"""Glove pricing on WINS (2026-10-25, Docs/Defense Study 2026-10-25.md §7).

Input: teams.json from teams.mts with MV2_TOURDIR=Archive/Completed MV2_NO_LEAGUE=1
(its `dpos` per position: lin / lo / hi / prod, rating points or runs × PA/700 per game, × gloveScale).

Each structure is fitted on half the exports (G-weighted least squares on win%
centred within the export) and scored by correlation on the other half; 20
random halvings, so each structure is compared on the same 40 half-samples.

  M0 production   off, pitSP, pitRP, (production glove runs + framing)    — weights refit
  M1 study        off, pitSP, pitRP, (study per-position prices + framing)
  M2 per-pos      off, pitSP, pitRP, framing, 8 free per-position slopes
  M3 + lo         M2 + 8 free terms below −20 (cliff / flattening)
  M4 + lo + hi    M3 + 8 free terms above +15 (flat top)
  M5 study+shape  M1 with the study's shape terms folded into the glove (one weight)
  M6 prod+shape   M0 with the same shape terms

  python3 -I scripts/model-v2/gloves.py   (MV2_DIR=…)
"""
import json, os, numpy as np
D = os.environ.get("MV2_DIR", "/tmp/mv2")
POS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"]
# Study prices, runs per rating point per 700 PA (team runs allowed with FIP outcomes held; C without framing)
STUDY = {"C": .217, "1B": .172, "2B": .506, "3B": .205, "SS": .519, "LF": .315, "CF": .344, "RF": .218}
# Study shape, runs per point below −20 beyond the linear price (per-card curves, extra slope per +10 / 10 × 1.30)
SHAPE_LO = {"C": .096, "1B": -.075, "2B": -.140, "3B": -.073, "SS": -.199, "LF": .144, "CF": -.027, "RF": .022}

T = [t for t in json.load(open(f"{D}/teams.json")) if t["kind"] == "tour" and t["W"] + t["L"] > 0]
units = sorted({t["unit"] for t in T}); ui = {u: i for i, u in enumerate(units)}
g = np.array([ui[t["unit"]] for t in T]); w = np.array([t["W"] + t["L"] for t in T], float)
y = np.array([t["W"] / (t["W"] + t["L"]) for t in T])
def dp(t, p, k): return (t.get("dpos") or {}).get(p, {}).get(k, 0.0)
cols = {
    "off": [t["off"] for t in T], "pitSP": [t["pitSP"] for t in T], "pitRP": [t["pitRP"] for t in T], "frm": [t.get("frm", 0) for t in T],
    "prod": [sum(dp(t, p, "prod") for p in POS) + t.get("frm", 0) for t in T],
    "study": [sum(STUDY[p] * dp(t, p, "lin") for p in POS) + t.get("frm", 0) for t in T],
    "studyglove": [sum(STUDY[p] * dp(t, p, "lin") for p in POS) for t in T],
    "prodglove": [sum(dp(t, p, "prod") for p in POS) for t in T],
    "studyshape": [sum(STUDY[p] * dp(t, p, "lin") + SHAPE_LO[p] * dp(t, p, "lo") for p in POS) + t.get("frm", 0) for t in T],
    "prodshape": [sum(dp(t, p, "prod") + SHAPE_LO[p] * dp(t, p, "lo") for p in POS) + t.get("frm", 0) for t in T],
    **{f"lin {p}": [dp(t, p, "lin") for t in T] for p in POS},
    **{f"lo {p}": [dp(t, p, "lo") for t in T] for p in POS},
    **{f"hi {p}": [dp(t, p, "hi") for t in T] for p in POS},
}
X = {k: np.array(v, float) for k, v in cols.items()}
def centre(v):
    v = v.copy()
    for u in np.unique(g):
        m = g == u; v[m] -= np.average(v[m], weights=w[m])
    return v
X = {k: centre(v) for k, v in X.items()}; yc = centre(y)
base = ["off", "pitSP", "pitRP"]
MODELS = {
    "M0 production": base + ["prod"],
    "M1 study": base + ["study"],
    "M2 per-pos": base + ["frm"] + [f"lin {p}" for p in POS],
    "M3 per-pos+lo": base + ["frm"] + [f"lin {p}" for p in POS] + [f"lo {p}" for p in POS],
    "M4 per-pos+lo+hi": base + ["frm"] + [f"lin {p}" for p in POS] + [f"lo {p}" for p in POS] + [f"hi {p}" for p in POS],
    "M1b study, framing apart": base + ["frm", "studyglove"],
    "M0b prod, framing apart": base + ["frm", "prodglove"],
    "M5 study+shape": base + ["studyshape"],
    "M6 prod+shape": base + ["prodshape"],
}
def fit(cs, m):
    A = np.column_stack([X[c][m] for c in cs]); sw = np.sqrt(w[m])
    return np.linalg.lstsq(A * sw[:, None], yc[m] * sw, rcond=None)[0]
def score(cs, b, m):
    p = np.column_stack([X[c][m] for c in cs]) @ b; ww = w[m]; a = yc[m]
    pm, am = np.average(p, weights=ww), np.average(a, weights=ww)
    return np.sum(ww * (p - pm) * (a - am)) / np.sqrt(np.sum(ww * (p - pm) ** 2) * np.sum(ww * (a - am) ** 2))
print(f"{len(T)} team-events in {len(units)} exports, median {np.median(w):.0f} games")
res = {k: [] for k in MODELS}; coefs = {k: [] for k in MODELS}
U = np.unique(g)
for seed in range(20):
    rng = np.random.default_rng(seed); half = set(rng.choice(U, len(U) // 2, replace=False)); h = np.array([x in half for x in g])
    for tr, te in ((h, ~h), (~h, h)):
        for k, cs in MODELS.items():
            b = fit(cs, tr); res[k].append(score(cs, b, te)); coefs[k].append(b)
r0 = np.array(res["M0 production"])
print("\nheld-out win% r (40 half-samples)        mean     vs M0   better in")
for k in MODELS:
    r = np.array(res[k]); print(f"  {k:24} {r.mean():.4f}  {r.mean() - r0.mean():+.4f}   {np.sum(r > r0):2d}/40")
# per-position prices on wins, in bat-run equivalents (coef / off coef), full sample
allm = np.ones(len(T), bool)
for k in ("M2 per-pos", "M3 per-pos+lo"):
    cs = MODELS[k]; B = np.array(coefs[k]); off = B[:, 0:1]; rel = B / off
    full = fit(cs, allm); fr = full / full[0]
    print(f"\n{k}: each term in bat runs (coef ÷ off coef); full sample, and the spread over the 40 halves")
    for c, v, lo_, hi_ in zip(cs, fr, np.percentile(rel, 10, 0), np.percentile(rel, 90, 0)):
        print(f"   {c:8} {v:+.3f}   [{lo_:+.3f}, {hi_:+.3f}]")

print("\nweights in bat runs (coef ÷ off coef), full sample")
for k in ("M0 production", "M1 study", "M0b prod, framing apart", "M1b study, framing apart"):
    b = fit(MODELS[k], allm); print(f"  {k:26} " + "  ".join(f"{c} {v / b[0]:.2f}" for c, v in zip(MODELS[k], b)))
champ = np.array([t["unit"].startswith("ptcs7champ") for t in T])
print(f"\nPTCS 7 Championship brackets ({champ.sum()} teams), weights fitted on everything else:")
for k in ("M0 production", "M1 study", "M1b study, framing apart"):
    b = fit(MODELS[k], ~champ); print(f"  {k:26} r {score(MODELS[k], b, champ):.4f}")

# ---- the wired candidate: study prices scaled level-neutral to production (k = study weight / production weight on wins)
PROD = {"C": .0362 * .887 * 1.61, "1B": .1407 * .887 * 1.0, "2B": .1744 * .887 * 1.29, "3B": .1501 * .887 * 1.20, "SS": .1562 * .887 * 1.64, "LF": .0895 * .887 * 1.24, "CF": .0643 * .887 * 1.69, "RF": .0973 * .887 * 1.25}
k = fit(MODELS["M1 study"], allm)[-1] / fit(MODELS["M0 production"], allm)[-1]
print(f"\nlevel-neutral scale k = {k:.4f}")
for label, cprice in (("C at production", PROD["C"]), ("C at study", k * STUDY["C"])):
    price = {p: (cprice if p == "C" else k * STUDY[p]) for p in POS}
    X[f"wired {label}"] = centre(np.array([sum(price[p] * dp(t, p, "lin") for p in POS) + t.get("frm", 0) for t in T], float))
    MODELS[f"M7 {label}"] = base + [f"wired {label}"]
    print(f"  {label}: " + "  ".join(f"{p} {price[p]:.4f} (cal {price[p] / (PROD[p] / {'C':1.61,'1B':1.0,'2B':1.29,'3B':1.20,'SS':1.64,'LF':1.24,'CF':1.69,'RF':1.25}[p]):.2f})" for p in POS))
for k2 in ("M0 production", "M1 study", "M7 C at production", "M7 C at study"):
    rs = []
    for seed in range(20):
        rng = np.random.default_rng(seed); half = set(rng.choice(U, len(U) // 2, replace=False)); h = np.array([x in half for x in g])
        for tr, te in ((h, ~h), (~h, h)): rs.append(score(MODELS[k2], fit(MODELS[k2], tr), te))
    res[k2] = rs
r0 = np.array(res["M0 production"])
for k2 in ("M1 study", "M7 C at production", "M7 C at study"):
    r = np.array(res[k2]); print(f"  {k2:24} {r.mean():.4f}  {r.mean() - r0.mean():+.4f}   {np.sum(r > r0):2d}/40   champ r {score(MODELS[k2], fit(MODELS[k2], ~champ), champ):.4f}")
ra = np.array(res["M7 C at production"]); rb = np.array(res["M7 C at study"])
print(f"  C at production vs C at study: {np.mean(ra - rb):+.5f}, better in {np.sum(ra > rb)}/40")
