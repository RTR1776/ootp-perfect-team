# Pitching fatigue: how fast pitchers recover (2026-10-19)

Data: L.J.'s friend's daily captures of OOTP's pitcher fatigue screen, `Tourney Data/pitching fatigue data/pitching fatigue (1)/` (34 files, 44.7k rows): Bronze Weekly (1979, days 1–7), Open Slots Daily (1987, days 2–19), Silver & Friends (2010, days 4–13), Tuesday Live (2023, day 4), Iron PTCS 2 (1969, day 1).

Each row has the pitches thrown on each of the last five days (5d … Yest.) and two readiness numbers: SPF% (ready to start) and RPF% (ready to relieve). 100% = fully rested. Hitters show a flat 60/60 and are dropped. Every pitcher with no pitches in the window is 100/100 (4,021 of 4,026), so five clean days resets anyone.

## 1. Starters recover on a fixed clock — pitch count barely matters

Start readiness after a single outing, by days since (16,073 single-outing rows):

| Pitches | 1 day | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| 60–74 | 8 | 26 | 48 | 79 | 99 |
| 90–104 | 7 | 22 | 45 | 77 | 100 |
| 105–119 | 6 | 22 | 45 | 75 | 100 |
| 120–134 | 7 | 24 | 47 | 77 | 100 |

Stamina moves it a little (day 4: STM 45–59 → 76, 105–119 → 81). **In a 5-man rotation every start is at 100% whatever the pitch count**, so the PCnt setting is an in-game choice (how deep, how tired late), not a recovery cost. A 4-man rotation starts at about 75–80% (1979/1987) or 61–68% (2010/2023).

## 2. Modern eras recover slower

| | 1979 / 1987 events | 2010 / 2023 events |
|---|---|---|
| Starter, day 4 after 100–119 pitches | 79 | 66 |
| Reliever, day after 10–35 pitches | 80 | 62 |
| Reliever, after two days running (10–35 each) | 44 | 8 |

The modern sample is two events (Silver & Friends 2010, Tuesday Live 2023; 56 and 11 rows for the reliever lines), so treat the size of the gap as rough; the direction holds in every cell.

## 3. Relievers: pitches matter a lot

Relief readiness the next day: 0–14 pitches 94, 15–29 → 80, 30–44 → 59, 45–59 → 30, 60+ → under 10. Two days later: 97 / 90 / 80 / 65. Stamina does not change it (one-inning outings: 74–81 next day across every STM band).

## 4. What the field throws per start

Median pitches in a start (60+): 1969 104, 1979 105, 1987 113, 2010 107, 2023 95.

## What this can't say yet

"Best PC by era" needs outcomes — runs allowed by times through the order or by pitch count — which these files don't carry. Pair them with the same events' stat exports (or per-game logs) to answer it. Also unknown: how much a pitcher at, say, 60% readiness actually loses on the mound.

## For L.J.'s teams

- **PEL (2010):** keep 5 starters (a 4-man would start at ~66%). Don't let Hernandez, Davis or Kimbrel pitch three days running; on two straight days they drop to near zero readiness in the modern sample. The pen of seven, with three long men, is the right shape.
- **Tournaments (Bo7, older eras):** a 5-man rotation is always fresh; a closer can go back to back (~44%) only in a pinch.

Script: `engine/trackers/fatigue_read.py`.
