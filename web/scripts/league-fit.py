"""
Fit the league hitter model from the league panel (scripts/league-panel.ts).

    pnpm league:panel
    python3 scripts/league-fit.py [../Archive/.league-panel.csv] [--min-pa 1500] [--dry]

WHY A SEPARATE LEAGUE MODEL. Leagues normalise: a rating counts relative to
the talent rostered around it, and league play returns only 0.69 of the edge
the tournament-calibrated model gives a card (the same in PEL, every HD league,
LD404, vs LHP and vs RHP; 2026-09-26, 3.4M PA of split play). The league
exports also carry each copy's PLAYED split ratings, variants included, so the
fit sees exactly what played.

THE MODEL, per board (vs LHP / vs RHP), in runs per 700 PA above the league's
average hitter on that board:

    runs = a + b * (app - app_lg) + sum_r c_r * (ln r - mean ln r_lg)

- app is the app's calibrated tournament model on that board (env-fit, 2010
  PT default, neutral park).
- r runs over the board's Avoid K, BABIP, Gap, Power and Eye.
- _lg marks the league's PA-weighted average over rostered hitters on that
  board. Measuring against it is the normalisation.

Fitted on card-level lines: each card form (card id + variant level) on each
board is pooled over every team and week it played, so a line has thousands of
PA (median ~6,700). Validated on cards and on whole weeks held out of the fit.

Writes src/data/league-model.json:
- the coefficients
- the per-league reference averages (PEL, HD, LD × vL/vR, from each family's
  newest ordinary week on file)
- the league's share of PA against LHP
- the rating range the fit saw
- the validation numbers
"""
import json, sys
from datetime import date
import numpy as np
import pandas as pd

args = [a for a in sys.argv[1:] if not a.startswith("--")]
SRC = args[0] if args else "../Archive/.league-panel.csv"
MIN_PA = float(sys.argv[sys.argv.index("--min-pa") + 1]) if "--min-pa" in sys.argv else 1500.0
DRY = "--dry" in sys.argv
OUT = "src/data/league-model.json"
W = dict(BB=0.69, HB=0.72, b1=0.888, b2=1.271, b3=1.616, HR=2.101)  # the app's wOBA weights (league.ts)
R = ["K", "BA", "GAP", "POW", "EYE"]


def wavg(x, w):
    return float(np.sum(x * w) / np.sum(w))


def wcorr(x, y, w):
    mx, my = wavg(x, w), wavg(y, w)
    return float(np.sum(w * (x - mx) * (y - my)) / np.sqrt(np.sum(w * (x - mx) ** 2) * np.sum(w * (y - my) ** 2)))


def family(lg):
    return "PEL" if lg == "PEL" else lg[:2]


d = pd.read_csv(SRC)
h = d[d.isP == 0].rename(columns={"1B_1": "b1", "2B_1": "b2", "3B_1": "b3"}).copy()
h["uBB"] = h.BB - h.IBB
den = h.AB + h.uBB + h.SF + h.HP
h["woba"] = (W["BB"] * h.uBB + W["HB"] * h.HP + W["b1"] * h.b1 + W["b2"] * h.b2 + W["b3"] * h.b3 + W["HR"] * h.HR) / den.where(den > 0)
h["grp"] = h.week + "|" + h.league + "|" + h.split
for r in R:
    h[r] = np.where(h.split == "vL", h[r + "_vL"], h[r + "_vR"])
    h["l" + r] = np.log(h[r].where(h[r] > 0) / 50.0)
live = h[(h.PA > 0) & h.woba.notna()]

# league-split-week baselines over every rostered hitter
g = live.groupby("grp")
lg_woba = (W["BB"] * g.uBB.sum() + W["HB"] * g.HP.sum() + W["b1"] * g.b1.sum() + W["b2"] * g.b2.sum() + W["b3"] * g.b3.sum() + W["HR"] * g.HR.sum()) / (g.AB.sum() + g.uBB.sum() + g.SF.sum() + g.HP.sum())
h["y"] = (h.woba - h.grp.map(lg_woba)) / 1.25 * 700
ref_cols = ["m_cal"] + ["l" + r for r in R]
means = {}
for c in ref_cols:
    ok = live[live[c].notna()]
    means[c] = ok.groupby("grp").apply(lambda x: np.sum(x[c] * x.PA) / np.sum(x.PA), include_groups=False)
    h["d_" + c] = h[c] - h.grp.map(means[c])

h = h[(h.PA > 0) & h.woba.notna() & h.d_m_cal.notna()].copy()
for r in R:
    h = h[h["d_l" + r].notna()]
h["form"] = h.cid.astype(int).astype(str) + "|" + h["var"].astype(str) + "|" + h.vlvl.fillna(0).astype(int).astype(str)
# Each rating's league term at the week's price: scale_<r> is +10 of that rating in the
# week's environment over +10 in the PT default (1 in an ordinary week; league-panel.ts).
for r in R:
    h["s_l" + r] = h["d_l" + r] * (h["scale_" + r] if "scale_" + r in h else 1.0)
UNSCALED = ["d_m_cal"] + ["d_l" + r for r in R]
X_COLS = ["d_m_cal"] + ["s_l" + r for r in R]


def pool(df, keys, min_pa):
    cols = ["y"] + X_COLS + [c for c in UNSCALED if c not in X_COLS]
    agg = df.assign(**{c + "_w": df[c] * df.PA for c in cols}).groupby(keys)
    out = agg[[c + "_w" for c in cols] + ["PA"]].sum()
    for c in cols:
        out[c] = out[c + "_w"] / out.PA
    out = out.reset_index()
    return out[out.PA >= min_pa].reset_index(drop=True)


cards = pool(h, ["form", "split"], MIN_PA)
weeks = pool(h, ["form", "split", "week"], MIN_PA * 0.4)


def wls(X, y, w):
    Xc = np.column_stack([np.ones(len(y)), X])
    sw = np.sqrt(w)
    return np.linalg.lstsq(Xc * sw[:, None], y * sw, rcond=None)[0]


def cv(df, cols, key):
    y, w = df.y.values, df.PA.values.astype(float)
    k = df.form.str.split("|").str[0].values if key == "card" else df[key].values
    uk = np.unique(k)
    np.random.default_rng(5).shuffle(uk)
    nf = min(5, len(uk))
    fold = pd.Series(np.arange(len(uk)) % nf, index=uk).reindex(k).values
    pred = np.zeros(len(y))
    for f in range(nf):
        tr, te = fold != f, fold == f
        b = wls(df[cols].values[tr], y[tr], w[tr])
        pred[te] = np.column_stack([np.ones(te.sum()), df[cols].values[te]]) @ b
    return wcorr(pred, y, w)


def by_week_detail(df, cols):
    """Each week held out in turn: r of the prediction on that week alone."""
    out = {}
    y, w = df.y.values, df.PA.values.astype(float)
    for wk in sorted(df.week.unique()):
        te = df.week.values == wk
        if te.sum() < 10 or (~te).sum() < 30:
            continue
        b_ = wls(df[cols].values[~te], y[~te], w[~te])
        pred = np.column_stack([np.ones(te.sum()), df[cols].values[te]]) @ b_
        out[wk] = (round(wcorr(pred, y[te], w[te]), 3), int(te.sum()))
    return out


b = wls(cards[X_COLS].values, cards.y.values, cards.PA.values.astype(float))
shrink = wls(cards[["d_m_cal"]].values, cards.y.values, cards.PA.values.astype(float))[1]
val = {
    "byCard": round(cv(cards, X_COLS, "card"), 3),
    "byWeek": round(cv(weeks, X_COLS, "week"), 3),
    "shrinkOnlyByCard": round(cv(cards, ["d_m_cal"], "card"), 3),
    "shrinkOnlyByWeek": round(cv(weeks, ["d_m_cal"], "week"), 3),
}
print(f"league model: {len(cards)} card-board lines (card forms with {MIN_PA:.0f}+ PA pooled over teams and weeks), {int(cards.PA.sum()):,} PA, weeks {sorted(h.week.unique())}")
print(f"  runs above league avg = {b[0]:+.2f} + {b[1]:.3f} (app - app_lg) + " + " + ".join(f"{v:.2f} dln{r}" for r, v in zip(R, b[2:])))
print(f"  league returns {shrink:.3f} of the tournament-scale edge when the app's runs are the only input")
print(f"  held out: by card r {val['byCard']} (shrink only {val['shrinkOnlyByCard']}); by week r {val['byWeek']} (shrink only {val['shrinkOnlyByWeek']})")
env_of = h.groupby("week").env_year.first().to_dict() if "env_year" in h else {}
themed = h.groupby("week").themed.max().to_dict() if "themed" in h else {}
per_week = by_week_detail(weeks, X_COLS)
per_week_unscaled = by_week_detail(weeks, UNSCALED)
print("  environment-priced rating terms vs unpriced, each week held out: " + "; ".join(
    f"{wk} {per_week[wk][0]} vs {per_week_unscaled.get(wk, ('-',))[0]}" for wk in per_week))
per_week_shrink = by_week_detail(weeks, ["d_m_cal"])
print("  each week held out (card lines that week): " + "; ".join(
    f"{wk}{' THEME ' + str(int(env_of.get(wk, 0))) if themed.get(wk) else ''} r {r} (shrink only {per_week_shrink.get(wk, ('-',))[0]}, n {n})" for wk, (r, n) in per_week.items()))
val["eachWeek"] = {wk: {"r": r, "shrinkOnly": per_week_shrink.get(wk, (None,))[0], "lines": n, "themed": bool(themed.get(wk)), "envYear": int(env_of.get(wk, 2010))} for wk, (r, n) in per_week.items()}

# reference averages: each family's newest week, pooled over its leagues
ref, lhp = {}, {}
live2 = live.assign(fam=live.league.map(family))
for fam, df in live2.groupby("fam"):
    # the newest ORDINARY week: a theme week's app level is in another environment
    ordinary = df[df.themed == 0] if "themed" in df else df
    newest = (ordinary if len(ordinary) else df).week.max()
    dfn = df[df.week == newest]
    for sp, ds in dfn.groupby("split"):
        e = {"week": newest, "pa": int(ds.PA.sum()), "leagues": sorted(ds.league.unique())}
        for c in ref_cols:
            ok = ds[ds[c].notna()]
            e[c.replace("m_cal", "app")] = round(float(np.sum(ok[c] * ok.PA) / np.sum(ok.PA)), 4)
        ref[f"{fam}|{sp}"] = e
    tot = dfn.groupby("split").PA.sum()
    lhp[fam] = round(float(tot.get("vL", 0) / tot.sum()), 3)
print("  reference (newest ordinary week per family): " + "; ".join(f"{k} app {v['app']:+.2f} ({v['week']})" for k, v in ref.items()))
print("  share of hitter PA vs LHP: " + ", ".join(f"{k} {v:.2f}" for k, v in lhp.items()))

rng = {r: [float(np.nanmin(h[r])), float(np.nanmax(h[r]))] for r in R}
out = {
    "fittedAt": date.today().isoformat(),
    "source": f"league split exports, weeks {', '.join(sorted(h.week.unique()))} (theme weeks: {', '.join(f'{wk} = {int(env_of[wk])}' for wk in sorted(themed) if themed[wk]) or 'none'}); card-board lines with {MIN_PA:.0f}+ PA",
    "lines": int(len(cards)), "pa": int(cards.PA.sum()),
    "coef": {"intercept": round(float(b[0]), 4), "app": round(float(b[1]), 4), **{r: round(float(v), 4) for r, v in zip(R, b[2:])}},
    "coefNote": "Rating terms are per unit of ln(rating) minus the league's PA-weighted mean ln(rating) on that board, each multiplied by the week's environment price (the app's +10 value of that rating there over the PT default; 1 in an ordinary week).",
    "shrink": round(float(shrink), 4),
    "validation": val,
    "reference": ref,
    "lhpShare": lhp,
    "ratingRange": rng,
}
if DRY:
    print("(dry run: nothing written)")
else:
    with open(OUT, "w") as f:
        json.dump(out, f, indent=2)
        f.write("\n")
    print(f"wrote {OUT}")
