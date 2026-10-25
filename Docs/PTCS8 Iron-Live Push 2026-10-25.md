# PTCS 8: Iron and Live push (2026-10-25, day 21 of 28)

L.J.: every tier and Cap is safe, drafts aren't, weekly drafts are coming. So pound the dailies in Iron and Live.

**Standing (ptcs-standing, through 10-24):**

| Category | Points | Gap to the line | Gap to safe |
|---|---|---|---|
| Iron | 6 | 96 | 107 |
| Live | 14 | 122 | 136 |
| PD Daily | 109 | 160 | 187 |

The PD Daily berth is out of reach: three draft slots give about 50 points in 8 days.

## Odds (Monte Carlo, 8,000 draws from his own finish percentiles since 08-01)

| Daily plan | Live | Iron |
|---|---|---|
| 3 Live drafts + 6 Live tourneys (+ Live weeklies) | 150–185 pts, **80–97% to the line** | — |
| + 7 Iron dailies, at his Iron record so far (14 entries, median 71st percentile) | same | ~30 pts, **0%** |
| + 7 Iron dailies, at his normal tourney level (41st percentile) | same | 150–170 pts, **95–99%** |

The range in each cell is 7 vs 8 days of dailies; 13 tourneys a day is at the top of his capacity (4 concurrent).

## The Iron rosters aren't the problem

On the team-strength model, KC's Iron teams rank well:
- **Iron Lunch:** #1 of 82 teams, but went 4-4.
- **High Iron Floor Gold Ceiling:** median rank 0.38 over 7 exports.
- **Danksville (≤49):** 0.23–0.65, mid-pack. The weakest build.

The 71st-percentile record is mostly bad luck in Bo7 brackets over 14 entries. Over 8 days he should play close to his normal level.

**Cards:**
- He owns 1,426 Iron-value cards, all but 78 of the pool. Only 11 unowned ones have an ask.
- Each Iron event was built with and without those 11 (`current-rosters --extra "--assume-owned …"`). The best gain is +2.9 runs.
- **Buy Willy Adames 59 (#83584) at 40 PP:** he starts at 2B vs RHP in Iron & Friends Slots.
- Eichelberger (25k), TJ House (29.7k), Deduno (6.5k) and Deion Sanders (11.9k) make rosters for ≤3 runs. Not worth it.

## Events (all daily unless noted)

**Live + PD Daily (drafts, 64):** Live All Night, Live Breakfast, Pick up the Kids - Live.
- They fill the three draft slots and feed both categories.
- His record there is 1.3–2.6 points per entry.

**Live:** Live Iron (128; also Iron), Live Bronze (128), Live Silver (128), Live Gold (128), Live Diamond (64), Live Open (128).
- **Weekly:** Tuesday Live (256, 10-27), Tuesday Live Lampooning (draft, PD Weekly + Live, 10-27), Friday Night Live Slots (128, Open + Live + Cap, 10-30), Friday Night Live PD (draft, PD Weekly + Live, 10-30).

**Iron:** Dank (64, ≤49), Iron Lunch (128, no variants), Iron Cap (64), Iron Dreamland (64), Late Iron (128), Iron Strikes Back (64), Iron & Friends Slots (32), PTCS 2 Iron Replay (64, some days).
- **Weekly:** Danksville (256, 10-30), Iron Warriors (256, 10-31).

**Daily Live Plus (64, cards 40–105):** **not confirmed to count for Live.** No result of his is on file, and the catalogue has no standings tag. Check the STANDINGS column on Your Tournaments after the first entry.

## Rosters
- **Daily Late Iron:** saved as 1134 on collection 306 (10-25).
- The other Iron events were rebuilt in the buy test; Live events were last built on collection 293.
- After the Live Perfect sales, rebuild Live on 306 before entering.

## Update: rosters on collection 306, and the Championship cards (2026-10-25, later)

**Saved, "Claude pick 2026-10-25 c306":**

| Iron | Roster |
|---|---|
| Dank | 1135 |
| Iron Cap | 1136 |
| Dreamland | 1137 |
| Iron Lunch | 1138 |
| Strikes Back | 1139 |
| PTCS 2 Iron Replay | 1147 |
| Danksville | 1148 |
| Iron Warriors | 1150 |
| Iron & Friends | 1152 |
| Late Iron | 1134 (earlier) |

| Live | Roster |
|---|---|
| Live Bronze | 1140 |
| Live Diamond | 1141 |
| Live Gold | 1142 |
| Live Iron | 1143 |
| Live Open | 1144 |
| Live Plus | 1145 |
| Live Silver | 1146 |
| Friday Night Live Slots | 1149 |
| Tuesday Live | 1151 |

- **Iron & Friends (1152)** is built without Adames, who was bought after collection 306. With him at 2B vs RHP it scores 59.7 against 57.6. Swap him in by hand, or rebuild after the next collection upload.
- **Iron Dreamland (1137):**
  - The 1907 environment sets a starter stamina floor of 80.
  - The build (and the saved 10-24 pick) started Ossie Orwoll VAR at 56. Fixed by hand: Mikolas (84) to SP4, Orwoll to the pen.
  - Lefty Grove (77) is still just under the floor at SP1.

**PTCS 8 Championship (deadball):** Pete Coscarart (#86148, 46, LE ask 15k) and Myril Hoag (#86088, 46, Clubhouse, no ask) make **none** of the seven pre-1946 brackets: Iron, Bronze, Silver, Gold, Diamond, Open and Cap.
- Both were in the pool via `--assume-owned`. Every objective came out identical.
- Even the Iron bracket's RF (Walt French −9.5, Cal McVey VAR −18.3) and 2B (Lajoie, Connie Day) beat them.
- Today's Championship builds on 306 are in `Inbox/rosters/*-2026-10-25-ch8own.txt`. They are not saved; rebuild before 11-07.
