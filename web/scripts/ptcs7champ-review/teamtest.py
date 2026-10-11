import csv,json,collections,math,statistics as st,os
D=os.environ.get("REV_DIR","/tmp/ptcs7rev")
M=json.load(open(f"{D}/model.json")); C=json.load(open(f"{D}/cids.json"))
B=["bronze","silver","gold","diamond","open","cap"]
f=lambda r,k: float(r[k]) if r.get(k) not in (None,'','-') else 0.0
def ipf(r):
    s=r.get("IP") or "0"; w,_,fr=s.partition(".")
    try: return float(w)+(float(fr)/3 if fr else 0)
    except: return 0
def corr(x,y,w):
    sw=sum(w); mx=sum(a*c for a,c in zip(x,w))/sw; my=sum(a*c for a,c in zip(y,w))/sw
    sxy=sum(c*(a-mx)*(b-my) for a,b,c in zip(x,y,w)); return sxy/math.sqrt(sum(c*(a-mx)**2 for a,c in zip(x,w))*sum(c*(b-my)**2 for b,c in zip(y,w)))
# gather rows once
data=[]
for b in B:
    rows=list(csv.DictReader(open(f"/home/user/ootp-perfect-team/Tourney Data/PTCS7 Championship/{b}_all.csv",encoding='utf-8-sig')))
    T=collections.defaultdict(lambda: collections.defaultdict(float))
    for r in rows:
        t=T[r["ORG"]]; t["G"]=max(t["G"],f(r,"G"),f(r,"G_1")); t["R"]+=f(r,"R"); t["RA"]+=f(r,"R_1")
    med=st.median([t["R"]/t["G"] for t in T.values() if t["G"]>0])
    jim={o for o,t in T.items() if t["G"]==0 or t["R"]/t["G"]>=3*med or t["R"]-t["RA"]>=150}
    data.append((b,[r for r in rows if r["ORG"] not in jim],T))
def val(m,lhp,K,obsmode):
    mod=m["R"] if m["p"] else (1-lhp)*m["R"]+lhp*m["L"]
    if m["obs"] is None or m["n"]<=0 or K is None: return mod
    if obsmode=="obs-only": return m["obs"]
    return (m["n"]*m["obs"]+K*mod)/(m["n"]+K)
def teams(K,obsmode=None,armw=1.0,defw=1.0,offw=1.0):
    out=[]
    for b,rows,T in data:
        mc=M[b]["cards"]; lhp=C[b]["lhpShare"]; tm=collections.defaultdict(lambda: collections.defaultdict(float))
        for r in rows:
            m=mc.get(r["CID"]); t=tm[r["ORG"]]
            t["G"]=max(t["G"],f(r,"G"),f(r,"G_1")); t["R"]+=f(r,"R"); t["RA"]+=f(r,"R_1")
            if not m or m["R"] is None: continue
            v=val(m,lhp,K,obsmode)
            if not m["p"] and f(r,"PA")>0:
                t["off"]+=f(r,"PA")*v/700
                if r["POS"] in m["fr"]: t["def"]+=f(r,"PA")*m["fr"][r["POS"]]/700
            if m["p"] and f(r,"BF")>0: t["pit"]+=f(r,"BF")*v/700
        L=[dict(b=b,org=o,**t) for o,t in tm.items() if t["G"]>=5]
        for k in ("off","def","pit"):
            mu=sum(t[k]/t["G"] for t in L)/len(L)
            for t in L: t[k+"c"]=t[k]/t["G"]-mu
        mu=sum((t["R"]-t["RA"])/t["G"] for t in L)/len(L)
        for t in L: t["rdc"]=(t["R"]-t["RA"])/t["G"]-mu; t["tot"]=offw*t["offc"]+defw*t["defc"]+armw*t["pitc"]
        out+=L
    return out
def score(L): return corr([t["tot"] for t in L],[t["rdc"] for t in L],[t["G"] for t in L])
print("=== team total vs run diff/G (corr), by how much track record is blended in")
for lab,K,mode in [("ratings only",None,None),("K=20000",20000,None),("K=5000 (current)",5000,None),("K=1500",1500,None),("K=500",500,None),("K=100",100,None),("record only where it exists","x","obs-only")]:
    L=teams(K,mode); print(f"  {lab:28} {score(L):.3f}")
# card-level: blended value vs championship observed
print("\n=== card level: does track record predict Championship play? (corr, weighted)")
bats=[];arms=[]
for b,rows,T in data:
    mc=M[b]["cards"]; lhp=C[b]["lhpShare"]
    for r in rows:
        m=mc.get(r["CID"])
        if not m or m["R"] is None: continue
        if not m["p"] and f(r,"PA")>=30: bats.append((b,m,f(r,"wRAA")/f(r,"PA")*700,f(r,"PA"),lhp))
for lab,K,mode in [("ratings only",None,None),("K=5000",5000,None),("K=1500",1500,None),("K=500",500,None)]:
    xs=[val(m,l,K,mode) for b,m,o,w,l in bats]; print(f"  bats {lab:14} {corr(xs,[o for _,_,o,_,_ in bats],[w for *_,w,_ in bats]):.3f}")
# weights CV
print("\n=== weights: fit off/def/pit on 3 brackets, test on the other 3 (K=5000)")
def wls3(L):
    import itertools
    X=[[t["offc"],t["defc"],t["pitc"]] for t in L]; y=[t["rdc"] for t in L]; w=[t["G"] for t in L]
    A=[[sum(wi*xi[j]*xi[k] for xi,wi in zip(X,w)) for k in range(3)] for j in range(3)]; bb=[sum(wi*xi[j]*yi for xi,yi,wi in zip(X,y,w)) for j in range(3)]
    # solve 3x3
    import copy; Mx=[A[i]+[bb[i]] for i in range(3)]
    for c in range(3):
        p=max(range(c,3),key=lambda r:abs(Mx[r][c])); Mx[c],Mx[p]=Mx[p],Mx[c]
        for r in range(3):
            if r!=c: fct=Mx[r][c]/Mx[c][c]; Mx[r]=[a-fct*b for a,b in zip(Mx[r],Mx[c])]
    return [Mx[i][3]/Mx[i][i] for i in range(3)]
L=teams(5000)
for tr,te in [({"bronze","gold","open"},{"silver","diamond","cap"}),({"silver","diamond","cap"},{"bronze","gold","open"}),({"bronze","silver","gold"},{"diamond","open","cap"}),({"diamond","open","cap"},{"bronze","silver","gold"})]:
    wo,wd,wp=wls3([t for t in L if t["b"] in tr]); Te=[t for t in L if t["b"] in te]
    eq=corr([t["offc"]+t["defc"]+t["pitc"] for t in Te],[t["rdc"] for t in Te],[t["G"] for t in Te])
    fit=corr([wo*t["offc"]+wd*t["defc"]+wp*t["pitc"] for t in Te],[t["rdc"] for t in Te],[t["G"] for t in Te])
    print(f"  fit on {sorted(tr)}: off {wo:.2f} def {wd:.2f} pit {wp:.2f} -> held-out corr {eq:.3f} (equal) vs {fit:.3f} (fitted)")

print("\n=== noise ceiling")
L=teams(5000)
G=[t["G"] for t in L]; sw=sum(G)
rd=[t["rdc"] for t in L]; var_obs=sum(g*r*r for g,r in zip(G,rd))/sw
for sig in (3.6,4.0,4.4):
    vn=sig**2*len(L)/sw; print(f"  per-game RD sd {sig}: noise var {vn:.2f} of observed {var_obs:.2f} -> best possible corr ~{math.sqrt(max(var_obs-vn,0)/var_obs):.2f}")
print("\n=== what the model misses: team traits vs residual (after off 0.6 / def 2 / pit 1.6)")
for t in L: t["tot2"]=0.6*t["offc"]+2*t["defc"]+1.6*t["pitc"]
mx=sum(t["tot2"]*t["G"] for t in L)/sw; my=sum(t["rdc"]*t["G"] for t in L)/sw
bta=sum(t["G"]*(t["tot2"]-mx)*(t["rdc"]-my) for t in L)/sum(t["G"]*(t["tot2"]-mx)**2 for t in L)
for t in L: t["res"]=t["rdc"]-bta*t["tot2"]
# traits
trait=collections.defaultdict(dict)
for b,rows,T in data:
    mc=M[b]["cards"]; acc=collections.defaultdict(lambda: collections.defaultdict(float))
    for r in rows:
        m=mc.get(r["CID"]); a=acc[r["ORG"]]
        if not m: continue
        rt=m["rt"]; pa=f(r,"PA"); bf=f(r,"BF")
        if not m["p"] and pa>0:
            a["pa"]+=pa; a["lhb"]+=pa*(1 if m["bats"]=="L" else .5 if m["bats"]=="S" else 0)
            for k in ("Avoid Ks","Power","Eye","BABIP","Gap","Speed"): a["b_"+k]+=pa*(rt.get(k) or 0)
            a["kpct"]+=f(r,"K"); a["bbpct"]+=f(r,"BB")
        if m["p"] and bf>0:
            a["bf"]+=bf; a["lhp"]+=bf*(1 if m["throws"]=="L" else 0)
            for k in ("Stuff","Control","pHR","pBABIP","Stamina"): a["p_"+k]+=bf*(rt.get(k) or 0)
            a["gs_bf"]+=bf if (rt.get("Stamina") or 0)>=60 else 0
            a["pk"]+=f(r,"K_1"); a["pbb"]+=f(r,"BB_1"); a["phr"]+=f(r,"HR_1")
    for o,a in acc.items():
        if a["pa"]>0 and a["bf"]>0:
            d={"LHB share":a["lhb"]/a["pa"],"LHP share":a["lhp"]/a["bf"],"starter BF share":a["gs_bf"]/a["bf"]}
            for k in ("Avoid Ks","Power","Eye","BABIP","Gap","Speed"): d["bat "+k]=a["b_"+k]/a["pa"]
            for k in ("Stuff","Control","pHR","pBABIP","Stamina"): d["arm "+k]=a["p_"+k]/a["bf"]
            trait[(b,o)]=d
names=list(next(iter(trait.values())).keys())
for nm in names:
    S=[t for t in L if (t["b"],t["org"]) in trait]
    # centre trait per bracket
    byb=collections.defaultdict(list)
    for t in S: byb[t["b"]].append(t)
    xs=[];ys=[];ws=[]
    for b,TT in byb.items():
        mu=sum(trait[(b,t["org"])][nm] for t in TT)/len(TT)
        for t in TT: xs.append(trait[(b,t["org"])][nm]-mu); ys.append(t["res"]); ws.append(t["G"])
    c=corr(xs,ys,ws); n=len(xs); se=1/math.sqrt(n)
    print(f"  {nm:18} corr with residual {c:+.3f}  {'**' if abs(c)>2.5*se else '*' if abs(c)>2*se else ''}")
