# PTMS 3: all six rosters, 2026-11-20 (Claude)

**Built on collection 420** (uploaded 11-20: Alcantara, Story and 13 more in; Matsui LE out). PTMS 3 is 11-21, every series best of 9.

| Event | Saved roster | Fresh build | Verdict |
|---|---|---|---|
| T1 Open | 2200 (797.0) | 16 starts from 2200: **same 26, same lineups**, 797.0 | Keep 2200 |
| T2 Iron | 2240 (−35.0) | 16 starts: −33.6 (**+1.4**). Espinosa 2B for Lajoie 50, Jason Schmidt (PIT) SP5 for Scantlebury | Noise; saved on L.J.'s word as roster 2259 (replaces 2240) |
| T3 Slots | 2258 (503.8, Alcantara) | 16 starts from 2258: **same 26**, 503.8 | Keep 2258 |
| PD 1 Low of Lows | 2233 | exact solve of the drafted 26: same lineups, −0.2 | Keep 2233 |
| PD 2 Double 101+ | 2252 | exact solve: same lineups (it now agrees with L.J.'s hand-set board); only RP5/RP6 swap order | Keep 2252 |
| PD 3 Perfectly Bronze | 2255 | exact solve: same lineups, 262.5 | Keep 2255 |

- Tournament builds: `current-rosters --only 9130001,9130002,9130003 --all --tag 2026-11-20-ptms` (manifest `Inbox/rosters/current-2026-11-20-ptms.tsv`). Draft solves: env-roster `--pool-ids` with the saved 26/21, 16 starts, L.J.'s floors; logs in the session scratchpad.
- **No PTMS 3 exports exist**, so there is no top-team list for this field. Shape and handedness fall back to the era table, and observed play is pooled across all events.

## Sliders (team strategy) by event

| Event | Environment | R/G | Preset | Sac bunt (1st & 2nd, 0 out) | Steal break-even (0 / 1 out) | Who to run |
|---|---|---|---|---|---|---|
| T1 Open | 1988 RE, 1996 Dodger Stadium, DH | 3.68 | **Small Ball** | +0.091 runs | 76.9% / 73.3% | Granderson (STL 124, SPD 121), Elly (114/117), Bo (108/119), Utley (126/84) |
| T2 Iron | 1998 RE, 1999 Jacobs Field, DH | 5.17 | **Sabermetric** | −0.053 (don't) | 81.9% / 78.9% | Hold; Sosa (98/102), Thompson (97/107) only on sure things |
| T3 Slots | 2019 RE, 1995 Coors Field, DH | 5.97 | **Sabermetric** | −0.147 (never) | 83.9% / 80.8% | Hold; Beltran (125/109), Granderson (124/121) at most |
| PD 1 | 1986 RE, 1985 Veterans Stadium, DH | 4.59 | **Balanced** | +0.008 (neutral) | 80.2% / 77.1% | Bell (117/119), Frisch (108/108), Brock (102/118) |
| PD 2 | 2015 RE, 2015 Angel Stadium, DH | 4.03 | **Balanced** (K 20.4% caps it) | +0.011 (neutral) | 79.5% / 76.3% | Pierre (119/124), Utley (126/84), Moniak (106/106), Furcal (117/108) |
| PD 3 | 1939 RE, 1940 Braves Field, **no DH** | 4.56 | **Moderate Small Ball** | +0.079 runs | 78.6% / 75.3% | Castillo (108/94), Hamilton (117/92) |

- Preset, bunt value and break-even are env-roster's run-expectancy read of each environment and park.
- **Who to run is judgement, not a measurement:** the model has no steal-success curve (Stealing and Baserunning added nothing over Speed in the 3,580-series calibration). The names are the starters whose Stealing and Speed are high enough to beat these break-evens.

## PTMS 3 Tournament 1 - Open (9130001)

**Keep saved 2200.** The 16-start search from it found the same 26 and the same boards (797.0).
- Rotation Brown, Yamamoto, Bumgarner, Mathewson, Cy Young (VAR); Hader closes; Willie Hernandez and Ben Sheets are the long men.
- Wilkins catches vs RHP (glove +5.9), Piazza (VAR) vs LHP. Hornsby (+31.8, covers 2B/3B/SS) is a real bat on the bench. Edgar DHs vs LHP, Reggie vs RHP.
- Kemp (+7.9 here) was the one buy that moved it; not bought.

1988 environment · 1996 Dodger Stadium · roster ptms3-9130001-claude-2026-11-20-ptms.txt

| Val | Card | Hand | Roles | Projected | Observed (all events: no exports of this series on file) |
|---|---|---|---|---|---|
| 104 | Josh Hader | L | CL | +30.7 runs, opp .198/.264/.284 | 1752 IP, FIP 3.68, 3.4 WAR/200 |
| 104 | Yoshinobu Yamamoto | R | SP2 | +32.0 runs, opp .209/.251/.302 | 6624 IP, FIP 3.90, 3.8 WAR/200 |
| 103 | George Brett | L | 1B vs RHP | vR +54.3 (glove +1.8) | vR .299/.403/.535 · vL .286/.375/.458 | 85239 PA, wOBA .351, 3.6 WAR/600 |
| 103 | Mordecai Brown | R | SP1 | +32.2 runs, opp .215/.256/.302 | 4820 IP, FIP 3.66, 4.2 WAR/200 |
| 103 | Madison Bumgarner | L | SP3 | +31.2 runs, opp .214/.257/.304 | 15538 IP, FIP 3.71, 4.5 WAR/200 |
| 103 | Elly De La Cruz | S | SS vs LHP; bench vs the other hand | vL +44.8 (glove +2.3) | vR .273/.355/.415 · vL .290/.362/.466 | 7335 PA, wOBA .327, 4.7 WAR/600 |
| 103 | Ed Delahanty | R | LF | vR +46.9 (glove +5.0) · vL +44.4 (glove +5.0) | vR .299/.369/.540 · vL .300/.364/.519 | 4825 PA, wOBA .345, 3.6 WAR/600 |
| 103 | Christy Mathewson | R | SP4 | +30.9 runs, opp .213/.258/.303 | 5095 IP, FIP 3.89, 3.6 WAR/200 |
| 103 | Andrew Miller | L | RP1 | +25.4 runs, opp .210/.256/.298 | 583 IP, FIP 3.10, 5.3 WAR/200 |
| 103 | Corey Seager | L | SS vs RHP | vR +42.0 (glove +3.5) | vR .289/.377/.529 · vL .278/.356/.459 | 23251 PA, wOBA .335, 3.4 WAR/600 |
| 103 | Ben Sheets | R | RP5 | +27.6 runs, opp .216/.258/.306 | 286 IP, FIP 3.98, 3.5 WAR/200 |
| 102 | Zack Britton | L | RP4 | +22.5 runs, opp .211/.268/.297 | 2280 IP, FIP 3.91, 2.9 WAR/200 |
| 102 | Wade Davis | R | RP3 | +22.9 runs, opp .206/.270/.293 | 818 IP, FIP 4.18, 2.4 WAR/200 |
| 102 | Willie Hernandez | L | RP2 | +29.2 runs, opp .212/.257/.300 | 8718 IP, FIP 3.70, 4.0 WAR/200 |
| 102 | Reggie Jackson | L | DH vs RHP | vR +57.8 | vR .300/.398/.598 · vL .285/.371/.540 | 6675 PA, wOBA .322, 1.5 WAR/600 |
| 102 | Andruw Jones | R | CF | vR +46.8 (glove +4.2) · vL +52.9 (glove +4.2) | vR .293/.377/.539 · vL .294/.382/.565 | 49551 PA, wOBA .344, 4.5 WAR/600 |
| 102 | Albert Pujols | R | 1B vs LHP; bench vs the other hand | vL +55.9 (glove +2.2) | vR .295/.386/.531 · vL .305/.391/.593 | 42875 PA, wOBA .351, 3.1 WAR/600 |
| 102 | Alex Rodriguez | R | 3B | vR +68.7 (glove +6.4) · vL +31.8 (glove +6.4) | vR .320/.401/.695 · vL .269/.381/.466 | 9426 PA, wOBA .332, 4.4 WAR/600 |
| 102 | Chase Utley | L | 2B | vR +34.2 (glove +6.5) · vL +44.6 (glove +6.5) | vR .281/.381/.455 · vL .289/.391/.497 | 49061 PA, wOBA .328, 4.3 WAR/600 |
| 102 | Cy Young (VAR) | R | SP5 | +28.1 runs, opp .220/.264/.313 | 3182 IP, FIP 3.77, 3.8 WAR/200 |
| 101 | Rogers Hornsby | R | bench | +31.8 | vR .274/.343/.458 · vL .276/.350/.390 | 32687 PA, wOBA .306, 2.8 WAR/600 |
| 101 | Mike Piazza (VAR) | R | C vs LHP; bench vs the other hand | vL +40.0 (glove -1.5) | vR .282/.359/.466 · vL .295/.351/.536 | 1575 PA, wOBA .343, 2.7 WAR/600 |
| 100 | Edgar Martinez | R | DH vs LHP; bench vs the other hand | vL +58.0 | vR .298/.400/.497 · vL .312/.421/.504 | — |
| 97 | Curtis Granderson | L | RF vs RHP | vR +42.8 (glove +6.0) | vR .286/.364/.475 · vL .220/.290/.309 | 22758 PA, wOBA .346, 4.2 WAR/600 |
| 92 | Rick Wilkins | L | C vs RHP | vR +25.3 (glove +5.9) | vR .265/.341/.483 · vL .220/.302/.332 | 3852 PA, wOBA .326, 2.8 WAR/600 |
| 88 | Bo Jackson | R | RF vs LHP; bench vs the other hand | vL +33.3 (glove +3.4) | vR .267/.321/.511 · vL .259/.347/.455 | 233866 PA, wOBA .326, 2.8 WAR/600 |

Total value 2632. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** George Brett 1B · Reggie Jackson DH · Alex Rodriguez 3B · Andruw Jones CF · Corey Seager SS · Ed Delahanty LF · Rick Wilkins C · Curtis Granderson RF · Chase Utley 2B

**vs LHP:** Edgar Martinez DH · Chase Utley 2B · Andruw Jones CF · Albert Pujols 1B · Ed Delahanty LF · Mike Piazza (VAR) C · Bo Jackson RF · Alex Rodriguez 3B · Elly De La Cruz SS

```
--- staff ---
SP1     Mordecai Brown             103  S  1909   +32.2   SP
SP2     Yoshinobu Yamamoto         104  R  2026   +32.0   SP
SP3     Madison Bumgarner          103  R  2014   +31.2   SP
SP4     Christy Mathewson          103  R  1905   +30.9   SP
SP5     Cy Young (VAR)             102  R  1895   +28.1   SP
CL      Josh Hader                 104  L  2026   +30.7   CL
RP1     Andrew Miller              103  L  2014   +25.4   RP
RP2     Willie Hernandez           102  L  1984   +29.2   CL
RP3     Wade Davis                 102  R  2015   +22.9   CL
RP4     Zack Britton               102  L  2016   +22.5   CL
RP5     Ben Sheets                 103  R  2004   +27.6   SP

--- roster check ---
  ✓ staff 5 SP / 6 RP / 15 bats (caps: 5 SP, 7 RP, 12 arms)
  ✓ starters' stamina Mordecai Brown 104, Yoshinobu Yamamoto 91, Madison Bumgarner 110, Christy Mathewson 111, Cy Young 114 (era floor 50)
  ✓ stamina guys in the pen (45+): Willie Hernandez 67, Ben Sheets 88
  ✓ C  backup: vs RHP Mike Piazza 69 · vs LHP Rick Wilkins 121
  ✓ 1B backup: vs RHP Albert Pujols 91 · vs LHP George Brett 88
  ✓ 2B backup: Rogers Hornsby 126
  ✓ 3B backup: vs RHP Rogers Hornsby 108 · vs LHP George Brett 88, Rogers Hornsby 108
  ✓ SS backup: vs RHP Elly De La Cruz 115, Rogers Hornsby 108 · vs LHP Corey Seager 119, Rogers Hornsby 108
  ✓ LF backup: vs RHP Bo Jackson 116, Rogers Hornsby 76 · vs LHP Curtis Granderson 147, Rogers Hornsby 76
  ✓ CF backup: vs RHP Bo Jackson 103 · vs LHP Curtis Granderson 133
  ✓ RF backup: vs RHP Bo Jackson 123 · vs LHP Curtis Granderson 142
```

## PTMS 3 Tournament 2 - Iron (9130002)

**Fresh build −33.6 against −35.0 for saved 2240: +1.4, noise.** It uses two cards owned since 418: Danny Espinosa at 2B (for Nap Lajoie 50) and Jason Schmidt (PIT 1999) as SP5 (for Scantlebury). Load file `Inbox/rosters/ptms3-9130002-claude-2026-11-20-ptms.txt`; **saved as roster 2259**, replacing 2240.
- 8 variants (cap 10). Roster check passes in full.
- Cal Raleigh (base) catches at −10.7 / −15.6. His variant (+6.4 here, ~128K) is the one PP buy that moves this roster.

1998 environment · 1999 Jacobs Field · roster ptms3-9130002-claude-2026-11-20-ptms.txt

| Val | Card | Hand | Roles | Projected | Observed (all events: no exports of this series on file) |
|---|---|---|---|---|---|
| 59 | John Bale (VAR) | L | CL | +4.7 runs, opp .272/.352/.399 | 407 IP, FIP 3.31, 4.7 WAR/200 |
| 59 | Hector Carrasco (VAR) | R | RP5 | -8.6 runs, opp .285/.363/.435 | 3131 IP, FIP 4.44, 1.5 WAR/200 |
| 59 | Shawn Green | L | 1B | vR +0.2 (glove +2.8) · vL -15.6 (glove +2.8) | vR .260/.339/.452 · vL .233/.306/.368 | 23112 PA, wOBA .329, 2.3 WAR/600 |
| 59 | Bill Hall | R | 3B vs RHP; DH vs LHP | vR -6.4 (glove -3.1) · vL +6.4 | vR .239/.304/.390 · vL .251/.355/.420 | 35167 PA, wOBA .332, 3.4 WAR/600 |
| 59 | Big Jeff Pfeffer | R | SP2 | +0.8 runs, opp .269/.354/.425 | 4631 IP, FIP 3.57, 4.7 WAR/200 |
| 59 | Chris Taylor | R | LF vs RHP; 3B vs LHP | vR -5.1 (glove +1.8) · vL -4.5 (glove +1.1) | vR .251/.325/.379 · vL .245/.346/.369 | 22162 PA, wOBA .299, 2.8 WAR/600 |
| 58 | Milt Thompson | L | CF vs RHP | vR -9.5 (glove +0.1) | vR .276/.347/.358 · vL .244/.280/.323 | 49469 PA, wOBA .296, 2.5 WAR/600 |
| 57 | Andruw Jones (VAR) | R | LF vs LHP; bench vs the other hand | vL -1.5 (glove +0.9) | vR .205/.312/.332 · vL .243/.334/.398 | 12899 PA, wOBA .340, 2.8 WAR/600 |
| 57 | Mike Marshall | R | RP3 | -0.4 runs, opp .276/.368/.420 | 25187 IP, FIP 4.39, 1.8 WAR/200 |
| 57 | Rick Wilkins (VAR) | L | bench | -8.7 | vR .245/.341/.370 · vL .221/.256/.334 | 9726 PA, wOBA .317, 2.8 WAR/600 |
| 55 | Ken Berry | R | CF vs LHP; bench vs the other hand | vL -5.7 (glove +0.2) | vR .260/.315/.355 · vL .268/.339/.400 | 69251 PA, wOBA .293, 1.4 WAR/600 |
| 55 | Roger Bresnahan | R | RF vs RHP | vR +2.9 (glove -1.8) | vR .260/.332/.453 · vL .258/.342/.329 | 3197 PA, wOBA .307, 1.8 WAR/600 |
| 55 | Carter Capps | R | RP4 | -7.3 runs, opp .278/.339/.434 | — |
| 55 | James McDonald (VAR) | R | SP1 | +3.5 runs, opp .270/.352/.404 | 31021 IP, FIP 3.91, 4.4 WAR/200 |
| 55 | Jose Vizcaino | S | bench | -19.9 | vR .257/.306/.354 · vL .229/.310/.276 | 6417 PA, wOBA .265, 1.1 WAR/600 |
| 54 | Danny Espinosa | S | 2B | vR -11.4 (glove +3.4) · vL -6.1 (glove +3.4) | vR .235/.308/.361 · vL .258/.330/.380 | — |
| 54 | Jason Schmidt | R | SP5 | -5.9 runs, opp .284/.356/.447 | — |
| 54 | Ty Wigginton (VAR) | R | DH vs RHP | vR +2.5 | vR .267/.326/.473 · vL .248/.332/.357 | 20489 PA, wOBA .337, 1.1 WAR/600 |
| 53 | Cal Raleigh | S | C | vR -10.7 (glove +2.9) · vL -15.6 (glove +2.9) | vR .216/.291/.427 · vL .212/.314/.356 | — |
| 50 | Tyler Chatwood | R | RP6 | -4.6 runs, opp .289/.361/.432 | — |
| 49 | Javier Baez (VAR) | R | SS | vR -1.6 (glove -4.9) · vL -5.0 (glove -4.9) | vR .251/.296/.405 · vL .232/.324/.350 | 24891 PA, wOBA .319, 3.2 WAR/600 |
| 48 | Dallas Keuchel | L | SP3 | +0.0 runs, opp .296/.350/.450 | 132 IP, FIP 3.87, 3.8 WAR/200 |
| 46 | Charlie Morton | R | SP4 | -3.1 runs, opp .282/.370/.417 | — |
| 45 | Randy Choate | L | RP1 | -3.1 runs, opp .281/.354/.417 | 8346 IP, FIP 4.15, 2.7 WAR/200 |
| 44 | Joe Thatcher | L | RP2 | -6.9 runs, opp .272/.368/.409 | — |
| 43 | Sammy Sosa (VAR) | R | RF vs LHP; bench vs the other hand | vL +2.0 (glove +1.4) | vR .212/.249/.298 · vL .245/.306/.424 | 13326 PA, wOBA .326, 2.8 WAR/600 |

Total value 1398. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** Milt Thompson CF · Shawn Green 1B · Roger Bresnahan RF · Ty Wigginton (VAR) DH · Chris Taylor LF · Javier Baez (VAR) SS · Cal Raleigh C · Bill Hall 3B · Danny Espinosa 2B

**vs LHP:** Bill Hall DH · Chris Taylor 3B · Andruw Jones (VAR) LF · Sammy Sosa (VAR) RF · Ken Berry CF · Danny Espinosa 2B · Shawn Green 1B · Javier Baez (VAR) SS · Cal Raleigh C

```
--- staff ---
SP1     James McDonald (VAR)        55  L  2010    +3.5   SP
SP2     Big Jeff Pfeffer            59  R  1906    +0.8   SP
SP3     Dallas Keuchel              48  L  2018    +0.0   SP
SP4     Charlie Morton              46  R  2011    -3.1   SP
SP5     Jason Schmidt               54  R  1999    -5.9   SP
CL      John Bale (VAR)             59  L  2007    +4.7   RP
RP1     Randy Choate                45  L  2013    -3.1   RP
RP2     Joe Thatcher                44  L  2009    -6.9   RP
RP3     Mike Marshall               57  R  1973    -0.4   CL
RP4     Carter Capps                55  R  2014    -7.3   RP
RP5     Hector Carrasco (VAR)       59  R  1999    -8.6   RP
RP6     Tyler Chatwood              50  R  2013    -4.6   SP

--- roster check ---
  ✓ staff 5 SP / 7 RP / 14 bats (caps: 5 SP, 7 RP, 12 arms)
  ✓ starters' stamina James McDonald 59, Big Jeff Pfeffer 98, Dallas Keuchel 92, Charlie Morton 59, Jason Schmidt 82 (era floor 50)
  ✓ stamina guys in the pen (45+): Mike Marshall 74, Tyler Chatwood 58
  ✓ C  backup: vs RHP Rick Wilkins 62 · vs LHP Roger Bresnahan 60, Rick Wilkins 62
  ✓ 1B backup: vs RHP Ty Wigginton 75 · vs LHP Roger Bresnahan 61, Ty Wigginton 75
  ✓ 2B backup: vs RHP Jose Vizcaino 122 · vs LHP Bill Hall 91, Jose Vizcaino 122
  ✓ 3B backup: vs RHP Jose Vizcaino 104 · vs LHP Bill Hall 74, Jose Vizcaino 104
  ✓ SS backup: Jose Vizcaino 105
  ✓ LF backup: vs RHP Ty Wigginton 65, Ken Berry 131, Sammy Sosa 105, Andruw Jones 103 · vs LHP Milt Thompson 121, Bill Hall 67, Ty Wigginton 65
  ✓ CF backup: vs RHP Ken Berry 115 · vs LHP Milt Thompson 114
  ✓ RF backup: vs RHP Ken Berry 126, Sammy Sosa 109, Andruw Jones 87 · vs LHP Milt Thompson 111, Roger Bresnahan 84
```

## PTMS 3 Tournament 3 - Slots (9130003)

**Keep saved 2258** (Alcantara in for Babe Ruth, saved this afternoon). The 16-start search from it found nothing better (503.8).
- Faucher closes on leverage; Liriano, Escobar and deGrom are the stamina arms in the pen.
- Halladay (+8.2) is the only buy that would move it; no sellers.

2019 environment · 1995 Coors Field · roster ptms3-9130003-claude-2026-11-20-ptms.txt

| Val | Card | Hand | Roles | Projected | Observed (all events: no exports of this series on file) |
|---|---|---|---|---|---|
| 99 | Sandy Alcantara | R | SP1 | +23.6 runs, opp .266/.319/.421 | — |
| 99 | Carlos Beltran | S | DH vs RHP; CF vs LHP | vR +38.9 · vL +33.4 (glove -0.8) | vR .334/.434/.771 · vL .348/.425/.685 | 71730 PA, wOBA .338, 3.2 WAR/600 |
| 98 | Joe Gordon | R | 2B | vR +22.4 (glove +7.3) · vL +45.1 (glove +7.3) | vR .314/.396/.679 · vL .368/.454/.836 | 3201 PA, wOBA .346, 3.8 WAR/600 |
| 98 | Jerry Koosman | L | SP2 | +21.0 runs, opp .266/.319/.425 | 662 IP, FIP 4.38, 3.3 WAR/200 |
| 97 | Curtis Granderson | L | LF vs RHP | vR +38.1 (glove +8.2) | vR .341/.420/.686 · vL .232/.309/.378 | 22758 PA, wOBA .346, 4.2 WAR/600 |
| 97 | Thurman Munson | R | C | vR +10.8 (glove +13.3) · vL +25.0 (glove +13.3) | vR .316/.371/.555 · vL .342/.402/.647 | 14347 PA, wOBA .295, 1.8 WAR/600 |
| 97 | Ed Reulbach | R | SP3 | +20.1 runs, opp .258/.322/.414 | 2624 IP, FIP 4.17, 3.4 WAR/200 |
| 96 | Don Larsen | R | SP4 | +19.3 runs, opp .264/.321/.427 | 5017 IP, FIP 4.40, 3.3 WAR/200 |
| 88 | Bo Jackson | R | RF vs RHP; LF vs LHP | vR +38.5 (glove +4.3) · vL +32.7 (glove +3.3) | vR .322/.378/.771 · vL .305/.396/.658 | 233866 PA, wOBA .326, 2.8 WAR/600 |
| 88 | Trevor Story | R | SS | vR +23.1 (glove +6.3) · vL +21.2 (glove +6.3) | vR .297/.384/.544 · vL .299/.375/.521 | — |
| 87 | Mookie Betts | R | CF vs RHP; RF vs LHP | vR +23.9 (glove +5.9) · vL +20.8 (glove +10.3) | vR .347/.403/.630 · vL .339/.389/.675 | 18163 PA, wOBA .300, 2.6 WAR/600 |
| 85 | Calvin Faucher | R | CL | +9.7 runs, opp .269/.363/.405 | 1493 IP, FIP 4.09, 1.7 WAR/200 |
| 82 | Cherokee Fisher | R | SP5 | +15.9 runs, opp .244/.346/.386 | 1353 IP, FIP 4.50, 2.7 WAR/200 |
| 81 | Pedro Alvarez | L | 1B vs RHP | vR +30.5 (glove +3.9) | vR .314/.390/.811 · vL .209/.304/.310 | 17486 PA, wOBA .331, 2.4 WAR/600 |
| 79 | Jacob deGrom | R | RP4 | +10.4 runs, opp .267/.348/.419 | 35356 IP, FIP 4.02, 3.6 WAR/200 |
| 78 | Kelvim Escobar | R | RP2 | +12.2 runs, opp .273/.338/.430 | 19318 IP, FIP 3.84, 4.3 WAR/200 |
| 77 | Mike Matthews | L | RP3 | +4.0 runs, opp .253/.363/.401 | 699 IP, FIP 4.80, 0.2 WAR/200 |
| 75 | Francisco Liriano | L | RP1 | +14.4 runs, opp .276/.338/.427 | — |
| 74 | Ryan Braun | R | DH vs LHP; bench vs the other hand | vL +47.0 | vR .270/.321/.518 · vL .349/.435/.778 | 12090 PA, wOBA .342, 2.3 WAR/600 |
| 74 | Josh Harrison | R | 3B vs RHP | vR +14.4 (glove +3.6) | vR .332/.370/.534 · vL .351/.393/.515 | — |
| 67 | Eric Byrnes | R | bench | +7.4 | vR .303/.367/.467 · vL .294/.375/.535 | 26578 PA, wOBA .319, 2.6 WAR/600 |
| 67 | Edwin Diaz | R | RP5 | +1.5 runs, opp .275/.350/.430 | 14394 IP, FIP 3.94, 3.6 WAR/200 |
| 66 | Chris Sabo | R | 3B vs LHP; bench vs the other hand | vL +37.3 (glove -3.6) | vR .285/.353/.573 · vL .373/.445/.773 | 59619 PA, wOBA .345, 2.8 WAR/600 |
| 64 | Ernie Clement | R | 1B vs LHP; bench vs the other hand | vL +18.6 (glove +3.9) | vR .336/.371/.471 · vL .361/.392/.552 | 23777 PA, wOBA .319, 2.9 WAR/600 |
| 59 | John Bale | L | RP6 | +2.6 runs, opp .282/.363/.435 | 4683 IP, FIP 3.62, 4.2 WAR/200 |
| 55 | Roger Bresnahan | R | bench | +2.1 | vR .277/.346/.520 · vL .273/.353/.348 | 3197 PA, wOBA .307, 1.8 WAR/600 |

Total value 2127. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** Carlos Beltran DH · Joe Gordon 2B · Bo Jackson RF · Pedro Alvarez 1B · Curtis Granderson LF · Mookie Betts CF · Thurman Munson C · Josh Harrison 3B · Trevor Story SS

**vs LHP:** Chris Sabo 3B · Carlos Beltran CF · Joe Gordon 2B · Ryan Braun DH · Bo Jackson LF · Thurman Munson C · Mookie Betts RF · Ernie Clement 1B · Trevor Story SS

```
--- staff ---
SP1     Sandy Alcantara             99  R  2022   +23.6   SP
SP2     Jerry Koosman               98  R  1969   +21.0   SP
SP3     Ed Reulbach                 97  R  1905   +20.1   SP
SP4     Don Larsen                  96  R  1956   +19.3   SP
SP5     Cherokee Fisher             82  R  1872   +15.9   SP
CL      Calvin Faucher              85  R  2026    +9.7   RP
RP1     Francisco Liriano           75  L  2010   +14.4   SP
RP2     Kelvim Escobar              78  S  2007   +12.2   SP
RP3     Mike Matthews               77  L  2001    +4.0   RP
RP4     Jacob deGrom                79  L  2014   +10.4   SP
RP5     Edwin Diaz                  67  R  2016    +1.5   CL
RP6     John Bale                   59  L  2007    +2.6   RP

--- roster check ---
  ✓ staff 5 SP / 7 RP / 14 bats (caps: 5 SP, 7 RP, 12 arms)
  ✓ starters' stamina Sandy Alcantara 109, Jerry Koosman 96, Ed Reulbach 92, Don Larsen 100, Cherokee Fisher 79 (era floor 50)
  ✓ stamina guys in the pen (45+): Francisco Liriano 77, Kelvim Escobar 76, Jacob deGrom 73
  ✓ C  backup: Roger Bresnahan 60
  ✓ 1B backup: vs RHP Ernie Clement 96, Roger Bresnahan 61 · vs LHP Pedro Alvarez 96, Roger Bresnahan 61
  ✓ 2B backup: vs RHP Ernie Clement 130 · vs LHP Josh Harrison 108
  ✓ 3B backup: vs RHP Chris Sabo 77, Ernie Clement 104 · vs LHP Josh Harrison 105, Pedro Alvarez 75
  ✓ SS backup: vs RHP Ernie Clement 109 · vs LHP Josh Harrison 96
  ✓ LF backup: vs RHP Eric Byrnes 134 · vs LHP Josh Harrison 75, Curtis Granderson 147, Eric Byrnes 134
  ✓ CF backup: vs RHP Carlos Beltran 108, Eric Byrnes 122 · vs LHP Curtis Granderson 133, Eric Byrnes 122
  ✓ RF backup: vs RHP Eric Byrnes 133, Roger Bresnahan 84 · vs LHP Josh Harrison 63, Curtis Granderson 142, Eric Byrnes 133, Roger Bresnahan 84
```

## PTMS 3 PD 1 - Low of Lows (9130004)

**Keep saved 2233**: the exact solve gives the same boards (−0.2; it read −0.0 on 11-18, the difference is observed play since).
- Missing backups the drafted 26 can't fix: 2B both ways, CF vs RHP.

1986 environment · 1985 Veterans Stadium · roster ptms3pd1-lj-draft-2026-11-18.txt

| Val | Card | Hand | Roles | Projected | Observed (all events: no exports of this series on file) |
|---|---|---|---|---|---|
| 100 | Cool Papa Bell | S | LF vs RHP; CF vs LHP | vR +12.0 (glove +4.6) · vL +16.3 (glove +1.1) | vR .279/.343/.432 · vL .288/.353/.446 | 24496 PA, wOBA .299, 3.2 WAR/600 |
| 100 | Roy Campanella | R | C | vR -2.7 (glove +2.7) · vL +6.3 (glove +2.7) | vR .270/.325/.443 · vL .284/.340/.478 | 12203 PA, wOBA .285, 0.7 WAR/600 |
| 94 | Frankie Frisch | S | 2B | vR +1.9 (glove +6.3) · vL +5.3 (glove +6.3) | vR .285/.321/.430 · vL .291/.346/.422 | 90361 PA, wOBA .321, 3.3 WAR/600 |
| 92 | Joe Rudi | R | DH | vR +12.0 · vL +26.6 | vR .275/.320/.487 · vL .298/.354/.608 | — |
| 90 | Brian Downing | R | LF vs LHP; bench vs the other hand | vL +8.6 (glove -0.9) | vR .269/.366/.476 · vL .287/.384/.458 | 12470 PA, wOBA .321, 0.4 WAR/600 |
| 90 | Webster McDonald | R | SP1 | +13.3 runs, opp .251/.299/.389 | 8137 IP, FIP 4.28, 3.1 WAR/200 |
| 83 | Kevin Bass | S | RF | vR -0.2 (glove +4.6) · vL +5.4 (glove +4.6) | vR .278/.324/.414 · vL .290/.308/.463 | 6796 PA, wOBA .298, 1.6 WAR/600 |
| 83 | Solly Hemus | L | SS | vR -10.1 (glove -3.8) · vL -9.3 (glove -3.8) | vR .250/.344/.369 · vL .248/.344/.373 | 12864 PA, wOBA .292, 1.9 WAR/600 |
| 83 | Ben Taylor | L | 1B | vR +1.6 (glove +0.8) · vL -0.4 (glove +0.8) | vR .285/.345/.407 · vL .281/.340/.397 | 2233 PA, wOBA .308, 0.9 WAR/600 |
| 82 | Boom-Boom Beck | R | RP1 | -6.7 runs, opp .272/.342/.411 | 1057 IP, FIP 4.84, 2.2 WAR/200 |
| 82 | Jerry Koosman | L | SP2 | +6.1 runs, opp .263/.319/.391 | 2904 IP, FIP 4.07, 3.5 WAR/200 |
| 80 | Lou Brock | L | CF vs RHP | vR +10.1 (glove -0.6) | vR .271/.323/.402 · vL .248/.286/.348 | 7596 PA, wOBA .309, 2.1 WAR/600 |
| 74 | Johnny Kling | R | bench | -26.9 | vR .243/.281/.368 · vL .256/.293/.419 | 3031 PA, wOBA .278, 1.8 WAR/600 |
| 74 | Dave Tomlin | L | CL | -9.1 runs, opp .275/.346/.404 | 1322 IP, FIP 4.16, 1.9 WAR/200 |
| 73 | Brent Strom | L | SP3 | +5.4 runs, opp .259/.322/.391 | 15168 IP, FIP 4.07, 3.4 WAR/200 |
| 72 | Billy Johnson | R | bench | +4.2 | vR .234/.292/.340 · vL .239/.304/.354 | 223 PA, wOBA .268, 0.3 WAR/600 |
| 72 | Brooks Robinson | R | 3B | vR -2.7 (glove +6.8) · vL +1.8 (glove +6.8) | vR .274/.325/.434 · vL .287/.344/.424 | 10831 PA, wOBA .302, 3.4 WAR/600 |
| 70 | Juan Beniquez | R | bench | -29.0 | vR .240/.301/.301 · vL .265/.328/.343 | 1297 PA, wOBA .246, -1.7 WAR/600 |
| 64 | Jonas Gaines | L | SP4 | -6.3 runs, opp .264/.330/.427 | 1428 IP, FIP 4.54, 2.1 WAR/200 |
| 63 | Al Fitzmorris | R | SP5 | -18.2 runs, opp .290/.358/.448 | 542 IP, FIP 4.54, 1.8 WAR/200 |
| 63 | Cal McLish | R | RP4 | -18.9 runs, opp .272/.361/.437 | 250 IP, FIP 4.96, 0.0 WAR/200 |
| 61 | Max Flack | L | bench | -19.5 | vR .273/.326/.440 · vL .244/.305/.346 | 695 PA, wOBA .292, -0.7 WAR/600 |
| 60 | Neil Allen | R | RP2 | -17.2 runs, opp .273/.359/.416 | 533 IP, FIP 4.77, 0.6 WAR/200 |
| 60 | Mike Armstrong | R | RP3 | -17.4 runs, opp .260/.351/.428 | 836 IP, FIP 5.09, -0.7 WAR/200 |
| 48 | Charlie Gelbert | R | bench | -43.5 | vR .227/.264/.280 · vL .237/.263/.292 | 199 PA, wOBA .244, -0.9 WAR/600 |
| 43 | Ron Robinson | R | RP5 | -28.1 runs, opp .274/.366/.448 | 597 IP, FIP 5.30, -0.8 WAR/200 |

Total value 1956. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** Solly Hemus SS · Cool Papa Bell LF · Roy Campanella C · Joe Rudi DH · Ben Taylor 1B · Brooks Robinson 3B · Frankie Frisch 2B · Kevin Bass RF · Lou Brock CF

**vs LHP:** Brian Downing LF · Cool Papa Bell CF · Joe Rudi DH · Roy Campanella C · Frankie Frisch 2B · Brooks Robinson 3B · Kevin Bass RF · Ben Taylor 1B · Solly Hemus SS

```
--- staff ---
SP1     Webster McDonald            90  L  1927   +13.3   SP
SP2     Jerry Koosman               82  R  1979    +6.1   SP
SP3     Brent Strom                 73  R  1975    +5.4   SP
SP4     Jonas Gaines                64  R  1946    -6.3   SP
SP5     Al Fitzmorris               63  S  1976   -18.2   SP
CL      Dave Tomlin                 74  L  1977    -9.1   RP
RP1     Boom-Boom Beck              82  R  1945    -6.7   RP
RP2     Neil Allen                  60  R  1979   -17.2   RP
RP3     Mike Armstrong              60  R  1982   -17.4   RP
RP4     Cal McLish                  63  S  1957   -18.9   RP
RP5     Ron Robinson                43  R  1986   -28.1   RP

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
```

## PTMS 3 PD 2 - Double 101+ (9130005)

**Keep saved 2252.** The exact solve now matches L.J.'s hand-set boards (on 11-19 it had Moniak at 1B); only Hicks and Viola swap RP5/RP6.
- Joe Mack is the only catcher: bat −20.8 / −27.0, glove +9.4.
- Missing: a second stamina arm in the pen (Viola only), 1B and 3B backups, CF backup vs RHP.

2015 environment · 2015 Angel Stadium of Anaheim · roster ptms3pd2-lj-draft-2026-11-19.txt

| Val | Card | Hand | Roles | Projected | Observed (all events: no exports of this series on file) |
|---|---|---|---|---|---|
| 103 | Josh Hamilton | L | RF | vR +76.3 (glove +7.2) · vL +21.2 (glove +7.2) | vR .367/.429/.785 · vL .286/.352/.469 | — |
| 102 | Chase Utley | L | 2B | vR +38.2 (glove +9.1) · vL +47.7 (glove +9.1) | vR .308/.401/.561 · vL .319/.414/.622 | 49061 PA, wOBA .328, 4.3 WAR/600 |
| 100 | Hideki Matsui | L | DH | vR +34.0 · vL +55.5 | vR .318/.405/.564 · vL .344/.420/.745 | 5165 PA, wOBA .336, 1.2 WAR/600 |
| 100 | Mickey Moniak | L | LF vs RHP; CF vs LHP | vR +24.5 (glove +6.2) · vL +7.5 (glove +1.0) | vR .296/.363/.491 · vL .272/.336/.412 | 8720 PA, wOBA .320, 2.6 WAR/600 |
| 94 | Evan Longoria | R | 3B | vR -5.6 (glove +9.0) · vL -2.7 (glove +9.0) | vR .229/.299/.396 · vL .233/.305/.407 | 10309 PA, wOBA .294, 1.3 WAR/600 |
| 94 | Arjun Nimmala | R | 1B | vR +8.6 (glove +4.7) · vL +12.4 (glove +4.7) | vR .251/.317/.442 · vL .256/.326/.458 | 53287 PA, wOBA .311, 2.5 WAR/600 |
| 94 | Javier Vazquez | R | SP1 | +11.5 runs, opp .233/.279/.371 | 1903 IP, FIP 4.57, 2.9 WAR/200 |
| 90 | Brian Downing | R | LF vs LHP; bench vs the other hand | vL +8.8 (glove -1.3) | vR .256/.345/.480 · vL .274/.363/.458 | 12470 PA, wOBA .321, 0.4 WAR/600 |
| 88 | Tom Niedenfuer | R | CL | -2.7 runs, opp .227/.296/.381 | 4045 IP, FIP 4.61, 0.3 WAR/200 |
| 88 | Hagen Smith | L | SP3 | +6.8 runs, opp .217/.312/.336 | 21508 IP, FIP 4.34, 2.4 WAR/200 |
| 83 | Randy Jones | L | SP4 | -0.2 runs, opp .263/.307/.426 | 22069 IP, FIP 4.63, 2.0 WAR/200 |
| 82 | Juan Pierre | L | CF vs RHP | vR +4.9 (glove +3.4) | vR .290/.365/.384 · vL .295/.342/.371 | 4596 PA, wOBA .308, 3.1 WAR/600 |
| 79 | Jacob deGrom | R | SP2 | +7.4 runs, opp .232/.308/.352 | 35356 IP, FIP 4.02, 3.6 WAR/200 |
| 79 | Adam Ottavino | R | RP2 | -5.4 runs, opp .223/.322/.354 | 12897 IP, FIP 4.32, 1.0 WAR/200 |
| 76 | Didi Gregorius | L | SS vs RHP | vR +8.1 (glove -4.7) | vR .263/.338/.462 · vL .264/.321/.409 | 49594 PA, wOBA .333, 3.5 WAR/600 |
| 76 | Gregory Soto | L | RP3 | -6.3 runs, opp .239/.315/.380 | 340 IP, FIP 4.42, 1.8 WAR/200 |
| 74 | Joe Mack | L | C | vR -20.8 (glove +9.4) · vL -27.0 (glove +9.4) | vR .207/.275/.329 · vL .199/.259/.295 | 14852 PA, wOBA .262, 0.9 WAR/600 |
| 73 | Jake Odorizzi | R | SP5 | -0.9 runs, opp .238/.301/.385 | 3995 IP, FIP 4.12, 3.3 WAR/200 |
| 69 | Rafael Furcal | S | SS vs LHP; bench vs the other hand | vL -5.0 (glove -1.1) | vR .259/.311/.368 · vL .226/.310/.365 | 98297 PA, wOBA .316, 2.7 WAR/600 |
| 69 | Frank Viola | L | RP5 | -11.3 runs, opp .263/.333/.416 | 17301 IP, FIP 4.99, 2.1 WAR/200 |
| 66 | Rob Murphy | L | RP1 | -0.9 runs, opp .241/.320/.370 | 795 IP, FIP 4.17, 2.3 WAR/200 |
| 63 | Daniel Nava | S | bench | -5.3 | vR .266/.347/.399 · vL .216/.294/.277 | — |
| 63 | Lou Whitaker | L | bench | +1.4 | vR .269/.347/.424 · vL .202/.273/.268 | — |
| 60 | Jordan Hicks | R | RP6 | -6.0 runs, opp .249/.335/.396 | 76 IP, FIP 4.82, 1.6 WAR/200 |
| 55 | Carter Capps | R | RP4 | -7.2 runs, opp .249/.303/.393 | — |
| 53 | Dexter Fowler | S | bench | -16.1 | vR .218/.285/.306 · vL .211/.295/.272 | 2167 PA, wOBA .296, 1.0 WAR/600 |

Total value 2073. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** Juan Pierre CF · Hideki Matsui DH · Chase Utley 2B · Josh Hamilton RF · Mickey Moniak LF · Didi Gregorius SS · Arjun Nimmala 1B · Evan Longoria 3B · Joe Mack C

**vs LHP:** Chase Utley 2B · Brian Downing LF · Josh Hamilton RF · Hideki Matsui DH · Mickey Moniak CF · Arjun Nimmala 1B · Evan Longoria 3B · Rafael Furcal SS · Joe Mack C

```
--- staff ---
SP1     Javier Vazquez              94  R  2001   +11.5   SP
SP2     Jacob deGrom                79  L  2014    +7.4   SP
SP3     Hagen Smith                 88  L  2026    +6.8   SP
SP4     Randy Jones                 83  R  1976    -0.2   SP
SP5     Jake Odorizzi               73  R  2019    -0.9   SP
CL      Tom Niedenfuer              88  R  1983    -2.7   RP
RP1     Rob Murphy                  66  L  1989    -0.9   RP
RP2     Adam Ottavino               79  S  2018    -5.4   RP
RP3     Gregory Soto                76  L  2026    -6.3   RP
RP4     Carter Capps                55  R  2014    -7.2   RP
RP5     Jordan Hicks                60  R  2026   -11.3   RP
RP6     Frank Viola                 69  L  1992    -6.0   SP

--- roster check ---
  ✓ staff 5 SP / 7 RP / 14 bats (caps: 5 SP, 7 RP, 12 arms)
  ✓ starters' stamina Javier Vazquez 101, Jacob deGrom 73, Hagen Smith 63, Randy Jones 95, Jake Odorizzi 61 (era floor 50)
  ✗ stamina guys in the pen (45+): Frank Viola 84 — need 2
  ✓ C  backup: the pool has no second card at the floor (60); nearest here: Brian Downing 45
  ✗ 1B backup: NONE on the bench — only Joe Mack, Arjun Nimmala, who start (floor 60)
  ✓ 2B backup: Lou Whitaker 114
  ✗ 3B backup: NONE on the bench — only Evan Longoria, Arjun Nimmala, who start (floor 60)
  ✓ SS backup: vs RHP Rafael Furcal 104 · vs LHP Didi Gregorius 95
  ✓ LF backup: vs RHP Brian Downing 88, Daniel Nava 67 · vs LHP Daniel Nava 67
  ✗ CF backup: NONE on the bench vs RHP — only Josh Hamilton, Mickey Moniak, Juan Pierre, who start (floor 90) · vs LHP Juan Pierre 133
  ✓ RF backup: Dexter Fowler 76
```

## PTMS 3 PD 3 - Modified Perfectly Bronze (9130006)

**Keep saved 2255** (262.5, unchanged). No DH, so the pitcher bats ninth.
- Missing: a second stamina arm in the pen (McDougal only), a 2B backup at the 85 floor, an RF backup at the 75 floor.

1939 environment · 1940 Braves Field · roster ptms3pd3-lj-draft-2026-11-19.txt

| Val | Card | Hand | Roles | Projected | Observed (all events: no exports of this series on file) |
|---|---|---|---|---|---|
| 104 | Clayton Kershaw | L | SP1 | +22.0 runs, opp .244/.287/.340 | — |
| 103 | Josh Hamilton | L | CF | vR +71.2 (glove +1.3) · vL +23.6 (glove +1.3) | vR .344/.412/.593 · vL .301/.371/.415 | — |
| 103 | Kevin McGonigle | L | SS | vR +41.2 (glove +5.9) · vL +19.9 (glove +5.9) | vR .319/.422/.475 · vL .307/.393/.428 | — |
| 103 | Charlie Smith | L | LF | vR +44.2 (glove +9.9) · vL +34.9 (glove +9.9) | vR .312/.402/.511 · vL .311/.392/.481 | 1188 PA, wOBA .338, 3.7 WAR/600 |
| 102 | Franklin Arias | R | 2B | vR +31.6 (glove +7.3) · vL +28.5 (glove +7.3) | vR .304/.389/.472 · vL .300/.396/.460 | 27577 PA, wOBA .324, 3.3 WAR/600 |
| 101 | Cal Raleigh | S | C | vR +30.7 (glove +6.2) · vL +40.6 (glove +6.2) | vR .284/.386/.458 · vL .300/.377/.507 | 9338 PA, wOBA .341, 2.9 WAR/600 |
| 100 | Ed Williamson | R | 3B | vR +23.2 (glove +9.6) · vL +31.3 (glove +9.6) | vR .275/.370/.458 · vL .282/.380/.481 | 1563 PA, wOBA .320, 3.7 WAR/600 |
| 69 | Jesse Barfield | R | RF | vR -2.8 (glove +5.9) · vL -3.6 (glove +5.9) | vR .261/.318/.378 · vL .267/.346/.367 | 1416 PA, wOBA .289, 2.0 WAR/600 |
| 69 | Dick Lines | L | RP1 | -8.6 runs, opp .270/.340/.386 | 5010 IP, FIP 4.93, 1.1 WAR/200 |
| 67 | Yuki Matsui | L | CL | -8.7 runs, opp .255/.352/.377 | 532 IP, FIP 5.74, -2.2 WAR/200 |
| 66 | Jose Hernandez | R | 1B vs LHP; bench vs the other hand | vL -8.3 (glove +2.4) | vR .248/.311/.328 · vL .258/.316/.369 | 5925 PA, wOBA .260, -0.7 WAR/600 |
| 66 | Tanner McDougal | R | RP2 | -6.3 runs, opp .269/.360/.380 | 11259 IP, FIP 4.72, 2.3 WAR/200 |
| 64 | Yolfran Castillo | R | 1B vs RHP | vR -18.7 (glove +5.5) | vR .249/.334/.325 · vL .253/.341/.338 | 17268 PA, wOBA .289, 1.2 WAR/600 |
| 64 | Pretzels Getzien | R | SP3 | -2.5 runs, opp .283/.338/.407 | 3925 IP, FIP 4.52, 2.9 WAR/200 |
| 64 | Mickey Haefner | L | SP4 | -5.0 runs, opp .277/.354/.387 | 2415 IP, FIP 4.76, 2.3 WAR/200 |
| 63 | Cal McLish | R | RP3 | -11.6 runs, opp .275/.362/.398 | 250 IP, FIP 4.96, 0.0 WAR/200 |
| 63 | Travis Wood | L | SP2 | -2.4 runs, opp .264/.343/.383 | 5578 IP, FIP 4.73, 1.3 WAR/200 |
| 62 | Alex Avila | L | bench | -11.5 | vR .262/.358/.341 · vL .241/.326/.304 | 7341 PA, wOBA .307, 1.7 WAR/600 |
| 62 | Jack Powell | R | SP5 | -7.2 runs, opp .284/.347/.412 | 291 IP, FIP 4.54, 1.2 WAR/200 |
| 62 | Victor Scott II | L | bench | -29.3 | vR .242/.303/.310 · vL .240/.298/.296 | 215 PA, wOBA .280, 0.3 WAR/600 |
| 62 | Andrelton Simmons | R | bench | -23.3 | vR .247/.293/.344 · vL .217/.306/.315 | — |

Total value 1619. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** Cal Raleigh C · Kevin McGonigle SS · Charlie Smith LF · Josh Hamilton CF · Franklin Arias 2B · Ed Williamson 3B · Yolfran Castillo 1B · Jesse Barfield RF · Pitcher

**vs LHP:** Kevin McGonigle SS · Franklin Arias 2B · Ed Williamson 3B · Charlie Smith LF · Josh Hamilton CF · Cal Raleigh C · Jesse Barfield RF · Jose Hernandez 1B · Pitcher

```
--- staff ---
SP1     Clayton Kershaw            104  L  2014   +22.0   SP
SP2     Travis Wood                 63  R  2013    -2.4   SP
SP3     Pretzels Getzien            64  R  1888    -2.5   SP
SP4     Mickey Haefner              64  L  1944    -5.0   SP
SP5     Jack Powell                 62  R  1908    -7.2   SP
CL      Yuki Matsui                 67  L  2026    -8.7   RP
RP1     Dick Lines                  69  R  1966    -8.6   RP
RP2     Tanner McDougal             66  R  2026    -6.3   SP
RP3     Cal McLish                  63  S  1957   -11.6   RP

--- roster check ---
  ✓ staff 5 SP / 4 RP / 12 bats (caps: 5 SP, 7 RP, 12 arms)
  ✓ starters' stamina Clayton Kershaw 102, Travis Wood 87, Pretzels Getzien 90, Mickey Haefner 84, Jack Powell 79 (era floor 70)
  ✗ stamina guys in the pen (45+): Tanner McDougal 62 — need 2
  ✓ C  backup: the pool has no second card at the floor (60); nearest here: Alex Avila 52
  ✓ 1B backup: vs RHP Jose Hernandez 85 · vs LHP Yolfran Castillo 96
  ✗ 2B backup: NONE on the bench — only Franklin Arias, Charlie Smith, who start (floor 85)
  ✓ 3B backup: vs RHP Jose Hernandez 60 · vs LHP Yolfran Castillo 75
  ✓ SS backup: Andrelton Simmons 138
  ✓ LF backup: vs RHP Jose Hernandez 93 · vs LHP Yolfran Castillo 60
  ✓ CF backup: Victor Scott II 92
  ✗ RF backup: NONE on the bench — only Josh Hamilton, Jesse Barfield, Charlie Smith, who start (floor 75)
```
