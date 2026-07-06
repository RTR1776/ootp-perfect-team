"""Loaders for OOTP Perfect Team CSV exports.

Two formats exist in this repo (headers verified 2026-07-06):

1. The 184-column "sortable stats" export (league seasons, tourney exports,
   watcher output). One row per card per team-stint; contains BOTH card
   ratings AND accumulated sim stats. Keyed by CID. Quirks:
   - '-' means null
   - duplicate base column names arrive pandas-suffixed: hitting stats use the
     bare name or `_1`, pitching `_1`/`_2`, fielding `_2`-ish — we renamespace
     by block position instead of trusting suffix numbers.
   - 'HLD' appears twice: pitcher hold RATING (col ~'HLD') and hold STAT ('HLD_1').

2. The 43-column collection export ("KC Torrent Current Cards.csv"): ratings
   only, no CID/Tier (until LJ re-exports with them), plus ACT/CVAL/BUY/VAR.

Both loaders return tidy DataFrames with predictable column names.
"""
from __future__ import annotations

import re
from pathlib import Path

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# 184-column stats export
# ---------------------------------------------------------------------------

# Column blocks in the 184-col export, in file order. Names as they appear
# AFTER pandas dedup-suffixing (verified against the real files).
HIT_STATS = ["G", "GS", "PA", "AB", "H", "1B_1", "2B_1", "3B_1", "HR", "RBI",
             "R", "BB", "IBB", "HP", "SH", "SF", "CI", "K", "GIDP", "RC",
             "WPA", "wRC", "wRAA", "WAR", "PI/PA", "SB", "CS", "wSB", "UBR"]
PIT_STATS = ["G_1", "GS_1", "W", "L", "HLD_1", "SD", "MD", "IP", "BF", "AB_1",
             "1B_2", "2B_2", "3B_2", "HR_1", "R_1", "ER", "BB_1", "IBB_1",
             "K_1", "HP_1", "SH_1", "SF_1", "WP", "BK", "CI_1", "DP", "GF",
             "IR", "IRS", "pLi", "PI", "GB", "FB_1", "SB_1", "CS_1", "WPA_1",
             "WAR_1", "rWAR", "SIERA"]
FLD_STATS = ["G_2", "GS_2", "TC", "A", "PO", "E", "DP_1", "TP", "RNG", "ZR",
             "EFF", "SBA", "RTO", "IP_1", "PB", "CER"]

RENAME = {}
for c in HIT_STATS:
    RENAME[c] = "bat_" + re.sub(r"_1$", "", c)
for c in PIT_STATS:
    RENAME[c] = "pit_" + re.sub(r"_[12]$", "", c)
for c in FLD_STATS:
    RENAME[c] = "fld_" + re.sub(r"_[12]$", "", c)

META_COLS = ["POS", "Name", "First Name", "Last Name", "ORG", "B", "T", "VAL",
             "CID", "Tier", "Title", "VAR", "VLvl", "CYear", "CEra", "L10"]


def _clean(df: pd.DataFrame) -> pd.DataFrame:
    """Dashes -> NaN; numeric coercion for everything that looks numeric."""
    df = df.replace("-", np.nan)
    protected = {"POS", "Name", "First Name", "Last Name", "ORG", "HT", "WT",
                 "B", "T", "CTM", "CFR", "ST", "Tier", "Title", "VAR", "CEra",
                 "BBT", "GBT", "FBT", "G/F", "VELO", "Slot", "BUY", "REL",
                 "L10", "ACT", "DEF"}
    for col in df.columns:
        if col not in protected:
            coerced = pd.to_numeric(df[col], errors="coerce")
            # adopt only if coercion is lossless (no real values became NaN)
            if coerced.notna().sum() == df[col].notna().sum():
                df[col] = coerced
    return df


def load_stats_export(path: str | Path) -> pd.DataFrame:
    """Load one 184-column export; renamespace stat blocks; keep ratings as-is."""
    path = Path(path)
    df = pd.read_csv(path, dtype=str, keep_default_na=False, na_values=[""])
    df = _clean(df)
    missing = [c for c in ("CID", "Name", "POS") if c not in df.columns]
    if missing:
        raise ValueError(f"{path.name}: not a 184-col stats export (missing {missing})")
    df = df.rename(columns=RENAME)
    # force numeric on the renamed stat blocks
    for col in df.columns:
        if col.startswith(("bat_", "pit_", "fld_")):
            df[col] = pd.to_numeric(df[col], errors="coerce")
    df["CID"] = pd.to_numeric(df["CID"], errors="coerce").astype("Int64")
    df["source_file"] = path.name
    return df.copy()  # defragment after many column ops


_SPLIT_RE = re.compile(r"(vl|vr)(?=\.csv$|_|$)", re.IGNORECASE)


def split_of(path: Path) -> str:
    m = _SPLIT_RE.search(path.stem.lower())
    return {"vl": "vL", "vr": "vR"}.get(m.group(1).lower(), "all") if m else "all"


def load_league_season(dir_path: str | Path) -> pd.DataFrame:
    """All 15 league files -> one long DataFrame with league + split columns."""
    dir_path = Path(dir_path)
    frames = []
    for f in sorted(dir_path.glob("*.csv")):
        df = load_stats_export(f)
        stem = f.stem.lower()
        league = "pel" if stem.startswith("pel") else re.match(r"(hd\d+)", stem).group(1)
        df["league"] = league
        df["split"] = split_of(f)
        frames.append(df)
    return pd.concat(frames, ignore_index=True)


TOURNEY_NAME_RE = re.compile(r"^(?P<type>.+?)_(?P<id>\d+)(?:_tourn_export)?\.csv$", re.IGNORECASE)


def parse_tourney_filename(path: Path) -> tuple[str, str]:
    m = TOURNEY_NAME_RE.match(path.name)
    if not m:
        raise ValueError(f"Cannot parse tourney type/id from filename: {path.name}")
    return m.group("type").lower(), m.group("id")


def load_tourneys(dir_path: str | Path) -> pd.DataFrame:
    """All tourney exports in a folder -> long DataFrame w/ tourney_type/id."""
    dir_path = Path(dir_path)
    frames = []
    for f in sorted(dir_path.glob("*.csv")):
        ttype, tid = parse_tourney_filename(f)
        df = load_stats_export(f)
        df["tourney_type"] = ttype
        df["tourney_id"] = tid
        frames.append(df)
    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True)


# ---------------------------------------------------------------------------
# 43-column collection export
# ---------------------------------------------------------------------------

def load_collection(path: str | Path) -> pd.DataFrame:
    """LJ's collection export. NOTE: has no CID/Tier until re-exported."""
    path = Path(path)
    df = pd.read_csv(path, dtype=str, keep_default_na=False, na_values=[""])
    df = _clean(df)
    if "ACT" in df.columns:
        df["active"] = df["ACT"].astype(str).str.strip().str.lower().isin(["yes", "y"])
    if "VAR" in df.columns:
        df["variant"] = df["VAR"].astype(str).str.strip().str.upper().eq("Y")
    for col in ("CVAL",):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    if "CID" in df.columns:  # future re-export with CID included
        df["CID"] = pd.to_numeric(df["CID"], errors="coerce").astype("Int64")
    df["source_file"] = path.name
    return df


# ---------------------------------------------------------------------------
# Observed offense/pitching metrics (used by ingest + Day-2 calibration)
# ---------------------------------------------------------------------------

WOBA_W = {"BB": 0.69, "HBP": 0.72, "1B": 0.89, "2B": 1.27, "3B": 1.62, "HR": 2.10}
FIP_C = 3.10


def observed_woba(df: pd.DataFrame) -> pd.Series:
    """Observed wOBA from bat_* counting stats (NaN where PA too small/absent)."""
    ubb = df["bat_BB"] - df["bat_IBB"].fillna(0)
    denom = df["bat_AB"] + ubb + df["bat_SF"].fillna(0) + df["bat_HP"].fillna(0)
    numer = (WOBA_W["BB"] * ubb + WOBA_W["HBP"] * df["bat_HP"].fillna(0)
             + WOBA_W["1B"] * df["bat_1B"] + WOBA_W["2B"] * df["bat_2B"]
             + WOBA_W["3B"] * df["bat_3B"] + WOBA_W["HR"] * df["bat_HR"])
    return (numer / denom).where(denom > 0)


def observed_fip(df: pd.DataFrame) -> pd.Series:
    ip = df["pit_IP"]
    fip = (13 * df["pit_HR"] + 3 * (df["pit_BB"] + df["pit_HP"].fillna(0))
           - 2 * df["pit_K"]) / ip + FIP_C
    return fip.where(ip > 0)
