"""Check 1: does observed play track the park's hand offset the model cancels? (archive card level)"""
import json,os,collections,math
D=os.environ.get("REV_DIR","/tmp/ptcs7rev"); A=json.load(open(f"{D}/arch.json")); TL=json.load(open(f"{D}/tilt.json"))
LHP=0.3
B=[x for x in A if not x["p"] and x["pa"]>=50 and x["woba"] is not None and x["s"] in TL and x.get("bats") in ("L","R","S")]
for x in B:
    t=TL[x["s"]]; x["off"]= t["L"] if x["bats"]=="L" else t["R"] if x["bats"]=="R" else (1-LHP)*t["L"]+LHP*t["R"]
    x["mod"]=(1-LHP)*x["R"]+LHP*x["L"]
by=collections.defaultdict(list)
for x in B: by[x["s"]].append(x)
for s,S in by.items():
    sw=sum(x["pa"] for x in S); mw=sum(x["woba"]*x["pa"] for x in S)/sw; mm=sum(x["mod"]*x["pa"] for x in S)/sw; mo=sum(x["off"]*x["pa"] for x in S)/sw
    for x in S: x["obs"]=(x["woba"]-mw)/1.25*700; x["mc"]=x["mod"]-mm; x["oc"]=x["off"]-mo
def fit(S):
    # obs ~ a*mc + b*oc (both centred)
    w=[x["pa"] for x in S]; X=[(x["mc"],x["oc"]) for x in S]; y=[x["obs"] for x in S]
    s11=sum(wi*a*a for wi,(a,b) in zip(w,X)); s12=sum(wi*a*b for wi,(a,b) in zip(w,X)); s22=sum(wi*b*b for wi,(a,b) in zip(w,X))
    t1=sum(wi*a*yi for wi,(a,b),yi in zip(w,X,y)); t2=sum(wi*b*yi for wi,(a,b),yi in zip(w,X,y)); det=s11*s22-s12*s12
    return ((s22*t1-s12*t2)/det,(s11*t2-s12*t1)/det)
def corr(x,y,w):
    sw=sum(w); mx=sum(a*c for a,c in zip(x,w))/sw; my=sum(a*c for a,c in zip(y,w))/sw
    return sum(c*(a-mx)*(b-my) for a,b,c in zip(x,y,w))/math.sqrt(sum(c*(a-mx)**2 for a,c in zip(x,w))*sum(c*(b-my)**2 for b,c in zip(y,w)))
a,b=fit(B); print(f"all {len(B)} bat lines, {len(by)} series: model coef {a:.2f}, park-hand offset coef {b:.2f}  (1.0 = the offset is fully real and fully missing)")
ser=sorted(by); random_halves=[set(ser[0::2]),set(ser[1::2])]
for i,h in enumerate(random_halves):
    S=[x for x in B if x["s"] in h]; T=[x for x in B if x["s"] not in h]; a,b=fit(S)
    r0=corr([x["mc"] for x in T],[x["obs"] for x in T],[x["pa"] for x in T]); r1=corr([x["mc"]+b*x["oc"] for x in T],[x["obs"] for x in T],[x["pa"] for x in T])
    print(f"  fold {i}: offset coef {b:.2f} (fit half) -> held-out corr {r0:.4f} without vs {r1:.4f} with")
# strong-tilt series only
S=[x for x in B if abs(TL[x["s"]]["L"]-TL[x["s"]]["R"])>=8]; a,b=fit(S); print(f"series with a big tilt (|L-R| >= 8): n={len(S)}, offset coef {b:.2f}")
S=[x for x in B if x["champ"]]; a,b=fit(S); print(f"PTCS 7 Championship: n={len(S)}, offset coef {b:.2f}")
