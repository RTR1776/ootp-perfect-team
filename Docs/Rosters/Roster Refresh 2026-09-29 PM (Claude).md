# Roster refresh, 2026-09-29 PM: the rest of the current events

L.J.: "do this same exercise for all the current tourney rosters that aren't updated". After `Save New-Card Rosters.command` (run 22:14Z), nine events held a pick built on the 09-29 afternoon collection (upload 173). These ten didn't. Each is rebuilt on upload 173, with every variant's base copy implied. `Save Remaining Rosters.command` saves them as "Claude pick 2026-09-29 PM".

Each is built as its first pick was: 26 cards, 14 bats / 5 SP / 7 RP, role trust 0.25, the optimiser from 16 starts (32 for Bronze Cap). The dry run passes every event's rules. Where an event's format changed, its old-format exports are left out (`--obs-exclude`).

| Event | Rules built to | Score | Against the saved pick |
|---|---|---|---|
| Saturday Iron Warriors (534) | 1991 RE, 1991 Cleveland Stadium, DH, 40–59 | −97.2 | 17 of 26 change. The 09-26 pick was ratings only, before any Iron play was on file. In: Shawn Green (LE), Justin Verlander (58), Bullet Campbell, and the Baez, Andruw Jones, McDonald and Todd Jones variants |
| Friday Danksville (570) | 1987 RE, 1977 Kingdome, DH, 40–49 | −200.6 | 10 change (the old pick was model only, from the eligible-cards export) |
| Saturday Negro Leagues Slots (779) | NLS only, P4 D4 G4 S4 B5 I5, PT default RE, 2026 Coors Field, no DH | 64.0 | 11 change. In: the three new NLS cards (Pat Patterson, Halley Harding, Hubert Lockhart), plus the Lennie Pearson variant, Dave Brown and Sam Streeter |
| Saturday Diamond Variety (541) | 1952 RE, 1958 Tiger Stadium, no DH, cards 1910–59, 40–99 | 183.6 | 19 change. The saved pick was for the old format (1975 RE, NLS/FL/Snap). The 09-26 pick for this format was never saved |
| Saturday Bronze Cap (535) | 2016 RE, 2025 Standard Stadium, DH, 40–69, cap 1386 | 21.3 | 3 change: Sammy Sosa, the McDougal variant and Ron Robinson in, for the Witherspoon variant, Reed Garrett and Charlie Eden |
| **Friday Nightmare Cap (569)** | **New format from 10-02:** 65–79, no LE, cap 1805, variant cap 6, 1971 RE, 1970 County Stadium, no DH | 102.1 | A new roster: the saved one was for the old 50–74 format. It uses all 1805 of the cap and 6 variants |
| Daily Early Bronze (525) | 1942 RE, 1945 Wrigley Field, no DH, up to 69, no variants | 44.3 | Edward Florentino for Bill Buckner |
| Monday Now We're into the Dregs (548) | 1994 RE, 1996 Dodger Stadium, DH, 50–64, cap 1468 | −6.2 | 7 change (the saved pick is from 09-28). In: the Buckner and Griffey variants, Verlander (58), Jim Tabor, Rick Wilkins, Sam Huff, Franco Aleman |
| Daily Live Bronze (561) | Live only, 2026 Kauffman Stadium, DH, 40–69 | −147.5 | Unchanged; re-saved so Build stops flagging it |
| Daily Bronze Only Curiosities (527) | UH/SS/RS, 2005 Minute Maid Park, DH, 60–69 | 37.4 | Unchanged; re-saved so Build stops flagging it |

Scores are on each event's own scale; compare them within a row, never across rows.

## Friday Nightmare Cap's new rules

- **The catalogue held the old format:** 50–74, cap 1559, no variants (L.J. confirmed it 09-25).
- **PT's 09-19 post** changes it to "High Bronze Floor-Silver Ceiling, No LE, 1805 cap, 1971 RE, DH off, Variant Cap 6, 1970 Milwaukee County Stadium". The new format first runs Friday 10-02.
- **The script sets:** value 65–79, cap 1805, variant cap 6 and No LE. The old rules are kept under previousFormat.
- **The app can now hold a "No LE" rule:**
  - `restrictions.noLimitedEdition`
  - `catalogue:set --no-le`, and `--variant-cap N`
  - `env-roster --no-le`
  - Build, Played and Draft all pass each card's LE flag to the rule check.
- **Check it in game before Friday:** the value floor. "High Bronze" is read as 65, since Low Bronze runs 60–64.

## Load files

In `Inbox/rosters/`, every card pinned by id:
- `ironwarriors-claude-2026-09-29pm.txt`
- `danksville-claude-2026-09-29pm.txt`
- `nelslots-claude-2026-09-29pm.txt`
- `diamondvariety-claude-2026-09-29pm.txt`
- `bronzecap-claude-2026-09-29pm.txt`
- `nightmarecap-claude-2026-10-02.txt`
- `earlybronze-claude-2026-09-29pm.txt`
- `dregs-claude-2026-09-29pm.txt`
- `livebronze-claude-2026-09-29pm.txt`
- `bronzecuriosity-claude-2026-09-29pm.txt`
