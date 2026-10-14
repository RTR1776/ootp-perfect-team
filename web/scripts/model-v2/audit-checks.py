import csv, sys, numpy as np
rows = list(csv.DictReader(open(sys.argv[1])))
num = lambda v: float(v) if v not in ("", None) else np.nan
def demean(x, g, w):
    x = x.astype(float).copy()
    for u in np.unique(g):
        m = g == u; x[m] -= np.average(x[m], weights=w[m])
    return x
def wls(X, y, w):
    sw = np.sqrt(w); b = np.linalg.lstsq(X*sw[:,None], y*sw, rcond=None)[0]; e = y - X@b
    XtWX = (X*w[:,None]).T@X; meat = (X*(w*e)[:,None]).T@(X*(w*e)[:,None]); cov = np.linalg.inv(XtWX)@meat@np.linalg.inv(XtWX)
    return b, np.sqrt(np.diag(cov))
# ----- bats: left-handed effect, by condition
B = [r for r in rows if r["is_pitcher"]=="0" and r["modelR"]]
g = np.array([r["series"] for r in B]); w = np.array([num(r["pa"]) for r in B]); L = np.array([num(r["lhp"]) for r in B])
y = np.array([num(r["woba"]) for r in B])/1.25*700; pred = (1-L)*np.array([num(r["modelR"]) for r in B]) + L*np.array([num(r["modelL"]) for r in B])
yd, pd = demean(y,g,w), demean(pred,g,w); b = np.sum(w*yd*pd)/np.sum(w*pd*pd); res = yd - b*pd
lhb = np.array([1.0 if r["bats"]=="L" else 0 for r in B]); sw_ = np.array([1.0 if r["bats"]=="S" else 0 for r in B])
yr = np.array([num(r["env_year"]) for r in B])
def eff(mask, label):
    X = np.column_stack([demean(lhb,g,w), demean(sw_,g,w)])[mask]; bb, se = wls(X, res[mask], w[mask])
    print(f"   {label:34s} LHB {bb[0]:+5.2f}±{se[0]:.2f}  switch {bb[1]:+5.2f}±{se[1]:.2f}  ({mask.sum()} card-series)")
print("LEFT-HANDED BATS: actual minus model, runs per 700 PA")
eff(np.ones(len(B),bool), "all series")
eff(L < 0.33, "fields throwing <33% LHP"); eff(L >= 0.33, "fields throwing 33%+ LHP")
eff(yr < 1946, "env before 1946"); eff((yr>=1946)&(yr<1994), "env 1946-1993"); eff(yr>=1994, "env 1994+")
# by the card's own split: are LHB under-credited vs RHP (their main side)?
# ----- arms: joint rating rebalance
P = [r for r in rows if r["is_pitcher"]=="1" and r["modelR"]]
g = np.array([r["series"] for r in P]); w = np.array([num(r["bf"]) for r in P])
y = -np.array([num(r["ra700"]) for r in P]); pred = 0.5*np.array([num(r["modelR"]) for r in P]) + 0.5*np.array([num(r["modelL"]) for r in P])
yd, pd = demean(y,g,w), demean(pred,g,w); b = np.sum(w*yd*pd)/np.sum(w*pd*pd); res = yd - b*pd
rel = np.array([1.0 if r["role"] in ("RP","CL") else 0 for r in P])
feat = ["Stuff","Control","pHR","pBABIP","Movement","Stamina"]
X = np.column_stack([demean(np.array([num(r["r_"+k]) for r in P]),g,w) for k in feat] + [demean(rel,g,w)])
ok = ~np.isnan(X).any(1)
bb, se = wls(X[ok], res[ok], w[ok])
print(f"\nARMS: joint fit of the residual (runs saved per 700 BF), model slope {b:.2f}")
for k, v, s in zip(feat+["reliever role (card RP/CL)"], bb, se): print(f"   {k:28s} {('%+.2f per +10' % (v*10)) if k!='reliever role (card RP/CL)' else ('%+.2f' % v):>14s} ±{(s*10 if k!='reliever role (card RP/CL)' else s):.2f}")
# usage: starters vs relievers by actual usage (GS share) instead of card role
gs = np.array([num(r.get("r_Stamina")) for r in P])
