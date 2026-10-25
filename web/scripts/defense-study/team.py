import pickle, numpy as np
from collections import defaultdict
d = pickle.load(open("data.pkl","rb"))
POS = ["C","1B","2B","3B","SS","LF","CF","RF"]
# field means per file/pos (fielders) and per file (pitcher ratings)
T = defaultdict(lambda: {"ip":0,"ra":0,"hr":0,"bbh":0,"k":0,"bf":0,"pr":np.zeros(4),"zr":0.0, **{f"r{p}":0.0 for p in POS}, **{f"i{p}":0.0 for p in POS}})
for g in d["pit"]:
    if not g["IP"] or g["IP"] <= 0 or None in (g["R_1"],g["HR_1"],g["BB_1"],g["K_1"],g["BF"]): continue
    t = T[(g["file"],g["org"])]; ip = g["IP"]
    t["ip"] += ip; t["ra"] += g["R_1"]; t["hr"] += g["HR_1"]; t["bbh"] += g["BB_1"] + (g["HP_1"] or 0); t["k"] += g["K_1"]; t["bf"] += g["BF"]
    t["pr"] += ip*np.array([g["STU"] or 0, g["CON"] or 0, g["HRA"] or 0, g["PBABIP"] or 0])
for g in d["fld"]:
    p = g["pos"]; ip = g["IP_1"] or 0
    if ip <= 0 or g[p] is None: continue
    t = T[(g["file"],g["org"])]; t[f"r{p}"] += ip*g[p]; t[f"i{p}"] += ip
    t["zr"] += (g["ZR"] or 0) + (g["ARM"] or 0) + ((g["FRM"] or 0) if p=="C" else 0)
rows = []
for (f,org),t in T.items():
    if t["ip"] < 45: continue
    if any(t[f"i{p}"] < 0.8*t["ip"] for p in POS): continue
    rows.append((f, t["ip"], t["ra"]/t["ip"]*1400, *(t["pr"]/t["ip"]), *[t[f"r{p}"]/t[f"i{p}"] for p in POS], t["hr"]/t["ip"]*1400, t["bbh"]/t["ip"]*1400, t["k"]/t["ip"]*1400, t["zr"]/t["ip"]*1400))
A = np.array(rows); f = A[:,0].astype(int); w = A[:,1]; y = A[:,2]
print(f"{len(A)} team-events, {len(np.unique(f))} exports, median {np.median(w):.0f} IP")
def demean(M):
    M = M.copy()
    for fi in np.unique(f):
        m = f==fi; M[m] -= np.average(M[m], axis=0, weights=w[m])
    return M
def run(cols, names, label):
    X = demean(A[:,cols]); yy = demean(y[:,None])[:,0]
    sw = np.sqrt(w); b = np.linalg.lstsq(X*sw[:,None], yy*sw, rcond=None)[0]
    files = np.unique(f); idxs = {fi: np.where(f==fi)[0] for fi in files}; rng = np.random.default_rng(2); bs=[]
    for _ in range(300):
        ix = np.concatenate([idxs[x] for x in rng.choice(files, len(files))])
        bs.append(np.linalg.lstsq(X[ix]*sw[ix,None], yy[ix]*sw[ix], rcond=None)[0])
    se = np.std(bs, axis=0)
    print(f"\n{label}")
    for n,bb,s in zip(names,b,se): print(f"   {n:10} {bb:+8.3f} ± {s:.3f}")
# (b) pitcher ratings + glove ratings: total defensive value per rating point (runs allowed per 1400 IP)
run(list(range(3,7))+list(range(7,15)), ["STU","CON","HRA","PBABIP"]+[f"glove {p}" for p in POS], "Runs allowed per 1,400 IP on pitcher ratings + glove ratings (per rating point; ×10 for per +10)")
# (c) does ZR capture it? RA on FIP components + team ZR
run([15,16,17,18], ["HR","BB+HBP","K","team ZR+ARM+FRM"], "Runs allowed per 1,400 IP on FIP components + team defensive runs (ZR+ARM+FRM)")
# (d) glove ratings with FIP components held: the balls-in-play part only
run([15,16,17]+list(range(7,15)), ["HR","BB+HBP","K"]+[f"glove {p}" for p in POS], "Same, glove ratings with FIP components held (balls-in-play part only)")
