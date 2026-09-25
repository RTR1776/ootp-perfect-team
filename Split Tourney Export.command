#!/bin/bash
# Double-click after exporting a finished tournament with the FULL all-stats view.
# Asks for the event id (the 7 digits after the name on Your Tournaments) and
# writes the all-stats file (TTTSSSS.csv) and cwhit's file (<series>_<run>.csv).
cd "$HOME/Desktop/OOTP Perfect Team" || exit 1
while true; do
  read -r -p "Event id (e.g. 1510027), blank to quit: " ID
  [ -z "$ID" ] && break
  python3 split_export.py "$ID"
  echo
done
