"""Team weights on WINS on the archive harness (2026-10-25 model review).

Input: teams.json from scripts/model-v2/teams.mts with MV2_TOURDIR=Archive/Completed MV2_NO_LEAGUE=1.
Score = bats + D * gloves + F * framing + S * starters + R * pen (runs per game; bats = 1).
Gloves are rebuilt at TODAY's per-position prices (fielding.ts TOURNEY_FIELDING_CALIBRATION)
from the harness's per-position rating gaps (dpos.lin, already x gloveScale).
Held out: weights chosen on half the exports by a grid, scored (G-weighted win% r, centred
within each export) on the other half; 20 random halvings = 40 half-samples. Production is
D 2, F 1, S 1.5, R 2.
  python3 -I scripts/model-review/teamweights.py [MV2_DIR]
"""
import json, os, sys, itertools, numpy as np
D_ = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("MV2_DIR", "/tmp/mv2")
POS = ["C","1B","2B","3B","SS","LF","CF","RF"]
SLOPE = {"C":.0362,"1B":.1407,"2B":.1744,"3B":.1501,"SS":.1562,"LF":.0895,"CF":.0643,"RF":.0973}
CAL = {"C":1.61,"1B":0.77,"2B":1.83,"3B":0.86,"SS":2.1,"LF":2.22,"CF":3.38,"RF":1.41}
PRICE = {p: SLOPE[p] * 0.887 * CAL[p] for p in POS}
T = [t for t in json.load(open(f"{D_}/teams.json")) if t["kind"] == "tour" and t["W"] + t["L"] > 0]
def band(y): return "<=1945" if y < 1946 else "1946-76" if y < 1977 else "1977-93" if y < 1994 else "1994-09" if y < 2010 else "2010+"
units = sorted({t["unit"] for t in T}); ui = {u: i for i, u in enumerate(units)}
g = np.array([ui[t["unit"]] for t in T]); w = np.array([t["W"] + t["L"] for t in T], float)
y = np.array([t["W"] / (t["W"] + t["L"]) for t in T]); bands = np.array([band(t["year"]) for t in T])
dp = lambda t, p: (t.get("dpos") or {}).get(p, {}).get("lin", 0.0)
cols = {"off": [t["off"] for t in T], "glove": [sum(PRICE[p] * dp(t, p) for p in POS) for t in T], "frm": [t.get("frm", 0.0) for t in T], "sp": [t["pitSP"] for t in T], "rp": [t["pitRP"] for t in T]}
def centre(v):
    v = np.array(v, float).copy()
    for u in np.unique(g):
        m = g == u; v[m] -= np.average(v[m], weights=w[m])
    return v
X = {k: centre(v) for k, v in cols.items()}; yc = centre(y)
def r(score, m):
    s, a, ww = score[m], yc[m], w[m]; sm, am = np.average(s, weights=ww), np.average(a, weights=ww)
    return np.sum(ww * (s - sm) * (a - am)) / np.sqrt(np.sum(ww * (s - sm) ** 2) * np.sum(ww * (a - am) ** 2))
def score(D, F, S, R): return X["off"] + D * X["glove"] + F * X["frm"] + S * X["sp"] + R * X["rp"]
GRID = list(itertools.product([1.0, 1.25, 1.5, 1.75, 2.0, 2.5], [0.5, 0.75, 1.0, 1.5], [1.0, 1.25, 1.5, 1.75, 2.0], [1.5, 2.0, 2.5, 3.0]))
PROD = (2.0, 1.0, 1.5, 2.0)
S_ = {k: score(*k) for k in GRID}
def run(mask, label):
    U = np.unique(g[mask]); res_p, res_c, picks = [], [], []
    for seed in range(20):
        rng = np.random.default_rng(seed); half = set(rng.choice(U, len(U) // 2, replace=False)); h = np.array([x in half for x in g])
        for tr, te in ((h & mask, ~h & mask), (~h & mask, h & mask)):
            best = max(GRID, key=lambda k: r(S_[k], tr)); picks.append(best)
            res_c.append(r(S_[best], te)); res_p.append(r(S_[PROD], te))
    res_p, res_c = np.array(res_p), np.array(res_c)
    full = max(GRID, key=lambda k: r(S_[k], mask))
    pk = np.array(picks)
    print(f"{label:9} n={mask.sum():6d} teams in {len(U):4d} exports | production {res_p.mean():.4f} | grid-chosen held out {res_c.mean():.4f} ({res_c.mean() - res_p.mean():+.4f}, better {np.sum(res_c > res_p)}/40) | full-sample best D {full[0]} F {full[1]} S {full[2]} R {full[3]} | fold picks median D {np.median(pk[:,0])} F {np.median(pk[:,1])} S {np.median(pk[:,2])} R {np.median(pk[:,3])}")
    return full
print(f"{len(T)} team-events, {len(units)} exports; production D/F/S/R = {PROD}")
run(np.ones(len(T), bool), "ALL")
for b in ("<=1945", "1946-76", "1977-93", "1994-09", "2010+"):
    m = bands == b
    if m.sum() > 500: run(m, b)
# fixed candidates against production on the same halves
print("\nfixed candidates vs production, ALL (held-out r, 40 half-samples):")
U = np.unique(g)
cands = [PROD, (1.5, 1.0, 1.5, 2.0), (1.5, 0.75, 1.25, 2.5), (1.5, 0.75, 1.5, 2.0), (1.25, 0.75, 1.25, 2.5), (1.5, 1.0, 1.25, 2.5), (1.75, 1.0, 1.5, 2.0), (2.0, 1.0, 1.25, 2.5)]
base = []
for seed in range(20):
    rng = np.random.default_rng(seed); half = set(rng.choice(U, len(U) // 2, replace=False)); h = np.array([x in half for x in g])
    base += [h, ~h]
rp = np.array([r(S_[PROD], m) for m in base])
for c in cands:
    sc = S_.get(c) if c in S_ else score(*c)
    rc = np.array([r(sc, m) for m in base])
    print(f"   D {c[0]} F {c[1]} S {c[2]} R {c[3]}:  {rc.mean():.4f}  {rc.mean() - rp.mean():+.4f}  better in {np.sum(rc > rp)}/40")
