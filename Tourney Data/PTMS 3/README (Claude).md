# PTMS 3 field rankings (2026-11-21)

Our pre-tourney ranking of every team in each PTMS 3 event, built from the event's stats export. It's kept here so we can grade it once the event finishes.

## How a ranking is made

1. **Rosters.** Each team's roster is the set of cards listed for it in the export.
   - The export only lists cards that played (survivor bias). A team with 19–22 cards listed is missing unused bench or pen cards, so it reads slightly weak.
2. **Scoring.** Each roster is arranged and scored by `env-roster --pool-ids` (exact fixed-pool solve) in the event's run environment.
   - No glove floors, because L.J.'s floors penalised other teams' rosters by up to 30 runs.
   - No observed play (`--obs-k 0`), so nothing from the run itself leaks in.
   - Variants play as base copies. `varadj.py` then adds each placed variant's rating gain (the variant row minus the base, about 8%). Gains are priced at the run's own +10-rating table and weighted by slot: R board 0.7, L board 0.3, SP 1, pen 0.93, bench 0.1. The lineup is not re-solved around them.
3. **Strength.** Strength is the roster objective, converted to runs per game at one lineup slot's PA per game: 700 ÷ (27 ÷ (1 − OBP) ÷ 9). That is 156 in PD 1 and 162 in T1.
4. **Odds.**
   - Each game's odds come from Pythagenpat, exponent (2 × R/G)^0.287, at the event's R/G.
   - A best-of-9 series is first to 5.
   - The bracket is 128 single-elimination slots with a random draw, 20,000 simulations. Seeds are unknown.
   - Slots with no team listed are blank rosters: their opponent advances.
5. **No shrinkage.** The model's spread is used as is. Grading will show whether it's too wide or too narrow.

## Running a new event

Export the event's stats from OOTP. Every export overwrites the same `online_data` file, so file each one right away. Then:

```
FR="web/scripts/.scratch/field-rank"
$FR/run.sh "<export.csv>" <out dir> --year <RE year> --park "<park>" --park-year <yr> [--dh] --sp 5 --rp 6 --bats 15
python3 -I $FR/parse.py <out dir> && python3 -I $FR/varadj.py <out dir> && python3 -I $FR/sim.py <out dir> 20000
```

119 teams take about 80 seconds. A rerun of PD 1 reproduced every score exactly.

## Events

| Event | Export | Ranking | Our team |
|---|---|---|---|
| PD 1 Low of Lows (9130004) | `PD1 Low of Lows 2026-11-21 export 1042.csv` (mid round 2, 119 teams) | `PD1 … pre-tourney ranking (Claude, model only).csv` | Kansas City Torrent - JW, 81st of 119, 48% to beat an average team in a BO9, out 2-5 |
| T1 Open (9130001) | `T1 Open 2026-11-21 export 1059.csv` (round 2, 113 teams) | `T1 Open pre-tourney ranking (Claude, model only).csv` | Kansas City Torrent - JW, 27th of 113, 67% to beat an average team in a BO9, out 3-5 |

## Early check (PD 1, not a grade)

The export covers 510 games, about 8 per team.

- **Correlation:** strength vs win% so far gives r = +0.16.
- **By thirds of our ranking:**
  - Top third: 182-143 (.560).
  - Middle third: 191-160 (.544).
  - Bottom third: 160-185 (.464).
  - The model expected about .529 for the top third and .470 for the bottom.
  - Each third's win% has an SE of about ±.027.
- **Blank rosters:** wins over blank-roster teams inflate every third.

A real grade needs the pairings (who played whom) to score series favourites and a Brier score. The export doesn't have them.

## Early check (T1, not a grade)

The export covers 990 team-games.

- **Correlation:** strength vs win% so far gives r = +0.23.
- **By thirds of our ranking:**
  - Top third: 192-141 (.577).
  - Middle third: 161-153 (.513).
  - Bottom third: 176-167 (.513).
- **Selection:** win% in an unfinished bracket is biased. Round-1 winners have played more games, and wins over blank rosters land wherever the draw put them.
- **Chester Surge** is an all-Iron roster (VAL 44–59) entered in the Open. It sits last at −4.9 R/G.

## T1 round 1 graded (2026-11-21)

**Pairings.**
- Taken from L.J.'s bracket screenshots.
- Labels were mapped to full names with the T1 save's `teams.dat`, which holds city, abbreviation, nickname and full name. The parsed table is in `T1 Open teams (from save teams.dat).json`.
- Repeated labels were settled by each team's export record:
  - two WR, two PUMP, two CHI and two CHA;
  - three Hurricanes;
  - CIB, HOU and DC.
- Every mapped team's bracket score agrees with its export W-L.
- The cut-off row opposite PURP (Shakedown 1977 Microbus) is Cibao Aguilas, the only export team left.
- Script: `field-rank/grade.py`.

**Results, 50 of 64 series scored** (both teams with a roster):

| Measure | Ours | Friends' card |
|---|---|---|
| Favourites won | 33 of 50 (66%), expected 35.6 | 31 of 50 (62%), expected 31.5 |
| Brier score | 0.243 | 0.234 |
| Log loss | 0.700 | — |

- **Baselines:** a 50/50 guess scores Brier 0.250 and log loss 0.693. The higher card-value total won 29 of 50 (58%).
- **Calibration by favourite strength:**

  | Favourite's odds | Won | Expected |
  |---|---|---|
  | 50–60% | 12 of 17 | 9.6 |
  | 60–70% | 3 of 6 | 3.9 |
  | 70–80% | 8 of 12 | 8.9 |
  | 80%+ | 10 of 15 | 13.2 |

  The spread is too wide at the top.
- **Spread test (indicative only; fitted on the same 50 series):**

  | Spread × | Brier | Log loss |
  |---|---|---|
  | 0.75 | 0.235 | 0.666 |
  | 0.5 | 0.231 | 0.651 |
  | 0.35 | 0.231 | 0.652 |

  Confirm on PD 1 and the other events before adopting a shrink.
- **Biggest misses:**
  - Hellcats GH (95%) lost 4-5 to Murderhawks (ranked 107th).
  - Spiders (87%) lost 1-5 to Preguntas (92nd).
  - Vaqueros (86%) lost 4-5 to Mayport (87th).
  - Whalers (83%) lost 4-5 to EVC's (110th).
- **Us:** Albion vs Torrent was 52/48 by the model; we lost 3-5.

## T1 rerun on full rosters (2026-11-21, supersedes the export-only grade)

**Rosters.**
- The save's roster log (`pt_rosters.py` on a copy of `7ea10000000000000001550a.pt`) has 25 cards per team, logged once at the start (all dated 1988-04-01).
- For 101 teams, save plus export comes to 26 or fewer cards, and that is the roster used.
- For 12 teams, save plus export ran to 27–31 cards. The save lists cards that never played, while regulars who did play are missing from it. Example: Utley played 10 of Dock Ellis's 12 games and isn't in their save roster. Those 12 teams use the export alone.
- Result: 99 teams now have all 26 cards, against 27 before.

**Effect on the ranking.**
- Old and new scores correlate at r = 0.978.
- The teams that moved were the ones missing unused arms. With the pen weighted 3× in this era, an empty pen slot costs a lot.
  - SafeZone: 98th → 62nd.
  - Charlotte Aviators: 60th → 26th.
  - Rascals: 43rd → 15th.
  - Us: 27th → 10th.
- Top three now: Providence 10.8%, Boston 8.2%, Gamehendge 7.0%. All three had byes, so their exports were thin.

**Round 1 regraded (50 series):**

| Measure | Full rosters | Export only |
|---|---|---|
| Favourites won | 31 of 50 (62%), expected 36.1 | 33 of 50 |
| Brier score | 0.239 | 0.243 |
| Log loss | 0.689 | 0.700 |
| Higher card value won | 31 of 49 (63%) | 29 of 50 |

- Friends' card: 31 of 50, Brier 0.234.
- **Spread test on full rosters:**

  | Spread × | Brier |
  |---|---|
  | 0.75 | 0.231 |
  | 0.5 | 0.227 |
  | 0.35 | 0.228 |

  The overconfidence is still there: 80%+ favourites won 10 of 15 against 13.2 expected.
- **Us:** the model now has us as the 58% favourite over Albion. We lost 3-5.

## T2, T3 and PD 3 ranked from the saves (2026-11-21, mid-event; we're in round 3 of all three)

**Rosters.**
- Read from the saves with `field-rank/pt_rosters_live.py`. This is a copy of `ootp-saves/pt_rosters.py` that also reads Live-card titles, which end in a team code instead of a year. The original missed 357 of PD 3's 2,499 cards, including two of ours.
- All four saves now match every card.
- T2 and T3 have 25 of 26 cards per team: the save logs one fewer than the roster size. PD 3 has all 21.

**Scoring.**
- No export yet, so there's no variant step. That only matters in T2 (variant cap 10).
- Staff shape is per team: 5 SP, with the pen and bench taken from the team's own arms.

**Our pre-tourney rank:**

| Event | Rank | Title odds | BO9 vs an average team |
|---|---|---|---|
| T2 Iron | 14th of 110 | 1.5% | 57% |
| T3 Slots | **1st of 108** | 4.7% | 68% |
| PD 3 | **1st of 119** | 3.8% | 66% |

**From round 3** (`field-rank/path.py`, random draw, conditional on reaching round 3):

| Event | Title | Final | Semi or better |
|---|---|---|---|
| T2 | 4.5% | 8.6% | 16% |
| T3 | 10.0% | 16.2% | 26% |
| PD 3 | 8.3% | 14.2% | 24% |

T1 grading showed the model is overconfident at the top, so the T3 and PD 3 numbers are probably high.

**PTMS points by elimination round** (read off the PTMS 2 standings): R1 5, R2 10, R3 20, R4 35, QF 50, SF 75, final 100, title 125.

**L.J.'s totals:**
- Tourney: T1 5, plus T2 and T3 at 20 or more each. Floor 45; expected about 94.
  - 47% chance of 90+ (PTMS 2 rank about #9–12).
  - 17% chance of 150+ (#3).
- Drafts: PD 1 5, PD 2 10, plus PD 3 at 20 or more. Floor 35.
  - 37% stays at 35 (below #35 on PTMS 2).
  - 24% reaches 65+ (about #20).
  - 8% reaches 140 (#5–7).

The placements are mapped onto PTMS 2's final standings. PTMS 3's spread of points may differ.

## PTMS 3 prize cards (from L.J.'s screenshots, 11-21) and what we're likely to get

**Prize tiers** (the top 2 weren't sent; L.J.: "they are good"):

| Place | Prize |
|---|---|
| 3rd–4th | 3B Nolan Arenado 103 (2019) |
| 5th–8th | LF Lance Berkman 98 (2001, S) |
| 9th–16th | SS Arky Vaughan 92 (1941) |
| 17th–32nd | SP James Paxton 88 (2017, LHP) |
| 33rd–64th | LF Mike Donlin 83 (1904) |
| 65th–128th | SP Jose Quintana 59, RF Nelson Cruz 68, 1B Stan Musial 78 |

L.J. (11-21): each standing pays separately, tourney and draft, with one winner each, so he gets one prize card per standing. The 65th–128th tier shows three cards.

**Where a points total ranks** (equal-strength model, 128 teams; matches PTMS 2's final tables within a rank or two):

| Points | Rank |
|---|---|
| 35 | #51–62 |
| 45 | #39–47 |
| 50 | #32–38 |
| 60 | #24–29 |
| 65 | #19–23 |
| 75 | #16–18 |
| 90 | #11–12 |

**L.J.'s tourney standing, chance of each prize:**

| Prize | Chance |
|---|---|
| Top 2 | ~9% |
| Arenado | ~10% |
| Berkman | ~21% |
| Vaughan | ~7% |
| Paxton | ~37% |
| Donlin (floor) | ~16% |

**Draft standing** (confirmed to pay the same tiers):

| Prize | Chance |
|---|---|
| Berkman | ~14% |
| Vaughan | ~10% |
| Paxton | ~15% |
| Donlin (floor) | ~61% |

**League value** (`league-compare`, PEL 2014 at 1987 Yankee Stadium, current 13 bats):
- Only Arenado starts: 3B on both boards, +8.6 runs a season (+0.8 W).
- Berkman, Vaughan, Donlin, Musial and Cruz add 0.
- The cards aren't in the catalogue yet. Each was priced with its card-face split ratings and position rating laid over a stand-in card of the same position and hand, so speed and baserunning come from the stand-in.

## Live update (11-21, mid round 3)

**Round-3 series:**

| Event | Score | Opponent (our rank) | Model odds before game 1 | Model odds now | Friends' tool |
|---|---|---|---|---|---|
| T2 | Won 5-0 | Phoenix Mango Slush (107th of 110) | 75% | done | 83% |
| T3 | Up 3-0 | Country Clubbers (25th) | 62% | 93% | 90% |
| PD 3 | Up 3-0 | Chicago Beans (25th) | 58% | 92% | 88% |

**Updated totals** (`path.py` from round 4; placements from PTMS 2's final tables, falling back to the equal-strength model below them):
- Tourney floor is now 60.
  - Top-2 prize (165+ points): ~23%. PTMS 2's table splits 1st and 2nd poorly.
  - Arenado ~13%, Berkman ~25%, Vaughan ~19%, Paxton ~20%.
  - 75 points sits on the #16/#17 line between Vaughan and Paxton.
- Draft floor is 35 (50 once PD 3 round 3 is won).
  - Berkman ~21%, Vaughan ~14%, Paxton ~22%, Donlin ~43%.

## Live standings simulation (11-21 ~13:05)

**Method.**
- The friends' live tool tables (tourney top 24; drafts top 37) are transcribed in `live … standings … .json`.
- `field-rank/standsim.py` plays each event's remaining bracket jointly among its alive teams, so there are at most two finalists per event.
  - Visible teams get our model's strength: T1 from full rosters, T2, T3, PD 1, PD 2 and PD 3 from the saves. PD 1 and PD 2 were re-ranked from their saves: we're 70th and 67th.
  - Unseen alive slots get a random non-visible team's strength, with secured totals of 35 (round 3) or 45 (round 4).
  - Pairings are random apart from our two live series: T3 vs Country Clubbers at 92.9%, PD 3 vs Chicago Beans at 91.8%.
- Placement ties break by seed, and we don't know our seed, so ties are shown three ways.

**Tourney** (we have 60 secured, T7):

| Prize | Chance |
|---|---|
| 1st | ~9% |
| 2nd | ~13% |
| Arenado | ~13% |
| Berkman | ~20% |
| Vaughan | ~30% |
| Paxton | ~15% (12–19% depending on ties) |
| Donlin | 0% |

**Draft** (we have 35, T35):

| Prize | Chance |
|---|---|
| 2nd | ~5% |
| Arenado | ~8% |
| Berkman | ~9% |
| Vaughan | ~14% |
| Paxton | 22–43%, by ties |
| Donlin | 19–42%, by ties |
| 65th–128th | up to 8% (only if PD 3 round 3 is lost and ties go against us) |
