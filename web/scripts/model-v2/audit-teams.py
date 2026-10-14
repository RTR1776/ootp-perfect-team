import csv, sys, glob, numpy as np, collections
files = glob.glob(sys.argv[1] + "/Cap Exports/*.csv") + glob.glob(sys.argv[1] + "/PTCS7 Championship/*_all.csv")
def f(r,k):
    try: return float(r.get(k) or 0)
    except ValueError: return 0.0
T = []
for fi, fn in enumerate(files):
    teams = collections.defaultdict(list)
    for r in csv.DictReader(open(fn, encoding="utf-8-sig")): teams[r["ORG"]].append(r)
    for org, rs in teams.items():
        W = sum(f(r,"W") for r in rs); L = sum(f(r,"L") for r in rs)
        if W + L < 15: continue
        bats = [r for r in rs if f(r,"PA") > 0]; arms = [r for r in rs if f(r,"BF") > 0]
        pa = np.array([f(r,"PA") for r in bats]); bf = np.array([f(r,"BF") for r in arms])
        if pa.sum() == 0 or bf.sum() == 0: continue
        bw = lambda k: np.average([f(r,k) for r in bats], weights=pa)
        aw = lambda k: np.average([f(r,k) for r in arms], weights=bf)
        cats = [r for r in bats if f(r,"IP_1") > 0 and r["POS"]=="C"]
        frm = np.average([f(r,"C FRM") for r in cats], weights=[f(r,"IP_1") for r in cats]) if cats else np.nan
        sp_bf = sum(f(r,"BF") for r in arms if f(r,"GS_1") > 0.5*f(r,"G_1")) / bf.sum()
        T.append(dict(file=fi, win=W/(W+L), games=W+L,
            BABIP=bw("BABIP"), GAP=bw("GAP"), POW=bw("POW"), EYE=bw("EYE"), K=bw("K's"),
            STU=aw("STU"), CON=aw("CON"), PBABIP=aw("PBABIP"), HRA=aw("HRA"),
            SPE=bw("SPE"), STE=bw("STE"), RUN=bw("RUN"),
            LHB=np.average([1.0 if r["B"]=="L" else 0 for r in bats], weights=pa),
            STM=aw("STM"), FRM=frm, SPshare=sp_bf,
            BUN=0.0, BFH=0.0, VELO=np.nan))
print(f"{len(files)} exports, {len(T)} team-events")
keys = ["BABIP","GAP","POW","EYE","K","STU","CON","PBABIP","HRA","SPE","STE","RUN","LHB","STM","FRM","SPshare"]
modeled = ["BABIP","GAP","POW","EYE","K","STU","CON","PBABIP","HRA"]
D = np.array([[t[k] for k in keys] for t in T], float); y = np.array([t["win"] for t in T]); w = np.array([t["games"] for t in T]); g = np.array([t["file"] for t in T])
ok = ~np.isnan(D).any(1); D, y, w, g = D[ok], y[ok], w[ok], g[ok]
def dm(X):
    X = X.copy()
    for u in np.unique(g):
        m = g==u; X[m] -= np.average(X[m], axis=0, weights=w[m])
    return X
Z = dm(D); Z /= np.sqrt(np.average(Z**2, axis=0, weights=w)); yd = dm(y[:,None])[:,0]
def fit(cols):
    X = Z[:, [keys.index(c) for c in cols]]; sw = np.sqrt(w); b = np.linalg.lstsq(X*sw[:,None], yd*sw, rcond=None)[0]
    e = yd - X@b; XtWX=(X*w[:,None]).T@X; meat=(X*(w*e)[:,None]).T@(X*(w*e)[:,None]); se=np.sqrt(np.diag(np.linalg.inv(XtWX)@meat@np.linalg.inv(XtWX)))
    r2 = 1 - np.sum(w*e*e)/np.sum(w*yd*yd); return b, se, r2
b0, s0, r0 = fit(modeled); b1, s1, r1 = fit(keys)
print(f"win% explained by the modeled ratings alone: R² {r0:.3f}; adding the unmodeled traits: R² {r1:.3f}")
print("effect of +1 sd of each team trait on win% (points), all traits together:")
for k, b, s in sorted(zip(keys, b1, s1), key=lambda x: -abs(x[1]/x[2])):
    print(f"   {'·' if k in modeled else '★'} {k:8s} {100*b:+5.2f} ±{100*s:.2f}  t {b/s:+5.1f}")
# halves by file
rng = np.random.default_rng(3); half = set(rng.choice(np.unique(g), len(np.unique(g))//2, replace=False)); h = np.array([x in half for x in g])
for name, m in (("half A", h), ("half B", ~h)):
    X = Z[m]; sw = np.sqrt(w[m]); b = np.linalg.lstsq(X*sw[:,None], yd[m]*sw, rcond=None)[0]
    print(f"   {name}: " + "  ".join(f"{k} {100*v:+.1f}" for k, v in zip(keys, b) if k not in modeled))
