"""Empirical rating→outcome curves fitted from observed PT league results.

WHY: the original engine's hand-tuned power curve ((rating/50)^0.55) saturates
badly at PT rating ranges — diagnosed 2026-07-06: projected K/9 averaged 16.75
(observed: 7.58) with corr 0.22, HR/9 projected 2x reality, so composite FIP
ordering was pure noise (corr 0.03) even though the sim itself follows ratings
tightly (raw STU->K9 corr +0.84, CON->BB9 -0.88).

METHOD: from the league-season vL/vR split files (ratings AND outcomes in the
same rows, env-relative), fit per component:
    log(rate / env_rate) = alpha + beta * log(rating / 50)
Aggregated per (CID, split) across the 5 leagues; weighted by sample size.
Fit population is elite-skewed (the played meta) — extrapolation to low-rated
cards rides the power law; revisit when tourney data with iron/bronze splits
exists.

ENV FRAME: projections built from these curves are in the "modern PT league"
frame (per-split env rates stored here) — i.e., what the card should actually
do in a current PT league. Era contexts rescale via baseline ratios in the app.

Components:
  hitters : k    K/PA        ~ K-rating (higher = fewer K, beta<0 expected)
            bb   BB/PA       ~ EYE
            hr   HR/BIP      ~ POW
            xbh  (2B+3B)/BIP ~ GAP
            babip (H-HR)/(BIP-HR) ~ BA-rating (split contact rating)
  pitchers: k    K/BF        ~ STU
            bb   BB/BF       ~ CON (pitcher control; beta<0)
            hr   HR/BIP      ~ HRA (avoidance; beta<0)
            babip            ~ PBABIP (beta<0)

Output: engine/config/curves.json
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from ootp_export import load_league_season

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CURVES_OUT = HERE / "config" / "curves.json"

PITCHER_POS = ("SP", "RP", "CL")
MIN_PA, MIN_BF = 150, 100

HIT_COMponents = None  # (placeholder to avoid typo'd import)

HIT_SPEC = {
    "k":     {"rating": "K",   "num": "bat_K",  "den": "PA"},
    "bb":    {"rating": "EYE", "num": "bat_BB", "den": "PA"},
    "hr":    {"rating": "POW", "num": "bat_HR", "den": "BIP"},
    "xbh":   {"rating": "GAP", "num": "XBH",    "den": "BIP"},
    "babip": {"rating": "BA",  "num": "HIP",    "den": "BIPxHR"},
}
PIT_SPEC = {
    "k":     {"rating": "STU",    "num": "pit_K",  "den": "BF"},
    "bb":    {"rating": "CON",    "num": "pit_BB", "den": "BF"},
    "hr":    {"rating": "HRA",    "num": "pit_HR", "den": "BIP"},
    "babip": {"rating": "PBABIP", "num": "HIP",    "den": "BIPxHR"},
}


def _prep_split_obs() -> tuple[pd.DataFrame, pd.DataFrame]:
    """(hitter obs, pitcher obs) aggregated per (CID, split) with ratings."""
    ls = load_league_season(ROOT / "Most recent League Season")
    ls = ls[ls["split"].isin(["vL", "vR"])].copy()
    suf = ls["split"].map({"vL": " vL", "vR": " vR"})

    # per-row split ratings under uniform names
    for base in ("BA", "GAP", "POW", "EYE", "K", "STU", "CON", "PBABIP", "HRA"):
        cols = [f"{base} vL", f"{base} vR"]
        vals = np.where(suf == " vL",
                        ls.get(cols[0], pd.Series(index=ls.index)),
                        ls.get(cols[1], pd.Series(index=ls.index)))
        ls[f"r_{base}"] = pd.to_numeric(pd.Series(vals, index=ls.index), errors="coerce")

    hit = ls[~ls["POS"].isin(PITCHER_POS)]
    pit = ls[ls["POS"].isin(PITCHER_POS)]

    def agg(df: pd.DataFrame, is_pit: bool) -> pd.DataFrame:
        counts = (["pit_BF", "pit_K", "pit_BB", "pit_HP", "pit_HR",
                   "pit_1B", "pit_2B", "pit_3B"] if is_pit else
                  ["bat_PA", "bat_K", "bat_BB", "bat_IBB", "bat_HP", "bat_HR",
                   "bat_1B", "bat_2B", "bat_3B", "bat_AB", "bat_SF"])
        aggs = {c: "sum" for c in counts}
        for base in ("STU", "CON", "PBABIP", "HRA") if is_pit else ("BA", "GAP", "POW", "EYE", "K"):
            aggs[f"r_{base}"] = "first"  # ratings identical across stints
        aggs["Name"] = "first"
        g = df.groupby(["CID", "split"], dropna=True).agg(aggs).reset_index()
        if is_pit:
            g["BF"] = g["pit_BF"]
            g["BIP"] = g["pit_BF"] - g["pit_K"] - g["pit_BB"] - g["pit_HP"]
            g["HIP"] = g["pit_1B"] + g["pit_2B"] + g["pit_3B"]
            g["BIPxHR"] = g["BIP"] - g["pit_HR"]
            g = g[g["BF"] >= MIN_BF]
        else:
            g["PA"] = g["bat_PA"]
            g["BIP"] = g["bat_PA"] - g["bat_K"] - g["bat_BB"] - g["bat_HP"]
            g["HIP"] = g["bat_1B"] + g["bat_2B"] + g["bat_3B"]
            g["XBH"] = g["bat_2B"] + g["bat_3B"]
            g["BIPxHR"] = g["BIP"] - g["bat_HR"]
            g = g[g["PA"] >= MIN_PA]
        return g

    return agg(hit, False), agg(pit, True)


def _fit_component(g: pd.DataFrame, spec: dict) -> dict | None:
    r = pd.to_numeric(g[f"r_{spec['rating']}"], errors="coerce")
    num, den = g[spec["num"]], g[spec["den"]]
    ok = r.notna() & (r > 0) & (num > 0) & (den > 0)
    if ok.sum() < 30:
        return None
    r, num, den = r[ok], num[ok], den[ok]
    rate = num / den
    env = float(num.sum() / den.sum())  # sample-weighted env rate
    y = np.log(rate / env)
    x = np.log(r / 50.0)
    w = np.sqrt(den.astype(float))
    W = np.sqrt(w)
    A = np.vstack([np.ones_like(x), x]).T * W.to_numpy()[:, None]
    coef, *_ = np.linalg.lstsq(A, y.to_numpy() * W.to_numpy(), rcond=None)
    a, b = float(coef[0]), float(coef[1])
    pred = a + b * x
    ss_res = float(np.average((y - pred) ** 2, weights=w))
    ss_tot = float(np.average((y - np.average(y, weights=w)) ** 2, weights=w))
    return {"alpha": round(a, 4), "beta": round(b, 4),
            "r2": round(1 - ss_res / ss_tot, 3) if ss_tot > 0 else 0.0,
            "n": int(ok.sum()), "env_rate": round(env, 5),
            "rating_range": [int(r.min()), int(r.max())]}


def fit_curves() -> dict:
    hit, pit = _prep_split_obs()
    out = {"generatedAt": datetime.now().isoformat(timespec="seconds"),
           "frame": "modern PT league (env_rate per component, splits pooled)",
           "hit": {}, "pit": {}}
    for name, spec in HIT_SPEC.items():
        f = _fit_component(hit, spec)
        if f:
            out["hit"][name] = {**f, "rating": spec["rating"]}
    for name, spec in PIT_SPEC.items():
        f = _fit_component(pit, spec)
        if f:
            out["pit"][name] = {**f, "rating": spec["rating"]}
    # league 2B:3B split for decomposing xbh (needs SPE later if desired)
    tot3b = hit["bat_3B"].sum()
    out["hit"]["xbh_3b_share"] = round(float(tot3b / max(hit["bat_2B"].sum() + tot3b, 1)), 4)
    # HBP env rates
    out["hit"]["hbp_rate_env"] = round(float(hit["bat_HP"].sum() / hit["bat_PA"].sum()), 5)
    out["pit"]["hbp_rate_env"] = round(float(pit["pit_HP"].sum() / pit["pit_BF"].sum()), 5)
    CURVES_OUT.write_text(json.dumps(out, indent=2))
    # the webapp's TS engine port (Card Lab) reads the same curves
    web_copy = ROOT / "web" / "public" / "data" / "curves.json"
    web_copy.parent.mkdir(parents=True, exist_ok=True)
    web_copy.write_text(json.dumps(out, indent=2))
    return out


if __name__ == "__main__":
    c = fit_curves()
    for kind in ("hit", "pit"):
        for k, v in c[kind].items():
            if isinstance(v, dict):
                print(f"{kind}.{k:6} ({v['rating']:6}) beta={v['beta']:+.3f} r2={v['r2']:.2f} "
                      f"n={v['n']} env={v['env_rate']} range={v['rating_range']}")
