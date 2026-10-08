"""Per-team cap allocation vs results, from the raw cap-event exports.

Usage: python3 -I teams.py <export dir> <out.json>
One record per team per file: value by role, spread, run differential per game, win %.
"""
import csv, glob, json, os, re, statistics, sys, collections

src, out = sys.argv[1], sys.argv[2]

# Run environment per file: the series' current RE, or the format before it for older runs.
RE = {
    "earlyyearscap": 1888, "nightmarecap": 1971, "c4q1": 1979, "goldfloorcapweekly": 1994,
    "silveronlycapdaily": 1998, "goldcapdaily": 1999, "highsilverlowgoldcap": 2007,
    "bronzecapweekly": 2016, "bronzeonlycapdaily": 2019, "c4q4": 2023,
    "highironfloorgoldceilingweekly": 2010,
}
OLD_RE = {"goldfloorcapweekly": (28, 2010)}  # runs before 28 were the 80-103 format at 2010 RE

def num(x):
    try: return float(x)
    except (TypeError, ValueError): return 0.0

teams_out = []
for path in sorted(glob.glob(os.path.join(src, "*.csv"))):
    m = re.match(r"(.+)_(\d+)\.csv$", os.path.basename(path))
    series, run = m.group(1), int(m.group(2))
    re_year = RE.get(series)
    if series in OLD_RE and run < OLD_RE[series][0]: re_year = OLD_RE[series][1]
    rows = list(csv.DictReader(open(path, newline="", encoding="utf-8-sig")))
    by = collections.defaultdict(list)
    for r in rows:
        if r.get("VAL", "").isdigit(): by[r["ORG"]].append(r)
    vals = [int(r["VAL"]) for t in by.values() for r in t]
    lo, hi = min(vals), max(vals)
    cap = max(sum(int(r["VAL"]) for r in t) for t in by.values())
    span = max(hi - lo, 1)
    for org, t in by.items():
        hit = [r for r in t if r["POS"] not in ("SP", "RP", "CL", "P")]
        pit = [r for r in t if r["POS"] in ("SP", "RP", "CL", "P")]
        maxpa = max([num(r["PA"]) for r in hit] or [1])
        lineup = [r for r in hit if num(r["PA"]) >= 0.4 * maxpa]
        bench = [r for r in hit if num(r["PA"]) < 0.4 * maxpa]
        sp = [r for r in pit if num(r["GS_1"]) > 0 and num(r["GS_1"]) / max(num(r["G_1"]), 1) >= 0.5]
        rp = [r for r in pit if r not in sp]
        games = sum(num(r["GS_1"]) for r in pit)
        if games < 4: continue
        rs = sum(num(r["R"]) for r in t); ra = sum(num(r["R_1"]) for r in t)
        w = sum(num(r["W"]) for r in pit); l = sum(num(r["L"]) for r in pit)
        v = lambda rs_: sum(int(r["VAL"]) for r in rs_)
        tot = v(t)
        allv = [int(r["VAL"]) for r in t]
        top = sum(1 for x in allv if x >= hi - 0.2 * span); bot = sum(1 for x in allv if x <= lo + 0.2 * span)
        spv = sorted((int(r["VAL"]) for r in sp), reverse=True)
        teams_out.append({
            "series": series, "run": run, "re": re_year, "cap": cap, "lo": lo, "hi": hi,
            "org": org, "games": games, "rdg": (rs - ra) / games, "wp": w / max(w + l, 1), "w": w,
            "tot": tot, "n": len(t),
            "lineup": v(lineup) / tot, "bench": v(bench) / tot, "sp": v(sp) / tot, "rp": v(rp) / tot,
            "nl": len(lineup), "nb": len(bench), "nsp": len(sp), "nrp": len(rp),
            "avg_lineup": v(lineup) / max(len(lineup), 1), "avg_sp": v(sp) / max(len(sp), 1), "avg_rp": v(rp) / max(len(rp), 1),
            "ace": spv[0] if spv else 0, "top2sp": sum(spv[:2]) / max(len(spv[:2]), 1),
            "sd": statistics.pstdev(allv), "barbell": (top + bot) / len(allv), "stars": top / len(allv), "basement": bot / len(allv),
        })
json.dump(teams_out, open(out, "w"))
print(len(teams_out), "teams from", len(set((x["series"], x["run"]) for x in teams_out)), "files")
