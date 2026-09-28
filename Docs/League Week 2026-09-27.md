# League week 2026-09-27: how cards are playing

L.J. uploaded HD450, the last HD league file needed, so the 2026-09-27 week is complete: PEL and all four HD leagues, finished seasons, in the ordinary 2010 environment. He asked what it says about how cards play now, outside a theme week.

**Short answer: cards play the way the model says, apart from a few that have been off for weeks.**
- League pays for the same ratings it did.
- The biggest systematic miss is in arms. The league keeps getting stronger, so the Card Model reads arms 0.05–0.09 runs/9 too high on average. The order is right; the level isn't.
- For his team: the season was luck and usage. The fixes are the catcher against RHP and one vs-LHP DH.

**The data.**
- PEL (36 teams) and HD450–453 (30 each).
- 972,844 PA of hitting over 4,615 copy-rows, and 224,046 IP of pitching.
- Every row carries the copy's own played split ratings.

| Week | K% | HR/PA | AVG | wOBA |
|---|---|---|---|---|
| 2026-09-27 (2010, as L.J. confirmed) | 19.2% | 2.56% | .261 | .325 |
| 2026-09-20 (1989 theme) | 14.9% | 1.98% | .255 | .306 |

**Units.**
- Bats: runs per 700 PA above the league's average bat on that board (vs LHP or vs RHP). "Season" combines the boards at the league's share of PA against LHP (PEL 0.47, HD 0.46).
- Arms: FIP-type runs per 9 IP better than that week's league, the app's edge9.
- Card Model totals: runs a season.

**How it was made.** Three analyses (bats, arms, his team), each re-derived by an independent checker; only confirmed claims are here, with the checker's corrections. The analysis ran on the reviewed refit, before L.J.'s 09-27 data push refreshed the tournament model's calibration. The refit shipped with this doc was re-run after that push. Its hitter coefficients moved at most 0.09, and the arm league slopes are identical. Spot checks, such as his park sweeps and Soto against Canseco, moved 0.3 runs or less.

## What the week says

- **The hitter model called it.** Held out, it predicts the week's 195 card-board lines at r 0.844, against 0.778 for the tournament model scaled down alone. League still returns about two-thirds (0.67) of a card's tournament edge.
- **League pays for the same ratings.** +10 at typical levels is worth:

  | Rating | Runs per 700 PA |
  |---|---|
  | Avoid K | 1.5–1.9 |
  | Power | 1.7 |
  | BABIP | 1.3–1.5 |
  | Eye | 0.7–0.9 |
  | Gap | 0.4–0.5 |

  - A weakness costs most: +10 Avoid K from 60 is worth 3.5–3.6.
  - This week alone prices no rating detectably differently from the other ordinary weeks, though the test is weak.
- **Copies of one card still differ only by luck.**
  - Bat copies spread 1.04× what sampling gives (1.00× in earlier weeks).
  - Arm copies spread 1.12×. The extra is probably team context, such as parks and catchers.
- **A few bats sit off the model every week:**
  - Ted Williams, about +14.
  - Heinie Manush, +5 to +8.
  - John McGraw vs LHP, +21.
  - Phil Rizzuto, −7 to −14.
- **Three rating bands the model misses:**
  - Power 40–70 plays about 4 runs below it.
  - Avoid K under 80 plays about 6.5 below.
  - Eye 200+ plays about 4 above.
- **Arms: league pays 2–3 times what tournaments pay for Control, Stuff and pHR.** For a starter that is about 0.06 runs/9 per +10. pBABIP doesn't move the FIP-type edge.
- **League arms get better every week.**
  - In HD450 the average rostered arm's Control went from 100 to 121 since 06-28.
  - A fixed card's edge falls 0.028 runs/9 a week.
  - The Card Model pools old weeks, so its arm scores read high. Read staff totals as comparisons, not as runs over the league.
- **Theme weeks move bats about half to three-quarters as much as the app's theme prices say.**

## His team (Kansas City Torrent - JW, PEL)

**The season: 74-88, tied 27th of 36 by wins.**
- Scored 744 (4.59 a game, league 4.68) and allowed 752 (RA/9 4.64, league 4.69).
- The runs say 80.2 wins, so close games cost 6.2 of them (z −1.9).
- KC gave 70.8% of its PA to its top nine, 2nd-lowest in PEL (median 77.9%). That is about 445 PA more bench play than a median team.
- The export has no standings. By the 09-26 rule, next week is probably HD.

**Every line was within luck.**
- Bats: against the model for each copy's played ratings, Σz² is 19.8 on 18 bats (p 0.34), which is what luck looks like. The team's bats ran −16.1 runs against a model +1.7 on the same PA (sampling SE 32.8).
- Arms: all 14 within luck. The staff's K/BB/HR was worth +18.6 runs; the Card Model says +18.7.

**Real misses on his cards.** These are measured on the other copies of each card and held across ordinary weeks. Runs per 700 PA.
- **Plus:**
  - Manush +6.0 ± 1.7 on both boards.
  - Boone vs LHP +5.9 ± 2.0.
  - Rolen vs LHP +4.0 ± 1.0 over 83,060 PA.
  - Beltran vs RHP +2.2 ± 0.9.
- **Minus:**
  - Aaron vs RHP −2.1 ± 0.9 over 107,679 PA (−2.7 with Aaron refitted out). His −4.7 vs LHP this week is the one-week part.
  - Ott about −1 to −1.5.
  - Hornsby vs LHP −3.3 to −4.2.
  - Gibson vs RHP −2.5 ± 1.1.
- **What they mean:** 1–6 runs each, and every plus is already in a best nine. They break near-ties; they don't change the plan.
- **The one near-tie is 1B against RHP.** The model has Aaron there by 1.1 over Clark, and Aaron's lasting vs-RHP minus is bigger than that, so it's a toss-up. Either way, Ott should DH against RHP, not Aaron.

**Lineups: the catcher is the fix.** The best nines on the league model, bat plus glove per slot:

| Slot | vs RHP | vs LHP |
|---|---|---|
| C | Ed Bailey VAR +7.0 | Gibson −3.4 |
| 1B | Aaron +3.8 | Banks +12.2 |
| 2B | De Vries +6.2 | Boone +6.4 |
| 3B | Rolen +1.4 (glove +6.1) | Rolen +8.0 |
| SS | Banks +7.9 | Cholowsky −1.5 |
| LF | Manush +7.2 | Manush +0.6 |
| CF | Hidalgo +6.7 | Ott −2.3 |
| RF | Beltran +4.2 | Beltran +2.1 |
| DH | Ott +4.4 | Aaron +12.4 |
| Nine | +48.9 | +34.6 |

- **Against RHP, Piazza at C scores −10.9 (bat +3.1, glove −14.0), and Ed Bailey VAR +7.0 (bat +2.3, glove +4.7).**
  - Swapping only the catcher is 17.9 of the 19.4 runs by which his 09-26 vs-RHP lineup (Piazza C, Clark 1B, Aaron DH) falls short of the best nine. That is about +9.5 runs a season.
  - Bailey is in reserve on the current roster, so this means activating him.
- **Against LHP, catch Gibson (−3.4), not Piazza (−15.3).**
- **Observed catcher defence agrees,** in runs per 1,000 innings:
  - Piazza −12.6 over 34,567 innings.
  - Gibson −2.0 over 311,975.
  - Bailey VAR +5.7 over 1,482 innings on his team (weak evidence; the model has +3.3).
- **HD picks the same nines as PEL.**

**Staff.**
- **Start Cliff Lee VAR instead of Stieb: +3.6 runs a season** (+17.3 → +20.8 on 12 arms).
- **Don't start Gossage** because the Card Model's free pick slots him at SP5. That score is a ratings estimate for a 48-Stamina reliever with no starts on file.
- **Balls in play cost the runs, not the arms.**
  - The starters allowed 25.7 more runs than their K/BB/HR imply: Hershiser −14.4, Saberhagen −13.1.
  - The staff's rates matched or beat the league: K 19.2% (18.8%), BB+HBP 9.0% (9.1%), HR 2.50% (2.63%).
  - Fielding was average.
- **The staff page read +20.8 on 09-27 before HD450 and HD452; it reads +18.7 now.** The new HD lines account for −2.4 and the refit for +0.3.

**Upgrades.** Owned cards add almost nothing: Willie Mays 98 +3.0 runs a season, Al Simmons 99 +1.0.

Shop bats on the PEL refit (the best nine with him minus without, reshuffles included; prices from the 09-27 shop list):

| Card | Adds vs RHP / vs LHP | Season (runs) | Last-10 | Lowest ask |
|---|---|---|---|---|
| Kevin Mitchell VAR 100 | +2.9 / +26.4 | +14.0 | 268k | not on the list |
| Juan Soto 102 | +9.1 / +12.3 | +10.6 | 267.5k | none (top bid 275k) |
| Franklin Arias 102 | +9.7 / +8.9 | +9.3 | 483.5k | none |
| J.D. Martinez 100 | 0.0 / +19.1 | +9.0 | 197k | 200k |
| Hank Greenberg 102 | 0.0 / +18.7 | +8.8 | 319k | none |
| Kevin Mitchell 100 | 0.0 / +18.0 | +8.5 | 153k | 156k |
| Jose Canseco 100 | +4.2 / +10.7 | +7.3 | 211k | 260k |

- **The Mitchell variant is the biggest single add under 500k.** Base Mitchell is the most runs per coin.
- **Buys don't add up, because two DH bats share one slot.** The best pair is Mitchell VAR + Soto, at +23.4 a season.
- **Arms after bats:** Eddie Plank 102 +4.0 as a starter, or Willie Hernandez 102 +4.1 (thin SP sample). Neither had a seller.
- **HD ranks the bats the same way:** Mitchell VAR +13.8, Soto +10.6.
- **The park pick** (`Docs/Rosters/League Park Pick 2026-09-28.md`) makes Canseco plus 1945 Fenway about level with Soto in any park.

**Do**
1. Against RHP, catch Ed Bailey VAR, not Piazza, and DH Ott, not Aaron (+10.3 runs a season for the whole vs-RHP fix).
2. Against LHP, catch Gibson.
3. Start Cliff Lee VAR instead of Stieb (+3.6).
4. Buy one vs-LHP DH: the Mitchell variant for the most runs, base Mitchell or J.D. Martinez for the most per coin, Soto if he comes up.
5. Upload one mid-season export, so we can test whether a copy's first half predicts its second.

**Don't**
1. Don't bench anyone for this season's line: Rolen, Boone and Beltran run at or above the model elsewhere.
2. Don't move Clark or Jenkins into the vs-LHP lineup for a hot 100–160 PA. The model has them at −15.7 and −13.2 there.
3. Don't keep Piazza catching because he hit. His glove costs 14 runs a season at C.
4. Don't sell Saberhagen or Hershiser for their 5.3 RA/9. Their K/BB/HR matched the league.
5. Don't read 74-88 as the roster's level. The runs say 80 wins.

## Bats

**Best bats this week.** These are card forms with 1,000+ PA pooled over every team in the five leagues. The model is in brackets, and z is observed minus model over sampling error.

| Card | Value, pos | PA (copies) | Season | z |
|---|---|---|---|---|
| Ted Williams (PTMS 2, 1942) | 102 LF | 1,282 (2) | +36.0 (+24.2) | +1.3 |
| Heinie Manush VAR L5 | 102 LF | 1,303 (2) | +25.2 (+10.4) | +1.8 |
| Miguel Cabrera | 102 3B | 3,374 (5) | +16.8 (+19.8) | −0.6 |
| Dan Brouthers | 101 1B | 6,149 (13) | +15.6 (+3.3) | +3.2 |
| Vladimir Guerrero | 102 RF | 5,115 (8) | +15.1 (+10.5) | +1.1 |
| Frank Schulte | 102 RF | 6,008 (12) | +14.2 (+10.3) | +1.0 |
| Jose Canseco | 100 RF | 2,143 (5) | +12.5 (+10.6) | +0.3 |
| Juan Soto | 102 RF | 1,306 (6) | +11.9 (+13.8) | −0.2 |
| Mark Teixeira | 101 1B | 2,439 (4) | +10.0 (−0.9) | +1.9 |
| Heinie Manush (his) | 102 LF | 22,197 (51) | +9.4 (+4.0) | +2.8 |

- **The top of any such list is partly luck.** Lines of 1,000–3,000 PA carry 5–10 runs of sampling error. The model's lasting miss on a typical card is about 2 runs.
- **Ted Williams is not a hot week.** Over every ordinary week he is +39.7 against a model +25.9 (z +3.0). Read him as a +32 to +38 bat.

**Cards off the model.** "Earlier" is 09-13, 09-06 and 08-30 pooled.

| Card | This week: gap (z) | Earlier: gap (z) | Read |
|---|---|---|---|
| Phil Rizzuto 99 SS | −14.5 (−4.2) | −6.9 (−3.1) | Real: the model overrates him by 7–14 |
| Ted Williams 102 | +11.8 (+1.3) | +14.4 (+2.7) | Real: +8 to +18 every week |
| Heinie Manush (his) | +5.5 (+2.8) | +7.5 (+2.4) | Real: +5 to +8 |
| John McGraw, vs LHP | +24.1 (+2.5) | +21.3 (+3.2) | Real: the model says −30.7, mostly from Power 1; he plays −6.6 |
| Dan Brouthers | +12.3 (+3.2) | +3.5 (+1.9) | Small plus, about +3.5; this week is mostly luck |
| Hank Aaron (his) | −3.9 (−3.1) | −0.1 (−0.1) | Season line: this week only. vs RHP: a lasting −2.1 to −2.7 |
| Chipper Jones VAR L5 | −15.7 (−2.9) | vs RHP −10.9 (−2.9) | Real for the variant vs RHP only; base Chipper plays to the model |

**Patterns the model misses.** Board lines with 300+ PA, all ordinary weeks. Runs per 700 PA, z in brackets.

| Pattern | All ordinary weeks | 09-27 | 09-13/06/08-30 |
|---|---|---|---|
| Power 40–70 on that board | −4.3 (−4.0) | −5.3 (−2.6) | −3.8 (−2.9) |
| Avoid K under 80 | −6.5 (−3.3) | −4.5 (−0.9) | −5.5 (−2.1) |
| Eye 200+ | +4.3 (+3.2) | +2.4 (+1.2) | +5.4 (+3.3) |
| Card year before 1920 | +1.7 (+2.3) | +2.3 (+1.7) | +1.7 (+1.9) |
| Card year 1946–92 | −1.6 (−3.3) | −1.8 (−2.1) | −1.1 (−1.9) |

- **Low power is the clearest miss:** contact bats at Power 40–70 play about 4 runs below the model. Examples: Rizzuto vs RHP −12.4 (Power 48), Ozzie Smith vs LHP −4.7 over 30,209 PA (Power 48). The log Power term is too gentle at 40–70 and too harsh near 0 (McGraw).
- **Avoid K under 80 costs about 6.5 runs more than the model says.** Example: J.D. Martinez vs RHP −8.8 over 10,987 PA.
- **Eye 200+ earns about 4 more.** Example: Rolen vs LHP +3.9 over 83,183 PA.
- **No effect:** tier or value, variant against base, and Speed.
- About 30 features were tried per sample, so only patterns with the same sign in both samples are listed.

**What league pays for.** +10 in one rating on Carlos Beltran (HD, 2010), runs per 700 PA:

| Rating | Typical | From 60 | League ÷ tournament: typical / from 60 |
|---|---|---|---|
| Avoid K | 1.45–1.92 | 3.49–3.60 | 1.18–1.34 / 1.13–1.18 |
| Power | 1.67–1.76 | 1.60–1.63 | 0.57–0.61 / 0.92–0.94 |
| BABIP | 1.26–1.51 | 2.11–2.15 | 0.69–0.75 / 0.83–0.84 |
| Eye | 0.70–0.92 | 1.96–2.00 | 2.26–2.64 / 2.58–2.83 |
| Gap | 0.42–0.47 | 0.70–0.71 | 0.74–0.79 / 0.95–0.96 |

- **Same order as the 09-26 doc,** and the refit moved no price by more than 0.12.
- **This week alone agrees.** Fitted on its own 195 lines, every pooled coefficient sits inside its 95% interval. For example, Avoid K is 11.6 (4.2–18.1) against a pooled 13.7.

**The 1989 week against now.**
- **1989 squeezed bats.** The spread between bat lines was 6.9 runs per 700 PA, against 8.0 now.
- **Its BABIP premium didn't show up.** The app's 1989 price makes BABIP worth more then than now; in play it was worth less.
- **Card by card, bats followed the app's theme moves at a slope of 0.53 ± 0.17.** So for the next theme week, move bats about half to three-quarters as much as the theme prices say.

## Arms

**The best arms with real samples:**
- **Starters:**
  - Hershiser: HD +0.18 ± 0.04 over 17,785 IP; PEL +0.20 ± 0.07.
  - Eddie Plank: HD +0.26 ± 0.07; PEL +0.34 ± 0.14.
  - Sabathia: HD +0.13 ± 0.04.
  - Cy Young VAR: HD +0.37 ± 0.16, on 4 teams.
- **Relievers:**
  - Willie Hernandez: HD +0.57 ± 0.07 over 4,945 IP; PEL +0.49 ± 0.12.
  - Kirby Yates: PEL +0.70 ± 0.22.
  - Kenley Jansen: PEL +0.51 ± 0.17.
  - Zack Britton: +0.40 in both.
- **Most other top lines** come from 2–3 teams, with an SE of 0.2–0.45.
- **Season scale:** a rotation slot pitches about 196 IP (PEL) and a pen slot about 60. So +0.20 is about +4.3 runs a season for a starter.

**How the Card Model called the week.** The arm model was refit without 09-27, each card-role scored with the app's `scoreArms`, and the scores compared with the week:

| Family, role | Card-roles | r | Ceiling from sampling | Bias, runs/9 |
|---|---|---|---|---|
| PEL SP | 33 | 0.49 | 0.60 | −0.054 ± 0.027 |
| PEL RP | 61 | 0.66 | 0.73 | −0.082 ± 0.052 |
| HD SP | 58 | 0.72 | 0.86 | −0.088 ± 0.018 |
| HD RP | 114 | 0.73 | 0.81 | −0.080 ± 0.030 |

- **Every cell reads too high,** by 0.054–0.088 runs/9. The miss grows with the age of a card's evidence, by 0.023 runs/9 a week.
- **Shifting each prediction by the league's weekly drift removes the bias and leaves r where it was.** It is a level problem, not an order problem.
- **The per-rating fit below predicted the same card-roles better** (r 0.37 / 0.66 / 0.76 / 0.74), with no bias.

**What league pays for, arms.** An IP-weighted fit of each card-role's edge on ln(shop rating) minus the league-week's mean, over the ordinary weeks: 69 starters (874,067 IP) and 105 relievers (335,137 IP). +10 from the typical level, runs/9:

| Role | Rating | League | Tournament model | League ÷ tournament |
|---|---|---|---|---|
| SP | Stuff | 0.059 | 0.031 | 1.9 |
| SP | pHR | 0.060 | 0.030 | 2.0 |
| SP | Control | 0.063 | 0.021 | 3.0 |
| SP | pBABIP | 0.000 | 0.026 | 0.0 |
| RP | Stuff | 0.050 | 0.026 | 1.9 |
| RP | pHR | 0.088 | 0.033 | 2.7 |
| RP | Control | 0.077 | 0.030 | 2.6 |
| RP | pBABIP | 0.003 | 0.025 | 0.1 |

- **pBABIP shows only in runs.** In earned runs, +10 is worth 0.026 (SP) to 0.044 (RP) runs/9.
- **Movement is not a separate rating.** On shop cards it is (2·pHR + pBABIP)/3.
- **Stamina buys innings, not better ones:** IP per start = 5.44 + 0.0112 × Stamina.
- **The fit holds out well:** r 0.83–0.87 (SP) and 0.82–0.84 (RP) by card, against 0.66–0.72 for the tournament read.

**What else shows up.**
- **The league gets stronger every week.**
  - HD450's rostered arms (06-28 → 09-27): Stuff 117 → 132, Control 100 → 121, pHR 116 → 133, pBABIP 117 → 134.
  - Examples: Vida Blue went from +0.18 on 07-06 to −0.16 now, and Sabathia from +0.24 to +0.13.
- **Pitcher splits are real in league.** Left-handers show +0.33 ± 0.04 runs/9 more platoon gap than their split ratings say. The staff board's vs-LHB and vs-RHB columns are observed, so they already show it.
- **Relieving gives no dependable gain:** the same card relieving rather than starting gained +0.056 ± 0.029 runs/9.
- **Arms off their ratings, held across weeks:**
  - Under: Carl Hubbell (HD SP).
  - Over: Kenley Jansen (PEL and HD RP), Jesse Orosco and Daniel Palencia base (HD RP).
  - Only relievers' misses carry over from week to week. The Card Model already follows them through their own lines.

## The refit (shipped with this doc)

| Hitters | Pre-refit | Refit |
|---|---|---|
| Card-board lines / PA | 256 / 4.91M | 267 / 5.65M |
| app | 0.458 | 0.462 |
| Avoid K / BABIP / Gap / Power / Eye | 14.59 / 5.83 / 2.23 / 5.78 / 10.68 | 13.76 / 6.20 / 2.37 / 5.27 / 10.67 |
| Held out by card / by week | 0.920 / 0.846 | 0.925 / 0.848 |
| 09-27 held out | 0.778 (83 lines, PEL only) | 0.844 (195 lines) |
| HD reference week | 09-13 (HD450, 451, 453) | 09-27 (all four) |

| Arms | Pre-refit | Refit |
|---|---|---|
| Arms in the fit | 83 | 85 |
| k (ratings estimate) | 0.981 | 0.987 |
| PEL a / b / w | −0.014 / 0.726 / 4000 | −0.015 / 0.743 / 4000 |
| HD a / b / w | 0.023 / 0.767 / 1000 | 0.023 / 0.813 / 1000 |

**What it means for the Card Model:**
1. **Bats: compare cards, not totals across refits.**
   - PEL totals moved under 1 run, and no lineup changed.
   - HD totals fell about 15 runs, because every HD bat is now measured against the stronger 09-27 week.
2. **Arms: the order is right and the level is high.** Scores average 0.06–0.07 runs/9 above what the week's arms did, about 9 runs on a 12-arm staff.
3. **Don't decide on a ratings estimate** (grey on the staff board). It prices Control, Stuff and pHR at well under half of what league pays, and credits pBABIP, which the edge doesn't see.
4. **Adjust bats at the extremes by hand:**
   - about −4 at Power 40–70 on a board;
   - about −6.5 for Avoid K under 80;
   - about +4 for Eye 200+.
5. **Next for the model:**
   - measure each arm week against its own league, or weight recent weeks;
   - replace the arm ratings estimate with the per-rating fit;
   - fix HD451's 09-27 pitcher Control import (a Mac script).

## How to re-run

Nothing here writes to the database.

    cd web
    pnpm league:panel                      # ../Archive/.league-panel.csv
    python3 scripts/league-fit.py [--dry]  # src/data/league-model.json
    pnpm fit:arms [--dry]                  # src/data/league-arm-model.json
    pnpm league:compare --league HD --roster "<his bats>" --add "Juan Soto#87013"   # one candidate at a time

The rest of the analysis (per-card persistence, patterns, the held-out arm test) was one-off scripts in the session scratchpad. They are not kept.

## Caveats

- **HD451 pitcher Control:** its 09-27 file has the hitters' Contact in the pitchers' Control columns. Nothing above depends on it: the arm fit uses shop Control, and edges come from K, BB and HR. The stored rows still need a re-import.
- **Sampling noise:** one copy's line says little. Arm z-scores are about 5% generous, because arm copies spread 1.12×.
- **In-sample:** the refit includes 09-27, so this week's bat gaps are in-sample. Heavily used cards (Aaron 4.7% of the fit's PA, Ott 7%) have part of their gap absorbed; their card-left-out figures are given above.
- **Team and park effects** add about 3 runs per 700 PA per team, so cards on 1–2 teams are less certain than their z.
- **His lineups** are from the 09-26 handoffs. The 12-arm staff assumes Vida Blue and Henke are off the roster.
- **Prices** are from the 09-27 shop list, and many cards had no seller.
- **Catcher defence for 09-27 can't be measured,** because those rows have no framing columns.
