"""
How well does the model predict what cards actually did? Re-runnable audit.

    pnpm model:panel                                   # dump the panel (TS)
    python3 scripts/model-audit.py ../Archive/.model-panel.csv

Reads the panel from scripts/model-panel.ts: one row per (series, card), with
the model computed in that series' own era, park and field handedness. Needs
numpy and pandas (the repo .venv has both).

All numbers are WITHIN a field. Observed runs are the card's wOBA over its
series' wOBA (the 1.25 scale the app uses); for arms, runs saved per 700 BF
from FIP and from runs allowed. The model is the same card's runs above its
field's PA-weighted mean. Each fit is weighted by PA or BF. Numbers of record,
2026-09-26 (Docs/Model Review 2026-09-26.md):
    bats   r 0.689 (full model), 0.625 raw; held-out observed blend 0.730
    arms   r 0.52 vs FIP, 0.42 vs runs allowed (role held equal)
"""
import sys
import numpy as np
import pandas as pd

SRC = sys.argv[1] if len(sys.argv) > 1 else "../Archive/.model-panel.csv"
WOBA_SCALE = 1.25
TIERS = [(0, 70, "<=70"), (70, 80, "70-80"), (80, 90, "80-90"), (90, 100, "90-100"), (100, 999, "100+")]


def wavg(x, w):
    return float(np.sum(x * w) / np.sum(w))


def wcorr(x, y, w):
    mx, my = wavg(x, w), wavg(y, w)
    return float(np.sum(w * (x - mx) * (y - my)) / np.sqrt(np.sum(w * (x - mx) ** 2) * np.sum(w * (y - my) ** 2)))


def wslope(x, y, w):
    mx, my = wavg(x, w), wavg(y, w)
    return float(np.sum(w * (x - mx) * (y - my)) / np.sum(w * (x - mx) ** 2))


def within(v, groups, w):
    """Subtract each group's weighted mean (series fixed effects)."""
    v = np.array(v, dtype=float, copy=True)
    for g in np.unique(groups):
        i = groups == g
        v[i] -= np.average(v[i], axis=0, weights=w[i])
    return v


df = pd.read_csv(SRC)
df["lhp"] = df["lhp"].fillna(0.3)
df["lhb"] = df["lhb"].fillna(0.35)
live = df[df.format_changed == 0]

# ------------------------------------------------------------------ bats
allh = live[(live.is_pitcher == 0) & live.woba.notna() & (live.pa > 0)]
field_woba = allh.groupby("series").apply(lambda g: np.sum(g.woba * g.pa) / np.sum(g.pa), include_groups=False)
h = allh[(allh.pa >= 300) & allh.raw_R.notna()].copy()
h["y"] = (h.woba - h.series.map(field_woba)) / WOBA_SCALE * 700
mod = allh[allh.raw_R.notna()].copy()
for k in ["raw", "cal_noera", "cal"]:
    mod[k] = (1 - mod.lhp) * mod[k + "_R"] + mod.lhp * mod[k + "_L"]
    lvl = mod.groupby("series").apply(lambda g: np.sum(g[k] * g.pa) / np.sum(g.pa), include_groups=False)
    h[k] = (1 - h.lhp) * h[k + "_R"] + h.lhp * h[k + "_L"] - h.series.map(lvl)
h = h.reset_index(drop=True)
w, y, ser = h.pa.values.astype(float), h.y.values, h.series.values
noise = wavg(280.0 ** 2 / h.pa.values, w)
var_y = wavg((y - wavg(y, w)) ** 2, w)
print(f"BATS  {len(h)} card-series lines with 300+ PA, {h.card_id.nunique()} cards, {int(w.sum()):,} PA, {h.series.nunique()} series")
print(f"  observed spread within fields: variance {var_y:.0f}, of which sampling noise {noise:.0f} (runs/700 squared)")
for k, lab in [("raw", "raw curves"), ("cal_noera", "calibrated"), ("cal", "calibrated + era correction (what /build uses)")]:
    r = wcorr(h[k].values, y, w)
    print(f"  {lab:48s} r {r:.3f}  slope {wslope(h[k].values, y, w):.2f}  share of the real spread explained {r * r * var_y / (var_y - noise):.2f}")
tier = pd.cut(h.val_max.fillna(120), [t[0] for t in TIERS] + [999], labels=False).values
print("  by field (value cap):  " + "   ".join(f"{lab} r {wcorr(h.cal.values[tier == i], y[tier == i], w[tier == i]):.2f} (n {int((tier == i).sum())})" for i, (_, _, lab) in enumerate(TIERS)))


def eff(d, over, split):
    return (1 - d.lhp) * d[split + " vR"].fillna(d[over]) + d.lhp * d[split + " vL"].fillna(d[over])


R5 = np.column_stack([eff(h, "Avoid Ks", "Avoid K"), eff(h, "Eye", "Eye"), eff(h, "Power", "Power"), eff(h, "Gap", "Gap"), eff(h, "BABIP", "BABIP")]) / 10.0
ok = np.isfinite(R5).all(axis=1)


def cv(X, by, groups=None, seed=7):
    """Five-fold, folds by card or by series; returns held-out r within fields."""
    keys = h.card_id.values if by == "card" else ser
    uniq = np.unique(keys)
    np.random.default_rng(seed).shuffle(uniq)
    fold = pd.Series(np.arange(len(uniq)) % 5, index=uniq).reindex(keys).values
    Xd, yd = within(X, ser, w), within(y, ser, w)
    pred = np.full(len(y), np.nan)
    groups = np.zeros(len(y), int) if groups is None else groups
    for f in range(5):
        for g in np.unique(groups):
            tr, te = (fold != f) & (groups == g) & ok, (fold == f) & (groups == g) & ok
            if te.sum() == 0:
                continue
            if tr.sum() < 40:
                tr = (fold != f) & ok
            sw = np.sqrt(w[tr])
            b = np.linalg.lstsq(Xd[tr] * sw[:, None], yd[tr] * sw, rcond=None)[0]
            pred[te] = Xd[te] @ b
    m = np.isfinite(pred)
    return wcorr(pred[m], yd[m], w[m])


print("  held out (five folds):")
for by in ["card", "series"]:
    print(f"    by {by:6s}: raw {cv(h[['raw']].values, by):.3f} · raw + one linear rating fix {cv(np.column_stack([h.raw, R5]), by):.3f} · shipped {cv(h[['cal']].values, by):.3f} (its era slopes were fitted on these same events)")

# The observed blend, held out: each line predicted from the card's play in OTHER series.
e = h.y.values - h.cal.values
by_card = {c: np.where(h.card_id.values == c)[0] for c in np.unique(h.card_id.values)}
for K in [2500, 5000, 10000]:
    pred = h.cal.values.copy()
    for j in range(len(h)):
        idx = by_card[h.card_id.values[j]]
        idx = idx[ser[idx] != ser[j]]
        if len(idx):
            n = w[idx].sum()
            pred[j] += n / (n + K) * np.sum(w[idx] * e[idx]) / n
    print(f"  model + the card's play in other series (blend, K={K}): r {wcorr(pred, y, w):.3f}")

# ------------------------------------------------------------------ arms
allp = live[(live.is_pitcher == 1) & (live.BF > 0)]
g = allp.groupby("series")
f_fip = allp[allp.fip.notna() & (allp.ip > 0)].groupby("series").apply(lambda x: np.sum(x.fip * x.ip) / np.sum(x.ip), include_groups=False)
p = allp[(allp.BF >= 300) & allp.raw_R.notna() & allp.fip.notna()].copy()
p["y_fip"] = -((p.fip - p.series.map(f_fip)) / 9.0) * p.ip / p.BF * 700
p["y_ra"] = -(p.Ra / p.BF - p.series.map(g.Ra.sum() / g.BF.sum())) * 700
modp = allp[allp.raw_R.notna()].copy()
for k in ["raw", "cal", "nobab"]:
    modp[k] = 0.55 * modp[k + "_R"] + 0.45 * modp[k + "_L"]
    lvl = modp.groupby("series").apply(lambda x: np.sum(x[k] * x.BF) / np.sum(x.BF), include_groups=False)
    p[k] = 0.55 * p[k + "_R"] + 0.45 * p[k + "_L"] - p.series.map(lvl)
p = p.reset_index(drop=True)
wp, sp = p.BF.values.astype(float), p.series.values
rp = (p.stamina <= 25).astype(float).values


def role_out(v):
    """Within series, with the reliever step removed: ranks arms, not roles."""
    v = within(v, sp, wp)
    X = within(rp[:, None], sp, wp)
    b = np.sum(wp * X[:, 0] * v) / np.sum(wp * X[:, 0] ** 2)
    return v - X[:, 0] * b


print(f"\nARMS  {len(p)} card-series lines with 300+ BF, {p.card_id.nunique()} cards, {int(wp.sum()):,} BF")
for tgt, lab in [("y_fip", "FIP"), ("y_ra", "runs allowed")]:
    yy = role_out(p[tgt].values)
    print(f"  vs {lab:13s} (role held equal): app r {wcorr(role_out(p.cal.values), yy, wp):.3f} · without pBABIP r {wcorr(role_out(p.nobab.values), yy, wp):.3f}")
for lab, m in [("starters (STM > 25)", rp == 0), ("relievers (STM <= 25)", rp == 1)]:
    print(f"  {lab:22s} n {int(m.sum()):4d}: vs runs allowed r {wcorr(p.cal.values[m], p.y_ra.values[m], wp[m]):.3f} · vs FIP r {wcorr(p.cal.values[m], p.y_fip.values[m], wp[m]):.3f}")
