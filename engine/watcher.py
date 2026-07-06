"""Python port of watchootpexport_portable.R — with auto-ingest.

Watches the OOTP online_data folder for the sortable-stats export, renames it
into the tourney archive as <label>_<id>.csv, then immediately ingests it and
rebuilds web/public/data/tourneys.json. Original R workflow (reference copy in
reference/r-watcher/) required RStudio + manual file shuffling; this replaces
it entirely.

Usage:
    python -m engine watch --label diamondslotsdaily
    (then enter the tourney ID each time an export appears; Ctrl+C to stop)

First run: set watchDir in engine/config/watcher.json — the folder that
CONTAINS online_data/, i.e. your OOTP saved-game folder. The OOTP view must be
saved as "Export" (same as the R workflow; view from CWhit).
"""
from __future__ import annotations

import json
import time
from pathlib import Path

from ingest import ingest_file, build_tourneys_json, ARCHIVE

HERE = Path(__file__).resolve().parent
CONFIG = HERE / "config" / "watcher.json"

DEFAULTS = {
    "watchDir": None,  # EDIT ME: OOTP save folder that contains online_data/
    "targetFile": "online_data/statistics_player_statistics_-_sortable_stats_export.csv",
    "storageDir": str(ARCHIVE),
    "intervalSeconds": 5,
}


def load_config() -> dict:
    if not CONFIG.exists():
        CONFIG.parent.mkdir(parents=True, exist_ok=True)
        CONFIG.write_text(json.dumps(DEFAULTS, indent=2))
        raise SystemExit(
            f"Created {CONFIG} — edit 'watchDir' to your OOTP save folder "
            "(the one containing online_data/) and rerun.")
    cfg = {**DEFAULTS, **json.loads(CONFIG.read_text())}
    if not cfg["watchDir"]:
        raise SystemExit(f"'watchDir' not set in {CONFIG}")
    wd = Path(cfg["watchDir"]).expanduser()
    if not wd.exists():
        raise SystemExit(f"Watch folder does not exist: {wd}")
    cfg["watchDir"] = wd
    return cfg


def prompt_id() -> str:
    while True:
        tid = input("Enter numeric tourney ID (quicks: quick ID; dailies: last 3 digits): ").strip()
        if tid.isdigit():
            return tid
        print("ID must be numbers only.")


def watch(label: str) -> None:
    cfg = load_config()
    target = cfg["watchDir"] / cfg["targetFile"]
    interval = float(cfg["intervalSeconds"])
    label = label.strip().lower().replace(" ", "")

    print(f"Watching : {target}")
    print(f"Archive  : {cfg['storageDir']}")
    print(f"Label    : {label}")
    print("Waiting for exports… Ctrl+C to stop.\n")

    handled: set[str] = set()
    while True:
        try:
            if target.exists():
                tid = prompt_id()
                dest_name = f"{label}_{tid}.csv"
                if dest_name in handled:
                    print(f"Already handled {dest_name} this session; ignoring.")
                    target.unlink()
                else:
                    dest = ingest_file(target, ttype=label, tid=tid)
                    target.unlink(missing_ok=True)  # consumed
                    handled.add(dest_name)
                    summary = build_tourneys_json()
                    print(f"✓ Archived {dest.name} and rebuilt tourneys.json "
                          f"({summary['tourneys']} tourneys, types: {list(summary['types'])})\n")
            time.sleep(interval)
        except KeyboardInterrupt:
            print("\nWatcher stopped.")
            return
