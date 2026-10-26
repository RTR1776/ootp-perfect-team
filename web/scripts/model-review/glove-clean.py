"""The 10-25 per-position glove prices, re-tested with BOTH price sets on the harness's
centred rating gaps (dpos.lin). The harness's own `def`/`dpos.prod` weight glove runs by PA
from fixed position means, so a team's plate appearances per game leak into it; the roster
objective scores one card per slot, where that constant cancels. (2026-10-25 model review)
  python3 -I scripts/model-review/glove-clean.py MV2_DIR
"""
import json, sys, numpy as np
POS = ["C","1B","2B","3B","SS","LF","CF","RF"]
SLOPE = {"C":.0362,"1B":.1407,"2B":.1744,"3B":.1501,"SS":.1562,"LF":.0895,"CF":.0643,"RF":.0973}
OLD = {"C":1.61,"1B":1.0,"2B":1.29,"3B":1.2,"SS":1.64,"LF":1.24,"CF":1.69,"RF":1.25}
NEW = {"C":1.61,"1B":0.77,"2B":1.83,"3B":0.86,"SS":2.1,"LF":2.22,"CF":3.38,"RF":1.41}
T = [t for t in json.load(open(f"{sys.argv[1]}/teams.json")) if t["kind"] == "tour" and t["W"] + t["L"] > 0]
def band(y): return "<=1945" if y < 1946 else "1946-76" if y < 1977 else "1977-93" if y < 1994 else "1994-09" if y < 2010 else "2010+"
units = sorted({t["unit"] for t in T}); ui = {u: i for i, u in enumerate(units)}
g = np.array([ui[t["unit"]] for t in T]); w = np.array([t["W"] + t["L"] for t in T], float); bands = np.array([band(t["year"]) for t in T])
y = np.array([t["W"] / (t["W"] + t["L"]) for t in T])
dp = lambda t, p: (t.get("dpos") or {}).get(p, {}).get("lin", 0.0)
glove = lambda cal: np.array([sum(SLOPE[p] * .887 * cal[p] * dp(t, p) for p in POS) for t in T])
base = np.array([t["off"] + t.get("frm", 0) + 1.5 * t["pitSP"] + 2 * t["pitRP"] for t in T])
gO, gN = glove(OLD), glove(NEW)
def centre(v, m):
    out = np.zeros(len(v))
    for u in np.unique(g[m]):
        s = (g == u) & m; out[s] = v[s] - np.average(v[s], weights=w[s])
    return out
def r(s, m):
    a, b, ww = centre(s, m)[m], centre(y, m)[m], w[m]
    return np.sum(ww * a * b) / np.sqrt(np.sum(ww * a * a) * np.sum(ww * b * b))
print(f"{len(T)} team-events")
for label, m in [("ALL", np.ones(len(T), bool))] + [(b, bands == b) for b in ("<=1945", "1946-76", "1977-93", "1994-09", "2010+")]:
    U = np.unique(g[m]); ro, rn = [], []
    for seed in range(20):
        rng = np.random.default_rng(seed); half = set(rng.choice(U, len(U) // 2, replace=False)); h = np.array([x in half for x in g])
        for part in (h & m, ~h & m):
            ro.append(r(base + 2 * gO, part)); rn.append(r(base + 2 * gN, part))
    ro, rn = np.array(ro), np.array(rn)
    print(f"   {label:8} old prices {ro.mean():.4f}  new prices {rn.mean():.4f} ({rn.mean() - ro.mean():+.4f}, better {np.sum(rn > ro)}/40)")
