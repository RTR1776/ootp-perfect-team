import pickle, numpy as np
from collections import defaultdict
d = pickle.load(open("data.pkl","rb"))
POS = ["C","1B","2B","3B","SS","LF","CF","RF"]
st = [g for g in d["fld"] if g["IP_1"] and g["IP_1"] >= 30 and g["ZR"] is not None and g[g["pos"]] is not None]
acc = defaultdict(lambda: [0.0,0.0])
for g in st: a = acc[(g["file"],g["pos"])]; a[0] += g["IP_1"]*g[g["pos"]]; a[1] += g["IP_1"]
fm = {k: v[0]/v[1] for k,v in acc.items()}
# file BIP rate from pitchers
bip = defaultdict(lambda: [0.0,0.0])
for g in d["pit"]:
    if g["IP"] and g["BF"] and None not in (g["K_1"],g["BB_1"],g["HR_1"]):
        b = bip[g["file"]]; b[0] += g["BF"]-g["K_1"]-g["BB_1"]-(g["HP_1"] or 0)-g["HR_1"]; b[1] += g["IP"]
bipr = {f: v[0]/v[1]*9 for f,v in bip.items() if v[1] > 0}
med = np.median(list(bipr.values())); q = np.percentile(list(bipr.values()), [25,75])
print(f"balls in play per 9: median {med:.1f}, IQR {q[0]:.1f}-{q[1]:.1f}")
# primary-position ladder: where would this card naturally play? difficulty order
HARD = {"C":9,"SS":8,"CF":7,"2B":6,"3B":5,"RF":4,"LF":3,"1B":2}
print("\nOut-of-position test: residual glove runs/season after rating (linear fit per position), by whether the card's own best-rated position is a different one")
for p in POS:
    S = [g for g in st if g["pos"]==p]
    rel = np.array([g[p]-fm[(g["file"],p)] for g in S]); w = np.array([g["IP_1"] for g in S])
    y = np.array([((g["ZR"] or 0)+(g["ARM"] or 0)+((g["FRM"] or 0) if p=="C" else 0))/g["IP_1"]*1400 for g in S])
    X = np.column_stack([np.ones(len(S)), rel]); b = np.linalg.lstsq(X*np.sqrt(w)[:,None], y*np.sqrt(w), rcond=None)[0]; r = y - X@b
    # "away": the card rates 15+ points higher somewhere else in the same fielding group
    grp = ["2B","3B","SS","1B"] if p in ("2B","3B","SS","1B") else (["LF","CF","RF"] if p in ("LF","CF","RF") else ["C"])
    away = np.array([max((g[o] or 0) for o in grp if o != p) - g[p] >= 15 if len(grp) > 1 else False for g in S])
    hi = np.array([bipr.get(g["file"], med) > med for g in S])
    out = f"  {p:2}"
    if away.any(): out += f"  playing off his best spot: {np.average(r[away],weights=w[away]):+.2f} (n {away.sum()}, {w[away].sum()/1e3:.0f}k inn) vs at it {np.average(r[~away],weights=w[~away]):+.2f}"
    # env: slope in high vs low BIP files
    sl = []
    for m in (hi, ~hi):
        Xm = X[m]; bm = np.linalg.lstsq(Xm*np.sqrt(w[m])[:,None], y[m]*np.sqrt(w[m]), rcond=None)[0]; sl.append(bm[1]*10)
    out += f" | per +10: high-BIP files {sl[0]:+.2f}, low-BIP {sl[1]:+.2f}"
    print(out)
