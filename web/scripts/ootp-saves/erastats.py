"""Q4: eras.json vs era_stats.txt (game's league stats by year)."""
import csv,json,numpy as np,collections
G="/Users/ljmac/Library/Application Support/Steam/steamapps/common/Out of the Park Baseball 27/data/database/"
ERA=json.load(open("/Users/ljmac/Desktop/OOTP Perfect Team/web/src/data/eras.json"))
es={}
for r in csv.DictReader(open(G+"era_stats.txt",encoding="utf-8-sig")):
    try: es[int(r["YEAR"])]=r
    except: pass
print("era_stats years",min(es),max(es),len(es),"cols",len(next(iter(es.values()))))
print("eras.json sources",collections.Counter(v["src"] for v in ERA.values()))
def gs(y):
    r=es[y]; f=lambda k: float(r[k])
    PA=f("AB")+f("BB")+f("HBP")+f("SAC")
    K,BB,HBP=f("K")/PA,f("BB")/PA,f("HBP")/PA; bip=1-K-BB-HBP-f("SAC")/PA
    hr=f("Homeruns")/PA/bip
    return dict(K=K,BB=BB,HBP=HBP,HR=hr,B2=f("Doubles")/PA/bip,B3=f("Triples")/PA/bip,BABIP=(f("Hits")-f("Homeruns"))/PA/(bip*(1-hr)),rg=f("Runs Per Game"),PA_bfp=f("BFP")/PA)
rows=[];bysrc=collections.defaultdict(list)
for k,v in ERA.items():
    if k=="0": continue
    y=int(k)
    if y not in es: continue
    g=gs(y); rel={s:v["rates"][s]/g[s]-1 for s in ("K","BB","HR","BABIP","B2","B3")}; rel["rg"]=v["rg"]/g["rg"]-1
    bysrc[v["src"]].append((y,rel))
for src,L in bysrc.items():
    print(f"\n{src}: {len(L)} years; median |rel diff| / max |rel diff|")
    for s in ("K","BB","HR","BABIP","B2","B3","rg"):
        a=np.array([abs(r[s]) for _,r in L]); worst=max(L,key=lambda t:abs(t[1][s]))
        print(f"   {s:6s} median {np.median(a)*100:5.2f}%  max {a.max()*100:5.2f}% ({worst[0]})")
# show a few
for y in (1907,1920,1958,1968,1987,1999,2010,2019):
    if str(y) in ERA and y in es:
        g=gs(y); v=ERA[str(y)]
        print(y,v["src"],"eras K %.4f HR %.4f BABIP %.4f rg %.2f | era_stats K %.4f HR %.4f BABIP %.4f rg %.2f"%(v["rates"]["K"],v["rates"]["HR"],v["rates"]["BABIP"],v["rg"],g["K"],g["HR"],g["BABIP"],g["rg"]))
print("eras.json years missing from era_stats:",[k for k in ERA if k!="0" and int(k) not in es][:10], " era_stats years missing from eras.json:",[y for y in es if str(y) not in ERA][:30])
print("\nYears with |diff|>3% in K, HR or BABIP (eras.json vs era_stats):")
for src,L in bysrc.items():
    for y,r in sorted(L):
        bad={s:round(r[s]*100,1) for s in ("K","HR","BABIP","rg") if abs(r[s])>0.03}
        if bad: print(" ",y,src,bad)
