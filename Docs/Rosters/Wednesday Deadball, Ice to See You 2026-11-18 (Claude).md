# Wednesday Night of the Living Deadball (551), Wednesday Ice to See You (542), 2026-11-18

Built with `current-rosters --only 551,542 --all --sold 87537 --bought 87526,87515 --tag 2026-11-18-wed`, seeded from the saved picks. Manifest `Inbox/rosters/current-2026-11-18-wed.tsv`. **Nothing saved.**

- **Deadball:** 440.1 against saved 2123's 439.7 (+0.4, noise). One card: Jack Burdock 87 (#86067) in at 2B for Fred Pfeffer 92 (#87363). Both project about the same at 2B (vR +8.6, vL +10.6 vs +11.0). Burdock has 3,063 own-series PA; Pfeffer's +32.2 observed is from 389 PA.
- **Ice to See You:** 623.0, the same 26 cards as saved 2231 (it scored 623.4 at save; observed data moved it). Nothing to change.
- **Why Deadball's top-team lefties sit:** 1919 Fenway swings 1.73 R/G toward right-handed bats. env-roster --show, vR/vL per 700 PA: Lajoie 99 −2.4/+8.9, Eddie Collins 98 +0.3/−12.3, Sheckard 100 +5.7/0.0, Shoeless Joe 88 +10.2/−1.1. Own-series observed agrees: Collins −3.9 (7,208 PA), Sheckard +1.9 (6,700), Jackson +5.2 (7,047), Lajoie −0.6 (6,581).

## Roster checks

```
--- roster check ---
  ✓ staff 4 SP / 5 RP / 17 bats (caps: 5 SP, 7 RP, 12 arms) · field's best quarter (230 teams): 4.5 SP / 4.1 RP / 16.3 bats
  ✓ starters' stamina Cy Young 114, Mordecai Brown 104, Christy Mathewson 111, Eddie Plank 104 (era floor 70)
  ✓ stamina guys in the pen (45+): Ed Reulbach 92, Noodles Hahn 102, Hugh Daily 100, Jeff Pfeffer 102, Jack Coombs 106
  ✓ C  backup: Hank Gowdy 80
  ✓ 1B backup: vs RHP Roger Connor 94, Chicken Wolf 62 · vs LHP George Sisler 69, Chicken Wolf 62
  ✓ 2B backup: Harry Steinfeldt 106
  ✓ 3B backup: Harry Steinfeldt 105, Joe Dugan 63
  ✓ SS backup: Jack Glasscock 102
  ✓ LF backup: Jesse Burkett 84, Chicken Wolf 89, Chick Stahl 129
  ✓ CF backup: Chick Stahl 111
  ✓ RF backup: Chicken Wolf 83, Mike Tiernan 79, Chick Stahl 126
(22 of 26 have a live ask in the last shop snapshot)
objective: 440.1 weighted runs (bats 81/19 R/L, SP 3.135, RP 0.54, bench 0.1)

--- roster check ---
  ✓ staff 5 SP / 7 RP / 14 bats (caps: 5 SP, 7 RP, 12 arms) · field's best quarter (422 teams): 5.1 SP / 7.5 RP / 14.0 bats
  ✓ starters' stamina Ryan Sloan 69, Babe Ruth 104, Noodles Hahn 102, Larry Jackson 92, Don Larsen 100 (era floor 50)
  ✓ stamina guys in the pen (45+): Liam Doyle 69, Joel Pineiro 62
  ✓ C  backup: vs RHP Lance Parrish 109 · vs LHP Ed Bailey 112
  ✓ 1B backup: vs RHP Josh Vitters 99, Ethan Holliday 113 · vs LHP Mark Teixeira 100, Ethan Holliday 113
  ✓ 2B backup: Ethan Holliday 104
  ✓ 3B backup: vs RHP Josh Vitters 86, Ethan Holliday 102 · vs LHP Ethan Holliday 102
  ✓ SS backup: Ethan Holliday 93
  ✓ LF backup: vs RHP Josh Vitters 72, Al Simmons 90, Ethan Holliday 66 · vs LHP Curtis Granderson 147, Mike Greenwell 125, Ethan Holliday 66
  ✓ CF backup: vs RHP Willie Mays 107 · vs LHP Curtis Granderson 133, Willie Mays 107
  ✓ RF backup: vs RHP Seiya Suzuki 129 · vs LHP Curtis Granderson 142, Mike Greenwell 117
(21 of 26 have a live ask in the last shop snapshot)
objective: 623.0 weighted runs (bats 55/45 R/L, SP 1.83, RP 0.86, bench 0.1)
```

## Wednesday Night of the Living Deadball

1920 environment · 1919 Fenway Park · roster deadballweekly-claude-2026-11-18-wed.txt

| Val | Card | Hand | Roles | Projected | Observed (this series) |
|---|---|---|---|---|---|
| 103 | Mordecai Brown | R | SP2 | +15.7 runs, opp .243/.280/.325 | 1468 IP, FIP 3.51, 3.7 WAR/200 |
| 103 | Ed Delahanty | R | LF | vR +41.1 (glove +9.8) · vL +42.8 (glove +9.8) | vR .326/.387/.474 · vL .329/.385/.463 | 1691 PA, wOBA .363, 4.6 WAR/600 |
| 103 | Christy Mathewson | R | SP3 | +15.1 runs, opp .240/.281/.323 | 1207 IP, FIP 3.62, 3.5 WAR/200 |
| 102 | Eddie Plank | L | SP4 | +12.9 runs, opp .252/.293/.335 | 4746 IP, FIP 3.63, 3.4 WAR/200 |
| 102 | Cy Young (VAR) | R | SP1 | +17.6 runs, opp .247/.286/.331 | 883 IP, FIP 3.53, 3.7 WAR/200 |
| 101 | Roger Connor | S | 1B vs LHP; bench vs the other hand | vL +34.4 (glove +5.3) | vR .248/.325/.336 · vL .326/.397/.422 | 14676 PA, wOBA .312, 2.3 WAR/600 |
| 100 | Jack Coombs | R | RP4 | +8.9 runs, opp .252/.311/.336 | 5596 IP, FIP 3.85, 2.9 WAR/200 |
| 100 | King Kelly | R | RF | vR +27.6 (glove +3.4) · vL +31.8 (glove +3.4) | vR .312/.362/.418 · vL .315/.367/.420 | 18684 PA, wOBA .331, 4.5 WAR/600 |
| 100 | Harry Steinfeldt | R | bench | +11.0 | vR .305/.348/.399 · vL .308/.361/.393 | 12471 PA, wOBA .303, 3.1 WAR/600 |
| 100 | Ed Williamson | R | 3B | vR +17.2 (glove +10.2) · vL +22.7 (glove +10.2) | vR .289/.369/.418 · vL .294/.377/.430 | 1549 PA, wOBA .322, 3.8 WAR/600 |
| 99 | Jesse Burkett | L | bench | +18.8 | vR .252/.315/.351 · vL .240/.292/.325 | 365 PA, wOBA .331, 2.6 WAR/600 |
| 99 | Honus Wagner | R | SS | vR +25.7 (glove +3.4) · vL +22.3 (glove +3.4) | vR .310/.360/.412 · vL .304/.349/.411 | 24030 PA, wOBA .323, 4.5 WAR/600 |
| 97 | Ed Reulbach | R | CL | +9.5 runs, opp .247/.300/.331 | 538 IP, FIP 3.75, 2.8 WAR/200 |
| 95 | Chicken Wolf | R | bench | +16.0 | vR .316/.357/.418 · vL .317/.359/.420 | 755 PA, wOBA .308, 1.7 WAR/600 |
| 93 | Hugh Daily | R | RP2 | +9.3 runs, opp .270/.322/.357 | 3193 IP, FIP 3.79, 3.1 WAR/200 |
| 93 | Noodles Hahn | L | RP1 | +10.0 runs, opp .259/.304/.344 | 324 IP, FIP 3.71, 2.5 WAR/200 |
| 93 | Chick Stahl | L | bench | +7.3 | vR .232/.307/.332 · vL .239/.298/.321 | 15377 PA, wOBA .297, 1.9 WAR/600 |
| 91 | George Sisler | L | 1B vs RHP | vR +21.1 (glove -2.4) | vR .254/.314/.358 · vL .231/.270/.287 | 395 PA, wOBA .306, 1.7 WAR/600 |
| 87 | Jack Burdock | R | 2B | vR +8.6 (glove +6.7) · vL +10.6 (glove +6.7) | vR .301/.343/.400 · vL .306/.344/.403 | 3751 PA, wOBA .295, 4.0 WAR/600 |
| 87 | Mike Tiernan | L | bench | +12.9 | vR .239/.313/.327 · vL .232/.301/.308 | 312 PA, wOBA .381, 4.8 WAR/600 |
| 86 | Jack Meyers | R | C | vR +10.4 (glove +1.2) · vL +19.6 (glove +1.2) | vR .305/.365/.364 · vL .309/.362/.410 | 510 PA, wOBA .329, 4.1 WAR/600 |
| 79 | Hank Gowdy | R | bench | +13.2 | vR .291/.367/.385 · vL .287/.366/.368 | 1063 PA, wOBA .318, 3.4 WAR/600 |
| 78 | Tillie Walker | R | CF | vR +12.4 (glove -3.8) · vL +22.4 (glove -3.8) | vR .290/.342/.386 · vL .292/.372/.388 | 1323 PA, wOBA .329, 3.4 WAR/600 |
| 76 | Jack Glasscock | R | bench | +10.0 | vR .310/.352/.385 · vL .314/.358/.395 | 391 PA, wOBA .309, 5.1 WAR/600 |
| 74 | Jeff Pfeffer | R | RP3 | +9.0 runs, opp .252/.303/.343 | 42 IP, FIP 3.71, 1.9 WAR/200 |
| 65 | Joe Dugan (VAR) | R | bench | +15.5 | vR .304/.333/.422 · vL .310/.369/.427 | 323 PA, wOBA .309, 1.7 WAR/600 |

Total value 2406. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** Jack Meyers C · Ed Williamson 3B · Honus Wagner SS · Ed Delahanty LF · King Kelly RF · Jack Burdock 2B · Tillie Walker CF · George Sisler 1B · Pitcher

**vs LHP:** Tillie Walker CF · Ed Williamson 3B · Roger Connor 1B · Ed Delahanty LF · King Kelly RF · Jack Meyers C · Honus Wagner SS · Jack Burdock 2B · Pitcher

**Cards the top quarter of teams play that we don't** (11 exports, 289 top teams):

- Tris Speaker 100: on 91% of top teams (70% as variants) — not owned
- Charlie Sweeney 100: on 86% of top teams — not owned
- Nap Lajoie 99: on 76% of top teams (16% as variants) — owned
- Old Hoss Radbourn 89: on 63% of top teams (26% as variants) — owned
- Eddie Collins 98: on 61% of top teams (4% as variants) — owned
- Ty Cobb 100: on 60% of top teams — not owned
- Shoeless Joe Jackson 88: on 54% of top teams (25% as variants) — owned
- Walt Wilmot 94: on 54% of top teams (15% as variants) — owned
- Jimmy Ryan 99: on 51% of top teams — not owned
- Jose Mendez 95: on 51% of top teams (16% as variants) — owned
- Ezra Sutton 91: on 51% of top teams (18% as variants) — owned
- Jimmy Sheckard 100: on 49% of top teams (3% as variants) — owned

## Wednesday Ice to See You

PT default environment · 1977 Wrigley Field · roster diamondweekly-claude-2026-11-18-wed.txt

| Val | Card | Hand | Roles | Projected | Observed (this series) |
|---|---|---|---|---|---|
| 99 | Carlos Beltran | S | CF | vR +40.4 (glove -0.8) · vL +28.3 (glove -0.8) | vR .325/.425/.781 · vL .313/.394/.668 | 13551 PA, wOBA .361, 3.3 WAR/600 |
| 99 | Tony Fossas (VAR) | L | RP3 | +12.7 runs, opp .248/.304/.411 | 207 IP, FIP 4.21, 2.3 WAR/200 |
| 99 | Mike Greenwell | L | LF vs RHP | vR +34.3 (glove +4.7) | vR .314/.419/.598 · vL .281/.317/.445 | 7449 PA, wOBA .357, 2.7 WAR/600 |
| 99 | Jake McGee (VAR) | L | RP1 | +15.8 runs, opp .231/.295/.391 | 132 IP, FIP 3.57, 3.6 WAR/200 |
| 99 | J.J. Putz | R | RP6 | +11.4 runs, opp .224/.278/.397 | — |
| 99 | Al Simmons | R | LF vs LHP; bench vs the other hand | vL +36.0 (glove -0.9) | vR .303/.348/.575 · vL .334/.394/.661 | 25796 PA, wOBA .349, 1.8 WAR/600 |
| 99 | Honus Wagner | R | SS | vR +17.3 (glove +2.3) · vL +18.6 (glove +2.3) | vR .299/.359/.511 · vL .305/.359/.554 | 22307 PA, wOBA .325, 2.4 WAR/600 |
| 98 | Joe Gordon | R | 2B | vR +16.9 (glove +7.4) · vL +40.1 (glove +7.4) | vR .287/.372/.675 · vL .340/.430/.840 | 1362 PA, wOBA .342, 3.4 WAR/600 |
| 98 | Willie Mays | R | DH | vR +23.1 · vL +40.6 | vR .288/.367/.593 · vL .308/.406/.708 | 30774 PA, wOBA .344, 2.6 WAR/600 |
| 98 | Ryan Sloan | R | SP1 | +20.7 runs, opp .241/.292/.404 | 4700 IP, FIP 4.05, 4.3 WAR/200 |
| 98 | Duane Ward (VAR) | R | RP2 | +13.1 runs, opp .235/.301/.396 | 168 IP, FIP 3.87, 3.5 WAR/200 |
| 97 | Ed Bailey (VAR) | L | C vs RHP | vR +33.6 (glove +10.8) | vR .321/.410/.757 · vL .188/.276/.299 | 2190 PA, wOBA .333, 2.3 WAR/600 |
| 97 | Curtis Granderson | L | RF vs RHP | vR +55.6 (glove +7.7) | vR .327/.407/.681 · vL .220/.297/.369 | 5597 PA, wOBA .374, 4.5 WAR/600 |
| 97 | Adrian Morejon | L | CL | +16.7 runs, opp .237/.305/.384 | 207 IP, FIP 3.60, 4.1 WAR/200 |
| 97 | Babe Ruth | L | SP2 | +20.1 runs, opp .234/.319/.385 | 2994 IP, FIP 4.39, 3.4 WAR/200 |
| 96 | Don Larsen | R | SP5 | +17.6 runs, opp .237/.296/.403 | 1341 IP, FIP 4.58, 3.1 WAR/200 |
| 95 | Ethan Holliday (VAR) | L | bench | +16.8 | vR .257/.361/.526 · vL .225/.328/.419 | 1319 PA, wOBA .321, 0.6 WAR/600 |
| 95 | Seiya Suzuki | R | RF vs LHP; bench vs the other hand | vL +28.9 (glove +5.4) | vR .269/.363/.515 · vL .306/.411/.644 | 2198 PA, wOBA .327, 1.7 WAR/600 |
| 95 | Josh Vitters (VAR) | R | 1B vs LHP; bench vs the other hand | vL +33.5 (glove +4.5) | vR .284/.336/.516 · vL .310/.372/.602 | 854 PA, wOBA .370, 2.9 WAR/600 |
| 94 | Arjun Nimmala (VAR) | R | 3B | vR +18.4 (glove +9.6) · vL +23.0 (glove +9.6) | vR .274/.351/.567 · vL .281/.361/.589 | 2121 PA, wOBA .329, 2.6 WAR/600 |
| 94 | Lance Parrish | R | C vs LHP; bench vs the other hand | vL +22.5 (glove +8.4) | vR .255/.344/.574 · vL .298/.377/.660 | 6813 PA, wOBA .331, 2.3 WAR/600 |
| 94 | Mark Teixeira | S | 1B vs RHP | vR +32.3 (glove +4.7) | vR .304/.387/.719 · vL .254/.335/.448 | 1480 PA, wOBA .362, 2.4 WAR/600 |
| 93 | Liam Doyle | L | RP4 | +18.2 runs, opp .229/.307/.391 | 552 IP, FIP 4.17, 3.4 WAR/200 |
| 93 | Noodles Hahn | L | SP3 | +19.8 runs, opp .244/.300/.410 | 317 IP, FIP 4.24, 3.9 WAR/200 |
| 92 | Larry Jackson | R | SP4 | +19.7 runs, opp .261/.313/.417 | 1275 IP, FIP 4.18, 3.6 WAR/200 |
| 91 | Joel Pineiro (VAR) | R | RP5 | +17.0 runs, opp .235/.296/.394 | — |

Total value 2505. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** Mike Greenwell LF · Carlos Beltran CF · Ed Bailey (VAR) C · Mark Teixeira 1B · Curtis Granderson RF · Joe Gordon 2B · Willie Mays DH · Arjun Nimmala (VAR) 3B · Honus Wagner SS

**vs LHP:** Seiya Suzuki RF · Joe Gordon 2B · Carlos Beltran CF · Willie Mays DH · Al Simmons LF · Lance Parrish C · Arjun Nimmala (VAR) 3B · Josh Vitters (VAR) 1B · Honus Wagner SS

**Cards the top quarter of teams play that we don't** (12 exports, 491 top teams):

- Thomas White 97: on 43% of top teams (9% as variants) — owned
- Aidan Miller 98: on 41% of top teams (23% as variants) — owned
- Devin Williams 99: on 38% of top teams — owned
- Andruw Jones 99: on 36% of top teams (15% as variants) — owned
- Payton Tolle 99: on 35% of top teams (14% as variants) — owned
- Mike Schmidt 99: on 35% of top teams (13% as variants) — not owned
- Joe Sambito 98: on 33% of top teams (18% as variants) — owned
- Paul Goldschmidt 99: on 33% of top teams (24% as variants) — owned
- Jose Reyes 98: on 33% of top teams (10% as variants) — owned
- Jonny Venters 98: on 30% of top teams (12% as variants) — owned
- Carlos Delgado 98: on 29% of top teams (16% as variants) — owned
- Andrew Miller 99: on 28% of top teams (9% as variants) — owned
