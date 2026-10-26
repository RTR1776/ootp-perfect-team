"""Regress observed batting rates on the era's rates and the park's factors (park-check.mts rows).

log(observed) = a + b * log(era rate) + c * log(park factor) + tier terms, weighted by the
denominator, standard errors by resampling series (a series keeps its park and era).
If the model applies parks right, c is about 1; if the era table is right, b is about 1.
The hand test: within an export, log(L rate / R rate) against log(avgL / avgR) — the
park's handedness split at full strength would read 1 (production trusts 0.44).
  python3 -I scripts/model-review/park-check.py rows.json [--exact]   (--exact: only series whose park is on file exactly)
"""
import json, sys, numpy as np
rows = json.load(open(sys.argv[1]))
if "--exact" in sys.argv:
    rows = [r for r in rows if r["parkKey"] and not any(x in r["parkKey"] for x in ("nearest", "neutral", "no factors", "no stadium"))]
def stat(r):
    bip = r["PA"] - r["K"] - r["BB"] - r["HP"]
    return {
        "HR/BIP": (r["HR"] / bip, bip, r["era"]["HR"], r["park"]["hr"]),
        "BABIP": ((r["H"] - r["HR"]) / max(r["AB"] - r["K"] - r["HR"] + r["SF"], 1), r["AB"] - r["K"] - r["HR"] + r["SF"], r["era"]["BABIP"], r["park"]["avg"]),
        "2B/BIP": (r["D"] / bip, bip, r["era"]["B2"], r["park"]["d2"]),
        "3B/BIP": (max(r["T"], 0.5) / bip, bip, r["era"]["B3"], r["park"]["d3"]),
        "K%": (r["K"] / r["PA"], r["PA"], r["era"]["K"], 1.0),
        "BB%": ((r["BB"] + r["HP"]) / r["PA"], r["PA"], r["era"]["BB"] + r["era"]["HBP"], 1.0),
    }
S = [stat(r) for r in rows]
series = np.array([r["series"] for r in rows]); U = np.unique(series); idx = {u: np.where(series == u)[0] for u in U}
vmax = np.array([r["valMax"] if r["valMax"] is not None else 105 for r in rows], float)
tier = np.column_stack([(vmax <= 59), (vmax > 59) & (vmax <= 79), (vmax > 79) & (vmax <= 99)]).astype(float)  # vs open / 100+
hand = np.array([1.0 if r["hand"] == "L" else 0.0 for r in rows])
def wls(X, y, w):
    sw = np.sqrt(w); return np.linalg.lstsq(X * sw[:, None], y * sw, rcond=None)[0]
rng = np.random.default_rng(5)
print(f"{len(rows)} export-hand rows, {len(U)} series")
print("rate        era coef (b)        park coef (c)       [b, c should be ~1]")
for key in S[0]:
    y = np.log(np.array([s[key][0] for s in S])); w = np.array([s[key][1] for s in S], float)
    era = np.log(np.array([s[key][2] for s in S])); pk = np.log(np.array([s[key][3] for s in S]))
    cols = [np.ones(len(rows)), era] + ([pk] if key not in ("K%", "BB%") else []) + [tier[:, i] for i in range(3)] + [hand]
    X = np.column_stack(cols); b = wls(X, y, w)
    bs = []
    for _ in range(300):
        ix = np.concatenate([idx[u] for u in rng.choice(U, len(U))]); bs.append(wls(X[ix], y[ix], w[ix]))
    se = np.std(bs, 0)
    pc = f"{b[2]:+.2f} ± {se[2]:.2f}" if key not in ("K%", "BB%") else "   (park-immune)"
    print(f"  {key:8}  {b[1]:+.2f} ± {se[1]:.2f}        {pc}")
# hand split test: per export with both hands
by = {}
for r, s in zip(rows, S): by.setdefault(r["file"], {})[r["hand"]] = (r, s)
print("\nhandedness: within an export, log(L/R observed) on log(L/R park factor)")
for key, pkey in (("BABIP", "avg"), ("HR/BIP", "hr")):
    ys, xs, ws, ss = [], [], [], []
    for f, d in by.items():
        if "L" not in d or "R" not in d: continue
        (rl, sl), (rr, sr) = d["L"], d["R"]
        ys.append(np.log(sl[key][0] / sr[key][0])); xs.append(np.log(rl["park"][pkey] / rr["park"][pkey])); ws.append(1 / (1 / sl[key][1] + 1 / sr[key][1])); ss.append(rl["series"])
    ys, xs, ws, ss = map(np.array, (ys, xs, ws, ss))
    X = np.column_stack([np.ones(len(ys)), xs]); b = wls(X, ys, ws)
    UU = np.unique(ss); ii = {u: np.where(ss == u)[0] for u in UU}; bs = []
    for _ in range(300):
        ix = np.concatenate([ii[u] for u in rng.choice(UU, len(UU))]); bs.append(wls(X[ix], ys[ix], ws[ix]))
    print(f"  {key:7} park L/R split coefficient {b[1]:+.2f} ± {np.std(bs, 0)[1]:.2f}   (n {len(ys)} exports, {len(UU)} series; spread of log(avgL/avgR) sd {np.std(xs):.3f})")
