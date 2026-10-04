#!/bin/bash
# Make cwhit Upload Folder — double-click after Push to GitHub.command.
#
# Builds ONE folder, "UPLOAD TO CWHIT TODAY" (next to this file), holding every
# export of ours that cwhit's sheet still lists as Missing: renamed to his
# filenames, trimmed to his 200 columns, checked (web/scripts/cwhit_upload.py).
# Drag that folder to his uploader at app.cwhitstats.com/upload.
#
# His sheet: the newest "DCFCStats App Data Entry" .xlsx in Downloads, Desktop,
# this folder or Tourney Data. Download a fresh one from his site first for
# the most up-to-date list (the copy in Tourney Data is from 2026-10-04).
#
# It also clears out the old cwhit folders (DCFC Upload Queue, DCFC READY TO
# UPLOAD..., DCFC Rejected). Every file in them is a copy of one in
# Archive/Completed; any that isn't is moved into Archive/Completed first, so
# nothing is lost. Safe to run any time; it rebuilds the folder from scratch.

cd "$(dirname "$0")" || exit 1
/usr/bin/python3 - <<'PY'
import glob, hashlib, os, shutil, subprocess, sys
REPO = os.getcwd()
sys.path.insert(0, os.path.join(REPO, "web/scripts"))
import cwhit_upload as cu
ARCHIVE = os.path.join(REPO, "Archive/Completed")
OUT = os.path.join(REPO, cu.UPLOAD_DIR_NAME)
REPORT = os.path.join(REPO, "Archive/last-cwhit-upload-report.txt")
sha = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()

def scan():
    found = {}
    for d, _, fs in os.walk(ARCHIVE):
        for f in sorted(fs):
            if f.endswith(".csv"):
                found.setdefault(f, []).append(os.path.join(d, f))
    return found

# 1. Old cwhit folders: keep anything not already archived, then remove them.
archived = scan()
old = [os.path.join(REPO, "Tourney Data/DCFC Upload Queue"), os.path.join(REPO, "Tourney Data/DCFC Rejected")]
old += glob.glob(os.path.join(REPO, "Tourney Data/DCFC READY TO UPLOAD*"))
kept = []
for d in old:
    if not os.path.isdir(d):
        continue
    for root, _, fs in os.walk(d):
        for f in fs:
            p = os.path.join(root, f)
            if not f.endswith(".csv"):
                continue
            if any(sha(a) == sha(p) for a in archived.get(f, [])):
                continue
            dest = os.path.join(ARCHIVE, f) if f not in archived else os.path.join(REPO, "Archive/From old cwhit folders", f)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copy2(p, dest)
            kept.append(os.path.relpath(dest, REPO))
    shutil.rmtree(d)
    print("removed " + os.path.relpath(d, REPO))
if kept:
    print("kept %d file(s) that were only in those folders: %s" % (len(kept), ", ".join(kept)))

# 2. His sheet.
sheet = cu.find_sheet(REPO)
if not sheet:
    print("\nNo cwhit sheet found. Download 'DCFCStats App Data Entry' (.xlsx) from his site into Downloads and run this again.")
    sys.exit(0)
status = cu.read_sheet(sheet)
print("\ncwhit's sheet: %s (%d rows, %d missing)" % (sheet, len(status), sum(v == "Missing" for v in status.values())))

# 3. Rebuild the folder.
archived = scan()   # now including anything rescued above
if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)
ready, held = [], []
for name in sorted(archived):
    his = cu.his_name(name)
    if not his or status.get(his) != "Missing":
        continue
    ok, detail = cu.write_for_cwhit(archived[name][0], os.path.join(OUT, his))
    (ready if ok else held).append((his, name, detail))
lines = ["%d files to upload, in %s/" % (len(ready), cu.UPLOAD_DIR_NAME), ""]
lines += ["  %-34s <- %-38s %s" % r for r in ready]
if held:
    lines += ["", "Not included (he lists them as missing, but the file fails a check):"]
    lines += ["  %-34s <- %-38s %s" % r for r in held]
open(REPORT, "w").write("\n".join(lines) + "\n")
print("\n" + "\n".join(lines))
try:
    subprocess.run(["open", OUT])
except OSError:
    pass
PY
echo; read -r -p "Press return to close."
