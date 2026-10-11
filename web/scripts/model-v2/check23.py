"""Checks 2b and 3, tournament teams only: runs ALLOWED per game beyond model pitching+defence (pBABIP, Control, Stamina,
starter share) and runs SCORED per game beyond model offence (Speed, Baserunning, Stealing, Avoid K, Power, Eye). 5-fold by event."""
import json,os,math,random,collections
D=os.environ.get("MV2_DIR","/tmp/mv2"); T=[t for t in json.load(open(f"{D}/teams.json")) if t["kind"]=="tour"]
by=collections.defaultdict(list)
for t in T: t["rg"]=t["R"]/t["G"]; t["rag"]=t["RA"]/t["G"]; by[t["unit"]].append(t)
TR=sorted({k for t in T for k in t["tr"]})
for L in by.values():
    for k in ("rg","rag","off","def","pit"):
        m=sum(t[k] for t in L)/len(L)
        for t in L: t[k+"c"]=t[k]-m
    for k in TR:
        v=[t["tr"][k] for t in L if k in t["tr"]]; m=sum(v)/len(v) if v else 0
        for t in L: t.setdefault("z",{})[k]=t["tr"].get(k,m)-m
sd={k:math.sqrt(sum(t["z"][k]**2 for t in T)/len(T)) or 1 for k in TR}
def solve(X,y,w):
    p=len(X[0]); M=[[0.0]*(p+1) for _ in range(p)]
    for xi,yi,wi in zip(X,y,w):
        for j in range(p):
            M[j][p]+=wi*xi[j]*yi
            for k in range(p): M[j][k]+=wi*xi[j]*xi[k]
    for j in range(p): M[j][j]+=1e-9
    for c in range(p):
        q=max(range(c,p),key=lambda r:abs(M[r][c])); M[c],M[q]=M[q],M[c]
        for r in range(p):
            if r!=c and M[c][c]: f=M[r][c]/M[c][c]; M[r]=[a-f*b for a,b in zip(M[r],M[c])]
    return [M[i][p]/M[i][i] for i in range(p)]
def corr(x,y,w):
    sw=sum(w); mx=sum(a*c for a,c in zip(x,w))/sw; my=sum(a*c for a,c in zip(y,w))/sw
    return sum(c*(a-mx)*(b-my) for a,b,c in zip(x,y,w))/math.sqrt(sum(c*(a-mx)**2 for a,c in zip(x,w))*sum(c*(b-my)**2 for b,c in zip(y,w)))
units=sorted(by); random.Random(5).shuffle(units); folds=[set(units[i::5]) for i in range(5)]
def cv(target,base,extra):
    fx=lambda t:[t[b] for b in base]+[t["z"][k]/sd[k] for k in extra]
    pred={};coefs=[]
    for f in folds:
        tr=[t for t in T if t["unit"] not in f]; te=[t for t in T if t["unit"] in f]
        b=solve([fx(t) for t in tr],[t[target] for t in tr],[t["G"] for t in tr]); coefs.append(b)
        for t in te: pred[id(t)]=sum(bi*xi for bi,xi in zip(b,fx(t)))
    c=corr([pred[id(t)] for t in T],[t[target] for t in T],[t["G"] for t in T])
    avg=[sum(b[i] for b in coefs)/5 for i in range(len(coefs[0]))]; lo=[min(b[i] for b in coefs) for i in range(len(coefs[0]))]; hi=[max(b[i] for b in coefs) for i in range(len(coefs[0]))]
    return c,avg,lo,hi
print(f"{len(T)} tournament team-events, {len(by)} events")
print("\n=== RUNS ALLOWED per game (lower = better; a negative trait coef means the trait prevents runs beyond the model)")
c0,*_=cv("ragc",["pitc","defc"],[]); print(f"  model pitching + defence only: held-out corr {c0:.3f}")
for ex in (["arm pBABIP"],["arm Stamina"],["starter BF share"],["arm Control"],["arm pBABIP","arm Stamina","starter BF share","arm Control"]):
    c,avg,lo,hi=cv("ragc",["pitc","defc"],ex)
    print(f"  + {', '.join(ex):45} held-out corr {c:.3f}  coefs per sd: "+", ".join(f"{k} {a:+.3f} [{l:+.3f},{h:+.3f}]" for k,a,l,h in zip(ex,avg[2:],lo[2:],hi[2:])))
print("\n=== RUNS SCORED per game")
c0,*_=cv("rgc",["offc"],[]); print(f"  model offence only: held-out corr {c0:.3f}")
for ex in (["bat Speed"],["bat Baserunning"],["bat Stealing"],["bat Avoid Ks"],["bat Power"],["bat Eye"],["bat Speed","bat Baserunning","bat Stealing"],["bat Speed","bat Baserunning","bat Avoid Ks","bat Power"]):
    c,avg,lo,hi=cv("rgc",["offc"],ex)
    print(f"  + {', '.join(ex):45} held-out corr {c:.3f}  coefs per sd: "+", ".join(f"{k} {a:+.3f} [{l:+.3f},{h:+.3f}]" for k,a,l,h in zip(ex,avg[1:],lo[1:],hi[1:])))
print("\n  trait sd (rating points):", {k:round(sd[k],1) for k in ("bat Speed","bat Baserunning","bat Stealing","bat Avoid Ks","bat Power","arm pBABIP","arm Stamina")})
