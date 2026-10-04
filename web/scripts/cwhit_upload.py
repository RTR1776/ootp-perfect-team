"""
What cwhit (DCFC) still needs, and how to hand it to him. Used by
"File OOTP Exports.command" (as each export is filed) and
"Make cwhit Upload Folder.command" (the whole archive at once).

  - his sheet: the newest "DCFCStats App Data Entry" .xlsx (download it from
    his site; Downloads, Desktop, the repo and Tourney Data are searched).
    Only a row whose status is "Missing" is wanted. Read with the standard
    library, so no install is needed.
  - his filenames: <his slug>_<run>.csv. Most of our slugs are his; ALIASES
    holds the ones that differ (renames, and two weeklies whose numbering
    restarted on his side).
  - his columns: exactly CWHIT_COLUMNS, in his order (read off a cwhit-view
    export 2026-09-24). A wider export is trimmed to them; one missing any is
    refused.
  - refused too: a row with no CID or team, fewer than MIN_TEAMS teams (a
    cut-off run), or a card newer than an event's year limit.
"""
import csv, glob, os, re, zipfile
import xml.etree.ElementTree as ET

CWHIT_COLUMNS = ['POS', 'Name', 'First Name', 'Last Name', 'ORG', 'HT', 'WT', 'B', 'T', 'VAL', 'CTM', 'CFR', 'CYear', 'CEra', 'ST', 'CID', 'Tier', 'Title', 'L10', 'VAR', 'VLvl', 'BABIP', 'GAP', 'POW', 'EYE', "K's", 'BA vL', 'GAP vL', 'POW vL', 'EYE vL', 'K vL', 'BA vR', 'GAP vR', 'POW vR', 'EYE vR', 'K vR', 'BUN', 'BFH', 'BBT', 'GBT', 'FBT', 'STU', 'CON', 'PBABIP', 'HRA', 'STU vL', 'CON vL', 'PBABIP vL', 'HRA vL', 'STU vR', 'CON vR', 'PBABIP vR', 'HRA vR', 'FB', 'CH', 'CB', 'SL', 'SI', 'SP', 'CT', 'FO', 'CC', 'SC', 'KC', 'KN', 'PIT', 'G/F', 'VELO', 'Slot', 'PT', 'STM', 'HLD', 'C ABI', 'C FRM', 'C ARM', 'IF RNG', 'IF ERR', 'IF ARM', 'TDP', 'OF RNG', 'OF ERR', 'OF ARM', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'P Pot', 'C Pot', '1B Pot', '2B Pot', '3B Pot', 'SS Pot', 'LF Pot', 'CF Pot', 'RF Pot', 'SPE', 'SR', 'STE', 'RUN', 'G', 'GS', 'PA', 'AB', 'H', '1B_1', '2B_1', '3B_1', 'HR', 'RBI', 'R', 'BB', 'IBB', 'HP', 'SH', 'SF', 'CI', 'K', 'GIDP', 'RC', 'WPA', 'wRC', 'wRAA', 'WAR', 'PI/PA', 'SB', 'CS', 'wSB', 'UBR', 'G_1', 'GS_1', 'W', 'L', 'HLD_1', 'SD', 'MD', 'IP', 'BF', 'AB_1', '1B_2', '2B_2', '3B_2', 'HR_1', 'R_1', 'ER', 'BB_1', 'IBB_1', 'K_1', 'HP_1', 'SH_1', 'SF_1', 'WP', 'BK', 'CI_1', 'DP', 'GF', 'IR', 'IRS', 'pLi', 'PI', 'GB', 'FB_1', 'SB_1', 'CS_1', 'WPA_1', 'WAR_1', 'rWAR', 'SIERA', 'G_2', 'GS_2', 'TC', 'A', 'PO', 'E', 'DP_1', 'TP', 'RNG', 'ZR', 'EFF', 'SBA', 'RTO', 'IP_1', 'PB', 'CER', 'BIZ-R', 'BIZ-Rm', 'BIZ-L', 'BIZ-Lm', 'BIZ-E', 'BIZ-Em', 'BIZ-U', 'BIZ-Um', 'BIZ-Z', 'BIZ-Zm', 'FRM', 'ARM']
MIN_TEAMS = 20
UPLOAD_DIR_NAME = "UPLOAD TO CWHIT TODAY"

def _restart(new, first_run):
    return lambda run: (new, run - first_run)

# our slug -> his slug, or a function of the run giving (his slug, his run).
ALIASES = {
    "allstarhardwareslots": "ashhslots",
    "bronze10to50": "bronze10to59",
    "silverfriendsslots": "silverandfriends",
    "liveplus": "liveplusdaily",
    "diamondslotsdaily": lambda run: ("diamondjumbleslots" if run >= 181 else "diamondslotsdaily", run),
    "lowgoldonly": "lowgoldonlydaily",
    "silveronlycapdaily": "silveronlycap",
    "bagelsschmearevcinnyc": "bagels",
    "lowdiamondonly": "lowdiamondonlydaily",
    "highironfloorgoldceilingweekly": "silverandgoldcapweekly",
    "silverweekly": lambda run: ("silveronlyweekly" if run >= 27 else "silverweekly", run),
    "goldfloorcapweekly": lambda run: ("dregscap" if run >= 28 else "goldfloorcapweekly", run),
    "upto1969weekly": lambda run: ("deadsilverwalking" if run >= 28 else "upto1969weekly", run),
    # His Cap Challenge numbering restarts at 0 for each edition (by date:
    # CC5 ran Thursdays 09-10 to 10-01 = our runs 17-20).
    "c4q1": _restart("c4q5", 17),
    "c4q4": _restart("c4q4", 13),
}
# His filename -> newest card year allowed (a check that the file is that event).
MAX_CARD_YEAR = {"deadsilverwalking": 1919}

def his_name(our_file):
    m = re.match(r"(.+)_(\d+)\.csv$", os.path.basename(our_file))
    if not m:
        return None
    slug, run = m.group(1), int(m.group(2))
    a = ALIASES.get(slug, slug)
    his, his_run = a(run) if callable(a) else (a, run)
    return f"{his}_{his_run}.csv" if his_run >= 0 else None

# --- his sheet -------------------------------------------------------------
def find_sheet(repo):
    """The newest copy of his sheet on this Mac, or None."""
    home = os.path.expanduser("~")
    dirs = [os.path.join(home, "Downloads"), os.path.join(home, "Desktop"), repo,
            os.path.join(repo, "Tourney Data"), os.path.join(repo, "Inbox")]
    hits = [h for d in dirs for h in glob.glob(os.path.join(d, "*DCFC*Data*Entry*.xlsx"))]
    return max(hits, key=os.path.getmtime) if hits else None

def _col(ref):
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n - 1

def read_sheet(path):
    """{expected_filename: status} over every tab that has those two columns."""
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", ns):
            shared.append("".join(t.text or "" for t in si.iter("{%s}t" % ns["m"])))
    out = {}
    for name in sorted(n for n in z.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", n)):
        rows = []
        for row in ET.fromstring(z.read(name)).iter("{%s}row" % ns["m"]):
            vals = {}
            for c in row.findall("m:c", ns):
                v = c.find("m:v", ns)
                t = c.get("t")
                if t == "s" and v is not None:
                    vals[_col(c.get("r"))] = shared[int(v.text)]
                elif t == "inlineStr":
                    vals[_col(c.get("r"))] = "".join(x.text or "" for x in c.iter("{%s}t" % ns["m"]))
                elif v is not None:
                    vals[_col(c.get("r"))] = v.text
            rows.append(vals)
        if not rows:
            continue
        head = {v: k for k, v in rows[0].items()}
        if "expected_filename" not in head or "status" not in head:
            continue
        for r in rows[1:]:
            fn = r.get(head["expected_filename"])
            if fn:
                out[fn] = r.get(head["status"], "")
    return out

# --- one file --------------------------------------------------------------
def write_for_cwhit(src, dest):
    """Check src and write cwhit's version to dest. Returns (ok, detail)."""
    with open(src, newline="", encoding="utf-8-sig") as fh:
        r = csv.reader(fh)
        header = next(r, [])
        body = list(r)
    at = {}
    for i, h in enumerate(header):
        at.setdefault(h, i)
    missing = [c for c in CWHIT_COLUMNS if c not in at]
    if missing:
        return False, f"{len(missing)} of his columns missing ({', '.join(missing[:4])})"
    trimmed = header != CWHIT_COLUMNS
    if trimmed:
        idx = [at[c] for c in CWHIT_COLUMNS]
        body = [[x[i] if i < len(x) else "" for i in idx] for x in body]
    ix = {h: i for i, h in enumerate(CWHIT_COLUMNS)}
    if any(len(x) < len(CWHIT_COLUMNS) or not x[ix["CID"]].strip() or not x[ix["ORG"]].strip() for x in body):
        return False, "a row with no CID or team"
    teams = len({x[ix["ORG"]] for x in body})
    if teams < MIN_TEAMS:
        return False, f"only {teams} teams (a cut-off run)"
    his_slug = os.path.basename(dest).rsplit("_", 1)[0]
    cap = MAX_CARD_YEAR.get(his_slug)
    if cap:
        yrs = [int(x[ix["CYear"]]) for x in body if x[ix["CYear"]].isdigit()]
        if yrs and max(yrs) > cap:
            return False, f"has a {max(yrs)} card; {his_slug} is {cap} or earlier"
    tmp = dest + ".part"
    with open(tmp, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(CWHIT_COLUMNS)
        w.writerows(body)
    os.replace(tmp, dest)
    return True, f"{len(body)} rows, {teams} teams" + (", trimmed to his 200 columns" if trimmed else "")
