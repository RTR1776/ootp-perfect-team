# Model Review, 2026-10-25: tournament and league

L.J. (max effort): "take a comprehensive look at our data modeling for both league and tourney — defense vs offense, ballpark factors, etc. — after review, plan the fixes, fix, then let me know."

**Evidence base:**
- 716 archived tournament exports (82 series).
- The archive win harness (`scripts/model-v2/teams.mts` over `Archive/Completed`): 54,273 team-events in 685 exports.
- League team-weeks (`scripts/defense-study/league-def.mts`).

**Standard for a change:** it beats production on held-out wins in ≥ 37/40 half-samples (export- or league-week-split), and the final configuration is re-checked end to end on a harness rebuilt with the new code.

**Scripts:** `web/scripts/model-review/`: park-check, teamweights(-oldprices), trait-scan, trait-holdout, glove-clean, endtoend.

## What changed (final)

| | Change | Evidence (held-out wins unless noted) |
|---|---|---|
| Tournament team weights | By era: **1977–93** glove 1.25 / framing 0.5 / starters 1.0 / pen 3.0; **1994–2009** 1.25 / 0.5 / 1.0 / 2.5; every other era unchanged (2 / 1 / 1.5 / 2) | 1977–93 +0.0046 (40/40); 1994–2009 +0.0022 (38/40); others: production holds |
| Framing weight | Its own team weight (`frm`): 0.5 in 1977–2009, 1 elsewhere | Part of the grid above |
| pBABIP | `ARM_RATING_FIX` +0.25 per +10 (1946–76), +0.55 (1977–93) | 36/40 and 37/40 in those bands; not other eras |
| Tournament glove prices | **Reverted** to FIELDING_CALIBRATION (see §2) | The 10-25 repricing loses on clean data (8/40) |
| League gloves | CF ×2 (3.38), every other position ×0.7 | League runs allowed 38/40 (both steps); wins 31/40 and 26/40 |
| League park sweep | Only L.J.'s 15 parks (`src/data/league-parks.json`); runs on the league scale (× 0.565) | — |
| Parks | **No change** (see §1) | Shrunk factors lost in every band (0/40) |

**End to end, final configuration against production before the review** (`endtoend.py`, same 54,273 team-events): **+0.0015 overall, better in 40/40.**

| Band | Change | From |
|---|---|---|
| ≤1945 | unchanged | |
| 1946–76 | +0.0004 (37/40) | pBABIP |
| 1977–93 | **+0.0076 (40/40)** | weights +0.0054, pBABIP +0.0025 |
| 1994–2009 | **+0.0034 (39/40)** | weights |
| 2010+ | unchanged | |
| PTCS 7 Championship brackets | 0.4012 → 0.4024 | |

**Code:** calibration.ts, fielding.ts, roster-objective / roster-search (`framingWeight`), env-roster, roster-builder and field-view (/build), card-fit / card-fit-load, park-sweep, league-parks.json. Card Fit cache `fit-v4`. Tests 329/329.

## Findings in detail

### 1. Parks: a field's rates move with the park far less than the factor, but cards don't
**Method:** observed rates per export and batter hand, regressed on the era's rate and the park's factor (67 series with the park on file exactly, series-resampled).

| Rate | Era coefficient | Park coefficient | Park L/R split coefficient |
|---|---|---|---|
| BABIP (AVG factor) | 1.00 ± 0.14 | 0.27 ± 0.06 | 0.24 ± 0.11 |
| HR per BIP | 0.85 ± 0.09 | 0.44 ± 0.25 | 0.70 ± 0.18 |
| 2B per BIP | 0.87 ± 0.08 | 0.93 ± 0.30 | |
| 3B per BIP | 0.93 ± 0.15 | 0.55 ± 0.28 | |
| K% | 0.45 ± 0.09 | | |

**What was tried:**
- Applying those strengths inside `applyPark`, with `PARK_HAND_TRUST` at 1.
- On a rebuilt harness that predicted wins **worse in every band** (0/40), so it was reverted.

**Most likely reason:**
- A field's rates are flattened by how fields adapt to their park (HR-suppressing arms in homer parks, which hands they play).
- What a card does in a park, which is what a roster choice turns on, is still the stated factor.
- The 10-11 `PARK_HAND_TRUST` 0.44 stays.

**Era table:** holds, except that PT fields strike out at only 0.45 of the era's K rate. At team level Avoid K shows no residual, so the era rating corrections absorb it. Watch item.

### 2. Defense vs offense, tournaments
- **Glove level by era.** In 1977–2009 environments gloves, framing and starters were over-weighted and the pen under-weighted (table above).
- **Elsewhere,** including the PT default (2010) and the 1919 PTCS 8 Championship, today's balance holds: gloves 2, framing 1, starters 1.5, pen 2.
- **Per-position prices.** This morning's repricing (Docs/Defense Study 2026-10-25.md §8) was validated against the harness's `def`, which sums glove runs by plate appearances from fixed position means. A team's PA per game leaks into it; the roster objective scores one card per slot, where that constant cancels.
  - On centred rating gaps for both price sets (`glove-clean.py`) the new prices lose overall (better in 8/40), clearly before 1946 (3/40) and in 1977–93 (3/40).
  - They gain only inside noise in 1946–76 and 2010+ (33/40 each).
  - **Reverted.** The study's measurements stand: CF and middle-infield range matter most, 1B least. Wins just don't reward re-weighting the positions beyond the old calibration.
- **Shape** (cliffs, flattening): no gain. Linear.

### 3. Ratings mispriced at team level
**Method:** residual win% after the production score, on team PA/BF-weighted ratings, each correction tested held out.

- **pBABIP is under-priced in 1946–93.** Earlier audits tested against FIP, which leaves balls in play out; the pBABIP curve was never refit.
- **Do not hold out:**
  - pHR (18/40; its multi-rating signal was collinearity)
  - Stealing (1/40 overall; 33/40 in 1977–93)
  - Power, Eye, BABIP, Avoid K
  - stamina: the big residual was the outcome-driven starter share
- **Watch:** Stealing in 1977–93, stamina before 1946, Avoid K / Power in 1994–2009.

### 4. League
- **CF glove.** It fits at 5–6× the old price in league play (runs allowed per 1,400 IP with pitching held, 1,005 team-weeks).
  - A fixed ×2 holds out: runs allowed 38/40, wins 31/40.
  - On top of that, ×0.7 on every other position holds on runs allowed (38/40) and is level-to-positive on wins (26/40).
  - That fits league compression: a ZR run is 0.64 runs allowed in league against 1.30 in tournaments.
- **Park.** On L.J.'s list at league scale: 1987 Yankee +6.5, 1945 Comiskey +5.4, 2026 Polar +3.5, 1952 Yankee +3.1. The 1919 Sportsman's the sweeps kept picking isn't on his list.
- **Lineups:** League Plan 2026-10-25 §11–12.

## What this means for rosters
- **Events in 1977–2009 environments** shift toward bats and bullpen, and away from gloves, catcher framing and starter spend.
- **1946–93 events** value high-pBABIP arms a little more.
- **Everything else** (2010 PT default dailies, deadball, the Championship) prices as it did before 10-25. That includes the glove prices: the Open Main Event's Hidalgo-in-LF build (1133) came from the reverted prices, so it is rebuilt with everything else.
