"""Resolve CIDs for the 43-column collection export (which lacks CID/Tier).

Reference pools, in trust order:
  A. The old full-roster ratings CSV (2,024 cards, May 30) — deleted from the
     working tree but recovered from git history (commit f9625c9). Has CID,
     CTier, and full ratings in the same rating-scale as the collection export.
  B. 184-col league-season + tourney exports (CID + Tier + VAL + ratings) for
     cards released after the old CSV.

Matching: candidates by normalized (Name, B, T); disambiguate multiple cards of
the same player by rating fingerprint (count of equal values over the shared
rating columns; requires >=90% agreement to accept).

Column gotcha: the 43-col export's "CON vL/vR" is the PITCHER contact-against
rating — it equals old-CSV "CON vL_1/vR_1" (the hitter CON isn't exported).

Tier mapping (LJ, 2026-07-06), from card VAL/CVAL:
  <60 Iron, 60-69 Bronze, 70-79 Silver, 80-89 Gold, 90-99 Diamond, 100-101 Perfect.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np
import pandas as pd

from ootp_export import load_collection, load_league_season, load_tourneys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
STORE = ROOT / "data-store"
OLD_RATINGS_GIT = "f9625c9:Ratings/collection_-_manage_cards_collection_-_manage_cards_full_roster_ratings.csv"
OLD_RATINGS_CACHE = STORE / "ratings_full_2026-05-30.csv"
COLLECTION_CSV = ROOT / "Roster Templates" / "KC Torrent Current Cards.csv"
OUT_MATCHED = STORE / "collection_with_cid.csv"
OUT_UNMATCHED = STORE / "collection_unmatched.csv"

# collection-export column -> old-ratings-CSV column (identical unless noted)
FP_COLS = {
    "BA vL": "BA vL", "GAP vL": "GAP vL", "POW vL": "POW vL", "EYE vL": "EYE vL",
    "K vL": "K vL",
    "BA vR": "BA vR", "GAP vR": "GAP vR", "POW vR": "POW vR", "EYE vR": "EYE vR",
    "K vR": "K vR",
    "STU vL": "STU vL", "CON vL": "CON vL_1", "PBABIP vL": "PBABIP vL", "HRA vL": "HRA vL",
    "STU vR": "STU vR", "CON vR": "CON vR_1", "PBABIP vR": "PBABIP vR", "HRA vR": "HRA vR",
    "STM": "STM",
    "C ABI": "C ABI", "C FRM": "C FRM", "C ARM": "C ARM",
    "IF RNG": "IF RNG", "IF ERR": "IF ERR", "IF ARM": "IF ARM", "TDP": "TDP",
    "OF RNG": "OF RNG", "OF ERR": "OF ERR", "OF ARM": "OF ARM",
    "SPE": "SPE", "STE": "STE", "SR": "SR", "RUN": "RUN",
}
# collection-export column -> 184-col export column (splits share names; the
# 184-col "CON vL/vR" IS the pitcher one, same as the collection export)
FP_COLS_184 = {c: c for c in FP_COLS}
FP_COLS_184.update({"CON vL": "CON vL", "CON vR": "CON vR"})

TIERS = [(60, "Iron"), (70, "Bronze"), (80, "Silver"), (90, "Gold"),
         (100, "Diamond"), (102, "Perfect")]


def tier_from_val(v) -> str | None:
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    for ceil, name in TIERS:
        if v < ceil:
            return name
    return None


def _norm_name(s: pd.Series) -> pd.Series:
    return s.astype(str).str.strip().str.lower().str.replace(r"\s+", " ", regex=True)


def _norm_hand(s: pd.Series) -> pd.Series:
    """Collection export spells out Right/Left/Switch; others use R/L/S."""
    return s.astype(str).str.strip().str.upper().str[0]  # R/L/S


def recover_old_ratings() -> pd.DataFrame:
    STORE.mkdir(exist_ok=True)
    if not OLD_RATINGS_CACHE.exists():
        csv = subprocess.run(["git", "show", OLD_RATINGS_GIT], cwd=ROOT,
                             capture_output=True, text=True, check=True).stdout
        OLD_RATINGS_CACHE.write_text(csv)
    df = pd.read_csv(OLD_RATINGS_CACHE, dtype=str, keep_default_na=False, na_values=[""])
    df["CID"] = pd.to_numeric(df["CID"], errors="coerce").astype("Int64")
    return df


def _fingerprint_score(row, cand, colmap) -> float:
    """Mean per-column similarity over shared rating columns.

    Tolerance-based, NOT exact equality: Live cards' ratings drift with weekly
    real-MLB updates (observed: +1 across the board, up to ~7 on pitch ratings
    over 5 weeks), so we score |a-b| against a 25-point full-mismatch scale.
    NaN==NaN counts as similar (dashes on non-applicable ratings).
    """
    sims = []
    for c_col, r_col in colmap.items():
        a, b = row.get(c_col), cand.get(r_col)
        an = pd.isna(a) or a in ("-", "")
        bn = pd.isna(b) or b in ("-", "")
        if an and bn:
            sims.append(1.0)
        elif an != bn:
            sims.append(0.0)
        else:
            try:
                sims.append(max(0.0, 1.0 - abs(float(a) - float(b)) / 25.0))
            except (TypeError, ValueError):
                sims.append(1.0 if str(a).strip() == str(b).strip() else 0.0)
    return sum(sims) / len(sims) if sims else 0.0


def build_reference_pools() -> tuple[pd.DataFrame, pd.DataFrame]:
    old = recover_old_ratings()
    old["_name"] = _norm_name(old["Name"])
    old["_b"], old["_t"] = _norm_hand(old["B"]), _norm_hand(old["T"])

    frames = []
    ls = load_league_season(ROOT / "Most recent League Season")
    frames.append(ls[ls["split"] == "all"])
    tv = load_tourneys(ROOT / "Tourney Stats examples")
    if (ROOT / "Tourney Stats").exists():
        tv2 = load_tourneys(ROOT / "Tourney Stats")
        tv = pd.concat([tv, tv2], ignore_index=True) if len(tv) else tv2
    if len(tv):
        frames.append(tv)
    new = pd.concat(frames, ignore_index=True)
    new = new.drop_duplicates(subset=["CID"]).copy()
    new["_name"] = _norm_name(new["Name"])
    new["_b"], new["_t"] = _norm_hand(new["B"]), _norm_hand(new["T"])
    return old, new


def match_collection(collection_csv: Path = COLLECTION_CSV) -> pd.DataFrame:
    col = load_collection(collection_csv)
    col["_name"] = _norm_name(col["Name"])
    col["_b"], col["_t"] = _norm_hand(col["B"]), _norm_hand(col["T"])
    col["tier"] = col["CVAL"].map(tier_from_val)
    old, new = build_reference_pools()

    cids, sources, scores = [], [], []
    old_by_name = {k: g for k, g in old.groupby(["_name", "_b", "_t"])}
    new_by_name = {k: g for k, g in new.groupby(["_name", "_b", "_t"])}

    for _, row in col.iterrows():
        key = (row["_name"], row["_b"], row["_t"])
        # collect scored candidates from both pools (old CSV first = trusted)
        cands: list[tuple[float, object, str]] = []
        for pool, colmap, src in ((old_by_name, FP_COLS, "old_csv"),
                                  (new_by_name, FP_COLS_184, "stats_export")):
            g = pool.get(key)
            if g is None:
                continue
            for _, cand in g.iterrows():
                cands.append((_fingerprint_score(row, cand, colmap), cand["CID"], src))
        cands.sort(key=lambda x: -x[0])
        # de-dup CIDs appearing in both pools (keep best score per CID)
        seen, uniq = set(), []
        for s, cid, src in cands:
            if cid not in seen:
                seen.add(cid); uniq.append((s, cid, src))
        accepted = None
        if len(uniq) == 1:
            # singleton (name,B,T): ratings only guard against gross mismatch
            if uniq[0][0] >= 0.60:
                accepted = uniq[0]
        elif len(uniq) > 1:
            # multiple cards of this player: need clear best
            if uniq[0][0] >= 0.75 and uniq[0][0] - uniq[1][0] >= 0.03:
                accepted = uniq[0]
        if accepted:
            cids.append(int(accepted[1])); sources.append(accepted[2])
            scores.append(round(accepted[0], 3))
        else:
            cids.append(None); sources.append(None)
            scores.append(round(uniq[0][0], 3) if uniq else 0.0)

    col["CID"] = pd.array(cids, dtype="Int64")
    col["cid_source"] = sources
    col["cid_score"] = scores
    col = col.drop(columns=["_name", "_b", "_t"])

    # collision pass: a CID may map to only one collection row — keep best score
    dup_mask = col["CID"].notna() & col["CID"].duplicated(keep=False)
    for cid, grp in col[dup_mask].groupby("CID"):
        losers = grp.sort_values("cid_score", ascending=False).index[1:]
        col.loc[losers, ["CID", "cid_source"]] = [pd.NA, None]

    STORE.mkdir(exist_ok=True)
    col.to_csv(OUT_MATCHED, index=False)
    col[col["CID"].isna()].to_csv(OUT_UNMATCHED, index=False)
    return col


if __name__ == "__main__":
    df = match_collection()
    n = len(df)
    m = int(df["CID"].notna().sum())
    print(f"matched {m}/{n} ({m/n:.1%})")
    print(df["cid_source"].value_counts(dropna=False).to_string())
    print("\ntier breakdown of unmatched:")
    print(df[df["CID"].isna()]["tier"].value_counts().to_string())
    dup = df[df["CID"].notna() & df["CID"].duplicated(keep=False)]
    if len(dup):
        print(f"\n⚠ {len(dup)} rows share a CID with another row (check {OUT_MATCHED.name}):")
        print(dup[["Name", "POS", "CVAL", "CID", "cid_score"]].head(10).to_string())
