import csv,json,collections,math,statistics as st
import os; D=os.environ.get('REV_DIR','/tmp/ptcs7rev')
M=json.load(open(f"{D}/model.json")); C=json.load(open(f"{D}/cids.json"))
B=["bronze","silver","gold","diamond","open","cap"]
f=lambda r,k: float(r[k]) if r.get(k) not in (None,'','-') else 0.0
def wls(X,y,w):
    p=len(X[0]); A=[[0]*p for _ in range(p)]; b=[0]*p
    for xi,yi,wi in zip(X,y,w):
        for j in range(p):
            b[j]+=wi*xi[j]*yi
            for k in range(p): A[j][k]+=wi*xi[j]*xi[k]
    # solve
    M_=[A[i]+[b[i]] for i in range(p)]
    for c in range(p):
        piv=max(range(c,p),key=lambda r:abs(M_[r][c])); M_[c],M_[piv]=M_[piv],M_[c]
        for r in range(p):
            if r!=c and M_[c][c]:
                fct=M_[r][c]/M_[c][c]
                for k in range(c,p+1): M_[r][k]-=fct*M_[c][k]
    beta=[M_[i][p]/M_[i][i] for i in range(p)]
    # se
    n=len(y); sw=sum(w); res=[yi-sum(bj*xj for bj,xj in zip(beta,xi)) for xi,yi in zip(X,y)]
    s2=sum(wi*ri*ri for wi,ri in zip(w,res))/(sw)*(n/(n-p))
    # invert A for se
    inv=[[float(i==j) for j in range(p)] for i in range(p)]; A2=[row[:] for row in A]
    for c in range(p):
        piv=max(range(c,p),key=lambda r:abs(A2[r][c])); A2[c],A2[piv]=A2[piv],A2[c]; inv[c],inv[piv]=inv[piv],inv[c]
        d=A2[c][c]
        for k in range(p): A2[c][k]/=d; inv[c][k]/=d
        for r in range(p):
            if r!=c:
                fct=A2[r][c]
                for k in range(p): A2[r][k]-=fct*A2[c][k]; inv[r][k]-=fct*inv[c][k]
    # effective weights: scale so sum w = n
    se=[math.sqrt(max(s2*inv[i][i]*sw/n*n/ (n) ,0)) for i in range(p)]
    return beta,se
def wcorr(x,y,w):
    sw=sum(w); mx=sum(a*c for a,c in zip(x,w))/sw; my=sum(a*c for a,c in zip(y,w))/sw
    sxy=sum(c*(a-mx)*(b-my) for a,b,c in zip(x,y,w)); sxx=sum(c*(a-mx)**2 for a,c in zip(x,w)); syy=sum(c*(b-my)**2 for b,c in zip(y,w))
    return sxy/math.sqrt(sxx*syy), sxy/sxx

bats=[]; arms=[]; fld=[]; teams=[]
for b in B:
    rows=list(csv.DictReader(open(f"/home/user/ootp-perfect-team/Tourney Data/PTCS7 Championship/{b}_all.csv",encoding='utf-8-sig')))
    mc=M[b]["cards"]; lhp=C[b]["lhpShare"]
    T=collections.defaultdict(lambda: collections.defaultdict(float))
    for r in rows:
        t=T[r["ORG"]]; t["G"]=max(t["G"],f(r,"G"),f(r,"G_1")); t["R"]+=f(r,"R"); t["RA"]+=f(r,"R_1")
    med=st.median([t["R"]/t["G"] for t in T.values() if t["G"]>0])
    jim={o for o,t in T.items() if t["G"]==0 or t["R"]/t["G"]>=3*med or t["R"]-t["RA"]>=150}
    rows=[r for r in rows if r["ORG"] not in jim and r["CID"] in map(str,[])] or [r for r in rows if r["ORG"] not in jim]
    # league means
    pa=sum(f(r,"PA") for r in rows); wr=sum(f(r,"wRAA") for r in rows)
    ip=sum(f(r,"IP_1") if r.get("IP_1") else 0 for r in rows)
    def ipf(r):
        s=r.get("IP") or "0"
        try:
            w,_,fr=s.partition("."); return float(w)+(float(fr)/3 if fr else 0)
        except: return 0
    IP=sum(ipf(r) for r in rows); 
    HR=sum(f(r,"HR_1") for r in rows); BBa=sum(f(r,"BB_1")+f(r,"HP_1") for r in rows); K=sum(f(r,"K_1") for r in rows); RA=sum(f(r,"R_1") for r in rows)
    cF=RA/IP*9-(13*HR+3*BBa-2*K)/IP   # FIP constant so FIP mean = RA9
    lgRA9=RA/IP*9
    def mbat(c): 
        m=mc.get(c); 
        return None if not m or m["p"] or m["R"] is None else (1-lhp)*m["R"]+lhp*m["L"]
    tm=collections.defaultdict(lambda: collections.defaultdict(float))
    for r in rows:
        cid=r["CID"]; m=mc.get(cid); t=tm[r["ORG"]]
        t["G"]=max(t["G"],f(r,"G"),f(r,"G_1")); t["R"]+=f(r,"R"); t["RA"]+=f(r,"R_1"); t["wRAA"]+=f(r,"wRAA"); t["ZR"]+=f(r,"ZR"); t["ARM"]+=f(r,"ARM"); t["FRM"]+=f(r,"FRM")
        if f(r,"PA")>0 and m and not m["p"]:
            mb=mbat(cid); 
            if mb is not None:
                bats.append(dict(b=b,cid=cid,name=m["name"],val=m["val"],pa=f(r,"PA"),obs=f(r,"wRAA")/f(r,"PA")*700,mod=mb,rt=m["rt"],mine="Torrent" in r["ORG"]))
                t["moff"]+=f(r,"PA")*mb/700
            pos=r["POS"]; 
            if pos in m["fr"] and f(r,"PA")>0:
                d=f(r,"ZR")+f(r,"ARM")+f(r,"FRM")
                fld.append(dict(b=b,pos=pos,name=m["name"],pa=f(r,"PA"),obs=d/f(r,"PA")*700,mod=m["fr"][pos],zr=f(r,"ZR")/f(r,"PA")*700,arm=f(r,"ARM")/f(r,"PA")*700,frm=f(r,"FRM")/f(r,"PA")*700,rt=m["rt"]))
                t["mdef"]+=f(r,"PA")*m["fr"][pos]/700
        bf=f(r,"BF"); I=ipf(r)
        if bf>0 and m and m["p"] and m["R"] is not None and I>0:
            fip=(13*f(r,"HR_1")+3*(f(r,"BB_1")+f(r,"HP_1"))-2*f(r,"K_1"))/I+cF
            arms.append(dict(b=b,name=m["name"],val=m["val"],bf=bf,ip=I,obs=(lgRA9-fip)/9*I/bf*700,obsRA=(lgRA9-9*f(r,"R_1")/I)/9*I/bf*700,mod=m["R"],rt=m["rt"],gs=f(r,"GS_1"),role=m["role"],mine="Torrent" in r["ORG"]))
            t["mpit"]+=bf*m["R"]/700
    for o,t in tm.items():
        if t["G"]>=5: teams.append(dict(b=b,org=o,**t))
# centre per bracket
for L,key,wk in ((bats,"obs","pa"),(bats,"mod","pa"),(arms,"obs","bf"),(arms,"obsRA","bf"),(arms,"mod","bf"),(fld,"obs","pa"),(fld,"mod","pa")):
    for b in B:
        S=[x for x in L if x["b"]==b]; sw=sum(x[wk] for x in S); mu=sum(x[key]*x[wk] for x in S)/sw
        for x in S: x[key+"_c"]=x[key]-mu
print("=== 1. BATS: observed runs/700 PA vs model (centred per bracket)")
for mn in (0,50,100):
    S=[x for x in bats if x["pa"]>=mn]; r,sl=wcorr([x["mod_c"] for x in S],[x["obs_c"] for x in S],[x["pa"] for x in S]); print(f"  PA>={mn}: n={len(S)}  r={r:.2f}  slope obs/model={sl:.2f}")
print("=== 2. ARMS: observed (FIP-based) runs/700 BF vs model")
for mn in (0,50,100):
    S=[x for x in arms if x["bf"]>=mn]; r,sl=wcorr([x["mod_c"] for x in S],[x["obs_c"] for x in S],[x["bf"] for x in S]); r2,sl2=wcorr([x["mod_c"] for x in S],[x["obsRA_c"] for x in S],[x["bf"] for x in S]); print(f"  BF>={mn}: n={len(S)}  FIP r={r:.2f} slope={sl:.2f} | RA r={r2:.2f} slope={sl2:.2f}")
print("=== 3. DEFENSE: observed ZR+ARM+FRM per 700 PA vs model fielding runs, by position")
for pos in ["C","1B","2B","3B","SS","LF","CF","RF","ALL"]:
    S=[x for x in fld if (pos=="ALL" or x["pos"]==pos) and x["pa"]>=20]
    if len(S)<10: continue
    r,sl=wcorr([x["mod_c"] for x in S],[x["obs_c"] for x in S],[x["pa"] for x in S])
    sdm=math.sqrt(sum(x["pa"]*x["mod_c"]**2 for x in S)/sum(x["pa"] for x in S)); sdo=math.sqrt(sum(x["pa"]*x["obs_c"]**2 for x in S)/sum(x["pa"] for x in S))
    print(f"  {pos:3} n={len(S):4d} r={r:.2f} slope={sl:.2f}  model sd {sdm:.1f}  observed sd {sdo:.1f}")
# residual regressions
def resid_reg(S,keys,wk,slope_fix=None,label=""):
    X=[];y=[];w=[]
    for x in S:
        rt=x["rt"]; 
        if any(rt.get(k) in (None,0) for k in keys): continue
        X.append([1.0,x["mod_c"]]+[(rt[k]-100)/10 for k in keys]); y.append(x["obs_c"]); w.append(x[wk])
    beta,se=wls(X,y,w)
    print(f"  {label} n={len(y)}  model coef {beta[1]:.2f}±{se[1]:.2f}")
    for k,bb,s in zip(keys,beta[2:],se[2:]): print(f"     {k:10} {bb:+.2f} ±{s:.2f}  runs/700 per +10 beyond the model")
print("=== 4. BATS: which ratings does the model mis-price? (joint fit, obs ~ model + ratings)")
resid_reg([x for x in bats if x["pa"]>=30],["Avoid Ks","BABIP","Gap","Power","Eye","Speed"],"pa",label="bats")
print("=== 5. ARMS: same (FIP-based)")
resid_reg([x for x in arms if x["bf"]>=30],["Stuff","Control","pHR","pBABIP","Movement","Stamina"],"bf",label="arms")
print("=== 6. TEAMS: run differential per game ~ model offence + model defence + model pitching (runs/G)")
for t in teams:
    t["rd"]=(t["R"]-t["RA"])/t["G"]
    for k in ("moff","mdef","mpit","wRAA","ZR","ARM","FRM"): t[k+"_g"]=t[k]/t["G"]
for b in B:
    S=[t for t in teams if t["b"]==b]
    for k in ("rd","moff_g","mdef_g","mpit_g","ZR_g"):
        mu=sum(t[k] for t in S)/len(S)
        for t in S: t[k+"c"]=t[k]-mu
X=[[1,t["moff_gc"],t["mdef_gc"],t["mpit_gc"]] for t in teams]; y=[t["rdc"] for t in teams]; w=[t["G"] for t in teams]
beta,se=wls(X,y,w); print(f"  n={len(teams)} teams  offence {beta[1]:.2f}±{se[1]:.2f}  defence {beta[2]:.2f}±{se[2]:.2f}  pitching {beta[3]:.2f}±{se[3]:.2f}   (1.0 = model calibrated)")
X=[[1,t["moff_gc"],t["mdef_gc"],t["mpit_gc"],t["ZR_gc"]] for t in teams]
beta,se=wls(X,y,w); print(f"  + observed ZR/G: offence {beta[1]:.2f} defence(model) {beta[2]:.2f} pitching {beta[3]:.2f} observedZR {beta[4]:.2f}±{se[4]:.2f}")
sd=lambda k: math.sqrt(sum(t["G"]*t[k]**2 for t in teams)/sum(t["G"] for t in teams))
print(f"  spread (sd) across teams, runs/G: model off {sd('moff_gc'):.2f}  model def {sd('mdef_gc'):.2f}  model pit {sd('mpit_gc'):.2f}  observed ZR {sd('ZR_gc'):.2f}  RD {sd('rdc'):.2f}")
json.dump(dict(bats=bats,arms=arms,fld=fld,teams=teams),open(f"{D}/rev.json","w"),default=str)
