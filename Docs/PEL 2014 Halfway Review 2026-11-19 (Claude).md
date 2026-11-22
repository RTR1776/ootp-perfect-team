# PEL 2014 at the halfway point, 2026-11-19 (Claude)

## The answer
- **KC is 43-42, 3 GB of the third NC wildcard, with 77 games left.** On runs it's worse: 382 scored, 399 allowed (−17), a .480 Pythagorean record (about 40.8 wins).
- **The runs allowed are mostly bad luck.**
  - By FIP the staff is league average: 4.05 against a league ERA of 4.03.
  - On their league records the same arms should be 0.22 a 9 better than that.
  - The ~30 runs KC allowed above league average came on balls in play. BABIP allowed is .318, 33rd of 36, and the fielders' zone runs are −13.6, 35th.
- **True talent is about .515** (range .490–.536). That gives **~28% for a wildcard** if the three division leaders hold, and ~36% if a top-6 NC record is enough.
- **The roster is close to right.** Both lineups are the league model's best nine. The owned moves are worth about 3 runs, +2 points of odds. No GTA card helps PEL. The one buy where the model and league play agree is Lajoie, at ~2.3M PP for about +5 points.

## Data
- **Export:** `League Data/2026-11-19/PEL2014halfway_all.csv` (36 teams, all split only, no vL/vR). It is **not imported into Neon**; that needs L.J.'s OK.
- **League this half:** wOBA .314, ERA 4.03, RA9 4.35, FIP constant 3.38, BABIP .302, 4.31 R/G. About 9.5 runs per win.
- **History:** every league-week since 10-18 in PEL and HD450–453, all teams' copies of each card, against that league-week's average. One snapshot per league and week; splits all/vL/vR.
  - Bats are wOBA minus league, in points. Arms are FIP minus league ERA, per 9, where negative is better.
  - This 2014 season isn't in the database, so it's shown separately.
  - Script: `web/scripts/.scratch/pel1119-x.mts` (read only).

## Where the runs went
| | KC | League | Rank of 36 |
|---|---|---|---|
| R/G scored | 4.49 | 4.31 | — |
| wOBA | .325 | .314 | 9th |
| RA9 | 4.70 | 4.35 | 29th |
| FIP | 4.05 | 4.03 (ERA) | 20th |
| BABIP allowed | .318 | .302 | 33rd |
| Zone runs (fielders) | −13.6 | +0.5 (team SD 6.5) | 35th |

- **Offense is real.** The nine's league records average about +10 wOBA points, and this half is +11.
- **Run prevention, ~30 runs above league:**
  - about 0 from FIP;
  - ~14 from the gloves (zone runs);
  - ~15 from pitcher BABIP and sequencing.
- **On their records:**
  - The staff, weighted by this half's IP, is −0.22 a 9 (759 IP).
  - The fielders are about −4 runs a half, not −13.6. The known leaks are Seager at SS (−5.8 zone runs per 650 PA over 30k PEL PA) and Soto in RF (−4.0 over 24k).

| Basis for KC's talent | Talent |
|---|---|
| Own run differential, half regressed | .490 |
| This half's FIP + this half's zone runs | .497 |
| Staff's league record + this half's zone runs | .523 |
| Staff's league record + gloves' league record | .536 |

## Bats: keep both lineups
League model (`league-compare --year 2014 --park "1987 Yankee Stadium"`, Reggie DH-only):
- vs RHP: Brett 1B, Soto RF, Reggie DH, A-Rod 3B, Seager SS, Utley 2B, Andruw CF, Delahanty LF, Moreno C. That is L.J.'s nine.
- vs LHP: Utley 2B, Edgar DH, Soto RF, Pujols 1B, Seager SS, Andruw CF, A-Rod 3B, Delahanty LF, Boone VAR C. Also L.J.'s nine.
- Without the DH-only rule the model puts Reggie in RF and Edgar at DH vs RHP. L.J.'s rule stands.

| Bat | KC this half (wOBA pts, PA) | Other PEL copies this season | PEL since 10-18 | HD since 10-18 | Read |
|---|---|---|---|---|---|
| De Vries | +56 (192), BABIP .422 | +1 (4.8k) | −3 (67k) | +2 (183k) | Bench is right. Rotate him in at SS or 2B for rest days: at SS for Seager it's a tie (glove +5, bat −6.5 runs per 650 PA). |
| A-Rod | −13 (302), BABIP .279 | +26 (2.2k) | +24 (12.7k) | +29 (15.9k) | Noise. Plays. |
| Delahanty | −28 (259) | −24 (1.6k) | +1 (6.2k); vs RHP +2 | +3 (12k); vs RHP −1 | A league-average bat. The weakest regular vs RHP. |
| Andruw | −5 (300) | +9 (8.8k) | +3 (70k); vs LHP +12 | +10 (119k) | Best CF owned (zone runs +1.9 per 650). |
| Soto | +6 (333), BABIP .277 | −48 (0.5k) | +14 (24k) | +13 (70k) | Fine bat; RF glove −4.0 per 650. |
| Moreno | −24 (162) | −18 (2.5k) | −18 (7.9k) | −23 (18.9k) | A catcher's bat; Molina is −27 (9.7k). No change. |
| Seager | −4 (304), zone runs −4.5 | −8 (1.3k) | +9 (30k) | +3 (51k) | Glove −5.8 per 650 PA. Still ahead of De Vries on the bat. |
| Utley, Brett, Pujols, Reggie, Edgar | +34 to +45 | −5 to +27 | +4 to +34 | +7 to +37 | Fine. |

## Arms: keep the rotation and the pen roles
| Arm | KC this half: ERA, FIP vs lg, BABIP (IP) | PEL since 10-18 | HD since 10-18 | Read |
|---|---|---|---|---|
| Plank (SP5) | 6.66, +0.10, **.356** (78.1) | −0.11 (14.1k); vs LHB −0.30 | −0.11 (30.1k) | A BABIP problem, not a pitching one. No owned SP beats him. Keep. |
| Britton | 8.20, +1.97, **.423** (26.1) | −0.44 (2.4k) | −0.41 (3.3k) | 140 BF. Keep the role. |
| Hernandez | 7.28, +0.80, **.342** (47.0) | −0.36 (14.3k); vs LHB −0.70 | −0.44 (29.4k) | One of the best league arms there is. Keep. |
| Miller (CL) | 4.45, −0.19, .381 (32.1) | −0.71 (2.8k) | −0.51 (3.1k) | Keep. |
| Yamamoto | 5.11, +2.71, .243 (24.2) | **+0.09 (7.0k)**; vs LHB +0.17 | −0.07 (15.1k) | Below a league-average arm in PEL, against the hitters 87 Yankee helps. Weakest of the 13 with Hershiser. |
| Hershiser | 5.91, +0.23, .301 (35.0) | +0.09 (24.2k) | −0.06 (65.8k) | Long man; keep for stamina (two long men minimum). |
| Varland / Hader / Ryan | 2.08 / 1.95 / 4.21 | −0.07 / −0.19 / −0.47 | −0.34 / −0.17 / −0.22 | Varland and Hader ran ahead of their records. |
| Rotation | Sheets 3.79, Sale 3.60, Brown 4.24, Bumgarner 2.84 | −0.26 (0.6k) / −0.20 / −0.22 / −0.16 | | Order barely matters at "highest rested". |

## The moves (owned cards)
1. **Granderson 86595 in, Yamamoto out:** worth +1 to +3 runs; with Yamamoto's ~1, about +3 runs (+0.3 W, +2 points of odds).
   - **Granderson's role:** LF vs RHP in place of Delahanty, who keeps LF vs LHP. Late defence for Soto in RF.
   - **The model:** +3.3 runs/700 on the RHP board, +0.9 over the 77 games.
   - **League play:** vs RHP he's +10 over 5.4k PEL PA and +22 over 8.0k HD PA; Delahanty is +2 and −1. Zone runs are +3.3 per 650 against −0.3. That's about +3 over the 77 games.
   - **Never against a lefty:** he's −80 vs LHP (0.8k).
   - **Small samples:** his −56 for KC this half is 91 PA. Yamamoto's ~22 relief IP go to the other seven relievers (record −0.31 a 9 on average), about +1 run.
2. **If L.J. would rather keep 13 arms:** Wade Davis 87067 (−0.21 over 2.8k PEL IP) for Yamamoto, about +0.7 run.
3. **Nothing else owned moves it.**
   - On the 2014 model at 87 Yankee, adding Bautista, Manush, Matsui, Molina or Elly gives 0. So do the GTA bats.
   - Sabathia (−0.02), Kimbrel (−0.17, 1.3k), Sloan (−0.29, 0.4k) and Cy Young (+0.23, base and VAR pooled) don't beat the current seven relievers.

## Buys (PP, upload 416 prices)
| Card | Model, season | Model, 77 games | League record (wOBA pts) | Price | Read |
|---|---|---|---|---|---|
| **Nap Lajoie 87424** (104 2B) | +10.5 | +5.0 | PEL +41 (1.2k), HD +44 (4.0k), this season +10 (1.0k); vs LHP +61/+54 | last 10 2.33M; buy order 1.6M | **The one buy where the model and league play agree.** 2B vs RHP for Utley (+1); SS vs LHP on the model. +5 to +9 runs, +3 to +6 points. |
| Ken Griffey Jr. 87290 (103 CF) | +19.9 | +9.5 | PEL +21 (1.2k), HD +34 (1.1k), **this season −8 (2.0k)** | 876k | The model is far above his league play. Pooled ~+11 over 4.3k against Andruw's +3 (70k) → +2 to +4 runs. Small sample. |
| Carl Yastrzemski 87129 (103 LF; sold 11-13) | +7.9 | +3.8 | PEL +9 (72k), vs RHP +15 | 334k | LF vs RHP; about what Granderson gives, for 334k. |
| Charlie Smith 87439 (103 RF) | +5.6 | +2.7 | PEL +4 (5.0k), HD +15 (7.6k) | 300–400k | Marginal. |
| Ernie Banks, McGonigle, Derrek Lee, Bresnahan | +1.2 to +2.7 | ≤ +1.3 | | 150k–930k | No. |

## GTA Mini-Set (Clubhouse, released 11-19): nothing for PEL
| Card | PEL read |
|---|---|
| Gary Sheffield 103 RF 87573 | Bat +4.9 vs RHP, +13.6 vs LHP on the model, but RF 52 and no LF rating, so DH only. Edgar (+18.8 vs LHP) and Reggie (+14.1 vs RHP) hold DH. Adds 0. |
| Jason Schmidt 102 SP 87572 | Model 22.1 runs/700 BF (tournament scale) against Plank 19.7 and Hershiser 21.0. About +0.1 a 9 in league over Plank, under 1 run over the half. No league play. Not worth a slot. |
| Jason Giambi 100 1B 87571 | −16.8 vs LHP, +1.9 vs RHP; 1B 59. Adds 0. |
| Sandy Alcantara 99 SP 82679 | 15.6 on the model, below every arm on the staff. |
| Barraclough 73, Frelick 66, Schmidt 54, Vargas 46 | Below PEL level. |

## The race
- **Rest of this month (25 games):** 2 more vs Ottawa, then RR, @TUL, OMA, @WIN, GB, @AW, HOTT, @MAD. The opponents' talents average .490, a soft month.
- **Simulation:** 200,000 seasons.
  - Rivals' talent is their half-regressed Pythagorean record, and they play a .500 field.
  - Rivals' talents: Boston .543, Ottawa .528, Breslau .509, Providence .501, Lincoln Heights .490, Ann Arbor .490.
  - KC's other 52 games are against .500.

| KC's true talent | Median wins | Wildcard (leaders hold) | Top-6 NC record |
|---|---|---|---|
| .490 (own run differential, half regressed) | 81 | 17% | 22% |
| .505 | 82 | 23% | 30% |
| **.515 (central)** | 82 | **28%** | **36%** |
| .519 (+ Granderson for Yamamoto) | 83 | 30% | 38% |
| .527 (+ Lajoie too) | 83 | 35% | 43% |
| .535 | 84 | 39% | 48% |

- Each win over the 77 games is worth about +6 points.
- **Unknown:** KC's division. If KC shares one with Madison Mashers (45-40, run differential +36), the division is 2 games back, and the top-6 column is the closer read.

## Verified vs assumed
- **Verified against the export and the database:**
  - the team totals, the ranks, each card's line this half and its league record;
  - prices from upload 416;
  - the GTA cards from card list 416.
- **Assumed:**
  - the division structure;
  - that the three division leaders hold;
  - that rivals face a .500 field;
  - that the half-regressed Pythagorean record is each rival's true talent (KC gets the card-record view, rivals don't, so the KC range is the honest read);
  - runs per win 9.5.

## Decision
- **L.J., 11-19: keep the roster.** No Granderson swap; Yamamoto stays in the pen. L.J.'s reason: the pen gets worn out and needs the arm. That matches the data: KC's starters average 5.95 IP a start (505.5 IP over 85), so the pen throws ~3.0 IP a game, against ~2.9 for both top and middle teams in the 11-16 pen study. It also matches the study's finding that top teams fill their top relief slots with stamina arms; Yamamoto (91), Hershiser (100) and Hernandez (67) are KC's three. `league-team.json` (asOf 11-19) is the 26 as playing.
