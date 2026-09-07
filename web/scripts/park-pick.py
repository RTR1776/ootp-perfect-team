#!/usr/bin/env python3
"""
Home-park pick from a league week's exports.

  python3 scripts/park-pick.py "../League Data/2026-09-06" ld404 [--team "Kansas City Torrent"] [--top 12]

Model: a home park multiplies BOTH teams' components, so it only helps where
you already out-produce your opponents in that component. Per component c
(1B/2B/3B/HR, by BATTER hand for AVG and HR) the season run edge is
    edge_c = own_c - allowed_c          (counts, from the all/vL/vR exports)
and a park scores
    sum_c (factor_c - 1) * runvalue_c * edge_c
with the AVG factor applied to all non-HR hits, the 2B/3B factors to the
single->double / single->triple upgrade, and HR to homers. Own hitters' hand
comes from the B column (switch hitters bat L vs RHP: assume 70/30); allowed
hits by batter hand come from the pitchers' vL/vR files. Factors from
reference/ballparks.csv (Avg LHB, Avg RHB, HR LHB, HR RHB, 2B, 3B).
"""
import csv, sys, os, argparse
from collections import defaultdict

RV = {"1B": 0.47, "2B": 0.77, "3B": 1.04, "HR": 1.40}   # linear weights vs an out, runs
SWITCH_L = 0.70                                         # share of PA a switch hitter bats left (vs RHP)

ap = argparse.ArgumentParser(); ap.add_argument("folder"); ap.add_argument("league"); ap.add_argument("--team", default="Kansas City Torrent"); ap.add_argument("--top", type=int, default=12); ap.add_argument("--parks", default=None)
ap.add_argument("--stress", default=None, help="comma-separated leagues in the same folder (e.g. hd450,hd452,hd453): rescale ALLOWED to their offence level, keep OWN as is - what the edge looks like against stronger hitting")
a = ap.parse_args()
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
parks_csv = a.parks or os.path.join(os.path.dirname(root), "reference", "ballparks.csv")

def load(split, league=None):
    p = os.path.join(a.folder, f"{league or a.league}_{split}.csv")
    with open(p, encoding="utf-8-sig", errors="replace") as f:
        r = csv.reader(f); h = next(r)
        return [dict(zip(h, row)) for row in r if len(row) >= len(h)]
def n(x):
    try: return float(x)
    except (TypeError, ValueError): return 0.0

ALL, VL, VR = load("all"), load("vL"), load("vR")
teams = sorted({x["ORG"] for x in ALL if x["ORG"] != "-"})
if a.team not in teams: sys.exit(f"{a.team} not in {a.league}: {teams[:5]}…")

def offense(rows, org):
    """own hits by batter hand, from the all-split hitter rows."""
    out = defaultdict(float)
    for x in rows:
        if x["ORG"] != org or n(x["PA"]) <= 0 or x["POS"] in ("SP", "RP", "CL"): continue
        b = x["B"]; wl = 1.0 if b == "L" else 0.0 if b == "R" else SWITCH_L
        for c, col in (("1B", "1B_1"), ("2B", "2B_1"), ("3B", "3B_1"), ("HR", "HR")):
            v = n(x[col]); out[(c, "L")] += v * wl; out[(c, "R")] += v * (1 - wl)
        out[("PA", "L")] += n(x["PA"]) * wl; out[("PA", "R")] += n(x["PA"]) * (1 - wl)
    return out

def allowed(vl, vr, org):
    """hits allowed by BATTER hand: pitchers' vL file = vs LHB, vR = vs RHB."""
    out = defaultdict(float)
    for hand, rows in (("L", vl), ("R", vr)):
        for x in rows:
            if x["ORG"] != org or n(x["BF"]) <= 0: continue
            for c, col in (("1B", "1B_2"), ("2B", "2B_2"), ("3B", "3B_2"), ("HR", "HR_1")):
                out[(c, hand)] += n(x[col])
            out[("BF", hand)] += n(x["BF"])
    return out

own, alw = offense(ALL, a.team), allowed(VL, VR, a.team)
# league averages per team for context
lg_own, lg_alw = defaultdict(float), defaultdict(float)
for t in teams:
    for k, v in offense(ALL, t).items(): lg_own[k] += v / len(teams)
    for k, v in allowed(VL, VR, t).items(): lg_alw[k] += v / len(teams)

KEYS = {(c, h) for c in ("1B", "2B", "3B", "HR") for h in "LR"}
if a.stress:
    st_alw = defaultdict(float); nteams = 0
    for lg in a.stress.split(","):
        A2, L2, R2 = load("all", lg), load("vL", lg), load("vR", lg)
        for t in sorted({x["ORG"] for x in A2 if x["ORG"] != "-"}):
            nteams += 1
            for k, v in allowed(L2, R2, t).items(): st_alw[k] += v
    ratio = {k: (st_alw[k] / nteams) / lg_alw[k] if lg_alw[k] else 1 for k in KEYS}
    print("stress: allowed x " + " ".join(f"{c}{h} {ratio[(c,h)]:.2f}" for (c, h) in sorted(KEYS)) + f"  ({a.stress}, {nteams} teams)")
    alw = defaultdict(float, {k: (alw[k] * ratio[k] if k in ratio else alw[k]) for k in alw})
edge = {k: own.get(k, 0) - alw.get(k, 0) for k in KEYS}
print(f"{a.team} — {a.league} — {os.path.basename(a.folder)}")
print(f"{'component':10s} {'own':>7s} {'allowed':>8s} {'edge':>7s}   {'lg own':>7s} {'lg alw':>7s}")
for c in ("1B", "2B", "3B", "HR"):
    for h in "LR":
        print(f"{c} vs {h}HB   {own[(c,h)]:7.0f} {alw[(c,h)]:8.0f} {edge[(c,h)]:+7.0f}   {lg_own[(c,h)]:7.0f} {lg_alw[(c,h)]:7.0f}")
print(f"PA by own hand: L {own[('PA','L')]:.0f} / R {own[('PA','R')]:.0f}   BF by opp hand: L {alw[('BF','L')]:.0f} / R {alw[('BF','R')]:.0f}")
bats = sorted([x for x in ALL if x["ORG"] == a.team and n(x["PA"]) >= 100 and x["POS"] not in ("SP","RP","CL")], key=lambda x: -n(x["PA"]))
print("lineup hands: " + ", ".join(f"{x['Name']} {x['B']} {int(n(x['PA']))}" for x in bats))
arms = sorted([x for x in ALL if x["ORG"] == a.team and n(x["BF"]) >= 100], key=lambda x: -n(x["BF"]))
print("staff throws: " + ", ".join(f"{x['Name']} {x['T']} {int(n(x['BF']))}" for x in arms))
runs_edge = {c: sum(RV[c] * edge[(c, h)] for h in "LR") for c in ("1B", "2B", "3B", "HR")}
print("season run edge by component (own − allowed, in runs): " + "  ".join(f"{c} {v:+.0f}" for c, v in runs_edge.items()))

# ---- parks
with open(parks_csv, encoding="utf-8-sig") as f:
    rd = csv.reader(f); hdr = next(rd)
    parks = [dict(zip(hdr, row)) for row in rd if row]
def score(p):
    avgL, avgR, hrL, hrR, d2, d3 = (n(p["Avg LHB"]), n(p["Avg RHB"]), n(p["HR LHB"]), n(p["HR RHB"]), n(p["2B"]), n(p["3B"]))
    s = 0.0; parts = {}
    for h, avg, hr in (("L", avgL, hrL), ("R", avgR, hrR)):
        non_hr = RV["1B"] * edge[("1B", h)] + RV["2B"] * edge[("2B", h)] + RV["3B"] * edge[("3B", h)]
        parts[f"avg{h}"] = (avg - 1) * non_hr
        parts[f"hr{h}"] = (hr - 1) * RV["HR"] * edge[("HR", h)]
    parts["2B"] = (d2 - 1) * (RV["2B"] - RV["1B"]) * (edge[("2B", "L")] + edge[("2B", "R")])
    parts["3B"] = (d3 - 1) * (RV["3B"] - RV["1B"]) * (edge[("3B", "L")] + edge[("3B", "R")])
    # counts are the whole season; the park only applies to the 81 home games
    parts = {k: v * 0.5 for k, v in parts.items()}
    s = sum(parts.values())
    return s, parts
scored = []
for p in parks:
    if not p.get("Ballpark"): continue
    s, parts = score(p); scored.append((s, p, parts))
scored.sort(key=lambda t: -t[0])
print(f"\nTop {a.top} parks by expected run edge over the 81 home games (+ = helps you more than opponents; ~10 runs = 1 win):")
print(f"{'park':40s} {'yr':>4s} {'AvgL':>5s} {'AvgR':>5s} {'HRL':>5s} {'HRR':>5s} {'2B':>5s} {'3B':>5s} {'runs':>6s}  drivers")
for s, p, parts in scored[: a.top]:
    drv = ", ".join(f"{k} {v:+.1f}" for k, v in sorted(parts.items(), key=lambda kv: -abs(kv[1]))[:3])
    print(f"{p['Ballpark'][:40]:40s} {p['Year']:>4s} {n(p['Avg LHB']):5.3f} {n(p['Avg RHB']):5.3f} {n(p['HR LHB']):5.3f} {n(p['HR RHB']):5.3f} {n(p['2B']):5.3f} {n(p['3B']):5.3f} {s:+6.1f}  {drv}")
print(f"\nBottom 5:")
for s, p, parts in scored[-5:]:
    print(f"{p['Ballpark'][:40]:40s} {p['Year']:>4s} {s:+6.1f}")
neutral = next((t for t in scored if t[1]["Ballpark"].startswith("Heinsohn")), None)
if neutral: print(f"\nHeinsohn (neutral) = {neutral[0]:+.1f}; rank {[t[1]['Ballpark'] for t in scored].index('Heinsohn Ballpark')+1} of {len(scored)}")
