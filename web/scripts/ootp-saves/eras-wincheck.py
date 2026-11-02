"""Era table test on WINS: production eras.json vs pre-1949 years from OOTP's era_stats.txt.
Both harnesses built with the same production code; only src/data/eras.json differs.
Score = off + glove + frm + sp + rp at production TEAM_WEIGHTS; win% r within export, 40 export half-samples.
  python3 -I erascmp.py PROD_DIR GAME_DIR"""
import json, sys, numpy as np
POS = ["C","1B","2B","3B","SS","LF","CF","RF"]
SLOPE = {"C":.0362,"1B":.1407,"2B":.1744,"3B":.1501,"SS":.1562,"LF":.0895,"CF":.0643,"RF":.0973}
CAL = {"C":1.61,"1B":1.0,"2B":1.29,"3B":1.2,"SS":1.64,"LF":1.24,"CF":1.69,"RF":1.25}
def wts(y): return (1.25,.5,1,3) if 1977<=y<1994 else (1.25,.5,1,2.5) if 1994<=y<2010 else (2,1,1.5,2)
def load(d): return {(t["unit"], t["org"]): t for t in json.load(open(f"{d}/teams.json")) if t["kind"] == "tour" and t["W"] + t["L"] > 0}
P, Q = load(sys.argv[1]), load(sys.argv[2])
keys = sorted(set(P) & set(Q)); print(f"{len(keys)} team-events in both; only-game {len(set(Q)-set(P))}, only-prod {len(set(P)-set(Q))}")
dp = lambda t, p: (t.get("dpos") or {}).get(p, {}).get("lin", 0.0)
glove = lambda t: sum(SLOPE[p] * .887 * CAL[p] * dp(t, p) for p in POS)
def score(t, part="all"):
    D, F, S, R = wts(t["year"])
    if part == "off": return t["off"]
    if part == "pit": return S * t["pitSP"] + R * t["pitRP"]
    return t["off"] + D * glove(t) + F * t.get("frm", 0) + S * t["pitSP"] + R * t["pitRP"]
y = np.array([P[k]["W"] / (P[k]["W"] + P[k]["L"]) for k in keys]); w = np.array([P[k]["W"] + P[k]["L"] for k in keys], float)
units = np.array([k[0] for k in keys]); yrs = np.array([P[k]["year"] for k in keys])
def centre(v, m):
    out = np.zeros(len(v))
    for u in np.unique(units[m]):
        s = (units == u) & m; out[s] = v[s] - np.average(v[s], weights=w[s])
    return out
def r(s, m):
    a, b, ww = centre(s, m)[m], centre(y, m)[m], w[m]
    return np.sum(ww * a * b) / np.sqrt(np.sum(ww * a * a) * np.sum(ww * b * b))
changed = np.array([abs(score(P[k]) - score(Q[k])) > 1e-9 for k in keys])
print(f"team-events whose score changed: {changed.sum()} (years {sorted(set(yrs[changed]))})")
for part in ("all", "off", "pit"):
    a = np.array([score(P[k], part) for k in keys]); b = np.array([score(Q[k], part) for k in keys])
    for lo, hi, lab in ((0, 1920, "<=1920"), (1921, 1948, "1921-48"), (0, 1948, "<=1948")):
        m = (yrs >= lo) & (yrs <= hi)
        U = np.unique(units[m])
        if len(U) < 4: continue
        ra, rb = [], []
        for seed in range(20):
            rng = np.random.default_rng(seed); half = set(rng.choice(U, len(U) // 2, replace=False)); h = np.array([x in half for x in units])
            for pm in (h & m, ~h & m): ra.append(r(a, pm)); rb.append(r(b, pm))
        ra, rb = np.array(ra), np.array(rb)
        print(f"  {part:3} {lab:8} exports {len(U):3d} teams {m.sum():6d}  prod {r(a,m):.4f}  game {r(b,m):.4f}  diff {rb.mean()-ra.mean():+.4f} ({np.sum(rb > ra)}/40)")
