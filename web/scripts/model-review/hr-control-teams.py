"""Team-win held-out test for the Control HR hinge (production score as endtoend.py, by band).
  python3 -I scripts/model-review/hr-control-teams.py $MV2_DIR/teams.json   (teams.mts carries the arm conH* traits)"""
import json, sys, numpy as np
T = [t for t in json.load(open(sys.argv[1])) if t["kind"] == "tour" and t["W"] + t["L"] > 0]
POS = ["C","1B","2B","3B","SS","LF","CF","RF"]
SLOPE = {"C":.0362,"1B":.1407,"2B":.1744,"3B":.1501,"SS":.1562,"LF":.0895,"CF":.0643,"RF":.0973}
CAL = {"C":1.61,"1B":1.0,"2B":1.29,"3B":1.2,"SS":1.64,"LF":1.24,"CF":1.69,"RF":1.25}
def band(y): return "<=1945" if y < 1946 else "1946-76" if y < 1977 else "1977-93" if y < 1994 else "1994-09" if y < 2010 else "2010+"
PROD = (2, 1, 1.5, 2); W = {"<=1945": PROD, "1946-76": PROD, "1977-93": (1.25, .5, 1, 3), "1994-09": (1.25, .5, 1, 2.5), "2010+": PROD}
dp = lambda t, p: (t.get("dpos") or {}).get(p, {}).get("lin", 0.0)
glove = lambda t: sum(SLOPE[p] * .887 * CAL[p] * dp(t, p) for p in POS)
base = np.array([(lambda D, F, S, R: t["off"] + D * glove(t) + F * t.get("frm", 0) + S * t["pitSP"] + R * t["pitRP"])(*W[band(t["year"])]) for t in T])
y = np.array([t["W"] / (t["W"] + t["L"]) for t in T]); w = np.array([t["W"] + t["L"] for t in T], float)
units = np.array([t["unit"] for t in T]); bands = np.array([band(t["year"]) for t in T])
print(len(T), "team-events;", {b: int((bands == b).sum()) for b in np.unique(bands)})
def centre(v, m):
    out = np.zeros(len(v))
    for u in np.unique(units[m]):
        s = (units == u) & m; out[s] = v[s] - np.average(v[s], weights=w[s])
    return out
def r(s, m):
    a, b, ww = centre(s, m)[m], centre(y, m)[m], w[m]
    return np.sum(ww * a * b) / np.sqrt(np.sum(ww * a * a) * np.sum(ww * b * b))
def fit(X, m):
    A = np.column_stack([centre(base, m)[m], centre(X, m)[m]]); b = centre(y, m)[m]; ww = w[m]
    c = np.linalg.lstsq(A * np.sqrt(ww)[:, None], b * np.sqrt(ww), rcond=None)[0]; return c[1] / c[0]
def test(key, m, label):
    X = np.array([t["tr"].get(key, 0.0) for t in T]); U = np.unique(units[m]); g, ks = [], []
    if len(U) < 4: print(f"{label:8} {key}: only {len(U)} exports"); return
    for seed in range(20):
        rng = np.random.default_rng(seed); half = set(rng.choice(U, len(U) // 2, replace=False)); hm = np.isin(units, list(half))
        for tr, te in ((hm & m, ~hm & m), (~hm & m, hm & m)):
            k = fit(X, tr); ks.append(k); g.append(r(base + k * X, te) - r(base, te))
    g = np.array(g); sdx = np.std(centre(X, m)[m])
    print(f"{label:8} {key:20} exports {len(U):3}  base r {r(base, m):.4f}  k {np.median(ks):+.3f} runs/game per unit (sd of trait {sdx:.3f})  held out {g.mean():+.5f}  better {np.sum(g > 0)}/40")
for key in ("arm conH140", "arm conH160", "arm conH140hr", "arm conH160hr", "arm conH140lowstu"): test(key, np.ones(len(T), bool), "ALL")
for b in ("<=1945", "1946-76", "1977-93", "1994-09", "2010+"):
    for key in ("arm conH140", "arm conH140hr"): test(key, bands == b, b)
