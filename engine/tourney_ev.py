#!/usr/bin/env python3
"""
Tournament EV engine — "what should I play tonight?"

Uses your ACTUAL finish history (from the season tournament dump) to compute
expected qualifying points per entry for every tournament, weighted by which
categories you still need.
"""
import csv, datetime, json, math
from collections import defaultdict, Counter

DUMP="/sessions/stoic-sleepy-goodall/mnt/Tourney Standings/pt27_tournaments_competitve_dump_20260720.csv"
ME="RTR1776"

PTS={256:[(1,40),(2,30),(4,20),(8,15),(16,10),(32,6),(64,3),(128,1)],
     128:[(1,30),(2,20),(4,15),(8,10),(16,6),(32,3),(64,1)],
     64:[(1,25),(2,15),(4,10),(8,6),(16,3),(32,1)],
     32:[(1,20),(2,10),(4,6),(8,3),(16,1)]}
def points(field,place):
    for cut,v in PTS.get(field,[]):
        if place<=cut: return v
    return 0

TIERS=["iron","bronze","silver","gold","diamond"]
def tags(title):
    """Which standings categories does this tournament feed?"""
    t=title.lower(); out=set()
    for k in TIERS:
        if k in t: out.add(k)
    if "open" in t or "wide open" in t: out.add("open")
    if "live" in t: out.add("live")
    if "cap" in t: out.add("cap")
    if "slots" in t: out.add("cap")   # slot events are capped
    return out

def load():
    T=[]
    with open(DUMP,encoding="utf-8",errors="replace") as f:
        f.readline(); rd=csv.reader(f); next(rd)
        for r in rd:
            if len(r)<4 or not r[2].isdigit(): continue
            fin=[x.strip() for x in r[3:] if x.strip()]
            if not fin: continue
            dt=datetime.datetime.utcfromtimestamp(int(r[2]))
            T.append(dict(title=r[1],dt=dt,field=len(fin),fin=fin,tags=tags(r[1])))
    return T

T=load()
print("="*78); print("TOURNAMENT EV ENGINE"); print("="*78)

# ---------- 1. your finish profile ----------
mine=[]
for t in T:
    if ME in t["fin"]:
        place=t["fin"].index(ME)+1
        mine.append(dict(title=t["title"],field=t["field"],place=place,
                         pct=place/t["field"],pts=points(t["field"],place),
                         tags=t["tags"],dt=t["dt"]))
print(f"\nYour record: {len(mine)} tournaments entered")
if mine:
    import statistics as st
    print(f"  avg finish percentile: {100*st.mean(m['pct'] for m in mine):.1f}  (50 = median)")
    print(f"  avg points/entry     : {st.mean(m['pts'] for m in mine):.2f}")
    wins=sum(1 for m in mine if m["place"]==1); top8=sum(1 for m in mine if m["place"]<=8)
    print(f"  wins {wins} | top-8 {top8} ({100*top8/len(mine):.0f}%)")

# by tier — where are you strongest?
print("\n[1] YOUR EDGE BY TIER  (lower percentile = better)")
byt=defaultdict(list)
for m in mine:
    for tag in m["tags"]:
        if tag in TIERS: byt[tag].append(m)
print(f"  {'tier':9} {'n':>4} {'avg pctile':>11} {'pts/entry':>10} {'top-8 %':>8}")
for tier in TIERS:
    v=byt.get(tier)
    if not v: continue
    import statistics as st
    p=100*st.mean(m["pct"] for m in v); pe=st.mean(m["pts"] for m in v)
    t8=100*sum(1 for m in v if m["place"]<=8)/len(v)
    print(f"  {tier:9} {len(v):4} {p:11.1f} {pe:10.2f} {t8:8.0f}")

# by field size — points convexity
print("\n[2] POINTS PER ENTRY BY FIELD SIZE  (your actual results)")
byf=defaultdict(list)
for m in mine: byf[m["field"]].append(m)
for f in sorted(byf):
    v=byf[f]; import statistics as st
    print(f"  {f:4}-team: n={len(v):4}  {st.mean(m['pts'] for m in v):5.2f} pts/entry  "
          f"avg pctile {100*st.mean(m['pct'] for m in v):.1f}")

# ---------- 2. per-tournament expected points ----------
print("\n[3] EXPECTED POINTS PER ENTRY, BY TOURNAMENT  (your history, n>=5)")
bytitle=defaultdict(list)
for m in mine: bytitle[m["title"]].append(m)
rows=[]
for title,v in bytitle.items():
    if len(v)<5: continue
    import statistics as st
    ev=st.mean(m["pts"] for m in v)
    rows.append((ev,title,len(v),v[0]["field"],sorted(v[0]["tags"])))
rows.sort(reverse=True)
print(f"  {'EV':>5} {'n':>4} {'field':>6}  {'tournament':38} feeds")
for ev,title,n,field,tg in rows[:22]:
    print(f"  {ev:5.2f} {n:4} {field:6}  {title[:38]:38} {','.join(tg)}")

# ---------- 3. the recommender ----------
def recommend(gaps: dict, top=15):
    """gaps: {category: points_still_needed}. Returns ranked entries."""
    print("\n[4] RECOMMENDED ENTRIES for your current gaps")
    print(f"    gaps: " + ", ".join(f"{k} +{v}" for k,v in gaps.items() if v>0))
    need={k for k,v in gaps.items() if v>0}
    scored=[]
    for title,v in bytitle.items():
        if len(v)<3: continue
        import statistics as st
        ev=st.mean(m["pts"] for m in v)
        tg=v[0]["tags"]
        hit=tg & need
        if not hit: continue
        # value = EV x number of needed categories it feeds, weighted by urgency
        urg=sum(min(1.0, gaps[c]/50) for c in hit)
        scored.append((ev*urg, ev, len(hit), sorted(hit), title, v[0]["field"], len(v)))
    scored.sort(reverse=True)
    print(f"\n  {'score':>6} {'EV':>5} {'field':>6} {'n':>4}  {'tournament':36} closes")
    for sc,ev,nh,hit,title,field,n in scored[:top]:
        print(f"  {sc:6.2f} {ev:5.2f} {field:6} {n:4}  {title[:36]:36} {','.join(hit)}")
    return scored

if __name__=="__main__":
    # current PTCS5 gaps (safe-target minus current)
    recommend(dict(diamond=0, gold=0, live=24, cap=27, bronze=98, iron=100))
