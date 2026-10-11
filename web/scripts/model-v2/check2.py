"""Check 2: arm ratings against RUNS ALLOWED (not FIP, which cannot see balls in play). Archive card level, 2-fold by series."""
import json,os,collections
D=os.environ.get("REV_DIR","/tmp/ptcs7rev"); A=json.load(open(f"{D}/arch.json"))
P=[x for x in A if x["p"] and x["bf"]>=100 and x.get("ra") is not None and x["ip"]>0 and all(x["rt"].get(k) for k in ("Stuff","Control","pHR","pBABIP"))]
by=collections.defaultdict(list)
for x in P: by[x["s"]].append(x)
for s,S in by.items():
    ip=sum(x["ip"] for x in S); ra9=9*sum(x["ra"] for x in S)/ip; fipm=sum(x["fip"]*x["ip"] for x in S if x["fip"] is not None)/ip
    sw=sum(x["bf"] for x in S); mm=sum(x["R"]*x["bf"] for x in S)/sw
    for x in S:
        x["obsRA"]=(ra9-9*x["ra"]/x["ip"])/9*x["ip"]/x["bf"]*700; x["mc"]=x["R"]-mm
        x["obsFIP"]=(fipm-(x["fip"] if x["fip"] is not None else fipm))/9*x["ip"]/x["bf"]*700
def band(y): return "<=1945" if y<1946 else "1946-76" if y<1977 else "1977-93" if y<1994 else "1994-09" if y<2010 else "2010+"
def wls(X,y,w):
    p=len(X[0]); M=[[0.0]*(p+1) for _ in range(p)]
    for xi,yi,wi in zip(X,y,w):
        for j in range(p):
            M[j][p]+=wi*xi[j]*yi
            for k in range(p): M[j][k]+=wi*xi[j]*xi[k]
    for c in range(p):
        q=max(range(c,p),key=lambda r:abs(M[r][c])); M[c],M[q]=M[q],M[c]
        for r in range(p):
            if r!=c and M[c][c]: f=M[r][c]/M[c][c]; M[r]=[a-f*b for a,b in zip(M[r],M[c])]
    return [M[i][p]/M[i][i] for i in range(p)]
K=["Stuff","Control","pHR","pBABIP"]
for tgt in ("obsRA","obsFIP"):
    print(f"\n=== target {tgt}: runs/700 BF per +10 rating beyond the model (fold A / fold B / all)")
    for bnd in ["ALL","<=1945","1946-76","1977-93","1994-09","2010+"]:
        S=[x for x in P if bnd=="ALL" or band(x["year"])==bnd]
        if len(S)<150: continue
        ser=sorted({x["s"] for x in S}); fa=set(ser[0::2]); res=[]
        for sub in ([x for x in S if x["s"] in fa],[x for x in S if x["s"] not in fa],S):
            res.append(wls([[1,x["mc"]]+[(x["rt"][k]-100)/10 for k in K] for x in sub],[x[tgt] for x in sub],[x["bf"] for x in sub]))
        print(f"  {bnd:8} n={len(S):5d} model {res[2][1]:.2f} | "+"  ".join(f"{k} {res[0][i+2]:+.2f}/{res[1][i+2]:+.2f}/{res[2][i+2]:+.2f}" for i,k in enumerate(K)))
