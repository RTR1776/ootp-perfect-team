# League plan for next week: PEL, 2010 run environment (2026-10-19)

KC Torrent was promoted from HD450 back to PEL. Next week returns to the PT default run environment (2010) after this week's 2007 theme.

Data in:
- **HD:** all four leagues for the week ending 10-18 (HD450–HD453).
- **PEL:** last week's (10-11). This week's PEL export is still to come.

Everything below is on the league models refit today. **Re-run when this week's PEL file arrives.**

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
