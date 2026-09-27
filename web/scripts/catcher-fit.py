"""
Catcher defence in league play, from the raw exports' fielding columns.

    python3 scripts/catcher-fit.py ["../League Data"]

Reads every League Data/<week>/*_all*.csv and keeps rows listed at C with 200+
innings there. Per 1,000 innings, a catcher's runs saved against the average
league catcher are

    FRM (framing runs) + 0.887 x ZR - (running game - league average)
    running game = 0.20 x steals allowed - 0.42 x runners thrown out

fitted on base copies against the three catcher ratings (C FRM, C ARM, C ABI).
Variants are checked with their catcher ratings scaled by their C boost, which
the exports do not show. The coefficients go into leagueCatcherRuns
(src/lib/analytics/league-lineup.ts); the write-up is in
Docs/League Model 2026-09-26.md, "Catcher defence".
"""
import glob, os, re, sys
import numpy as np
import pandas as pd

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join("..", "League Data")
SB, CS = 0.20, 0.42

def innings(x):
    w, _, t = str(x).partition(".")
    try:
        return int(w) + (int(t) / 3 if t else 0)
    except ValueError:
        return np.nan

frames = []
for f in sorted(glob.glob(os.path.join(ROOT, "*", "*.csv"))):
    name = os.path.basename(f).lower()
    if "_all" not in name:
        continue
    d = pd.read_csv(f, encoding="utf-8-sig", low_memory=False)
    if "FRM" not in d.columns or "IP_1" not in d.columns:
        continue
    d = d[d.POS == "C"].copy()
    d["week"] = os.path.basename(os.path.dirname(f))
    d["league"] = re.sub(r"^\d{4}_", "", name).split("_all")[0].upper()
    frames.append(d)
c = pd.concat(frames, ignore_index=True)
c["inn"] = c.IP_1.map(innings)
for k in ["C", "C ABI", "C FRM", "C ARM", "FRM", "PB", "SBA", "RTO", "ZR"]:
    c[k] = pd.to_numeric(c[k], errors="coerce")
c = c.drop_duplicates(subset=["week", "league", "ORG", "Name", "CID", "inn"])
c = c[(c.inn >= 200) & c[["C FRM", "C ARM", "C ABI", "FRM", "SBA", "RTO", "ZR"]].notna().all(axis=1)].reset_index(drop=True)

w = c.inn.values
run_game = ((c.SBA - c.RTO) * SB - c.RTO * CS) / c.inn * 1000
c["runs"] = (c.FRM + 0.887 * c.ZR) / c.inn * 1000 - (run_game - np.sum(run_game * w) / w.sum())
print(f"{len(c)} catcher-seasons, {w.sum():,.0f} innings, weeks {', '.join(sorted(c.week.unique()))}")

base = c[c.VAR == "N"]
X = np.column_stack([np.ones(len(base)), base["C FRM"], base["C ARM"], base["C ABI"]])
sw = np.sqrt(base.inn.values)
b = np.linalg.lstsq(X * sw[:, None], base.runs.values * sw, rcond=None)[0]
print(f"runs per 1,000 innings = {b[0]:+.2f} {b[1]:+.4f}*Frame {b[2]:+.4f}*Arm {b[3]:+.4f}*Blocking")

base_c = base.groupby("CID")["C"].first()
k = np.where(c.VAR == "Y", c.C / c.CID.map(base_c).fillna(c.C), 1.0)
c["pred"] = b[0] + (b[1] * c["C FRM"] + b[2] * c["C ARM"] + b[3] * c["C ABI"]) * k
g = c.groupby(["Name", "VAR"]).apply(
    lambda x: pd.Series({"innings": x.inn.sum(), "observed": np.average(x.runs, weights=x.inn), "from ratings": np.average(x.pred, weights=x.inn)}),
    include_groups=False)
g = g[g.innings >= 5000].sort_values("observed")
r = np.corrcoef(g["from ratings"], g.observed)[0, 1]
print(g.round(1).to_string())
print(f"cards with 5,000+ innings: r {r:.2f}")
