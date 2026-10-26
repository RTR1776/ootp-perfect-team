"""End-to-end on WINS: production before the 10-25 review against the final config (2026-10-25).

Both scores take the glove from the harness's centred rating gaps (dpos.lin) at
FIELDING_CALIBRATION prices: the harness's own `def` weights glove runs by PA from fixed
position means, so a team's PA per game leaks into it (scripts/model-review/glove-clean.py).
OLD: the harness built before the review (no pBABIP fix), weights 2 / 1 / 1.5 / 2 everywhere.
FINAL: the harness rebuilt with the final code (pBABIP fix 1946–93), TEAM_WEIGHTS by band.
Off and pit are otherwise identical between the two builds. Same team-events, win% r within
each export, 40 export half-samples, by era band.
  python3 -I scripts/model-review/endtoend.py OLD_DIR NEW_DIR
"""
import json, sys, numpy as np
POS = ["C","1B","2B","3B","SS","LF","CF","RF"]
SLOPE = {"C":.0362,"1B":.1407,"2B":.1744,"3B":.1501,"SS":.1562,"LF":.0895,"CF":.0643,"RF":.0973}
CAL = {"C":1.61,"1B":1.0,"2B":1.29,"3B":1.2,"SS":1.64,"LF":1.24,"CF":1.69,"RF":1.25}
def band(y): return "<=1945" if y < 1946 else "1946-76" if y < 1977 else "1977-93" if y < 1994 else "1994-09" if y < 2010 else "2010+"
PROD = (2, 1, 1.5, 2)
W = {"<=1945": PROD, "1946-76": PROD, "1977-93": (1.25, .5, 1, 3), "1994-09": (1.25, .5, 1, 2.5), "2010+": PROD}
def load(d): return {(t["unit"], t["org"]): t for t in json.load(open(f"{d}/teams.json")) if t["kind"] == "tour" and t["W"] + t["L"] > 0}
O, N = load(sys.argv[1]), load(sys.argv[2])
keys = sorted(set(O) & set(N)); print(f"{len(keys)} team-events in both harnesses")
dp = lambda t, p: (t.get("dpos") or {}).get(p, {}).get("lin", 0.0)
glove = lambda t: sum(SLOPE[p] * .887 * CAL[p] * dp(t, p) for p in POS)
def score(t, wts): D, F, S, R = wts; return t["off"] + D * glove(t) + F * t.get("frm", 0) + S * t["pitSP"] + R * t["pitRP"]
old = np.array([score(O[k], PROD) for k in keys])
final = np.array([score(N[k], W[band(N[k]["year"])]) for k in keys])
pbabip_only = np.array([score(N[k], PROD) for k in keys])
weights_only = np.array([score(O[k], W[band(O[k]["year"])]) for k in keys])
y = np.array([O[k]["W"] / (O[k]["W"] + O[k]["L"]) for k in keys]); w = np.array([O[k]["W"] + O[k]["L"] for k in keys], float)
units = np.array([k[0] for k in keys]); bands = np.array([band(O[k]["year"]) for k in keys])
def centre(v, m):
    out = np.zeros(len(v))
    for u in np.unique(units[m]):
        s = (units == u) & m; out[s] = v[s] - np.average(v[s], weights=w[s])
    return out
def r(s, m):
    a, b, ww = centre(s, m)[m], centre(y, m)[m], w[m]
    return np.sum(ww * a * b) / np.sqrt(np.sum(ww * a * a) * np.sum(ww * b * b))
def compare(m, label):
    U = np.unique(units[m]); res = {k: [] for k in ("old", "final", "pbabip", "weights")}
    for seed in range(20):
        rng = np.random.default_rng(seed); half = set(rng.choice(U, len(U) // 2, replace=False)); h = np.array([x in half for x in units])
        for part in (h & m, ~h & m):
            res["old"].append(r(old, part)); res["final"].append(r(final, part)); res["pbabip"].append(r(pbabip_only, part)); res["weights"].append(r(weights_only, part))
    o = np.array(res["old"])
    line = f"   {label:8} n {m.sum():6d}  old {o.mean():.4f}"
    for k, lab in (("final", "FINAL"), ("weights", "weights only"), ("pbabip", "pBABIP only")):
        x = np.array(res[k]); line += f" | {lab} {x.mean() - o.mean():+.4f} ({np.sum(x > o)}/40)"
    print(line)
compare(np.ones(len(keys), bool), "ALL")
for b in ("<=1945", "1946-76", "1977-93", "1994-09", "2010+"): compare(bands == b, b)
champ = np.array([u.startswith("ptcs7champ") for u in units])
if champ.any(): print(f"   PTCS 7 Championship ({champ.sum()} teams): old {r(old, champ):.4f}  final {r(final, champ):.4f}")
