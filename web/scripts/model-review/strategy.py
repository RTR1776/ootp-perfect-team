"""Steal and pitch-count study over the archived tournament exports (2026-10-27).
  python3 -I strategy.py ARCHIVE_DIR strategy-env.json totalmods.csv"""
import csv, json, os, sys, collections, numpy as np
D, ENV, MODS = sys.argv[1], json.load(open(sys.argv[2]))["exports"], sys.argv[3]
mr = list(csv.reader(open(MODS))); mh = mr[0]
mods = {int(r[0]): r for r in mr[1:] if r and r[0].isdigit()}
mod = lambda y, c: float(mods[min(max(y, 1871), 2024)][mh.index(c)])
def band(y): return "<=1945" if y < 1946 else "1946-76" if y < 1977 else "1977-93" if y < 1994 else "1994-09" if y < 2010 else "2010+"
BANDS = ["<=1945", "1946-76", "1977-93", "1994-09", "2010+"]
num = lambda v: float(v) if v not in ("", "-", None) else 0.0
def ip(v):  # 123.1 = 123 1/3
    x = num(v); w = int(x); return w + (x - w) * 10 / 3
st = collections.defaultdict(lambda: [0.0, 0.0, 0.0])          # (band, ste bucket) -> SB, CS, PA
be = collections.defaultdict(lambda: [0.0, 0.0])                # band -> sum(att*sbbe0), att
yr = collections.defaultdict(lambda: [0.0, 0.0, 0.0, 0.0])      # export year -> SB, CS, PA, sum STE*PA
pc = collections.defaultdict(list)                              # (band, stm bucket, team quartile) -> (pitches/GS, IP/GS)
STE_B = [(0, 40), (40, 60), (60, 80), (80, 100), (100, 999)]
STM_B = [(0, 70), (70, 90), (90, 110), (110, 999)]
bk = lambda x, B: next(f"{a}-{b - 1}" if b < 999 else f"{a}+" for a, b in B if a <= x < b)
for f, e in ENV.items():
    p = os.path.join(D, f)
    if not os.path.exists(p): continue
    rows = list(csv.reader(open(p, encoding="utf-8-sig"))); h = rows[0]
    ix = {k: h.index(k) for k in ["POS", "ORG", "STE", "STM", "PA", "SB", "CS", "G_1", "GS_1", "W", "L", "IP", "PI"] if k in h}
    if len(ix) < 13: continue
    y, b = e["year"], band(e["year"])
    teams = collections.defaultdict(lambda: [0, 0])
    for r in rows[1:]:
        if len(r) < len(h): continue
        if num(r[ix["GS_1"]]) > 0: t = teams[r[ix["ORG"]]]; t[0] += num(r[ix["W"]]); t[1] += num(r[ix["L"]])
    wp = {o: w / (w + l) for o, (w, l) in teams.items() if w + l >= 5}
    q = np.quantile(list(wp.values()), [0.25, 0.75]) if len(wp) >= 8 else None
    for r in rows[1:]:
        if len(r) < len(h): continue
        pa = num(r[ix["PA"]])
        if r[ix["POS"]] not in ("SP", "RP", "CL") and pa > 0:
            sb, cs, ste = num(r[ix["SB"]]), num(r[ix["CS"]]), num(r[ix["STE"]])
            s = st[(b, bk(ste, STE_B))]; s[0] += sb; s[1] += cs; s[2] += pa
            be[b][0] += (sb + cs) * e["sbbe0"]; be[b][1] += sb + cs
            v = yr[f]; v[0] += sb; v[1] += cs; v[2] += pa; v[3] += ste * pa
        gs, g = num(r[ix["GS_1"]]), num(r[ix["G_1"]])
        if gs >= 3 and gs >= 0.9 * g and num(r[ix["PI"]]) > 0 and q is not None and r[ix["ORG"]] in wp:
            tq = "top" if wp[r[ix["ORG"]]] >= q[1] else "bottom" if wp[r[ix["ORG"]]] <= q[0] else "mid"
            pc[(b, bk(num(r[ix["STM"]]), STM_B), tq)].append((num(r[ix["PI"]]) / gs, ip(r[ix["IP"]]) / gs, gs))
print("=== STEALS: success by runner Stealing rating, vs the era's break-even (0 out) ===")
for b in BANDS:
    if not be[b][1]: continue
    print(f"\n{b}: break-even {be[b][0] / be[b][1]:.1%}")
    for lo, hi in STE_B:
        k = (b, bk(lo, STE_B)); sb, cs, pa = st[k]
        if sb + cs >= 50: print(f"   STE {bk(lo, STE_B):7s}  attempts/600 PA {600 * (sb + cs) / pa:5.1f}  success {sb / (sb + cs):.1%}  (n {int(sb + cs)})")
print("\n=== totalmods check: do the game's SBA / SBSuccess modifiers move observed steals by year (rating held)? ===")
X, Ya, Ys, Wt = [], [], [], []
for f, (sb, cs, pa, stepa) in yr.items():
    if sb + cs < 30 or pa <= 0: continue
    y = ENV[f]["year"]; X.append([1, stepa / pa, mod(y, "SBA"), mod(y, "SBSuccess")]); Ya.append((sb + cs) / pa); Ys.append(sb / (sb + cs)); Wt.append(pa)
X, Ya, Ys, Wt = map(np.array, (X, Ya, Ys, Wt)); Wt = Wt / Wt.mean()
for name, Y in (("attempt rate", Ya), ("success", Ys)):
    sw = np.sqrt(Wt); c = np.linalg.lstsq(X * sw[:, None], Y * sw, rcond=None)[0]; res = Y - X @ c
    se = np.sqrt(np.diag(np.linalg.inv((X * Wt[:, None]).T @ X) * np.average(res ** 2, weights=Wt)))
    print(f"  {name:12s} on [STE, SBA mod, SBSuccess mod]: coefs {np.round(c[1:], 4)}  t {np.round(c[1:] / se[1:], 1)}  ({len(Y)} exports)")
print("\n=== PITCH COUNTS: pitches and innings per start, by era and starter stamina (top / bottom quarter teams) ===")
for b in BANDS:
    print(f"\n{b}:  SPStam modifier ~ {np.mean([mod(int(ENV[f]['year']), 'SPStam') for f in ENV if band(ENV[f]['year']) == b]):.2f}")
    for lo, hi in STM_B:
        line = f"   STM {bk(lo, STM_B):7s}"
        for tq in ("top", "bottom"):
            v = pc.get((b, bk(lo, STM_B), tq), [])
            if len(v) >= 20:
                w = np.array([x[2] for x in v]); line += f" | {tq}: {np.average([x[0] for x in v], weights=w):5.1f} P/GS {np.average([x[1] for x in v], weights=w):4.2f} IP/GS (n {len(v)})"
        print(line)
