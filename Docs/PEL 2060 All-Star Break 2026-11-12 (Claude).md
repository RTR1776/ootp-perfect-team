# PEL 2060 at the All-Star break, 2026-11-12 (Claude)

## Data
- **Exports:** `League Data/2026-11-15/PEL2060mid-season_{all,vL,vR}.csv`, imported as PEL snapshots 216–218 with `--on 2026-11-15`, the Sunday this season ends. The full-season export replaces them.
- **Kansas City:** 52-44, 2nd NC wildcard, 1 game up on Phoenix and Clover Hill.
- **Run differential:** +15 (464 scored, 449 allowed), a .515 Pythagorean record. KC is about 2½ wins ahead of its runs.
- **League:** wOBA .327, ERA 4.30, FIP constant 3.36.
- **Method (memory: check-league-picks-across-leagues):** every league week since 10-18, all teams' copies of each card, against that league-week's average. PEL and the HD ladders are read separately, because PEL is the tougher league.
  - Bats: wOBA minus the league-week's average, in points.
  - Arms: FIP minus the league-week's ERA (negative is better).

## Bats: keep everyone
| Card | KC this half (wOBA, PA) | PEL since 10-18 | Read |
|---|---|---|---|
| Albert Pujols | .190 (186); .151 vs LHP (123) | **+23 vs LHP over 32,960 PA**; +13 overall | BABIP .150 against a league .306, .110 vs LHP, with K% and BB% near league. Keep him at 1B vs LHP. The next best owned options vs LHP are Brett −5 and De Vries −4. |
| Andruw Jones | .271 (332) | +2 (63,145), +12 vs LHP | BABIP .258. The best CF you own: Granderson is −76 vs LHP, Hidalgo −17. |
| Gabriel Moreno / Yadier Molina | .284 / .289 | −16 / −27 | Below-average bats, as catchers are. Josh Gibson is −9 but gives up Molina's glove. No change. |
| Jose Bautista | .305 (313) | +9 vs RHP (8,247) | Soto is +15 vs RHP (8,719). Soto in RF vs RHP is about +1.8 runs per 700 PA after the glove (RF 91 vs 111); optional, about half a run over the rest of the season. |
| A-Rod, Reggie, Matsui, Soto, Yaz, Brett vs RHP | .345 to .449 | +9 to +56 | Fine. |

Both lineups are already the data's best nine, except the optional Soto RF vs RHP.

## Arms: two out, two in
| Card | KC this half | PEL since 10-18 | Read |
|---|---|---|---|
| **Yoshinobu Yamamoto** (SP) | 5.48 FIP, 6.83 ERA, 1.75 HR/9; .406 wOBA vs LHB | **+0.12 over 4,911 IP**; vs LHB +0.15 | Below average in PEL, and weakest against the hitters your park helps. **Out.** |
| **Christy Mathewson** (long) | 5.99 FIP | **+0.16 over 5,407 IP**; vs LHB **+0.37** | Same problem. **Out.** |
| Zack Britton | 5.01 FIP, 16% BB | −0.46 over 2,261 | Noise. Keep. |
| Josh Hader | 4.11 FIP | −0.25 over 1,899 | Keep. |
| Eddie Plank | 4.22 FIP (10 GS) | −0.10 over 10,816; vs LHB −0.30 | **Into the rotation for Yamamoto.** |
| Orel Hershiser | 16 IP | +0.08 over 23,407 | He's on the export with 16 IP. If he's still on the 26, he goes first. |

**In:**
- **Wade Davis** 87067 (102 CL): −0.23 in PEL over 2,613 IP, −0.23 in HD over 5,175. He replaces Mathewson.
- **Ryan Sloan** 84731 (98 SP, stamina 69): −0.29 in PEL over 356 IP, −0.27 in HD over 1,160; vs LHB −0.84. He's the long man in Plank's old swing role. The sample is smaller, so the safer alternative is CC Sabathia 86350 (101 L, stamina 105): −0.02 over 8,750 IP, −0.23 vs LHB.
- Not needed: Kimbrel 85467 (−0.17 over 1,251). The pen is already Miller −0.74, Britton −0.46, Ryan −0.40, Hernandez −0.36, Hader −0.25.

**Staff after the moves:**
- Rotation: Brown, Sheets, Bumgarner, Sale, Plank.
- Pen: Miller (CL), Hernandez (stopper and long), Britton, Ryan, Hader, Davis, Sloan.
- If the game currently has Sale in the pen (the export lists him as RP with 13 GS), he goes back into the rotation.

**Worth:**
- Plank for Yamamoto: about 2–3 runs over the remaining ~70 IP.
- Davis for Mathewson: about 1 run.
- Soto RF vs RHP: about 0.5.
- Total about +0.4 to +0.5 wins over 66 games.
- **Griffey Jr. 103 in CF** (new card; buy with PP once it lists) is about +8 runs over the half on the model. That's model only: no league play exists yet.

## The race (66 games left)
- **Schedule:** opponents' current win% averages .502. Head-to-head: Phoenix 6 (7/17–19 away, 9/10–12 home), Southside 6, Kamouraska 3 (8/2–4 away), Clover Hill 3 (8/18–20 home), NoseKerim 3 (8/15–17 away).
- **Monte Carlo:** 40,000 runs. Talent is regressed Pythagorean; rivals' non-KC games are against a .500 field; the three division leaders are assumed to hold.

| KC's true talent | Wildcard odds |
|---|---|
| .507 (its own run differential, half regressed) | 39% |
| .520 | 46% |
| .530 (closer to what the roster rates) | 52% |
| .540 | 57% |

Each extra win over the half is worth about +6 points of playoff odds.
- With the pitching moves, the .507 case goes to about 42%.
- Adding Griffey takes it to about 49%.

## Lineups, defence and the 7-man pen (later 11-12, after L.J.'s depth-chart screenshots)
L.J. had already made these moves: Yamamoto out, Wade Davis in, Plank in the rotation, Mathewson kept as the long man.

**Defence is mostly fine.**
- KC's BABIP allowed is .315 against a league .306, 32nd of 37 teams, about +18 runs.
- But it's three pitchers: Yamamoto .360 on 333 balls in play, Mathewson .345, Hershiser .400. Without them KC is at .303.
- OOTP's own zone runs put the fielders at +0.8 as a team.
- The weak gloves this half are Seager (ZR −5.4) and Soto in RF (−4.0, against Bautista −1.7).
- Nobody you own is a better SS than Seager (119) with a bat worth carrying.
- The fix for "glove even if the bat is worse" is **Curtis Granderson 86595** (97, bats L): RF 142, CF 133, LF 147. In PEL since 10-18 he's +11 vs RHP over 4,393 PA (Bautista +9); against lefties he's −76, so he never faces one.
- League model (`league-compare --park "1987 Yankee Stadium"`):
  - Granderson is +2.0 (normal glove weight; he plays CF vs RHP) to +4.1 (double glove weight; RF vs RHP, Jones in CF) runs a season-slot over the current roster.
  - At both weights the vs-LHP nine is Molina, Pujols, Utley, A-Rod, Seager, Yaz, Jones, Soto, Matsui.

**Roster:** Granderson in, Bautista out.

**vs RHP:** Brett 1B, A-Rod 3B, Yaz LF, Reggie DH, Granderson RF, Seager SS, Utley 2B, Jones CF, Moreno C.
- Molina is the late defensive sub at C. The model at double glove weight would catch Molina outright, but the observed bats say Moreno: −8 vs RHP against Molina's −33.
- Soto and Pujols pinch-hit.

**vs LHP:** Utley 2B, A-Rod 3B, Matsui DH, **Pujols 1B** (in for Brett), Jones CF, Yaz LF, Soto RF, Seager SS, Molina C.
- Granderson is the late defensive sub for Soto in RF.
- Brett and Reggie pinch-hit.
- Pujols for Brett is the biggest single fix: +23 vs −5 vs LHP over about 33k PEL PA each, about +16 runs per 700 PA, roughly +2.4 runs over the half.

**Pen of 7 with two long men, no Sloan:** Miller (CL), Hernandez (stopper), Britton, Ryan, Hader; long men **CC Sabathia 86350** and **Cy Young (VAR) 86572**. Mathewson and Wade Davis go off.
- Long-man candidates, PEL since 10-18, FIP minus league ERA:
  - Sabathia: −0.02 over 8,750 IP, −0.23 vs LHB, LHP, stamina 105.
  - Cy Young VAR: −0.10 over 1,176 IP, but +0.34 vs LHB.
  - Sloan: −0.29 over 356 IP (−0.27 in HD over 1,160), −0.84 vs LHB. The best on the numbers if L.J. will use him.
  - Mathewson: +0.16, and +0.37 vs LHB.
- Davis (−0.23) is the weakest short man by a hair. Keeping him means letting Hernandez (stamina 67) be the second long man.

**Rotation:** fine as set (Brown, Sheets, Bumgarner, Plank, Sale, always start highest rested). By the data the order would be Sheets −0.46, Brown −0.22, Sale −0.18, Bumgarner −0.16, Plank −0.10.
