# Step 1: card ids and field handedness per bracket, from the six Championship exports.
# Run from the repo root: REV_DIR=/tmp/ptcs7rev python3 web/scripts/ptcs7champ-review/cids.py
# Then: cd web && REV_DIR=/tmp/ptcs7rev node --import tsx scripts/ptcs7champ-review/model.mts
# Then: REV_DIR=/tmp/ptcs7rev python3 web/scripts/ptcs7champ-review/review.py (and teams.py)
import csv,json,os
D=os.environ.get('REV_DIR','/tmp/ptcs7rev'); os.makedirs(D,exist_ok=True)
B=["bronze","silver","gold","diamond","open","cap"]
out={}
for b in B:
    rows=list(csv.DictReader(open(f"Tourney Data/PTCS7 Championship/{b}_all.csv",encoding='utf-8-sig')))
    f=lambda r,k: float(r[k]) if r.get(k) not in (None,'','-') else 0.0
    bfL=sum(f(r,"BF") for r in rows if r["T"]=="L"); bf=sum(f(r,"BF") for r in rows)
    paL=sum(f(r,"PA") for r in rows if r["B"]=="L"); paS=sum(f(r,"PA") for r in rows if r["B"]=="S"); pa=sum(f(r,"PA") for r in rows)
    out[b]={"cids":sorted({int(r["CID"]) for r in rows if r["CID"]}), "lhpShare":bfL/bf, "lhbShare":(paL+0.5*paS)/pa}
json.dump(out,open(f"{D}/cids.json","w"))
