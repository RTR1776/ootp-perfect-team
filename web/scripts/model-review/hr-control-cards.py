"""Card-level held-out test (2026-10-29): does a Control hinge on HR per BIP beat the pHR curve alone?
  python3 -I scripts/model-review/hr-control-cards.py /tmp/hrcards.json   (from hr-control-export.mts)
expected HR_i = BIP_i * seriesRate * m_i e^{k x_i} / mean_s(m e^{k x}),  x = max(0, Con - H)/10.
k fitted by Poisson deviance on half the series, scored on the other half. 40 half-samples."""
import json, sys, numpy as np
D = json.load(open(sys.argv[1]))
s = np.array([d["s"] for d in D]); y = np.array([d["y"] for d in D]); bip = np.array([d["bip"] for d in D], float)
hr = np.array([d["hr"] for d in D], float); con = np.array([d["con"] for d in D], float); m = np.array([d["m"] for d in D], float); stu = np.array([d["stu"] for d in D], float)
ser = np.unique(s); si = {u: i for i, u in enumerate(ser)}; g = np.array([si[x] for x in s])
tot = np.bincount(g, weights=bip * 0 + np.array([d["bf"] for d in D])); keep = tot[g] > 20000
def band(v): return np.where(v <= 1920, "deadball", np.where(v <= 1945, "1921-45", np.where(v <= 1976, "1946-76", np.where(v <= 1993, "1977-93", np.where(v <= 2009, "1994-09", "2010+")))))
B = band(y)
def dev(k, x, mask):
    f = m * np.exp(k * x)
    num = np.bincount(g[mask], weights=hr[mask], minlength=len(ser)); den = np.bincount(g[mask], weights=(bip * f)[mask], minlength=len(ser))
    rate = np.where(den > 0, num / np.maximum(den, 1e-9), 0)  # series-level rate fitted per series (normalisation)
    mu = bip * f * rate[g]
    o, e = hr[mask], np.maximum(mu[mask], 1e-9)
    return 2 * np.sum(np.where(o > 0, o * np.log(np.maximum(o, 1e-9) / e), 0) - (o - e))
KS = np.linspace(-0.1, 0.3, 81)
def test(H, mask, label, xfn=None):
    x = np.maximum(0, con - H) / 10 if xfn is None else xfn
    m0 = mask & keep; U = np.unique(g[m0]); gains, ks, wins = [], [], 0
    for seed in range(20):
        rng = np.random.default_rng(seed); half = set(rng.choice(U, len(U) // 2, replace=False)); h = np.isin(g, list(half))
        for tr, te in ((h & m0, ~h & m0), (~h & m0, h & m0)):
            k = KS[np.argmin([dev(k, x, tr) for k in KS])]; ks.append(k)
            d = dev(0, x, te) - dev(k, x, te); gains.append(d); wins += d > 0
    n = (m0 & (x > 0)).sum()
    print(f"{label:10} H={H:<4} k {np.median(ks):+.3f} (HR/BIP x{np.exp(np.median(ks)):.3f} per +10 over H)  held-out deviance gain {np.mean(gains):+7.1f}  better {wins}/40   arms over H: {n}")
for H in (120, 140, 160): test(H, np.ones(len(D), bool), "ALL")
for b in ("deadball", "1921-45", "1946-76", "1977-93", "1994-09", "2010+"): test(140, B == b, b)
# control: same hinge but only for low Stuff
test(140, np.ones(len(D), bool), "Stu<80 only", np.where(stu < 80, np.maximum(0, con - 140) / 10, 0))
