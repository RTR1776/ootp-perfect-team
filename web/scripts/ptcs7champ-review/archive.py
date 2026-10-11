import json,math,collections
import os; D=os.environ.get("REV_DIR","/tmp/ptcs7rev")
A=json.load(open(f"{D}/arch.json"))
LHP=0.3
for x in A:
    x["mod"]=x["R"] if x["p"] else (1-LHP)*x["R"]+LHP*x["L"]
    x["w"]=x["bf"] if x["p"] else x["pa"]
# per series centring + observed on runs/700
bys=collections.defaultdict(list)
for x in A: bys[(x["s"],x["p"])].append(x)
for (s,p),S in bys.items():
    S2=[x for x in S if x["w"]>0 and (x["fip"] if p else x["woba"]) is not None]
    sw=sum(x["w"] for x in S2)
    if not sw: continue
    if p:
        mf=sum(x["fip"]*x["w"] for x in S2)/sw
        for x in S2: x["obs"]=(mf-x["fip"])/9*x["ip"]/x["bf"]*700
    else:
        mw=sum(x["woba"]*x["w"] for x in S2)/sw
        for x in S2: x["obs"]=(x["woba"]-mw)/1.25*700
    mm=sum(x["mod"]*x["w"] for x in S2)/sw
    for x in S2: x["mc"]=x["mod"]-mm
    # defence
    D2=[x for x in S2 if not p and x["fr"] is not None and x["pa"]>0]
    sw2=sum(x["pa"] for x in D2)
    if sw2:
        mz=sum(x["zr"] for x in D2)/sw2*700; mf_=sum(x["fr"]*x["pa"] for x in D2)/sw2
        for x in D2: x["zc"]=x["zr"]/x["pa"]*700-mz; x["fc"]=x["fr"]-mf_
def slope(S,xk,yk,wk):
    S=[x for x in S if xk in x and yk in x and x[wk]>0]
    sw=sum(x[wk] for x in S); 
    if len(S)<20: return None
    mx=sum(x[xk]*x[wk] for x in S)/sw; my=sum(x[yk]*x[wk] for x in S)/sw
    sxy=sum(x[wk]*(x[xk]-mx)*(x[yk]-my) for x in S); sxx=sum(x[wk]*(x[xk]-mx)**2 for x in S); syy=sum(x[wk]*(x[yk]-my)**2 for x in S)
    # bootstrap-free SE approx by series clusters later; here plain
    return sxy/sxx, sxy/math.sqrt(sxx*syy), len(S)
def band(y):
    return "≤1945" if y<1946 else "1946–76" if y<1977 else "1977–93" if y<1994 else "1994–2009" if y<2010 else "2010+/default"
print("=== calibrated model vs play, by group (slope 1.0 = right)")
print(f"{'group':26} {'bats slope (r, n)':22} {'arms slope (r, n)':22} {'ZR slope (r, n)':22}")
groups=[("ALL non-Championship",lambda x: not x["champ"]),("PTCS7 Championship",lambda x: x["champ"])]
for bnd in ["≤1945","1946–76","1977–93","1994–2009","2010+/default"]: groups.append((f"era {bnd} (non-champ)",lambda x,b=bnd: not x["champ"] and band(x["year"])==b))
for lab,cap in [("value cap ≤79",lambda m: m is not None and m<=79),("value cap 80–99",lambda m: m is not None and 80<=m<=99),("no cap / 100+",lambda m: m is None or m>=100)]:
    groups.append((f"field {lab} (non-champ)",lambda x,c=cap: not x["champ"] and c(x["max"])))
def fmt(t): return "—" if not t else f"{t[0]:.2f} ({t[1]:.2f}, {t[2]})"
for lab,fn in groups:
    S=[x for x in A if fn(x)]
    b=slope([x for x in S if not x["p"] and x["pa"]>=50],"mc","obs","w"); a=slope([x for x in S if x["p"] and x["bf"]>=50],"mc","obs","w"); z=slope([x for x in S if not x["p"] and x["pa"]>=50],"fc","zc","pa")
    print(f"{lab:26} {fmt(b):22} {fmt(a):22} {fmt(z):22}")
print("\n=== defence (ZR) slope by position, non-Championship archive vs Championship")
for pos in ["C","1B","2B","3B","SS","LF","CF","RF"]:
    a=slope([x for x in A if not x["champ"] and not x["p"] and x["pos"]==pos and x["pa"]>=50],"fc","zc","pa")
    c=slope([x for x in A if x["champ"] and not x["p"] and x["pos"]==pos and x["pa"]>=20],"fc","zc","pa")
    print(f"  {pos:3} archive {fmt(a):22} champ {fmt(c)}")
# series-level slopes distribution for arms & ZR (cluster robustness)
print("\n=== per-series slopes (median, IQR) — robustness")
for lab,p,xk,yk,wk,mn in [("arms",True,"mc","obs","w",50),("bats",False,"mc","obs","w",50),("ZR",False,"fc","zc","pa",50)]:
    v=[]
    for s in {x["s"] for x in A if not x["champ"]}:
        t=slope([x for x in A if x["s"]==s and x["p"]==p and (x["bf"] if p else x["pa"])>=mn],xk,yk,wk)
        if t and t[2]>=30: v.append(t[0])
    v.sort(); q=lambda f: v[int(f*(len(v)-1))]
    print(f"  {lab:5} series {len(v)}  median {q(.5):.2f}  IQR {q(.25):.2f}–{q(.75):.2f}")

E=json.load(open("src/data/eras.json"))
def gs(y):
    r=(E["0"] if y==2010 else E.get(str(y)))["rates"]
    bip=(1-r["K"]-r["BB"]-r["HBP"])*(1-r["HR"]); return min(1.35,max(0.7,(bip/0.743)**1.5))
for x in A:
    if "fc" in x: x["fgc"]=x["fc"]*gs(x["year"])
print("\n=== ZR vs PRODUCTION glove runs (fielding × gloveScale)")
for lab,fn in [("ALL non-champ",lambda x: not x["champ"]),("Championship",lambda x: x["champ"])]+[(f"era {b}",lambda x,b=b: not x["champ"] and band(x["year"])==b) for b in ["≤1945","1946–76","1977–93","1994–2009","2010+/default"]]:
    print(f"  {lab:22} {fmt(slope([x for x in A if fn(x) and not x['p'] and x['pa']>=50],'fgc','zc','pa'))}")
for pos in ["C","1B","2B","3B","SS","LF","CF","RF"]:
    print(f"  {pos:3} archive {fmt(slope([x for x in A if not x['champ'] and not x['p'] and x['pos']==pos and x['pa']>=50],'fgc','zc','pa'))}")

print("\n=== 2-fold by series (fit on one half, test on the other)")
ser=sorted({x["s"] for x in A if not x["champ"]}); half=[set(ser[0::2]),set(ser[1::2])]
for fold in (0,1):
    tr=half[fold]; te=half[1-fold]
    # arms by band
    fac={}
    for b in ["≤1945","1946–76","1977–93","1994–2009","2010+/default"]:
        t=slope([x for x in A if x["s"] in tr and x["p"] and x["bf"]>=50 and band(x["year"])==b],"mc","obs","w"); fac[b]=t[0] if t else 1
    before=slope([x for x in A if x["s"] in te and x["p"] and x["bf"]>=50],"mc","obs","w")
    for x in A:
        if x["p"] and "mc" in x: x["mc2"]=x["mc"]*fac[band(x["year"])]
    after=slope([x for x in A if x["s"] in te and x["p"] and x["bf"]>=50],"mc2","obs","w")
    # defence by pos
    pf={}
    for pos in ["C","1B","2B","3B","SS","LF","CF","RF"]:
        t=slope([x for x in A if x["s"] in tr and not x["p"] and x["pos"]==pos and x["pa"]>=50],"fgc","zc","pa"); pf[pos]=t[0] if t else 1
    for x in A:
        if "fgc" in x: x["fgc2"]=x["fgc"]*pf.get(x["pos"],1)
    db=slope([x for x in A if x["s"] in te and not x["p"] and x["pa"]>=50],"fgc","zc","pa"); da=slope([x for x in A if x["s"] in te and not x["p"] and x["pa"]>=50],"fgc2","zc","pa")
    print(f"  fold {fold}: arms factors {', '.join(f'{k} {v:.2f}' for k,v in fac.items())}")
    print(f"          held-out arms slope {before[0]:.2f} -> {after[0]:.2f} (r {before[1]:.3f} -> {after[1]:.3f}) | held-out ZR slope {db[0]:.2f} -> {da[0]:.2f} (r {db[1]:.3f} -> {da[1]:.3f})")

print("\n=== fixed rule test: arms x1.5 (1946-76), x1.3 (1977-93), x1.0 else; gloves by position")
RULE={"1946–76":1.5,"1977–93":1.3}
for x in A:
    if x["p"] and "mc" in x: x["mc3"]=x["mc"]*RULE.get(band(x["year"]),1.0)
for fold in (0,1):
    te=half[1-fold]; tr=half[fold]
    S=[x for x in A if x["s"] in te and x["p"] and x["bf"]>=50]
    b=slope(S,"mc","obs","w"); a=slope(S,"mc3","obs","w")
    pf={pos:(slope([x for x in A if x["s"] in tr and not x["p"] and x["pos"]==pos and x["pa"]>=50],"fgc","zc","pa") or (1,))[0] for pos in ["C","1B","2B","3B","SS","LF","CF","RF"]}
    print(f"  fold {fold}: held-out arms slope {b[0]:.2f} -> {a[0]:.2f} (r {b[1]:.3f} -> {a[1]:.3f})   glove factors from the other half: " + " ".join(f"{k} {v:.2f}" for k,v in pf.items()))
S=[x for x in A if x["champ"] and x["p"] and x["bf"]>=50]
print(f"  Championship (never used in fitting): arms slope {slope(S,'mc','obs','w')[0]:.2f} -> {slope(S,'mc3','obs','w')[0]:.2f}")
PF={"C":1.61,"1B":1.0,"2B":1.29,"3B":1.20,"SS":1.64,"LF":1.24,"CF":1.69,"RF":1.25}
for x in A:
    if "fgc" in x: x["fgc4"]=x["fgc"]*PF.get(x["pos"],1)
S=[x for x in A if x["champ"] and not x["p"] and x["pa"]>=20]
print(f"  Championship ZR slope {slope(S,'fgc','zc','pa')[0]:.2f} -> {slope(S,'fgc4','zc','pa')[0]:.2f} (ZR units; x0.887 runs/ZR target {1/0.887:.2f})")
S=[x for x in A if not x["champ"] and not x["p"] and x["pa"]>=50]
print(f"  archive ZR slope {slope(S,'fgc','zc','pa')[0]:.2f} -> {slope(S,'fgc4','zc','pa')[0]:.2f} (target {1/0.887:.2f})")
