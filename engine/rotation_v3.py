#!/usr/bin/env python3
"""Rotation analysis v3 — per-day normalized (fixes the partial-week artifact)."""
import csv, datetime, statistics as st
from collections import defaultdict, Counter

DUMP="/sessions/stoic-sleepy-goodall/mnt/Tourney Standings/pt27_tournaments_competitve_dump_20260720.csv"
PERIODS=[(1,"2026-03-13","2026-04-05"),(2,"2026-04-06","2026-05-03"),
         (3,"2026-05-04","2026-05-31"),(4,"2026-06-01","2026-07-05")]
TIERS=["iron","bronze","silver","gold","diamond"]
PTS={256:[(1,40),(2,30),(4,20),(8,15),(16,10),(32,6),(64,3),(128,1)],
     128:[(1,30),(2,20),(4,15),(8,10),(16,6),(32,3),(64,1)],
     64:[(1,25),(2,15),(4,10),(8,6),(16,3),(32,1)],
     32:[(1,20),(2,10),(4,6),(8,3),(16,1)]}
def points(f,p):
    for cut,v in PTS.get(f,[]):
        if p<=cut: return v
    return 0
def tier_of(t):
    t=t.lower()
    for k in TIERS:
        if k in t: return k
    return None

T=[]
with open(DUMP,encoding="utf-8",errors="replace") as f:
    f.readline(); rd=csv.reader(f); next(rd)
    for r in rd:
        if len(r)<4 or not r[2].isdigit(): continue
        fin=[x.strip() for x in r[3:] if x.strip()]
        if not fin: continue
        T.append(dict(title=r[1],date=datetime.datetime.utcfromtimestamp(int(r[2])).date(),
                      field=len(fin),fin=fin,tier=tier_of(r[1])))

print("="*74)
print("ROTATION ANALYSIS v3 — normalized per DAY (fixes partial-week bias)")
print(f"{len(T)} tournaments, {min(t['date'] for t in T)} .. {max(t['date'] for t in T)}")
print("="*74)

def halves(a,b):
    """split a period into first half / second half by date"""
    A=datetime.date.fromisoformat(a); B=datetime.date.fromisoformat(b)
    n=(B-A).days+1; mid=A+datetime.timedelta(days=n//2)
    return A,mid,B,n//2,n-n//2

print("\n[1] EARLY-LEADER ENTRY RATE — do the top players stop entering that tier?")
print("    entries PER DAY, first half vs second half of each period\n")
res=defaultdict(list)
for p,a,b in PERIODS:
    A,mid,B,d1,d2=halves(a,b)
    for tier in TIERS:
        rows=[t for t in T if t["tier"]==tier and A<=t["date"]<=B]
        if len(rows)<30: continue
        early_pts=Counter(); e=Counter(); l=Counter()
        for t in rows:
            first = t["date"]<mid
            for i,u in enumerate(t["fin"]):
                if first:
                    early_pts[u]+=points(t["field"],i+1); e[u]+=1
                else: l[u]+=1
        if not early_pts: continue
        top=[u for u,_ in sorted(early_pts.items(),key=lambda x:-x[1])[:50]]
        er=sum(e[u] for u in top)/d1/len(top)
        lr=sum(l[u] for u in top)/d2/len(top)
        chg=100*(lr-er)/er if er else 0
        still=sum(1 for u in top if l[u]>0)
        res[tier].append(chg)
        flag="ROTATE OUT" if chg<-25 else ("eases off" if chg<-10 else "keeps playing")
        print(f"  P{p} {tier:8} {still}/50 still active | {er:.2f} -> {lr:.2f} entries/day ({chg:+.0f}%)  {flag}")
print("\n  mean change by tier: " + ", ".join(f"{k} {st.mean(v):+.0f}%" for k,v in res.items()))

print("\n[2] FIELD STRENGTH — elite share of entrants, first vs second half")
score=Counter()
for t in T:
    for u in t["fin"][:8]: score[u]+=1
ELITE=set(u for u,_ in score.most_common(200))
tot=defaultdict(list)
for p,a,b in PERIODS:
    A,mid,B,_,_=halves(a,b)
    for tier in TIERS:
        rows=[t for t in T if t["tier"]==tier and A<=t["date"]<=B]
        if len(rows)<30: continue
        ee=[u for t in rows if t["date"]<mid for u in t["fin"]]
        ll=[u for t in rows if t["date"]>=mid for u in t["fin"]]
        if not ee or not ll: continue
        se=100*sum(1 for u in ee if u in ELITE)/len(ee)
        sl=100*sum(1 for u in ll if u in ELITE)/len(ll)
        tot[tier].append(sl-se)
        print(f"  P{p} {tier:8} elite share {se:4.1f}% -> {sl:4.1f}%  ({sl-se:+.1f}pp)")
print("\n  mean change by tier: " + ", ".join(f"{k} {st.mean(v):+.1f}pp" for k,v in tot.items()))

print("\n[3] PRACTICAL PAYOFF — same players, do they finish better late?")
print("    avg finish percentile (lower=better), repeat entrants only")
agg=defaultdict(list)
for p,a,b in PERIODS:
    A,mid,B,_,_=halves(a,b)
    for tier in TIERS:
        rows=[t for t in T if t["tier"]==tier and A<=t["date"]<=B]
        if len(rows)<30: continue
        E=defaultdict(list); L=defaultdict(list)
        for t in rows:
            for i,u in enumerate(t["fin"]):
                (E if t["date"]<mid else L)[u].append(100*(i+1)/t["field"])
        both=[u for u in E if u in L]
        if len(both)<40: continue
        de=st.mean([st.mean(E[u]) for u in both]); dl=st.mean([st.mean(L[u]) for u in both])
        agg[tier].append(dl-de)
        print(f"  P{p} {tier:8} n={len(both):4}  {de:.1f} -> {dl:.1f}  ({dl-de:+.1f})")
print("\n  mean change by tier: " + ", ".join(f"{k} {st.mean(v):+.1f}" for k,v in agg.items()))

print("\n[4] WHERE THE POINTS ARE — pts/entry by tier & field size (season-wide)")
val=defaultdict(lambda: defaultdict(list))
for t in T:
    if not t["tier"]: continue
    for i,u in enumerate(t["fin"]):
        val[t["tier"]][t["field"]].append(points(t["field"],i+1))
print(f"  {'tier':9} " + " ".join(f"{f:>10}" for f in (32,64,128,256)))
for tier in TIERS:
    row=f"  {tier:9} "
    for f in (32,64,128,256):
        v=val[tier].get(f)
        row += f"{(st.mean(v) if v else 0):10.2f}"
    print(row)
print("\n  (avg points earned per entry — higher = better ROI per slot)")
