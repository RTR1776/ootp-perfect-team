import csv, sys, numpy as np, collections
rows = list(csv.DictReader(open(sys.argv[1])))
def num(v):
    try: return float(v)
    except: return np.nan
def demean(x, g, w):
    x = x.copy()
    for u in np.unique(g):
        m = g == u; mm = m & ~np.isnan(x)
        if mm.sum(): x[m] = x[m] - np.average(x[mm], weights=w[mm])
    return x
def scan(sub, y, pred, w, feats, label, unit):
    g = np.array([r["series"] for r in sub]); series = np.unique(g)
    yd, pd = demean(y, g, w), demean(pred, g, w)
    b = np.sum(w*yd*pd)/np.sum(w*pd*pd); res = yd - b*pd
    r_m = np.sum(w*yd*pd)/np.sqrt(np.sum(w*yd*yd)*np.sum(w*pd*pd))
    print(f"\n=== {label}: {len(sub)} card-series, {len(series)} series · model vs actual within series r {r_m:.3f}, slope {b:.2f} ===")
    rng = np.random.default_rng(11); halves = [set(rng.choice(series, len(series)//2, replace=False)) for _ in range(1)][0]
    h = np.array([s in halves for s in g])
    out = []
    for name, x in feats.items():
        ok = ~np.isnan(x)
        if ok.sum() < 300 or np.nanstd(x) == 0: continue
        xd = demean(np.where(ok, x, np.nan), g, w); ok = ~np.isnan(xd)
        def fit(m):
            m = m & ok; X = xd[m]; R = res[m]; W = w[m]
            beta = np.sum(W*X*R)/np.sum(W*X*X); e = R - beta*X
            se = np.sqrt(np.sum(W*W*e*e*X*X))/np.sum(W*X*X)  # robust
            return beta, se
        b_all, se = fit(np.ones(len(sub), bool)); b1,_ = fit(h); b2,_ = fit(~h)
        sd = np.sqrt(np.average(xd[ok]**2, weights=w[ok]))
        out.append((abs(b_all*sd), name, b_all*10, se*10, b1*10, b2*10, sd, b_all/se))
    print(f"   {'feature':26s} {unit+' per +10':>16s}   t     half A   half B   effect of 1 sd")
    for eff, name, b10, se10, h1, h2, sd, t in sorted(out, reverse=True)[:22]:
        flag = "✓" if (np.sign(h1)==np.sign(h2) and abs(t)>3) else " "
        print(f" {flag} {name:26s} {b10:+8.2f} ±{se10:4.2f}  {t:+6.1f}  {h1:+7.2f}  {h2:+7.2f}   {eff*np.sign(b10):+6.2f} (sd {sd:.0f})")
# ---------- bats
B = [r for r in rows if r["is_pitcher"]=="0"]
w = np.array([num(r["pa"]) for r in B]); y = (np.array([num(r["woba"]) for r in B]))/1.25*700
L = np.array([num(r["lhp"]) for r in B]); pred = (1-L)*np.array([num(r["modelR"]) for r in B]) + L*np.array([num(r["modelL"]) for r in B])
keep = ~np.isnan(pred) & ~np.isnan(y); B=[r for r,k in zip(B,keep) if k]; w,y,pred=w[keep],y[keep],pred[keep]
F = {}
for k in rows[0].keys():
    if k.startswith("r_") and not k.startswith("r_Pos_Rating_P") and not any(s in k for s in ("Stuff","Control","pHR","pBABIP","Movement","Stamina","Hold","Fastball","Changeup","Curveball","Slider","Sinker","Splitter","Cutter","Forkball","Circlechange","Screwball","Knuckle","Arm_Slot","GB","Learn")):
        F[k[2:]] = np.array([num(r[k]) for r in B])
F["card value"] = np.array([num(r["val"]) for r in B])
F["card year - env year"] = np.array([num(r["cyear"]) for r in B]) - np.array([num(r["env_year"]) for r in B])
F["bats switch"] = np.array([1.0 if r["bats"]=="S" else 0.0 for r in B]); F["bats left"] = np.array([1.0 if r["bats"]=="L" else 0.0 for r in B])
F["LE card"] = np.array([1.0 if r["sub"]=="LE" else 0.0 for r in B])
F["split gap |BABIP vL-vR|"] = np.abs(F["BABIP_vL"]-F["BABIP_vR"]); F["split gap |Power vL-vR|"] = np.abs(F["Power_vL"]-F["Power_vR"])
scan(B, y, pred, w, F, "BATS: wOBA runs vs model (speed/baserunning not in either)", "runs/700 PA")
# baserunning: SB/CS runs per 700 PA vs ratings (model's only speed term is SPEED_RUNS_PER_POINT)
sbr = (0.2*np.array([num(r["sb"]) for r in B]) - 0.42*np.array([num(r["cs"]) for r in B]))/w*700
scan(B, sbr, np.zeros_like(sbr)+1e-9*np.arange(len(sbr)), w, {k: F[k] for k in ("Speed","Stealing","Steal_Rate","Baserunning","card value")}, "BATS: stolen-base runs (SB×0.2 − CS×0.42) per 700 PA", "runs/700 PA")
# ---------- arms
P = [r for r in rows if r["is_pitcher"]=="1"]
w = np.array([num(r["bf"]) for r in P]); y = -np.array([num(r["ra700"]) for r in P])
pred = 0.5*np.array([num(r["modelR"]) for r in P]) + 0.5*np.array([num(r["modelL"]) for r in P])
keep = ~np.isnan(pred) & ~np.isnan(y); P=[r for r,k in zip(P,keep) if k]; w,y,pred=w[keep],y[keep],pred[keep]
G = {}
for k in rows[0].keys():
    if k.startswith("r_") and any(s in k for s in ("Stuff","Control","pHR","pBABIP","Movement","Stamina","Hold","Fastball","Changeup","Curveball","Slider","Sinker","Splitter","Cutter","Forkball","Circlechange","Screwball","Knuckle","Arm_Slot","GB","Height","Pos_Rating_P","Infield")):
        G[k[2:]] = np.array([num(r[k]) for r in P])
pitches = [k for k in G if k in ("Fastball","Changeup","Curveball","Slider","Sinker","Splitter","Cutter","Forkball","Circlechange","Screwball","Knuckleball","Knucklecurve")]
G["pitch count (rated 40+)"] = np.array([sum(1 for k in pitches if (num(r["r_"+k]) or 0) >= 40) for r in P], float)
G["best pitch"] = np.nanmax(np.column_stack([G[k] for k in pitches]), axis=1)
G["card value"] = np.array([num(r["val"]) for r in P]); G["throws left"] = np.array([1.0 if r["throws"]=="L" else 0.0 for r in P])
G["card year - env year"] = np.array([num(r["cyear"]) for r in P]) - np.array([num(r["env_year"]) for r in P])
G["reliever role"] = np.array([1.0 if r["role"] in ("RP","CL") else 0.0 for r in P])
scan(P, y, pred, w, G, "ARMS: runs allowed per 700 BF (sign flipped: + = better) vs model", "runs saved/700 BF")
