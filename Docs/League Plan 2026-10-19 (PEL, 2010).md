# League plan for next week: PEL, 2010 run environment (2026-10-19)

KC Torrent was promoted from HD450 back to PEL. Next week returns to the PT default run environment (2010) after this week's 2007 theme.

Data in:
- **HD:** all four leagues for the week ending 10-18 (HD450–HD453).
- **PEL:** last week's (10-11). This week's PEL export is still to come.

Everything below is on the league models refit today. **§7 is the update with this week's PEL file (uploaded 10-19). Where §1–6 and §7 disagree, §7 wins.**

## 1. Refit

- **Panel:** 75,319 rows over 11 weeks.
  - This week is scored as the 2007 theme. The era fit can't tell 2007 from the ordinary 2010–2013 band, so `league-panel.ts` now has a `KNOWN_THEME` entry for it.
  - The mid-week HD452 copies from 10-08 and 10-10 are now dropped automatically, the same way the database captures already were.
- **Hitter model** (`league-model.json`): 325 card lines, 8.15M PA.
  - Held out by card r 0.928 and by week 0.853, essentially unchanged.
  - This week held out (2007): r 0.83.
  - Coefficients moved a little: app 0.44 → 0.41, BABIP 8.0 → 9.1, Avoid K 14.7 → 15.5.
- **Arm model** (`league-arm-model.json`): 96 base cards with 1,000+ league IP, r 0.66.
  - Best league edge: Willie Hernandez, Wade Davis, Kirby Yates, Zack Britton, Madison Bumgarner.

## 2. Who is ageing out (usage share and results by week)

Usage share is a card's share of all league PA or IP that week. Results are wRAA/600 for bats and FIP minus league FIP for arms (negative is good). Both are relative to that week's league, so the 2007 week compares fairly. Script: scratch `meta-age.mts`.

**The 101 wave is leaving the HD and PEL meta**, both in usage and in results:

| Card | HD share, mid-Sept → now | Results, before → now |
|---|---|---|
| Mel Ott 101 | 6.4% → 4.4% | wRAA +4.5 → −0.5 |
| Lou Gehrig 101 | 2.5% → 1.0% | +4.7 → −0.7 |
| Tris Speaker VAR | 4.1% → 2.8% | −1.7 → −4.5 |
| Scott Rolen 101 | 4.1% → 3.5% | +4.0 → +1.7 |
| Johan Santana 101 | 6.8% → 4.0% | FIP −0.04 → +0.13 |
| CC Sabathia 101 | 9.4% → 6.8% | −0.14 → −0.04 |
| Roger Clemens 101 | 7.7% → 5.7% | −0.02 → +0.08 |
| Vida Blue 101 | 4.6% → 3.1% | +0.12 → +0.31 |

**Rising (the 102/103 wave):** Brett 103 (+14 wRAA), Utley, Pujols, Franklin Arias, Andruw Jones, Soto, Yastrzemski 103 (+12.8). Arms: Saberhagen, Viola, Plank, Bumgarner 103 (FIP −0.34), Beckett, Brandon Webb, Wade Davis (−0.45).

**Our cards:**
- **Holding:**
  - Brett: +13 to +17 every week.
  - Soto: about +10.
  - Pujols: +9 to +13.
  - Manush: +5 to +7.
  - Seager: +6.6.
  - A-Rod: +9.2 (small sample).
- **Fading:**
  - Banks: +8.8 → +1.0 over six weeks.
  - Aaron: +8.7 → +1.8.
  - De Vries: +7.5 → +1.3.
  - Gibson: −6.8 in HD, −10.6 in PEL.
  - Wood: −6.6.
  - Hidalgo: about 0.
- **Arms holding:**
  - W. Hernandez: −0.50, the best arm in the league.
  - Britton: −0.31.
  - Hershiser: −0.18.
  - Plank: −0.23.
  - Viola: −0.17.
  - Haddix: −0.17.
- **Arms fading:**
  - Kade Anderson: −0.32 → +0.02.
  - Nen: +0.15 in HD (but −0.26 in PEL).
  - Saberhagen: league average (+0.03 last week), which matches L.J.'s read.

## 3. Ballpark

Park sweep: our cards (HD450 export, owned copies) against last week's PEL field (35 teams), 2010, 81 home games. On ratings, KC is +70 runs above the average PEL club before any park. Bats account for +64 of that and arms +6.

| Park | Edge over the season (runs) |
|---|---|
| **1919 Sportsman's Park** | **+14.2** |
| 1971 Yankee Stadium | +12.9 |
| 2026 PNC Field | +12.7 |
| 1910 Baker Bowl | +12.1 |
| 2026 Louisville Slugger Field | +11.8 |
| 1987 Yankee Stadium (this week's) | +10.1 |
| 1952 Yankee Stadium | +5.7 |

**Pick: 1919 Sportsman's Park.**
- It was first in the 10-11 sweep too.
- Its lefty home-run boost (HR vs LHB 1.36, vs RHB 0.91) suits our lineup: Brett, Soto, Seager, Utley, Matsui and Bailey all bat left.
- It's worth about 0.4 wins over Yankee 87.
- Avoid the Fenways (1919 Fenway −12).

## 4. Roster and lineups (league model, PEL, 2010)

**One change: Ernie Banks back for Brandon Wood.**
- Banks is the shortstop against lefties: +10.9 on that side, +5.1 runs over the season (+0.5 W).
- Wood rates −5 vs RHP and −13 vs LHP and is fading in league play.

Nothing else on the bench adds a run. That includes Carlos Pena: he's +34 on the tournament model but −11 vs RHP on the league model, which is fitted on league results. Beltran, Piazza, Ott, De Vries, Greenwell (+1.9) and O'Doul add nothing.

**vs RHP** (+106 above a PEL lineup):

| Pos | Player |
|---|---|
| C | Ed Bailey (VAR) |
| 1B | Albert Pujols |
| 2B | Chase Utley |
| 3B | Alex Rodriguez |
| SS | Corey Seager |
| LF | Juan Soto |
| CF | Heinie Manush |
| RF | Jose Bautista |
| DH | George Brett |

**vs LHP** (+57):

| Pos | Player |
|---|---|
| C | Josh Gibson |
| 1B | Albert Pujols |
| 2B | Chase Utley |
| 3B | Alex Rodriguez |
| SS | Ernie Banks |
| LF | Hank Aaron |
| CF | Jose Bautista (CF 83) |
| RF | Juan Soto |
| DH | Hideki Matsui |

With L.J.'s CF 90 floor, Manush plays CF against lefties instead and Bautista sits. That is about even on the model.

**Bench:**
- **vs RHP:** Aaron, Gibson, Hidalgo, Matsui and Banks.
- **vs LHP:** Bailey, Brett, Seager, Manush and Hidalgo.

Brett (+0.8) and Seager (−3.5) sit against lefties on the model.

**Catcher is the weak spot, but it is weak league-wide.** No catcher we checked adds more than +1.6 runs: Yogi Berra +1.6, Munson +1.0, and none at all for Bench, Campanella, Carter, Fisk, Mauer, Posey, Cochrane, Hartnett, Salas or Piazza.

**Staff:**
- **Rotation:** Hershiser, Cy Young (VAR), Plank, Haddix, Viola.
- **Bullpen:** Britton (CL), W. Hernandez (stopper), Kade Anderson, Lee (VAR), Palencia (VAR), Nen, Saberhagen.
- **What league-best would change:**
  - It would start Hernandez (stamina 67) and Saberhagen. Hernandez's −0.50 FIP is as a reliever, and starters lose the relief edge, so he stays in the pen.
  - It would swap Nen and Palencia for Sabathia and Stieb, which is within a run. Sabathia and Stieb are both fading in league play, so no change.

## 5. Buys worth a look (league model, PEL, 2010)

| Card | Adds | Where |
|---|---|---|
| Carl Yastrzemski 103 | +10.5 runs (+1.1 W) | LF vs RHP (+18.3); Soto moves to RF, Bautista to CF |
| Andruw Jones 102 | +10.3 runs (+1.1 W) | CF on both sides; Manush and Bautista move off CF |
| Miguel Cabrera 102 | +4.3 runs (+0.4 W) | |

Arms performing best in the league that we don't own: Bumgarner 103 (FIP −0.34), Wade Davis (−0.45).

## 6. To do when PEL 10-18 arrives

`pnpm league:panel` → `python3 scripts/league-fit.py` → `pnpm fit:arms`, then:
- `park-sweep --year 2010 --league HD450 --field PEL`. Drop `--field-on` once PEL's newest week is 10-18.
- `league-compare --league PEL --year 2010` with the same roster and adds.

## 7. Update with PEL 10-18 (all leagues in)

### Refit

- **Hitter model:** 331 card lines, 8.38M PA. Held out by card r 0.933 and by week 0.854; this week's PEL held out (2007) r 0.844.
- **Arm model:** 96 base cards. Best league edges: Willie Hernandez +0.48, Wade Davis +0.43, Kirby Yates +0.41, Zack Britton +0.38, **Craig Kimbrel +0.29 (owned, not rostered)**.

### PEL this week

**Pumpkin Smashers – HotL (Rick the Ruler) won the World Series over Mt Etna.** PEL carries two teams under that name; the export merges them (173-152).

Best by runs:

| Team | Record | RD | Pythag W | Note |
|---|---|---|---|---|
| Bethlehem | 89-63 | +182 | 97 | |
| Winnipeg GoJetsGo | 96-66 | +144 | 93 | |
| False Hustle | 93-69 | +135 | 93 | |
| Perugia | 86-61 | +132 | 94 | |
| Gamehendge | 89-73 | +127 | 92 | |
| Mt Etna | 90-72 | +102 | 91 | Runs allowed 688, 2nd fewest |

**Ratings model of every PEL roster** (2010, neutral park; bats are runs/700 PA, arms are runs saved/700 BF, both weighted by playing time):

| Team | Bats | Arms | Sum | Team ZR |
|---|---|---|---|---|
| Portland | 43.5 | 19.0 | 62.5 | |
| **Mt Etna** | 41.5 | **20.5 (#1)** | 62.0 | +12.4 |
| Laffy Comedians | | | 61.2 | |
| Castroville | | | 60.1 | |
| … | | | | |
| Pumpkin Smashers | | | 57.9 | |
| **KC (HD450 roster, same scale)** | **39.5** | **17.9** | **57.5** | **−15.9** |

- KC lands about 9th of 35.
- Park sweep against this week's PEL field: KC is **+35 runs above the average PEL club**. Bats are +33 and arms +2, so **the staff is only PEL-average**. The 10-11 field read +70; the field got stronger.

**What makes Mt Etna good.** Their core is our core: Utley, Brett, Soto, Seager, Gibson, Aaron; Plank, Viola, Hernandez, Britton, Hershiser, Saberhagen, Haddix. The difference is:
1. **Variants all over:** Plank, Viola, Beckett, Bunning, Soto, Rolen, Gibson, Munson, A-Rod 101, Beltran, Haddix.
2. **The 103s:** Yastrzemski, Snider, Bumgarner, plus Andruw Jones in CF (148).
3. **A pen of four elite relievers:** Hernandez, Yates, Britton, Wade Davis.
4. **Gloves:** ZR +12.4 against our −15.9.

It's run prevention, not bats. Their bats (41.5) are close to ours (39.5).

### Park (this week's PEL field)

| Park | Edge |
|---|---|
| **1919 Sportsman's Park** | **+10.4** |
| 1971 Yankee Stadium | +10.0 |
| 1927 Bacharach Park | +9.6 |
| 2026 PNC Field | +9.3 |
| 1987 Yankee Stadium | +6.7 |

The pick stays **1919 Sportsman's**.

### Arms on their whole league record (FIP minus league, all weeks)

| Role | Arm | FIP − league | IP |
|---|---|---|---|
| SP | Hershiser | −0.21 | 138k |
| SP | Plank | −0.21 | |
| SP | Viola | −0.14 | |
| SP | Cy Young (base card; ours is the VAR) | −0.08 | |
| SP | Haddix | −0.07 | fading: +0.24 in PEL lately |
| SP | Kade Anderson | −0.07 | |
| SP | Lee | −0.05 | |
| SP | Saberhagen | −0.04 | |
| SP, not owned | **Bumgarner** | **−0.25** | 8.0k |
| SP, not owned | Webb | −0.14 | 3.5k |
| RP | Hernandez | −0.46 | |
| RP | **Wade Davis** | **−0.44** | 2.0k |
| RP | Yates (not owned) | −0.41 | |
| RP | Britton | −0.39 | |
| RP | **Kimbrel (owned)** | **−0.24** | 10.5k |
| RP | Nen | −0.11 | |
| RP | Palencia | −0.02 | |

### What to do for PEL (in order)

1. **Park:** 1919 Sportsman's Park.
2. **Banks for Wood:** +5.1 runs; SS vs LHP and gloves.
3. **Kimbrel for Palencia (VAR):** free, about +1.5 runs.
4. **Bumgarner** via the mission (Beckett or Andruw + Kimbro; both resell): for Haddix, about +4 runs, more in tournaments.
5. **Wade Davis** (500 CS): for Nen, about +3 runs. Only if the CS isn't converted to PP for the mission.
6. **Bats:** Andruw Jones (+10.2, CF both sides, plus the glove), Yastrzemski (+10.4) or Duke Snider 103 (+10.8): each about +1.1 W. Cabrera +4.5, Yogi +1.7, Carlos Pena 0.
7. **Lineups:** unchanged from §4.

## 8. Final pick: the best 26 period (10-19, supersedes §4 and §7)

L.J.: "the best 26 players period — defense might suck, but our ballpark and offense crushes." Shared with friends as the artifact https://claude.ai/artifact/DBPc8NSUuifjVf3b24qwaQ.

The 26 come from his whole collection (collection 262), scored on the league model with gloves ×1. The answer is the same at ×1.5 and with the 1971 Yankee home half included.

**Bats.** I swept 126 other owned bats (value 95+) against the 14. None adds more than +2 runs.
- Core 12, then Greenwell for Manush and Mays for Hidalgo.
- On the 12 core, the 13th bat vs RHP is worth: Greenwell +6.5, Manush +4.6, Hidalgo +4.1. Mays adds +2.0 vs LHP.

**vs RHP** (+108.8):

| # | Pos | Player |
|---|---|---|
| 1 | DH | Brett |
| 2 | RF | Soto |
| 3 | 3B | A-Rod |
| 4 | 1B | Pujols |
| 5 | SS | Seager |
| 6 | CF | Bautista |
| 7 | 2B | Utley |
| 8 | LF | Greenwell |
| 9 | C | Bailey VAR |

Bench: Gibson, Banks, Aaron, Matsui, Mays.

**vs LHP** (+60.7):

| # | Pos | Player |
|---|---|---|
| 1 | RF | Soto |
| 2 | 2B | Utley |
| 3 | DH | Matsui |
| 4 | 1B | Pujols |
| 5 | LF | Aaron |
| 6 | 3B | A-Rod |
| 7 | SS | Banks |
| 8 | CF | Mays |
| 9 | C | Gibson |

Bench: Bailey, Brett, Seager, Greenwell, Bautista.

**Batting orders:**
- The orders follow the league-model ranking.
- The order engine, blending home 1971 Yankee and road, scores them 0.008 and 0.001 R/G off its best.
- Its own best order bats Pujols 8th vs RHP and A-Rod 9th vs LHP, because it runs on tournament ratings.
- Scratch: `order2.mts` (`ORD_R` / `ORD_L` score a fixed order).

**Bautista CF (83) vs RHP:**
- This breaks the CF 90 floor.
- Locking CF vs RHP costs: Manush −1.7, Hidalgo −2.6, Mays −20.0.
- Manush in for Mays costs about 3 runs a season in all.
- Scratch: `cflock.mts`.

**Glove ratings:** Greenwell LF 125, Mays CF 107 (speed 118), Hidalgo CF 114, Manush CF 97, Bautista CF 83 / RF 111, Soto RF 91, Aaron LF 85.

**Staff.** The solver picked these from 170 owned arms, PEL family, at 193 IP per starter and 65 per reliever. Scratch: `beststaff.mts`, `staffplus.mts`.
- **Rotation:** Plank, Hershiser, Lee VAR, Cy Young VAR, Saberhagen.
- **Pen:**
  - Britton CL.
  - Hernandez setup (fireman).
  - Kimbrel, Nen.
  - Viola: long man and 6th starter.
  - Palencia VAR, Gossage.
- **Total:** +26.0 runs.
- The HD staff as used was +15.8, and +23.0 with only its roles re-solved.
- The solver's pure best is +27.5, with Larry Jackson SP5 and Varland. Both have under 1,000 league IP between them, so I kept the proven arms.

**Vs the HD title team as used:** bats +77.2 → +86.2 and staff +15.8 → +26.0, about +19 runs (2 W) before the park.

**Park:** 1971 Yankee Stadium (+10.0), then 1927 Bacharach (+9.6), then 2026 PNC (+9.3).

**Buys:**

| Card | Gain (runs/season) | Note |
|---|---|---|
| Yaz 103 | +9.1 | |
| Snider 103 | +9.1 | |
| Andruw 102 | +7.3 | |
| Bumgarner 103 | +3.2 | SP1; Saberhagen sits |
| Kirby Yates 101 | +2.5 | |
| Wade Davis | +2.2 | |
| Webb | +1.0 | |

Swapping Brett for Yaz is only about +2.8 in league.
