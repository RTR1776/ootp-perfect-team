import pickle, numpy as np
from collections import defaultdict
d = pickle.load(open("data.pkl","rb"))
POS = ["C","1B","2B","3B","SS","LF","CF","RF"]
SEASON = 1400
def target(g):
    t = g["ZR"] + (g["ARM"] or 0)
    if g["pos"] == "C": t += (g["FRM"] or 0)
    return t
st = [g for g in d["fld"] if g["IP_1"] and g["IP_1"] >= 30 and g["ZR"] is not None and g[g["pos"]] is not None]
# field mean rating per (file,pos), innings weighted
acc = defaultdict(lambda: [0.0,0.0])
for g in st: a = acc[(g["file"],g["pos"])]; a[0] += g["IP_1"]*g[g["pos"]]; a[1] += g["IP_1"]
fm = {k: v[0]/v[1] for k,v in acc.items()}
res = {}
BINS = [-999,-45,-30,-20,-10,0,10,20,999]
for p in POS:
    S = [g for g in st if g["pos"] == p]
    rel = np.array([g[p]-fm[(g["file"],p)] for g in S]); y = np.array([target(g)/g["IP_1"]*SEASON for g in S]); w = np.array([g["IP_1"] for g in S]); fl = np.array([g["file"] for g in S])
    absr = np.array([g[p] for g in S])
    # linear + hinge below -20, weighted LS; cluster bootstrap by file for SE
    def fit(idx):
        X = np.column_stack([np.ones(idx.sum()), rel[idx], np.minimum(rel[idx]+20,0)])
        W = w[idx]; b = np.linalg.lstsq(X*np.sqrt(W)[:,None], y[idx]*np.sqrt(W), rcond=None)[0]; return b
    allidx = np.ones(len(S), bool); b = fit(allidx)
    files = np.unique(fl); rng = np.random.default_rng(1); bs = []
    pos_of = defaultdict(list)
    for i,f in enumerate(fl): pos_of[f].append(i)
    for _ in range(200):
        pick = rng.choice(files, len(files)); idx = np.concatenate([pos_of[f] for f in pick])
        m = np.zeros(len(S), bool); 
        X = np.column_stack([np.ones(len(idx)), rel[idx], np.minimum(rel[idx]+20,0)]); W = w[idx]
        bs.append(np.linalg.lstsq(X*np.sqrt(W)[:,None], y[idx]*np.sqrt(W), rcond=None)[0])
    se = np.std(bs, axis=0)
    print(f"\n{p}: {len(S)} stints, {w.sum()/1e3:.0f}k inn, field mean rating {np.average(absr,weights=w):.0f}  "
          f"slope {b[1]*10:+.2f} runs/season per +10  extra slope below -20: {b[2]*10:+.2f} ± {se[2]*10:.2f}")
    for lo,hi in zip(BINS[:-1],BINS[1:]):
        m = (rel>=lo)&(rel<hi)
        if w[m].sum() < 2000: print(f"   rel {lo:>4}..{hi:<4} thin ({w[m].sum():.0f} inn)"); continue
        mu = np.average(y[m],weights=w[m]); 
        print(f"   rel {lo:>4}..{hi:<4} n={m.sum():5d} inn={w[m].sum()/1e3:6.0f}k  mean rel {np.average(rel[m],weights=w[m]):+5.1f}  runs/season {mu:+5.1f}")
