# Dregs, Daily Dank, Tuesday Dead Silver Walking (Claude, 2026-10-27)

Collection 311. Dregs saved as roster 1266, "Claude pick 2026-10-27 fixed" (replaces 1265). Dank (1250) and Dead Silver (1244) rebuilt on the fixed search and came out with the same 26; no new save.

## What was wrong with the optimiser (L.J.: "Sam Huff at C v R and all rightie bats makes no sense")

1. **Search bug, cap events (fixed, `roster-optimize.ts`).** With the cap full, the climb could pay for an upgrade only by dropping another slot to one of its 12 *cheapest* cards, almost all 50s. A 64-to-60 trade was never tried. Pena for Huff (+11 value, worth about +13 runs) could not be paid for, so Huff caught. Downgrades now also include the best card or two at every value level. Regression test added; it fails on the old code. Dregs on the same weights: −52.7 → −51.5, Pena catching both boards.
2. **Pen weight in cap and slots events (fixed, `calibration.ts` `CAPPED_PEN_WEIGHT`).** The by-era team weights (10-25) count a pen run 2.5× a bat run in 1994–2009 (3.0 in 1977–93). Refit on cap events alone (57 exports, 4,509 teams) and slots alone (205 exports, 12,494 teams), held-out r with win% is flat from 1.5 to 3 (cap .410 / .412 / .413 / .412), so the wins can't choose. The rosters differ a lot, though. Each Dregs roster scored under each weight (runs short of the best roster at that weight):

| Built at | scored at 2.5 | at 1.85 | at 1.3 | worst |
|---|---|---|---|---|
| 2.5 (old) | 0 | −5.1 | −10.1 | −10.1 |
| 1.85 | −2.7 | 0 | 0 | −2.7 |
| 1.3 | −3.9 | −0.8 | −0.4 | −3.9 |

   The 1.85 pen averages 53.7 a card, what the top quarter of Dregs teams spend (53.6); at 2.5 we spent 57.3. Cap and slots events now use min(era weight, 1.85) in env-roster, /build and Card Fit (`rationedEvent`).
3. **All-righty lineup vs RHP: a model result, not a bug.** Lefties are better vs RHP (Florentino +1.2 vs Lajoie −12.6 at 1B), but in Dodger Stadium 96 (LHB HR ×.850) at 10–13 more value, forcing one in costs runs even at 1.85: Florentino (VAR) −4.5, Edmonds −8.5. The field agrees: top-quarter teams 35% L/S PA, bottom quarter 41%.
4. **Mislabelled log line fixed:** "friendly park side in N of 9" counted lefties, not the park's friendly side.
5. **New `env-roster --score <load file>`:** scores any roster on the optimiser's objective, slot by slot, with no search. Use it to check a hand-built roster against the optimiser's pick.
6. **Hand change:** Sam Huff (C 62, ability 58, framing 61) out as backup catcher; Doug Mirabelli (C 78) in. Costs 0.4 runs.

Checked and kept:
- Dead Silver: Tobin in RF vs RHP over Keeler scores +0.2 (RF 73 under the 75 floor), so not worth it. Dugan at 3B, the position solver's pick.
- Dank: Rosar (C 96) scores −49 vs RHP on the bat. Only one Dank export is on file, so there's no observed case against the model.

## Monday Now We're into the Dregs

1994 environment · 1996 Dodger Stadium · roster dregs-claude-2026-10-27-final.txt

| Val | Card | Hand | Roles | Projected | Observed (this series) |
|---|---|---|---|---|---|
| 64 | Brandon Phillips | R | 2B | vR -6.3 (glove +4.0) · vL +20.5 (glove +4.0) | vR .254/.289/.386 · vL .290/.335/.506 | 1371 PA, wOBA .360, 4.9 WAR/600 |
| 64 | Bruce Hurst | L | SP3 | +0.5 runs, opp .254/.315/.404 | 5043 IP, FIP 4.02, 3.7 WAR/200 |
| 64 | Byron Buxton (VAR) | R | CF | vR -6.6 (glove +1.9) · vL +6.7 (glove +1.9) | vR .233/.287/.360 · vL .254/.312/.406 | 1445 PA, wOBA .295, 1.9 WAR/600 |
| 64 | Fritz Ostermueller | L | SP1 | +6.3 runs, opp .255/.331/.378 | 4461 IP, FIP 3.62, 4.6 WAR/200 |
| 62 | Jett Williams | R | RF vs RHP; LF vs LHP | vR -4.5 (glove -0.1) · vL +5.3 (glove +0.9) | vR .226/.329/.340 · vL .243/.348/.387 | 9183 PA, wOBA .321, 2.5 WAR/600 |
| 62 | Khalil Greene | R | SS | vR -5.6 (glove +0.3) · vL -2.7 (glove +0.3) | vR .233/.271/.420 · vL .247/.322/.400 | 402 PA, wOBA .296, 1.3 WAR/600 |
| 62 | Tony Pena Sr. | R | C | vR -22.2 (glove +5.2) · vL -9.5 (glove +5.2) | vR .231/.287/.315 · vL .255/.290/.391 | 503 PA, wOBA .275, 0.6 WAR/600 |
| 60 | Chuck Finley (VAR) | L | SP4 | -2.3 runs, opp .257/.358/.388 | 101 IP, FIP 3.75, 4.3 WAR/200 |
| 59 | Bill Hall | R | 3B | vR -5.8 (glove -3.2) · vL +7.8 (glove -3.2) | vR .226/.290/.362 · vL .237/.340/.388 | 821 PA, wOBA .320, 2.3 WAR/600 |
| 59 | John Bale | L | CL | +0.4 runs, opp .256/.340/.371 | 45 IP, FIP 4.46, 1.3 WAR/200 |
| 58 | Jackie Robinson (VAR) | R | 1B vs LHP; bench vs the other hand | vL +3.3 (glove +0.5) | vR .242/.300/.326 · vL .257/.331/.403 | 1439 PA, wOBA .358, 3.0 WAR/600 |
| 58 | Jonny Gomes | R | DH vs RHP; RF vs LHP | vR -0.9 · vL -2.6 (glove -2.6) | vR .222/.306/.368 · vL .222/.314/.341 | — |
| 58 | Justin Verlander | R | SP5 | -2.9 runs, opp .262/.328/.405 | 1672 IP, FIP 3.83, 4.2 WAR/200 |
| 57 | Mike Marshall | R | RP1 | -0.3 runs, opp .259/.350/.384 | 766 IP, FIP 4.27, 1.8 WAR/200 |
| 55 | James McDonald (VAR) | R | SP2 | +3.9 runs, opp .253/.334/.370 | 1680 IP, FIP 3.56, 4.8 WAR/200 |
| 53 | Jeff Francis | L | RP2 | -5.8 runs, opp .270/.331/.424 | 73 IP, FIP 4.97, -0.3 WAR/200 |
| 53 | Jim Thorpe | R | DH vs LHP; bench vs the other hand | vL -0.7 | vR .223/.262/.339 · vL .240/.292/.408 | 499 PA, wOBA .333, 1.8 WAR/600 |
| 52 | Don Schwall | R | RP4 | -13.0 runs, opp .268/.392/.400 | 111 IP, FIP 5.06, 1.1 WAR/200 |
| 51 | Derek Dietrich (VAR) | L | bench | -11.0 | vR .197/.291/.333 · vL .179/.223/.207 | 92 PA, wOBA .364, 2.0 WAR/600 |
| 51 | John Maine | R | RP5 | -13.1 runs, opp .264/.343/.429 | 298 IP, FIP 4.76, 0.7 WAR/200 |
| 51 | Mike Trout (VAR) | R | LF vs RHP | vR -5.4 (glove +0.0) | vR .207/.286/.362 · vL .164/.261/.191 | 154 PA, wOBA .229, -1.9 WAR/600 |
| 50 | Connie Day | R | bench | -23.3 | vR .237/.300/.321 · vL .239/.304/.327 | 3181 PA, wOBA .271, 0.9 WAR/600 |
| 50 | Dave Henderson | R | bench | -13.7 | vR .227/.296/.329 · vL .248/.316/.369 | 1596 PA, wOBA .295, 1.5 WAR/600 |
| 50 | Don August (VAR) | R | RP3 | -11.0 runs, opp .271/.343/.430 | 301 IP, FIP 5.00, -0.9 WAR/200 |
| 50 | Doug Mirabelli | R | bench | -20.6 | vR .209/.295/.289 · vL .218/.285/.332 | 1117 PA, wOBA .278, 0.5 WAR/600 |
| 50 | Nap Lajoie | R | 1B vs RHP | vR -12.6 (glove +2.9) | vR .277/.308/.377 · vL .242/.288/.348 | 4127 PA, wOBA .294, 0.7 WAR/600 |

Total value 1467. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** Jett Williams RF · Jonny Gomes DH · Khalil Greene SS · Byron Buxton (VAR) CF · Nap Lajoie 1B · Brandon Phillips 2B · Mike Trout (VAR) LF · Bill Hall 3B · Tony Pena Sr. C

**vs LHP:** Bill Hall 3B · Jett Williams LF · Jackie Robinson (VAR) 1B · Brandon Phillips 2B · Byron Buxton (VAR) CF · Khalil Greene SS · Jim Thorpe DH · Tony Pena Sr. C · Jonny Gomes RF

**Cards the top quarter of teams play that we don't** (4 exports, 83 top teams):

- Santiago Espinal 55: on 55% of top teams — not owned
- Ozzie Smith 59: on 53% of top teams (20% as variants) — owned
- Mark Huismann 50: on 41% of top teams (59% as variants) — owned
- Alex Reyes 53: on 41% of top teams — owned
- Jim Tabor 54: on 41% of top teams (85% as variants) — owned
- Ken Berry 55: on 40% of top teams — owned
- Jack Cust 63: on 39% of top teams — owned
- Pedro Martinez 51: on 36% of top teams — owned
- Yadier Molina 62: on 35% of top teams (28% as variants) — owned
- Aaron Crow 51: on 31% of top teams — not owned
- Willie Randolph 60: on 31% of top teams (27% as variants) — owned
- Carlos Beltran 58: on 31% of top teams (77% as variants) — owned

## Daily Dank

1945 environment · 1945 Comiskey Park · roster dankdaily-claude-2026-10-27-fix.txt

| Val | Card | Hand | Roles | Projected | Observed (this series) |
|---|---|---|---|---|---|
| 49 | Brooks Robinson | R | 3B | vR -44.7 (glove +18.0) · vL -27.8 (glove +18.0) | vR .221/.270/.279 · vL .218/.266/.291 | 587 PA, wOBA .248, 2.8 WAR/600 |
| 49 | Dwayne Hosey | S | LF | vR -11.7 (glove -1.2) · vL -14.0 (glove -1.2) | vR .276/.339/.370 · vL .240/.309/.344 | 1516 PA, wOBA .314, 3.4 WAR/600 |
| 49 | Javier Baez (VAR) | R | 2B | vR -5.8 (glove -5.2) · vL -13.5 (glove -5.2) | vR .241/.280/.329 · vL .231/.315/.323 | 481 PA, wOBA .275, 2.9 WAR/600 |
| 49 | John Danks | L | RP3 | -7.9 runs, opp .275/.354/.376 | 188 IP, FIP 4.61, 2.1 WAR/200 |
| 49 | Marco Estrada | R | SP2 | -3.9 runs, opp .255/.329/.364 | 808 IP, FIP 3.95, 3.7 WAR/200 |
| 49 | Sam Bankhead | R | SS | vR -29.4 (glove +7.0) · vL -26.0 (glove +7.0) | vR .228/.293/.281 · vL .229/.297/.283 | 1321 PA, wOBA .268, 3.3 WAR/600 |
| 48 | Austin Jackson | R | bench | -20.9 | vR .249/.293/.322 · vL .239/.289/.310 | 803 PA, wOBA .254, 2.0 WAR/600 |
| 48 | Billy Bryan (VAR) | L | bench | -12.1 | vR .269/.327/.348 · vL .273/.300/.350 | — |
| 48 | George Sisler (VAR) | L | bench | +0.0 | vR .311/.361/.371 · vL .281/.322/.333 | 134 PA, wOBA .315, 2.7 WAR/600 |
| 48 | Lefty Grove | L | SP1 | -0.7 runs, opp .262/.320/.371 | 784 IP, FIP 3.84, 3.9 WAR/200 |
| 48 | Mark Langston | L | RP1 | -6.9 runs, opp .271/.362/.377 | 96 IP, FIP 4.53, 2.3 WAR/200 |
| 48 | Nico Hoerner | R | bench | -35.2 | vR .249/.288/.306 · vL .233/.311/.271 | 816 PA, wOBA .286, 4.0 WAR/600 |
| 48 | Thomas Pannone | L | SP3 | -4.7 runs, opp .266/.320/.379 | 668 IP, FIP 4.24, 2.8 WAR/200 |
| 48 | Vladimir Guerrero | R | RF vs RHP; CF vs LHP | vR -17.6 (glove +4.8) · vL -13.5 (glove -4.3) | vR .236/.283/.330 · vL .233/.285/.322 | 1555 PA, wOBA .268, 2.2 WAR/600 |
| 47 | Al Holland (VAR) | L | RP2 | -6.9 runs, opp .261/.330/.384 | 39 IP, FIP 5.65, -3.1 WAR/200 |
| 46 | Jim Hegan (VAR) | R | C vs LHP; bench vs the other hand | vL -34.7 (glove +0.8) | vR .199/.261/.259 · vL .202/.255/.280 | — |
| 46 | Stan Hack | L | 1B vs RHP | vR -11.1 (glove +0.1) | vR .289/.368/.350 · vL .277/.367/.293 | 433 PA, wOBA .289, 1.8 WAR/600 |
| 45 | Nate Robertson | L | CL | -5.6 runs, opp .267/.337/.379 | 127 IP, FIP 4.07, 3.3 WAR/200 |
| 45 | Tin Can Kincannon | R | SP5 | -5.9 runs, opp .278/.351/.375 | 115 IP, FIP 3.77, 4.2 WAR/200 |
| 45 | Todd Helton | L | 1B vs LHP; bench vs the other hand | vL -22.6 (glove +2.1) | vR .266/.355/.325 · vL .279/.352/.333 | 151 PA, wOBA .299, 2.0 WAR/600 |
| 44 | Alfredo Amezaga | S | CF vs RHP | vR -19.6 (glove -4.1) | vR .281/.346/.341 · vL .216/.221/.295 | 215 PA, wOBA .343, 5.3 WAR/600 |
| 44 | Joe Saunders | L | SP4 | -4.8 runs, opp .275/.330/.383 | 426 IP, FIP 3.90, 3.9 WAR/200 |
| 44 | Tsung-Che Cheng (VAR) | L | bench | -11.0 | vR .277/.365/.321 · vL .267/.346/.303 | 69 PA, wOBA .353, 5.2 WAR/600 |
| 43 | Sammy Sosa (VAR) | R | RF vs LHP; bench vs the other hand | vL -3.4 (glove +2.8) | vR .215/.246/.288 · vL .230/.285/.337 | 357 PA, wOBA .306, 3.0 WAR/600 |
| 42 | Buck Rodgers (VAR) | S | C vs RHP | vR -27.7 (glove -5.9) | vR .260/.311/.348 · vL .203/.250/.273 | — |
| 40 | R.T. Walker | R | RP4 | -8.3 runs, opp .274/.354/.367 | — |

Total value 1209. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** Stan Hack 1B · Sam Bankhead SS · Alfredo Amezaga CF · Dwayne Hosey LF · Buck Rodgers (VAR) C · Vladimir Guerrero RF · Javier Baez (VAR) 2B · Brooks Robinson 3B · Pitcher

**vs LHP:** Sam Bankhead SS · Javier Baez (VAR) 2B · Sammy Sosa (VAR) RF · Todd Helton 1B · Dwayne Hosey LF · Vladimir Guerrero CF · Brooks Robinson 3B · Jim Hegan (VAR) C · Pitcher

**Cards the top quarter of teams play that we don't** (1 exports, 12 top teams):

- Ace Adams 46: on 58% of top teams — owned
- Buddy Rosar 49: on 58% of top teams (29% as variants) — owned
- Kid Elberfeld 47: on 50% of top teams (50% as variants) — owned
- Randy Choate 45: on 42% of top teams — owned
- Reed Garrett 49: on 42% of top teams (60% as variants) — owned
- Yasmani Grandal 49: on 42% of top teams — not owned
- Jonathan Lucroy 48: on 42% of top teams — owned
- Maurice Archdeacon 45: on 42% of top teams (80% as variants) — owned
- Lou Kretlow 48: on 33% of top teams (100% as variants) — owned
- Todd Jones 43: on 33% of top teams (50% as variants) — owned
- Hal Smith 48: on 33% of top teams (75% as variants) — owned
- Wally Backman 47: on 33% of top teams (25% as variants) — owned

## Tuesday Dead Silver Walking

1919 environment · 1911 Washington Park · roster upto1969weekly-claude-2026-10-27-fix.txt

| Val | Card | Hand | Roles | Projected | Observed (this series) |
|---|---|---|---|---|---|
| 79 | Emmet Heidrick | L | bench | -7.9 | vR .273/.299/.359 · vL .253/.271/.306 | 7070 PA, wOBA .304, 2.4 WAR/600 |
| 79 | Hank Gowdy | R | C | vR +0.8 (glove -4.0) · vL -2.7 (glove -4.0) | vR .257/.336/.345 · vL .254/.337/.330 | — |
| 79 | Kid Nichols (VAR) | R | SP4 | +0.4 runs, opp .265/.330/.351 | 653 IP, FIP 3.68, 3.5 WAR/200 |
| 78 | Tillie Walker | R | CF vs LHP; bench vs the other hand | vL +5.6 (glove -3.7) | vR .255/.310/.344 · vL .257/.341/.346 | 9636 PA, wOBA .312, 2.7 WAR/600 |
| 77 | Bill Dahlen | R | 2B vs LHP; bench vs the other hand | vL -14.5 (glove -4.9) | vR .244/.292/.320 · vL .247/.293/.321 | 9361 PA, wOBA .292, 2.2 WAR/600 |
| 77 | Willie Keeler | L | RF | vR +11.9 (glove -3.1) · vL +4.3 (glove -3.1) | vR .301/.329/.375 · vL .297/.316/.364 | 13204 PA, wOBA .324, 2.9 WAR/600 |
| 76 | Nick Altrock | L | SP3 | +2.4 runs, opp .269/.309/.348 | 969 IP, FIP 3.24, 4.3 WAR/200 |
| 75 | Frank Foreman (VAR) | R | RP3 | -0.5 runs, opp .264/.324/.350 | 294 IP, FIP 3.69, 2.9 WAR/200 |
| 75 | Joe McGinnity | R | RP1 | -0.1 runs, opp .268/.322/.356 | 550 IP, FIP 3.76, 2.6 WAR/200 |
| 74 | Aleck Smith | S | bench | -1.9 | vR .275/.325/.359 · vL .248/.324/.305 | 2673 PA, wOBA .284, 1.4 WAR/600 |
| 74 | Dick Rudolph | R | RP2 | -0.4 runs, opp .267/.315/.356 | 432 IP, FIP 3.94, 1.6 WAR/200 |
| 74 | Joe Judge | L | 1B vs LHP; bench vs the other hand | vL -1.9 (glove -0.5) | vR .274/.337/.363 · vL .266/.335/.350 | 7365 PA, wOBA .338, 2.9 WAR/600 |
| 72 | Bill Keister | L | bench | +2.4 | vR .286/.311/.377 · vL .295/.334/.376 | 5992 PA, wOBA .323, 3.0 WAR/600 |
| 71 | Con Daily (VAR) | L | 1B vs RHP | vR +1.8 (glove +1.9) | vR .281/.325/.366 · vL .269/.301/.332 | 884 PA, wOBA .319, 3.1 WAR/600 |
| 71 | Pop Corkhill | L | CF vs RHP | vR -3.9 (glove +4.6) | vR .279/.308/.355 · vL .272/.293/.335 | 8611 PA, wOBA .287, 2.3 WAR/600 |
| 68 | Dave Brain (VAR) | R | bench | -12.3 | vR .245/.284/.337 · vL .241/.284/.359 | 696 PA, wOBA .267, 2.0 WAR/600 |
| 68 | Honus Wagner | R | SS | vR -11.8 (glove -4.3) · vL -7.6 (glove -4.3) | vR .252/.310/.326 · vL .264/.298/.341 | 7428 PA, wOBA .283, 2.4 WAR/600 |
| 66 | Eddie Plank | L | CL | +0.0 runs, opp .259/.312/.344 | 2053 IP, FIP 3.78, 2.6 WAR/200 |
| 66 | Tom Brown | L | LF | vR +18.1 (glove -6.5) · vL +9.2 (glove -6.5) | vR .287/.348/.381 · vL .281/.336/.363 | 5717 PA, wOBA .335, 2.9 WAR/600 |
| 65 | Christy Mathewson | R | SP2 | +2.5 runs, opp .266/.299/.353 | 4699 IP, FIP 3.61, 3.3 WAR/200 |
| 65 | Joe Dugan (VAR) | R | 3B | vR +6.1 (glove -10.8) · vL +19.6 (glove -10.8) | vR .268/.299/.379 · vL .273/.335/.382 | 836 PA, wOBA .310, 3.1 WAR/600 |
| 64 | Pretzels Getzien | R | RP4 | -1.1 runs, opp .273/.322/.361 | 50 IP, FIP 3.97, 0.8 WAR/200 |
| 62 | Sherry Smith | L | SP1 | +5.4 runs, opp .255/.297/.346 | 2538 IP, FIP 3.94, 2.5 WAR/200 |
| 61 | Jack Tobin | L | bench | +15.7 | vR .299/.353/.375 · vL .284/.315/.337 | 3025 PA, wOBA .333, 2.6 WAR/600 |
| 58 | Ted Easterly | L | bench | -9.2 | vR .275/.314/.348 · vL .231/.268/.240 | 130 PA, wOBA .318, 3.2 WAR/600 |
| 50 | Nap Lajoie | R | 2B vs RHP | vR -4.6 (glove +0.4) | vR .271/.297/.345 · vL .239/.278/.309 | 2847 PA, wOBA .294, 3.6 WAR/600 |

Total value 1824. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** Hank Gowdy C · Honus Wagner SS · Con Daily (VAR) 1B · Tom Brown LF · Willie Keeler RF · Pop Corkhill CF · Joe Dugan (VAR) 3B · Nap Lajoie 2B · Pitcher

**vs LHP:** Hank Gowdy C · Tillie Walker CF · Joe Judge 1B · Tom Brown LF · Joe Dugan (VAR) 3B · Willie Keeler RF · Honus Wagner SS · Bill Dahlen 2B · Pitcher

**Cards the top quarter of teams play that we don't** (4 exports, 105 top teams):

- Charlie Hickman 74: on 50% of top teams — owned
- Silver King 78: on 44% of top teams — not owned
- Phil Douglas 74: on 43% of top teams (33% as variants) — owned
- Bobby Wallace 78: on 43% of top teams (20% as variants) — owned
- Frank Miller 78: on 38% of top teams — owned
- Rynie Wolters 79: on 37% of top teams — not owned
- Tim Murnane 71: on 34% of top teams (14% as variants) — owned
- Bobby Lowe 78: on 34% of top teams (6% as variants) — owned
- Stan Coveleski 78: on 33% of top teams (6% as variants) — owned
- Tom Daly 78: on 33% of top teams (23% as variants) — owned
- Wilbert Robinson 77: on 32% of top teams (21% as variants) — owned
- Irvin Brooks 78: on 31% of top teams (9% as variants) — owned
