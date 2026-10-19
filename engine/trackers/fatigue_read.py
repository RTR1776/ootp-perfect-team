import csv,glob,re
def load(d='.'):
    rows=[]
    for f in sorted(glob.glob(d+'/*.csv')):
        m=re.search(r'([a-z0-9]+)_pitchingfati\w*?_day(\d+)_(\d+)_',f)
        for r in csv.DictReader(open(f,encoding='utf-8-sig')):
            r['series']=m.group(1);r['day']=int(m.group(2));r['yr']=int(m.group(3))
            r['h']=[int(r[k] or 0) for k in ['5d','4d','3d','2d','Yest.']]  # index 0 = 5 days ago, 4 = yesterday
            r['sp']=int(r['SPF%'].rstrip('%')); r['rp']=int(r['RPF%'].rstrip('%')); r['stm']=int(r['STM'] or 0)
            rows.append(r)
    return rows


if __name__ == "__main__":
    # Start/relief readiness by pitches x days since a single outing.
    import collections, statistics as st, sys
    rows = load(sys.argv[1] if len(sys.argv) > 1 else "Tourney Data/pitching fatigue data/pitching fatigue (1)")
    one = [r for r in rows if r["POS"] in ("SP", "RP", "CL") and sum(1 for x in r["h"] if x > 0) == 1]
    t = collections.defaultdict(list)
    for r in one:
        i = next(j for j, x in enumerate(r["h"]) if x > 0)
        t[(min(r["h"][i] // 15 * 15, 135), 5 - i)].append((r["sp"], r["rp"]))
    print("pitches   start/relief readiness, 1..5 days since")
    for b in range(0, 150, 15):
        print(f"{b:3}-{b + 14:<4}", "  ".join(f"{st.mean(x[0] for x in t[(b, a)]):3.0f}/{st.mean(x[1] for x in t[(b, a)]):3.0f}" if t[(b, a)] else "   -   " for a in range(1, 6)))
