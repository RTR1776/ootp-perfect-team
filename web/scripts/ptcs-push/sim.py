import json, random, statistics as st
F = json.load(open("finishes.json"))
TABLE = {256:[(1,40),(2,30),(4,20),(8,15),(16,10),(32,6),(64,3),(128,1)], 128:[(1,30),(2,20),(4,15),(8,10),(16,6),(32,3),(64,1),(128,0)],
         64:[(1,25),(2,15),(4,10),(8,6),(16,3),(32,1),(64,0)], 32:[(1,20),(2,10),(4,6),(8,3),(16,1),(32,0)]}
def pts(pct, fs):
    place = max(1, round(pct * fs))
    for cut, p in TABLE[fs]:
        if place <= cut: return p
    return 0
pool = lambda f: [x["pct"] for x in F if f(x)]
drafts_live = pool(lambda x: x["src"] == "drafts" and "Live" in x["cats"])
drafts_all = pool(lambda x: x["src"] == "drafts")
tour_all = pool(lambda x: x["src"] != "drafts")
tour_live = pool(lambda x: x["src"] != "drafts" and "Live" in x["cats"])
tour_iron = pool(lambda x: x["src"] != "drafts" and "Iron" in x["cats"])
print(f"samples: live drafts {len(drafts_live)} (median pct {st.median(drafts_live):.2f}), all drafts {len(drafts_all)}, tournaments {len(tour_all)} (median {st.median(tour_all):.2f}), live tourneys {len(tour_live)} ({st.median(tour_live):.2f}), iron tourneys {len(tour_iron)} ({st.median(tour_iron):.2f})")
# daily schedule: (name, field, categories, pool)
LIVE_DRAFTS = [("Live All Night",64,["PD","Live"],"d"),("Live Breakfast",64,["PD","Live"],"d"),("Pick up the Kids - Live",64,["PD","Live"],"d")]
LIVE_TOURS = [("Live Iron",128,["Iron","Live"],"i"),("Live Bronze",128,["Live"],"t"),("Live Silver",128,["Live"],"t"),("Live Gold",128,["Live"],"t"),("Live Diamond",64,["Live"],"t"),("Live Open",128,["Live"],"t")]
IRON_TOURS = [("Dank",64,["Iron"],"i"),("Iron Lunch",128,["Iron"],"i"),("Iron Cap",64,["Iron"],"i"),("Dreamland",64,["Iron"],"i"),("Late Iron",128,["Iron"],"i"),("Strikes Back",64,["Iron"],"i"),("Iron & Friends",32,["Iron"],"i")]
WEEKLY_LIVE = [("Tuesday Live",256,["Live"],"t"),("Fri Night Live Slots",128,["Live"],"t"),("Fri Night Live PD",128,["Live"],"d"),("Tue Live Lampooning",128,["Live"],"d")]
WEEKLY_IRON = [("Iron Warriors",256,["Iron"],"i"),("Danksville",256,["Iron"],"i")]
NEED = {"Live": (122, 136), "Iron": (96, 107), "PD": (160, 187)}
def run(days, ironpool, tourpool, sched, n=20000):
    hits = {k: [0, 0] for k in NEED}; tot = {k: [] for k in NEED}
    P = {"d": drafts_live, "t": tourpool, "i": ironpool}
    for _ in range(n):
        s = {k: 0 for k in NEED}
        events = [e for e in sched["daily"] for _ in range(days)] + sched["weekly"]
        for name, fs, cats, p in events:
            v = pts(random.choice(P[p]), fs)
            for c in cats: s[c] += v
        for k in NEED:
            tot[k].append(s[k]); hits[k][0] += s[k] >= NEED[k][0]; hits[k][1] += s[k] >= NEED[k][1]
    return {k: (st.mean(tot[k]), hits[k][0] / n, hits[k][1] / n) for k in NEED}
random.seed(7)
plans = {
  "A. Live only (3 Live drafts + 6 Live tourneys a day + Live weeklies)": {"daily": LIVE_DRAFTS + LIVE_TOURS, "weekly": WEEKLY_LIVE},
  "B. Iron only (Live Iron + 7 Iron dailies + Iron weeklies; drafts still Live)": {"daily": LIVE_DRAFTS + [LIVE_TOURS[0]] + IRON_TOURS, "weekly": WEEKLY_IRON},
  "C. Both (3 Live drafts + 6 Live + 7 Iron tourneys a day = 13 tourneys)": {"daily": LIVE_DRAFTS + LIVE_TOURS + IRON_TOURS, "weekly": WEEKLY_LIVE + WEEKLY_IRON},
}
for days in (7, 8):
    print(f"\n=== {days} days of dailies ===")
    for label, sched in plans.items():
        for ilab, ipool, tlab, tpool in (("Iron at your Iron record", tour_iron, "Live at your tourney record", tour_all), ("Iron at your overall tourney level", tour_all, "", tour_all)):
            r = run(days, ipool, tpool, sched, 8000)
            print(f"  {label[:70]:70} | {ilab:34} | " + "  ".join(f"{k} {r[k][0]:5.0f} pts, line {100*r[k][1]:3.0f}% safe {100*r[k][2]:3.0f}%" for k in ("Live", "Iron", "PD")))
