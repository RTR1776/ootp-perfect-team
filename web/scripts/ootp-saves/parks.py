import re
"""Q3: park-factors.json / park-dimensions.json vs pt_ballparks.txt and era_ballparks.txt."""
import csv,json,collections,math
G="/Users/ljmac/Library/Application Support/Steam/steamapps/common/Out of the Park Baseball 27/data/database/"
W="/Users/ljmac/Desktop/OOTP Perfect Team/web/src/data/"
PF=json.load(open(W+"park-factors.json")); PD=json.load(open(W+"park-dimensions.json"))
pt=list(csv.DictReader(open(G+"pt_ballparks.txt",encoding="utf-8-sig")))
era=list(csv.DictReader(open(G+"era_ballparks.txt",encoding="utf-8-sig")))
print("pt_ballparks rows",len(pt),"distinct park names",len({r['park name'] for r in pt}),"pt_level counts",collections.Counter(r['pt_level'] for r in pt))
print("era_ballparks rows",len(era),"years",min(r['yearID'] for r in era),max(r['yearID'] for r in era))
pfrows=[(n,y,v) for n,d in PF.items() for y,v in d.items()]
print("park-factors.json: names",len(PF),"name+year rows",len(pfrows))
f=lambda x: float(x) if x not in ('',None) else float('nan')
match=0;mism=[];missing=[];
ptkey={(r['park name'].strip(),r['year']):r for r in pt}
for n,y,v in pfrows:
    r=ptkey.get((n,y))
    if not r: missing.append((n,y)); continue
    pairs=[("avgL","BA LH"),("avgR","BA RH"),("hrL","HR LH"),("hrR","HR RH"),("d2","2B Overall"),("d3","3B Overall")]
    dif=max(abs(v[a]-f(r[b])) for a,b in pairs)
    if dif<0.0015: match+=1
    else: mism.append((n,y,round(dif,3),{a:(v[a],round(f(r[b]),3)) for a,b in pairs if abs(v[a]-f(r[b]))>=0.0015}))
print("json rows found in pt_ballparks:",len(pfrows)-len(missing),"exact (<0.0015):",match,"mismatched:",len(mism),"not in pt_ballparks:",len(missing))
for m in mism[:8]: print("  MISMATCH",m)
print("  not in pt file (sample):",missing[:10])
jkeys={(n,y) for n,y,_ in pfrows}
notours=[(r['park name'],r['year'],r['pt_level']) for r in pt if (r['park name'].strip(),r['year']) not in jkeys]
print("pt_ballparks rows not in park-factors.json:",len(notours),notours[:15])
# 2B/3B by hand spread
sp2=[abs(f(r['2B LH'])-f(r['2B RH'])) for r in pt]; sp3=[abs(f(r['3B LH'])-f(r['3B RH'])) for r in pt]; spb=[abs(f(r['BA LH'])-f(r['BA RH'])) for r in pt]; sph=[abs(f(r['HR LH'])-f(r['HR RH'])) for r in pt]
q=lambda a: sorted(a)[int(.9*len(a))]
print(f"pt_ballparks |LH-RH| 90th pct: BA {q(spb):.3f} HR {q(sph):.3f} 2B {q(sp2):.3f} 3B {q(sp3):.3f}; max 2B {max(sp2):.3f} 3B {max(sp3):.3f}")
big=sorted(pt,key=lambda r:-abs(f(r['2B LH'])-f(r['2B RH'])))[:5]
for r in big: print("   2B by hand:",r['park name'],r['year'],"LH",r['2B LH'][:5],"RH",r['2B RH'][:5],"overall",r['2B Overall'][:5])
# Is 'Overall' the mean of LH/RH? And raw BA/HR columns vs overall?
d=[abs(f(r['HR Overall'])-f(r['HR'])) for r in pt if r['HR']]; print("HR Overall vs raw HR col max diff",round(max(d),3))
import difflib
norm=lambda s: re.sub(r'[^a-z]','',s.lower())
pn={(norm(r['park name']),r['year']):r for r in pt}
for n,y in missing:
    c=difflib.get_close_matches(norm(n),[k[0] for k in pn if k[1]==y],1,0.75)
    if c:
        r=pn[(c[0],y)]; v=PF[n][y]
        print('   spelling', n,y,'->',r['park name'],'maxdiff',round(max(abs(v[a]-f(r[b])) for a,b in [("avgL","BA LH"),("avgR","BA RH"),("hrL","HR LH"),("hrR","HR RH"),("d2","2B Overall"),("d3","3B Overall")]),4))
    else: print('   no pt match',n,y)
# dimensions
dm=0;dmis=[]
for n,dd in PD.items():
    for y,v in dd.items():
        r=ptkey.get((n,y))
        if not r: continue
        ours=(v['lf'],v['lcf'],v['cf'],v['rcf'],v['rf']); theirs=tuple(int(float(r[k])) for k in ('LFd','LCd','CFd','RCd','RFd'))
        if ours==theirs: dm+=1
        else: dmis.append((n,y,ours,theirs))
print("park-dimensions.json:",sum(len(x) for x in PD.values()),"rows; matched in pt file and equal:",dm,"differ:",len(dmis))
for x in dmis[:6]: print("   DIM",x)
print("pt rows with dimensions:",len(pt),"; park-dimensions.json covers",len(PD),"names")
# era_ballparks vs pt for historical parks with same name+year
ek={(r['park'].strip(),r['yearID']):r for r in era}
same=diff=0
for (n,y),r in ptkey.items():
    e=ek.get((n,y))
    if e:
        if abs(f(e['HR RH'])-f(r['HR RH']))<1e-3 and abs(f(e['BA LH'])-f(r['BA LH']))<1e-3: same+=1
        else: diff+=1
print("pt rows also in era_ballparks (name+year):",same+diff,"identical factors:",same,"different:",diff)
print("pt years:",sorted(collections.Counter(r['year'] for r in pt).items())[:60])
