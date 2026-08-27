#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Watch OOTP Exports — double-click to run.

Flow (mirrors the DCFCStats R watcher, no installs needed):
  1. Pick the tournament you're about to export (searchable list).
  2. Export from OOTP like normal. The moment a new stats CSV appears in a
     watched folder, a popup asks for the tourney id (the quick number, or
     the last three digits of a daily/weekly — no leading zeros).
  3. Click OK and the file is renamed varname_<id>.csv and moved to the
     Completed archive. Repeat; pick "Change Tournament" between events.

Varnames come from the DCFCStats data-entry sheet (96 tournaments, embedded
below). Watched folders: ~/Downloads and every OOTP saved-game import_export
folder. A CSV only triggers the popup if it actually looks like an OOTP
stats export (first line starts with POS,Name).

Quit with Ctrl+C in this Terminal window, or Cancel in the tournament picker.
"""

from __future__ import annotations  # py3.9-safe: don't evaluate "tuple | None"

import glob
import os
import re
import shutil
import subprocess
import sys
import time

HOME = os.path.expanduser("~")

# ----------------------------------------------------------------- config --
WATCH_DIRS = [
    os.path.join(HOME, "Downloads"),
]
WATCH_GLOBS = [
    os.path.join(HOME, "Application Support/Out of the Park Developments/OOTP Baseball 27/saved_games/*/import_export"),
]
DEST = os.path.join(HOME, "Desktop/OOTP Perfect Team/Archive/Completed")
POLL_SECONDS = 1.5
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

def notify(msg: str) -> None:
    msg = msg.replace("\\", "\\\\").replace('"', '\\"')
    subprocess.run(
        ["osascript", "-e", f'display notification "{msg}" with title "OOTP Export Watcher"'],
        capture_output=True,
    )

def pick_tournament() -> tuple | None:
    items = [f"{v} — {n}  [{g}]" for v, n, g in VARNAMES]
    listing = "{" + ", ".join(f'"{i}"' for i in items) + "}"
    res = osascript(
        f'choose from list {listing} with title "OOTP Export Watcher" '
        f'with prompt "Which tournament are you exporting? (type to jump)" default items {{"{items[0]}"}}'
    )
    if not res or res == "false":
        return None
    varname = res.split(" — ")[0].strip()
    for v, n, g in VARNAMES:
        if v == varname:
            return (v, n, g)
    return None

def ask_id(varname: str, filename: str) -> tuple:
    """Returns (action, id). action in ok|change|skip."""
    filename = filename.replace('"', "'")
    while True:
        res = osascript(
            f'display dialog "New export detected:\n{filename}\n\nTournament: {varname}\nEnter the tourney id (quick number or last 3 digits, no leading zeros):" '
            f'default answer "" buttons {{"Skip", "Change Tournament", "OK"}} default button "OK" with title "OOTP Export Watcher"'
        )
        if not res:
            return ("skip", None)
        m = re.search(r"button returned:([^,]+)(?:, text returned:(.*))?$", res)
        button = m.group(1).strip() if m else "Skip"
        text = (m.group(2) or "").strip() if m else ""
        if button == "Skip":
            return ("skip", None)
        if button == "Change Tournament":
            return ("change", None)
        if re.fullmatch(r"\d+", text):
            return ("ok", str(int(text)))  # int() strips leading zeros
        notify("Tourney id must be a number — try again.")

def watch_paths() -> list:
    dirs = list(WATCH_DIRS)
    for g in WATCH_GLOBS:
        dirs.extend(glob.glob(g))
    return [d for d in dirs if os.path.isdir(d)]

def looks_like_export(path: str) -> bool:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            head = f.readline()
        return head.startswith("POS,") or head.startswith("POS;")
    except OSError:
        return False

def settled(path: str) -> bool:
    """File finished writing: size stable across a short beat."""
    try:
        a = os.path.getsize(path); time.sleep(0.4); b = os.path.getsize(path)
        return a == b and a > 0
    except OSError:
        return False

def main() -> None:
    os.makedirs(DEST, exist_ok=True)
    picked = pick_tournament()
    if not picked:
        print("No tournament picked — bye.")
        return
    varname = picked[0]
    print(f"Watching for exports → {varname}  (dest: {DEST})")
    print("Folders:", *watch_paths(), sep="\n  ")
    notify(f"Watching for {varname} exports…")

    seen = {}
    for d in watch_paths():
        for p in glob.glob(os.path.join(d, "*.csv")):
            try:
                seen[p] = os.path.getmtime(p)
            except OSError:
                pass

    while True:
        try:
            time.sleep(POLL_SECONDS)
            for d in watch_paths():
                for p in glob.glob(os.path.join(d, "*.csv")):
                    try:
                        m = os.path.getmtime(p)
                    except OSError:
                        continue  # vanished mid-poll (browser rename etc.)
                    if p in seen and seen[p] >= m:
                        continue
                    seen[p] = m
                    if not settled(p) or not looks_like_export(p):
                        continue
                    action, tid = ask_id(varname, os.path.basename(p))
                    while action == "change":
                        newpick = pick_tournament()
                        if newpick:
                            varname = newpick[0]
                            print(f"Switched to {varname}")
                        action, tid = ask_id(varname, os.path.basename(p))
                    if action == "skip":
                        print(f"skipped {os.path.basename(p)}")
                        continue
                    dest = os.path.join(DEST, f"{varname}_{tid}.csv")
                    if os.path.exists(dest):
                        notify(f"{os.path.basename(dest)} already exists — left in place.")
                        print(f"COLLISION: {dest} exists; {p} not moved")
                        continue
                    shutil.move(p, dest)
                    seen.pop(p, None)
                    seen[dest] = os.path.getmtime(dest)
                    print(f"✓ {os.path.basename(p)}  →  {os.path.basename(dest)}")
                    notify(f"Filed {os.path.basename(dest)}")
        except KeyboardInterrupt:
            print("\nDone. Files are in", DEST)
            return

if __name__ == "__main__":
    main()
