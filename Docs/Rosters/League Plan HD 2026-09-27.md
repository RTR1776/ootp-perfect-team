# League plan for next week (relegated to HD), 2026-09-27

Kansas City Torrent - JW is back in HD after one PEL week (HD451 on 09-20, PEL on 09-27). HD rosters Perfect cards like PEL does: values run to 102–103 and average about 100.6, against PEL's 101.0. **Every card stays legal. The field gets weaker.**

- **Scoring.**
  - Bats use the league model (`league-model.json`, refit 09-27) in the PT default environment, HD family, with 44% of PA against left-handers.
  - Arms use every card's pooled league results. The measure is the FIP-component edge against each week's league, over every team that rostered the card.
  - Parks use `park-sweep` with the 09-27 roster against the 09-20 HD field (`--field-on`, new).
  - Prices are from L.J.'s shop list of 2026-09-27.
- **Standing.** Against the HD field the current roster is **+64 runs better than an average team before any park**: bats +49, arms +16.

## Lineups (league model, runs per 700 PA, glove included)

| | vs RHP (56%) | | vs LHP (44%) | |
|---|---|---|---|---|
| C | Ed Bailey (VAR) | +6.7 | Josh Gibson | +2.3 |
| 1B | Hank Aaron | +7.1 | Hank Aaron | +16.5 |
| 2B | Leodalis De Vries | +9.4 | Bret Boone | +10.2 |
| 3B | Scott Rolen | +4.8 | Scott Rolen | +11.7 |
| SS | Ernie Banks | +11.4 | Ernie Banks | +16.1 |
| LF | Heinie Manush | +10.7 | Heinie Manush | +5.1 |
| CF | Richard Hidalgo | +10.2 | Mel Ott → **Willie Mays** (owned) | +1.6 → +6.7 |
| RF | Carlos Beltran | +7.6 | Carlos Beltran | +6.0 |
| DH | Mel Ott | +7.9 | Mike Piazza (VAR) → **Al Simmons** (owned) | +2.8 → +5.1 |

- **Free upgrades from the collection:** Willie Mays 98 and Al Simmons 99 are owned but not on the league team.
  - Both help only against LHP: +6.4 and +2.2 on that board, +2.8 and +1.0 over a season.
  - Nothing owned beats the current vs-RHP nine.
- **Deadweight:**
  - Will Clark: +3.8 vs RHP, −12.1 vs LHP.
  - Also Walker Jenkins, Tommy Harper, Rogers Hornsby and Roch Cholowsky.
  - Keep one utility glove (Brandon Wood) and the second catcher.

## Buys (tonight's prices; each scored alone against the current roster)

| Card | Price | vs RHP | vs LHP | Season | Runs per 100k |
|---|---|---|---|---|---|
| **Kevin Mitchell 100, variant** | variant L10 268k | +2.7 | +26.6 | **+13.3 (1.4 W)** | 5.0 |
| **Juan Soto 102** | L10 262k, no ask now (bid) | +8.9 | +12.7 | **+10.6 (1.1 W)** | 4.0 |
| J.D. Martinez 100 | ask 200k | 0 | +19.0 | +8.4 | 4.2 |
| Kevin Mitchell 100 (base) | ask 190k (L10 155k) | 0 | +18.2 | +8.1 | 4.3–5.2 |
| Hank Greenberg 102 | L10 319k | 0 | +18.5 | +8.2 | 2.6 |
| Jose Canseco 100 | ask 260k | +3.9 | +10.5 | +6.9 | 2.6 |
| Mike Greenwell 99 | ask 105k | +7.5 | 0 | +4.2 | 4.0 |

- **Mitchell, Martinez and Greenberg all do the same job: DH against LHP.** Buy one of them.
- Soto helps both boards, so he stacks with any of them. With Soto, Mays and Simmons on the team, the Mitchell variant still adds **+11.8**.
- Soto, the Mitchell variant, Mays and Simmons together are about **+25 runs (2.5 W)** over today's lineups. About 4 of those runs come from Mays and Simmons, who are free; the two buys cost about 530k.
- On a ~200k budget: Mitchell base (ask 190k) or J.D. Martinez (200k), both about +8.

## Pitching (pooled league results; + = better than the league)

| Staff | Role this week | Edge per 9 | League IP | Note |
|---|---|---|---|---|
| **Cliff Lee (VAR)** | relief | **+0.36** (as SP) | 3,306 | best starter result in the data; **move him to the rotation** |
| Orel Hershiser | SP | +0.26 | 52,975 | |
| Cy Young (VAR) 102 | SP | +0.18 | 3,090 | |
| CC Sabathia | relief | +0.12 (as SP) | 100,140 | better as the 5th starter than in the pen |
| Bret Saberhagen | SP | +0.10 | 3,285 | |
| Harvey Haddix | SP | +0.08 | 24,646 | long man |
| Dave Stieb | SP | −0.27 | 498 | small sample, but last; **out of the rotation** |
| Craig Kimbrel / Zack Britton | RP / CL | +0.36 each | 8,942 / 4,256 | keep |
| Daniel Palencia (VAR) / Robb Nen / Rich Gossage | RP | +0.20 / +0.17 / +0.15 | | keep |
| Tom Henke / Vida Blue | RP | −0.05 each | 10,603 / 77,686 | replace |

- **Rotation:** Lee (VAR), Hershiser, Cy Young (VAR), Sabathia, Saberhagen; Haddix to the pen as long man.
- **Cheap arm buys:**
  - **Kenley Jansen 100** (L10 ~96k): +0.29 over 20,028 league IP, about +2.7 runs per 70 IP over Henke or Blue.
  - Jim Bunning 101 (ask 130k): +0.20 as SP.
  - Eddie Plank 102 (ask 200k): +0.23 as SP.
  - Arms are compressed in league play, so the bats above are better value per PP.
- **Variants that don't pay:** Nen's and Gossage's variants play much better (+0.63 / +0.56), but they cost 509k / 655k.

## Home park (edge = your runs minus the field's in the same park, 81 home games)

| Park | Now | With Mitchell |
|---|---|---|
| **1945 Fenway Park** (HR L 0.808 / R 1.385) | +3.4 | **+7.8** |
| 2026 Durham Bulls Athletic Park | +3.0 | +5.1 |
| 1905 Polo Grounds | +2.9 | — |
| 2026 Rio Grande Credit Union Field | +2.7 | +5.2 |
| 1911 Bennett Park | +2.5 | +5.8 |

- The roster's power is right-handed (Aaron, Banks, Gibson, Rolen, Piazza, plus Mitchell), so a park that lifts right-handed home runs and suppresses left-handed ones pays.
- The park is worth under a win either way.
- Rerun after buying:

      pnpm park:sweep --league PEL --on 2026-09-27 --field HD450,HD451,HD452,HD453 --field-on 2026-09-20 --year 2010 [--add "Name@PA"]

## Caveats

- **Theme weeks.**
  - If next week is announced as a theme week, rerun `league:compare --year <year>` and `park:sweep --year <year>`.
  - In the 1959 and 1989 weeks, Avoid K was worth about 0.55 of normal and Power 0.63–0.78.
  - The Mitchell/Canseco order held in 1989.
- **Unknown data.** The Mitchell variant's vL Power 250 is past the league fit's range (max 233). The HD field is 09-20's; the league you land in is not known yet.
