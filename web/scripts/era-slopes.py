"""
What each rating is WORTH, measured per era, from observed tournament play.

    pnpm era:slopes            (scripts/era-slopes.ts dumps, this fits)

The model carries one set of rating->outcome curves with an era term layered
on top. This asks the blunter question directly of the data: regress a card's
observed wOBA deviation from its own series' mean on its ratings, separately
within each era band, PA-weighted. The coefficient is wOBA points per +10
rating, so it is a slope and therefore NOT attenuated by a narrow rating
range the way a correlation would be (the spread check at the bottom prints
the SDs anyway, and they are ~32 for Power in every band).

Read the standard errors as card-level. They understate the real uncertainty,
because cards inside one series share a park, a field and an opponent pool;
the honest unit is the series, and some bands have only four of those.
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
    for x in rs:
        x["dev"] = x["woba"] - m

print(f"\n{'era':<21}{'ser':>4}{'PA':>10}  " + "".join(f"{LAB[f]:>11}" for f in FEAT) + f"{'R2':>7}")
print("-" * 98)
table = {}
for name, lo, hi in ERAS:
    rs = [r for r in rows if lo <= r["env_year"] <= hi]
    if len(rs) < 120:
        continue
    X = np.array([[r[f] for f in FEAT] for r in rs], float)
    y = np.array([r["dev"] for r in rs], float)
    w = np.array([r["pa"] for r in rs], float)
    Xc = np.column_stack([np.ones(len(X)), X])
    sw = np.sqrt(w)
    beta, *_ = np.linalg.lstsq(Xc * sw[:, None], y * sw, rcond=None)
    resid = (y - Xc @ beta) * sw
    s2 = resid @ resid / (len(rs) - Xc.shape[1])
    se = np.sqrt(np.diag(s2 * np.linalg.inv((Xc * sw[:, None]).T @ (Xc * sw[:, None]))))
    co = {f: (beta[i + 1] * 1e4, se[i + 1] * 1e4) for i, f in enumerate(FEAT)}
    table[name] = co
    pred = Xc @ beta
    ww = w / w.sum()
    r2 = 1 - ((y - pred) ** 2 * ww).sum() / ((y - (y * ww).sum()) ** 2 * ww).sum()
    ns = len({r["series"] for r in rs})
    print(f"{name:<21}{ns:>4}{int(w.sum()):>10}  "
          + "".join(f"{co[f][0]:>7.2f}+-{co[f][1]:<3.1f}" for f in FEAT) + f"{r2:>7.3f}")

print("\nwOBA points per +10 rating. Same numbers as runs per 700 PA:")
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
