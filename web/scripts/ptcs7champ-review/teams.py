import json
import os; D=os.environ.get('REV_DIR','/tmp/ptcs7rev')
R=json.load(open(f"{D}/rev.json")); T=R["teams"]
def pct(S,k,v): return 100*sum(1 for t in S if t[k]<v)/len(S)
print("bracket team                         G   RD/G | model pctile off/def/pit | obs wRAA/G ZR/G")
for b in ["bronze","silver","gold","diamond","open","cap"]:
    S=[t for t in T if t["b"]==b]
    deep=[t for t in S if t["G"]>=30]
    for t in sorted(S,key=lambda t:-t["G"]):
        if "Torrent" in t["org"] or "Etna" in t["org"] or "Castroville" in t["org"]:
            print(f"{b:7} {t['org'][:28]:28} {int(t['G']):3d} {t['rd']:+.2f} | {pct(S,'moff_g',t['moff_g']):3.0f} {pct(S,'mdef_g',t['mdef_g']):3.0f} {pct(S,'mpit_g',t['mpit_g']):3.0f} | {t['wRAA_g']:+.2f} {t['ZR_g']:+.2f}")
    if deep:
        import statistics as st
        print(f"{b:7} {'deep teams (30+ G) median':28}     | {st.median(pct(S,'moff_g',t['moff_g']) for t in deep):3.0f} {st.median(pct(S,'mdef_g',t['mdef_g']) for t in deep):3.0f} {st.median(pct(S,'mpit_g',t['mpit_g']) for t in deep):3.0f} | {st.median(t['wRAA_g'] for t in deep):+.2f} {st.median(t['ZR_g'] for t in deep):+.2f}")
