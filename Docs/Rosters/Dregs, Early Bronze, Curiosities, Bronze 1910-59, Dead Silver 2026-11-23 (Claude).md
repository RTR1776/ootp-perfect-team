# Dregs, Early Bronze, Curiosities, Bronze 1910-59, Dead Silver Walking — 2026-11-23 (Claude)

L.J. (Monday night 11-23): "I need the rosters for the upcoming tourneys." Five events were open on his screen: Monday Now We're into the Dregs (548), Daily Early Bronze (525), Daily Bronze Only Curiosities (527), Daily Bronze 1910-59 (584) and Tuesday Dead Silver Walking (549).

**Build:** `current-rosters --only 525,527,548,549,584 --all --jobs 5 --tag 2026-11-23-mon` (16 starts, seeded from each saved pick), collection 436 (11-23: Pete Rose, Bob Forsch, Randy Myers, Billy Wagner VAR, Larry French VAR, Al Osuna VAR, Todd Helton VAR and eight higher-tier variants new since 422). All five legal. **Every saved pick stands:**

| Event | Saved pick | Saved, rescored | Fresh build | Verdict |
|---|---|---|---|---|
| Monday Dregs (548) | 2369 (11-22 bend) | 61.1 | 61.1 | same 26 cards |
| Daily Early Bronze (525) | 2393 (11-23, Mac, on 436) | 162.4 | 162.4 | same 26 cards |
| Bronze Only Curiosities (527) | 2318 (11-22 bend) | 140.9 | 141.2 | tie: Bailey (VAR) C vs RHP, Wagner 3B vs LHP, Sweeney for Dugan (VAR), Grim, Julio Cruz (VAR) |
| Bronze 1910-59 (584) | 2316 (11-22 bend) | 10.8 | 12.0 | tie: Harshman for Buckeye, Evar Swanson LF vs LHP for Ed Morgan (VAR) |
| Tuesday Dead Silver Walking (549) | 2382 (11-22 bend) | 126.1 | 126.1 | same 26 cards |

The two ties are under the +3 bar, so nothing was saved and the batch's manifest and load files were taken out of `Inbox/rosters` (Save Current Rosters would otherwise save them). The saved boards for 527 and 584 were rescored with `env-roster --seed <saved load file> --must <its cards> --ban <the build's swaps>`, which reproduced each saved 26 exactly; their batting orders and roster checks below come from those runs. On 584 the model now closes with Red Howard, not Paige (the saved load file has Paige at CL).

None of the new collection cards starts in these five. The top-teams section of the report needs `Archive/Completed` (Mac only), so it is left out here.

Results logged the same night (`Tourney Data/PTCS9 Results/2026-11-23.txt`): Low Diamond Only 3rd/4th of 64 (+10 Diamond), Bronze 1910-59 2nd of 64 (+15 Bronze, roster 2316), Up And At Them Bronze 3rd/4th of 256 (+20 Bronze), Open Main Event 65th–128th of 256 (+1 Open), Low Silver Only 33rd–64th (0). Diamond 1990 Onward 5th–8th was already on file. Daily Bronze OOTP Era 1820238 was still running (eliminated, no placement yet). Bronze 123 at day 22: 46 to safe (169).

## Monday Now We're into the Dregs

1994 environment · 1996 Dodger Stadium · saved roster 2369 (load file `goldfloorcapweekly-claude-2026-11-22-bend.txt`)

| Val | Card | Hand | Roles | Projected | Observed (this series) |
|---|---|---|---|---|---|
| 64 | Byron Buxton (VAR) | R | CF | vR -6.1 (glove +1.9) · vL +7.3 (glove +1.9) | vR .233/.287/.360 · vL .254/.312/.406 | 2770 PA, wOBA .307, 2.5 WAR/600 |
| 64 | Joe Carter | R | RF | vR -2.6 (glove +0.8) · vL +4.7 (glove +0.8) | vR .225/.281/.380 · vL .253/.292/.420 | 3527 PA, wOBA .311, 1.5 WAR/600 |
| 64 | Fritz Ostermueller | L | SP2 | +7.7 runs, opp .255/.331/.378 | 8789 IP, FIP 3.74, 4.4 WAR/200 |
| 64 | Brandon Phillips | R | 2B | vR -1.9 (glove +4.0) · vL +24.7 (glove +4.0) | vR .254/.289/.386 · vL .290/.335/.506 | 7312 PA, wOBA .335, 3.4 WAR/600 |
| 64 | Caden Scarborough (VAR) | R | RP1 | +2.2 runs, opp .247/.327/.375 | 86 IP, FIP 3.92, 3.0 WAR/200 |
| 63 | Travis Fryman (VAR) | R | 3B | vR -6.6 (glove +2.8) · vL +10.2 (glove +2.8) | vR .228/.292/.353 · vL .254/.323/.435 | 45 PA, wOBA .369, 5.3 WAR/600 |
| 62 | Khalil Greene (VAR) | R | SS | vR -2.1 (glove +2.5) · vL +0.0 (glove +2.5) | vR .236/.278/.441 · vL .249/.329/.417 | 150 PA, wOBA .376, 4.8 WAR/600 |
| 62 | Gene Krapp | R | SP4 | +5.0 runs, opp .232/.376/.340 | 1080 IP, FIP 3.96, 3.8 WAR/200 |
| 59 | John Bale (VAR) | L | CL | +2.9 runs, opp .255/.334/.366 | 45 IP, FIP 3.38, 3.6 WAR/200 |
| 59 | Big Jeff Pfeffer | R | SP1; bench | +10.2 runs, opp .252/.336/.387 | 1021 IP, FIP 3.45, 5.1 WAR/200 |
| 58 | Jackie Robinson (VAR) | R | DH vs LHP; bench vs the other hand | vL +12.6 | vR .242/.300/.326 · vL .257/.331/.403 | 2696 PA, wOBA .336, 1.9 WAR/600 |
| 58 | Justin Verlander | R | SP5 | +3.0 runs, opp .262/.328/.405 | 2982 IP, FIP 3.85, 4.1 WAR/200 |
| 55 | Carter Capps | R | RP2 | -6.8 runs, opp .260/.320/.395 | — |
| 55 | James McDonald (VAR) | R | SP3 | +7.4 runs, opp .253/.334/.370 | 3624 IP, FIP 3.59, 4.7 WAR/200 |
| 54 | Jim Tabor (VAR) | R | DH vs RHP | vR +4.1 | vR .251/.300/.425 · vL .242/.302/.374 | 7966 PA, wOBA .323, 2.4 WAR/600 |
| 53 | Jeff Francis | L | RP4 | -5.5 runs, opp .270/.331/.424 | 634 IP, FIP 4.12, 2.8 WAR/200 |
| 53 | Cal Raleigh | S | C | vR -11.6 (glove +2.9) · vL -15.3 (glove +2.9) | vR .198/.271/.366 · vL .200/.300/.330 | 565 PA, wOBA .322, 2.4 WAR/600 |
| 53 | Jim Thorpe (VAR) | R | LF vs LHP; bench vs the other hand | vL +10.1 (glove -2.3) | vR .224/.265/.344 · vL .241/.296/.416 | 825 PA, wOBA .357, 3.3 WAR/600 |
| 51 | Sam Huff | R | bench | -21.7 | vR .215/.270/.312 · vL .225/.285/.334 | 132 PA, wOBA .273, -0.5 WAR/600 |
| 51 | Ray Knight | R | 1B vs LHP; bench vs the other hand | vL +4.4 (glove +1.1) | vR .233/.310/.296 · vL .277/.324/.460 | 757 PA, wOBA .317, 1.0 WAR/600 |
| 51 | Juan Mejia | R | RP5 | -13.1 runs, opp .264/.356/.406 | 310 IP, FIP 4.29, 1.3 WAR/200 |
| 51 | Mike Trout (VAR) | R | LF vs RHP | vR -3.8 (glove +0.0) | vR .207/.286/.362 · vL .164/.261/.191 | 346 PA, wOBA .273, -0.9 WAR/600 |
| 50 | Tyler Chatwood | R | RP3 | -4.3 runs, opp .270/.341/.394 | 119 IP, FIP 4.22, 2.5 WAR/200 |
| 50 | Trei Cruz | S | bench | -24.3 | vR .206/.281/.288 · vL .209/.282/.302 | — |
| 50 | Hayden Juenger | R | RP6 | -15.5 runs, opp .272/.356/.423 | 293 IP, FIP 4.26, 1.4 WAR/200 |
| 50 | Nap Lajoie (VAR) | R | 1B vs RHP | vR -5.5 (glove +3.9) | vR .278/.313/.386 · vL .243/.294/.359 | 3642 PA, wOBA .326, 2.1 WAR/600 |

Total value 1468. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** Mike Trout (VAR) LF · Jim Tabor (VAR) DH · Khalil Greene (VAR) SS · Byron Buxton (VAR) CF · Nap Lajoie (VAR) 1B · Brandon Phillips 2B · Joe Carter RF · Travis Fryman (VAR) 3B · Cal Raleigh C

**vs LHP:** Jackie Robinson (VAR) DH · Khalil Greene (VAR) SS · Travis Fryman (VAR) 3B · Brandon Phillips 2B · Ray Knight 1B · Byron Buxton (VAR) CF · Joe Carter RF · Jim Thorpe (VAR) LF · Cal Raleigh C

Monday Dregs: 5 SP / 7 RP, cap 1468 of 1468. Big Jeff Pfeffer is SP1 and the bench bat (two-way).

```
--- rotation ---
SP1     Big Jeff Pfeffer            59  R  1906   +10.2 fld +15.6   SP STM  98  #87340
SP2     Fritz Ostermueller          64  L  1944    +7.7 fld +13.1   SP STM  98  #86357
SP3     James McDonald (VAR)        55  L  2010    +7.4 fld +12.7   SP STM  59  #86384
SP4     Gene Krapp                  62  R  1911    +5.0 fld +10.3   SP STM 102  #87374
SP5     Justin Verlander            58  R  2006    +3.0 fld  +8.4   SP STM  83  #87014
--- bullpen ---
CL      John Bale (VAR)             59  L  2007    +2.9 fld  +8.3   RP STM  33  #87234
RP1     Caden Scarborough (VAR)     64  R  2026    +2.2 fld  +7.6   RP STM  46  #84762
RP2     Carter Capps                55  R  2014    -6.8 fld  -1.4   RP STM  19  #87508
RP3     Tyler Chatwood              50  R  2013    -4.3 fld  +1.1   SP STM  58  #87515
RP4     Jeff Francis                53  L  2007    -5.5 fld  -0.1   SP STM  75  #87199
RP5     Juan Mejia                  51  R  2026   -13.1 fld  -7.7   RP STM  19  #81806
RP6     Hayden Juenger              50  R  2026   -15.5 fld -10.1   RP STM  21  #86032
--- roster check ---
  ✓ staff 5 SP / 7 RP / 15 bats (caps: 5 SP, 7 RP, 12 arms) · field's best quarter (225 teams): 5.0 SP / 7.0 RP / 14.2 bats
  ✓ starters' stamina Big Jeff Pfeffer 98, Fritz Ostermueller 98, James McDonald 59, Gene Krapp 102, Justin Verlander 83 (era floor 50)
  ✓ stamina guys in the pen (45+): Caden Scarborough 46, Tyler Chatwood 58, Jeff Francis 75
  ✓ C  backup: Sam Huff 62
  ✓ 1B backup: vs RHP Ray Knight 84, Jackie Robinson 80, Trei Cruz 87 · vs LHP Nap Lajoie 103, Jackie Robinson 80, Trei Cruz 87
  ✓ 2B backup: vs RHP Trei Cruz 78 · vs LHP Nap Lajoie 122, Trei Cruz 78
  ✓ 3B backup: Jim Tabor 74, Trei Cruz 75
  ✓ SS backup: Trei Cruz 64
  ✓ LF backup: vs RHP Jim Thorpe 76, Big Jeff Pfeffer 80 · vs LHP Mike Trout 95, Big Jeff Pfeffer 80
  ✓ CF backup: vs RHP Trei Cruz 62 · vs LHP Mike Trout 64, Trei Cruz 62
  ✓ RF backup: vs RHP Jim Thorpe 76, Big Jeff Pfeffer 74 · vs LHP Big Jeff Pfeffer 74

--- cap ledger --- (floor value 50; runs = what he adds over the best unrostered floor card in his slots)
  slot      card                     val +cap   runs   /pt  floor sub / why
  2B        Brandon Phillips          64   14  +37.3  2.66  Connie Day
  SP2       Fritz Ostermueller        64   14  +30.9  2.21  Don August
  CF        Byron Buxton              64   14  +16.7  1.19  Dave Henderson
  RF        Joe Carter                64   14  +14.6  1.04  Dave Henderson
  RP1       Caden Scarborough         64   14  +13.3  0.95  Peter Strzelecki  ◂ LEAK
  3B        Travis Fryman             63   13  +26.0  2.00  Connie Day
  SS        Khalil Greene             62   12  +26.9  2.24  Connie Day
  SP4       Gene Krapp                62   12  +23.4  1.95  Don August
  CL        John Bale                 59    9  +19.8  2.20  Peter Strzelecki
  SP1/BN5   Big Jeff Pfeffer          59    9      -     -  no floor card fits · backup RF
  SP5       Justin Verlander          58    8  +17.6  2.20  Don August
  DH/BN2    Jackie Robinson           58    8  +10.7  1.33  Dave Henderson
  SP3       James McDonald            55    5  +28.3  5.65  Don August
  RP2       Carter Capps              55    5   +6.8  1.36  Peter Strzelecki
  DH        Jim Tabor                 54    4   +6.2  1.55  Jay Clarke
  C         Cal Raleigh               53    3  +19.1  6.37  Doug Mirabelli
  LF/BN1    Jim Thorpe                53    3  +11.0  3.66  Todd Benzinger
  RP4       Jeff Francis              53    3   +2.4  0.80  Peter Strzelecki  ◂ LEAK
  1B/BN6    Ray Knight                51    1  +10.9 10.95  Rece Hinds
  LF        Mike Trout                51    1   +6.4  6.39  Todd Benzinger
  RP5       Juan Mejia                51    1   +1.8  1.77  Peter Strzelecki
  BN3       Sam Huff                  51    1   -0.8 -0.80  Jay Clarke · backup C, 2nd C
  168 cap points above the floor on 22 cards (4 at the floor) · 2.07 runs per point on average
  leaks (under half the average, no rule behind them): Caden Scarborough 14 pts, Jeff Francis 3 pts
```

## Daily Early Bronze

1942 environment · 1945 Wrigley Field · saved roster 2393 (load file `earlybronze-claude-2026-11-23.txt`)

| Val | Card | Hand | Roles | Projected | Observed (this series) |
|---|---|---|---|---|---|
| 69 | Erik Hanson | R | SP1 | +8.1 runs, opp .258/.318/.354 | 246 IP, FIP 3.58, 5.0 WAR/200 |
| 69 | Dax Kilby | L | 1B vs RHP | vR -3.0 (glove +3.9) | vR .231/.330/.303 · vL .221/.316/.271 | 506 PA, wOBA .307, 3.1 WAR/600 |
| 69 | Jeff Reardon | R | RP1 | -1.0 runs, opp .245/.309/.340 | 47 IP, FIP 3.68, 3.9 WAR/200 |
| 69 | Pete Rose | S | RF vs RHP | vR +19.1 (glove +13.8) | vR .278/.352/.365 · vL .287/.337/.351 | 1147 PA, wOBA .349, 5.6 WAR/600 |
| 69 | Deion Sanders | L | CF | vR +0.6 (glove +1.6) · vL +5.4 (glove +1.6) | vR .256/.306/.338 · vL .253/.282/.368 | 7697 PA, wOBA .307, 4.5 WAR/600 |
| 69 | Shane Victorino | S | RF vs LHP; bench vs the other hand | vL +1.3 (glove +13.8) | vR .243/.296/.316 · vL .280/.332/.368 | 2938 PA, wOBA .292, 3.5 WAR/600 |
| 68 | Hank Blalock | L | 3B vs RHP | vR -5.9 (glove +5.2) | vR .241/.297/.342 · vL .204/.238/.233 | 4614 PA, wOBA .287, 3.6 WAR/600 |
| 68 | Bobby Bonilla | S | bench | +0.7 | vR .224/.320/.344 · vL .253/.339/.334 | 173 PA, wOBA .289, 2.4 WAR/600 |
| 68 | Nelson Cruz | R | LF vs RHP | vR +16.0 (glove +7.2) | vR .256/.329/.400 · vL .232/.318/.329 | — |
| 68 | Nelson Dean | R | RP4 | +4.7 runs, opp .253/.316/.349 | 554 IP, FIP 4.01, 3.8 WAR/200 |
| 67 | Edwin Diaz | R | RP3 | -4.1 runs, opp .262/.335/.347 | 244 IP, FIP 3.98, 2.5 WAR/200 |
| 67 | Pedro Martinez | R | CL | +4.8 runs, opp .251/.319/.341 | 619 IP, FIP 3.85, 4.0 WAR/200 |
| 67 | Scott Spiezio | S | 1B vs LHP; bench vs the other hand | vL +7.8 (glove +4.1) | vR .224/.315/.312 · vL .279/.367/.349 | 1035 PA, wOBA .305, 2.0 WAR/600 |
| 66 | Eddie Dixon | R | RP2 | +2.1 runs, opp .259/.313/.359 | 292 IP, FIP 3.90, 4.1 WAR/200 |
| 66 | Gabby Hartnett | R | C vs LHP; bench vs the other hand | vL -1.2 (glove -3.0) | vR .259/.304/.338 · vL .264/.323/.359 | 1938 PA, wOBA .297, 3.3 WAR/600 |
| 66 | Chris Sabo | R | 3B vs LHP; bench vs the other hand | vL +27.6 (glove -5.2) | vR .240/.308/.372 · vL .278/.357/.422 | 873 PA, wOBA .301, 3.3 WAR/600 |
| 65 | Bill Duggleby | R | SP3 | +6.7 runs, opp .256/.294/.359 | 576 IP, FIP 4.07, 3.5 WAR/200 |
| 65 | Mark Grudzielanek | R | 2B vs RHP | vR -11.8 (glove +12.0) | vR .280/.302/.360 · vL .283/.345/.351 | 769 PA, wOBA .292, 4.3 WAR/600 |
| 64 | Ernie Clement | R | SS | vR -5.6 (glove +1.2) · vL +12.0 (glove +1.2) | vR .287/.319/.369 · vL .300/.329/.407 | 2250 PA, wOBA .309, 4.6 WAR/600 |
| 64 | Bruce Hurst | L | SP2 | +6.7 runs, opp .252/.310/.352 | 2669 IP, FIP 3.89, 4.1 WAR/200 |
| 64 | Fritz Ostermueller | L | SP4 | +6.3 runs, opp .258/.330/.345 | 3221 IP, FIP 3.94, 3.9 WAR/200 |
| 64 | Brandon Phillips | R | 2B vs LHP; bench vs the other hand | vL +23.4 (glove +7.8) | vR .260/.292/.350 · vL .284/.326/.408 | 1335 PA, wOBA .309, 4.9 WAR/600 |
| 63 | Jack Cust | L | bench | +0.1 | vR .222/.341/.313 · vL .222/.341/.297 | 345 PA, wOBA .306, 1.0 WAR/600 |
| 62 | Jett Williams | R | LF vs LHP; bench vs the other hand | vL +11.7 (glove +1.7) | vR .243/.339/.333 · vL .255/.355/.364 | 3909 PA, wOBA .317, 3.9 WAR/600 |
| 59 | Chris Taylor | R | bench | -6.6 | vR .265/.331/.361 · vL .247/.340/.326 | 286 PA, wOBA .283, 3.6 WAR/600 |
| 55 | Roger Bresnahan | R | C vs RHP | vR -4.6 (glove -8.0) | vR .250/.317/.360 · vL .261/.339/.321 | 123 PA, wOBA .223, 0.0 WAR/600 |

Total value 1710. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** Dax Kilby 1B · Pete Rose RF · Roger Bresnahan C · Nelson Cruz LF · Ernie Clement SS · Mark Grudzielanek 2B · Deion Sanders CF · Hank Blalock 3B · Pitcher

**vs LHP:** Scott Spiezio 1B · Jett Williams LF · Chris Sabo 3B · Ernie Clement SS · Shane Victorino RF · Brandon Phillips 2B · Gabby Hartnett C · Deion Sanders CF · Pitcher

Early Bronze: 1942 RE, no DH, 4 SP / 5 RP.

```
--- rotation ---
SP1     Erik Hanson                 69  R  1990    +8.1 fld  +9.7   SP STM  83  #87285
SP2     Bruce Hurst                 64  L  1990    +6.7 fld  +8.3   SP STM  86  #86361
SP3     Bill Duggleby               65  R  1901    +6.7 fld  +8.3   SP STM 105  #87335
SP4     Fritz Ostermueller          64  L  1944    +6.3 fld  +7.9   SP STM  98  #86357
--- bullpen ---
CL      Pedro Martinez              67  R  1994    +4.8 fld  +6.4   SP STM  69  #87430
RP1     Jeff Reardon                69  R  1985    -1.0 fld  +0.6   CL STM  22  #87470
RP2     Eddie Dixon                 66  R  1938    +2.1 fld  +3.7   RP STM  65  #87157
RP3     Edwin Diaz                  67  R  2016    -4.1 fld  -2.5   CL STM  13  #86422
RP4     Nelson Dean                 68  R  1925    +4.7 fld  +6.3   SP STM  90  #87434
--- roster check ---
  ✓ staff 4 SP / 5 RP / 17 bats (caps: 5 SP, 7 RP, 12 arms) · field's best quarter (150 teams): 4.6 SP / 5.4 RP / 15.0 bats
  ✓ starters' stamina Erik Hanson 83, Bruce Hurst 86, Bill Duggleby 105, Fritz Ostermueller 98 (era floor 70)
  ✓ stamina guys in the pen (45+): Pedro Martinez 69, Eddie Dixon 65, Nelson Dean 90
  ✓ C  backup: vs RHP Gabby Hartnett 88 · vs LHP Roger Bresnahan 60
  ✓ 1B backup: vs RHP Scott Spiezio 91 · vs LHP Roger Bresnahan 61, Dax Kilby 90
  ✓ 2B backup: vs RHP Brandon Phillips 130, Jett Williams 93, Chris Taylor 112 · vs LHP Mark Grudzielanek 139, Hank Blalock 108, Chris Taylor 112
  ✓ 3B backup: vs RHP Chris Sabo 77, Jett Williams 83, Chris Taylor 97, Bobby Bonilla 63 · vs LHP Hank Blalock 105, Dax Kilby 69, Chris Taylor 97, Bobby Bonilla 63
  ✓ SS backup: Chris Taylor 96
  ✓ LF backup: vs RHP Scott Spiezio 62, Shane Victorino 151, Jett Williams 103, Chris Taylor 111 · vs LHP Dax Kilby 67, Pete Rose 152, Nelson Cruz 127, Chris Taylor 111
  ✓ CF backup: vs RHP Shane Victorino 140, Chris Taylor 94 · vs LHP Chris Taylor 94
  ✓ RF backup: vs RHP Shane Victorino 153, Jett Williams 97 · vs LHP Roger Bresnahan 84, Pete Rose 153, Nelson Cruz 126
```

## Daily Bronze Only Curiosities

PT default environment · 2005 Minute Maid Park · saved roster 2318 (load file `bronzecuriosity-claude-2026-11-22-bend.txt`)

| Val | Card | Hand | Roles | Projected | Observed (this series) |
|---|---|---|---|---|---|
| 69 | Austin Adams | R | RP3 | -2.1 runs, opp .200/.376/.313 | — |
| 69 | Adam Cimber (VAR) | R | RP1 | +0.8 runs, opp .245/.333/.380 | 180 IP, FIP 3.46, 4.0 WAR/200 |
| 69 | Erik Hanson | R | SP3 | +4.0 runs, opp .239/.304/.405 | — |
| 69 | Mickey Lolich | L | SP4 | +3.0 runs, opp .238/.310/.417 | — |
| 69 | Bob Miller | R | RP4 | +2.4 runs, opp .251/.330/.396 | 1808 IP, FIP 3.78, 4.3 WAR/200 |
| 69 | Aaron Rowand | R | RF vs LHP; bench vs the other hand | vL +12.0 (glove +6.3) | vR .249/.284/.428 · vL .262/.329/.473 | — |
| 69 | Deion Sanders | L | CF | vR +3.4 (glove +1.1) · vL +4.7 (glove +1.1) | vR .242/.298/.367 · vL .234/.269/.410 | 1224 PA, wOBA .339, 4.5 WAR/600 |
| 69 | Kerry Wood | R | RP2 | -0.6 runs, opp .211/.321/.347 | 72 IP, FIP 2.92, 6.4 WAR/200 |
| 69 | Ben Zobrist | S | 1B vs RHP | vR +3.0 (glove +3.3) | vR .242/.351/.392 · vL .239/.335/.358 | — |
| 68 | Dave Brain (VAR) | R | 3B | vR +9.7 (glove +2.1) · vL +13.3 (glove +2.1) | vR .248/.296/.475 · vL .244/.297/.490 | 1063 PA, wOBA .336, 4.0 WAR/600 |
| 68 | Livan Hernandez | R | SP5 | +1.7 runs, opp .228/.322/.383 | — |
| 68 | Billy Southworth (VAR) | L | LF vs RHP | vR +6.3 (glove +3.1) | vR .271/.325/.469 · vL .253/.262/.412 | 803 PA, wOBA .329, 2.8 WAR/600 |
| 67 | Eric Byrnes | R | RF vs RHP; LF vs LHP | vR +3.8 (glove +6.1) · vL +10.6 (glove +6.2) | vR .253/.322/.399 · vL .248/.334/.461 | — |
| 67 | Wes Covington | L | DH vs RHP | vR +8.7 | vR .261/.304/.486 · vL .162/.238/.196 | 1026 PA, wOBA .365, 2.8 WAR/600 |
| 67 | Edwin Diaz | R | CL | +4.9 runs, opp .233/.312/.367 | 496 IP, FIP 3.11, 5.1 WAR/200 |
| 67 | Pedro Martinez | R | SP2 | +4.3 runs, opp .229/.303/.378 | — |
| 65 | Joe Dugan (VAR) | R | DH vs LHP; bench vs the other hand | vL +8.4 | vR .248/.288/.400 · vL .241/.319/.400 | 269 PA, wOBA .278, -0.7 WAR/600 |
| 65 | John Grim | R | bench | -7.1 | vR .245/.281/.436 · vL .255/.291/.472 | — |
| 64 | Ernie Clement | R | 2B vs RHP; 1B vs LHP | vR -0.3 (glove +5.4) · vL +15.8 (glove +3.9) | vR .279/.317/.399 · vL .300/.335/.470 | — |
| 64 | Jaime Garcia | L | RP5 | +2.1 runs, opp .252/.323/.399 | — |
| 64 | Bill Killefer | R | C | vR -14.9 (glove +7.8) · vL -16.2 (glove +7.8) | vR .275/.332/.349 · vL .276/.338/.347 | — |
| 64 | Brandon Phillips | R | 2B vs LHP; bench vs the other hand | vL +23.4 (glove +5.4) | vR .245/.283/.410 · vL .292/.338/.579 | — |
| 62 | Julio Cruz (VAR) | S | bench | -18.1 | vR .202/.306/.264 · vL .226/.316/.283 | 1124 PA, wOBA .278, 1.4 WAR/600 |
| 62 | Khalil Greene (VAR) | R | SS | vR -0.8 (glove +3.4) · vL +5.8 (glove +3.4) | vR .228/.272/.477 · vL .242/.323/.450 | — |
| 62 | Ramon Hernandez | L | RP6 | -3.6 runs, opp .246/.338/.386 | — |
| 62 | Gene Krapp | R | SP1 | +5.0 runs, opp .211/.355/.332 | — |

Total value 1727. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** Ben Zobrist 1B · Billy Southworth (VAR) LF · Dave Brain (VAR) 3B · Khalil Greene (VAR) SS · Ernie Clement 2B · Eric Byrnes RF · Wes Covington DH · Deion Sanders CF · Bill Killefer C

**vs LHP:** Eric Byrnes LF · Khalil Greene (VAR) SS · Brandon Phillips 2B · Aaron Rowand RF · Ernie Clement 1B · Joe Dugan (VAR) DH · Dave Brain (VAR) 3B · Deion Sanders CF · Bill Killefer C

Curiosities (Unsung, Hardware, Rookie card types only): 5 SP / 7 RP.

```
--- rotation ---
SP1     Gene Krapp                  62  R  1911    +5.0 fld +10.7   SP STM 102  #87374
SP2     Pedro Martinez              67  R  1994    +4.3 fld  +9.9   SP STM  69  #87430
SP3     Erik Hanson                 69  R  1990    +4.0 fld  +9.6   SP STM  83  #87285
SP4     Mickey Lolich               69  S  1968    +3.0 fld  +8.7   SP STM 117  #87279
SP5     Livan Hernandez             68  R  1997    +1.7 fld  +7.3   SP STM  87  #87261
--- bullpen ---
CL      Edwin Diaz                  67  R  2016    +4.9 fld +10.5   CL STM  13  #86422
RP1     Adam Cimber (VAR)           69  R  2018    +0.8 fld  +6.5   RP STM  17  #84271
RP2     Kerry Wood                  69  R  2010    -0.6 fld  +5.0   RP STM  17  #86987
RP3     Austin Adams                69  R  2021    -2.1 fld  +3.5   RP STM  15  #87564
RP4     Bob Miller                  69  R  1963    +2.4 fld  +8.1   SP STM  62  #84715
RP5     Jaime Garcia                64  L  2015    +2.1 fld  +7.8   SP STM  69  #87521
RP6     Ramon Hernandez             62  S  1975    -3.6 fld  +2.1   RP STM  22  #87294
--- roster check ---
  ✓ staff 5 SP / 7 RP / 14 bats (caps: 5 SP, 7 RP, 12 arms) · field's best quarter (64 teams): 5.0 SP / 7.1 RP / 13.9 bats
  ✓ starters' stamina Gene Krapp 102, Pedro Martinez 69, Erik Hanson 83, Mickey Lolich 117, Livan Hernandez 87 (era floor 50)
  ✓ stamina guys in the pen (45+): Bob Miller 62, Jaime Garcia 69
  ✓ C  backup: John Grim 60
  ✓ 1B backup: vs RHP John Grim 82 · vs LHP Ben Zobrist 93, John Grim 82
  ✓ 2B backup: vs RHP Brandon Phillips 130, Julio Cruz 111 · vs LHP Julio Cruz 111
  ✓ 3B backup: Joe Dugan 63
  ✓ SS backup: Julio Cruz 86
  ✓ LF backup: vs RHP Aaron Rowand 131 · vs LHP Ben Zobrist 73, Billy Southworth 115
  ✓ CF backup: vs RHP Aaron Rowand 122 · vs LHP Billy Southworth 100
  ✓ RF backup: vs RHP Aaron Rowand 134 · vs LHP Billy Southworth 100
```

## Daily Bronze 1910-59

1959 environment · 1959 Seals Stadium · saved roster 2316 (load file `bronze10to50-claude-2026-11-22-bend.txt`)

| Val | Card | Hand | Roles | Projected | Observed (this series) |
|---|---|---|---|---|---|
| 69 | Ed Bailey (VAR) | L | C vs RHP | vR -16.4 (glove +1.3) | vR .239/.345/.337 · vL .224/.306/.309 | 881 PA, wOBA .329, 3.5 WAR/600 |
| 69 | Dave Bancroft | S | SS | vR -10.4 (glove +1.0) · vL -4.4 (glove +1.0) | vR .259/.359/.329 · vL .258/.345/.359 | 637 PA, wOBA .333, 4.3 WAR/600 |
| 69 | Claude Johnson | R | 2B | vR -7.3 (glove -5.8) · vL -4.7 (glove -5.8) | vR .246/.344/.335 · vL .249/.348/.342 | 885 PA, wOBA .337, 4.3 WAR/600 |
| 69 | Pete Washington | R | CF | vR -17.6 (glove +4.1) · vL -12.2 (glove +4.1) | vR .227/.293/.381 · vL .232/.298/.398 | 782 PA, wOBA .320, 3.0 WAR/600 |
| 68 | Cool Papa Bell | L | SP2 | +5.3 runs, opp .258/.314/.395 | 1297 IP, FIP 4.15, 4.6 WAR/200 |
| 68 | Garland Buckeye | L | RP2 | -11.6 runs, opp .253/.318/.392 | 292 IP, FIP 4.66, 3.1 WAR/200 |
| 68 | Nelson Dean | R | SP3 | +4.4 runs, opp .246/.309/.379 | 539 IP, FIP 4.23, 4.2 WAR/200 |
| 68 | Satchel Paige | R | CL | -1.5 runs, opp .248/.330/.369 | 4142 IP, FIP 4.35, 3.5 WAR/200 |
| 68 | Billy Southworth (VAR) | L | RF vs RHP | vR +6.4 (glove +0.4) | vR .267/.317/.422 · vL .246/.251/.369 | 2814 PA, wOBA .354, 4.7 WAR/600 |
| 67 | Ping Bodie | R | RF vs LHP; bench vs the other hand | vL -1.4 (glove -4.8) | vR .238/.291/.389 · vL .243/.302/.410 | 939 PA, wOBA .338, 1.8 WAR/600 |
| 67 | Wes Covington | L | DH vs RHP | vR +21.1 | vR .268/.307/.451 · vL .189/.259/.220 | 10160 PA, wOBA .371, 3.2 WAR/600 |
| 67 | Dave Harris | R | DH vs LHP; bench vs the other hand | vL +12.2 | vR .212/.279/.332 · vL .240/.322/.407 | 6401 PA, wOBA .327, 1.4 WAR/600 |
| 67 | Pat Patterson | S | 3B vs RHP | vR -5.1 (glove -2.3) | vR .265/.304/.395 · vL .255/.293/.379 | 6123 PA, wOBA .329, 3.1 WAR/600 |
| 67 | Elmer Singleton | R | RP4 | -7.1 runs, opp .260/.328/.386 | 158 IP, FIP 4.19, 3.8 WAR/200 |
| 66 | Eddie Dixon | R | RP3 | -6.8 runs, opp .255/.309/.397 | 419 IP, FIP 4.63, 3.5 WAR/200 |
| 66 | Charlie Grimm (VAR) | L | 1B vs RHP | vR +1.3 (glove -0.4) | vR .271/.342/.368 · vL .257/.324/.314 | 71 PA, wOBA .327, 2.5 WAR/600 |
| 66 | Gabby Hartnett | R | C vs LHP; bench vs the other hand | vL -5.4 (glove -3.0) | vR .236/.283/.338 · vL .251/.311/.400 | 12380 PA, wOBA .315, 2.5 WAR/600 |
| 66 | Ed Morgan (VAR) | R | LF vs LHP; bench vs the other hand | vL -2.4 (glove -6.9) | vR .243/.334/.328 · vL .248/.335/.359 | 4700 PA, wOBA .317, 1.4 WAR/600 |
| 65 | Joe Dugan (VAR) | R | 3B vs LHP; bench vs the other hand | vL +8.0 (glove -9.1) | vR .251/.287/.376 · vL .253/.327/.385 | 1195 PA, wOBA .349, 3.4 WAR/600 |
| 64 | Red Howard | L | RP1 | -1.3 runs, opp .251/.325/.371 | 155 IP, FIP 4.25, 3.9 WAR/200 |
| 64 | Fritz Ostermueller | L | SP1 | +9.3 runs, opp .248/.321/.364 | 8392 IP, FIP 3.95, 4.8 WAR/200 |
| 62 | Gene Krapp | R | SP4 | -2.0 runs, opp .229/.368/.332 | 378 IP, FIP 4.80, 2.6 WAR/200 |
| 61 | Jack Tobin | L | LF vs RHP | vR +3.8 (glove -3.7) | vR .279/.343/.363 · vL .256/.292/.314 | 1976 PA, wOBA .346, 3.3 WAR/600 |
| 58 | Jackie Robinson (VAR) | R | 1B vs LHP; bench vs the other hand | vL +2.2 (glove +0.8) | vR .230/.286/.308 · vL .245/.316/.380 | 858 PA, wOBA .316, 2.2 WAR/600 |
| 56 | Specs Clark | L | bench | -26.1 | vR .241/.304/.306 · vL .219/.281/.271 | 61 PA, wOBA .300, 2.0 WAR/600 |
| 46 | Vince DiMaggio | R | bench | -37.6 | vR .211/.263/.310 · vL .199/.249/.281 | — |

Total value 1691. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** Ed Bailey (VAR) C · Dave Bancroft SS · Wes Covington DH · Billy Southworth (VAR) RF · Charlie Grimm (VAR) 1B · Jack Tobin LF · Pat Patterson 3B · Pete Washington CF · Claude Johnson 2B

**vs LHP:** Claude Johnson 2B · Ed Morgan (VAR) LF · Dave Harris DH · Joe Dugan (VAR) 3B · Dave Bancroft SS · Jackie Robinson (VAR) 1B · Ping Bodie RF · Gabby Hartnett C · Pete Washington CF

Bronze 1910-59: 4 SP / 5 RP.

```
--- rotation ---
SP1     Fritz Ostermueller          64  L  1944    +9.3 fld +16.2   SP STM  98  #86357
SP2     Cool Papa Bell              68  R  1923    +5.3 fld +12.1   SP STM  86  #86981
SP3     Nelson Dean                 68  R  1925    +4.4 fld +11.3   SP STM  90  #87434
SP4     Gene Krapp                  62  R  1911    -2.0 fld  +4.9   SP STM 102  #87374
--- bullpen ---
CL      Red Howard                  64  L  1940    -1.5 fld  +5.4   RP STM  40  #87156
RP1     Satchel Paige               68  R  1952    -1.3 fld  +5.6   RP STM  57  #84839
RP2     Elmer Singleton             67  R  1959   -11.6 fld  -4.7   RP STM  24  #83182
RP3     Eddie Dixon                 66  R  1938    -6.8 fld  +0.1   RP STM  65  #87157
RP4     Garland Buckeye             68  S  1925    -7.1 fld  -0.2   SP STM  66  #87277
--- roster check ---
  ✓ staff 4 SP / 5 RP / 17 bats (caps: 5 SP, 7 RP, 12 arms) · field's best quarter (218 teams): 4.6 SP / 5.3 RP / 15.4 bats
  ✓ starters' stamina Fritz Ostermueller 98, Cool Papa Bell 86, Nelson Dean 90, Gene Krapp 102 (era floor 60)
  ✓ stamina guys in the pen (45+): Satchel Paige 57, Eddie Dixon 65, Garland Buckeye 66
  ✓ C  backup: vs RHP Gabby Hartnett 88 · vs LHP Ed Bailey 97
  ✓ 1B backup: vs RHP Jackie Robinson 80 · vs LHP Charlie Grimm 75
  ✓ 2B backup: vs RHP Specs Clark 123 · vs LHP Pat Patterson 85, Specs Clark 123
  ✓ 3B backup: vs RHP Joe Dugan 63 · vs LHP Pat Patterson 84
  ✓ SS backup: Specs Clark 105
  ✓ LF backup: vs RHP Ed Morgan 61, Ping Bodie 71 · vs LHP Jack Tobin 77, Billy Southworth 115
  ✓ CF backup: vs RHP Vince DiMaggio 100 · vs LHP Billy Southworth 100, Vince DiMaggio 100
  ✓ RF backup: vs RHP Ping Bodie 76 · vs LHP Billy Southworth 100
```

## Tuesday Dead Silver Walking

1919 environment · 1911 Washington Park · saved roster 2382 (load file `upto1969weekly-claude-2026-11-22-bend.txt`)

| Val | Card | Hand | Roles | Projected | Observed (this series) |
|---|---|---|---|---|---|
| 79 | Hank Gowdy | R | bench | -2.3 | vR .257/.336/.345 · vL .254/.337/.330 | 3695 PA, wOBA .303, 2.7 WAR/600 |
| 79 | Emmet Heidrick | L | bench | +1.9 | vR .273/.299/.359 · vL .253/.271/.306 | 10513 PA, wOBA .301, 2.3 WAR/600 |
| 78 | Jack Pfiester | L | SP4 | +6.6 runs, opp .253/.312/.340 | 2161 IP, FIP 3.54, 3.5 WAR/200 |
| 78 | Tillie Walker | R | CF vs LHP; bench vs the other hand | vL +10.4 (glove -3.7) | vR .255/.310/.344 · vL .257/.341/.346 | 17184 PA, wOBA .310, 2.7 WAR/600 |
| 77 | Bill Dahlen | R | bench | -8.8 | vR .244/.292/.320 · vL .247/.293/.321 | 14628 PA, wOBA .291, 2.2 WAR/600 |
| 77 | Willie Keeler | L | RF | vR +12.1 (glove -3.1) · vL +3.5 (glove -3.1) | vR .301/.329/.375 · vL .297/.316/.364 | 21322 PA, wOBA .321, 2.9 WAR/600 |
| 76 | Nick Altrock | L | CL | +6.7 runs, opp .269/.309/.348 | 1604 IP, FIP 3.33, 4.0 WAR/200 |
| 76 | Jack Glasscock | R | SS | vR -6.7 (glove -2.6) · vL -1.2 (glove -2.6) | vR .275/.319/.346 · vL .280/.325/.356 | 3168 PA, wOBA .286, 3.3 WAR/600 |
| 74 | Phil Douglas | R | RP1 | +2.0 runs, opp .267/.315/.354 | 1189 IP, FIP 3.69, 2.9 WAR/200 |
| 74 | Joe Judge | L | 1B | vR +10.2 (glove -0.5) · vL +5.7 (glove -0.5) | vR .274/.337/.363 · vL .266/.335/.350 | 13649 PA, wOBA .331, 2.7 WAR/600 |
| 74 | Jeff Pfeffer | R | SP3 | +6.9 runs, opp .247/.298/.332 | 2169 IP, FIP 3.56, 3.5 WAR/200 |
| 72 | Topsy Hartsel | L | bench | +7.7 | vR .267/.357/.353 · vL .267/.354/.341 | 3359 PA, wOBA .321, 2.6 WAR/600 |
| 72 | Bill Keister | L | 3B | vR +5.8 (glove -11.2) · vL +15.6 (glove -11.2) | vR .286/.311/.377 · vL .295/.334/.376 | 10413 PA, wOBA .319, 2.9 WAR/600 |
| 71 | Pop Corkhill | L | CF vs RHP | vR -7.3 (glove +4.6) | vR .279/.308/.355 · vL .272/.293/.335 | 15475 PA, wOBA .289, 2.5 WAR/600 |
| 71 | Con Daily (VAR) | L | bench | -2.2 | vR .281/.325/.366 · vL .269/.301/.332 | 1368 PA, wOBA .300, 2.2 WAR/600 |
| 70 | Kid Madden | L | SP1 | +8.8 runs, opp .259/.304/.347 | 1033 IP, FIP 3.41, 3.8 WAR/200 |
| 66 | Tom Brown | L | LF vs RHP | vR +20.9 (glove -6.5) | vR .287/.348/.381 · vL .281/.336/.363 | 9688 PA, wOBA .334, 3.2 WAR/600 |
| 66 | Bill Sweeney | R | 2B vs LHP; bench vs the other hand | vL +8.5 (glove -4.4) | vR .265/.324/.331 · vL .282/.340/.346 | 1340 PA, wOBA .301, 2.6 WAR/600 |
| 65 | Bill Duggleby | R | SP2 | +8.2 runs, opp .258/.292/.346 | 1586 IP, FIP 3.53, 3.5 WAR/200 |
| 65 | Christy Mathewson | R | RP2 | +5.2 runs, opp .266/.299/.353 | 7313 IP, FIP 3.61, 3.3 WAR/200 |
| 64 | Pretzels Getzien | R | RP3 | +3.6 runs, opp .273/.322/.361 | 122 IP, FIP 3.67, 2.6 WAR/200 |
| 64 | Bill Killefer | R | C | vR -8.7 (glove +3.2) · vL -6.8 (glove +3.2) | vR .271/.318/.332 · vL .273/.324/.331 | 920 PA, wOBA .290, 2.5 WAR/600 |
| 61 | Jack Tobin | L | bench | +13.5 | vR .299/.353/.375 · vL .284/.315/.337 | 4750 PA, wOBA .320, 2.2 WAR/600 |
| 60 | Davy Jones | L | LF vs LHP; bench vs the other hand | vL +6.4 (glove -0.1) | vR .276/.357/.335 · vL .275/.352/.329 | 1302 PA, wOBA .331, 3.3 WAR/600 |
| 59 | Big Jeff Pfeffer | R | RP4 | +3.3 runs, opp .262/.330/.345 | 43 IP, FIP 3.31, 3.7 WAR/200 |
| 50 | Nap Lajoie (VAR) | R | 2B vs RHP | vR +0.9 (glove +4.2) | vR .271/.301/.351 · vL .239/.282/.314 | 2284 PA, wOBA .282, 3.1 WAR/600 |

Total value 1818. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.

**vs RHP:** Tom Brown LF · Joe Judge 1B · Bill Keister 3B · Willie Keeler RF · Pop Corkhill CF · Jack Glasscock SS · Bill Killefer C · Nap Lajoie (VAR) 2B · Pitcher

**vs LHP:** Davy Jones LF · Tillie Walker CF · Joe Judge 1B · Bill Keister 3B · Willie Keeler RF · Bill Sweeney 2B · Jack Glasscock SS · Bill Killefer C · Pitcher

Dead Silver Walking: pre-1930, 4 SP / 5 RP, no DH.

```
--- rotation ---
SP1     Kid Madden                  70  L  1888    +8.8 fld  +8.1   SP STM 101  #87348
SP2     Bill Duggleby               65  R  1901    +8.2 fld  +7.5   SP STM 105  #87335
SP3     Jeff Pfeffer                74  R  1914    +6.9 fld  +6.2   SP STM 102  #87350
SP4     Jack Pfiester               78  R  1906    +6.6 fld  +6.0   SP STM 103  #87351
--- bullpen ---
CL      Nick Altrock                76  S  1906    +6.7 fld  +6.1   SP STM  90  #87049
RP1     Phil Douglas                74  R  1917    +2.0 fld  +1.4   SP STM  68  #83311
RP2     Christy Mathewson           65  R  1914    +5.2 fld  +4.5   SP STM 102  #86706
RP3     Pretzels Getzien            64  R  1888    +3.6 fld  +3.0   SP STM  90  #85139
RP4     Big Jeff Pfeffer            59  R  1906    +3.3 fld  +2.7   SP STM  98  #87340
--- roster check ---
  ✓ staff 4 SP / 5 RP / 17 bats (caps: 5 SP, 7 RP, 12 arms) · field's best quarter (196 teams): 4.2 SP / 4.1 RP / 16.4 bats
  ✓ starters' stamina Kid Madden 101, Bill Duggleby 105, Jeff Pfeffer 102, Jack Pfiester 103 (era floor 80)
  ✓ stamina guys in the pen (45+): Nick Altrock 90, Phil Douglas 68, Christy Mathewson 102, Pretzels Getzien 90, Big Jeff Pfeffer 98
  ✓ C  backup: Hank Gowdy 80, Con Daily 82
  ✓ 1B backup: vs RHP Con Daily 83 · vs LHP Nap Lajoie 103, Pop Corkhill 66, Con Daily 83
  ✓ 2B backup: vs RHP Bill Sweeney 104, Bill Dahlen 103 · vs LHP Nap Lajoie 122, Bill Dahlen 103
  ✓ 3B backup: Bill Dahlen 89
  ✓ SS backup: Bill Dahlen 86
  ✓ LF backup: vs RHP Tillie Walker 117, Davy Jones 95, Topsy Hartsel 64, Jack Tobin 77 · vs LHP Pop Corkhill 147, Tom Brown 68, Topsy Hartsel 64, Jack Tobin 77
  ✓ CF backup: vs RHP Tillie Walker 97 · vs LHP Pop Corkhill 133
  ✓ RF backup: vs RHP Emmet Heidrick 98 · vs LHP Pop Corkhill 145, Emmet Heidrick 98
```

