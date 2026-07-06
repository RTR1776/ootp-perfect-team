"""Build tournament/draft config + RE contexts from the hand-maintained xlsx.

Source of truth: data-src/OOTP26 Historic Tourney_Draft List.xlsx
  - Sheet "Tournaments": one row per rule-version (startdate/enddate windows).
  - Sheet "Drafts": Perfect Draft events, keyed by DraftType.

Outputs:
  - engine/config/tournaments.json  (full config incl. historical rule versions)
  - web/public/data/contexts.json   (active contexts w/ RE baselines for the webapp)

Draft pack mechanics (from LJ, 2026-07-06): packs usually show 6 cards of one
tier (Perfect/Diamond/Gold/...); 26 total cards are drafted; some packs pick 1,
some pick 2; the last round is sometimes pick-5-of-iron. Exact pack schedule
varies BY DRAFT TYPE and lives in DRAFT_TYPE_RULES below — entries with
"packSchedule": None still need LJ to fill the round-by-round schedule.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
XLSX = ROOT / "data-src" / "OOTP26 Historic Tourney_Draft List.xlsx"
CONFIG_OUT = HERE / "config" / "tournaments.json"
CONTEXTS_OUT = ROOT / "web" / "public" / "data" / "contexts.json"

MODERN_WINDOW = (2020, 2026)
RE_HALF_WINDOW = 2  # year-specific RE -> [year-2, year+2] to smooth old-era noise

# Known pack-schedule scaffolding per DraftType. packSchedule format:
#   [{"round": 1, "packTier": "Diamond", "shown": 6, "picks": 1}, ...]
# None = TODO: LJ to supply the round-by-round schedule for that type.
DRAFT_TYPE_DEFAULTS = {
    "totalPicks": 26,
    "packSize": 6,
    "clockSeconds": 900,  # 15:00 — LJ confirm whether global or per-pick per type
    "packSchedule": None,
}
DRAFT_TYPE_NOTES = {
    "Original": "The OG PD format.",
    "Double": "Two picks on some/all packs.",
    "Historic Double": "Historic pool, double picks.",
    "8 Round": "8 rounds only — schedule differs from 26-pick standard.",
    "Diamond And Gold Only": "Packs limited to Diamond and Gold tiers.",
    "Silver Only": "Silver-tier packs only.",
    "Silver, Bronze, and Iron": "Lower-tier pool.",
    "Nearly Perfect": "Includes Perfect-tier packs.",
    "Pitchers First": "Pitching rounds come first.",
    "Positional": "Packs grouped by position.",
    "Speed": "Reduced clock.",
    "Non Live Speed": "No Live cards; reduced clock.",
    "Non Live": "No Live cards.",
    "Live": "Live cards only.",
    "Half and Half": "Half one pool/rule, half another.",
    "Rocking Chair": "Veteran/era-restricted pool.",
    "Mixed Bag 1": "Mixed-tier packs, variant 1.",
    "Mixed Bag 2": "Mixed-tier packs, variant 2.",
    "Historic": "Historic (non-live) pool.",
    "Original OOTP Era": "Original format, OOTP-era pool.",
}


def _s(v):
    """Cell -> clean scalar (None for blanks/NaN, int for whole floats, str otherwise)."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if isinstance(v, str):
        v = v.strip()
        return v if v else None
    return v


def _yn(v):
    v = _s(v)
    if v is None:
        return None
    return str(v).upper() == "Y"


def load_sheets() -> tuple[pd.DataFrame, pd.DataFrame]:
    tours = pd.read_excel(XLSX, sheet_name="Tournaments")
    drafts = pd.read_excel(XLSX, sheet_name="Drafts")
    return tours, drafts


def tournament_records(tours: pd.DataFrame) -> list[dict]:
    recs = []
    for _, r in tours.iterrows():
        if _s(r.get("name")) is None:
            continue
        recs.append({
            "name": _s(r["name"]),
            "startDate": _s(r.get("startdate")),
            "endDate": _s(r.get("enddate")),  # None => currently active ruleset
            "tierGroup": _s(r.get("tier")),
            "subtier": _s(r.get("subtier")),
            "subcategory": _s(r.get("subcategory")),
            "cardValueCeiling": _s(r.get("ceiling")),
            "cardValueFloor": _s(r.get("floor")),
            "teamValueCap": _s(r.get("capnum")) if _yn(r.get("capyn")) else None,
            # 've' cap semantics TBD — stored raw until LJ confirms meaning
            "veCap": _s(r.get("vecapnum")) if _yn(r.get("vecap")) else None,
            "dh": _yn(r.get("dh")),
            "modernRE": _yn(r.get("modern")),
            "reYear": _s(r.get("year")),
            "mode": _s(r.get("mode")),
            "teams": _s(r.get("teams")),
            "cardEligibility": {
                "live": _yn(r.get("live")),
                "unsung": _yn(r.get("unsung")),
                "snapshot": _yn(r.get("snapshot")),
                "nel": _yn(r.get("nel")),
                "fl": _yn(r.get("fl")),
                "legend": _yn(r.get("legend")),
                "hh": _yn(r.get("hh")),
                "allstar": _yn(r.get("allstar")),
                "rookie": _yn(r.get("rookie")),
            },
            "cardEraMax": _s(r.get("eramax")),
            "cardEraMin": _s(r.get("eramin")),
            "prize": _s(r.get("prize")),
        })
    return recs


def draft_records(drafts: pd.DataFrame) -> list[dict]:
    recs = []
    for _, r in drafts.iterrows():
        if _s(r.get("Name")) is None:
            continue
        recs.append({
            "name": _s(r["Name"]),
            "startDate": _s(r.get("StartDate")),
            "endDate": _s(r.get("EndDate")),
            "draftType": _s(r.get("DraftType")),
            "cadence": _s(r.get("Tier")),  # "Daily Draft" | "Weekly Draft"
            "subcategory": _s(r.get("Subcategory")),
            "defaultRE": _yn(r.get("Default_RE")),
            "reYear": _s(r.get("Year")),
            "mode": _s(r.get("Mode")),
            "teams": _s(r.get("Teams")),
            "dh": _yn(r.get("DH")),
            "prize": _s(r.get("Top Prize")),
        })
    return recs


def slug(name: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in name.lower()).strip("_")


def re_window(modern: bool | None, year) -> tuple[int, int]:
    if modern or year is None:
        return MODERN_WINDOW
    y = int(year)
    return (max(1871, y - RE_HALF_WINDOW), min(2026, y + RE_HALF_WINDOW))


def context_baselines(window: tuple[int, int]) -> dict:
    """load_baselines for a window, tolerating missing early-era columns."""
    import league_baselines as lb

    tables = pd.read_html(str(lb.MLB_FILE))
    df = tables[0]
    df = df[(df["Year"] >= window[0]) & (df["Year"] <= window[1])].copy()
    if df.empty:
        raise ValueError(f"No MLB rows in window {window}")
    # Early eras: SF/HBP/IBB/SO sometimes untracked -> treat as 0
    for col in ("SF", "HBP", "IBB", "SO", "CS", "GDP"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # Reuse load_baselines math by temporarily pointing it at the filtered frame
    # (simplest faithful reuse: replicate the weighted-rate computation)
    pa, ab, h = df["PA"], df["AB"], df["H"]
    b1 = df["1B"] if "1B" in df.columns else (h - df["2B"] - df["3B"] - df["HR"])
    bb, so, hbp, hr, b2, b3, sf = df["BB"], df["SO"], df["HBP"], df["HR"], df["2B"], df["3B"], df["SF"]

    def w(col):
        return (col * df["G"]).sum() / df["G"].sum()

    bip = w(pa) - w(bb) - w(so) - w(hbp)
    base = {
        "window": list(window),
        "BB_rate": w(bb) / w(pa),
        "K_rate": w(so) / w(pa),
        "HBP_rate": w(hbp) / w(pa),
        "HR_per_BIP": w(hr) / bip,
        "2B_per_BIP": w(b2) / bip,
        "3B_per_BIP": w(b3) / bip,
        "BABIP": (w(h) - w(hr)) / max(w(ab) - w(so) - w(hr) + w(sf), 1e-9),
        "BA": w(h) / w(ab),
        "OBP": (w(h) + w(bb) + w(hbp)) / (w(ab) + w(bb) + w(hbp) + w(sf)),
        "SLG": (w(b1) + 2 * w(b2) + 3 * w(b3) + 4 * w(hr)) / w(ab),
        "R_per_G": w(df["R/G"]),
        "w": {"BB": 0.69, "HBP": 0.72, "1B": 0.89, "2B": 1.27, "3B": 1.62, "HR": 2.10},
    }
    return {k: (round(v, 5) if isinstance(v, float) else v) for k, v in base.items()}


def build() -> dict:
    tours, drafts = load_sheets()
    t_recs = tournament_records(tours)
    d_recs = draft_records(drafts)

    draft_types = {}
    for d in d_recs:
        dt = d["draftType"]
        if dt and dt not in draft_types:
            draft_types[dt] = {
                **DRAFT_TYPE_DEFAULTS,
                "notes": DRAFT_TYPE_NOTES.get(dt, ""),
            }

    config = {
        "generatedFrom": XLSX.name,
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "draftMechanics": {
            "summary": "Packs usually show 6 cards of one tier; 26 total picks; "
                       "some packs pick 1, some pick 2; final round sometimes "
                       "pick-5-of-Iron. Schedule varies by draftType.",
            "confirmedBy": "LJ 2026-07-06",
        },
        "tournaments": t_recs,
        "drafts": d_recs,
        "draftTypes": draft_types,
    }
    CONFIG_OUT.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_OUT.write_text(json.dumps(config, indent=1))

    # Active contexts for the webapp (active = no endDate), with RE baselines.
    baseline_cache: dict[tuple[int, int], dict] = {}

    def ctx_for(name, kind, modern, year, extra):
        win = re_window(modern, year)
        if win not in baseline_cache:
            baseline_cache[win] = context_baselines(win)
        return {
            "key": f"{kind}:{slug(name)}",
            "label": name,
            "kind": kind,
            "reYear": year if not modern else None,
            "re": baseline_cache[win],
            "park": None,  # None => neutral; LJ can override per context later
            **extra,
        }

    contexts = [{
        "key": "season:pt_season",
        "label": "PT Season (home: 2013 Citi Field)",
        "kind": "season",
        "reYear": None,
        "re": baseline_cache.setdefault(MODERN_WINDOW, context_baselines(MODERN_WINDOW)),
        "park": "Citi Field 2013",
    }]
    for t in t_recs:
        if t["endDate"] is None:
            contexts.append(ctx_for(t["name"], "tournament", t["modernRE"], t["reYear"], {
                "rules": {k: t[k] for k in (
                    "cardValueCeiling", "cardValueFloor", "teamValueCap", "veCap",
                    "dh", "mode", "cardEraMax", "cardEraMin")},
                "cardEligibility": t["cardEligibility"],
            }))
    for d in d_recs:
        if d["endDate"] is None:
            contexts.append(ctx_for(d["name"], "draft", d["defaultRE"], d["reYear"], {
                "draftType": d["draftType"],
                "cadence": d["cadence"],
                "rules": {"dh": d["dh"], "mode": d["mode"]},
            }))

    CONTEXTS_OUT.parent.mkdir(parents=True, exist_ok=True)
    CONTEXTS_OUT.write_text(json.dumps({
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "draftTypes": draft_types,
        "contexts": contexts,
    }, indent=1))

    return {"tournaments": len(t_recs), "drafts": len(d_recs),
            "draftTypes": len(draft_types), "contexts": len(contexts),
            "reWindows": len(baseline_cache)}


if __name__ == "__main__":
    print(json.dumps(build(), indent=2))
