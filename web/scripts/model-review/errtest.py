"""Do fielding ERROR ratings explain wins beyond the position rating, and does OOTP's era error modifier (totalmods.csv) scale it?
Baseline = the final production score (endtoend.py: off + glove(dpos.lin) + framing + SP + RP at TEAM_WEIGHTS by band).
Adds (each fitted on half the exports, scored on the other half, 40 half-samples, win% r within export):
  E0 = sum over positions of the error-rating gap (no era scaling)
  EM = sum over positions of gap x (era error modifier for that position and year)
  RG = range-rating gap (control)
  python3 -I errtest.py teams.json totalmods.csv"""
import json, sys, csv, numpy as np
POS = ["C","1B","2B","3B","SS","LF","CF","RF"]
SLOPE = {"C":.0362,"1B":.1407,"2B":.1744,"3B":.1501,"SS":.1562,"LF":.0895,"CF":.0643,"RF":.0973}
CAL = {"C":1.61,"1B":1.0,"2B":1.29,"3B":1.2,"SS":1.64,"LF":1.24,"CF":1.69,"RF":1.25}
def band(y): return "<=1945" if y < 1946 else "1946-76" if y < 1977 else "1977-93" if y < 1994 else "1994-09" if y < 2010 else "2010+"
PROD = (2, 1, 1.5, 2); W = {"<=1945": PROD, "1946-76": PROD, "1977-93": (1.25, .5, 1, 3), "1994-09": (1.25, .5, 1, 2.5), "2010+": PROD}
rows = list(csv.reader(open(sys.argv[2]))); h = rows[0]
MCOL = {"1B": "FirstError", "2B": "SecondError", "3B": "ThirdError", "SS": "SSError", "LF": "LFError", "CF": "CFError", "RF": "RFError"}
mods = {int(r[0]): {p: float(r[h.index(c)]) for p, c in MCOL.items()} for r in rows[1:] if r and r[0].isdigit()}
def mod(y, p): y = min(max(y, 1871), 2024); return mods[y][p]
T = [t for t in json.load(open(sys.argv[1])) if t["kind"] == "tour" and t["W"] + t["L"] > 0]
print(len(T), "team-events")
dp = lambda t, p: (t.get("dpos") or {}).get(p, {}).get("lin", 0.0)
glove = lambda t: sum(SLOPE[p] * .887 * CAL[p] * dp(t, p) for p in POS)
base = np.array([(lambda D, F, S, R: t["off"] + D * glove(t) + F * t.get("frm", 0) + S * t["pitSP"] + R * t["pitRP"])(*W[band(t["year"])]) for t in T])
ds = lambda t, p, k: (t.get("dsub") or {}).get(p, {}).get(k, 0.0)
E0 = np.array([sum(ds(t, p, "err") for p in MCOL) for t in T])
EM = np.array([sum(ds(t, p, "err") * mod(t["year"], p) for p in MCOL) for t in T])
EX = np.array([sum(ds(t, p, "err") * (mod(t["year"], p) - 1) for p in MCOL) for t in T])
RG = np.array([sum(ds(t, p, "rng") for p in MCOL) for t in T])
y = np.array([t["W"] / (t["W"] + t["L"]) for t in T]); w = np.array([t["W"] + t["L"] for t in T], float)
units = np.array([t["unit"] for t in T]); bands = np.array([band(t["year"]) for t in T])
def centre(v, m):
    out = np.zeros(len(v))
    for u in np.unique(units[m]):
        s = (units == u) & m; out[s] = v[s] - np.average(v[s], weights=w[s])
    return out
def fit(X, m):  # weighted LS of centred y on centred [base, X]
    A = np.column_stack([centre(base, m)[m], centre(X, m)[m]]); b = centre(y, m)[m]; ww = w[m]
    coef = np.linalg.lstsq(A * np.sqrt(ww)[:, None], b * np.sqrt(ww), rcond=None)[0]; return coef[1] / coef[0]
def r(s, m):
    a, b, ww = centre(s, m)[m], centre(y, m)[m], w[m]
    return np.sum(ww * a * b) / np.sqrt(np.sum(ww * a * a) * np.sum(ww * b * b))
def test(m, label):
    U = np.unique(units[m]); res = {k: [] for k in ("E0", "EM", "EX", "RG")}; base_r = []; ks = {k: [] for k in res}
    for seed in range(20):
        rng = np.random.default_rng(seed); half = set(rng.choice(U, len(U) // 2, replace=False)); hm = np.array([x in half for x in units])
        for tr, te in ((hm & m, ~hm & m), (~hm & m, hm & m)):
            br = r(base, te); base_r.append(br)
            for k, X in (("E0", E0), ("EM", EM), ("EX", EX), ("RG", RG)):
                c = fit(X, tr); ks[k].append(c); res[k].append(r(base + c * X, te) - br)
    line = f"{label:8} n {m.sum():6d}  base r {np.mean(base_r):.4f}"
    for k in res: x = np.array(res[k]); line += f" | {k} {x.mean():+.4f} ({np.sum(x > 0)}/40, k {np.median(ks[k]):+.4f})"
    print(line)
test(np.ones(len(T), bool), "ALL")
for b in ("<=1945", "1946-76", "1977-93", "1994-09", "2010+"): test(bands == b, b)
print("\nmean error modifier by band (IF/OF):", {b: round(float(np.mean([np.mean([mod(t['year'], p) for p in MCOL]) for t, bb in zip(T, bands) if bb == b])), 2) for b in ("<=1945", "1946-76", "1977-93", "1994-09", "2010+")})
