"""Cap allocation vs results. Every variable is demeaned within its event file, so a
coefficient compares teams in the same field. Shares are fractions of the team's cap.

Usage: python3 -I analyze.py teams.json
"""
import json, sys, collections
import numpy as np

T = json.load(open(sys.argv[1]))
for t in T:
    t["era"] = "pre-1930" if t["re"] < 1930 else "1960s-70s" if t["re"] < 1985 else "modern 1990s+"
    span = max(t["hi"] - t["lo"], 1)
    t["ace_rel"] = (t["ace"] - t["lo"]) / span          # 0 = window floor, 1 = window top
    t["rp_rel"] = (t["avg_rp"] - t["lo"]) / span
    t["lin_rel"] = (t["avg_lineup"] - t["lo"]) / span
    t["sp_rel"] = (t["avg_sp"] - t["lo"]) / span

def demean(rows, keys):
    by = collections.defaultdict(list)
    for r in rows: by[(r["series"], r["run"])].append(r)
    out = []
    for g in by.values():
        if len(g) < 8: continue
        m = {k: np.mean([r[k] for r in g]) for k in keys}
        for r in g: out.append({k: r[k] - m[k] for k in keys})
    return out

def ols(rows, y, xs):
    keys = [y] + xs
    d = demean(rows, keys)
    Y = np.array([r[y] for r in d]); X = np.array([[r[x] for x in xs] for r in d])
    b, *_ = np.linalg.lstsq(X, Y, rcond=None)
    res = Y - X @ b; n, k = X.shape
    s2 = res @ res / (n - k); se = np.sqrt(np.diag(s2 * np.linalg.inv(X.T @ X)))
    return n, b, se

def show(title, rows, y, xs, scale=None):
    n, b, se = ols(rows, y, xs)
    parts = []
    for x, bi, si in zip(xs, b, se):
        f = (scale or {}).get(x, 1)
        flag = "**" if abs(bi / si) >= 2 else "  "
        parts.append(f"{x} {bi * f:+.3f} ±{si * f:.3f}{flag}")
    print(f"  {title:<34} n={n:<5} " + " | ".join(parts))

SH = {"sp": 0.1, "rp": 0.1, "bench": 0.1}  # per 10% of the cap moved out of the lineup
print("A. Moving 10% of the cap from the lineup into SP / RP / bench  (** = 2+ standard errors)")
for era in [None, "pre-1930", "1960s-70s", "modern 1990s+"]:
    rows = [t for t in T if era is None or t["era"] == era]
    lab = era or "ALL"
    show(f"{lab}: run diff per game", rows, "rdg", ["sp", "rp", "bench"], SH)
    show(f"{lab}: total wins", rows, "w", ["sp", "rp", "bench"], SH)

print("\nB. Shape of the roster at the same total (value spread, stars, basement), run diff per game")
for era in [None, "pre-1930", "1960s-70s", "modern 1990s+"]:
    rows = [t for t in T if era is None or t["era"] == era]
    show(f"{era or 'ALL'}: SD of card values (+5)", rows, "rdg", ["sd", "sp", "rp", "bench"], {"sd": 5, "sp": .1, "rp": .1, "bench": .1})
    show(f"{era or 'ALL'}: stars / basement (+10%)", rows, "rdg", ["stars", "basement", "sp", "rp", "bench"], {"stars": .1, "basement": .1, "sp": .1, "rp": .1, "bench": .1})

print("\nC. Where in the window each role's cards sit (0 = floor, 1 = top), +0.1 of the window, run diff per game")
for era in [None, "pre-1930", "1960s-70s", "modern 1990s+"]:
    rows = [t for t in T if era is None or t["era"] == era]
    show(f"{era or 'ALL'}", rows, "rdg", ["ace_rel", "sp_rel", "rp_rel", "lin_rel"], {k: .1 for k in ["ace_rel", "sp_rel", "rp_rel", "lin_rel"]})

print("\nD. Best quarter by wins vs the rest (within each event), average shares and placement")
by = collections.defaultdict(list)
for t in T: by[(t["series"], t["run"])].append(t)
best, rest = [], []
for g in by.values():
    g = sorted(g, key=lambda t: (t["w"], t["rdg"]), reverse=True); q = max(1, len(g) // 4)
    best += g[:q]; rest += g[q:]
def avg(rows, k): return np.mean([r[k] for r in rows])
for era in [None, "pre-1930", "1960s-70s", "modern 1990s+"]:
    B = [t for t in best if era is None or t["era"] == era]; R = [t for t in rest if era is None or t["era"] == era]
    print(f"  {era or 'ALL':<14} best n={len(B):<4} lineup {avg(B,'lineup'):.3f} bench {avg(B,'bench'):.3f} SP {avg(B,'sp'):.3f} RP {avg(B,'rp'):.3f} sd {avg(B,'sd'):.1f} ace {avg(B,'ace_rel'):.2f} rp_pos {avg(B,'rp_rel'):.2f} nSP {avg(B,'nsp'):.1f} nRP {avg(B,'nrp'):.1f}")
    print(f"  {'':<14} rest n={len(R):<4} lineup {avg(R,'lineup'):.3f} bench {avg(R,'bench'):.3f} SP {avg(R,'sp'):.3f} RP {avg(R,'rp'):.3f} sd {avg(R,'sd'):.1f} ace {avg(R,'ace_rel'):.2f} rp_pos {avg(R,'rp_rel'):.2f} nSP {avg(R,'nsp'):.1f} nRP {avg(R,'nrp'):.1f}")
print("\nfiles by era:", collections.Counter((t["era"]) for t in T))
