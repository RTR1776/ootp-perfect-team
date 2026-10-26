"""Ratings the production score still misprices at team level (2026-10-25 model review).

Residual of win% after the production score (bats + 2 gloves + framing + 1.5 starters + 2 pen,
gloves at today's per-position prices), regressed within each export on the team's PA/BF-weighted
ratings (teams.mts `tr`), one at a time and all together; standard errors by resampling exports,
and the sign checked in both halves of a 2-fold split.
  python3 -I scripts/model-review/trait-scan.py [MV2_DIR]
"""
import json, os, sys, numpy as np
D_ = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("MV2_DIR", "/tmp/mv2")
POS = ["C","1B","2B","3B","SS","LF","CF","RF"]
SLOPE = {"C":.0362,"1B":.1407,"2B":.1744,"3B":.1501,"SS":.1562,"LF":.0895,"CF":.0643,"RF":.0973}
CAL = {"C":1.61,"1B":0.77,"2B":1.83,"3B":0.86,"SS":2.1,"LF":2.22,"CF":3.38,"RF":1.41}
T = [t for t in json.load(open(f"{D_}/teams.json")) if t["kind"] == "tour" and t["W"] + t["L"] > 0]
def band(y): return "<=1945" if y < 1946 else "1946-76" if y < 1977 else "1977-93" if y < 1994 else "1994-09" if y < 2010 else "2010+"
units = sorted({t["unit"] for t in T}); ui = {u: i for i, u in enumerate(units)}
g = np.array([ui[t["unit"]] for t in T]); w = np.array([t["W"] + t["L"] for t in T], float)
dp = lambda t, p: (t.get("dpos") or {}).get(p, {}).get("lin", 0.0)
score = np.array([t["off"] + 2 * sum(SLOPE[p] * .887 * CAL[p] * dp(t, p) for p in POS) + t.get("frm", 0) + 1.5 * t["pitSP"] + 2 * t["pitRP"] for t in T])
y = np.array([t["W"] / (t["W"] + t["L"]) for t in T])
KEYS = ["bat Power", "bat Eye", "bat Avoid Ks", "bat BABIP", "bat Gap", "bat Speed", "bat Stealing", "bat Baserunning", "arm Stuff", "arm Control", "arm pHR", "arm pBABIP", "arm Stamina", "LHB share", "LHP share", "starter BF share"]
TR = np.array([[t["tr"].get(k, np.nan) for k in KEYS] for t in T], float)
ok = ~np.isnan(TR).any(1)
def centre(v, m):
    v = v[m].astype(float).copy(); gg = g[m]; ww = w[m]
    for u in np.unique(gg):
        s = gg == u; v[s] -= np.average(v[s], axis=0, weights=ww[s])
    return v
m = ok
sc, yy, Z = centre(score, m), centre(y, m), centre(TR, m)
ww = w[m]; gg = g[m]
b0 = np.sum(ww * sc * yy) / np.sum(ww * sc * sc); res = yy - b0 * sc   # win% per run of score
Zs = Z / np.sqrt(np.average(Z ** 2, axis=0, weights=ww))
U = np.unique(gg); idx = {u: np.where(gg == u)[0] for u in U}; rng = np.random.default_rng(9)
def fit(X, v, ix): sw = np.sqrt(ww[ix]); return np.linalg.lstsq(X[ix] * sw[:, None], v[ix] * sw, rcond=None)[0]
allix = np.arange(len(res))
B = fit(Zs, res, allix); bs = [fit(Zs, res, np.concatenate([idx[u] for u in rng.choice(U, len(U))])) for _ in range(200)]
SE = np.std(bs, 0)
half = set(rng.choice(U, len(U) // 2, replace=False)); h = np.array([x in half for x in gg])
BA, BB = fit(Zs, res, np.where(h)[0]), fit(Zs, res, np.where(~h)[0])
print(f"{m.sum()} team-events; win% per run/game of production score {b0:.4f}")
print("residual win% per +1 sd of the team's rating, all together (in runs/game of score: ÷ the line above)")
for k, b, s, a1, a2 in sorted(zip(KEYS, B, SE, BA, BB), key=lambda x: -abs(x[1] / x[2])):
    flag = " <-- both halves agree" if np.sign(a1) == np.sign(a2) and abs(b / s) >= 2.5 else ""
    print(f"   {k:18} {100*b:+6.2f} pts ± {100*s:.2f}  t {b/s:+5.1f}  halves {100*a1:+.2f} / {100*a2:+.2f}  = {b/b0:+.3f} runs/game per sd{flag}")
