#!/usr/bin/env python3
"""OOTP PT meta engine v2: meta + variant flags + reliability floors +
roster cross-reference + shop pricing + sell list + upgrade targets."""
import csv, json, re, os, unicodedata
from collections import defaultdict

DATA = "/sessions/stoic-sleepy-goodall/mnt/OOTP Perfect Team/Perfect League and HD data"
OUTDIR = "/sessions/stoic-sleepy-goodall/mnt/outputs"

LEAGUES = {
    "PeL-S1": ("PeL","Perfect League S1","PeL Overall.csv","PeL vs L.csv","PeL vs R.csv",36),
    "PeL-S2": ("PeL","Perfect League S2","pel_all.csv","pel_vL.csv","pel_vR.csv",36),
    "HD450":  ("HD","High Diamond 450","2040 HD450 ALL.csv","2040 HD450 vL.csv","2040 HD450 vR.csv",30),
    "HD451":  ("HD","High Diamond 451","hd451_all.csv","hd451_vL.csv","hd451_vR.csv",30),
    "HD451b": ("HD","High Diamond 451-B","hd451_statistics_player_statistics_all.csv","hd451_statistics_player_statistics_vL.csv","hd451_statistics_player_statistics_vR.csv",30),
    "HD452":  ("HD","High Diamond 452","hd452_6-28_statistics_player_statistics_-_sortable_stats_export.csv","hd452_6-28_vl_statistics_player_statistics_-_sortable_stats_export.csv","hd452_6-28_vr_statistics_player_statistics_-_sortable_stats_export.csv",30),
}
PITCHER_POS = {"SP","RP","CL","P"}
# reliability floors (pooled across all team-usages) — see notes in report
H_MIN_PA = 500
P_MIN_IP = 400

def num(x):
    if x is None: return 0.0
    x=str(x).strip()
    if x in ("","-"): return 0.0
    try: return float(x)
    except: return 0.0

def norm(s):
    s=unicodedata.normalize('NFKD',s or '').encode('ascii','ignore').decode().lower()
    return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9 ]','',s)).strip()

POS_TOK = r'(?:P|SP|RP|CL|C|1B|2B|3B|SS|LF|CF|RF|DH|OF|IF|UTIL)'
def parse_title(title):
    parts=[p for p in re.split(r'\s{2,}',title.strip()) if p]
    # find posname element (starts with a position token)
    pi=None
    for i,p in enumerate(parts):
        if re.match(r'^'+POS_TOK+r'\s',p): pi=i; break
    if pi is None:
        return "", "", title, "", ""
    cardset="  ".join(parts[:pi])
    posname=parts[pi]
    rest=parts[pi+1:]
    year=team=""
    if rest:
        last=rest[-1]
        if re.match(r'^(18|19|20)\d\d$',last) or last.lower()=="peak":
            year=last; team=rest[0] if len(rest)>=2 else (rest[0] if rest else "")
            if len(rest)>=2: team=rest[-2]
        else:
            team=rest[-1]; year="2026"  # MLB 2026 Live style
    m=re.match(r'^('+POS_TOK+r')\s+(.*)$',posname)
    pos,player=(m.group(1),m.group(2)) if m else ("",posname)
    return cardset.strip(),pos,player.strip(),team,year

def load(f): return list(csv.DictReader(open(os.path.join(DATA,f))))
def is_pitcher(r): return r["POS"] in PITCHER_POS
def org_ok(o): return o and o.strip() not in ("","-")

def bh(): return dict(PA=0,AB=0,H=0,d2=0,d3=0,HR=0,BB=0,HBP=0,SF=0,K=0,SB=0,CS=0,wRAA=0.0,WAR=0.0,RBI=0,R=0)
def bp(): return dict(IP=0.0,BF=0,H=0,HR=0,BB=0,K=0,ER=0,R=0,WAR=0.0,W=0,L=0,SV=0)

league_usage=defaultdict(lambda:defaultdict(set))
pooled_hit=defaultdict(bh); pooled_pit=defaultdict(bp)
split_hit={"vL":defaultdict(bh),"vR":defaultdict(bh)}
split_pit={"vL":defaultdict(bp),"vR":defaultdict(bp)}
card_info={}

def ah(d,r):
    for a,b in (("PA","PA"),("AB","AB"),("H","H"),("d2","2B_1"),("d3","3B_1"),("HR","HR"),("BB","BB"),("HBP","HP"),("SF","SF"),("K","K"),("SB","SB"),("CS","CS"),("RBI","RBI"),("R","R")):
        d[a]+=num(r[b])
    d["wRAA"]+=num(r["wRAA"]); d["WAR"]+=num(r["WAR"])
def ap(d,r):
    d["IP"]+=num(r["IP"]); d["BF"]+=num(r["BF"])
    d["H"]+=num(r["1B_2"])+num(r["2B_2"])+num(r["3B_2"])+num(r["HR_1"])
    d["HR"]+=num(r["HR_1"]); d["BB"]+=num(r["BB_1"]); d["K"]+=num(r["K_1"])
    d["ER"]+=num(r["ER"]); d["R"]+=num(r["R_1"]); d["WAR"]+=num(r["WAR_1"])
    d["W"]+=num(r["W"]); d["L"]+=num(r["L"]); d["SV"]+=num(r["SD"])

for lk,(lvl,lab,af,lf,rf,nt) in LEAGUES.items():
    for r in load(af):
        t=r["Title"].strip()
        if not t: continue
        if t not in card_info:
            cs,pos,player,team,year=parse_title(t)
            ci=dict(title=t,card_set=cs,pos=pos or r["POS"],player=player,real_team=team,year=year,
                    game_pos=r["POS"],VAL=int(num(r["VAL"])),tier=r["Tier"],bats=r["B"],throws=r["T"],
                    pitcher=is_pitcher(r),variant=(r.get("VAR","")=="Y" or num(r.get("VLvl",0))>=5))
            if is_pitcher(r):
                ci.update(STU=int(num(r["STU"])),CON=int(num(r["CON"])),PBABIP=int(num(r["PBABIP"])),
                          HRA=int(num(r["HRA"])),STM=int(num(r["STM"])),VELO=r["VELO"])
            else:
                ci.update(rCON=int(num(r["BABIP"])),GAP=int(num(r["GAP"])),POW=int(num(r["POW"])),
                          EYE=int(num(r["EYE"])),SPE=int(num(r["SPE"])),
                          POWvL=int(num(r["POW vL"])),POWvR=int(num(r["POW vR"])))
            card_info[t]=ci
        else:
            if r.get("VAR","")=="Y" or num(r.get("VLvl",0))>=5: card_info[t]["variant"]=True
        if org_ok(r["ORG"]): league_usage[t][lk].add(r["ORG"].strip())
        (ap if is_pitcher(r) else ah)((pooled_pit if is_pitcher(r) else pooled_hit)[t], r)
    for sp,fn in (("vL",lf),("vR",rf)):
        for r in load(fn):
            t=r["Title"].strip()
            if not t: continue
            (ap if is_pitcher(r) else ah)((split_pit if is_pitcher(r) else split_hit)[sp][t], r)

LW=dict(BB=0.69,HBP=0.72,s1=0.89,d2=1.27,d3=1.62,HR=2.10); FIP_C=3.10
def hr(d):
    PA,AB,H,d2,d3,HR,BB,HBP,SF,K=(d[k] for k in("PA","AB","H","d2","d3","HR","BB","HBP","SF","K"))
    s1=H-d2-d3-HR; den=AB+BB+HBP+SF
    avg=H/AB if AB else 0; obp=(H+BB+HBP)/den if den else 0
    slg=(s1+2*d2+3*d3+4*HR)/AB if AB else 0
    woba=((LW["BB"]*BB+LW["HBP"]*HBP+LW["s1"]*s1+LW["d2"]*d2+LW["d3"]*d3+LW["HR"]*HR)/den) if den else 0
    return dict(PA=int(PA),AVG=round(avg,3),OBP=round(obp,3),SLG=round(slg,3),OPS=round(obp+slg,3),
                ISO=round(slg-avg,3),wOBA=round(woba,3),HR=int(HR),
                BBpct=round(100*BB/PA,1) if PA else 0,Kpct=round(100*K/PA,1) if PA else 0,
                SB=int(d["SB"]),WAR=round(d["WAR"],1),WAR600=round(d["WAR"]/PA*600,1) if PA else 0,
                RBI=int(d["RBI"]),R=int(d["R"]))
def pr(d):
    IP=d["IP"]
    return dict(IP=round(IP,1),ERA=round(9*d["ER"]/IP,2) if IP else 0,
                FIP=round((13*d["HR"]+3*d["BB"]-2*d["K"])/IP+FIP_C,2) if IP else 0,
                K9=round(9*d["K"]/IP,1) if IP else 0,BB9=round(9*d["BB"]/IP,1) if IP else 0,
                HR9=round(9*d["HR"]/IP,2) if IP else 0,WHIP=round((d["BB"]+d["H"])/IP,2) if IP else 0,
                WAR=round(d["WAR"],1),WAR180=round(d["WAR"]/IP*180,1) if IP else 0,
                W=int(d["W"]),L=int(d["L"]),SV=int(d["SV"]),K=int(d["K"]))

records=[]
for t,ci in card_info.items():
    pel=[];hd=[];per={}
    for lk,(lvl,lab,af,lf,rf,nt) in LEAGUES.items():
        u=len(league_usage[t].get(lk,())); pct=u/nt
        per[lk]=dict(teams=u,pct=round(100*pct,1))
        (pel if lvl=="PeL" else hd).append(pct)
    pelp=sum(pel)/len(pel) if pel else 0; hdp=sum(hd)/len(hd) if hd else 0
    rec=dict(**ci,per_league=per,pel_pct=round(100*pelp,1),hd_pct=round(100*hdp,1),
             meta_score=round(100*(0.65*pelp+0.35*hdp),1),
             teams_total=sum(per[k]["teams"] for k in per))
    if ci["pitcher"]:
        rec["prod"]=pr(pooled_pit[t]); rec["reliable"]=pooled_pit[t]["IP"]>=P_MIN_IP
        rec["vL"]=pr(split_pit["vL"][t]) if split_pit["vL"][t]["IP"]>50 else None
        rec["vR"]=pr(split_pit["vR"][t]) if split_pit["vR"][t]["IP"]>50 else None
    else:
        rec["prod"]=hr(pooled_hit[t]); rec["reliable"]=pooled_hit[t]["PA"]>=H_MIN_PA
        rec["vL"]=hr(split_hit["vL"][t]) if split_hit["vL"][t]["PA"]>70 else None
        rec["vR"]=hr(split_hit["vR"][t]) if split_hit["vR"][t]["PA"]>70 else None
    records.append(rec)

def pctile(vals):
    order=sorted(range(len(vals)),key=lambda i:vals[i]); rk=[0]*len(vals)
    for r,i in enumerate(order): rk[i]=100*r/(len(vals)-1) if len(vals)>1 else 50
    return rk
for pool,pk in ((["h"],"WAR600"),(["p"],"WAR180")):
    grp=[r for r in records if (r["pitcher"]==(pk=="WAR180")) and r["reliable"]]
    if not grp: continue
    ur=pctile([r["meta_score"] for r in grp]); prk=pctile([r["prod"][pk] for r in grp])
    for i,r in enumerate(grp):
        r["usage_pctile"]=round(ur[i],1); r["prod_pctile"]=round(prk[i],1); r["gap"]=round(prk[i]-ur[i],1)

records.sort(key=lambda r:-r["meta_score"])

# ---- index meta by (name,year) and (name) for matching ----
meta_by_ny=defaultdict(list); meta_by_n=defaultdict(list)
for r in records:
    meta_by_ny[(norm(r["player"]),str(r["year"]))].append(r)
    meta_by_n[norm(r["player"])].append(r)

def find_meta(name,year,pos=None):
    n=norm(name); y=str(year)
    cands=meta_by_ny.get((n,y)) or meta_by_n.get(n) or []
    if pos and len(cands)>1:
        pc=[c for c in cands if c["game_pos"]==pos]
        if pc: cands=pc
    return cands[0] if cands else None

# ---- shop ----
shop=list(csv.DictReader(open(os.path.join(OUTDIR,"shop.csv"))))
shop_by_ny=defaultdict(list); shop_by_n=defaultdict(list)
def price(r):
    for k in ("Last 10 Price","Sell Order Low","Buy Order High","Last 10 Price(VAR)"):
        v=num(r.get(k,0))
        if v>0: return int(v)
    return 0
for r in shop:
    k=(norm(r["FirstName"]+" "+r["LastName"]),r["Year"])
    shop_by_ny[k].append(r); shop_by_n[norm(r["FirstName"]+" "+r["LastName"])].append(r)
def find_shop(name,year,pos=None):
    n=norm(name);y=str(year)
    cands=shop_by_ny.get((n,y)) or shop_by_n.get(n) or []
    if not cands: return None
    # when multiple rows (different sets), pick the highest-value card (meta-relevant)
    return max(cands,key=lambda r:num(r.get("Card Value",0)))
def acquire(sh,is_variant):
    """Return (price, available, acq_type). Variant meta cards must be bought as the
    lvl-5 variant (Last 10 Price(VAR)); base price doesn't get you the meta card."""
    if not sh: return 0,False,"?"
    base_l10=num(sh.get("Last 10 Price")); base_ask=num(sh.get("Sell Order Low"))
    var_l10=num(sh.get("Last 10 Price(VAR)"))
    base_avail = base_ask>0 or sh.get("packs")=="1"
    if is_variant:
        # variant version required; if no VAR market, not directly available
        if var_l10>0: return int(var_l10),True,"variant"
        return int(base_l10),False,"variant (no market)"
    pc = base_l10 or base_ask
    return int(pc),bool(base_avail or pc>0),"base"

# ---- roster ----
def pmoney(x):
    x=re.sub(r'[^0-9]','',str(x)); return int(x) if x else 0
def tier_of(ovr):
    return "Perfect" if ovr>=100 else "Diamond" if ovr>=90 else "Gold" if ovr>=80 else "Silver"
roster=[]
for r in csv.DictReader(open(os.path.join(OUTDIR,"roster.csv"))):
    if not r.get("Name"): continue
    ovr=int(num(r["OVR"]))
    locked = (r.get("QS","").strip().lower()=="locked") or (r.get("Sell","").strip()=="")
    m=find_meta(r["Name"],r["CYear"],r["POS"])
    # roster cols: L10 = fair market value; BUY = Buy Order High (instant SELL proceeds);
    # SELL = Sell Order Low (instant BUY cost). So sale value = L10 (list) or BUY (instant).
    l10=pmoney(r["L10"]); buyorder=pmoney(r["BUY"]); sellorder=pmoney(r["SELL"])
    rc=dict(pos=r["POS"],name=r["Name"],ovr=ovr,tier=tier_of(ovr),ctype=r["CType"],year=r["CYear"],
            team=r["CTM"],status=r["St"],locked=locked,
            sell=l10, sell_now=buyorder, l10=l10,
            meta_score=m["meta_score"] if m else 0.0,
            pel_pct=m["pel_pct"] if m else 0.0, variant=m["variant"] if m else None,
            in_meta=bool(m), meta_title=m["title"] if m else None)
    if m: m["owned"]=True; m["roster_status"]=r["St"]; m["roster_locked"]=locked; m["roster_ovr"]=ovr
    roster.append(rc)

owned_titles=set(r["meta_title"] for r in roster if r["meta_title"])
for r in records: r.setdefault("owned",False)

# ---- attach PRODUCTION to records + roster (production-first lens) ----
for r in records:
    if r["pitcher"]:
        r["prod_rate"]=r["prod"]["WAR180"] if r.get("reliable") else None
        r["best_side"]=None
    else:
        r["prod_rate"]=r["prod"]["WAR600"] if r.get("reliable") else None
        sides=[s for s in [r["vL"]["OPS"] if r.get("vL") else None, r["vR"]["OPS"] if r.get("vR") else None] if s]
        r["best_side"]=round(max(sides),3) if sides else None
rec_by_title={r["title"]:r for r in records}
for rc in roster:
    rec=rec_by_title.get(rc.get("meta_title")) if rc.get("meta_title") else None
    rc["prod_rate"]=rec["prod_rate"] if rec else None
    rc["vL_ops"]=(rec["vL"]["OPS"] if rec and rec.get("vL") and not rec["pitcher"] else None)
    rc["vR_ops"]=(rec["vR"]["OPS"] if rec and rec.get("vR") and not rec["pitcher"] else None)
    rc["reliable"]=rec.get("reliable") if rec else False
    rc["pitcher"]=rec["pitcher"] if rec else (rc["pos"] in PITCHER_POS)

# ---- sell list: PRODUCTION-GUARDED. Perfect+unlocked, but never sell a top-3
# producer at a position, never sell a card's best platoon side, keep depth>=3 ----
own_by_pos=defaultdict(list)
for rc in roster:
    if rc["in_meta"]: own_by_pos[rc["pos"]].append(rc)
protected=set()
for p,arr in own_by_pos.items():
    # protect only GENUINELY useful cards: real top producers...
    good=[rc for rc in arr if rc["prod_rate"] is not None and rc["prod_rate"]>=0.8]
    for rc in sorted(good,key=lambda r:-r["prod_rate"])[:3]: protected.add(id(rc))
    # ...and the best bat on each platoon side IF that side is actually productive
    for side in ("vL_ops","vR_ops"):
        cand=[rc for rc in arr if rc.get(side) and rc[side]>=0.72]
        if cand: protected.add(id(max(cand,key=lambda r:r[side])))
def pos_depth(p): return sum(1 for rc in roster if rc["pos"]==p)
sell_list=[]
for rc in roster:
    if rc["tier"]!="Perfect" or rc["locked"]: continue
    if id(rc) in protected: continue
    pr=rc.get("prod_rate"); bs=max([x for x in [rc.get("vL_ops"),rc.get("vR_ops")] if x] or [0])
    if pr is not None and pr>=1.0: continue       # solid everyday producer -> keep
    if bs>=0.74: continue                          # useful platoon side -> keep
    if rc["meta_score"]>=10: continue              # still rostered enough -> keep
    if pos_depth(rc["pos"])<=3: continue           # don't thin a position below 3
    rc["sell_reason"]=("poor prod (%.1f WAR rate)"%pr) if pr is not None else "no meta use, weak/no sample"
    sell_list.append(rc)
sell_list.sort(key=lambda r:-r["sell"])

# ---- upgrade targets: meta cards not owned; ranked by PRODUCTION (reliable) ----
def meta_band(ms):
    return "Core" if ms>=50 else "Strong" if ms>=25 else "Role" if ms>=10 else "Fringe"
targets=[]
for r in records:
    if r.get("owned"): continue
    if r["meta_score"]<10 and (r.get("gap") is None or r["gap"]<40): continue  # meta OR underrated gem
    sh=find_shop(r["player"],r["year"],r["game_pos"])
    pc,avail,acqt=acquire(sh,r["variant"])
    targets.append(dict(pos=r["game_pos"],player=r["player"],year=r["year"],set=r["card_set"],
                        variant=r["variant"],meta_score=r["meta_score"],pel_pct=r["pel_pct"],hd_pct=r["hd_pct"],
                        band=meta_band(r["meta_score"]),price=pc,available=avail,acq_type=acqt,
                        prod=r["prod"],pitcher=r["pitcher"],reliable=r.get("reliable",False),
                        prod_rate=r.get("prod_rate"),best_side=r.get("best_side"),
                        vL=(r["vL"]["OPS"] if r.get("vL") and not r["pitcher"] else None),
                        vR=(r["vR"]["OPS"] if r.get("vR") and not r["pitcher"] else None),
                        gap=r.get("gap")))
# primary sort = production rate (reliable first), meta as tiebreak
targets.sort(key=lambda t:(-(t["prod_rate"] if t["prod_rate"] is not None else -9),-t["meta_score"]))
BUDGET=200000
buyable=[t for t in targets if t["available"] and 0<t["price"]<=BUDGET and t["reliable"]]
buyable.sort(key=lambda t:-(t["prod_rate"] if t["prod_rate"] is not None else -9))

# ---- positional summary: owned vs best available ----
POSORD=["C","1B","2B","3B","SS","LF","CF","RF","DH","SP","RP","CL"]
pos_summary={}
for p in POSORD:
    owned_here=[r for r in roster if r["pos"]==p]
    owned_meta=[r for r in owned_here if r["meta_score"]>=10]
    best_owned=max((r["meta_score"] for r in owned_here),default=0)
    avail=[t for t in targets if t["pos"]==p][:4]
    pos_summary[p]=dict(owned=len(owned_here),owned_meta=len(owned_meta),
                        best_owned=best_owned,top_targets=avail)

out=dict(generated="2026-06-28",
    leagues={k:dict(label=v[1],level=v[0],teams=v[5]) for k,v in LEAGUES.items()},
    floors=dict(hitter_PA=H_MIN_PA,pitcher_IP=P_MIN_IP),
    budget=dict(now=127000,morning=200000),
    n_cards=len(records),records=records,roster=roster,
    sell_list=sell_list,targets=targets,buyable=buyable,pos_summary=pos_summary,
    owned_count=sum(1 for r in records if r.get("owned")))
json.dump(out,open(os.path.join(OUTDIR,"meta2.json"),"w"))

# ---- console report ----
print("META cards %d | owned in-meta %d | roster %d"%(len(records),out["owned_count"],len(roster)))
nv=sum(1 for r in records if r["variant"])
print("variant (lvl5) meta cards: %d"%nv)
print("\nSELL CANDIDATES (production-guarded: Perfect+unlocked, NOT a top-3 producer or best platoon side, pos depth>3):")
for r in sell_list[:18]:
    print("  L10 %7d (instant %7d)  %-3s %-20s %s %-8s | %s"%(r["sell"],r["sell_now"],r["pos"],r["name"],r["year"],r["ctype"],r.get("sell_reason","")))
print("  ... %d candidates, total L10 ~%d PP (instant ~%d PP)"%(len(sell_list),sum(r["sell"] for r in sell_list),sum(r["sell_now"] for r in sell_list)))
print("\n>>> REALISTIC BUYS — ranked by ACTUAL PRODUCTION (available, reliable, <=200K):")
for t in buyable[:15]:
    pl=("FIP %.2f W/180 %.1f"%(t["prod"]["FIP"],t["prod"]["WAR180"])) if t["pitcher"] else ("OPS %.3f W/600 %.1f vL%s vR%s"%(t["prod"]["OPS"],t["prod"]["WAR600"],("%.3f"%t["vL"]) if t["vL"] else "na",("%.3f"%t["vR"]) if t["vR"] else "na"))
    print("  %-3s %-18s %-5s ~%8d PP %-7s | %s | meta %.0f"%(t["pos"],t["player"],t["year"],t["price"],t["acq_type"],pl,t["meta_score"]))
print("\nALL meta targets (meta>=20) w/ CORRECT variant pricing & availability:")
for t in targets:
    if t["meta_score"]<20: continue
    pp="%d"%t["price"] if t["price"] else "n/a"
    print("  meta %5.1f  %-3s %-18s %-5s  ~%9s PP  %-16s avail=%s"%(t["meta_score"],t["pos"],t["player"],t["year"],pp,t["acq_type"],t["available"]))
print("\nOWNED META CORE/STRONG (your meta assets):")
owned_meta=sorted([r for r in records if r.get("owned") and r["meta_score"]>=25],key=lambda r:-r["meta_score"])
for r in owned_meta:
    print("  meta %5.1f  %-3s %-18s %-5s  %s %s"%(r["meta_score"],r["game_pos"],r["player"],r["year"],r.get("roster_status",""),"VAR" if r["variant"] else ""))
