"""OOTP Perfect Team — ratings to projected stats engine.

Inputs: ratings CSV exported from "Collection → Manage Cards → Full Roster Ratings".
Output: per-card projection record (hitter line, pitcher line, defense, baserun).

Scale assumption: ratings are on the 1-250 family where 100 ≈ MLB average for
the rating category. Multiplier curve used is (rating/100)^k where k=0.7 keeps
projections realistic at the extremes. Calibrated against league baselines from
the user's MLB year-by-year file (see league_baselines.py).
"""
from __future__ import annotations
import json
import math
import pandas as pd
from pathlib import Path
from typing import Optional

from league_baselines import load_baselines

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
RATINGS_CSV = ROOT / "Ratings" / "collection_-_manage_cards_collection_-_manage_cards_full_roster_ratings.csv"
OUT_JSON = ROOT / "data" / "projections.json"

# League handedness split: ~28% PA vs LHP, ~72% vs RHP
PA_VS_L = 0.28
PA_VS_R = 0.72

# Curve exponent — softens extreme ratings
# Scale: the exported CSV uses the OOTP "rating points" view where ~50 = MLB
# average for the rating category, not 100. Confirmed by collection mean ≈ 50
# and elite hitter cards (Bagwell/Aaron/McGwire) topping out at 140-150 in
# their best ratings. We center at 50 and use a gentle exponent so extremes
# (e.g., a 150-rated POW) don't blow up to unrealistic projections.
RATING_CENTER = 50.0
HIT_K_EXP = 0.55
PIT_K_EXP = 0.55

# Hitter position list for fielding
POS_FIELDING_MAP = {
    "C": ("C ABI", "C FRM", "C ARM"),
    "1B": ("IF RNG", "IF ERR", "IF ARM"),
    "2B": ("IF RNG", "IF ERR", "IF ARM"),
    "3B": ("IF RNG", "IF ERR", "IF ARM"),
    "SS": ("IF RNG", "IF ERR", "IF ARM"),
    "LF": ("OF RNG", "OF ERR", "OF ARM"),
    "CF": ("OF RNG", "OF ERR", "OF ARM"),
    "RF": ("OF RNG", "OF ERR", "OF ARM"),
}
POSITIONAL_ADJ = {  # runs per 162G defensive position adjustment (fangraphs-style)
    "C": 12.5, "SS": 7.5, "2B": 2.5, "CF": 2.5, "3B": 2.5,
    "RF": -7.5, "LF": -7.5, "1B": -12.5, "DH": -17.5,
}


def _num(x) -> Optional[float]:
    """Coerce to float; OOTP CSV uses '-' for not-applicable."""
    if x is None or x == "" or x == "-":
        return None
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def _mult(rating: Optional[float], k: float = HIT_K_EXP, inverse: bool = False) -> float:
    """Convert a rating to a multiplier vs league average.

    Rating scale: RATING_CENTER (=50) represents MLB league average for that
    category. inverse=True flips the relationship (used for K-avoidance rating
    on hitters and control/pBABIP/HRA on pitchers, where higher = better but
    the resulting stat goes DOWN).
    """
    if rating is None or rating <= 0:
        return 0.01 if not inverse else 100.0
    if inverse:
        return (RATING_CENTER / rating) ** k
    return (rating / RATING_CENTER) ** k


def project_hitter_platoon(row, baselines, vs_hand: str) -> dict:
    """Project a hitter's line vs L (vs_hand='L') or vs R ('R')."""
    suf = " vL" if vs_hand == "L" else " vR"
    babip_r = _num(row.get("BABIP"))
    ba_r = _num(row.get("BA" + suf))
    con_r = _num(row.get("CON" + suf))
    gap_r = _num(row.get("GAP" + suf))
    pow_r = _num(row.get("POW" + suf))
    eye_r = _num(row.get("EYE" + suf))
    k_r = _num(row.get("K" + suf))

    if all(r is None for r in [ba_r, con_r, gap_r, pow_r, eye_r, k_r]):
        return {}

    # Per-PA rates
    bb_rate = min(0.30, baselines["BB_rate"] * _mult(eye_r))
    k_rate = min(0.55, baselines["K_rate"] * _mult(k_r, inverse=True))
    # Contact rating modulates K too (lower CON = more K)
    if con_r is not None:
        k_rate *= _mult(con_r, k=0.30, inverse=True)
        k_rate = min(0.55, k_rate)
    hbp_rate = baselines["HBP_rate"]

    bip_share = max(0.30, 1 - bb_rate - k_rate - hbp_rate)

    # Of BIP:
    hr_bip = baselines["HR_per_BIP"] * _mult(pow_r)
    db_bip = baselines["2B_per_BIP"] * _mult(gap_r)
    tr_bip = baselines["3B_per_BIP"] * _mult(gap_r) * (1.0 if (_num(row.get("SPE")) or 50) < 60 else 1.5)
    # cap to keep BIP composition sane
    hr_bip = min(0.18, hr_bip)
    db_bip = min(0.20, db_bip)

    # BABIP applies to BIP-excluding-HR
    babip_mult = _mult(babip_r if babip_r is not None else con_r)
    babip_proj = min(0.45, baselines["BABIP"] * babip_mult)

    # Decompose into rates per PA
    hr_rate = bip_share * hr_bip
    bip_ex_hr = bip_share * (1 - hr_bip)
    h_in_play = bip_ex_hr * babip_proj
    db_rate = min(h_in_play * 0.85, bip_share * db_bip)
    tr_rate = min(h_in_play * 0.15, bip_share * tr_bip)
    b1_rate = max(0, h_in_play - db_rate - tr_rate)

    # Slash line
    ab_rate = 1 - bb_rate - hbp_rate - baselines["SF_rate"]
    hits_rate = b1_rate + db_rate + tr_rate + hr_rate
    ba = hits_rate / ab_rate if ab_rate > 0 else 0
    obp = hits_rate + bb_rate + hbp_rate
    slg = (b1_rate + 2 * db_rate + 3 * tr_rate + 4 * hr_rate) / ab_rate if ab_rate > 0 else 0

    w = baselines["w"]
    woba = (
        w["BB"] * bb_rate + w["HBP"] * hbp_rate +
        w["1B"] * b1_rate + w["2B"] * db_rate +
        w["3B"] * tr_rate + w["HR"] * hr_rate
    )

    iso = slg - ba
    return {
        "BA": round(ba, 3),
        "OBP": round(obp, 3),
        "SLG": round(slg, 3),
        "OPS": round(obp + slg, 3),
        "ISO": round(iso, 3),
        "wOBA": round(woba, 3),
        "K%": round(k_rate, 3),
        "BB%": round(bb_rate, 3),
        "HR_rate": round(hr_rate, 3),
        "BABIP": round(babip_proj, 3),
    }


def project_pitcher_platoon(row, baselines, vs_hand: str) -> dict:
    """Project pitcher rates vs the given batter handedness."""
    suf = " vL" if vs_hand == "L" else " vR"
    # CSV uses 'CON vL_1' / 'CON vR_1' for pitcher control to disambiguate
    stu = _num(row.get("STU" + suf))
    mov = _num(row.get("MOV" + suf))
    con = _num(row.get("CON" + suf + "_1"))
    pbabip = _num(row.get("PBABIP" + suf))
    hra = _num(row.get("HRA" + suf))

    if all(r is None for r in [stu, mov, con]):
        return {}

    k_rate = min(0.50, baselines["K_rate"] * _mult(stu, k=PIT_K_EXP))
    # MOV improves K some + reduces hard contact
    if mov is not None:
        k_rate *= 1 + 0.10 * (_mult(mov) - 1)
        k_rate = min(0.50, k_rate)
    bb_rate = max(0.02, baselines["BB_rate"] * _mult(con, k=PIT_K_EXP, inverse=True))
    bb_rate = min(0.20, bb_rate)
    hbp_rate = baselines["HBP_rate"]

    bip_share = max(0.30, 1 - bb_rate - k_rate - hbp_rate)
    babip_proj = baselines["BABIP"] * _mult(pbabip or 100, inverse=True)
    babip_proj = min(0.40, max(0.20, babip_proj))
    hr_bip = baselines["HR_per_BIP"] * _mult(hra or 100, inverse=True)
    hr_bip = min(0.15, hr_bip)
    if mov is not None:
        hr_bip *= _mult(mov, inverse=True)
        hr_bip = min(0.15, hr_bip)

    hr_rate = bip_share * hr_bip
    hits_in_play = bip_share * (1 - hr_bip) * babip_proj
    hits_rate = hits_in_play + hr_rate

    # FIP-style ERA estimator.
    # IP/PA: a PA ends in 1 out (1/3 IP) unless it's a hit, BB, or HBP.
    ip_per_pa = max(0.05, (1 - hits_rate - bb_rate - hbp_rate) / 3.0)
    pa_per_9 = 9 / ip_per_pa
    k9 = k_rate * pa_per_9
    bb9 = bb_rate * pa_per_9
    hr9 = hr_rate * pa_per_9
    hbp9 = hbp_rate * pa_per_9
    # FIP = (13*HR + 3*(BB+HBP) - 2*K) / IP + C.
    # With per-9 inputs: FIP = (13*HR9 + 3*(BB9+HBP9) - 2*K9) / 9 + C.
    FIP_CONSTANT = 3.10
    fip = (13 * hr9 + 3 * (bb9 + hbp9) - 2 * k9) / 9 + FIP_CONSTANT

    woba_against = (
        baselines["w"]["BB"] * bb_rate + baselines["w"]["HBP"] * hbp_rate +
        baselines["w"]["1B"] * (hits_in_play * 0.80) +
        baselines["w"]["2B"] * (hits_in_play * 0.17) +
        baselines["w"]["3B"] * (hits_in_play * 0.03) +
        baselines["w"]["HR"] * hr_rate
    )

    return {
        "FIP": round(max(0.50, min(12.00, fip)), 2),
        "K/9": round(k9, 2),
        "BB/9": round(bb9, 2),
        "HR/9": round(hr9, 2),
        "BABIP_against": round(babip_proj, 3),
        "wOBA_against": round(woba_against, 3),
    }


def project_defense(row) -> dict:
    """Defensive runs above average per 162 games at each rated position."""
    positions = []
    for pos in POS_FIELDING_MAP:
        rating_at_pos = _num(row.get(pos))
        if rating_at_pos is None or rating_at_pos <= 0:
            continue
        rng_col, err_col, arm_col = POS_FIELDING_MAP[pos]
        rng = _num(row.get(rng_col)) or 50
        err = _num(row.get(err_col)) or 50
        arm = _num(row.get(arm_col)) or 50
        # Special-case catcher: use C FRM heavily (framing is huge)
        if pos == "C":
            frm = _num(row.get("C FRM")) or 50
            arm_c = _num(row.get("C ARM")) or 50
            runs = 0.40 * (frm - 100) + 0.10 * (arm_c - 100) + 0.05 * (_num(row.get("C ABI")) or 50 - 100)
        else:
            # Outfielders weight ARM more; infielders weight RNG and DP
            if pos in ("LF", "CF", "RF"):
                runs = 0.20 * (rng - 100) + 0.05 * (-1 * (err - 100)) + 0.08 * (arm - 100)
                if pos == "CF":
                    runs *= 1.15
            else:
                tdp = _num(row.get("TDP")) or 50
                runs = 0.18 * (rng - 100) + 0.05 * (-1 * (err - 100)) + 0.06 * (arm - 100) + 0.04 * (tdp - 100)
        positions.append({
            "pos": pos,
            "position_rating": rating_at_pos,
            "def_runs_per_162": round(runs, 1),
            "with_position_adj": round(runs + POSITIONAL_ADJ.get(pos, 0), 1),
        })
    positions.sort(key=lambda p: -p["with_position_adj"])
    return {"positions": positions}


def project_baserun(row) -> dict:
    spe = _num(row.get("SPE")) or 50
    ste = _num(row.get("STE")) or 50
    sr = _num(row.get("SR")) or 50
    run = _num(row.get("RUN")) or 50
    # Rough: 0.05 runs per game per 10 rating points above 100, spread across speed metrics
    avg = (spe * 0.30 + ste * 0.20 + sr * 0.20 + run * 0.30)
    bsr_runs_162 = (avg - 100) * 0.20
    return {
        "SPE": int(spe), "STE": int(ste), "SR": int(sr), "RUN": int(run),
        "bsr_runs_per_162": round(bsr_runs_162, 1),
    }


def overall_card_value(card: dict, baselines: dict) -> dict:
    """Combine projections into a single overall score (runs above avg per 600 PA)."""
    if card.get("hitter_overall"):
        h = card["hitter_overall"]
        # wRAA = ((wOBA - lgwOBA)/wOBA_scale) * PA, scale ≈ 1.25
        wraa_600 = ((h["wOBA"] - baselines["wOBA"]) / 1.25) * 600
        bsr = card["baserun"]["bsr_runs_per_162"] * (600 / 700)  # PA→game scale
        # Use best defensive position with positional adj
        best_def = max((p["with_position_adj"] for p in card["defense"]["positions"]), default=0)
        wins = (wraa_600 + bsr + best_def) / 10.0  # ~10 runs per win
        return {
            "wRAA_per_600": round(wraa_600, 1),
            "BsR_per_162": round(bsr, 1),
            "best_def_runs_162": round(best_def, 1),
            "WAR_per_600": round(wins, 2),
        }
    elif card.get("pitcher_overall"):
        p = card["pitcher_overall"]
        # Lower FIP = better; convert to runs-above-avg per 180 IP
        ra_per_9 = max(1.5, p["FIP"])
        # baseline ERA ~ 4.20 in 2020-2026
        baseline_ra = 4.20
        runs_above = (baseline_ra - ra_per_9) * (180 / 9)
        wins = runs_above / 10.0
        return {
            "RAA_per_180IP": round(runs_above, 1),
            "WAR_per_180IP": round(wins, 2),
        }
    return {}


def project_card(row: dict, baselines: dict) -> dict:
    pos = row.get("POS", "")
    is_pitcher = pos in ("SP", "RP", "CL")

    out = {
        "cid": int(_num(row.get("CID")) or 0),
        "name": row.get("Name", "").strip(),
        "pos": pos,
        "bats": row.get("B", ""),
        "throws": row.get("T", ""),
        "tier": row.get("CTier", ""),
        "buy": row.get("BUY", ""),
        "sell": row.get("SELL", ""),
        "lock": row.get("Lock", "No") == "Yes",
        "var": row.get("VAR", ""),
        "vlvl": row.get("VLvl", ""),
    }

    if not is_pitcher:
        # Hitter projections
        vL = project_hitter_platoon(row, baselines, "L")
        vR = project_hitter_platoon(row, baselines, "R")
        # Overall = weighted blend by typical PA share
        overall = {}
        if vL and vR:
            for k in vL.keys():
                overall[k] = round(vL[k] * PA_VS_L + vR[k] * PA_VS_R, 3)
        out["hitter_vL"] = vL
        out["hitter_vR"] = vR
        out["hitter_overall"] = overall
        out["defense"] = project_defense(row)
        out["baserun"] = project_baserun(row)
    else:
        # Pitcher projections
        pL = project_pitcher_platoon(row, baselines, "L")
        pR = project_pitcher_platoon(row, baselines, "R")
        # Pitchers face slightly more same-handed batters in real lineups, simplify 50/50
        overall = {}
        if pL and pR:
            for k in pL.keys():
                overall[k] = round(pL[k] * 0.45 + pR[k] * 0.55, 3)
        out["pitcher_vL"] = pL
        out["pitcher_vR"] = pR
        out["pitcher_overall"] = overall
        out["stamina"] = int(_num(row.get("STM")) or 0)
        out["hold"] = int(_num(row.get("HLD")) or 0)

    out["value"] = overall_card_value(out, baselines)
    return out


def build_projections(out_path: Path = OUT_JSON) -> dict:
    baselines = load_baselines()
    df = pd.read_csv(RATINGS_CSV, low_memory=False)
    records = []
    for _, row in df.iterrows():
        try:
            records.append(project_card(row.to_dict(), baselines))
        except Exception as e:
            records.append({"name": row.get("Name"), "error": str(e)})
    payload = {
        "baselines": baselines,
        "card_count": len(records),
        "cards": records,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2, default=str))
    return payload


if __name__ == "__main__":
    p = build_projections()
    print(f"Wrote {p['card_count']} cards to {OUT_JSON}")
    # Quick sanity print
    sample = next((c for c in p["cards"] if c["name"] == "Jeff Bagwell"), None)
    if sample:
        print(json.dumps(sample, indent=2, default=str))
