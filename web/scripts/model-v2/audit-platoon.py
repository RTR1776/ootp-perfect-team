import csv, sys, numpy as np
rows = list(csv.DictReader(open(sys.argv[1])))
K = ["BABIP","Gap","Power","Eye","Avoid K"]
pa = np.array([float(r["pa"]) for r in rows]); w = np.array([float(r["woba"]) for r in rows])
S = np.column_stack([[float(r[("l_" if r["split"]=="vL" else "r_")+k]) for r in rows] for k in K])
grp = np.array([f'{r["league"]}|{r["week"]}|{r["split"]}' for r in rows])
def dm(X):
    X = X.astype(float).copy()
    for u in np.unique(grp):
        m = grp==u; X[m] -= np.average(X[m], axis=0, weights=pa[m])
    return X
for split in ("vR","vL"):
    m = np.array([r["split"]==split for r in rows])
    L = np.array([1.0 if r["bats"]=="L" else 0 for r in rows]); Sw = np.array([1.0 if r["bats"]=="S" else 0 for r in rows])
    X = dm(np.column_stack([S, L, Sw]))[m]; y = dm(w[:,None])[m,0]; ww = pa[m]
    sw = np.sqrt(ww); b = np.linalg.lstsq(X*sw[:,None], y*sw, rcond=None)[0]
    e = y - X@b; XtWX=(X*ww[:,None]).T@X; meat=(X*(ww*e)[:,None]).T@(X*(ww*e)[:,None]); se=np.sqrt(np.diag(np.linalg.inv(XtWX)@meat@np.linalg.inv(XtWX)))
    R = 700/1.2
    print(f"league, {split} only, at equal split ratings: lefty bat {b[5]*R:+.2f}±{se[5]*R:.2f} runs/700 PA · switch {b[6]*R:+.2f}±{se[6]*R:.2f}  ({m.sum()} card-weeks)")
