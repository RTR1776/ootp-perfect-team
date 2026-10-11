"""Tournament-only team weights, scored on WINS (L.J. 10-11: league is normalised, tournaments are not —
two models; the tournament model must be fitted on tournaments). python3 tourfit.py  (MV2_DIR=…)"""
import json,math,os,random,collections
D=os.environ.get("MV2_DIR","/tmp/mv2")
T=[t for t in json.load(open(f"{D}/teams.json")) if t["kind"]=="tour" and t["W"]+t["L"]>0]
def band(y): return "<=1945" if y<1946 else "1946-76" if y<1977 else "1977-93" if y<1994 else "1994-09" if y<2010 else "2010+"
by=collections.defaultdict(list)
for t in T:
    t["band"]=band(t["year"]); t["wp"]=t["W"]/(t["W"]+t["L"]); t["rd"]=(t["R"]-t["RA"])/t["G"]; t["gp"]=t["G"]; by[t["unit"]].append(t)
for L in by.values():
    for k in ("wp","rd","gp","off","def","pit"):
        m=sum(t[k] for t in L)/len(L)
        for t in L: t[k+"c"]=t[k]-m
def corr(x,y,w):
    sw=sum(w); mx=sum(a*c for a,c in zip(x,w))/sw; my=sum(a*c for a,c in zip(y,w))/sw
    sxy=sum(c*(a-mx)*(b-my) for a,b,c in zip(x,y,w)); sxx=sum(c*(a-mx)**2 for a,c in zip(x,w)); syy=sum(c*(b-my)**2 for b,c in zip(y,w))
    return sxy/math.sqrt(sxx*syy)
def sc(S,d,p,target): 
    w=[t["G"] for t in S] if target!="gpc" else [1]*len(S)
    return corr([t["offc"]+d*t["defc"]+p*t["pitc"] for t in S],[t[target] for t in S],w)
P=[0.5,1,1.5,2,2.5,3,3.5,4,5]; Dd=[0.5,1,1.5,2,3,4,5]
print(f"tournament team-events: {len(T)} in {len(by)} events; bands {dict(collections.Counter(t['band'] for t in T))}")
for target,lab in (("wpc","win%"),("gpc","games played (how deep)"),("rdc","run diff/G")):
    print(f"\n=== target: {lab}")
    for bnd in ["ALL","1946-76","1994-09","2010+"]:
        S=T if bnd=="ALL" else [t for t in T if t["band"]==bnd]
        grid={(d,p):sc(S,d,p,target) for d in Dd for p in P}; (bd,bp),bv=max(grid.items(),key=lambda x:x[1])
        # honest: choose (d,p) on 4/5 of events, score the held-out fifth
        units=sorted({t["unit"] for t in S}); random.Random(3).shuffle(units); folds=[set(units[i::5]) for i in range(5)]
        xs=[];ys=[];ws=[];xe=[];xp=[]
        for f in folds:
            tr=[t for t in S if t["unit"] not in f]; te=[t for t in S if t["unit"] in f]
            (d,p)=max(((d,p) for d in Dd for p in P),key=lambda dp:sc(tr,dp[0],dp[1],target))
            xs+=[t["offc"]+d*t["defc"]+p*t["pitc"] for t in te]; ys+=[t[target] for t in te]; ws+=[t["G"] if target!="gpc" else 1 for t in te]
            xe+=[t["offc"]+t["defc"]+t["pitc"] for t in te]; xp+=[t["offc"]+3*t["defc"]+2.5*t["pitc"] for t in te]
        print(f"  {bnd:8} n={len(S):5d}  equal {sc(S,1,1,target):.3f}  pooled-league(3,2.5) {sc(S,3,2.5,target):.3f}  best d={bd} p={bp} {bv:.3f}  | 5-fold held-out: equal {corr(xe,ys,ws):.3f}  league-pooled {corr(xp,ys,ws):.3f}  tour-chosen {corr(xs,ys,ws):.3f}")

# ---- track record from other event types (MV2_OBS run)
if T and T[0].get("ob"):
    KS=[20000,5000,1500,500,150]
    for L in by.values():
        for K in KS:
            for k in (f"off{K}",f"pit{K}"):
                m=sum(t["ob"][k] for t in L)/len(L)
                for t in L: t[k+"c"]=t["ob"][k]-m
    print("\n=== track record (other event types only) blended into card values: K = PA/BF at which record and ratings weigh equally")
    for target,lab in (("wpc","win%"),("gpc","games played"),("rdc","run diff/G")):
        w=lambda S: [t["G"] if target!="gpc" else 1 for t in S]
        line=f"  {lab:14} ratings only {corr([t['offc']+t['defc']+t['pitc'] for t in T],[t[target] for t in T],w(T)):.3f}"
        for K in KS: line+=f" | K={K} {corr([t[f'off{K}c']+t['defc']+t[f'pit{K}c'] for t in T],[t[target] for t in T],w(T)):.3f}"
        print(line)
    for bnd in ["1946-76","1994-09","2010+"]:
        S=[t for t in T if t["band"]==bnd]; line=f"  win% {bnd:8} ratings {corr([t['offc']+t['defc']+t['pitc'] for t in S],[t['wpc'] for t in S],[t['G'] for t in S]):.3f}"
        for K in KS: line+=f" | K={K} {corr([t[f'off{K}c']+t['defc']+t[f'pit{K}c'] for t in S],[t['wpc'] for t in S],[t['G'] for t in S]):.3f}"
        print(line)

print("\n=== how predictable is tournament win% at all?")
w=[t["G"] for t in T]; sw=sum(w)
var_obs=sum(t["G"]*t["wpc"]**2 for t in T)/sw
# binomial noise of a G-game win%: p(1-p)/G, G-weighted average -> 0.25 * N / sum(G)
var_noise=sum(t["G"]*(t["wp"]*(1-t["wp"]))/t["G"] for t in T)/sw
print(f"  observed var of win% {var_obs:.4f}, coin-flip noise {var_noise:.4f} -> skill share {1-var_noise/var_obs:.2f}, best possible corr ~{math.sqrt(max(0,1-var_noise/var_obs)):.2f}; we are at 0.375-0.380")
