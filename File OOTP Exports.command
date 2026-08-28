#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
File OOTP Exports — double-click, file everything, then keep catching
exports as you download them.

The flow that works with OOTP's exporter (it always writes the SAME
filename into online_data, so each download overwrites the last):

  1. Double-click this. Any unfiled export it finds gets the two prompts
     (tournament, then id) and lands in Archive/Completed + the DCFC
     Upload Queue.
  2. Then it offers to KEEP WATCHING. Say yes, go back to OOTP, and
     export tournament after tournament — each file is caught and
     prompted for the moment it lands, so "which one is this?" is always
     "the one you just exported." Filing it also clears the way for the
     next download.
  3. Quit with Ctrl+C in the Terminal, or it stops by itself after 10
     quiet minutes and shows the summary.

The id prompt now PRE-FILLS its best guess: dailies follow the launch
calendar (Mar 13 = 0, so Aug 26's dailies are 166), weeklies follow each
series' own counter (anchored to the community dumps). Check it against
the number in parentheses in the game's tournament title, fix if needed,
hit OK. Quicks have no calendar — type the quick number from the title.
"""

from __future__ import annotations  # py3.9-safe

import glob
import os
import re
import shutil
import subprocess
import time
from datetime import date, datetime

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
QUEUE = os.path.join(HOME, "Desktop/OOTP Perfect Team/Tourney Data/DCFC Upload Queue")
MAX_AGE_DAYS = 7      # ignore stale stats CSVs (old archives live in online_data too)
POLL_SECONDS = 1.5
IDLE_QUIT_MINUTES = 10
DAILY_EPOCH = date(2026, 3, 13)  # daily instance 0 — all dailies share the day counter
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
    # ---- Perfect Draft series (our naming — DCFC does not collect draft stats)
    ("aroundbreakfasttable", "Daily Around the Breakfast Table", "pddaily"),
    ("aroundhornbeforebed", "Daily Around the Horn Before Bed", "pddaily"),
    ("aroundhornatnight", "Daily Around the Horn at Night", "pddaily"),
    ("bagelsschmearevcinnyc", "Daily Bagels and Schmear with EVCinNYC", "pddaily"),
    ("dontforgetpickkids", "Daily Don't Forget to Pick up the Kids - Live", "pddaily"),
    ("doubleespressomorning", "Daily Double Espresso Morning", "pddaily"),
    ("eveningmixedbag", "Daily Evening Mixed Bag", "pddaily"),
    ("goodorderlyevening", "Daily Good Orderly Evening", "pddaily"),
    ("historicalprimetime", "Daily Historical Primetime", "pddaily"),
    ("hittersfirst", "Daily Hitters First", "pddaily"),
    ("honeyishrunkroster", "Daily Honey I Shrunk the Roster", "pddaily"),
    ("justorderpizzadinner", "Daily Just Order Pizza for Dinner - D&G", "pddaily"),
    ("liveallnight", "Daily Live All Night", "pddaily"),
    ("livebreakfast", "Daily Live Breakfast", "pddaily"),
    ("livespeedrun", "Daily Live Speed Run", "pddaily"),
    ("meetingaboutmeetings", "Daily Meeting About Meetings - ORD", "pddaily"),
    ("mixedlunch", "Daily Mixed Up My Lunch", "pddaily"),
    ("morningmixedbag", "Daily Morning Mixed Bag", "pddaily"),
    ("nocturnalmixedbag", "Daily Nocturnal Mixed Bag", "pddaily"),
    ("ootpchill", "Daily OOTP and Chill", "pddaily"),
    ("pitchersfirst", "Daily Pitchers First", "pddaily"),
    ("riseshine", "Daily Rise and Shine", "pddaily"),
    ("rockingchairlunch", "Daily Rocking Chair Lunch", "pddaily"),
    ("scrum", "Daily Scrum", "pddaily"),
    ("snacktimeladder", "Daily Snack Time on the Ladder", "pddaily"),
    ("strugglingsleep", "Daily Struggling to Sleep - DBL", "pddaily"),
    ("theyvegoneplaid", "Daily They've Gone to Plaid", "pddaily"),
    ("thiscouldvebeenemail", "Daily This Could've Been an Email - RCK", "pddaily"),
    ("tryinglookbusy", "Daily Trying to Look Busy - D&G", "pddaily"),
    ("tucktime", "Daily Tuck in Time", "pddaily"),
    ("laterich", "Daily Up Late with Rich - LAD", "pddaily"),
    ("docrockderby", "Dr. Dynastic's Doc Rock Derby", "pddaily"),
    ("fridaydraftaboutnothing", "Friday Draft About Nothing", "pdweekly"),
    ("fridaynightlivepd", "Friday Night Live PD", "pdweekly"),
    ("fridaywatchingclock", "Friday Watching the Clock - ATH", "pdweekly"),
    ("5ldeadball", "Laptophound's Daily 5L Deadball", "pddaily"),
    ("6lpowerplay", "Laptophound's Daily 6L Power Play", "pddaily"),
    ("mondaygettingstarted", "Monday Getting it Started", "pdweekly"),
    ("mondaynighthistorylesson", "Monday Night History Lesson", "pdweekly"),
    ("mondaytrimthosesideburns", "Monday Trim Those Sideburns", "pdweekly"),
    ("saturdayaroundhornafterdar", "Saturday Around the Horn After Dark", "pdweekly"),
    ("saturdaycantsleepclownwill", "Saturday Can't Sleep Clown Will Eat Me", "pdweekly"),
    ("saturdayshrinkage", "Saturday Shrinkage", "pdweekly"),
    ("sundaymorningmarkusrevenge", "Sunday Morning Markus' Revenge", "pdweekly"),
    ("sundaypdmainevent", "Sunday PD Main Event", "pdweekly"),
    ("sundaydownladder", "Sunday Up and Down the Ladder", "pdweekly"),
    ("twiptsaturdayshowdown", "TWIPT Saturday Showdown", "pdweekly"),
    ("thursdaydudewherecards", "Thursday Dude Where's My Cards?", "pdweekly"),
    ("thursdaynightputbooks", "Thursday Night Put it in the Books", "pdweekly"),
    ("thursdayovernightundercove", "Thursday Overnight Under the Covers", "pdweekly"),
    ("tuesdaydoublerockingchairs", "Tuesday Double Rocking Chairs", "pdweekly"),
    ("tuesdayeveningadrenalineru", "Tuesday Evening Adrenaline Rush", "pdweekly"),
    ("tuesdaylivelampooning", "Tuesday Live Lampooning", "pdweekly"),
    ("wednesdaydiamondiron", "Wednesday Diamond to Iron", "pdweekly"),
    ("wednesdaydoublepd", "Wednesday Double PD", "pdweekly"),
    ("wednesdaywakehistory", "Wednesday Wake Up To History", "pdweekly"),
]

# Latest known (event id, unix start) per weekly series — from the community dumps.
WEEKLY_ANCHORS = {
    "1950tonow": (1480022, 1787148186),
    "bronzecapweekly": (1580023, 1787418130),
    "bronzeweekly": (1420022, 1786968322),
    "c4q1": (1870003, 1779987730),
    "c4q2": (1870009, 1783616562),
    "c4q3": (1870013, 1786035740),
    "c4q4": (1870015, 1787245339),
    "deadballweekly": (1500022, 1787187768),
    "diamondvariety": (1590023, 1787446977),
    "diamondweekly": (1490022, 1787169957),
    "goldfloorcapweekly": (1440022, 1787014942),
    "goldweekly": (1530022, 1787267133),
    "highironfloorgoldceilingweekly": (1600023, 1787493736),
    "ironweekly": (1570023, 1787403920),
    "livelowdiamondweekly": (1430016, 1783357382),
    "liveslotsweekly": (1560023, 1787356933),
    "liveweekly": (1460022, 1787076385),
    "lowironweekly": (1550022, 1787335451),
    "mishmashcap": (1520006, 1777565104),
    "nelslotsweekly": (1950012, 1787396516),
    "nightmarecap": (1540022, 1787292245),
    "openslotsweekly": (1610023, 1787508166),
    "openweekly": (1620023, 1787522836),
    "sandlot": (1470022, 1787104951),
    "silverweekly": (1510022, 1787223942),
    "upto1969weekly": (1450022, 1787058163),
    "wonkyslots": (1430022, 1786986173),
}


TIER_ORDER = ["Diamond", "Gold", "Silver", "Bronze", "Iron", "Open", "Live", "Cap", "Other"]

def tier_of(display_name: str) -> str:
    """Level wins when present (Diamond & Friends Slots -> Diamond); Cap/Slots
    only when no level; Live likewise; NEL and oddballs land in Other."""
    for t in ("Diamond", "Gold", "Silver", "Bronze", "Iron"):
        if t.lower() in display_name.lower():
            return t
    if "open" in display_name.lower():
        return "Open"
    if "live" in display_name.lower():
        return "Live"
    if "cap" in display_name.lower() or "slots" in display_name.lower():
        return "Cap"
    return "Other"

def grouped_items():
    """Picker rows: tier headers, then dailies, weeklies, quicks within each."""
    rows = []
    for tier in TIER_ORDER:
        block = []
        for grp in ("daily", "weekly", "quick"):
            for v, n, g in sorted(VARNAMES, key=lambda x: x[1].lower()):
                if g == grp and tier_of(n) == tier:
                    tag = {"daily": "D", "weekly": "W", "quick": "Q"}[g]
                    block.append((f"{v} — {n}  [{tag}]", v))
        if block:
            rows.append((f"────────  {tier.upper()}  ────────", None))
            rows.extend(block)
    for grp, label, tag in (("pddaily", "PERFECT DRAFT — DAILY", "PD"), ("pdweekly", "PERFECT DRAFT — WEEKLY", "PW")):
        block = [(f"{v} — {n}  [{tag}]", v) for v, n, g in sorted(VARNAMES, key=lambda x: x[1].lower()) if g == grp]
        if block:
            rows.append((f"────────  {label}  ────────", None))
            rows.extend(block)
    return rows

DRAFT_ANCHORS = {
    "aroundbreakfasttable": (2560088, 1787489559),
    "aroundhornbeforebed": (2610089, 1787543557),
    "aroundhornatnight": (2600089, 1787536361),
    "bagelsschmearevcinnyc": (2060162, 1787490879),
    "dontforgetpickkids": (2130162, 1787512960),
    "doubleespressomorning": (2040163, 1787569656),
    "eveningmixedbag": (2540152, 1787530838),
    "goodorderlyevening": (2590089, 1787533907),
    "historicalprimetime": (2190163, 1787530966),
    "hittersfirst": (2580089, 1787507569),
    "honeyishrunkroster": (2150162, 1787520157),
    "justorderpizzadinner": (2170163, 1787527364),
    "liveallnight": (2260163, 1787554361),
    "livebreakfast": (2050162, 1787487764),
    "livespeedrun": (2200163, 1787533657),
    "meetingaboutmeetings": (2090162, 1787498562),
    "mixedlunch": (2530152, 1787503827),
    "morningmixedbag": (2520151, 1787488286),
    "nocturnalmixedbag": (2550152, 1787539943),
    "ootpchill": (2220163, 1787541760),
    "pitchersfirst": (2570089, 1787502162),
    "riseshine": (2030163, 1787566941),
    "rockingchairlunch": (2100162, 1787501567),
    "scrum": (2080162, 1787494965),
    "snacktimeladder": (2120162, 1787509347),
    "strugglingsleep": (2240163, 1787548961),
    "theyvegoneplaid": (2210163, 1787537260),
    "thiscouldvebeenemail": (2140162, 1787516562),
    "tryinglookbusy": (2110162, 1787505762),
    "tucktime": (2230163, 1787545341),
    "laterich": (2250163, 1787552543),
    "docrockderby": (2160163, 1787522446),
    "fridaydraftaboutnothing": (2390022, 1787325882),
    "fridaynightlivepd": (2410023, 1787365394),
    "fridaywatchingclock": (2400022, 1787342901),
    "5ldeadball": (2070162, 1787493197),
    "6lpowerplay": (2180163, 1787532493),
    "mondaygettingstarted": (2270022, 1786980281),
    "mondaynighthistorylesson": (2290022, 1787019881),
    "mondaytrimthosesideburns": (2280022, 1786998196),
    "saturdayaroundhornafterdar": (2620012, 1787457194),
    "saturdaycantsleepclownwill": (2420023, 1787379873),
    "saturdayshrinkage": (2430023, 1787412278),
    "sundaymorningmarkusrevenge": (2450023, 1787487800),
    "sundaypdmainevent": (2470023, 1787520280),
    "sundaydownladder": (2460023, 1787505799),
    "twiptsaturdayshowdown": (2440023, 1787441078),
    "thursdaydudewherecards": (2370022, 1787250194),
    "thursdaynightputbooks": (2380022, 1787275478),
    "thursdayovernightundercove": (2360022, 1787210663),
    "tuesdaydoublerockingchairs": (2300022, 1787055797),
    "tuesdayeveningadrenalineru": (2320022, 1787101789),
    "tuesdaylivelampooning": (2310022, 1787073799),
    "wednesdaydiamondiron": (2350022, 1787192596),
    "wednesdaydoublepd": (2340022, 1787167470),
    "wednesdaywakehistory": (2330022, 1787149476),
}

def osascript(script: str) -> str:
    out = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
    return out.stdout.strip()

def q(s: str) -> str:
    return s.replace("\\", "\\\\").replace(chr(34), "\\" + chr(34))

def notify(msg: str) -> None:
    subprocess.run(
        ["osascript", "-e", f'display notification "{q(msg)}" with title "File OOTP Exports"'],
        capture_output=True,
    )

def alert(msg: str, buttons=("OK",), default=None) -> str:
    bl = "{" + ", ".join(f'"{b}"' for b in buttons) + "}"
    res = osascript(
        f'display dialog "{q(msg)}" buttons {bl} default button "{default or buttons[-1]}" with title "File OOTP Exports"'
    )
    m = re.search(r"button returned:([^,]+)", res)
    return m.group(1).strip() if m else buttons[0]

def pick_tournament(prompt: str):
    rows = grouped_items()
    listing = "{" + ", ".join(f'"{q(label)}"' for label, _v in rows) + "}"
    default = next(label for label, v in rows if v)
    while True:
        res = osascript(
            f'choose from list {listing} with title "File OOTP Exports" '
            f'with prompt "{q(prompt)}" default items {{"{q(default)}"}}'
        )
        if not res or res == "false":
            return None
        if res.startswith("────"):
            notify("That's a section header — pick a tournament under it.")
            continue
        varname = res.split(" — ")[0].strip()
        for v, n, g in VARNAMES:
            if v == varname:
                return (v, n, g)
        return None

LAST_DAILY_ID = [None]  # sticky: back-filling a week means many same-day dailies in a row

def guess_id(varname: str, group: str, mtime: float) -> str:
    """Best-guess tourney id from the file's timestamp."""
    if group == "daily":
        if LAST_DAILY_ID[0] is not None:
            return LAST_DAILY_ID[0]  # repeat whatever you last typed for a daily
        dt = datetime.fromtimestamp(mtime)
        n = (dt.date() - DAILY_EPOCH).days
        if dt.hour < 17:
            n -= 1  # a morning export is for yesterday's daily
        return str(max(n, 0))
    if group == "weekly" and varname in WEEKLY_ANCHORS:
        aid, astart = WEEKLY_ANCHORS[varname]
        weeks = round((mtime - 7 * 86400 - astart) / (7 * 86400))
        return str(max(aid % 1000 + weeks, 0))
    if group == "pddaily" and varname in DRAFT_ANCHORS:
        # each PD daily runs its own day counter — anchor from the dumps
        aid, astart = DRAFT_ANCHORS[varname]
        dt = datetime.fromtimestamp(mtime)
        played = dt.date() if dt.hour >= 17 else date.fromordinal(dt.date().toordinal() - 1)
        return str(max(aid % 1000 + (played - datetime.fromtimestamp(astart).date()).days, 0))
    if group == "pdweekly" and varname in DRAFT_ANCHORS:
        aid, astart = DRAFT_ANCHORS[varname]
        weeks = round((mtime - 7 * 86400 - astart) / (7 * 86400))
        return str(max(aid % 1000 + weeks, 0))
    return ""

def ask_id(varname: str, group: str, fileinfo: str, mtime: float):
    """Returns (action, id). action in ok|back|skip."""
    guess = guess_id(varname, group, mtime)
    hint = f"\n\nPre-filled with my best guess from the calendar — check it against the number in ( ) in the game title." if guess else "\n\nQuicks have no calendar — type the quick number from the game title."
    while True:
        res = osascript(
            f'display dialog "{q(fileinfo)}\n\nTournament: {q(varname)}\nTourney id (quick number or last 3 digits, no leading zeros):{hint}" '
            f'default answer "{guess}" buttons {{"Skip", "Back", "OK"}} default button "OK" with title "File OOTP Exports"'
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
            if group == "daily":
                LAST_DAILY_ID[0] = str(int(text))
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

def settled(path: str) -> bool:
    try:
        a = os.path.getsize(path); time.sleep(0.4); b = os.path.getsize(path)
        return a == b and a > 0
    except OSError:
        return False

def fresh(m: float) -> bool:
    return m >= time.time() - MAX_AGE_DAYS * 86400

def find_exports() -> list:
    found = []
    for d in scan_paths():
        for p in glob.glob(os.path.join(d, "*.csv")):
            if looks_like_export(p):
                try:
                    m = os.path.getmtime(p)
                    if fresh(m):
                        found.append((m, p))
                except OSError:
                    pass
    found.sort()
    return found

def short(path: str) -> str:
    p = path.replace(HOME, "~")
    p = re.sub(r"~/Application Support/.*/saved_games/[0-9a-f]*([0-9a-f]{4})\.pt/import_export", r"OOTP game …\1", p)
    return p.replace("~/Application Support/Out of the Park Developments/OOTP Baseball 27/online_data", "OOTP online_data")

def file_one(mt: float, p: str, label: str, filed: list) -> str:
    """Prompt for and file a single export. Returns ok|skip."""
    info = (f"{label}:  {os.path.basename(p)}\n"
            f"from {short(os.path.dirname(p))}\n"
            f"exported {time.strftime('%a %b %d, %H:%M', time.localtime(mt))}")
    while True:
        picked = pick_tournament(info + "\n\nWhich tournament is this? (type to jump, Cancel to skip)")
        if picked is None:
            print(f"skipped {os.path.basename(p)}")
            return "skip"
        varname, _n, group = picked
        action, tid = ask_id(varname, group, info, mt)
        if action == "back":
            continue
        if action == "skip":
            print(f"skipped {os.path.basename(p)}")
            return "skip"
        name = f"{varname}_{tid}.csv"
        dest = os.path.join(DEST, name)
        if os.path.exists(dest):
            r = alert(f"{name} already exists in Archive/Completed.", ("Skip", "Replace"), "Skip")
            if r != "Replace":
                print(f"collision, kept old: {name}")
                return "skip"
        if not group.startswith("pd"):
            shutil.copy2(p, os.path.join(QUEUE, name))  # DCFC takes tournament stats only
        os.replace(p, dest)
        filed.append(name)
        print(f"✓ filed {name}" + ("  (app only — not queued for DCFC)" if group.startswith("pd") else ""))
        notify(f"Filed {name}")
        return "ok"

def main() -> None:
    os.makedirs(DEST, exist_ok=True)
    os.makedirs(QUEUE, exist_ok=True)
    filed: list = []

    exports = find_exports()
    for i, (mt, p) in enumerate(exports, 1):
        file_one(mt, p, f"File {i} of {len(exports)}", filed)

    start_msg = (f"Filed {len(filed)} export(s)." if exports else "No unfiled exports right now.")
    choice = alert(
        start_msg + "\n\nWatch for more? Export from OOTP and I'll catch each file the moment it lands — "
        f"the popup is always the one you just exported. Stops after {IDLE_QUIT_MINUTES} quiet minutes or Ctrl+C.",
        ("Quit", "Watch for Exports"), "Watch for Exports")
    if choice == "Quit":
        if filed:
            alert("Filed:\n" + "\n".join("  " + n for n in filed) + "\n\nCopies for cwhit are in Tourney Data/DCFC Upload Queue.")
        return

    print(f"Watching… export from OOTP now. Ctrl+C here to finish (auto-quits after {IDLE_QUIT_MINUTES} idle minutes).")
    notify("Watching — export from OOTP now.")
    seen = {}
    for d in scan_paths():
        for p in glob.glob(os.path.join(d, "*.csv")):
            try:
                seen[p] = os.path.getmtime(p)
            except OSError:
                pass
    last_activity = time.time()
    try:
        while time.time() - last_activity < IDLE_QUIT_MINUTES * 60:
            time.sleep(POLL_SECONDS)
            for d in scan_paths():
                for p in glob.glob(os.path.join(d, "*.csv")):
                    try:
                        m = os.path.getmtime(p)
                    except OSError:
                        continue
                    if p in seen and seen[p] >= m:
                        continue
                    seen[p] = m
                    if not fresh(m) or not settled(p) or not looks_like_export(p):
                        continue
                    file_one(m, p, "New export", filed)
                    seen.pop(p, None)
                    last_activity = time.time()
    except KeyboardInterrupt:
        pass
    lines = "\n".join("  " + n for n in filed) if filed else "  (none)"
    print("Done. Filed:\n" + lines)
    alert(f"Done — filed {len(filed)} export(s):\n{lines}\n\nCopies for cwhit are in Tourney Data/DCFC Upload Queue.")

if __name__ == "__main__":
    main()
