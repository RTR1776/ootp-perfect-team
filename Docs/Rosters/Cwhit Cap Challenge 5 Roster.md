# Cwhit Cap Challenge 5 — roster (v2, current eligible export)

Pool: Inbox/cap-challenge-5-eligible.csv (249 rows, all matched). Schmidt carried on purpose.

```
pnpm env:roster --pool "Inbox/cap-challenge-5-eligible.csv" --year 1979 \
  --park "Louisville Slugger Field" --park-year 2026 --dh --min 90 --max 100 \
  --cap 2444 --size 26 --optimize --must "Mike Schmidt"
```

## Recommended (54.6 weighted runs)
```

=== Cap 5 — Schmidt forced ===
1979 RE @ 2026 Louisville Slugger Field · DH on · value 90–100 · cap 2444 · 26 players
R/G 4.38  AVG 0.261  OBP 0.327  SLG 0.392  K% 12.5  HR/PA 2.14%  preset Traditional
park: all-LHB lineup 5.09 R/G vs all-RHB 4.03 — 1.06 R/G swing toward LEFT-handed bats
pool from export: 249 rows -> 242 distinct cards; all matched

pool: 242 eligible owned cards — 146 bats (49L / 16S / 81R), 96 arms
shape: 15 bats / 5 SP / 6 RP (1960s–70s) · out-of-position guard 60% of best

+10 rating, runs/700 PA — LHB: Power +3.2  Eye +1.9  Avoid Ks +1.8  BABIP +1.8  Gap +0.9
                          RHB: Power +2.4  Eye +1.7  Avoid Ks +1.4  BABIP +1.4  Gap +0.9
                         arms: pHR +1.8  Control +1.2  Stuff +1.1  pBABIP +1.0
must carry: Mike Schmidt -> 1 matched

optimiser: 9 λ starts hill-climbed; best 54.6 runs vs -981.1 greedy (+1035.7), 13 moves from λ 4.50

--- lineup vs RHP ---   (name, value, bats, year, runs/700 PA on this board)
R:C     Ed Bailey (VAR)             97  L  1956   +28.1  park:L DEF 104/104
R:1B    Carlos Delgado              98  L  2000   +13.5  park:L DEF  49/ 49
R:2B    Bryce Rainer                92  L  2026    +2.6  park:L DEF  96/ 96
R:3B    Eddie Yost                  92  R  1959   +15.7  park:R DEF  76/ 76
R:SS    Arjun Nimmala (VAR)         94  R  2026    +2.5  park:R DEF 108/119
R:LF    Carlos Lee                  92  R  2006    +0.2  park:R DEF  55/ 55
R:CF    Chick Stahl                 93  L  1899    -2.5  park:L DEF 111/129
R:RF    Darryl Strawberry           97  L  1987    +8.4  park:L DEF  70/ 70
R:DH    Mike Schmidt                99  R  1977    -1.2  park:R

--- lineup vs LHP ---
L:C     Jason Kendall               91  R  1998   -11.1  park:R DEF  64/ 64
L:1B    Mark Loretta                90  R  2004    -4.7  park:R DEF  89/109
L:2B    Mike Schmidt                99  R  1977   +10.5  park:R DEF 103/109
L:3B    Eddie Yost                  92  R  1959   +16.5  park:R DEF  76/ 76
L:SS    Arjun Nimmala (VAR)         94  R  2026    +7.1  park:R DEF 108/119
L:LF    Carlos Lee                  92  R  2006    -7.6  park:R DEF  55/ 55
L:CF    Ryan Waldschmidt (VAR)      94  R  2026    -0.6  park:R DEF  91/110
L:RF    Chick Stahl                 93  L  1899    -5.6  park:L DEF 126/129
L:DH    Barry Larkin                93  R  1991    +7.1  park:R

--- rotation ---
SP1     Tommy John                  92  R  1979    +3.3  
SP2     Barry Zito                  92  L  2003    -0.4  
SP3     Sam Jones                   92  R  1921    -1.3  
SP4     Tyler Anderson              95  L  2022    +0.8  
SP5     Josh Johnson               100  L  2010    +5.5  

--- bullpen ---
CL      Andrew Bailey               94  R  2009    -1.7  
RP1     Pedro Borbon                92  R  1996    -3.6  
RP2     Larry Jackson               92  R  1959    -2.2  
RP3     Milt Pappas                 96  R  1959    +0.3  
RP4     Craig Kimbrel              100  R  2012   +11.3  
RP5     Thomas White                97  L  2026    +0.7  

--- bench ---
BN1     Ryan Howard                 90  L  2006    +0.7  park:L
BN2     Ryan Waldschmidt (VAR)      94  R  2026    -5.1  park:R
BN3     Edouard Julien              90  L  2023    -6.1  park:L
BN4     Barry Larkin                93  R  1991   -19.4  park:R
BN5     Jason Kendall               91  R  1998   -22.3  park:R
BN6     Mark Loretta                90  R  2004   -10.7  park:R

26 players · value 2444 / 2444 (0 spare) · λ 4.500 · 3 variants
vs RHP lineup gets the friendly park side in 5 of 9 spots
LEGAL — every rule check passes
(24 of 26 have a live ask in the last shop snapshot)
objective: 54.6 weighted runs (bats 70/30 R/L, SP 1.0, RP 0.5, bench 0.1)
points: lineup(both boards, 13 bats) 1222 · rotation 471 · bullpen 571 · bench-only 180

!! ratings past the curves' fitted range — the model extrapolates here, treat the number as a direction not a measurement:
   Ed Bailey                Power 166 (fitted 4–160)
   Eddie Yost               Eye 277 (fitted 37–204)
   Ryan Howard              Avoid Ks 49 (fitted 60–230)
```

## Without Schmidt (52.0) — what the optimiser reaches on its own
```

=== Cap 5 — default weights ===
1979 RE @ 2026 Louisville Slugger Field · DH on · value 90–100 · cap 2444 · 26 players
R/G 4.38  AVG 0.261  OBP 0.327  SLG 0.392  K% 12.5  HR/PA 2.14%  preset Traditional
park: all-LHB lineup 5.09 R/G vs all-RHB 4.03 — 1.06 R/G swing toward LEFT-handed bats
pool from export: 249 rows -> 242 distinct cards; all matched

pool: 242 eligible owned cards — 146 bats (49L / 16S / 81R), 96 arms
shape: 15 bats / 5 SP / 6 RP (1960s–70s) · out-of-position guard 60% of best

+10 rating, runs/700 PA — LHB: Power +3.2  Eye +1.9  Avoid Ks +1.8  BABIP +1.8  Gap +0.9
                          RHB: Power +2.4  Eye +1.7  Avoid Ks +1.4  BABIP +1.4  Gap +0.9
                         arms: pHR +1.8  Control +1.2  Stuff +1.1  pBABIP +1.0

optimiser: 9 λ starts hill-climbed; best 52.0 runs vs 18.9 greedy (+33.1), 11 moves from λ 8.00

--- lineup vs RHP ---   (name, value, bats, year, runs/700 PA on this board)
R:C     Ed Bailey (VAR)             97  L  1956   +28.1  park:L DEF 104/104
R:1B    Carlos Delgado              98  L  2000   +13.5  park:L DEF  49/ 49
R:2B    Bryce Rainer                92  L  2026    +2.6  park:L DEF  96/ 96
R:3B    Eddie Yost                  92  R  1959   +15.7  park:R DEF  76/ 76
R:SS    Arjun Nimmala (VAR)         94  R  2026    +2.5  park:R DEF 108/119
R:LF    Carlos Lee                  92  R  2006    +0.2  park:R DEF  55/ 55
R:CF    Mickey Moniak              100  L  2020    +8.2  park:L DEF 119/131
R:RF    Darryl Strawberry           97  L  1987    +8.4  park:L DEF  70/ 70
R:DH    Ryan Howard                 90  L  2006    +0.7  park:L

--- lineup vs LHP ---
L:C     Jason Kendall               91  R  1998   -11.1  park:R DEF  64/ 64
L:1B    Felipe Alou                 92  R  1966    -7.6  park:R DEF  70/116
L:2B    Chuck Knoblauch             95  R  1996    -3.0  park:R DEF 113/113
L:3B    Eddie Yost                  92  R  1959   +16.5  park:R DEF  76/ 76
L:SS    Mark Loretta                90  R  2004    -4.7  park:R DEF  84/109
L:LF    Carlos Lee                  92  R  2006    -7.6  park:R DEF  55/ 55
L:CF    Ryan Waldschmidt (VAR)      94  R  2026    -0.6  park:R DEF  91/110
L:RF    Jimmy Wynn                  91  R  1972    -6.3  park:R DEF  57/ 57
L:DH    Arjun Nimmala (VAR)         94  R  2026    +7.1  park:R

--- rotation ---
SP1     Tommy John                  92  R  1979    +3.3  
SP2     Barry Zito                  92  L  2003    -0.4  
SP3     Sam Jones                   92  R  1921    -1.3  
SP4     Josh Johnson               100  L  2010    +5.5  
SP5     Tyler Anderson              95  L  2022    +0.8  

--- bullpen ---
CL      Andrew Bailey               94  R  2009    -1.7  
RP1     Larry Jackson               92  R  1959    -2.2  
RP2     Milt Pappas                 96  R  1959    +0.3  
RP3     Craig Kimbrel              100  R  2012   +11.3  
RP4     Pedro Borbon                92  R  1996    -3.6  
RP5     Matt Anderson               94  R  1998    -2.9  

--- bench ---
BN1     Mark Loretta                90  R  2004   -10.7  park:R
BN2     Ryan Waldschmidt (VAR)      94  R  2026    -5.1  park:R
BN3     Felipe Alou                 92  R  1966   -11.1  park:R
BN4     Chuck Knoblauch             95  R  1996    -6.7  park:R
BN5     Jimmy Wynn                  91  R  1972   -16.4  park:R
BN6     Jason Kendall               91  R  1998   -22.3  park:R

26 players · value 2444 / 2444 (0 spare) · λ 8.000 · 3 variants
vs RHP lineup gets the friendly park side in 6 of 9 spots
LEGAL — every rule check passes
(23 of 26 have a live ask in the last shop snapshot)
objective: 52.0 weighted runs (bats 70/30 R/L, SP 1.0, RP 0.5, bench 0.1)
points: lineup(both boards, 15 bats) 1405 · rotation 471 · bullpen 568 · bench-only 0

!! ratings past the curves' fitted range — the model extrapolates here, treat the number as a direction not a measurement:
   Ed Bailey                Power 166 (fitted 4–160)
   Eddie Yost               Eye 277 (fitted 37–204)
   Ryan Howard              Avoid Ks 49 (fitted 60–230)
   Felipe Alou              Eye 36 (fitted 37–204)
```

## LHP 40% / thin bullpen variant (47.2 on its own objective)
```

=== Cap 5 — LHP 40%, thin pen ===
1979 RE @ 2026 Louisville Slugger Field · DH on · value 90–100 · cap 2444 · 26 players
R/G 4.38  AVG 0.261  OBP 0.327  SLG 0.392  K% 12.5  HR/PA 2.14%  preset Traditional
park: all-LHB lineup 5.09 R/G vs all-RHB 4.03 — 1.06 R/G swing toward LEFT-handed bats
pool from export: 249 rows -> 242 distinct cards; all matched

pool: 242 eligible owned cards — 146 bats (49L / 16S / 81R), 96 arms
shape: 15 bats / 5 SP / 6 RP (1960s–70s) · out-of-position guard 60% of best

+10 rating, runs/700 PA — LHB: Power +3.2  Eye +1.9  Avoid Ks +1.8  BABIP +1.8  Gap +0.9
                          RHB: Power +2.4  Eye +1.7  Avoid Ks +1.4  BABIP +1.4  Gap +0.9
                         arms: pHR +1.8  Control +1.2  Stuff +1.1  pBABIP +1.0

optimiser: 9 λ starts hill-climbed; best 47.2 runs vs 11.2 greedy (+36.0), 13 moves from λ 4.50

--- lineup vs RHP ---   (name, value, bats, year, runs/700 PA on this board)
R:C     Ed Bailey (VAR)             97  L  1956   +28.1  park:L DEF 104/104
R:1B    Ryan Howard                 90  L  2006    +0.7  park:L DEF  47/ 47
R:2B    Bryce Rainer                92  L  2026    +2.6  park:L DEF  96/ 96
R:3B    Eddie Yost                  92  R  1959   +15.7  park:R DEF  76/ 76
R:SS    Arjun Nimmala (VAR)         94  R  2026    +2.5  park:R DEF 108/119
R:LF    Carlos Lee                  92  R  2006    +0.2  park:R DEF  55/ 55
R:CF    Chick Stahl                 93  L  1899    -2.5  park:L DEF 111/129
R:RF    Darryl Strawberry           97  L  1987    +8.4  park:L DEF  70/ 70
R:DH    Carlos Delgado              98  L  2000   +13.5  park:L

--- lineup vs LHP ---
L:C     Jason Kendall               91  R  1998   -11.1  park:R DEF  64/ 64
L:1B    Joe Adcock                  95  R  1956    -1.8  park:R DEF  99/ 99
L:2B    Mark Loretta                90  R  2004    -4.7  park:R DEF 109/109
L:3B    Eddie Yost                  92  R  1959   +16.5  park:R DEF  76/ 76
L:SS    Arjun Nimmala (VAR)         94  R  2026    +7.1  park:R DEF 108/119
L:LF    Carlos Lee                  92  R  2006    -7.6  park:R DEF  55/ 55
L:CF    Ryan Waldschmidt (VAR)      94  R  2026    -0.6  park:R DEF  91/110
L:RF    Chick Stahl                 93  L  1899    -5.6  park:L DEF 126/129
L:DH    Barry Larkin                93  R  1991    +7.1  park:R

--- rotation ---
SP1     Tommy John                  92  R  1979    +3.3  
SP2     Doug Fister                 98  L  2011    +2.5  
SP3     Cliff Lee                  100  L  2011    +4.4  
SP4     Tyler Anderson              95  L  2022    +0.8  
SP5     Josh Johnson               100  L  2010    +5.5  

--- bullpen ---
CL      Andrew Bailey               94  R  2009    -1.7  
RP1     Sam Jones                   92  R  1921    -1.3  
RP2     Hal Haid                    91  R  1928    -8.6  
RP3     Larry Jackson               92  R  1959    -2.2  
RP4     Craig Kimbrel              100  R  2012   +11.3  
RP5     Barry Zito                  92  L  2003    -0.4  

--- bench ---
BN1     Mark Loretta                90  R  2004   -10.7  park:R
BN2     Ryan Waldschmidt (VAR)      94  R  2026    -5.1  park:R
BN3     Edouard Julien              90  L  2023    -6.1  park:L
BN4     Barry Larkin                93  R  1991   -19.4  park:R
BN5     Jason Kendall               91  R  1998   -22.3  park:R
BN6     Joe Adcock                  95  R  1956   -33.6  park:R

26 players · value 2444 / 2444 (0 spare) · λ 4.500 · 3 variants
vs RHP lineup gets the friendly park side in 6 of 9 spots
LEGAL — every rule check passes
(25 of 26 have a live ask in the last shop snapshot)
objective: 47.2 weighted runs (bats 60/40 R/L, SP 1.0, RP 0.25, bench 0.1)
points: lineup(both boards, 14 bats) 1308 · rotation 485 · bullpen 561 · bench-only 90

!! ratings past the curves' fitted range — the model extrapolates here, treat the number as a direction not a measurement:
   Ed Bailey                Power 166 (fitted 4–160)
   Eddie Yost               Eye 277 (fitted 37–204)
   Ryan Howard              Avoid Ks 49 (fitted 60–230)
```
