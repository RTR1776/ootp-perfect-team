"""
What each rating is WORTH, measured per era, from observed tournament play.

    pnpm era:slopes            (scripts/era-slopes.ts dumps, this fits)

Regress a card's observed wOBA deviation from its own series' mean on its
ratings, separately within each era band, PA-weighted, WITH SERIES FIXED
EFFECTS: the ratings are demeaned within each series exactly as the wOBA is.
The first cut of this script demeaned wOBA only, and pooling a Bronze field
with a Diamond field inside one band then shrank every slope toward zero (both
fields have mean deviation 0 whatever their mean ratings are). That is why it
read Power in deadball as 0.16 and BABIP in the steroid era as 0.79; within
series they are 0.89 and 1.24, and the modern Eye "zero" is 0.48. Reviewed
2026-09-19; the old numbers are withdrawn.

Standard errors are series-clustered (cards inside one series share a park, a
field and an opponent pool), so a band with four series says so honestly.
The coefficient is wOBA points per +10 rating; the runs table below it uses
the same 1.25 wOBA scale the roster tools use, so it is comparable to the
model's own "+10 rating" line, which the TS wrapper prints per band.
"""
import csv, sys
import numpy as np
from collections import defaultdict

SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/eraslopes.csv"
FEAT = ["pow", "eye", "avk", "bab", "gap"]
LAB = {"pow": "Power", "eye": "Eye", "avk": "Avoid Ks", "bab": "BABIP", "gap": "Gap"}
ERAS = [("Deadball <=1920", 0, 1920), ("Live Ball 1921-45", 1921, 1945),
        ("Integration 1946-60", 1946, 1960), ("Expansion 1961-76", 1961, 1976),
        ("Free Agency 1977-93", 1977, 1993), ("Steroid 1994-2009", 1994, 2009),
        ("Modern 2010+", 2010, 3000)]
# runs per 700 PA per point of wOBA, the scale roster-fill uses (wOBA scale 1.25)
TO_RUNS = 700 / 1.25 / 1000

rows = []
for r in csv.DictReader(open(SRC)):
    try:
        for k in ("env_year", "pa", "woba", *FEAT):
            r[k] = float(r[k])
    except (TypeError, ValueError):
        continue
    rows.append(r)

by_series = defaultdict(list)
for r in rows:
    by_series[r["series"]].append(r)
for rs in by_series.values():
    w = sum(x["pa"] for x in rs)
    m = sum(x["woba"] * x["pa"] for x in rs) / w
    means = {f: sum(x[f] * x["pa"] for x in rs) / w for f in FEAT}
    for x in rs:
        x["dev"] = x["woba"] - m
        for f in FEAT:
            x[f + "_c"] = x[f] - means[f]

def fit(rs):
    """PA-weighted least squares on within-series deviations; series-clustered SEs."""
    X = np.array([[r[f + "_c"] for f in FEAT] for r in rs], float)
    y = np.array([r["dev"] for r in rs], float)
    w = np.array([r["pa"] for r in rs], float)
    sw = np.sqrt(w)
    Xw, yw = X * sw[:, None], y * sw
    beta, *_ = np.linalg.lstsq(Xw, yw, rcond=None)
    xtx_inv = np.linalg.inv(Xw.T @ Xw)
    e = yw - Xw @ beta
    groups = defaultdict(list)
    for i, r in enumerate(rs):
        groups[r["series"]].append(i)
    meat = np.zeros_like(xtx_inv)
    for idx in groups.values():
        s = (Xw[idx] * e[idx, None]).sum(axis=0)
        meat += np.outer(s, s)
    G, (n, k) = len(groups), Xw.shape
    adj = (G / max(G - 1, 1)) * ((n - 1) / (n - k))
    se = np.sqrt(np.diag(adj * xtx_inv @ meat @ xtx_inv))
    ww = w / w.sum()
    r2 = 1 - ((y - X @ beta) ** 2 * ww).sum() / ((y - (y * ww).sum()) ** 2 * ww).sum()
    return beta, se, G, r2, w.sum()

print(f"\n{'era':<21}{'ser':>4}{'PA':>10}  " + "".join(f"{LAB[f]:>11}" for f in FEAT) + f"{'R2':>7}")
print("-" * 98)
table = {}
for name, lo, hi in ERAS + [("ALL ERAS", 0, 3000)]:
    rs = [r for r in rows if lo <= r["env_year"] <= hi]
    if len(rs) < 120:
        continue
    beta, se, ns, r2, pa = fit(rs)
    co = {f: (beta[i] * 1e4, se[i] * 1e4) for i, f in enumerate(FEAT)}
    table[name] = co
    print(f"{name:<21}{ns:>4}{int(pa):>10}  "
          + "".join(f"{co[f][0]:>7.2f}+-{co[f][1]:<3.1f}" for f in FEAT) + f"{r2:>7.3f}")

print("\nSame numbers as runs per 700 PA per +10 rating (compare with the model lines the wrapper prints):")
print(f"{'era':<21}  " + "".join(f"{LAB[f]:>11}" for f in FEAT))
for name, co in table.items():
    print(f"{name:<21}  " + "".join(f"{co[f][0]*TO_RUNS:>11.2f}" for f in FEAT))

print("\nrating spread per band (a flat slope is not a narrow range):")
print(f"{'era':<21}" + "".join(f"{LAB[f]+' SD':>12}" for f in FEAT))
for name, lo, hi in ERAS:
    rs = [r for r in rows if lo <= r["env_year"] <= hi]
    if len(rs) < 120:
        continue
    print(f"{name:<21}" + "".join(f"{np.std([r[f] for r in rs]):>12.1f}" for f in FEAT))
