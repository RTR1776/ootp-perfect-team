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
- `Docs/Tourney Exports To Grab 2026-10-03.md` (the newest of these) lists the played events with no export on file. Ask the cloud Claude to refresh it, or work down the screen and skip anything already filed.
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
