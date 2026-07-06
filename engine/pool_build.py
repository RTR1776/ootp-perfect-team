"""Build the master ratings pool and regenerate projections.json.

Merge order (see PROGRESS.md for why):
  1. Old full-roster ratings CSV (git-recovered, 2,024 cards) — base, full
     fidelity for every rating projections.py consumes.
  2. Collection export (CID-matched via cid_match) — ownership, ACT, BUY, VAR
     refresh. Cards whose CID didn't resolve are EXCLUDED until LJ re-exports
     with CID (they're listed in data-store/collection_unmatched.csv).
  3. Cards seen in league/tourney 184-col exports but absent from the old CSV
     (post–May-30 releases) — rows synthesized into the old schema. Two known
     substitutions: hitter CON (not in 184-col) <- BA rating; pitcher MOV
     absent -> engine skips MOV terms. Rows tagged ratings_source='stats_export'.

Also refreshes web/public/data/team.json activeCids/variantCids from the
matched collection (ACT == Yes / VAR == Y).
"""
from __future__ import annotations

import json
import math
from datetime import datetime
from pathlib import Path

import pandas as pd

from cid_match import (match_collection, build_reference_pools, tier_from_val,
                       OUT_MATCHED)
from projections2 import project_card, pt_env  # v2 empirical-curve engine
from league_baselines import load_baselines

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT_JSON = ROOT / "web" / "public" / "data" / "projections.json"
TEAM_JSON = ROOT / "web" / "public" / "data" / "team.json"

# 184-col export column -> old-CSV schema column (None = same name)
NEW_CARD_MAP = {
    "POS": "POS", "Name": "Name", "BABIP": "BABIP",
    "BA vL": "BA vL", "GAP vL": "GAP vL", "POW vL": "POW vL",
    "EYE vL": "EYE vL", "K vL": "K vL",
    "BA vR": "BA vR", "GAP vR": "GAP vR", "POW vR": "POW vR",
    "EYE vR": "EYE vR", "K vR": "K vR",
    "BBT": "BBT", "GBT": "GBT", "FBT": "FBT",
    "STU vL": "STU vL", "CON vL": "CON vL_1", "PBABIP vL": "PBABIP vL", "HRA vL": "HRA vL",
    "STU vR": "STU vR", "CON vR": "CON vR_1", "PBABIP vR": "PBABIP vR", "HRA vR": "HRA vR",
    "STM": "STM", "HLD": "HLD",
    "C ABI": "C ABI", "C FRM": "C FRM", "C ARM": "C ARM",
    "IF RNG": "IF RNG", "IF ERR": "IF ERR", "IF ARM": "IF ARM", "TDP": "TDP",
    "OF RNG": "OF RNG", "OF ERR": "OF ERR", "OF ARM": "OF ARM",
    "P": "P", "C": "C", "1B": "1B", "2B": "2B", "3B": "3B", "SS": "SS",
    "LF": "LF", "CF": "CF", "RF": "RF",
    "SPE": "SPE", "STE": "STE", "SR": "SR", "RUN": "RUN",
    "CID": "CID", "Tier": "CTier", "VAR": "VAR", "VLvl": "VLvl", "L10": "L10",
}


def build_master_ratings() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Returns (master ratings DataFrame in old-CSV schema, matched collection)."""
    col = match_collection()
    matched = col[col["CID"].notna()].copy()
    matched_cids = set(matched["CID"].astype(int))

    from cid_match import recover_old_ratings
    old = recover_old_ratings()
    old["owned"] = old["CID"].astype("Int64").isin(matched_cids)
    old["ratings_source"] = "old_csv"

    # refresh ACT / BUY / VAR from the (fresher) collection where matched
    upd = matched.set_index(matched["CID"].astype(int))
    idx = old["CID"].astype("Int64")
    for src_col, dst_col in (("ACT", "ACT"), ("BUY", "BUY"), ("VAR", "VAR")):
        if src_col in upd.columns:
            vals = idx.map(upd[src_col])
            old.loc[vals.notna(), dst_col] = vals[vals.notna()]

    # synthesize rows for post-May-30 cards seen in stats exports
    _, new_pool = build_reference_pools()
    new_cards = new_pool[~new_pool["CID"].isin(old["CID"])].copy()
    if len(new_cards):
        rows = pd.DataFrame({dst: new_cards[src] if src in new_cards.columns else None
                             for src, dst in NEW_CARD_MAP.items()})
        rows["B"] = new_cards["_b"].values
        rows["T"] = new_cards["_t"].values
        rows["CON vL"] = new_cards["BA vL"].values   # hitter CON not exported
        rows["CON vR"] = new_cards["BA vR"].values
        rows["SELL"] = "0"
        rows["Lock"] = "No"
        rows["owned"] = rows["CID"].astype("Int64").isin(matched_cids)
        rows["ratings_source"] = "stats_export"
        # ownership metadata for those we matched
        m = rows["CID"].astype("Int64").map(upd["ACT"]) if "ACT" in upd.columns else None
        if m is not None:
            rows.loc[m.notna(), "ACT"] = m[m.notna()]
        b = rows["CID"].astype("Int64").map(upd["BUY"]) if "BUY" in upd.columns else None
        if b is not None:
            rows.loc[b.notna(), "BUY"] = b[b.notna()]
        old = pd.concat([old, rows], ignore_index=True)

    return old, matched


def build_projections(out_path: Path = OUT_JSON) -> dict:
    master, matched = build_master_ratings()
    baselines = load_baselines()
    records = []
    for _, row in master.iterrows():
        try:
            card = project_card(row.to_dict(), baselines)
            card["owned"] = bool(row.get("owned"))
            card["ratings_source"] = row.get("ratings_source")
            records.append(card)
        except Exception as e:  # keep going; surface in payload
            records.append({"name": row.get("Name"), "error": str(e)})

    # Python json.dumps writes literal NaN (invalid JSON — browsers reject it);
    # scrub every NaN picked up from pandas before serializing.
    def _no_nan(o):
        if isinstance(o, float) and math.isnan(o):
            return None
        if isinstance(o, dict):
            return {k: _no_nan(v) for k, v in o.items()}
        if isinstance(o, list):
            return [_no_nan(v) for v in o]
        return o

    records = _no_nan(records)
    payload = {
        "baselines": baselines,
        "pt_env": pt_env(),  # league frame the v2 projections live in
        "card_count": len(records),
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "note": ("merged pool: old ratings CSV + stats-export cards; "
                 "unmatched collection cards excluded pending CID re-export"),
        "cards": records,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2, default=str))

    # team.json refresh (preserve homePark etc.)
    team = json.loads(TEAM_JSON.read_text()) if TEAM_JSON.exists() else {}
    act = matched["ACT"].astype(str).str.strip().str.lower().isin(["yes", "y"])
    var = matched["VAR"].astype(str).str.strip().str.upper().eq("Y")
    team["activeCids"] = sorted(matched.loc[act, "CID"].astype(int).tolist())
    team["variantCids"] = sorted(matched.loc[var, "CID"].astype(int).tolist())
    team["updatedAt"] = datetime.now().isoformat(timespec="seconds")
    TEAM_JSON.write_text(json.dumps(team, indent=2))

    errors = sum(1 for c in records if "error" in c)
    return {"cards": len(records), "errors": errors,
            "owned": sum(1 for c in records if c.get("owned")),
            "new_from_stats_export": sum(1 for c in records
                                         if c.get("ratings_source") == "stats_export"),
            "activeCids": len(team["activeCids"]),
            "variantCids": len(team["variantCids"])}


if __name__ == "__main__":
    print(json.dumps(build_projections(), indent=2))
