"""MODEL v2, step 3: team-level weights by run environment, cross-validated.
REV: MV2_DIR/teams.json from teams.mts.   python3 scripts/model-v2/fit.py"""
import json,math,os,random,collections
D=os.environ.get("MV2_DIR","/tmp/mv2")
T=json.load(open(f"{D}/teams.json"))
# clean: duplicate 06-28 copy of the 07-06 file; units with too few teams
T=[t for t in T if not t["unit"].endswith("@2026-06-28")]
cnt=collections.Counter(t["unit"] for t in T); T=[t for t in T if cnt[t["unit"]]>=10]
def band(y): return "<=1945" if y<1946 else "1946-76" if y<1977 else "1977-93" if y<1994 else "1994-09" if y<2010 else "2010+"
TR=sorted({k for t in T for k in t["tr"]})
by=collections.defaultdict(list)
for t in T: t["rd"]=(t["R"]-t["RA"])/t["G"]; t["band"]=band(t["year"]); by[t["unit"]].append(t)
for u,L in by.items():   # centre within each event / league-season
    for k in ["rd","off","def","pit","zr","wraa"]:
        m=sum(t[k] for t in L)/len(L)
        for t in L: t[k+"c"]=t[k]-m
    for k in TR:
        vals=[t["tr"].get(k) for t in L if t["tr"].get(k) is not None]; m=sum(vals)/len(vals) if vals else 0
        for t in L: t.setdefault("trc",{})[k]=(t["tr"].get(k,m)-m)
# standardise traits across the whole set (so coefficients are per 1 sd)
sdtr={k:math.sqrt(sum(t["trc"][k]**2 for t in T)/len(T)) or 1 for k in TR}
def solve(X,y,w,ridge=0.0):
    p=len(X[0]); A=[[0.0]*p for _ in range(p)]; b=[0.0]*p
    for xi,yi,wi in zip(X,y,w):
        for j in range(p):
            b[j]+=wi*xi[j]*yi
            for k in range(p): A[j][k]+=wi*xi[j]*xi[k]
    for j in range(p): A[j][j]+=ridge
    M=[A[i]+[b[i]] for i in range(p)]
    for c in range(p):
        q=max(range(c,p),key=lambda r:abs(M[r][c])); M[c],M[q]=M[q],M[c]
        for r in range(p):
            if r!=c and M[c][c]: f=M[r][c]/M[c][c]; M[r]=[a-f*bb for a,bb in zip(M[r],M[c])]
    return [M[i][p]/M[i][i] if M[i][i] else 0 for i in range(p)]
def corr(x,y,w):
    sw=sum(w); mx=sum(a*c for a,c in zip(x,w))/sw; my=sum(a*c for a,c in zip(y,w))/sw
    sxy=sum(c*(a-mx)*(b-my) for a,b,c in zip(x,y,w)); sxx=sum(c*(a-mx)**2 for a,c in zip(x,w)); syy=sum(c*(b-my)**2 for b,c in zip(y,w))
    return sxy/math.sqrt(sxx*syy) if sxx>0 and syy>0 else float('nan')
FEATS={"sum":lambda t:[t["offc"]+t["defc"]+t["pitc"]],
       "3w":lambda t:[t["offc"],t["defc"],t["pitc"]]}
def feats_tr(keys): return lambda t:[t["offc"],t["defc"],t["pitc"]]+[t["trc"][k]/sdtr[k] for k in keys]
def evaluate(train,test,fx,ridge=0.0):
    b=solve([fx(t) for t in train],[t["rdc"] for t in train],[t["G"] for t in train],ridge)
    pred=[sum(bi*xi for bi,xi in zip(b,fx(t))) for t in test]
    return corr(pred,[t["rdc"] for t in test],[t["G"] for t in test]), b
league=[t for t in T if t["kind"]=="league"]; tour=[t for t in T if t["kind"]=="tour"]
print(f"rows: league {len(league)} (mean G {sum(t['G'] for t in league)/len(league):.0f}), tournament {len(tour)} (mean G {sum(t['G'] for t in tour)/len(tour):.1f})")
print("bands:", dict(collections.Counter((t['kind'],t['band']) for t in T)))
print("\n=== in-sample weights by band (offence, defence, pitching) — 1.0 = model's runs are real runs")
for kind,S in (("league",league),("tour",tour)):
    for bnd in ["<=1945","1946-76","1977-93","1994-09","2010+"]:
        L=[t for t in S if t["band"]==bnd]
        if len(L)<60: continue
        b=solve([FEATS["3w"](t) for t in L],[t["rdc"] for t in L],[t["G"] for t in L])
        r0=corr([t["offc"]+t["defc"]+t["pitc"] for t in L],[t["rdc"] for t in L],[t["G"] for t in L])
        r1=corr([sum(bi*xi for bi,xi in zip(b,FEATS["3w"](t))) for t in L],[t["rdc"] for t in L],[t["G"] for t in L])
        print(f"  {kind:6} {bnd:8} n={len(L):5d}  off {b[0]:.2f}  def {b[1]:.2f}  pit {b[2]:.2f}   corr equal {r0:.3f} -> fitted {r1:.3f}")
print("\n=== cross-validation (held-out corr with run differential per game)")
def cv(name,fx,ridge=0.0,bandwise=False):
    res=[]
    for tr,te,lab in ((league,tour,"league->tour"),(tour,league,"tour->league")):
        if bandwise:
            preds=[];ys=[];ws=[]
            for bnd in {t["band"] for t in te}:
                trb=[t for t in tr if t["band"]==bnd] or tr; teb=[t for t in te if t["band"]==bnd]
                b=solve([fx(t) for t in trb],[t["rdc"] for t in trb],[t["G"] for t in trb],ridge)
                preds+=[sum(bi*xi for bi,xi in zip(b,fx(t))) for t in teb]; ys+=[t["rdc"] for t in teb]; ws+=[t["G"] for t in teb]
            res.append((lab,corr(preds,ys,ws)))
        else: res.append((lab,evaluate(tr,te,fx,ridge)[0]))
    # 5-fold by unit
    units=sorted(by); random.Random(7).shuffle(units); folds=[set(units[i::5]) for i in range(5)]
    preds=[];ys=[];ws=[]
    for f in folds:
        tr=[t for t in T if t["unit"] not in f]; te=[t for t in T if t["unit"] in f]
        if bandwise:
            for bnd in {t["band"] for t in te}:
                trb=[t for t in tr if t["band"]==bnd] or tr; teb=[t for t in te if t["band"]==bnd]
                b=solve([fx(t) for t in trb],[t["rdc"] for t in trb],[t["G"] for t in trb],ridge)
                preds+=[sum(bi*xi for bi,xi in zip(b,fx(t))) for t in teb]; ys+=[t["rdc"] for t in teb]; ws+=[t["G"] for t in teb]
        else:
            b=solve([fx(t) for t in tr],[t["rdc"] for t in tr],[t["G"] for t in tr],ridge)
            preds+=[sum(bi*xi for bi,xi in zip(b,fx(t))) for t in te]; ys+=[t["rdc"] for t in te]; ws+=[t["G"] for t in te]
    res.append(("5-fold by event",corr(preds,ys,ws)))
    print(f"  {name:34} "+"  ".join(f"{l} {c:.3f}" for l,c in res))
cv("current model (equal weights)",FEATS["sum"])
cv("3 weights, pooled",FEATS["3w"])
cv("3 weights, by era band",FEATS["3w"],bandwise=True)
cv("3 weights + all traits, pooled",feats_tr(TR),ridge=50)
cv("3 weights + all traits, by band",feats_tr(TR),ridge=50,bandwise=True)
b=solve([feats_tr(TR)(t) for t in T],[t["rdc"] for t in T],[t["G"] for t in T],50)
print("\n=== pooled fit, all rows (runs/G per 1 sd of trait, beyond the three components)")
print(f"  off {b[0]:.2f} def {b[1]:.2f} pit {b[2]:.2f}")
for k,bi in sorted(zip(TR,b[3:]),key=lambda x:-abs(x[1])): print(f"  {k:20} {bi:+.3f}")
json.dump({"bands":{}},open(f"{D}/fit-placeholder.json","w"))

print("\n=== weights to use (league + tournament together), as ratios to offence")
out={}
for bnd in ["ALL","1946-76","1977-93","1994-09","2010+"]:
    L=T if bnd=="ALL" else [t for t in T if t["band"]==bnd]
    b=solve([FEATS["3w"](t) for t in L],[t["rdc"] for t in L],[t["G"] for t in L])
    # bootstrap by unit for spread of the ratios
    units=sorted({t["unit"] for t in L}); rng=random.Random(11); rd=[];rp=[]
    for _ in range(200):
        pick=[rng.choice(units) for _ in units]; S=[t for u in pick for t in by[u] if t in L or bnd=="ALL"]
        bb=solve([FEATS["3w"](t) for t in S],[t["rdc"] for t in S],[t["G"] for t in S]); rd.append(bb[1]/bb[0]); rp.append(bb[2]/bb[0])
    rd.sort(); rp.sort()
    print(f"  {bnd:8} n={len(L):5d}  off {b[0]:.2f} def {b[1]:.2f} pit {b[2]:.2f}  | def/off {b[1]/b[0]:.2f} (90% {rd[10]:.2f}-{rd[189]:.2f})  pit/off {b[2]/b[0]:.2f} (90% {rp[10]:.2f}-{rp[189]:.2f})")
    out[bnd]={"off":b[0],"def":b[1],"pit":b[2]}
json.dump(out,open(f"{D}/weights.json","w"),indent=1)

print("\n=== confounding check")
for kind,S in (("league",league),("tour",tour),("all",T)):
    w=[t["G"] for t in S]
    b4=solve([[t["offc"],t["defc"],t["pitc"],t["zrc"]] for t in S],[t["rdc"] for t in S],w)
    bz=solve([[t["zrc"]] for t in S],[t["defc"] for t in S],w)
    print(f"  {kind:6} with observed ZR/G added: off {b4[0]:.2f} def {b4[1]:.2f} pit {b4[2]:.2f} ZR {b4[3]:.2f}   corr(model def, model pit) {corr([t['defc'] for t in S],[t['pitc'] for t in S],w):+.2f}  corr(model def, model off) {corr([t['defc'] for t in S],[t['offc'] for t in S],w):+.2f}  corr(model def, obs ZR) {corr([t['defc'] for t in S],[t['zrc'] for t in S],w):+.2f}")
    sd=lambda k: math.sqrt(sum(t['G']*t[k]**2 for t in S)/sum(w))
    print(f"         spread across teams (runs/G): off {sd('offc'):.3f} def {sd('defc'):.3f} pit {sd('pitc'):.3f} obsZR {sd('zrc'):.3f} RD {sd('rdc'):.3f}")

print("\n=== grid: corr(off + d*def + p*pit, run diff/G) — no fitting, so every cell is 'out of sample'")
P=[1,1.5,2,2.5,3,3.5,4,5]; Dd=[1,1.5,2,3,4,5,6]
def score(S,d,p): return corr([t["offc"]+d*t["defc"]+p*t["pitc"] for t in S],[t["rdc"] for t in S],[t["G"] for t in S])
groups={"league":league,"tour":tour}
for bnd in ["1946-76","1977-93","1994-09","2010+"]:
    for kind,S in (("league",league),("tour",tour)):
        L=[t for t in S if t["band"]==bnd]
        if len(L)>=100: groups[f"{kind} {bnd}"]=L
best={}
for g,S in groups.items():
    grid={(d,p):score(S,d,p) for d in Dd for p in P}
    (bd,bp),bv=max(grid.items(),key=lambda x:x[1]); base=grid[(1,1)]
    best[g]=(bd,bp)
    print(f"  {g:16} n={len(S):5d}  equal {base:.3f}  best d={bd} p={bp} -> {bv:.3f}   at d=3,p=2.5: {score(S,3,2.5):.3f}  d=2,p=2: {score(S,2,2):.3f}  d=4,p=3: {score(S,4,3):.3f}")
