#!/usr/bin/env python3
"""
Split one full "all stats" tournament export into the two upload files.

    python3 split_export.py 1510027                 # newest export in OOTP's online_data
    python3 split_export.py 1510027 path/to/export.csv

The argument is the event id from Your Tournaments - "Thursday Splendid Silver
Only Spectacular (1510027)" - which is <3-digit tournament><4-digit run>.

Writes:
  Tourney Data/AllStats Upload Queue/1510027.csv
      the full export, untouched, under the TTTSSSS name the all-stats site wants
  Tourney Data/DCFC Upload Queue/silverweekly_27.csv   (and a copy in Archive/Completed)
      cwhit's 200 columns in his order, under his <series>_<run> name

The series name comes from web/scripts/slot-map.json, the same map
File OOTP Exports.command uses, so names always agree. Nothing is written if
any of cwhit's columns is missing from the export (wrong view exported), if
the tournament number is not in the map, or if either file already exists.
"""
import csv, glob, json, os, shutil, sys

HOME = os.path.expanduser("~")
REPO = os.path.join(HOME, "Desktop/OOTP Perfect Team")
ONLINE = os.path.join(HOME, "Application Support/Out of the Park Developments/OOTP Baseball 27/online_data")
SLOT_MAP = os.path.join(REPO, "web/scripts/slot-map.json")
ALL_QUEUE = os.path.join(REPO, "Tourney Data/AllStats Upload Queue")
CWHIT_QUEUE = os.path.join(REPO, "Tourney Data/DCFC Upload Queue")
ARCHIVE = os.path.join(REPO, "Archive/Completed")

# cwhit's view, in his order (read off a cwhit_view export, 2026-09-24).
CWHIT_COLUMNS = [
    'POS', 'Name', 'First Name', 'Last Name', 'ORG', 'HT', 'WT', 'B', 'T', 'VAL', 'CTM', 'CFR',
    'CYear', 'CEra', 'ST', 'CID', 'Tier', 'Title', 'L10', 'VAR', 'VLvl', 'BABIP', 'GAP', 'POW',
    'EYE', "K's", 'BA vL', 'GAP vL', 'POW vL', 'EYE vL', 'K vL', 'BA vR', 'GAP vR', 'POW vR',
    'EYE vR', 'K vR', 'BUN', 'BFH', 'BBT', 'GBT', 'FBT', 'STU', 'CON', 'PBABIP', 'HRA',
    'STU vL', 'CON vL', 'PBABIP vL', 'HRA vL', 'STU vR', 'CON vR', 'PBABIP vR', 'HRA vR', 'FB',
    'CH', 'CB', 'SL', 'SI', 'SP', 'CT', 'FO', 'CC', 'SC', 'KC', 'KN', 'PIT', 'G/F', 'VELO',
    'Slot', 'PT', 'STM', 'HLD', 'C ABI', 'C FRM', 'C ARM', 'IF RNG', 'IF ERR', 'IF ARM', 'TDP',
    'OF RNG', 'OF ERR', 'OF ARM', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'P Pot',
    'C Pot', '1B Pot', '2B Pot', '3B Pot', 'SS Pot', 'LF Pot', 'CF Pot', 'RF Pot', 'SPE', 'SR',
    'STE', 'RUN', 'G', 'GS', 'PA', 'AB', 'H', '1B_1', '2B_1', '3B_1', 'HR', 'RBI', 'R', 'BB',
    'IBB', 'HP', 'SH', 'SF', 'CI', 'K', 'GIDP', 'RC', 'WPA', 'wRC', 'wRAA', 'WAR', 'PI/PA',
    'SB', 'CS', 'wSB', 'UBR', 'G_1', 'GS_1', 'W', 'L', 'HLD_1', 'SD', 'MD', 'IP', 'BF', 'AB_1',
    '1B_2', '2B_2', '3B_2', 'HR_1', 'R_1', 'ER', 'BB_1', 'IBB_1', 'K_1', 'HP_1', 'SH_1', 'SF_1',
    'WP', 'BK', 'CI_1', 'DP', 'GF', 'IR', 'IRS', 'pLi', 'PI', 'GB', 'FB_1', 'SB_1', 'CS_1',
    'WPA_1', 'WAR_1', 'rWAR', 'SIERA', 'G_2', 'GS_2', 'TC', 'A', 'PO', 'E', 'DP_1', 'TP', 'RNG',
    'ZR', 'EFF', 'SBA', 'RTO', 'IP_1', 'PB', 'CER', 'BIZ-R', 'BIZ-Rm', 'BIZ-L', 'BIZ-Lm',
    'BIZ-E', 'BIZ-Em', 'BIZ-U', 'BIZ-Um', 'BIZ-Z', 'BIZ-Zm', 'FRM', 'ARM',
]


def fail(msg):
    print("NOT WRITTEN - " + msg)
    sys.exit(1)


def newest_export():
    files = glob.glob(os.path.join(ONLINE, "statistics_player_statistics*.csv"))
    if not files:
        fail("no statistics_player_statistics*.csv in " + ONLINE + " - pass the file path instead")
    return max(files, key=os.path.getmtime)


def main():
    if len(sys.argv) < 2 or not sys.argv[1].isdigit() or len(sys.argv[1]) != 7:
        fail("give the 7-digit event id from Your Tournaments, e.g. 1510027")
    event = sys.argv[1]
    slot, run = int(event[:3]), int(event[3:])
    src = sys.argv[2] if len(sys.argv) > 2 else newest_export()

    with open(SLOT_MAP, encoding="utf-8") as f:
        slots = {int(k): v for k, v in json.load(f).items() if not k.startswith("_")}
    slug = slots.get(slot)
    if not slug:
        fail("tournament %d is not in slot-map.json - add it (pnpm picker:sync) before filing" % slot)

    with open(src, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    if len(rows) < 2:
        fail(src + " has no data rows")
    head = [h.strip() for h in rows[0]]
    at = {}
    for i, h in enumerate(head):
        at.setdefault(h, i)
    missing = [c for c in CWHIT_COLUMNS if c not in at]
    if missing:
        fail("%d of cwhit's columns are not in this export (%s%s). Export the full all-stats view."
             % (len(missing), ", ".join(missing[:8]), " ..." if len(missing) > 8 else ""))
    if "ORG" in at and len({r[at["ORG"]] for r in rows[1:] if len(r) > at["ORG"]}) < 8:
        fail("fewer than 8 teams in this export - looks like a partial field, not a finished tournament")

    all_out = os.path.join(ALL_QUEUE, event + ".csv")
    cw_name = "%s_%d.csv" % (slug, run)
    cw_out = os.path.join(CWHIT_QUEUE, cw_name)
    ar_out = os.path.join(ARCHIVE, cw_name)
    for p in (all_out, cw_out):
        if os.path.exists(p):
            fail(p + " already exists - this run was filed before")

    for d in (ALL_QUEUE, CWHIT_QUEUE, ARCHIVE):
        os.makedirs(d, exist_ok=True)
    shutil.copyfile(src, all_out)
    idx = [at[c] for c in CWHIT_COLUMNS]
    with open(cw_out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(CWHIT_COLUMNS)
        for r in rows[1:]:
            if not any(x.strip() for x in r):
                continue
            w.writerow([r[i] if i < len(r) else "" for i in idx])
    if not os.path.exists(ar_out):
        shutil.copyfile(cw_out, ar_out)

    print("event %s  ->  %s (tournament %d, run %d)" % (event, slug, slot, run))
    print("  all-stats site: " + all_out + "  (%d columns, %d rows)" % (len(head), len(rows) - 1))
    print("  cwhit:          " + cw_out + "  (200 columns)")
    print("  archive copy:   " + ar_out)


if __name__ == "__main__":
    main()
