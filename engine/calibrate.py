"""Day-2 calibration: fit engine projections to observed PT results, then
blend observation into projection with sample-size shrinkage.

Method (all in environment-relative space, see observed.py):
  1. Fit population: cards with PA>=300 (hitters, per split >=150) / IP>=50
     (pitchers, per split >=25). proj_rel = proj / PA-weighted proj mean of the
     fit population (same normalization obs_rel has by construction).
  2. Weighted linear fit obs_rel ~ a + b*proj_rel per (hit|pit, split).
     b < 1 means the engine overspreads talent (its extremes are too extreme).
  3. Calibrated projection for ANY card: cal_rel = a + b*(proj / proj_mean).
  4. Blend: blend_rel = (n*obs_rel + k*cal_rel) / (n + k),
     k = 220 PA (hit wOBA) / 60 IP (pit FIP) — PD-guide "signal vs measurement".
  5. PEL pitcher observations adjusted by the measured opponent-strength offset
     before pooling (hitter offset measured ≈0, not applied).

Outputs:
  - engine/config/calibration.json          (fits, offsets, constants)
  - web/public/data/projections.json        (cards augmented with `evidence`)
  - web/public/data/calibration_report.json (scatter data + movers for the app)
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from observed import build_observed, league_strength_offsets, pool_observed

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PROJ_JSON = ROOT / "web" / "public" / "data" / "projections.json"
CAL_OUT = HERE / "config" / "calibration.json"
REPORT_OUT = ROOT / "web" / "public" / "data" / "calibration_report.json"

K_PA = 220.0   # hitter wOBA stabilization
K_IP = 60.0    # pitcher FIP stabilization
# Splits ONLY: the observed 'all' split is usage-contaminated (managers platoon
# by the card's platoon gap, corr +0.77), so overall blends are CONSTRUCTED
# from calibrated splits (28/72 hitters, 45/55 pitchers), never fitted.
FIT_MIN = {"hit_vL": ("PA", 150), "hit_vR": ("PA", 150),
           "pit_vL": ("IP", 25), "pit_vR": ("IP", 25)}
SPLIT_KEY = {"all": "overall", "vL": "vL", "vR": "vR"}
BLEND_W = {"hit": {"vL": 0.28, "vR": 0.72}, "pit": {"vL": 0.45, "vR": 0.55}}


def _proj_frame(payload: dict) -> pd.DataFrame:
    """cid -> projected wOBA / FIP per split from projections.json."""
    rows = []
    for c in payload["cards"]:
        if "error" in c or not c.get("cid"):
            continue
        rec = {"CID": c["cid"], "name": c["name"], "pos": c["pos"]}
        for split in ("all", "vL", "vR"):
            h = c.get(f"hitter_{SPLIT_KEY[split]}") or {}
            p = c.get(f"pitcher_{SPLIT_KEY[split]}") or {}
            rec[f"proj_woba_{split}"] = h.get("wOBA")
            rec[f"proj_fip_{split}"] = p.get("FIP")
        rows.append(rec)
    return pd.DataFrame(rows).set_index("CID")


def _wfit(x: np.ndarray, y: np.ndarray, w: np.ndarray) -> tuple[float, float, float]:
    """Weighted least squares y ~ a + b x; returns (a, b, weighted R²)."""
    W = np.sqrt(w)
    A = np.vstack([np.ones_like(x), x]).T * W[:, None]
    coef, *_ = np.linalg.lstsq(A, y * W, rcond=None)
    a, b = float(coef[0]), float(coef[1])
    pred = a + b * x
    ybar = np.average(y, weights=w)
    ss_res = np.average((y - pred) ** 2, weights=w)
    ss_tot = np.average((y - ybar) ** 2, weights=w)
    return a, b, float(1 - ss_res / ss_tot) if ss_tot > 0 else 0.0


def calibrate() -> dict:
    payload = json.loads(PROJ_JSON.read_text())
    proj = _proj_frame(payload)

    obs_raw = build_observed()
    offsets = league_strength_offsets(obs_raw)
    pit_off = offsets.get("pit_fip_rel_pel_minus_hd", 0.0)
    pooled = pool_observed(obs_raw, pel_hit_offset=0.0, pel_pit_offset=pit_off)
    pooled = pooled.join(proj, on="CID", rsuffix="_proj")

    fits: dict[str, dict] = {}
    report: dict[str, dict] = {}
    for kind in ("hit", "pit"):
        for split in ("vL", "vR"):
            key = f"{kind}_{split}"
            ncol, nmin = FIT_MIN[key]
            m_col = "woba_rel" if kind == "hit" else "fip_rel"
            p_col = f"proj_woba_{split}" if kind == "hit" else f"proj_fip_{split}"
            sub = pooled[(pooled.split == split)
                         & (pooled.is_pitcher == (kind == "pit"))
                         & pooled[m_col].notna() & pooled[p_col].notna()
                         & (pooled[ncol] >= nmin)]
            if len(sub) < 20:
                continue
            w = sub[ncol].to_numpy(float)
            proj_mean = float(np.average(sub[p_col], weights=w))
            x = sub[p_col].to_numpy(float) / proj_mean
            y = sub[m_col].to_numpy(float)
            a, b, r2 = _wfit(x, y, w)
            fits[key] = {"a": round(a, 4), "b": round(b, 4), "r2": round(r2, 3),
                         "n": int(len(sub)), "proj_mean": round(proj_mean, 4),
                         "obs_mean_env": round(float(np.average(
                             obs_raw[(obs_raw.split == split) & (obs_raw.source_kind == "league")]
                             ["env_woba" if kind == "hit" else "env_fip"].dropna())), 4)}
            report[key] = {
                "fit": fits[key],
                "points": [{"name": r.Name, "cid": int(r.CID),
                            "n": int(getattr(r, ncol)),
                            "proj": round(float(getattr(r, p_col)) / proj_mean, 3),
                            "obs": round(float(getattr(r, m_col)), 3)}
                           for r in sub.itertuples()],
            }

    # ---- augment every card with an evidence block --------------------------
    pooled_idx = {(int(r.CID), r.split): r for r in pooled.itertuples()}
    movers = []
    for c in payload["cards"]:
        if "error" in c or not c.get("cid"):
            continue
        kind = "pit" if c["pos"] in ("SP", "RP", "CL") else "hit"
        metric = "woba" if kind == "hit" else "fip"
        ev: dict = {"sources": []}
        split_abs: dict[str, float] = {}
        split_cal_abs: dict[str, float] = {}
        n_all = 0
        for split in ("vL", "vR"):
            key = f"{kind}_{split}"
            fit = fits.get(key)
            if not fit:
                continue
            p_val = (c.get(f"hitter_{SPLIT_KEY[split]}") or {}).get("wOBA") if kind == "hit" \
                else (c.get(f"pitcher_{SPLIT_KEY[split]}") or {}).get("FIP")
            if p_val is None:
                continue
            proj_rel = p_val / fit["proj_mean"]
            cal_rel = fit["a"] + fit["b"] * proj_rel
            r = pooled_idx.get((c["cid"], split))
            if kind == "hit":
                n = float(r.PA) if r is not None and pd.notna(r.woba_rel) else 0.0
                obs_rel = float(r.woba_rel) if n > 0 else None
                k = K_PA
            else:
                n = float(r.IP) if r is not None and pd.notna(r.fip_rel) else 0.0
                obs_rel = float(r.fip_rel) if n > 0 else None
                k = K_IP
            blend_rel = ((n * obs_rel + k * cal_rel) / (n + k)) if obs_rel is not None else cal_rel
            ev[f"{metric}_cal_rel_{split}"] = round(cal_rel, 3)
            ev[f"{metric}_blend_rel_{split}"] = round(blend_rel, 3)
            ev[f"{metric}_blend_{split}"] = round(blend_rel * fit["obs_mean_env"], 3)
            split_abs[split] = blend_rel * fit["obs_mean_env"]
            split_cal_abs[split] = cal_rel * fit["obs_mean_env"]
            n_all += int(n)
            if obs_rel is not None:
                ev[f"{metric}_obs_rel_{split}"] = round(obs_rel, 3)
                ev[f"n_{'PA' if kind == 'hit' else 'IP'}_{split}"] = int(n)
        # constructed overall (usage-neutral blend of calibrated splits)
        if len(split_abs) == 2:
            w = BLEND_W[kind]
            blend_all = w["vL"] * split_abs["vL"] + w["vR"] * split_abs["vR"]
            cal_all = w["vL"] * split_cal_abs["vL"] + w["vR"] * split_cal_abs["vR"]
            ev[f"{metric}_blend_all"] = round(blend_all, 3)
            ev[f"{metric}_cal_all"] = round(cal_all, 3)
            movers.append({"name": c["name"], "cid": c["cid"], "pos": c["pos"],
                           "kind": kind, "n": n_all,
                           "delta": round(blend_all - cal_all, 3)})
        # informational: raw usage-contaminated 'all' observation
        r = pooled_idx.get((c["cid"], "all"))
        if r is not None:
            ev["sources"] = r.sources
            if kind == "hit" and pd.notna(r.woba_rel) and r.PA > 0:
                ev["woba_obs_rel_all_usage"] = round(float(r.woba_rel), 3)
                ev["n_PA_all"] = int(r.PA)
            if kind == "pit" and pd.notna(r.fip_rel) and r.IP > 0:
                ev["fip_obs_rel_all_usage"] = round(float(r.fip_rel), 3)
                ev["n_IP_all"] = int(r.IP)
                if pd.notna(r.siera):
                    ev["siera_obs"] = round(float(r.siera), 2)
        c["evidence"] = ev

    payload["calibratedAt"] = datetime.now().isoformat(timespec="seconds")
    PROJ_JSON.write_text(json.dumps(payload, indent=2, default=str))

    movers = [m for m in movers if m["n"] > 0]
    movers.sort(key=lambda m: -abs(m["delta"]))
    cal = {"generatedAt": datetime.now().isoformat(timespec="seconds"),
           "k_PA": K_PA, "k_IP": K_IP,
           "leagueStrengthOffsets": offsets,
           "pelPitcherOffsetApplied": pit_off,
           "fits": fits}
    CAL_OUT.write_text(json.dumps(cal, indent=2))
    REPORT_OUT.write_text(json.dumps({**cal, "groups": report,
                                      "topMovers": movers[:25]}))
    return {"fits": {k: {kk: v[kk] for kk in ("b", "r2", "n")} for k, v in fits.items()},
            "offsets": offsets, "cardsAugmented": sum(1 for c in payload["cards"] if "evidence" in c)}


if __name__ == "__main__":
    print(json.dumps(calibrate(), indent=2))
