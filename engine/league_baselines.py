"""League baselines pulled from the user's MLB year-by-year averages file.

We use 2020–2026 average to represent the "modern OOTP" baseline since PT's sim
calibrates to recent MLB run environment. These constants feed every
ratings-to-stats conversion in projections.py.

Linear weights for wOBA (Fangraphs 2023):
  wBB=0.69, wHBP=0.72, w1B=0.89, w2B=1.27, w3B=1.62, wHR=2.10
"""
from __future__ import annotations
import pandas as pd
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MLB_FILE = ROOT / "MLB Batting Year-by-Year Averages.xls"


def load_baselines(window: tuple[int, int] = (2020, 2026)) -> dict:
    """Average MLB rate stats across the window (inclusive)."""
    tables = pd.read_html(str(MLB_FILE))
    df = tables[0]
    df = df[(df["Year"] >= window[0]) & (df["Year"] <= window[1])].copy()

    # Derive per-PA rate stats
    pa = df["PA"]
    ab = df["AB"]
    h = df["H"]
    b1 = df["1B"] if "1B" in df.columns else (h - df["2B"] - df["3B"] - df["HR"])
    bb = df["BB"]
    so = df["SO"]
    hbp = df["HBP"]
    hr = df["HR"]
    b2 = df["2B"]
    b3 = df["3B"]
    sf = df["SF"]

    def w(col):
        return (col * df["G"]).sum() / df["G"].sum()  # weighted by team-games proxy

    base = {
        "BB_rate": (w(bb) / w(pa)),
        "K_rate": (w(so) / w(pa)),
        "HBP_rate": (w(hbp) / w(pa)),
        "HR_per_BIP": (w(hr) / (w(pa) - w(bb) - w(so) - w(hbp))),
        "2B_per_BIP": (w(b2) / (w(pa) - w(bb) - w(so) - w(hbp))),
        "3B_per_BIP": (w(b3) / (w(pa) - w(bb) - w(so) - w(hbp))),
        "BABIP": (w(h) - w(hr)) / (w(ab) - w(so) - w(hr) + w(sf)),
        "SF_rate": (w(sf) / w(pa)),
        "BA": (w(h) / w(ab)),
        "OBP": ((w(h) + w(bb) + w(hbp)) / (w(ab) + w(bb) + w(hbp) + w(sf))),
        "SLG": ((w(b1) + 2 * w(b2) + 3 * w(b3) + 4 * w(hr)) / w(ab)),
        "R_per_G": w(df["R/G"]),
    }

    # wOBA linear weights (Fangraphs, contemporary)
    base["w"] = {
        "BB": 0.69, "HBP": 0.72,
        "1B": 0.89, "2B": 1.27, "3B": 1.62, "HR": 2.10,
    }
    # League wOBA implied by these weights and rates
    w_ = base["w"]
    # singles per PA = (H - HR - 2B - 3B) / PA, computed from base
    pa_total = 1.0
    b1_rate = base["BA"] * (1 - 0) - base["HR_per_BIP"] * (1 - base["BB_rate"] - base["K_rate"] - base["HBP_rate"])  # approximation
    # Simpler: derive everything from BIP composition
    bip_share = 1 - base["BB_rate"] - base["K_rate"] - base["HBP_rate"]
    base["BIP_rate"] = bip_share
    bip_hr = base["HR_per_BIP"]
    bip_2b = base["2B_per_BIP"]
    bip_3b = base["3B_per_BIP"]
    bip_h_other = base["BABIP"] * (1 - bip_hr - bip_2b - bip_3b)
    # Actually BABIP excludes HR — so hits-on-BIP-ex-HR fraction = BABIP
    bip_ex_hr = bip_share * (1 - bip_hr)
    h_in_play = bip_ex_hr * base["BABIP"]
    # Decompose in-play hits into 1B/2B/3B
    bip_2b_rate = bip_share * bip_2b
    bip_3b_rate = bip_share * bip_3b
    bip_1b_rate = max(0, h_in_play - bip_2b_rate - bip_3b_rate)
    base["1B_rate"] = bip_1b_rate
    base["2B_rate"] = bip_2b_rate
    base["3B_rate"] = bip_3b_rate
    base["HR_rate"] = bip_share * bip_hr

    numer = (
        w_["BB"] * base["BB_rate"] + w_["HBP"] * base["HBP_rate"] +
        w_["1B"] * base["1B_rate"] + w_["2B"] * base["2B_rate"] +
        w_["3B"] * base["3B_rate"] + w_["HR"] * base["HR_rate"]
    )
    # wOBA divides by AB+BB+SF+HBP, not PA, so multiply by PA/(PA - SF... approximate to ~0.98)
    base["wOBA"] = numer / (1 - 0.013)  # ~SH adjustment
    return base


if __name__ == "__main__":
    import json
    b = load_baselines()
    print(json.dumps({k: (round(v, 4) if isinstance(v, (int, float)) else v) for k, v in b.items()}, indent=2, default=str))
