"""Pooled per-band elasticity at rating 100 (export FE Poisson, quadratic in ln rating), ratio to the 2010+ band,
next to the band's mean era_modifier. Does elasticity track the modifiers, or the bands where our fixes live?"""
import pickle,os,csv,math,numpy as np,importlib.util
H=os.path.dirname(os.path.abspath(__file__))
spec=importlib.util.spec_from_file_location("s",f"{H}/slopes_lib.py")
A=pickle.load(open(f"{H}/arrays.pkl","rb"))
G="/Users/ljmac/Library/Application Support/Steam/steamapps/common/Out of the Park Baseball 27/data/database/"
em={int(r["YEAR"]):{k:float(v) for k,v in r.items() if k!="YEAR"} for r in csv.DictReader(open(G+"era_modifiers.txt",encoding="utf-8-sig"))}
MOD={"bat_K":"Avoid K","bat_BB":"Eye","bat_HR":"HR Power","bat_BABIP":"Contact","bat_XBH":"Gap Power","pit_K":"Stuff","pit_BB":"Control","pit_HR":"Movement","pit_BABIP":"Movement"}
exec(open(f"{H}/slopes.py").read().split("res={}")[0].split("def pfe")[1].join(["def pfe",""]) if False else "")
src=open(f"{H}/slopes.py").read(); exec(src[src.index("def pfe"):src.index("res={}")])
B=[("<=1945",0,1945),("1946-76",1946,1976),("1977-93",1977,1993),("1994-09",1994,2009),("2010+",2010,9999)]
print("stat        "+"  ".join(f"{b:>18s}" for b,_,_ in B))
for name in [k for k in A if not k.startswith("_")]:
    d=A[name]; ok=(d["r"]>=30)&(d["r"]<=200); cells=[]; ref=None; out=[]
    for b,a,z in B:
        m=ok&(d["yr"]>=a)&(d["yr"]<=z)
        g=np.unique(d["g"][m],return_inverse=True)[1]; L=np.log(d["r"][m]/100)
        be,se=pfe(d["y"][m],d["e"][m],np.stack([L,L*L],1),g)
        yrs=d["yr"][m]; mm=math.exp(np.average([math.log(em[min(max(int(y),1871),2023)][MOD[name]]) for y in yrs[::50]]))
        out.append((be[0],se[0],mm))
    ref=out[-1][0]
    print(f"{name:10s}  "+"  ".join(f"{b1:+.3f}({b1/ref:.2f}x) m{mm:.2f}" for b1,se,mm in out))
