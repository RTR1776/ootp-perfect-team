"""
Per card (cid) per board: observed league runs/700 vs the league model's in-sample prediction,
pooled over every league line (same y and features as league-fit.py). Read by league-lineup-blend.mts.

    python3 scripts/league-resid.py ../Archive/.league-panel.csv ../Archive/.league-resid.json src/data/league-model.json
"""
import json, sys, numpy as np, pandas as pd
SRC = sys.argv[1]; OUT = sys.argv[2]; MODEL = json.load(open(sys.argv[3]))
W = dict(BB=0.69, HB=0.72, b1=0.888, b2=1.271, b3=1.616, HR=2.101); R = ["K","BA","GAP","POW","EYE"]
d = pd.read_csv(SRC)
h = d[d.isP == 0].rename(columns={"1B_1":"b1","2B_1":"b2","3B_1":"b3"}).copy()
h["uBB"] = h.BB - h.IBB
den = h.AB + h.uBB + h.SF + h.HP
h["woba"] = (W["BB"]*h.uBB + W["HB"]*h.HP + W["b1"]*h.b1 + W["b2"]*h.b2 + W["b3"]*h.b3 + W["HR"]*h.HR) / den.where(den > 0)
h["grp"] = h.week + "|" + h.league + "|" + h.split
for r in R:
    h[r] = np.where(h.split == "vL", h[r+"_vL"], h[r+"_vR"]); h["l"+r] = np.log(h[r].where(h[r] > 0)/50.0)
live = h[(h.PA > 0) & h.woba.notna()]
g = live.groupby("grp")
lg = (W["BB"]*g.uBB.sum()+W["HB"]*g.HP.sum()+W["b1"]*g.b1.sum()+W["b2"]*g.b2.sum()+W["b3"]*g.b3.sum()+W["HR"]*g.HR.sum())/(g.AB.sum()+g.uBB.sum()+g.SF.sum()+g.HP.sum())
h["y"] = (h.woba - h.grp.map(lg))/1.25*700
for c in ["m_cal"]+["l"+r for r in R]:
    ok = live[live[c].notna()]
    m = ok.groupby("grp").apply(lambda x: np.sum(x[c]*x.PA)/np.sum(x.PA), include_groups=False)
    h["d_"+c] = h[c] - h.grp.map(m)
h = h[(h.PA > 0) & h.woba.notna() & h.d_m_cal.notna()].copy()
for r in R: h = h[h["d_l"+r].notna()]
co = MODEL["coef"]
h["pred"] = co["intercept"] + co["app"]*h.d_m_cal + sum(co[r]*h["d_l"+r]*h["scale_"+r] for r in R)
h["fam"] = np.where(h.league == "PEL", "PEL", h.league.str[:2])
out = {}
for (cid, sp), x in h.groupby(["cid","split"]):
    pa = float(x.PA.sum())
    e = {"pa": pa, "obs": float(np.sum(x.y*x.PA)/pa), "pred": float(np.sum(x.pred*x.PA)/pa)}
    xp = x[x.fam == "PEL"]
    if len(xp): e["pelPa"] = float(xp.PA.sum()); e["pelResid"] = float(np.sum((xp.y-xp.pred)*xp.PA)/xp.PA.sum())
    xc = x[x.week == x.week.max()]
    out[f"{int(cid)}|{sp}"] = e
json.dump(out, open(OUT, "w"))
print(len(out), "card-boards")
