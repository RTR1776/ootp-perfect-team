"""Fielding sub-ratings vs the position rating, stint level (2026-11-03, Docs/OF Range and Arm 2026-11-03.md).
Stints of 100+ fielding innings in Archive/Completed, centred within each export: runs per 1,400 innings
(0.887 x ZR + the export's ARM column) regressed on the position rating, on range + arm, and on every sub-rating.
Writes the per-point prices subrating-test.py reads.
  python3 -I scripts/model-review/subrating-prices.py ../Archive/Completed prices.json"""
import csv, os, sys, json, numpy as np
D = sys.argv[1]
SUB = {"LF": ["OF RNG","OF ARM","OF ERR"], "CF": ["OF RNG","OF ARM","OF ERR"], "RF": ["OF RNG","OF ARM","OF ERR"],
       "1B": ["IF RNG","IF ARM","IF ERR","TDP"], "2B": ["IF RNG","IF ARM","IF ERR","TDP"], "3B": ["IF RNG","IF ARM","IF ERR","TDP"], "SS": ["IF RNG","IF ARM","IF ERR","TDP"]}
data = {p: [] for p in SUB}
for f in sorted(os.listdir(D)):
    if not f.endswith(".csv"): continue
    try: rows = list(csv.DictReader(open(os.path.join(D, f), encoding="utf-8", errors="replace")))
    except Exception: continue
    if not rows or "ZR" not in rows[0] or "IP_1" not in rows[0] or "OF RNG" not in rows[0] or "ARM" not in rows[0]: continue
    for r in rows:
        p = (r.get("POS") or "").strip()
        if p not in SUB: continue
        try:
            ip = float(r["IP_1"]); zr = float(r["ZR"]); arm = float(r["ARM"] or 0); pr = float(r[p]); subs = [float(r[k]) for k in SUB[p]]
        except Exception: continue
        if ip < 100: continue
        data[p].append((f, ip, (0.887 * zr + arm) / ip * 1400, pr, *subs))
out = {}
for p in SUB:
    a = data[p]; f = np.array([x[0] for x in a]); w = np.array([x[1] for x in a]); M = np.array([x[2:] for x in a])
    C = M.copy()
    for u in np.unique(f):
        s = f == u; C[s] -= np.average(M[s], axis=0, weights=w[s])
    y, pr, subs = C[:, 0], C[:, 1], C[:, 2:]
    def fit(cols):
        X = np.column_stack(cols); sw = np.sqrt(w); b = np.linalg.lstsq(X * sw[:, None], y * sw, rcond=None)[0]
        res = y - X @ b; return b, 1 - np.sum(w * res**2) / np.sum(w * y**2)
    bp, rp = fit([pr]); bs2, rs2 = fit([subs[:, 0], subs[:, 1]]); bs, rs = fit([subs[:, k] for k in range(subs.shape[1])])
    # half-split stability
    print(f"{p:2} n={len(a)}  pos {bp[0]:.4f} R2 {rp:.4f} | rng+arm {bs2.round(4)} R2 {rs2:.4f} | all subs {SUB[p]} {bs.round(4)} R2 {rs:.4f}")
    out[p] = {"pos": float(bp[0]), "rng": float(bs2[0]), "arm": float(bs2[1]), "all": [float(x) for x in bs]}
json.dump(out, open(sys.argv[2], "w"), indent=1)
