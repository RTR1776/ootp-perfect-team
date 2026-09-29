# Roster refresh — 2026-09-29

L.J. pulled the Steve Pearce and Joe Dugan variants, uploaded a new collection and shop list, and loaded the 09-29 dump. His question: how do recommended buys, lineups and the rest pick up new cards?

Every Claude-made Bronze roster was rebuilt on the 09-29 collection (upload 171), with the same rules and settings as the pick it replaces. `Refresh Rosters.command` saves the ones that improved as "Claude pick 2026-09-29"; the older picks stay under their own names. Every load file passes `roster:save --dry` against its event's rules.

| Event | Old pick | Rebuilt | What changed |
|---|---|---|---|
| Daily Bronze PTCS 3 Replay Slots (773) | 112.8 | 119.4 | Pearce (VAR) in LF vs RHP and at 1B vs LHP; Dugan (VAR) at 3B vs LHP; Cardenas out |
| Monday Up And At Them Bronze (536) | 67.3 | 75.1 | Pearce (VAR) in LF; Steve Sax, Andruw Jones (VAR) and Liranzo (VAR) in; Southworth, Cannizzaro and Grudzielanek out |
| Daily Bronze Only Cap (520) | 78.2 | 86.7 | Pearce (VAR) in LF; Sax, Paige, Grube and Nate Pearson in; McCarver, Randolph, Morgan (VAR), Orze and Wolfram out |
| Daily Late Bronze (524) | 80.7 | 85.7 | Pearce (VAR) in LF; Sax and Jett Williams in; Southworth and Soriano out |
| Daily Bronze Only Curiosities (527) | 26.5 | 30.5 | Dugan (VAR) at 3B for Honus Wagner |
| Saturday Bronze Cap (535), for 10-03 | 12.2 | 20.6 | Pearce (VAR); Incaviglia, Hosey, Witherspoon (VAR) and Daniel Norris in; Sosa, Sheffield, Miller and Ron Robinson out |
| Daily Bronze 1910-59 (584) | −61.8 | −57.7 | Dugan (VAR) at 2B; Paul Waner and Red Kress (VAR) in; Allison (VAR) and Jackie Robinson out |
| Daily Bronze OOTP Era (633) | 58.6 | 64.2 | Pearce (VAR) in LF and at 1B vs LHP; Andruw Jones (VAR) for Spiezio |
| Tuesday Dead Silver Walking (549), for 10-06 | −22.9 | −17.6 | Dugan (VAR) at 3B vs RHP and 2B vs LHP |
| Daily Low Bronze Only (519) | −25.3 | −16.7 | Jim Edmonds, Paul Waner and Steve Sax in; Buckner (VAR), Randolph and Willie Wilson out |

**Not refreshed:**
- **Daily Live Bronze (561):** the rebuild scores the same, −155.4.
- **Monday Now We're into the Dregs (548):** −8.1 to −5.6, but for eight swaps. That's within the optimiser's run-to-run noise, and the current roster reached the quarterfinal of the format's first run, so it stays.
- **Daily Early Bronze (525), held:** the rebuild scores 29.3 to 42.1, but it plays base copies of James McDonald, Adam Cimber and Bill Buckner. Only the 09-29 export shows those; before, he had them as variants, which this event bars. Steve Sax also comes in. The load file is `Inbox/rosters/earlybronze-claude-2026-09-29-held.txt`. It is not in the script; save it once he confirms the base copies are real.

The scores are weighted runs on each event's own scale, so compare them within a row, not across rows.
- **Load files:** `Inbox/rosters/*-claude-2026-09-29.txt`. Dead Silver's is `deadsilver-1920-claude-2026-10-06.txt`: this week's run started before the refresh, and the saved 09-28 pick stays for it.
- **Batting orders:** load a roster on /build to see its batting order under each lineup.

## The collection export lists base copies it didn't before

- **What changed:** the 09-29 export has a base row next to the variant for 152 cards. For 146 of them, both earlier exports (09-25 and 09-27) listed only the variant, for example Dave Brain, Andruw Jones, Mickey Mantle's 68 and Mike Trout's 51. Each extra row carries the base card's own ratings.
- **Why it matters:** if L.J. doesn't own those base copies, an event that bars variants (Early Bronze) or caps them (PTCS 3, Low Bronze Only and Bronze Only Cap) could plan on a base card he doesn't have.
- **The saved rosters are unaffected:** none of the ten in the script plays one of those 146 base copies. The held Early Bronze rebuild plays three (McDonald, Cimber, Buckner). The cards used as base that the 09-27 export didn't have are real new buys: Steve Sax, Paul Waner and Jim Edmonds, released 09-23 and 09-24, one row each.
- **To settle:** check one card in game, such as whether he has both a base Dave Brain and the variant.

## What refreshes by itself, and what doesn't

**On its own**, whenever a page loads, from the newest collection, shop list and dump:
- Build: the pool, Optimise, "Start from recommendation" and the shop's buys
- Market, Era Strength, Played, Cards and the Draft Board
- PTCS standings

**Not on its own:**
- **PTCS berth lines** (which categories to feed): `Load Tourney Dumps.command` writes them, then Push to GitHub deploys them. On 09-29 the lines were written (day 23, through 09-29) and are waiting for Push to GitHub.
- **Saved rosters**, his and Claude's: these are snapshots. They keep the cards they were saved with until someone optimises again or rebuilds them, as here.
- **The Card Model's team sheet**, until the next league export.

## Also fixed: the dump renamed two events back

Loading the 09-29 dump put "Monday Gold Floor Cap" and "Tuesday Up to 1969" back over the Dregs and Dead Silver Walking. Their rules were untouched; only the names reverted.
- **Why:** `catalogue:sync` names each event after its slot's newest title in the dump, and the dump's newest Monday and Tuesday runs were the 09-22 old formats.
- **The fix:** it now leaves the name and field size alone when an event's format started after the slot's newest run in the dump (`dumpPredatesFormat`).
- **Restoring the names:** `Refresh Rosters.command` puts them back.
