# PTCS 8 Championship roster review (Claude, 2026-11-03)

**The saved picks stand.**
- All seven events (Iron 1702, Bronze 1703, Silver 1767, Gold 1705, Diamond 1706, Open 1707, Cap 1710) were rebuilt on today's code from the catalogue's rules (current-rosters, tag `2026-11-03-review`; not saved).
- Every rebuild came out with the same 26 cards, lineups and rotations. Only bench and pen order moved in Open and Gold.

## L.J.'s Gold questions

**Tom Brown is not on the Gold pick.**
- He is on the bench in Cap.
- He starts in LF vs RHP only in Bronze and Silver. Ed Morgan (VAR) plays LF vs LHP.
- The model charges him for his glove: LF 68, −6.5 runs a season. He still wins the spot on his bat (+16 to +17 per 700 PA vs RHP).
- Scored swaps:
  - Silver: Tillie Walker instead costs 4.4 weighted runs, about 6 runs a season.
  - Bronze: Archdeacon instead costs 13.6 weighted runs.
- His record in the Dead Silver exports: 7,296 PA, wOBA .335, 2.9 WAR/600 with his defence included.
- Use the depth chart's late-inning defensive sub (Walker in Silver, Archdeacon in Bronze).

**How the four starters are chosen (Gold):**
- With no DH the starter bats about 2.9 times a game, and the model credits his own bat.
- Stivetts (−22 per 700 PA) and Farrell (−14/−20) are real hitters. A normal pitcher is −62.
- That gap is worth about 6–7 runs a season per rotation spot.
- On pitching alone, Leblanc VAR (+9.4) and Stivetts (+8.7) are about even.
- Scored swaps:

| Change | Score |
|---|---|
| Saved rotation | 216.3 |
| Leblanc for Stivetts | 210.8 |
| Pfeffer for Farrell | 212.5 |
| Both | 207.5 |

- Old Hoss Radbourn VAR (stamina 128, +10.2) is the rotation's second-best arm; he stays.

**Platoons:** every event has separate vs-RHP and vs-LHP lineups. Gold vs RHP has 5 of 8 left-handed bats.

## Parks

| Event | Park | AVG L/R | HR L/R | 2B / 3B | Outfield (avg ft LF / CF / RF) |
|---|---|---|---|---|---|
| Iron | 1880 Agricultural Fair Ground | 1.06 / 1.06 | 1.06 / 1.06 | 1 / 1 | 360 / 387 / 360 |
| Bronze | 1903 South Side Park | 0.94 / 0.94 | **0.77 / 0.77** | 1.05 / 0.79 | 375 / 387 / 358 |
| Silver | 1905 Hilltop Park | 1.08 / 1.08 | **1.26** / 1.13 | 0.90 / **1.32** | 369 / 407 / **402** |
| Gold | 1876 Hartford | 1.01 / 1.01 | 1.01 / 1.01 | 1 / 1 | 360 / 387 / 360 |
| Diamond | 1920 Ebbets Field | 1.04 / 0.99 | **1.23** / 0.91 | 0.93 / 1.09 | **416 / 435** / 334 |
| Open | 1885 Messer Street | 0.95 / 0.95 | 0.95 / 0.95 | 1 / 1 | 360 / 387 / 360 |
| Cap | 1906 Columbia Park | 1.10 / 1.08 | **1.37** / 1.07 | 1.14 / 0.81 | 361 / 370 / 298 |
| PD Weekly | 1914 Griffith Stadium | 1.05 / 0.99 | **1.18** / 0.90 | 0.93 / 1.13 | **433** / 420 / 361 |

- The model uses exactly these factors (`park-factors.json` matches the game's `pt_ballparks.txt`). L.J.'s reads all match: Bronze kills HR; Silver, Diamond, Cap and Griffith favour left-handed HR.
- **Gap power by hand ("right-hand gap"):** the park file does list doubles and triples by hand. Hilltop's right-handed triples are 1.56, Ebbets' 1.23. But the game's park settings have no such field: only AVG and HR are set by hand (the game's own text), and tournaments state 2B and 3B overall. So the model uses one 2B and one 3B factor, as the game does.
- **Outfield size and range:** the model does not use park dimensions. Tested on 682 exports (ZR per rating point against each park's depth, controlling for era):
  - LF: weak positive (t 2.2).
  - CF: none (t 1.1).
  - RF: none (t −1.0).
- **Deadball gloves:** ZR per point of rating is higher in ≤1919 exports at most positions, up to 2.3× the modern rate. The model already raises glove value for the era (×1.22 at 1919).
- Repricing gloves by position for deadball, or the outfield alone, did not predict wins better in the win harness (31 exports ≤1919, 2,715 teams):
  - by position: −0.0009 (9/40)
  - outfield only: −0.0003 (15/40)
  - ≤1945, by position: 0/40
- So no change. Had it been applied, the marginal calls would have flipped: Tom Brown and Jesse Burkett out of LF vs RHP, and Joe Dugan VAR out at 3B.

## Not owned, would start (from earlier today)
- Ross Barnes: +15.8 runs in Open, +10.1 in Cap (2B).
- Duke Kenworthy: no gain.

## Later on 11-03: rotations, the friends' engine reference, fielding

**3-man rotations in 1919 hold up in the data.**
- Up to 1919, 499 of 1,435 export teams used 3 starters for 85% of their starts.
- Those starters averaged 8.2 IP and 121 pitches a start, at an average stamina of 77.
- With the same ratings, in the same export, their runs allowed matched 4-man starters (+0.003 RA9 ± 0.05).
- Against the model's expected win%:
  - 3-man +0.2 points, 4-man +0.7, 5-man −1.8.
  - In 1920–45: 3-man +3.6 (n 83), 5-man −1.6.

**Builds, with the rotation weight matched** (3 SP at 4/3 the per-starter weight, plus an 18th bat):

| Event | 4-man | 3-man |
|---|---|---|
| Gold | 216.3 | 217.9 |
| Open | 401.1 | 408.3 |

- Gold: Farrell and Ed Morgan out; Tillie Walker and Tom Brown in.
- Open: Plank to the pen, Hilton Smith out, Ben Taylor in.
- Nothing has been saved.

**Park √AVG split** (engine reference: BABIP and BB × √AVG, K × (2 − √AVG)):
- Win harness over 812 exports: −0.0001 overall (5/40).
- Pitching a hair better, offence a hair worse.
- Not adopted.

**Outfield fielding:**
- ZR follows OF Range better than the position rating, and arm and error add nothing to it.
  - R² RF 0.135 vs 0.108, LF 0.118 vs 0.112, CF 0.061 vs 0.054.
- OF arm runs are a separate quantity that OF ARM predicts (R² 0.05–0.09) and the position rating doesn't (≤ 0.007).
  - Their spread is about 2–2.5 runs a season against about 4.3 for ZR.
- The model prices OF gloves on the position rating, so it misses arm runs. Not yet win-tested.

**Infield:** range, arm and error together predict ZR slightly better than the position rating (2B 0.182 vs 0.163, SS 0.150 vs 0.143).
