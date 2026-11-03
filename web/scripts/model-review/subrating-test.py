"""Glove from fielding sub-ratings vs the position rating, on WINS (2026-11-03, Docs/OF Range and Arm 2026-11-03.md).
Archive harness (teams.mts, dpos.lin and dsub rng/arm/err gaps, both centred on the export's field at the position),
production TEAM_WEIGHTS by band, win% r within export, 40 export half-samples. Every non-tested position keeps
production's glove. OF: range + arm. IF (arg "IF"): range + arm + error.
  P0 production prices on the position rating      P1 centred stint-fit price on the position rating
  V1 centred stint-fit prices on the sub-ratings   V0 V1 rescaled to production's level per position (what would ship)
  R0 range alone at production level               Pfit / Vfit free per-position weights fitted on the other half
  python3 -I scripts/model-review/subrating-test.py MV2_DIR prices.json [IF]"""
import json, sys, numpy as np
POS = ["C","1B","2B","3B","SS","LF","CF","RF"]
SLOPE = {"C":.0362,"1B":.1407,"2B":.1744,"3B":.1501,"SS":.1562,"LF":.0895,"CF":.0643,"RF":.0973}
CAL = {"C":1.61,"1B":1.0,"2B":1.29,"3B":1.2,"SS":1.64,"LF":1.24,"CF":1.69,"RF":1.25}
PR = json.load(open(sys.argv[2]))
GRP = ["1B","2B","3B","SS"] if len(sys.argv) > 3 and sys.argv[3] == "IF" else ["LF","CF","RF"]
SUBK = ["rng","arm","err"] if GRP[0] == "1B" else ["rng","arm"]
def band(y): return "<=1945" if y < 1946 else "1946-76" if y < 1977 else "1977-93" if y < 1994 else "1994-09" if y < 2010 else "2010+"
PROD = (2, 1, 1.5, 2); W = {"<=1945": PROD, "1946-76": PROD, "1977-93": (1.25, .5, 1, 3), "1994-09": (1.25, .5, 1, 2.5), "2010+": PROD}
T = [t for t in json.load(open(f"{sys.argv[1]}/teams.json")) if t["kind"] == "tour" and t["W"] + t["L"] > 0]
print(len(T), "team-events; group", GRP)
dp = lambda t, p: (t.get("dpos") or {}).get(p, {}).get("lin", 0.0)
ds = lambda t, p, k: (t.get("dsub") or {}).get(p, {}).get(k, 0.0) * t.get("gs", 1)
P0 = {p: SLOPE[p] * .887 * CAL[p] for p in POS}
Dw = np.array([W[band(t["year"])][0] for t in T])
other = np.array([t["off"] + W[band(t["year"])][1] * t.get("frm", 0) + W[band(t["year"])][2] * t["pitSP"] + W[band(t["year"])][3] * t["pitRP"]
                  + W[band(t["year"])][0] * sum(P0[p] * dp(t, p) for p in POS if p not in GRP) for t in T])
lin = {p: np.array([dp(t, p) for t in T]) for p in GRP}
sub = {(p, k): np.array([ds(t, p, k) for t in T]) for p in GRP for k in SUBK}
def subprice(p, k):
    if GRP[0] != "1B": return PR[p][k]
    return PR[p]["all"][["rng","arm","err"].index(k)]
gP0 = sum(P0[p] * lin[p] for p in GRP)
gP1 = sum(PR[p]["pos"] * lin[p] for p in GRP)
gV1 = sum(subprice(p, k) * sub[(p, k)] for p in GRP for k in SUBK)
gV0 = sum(P0[p] / PR[p]["pos"] * subprice(p, k) * sub[(p, k)] for p in GRP for k in SUBK)            # production level, sub-rating mix
gR0 = sum(P0[p] / PR[p]["pos"] * PR[p]["rng"] * sub[(p, "rng")] for p in GRP) if GRP[0] != "1B" else gV0  # range only
scores = {"P0 prod": other + Dw * gP0, "P1 pos-fit": other + Dw * gP1, "V1 sub-fit": other + Dw * gV1, "V0 sub@prod": other + Dw * gV0, "R0 rng@prod": other + Dw * gR0,
          "none": other}
y = np.array([t["W"] / (t["W"] + t["L"]) for t in T]); w = np.array([t["W"] + t["L"] for t in T], float)
units = np.array([t["unit"] for t in T]); bands = np.array([band(t["year"]) for t in T])
def centre(v, m):
    out = np.zeros(len(v))
    for u in np.unique(units[m]):
        s = (units == u) & m; out[s] = v[s] - np.average(v[s], weights=w[s])
    return out
def r(s, m):
    a, b, ww = centre(s, m)[m], centre(y, m)[m], w[m]
    return np.sum(ww * a * b) / np.sqrt(np.sum(ww * a * a) * np.sum(ww * b * b))
XP = np.column_stack([Dw * lin[p] for p in GRP]); XV = np.column_stack([Dw * sub[(p, k)] for p in GRP for k in SUBK])
def fit(X, m):
    A = np.column_stack([centre(other, m)[m]] + [centre(X[:, j], m)[m] for j in range(X.shape[1])]); b = centre(y, m)[m]; ww = w[m]
    c = np.linalg.lstsq(A * np.sqrt(ww)[:, None], b * np.sqrt(ww), rcond=None)[0]; return c[1:] / c[0]
def test(m, label):
    U = np.unique(units[m]); res = {k: [] for k in list(scores) + ["Pfit", "Vfit"]}; cp, cv = [], []
    for seed in range(20):
        rng = np.random.default_rng(seed); half = set(rng.choice(U, len(U) // 2, replace=False)); hm = np.array([x in half for x in units])
        for tr, te in ((hm & m, ~hm & m), (~hm & m, hm & m)):
            for k, s in scores.items(): res[k].append(r(s, te))
            a = fit(XP, tr); b = fit(XV, tr); cp.append(a); cv.append(b)
            res["Pfit"].append(r(other + XP @ a, te)); res["Vfit"].append(r(other + XV @ b, te))
    b0 = np.array(res["P0 prod"]); line = f"{label:8} n {m.sum():6d} P0 {b0.mean():.4f}"
    for k in res:
        if k == "P0 prod": continue
        x = np.array(res[k]); line += f" | {k} {x.mean() - b0.mean():+.4f} ({np.sum(x > b0)})"
    xf = np.array(res["Vfit"]) - np.array(res["Pfit"]); line += f" || Vfit-Pfit {xf.mean():+.4f} ({np.sum(xf > 0)}/40)"
    xv = np.array(res["V1 sub-fit"]) - np.array(res["P1 pos-fit"]); line += f" || V1-P1 {xv.mean():+.4f} ({np.sum(xv > 0)}/40)"
    print(line)
    print(f"         Pfit coefs (runs/pt) {np.median(cp, axis=0).round(4)}  Vfit {np.median(cv, axis=0).round(4)}")
test(np.ones(len(T), bool), "ALL")
for b in ("<=1945", "1946-76", "1977-93", "1994-09", "2010+"): test(bands == b, b)
print("prices P0", {p: round(P0[p], 4) for p in GRP}, "P1", {p: round(PR[p]["pos"], 4) for p in GRP})
