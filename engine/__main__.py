"""CLI for the OOTP Perfect Team data engine.

Run from the repo root with the project venv:
    .venv/bin/python -m engine <command>

Commands:
    config          Rebuild tournament/draft config + RE contexts from
                    data-src/OOTP26 Historic Tourney_Draft List.xlsx
    ingest [FILES]  Ingest tourney export file(s) into the archive, or with no
                    args just rebuild tourneys.json from everything archived
    watch --label L Watch OOTP export folder; archive+ingest each new export
    build           config + ingest (full data refresh)
                    NOTE: card projections rebuild (projections.py) still
                    requires the collection re-export with CID — see PROGRESS.md
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # flat intra-engine imports


def main() -> None:
    ap = argparse.ArgumentParser(prog="engine", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("config", help="rebuild tournaments.json + contexts.json from xlsx")

    p_ing = sub.add_parser("ingest", help="ingest tourney export(s) + rebuild tourneys.json")
    p_ing.add_argument("files", nargs="*", help="export CSVs (named <type>_<id>*.csv)")

    p_watch = sub.add_parser("watch", help="watch OOTP export folder (replaces R watcher)")
    p_watch.add_argument("--label", required=True,
                         help="tournament label for this batch, e.g. diamondslotsdaily")

    sub.add_parser("build", help="config + ingest (full refresh of derived JSON)")

    args = ap.parse_args()

    if args.cmd == "config":
        import config_build
        print(json.dumps(config_build.build(), indent=2))
    elif args.cmd == "ingest":
        import ingest
        for f in args.files:
            dest = ingest.ingest_file(f)
            print(f"archived: {dest}")
        print(json.dumps(ingest.build_tourneys_json(), indent=2))
    elif args.cmd == "watch":
        import watcher
        watcher.watch(args.label)
    elif args.cmd == "build":
        import config_build, ingest
        print(json.dumps({"config": config_build.build(),
                          "tourneys": ingest.build_tourneys_json()}, indent=2))


if __name__ == "__main__":
    main()
