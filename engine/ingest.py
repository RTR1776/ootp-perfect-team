"""Tourney export ingestion + aggregate artifact builder.

Canonical archive: ROOT/"Tourney Stats"/  — every concluded tourney's export
lands here (via the watcher or manual drop), named
    <type>_<id>.csv   or   <type>_<id>_tourn_export.csv

`build_tourneys_json()` re-scans the archive (plus the original
"Tourney Stats examples" folder) and writes web/public/data/tourneys.json:
per-card aggregates (counting stats summed across team-stints, observed
wOBA/FIP recomputed from the sums, SIERA IP-weighted) per tourney type, plus
per-type environment means. Idempotent — safe to run after every ingest.
"""
from __future__ import annotations

import json
import shutil
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from ootp_export import (load_stats_export, parse_tourney_filename,
                         observed_woba, observed_fip)

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
ARCHIVE = ROOT / "Tourney Stats"
EXAMPLES = ROOT / "Tourney Stats examples"
OUT_JSON = ROOT / "web" / "public" / "data" / "tourneys.json"

BAT_SUM = ["bat_PA", "bat_AB", "bat_H", "bat_1B", "bat_2B", "bat_3B", "bat_HR",
           "bat_BB", "bat_IBB", "bat_HP", "bat_SF", "bat_SH", "bat_K",
           "bat_R", "bat_RBI", "bat_SB", "bat_CS", "bat_wRAA"]
PIT_SUM = ["pit_IP", "pit_BF", "pit_HR", "pit_BB", "pit_HP", "pit_K", "pit_ER",
           "pit_W", "pit_L"]


def archive_dirs() -> list[Path]:
    return [d for d in (ARCHIVE, EXAMPLES) if d.exists()]


def ingest_file(src: str | Path, ttype: str | None = None, tid: str | None = None) -> Path:
    """Copy/normalize one export into the archive; returns destination path."""
    src = Path(src)
    if ttype is None or tid is None:
        ttype, tid = parse_tourney_filename(src)
    ARCHIVE.mkdir(exist_ok=True)
    dest = ARCHIVE / f"{ttype}_{tid}.csv"
    if src.resolve() != dest.resolve():
        shutil.copy2(src, dest)
    return dest


def _agg_cards(df: pd.DataFrame) -> pd.DataFrame:
    """Sum stints per CID, recompute observed rates from summed counts."""
    keep_first = ["Name", "POS", "B", "T", "Tier", "VAL", "VAR", "VLvl", "CYear"]
    aggs = {c: "sum" for c in BAT_SUM + PIT_SUM if c in df.columns}
    for c in keep_first:
        if c in df.columns:
            aggs[c] = "first"
    g = df.groupby("CID", dropna=True).agg(aggs)
    # IP-weighted SIERA
    if "pit_SIERA" in df.columns:
        d = df.dropna(subset=["pit_SIERA"])
        d = d[d["pit_IP"] > 0]
        if len(d):
            sw = d.groupby("CID").apply(
                lambda x: np.average(x["pit_SIERA"], weights=x["pit_IP"]),
                include_groups=False)
            g["pit_SIERA"] = sw
    g["woba_obs"] = observed_woba(g)
    g["fip_obs"] = observed_fip(g)
    return g.reset_index()


def build_tourneys_json() -> dict:
    per_type: dict[str, dict] = {}
    tourneys_seen = []
    frames_by_type: dict[str, list[pd.DataFrame]] = {}

    seen_ids = set()
    for d in archive_dirs():
        for f in sorted(d.glob("*.csv")):
            try:
                ttype, tid = parse_tourney_filename(f)
            except ValueError:
                continue
            if (ttype, tid) in seen_ids:  # archive copy wins over examples dup
                continue
            seen_ids.add((ttype, tid))
            df = load_stats_export(f)
            df["tourney_id"] = tid
            frames_by_type.setdefault(ttype, []).append(df)
            tourneys_seen.append({"type": ttype, "id": tid, "file": f.name,
                                  "rows": len(df)})

    for ttype, frames in frames_by_type.items():
        allrows = pd.concat(frames, ignore_index=True)
        cards = _agg_cards(allrows)
        # environment means (PA/IP-weighted across everything in this type)
        w_woba = observed_woba(cards)
        pa = cards["bat_PA"]
        hit_mask = pa.fillna(0) >= 20
        env_woba = float(np.average(w_woba[hit_mask], weights=pa[hit_mask])) if hit_mask.any() else None
        ip = cards["pit_IP"]
        pit_mask = ip.fillna(0) >= 5
        env_fip = float(np.average(cards["fip_obs"][pit_mask], weights=ip[pit_mask])) if pit_mask.any() else None
        env_siera = (float(np.average(cards.loc[pit_mask & cards["pit_SIERA"].notna(), "pit_SIERA"],
                                      weights=ip[pit_mask & cards["pit_SIERA"].notna()]))
                     if "pit_SIERA" in cards and (pit_mask & cards["pit_SIERA"].notna()).any() else None)

        cards_out = []
        for _, r in cards.iterrows():
            rec = {"cid": int(r["CID"]), "name": r.get("Name"), "pos": r.get("POS"),
                   "tier": r.get("Tier"),
                   "PA": _i(r.get("bat_PA")), "wOBA": _f(r.get("woba_obs")),
                   "IP": _f(r.get("pit_IP")), "FIP": _f(r.get("fip_obs")),
                   "SIERA": _f(r.get("pit_SIERA"))}
            if env_woba and rec["wOBA"] and rec["PA"] and rec["PA"] >= 20:
                rec["wOBA_rel"] = round(rec["wOBA"] / env_woba, 3)
            cards_out.append(rec)

        per_type[ttype] = {
            "tourneys": sorted({f2["id"] for f2 in tourneys_seen if f2["type"] == ttype}),
            "cardCount": len(cards_out),
            "env": {"wOBA": _f(env_woba), "FIP": _f(env_fip), "SIERA": _f(env_siera)},
            "cards": cards_out,
        }

    out = {"generatedAt": datetime.now().isoformat(timespec="seconds"),
           "tourneysIngested": tourneys_seen,
           "types": per_type}
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(out))
    return {"types": {k: v["cardCount"] for k, v in per_type.items()},
            "tourneys": len(tourneys_seen), "out": str(OUT_JSON)}


def _f(v, nd=3):
    try:
        if v is None or (isinstance(v, float) and np.isnan(v)):
            return None
        return round(float(v), nd)
    except (TypeError, ValueError):
        return None


def _i(v):
    try:
        if v is None or (isinstance(v, float) and np.isnan(v)):
            return None
        return int(v)
    except (TypeError, ValueError):
        return None


if __name__ == "__main__":
    print(json.dumps(build_tourneys_json(), indent=2))
