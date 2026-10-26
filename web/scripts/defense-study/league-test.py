"""Held-out test of league glove prices (Docs/League Plan 2026-10-25 §11).

Input: lgdef.json from league-def.mts (one row per team-week).
Each structure is fitted on half the league-weeks and scored on the other half,
20 random halvings = 40 half-samples, on two targets:
  RA   runs allowed per 1,400 IP, FIP parts (HR, BB+HBP, K) held
  WIN  win%, runs scored and FIP parts held
Glove terms are PA-weighted Pos Rating at each position, centred within the league-week.
  P0  today's prices (leagueFieldingRuns: slope x 0.887 x FIELDING_CALIBRATION), one free scale
  P1  8 free per-position prices
  P2  today's prices, CF price free
  P3  today's prices, CF and SS free
  python3 -I scripts/defense-study/league-test.py <lgdef.json>
"""
import json, sys, numpy as np
T = json.load(open(sys.argv[1])); POS = ["C","1B","2B","3B","SS","LF","CF","RF"]
CUR = {"C": .0362*.887*1.61, "1B": .1407*.887*1.0, "2B": .1744*.887*1.29, "3B": .1501*.887*1.2, "SS": .1562*.887*1.64, "LF": .0895*.887*1.24, "CF": .0643*.887*1.69, "RF": .0973*.887*1.25}
def pr(t, p): a = t["pos"].get(p); return a[0] / a[1] if a and a[1] > 0 else np.nan
R = np.array([[pr(t, p) for p in POS] for t in T]); ok = ~np.isnan(R).any(1) & np.array([t["w"] + t["l"] > 100 for t in T])
T = [t for t, o in zip(T, ok) if o]; R = R[ok]
g = np.array([t["sid"] for t in T]); w = np.array([t["ip"] for t in T])
per = lambda k: np.array([t[k] / t["ip"] * 1400 for t in T])
ra, rs, hr, bb, k = per("ra"), per("rs"), per("hr"), per("bb"), per("k")
wp = np.array([t["w"] / (t["w"] + t["l"]) for t in T])
def dm(v):
    v = v.astype(float).copy()
    for u in np.unique(g):
        m = g == u; v[m] -= np.average(v[m], axis=0, weights=w[m])
    return v
Rd = dm(R); cur = Rd @ np.array([CUR[p] for p in POS]); cf = Rd[:, POS.index("CF")]; ss = Rd[:, POS.index("SS")]
oth = Rd @ np.array([0 if p == "CF" else CUR[p] for p in POS]); oth2 = Rd @ np.array([0 if p in ("CF", "SS") else CUR[p] for p in POS])
base = {"RA": [dm(hr), dm(bb), dm(k)], "WIN": [dm(rs), dm(hr), dm(bb), dm(k)]}
ys = {"RA": dm(ra), "WIN": dm(wp)}
glove = {"P0 today's prices": [cur], "P1 8 free prices": [Rd[:, i] for i in range(8)], "P2 CF free": [oth, cf], "P3 CF+SS free": [oth2, cf, ss]}
U = np.unique(g)
def fit(X, y, m): sw = np.sqrt(w[m]); return np.linalg.lstsq(X[m] * sw[:, None], y[m] * sw, rcond=None)[0]
def r(X, y, b, m):
    p = X[m] @ b; ww = w[m]; a = y[m]; pm, am = np.average(p, weights=ww), np.average(a, weights=ww)
    return np.sum(ww * (p - pm) * (a - am)) / np.sqrt(np.sum(ww * (p - pm) ** 2) * np.sum(ww * (a - am) ** 2))
print(f"{len(T)} team-weeks, {len(U)} league-weeks")
for tgt in ("RA", "WIN"):
    res = {}
    for name, G in glove.items():
        X = np.column_stack(base[tgt] + G); out = []
        for seed in range(20):
            rng = np.random.default_rng(seed); half = set(rng.choice(U, len(U) // 2, replace=False)); h = np.array([x in half for x in g])
            for tr, te in ((h, ~h), (~h, h)): out.append(r(X, ys[tgt], fit(X, ys[tgt], tr), te))
        res[name] = np.array(out)
        bfull = fit(X, ys[tgt], np.ones(len(T), bool))
        if name == "P2 CF free":
            nb = len(base[tgt]); res[name + " coef"] = bfull[nb:]
    r0 = res["P0 today's prices"]
    print(f"\n=== {tgt}: held-out r (40 half-samples)")
    for name in glove:
        x = res[name]; print(f"   {name:20} {x.mean():.4f}  {x.mean() - r0.mean():+.4f}  better in {np.sum(x > r0)}/40")
    c = res["P2 CF free coef"]
    if tgt == "RA": print(f"   P2 fit, full sample: other positions at {-c[0]:.2f}x today's prices; CF {-c[1]:.3f} runs per point (today {CUR['CF']:.3f}, {(-c[1]) / CUR['CF']:.1f}x)")
    else: print(f"   P2 fit, full sample (win%): other positions {c[0]:+.5f} per run-unit, CF {c[1]:+.5f} per point; ratio CF/(today CF price x other) = {c[1] / (c[0] * CUR['CF']):.1f}x")
