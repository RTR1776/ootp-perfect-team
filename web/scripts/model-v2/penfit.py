"""Pen vs rotation on tournament wins (L.J. 10-11: too much spent in the bullpen?). MV2_DIR=… python3 penfit.py"""
import json,math,os,random,collections
D=os.environ.get("MV2_DIR","/tmp/mv2")
T=[t for t in json.load(open(f"{D}/teams.json")) if t["kind"]=="tour" and t["W"]+t["L"]>0]
by=collections.defaultdict(list)
for t in T: t["wp"]=t["W"]/(t["W"]+t["L"]); by[t["unit"]].append(t)
for L in by.values():
    for k in ("wp","off","def","pitSP","pitRP","nRP","nSP"):
        m=sum(t[k] for t in L)/len(L)
        for t in L: t[k+"c"]=t[k]-m
def corr(x,y,w):
    sw=sum(w); mx=sum(a*c for a,c in zip(x,w))/sw; my=sum(a*c for a,c in zip(y,w))/sw
    sxy=sum(c*(a-mx)*(b-my) for a,b,c in zip(x,y,w)); sxx=sum(c*(a-mx)**2 for a,c in zip(x,w)); syy=sum(c*(b-my)**2 for b,c in zip(y,w))
    return sxy/math.sqrt(sxx*syy)
x=lambda t,s,r:t["offc"]+2*t["defc"]+s*t["pitSPc"]+r*t["pitRPc"]
sc=lambda S,s,r:corr([x(t,s,r) for t in S],[t["wpc"] for t in S],[t["G"] for t in S])
G=[0,0.5,1,1.5,2,2.5,3,4,5]
print(f"tournament team-events {len(T)}; pen share of pitching runs: SP sd {statistics_sd if False else ''}")
import statistics
print(f"  sd per game: off {statistics.pstdev(t['offc'] for t in T):.3f} pitSP {statistics.pstdev(t['pitSPc'] for t in T):.3f} pitRP {statistics.pstdev(t['pitRPc'] for t in T):.3f}")
grid={(s,r):sc(T,s,r) for s in G for r in G}; (bs,br),bv=max(grid.items(),key=lambda z:z[1])
print(f"  current (SP 2, RP 2): {sc(T,2,2):.4f}   best SP {bs} RP {br}: {bv:.4f}")
for r in G: print(f"    SP 2, RP {r}: {sc(T,2,r):.4f}")
units=sorted(by); random.Random(3).shuffle(units); folds=[set(units[i::5]) for i in range(5)]
xs=[];ys=[];ws=[];xc=[];picks=[]
for f in folds:
    tr=[t for t in T if t["unit"] not in f]; te=[t for t in T if t["unit"] in f]
    s,r=max(((s,r) for s in G for r in G),key=lambda p:sc(tr,*p)); picks.append((s,r))
    xs+=[x(t,s,r) for t in te]; xc+=[x(t,2,2) for t in te]; ys+=[t["wpc"] for t in te]; ws+=[t["G"] for t in te]
print(f"  5-fold held out: current {corr(xc,ys,ws):.4f}  chosen {corr(xs,ys,ws):.4f}  picks {picks}")
# relievers carried (who pitched) vs win%, after the model's strength
from statistics import mean
res=[(t["nRP"],t["wpc"]-0.0*x(t,2,2)) for t in T]
b=sum(x(t,2,2)*t["wpc"]*t["G"] for t in T)/sum(x(t,2,2)**2*t["G"] for t in T)
cnt=collections.defaultdict(list)
for t in T: cnt[min(9,max(3,t["nRP"]))].append((t["wpc"]-b*x(t,2,2),t["G"]))
print("  relievers who pitched → win% vs what the model expects (team-events):")
for k in sorted(cnt): v=cnt[k]; print(f"    {k}{'+' if k==9 else ''}: {sum(a*g for a,g in v)/sum(g for a,g in v):+.4f}  n {len(v)}")
