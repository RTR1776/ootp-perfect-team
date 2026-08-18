#!/usr/bin/env python3
"""
OOTP PT Card Projector — ratings in, projected line out.

Implements the empirical rating->outcome model:
    rate = env_rate * exp(alpha) * (rating/50)^beta

Works for ANY card, including brand-new ones that have never been played.
No league data needed at runtime — only the fitted curves.

Usage:
  python3 card_projector.py --hitter --BA 120 --GAP 110 --POW 140 --EYE 130 --K 115
  python3 card_projector.py --pitcher --STU 150 --CON 120 --HRA 130 --PBABIP 110
  python3 card_projector.py --validate      # check vs known cards
"""
from __future__ import annotations
import json, math, argparse, os

CURVES = os.environ.get("PT_CURVES",
    "/sessions/stoic-sleepy-goodall/mnt/OOTP Perfect Team/engine/config/curves.json")

# wOBA linear weights (modern frame)
W = dict(BB=0.69, HBP=0.72, s1=0.89, d2=1.27, d3=1.62, HR=2.10)
FIP_C = 3.10


def load_curves(path=CURVES):
    with open(path) as f:
        return json.load(f)


def rate(c: dict, rating: float) -> float:
    """The core OOTP rating->outcome transform."""
    if rating is None or rating <= 0:
        rating = 50.0
    return c["env_rate"] * math.exp(c["alpha"]) * (rating / 50.0) ** c["beta"]


def clamp_note(c: dict, rating: float) -> str | None:
    lo, hi = c.get("rating_range", [0, 999])
    if rating < lo: return f"below fitted range ({lo}-{hi}) — extrapolated"
    if rating > hi: return f"above fitted range ({lo}-{hi}) — extrapolated"
    return None


def project_hitter(cur: dict, BA, GAP, POW, EYE, K) -> dict:
    h = cur["hit"]
    k_pa   = rate(h["k"],   K)      # K per PA
    bb_pa  = rate(h["bb"],  EYE)    # BB per PA
    hbp_pa = h["hbp_rate_env"]
    bip_pa = max(1e-6, 1 - k_pa - bb_pa - hbp_pa)

    hr_bip    = rate(h["hr"],    POW)
    xbh_bip   = rate(h["xbh"],   GAP)
    babip_raw = rate(h["babip"], BA)

    # per-PA event rates
    hr  = hr_bip * bip_pa
    bipx = bip_pa - hr                      # balls in play excluding HR
    hits_ip = babip_raw * bipx              # non-HR hits
    xbh = min(xbh_bip * bip_pa, hits_ip)    # 2B+3B can't exceed non-HR hits
    b3  = xbh * h["xbh_3b_share"]
    b2  = xbh - b3
    b1  = max(0.0, hits_ip - xbh)

    PA = 1.0
    AB = PA - bb_pa - hbp_pa                # (ignoring SF/SH ~ small)
    H  = b1 + b2 + b3 + hr
    avg = H / AB if AB else 0
    obp = (H + bb_pa + hbp_pa) / PA
    slg = (b1 + 2*b2 + 3*b3 + 4*hr) / AB if AB else 0
    woba = (W["BB"]*bb_pa + W["HBP"]*hbp_pa + W["s1"]*b1 +
            W["d2"]*b2 + W["d3"]*b3 + W["HR"]*hr) / PA
    return dict(BA=round(avg,3), OBP=round(obp,3), SLG=round(slg,3),
                OPS=round(obp+slg,3), ISO=round(slg-avg,3), wOBA=round(woba,3),
                **{"K%": round(k_pa,3), "BB%": round(bb_pa,3)},
                HR_rate=round(hr,3), BABIP=round(hits_ip/bipx if bipx else 0,3))


def project_pitcher(cur: dict, STU, CON, HRA, PBABIP) -> dict:
    p = cur["pit"]
    k_bf   = rate(p["k"],   STU)
    bb_bf  = rate(p["bb"],  CON)
    hbp_bf = p["hbp_rate_env"]
    bip_bf = max(1e-6, 1 - k_bf - bb_bf - hbp_bf)

    hr_bip = rate(p["hr"],    HRA)
    babip  = rate(p["babip"], PBABIP)

    hr = hr_bip * bip_bf
    bipx = bip_bf - hr
    hits_ip = babip * bipx
    H = hits_ip + hr

    # outs per BF -> IP
    outs_bf = k_bf + (bipx - hits_ip)
    ip_per_bf = outs_bf / 3.0
    per9 = lambda x: 9 * x / ip_per_bf if ip_per_bf else 0

    k9, bb9, hr9 = per9(k_bf), per9(bb_bf), per9(hr)
    fip = (13*hr + 3*(bb_bf+hbp_bf) - 2*k_bf) / ip_per_bf + FIP_C if ip_per_bf else 0
    whip = (H + bb_bf) / ip_per_bf if ip_per_bf else 0
    # wOBA against
    woba_a = (W["BB"]*bb_bf + W["HBP"]*hbp_bf + W["s1"]*(hits_ip*0.78) +
              W["d2"]*(hits_ip*0.19) + W["d3"]*(hits_ip*0.03) + W["HR"]*hr)
    return dict(FIP=round(fip,2), K9=round(k9,1), BB9=round(bb9,1),
                HR9=round(hr9,2), WHIP=round(whip,2),
                BABIP=round(babip,3), wOBA_against=round(woba_a,3),
                **{"K%": round(k_bf,3), "BB%": round(bb_bf,3)})


def explain(cur: dict, is_pit: bool):
    """Print the multiplier table: what each rating point is worth."""
    spec = cur["pit"] if is_pit else cur["hit"]
    comps = ["k","bb","hr","babip"] + ([] if is_pit else ["xbh"])
    print(f"\n{'component':8} {'rating':8} {'beta':>7} {'R2':>6} {'env':>8}   effect of +10 rating")
    print("-"*72)
    for name in comps:
        c = spec.get(name)
        if not c: continue
        base = rate(c, 100); up = rate(c, 110)
        pct = 100*(up-base)/base if base else 0
        direction = "worse for hitter" if (pct>0 and name in ("k",)) else ""
        print(f"{name:8} {c['rating']:8} {c['beta']:7.3f} {c['r2']:6.3f} {c['env_rate']:8.5f}   "
              f"{pct:+6.1f}% {direction}")
    print("\n  rate = env * exp(alpha) * (rating/50)^beta")
    print("  beta>0: higher rating -> MORE of that event.  beta<0: higher rating -> FEWER.")


def validate():
    """Reproduce projections for known cards and compare."""
    cur = load_curves()
    proj_path = "/sessions/stoic-sleepy-goodall/mnt/OOTP Perfect Team/web/public/data/projections.json"
    ratings_csv = "/sessions/stoic-sleepy-goodall/mnt/OOTP Perfect Team/data-store/ratings_full_2026-05-30.csv"
    import csv
    with open(proj_path) as f:
        P = {c["cid"]: c for c in json.load(f)["cards"]}
    rows = list(csv.DictReader(open(ratings_csv, encoding="utf-8", errors="replace")))
    def num(x):
        try: return float(x)
        except: return None
    n=0; err_ops=[]; err_fip=[]
    for r in rows:
        cid = num(r.get("CID"))
        if cid is None or int(cid) not in P: continue
        card = P[int(cid)]
        is_pit = card["pos"] in ("SP","RP","CL")
        if is_pit and card.get("pitcher_vL"):
            mine = project_pitcher(cur, num(r.get("STU vL")), num(r.get("CON vL_1")),
                                   num(r.get("HRA vL")), num(r.get("PBABIP vL")))
            theirs = card["pitcher_vL"]
            if theirs.get("FIP"): err_fip.append(mine["FIP"]-theirs["FIP"]); n+=1
        elif not is_pit and card.get("hitter_vL"):
            mine = project_hitter(cur, num(r.get("BA vL")), num(r.get("GAP vL")),
                                  num(r.get("POW vL")), num(r.get("EYE vL")), num(r.get("K vL")))
            theirs = card["hitter_vL"]
            if theirs.get("OPS"): err_ops.append(mine["OPS"]-theirs["OPS"]); n+=1
        if n>400: break
    import statistics as st
    print(f"validated on {n} cards")
    if err_ops:
        print(f"  hitter OPS  mean err {st.mean(err_ops):+.4f}  median |err| {st.median(map(abs,err_ops)):.4f}")
    if err_fip:
        print(f"  pitcher FIP mean err {st.mean(err_fip):+.3f}  median |err| {st.median(map(abs,err_fip)):.3f}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--hitter", action="store_true"); ap.add_argument("--pitcher", action="store_true")
    for r in ("BA","GAP","POW","EYE","K","STU","CON","HRA","PBABIP"):
        ap.add_argument(f"--{r}", type=float, default=100.0)
    ap.add_argument("--explain", action="store_true")
    ap.add_argument("--validate", action="store_true")
    a = ap.parse_args()
    cur = load_curves()
    if a.validate: validate(); raise SystemExit
    if a.explain: explain(cur, a.pitcher); raise SystemExit
    if a.pitcher:
        print(json.dumps(project_pitcher(cur, a.STU, a.CON, a.HRA, a.PBABIP), indent=1))
    else:
        print(json.dumps(project_hitter(cur, a.BA, a.GAP, a.POW, a.EYE, a.K), indent=1))
