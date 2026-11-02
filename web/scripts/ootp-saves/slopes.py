"""Q1 slope test. Poisson regression with export fixed effects: count ~ exposure*exp(FE_export + b1*L + b2*L^2), L=ln(rating/100).
Fit per era year. If PT multiplied ratings by era_modifiers, the year's local elasticity at rating 100 should equal the
2010 curve's elasticity at rating 100*m: b1_2010 + 2*b2_2010*ln(m). Under our model (no rating scaling) it stays b1_2010."""
import pickle,os,csv,math,numpy as np,collections
H=os.path.dirname(os.path.abspath(__file__))
A=pickle.load(open(f"{H}/arrays.pkl","rb"))
G="/Users/ljmac/Library/Application Support/Steam/steamapps/common/Out of the Park Baseball 27/data/database/"
em={int(r["YEAR"]):{k:float(v) for k,v in r.items() if k!="YEAR"} for r in csv.DictReader(open(G+"era_modifiers.txt",encoding="utf-8-sig"))}
MOD={"bat_K":"Avoid K","bat_BB":"Eye","bat_HR":"HR Power","bat_BABIP":"Contact","bat_XBH":"Gap Power","pit_K":"Stuff","pit_BB":"Control","pit_HR":"Movement","pit_BABIP":"Movement"}
def pfe(y,e,X,g,it=40):
    ng=g.max()+1; b=np.zeros(X.shape[1]); fe=np.log((np.bincount(g,y,ng)+.5)/np.bincount(g,e,ng))
    for _ in range(it):
        mu=e*np.exp(fe[g]+X@b)
        fe+=np.log((np.bincount(g,y,ng)+1e-9)/(np.bincount(g,mu,ng)+1e-12)); mu=e*np.exp(fe[g]+X@b)
        sm=np.bincount(g,mu,ng)
        Xd=X-np.stack([np.bincount(g,mu*X[:,j],ng)/np.maximum(sm,1e-12) for j in range(X.shape[1])],1)[g]
        Hm=(Xd*mu[:,None]).T@Xd; gr=Xd.T@(y-mu); st=np.linalg.solve(Hm,gr); b+=st
        if np.abs(st).max()<1e-7: break
    mu=e*np.exp(fe[g]+X@b); disp=np.sum((y-mu)**2/np.maximum(mu,1e-9))/max(len(y)-len(b)-ng,1)
    se=np.sqrt(np.diag(np.linalg.inv(Hm))*disp)
    return b,se
res={}
for name in [k for k in A if not k.startswith("_")]:
    d=A[name]; ok=(d["r"]>=30)&(d["r"]<=200)
    yrs=sorted(set(d["yr"][ok].tolist()))
    rows=[]
    for Y in yrs:
        m=ok&(d["yr"]==Y)
        if d["e"][m].sum()<3e5: continue
        g=np.unique(d["g"][m],return_inverse=True)[1]
        L=np.log(d["r"][m]/100); X=np.stack([L,L*L],1)
        b,se=pfe(d["y"][m],d["e"][m],X,g); rows.append((Y,b,se,int(d["e"][m].sum()),len(set(g.tolist()))))
    res[name]=rows
    base=[r for r in rows if r[0]==2010][0]; b1,b2=base[1]
    print(f"\n=== {name}  (2010: b1={b1:+.3f}±{base[2][0]:.3f}  b2={b2:+.3f}±{base[2][1]:.3f}; modifier '{MOD[name]}')")
    print("  year  m      b1_obs   se    H0(b1_2010)  H1(scaled)   expos  nexp")
    zs0=[];zs1=[]
    for Y,b,se,ex,ne in rows:
        mm=em[min(max(Y,1871),2023)][MOD[name]]; h1=b1+2*b2*math.log(mm)
        print(f"  {Y}  {mm:5.3f}  {b[0]:+.3f}  {se[0]:.3f}   {b1:+.3f}       {h1:+.3f}   {ex:8d} {ne:3d}")
        if Y!=2010 and abs(mm-1)>0.05: zs0.append(((b[0]-b1)/se[0])**2); zs1.append(((b[0]-h1)/se[0])**2)
    if zs0: print(f"  chi2 over years with |m-1|>5%: H0 {sum(zs0):.1f}  H1 {sum(zs1):.1f}  (df={len(zs0)})")
pickle.dump(res,open(f"{H}/slopes.pkl","wb"))
