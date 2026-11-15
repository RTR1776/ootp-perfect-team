# League plan for next week: PEL, 2014 theme (2026-11-16)

KC Torrent lost the Division Series 3-2 and stays in PEL. Next week is a theme week: 2014. The home park can be changed before the season starts (11-17).

Data in (all captured 11-15):
- **PEL:** the final season export (uploads 396–398, 125.8k PA vs RHP).
- **HD:** HD450 and HD451.
- The late-season and mid-season PEL files from 11-13/11-14 are in `League Data/2026-11-15/superseded/`. A file on disk outranks the database in `league-panel`, so the older late-season copy (109k PA) had been read in place of the final season.

## 1. Refit

`league-panel` → `league-fit.py` → `fit-arm-slope`. The model was last fit on 10-25.

- **Hitter model:** 388 card lines, 11.67M PA, 15 weeks.
  - Held out by card r 0.937; by week r 0.852; this week's PEL alone r 0.839.
  - League play returns 0.536 of a tournament-scale edge (was 0.565).
- **Arm model:**
  - Best league edges: Andrew Miller +0.60 per 9, Willie Hernandez +0.44, Koji Uehara, Kirby Yates.
  - Hader's league record is weak: −0.65 per 9 on the slope fit over 1,232 IP.
- **Tests:** 414 pass.

## 2. What 2014 changes

Almost nothing for bats. Measured with `league-best --year 2014` over the whole collection:
- **Bats:** spread ×1.006 against 2010. No card moves more than 0.9 runs; A-Rod gains the most.
- **Arms:** spread ×1.081, so a good staff is worth about 8% more.
- **Lineups:** the best nines below are identical under 2010 and 2014.
- **Ratings:** +10 Power is about +4.5 runs/700, Avoid K about +3.2, BABIP about +2.4.

## 3. Park (`park-sweep --year 2014 --league PEL --field PEL`)

KC against this season's 35-team PEL field, 81 home games, league scale.

| Park | Edge |
|---|---|
| **1987 Yankee Stadium (current)** | **+4.1** |
| 1952 Yankee Stadium | +3.4 |
| 1986 Three Rivers Stadium | +2.5 |
| 1945 Comiskey Park | +2.4 |
| 2026 Polar Park | +2.3 |

- In 2010, 1952 Yankee edged it, +4.8 to +4.6. The two Yankee Stadiums are a coin flip.
- **Keep 1987 Yankee Stadium.**

## 4. Lineups (league model in 2014 at 1987 Yankee, blended with league history at K 1300 PA; Reggie, Matsui and Edgar DH-only)

Scratch: `web/scripts/_lu4.mts <obs.json> 2014`. Batting order from `lib/batting-order` (`_order.mts`).

- **vs RHP (101.1):**
  1. Brett 1B
  2. Soto LF
  3. Reggie DH
  4. Seager SS
  5. Granderson CF
  6. A-Rod 3B
  7. Bautista RF
  8. Moreno C
  9. De Vries 2B
- **vs LHP (94.7):**
  1. Utley 2B
  2. Edgar DH
  3. Soto RF
  4. Pujols 1B
  5. Andruw CF
  6. Delahanty LF
  7. A-Rod 3B
  8. De Vries SS
  9. Boone VAR (Gold, 87498) C
- **Changes from the last 22 games:**
  - vs RHP: Bautista RF in for Delahanty, with Soto to LF. Worth +3.9 runs/700 on that board.
  - De Vries at 2B vs RHP and SS vs LHP.
- **The middle infield is a three-way tie.** Utley at 2B vs RHP costs 0.1, and Seager at SS vs LHP costs 0.4. Rotate Utley, Seager and De Vries freely for rest.

**Season worth of each bat** (best nines without him, boards weighted 0.557 vs RHP / 0.443 vs LHP):

| Bat | Season |
|---|---|
| A-Rod | −14.1 |
| Andruw | −10.6 (vs LHP −23.9) |
| Brett | −7.8 |
| Pujols | −6.0 |
| Utley | −5.1 |
| Edgar | −4.5 |
| Delahanty | −4.2 |
| Soto | −3.8 |
| Granderson | −2.6 (also the only real CF backup) |
| Bautista | −2.2 |
| Moreno | −1.7 |
| Seager | −1.6 |
| Boone VAR | −1.6 |
| Reggie | −1.0 |
| De Vries | −0.2 (the utility man) |
| Molina | 0.0 |
| Matsui | 0.0 |

**Owned bats not on KC:**
- Elly De La Cruz 87387 is +2.4 a season, at SS vs LHP only.
- Manush is +0.7.
- Caminero, Ben Rice, Ed Rile, Piazza VAR, Kirk Gibson VAR and Bret Boone are 0.
- None is worth a roster spot.

**Catchers:** Moreno vs RHP (bat −10.6, glove +7.4) and Boone VAR vs LHP (−4.3, +11.7). Molina adds nothing with both of them on the roster. Note that Moreno's league bat is −16.3 vs LHP over 8.2k PA.

## 5. Staff (refit arm model, `_arms2.mts`)

Runs per 9 over the league's arm, on PEL record:
- **Rotation:** Sheets +0.29, Sale +0.21, Brown +0.17, Bumgarner +0.17, Plank +0.12. The same five as this season.
- **Pen:** Miller +0.59 (CL), Ryan +0.36, Hernandez +0.34 (the long man, stamina 67), Britton +0.33.
  - Then Kimbrel +0.21, Nen +0.18, Davis +0.17, Hader +0.16 and Varland +0.15, all within 0.06 per 9 (~0.3 runs a season).
  - Keep the playoff pen. Kimbrel (owned) is an even swap for any tired arm.
- **Stay off:** Yamamoto (−0.09 as SP over 9.2k PEL IP) and Mathewson (−0.11). Both are below a league-average arm in PEL.

## 6. The 26

- **15 bats:**
  - C: Moreno, Boone VAR
  - IF: Brett, Pujols, Utley, De Vries, A-Rod, Seager
  - OF: Delahanty, Granderson, Andruw, Soto, Bautista
  - DH: Reggie, Edgar
  - Reserve: Molina and Matsui.
- **Arms:**
  - SP: Sheets, Sale, Brown, Bumgarner, Plank.
  - RP: Miller, Ryan, Hernandez, Britton, Davis, Varland, Hader.
- That is 27, so one spot is a tie:
  - Reggie is worth 1.0 run over Edgar DHing every day.
  - The 7th reliever is worth 0.9.
  - Claude's lean is the 7th reliever, because pen fatigue over 162 games is what these numbers don't see. L.J.'s call.
