# Steal and pitch-count settings by era (2026-10-27)

From the archived tournament exports (740 exports, about 180k steal attempts and 50k qualifying starter seasons) and OOTP 27's era modifiers (`Data/OOTP game files/totalmods.csv`).

**Scripts:**
- `web/scripts/model-review/strategy-env.mts`: era year and steal break-evens per export and event, from `solveEnv`, the same numbers env-roster prints.
- `web/scripts/model-review/strategy.py`: the study.

## Stealing: turn it down everywhere, most of all in deadball

| Era | Break-even (0 out) | Stealing 100+ | 80–99 | 60–79 | under 60 |
|---|---|---|---|---|---|
| 1945 and earlier | 76.1% | 62.2% | 60.7% | 50.4% | 30–40% |
| 1946–76 | 78.7% | 73.2% | 67.2% | 52.2% | 24–36% |
| 1977–93 | 79.1% | 75.3% | 70.6% | 56.0% | 30–40% |
| 1994–2009 | 81.7% | 77.8% | 73.2% | 62.5% | 41–45% |
| 2010 and later | 81.4% | 76.1% | 71.7% | 59.1% | 35–43% |

- **No group of runners clears break-even in any era.** A 100+ runner attempts about 17–21 times a season (per 600 PA) and gives back about 1 run doing it, more in deadball.
- **Setting:** team stealing at its lowest. If any green light is wanted, only for 100+ runners, and not in deadball events.
- **Caveat:** these rates are under whatever settings the field used. Fewer, better-chosen attempts may do better than these averages. Nothing here says they clear break-even, though.
- **The game's era modifiers check out.** With the runner's rating held, the year's SBSuccess modifier predicts that year's success rate (t = 21; 729 exports). The file is real game behaviour.

## Pitch counts: the cap should sit above what good teams' starters actually throw

Pitches per start (and innings per start) for starters on top-quarter teams, against bottom-quarter teams at the same stamina:

| Era | Stamina under 70 | 70–89 | 90–109 | 110+ |
|---|---|---|---|---|
| 1945 and earlier | 113 / 7.8 IP (bottom 108) | 119 / 8.1 (115) | 120 / 8.3 (113) | 122 / 8.5 (117) |
| 1946–76 | 107 / 6.9 (97) | 113 / 7.4 (105) | 116 / 7.6 (107) | 117 / 7.5 (109) |
| 1977–93 | 102 / 6.6 (93) | 109 / 7.0 (103) | 113 / 7.3 (109) | 117 / 7.8 |
| 1994–2009 | 97 / 5.9 (90) | 104 / 6.4 (99) | 108 / 6.7 (103) | 109 / 6.8 |
| 2010 and later | 98 / 6.0 (91) | 104 / 6.5 (100) | 107 / 6.8 (101) | 108 / 6.8 (103) |

**Suggested pitch-count limit:** the top-team average plus about 5, so a good outing ends on fatigue rather than the cap.

| Era | Stamina under 70 | 70–89 | 90+ |
|---|---|---|---|
| 1945 and earlier (the whole PTCS 8 Championship) | 120 | 140 | **150–170** (L.J.; see below) |
| 1946–76 | 110 | 115 | 120 |
| 1977–93 | 105 | 115 | 120 |
| 1994 and later | 100 | 105 | 110 |

- **Not tested causally:** winning teams' starters go deeper partly because they pitch well. Treat this as a norm, not a proven win.
- **Era stamina modifier:** SPStam does not line up with observed depth (0.99 / 0.89 / 0.87 / 1.02 / 0.95 by band). Deadball starters go deepest regardless.
- **Deadball correction (L.J.: "they can pitch 170 PC if they have 90 plus stam easy"):**
  - The averages above are capped by the field's own settings, so they show settings, not limits.
  - Deadball-era starters with stamina 90+ (1,633 pitcher-events) average 121 pitches a start; the top 10% 134+, the top 1% 146+.
  - Those going longest (125–155 a start) pitch 8.8–9.3 innings with ERA 2.67–2.68, against 2.74 at 110–125.
  - Going long costs nothing per inning, so the cap for 90+ stamina should be high enough to let them finish (150–170). The 70–89 cap of 140 is a guess from the same pattern; untested.
- **League (2010):** L.J.'s 115 / 110 caps sit above the modern norm, which is fine for a cap.

## Current events by era
- <=1945 (17): Daily Bagels and Schmear with EVCinNYC, Daily Dank, Daily Early Bronze, Daily Early Years Cap, Daily Golden Age, Daily Iron Dreamland, Daily Roaring Silvers, PTCS8 Champ Bronze, PTCS8 Champ Cap, PTCS8 Champ Diamond, PTCS8 Champ Gold, PTCS8 Champ Iron, PTCS8 Champ Live, PTCS8 Champ Open, PTCS8 Champ Silver, Tuesday Dead Silver Walking, Wednesday Night of the Living Deadball
- 1946-76 (13): Daily Bronze 1910-59, Daily Diamond 1990 Onward, Daily Diamond Cap, Daily Gold Slots, Daily Golden Heart, Daily Goldfather II, Daily Iron Lunch, Daily Low Bronze Only, Daily PTCS 2 Iron Replay, Dr. Dynastic's Daily Time Travelers Slots, Friday Nightmare Cap, Saturday Diamond Variety, Sunday Open Slots
- 1977-93 (11): Daily Diamond, Daily Iron Strikes Back, Daily Late Silver, Daily Open Slots, Daily Silver Slots, Daily Silver Snapshots, Friday Danksville, Monday Up And At Them Bronze, Saturday Iron Warriors, Thursday Splendid Silver Only Spectacular, Tuesday Sporer's Sandlot
- 1994-09 (10): Daily Bronze OOTP Era, Daily Bronze PTCS 3 Replay Slots, Daily Diamond Up to 1969, Daily Gold Cap, Daily Iron & Friends OOTP Era Slots, Daily Late 1900s, Daily Low Gold Cap, Daily Silver Only Cap, Monday Now We're into the Dregs, Monday Wonky Historical Slots
- 2010+ (61): Daily All-Star Hardware Slots, Daily Bronze Only Cap, Daily Bronze Only Curiosities, Daily Diamond Jumble Slots, Daily Diamonds are Forever, Daily Early Silver, Daily Gold Standard, Daily Iron Cap, Daily Late Bronze, Daily Late Iron, Daily Live Bronze, Daily Live Diamond, Daily Live Gold, Daily Live Iron, Daily Live Open, Daily Live Plus, Daily Live Silver, Daily Low Diamond Only, Daily Low Gold Only, Daily Low Silver Only, Daily Silver & Friends Slots, Daily Wide Open, Diamond Quick, EF-4T-Challenge-Bronze-ID294, EF-4T-Challenge-Diamond-ID75, EF-4T-Challenge-Gold-ID122, EF-4T-Challenge-Iron-ID417, EF-4T-Challenge-Open-ID134, EF-4T-Challenge-Silver-ID344, EF-H2H-Challenge-Bronze-ID2250, EF-H2H-Challenge-Diamond-ID196, EF-H2H-Challenge-Gold-ID1736, EF-H2H-Challenge-Iron-ID902, EF-H2H-Challenge-Open-ID438, EF-H2H-Challenge-Silver-ID497, Friday Night Live Slots, Live-Plus Bronze Floor-Low Gold Ceiling Pop-up, Live-Plus Bronze Pop-up, Live-Plus Diamond Pop-up, Live-Plus Gold Pop-up, Q-Bo5-T16-ID1028, Q-Bo5-T16-ID2113, Q-Bronze-Bo5-T16-ID5927, Q-Diamond-Bo5-T16-ID3566, Q-Gold-Bo5-T16-ID5406, Q-Iron-Bo5-T16-ID5783, Q-Live-Bo5-T16-ID1745, Q-Live-Bo5-T16-ID4131, Q-LowD-Bo5-T16-ID1063, Q-LowG-UnH+Snap+RS-1999-Bo5-T16-ID449, Q-LowI-Bo5-T16-ID157, Q-Silver-Bo5-T16-ID9862, Saturday Bronze Cap, Saturday Negro Leagues Slots, Sunday Open Main Event, Sunday Silver and Gold Cap, Thursday CWhit's Say My Name Cap, Thursday Night Gold Rush, Tuesday Live, Wednesday 1950 to Now, Wednesday Ice to See You

## Reliever readiness: the 28–30 pitch cliff (JW group, from L.J., 2026-10-27)
- **Proposed rule:** next-day readiness ≈ 103 − 1.5 × pitches − 0.67 × (pitches − 28) × (50 ÷ stamina), the last term only past 28 pitches, capped 0–100.
  - Up to about 28 pitches, every arm loses about 1.5 points per pitch, whatever its stamina.
  - Past 28, low stamina costs more: about 3.2 points per pitch at stamina 20, 2.1 at stamina 65. cwhit: "30 is where the big drop starts".
- **Against L.J.'s scouting screenshot** (13 relievers, yesterday's pitches against readiness):
  - Everyone at 30+ pitches shows 33–47% except one (71%); everyone under 30 shows 60–77%.
  - The formula is within about ±10 points. Arms at 31–37 pitches sit 6–11 below it, consistent with having also pitched the day before.
- **Starters (1968, a JW member):** Nolan Ryan (stamina 100) hit a 160 cap and came out at 5%; the cap is now 155. Few games reach the cap, so upper bounds are hard to find.
- **Use:**
  - Keep short relievers under about 25–28 pitches an outing in multi-game days.
  - Long outings belong to high-stamina arms, whose cost past 28 is smaller. It supports carrying a 90+ stamina long man (Saberhagen over Nen in league).
  - Relief pitch counts are not in the exports, so this can't be checked against the archive.
