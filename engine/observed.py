"""Observed PT performance per card, normalized to each source's environment.

Sources:
  - League season files (5 leagues × all/vL/vR): the calibration backbone —
    consistent modern settings, huge pooled samples (rows are card×team
    stints; we sum counting stats per CID per league per split).
  - Tourney exports (overall split only): pooled into the 'all' split evidence,
    each relative to its own tourney-type environment mean.

Everything is expressed RELATIVE to the source environment (wOBA+ / FIP- style,
ratio to the source's PA/IP-weighted aggregate) so leagues and tourney types
can pool despite different talent levels, parks, and era settings.

League-strength caveat: a 1.10 wOBA_rel in PEL (vs Perfect-tier pitching) is
better than 1.10 in an HD league. `league_strength_offsets()` measures this via
cards that appear in both PEL and HD leagues; calibrate.py decides whether to
apply it (reported either way).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from ootp_export import (load_league_season, load_tourneys,
                         observed_woba, observed_fip)

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

PITCHER_POS = ("SP", "RP", "CL")

BAT_COUNT = ["bat_PA", "bat_AB", "bat_1B", "bat_2B", "bat_3B", "bat_HR",
             "bat_BB", "bat_IBB", "bat_HP", "bat_SF", "bat_K"]
PIT_COUNT = ["pit_IP", "pit_BF", "pit_HR", "pit_BB", "pit_HP", "pit_K", "pit_ER"]


def _league_env(df: pd.DataFrame) -> tuple[float, float]:
    """(league wOBA, league FIP) from summed totals of every row in the frame."""
    tot = df[BAT_COUNT + PIT_COUNT].sum().to_frame().T
    return float(observed_woba(tot).iloc[0]), float(observed_fip(tot).iloc[0])


def _agg_by_cid(df: pd.DataFrame) -> pd.DataFrame:
    aggs = {c: "sum" for c in BAT_COUNT + PIT_COUNT}
    aggs["Name"] = "first"
    aggs["POS"] = "first"
    g = df.groupby("CID", dropna=True).agg(aggs)
    d = df.dropna(subset=["pit_SIERA"])
    d = d[d["pit_IP"] > 0]
    if len(d):
        g["pit_SIERA"] = d.groupby("CID").apply(
            lambda x: np.average(x["pit_SIERA"], weights=x["pit_IP"]),
            include_groups=False)
    g["woba"] = observed_woba(g)
    g["fip"] = observed_fip(g)
    return g.reset_index()


def build_observed() -> pd.DataFrame:
    """Long frame: one row per (CID, split, source) with env-relative metrics."""
    out_rows = []

    ls = load_league_season(ROOT / "Most recent League Season")
    for (league, split), grp in ls.groupby(["league", "split"]):
        env_woba, env_fip = _league_env(grp)
        cards = _agg_by_cid(grp)
        is_pit = cards["POS"].isin(PITCHER_POS)
        for _, r in cards.iterrows():
            out_rows.append({
                "CID": int(r["CID"]), "Name": r["Name"], "POS": r["POS"],
                "split": split, "source": league, "source_kind": "league",
                "PA": float(r["bat_PA"]), "IP": float(r["pit_IP"]),
                "woba": r["woba"], "woba_rel": r["woba"] / env_woba if pd.notna(r["woba"]) else np.nan,
                "fip": r["fip"], "fip_rel": r["fip"] / env_fip if pd.notna(r["fip"]) else np.nan,
                "siera": r.get("pit_SIERA", np.nan),
                "is_pitcher": bool(is_pit.loc[r.name]) if r.name in is_pit.index else r["POS"] in PITCHER_POS,
                "env_woba": env_woba, "env_fip": env_fip,
            })

    frames = []
    for d in (ROOT / "Tourney Stats", ROOT / "Tourney Stats examples"):
        if d.exists():
            tv = load_tourneys(d)
            if len(tv):
                frames.append(tv)
    if frames:
        tv = pd.concat(frames, ignore_index=True)
        tv = tv.drop_duplicates(subset=["CID", "tourney_type", "tourney_id", "ORG"])
        for ttype, grp in tv.groupby("tourney_type"):
            env_woba, env_fip = _league_env(grp)
            cards = _agg_by_cid(grp)
            for _, r in cards.iterrows():
                out_rows.append({
                    "CID": int(r["CID"]), "Name": r["Name"], "POS": r["POS"],
                    "split": "all", "source": ttype, "source_kind": "tourney",
                    "PA": float(r["bat_PA"]), "IP": float(r["pit_IP"]),
                    "woba": r["woba"], "woba_rel": r["woba"] / env_woba if pd.notna(r["woba"]) else np.nan,
                    "fip": r["fip"], "fip_rel": r["fip"] / env_fip if pd.notna(r["fip"]) else np.nan,
                    "siera": r.get("pit_SIERA", np.nan),
                    "is_pitcher": r["POS"] in PITCHER_POS,
                    "env_woba": env_woba, "env_fip": env_fip,
                })

    return pd.DataFrame(out_rows)


def league_strength_offsets(obs: pd.DataFrame,
                            min_pa: float = 300, min_ip: float = 50) -> dict:
    """PEL-vs-HD offset from cards observed in both (split='all', leagues only)."""
    lg = obs[(obs.source_kind == "league") & (obs.split == "all")]
    pel = lg[lg.source == "pel"].set_index("CID")
    hd = lg[lg.source != "pel"]

    res = {}
    # hitters
    h = hd[(~hd.is_pitcher) & (hd.PA >= min_pa)]
    h_mean = h.groupby("CID")["woba_rel"].mean()
    shared = h_mean.index.intersection(pel[(~pel.is_pitcher) & (pel.PA >= min_pa)].index)
    if len(shared) >= 10:
        delta = (pel.loc[shared, "woba_rel"] - h_mean.loc[shared])
        res["hit_woba_rel_pel_minus_hd"] = round(float(delta.mean()), 4)
        res["hit_n_shared"] = int(len(shared))
    # pitchers
    p = hd[(hd.is_pitcher) & (hd.IP >= min_ip)]
    p_mean = p.groupby("CID")["fip_rel"].mean()
    shared = p_mean.index.intersection(pel[(pel.is_pitcher) & (pel.IP >= min_ip)].index)
    if len(shared) >= 10:
        delta = (pel.loc[shared, "fip_rel"] - p_mean.loc[shared])
        res["pit_fip_rel_pel_minus_hd"] = round(float(delta.mean()), 4)
        res["pit_n_shared"] = int(len(shared))
    return res


def pool_observed(obs: pd.DataFrame, pel_hit_offset: float = 0.0,
                  pel_pit_offset: float = 0.0) -> pd.DataFrame:
    """Pool sources per (CID, split): PA/IP-weighted env-relative metrics."""
    obs = obs.copy()
    is_pel = obs.source == "pel"
    obs.loc[is_pel & ~obs.is_pitcher, "woba_rel"] -= pel_hit_offset
    obs.loc[is_pel & obs.is_pitcher, "fip_rel"] -= pel_pit_offset

    rows = []
    for (cid, split), g in obs.groupby(["CID", "split"]):
        rec = {"CID": cid, "split": split, "Name": g["Name"].iloc[0],
               "POS": g["POS"].iloc[0], "is_pitcher": bool(g["is_pitcher"].iloc[0]),
               "sources": sorted(g["source"].unique().tolist())}
        h = g[g["woba_rel"].notna() & (g["PA"] > 0)]
        rec["PA"] = float(h["PA"].sum()) if len(h) else 0.0
        rec["woba_rel"] = (float(np.average(h["woba_rel"], weights=h["PA"]))
                           if rec["PA"] > 0 else np.nan)
        p = g[g["fip_rel"].notna() & (g["IP"] > 0)]
        rec["IP"] = float(p["IP"].sum()) if len(p) else 0.0
        rec["fip_rel"] = (float(np.average(p["fip_rel"], weights=p["IP"]))
                          if rec["IP"] > 0 else np.nan)
        s = g[g["siera"].notna() & (g["IP"] > 0)]
        rec["siera"] = (float(np.average(s["siera"], weights=s["IP"]))
                        if len(s) else np.nan)
        rows.append(rec)
    return pd.DataFrame(rows)


if __name__ == "__main__":
    obs = build_observed()
    print(f"{len(obs)} (CID,split,source) rows")
    print(obs.groupby(["source_kind", "split"]).size().to_string())
    print("\nleague-strength offsets:", league_strength_offsets(obs))
