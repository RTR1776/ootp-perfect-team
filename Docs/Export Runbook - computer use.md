# Exporting tourney stats with computer use (Claude desktop app)

For a Claude session in the desktop app on L.J.'s Mac, with Computer use on
(Settings → Desktop app → Computer use). The old `Grab Tourney Stats.command`
clicked blind coordinates and filed the wrong event whenever the list moved;
here every click is decided from a fresh screenshot.

## Before starting (L.J.)
1. OOTP open on **Your Tournaments**, list scrolled to the top, **Auto-Refresh set to None** (otherwise rows re-sort mid-run).
2. Double-click **`Watch Tourney Stats.command`** and leave its Terminal open. It catches each export the moment it lands in `online_data`, shows one dialog with the likely event pre-selected, files it to `Archive/Completed`, and imports it.
3. Approve OOTP (full) when Claude asks. Don't touch the mouse while it runs; to stop it, say so in the chat.

## What to export
- The newest `Docs/Tourney Exports To Grab <date>.md` (10-03 as of this edit) lists the played events with no export on file. Ask the cloud Claude to refresh it, or work down the screen and skip anything already filed.
- Skip drafts (PD Daily / PD Weekly rows); they've never been exported. Skip EF pop-ups and Quicks.
- Work **oldest first**, because Your Tournaments drops events after about a week.

## The loop (Claude), one event at a time
1. Screenshot. Find the target row by its **name and id in parentheses**, e.g. `Daily Low Bronze Only (1220198)`, never by row position.
2. Open it (EXAMINE), go to **Statistics → Sortable Stats**, keep the **cwhit** view, then **Report → Write to CSV**. Screenshot after each click to confirm the screen changed as expected.
3. Switch to the Watch Terminal's dialog. Check the pre-selected row matches the event **and id** just exported; if not, pick the right one (✎ row to type an id). Field size is in the TEAMS column (64 / 128 / 256).
4. Go back to Your Tournaments, screenshot, and confirm the list is where it was before taking the next one.
5. If anything looks off (wrong screen, a dialog that's not the filer, rows moved), stop and tell L.J. rather than guess. An overwrite or a misfiled export costs that tournament's data.

## When done
Quit the watcher (Ctrl-C, or 10 quiet minutes) so the model recalibrates, run `Push to GitHub.command`, and tell the cloud Claude so it can recheck the gap list.

## What actually worked (cloud session, 2026-10-03): use this, not the watcher

**The watcher can't be used from a Claude session.** Its picker is an `osascript` dialog. Computer use can't grant osascript, so Claude can't see or click the picker. And because the guessed id comes from the file's timestamp, it's wrong for back-fills anyway. Every export overwrites the same file, so an unanswered picker blocks the run.

**Setup:**
1. L.J. stops the watcher (Ctrl-C; Claude only gets click access to Terminal).
2. Grant folder access to `~/Application Support/Out of the Park Developments/OOTP Baseball 27/online_data`.
3. Grant OOTP Baseball 27, and approve full-screen control. Background `app_*` clicks are ignored by OOTP.

**Filer:** `web/scripts/.scratch/file-export.py <slug_run> <field size>`. Copy it to the device shell's `$HOME` and run it right after each export. It:
- checks the 200-column Export All View header, the team count (≥80% of the field), that the file is newer than the last one filed, and that its hash differs from recent files (catches a stale re-export);
- prints the VAL and card-year ranges, so you can check them against the event's rules;
- copies the file to Archive/Completed and the DCFC Upload Queue under the exact id from the row;
- moves OOTP's original into `online_data/filed by Claude/`.

The paths assume the device shell's `~/mnt/online_data` and `~/mnt/OOTP Perfect Team` mounts. Seed `~/fileexp_state.json` before the first run (see the script).

**Clicks:**
- Every click is press-and-hold: mouse_move, wait 0.4 s, left_mouse_down, wait 0.2 s, left_mouse_up. Plain clicks are swallowed.
- Coordinates are for the HP 27m in the 1456×819 frame.
  - EXAMINE column x = 1358. Rows are 19.6 px apart; the first row is at y = 187.
  - TOURNAMENT menu (492,20) → Statistics (432,142).
  - Sortable Stats tab (700,186). The VIEW must read "Export All View" (that is the 200-column view the archive uses).
  - REPORT (842,247) → Write report to csv (862,291). The COMPLETE box's OK is at (847,466).
- Wait about 12 s after EXAMINE. After the Sortable tab, wait 6 s for 64/128 fields and 10 s+ for 256 fields; a REPORT click while the table is still loading does nothing.

**Getting back to the list:**
- MAIN (218,20) → OOTP Start Screen (251,268).
- Wait **15 s**; an earlier click is swallowed.
- SHOW TOURNAMENTS (880,470), wait 10 s. Then the YOUR TOURNAMENTS tab (368,52), wait 6 s. The list comes back at the top with Auto-Refresh still None.
- **Never** chain "open the row" onto the return trip in one batch. If the tab click is swallowed you are on the Tournaments tab, where x = 1358 is SIGN UP / PLAY NOW.

**Checks that caught problems on 10-03:**
- Zoom the row (name + id) just before clicking. After the event opens, zoom the title bar at (700,0)-(1100,30) and only file if the name matches.
  - One click landed a row high: Dead Silver Walking opened instead of Bronze 1910-59. The title check caught it, and it was filed under its own name.
  - Click about 3 px below the row's center.
- A "Congratulations" popup appears when opening an event L.J. won. It blocks every click until its OKAY (726,599) is pressed.

**When done:**
- Import from the device shell (Node works there, and the Neon URL is reachable). Run `node --import tsx scripts/import-observed.ts --series <slug>` in web/ with DATABASE_URL from .env.local, then run `scripts/model-calibrate.ts` the same way (about 3 min; run it with nohup).
- Append to Archive/import-log.txt.
- L.J. runs `Push to GitHub.command` (model-calibration.json and field-construction.json change).

## 2026-10-07 run (cloud session linked to the Mac): what changed

- **Filed 21 events in about 40 minutes.** Each one took three calls: open the event and go to Sortable Stats, export and return to the list, then run the filer alongside the next open.
- **Window layout:** OOTP's window sat about 38 px left of the 10-03 layout. Coordinates in the 1456×819 frame:
  - TOURNAMENT menu (454,67) → Statistics (400,189). Sortable Stats tab (688,233).
  - REPORT (800,294) → Write report to csv (822,337). Complete box OK (804,489).
  - MAIN (178,67) → OOTP Start Screen (212,314). **Quit OOTP sits just below it at y≈369.** Zoom the item before clicking.
  - Start screen: SHOW TOURNAMENTS (804,518). YOUR TOURNAMENTS tab (348,99).
  - Rows: EXAMINE x=1320. A Congratulations popup's OKAY is at (688,622).
- **Scroll position is stable.** Mouse at (200,600), scroll down 25 ticks. The list lands in the same spot every time: row k at y = 233 + 19.72·k, with Early Bronze 1170204 at k=0 and Splendid Silver 1510028 at k=27 on 10-07. The 10-04 rows above k=0 need less scroll.
- **Batch limit:** the bridge refuses a batch with more than ~50 s of total waits. Stats chain plus export plus return is too much for one batch, so split it into two.
- **DCFC Upload Queue is gone.** `Make cwhit Upload Folder.command` retired it, so the filer no longer copies there.
- **Screen lock kills capture.** When the Mac locks, screenshots fail with "SCContentFilter failure". Set the screen saver and lock to at least the length of the run.
- **Clicking OOTP Start Screen needs a go-ahead.** The permission check refused that click until L.J. approved it in chat.
- **Imports:** run `import-observed.ts --series <slug>` for each series, and use `timeout 40` to stay under the shell limit.
