"""eras.json with years <= 1948 replaced by OOTP 27's own era_stats.txt (same rate definitions as build-env-data.mjs)."""
import json,csv,os,sys
G=os.path.expanduser('~/Library/Application Support/Steam/steamapps/common/Out of the Park Baseball 27/data/database/era_stats.txt')
src,out,last=sys.argv[1],sys.argv[2],int(sys.argv[3]) if len(sys.argv)>3 else 1948
e=json.load(open(src))
rows={int(r['﻿YEAR']):r for r in csv.DictReader(open(G,encoding='utf-8'))}
n=0
for y,r in rows.items():
    if y>last: continue
    f=lambda k: float(r[k])
    AB,H,B2,B3,HR,BB,HBP,K,SH=[f(k) for k in ['AB','Hits','Doubles','Triples','Homeruns','BB','HBP','K','SAC']]
    PA=AB+BB+HBP+SH; k,bb,hbp=K/PA,BB/PA,HBP/PA; bip=1-k-bb-hbp-SH/PA; hr=HR/PA/bip
    old=e.get(str(y),{})
    e[str(y)]={"rates":{"K":k,"BB":bb,"HBP":hbp,"HR":hr,"B2":B2/PA/bip,"B3":B3/PA/bip,"BABIP":(H-HR)/PA/(bip*(1-hr))},
               "rg":f('Runs Per Game'),"src":"OOTP era_stats","preset":old.get("preset")}
    n+=1
json.dump(e,open(out,'w'),separators=(',',':'))
print(n,"years replaced;",len(e),"total")
