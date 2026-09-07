#!/bin/bash
# Watch Tourney Stats — leave this running while you export stats out of OOTP.
#
# Since 2026-09-07 this is simply "File OOTP Exports.command --watch": the same
# one-dialog filer (fingerprint-ranked LIKELY rows, exact ids from the dumps,
# never overwrites), started straight in watch mode. Each export is caught the
# moment it lands, filed to Archive/Completed + the DCFC queue, and imported
# into the app's database right away; the projection model is refit when you
# quit (Ctrl-C, or 10 quiet minutes). Nothing else to run.
#
# The old version of this file snapshotted exports to Inbox/Tourney Stats and
# identified them against a hand-written worklist (scripts/claim-export.ts);
# that is superseded - the filer scans Inbox/Tourney Stats too, so anything
# left there is picked up on the next run.
exec /usr/bin/env python3 "$HOME/Desktop/OOTP Perfect Team/File OOTP Exports.command" --watch
