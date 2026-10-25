"""
Defense study, 2026-10-25 (Docs/Defense Study 2026-10-25.md).
Run from this folder:
  python3 -I load.py "../../../Archive/Completed"   # writes data.pkl (gitignore it; ~0.9M fielder lines)
  python3 -I curve.py   # glove runs by rating vs the field, per position
  python3 -I team.py    # team runs allowed on glove ratings and on ZR
  python3 -I oop.py     # out-of-position and balls-in-play checks
  python3 -I table.py   # cost table (bins pasted from curve.py, team fit from team.py)
"""
import csv, glob, pickle, sys
D = sys.argv[1]
POS = ["C","1B","2B","3B","SS","LF","CF","RF"]
def num(x):
    try: return float(x)
    except: return None
out = {"fld": [], "pit": [], "files": 0}
for fi, f in enumerate(sorted(glob.glob(D + "/*.csv"))):
    try:
        with open(f, newline="", encoding="utf-8", errors="replace") as fh: rows = list(csv.DictReader(fh))
    except Exception: continue
    if not rows or "ZR" not in rows[0] or "IP_1" not in rows[0]: continue
    out["files"] += 1
    slug = f.split("/")[-1].rsplit("_", 1)[0]
    for r in rows:
        p = r["POS"].strip(); org = r.get("ORG", "")
        if p in POS:
            g = {k: num(r.get(k)) for k in ["ZR","FRM","ARM","DP_1","E","IP_1","PA","wRAA","BABIP","POW","EYE","K's","GAP","SPE","VAL"] + POS}
            g.update(pos=p, file=fi, slug=slug, org=org, name=r["Name"], var=r.get("VAR"))
            out["fld"].append(g)
        elif p in ("SP","RP","CL"):
            g = {k: num(r.get(k)) for k in ["IP","BF","R_1","ER","HR_1","BB_1","HP_1","K_1","SF_1","PBABIP","STU","CON","HRA","GB","FB_1"]}
            g.update(pos=p, file=fi, slug=slug, org=org)
            out["pit"].append(g)
pickle.dump(out, open("data.pkl", "wb"))
print(out["files"], len(out["fld"]), len(out["pit"]))
