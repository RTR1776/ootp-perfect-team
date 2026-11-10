# PTMS 3 Tournament Rosters (Claude, 2026-11-10)

PTMS 3 is Saturday 11-21, with every event best of 9. These are the three tournaments, built on the newest collection with `current-rosters --only 9130001,9130002,9130003 --all` (16 λ starts plus a staff polish of the best 3 boards, L.J.'s position floors, default shape). Each is saved on /build as **"Claude pick 2026-11-10"**. The load files are `Inbox/rosters/ptms3-91300NN-claude-2026-11-10-ptms3.txt`. The catalogue events and the /ptms page are in [PR 179](https://github.com/RTR1776/ootp-perfect-team/pull/179).

| Event | Roster | Score | Rotation | CL |
|---|---|---|---|---|
| T1 Open (1988 RE, 1996 Dodger Stadium, DH, variants on) | 2031 | 796.7 | Mordecai Brown, Yoshinobu Yamamoto, Madison Bumgarner, Christy Mathewson, Cy Young (VAR) | Josh Hader |
| T2 Iron, 5 sets, variant cap 10 (1998 RE, 1999 Jacobs Field, DH) | 2032 | −64.6 | James McDonald (VAR), Big Jeff Pfeffer, Jeff Francis, Patricio Scantlebury, Wilson Alvarez (VAR) | Randy Choate |
| T3 Slots D8 G6 S6 B6 (2019 RE, 1995 Coors Field, DH, no variants) | 2033 | 487.0 | Jerry Koosman, Ed Reulbach, Don Larsen, Mark Langston, Cherokee Fisher | Adrian Morejon |

**Read these first:**
- **No exports of any PTMS 3 event exist.** The shape and handedness fall back to the era table, observed play is pooled across every event, and the "top teams" lists are general usage, not this field.
- **Iron:** the sets rule is applied (Negro League Star, Historical All-Star, Snapshot, Unsung Heroes, Hardware Heroes). There are exactly **10 variants**, which is the cap.
  - Randy Choate closes over John Bale. Bale is better per 700 BF at a 35% LHB mix (+0.7 against −2.4).
  - The scorer prices the CL slot at its leverage and usage, which gives Choate 6.74 and Bale 5.07. It sorts the staff by that, so the order meets the "CL is the best reliever" rule as the code defines it.
  - With the two swapped in the load file, `env-roster --score` still reads −64.6, because the scorer re-sorts the staff anyway. Closing with Bale in the game is a coin flip.
- **Slots:** D8 G6 S6 B5, with **Roger Bresnahan (55, Iron) in a Bronze slot** as the backup C. This is legal under the slots backup rule, where a lower tier fills a higher slot, the same rule as the PTCS 8 Cap builds.
  - At Coors in a 2019 RE, the bats carry it: Beltran, Granderson, Bo Jackson, Betts, Alvarez and Braun are all +30 or better on one board.
- **Open:** a 5 SP / 6 RP / 15-bat shape. Mike Piazza (VAR) catches against LHP and Rick Wilkins against RHP.


## PTMS 3 Tournament 1 - Open

1988 environment · 1996 Dodger Stadium · roster ptms3-9130001-claude-2026-11-10-ptms3.txt

| Val | Card | Hand | Roles | Projected | Observed (all events: no exports of this series on file) |
|---|---|---|---|---|---|
| 104 | Josh Hader | L | CL | +30.7 runs, opp .198/.264/.284 | — |
| 104 | Yoshinobu Yamamoto | R | SP2 | +32.0 runs, opp .209/.251/.302 | — |
| 103 | George Brett | L | 1B vs RHP | vR +54.4 (glove +1.8) | vR .299/.403/.535 · vL .286/.375/.458 | 63887 PA, wOBA .350, 3.6 WAR/600 |
| 103 | Mordecai Brown | R | SP1 | +32.3 runs, opp .215/.256/.302 | 1735 IP, FIP 3.54, 4.6 WAR/200 |
| 103 | Madison Bumgarner | L | SP3 | +31.4 runs, opp .214/.257/.304 | 12467 IP, FIP 3.69, 4.6 WAR/200 |
| 103 | Elly De La Cruz | S | SS vs LHP; bench vs the other hand | vL +44.9 (glove +2.3) | vR .273/.355/.415 · vL .290/.362/.466 | — |
| 103 | Ed Delahanty | R | LF vs LHP; bench vs the other hand | vL +44.5 (glove +5.0) | vR .299/.369/.540 · vL .300/.364/.519 | 1532 PA, wOBA .339, 3.1 WAR/600 |
| 103 | Christy Mathewson | R | SP4 | +31.2 runs, opp .213/.258/.303 | 2639 IP, FIP 3.84, 3.7 WAR/200 |
| 103 | Andrew Miller | L | RP1 | +25.2 runs, opp .210/.256/.298 | 296 IP, FIP 3.15, 5.0 WAR/200 |
| 103 | Chris Sale | L | RP5 | +25.6 runs, opp .220/.263/.309 | — |
| 103 | Corey Seager | L | SS vs RHP | vR +42.1 (glove +3.5) | vR .289/.377/.529 · vL .278/.356/.459 | 18861 PA, wOBA .338, 3.4 WAR/600 |
| 103 | Carl Yastrzemski | L | LF vs RHP | vR +49.4 (glove +6.6) | vR .302/.393/.545 · vL .294/.377/.474 | 25338 PA, wOBA .334, 3.2 WAR/600 |
| 102 | Zack Britton | L | RP4 | +22.2 runs, opp .211/.268/.297 | 2209 IP, FIP 3.88, 3.0 WAR/200 |
| 102 | Wade Davis | R | RP3 | +22.9 runs, opp .206/.270/.293 | 691 IP, FIP 4.15, 2.7 WAR/200 |
| 102 | Willie Hernandez | L | RP2 | +29.6 runs, opp .212/.257/.300 | 7064 IP, FIP 3.65, 4.1 WAR/200 |
| 102 | Reggie Jackson | L | DH | vR +57.9 · vL +45.6 | vR .300/.398/.598 · vL .285/.371/.540 | 3393 PA, wOBA .314, 0.9 WAR/600 |
| 102 | Andruw Jones | R | CF | vR +46.9 (glove +4.2) · vL +53.0 (glove +4.2) | vR .293/.377/.539 · vL .294/.382/.565 | 34632 PA, wOBA .343, 4.7 WAR/600 |
| 102 | Albert Pujols | R | 1B vs LHP; bench vs the other hand | vL +56.0 (glove +2.2) | vR .295/.386/.531 · vL .305/.391/.593 | 35561 PA, wOBA .354, 3.2 WAR/600 |
| 102 | Alex Rodriguez | R | 3B | vR +69.0 (glove +6.4) · vL +31.9 (glove +6.4) | vR .320/.401/.695 · vL .269/.381/.466 | 7285 PA, wOBA .330, 4.3 WAR/600 |
| 102 | Chase Utley | L | 2B | vR +34.3 (glove +6.5) · vL +44.7 (glove +6.5) | vR .281/.381/.455 · vL .289/.391/.497 | 39537 PA, wOBA .328, 4.3 WAR/600 |
| 102 | Cy Young (VAR) | R | SP5 | +28.2 runs, opp .220/.264/.313 | 2894 IP, FIP 3.81, 3.7 WAR/200 |
| 101 | Rogers Hornsby | R | bench | +31.8 | vR .274/.343/.458 · vL .276/.350/.390 | 31733 PA, wOBA .306, 2.9 WAR/600 |
| 101 | Mike Piazza (VAR) | R | C vs LHP; bench vs the other hand | vL +40.1 (glove -1.5) | vR .282/.359/.466 · vL .295/.351/.536 | 1323 PA, wOBA .346, 2.6 WAR/600 |
| 97 | Curtis Granderson | L | RF vs RHP | vR +42.9 (glove +6.0) | vR .286/.364/.475 · vL .220/.290/.309 | 12384 PA, wOBA .346, 4.0 WAR/600 |
| 92 | Rick Wilkins | L | C vs RHP | vR +25.4 (glove +5.9) | vR .265/.341/.483 · vL .220/.302/.332 | — |
| 88 | Bo Jackson | R | RF vs LHP; bench vs the other hand | vL +33.4 (glove +3.4) | vR .267/.321/.511 · vL .259/.347/.455 | 180804 PA, wOBA .325, 2.8 WAR/600 |

Total value 2635. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** George Brett 1B · Carl Yastrzemski LF · Reggie Jackson DH · Alex Rodriguez 3B · Andruw Jones CF · Corey Seager SS · Rick Wilkins C · Curtis Granderson RF · Chase Utley 2B

**vs LHP:** Chase Utley 2B · Andruw Jones CF · Reggie Jackson DH · Albert Pujols 1B · Ed Delahanty LF · Mike Piazza (VAR) C · Bo Jackson RF · Alex Rodriguez 3B · Elly De La Cruz SS

**No exports of this series on file.** Most-used cards in observed play inside the value window (0–999) that we don't carry:

- Bob Friend 99: 7626 event appearances — owned
- Fritz Ostermueller 64: 7252 event appearances — owned
- Jordan Montgomery 77: 6864 event appearances — owned
- Honus Wagner 99: 6625 event appearances — owned
- James McDonald 55: 6617 event appearances — owned
- Willie McGee 79: 6547 event appearances — owned
- Steve Pearce 69: 6521 event appearances — owned
- Jim Brewer 78: 6300 event appearances — owned
- Joe Grzenda 98: 6177 event appearances — owned
- Edgardo Alfonzo 79: 5959 event appearances — owned
- Zack Wheeler 79: 5342 event appearances — owned
- Jefferson Rojas 66: 5043 event appearances — owned

```
--- rotation ---
SP1     Mordecai Brown             103  S  1909   +32.3   SP STM 104  #87370
SP2     Yoshinobu Yamamoto         104  R  2026   +32.0   SP STM  91  #87408
SP3     Madison Bumgarner          103  R  2014   +31.4   SP STM 110  #87024
SP4     Christy Mathewson          103  R  1905   +31.2   SP STM 111  #86697
SP5     Cy Young (VAR)             102  R  1895   +28.2   SP STM 114  #86572

--- bullpen ---
CL      Josh Hader                 104  L  2026   +30.7   CL STM  19  #87401
RP1     Andrew Miller              103  L  2014   +25.2   RP STM  10  #87138
RP2     Willie Hernandez           102  L  1984   +29.6   CL STM  67  #86914
RP3     Wade Davis                 102  R  2015   +22.9   CL STM  16  #87067
RP4     Zack Britton               102  L  2016   +22.2   CL STM  18  #86426
RP5     Chris Sale                 103  L  2026   +25.6   SP STM  82  #87406

--- roster check ---
  ✓ staff 5 SP / 6 RP / 15 bats (caps: 5 SP, 7 RP, 12 arms)
  ✓ starters' stamina Mordecai Brown 104, Yoshinobu Yamamoto 91, Madison Bumgarner 110, Christy Mathewson 111, Cy Young 114 (era floor 50)
  ✓ stamina guys in the pen (45+): Willie Hernandez 67, Chris Sale 82
  ✓ C  backup: vs RHP Mike Piazza 69 · vs LHP Rick Wilkins 121
  ✓ 1B backup: vs RHP Albert Pujols 91, Ed Delahanty 67 · vs LHP George Brett 88
  ✓ 2B backup: Rogers Hornsby 126
  ✓ 3B backup: vs RHP Rogers Hornsby 108 · vs LHP George Brett 88, Rogers Hornsby 108
  ✓ SS backup: vs RHP Elly De La Cruz 115, Rogers Hornsby 108 · vs LHP Corey Seager 119, Rogers Hornsby 108
  ✓ LF backup: vs RHP Bo Jackson 116, Ed Delahanty 136, Rogers Hornsby 76 · vs LHP Curtis Granderson 147, Carl Yastrzemski 149, Rogers Hornsby 76
  ✓ CF backup: vs RHP Bo Jackson 103 · vs LHP Curtis Granderson 133
  ✓ RF backup: vs RHP Bo Jackson 123 · vs LHP Curtis Granderson 142
(13 of 26 have a live ask in the last shop snapshot)
objective: 796.7 weighted runs (bats 70/30 R/L, SP 1, RP 0.9299999999999999, bench 0.1)
points: lineup(both boards, 14 bats) 1403 · rotation 515 · bullpen 616 · bench-only 101
```


## PTMS 3 Tournament 2 - Iron

1998 environment · 1999 Jacobs Field · roster ptms3-9130002-claude-2026-11-10-ptms3.txt

| Val | Card | Hand | Roles | Projected | Observed (all events: no exports of this series on file) |
|---|---|---|---|---|---|
| 59 | Willy Adames | R | SS vs RHP | vR -10.7 (glove +0.6) | vR .240/.293/.398 · vL .228/.294/.347 | 47838 PA, wOBA .280, 2.0 WAR/600 |
| 59 | Wilson Alvarez (VAR) | L | SP5 | -8.3 runs, opp .283/.365/.457 | 3025 IP, FIP 4.57, 1.8 WAR/200 |
| 59 | John Bale | L | RP1 | +0.7 runs, opp .274/.359/.405 | 3701 IP, FIP 3.63, 4.2 WAR/200 |
| 59 | Hector Carrasco (VAR) | R | RP3 | -8.6 runs, opp .285/.363/.435 | 2800 IP, FIP 4.49, 1.4 WAR/200 |
| 59 | Shawn Green | L | 1B vs RHP | vR +0.3 (glove +2.8) | vR .260/.339/.452 · vL .233/.306/.368 | 19183 PA, wOBA .328, 2.3 WAR/600 |
| 59 | Bill Hall | R | DH vs LHP; bench vs the other hand | vL +6.4 | vR .239/.304/.390 · vL .251/.355/.420 | 28498 PA, wOBA .334, 3.5 WAR/600 |
| 59 | Big Jeff Pfeffer | R | SP2 | +1.2 runs, opp .269/.354/.425 | 1993 IP, FIP 3.61, 4.6 WAR/200 |
| 59 | Chris Taylor | R | 3B | vR -5.0 (glove +1.1) · vL -4.4 (glove +1.1) | vR .251/.325/.379 · vL .245/.346/.369 | 15445 PA, wOBA .300, 2.9 WAR/600 |
| 58 | Pat Perry | L | RP5 | -10.1 runs, opp .263/.366/.434 | 7627 IP, FIP 4.67, 0.6 WAR/200 |
| 58 | Milt Thompson | L | CF vs RHP | vR -9.3 (glove +0.1) | vR .276/.347/.358 · vL .244/.280/.323 | 41586 PA, wOBA .296, 2.5 WAR/600 |
| 57 | Mike Marshall | R | RP2 | -0.7 runs, opp .276/.368/.420 | 23582 IP, FIP 4.41, 1.7 WAR/200 |
| 57 | Rick Wilkins | L | bench | -10.1 | vR .244/.339/.366 · vL .221/.254/.331 | 21324 PA, wOBA .297, 1.8 WAR/600 |
| 56 | Matt Davidson (VAR) | R | 1B vs LHP; bench vs the other hand | vL -1.6 (glove -0.1) | vR .226/.309/.346 · vL .248/.337/.437 | 15772 PA, wOBA .340, 1.9 WAR/600 |
| 56 | Patricio Scantlebury | L | SP4 | -7.6 runs, opp .290/.379/.437 | 4231 IP, FIP 4.33, 2.2 WAR/200 |
| 55 | Ken Berry | R | RF vs RHP; LF vs LHP | vR -15.0 (glove +3.5) · vL -5.6 (glove +4.1) | vR .260/.315/.355 · vL .268/.339/.400 | 63372 PA, wOBA .293, 1.4 WAR/600 |
| 55 | Roger Bresnahan | R | C | vR +3.0 (glove -7.2) · vL -17.4 (glove -7.2) | vR .260/.332/.453 · vL .258/.342/.329 | — |
| 55 | James McDonald (VAR) | R | SP1 | +3.9 runs, opp .270/.352/.404 | 27832 IP, FIP 3.94, 4.4 WAR/200 |
| 54 | Ty Wigginton (VAR) | R | LF vs RHP | vR +2.6 (glove -3.5) | vR .267/.326/.473 · vL .248/.332/.357 | 18258 PA, wOBA .340, 1.1 WAR/600 |
| 53 | Jeff Francis | L | SP3 | -7.0 runs, opp .290/.351/.468 | 4779 IP, FIP 4.00, 3.8 WAR/200 |
| 50 | Dave Henderson | R | CF vs LHP; bench vs the other hand | vL -5.4 (glove -0.9) | vR .241/.311/.354 · vL .265/.333/.400 | 7731 PA, wOBA .301, 2.2 WAR/600 |
| 50 | Nap Lajoie (VAR) | R | 2B | vR -8.1 (glove +2.0) · vL -10.5 (glove +2.0) | vR .297/.333/.418 · vL .259/.311/.389 | 15991 PA, wOBA .311, 2.1 WAR/600 |
| 49 | Javier Baez (VAR) | R | DH vs RHP; SS vs LHP | vR -1.6 · vL -4.9 (glove -4.9) | vR .251/.296/.405 · vL .232/.324/.350 | 20064 PA, wOBA .318, 3.1 WAR/600 |
| 45 | Randy Choate | L | CL | -2.4 runs, opp .281/.354/.417 | 7152 IP, FIP 4.19, 2.6 WAR/200 |
| 44 | Bob Gibson (VAR) | R | RP6 | -8.7 runs, opp .279/.393/.421 | 1187 IP, FIP 4.30, 3.1 WAR/200 |
| 43 | Todd Jones (VAR) | R | RP4 | -9.1 runs, opp .279/.354/.436 | 2677 IP, FIP 3.91, 3.5 WAR/200 |
| 43 | Sammy Sosa (VAR) | R | RF vs LHP; bench vs the other hand | vL +2.0 (glove +1.4) | vR .212/.249/.298 · vL .245/.306/.424 | 11175 PA, wOBA .328, 2.8 WAR/600 |

Total value 1410. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** Milt Thompson CF · Shawn Green 1B · Roger Bresnahan C · Ty Wigginton (VAR) LF · Nap Lajoie (VAR) 2B · Chris Taylor 3B · Javier Baez (VAR) DH · Willy Adames SS · Ken Berry RF

**vs LHP:** Bill Hall DH · Chris Taylor 3B · Matt Davidson (VAR) 1B · Sammy Sosa (VAR) RF · Ken Berry LF · Dave Henderson CF · Javier Baez (VAR) SS · Nap Lajoie (VAR) 2B · Roger Bresnahan C

**No exports of this series on file.** Most-used cards in observed play inside the value window (0–59) that we don't carry:

- Santiago Espinal 55: 3111 event appearances — not owned
- Vladimir Guerrero 48: 3006 event appearances — owned
- Nico Hoerner 48: 2759 event appearances — owned
- Ozzie Smith 59: 2405 event appearances — owned
- Bob Romby 58: 2335 event appearances — owned
- Reed Garrett 49: 2139 event appearances — owned
- Alex Reyes 53: 2002 event appearances — owned
- Carlos Beltran 58: 1936 event appearances — owned
- Dallas Braden 57: 1669 event appearances — owned
- Jason Heyward 57: 1578 event appearances — owned
- Jim Tabor 54: 1527 event appearances — owned
- Dwayne Hosey 49: 1518 event appearances — owned

```
--- rotation ---
SP1     James McDonald (VAR)        55  L  2010    +3.9   SP STM  59  #86384
SP2     Big Jeff Pfeffer            59  R  1906    +1.2   SP STM  98  #87340
SP3     Jeff Francis                53  L  2007    -7.0   SP STM  75  #87199
SP4     Patricio Scantlebury        56  L  1946    -7.6   SP STM  68  #85828
SP5     Wilson Alvarez (VAR)        59  L  1994    -8.3   SP STM  77  #83868

--- bullpen ---
CL      Randy Choate                45  L  2013    -2.4   RP STM   6  #87026
RP1     John Bale                   59  L  2007    +0.7   RP STM  33  #87234
RP2     Mike Marshall               57  R  1973    -0.7   CL STM  74  #84720
RP3     Hector Carrasco (VAR)       59  R  1999    -8.6   RP STM  20  #83082
RP4     Todd Jones (VAR)            43  L  2000    -9.1   CL STM  17  #86434
RP5     Pat Perry                   58  L  1989   -10.1   RP STM  35  #86916
RP6     Bob Gibson (VAR)            44  R  1959    -8.7   SP STM  69  #86658

--- roster check ---
  ✓ staff 5 SP / 7 RP / 14 bats (caps: 5 SP, 7 RP, 12 arms)
  ✓ starters' stamina James McDonald 59, Big Jeff Pfeffer 98, Jeff Francis 75, Patricio Scantlebury 68, Wilson Alvarez 77 (era floor 50)
  ✓ stamina guys in the pen (45+): Mike Marshall 74, Bob Gibson 69
  ✓ C  backup: Rick Wilkins 60
  ✓ 1B backup: vs RHP Matt Davidson 76 · vs LHP Shawn Green 96, Ty Wigginton 75
  ✓ 2B backup: vs RHP Javier Baez 102, Bill Hall 91 · vs LHP Willy Adames 127, Bill Hall 91
  ✓ 3B backup: Bill Hall 74
  ✓ SS backup: vs RHP Javier Baez 88 · vs LHP Willy Adames 109
  ✓ LF backup: vs RHP Sammy Sosa 104, Bill Hall 67 · vs LHP Milt Thompson 121, Ty Wigginton 65, Bill Hall 67
  ✓ CF backup: vs RHP Dave Henderson 105 · vs LHP Milt Thompson 114
  ✓ RF backup: vs RHP Dave Henderson 104, Sammy Sosa 109 · vs LHP Milt Thompson 111
(22 of 26 have a live ask in the last shop snapshot)
objective: -64.6 weighted runs (bats 70/30 R/L, SP 1, RP 0.775, bench 0.1)
points: lineup(both boards, 13 bats) 706 · rotation 282 · bullpen 365 · bench-only 57
```


## PTMS 3 Tournament 3 - Slots

2019 environment · 1995 Coors Field · roster ptms3-9130003-claude-2026-11-10-ptms3.txt

| Val | Card | Hand | Roles | Projected | Observed (all events: no exports of this series on file) |
|---|---|---|---|---|---|
| 99 | Carlos Beltran | S | DH vs RHP; CF vs LHP | vR +39.1 · vL +33.6 (glove -0.8) | vR .334/.434/.771 · vL .348/.425/.685 | 55366 PA, wOBA .338, 3.1 WAR/600 |
| 98 | Jerry Koosman | L | SP1 | +21.5 runs, opp .266/.319/.425 | 63 IP, FIP 4.20, 4.1 WAR/200 |
| 97 | Curtis Granderson | L | LF vs RHP | vR +38.2 (glove +8.2) | vR .341/.420/.686 · vL .232/.309/.378 | 12384 PA, wOBA .346, 4.0 WAR/600 |
| 97 | Adrian Morejon | L | CL | +13.4 runs, opp .266/.331/.411 | — |
| 97 | Thurman Munson | R | C | vR +10.9 (glove +13.3) · vL +25.2 (glove +13.3) | vR .316/.371/.555 · vL .342/.402/.647 | 10608 PA, wOBA .294, 1.8 WAR/600 |
| 97 | Ed Reulbach | R | SP2 | +20.3 runs, opp .258/.322/.414 | 850 IP, FIP 4.09, 3.4 WAR/200 |
| 96 | Don Larsen | R | SP3 | +19.5 runs, opp .264/.321/.427 | 2821 IP, FIP 4.44, 3.1 WAR/200 |
| 91 | Mark Langston | L | SP4 | +18.7 runs, opp .253/.333/.404 | 9870 IP, FIP 4.26, 3.4 WAR/200 |
| 89 | Sebastian Walcott | R | 3B vs RHP; 1B vs LHP | vR +20.5 (glove +1.0) · vL +20.2 (glove +6.9) | vR .293/.391/.580 · vL .303/.394/.558 | 2758 PA, wOBA .291, 1.6 WAR/600 |
| 88 | Bo Jackson | R | RF vs RHP; LF vs LHP | vR +38.6 (glove +4.3) · vL +32.8 (glove +3.3) | vR .322/.378/.771 · vL .305/.396/.658 | 180804 PA, wOBA .325, 2.8 WAR/600 |
| 87 | Mookie Betts | R | CF vs RHP; RF vs LHP | vR +24.1 (glove +5.9) · vL +21.0 (glove +10.3) | vR .347/.403/.630 · vL .339/.389/.675 | 4031 PA, wOBA .292, 2.7 WAR/600 |
| 84 | Marcus Semien | R | 2B vs RHP | vR +22.4 (glove +2.5) | vR .308/.381/.661 · vL .279/.353/.540 | 45464 PA, wOBA .303, 2.6 WAR/600 |
| 82 | Cherokee Fisher | R | SP5 | +16.3 runs, opp .244/.346/.386 | 346 IP, FIP 4.35, 3.2 WAR/200 |
| 81 | Pedro Alvarez | L | 1B vs RHP | vR +30.7 (glove +3.9) | vR .314/.390/.811 · vL .209/.304/.310 | 14293 PA, wOBA .330, 2.4 WAR/600 |
| 79 | Jacob deGrom | R | RP4 | +10.7 runs, opp .267/.348/.419 | 34354 IP, FIP 4.01, 3.6 WAR/200 |
| 79 | Jeremy Pena | R | SS | vR +15.0 (glove +3.4) · vL +23.2 (glove +3.4) | vR .313/.356/.550 · vL .329/.377/.593 | 39022 PA, wOBA .293, 3.2 WAR/600 |
| 78 | Kelvim Escobar | R | RP2 | +12.3 runs, opp .273/.338/.430 | 12033 IP, FIP 3.79, 4.3 WAR/200 |
| 77 | Mike Matthews | L | RP1 | +5.5 runs, opp .253/.363/.401 | 136 IP, FIP 5.00, -1.9 WAR/200 |
| 77 | Eric O'Flaherty | L | RP3 | +3.6 runs, opp .283/.360/.436 | 2891 IP, FIP 4.02, 1.8 WAR/200 |
| 74 | Ryan Braun | R | DH vs LHP; bench vs the other hand | vL +47.2 | vR .270/.321/.518 · vL .349/.435/.778 | 8386 PA, wOBA .343, 2.4 WAR/600 |
| 69 | Kerry Wood | R | RP6 | +1.3 runs, opp .249/.354/.406 | 5771 IP, FIP 4.50, 1.6 WAR/200 |
| 67 | Edwin Diaz | R | RP5 | +1.9 runs, opp .275/.350/.430 | 14151 IP, FIP 3.93, 3.6 WAR/200 |
| 66 | Jefferson Rojas | R | bench | -0.4 | vR .297/.349/.485 · vL .308/.362/.514 | 144471 PA, wOBA .316, 2.6 WAR/600 |
| 66 | Chris Sabo | R | 3B vs LHP; bench vs the other hand | vL +37.5 (glove -3.6) | vR .285/.353/.573 · vL .373/.445/.773 | 53187 PA, wOBA .346, 2.8 WAR/600 |
| 64 | Brandon Phillips | R | 2B vs LHP; bench vs the other hand | vL +26.3 (glove +5.4) | vR .293/.328/.479 · vL .343/.386/.669 | 21567 PA, wOBA .337, 3.6 WAR/600 |
| 55 | Roger Bresnahan | R | bench | +2.2 | vR .277/.346/.520 · vL .273/.353/.348 | — |

Total value 2134. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** Mookie Betts CF · Carlos Beltran DH · Bo Jackson RF · Pedro Alvarez 1B · Curtis Granderson LF · Sebastian Walcott 3B · Marcus Semien 2B · Thurman Munson C · Jeremy Pena SS

**vs LHP:** Chris Sabo 3B · Carlos Beltran CF · Bo Jackson LF · Ryan Braun DH · Thurman Munson C · Mookie Betts RF · Brandon Phillips 2B · Jeremy Pena SS · Sebastian Walcott 1B

**No exports of this series on file.** Most-used cards in observed play inside the value window (0–99) that we don't carry:

- Bob Friend 99: 7626 event appearances — owned
- Fritz Ostermueller 64: 7252 event appearances — owned
- Jordan Montgomery 77: 6864 event appearances — owned
- Honus Wagner 99: 6625 event appearances — owned
- James McDonald 55: 6617 event appearances — owned
- Willie McGee 79: 6547 event appearances — owned
- Steve Pearce 69: 6521 event appearances — owned
- Jim Brewer 78: 6300 event appearances — owned
- Joe Grzenda 98: 6177 event appearances — owned
- Edgardo Alfonzo 79: 5959 event appearances — owned
- Zack Wheeler 79: 5342 event appearances — owned
- Chick Hafey 89: 5042 event appearances — owned

```
--- rotation ---
SP1     Jerry Koosman               98  R  1969   +21.5   SP STM  96  #87440
SP2     Ed Reulbach                 97  R  1905   +20.3   SP STM  92  #87376
SP3     Don Larsen                  96  R  1956   +19.5   SP STM 100  #87240
SP4     Mark Langston               91  R  1989   +18.7   SP STM  86  #86956
SP5     Cherokee Fisher             82  R  1872   +16.3   SP STM  79  #87337

--- bullpen ---
CL      Adrian Morejon              97  L  2026   +13.4   RP STM  17  #87421
RP1     Mike Matthews               77  L  2001    +5.5   RP STM  14  #87296
RP2     Kelvim Escobar              78  S  2007   +12.3   SP STM  76  #87207
RP3     Eric O'Flaherty             77  L  2011    +3.6   RP STM  11  #86776
RP4     Jacob deGrom                79  L  2014   +10.7   SP STM  73  #86675
RP5     Edwin Diaz                  67  R  2016    +1.9   CL STM  13  #86422
RP6     Kerry Wood                  69  R  2010    +1.3   RP STM  17  #86987

--- roster check ---
  ✓ staff 5 SP / 7 RP / 14 bats (caps: 5 SP, 7 RP, 12 arms)
  ✓ starters' stamina Jerry Koosman 96, Ed Reulbach 92, Don Larsen 100, Mark Langston 86, Cherokee Fisher 79 (era floor 50)
  ✓ stamina guys in the pen (45+): Kelvim Escobar 76, Jacob deGrom 73
  ✓ C  backup: Roger Bresnahan 60
  ✓ 1B backup: vs RHP Roger Bresnahan 61, Jefferson Rojas 84 · vs LHP Pedro Alvarez 96, Roger Bresnahan 61, Jefferson Rojas 84
  ✓ 2B backup: vs RHP Brandon Phillips 130, Jefferson Rojas 128 · vs LHP Marcus Semien 121, Jefferson Rojas 128
  ✓ 3B backup: vs RHP Chris Sabo 77, Jefferson Rojas 110 · vs LHP Pedro Alvarez 75, Jefferson Rojas 110
  ✓ SS backup: vs RHP Jefferson Rojas 110 · vs LHP Marcus Semien 90, Jefferson Rojas 110
  ✓ LF backup: vs RHP Jefferson Rojas 71 · vs LHP Curtis Granderson 147, Jefferson Rojas 71
  ✓ CF backup: vs RHP Carlos Beltran 108 · vs LHP Curtis Granderson 133
  ✓ RF backup: vs RHP Roger Bresnahan 84, Jefferson Rojas 61 · vs LHP Curtis Granderson 142, Roger Bresnahan 84, Jefferson Rojas 61
(18 of 26 have a live ask in the last shop snapshot)
objective: 487.0 weighted runs (bats 70/30 R/L, SP 1.5, RP 0.5735, bench 0.1)
points: lineup(both boards, 12 bats) 1005 · rotation 464 · bullpen 544 · bench-only 121
```
