import sys, csv, numpy as np
rows = list(csv.DictReader(open(sys.argv[1])))
K = ["BABIP","Gap","Power","Eye","Avoid K"]
RUNS = 10 * 700 / 1.2   # wOBA per rating point -> runs per 700 PA per +10
def arr(f): return np.array([f(r) for r in rows], float)
pa = arr(lambda r: float(r["pa"])); w = arr(lambda r: float(r["woba"]))
isL = np.array([r["split"]=="vL" for r in rows])
O = np.column_stack([arr(lambda r,k=k: float(r[f"o_{k}"])) for k in K])
S = np.column_stack([arr(lambda r,k=k: float(r[("l_" if r["split"]=="vL" else "r_")+k])) for k in K])
grp = np.array([f'{r["league"]}|{r["week"]}|{r["split"]}' for r in rows])
cid = np.array([r["cid"] for r in rows])
def demean(X, g, wt):
    X = X.astype(float).copy()
    for u in np.unique(g):
        m = g==u; X[m] -= np.average(X[m], axis=0, weights=wt[m])
    return X
def wls(X, y, wt):
    sw = np.sqrt(wt); b, *_ = np.linalg.lstsq(X*sw[:,None], y*sw, rcond=None)
    res = y - X@b; n,p = X.shape; s2 = (wt*res**2).sum()/(n-p)
    cov = s2*np.linalg.inv((X*wt[:,None]).T@X); return b, np.sqrt(np.diag(cov)), res
def r2(y,res,wt): return 1 - (wt*res**2).sum()/(wt*y**2).sum()
yd = demean(w[:,None], grp, pa)[:,0]
print(f"rows {len(rows)}, cards {len(set(cid))}, PA {pa.sum():,.0f} (vs LHP {pa[isL].sum():,.0f})\n")
fmt = lambda b,se: "  ".join(f"{k:>8} {b[i]*RUNS:5.2f}±{se[i]*RUNS:4.2f}" for i,k in enumerate(K))
Od, Sd = demean(O, grp, pa), demean(S, grp, pa)
bO,seO,resO = wls(Od, yd, pa); bS,seS,resS = wls(Sd, yd, pa)
print("A. overall ratings predict each split:  R2 %.3f\n   " % r2(yd,resO,pa) + fmt(bO,seO))
print("B. split ratings predict each split:    R2 %.3f\n   " % r2(yd,resS,pa) + fmt(bS,seS))
Dd = demean(S-O, grp, pa)
bC,seC,_ = wls(np.hstack([Od,Dd]), yd, pa)
print("C. overall + (split - overall) deviation, runs per 700 PA per +10:")
print("   overall   " + fmt(bC[:5],seC[:5])); print("   deviation " + fmt(bC[5:],seC[5:]))
print("   deviation / overall: " + "  ".join(f"{k} {bC[5+i]/bC[i]:.2f}" for i,k in enumerate(K)))
# held-out by card: fit on half the cards, score the other half
rng = np.random.default_rng(7); u = np.unique(cid); out = []
for rep in range(20):
    half = set(rng.choice(u, len(u)//2, replace=False)); tr = np.array([c in half for c in cid]); te = ~tr
    for name,X in (("overall",Od),("split",Sd)):
        b,_,_ = wls(X[tr], yd[tr], pa[tr]); res = yd[te]-X[te]@b; out.append((name, r2(yd[te],res,pa[te])))
for name in ("overall","split"): print(f"D. held-out cards (20 splits) R2, {name:>7}: {np.mean([v for n,v in out if n==name]):.3f}")
# E. within-card, within-week: vL minus vR
pair = {}
for i,r in enumerate(rows): pair.setdefault((r["league"],r["week"],r["cid"]),{})[r["split"]] = i
dy, dX, dw, bats = [], [], [], []
for k,v in pair.items():
    if "vL" in v and "vR" in v:
        i,j = v["vL"], v["vR"]; dy.append(w[i]-w[j]); dX.append(S[i]-S[j]); dw.append(1/(1/pa[i]+1/pa[j])); bats.append(rows[i]["bats"])
dy,dX,dw,bats = map(np.array,(dy,dX,dw,bats))
H = np.column_stack([(bats==h).astype(float) for h in ("L","R","S")])
bE,seE,resE = wls(np.hstack([dX,H]), dy, dw)
print(f"\nE. same card, same week: (vs LHP - vs RHP) on (split rating gap), {len(dy)} pairs")
print("   " + fmt(bE[:5],seE[:5]))
print("   vs the overall slopes (A): " + "  ".join(f"{k} {bE[i]/bO[i]:.2f}" for i,k in enumerate(K)))
print("   platoon intercepts (wOBA, vL-vR at equal ratings): L %.3f  R %.3f  S %.3f" % tuple(bE[5:]))
# how extreme are the gaps?
gap = np.abs(np.array([[float(r[f"l_{k}"])-float(r[f"r_{k}"]) for k in K] for r in rows]))
print("\n   typical |vL - vR| rating gap (median / 90th pct): " + "  ".join(f"{k} {np.median(gap[:,i]):.0f}/{np.percentile(gap[:,i],90):.0f}" for i,k in enumerate(K)))
