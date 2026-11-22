# Sunday PD Main Event (9100247): L.J.'s draft, 2026-11-21 (Claude)

**Saved as roster 2261**, "L.J. draft 2026-11-21 (Claude lineup)".
- Backup: `Docs/Archive/saved-rosters-2026-11-21-2.json.gz`.
- Load file: `Inbox/rosters/sundaypd-main-lj-draft-2026-11-21.txt`.
- Status is "draft": the catalogue row has no format, DH or value window. Same as the PTMS 3 drafts.

## Format

- Original PD, default strategy and stats (read as the 2010 PT default), DH, 2026 Coca-Cola Park (AVG .970/.980, HR .820/.940, 2B 1.008, 3B .730), best-of-7, starts Sun 22 Nov 3:59 PM.
- 13 rounds of 12 cards: P 101+ pick 1; P 100 pick 1; D pick 1; D pick 2; G ×2 pick 2; S ×3 pick 2; B ×3 pick 2; Iron 40-59 pick 5. That's 2 P, 3 D, 4 G, 6 S, 6 B, 5 I.
- Added to `web/src/lib/draft/formats.ts` as `sundaypdmainevent` (not committed).

## The draft

Picks were ranked live by `scripts/.scratch/draft-pick.mts` with the game's position counter.

| Round | Picks | Notes |
|---|---|---|
| 1 | Seager | Weak pack, 16 below a typical one. |
| 2 | Giambi | |
| 3 | Choo | Model's pick was Morejon by 1.2 runs, a tie. |
| 4 | Tatis, Grzenda | |
| 5 | Faucher, Stewart | Model's second pick was Brown, but within noise. |
| 6 | Gibbon, Ruth | |
| 7 | Cervelli, Pfeffer | Catchers went scarce in this round. |
| 8 | McCarthy, O'Flaherty | |
| 9 | Hampton, Peña | |
| 10 | Devers, Bob Miller | 1971 SD reliever, #84716. |
| 11 | Crooks, Meyer | Last catchers dealt. |
| 12 | Buckeye, Lance Johnson | L.J. called the 5-man rotation and the OF glove. |
| 13 | Waldrep, Hershiser, Jordan, Vilade, Dawson | |

Two lessons for the helper:
- The env-roster solver scores an empty SP5 slot as average. That made skipping a 5th starter look about 7 runs better than it is. L.J. caught it.
- The lineup solver once played Stewart (2B 30) at 2B over Peña (2B 91). With L.J.'s floors it plays Peña.

## Lineup

env-roster, `--pool-ids`, L.J.'s floors, 16 starts. Objective 111.1.

**Batting orders:**

| # | vs RHP | vs LHP |
|---|---|---|
| 1 | Choo RF | Cervelli C |
| 2 | Giambi DH | Choo RF |
| 3 | Ruth LF | Giambi DH |
| 4 | Seager SS | Seager SS |
| 5 | Stewart 1B | Stewart 1B |
| 6 | Tatis CF | Tatis CF |
| 7 | Devers 3B | Ruth LF |
| 8 | Peña 2B | Peña 2B |
| 9 | Cervelli C | Devers 3B |

**Staff:**
- Rotation: Hampton, McCarthy, Pfeffer, Gibbon, Buckeye.
- Pen: Faucher (closer), Grzenda, O'Flaherty, Bob Miller, Meyer, with Waldrep and Hershiser as long men.

**Bench:** L. Johnson, Jordan, Vilade, Crooks, Dawson. Jordan is the late defensive sub for Ruth in LF (+4.8).

**Holes:** no backup at 2B, 3B or SS (none was offered after round 4), and Devers is weak against lefties (−21.2).
