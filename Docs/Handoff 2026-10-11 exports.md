# Handoff, 2026-10-11 (afternoon): tourney exports paused for a break

Read after `Handoff 2026-10-03.md`. Method: `Export Runbook - computer use.md`, full-screen coordinates as in the 10-11 prompt.

## Filed this session (26, all checked by file-export.py, in Archive/Completed)
silveronlycapdaily_205 (no leftover file was in online_data, so it was re-exported), wonkyslots_29 (slot 143),
bronzeootp_189, goldfloorcapweekly_29, diamond1990onward_26, silverslotsdaily_206, upto1969weekly_29,
liveplus_189, openslotsdaily_206, lowsilveronly_35, goldfather_206, bronzeonlycapdaily_207, sandlot_29,
silverslotsdaily_207, diamondupto1969_190, 1950tonow_29, openslotsdaily_207, late1900s_134,
silversnapshots_204, diamondweekly_29, bronzeptcs3_134, latesilver_208, deadballweekly_29,
silverweekly_29, goldslotsdaily_208, lowdiamondonly_208.
Not imported yet. Model not recalibrated. Not pushed.

## Left on Your Tournaments (oldest first; all fit on the unscrolled top view)
Silver & Friends 1900135, Gold Cap 1300208, Bronze OOTP 1820192, Goldfather II 1290208,
Diamond Jumble 1800209, Thursday Night Gold Rush 1530029 (256), CWhit's Say My Name Cap 1870022,
Silver Slots 1270209, Friday Nightmare Cap 1540029, Diamond Up to 1969 1850192, Gold Slots 1320209,
All-Star Hardware Slots 1390206 (32), Open Slots 1410209, Silver Snapshots 1650206, Bronze OOTP 1820193,
Goldfather II 1290209, Late Silver 1240210, Friday Night Live Slots 1560030, and yesterday's:
Negro Leagues Slots 1950019, Diamond Up to 1969 1850193, Gold Slots 1320210, Bronze Cap 1580030,
Goldfather II 1290210, Late Silver 1240211, Diamonds are Forever 1670207, Diamond Variety 1590030.
Check slot-map.json for slugs of slots 139, 156, 195, 158, 159, 167 before filing.

## Gotchas found today
- **Scroll is laggy.** OOTP sometimes holds wheel events and applies them on the next click. Twice that opened the wrong event (the title check caught both, and nothing was misfiled). Now that the remaining rows fit on the top view, don't scroll at all: rows are at y = 187 + 19.73·k.
- Hover over EXAMINE, then zoom the row again just before mouse-down, and check the title bar after it opens.
- Congratulations popup OKAY is at (726,599).
- The device-shell `~/filed.txt` and `~/fileexp_state.json` are per-session. Re-seed the state file (see file-export.py) in a new session.
