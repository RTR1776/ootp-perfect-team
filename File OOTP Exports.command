#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
File OOTP Exports — double-click to run, files everything, then quits.

No background watcher. Run it AFTER exporting from OOTP (one file or a
batch). It finds every unfiled stats export in ~/Downloads and the OOTP
saved-game import_export folders, and for each one asks:

  1. Which tournament?  (searchable list of 96 — type to jump)
  2. The tourney id     (quick number, or last 3 digits of a daily/weekly
                         id — leading zeros are stripped automatically)

Each file is then renamed varname_<id>.csv and:
  - moved to  Archive/Completed          (the app's ingestion archive)
  - copied to Tourney Data/DCFC Upload Queue  (grab these when you upload
    to cwhit/DCFCStats, then clear the folder)

Buttons: Back re-picks the tournament, Skip leaves a file where it is,
Cancel in the picker also skips. A summary shows when it's done.
"""

from __future__ import annotations  # py3.9-safe: don't evaluate "tuple | None"

import glob
import os
import re
import shutil
import subprocess
import time

HOME = os.path.expanduser("~")

# ----------------------------------------------------------------- config --
SCAN_DIRS = [
    os.path.join(HOME, "Downloads"),
    # OOTP's own export dialog writes here (the "Report Written to..." path)
    os.path.join(HOME, "Application Support/Out of the Park Developments/OOTP Baseball 27/online_data"),
]
SCAN_GLOBS = [
    os.path.join(HOME, "Application Support/Out of the Park Developments/OOTP Baseball 27/saved_games/*/import_export"),
]
DEST = os.path.join(HOME, "Desktop/OOTP Perfect Team/Archive/Completed")
MAX_AGE_DAYS = 7  # ignore stale stats CSVs (old archives live in online_data too)
QUEUE = os.path.join(HOME, "Desktop/OOTP Perfect Team/Tourney Data/DCFC Upload Queue")
# ---------------------------------------------------------------------------

VARNAMES = [
    ("bagels", "EVCinNYC Bagels and Schmear", "daily"),
    ("bronze10to50", "Bronze 1910-59", "daily"),
    ("bronzecapdaily", "Bronze Cap Daily", "daily"),
    ("bronzecuriosity", "Bronze Only Curiosities", "daily"),
    ("bronzeheart", "Bronze Heart", "daily"),
    ("bronzeonlycapdaily", "Bronze Only Cap Daily", "daily"),
    ("bronzeootp", "Bronze OOTP Era", "daily"),
    ("bronzeptcs2", "Bronze PTCS 2 Replay Slots", "daily"),
    ("bronzeptcs3", "Bronze PTCS 3 Replay Slots", "daily"),
    ("bronzesequel", "Bronze Sequel", "daily"),
    ("dankdaily", "Dank Daily", "daily"),
    ("diamondandfriends", "Diamond & Friends", "daily"),
    ("diamondcapdaily", "Diamond Cap Daily", "daily"),
    ("diamonddaily", "Diamond Daily", "daily"),
    ("diamondheart", "Diamond Heart", "daily"),
    ("diamondsforever", "Diamonds Are Forever", "daily"),
    ("diamondslotsdaily", "Diamond Slots Daily", "daily"),
    ("earlybronze", "Early Bronze", "daily"),
    ("earlygold", "Early Gold", "daily"),
    ("earlysilver", "Early Silver", "daily"),
    ("goldcapdaily", "Gold Cap Daily", "daily"),
    ("goldenchildhood", "Daily Sporer's Golden Childhood", "daily"),
    ("goldenheart", "Golden Heart", "daily"),
    ("goldfather", "Goldfather II", "daily"),
    ("goldslotsdaily", "Gold Slots Daily", "daily"),
    ("ironandfriends", "Iron & Friends OOTP Era Slots", "daily"),
    ("ironcapdaily", "Iron Cap Daily", "daily"),
    ("irondreamland", "Iron Dreamland", "daily"),
    ("ironheart", "Iron Heart", "daily"),
    ("ironlunch", "Iron Lunch", "daily"),
    ("ironstrikesback", "Iron Strikes Back", "daily"),
    ("latebronze", "Late Bronze", "daily"),
    ("lateiron", "Late Iron", "daily"),
    ("latesilver", "Late Silver", "daily"),
    ("lgretro", "Low Gold Restrospecticus", "daily"),
    ("livebronzedaily", "Live Bronze Daily", "daily"),
    ("livediamonddaily", "Live Diamond Daily", "daily"),
    ("livegolddaily", "Live Gold Daily", "daily"),
    ("liveirondaily", "Live Iron Daily", "daily"),
    ("liveopendaily", "Live Open Daily", "daily"),
    ("livesilverdaily", "Live Silver Daily", "daily"),
    ("lowbronzedaily", "Low Bronze Daily", "daily"),
    ("lowbronzeonlydaily", "Low Bronze Only Daily", "daily"),
    ("lowdiamonddaily", "Low Diamond Daily", "daily"),
    ("neldaily", "Negro Leagues Daily", "daily"),
    ("openheart", "Open Heart", "daily"),
    ("openhighcap", "Open High Cap", "daily"),
    ("openlowcap", "Open Low Cap", "daily"),
    ("openslotsdaily", "Open Slots Daily", "daily"),
    ("ptcs2iron", "Iron PTCS 2 Replay", "daily"),
    ("ptcs4cap", "Cap PTCS 4 Replay", "daily"),
    ("returnofthebronze", "Return of the Bronze", "daily"),
    ("silverandfriends", "Silver & Friends Deadball Slots", "daily"),
    ("silvercapdaily", "Silver Cap Daily", "daily"),
    ("silverheart", "Silver Heart", "daily"),
    ("silverslamboree", "Silver Slamboree", "daily"),
    ("silverslotsdaily", "Silver Slots Daily", "daily"),
    ("timetravelersslots", "Dr. Dynastic's Time Traveler Slots", "daily"),
    ("wideopen", "Wide Open", "daily"),
    ("bronzequick", "Bronze Quick", "quick"),
    ("dankquick", "Dank Quick", "quick"),
    ("diamondquick", "Diamond Quick", "quick"),
    ("goldquick", "Gold Quick", "quick"),
    ("ironquick", "Iron Quick", "quick"),
    ("ldquick", "Low Diamond Quick", "quick"),
    ("lgmashupquick", "Low Gold Mashup Quick", "quick"),
    ("livequick", "Live Quick", "quick"),
    ("openquick", "Open Quick", "quick"),
    ("silverquick", "Silver Quick", "quick"),
    ("1950tonow", "Wednesday 1950 to Now", "weekly"),
    ("bronzecapweekly", "Saturday Bronze Cap", "weekly"),
    ("bronzeweekly", "Monday Up And At Them Bronze", "weekly"),
    ("c4q1", "Thursday Cwhit's Cap Challenge 1", "weekly"),
    ("c4q2", "Thursday Cwhit's Cap Challenge 2", "weekly"),
    ("c4q3", "Thursday Cwhit's Cap Challenge 3", "weekly"),
    ("c4q4", "Thursday Cwhit's Cap Challenge 4", "weekly"),
    ("deadballweekly", "Wednesday Night of the Living Deadball", "weekly"),
    ("diamondvariety", "Saturday Diamond Variety", "weekly"),
    ("diamondweekly", "Wednesday Ice To See You", "weekly"),
    ("goldfloorcapweekly", "Monday Gold Floor Cap", "weekly"),
    ("goldweekly", "Thursday Night Gold Rush", "weekly"),
    ("highironfloorgoldceilingweekly", "Sunday High Iron Floor and Gold Ceiling", "weekly"),
    ("ironweekly", "Saturday Iron Warriors", "weekly"),
    ("livelowdiamondweekly", "Monday Live Low Diamond", "weekly"),
    ("liveslotsweekly", "Friday Night Live Slots", "weekly"),
    ("liveweekly", "Tuesday Live", "weekly"),
    ("lowironweekly", "Friday Danksville", "weekly"),
    ("mishmashcap", "Thursday Mishmash Cap", "weekly"),
    ("nelslotsweekly", "Saturday Negro Leagues Slots", "weekly"),
    ("nightmarecap", "Friday Nightmare Cap", "weekly"),
    ("openslotsweekly", "Sunday Open Slots", "weekly"),
    ("openweekly", "Sunday Open Main Event", "weekly"),
    ("sandlot", "Tuesday Sporer's Sandlot", "weekly"),
    ("silverweekly", "Thursday Silver Spectacular", "weekly"),
    ("upto1969weekly", "Tuesday Up to 1969", "weekly"),
    ("wonkyslots", "Monday Wonky Historical Slots", "weekly"),
]

def osascript(script: str) -> str:
    out = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
    return out.stdout.strip()

def q(s: str) -> str:
    """Escape a python string for embedding in an AppleScript double-quoted literal."""
    return s.replace("\\", "\\\\").replace(chr(34), "\\" + chr(34))

def notify(msg: str) -> None:
    subprocess.run(
        ["osascript", "-e", f'display notification "{q(msg)}" with title "File OOTP Exports"'],
        capture_output=True,
    )

def alert(msg: str) -> None:
    osascript(f'display dialog "{q(msg)}" buttons {{"OK"}} default button "OK" with title "File OOTP Exports"')

def pick_tournament(prompt: str):
    items = [f"{v} — {n}  [{g}]" for v, n, g in VARNAMES]
    listing = "{" + ", ".join(f'"{q(i)}"' for i in items) + "}"
    res = osascript(
        f'choose from list {listing} with title "File OOTP Exports" '
        f'with prompt "{q(prompt)}" default items {{"{q(items[0])}"}}'
    )
    if not res or res == "false":
        return None
    varname = res.split(" — ")[0].strip()
    for v, n, g in VARNAMES:
        if v == varname:
            return (v, n, g)
    return None

def ask_id(varname: str, fileinfo: str):
    """Returns (action, id). action in ok|back|skip."""
    while True:
        res = osascript(
            f'display dialog "{q(fileinfo)}\n\nTournament: {q(varname)}\nTourney id (quick number or last 3 digits, no leading zeros):" '
            f'default answer "" buttons {{"Skip", "Back", "OK"}} default button "OK" with title "File OOTP Exports"'
        )
        if not res:
            return ("skip", None)
        m = re.search(r"button returned:([^,]+)(?:, text returned:(.*))?$", res)
        button = m.group(1).strip() if m else "Skip"
        text = (m.group(2) or "").strip() if m else ""
        if button == "Skip":
            return ("skip", None)
        if button == "Back":
            return ("back", None)
        if re.fullmatch(r"\d+", text):
            return ("ok", str(int(text)))  # int() strips leading zeros
        notify("Tourney id must be a number — try again.")

def scan_paths() -> list:
    dirs = list(SCAN_DIRS)
    for g in SCAN_GLOBS:
        dirs.extend(glob.glob(g))
    return [d for d in dirs if os.path.isdir(d)]

def looks_like_export(path: str) -> bool:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            head = f.readline()
        return head.startswith("POS,") or head.startswith("POS;")
    except OSError:
        return False

def find_exports() -> list:
    found = []
    cutoff = time.time() - MAX_AGE_DAYS * 86400
    for d in scan_paths():
        for p in glob.glob(os.path.join(d, "*.csv")):
            if looks_like_export(p):
                try:
                    m = os.path.getmtime(p)
                    if m >= cutoff:
                        found.append((m, p))
                except OSError:
                    pass
    found.sort()  # oldest first = the order you exported them
    return found

def short(path: str) -> str:
    p = path.replace(HOME, "~")
    return re.sub(r"~/Application Support/.*/saved_games/[0-9a-f]*([0-9a-f]{4})\.pt/import_export", r"OOTP game …\1", p)

def main() -> None:
    os.makedirs(DEST, exist_ok=True)
    os.makedirs(QUEUE, exist_ok=True)
    exports = find_exports()
    if not exports:
        alert("No unfiled OOTP exports found in Downloads or the OOTP export folders.\n\nExport from OOTP first, then run this again.")
        return

    filed, skipped = [], 0
    for i, (mt, p) in enumerate(exports, 1):
        info = (f"File {i} of {len(exports)}:  {os.path.basename(p)}\n"
                f"from {short(os.path.dirname(p))}\n"
                f"exported {time.strftime('%a %b %d, %H:%M', time.localtime(mt))}")
        varname = None
        while True:
            picked = pick_tournament(info + "\n\nWhich tournament is this? (type to jump, Cancel to skip)")
            if picked is None:
                skipped += 1
                print(f"skipped {os.path.basename(p)}")
                break
            varname = picked[0]
            action, tid = ask_id(varname, info)
            if action == "back":
                continue
            if action == "skip":
                skipped += 1
                print(f"skipped {os.path.basename(p)}")
                break
            name = f"{varname}_{tid}.csv"
            dest = os.path.join(DEST, name)
            if os.path.exists(dest):
                r = osascript(
                    f'display dialog "{q(name)} already exists in Archive/Completed." '
                    f'buttons {{"Skip", "Replace"}} default button "Skip" with title "File OOTP Exports"'
                )
                if "Replace" not in r:
                    skipped += 1
                    print(f"collision, kept old: {name}")
                    break
            shutil.copy2(p, os.path.join(QUEUE, name))
            os.replace(p, dest)
            filed.append(name)
            print(f"filed {name}")
            break

    lines = "\n".join("  " + n for n in filed) if filed else "  (none)"
    tail = f"\nSkipped: {skipped}" if skipped else ""
    alert(f"Filed {len(filed)} export(s) to Archive/Completed:\n{lines}\n\n"
          f"Copies for the cwhit/DCFC upload are in Tourney Data/DCFC Upload Queue.{tail}")
    print("Done. App archive:", DEST)
    print("cwhit upload queue:", QUEUE)

if __name__ == "__main__":
    main()
