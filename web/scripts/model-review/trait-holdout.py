"""Do the trait residuals hold out? (2026-10-25 model review)

Production score plus a correction term coef x (team rating - export mean), the coef learned on
half the exports, scored on the other half; 40 half-samples; overall and per era band.
  python3 -I scripts/model-review/trait-holdout.py [MV2_DIR]
"""
import json, os, sys, numpy as np
D_ = sys.argv[1] if len(sys.argv) > 1 else "/tmp/mv2"
POS = ["C","1B","2B","3B","SS","LF","CF","RF"]
SLOPE = {"C":.0362,"1B":.1407,"2B":.1744,"3B":.1501,"SS":.1562,"LF":.0895,"CF":.0643,"RF":.0973}
CAL = {"C":1.61,"1B":0.77,"2B":1.83,"3B":0.86,"SS":2.1,"LF":2.22,"CF":3.38,"RF":1.41}
T = [t for t in json.load(open(f"{D_}/teams.json")) if t["kind"] == "tour" and t["W"] + t["L"] > 0]
def band(y): return "<=1945" if y < 1946 else "1946-76" if y < 1977 else "1977-93" if y < 1994 else "1994-09" if y < 2010 else "2010+"
units = sorted({t["unit"] for t in T}); ui = {u: i for i, u in enumerate(units)}
g = np.array([ui[t["unit"]] for t in T]); w = np.array([t["W"] + t["L"] for t in T], float); bands = np.array([band(t["year"]) for t in T])
dp = lambda t, p: (t.get("dpos") or {}).get(p, {}).get("lin", 0.0)
score = np.array([t["off"] + 2 * sum(SLOPE[p] * .887 * CAL[p] * dp(t, p) for p in POS) + t.get("frm", 0) + 1.5 * t["pitSP"] + 2 * t["pitRP"] for t in T])
y = np.array([t["W"] / (t["W"] + t["L"]) for t in T])
def tr(k): return np.array([t["tr"].get(k, np.nan) for t in T], float)
def centre(v, m):
    v = v.astype(float).copy(); out = np.zeros_like(v)
    for u in np.unique(g[m]):
        s = (g == u) & m; out[s] = v[s] - np.average(v[s], weights=w[s])
    return out
def r(s, a, m):
    ww = w[m]; s, a = s[m], a[m]; sm, am = np.average(s, weights=ww), np.average(a, weights=ww)
    return np.sum(ww * (s - sm) * (a - am)) / np.sqrt(np.sum(ww * (s - sm) ** 2) * np.sum(ww * (a - am) ** 2))
def test(key, mask, label):
    x = tr(key); m = mask & ~np.isnan(x)
    sc, yc, xc = centre(score, m), centre(y, m), centre(np.nan_to_num(x), m)
    U = np.unique(g[m]); base, new, coefs = [], [], []
    for seed in range(20):
        rng = np.random.default_rng(seed); half = set(rng.choice(U, len(U) // 2, replace=False)); h = np.array([q in half for q in g])
        for tr_, te in ((h & m, ~h & m), (~h & m, h & m)):
            # learn the correction on the score's own scale: regress win% on [score, x], keep x's coef / score's coef
            X = np.column_stack([sc[tr_], xc[tr_]]); sw = np.sqrt(w[tr_]); b = np.linalg.lstsq(X * sw[:, None], yc[tr_] * sw, rcond=None)[0]
            k = b[1] / b[0]; coefs.append(k)
            base.append(r(sc, yc, te)); new.append(r(sc + k * xc, yc, te))
    base, new = np.array(base), np.array(new)
    print(f"   {label:9} {key:16} runs/game per rating pt {np.median(coefs):+.4f}  held out {new.mean() - base.mean():+.5f}  better in {np.sum(new > base)}/40")
for key in ("arm pHR", "bat Stealing", "bat Power", "bat Avoid Ks", "arm pBABIP", "bat Eye", "arm Stamina"):
    test(key, np.ones(len(T), bool), "ALL")
for b, keys in (("1994-09", ("arm pHR", "bat Power", "bat Avoid Ks")), ("1977-93", ("bat Stealing", "arm pBABIP")), ("<=1945", ("arm Stamina", "bat Avoid Ks"))):
    for k in keys: test(k, bands == b, b)
