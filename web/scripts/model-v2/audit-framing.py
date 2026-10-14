import csv, sys, glob, numpy as np
files = glob.glob(sys.argv[1] + "/Cap Exports/*.csv") + [f for f in glob.glob(sys.argv[1] + "/PTCS7 Championship/*_all.csv")]
f = lambda r,k: float(r.get(k) or 0)
X, Y, W, ARM, ABI, SBA, ZR = [], [], [], [], [], [], []
for fn in files:
    for r in csv.DictReader(open(fn, encoding="utf-8-sig")):
        if r.get("POS") != "C" or f(r,"IP_1") < 50: continue
        ip = f(r,"IP_1")
        X.append(f(r,"C FRM")); ABI.append(f(r,"C ABI")); ARM.append(f(r,"C ARM")); Y.append(f(r,"FRM")/ip*1300); W.append(ip)
        SBA.append((f(r,"SBA")-f(r,"RTO"))/ip*1300); ZR.append(f(r,"ZR")/ip*1300)
X, Y, W, ARM, ABI, SBA, ZR = map(np.array, (X, Y, W, ARM, ABI, SBA, ZR))
print(f"{len(files)} tournament exports, {len(X)} catcher-stints with 50+ innings, {W.sum():,.0f} innings")
def fit(x, y, label):
    A = np.column_stack([np.ones_like(x), x]); sw = np.sqrt(W); b = np.linalg.lstsq(A*sw[:,None], y*sw, rcond=None)[0]
    r = np.corrcoef(x, y)[0,1]; print(f"  {label:44s} {10*b[1]:+.2f} runs per +10, full season (1,300 inn) · r {r:.2f}")
fit(X, Y, "framing runs (FRM) vs framing rating")
fit(ABI, Y, "framing runs vs catcher ability")
fit(ARM, ZR, "catcher ZR (arm/blocking) vs catcher arm")
fit(ABI, ZR, "catcher ZR vs catcher ability")
print(f"  framing runs spread, 10th-90th pct: {np.percentile(Y,10):+.1f} to {np.percentile(Y,90):+.1f} a season; ZR spread {np.percentile(ZR,10):+.1f} to {np.percentile(ZR,90):+.1f}")
