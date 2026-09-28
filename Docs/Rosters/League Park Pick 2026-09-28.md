# League home park for next week (HD), 2026-09-28

L.J. asked for the park pick for next week, with his current roster and reserves (screenshots). He leans right-handed even if he adds Juan Soto, a left-handed bat, because of his other power bats. He asked whether something more extreme than Fenway would suit the team better. The only change he'd make is Soto (buy order up at 265k) or Jose Canseco.

**Pick 1945 Fenway Park.** Nothing more extreme beats it for this roster, with or without Canseco. If Soto lands, no park is worth much, and Fenway costs little.

## How it was scored

- **Roster:** his 26 from the screenshot. The 09-27 PEL export is the source, with the reserves dropped (Wood, Cholowsky, Bailey, Harper, Hornsby, Henke) and Aaron and Rolen at 600 PA as full-time starters.
- **Field:** all four HD leagues' 09-27 rosters (120 teams), since he plays HD next week. 2010 run environment.
- **Tool:** `park:sweep`. The edge is his runs minus the field's in the same park, over 81 home games, on the tournament scale; league play shrinks it to roughly half to two-thirds.
- **Adding a bat:** Soto or Canseco is added at 600 PA in place of Will Clark.

      pnpm park:sweep --league PEL --on 2026-09-27 --team "Kansas City Torrent - JW" \
        --field HD450,HD451,HD452,HD453 --field-on 2026-09-27 --year 2010 \
        --drop "Brandon Wood,Roch Cholowsky,Ed Bailey,Tommy Harper,Rogers Hornsby,Tom Henke,Hank Aaron,Scott Rolen[,Will Clark]" \
        --add "Hank Aaron@600,Scott Rolen@600[,Juan Soto@600 | Jose Canseco@600]" [--parks "Fenway Park@1945,…"]

Before any park he is **+60.5 runs better than the HD field**: bats +55.3, arms +5.3. With Soto it's +80.1; with Canseco, +86.0.

The numbers are from after L.J.'s 09-27 data push refreshed the tournament model's calibration; each is within 0.3 runs of the first run.

## The parks

| Park | AvgL | AvgR | HR L | HR R | Now | With Soto | With Canseco |
|---|---|---|---|---|---|---|---|
| **1945 Fenway Park** | 0.997 | 1.045 | 0.808 | 1.385 | **+5.7** | +0.8 | **+13.3** |
| 1911 Bennett Park | 0.977 | 1.037 | 1.011 | 1.394 | +4.3 | +1.2 | +10.0 |
| 2026 Rio Grande Credit Union Field | 1.080 | 1.140 | 1.170 | 1.390 | +3.8 | +2.5 | +7.9 |
| 1921 Baker Bowl | 1.016 | 1.074 | 1.293 | 1.480 | +3.5 | +2.5 | +7.4 |
| 2026 Las Vegas Ballpark | 1.060 | 1.110 | 1.390 | 1.440 | +2.7 | +3.0 | +4.9 |
| 1905 Polo Grounds | 1.138 | 0.983 | 1.500 | 1.456 | +2.1 | **+3.5** | +0.8 |
| 2026 Truist Field (Charlotte) | 1.050 | 1.070 | 1.500 | 1.460 | +2.0 | +3.2 | +2.9 |
| *His five:* 1992 SkyDome | 1.017 | 1.000 | 0.898 | 1.139 | +2.3 | +0.3 | +5.0 |
| 2005 Minute Maid Park | 0.976 | 1.006 | 0.932 | 1.120 | +1.7 | +0.1 | +4.3 |
| 1968 Connie Mack Stadium | 1.004 | 0.998 | 0.906 | 1.093 | +1.7 | +0.1 | +3.8 |
| 2026 Huntington Park | 0.950 | 0.990 | 0.960 | 1.100 | +1.1 | −0.1 | +3.3 |
| 2026 Tropicana Field | 0.999 | 1.065 | 0.997 | 1.082 | +1.1 | +0.4 | +3.0 |

- **Fenway pays because it is lopsided:** right-handed home runs ×1.385, left-handed ×0.808. His power is right-handed (Aaron, Banks, Rolen, Gibson, Piazza).
- **The more extreme power parks lift the field too.** Baker Bowl, Rio Grande, Las Vegas, Truist and the 1905 Polo Grounds all lift both sides' home runs. They also raise scoring, and the more runs are scored, the more runs a win costs (about 1.5 × R/G + 3). So his +60-run edge buys fewer wins in them. The table does not charge for that, so these parks are a little worse than they look.
- **Soto turns it around:** his Power 200 is left-handed, and Fenway cuts left-handed homers. With him, Fenway falls to +0.8, and the best parks are the all-round power parks, at +3.5 or less before the scoring cost. That is why Fenway is still the pick while the Soto order is open: little is lost if he lands, and the full gain is kept if he doesn't.
- **His five:** SkyDome 1992 is the best of them in every case, at under half of Fenway without Soto.

## Soto or Canseco (league model)

`pnpm league:compare --league HD --year 2010` against his 13 bats:

| Candidate | vs RHP | vs LHP | Season | Where he plays |
|---|---|---|---|---|
| Juan Soto 102 (HH, 2024, L) | +9.1 | +12.4 | **+10.6 runs, +1.1 W** | DH both boards |
| Jose Canseco 100 (LE, 1988, R) | +4.2 | +10.8 | +7.2 runs, +0.7 W | DH both boards |

- **Soto is the better card in league.** League pays extra for Eye and Avoid K, and Soto's Eye is 236–244.
- **Defense is close on the cards:** RF 91 for Soto against 88 for Canseco. Both land at DH; Beltran stays in RF.
- **With the park, they come out about level.** Canseco plus Fenway (+7.2 plus about 60% of +13.3) is roughly equal to Soto plus any park, within half a win.
- **Market** (shop list 09-27):
  - Soto: no sellers, and the top buy order is 275,000, above L.J.'s 265,000.
  - Canseco: on sale from 259,999; his last 10 sales averaged 211,388.

## Caveats

- **Next week's league is unknown.** He is relegated to HD, but which HD league isn't known, so the field is all four HD leagues' 09-27 rosters.
- **Theme week:** if next week is announced as one, rerun with `--year <year>`.
- **Park availability:** check that 1945 Fenway is on his list in the game. If it isn't, SkyDome 1992 is the best of the five he showed.
