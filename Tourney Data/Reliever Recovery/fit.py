import csv, numpy as np
from scipy.optimize import minimize
rows=[r for r in csv.DictReader(open('data.csv'))]
S=np.array([float(r['stm']) for r in rows]); P=np.array([float(r['pc']) for r in rows]); R=np.array([float(r['rpp']) for r in rows]); N=[r['name'] for r in rows]
use = np.array([n not in ('Eddie Gamboa',) for n in N])
def loss(pred):
    pred=np.clip(pred,0,100)
    return np.sqrt((((R-pred)[use])**2).mean())
models = {
 "c - a*pc": (lambda t: t[0]-t[1]*P, [100,1.8]),
 "c - a*pc - b*max(0,pc-T)": (lambda t: t[0]-t[1]*P-t[2]*np.maximum(0,P-t[3]), [100,1.5,1,30]),
 "c - a*pc - b*max(0,pc-T)*(50/stm)": (lambda t: t[0]-t[1]*P-t[2]*np.maximum(0,P-t[3])*50/S, [100,1.5,0.5,30]),
 "c - a*pc - b*max(0,pc-T)*(1-stm/100)": (lambda t: t[0]-t[1]*P-t[2]*np.maximum(0,P-t[3])*(1-S/100), [100,1.5,1,30]),
 "c - a*pc*(1+b*(50-stm)/50)": (lambda t: t[0]-t[1]*P*(1+t[2]*(50-S)/50), [100,1.8,0]),
 "c - a*pc^k": (lambda t: t[0]-t[1]*P**t[2], [100,1.8,1]),
}
best={}
for k,(f,t0) in models.items():
    r=min((minimize(lambda t: loss(f(t)), np.array(t0)*s, method="Nelder-Mead", options={"maxiter":40000,"xatol":1e-6,"fatol":1e-8}) for s in (0.8,1,1.2)), key=lambda r:r.fun)
    best[k]=(r.x,f); print(f"{k:40s} rmse {r.fun:.2f}  {np.round(r.x,3)}")
# leave-one-out-ish: halves
k="c - a*pc - b*max(0,pc-T)*(50/stm)"
t,f=best[k]; pred=np.clip(f(t),0,100)
print("\nby pitch-count band (obs mean / pred mean / n):")
for lo,hi in [(0,10),(10,20),(20,30),(30,40),(40,50),(50,130)]:
    i=(P>=lo)&(P<hi)&use
    print(f"  {lo:3d}-{hi:<3d} {R[i].mean():5.1f} {pred[i].mean():5.1f} {i.sum()}")
print("\nlow vs high stamina at pc>=40:")
for i in np.argsort(P):
    if P[i]>=40: print(f"  {N[i]:20s} stm {S[i]:3.0f} pc {P[i]:4.0f} rpp {R[i]:3.0f} pred {pred[i]:5.1f}")
print("\nworst misses:")
for i in np.argsort(-np.abs(R-pred))[:8]: print(f"  {N[i]:20s} stm {S[i]:3.0f} pc {P[i]:4.0f} rpp {R[i]:3.0f} pred {pred[i]:5.1f}")
c,a,b,T=t
print("\ntable (pred RPP%):  PC ->", [10,15,20,25,30,35,40,45,50])
for s in [10,20,30,45,65,80]:
    print(f"  stm {s:3d}:", [int(round(max(0,min(100,c-a*p-b*max(0,p-T)*50/s)))) for p in [10,15,20,25,30,35,40,45,50]])
# split-half stability
rng=np.random.default_rng(1); fm=best[k][1]; f0=best["c - a*pc"][1]
for h in range(3):
    idx=rng.permutation(len(P)); A=np.zeros(len(P),bool); A[idx[:len(P)//2]]=True
    def L(t,mask,g=None): pr=np.clip((g or fm)(t),0,100); return np.sqrt((((R-pr)[mask&use])**2).mean())
    r=minimize(lambda t: L(t,A), best[k][0], method="Nelder-Mead", options={"maxiter":20000})
    r0=minimize(lambda t: L(t,A,f0), best["c - a*pc"][0], method="Nelder-Mead") 
    print(f"half {h}: params {np.round(r.x,2)}  held-out rmse {L(r.x,~A):.2f} (pitch-count-only {L(r0.x,~A,f0):.2f})")
