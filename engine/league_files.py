"""Which league season exports are current, and where they live.

The engine used to read one folder, ``Most recent League Season/``. That folder
no longer exists — exports are filed a week at a time under
``League Data/<YYYY-MM-DD>/`` — so every entry point that reached for it has
been raising FileNotFoundError.

Restoring it is not simply "read the newest folder": not every league is
exported every week. As of 2026-09-06 the newest week holds HD452, HD453 and
LD404, while HD450 was last exported 2026-08-23 and PEL 2026-08-30. Taking the
newest folder alone would silently drop three leagues from the calibration
backbone. So the current file for each (league, split) is resolved
independently and the newest one wins, which is the same rule the web app uses
for league snapshots.

Stdlib only, on purpose: this resolves paths and can be tested without pandas.
"""
from __future__ import annotations

import re
from pathlib import Path

# hd452 / ld404, tolerating OOTP's own naming (ld404vR_statistics_….csv) and
# the dated exports (2049_HD451_all.csv). Underscore is not a boundary here,
# so \b cannot be used.
_LEAGUE_RE = re.compile(r"(?<![a-z0-9])(hd|ld)(\d{3})(?![0-9])")
# The split marker is not always its own token: 'ld404vR' hangs it straight off
# the league. Guarded both sides so 'view' or 'vlad' can never read as a split.
_SPLIT_RE = re.compile(r"(?:^|[^a-z])(versus_left|versus_right|vl|vr)(?![a-z])")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

LEGACY_DIR = "Most recent League Season"
WEEKLY_DIR = "League Data"


def league_of(path) -> str | None:
    """'hd452_vL.csv' -> 'hd452'; None when the filename names no league."""
    stem = Path(path).stem.lower()
    if "pel" in stem:
        return "pel"
    m = _LEAGUE_RE.search(stem)
    return f"{m.group(1)}{m.group(2)}" if m else None


def split_of(path) -> str:
    """'all' | 'vL' | 'vR', read from the filename."""
    m = _SPLIT_RE.search(Path(path).stem.lower())
    if not m:
        return "all"
    return "vL" if m.group(1) in ("vl", "versus_left") else "vR"


def _week_key(path: Path) -> tuple:
    """Sort key: the YYYY-MM-DD folder if there is one, else file mtime."""
    parent = path.parent.name
    if _DATE_RE.match(parent):
        return (1, parent)
    try:
        return (0, str(path.stat().st_mtime))
    except OSError:
        return (0, "")


def latest_league_files(root) -> list[Path]:
    """Newest export per (league, split) across every filed week.

    ``Most recent League Season/`` still wins outright when it exists, so an
    explicitly curated folder keeps overriding the automatic pick.
    """
    root = Path(root)
    legacy = root / LEGACY_DIR
    if legacy.is_dir():
        files = sorted(legacy.glob("*.csv"))
        if files:
            return files

    weekly = root / WEEKLY_DIR
    if not weekly.is_dir():
        raise FileNotFoundError(
            f"No league exports: expected {legacy} or {weekly}/<YYYY-MM-DD>/*.csv"
        )

    best: dict[tuple[str, str], Path] = {}
    for key, files in league_file_candidates(root).items():
        best[key] = files[0]

    if not best:
        raise FileNotFoundError(f"No league exports found under {weekly}")
    return [best[k] for k in sorted(best)]


def league_file_candidates(root) -> dict[tuple[str, str], list[Path]]:
    """Every filed export per (league, split), NEWEST FIRST.

    Callers that can read the files use this to fall back when the newest one
    is truncated — OOTP will happily export a stats view with the pitching
    block missing, and the 2026-08-30 HD451 export is exactly that: 473 rows,
    4 of them pitchers, 634 innings where the week before had 43,500.
    """
    root = Path(root)
    legacy = root / LEGACY_DIR
    if legacy.is_dir() and any(legacy.glob("*.csv")):
        out: dict[tuple[str, str], list[Path]] = {}
        for f in sorted(legacy.glob("*.csv")):
            league = league_of(f)
            if league is not None:
                out.setdefault((league, split_of(f)), []).append(f)
        return out

    weekly = root / WEEKLY_DIR
    if not weekly.is_dir():
        raise FileNotFoundError(
            f"No league exports: expected {legacy} or {weekly}/<YYYY-MM-DD>/*.csv"
        )

    grouped: dict[tuple[str, str], list[Path]] = {}
    for f in weekly.glob("*/*.csv"):
        league = league_of(f)
        if league is None:
            continue  # not a league export; tourney files live elsewhere
        grouped.setdefault((league, split_of(f)), []).append(f)
    for files in grouped.values():
        files.sort(key=_week_key, reverse=True)
    return grouped
