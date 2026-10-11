"""MODEL v2, end to end: original model (equal weights) vs new model (fixes + team weights), same teams.
python3 compare.py OLD_DIR NEW_DIR"""
import json,math,sys,collections
sys.path.insert(0,"")
def band(y): return "<=1945" if y<1946 else "1946-76" if y<1977 else "1977-93" if y<1994 else "1994-09" if y<2010 else "2010+"
W={"<=1945":(2,2),"1946-76":(3,2.5),"1977-93":(3,2),"1994-09":(1.5,1.5),"2010+":(3,2.5)}
def load(d):
    T=json.load(open(f"{d}/teams.json")); T=[t for t in T if not t["unit"].endswith("@2026-06-28")]
    c=collections.Counter(t["unit"] for t in T); T=[t for t in T if c[t["unit"]]>=10]
    return {(t["unit"],t["org"]):t for t in T}
O=load(sys.argv[1]); N=load(sys.argv[2]); keys=[k for k in O if k in N]
def corr(x,y,w):
    sw=sum(w); mx=sum(a*c for a,c in zip(x,w))/sw; my=sum(a*c for a,c in zip(y,w))/sw
    sxy=sum(c*(a-mx)*(b-my) for a,b,c in zip(x,y,w)); return sxy/math.sqrt(sum(c*(a-mx)**2 for a,c in zip(x,w))*sum(c*(b-my)**2 for b,c in zip(y,w)))
rows=[]
for k in keys:
    o,n=O[k],N[k]; d,p=W[band(n["year"])]
    rows.append(dict(unit=k[0],org=k[1],kind=n["kind"],band=band(n["year"]),G=n["G"],rd=(n["R"]-n["RA"])/n["G"],old=o["off"]+o["def"]+o["pit"],new=n["off"]+d*n["def"]+p*n["pit"],mid=n["off"]+n["def"]+n["pit"]))
by=collections.defaultdict(list)
for r in rows: by[r["unit"]].append(r)
for L in by.values():
    for k in ("rd","old","new","mid"):
        m=sum(r[k] for r in L)/len(L)
        for r in L: r[k+"c"]=r[k]-m
def rep(lab,S):
    w=[r["G"] for r in S]; y=[r["rdc"] for r in S]
    print(f"  {lab:24} n={len(S):5d}  original {corr([r['oldc'] for r in S],y,w):.3f}   fixes only {corr([r['midc'] for r in S],y,w):.3f}   fixes + team weights {corr([r['newc'] for r in S],y,w):.3f}")
print("corr(model team strength, run differential per game), within each event")
rep("ALL",rows); rep("league seasons",[r for r in rows if r["kind"]=="league"]); rep("tournaments",[r for r in rows if r["kind"]=="tour"])
for b in ["1946-76","1977-93","1994-09","2010+"]:
    S=[r for r in rows if r["band"]==b]
    if S: rep(f"era {b}",S)
rep("PTCS7 Championship",[r for r in rows if r["unit"].startswith("ptcs7champ")])
print("\nPTCS7 Championship: rank on paper within bracket (1 = best), original -> new; G = games played")
for u in sorted({r["unit"] for r in rows if r["unit"].startswith("ptcs7champ")}):
    L=by[u]; ro={r["org"]:i+1 for i,r in enumerate(sorted(L,key=lambda r:-r["old"]))}; rn={r["org"]:i+1 for i,r in enumerate(sorted(L,key=lambda r:-r["new"]))}
    deep=sorted(L,key=lambda r:-r["G"])[:4]
    s=f"  {u[10:]:8} 4 deepest: "+", ".join(f"#{ro[r['org']]}->#{rn[r['org']]}" for r in deep)
    for tag,key in (("us","Torrent"),("Liam","Etna"),("cwhit","Castroville")):
        m=[r for r in L if key in r["org"]]
        if m: s+=f" | {tag} #{ro[m[0]['org']]}->#{rn[m[0]['org']]} ({int(m[0]['G'])}G)"
    print(s)
