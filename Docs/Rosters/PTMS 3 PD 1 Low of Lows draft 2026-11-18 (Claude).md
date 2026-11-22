# PTMS 3 PD 1 – Low of Lows (9130004): L.J.'s draft, 2026-11-18

L.J. drafted on 11-18 and sent the 26 as a screenshot. The tiers match the format: 2 Perfect, 4 Diamond 90–94, 6 Gold 80–84, 6 Silver 70–74, 6 Bronze 60–64, 2 Iron 40–49. Every card maps to one id (`--pool-ids` below).

- **Filed in the app as roster 2233**, "L.J. draft 2026-11-18 (Claude lineup)". It shows on /build and /ptms. Load file `Inbox/rosters/ptms3pd1-lj-draft-2026-11-18.txt`. Backups `Docs/Archive/saved-rosters-2026-11-18-2/-3.json.gz`.
- **Status "draft"**: the catalogue row has no card-value window, so eligibility can't be confirmed. That's expected for a draft.
- **The game's draft save** (`draft_7ea200000000000000003d777729.pt`, 11:36) is an empty shell until the bracket starts. Every team's 26 will be in it then (`scripts/ootp-saves/pt_rosters.py`). L.J. wants the field's rosters in the app, for this event and the other PTMS 3 events.
- **No grade yet:** L.J. (11-18) says the other teams post an hour before start, so we rank against the real field rather than simulated drafts.

## The arrangement, and the builder fix (PR 199)

| Board | Weighted runs |
|---|---|
| Builder before the fix: Bell at 1B, Brock CF, Bass RF vs RHP | −7.4 |
| Hand fix: Bell CF both ways, Taylor 1B, Brock/Bass platoon in RF | −2.9 |
| Exact solve, all backups scored: Gelbert (−43.5 bat) at SS so Hemus backs up 2B | −30.5 |
| **Exact solve, backups not scored (now the builder's default for --pool-ids)** | **−0.0** |

- **Why the builder missed it:** env-roster compared climbs scored with the 25-run backup penalty against the greedy fill's raw objective. Nobody on this 26 backs up 2B, so every climb carried the penalty and the greedy fill won.
- **The fix:** fixed pools are now solved exactly: each board over all 5,005 sets of 9 bats. A test checks the solver against brute force.
- **Normal builds:** Ice (542) and Deadball (551) build the same boards before and after the fix. None of the 77 current build logs shows the greedy fill winning, so nothing needs rebuilding.
- **Missing backups, which the 26 can't fix:** 2B both ways, and CF vs RHP.
- **Checked and kept:** Beck as SP5 instead of Fitzmorris costs 1.1. A 4-man rotation (4 SP / 7 RP) costs 3.6.

```
IDS=85420,82762,85721,87484,86923,87085,86937,86445,87163,85146,86995,86371,87349,83236,86685,84138,87128,83666,87265,83123,83138,87342,84248,83119,84130,86778
env-roster --year 1986 --park "Veterans Stadium" --park-year 1985 --dh --size 26 --name "PTMS 3 PD 1 - Low of Lows" --sp 5 --rp 6 --bats 15 --pool-ids $IDS --optimize --starts 16 --role-trust 0.25 --min-pos "60,SS:85,CF:90,2B:85,RF:75"
```

## Roster check

```
--- roster check ---
  ✓ staff 5 SP / 6 RP / 15 bats (caps: 5 SP, 7 RP, 12 arms)
  ✓ starters' stamina Webster McDonald 101, Jerry Koosman 85, Brent Strom 79, Jonas Gaines 71, Al Fitzmorris 72 (era floor 50)
  ✓ stamina guys in the pen (45+): Boom-Boom Beck 72, Ron Robinson 48
  ✓ C  backup: Johnny Kling 121
  ✓ 1B backup: Juan Beniquez 70
  ✗ 2B backup: NONE on the bench — only Frankie Frisch, Solly Hemus, who start (floor 85)
  ✓ 3B backup: Billy Johnson 85
  ✓ SS backup: Charlie Gelbert 100
  ✓ LF backup: vs RHP Joe Rudi 75, Brian Downing 88, Juan Beniquez 85 · vs LHP Lou Brock 118, Joe Rudi 75, Juan Beniquez 85
  ✗ CF backup: NONE on the bench vs RHP — only Lou Brock, Kevin Bass, Cool Papa Bell, who start (floor 90) · vs LHP Lou Brock 108
  ✓ RF backup: vs RHP Juan Beniquez 76 · vs LHP Lou Brock 117, Juan Beniquez 76
(21 of 26 have a live ask in the last shop snapshot)
objective: -0.0 weighted runs (bats 70/30 R/L, SP 1, RP 0.9299999999999999, bench 0.1)
```

1986 environment · 1985 Veterans Stadium · roster ptms3pd1-lj-draft-2026-11-18.txt

| Val | Card | Hand | Roles | Projected | Observed (all events: no exports of this series on file) |
|---|---|---|---|---|---|
| 100 | Cool Papa Bell | S | LF vs RHP; CF vs LHP | vR +12.0 (glove +4.6) · vL +16.4 (glove +1.1) | vR .279/.343/.432 · vL .288/.353/.446 | 24496 PA, wOBA .299, 3.2 WAR/600 |
| 100 | Roy Campanella | R | C | vR -2.7 (glove +2.7) · vL +6.3 (glove +2.7) | vR .270/.325/.443 · vL .284/.340/.478 | 12203 PA, wOBA .285, 0.7 WAR/600 |
| 94 | Frankie Frisch | S | 2B | vR +1.9 (glove +6.3) · vL +5.4 (glove +6.3) | vR .285/.321/.430 · vL .291/.346/.422 | 90271 PA, wOBA .321, 3.3 WAR/600 |
| 92 | Joe Rudi | R | DH | vR +12.0 · vL +26.6 | vR .275/.320/.487 · vL .298/.354/.608 | — |
| 90 | Brian Downing | R | LF vs LHP; bench vs the other hand | vL +8.6 (glove -0.9) | vR .269/.366/.476 · vL .287/.384/.458 | 12470 PA, wOBA .321, 0.4 WAR/600 |
| 90 | Webster McDonald | R | SP1 | +13.3 runs, opp .251/.299/.389 | 8137 IP, FIP 4.28, 3.1 WAR/200 |
| 83 | Kevin Bass | S | RF | vR -0.2 (glove +4.6) · vL +5.4 (glove +4.6) | vR .278/.324/.414 · vL .290/.308/.463 | 6749 PA, wOBA .298, 1.6 WAR/600 |
| 83 | Solly Hemus | L | SS | vR -10.1 (glove -3.8) · vL -9.3 (glove -3.8) | vR .250/.344/.369 · vL .248/.344/.373 | 12745 PA, wOBA .292, 1.9 WAR/600 |
| 83 | Ben Taylor | L | 1B | vR +1.6 (glove +0.8) · vL -0.4 (glove +0.8) | vR .285/.345/.407 · vL .281/.340/.397 | 2058 PA, wOBA .310, 0.9 WAR/600 |
| 82 | Boom-Boom Beck | R | RP1 | -6.7 runs, opp .272/.342/.411 | 1057 IP, FIP 4.84, 2.2 WAR/200 |
| 82 | Jerry Koosman | L | SP2 | +6.1 runs, opp .263/.319/.391 | 2872 IP, FIP 4.07, 3.6 WAR/200 |
| 80 | Lou Brock | L | CF vs RHP | vR +10.1 (glove -0.6) | vR .271/.323/.402 · vL .248/.286/.348 | 7596 PA, wOBA .309, 2.1 WAR/600 |
| 74 | Johnny Kling | R | bench | -19.5 | vR .243/.281/.368 · vL .256/.293/.419 | 2297 PA, wOBA .278, 1.7 WAR/600 |
| 74 | Dave Tomlin | L | CL | -9.1 runs, opp .275/.346/.404 | 1297 IP, FIP 4.16, 1.9 WAR/200 |
| 73 | Brent Strom | L | SP3 | +5.4 runs, opp .259/.322/.391 | 14930 IP, FIP 4.08, 3.3 WAR/200 |
| 72 | Billy Johnson | R | bench | -26.8 | vR .234/.292/.340 · vL .239/.304/.354 | 223 PA, wOBA .268, 0.3 WAR/600 |
| 72 | Brooks Robinson | R | 3B | vR -2.7 (glove +6.8) · vL +1.8 (glove +6.8) | vR .274/.325/.434 · vL .287/.344/.424 | 10261 PA, wOBA .303, 3.4 WAR/600 |
| 70 | Juan Beniquez | R | bench | -29.0 | vR .240/.301/.301 · vL .265/.328/.343 | 1292 PA, wOBA .246, -1.7 WAR/600 |
| 64 | Jonas Gaines | L | SP4 | -6.3 runs, opp .264/.330/.427 | 1428 IP, FIP 4.54, 2.1 WAR/200 |
| 63 | Al Fitzmorris | R | SP5 | -18.1 runs, opp .290/.358/.448 | 542 IP, FIP 4.54, 1.8 WAR/200 |
| 63 | Cal McLish | R | RP4 | -18.9 runs, opp .272/.361/.437 | 250 IP, FIP 4.96, 0.0 WAR/200 |
| 61 | Max Flack | L | bench | -2.8 | vR .273/.326/.440 · vL .244/.305/.346 | 695 PA, wOBA .292, -0.7 WAR/600 |
| 60 | Neil Allen | R | RP2 | -17.2 runs, opp .273/.359/.416 | 533 IP, FIP 4.77, 0.6 WAR/200 |
| 60 | Mike Armstrong | R | RP3 | -17.4 runs, opp .260/.351/.428 | 836 IP, FIP 5.09, -0.7 WAR/200 |
| 48 | Charlie Gelbert | R | bench | -43.5 | vR .227/.264/.280 · vL .237/.263/.292 | 199 PA, wOBA .244, -0.9 WAR/600 |
| 43 | Ron Robinson | R | RP5 | -28.1 runs, opp .274/.366/.448 | 597 IP, FIP 5.30, -0.8 WAR/200 |

Total value 1956. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** Solly Hemus SS · Cool Papa Bell LF · Roy Campanella C · Joe Rudi DH · Ben Taylor 1B · Brooks Robinson 3B · Frankie Frisch 2B · Kevin Bass RF · Lou Brock CF

**vs LHP:** Brian Downing LF · Cool Papa Bell CF · Joe Rudi DH · Roy Campanella C · Frankie Frisch 2B · Brooks Robinson 3B · Kevin Bass RF · Ben Taylor 1B · Solly Hemus SS


- Bob Friend 99: 7796 event appearances — owned
- Fritz Ostermueller 64: 7601 event appearances — owned
- Jordan Montgomery 77: 7498 event appearances — owned
- Honus Wagner 99: 7078 event appearances — owned
- James McDonald 55: 6975 event appearances — owned
- Steve Pearce 69: 6726 event appearances — owned
- Willie McGee 79: 6668 event appearances — owned
- Jim Brewer 78: 6420 event appearances — owned
- Joe Grzenda 98: 6246 event appearances — owned
- Edgardo Alfonzo 79: 6063 event appearances — owned
- Zack Wheeler 79: 5846 event appearances — owned
- Chick Hafey 89: 5475 event appearances — owned
