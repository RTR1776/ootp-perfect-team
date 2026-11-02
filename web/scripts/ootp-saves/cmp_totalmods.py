import csv,sys
G="/Users/ljmac/Library/Application Support/Steam/steamapps/common/Out of the Park Baseball 27/data/database/"
def load(p,skiphdr):
    d={}
    with open(p,encoding='utf-8-sig') as f:
        r=list(csv.reader(f))
    if skiphdr: r=r[1:]
    for row in r:
        if not row or not row[0].strip().isdigit(): continue
        d[int(row[0])]=row[1:]
    return d
tm=load("/Users/ljmac/Desktop/OOTP Perfect Team/Data/OOTP game files/totalmods.csv",True)
a=load(G+"total_modifiers.txt",False); b=load(G+"total_modifiers_neutralized.txt",False)
def cmp(x,y,name):
    yrs=sorted(set(x)&set(y)); exact=0; maxd=0; ncell=0
    for yr in yrs:
        for i,(u,v) in enumerate(zip(x[yr],y[yr])):
            try: u=float(u); v=float(v)
            except: continue
            ncell+=1; d=abs(u-v); maxd=max(maxd,d); exact+= d<1e-9
    print(name,"years",len(yrs),min(yrs),max(yrs),"cells",ncell,"exact",exact,"maxdiff",maxd)
cmp(tm,a,"totalmods vs total_modifiers")
cmp(tm,b,"totalmods vs neutralized")
print(sorted(tm)[:3],sorted(tm)[-3:],sorted(a)[:3],sorted(a)[-3:],sorted(b)[-3:])
print("len cols",len(tm[2024]),len(a[2024]),len(b.get(2024,[])))
print("2010 total",a[2010][:12]); print("2010 neut",b[2010][:12])
