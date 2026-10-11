"""MODEL v2, step 4: which ratings does the (fixed) card model still mis-price, by era band?
Input: REV_DIR/arch.json from scripts/ptcs7champ-review/archive.mts (production scorer, each series' own env).
Joint WLS per band: observed runs/700 ~ model + Σ (rating-100)/10, two-fold by series."""
import json,math,os,collections,random
D=os.environ.get("REV_DIR","/tmp/ptcs7rev"); A=json.load(open(f"{D}/arch.json"))
LHP=0.3
for x in A: x["mod"]=x["R"] if x["p"] else (1-LHP)*x["R"]+LHP*x["L"]; x["w"]=x["bf"] if x["p"] else x["pa"]
bys=collections.defaultdict(list)
for x in A: bys[(x["s"],x["p"])].append(x)
for (s,p),S in bys.items():
    S2=[x for x in S if x["w"]>0 and (x["fip"] if p else x["woba"]) is not None]; sw=sum(x["w"] for x in S2)
    if not sw: continue
    if p:
        mf=sum(x["fip"]*x["w"] for x in S2)/sw
        for x in S2: x["obs"]=(mf-x["fip"])/9*x["ip"]/x["bf"]*700
    else:
        mw=sum(x["woba"]*x["w"] for x in S2)/sw
        for x in S2: x["obs"]=(x["woba"]-mw)/1.25*700
    mm=sum(x["mod"]*x["w"] for x in S2)/sw
    for x in S2: x["mc"]=x["mod"]-mm
def band(y): return "<=1945" if y<1946 else "1946-76" if y<1977 else "1977-93" if y<1994 else "1994-09" if y<2010 else "2010+"
def wls(X,y,w):
    p=len(X[0]); A_=[[0.0]*p for _ in range(p)]; b=[0.0]*p
    for xi,yi,wi in zip(X,y,w):
        for j in range(p):
            b[j]+=wi*xi[j]*yi
            for k in range(p): A_[j][k]+=wi*xi[j]*xi[k]
    M=[A_[i]+[b[i]] for i in range(p)]
    for c in range(p):
        q=max(range(c,p),key=lambda r:abs(M[r][c])); M[c],M[q]=M[q],M[c]
        for r in range(p):
            if r!=c and M[c][c]: f=M[r][c]/M[c][c]; M[r]=[a-f*bb for a,bb in zip(M[r],M[c])]
    return [M[i][p]/M[i][i] for i in range(p)]
KEYS={False:["Avoid Ks","BABIP","Gap","Power","Eye"],True:["Stuff","Control","pHR","pBABIP"]}
out={}
for p in (False,True):
    print(f"\n=== {'ARMS' if p else 'BATS'}: runs/700 per +10 rating the current model misses (fold A / fold B / all)")
    for bnd in ["<=1945","1946-76","1977-93","1994-09","2010+"]:
        S=[x for x in A if x["p"]==p and "mc" in x and x["w"]>=(50) and band(x["year"])==bnd and all(x["rt"].get(k) for k in KEYS[p])]
        if len(S)<150: continue
        ser=sorted({x["s"] for x in S}); fa=set(ser[0::2])
        res=[]
        for sub in ([x for x in S if x["s"] in fa],[x for x in S if x["s"] not in fa],S):
            X=[[1,x["mc"]]+[(x["rt"][k]-100)/10 for k in KEYS[p]] for x in sub]; res.append(wls(X,[x["obs"] for x in sub],[x["w"] for x in sub]))
        line=f"  {bnd:8} n={len(S):5d} model {res[0][1]:.2f}/{res[1][1]:.2f}/{res[2][1]:.2f} |"
        for i,k in enumerate(KEYS[p]):
            a,b,c=res[0][i+2],res[1][i+2],res[2][i+2]
            agree = (a>0)==(b>0) and min(abs(a),abs(b))>0.3
            line+=f" {k} {a:+.1f}/{b:+.1f}/{c:+.1f}{'*' if agree else ' '}"
            out.setdefault("arms" if p else "bats",{}).setdefault(bnd,{})[k]={"a":a,"b":b,"all":c,"agree":agree}
        print(line)
json.dump(out,open(f"{D}/ratings.json","w"),indent=1)
