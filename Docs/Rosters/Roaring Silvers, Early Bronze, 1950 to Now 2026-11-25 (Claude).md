# Daily Roaring Silvers, Daily Early Bronze, Wednesday 1950 to Now, 2026-11-25 (Claude)

L.J.: "upcoming rosters to make sure in app good". Each event rebuilt at 16 starts on collection 436 (11-23), seeded from its saved roster, on the current model (bend on outside cap events, arms by throwing hand).

| Event | Saved roster | New build | Result |
|---|---|---|---|
| Daily Roaring Silvers (9100183) | 2360 (11-22 bend, collection 422): 115.4 | 115.4 | Same 26 cards. **2360 stays.** |
| Daily Early Bronze (525) | 2393 (11-23, collection 436): 161.9 | 161.9 | Same 26 cards. **2393 stays.** Pete Rose already plays RF vs RHP. |
| Wednesday 1950 to Now (550) | 2385 (11-22 bend, collection 422): 622.7 | **630.4 (+7.7)** | **Saved as roster 2402, "Claude pick 2026-11-25"**. Backup `Docs/Archive/saved-rosters-2026-11-25-cloud.json.gz` (112 rosters). |

The two unchanged builds differed from the saved rosters only in bench order, so they were not saved again. The manifest `Inbox/rosters/current-2026-11-25.tsv` holds 550 only.

## 1950 to Now: what changed

- **J.D. Martinez (85, 87247) is DH vs LHP**; the saved roster did not have him. Hidalgo moves to LF vs LHP, and Lonnie Smith is out.
- **Ben Rice (100) is DH vs RHP** in place of Junior Caminero (102). Caminero is out.
- **Jake McGee (VAR) in** for Daniel Palencia (VAR).
- **Yamamoto to the pen (RP5), Larry Jackson SP5.**

Each swap scored on its own (`env-roster --score` on the new roster with one change):

| Variant | Score | vs new |
|---|---|---|
| New build | 630.4 | — |
| Caminero DH vs RHP for Rice | 628.7 | −1.7 (tie; observed here: Caminero .333 wOBA / 3,696 PA, Rice .332 / 4,464) |
| Caminero DH vs LHP for Martinez | 625.6 | **−4.8** (Martinez is real) |
| Palencia (VAR) for McGee (VAR) | 628.9 | −1.5 (tie) |
| Yamamoto SP5, Jackson RP5 | 629.7 | −0.7 (tie) |
| Saved 2385 | 622.7 | −7.7 |

Martinez has 335 PA in this series (.317 wOBA, both hands); the gain rests on his ratings vs LHP.

`env-roster --must <card> --seed …` came out at −383.5 with no SS or CF backup, so a forced run seeded from a roster that lacks the forced card is not usable. Single swaps were priced with `--score` instead.

## Wednesday 1950 to Now

2010 environment · 2026 Globe Life Field · roster 1950tonow-claude-2026-11-25.txt

| Val | Card | Hand | Roles | Projected | Observed (this series) |
|---|---|---|---|---|---|
| 104 | Josh Hader | L | RP1 | +18.0 runs, opp .188/.261/.304 | 790 IP, FIP 3.63, 3.9 WAR/200 |
| 104 | Yoshinobu Yamamoto | R | RP5 | +17.9 runs, opp .201/.249/.330 | 2182 IP, FIP 4.03, 3.5 WAR/200 |
| 103 | Elly De La Cruz | S | SS | vR +27.7 (glove +3.0) · vL +33.4 (glove +3.0) | vR .280/.369/.512 · vL .289/.368/.552 | 4521 PA, wOBA .329, 4.1 WAR/600 |
| 103 | Andrew Miller | L | CL | +21.7 runs, opp .199/.252/.319 | 268 IP, FIP 3.11, 5.7 WAR/200 |
| 103 | Chris Sale | L | SP1 | +25.1 runs, opp .209/.258/.331 | 2400 IP, FIP 3.57, 4.6 WAR/200 |
| 103 | Ben Sheets | R | SP2 | +22.5 runs, opp .206/.254/.329 | 299 IP, FIP 3.85, 4.1 WAR/200 |
| 103 | Louis Varland | R | RP3 | +13.6 runs, opp .204/.265/.321 | 737 IP, FIP 3.84, 2.3 WAR/200 |
| 102 | Josh Beckett | R | SP4 | +19.8 runs, opp .208/.264/.337 | 2622 IP, FIP 3.92, 3.8 WAR/200 |
| 102 | Andruw Jones | R | RF vs RHP; CF vs LHP | vR +42.9 (glove +10.0) · vL +44.5 (glove +5.5) | vR .307/.396/.689 · vL .309/.402/.725 | 8848 PA, wOBA .363, 5.5 WAR/600 |
| 102 | Gabriel Moreno | R | C vs LHP; bench vs the other hand | vL +6.0 (glove +11.9) | vR .274/.366/.436 · vL .266/.349/.414 | 3275 PA, wOBA .307, 1.9 WAR/600 |
| 102 | Albert Pujols | R | 1B | vR +45.9 (glove +2.9) · vL +52.4 (glove +2.9) | vR .312/.408/.672 · vL .329/.419/.780 | 9301 PA, wOBA .384, 4.5 WAR/600 |
| 101 | Richard Hidalgo | R | CF vs RHP; LF vs LHP | vR +28.1 (glove +0.2) · vL +12.2 (glove +4.6) | vR .304/.389/.663 · vL .259/.345/.448 | 12952 PA, wOBA .331, 3.1 WAR/600 |
| 101 | Robb Nen | R | RP4 | +14.0 runs, opp .210/.274/.336 | 2192 IP, FIP 3.66, 3.5 WAR/200 |
| 101 | CC Sabathia | L | SP3 | +21.8 runs, opp .214/.273/.343 | 10639 IP, FIP 3.85, 4.0 WAR/200 |
| 100 | Ben Rice | L | DH vs RHP | vR +33.8 | vR .315/.417/.713 · vL .259/.338/.471 | 4464 PA, wOBA .332, 1.1 WAR/600 |
| 99 | Jake McGee (VAR) | L | RP2 | +13.9 runs, opp .214/.279/.346 | 44 IP, FIP 3.47, 3.2 WAR/200 |
| 97 | Curtis Granderson | L | LF vs RHP | vR +43.1 (glove +8.2) | vR .306/.388/.612 · vL .207/.286/.336 | 4453 PA, wOBA .330, 3.5 WAR/600 |
| 95 | Seiya Suzuki | R | RF vs LHP; bench vs the other hand | vL +22.6 (glove +5.4) | vR .244/.341/.436 · vL .274/.384/.530 | 5454 PA, wOBA .313, 1.7 WAR/600 |
| 93 | Kyle Seager | L | 3B | vR +21.2 (glove +4.1) · vL +15.1 (glove +4.1) | vR .275/.370/.497 · vL .271/.344/.480 | 207 PA, wOBA .365, 6.1 WAR/600 |
| 92 | Larry Jackson | R | SP5 | +18.6 runs, opp .242/.295/.373 | 3594 IP, FIP 3.93, 3.8 WAR/200 |
| 92 | Rick Wilkins | L | C vs RHP | vR +28.3 (glove +10.7) | vR .279/.360/.640 · vL .206/.298/.376 | 1213 PA, wOBA .326, 2.1 WAR/600 |
| 91 | Joel Pineiro (VAR) | R | RP6 | +14.0 runs, opp .218/.280/.350 | 16 IP, FIP 3.73, 3.8 WAR/200 |
| 85 | J.D. Martinez | R | DH vs LHP; bench vs the other hand | vL +27.8 | vR .253/.318/.459 · vL .280/.364/.611 | 335 PA, wOBA .317, 0.5 WAR/600 |
| 82 | Adam Kennedy | L | 2B vs RHP | vR +18.7 (glove -0.4) | vR .269/.311/.481 · vL .243/.277/.386 | 1095 PA, wOBA .320, 2.8 WAR/600 |
| 73 | Jose Oquendo | S | bench | -7.7 | vR .252/.347/.330 · vL .269/.332/.423 | 4079 PA, wOBA .288, 1.6 WAR/600 |
| 64 | Brandon Phillips | R | 2B vs LHP; bench vs the other hand | vL +20.5 (glove +5.4) | vR .233/.272/.385 · vL .276/.323/.536 | 424 PA, wOBA .334, 4.1 WAR/600 |

Total value 2497. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** Ben Rice DH · Albert Pujols 1B · Andruw Jones RF · Richard Hidalgo CF · Curtis Granderson LF · Rick Wilkins C · Adam Kennedy 2B · Elly De La Cruz SS · Kyle Seager 3B

**vs LHP:** Seiya Suzuki RF · Albert Pujols 1B · Andruw Jones CF · J.D. Martinez DH · Elly De La Cruz SS · Kyle Seager 3B · Brandon Phillips 2B · Richard Hidalgo LF · Gabriel Moreno C

```
--- roster check ---
  ✓ staff 5 SP / 7 RP / 14 bats (caps: 5 SP, 7 RP, 12 arms) · field's best quarter (233 teams): 5.1 SP / 7.6 RP / 14.3 bats
  ✓ starters' stamina Chris Sale 82, Ben Sheets 88, CC Sabathia 105, Josh Beckett 96, Larry Jackson 92 (era floor 50)
  ✓ stamina guys in the pen (45+): Yoshinobu Yamamoto 91, Joel Pineiro 62
  ✓ C  backup: vs RHP Gabriel Moreno 126 · vs LHP Rick Wilkins 121
  ✓ 1B backup: Jose Oquendo 87
  ✓ 2B backup: vs RHP Brandon Phillips 130, Jose Oquendo 139 · vs LHP Adam Kennedy 112, Jose Oquendo 139
  ✓ 3B backup: Jose Oquendo 114
  ✓ SS backup: Jose Oquendo 117
  ✓ LF backup: vs RHP Jose Oquendo 113 · vs LHP Curtis Granderson 147, Jose Oquendo 113
  ✓ CF backup: vs RHP Jose Oquendo 94 · vs LHP Curtis Granderson 133, Jose Oquendo 94
  ✓ RF backup: vs RHP Seiya Suzuki 129, Jose Oquendo 104 · vs LHP Curtis Granderson 142, Jose Oquendo 104
(16 of 26 have a live ask in the last shop snapshot)
objective: 630.4 weighted runs (bats 53/47 R/L, SP 1.905, RP 0.78, bench 0.1)
```
