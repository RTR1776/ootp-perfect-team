"""Projection engine v2 — empirical curves (see curves.py) instead of the
hand-tuned power curve that saturated at PT rating ranges.

Frame: "modern PT league" — rates are what the card should post in a current
PT league (era contexts rescale in the app via baseline ratios).

Overall lines are 28/72 (hitters) and 45/55 (pitchers) blends of the split
projections — the observed 'all' split is usage-contaminated (managers platoon
hard: PA-vs-L share correlates +0.77 with platoon gap), so overall is a
construction, not a calibration target.

Defense, baserunning, and card-meta handling reuse v1 (projections.py).
"""
from __future__ import annotations

import json
from pathlib import Path

from projections import (_num, project_defense, project_baserun,
                         PA_VS_L, PA_VS_R)

HERE = Path(__file__).resolve().parent
CURVES_JSON = HERE / "config" / "curves.json"

WOBA_W = {"BB": 0.69, "HBP": 0.72, "1B": 0.89, "2B": 1.27, "3B": 1.62, "HR": 2.10}
FIP_C = 3.10
PIT_VS_L, PIT_VS_R = 0.45, 0.55

_curves_cache: dict | None = None


def curves() -> dict:
    global _curves_cache
    if _curves_cache is None:
        _curves_cache = json.loads(CURVES_JSON.read_text())
    return _curves_cache


def _rate(kind: str, comp: str, rating: float | None) -> float | None:
    c = curves()[kind].get(comp)
    if c is None or rating is None or rating <= 0:
        return None
    return c["env_rate"] * (rating / 50.0) ** c["beta"] * pow(2.718281828, c["alpha"])


def _env_woba() -> float:
    """League-mean wOBA implied by the env rates (cached on the curves dict)."""
    c = curves()
    if "_env_woba" not in c:
        h = c["hit"]
        k, bb = h["k"]["env_rate"], h["bb"]["env_rate"]
        hbp = h["hbp_rate_env"]
        bip = 1 - k - bb - hbp
        hr = bip * h["hr"]["env_rate"]
        hip = bip * (1 - h["hr"]["env_rate"]) * h["babip"]["env_rate"]
        xbh = min(bip * h["xbh"]["env_rate"], hip * 0.9)
        s3 = h["xbh_3b_share"]
        b3, b2 = xbh * s3, xbh * (1 - s3)
        b1 = hip - xbh
        c["_env_woba"] = (WOBA_W["BB"] * bb + WOBA_W["HBP"] * hbp + WOBA_W["1B"] * b1
                          + WOBA_W["2B"] * b2 + WOBA_W["3B"] * b3 + WOBA_W["HR"] * hr)
    return c["_env_woba"]


def _env_fip() -> float:
    c = curves()
    if "_env_fip" not in c:
        p = c["pit"]
        k, bb, hbp = p["k"]["env_rate"], p["bb"]["env_rate"], p["hbp_rate_env"]
        bip = 1 - k - bb - hbp
        hr = bip * p["hr"]["env_rate"]
        hip = bip * (1 - p["hr"]["env_rate"]) * p["babip"]["env_rate"]
        ip_per_pa = max(0.05, (1 - hip - hr - bb - hbp) / 3.0)
        per9 = 9 / ip_per_pa
        c["_env_fip"] = (13 * hr * per9 + 3 * (bb + hbp) * per9 - 2 * k * per9) / 9 + FIP_C
    return c["_env_fip"]


def project_hitter_platoon(row, vs_hand: str) -> dict:
    suf = " vL" if vs_hand == "L" else " vR"
    ba_r = _num(row.get("BA" + suf))
    gap_r = _num(row.get("GAP" + suf))
    pow_r = _num(row.get("POW" + suf))
    eye_r = _num(row.get("EYE" + suf))
    k_r = _num(row.get("K" + suf))
    if all(r is None for r in (ba_r, gap_r, pow_r, eye_r, k_r)):
        return {}

    h = curves()["hit"]
    k_rate = min(0.55, _rate("hit", "k", k_r) or h["k"]["env_rate"])
    bb_rate = min(0.30, _rate("hit", "bb", eye_r) or h["bb"]["env_rate"])
    hbp_rate = h["hbp_rate_env"]
    bip_share = max(0.30, 1 - k_rate - bb_rate - hbp_rate)

    hr_bip = min(0.18, _rate("hit", "hr", pow_r) or h["hr"]["env_rate"])
    xbh_bip = min(0.22, _rate("hit", "xbh", gap_r) or h["xbh"]["env_rate"])
    babip = min(0.42, max(0.20, _rate("hit", "babip", ba_r) or h["babip"]["env_rate"]))

    hr_rate = bip_share * hr_bip
    hits_in_play = bip_share * (1 - hr_bip) * babip
    xbh_rate = min(hits_in_play * 0.90, bip_share * xbh_bip)
    s3 = h["xbh_3b_share"]
    spe = _num(row.get("SPE")) or 50
    s3 = s3 * (1.4 if spe >= 90 else 0.6 if spe < 40 else 1.0)
    tr_rate = xbh_rate * s3
    db_rate = xbh_rate - tr_rate
    b1_rate = max(0.0, hits_in_play - xbh_rate)

    ab_rate = 1 - bb_rate - hbp_rate - 0.005
    hits_rate = b1_rate + db_rate + tr_rate + hr_rate
    ba = hits_rate / ab_rate if ab_rate > 0 else 0
    obp = hits_rate + bb_rate + hbp_rate
    slg = (b1_rate + 2 * db_rate + 3 * tr_rate + 4 * hr_rate) / ab_rate if ab_rate > 0 else 0
    woba = (WOBA_W["BB"] * bb_rate + WOBA_W["HBP"] * hbp_rate + WOBA_W["1B"] * b1_rate
            + WOBA_W["2B"] * db_rate + WOBA_W["3B"] * tr_rate + WOBA_W["HR"] * hr_rate)
    return {"BA": round(ba, 3), "OBP": round(obp, 3), "SLG": round(slg, 3),
            "OPS": round(obp + slg, 3), "ISO": round(slg - ba, 3),
            "wOBA": round(woba, 3), "K%": round(k_rate, 3), "BB%": round(bb_rate, 3),
            "HR_rate": round(hr_rate, 3), "BABIP": round(babip, 3)}


def project_pitcher_platoon(row, vs_hand: str) -> dict:
    suf = " vL" if vs_hand == "L" else " vR"
    stu = _num(row.get("STU" + suf))
    con = _num(row.get("CON" + suf + "_1"))
    pbabip = _num(row.get("PBABIP" + suf))
    hra = _num(row.get("HRA" + suf))
    if all(r is None for r in (stu, con)):
        return {}

    p = curves()["pit"]
    k_rate = min(0.50, _rate("pit", "k", stu) or p["k"]["env_rate"])
    bb_rate = min(0.20, max(0.02, _rate("pit", "bb", con) or p["bb"]["env_rate"]))
    hbp_rate = p["hbp_rate_env"]
    bip_share = max(0.30, 1 - k_rate - bb_rate - hbp_rate)
    hr_bip = min(0.15, _rate("pit", "hr", hra) or p["hr"]["env_rate"])
    babip = min(0.40, max(0.20, _rate("pit", "babip", pbabip) or p["babip"]["env_rate"]))

    hr_rate = bip_share * hr_bip
    hits_in_play = bip_share * (1 - hr_bip) * babip
    hits_rate = hits_in_play + hr_rate

    ip_per_pa = max(0.05, (1 - hits_rate - bb_rate - hbp_rate) / 3.0)
    per9 = 9 / ip_per_pa
    k9, bb9, hr9, hbp9 = (r * per9 for r in (k_rate, bb_rate, hr_rate, hbp_rate))
    fip = (13 * hr9 + 3 * (bb9 + hbp9) - 2 * k9) / 9 + FIP_C
    woba_against = (WOBA_W["BB"] * bb_rate + WOBA_W["HBP"] * hbp_rate
                    + WOBA_W["1B"] * hits_in_play * 0.80
                    + WOBA_W["2B"] * hits_in_play * 0.17
                    + WOBA_W["3B"] * hits_in_play * 0.03
                    + WOBA_W["HR"] * hr_rate)
    return {"FIP": round(max(0.50, min(12.0, fip)), 2),
            "K/9": round(k9, 2), "BB/9": round(bb9, 2), "HR/9": round(hr9, 2),
            "BABIP_against": round(babip, 3), "wOBA_against": round(woba_against, 3)}


def overall_card_value(card: dict) -> dict:
    if card.get("hitter_overall"):
        h = card["hitter_overall"]
        wraa_600 = ((h["wOBA"] - _env_woba()) / 1.25) * 600
        bsr = card["baserun"]["bsr_runs_per_162"] * (600 / 700)
        best_def = max((p["with_position_adj"] for p in card["defense"]["positions"]), default=0)
        return {"wRAA_per_600": round(wraa_600, 1), "BsR_per_162": round(bsr, 1),
                "best_def_runs_162": round(best_def, 1),
                "WAR_per_600": round((wraa_600 + bsr + best_def) / 10.0, 2)}
    if card.get("pitcher_overall"):
        p = card["pitcher_overall"]
        runs_above = (_env_fip() - max(1.0, p["FIP"])) * (180 / 9)
        return {"RAA_per_180IP": round(runs_above, 1),
                "WAR_per_180IP": round(runs_above / 10.0, 2)}
    return {}


def project_card(row: dict, baselines: dict | None = None) -> dict:
    """Drop-in replacement for projections.project_card (v2 curves)."""
    pos = row.get("POS", "")
    is_pitcher = pos in ("SP", "RP", "CL")
    out = {
        "cid": int(_num(row.get("CID")) or 0),
        "name": str(row.get("Name", "")).strip(),
        "pos": pos,
        "bats": row.get("B", ""), "throws": row.get("T", ""),
        "tier": row.get("CTier", ""),
        "buy": row.get("BUY", ""), "sell": row.get("SELL", ""),
        "lock": row.get("Lock", "No") == "Yes",
        "var": row.get("VAR", ""), "vlvl": row.get("VLvl", ""),
        "engine": "v2-empirical",
    }
    if not is_pitcher:
        vL = project_hitter_platoon(row, "L")
        vR = project_hitter_platoon(row, "R")
        overall = ({k: round(vL[k] * PA_VS_L + vR[k] * PA_VS_R, 3) for k in vL}
                   if vL and vR else {})
        out.update(hitter_vL=vL, hitter_vR=vR, hitter_overall=overall,
                   defense=project_defense(row), baserun=project_baserun(row))
    else:
        pL = project_pitcher_platoon(row, "L")
        pR = project_pitcher_platoon(row, "R")
        overall = ({k: round(pL[k] * PIT_VS_L + pR[k] * PIT_VS_R, 3) for k in pL}
                   if pL and pR else {})
        out.update(pitcher_vL=pL, pitcher_vR=pR, pitcher_overall=overall,
                   stamina=int(_num(row.get("STM")) or 0),
                   hold=int(_num(row.get("HLD")) or 0))
    out["value"] = overall_card_value(out)
    return out


def pt_env() -> dict:
    return {"wOBA": round(_env_woba(), 4), "FIP": round(_env_fip(), 3)}
