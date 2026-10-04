#!/bin/bash
# Prepare cwhit Upload — double-click after Push to GitHub.command has pulled.
#
# Builds "Tourney Data/DCFC READY TO UPLOAD 2026-10-04/": every export of ours
# that cwhit's sheet (DCFCStats App Data Entry, 10-04) lists as Missing,
# renamed to the filename his sheet expects. The list is
# "Tourney Data/DCFC Upload 2026-10-04.tsv" (54 files).
#
# Each file is found in Archive/ (or the DCFC Upload Queue), matched by its
# sha256 to the copy that was filed, and checked before it is copied:
#   - 200 columns, the same header as every other file in the batch
#   - every row has a CID and a team (ORG)
#   - at least 20 teams (a 1-2 team export is the truncated-run tell)
#   - for Dead Silver Walking: no card newer than 1919
# Anything that fails goes in the report, not the folder. Originals are
# never moved or changed. Safe to run twice. Delete this file after.

cd "$(dirname "$0")" || exit 1
/usr/bin/python3 - <<'PY'
import csv, hashlib, os, shutil, collections
ROOT = os.getcwd()
MAN = os.path.join(ROOT, "Tourney Data/DCFC Upload 2026-10-04.tsv")
OUT = os.path.join(ROOT, "Tourney Data/DCFC READY TO UPLOAD 2026-10-04")
SEARCH = [os.path.join(ROOT, "Archive"), os.path.join(ROOT, "Tourney Data/DCFC Upload Queue")]
rows = [l.rstrip("\n").split("\t") for l in open(MAN) if l.strip() and not l.startswith("#")]
where = collections.defaultdict(list)
for base in SEARCH:
    for d, _, fs in os.walk(base):
        for f in fs:
            if f.endswith(".csv"): where[f].append(os.path.join(d, f))
sha = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()
os.makedirs(OUT, exist_ok=True)
ok, bad, header0 = [], [], None
for src, dst, name, date, want, maxyear, note in rows:
    hits = [p for p in where.get(src, []) if sha(p) == want]
    if not hits:
        bad.append((src, dst, "not found in Archive/ with the sha256 it was filed under" if not where.get(src) else "found, but no copy matches the filed sha256"))
        continue
    p = hits[0]
    with open(p, newline="", encoding="utf-8-sig") as fh:
        r = csv.reader(fh); header = next(r); body = list(r)
    why = []
    if len(header) != 200: why.append(f"{len(header)} columns, not 200")
    if header0 is None and len(header) == 200: header0 = header
    elif header0 is not None and header != header0: why.append("header differs from the rest of the batch")
    ix = {h: i for i, h in enumerate(header)}
    if "CID" not in ix or "ORG" not in ix:
        why.append("no CID or ORG column")
    else:
        if any(len(x) <= max(ix["CID"], ix["ORG"]) or not x[ix["CID"]].strip() or not x[ix["ORG"]].strip() for x in body): why.append("a row with no CID or team")
        teams = len({x[ix["ORG"]] for x in body if len(x) > ix["ORG"]})
        if teams < 20: why.append(f"only {teams} teams")
    if maxyear and "CYear" in ix:
        yrs = [int(x[ix["CYear"]]) for x in body if len(x) > ix["CYear"] and x[ix["CYear"]].isdigit()]
        if yrs and max(yrs) > int(maxyear): why.append(f"has a {max(yrs)} card; this event is {maxyear} or earlier")
    if why:
        bad.append((src, dst, "; ".join(why))); continue
    shutil.copy2(p, os.path.join(OUT, dst))
    ok.append((src, dst, len(body), teams))
rep = [f"cwhit upload, built {__import__('datetime').date.today()}: {len(ok)} ready, {len(bad)} held back.", "",
       "READY (drag the whole folder to cwhit's uploader):"]
rep += [f"  {d:34} <- {s:38} {n:6} rows {t:4} teams" for s, d, n, t in ok]
if bad:
    rep += ["", "HELD BACK (not in the folder):"] + [f"  {d:34} <- {s:38} {w}" for s, d, w in bad]
open(os.path.join(OUT, "_report.txt"), "w").write("\n".join(rep) + "\n")
print("\n".join(rep))
PY
echo; read -r -p "Press return to close."
