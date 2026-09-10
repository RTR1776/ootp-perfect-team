# Cwhit Cap Challenge 5 — roster

Built 2026-09-10 by `pnpm env:roster` (web/scripts/env-roster.ts). Scored by the /runenv model — era + ballpark, no observed stats — then hill-climbed under the cap. Rerun with:

```
pnpm env:roster --year 1979 --park "Louisville Slugger Field" --park-year 2026 \
  --dh --min 90 --max 100 --cap 2444 --size 26 --name "Cwhit Cap Challenge 5" --optimize
```

```

=== Cwhit Cap Challenge 5 ===
1979 RE @ 2026 Louisville Slugger Field · DH on · value 90–100 · cap 2444 · 26 players
R/G 4.38  AVG 0.261  OBP 0.327  SLG 0.392  K% 12.5  HR/PA 2.14%  preset Traditional
park: all-LHB lineup 5.09 R/G vs all-RHB 4.03 — 1.06 R/G swing toward LEFT-handed bats

pool: 276 eligible owned cards — 159 bats (55L / 19S / 85R), 117 arms
shape: 15 bats / 5 SP / 6 RP (1960s–70s) · out-of-position guard 60% of best

+10 rating, runs/700 PA — LHB: Power +3.2  Eye +1.9  Avoid Ks +1.8  BABIP +1.8  Gap +0.9
                          RHB: Power +2.4  Eye +1.7  Avoid Ks +1.4  BABIP +1.4  Gap +0.9
                         arms: pHR +1.8  Control +1.2  Stuff +1.1  pBABIP +1.0

optimiser: 11 λ starts hill-climbed; best 45.1 runs vs 6.9 greedy (+38.1), 14 moves from λ 8.00

--- lineup vs RHP ---   (name, value, bats, year, runs/700 PA on this board)
R:C     Ed Bailey (VAR)             97  L  1956   +28.1  park:L DEF 104/104
R:1B    Carlos Delgado              98  L  2000   +13.5  park:L DEF  49/ 49
R:2B    Bryce Rainer                92  L  2026    +2.6  park:L DEF  96/ 96
R:3B    Eddie Yost                  92  R  1959   +15.7  park:R DEF  76/ 76
R:SS    Arjun Nimmala               94  R  2026    -5.0  park:R DEF 108/119
R:LF    Carlos Lee                  92  R  2006    +0.2  park:R DEF  55/ 55
R:CF    Mickey Moniak              100  L  2020    +8.2  park:L DEF 119/131
R:RF    Darryl Strawberry           97  L  1987    +8.4  park:L DEF  70/ 70
R:DH    Ryan Howard                 90  L  2006    +0.7  park:L

--- lineup vs LHP ---
L:C     Jason Kendall               91  R  1998   -11.1  park:R DEF  64/ 64
L:1B    Felipe Alou                 92  R  1966    -7.6  park:R DEF  70/116
L:2B    Eddie Yost                  92  R  1959   +16.5  park:R DEF  72/ 76
L:3B    Arjun Nimmala               94  R  2026    -0.5  park:R DEF 119/119
L:SS    Mark Loretta                90  R  2004    -4.7  park:R DEF  84/109
L:LF    Carlos Lee                  92  R  2006    -7.6  park:R DEF  55/ 55
L:CF    Ryan Waldschmidt (VAR)      94  R  2026    -0.6  park:R DEF  91/110
L:RF    Jimmy Wynn                  91  R  1972    -6.3  park:R DEF  57/ 57
L:DH    Barry Larkin                93  R  1991    +7.1  park:R

--- rotation ---
SP1     Tommy John                  92  R  1979    +3.3  
SP2     Barry Zito                  92  L  2003    -0.4  
SP3     Cliff Lee                  100  L  2011    +4.4  
SP4     Josh Johnson               100  L  2010    +5.5  
SP5     Tyler Anderson              95  L  2022    +0.8  

--- bullpen ---
CL      Andrew Bailey               94  R  2009    -1.7  
RP1     Sam Jones                   92  R  1921    -1.3  
RP2     Al Leiter                   90  L  1996   -10.0  
RP3     Milt Pappas                 96  R  1959    +0.3  
RP4     Larry Jackson               92  R  1959    -2.2  
RP5     Doug Fister                 98  L  2011    +2.5  

--- bench ---
BN1     Mark Loretta                90  R  2004   -10.7  park:R
BN2     Felipe Alou                 92  R  1966   -11.1  park:R
BN3     Ryan Waldschmidt (VAR)      94  R  2026    -5.1  park:R
BN4     Jimmy Wynn                  91  R  1972   -16.4  park:R
BN5     Barry Larkin                93  R  1991   -19.4  park:R
BN6     Jason Kendall               91  R  1998   -22.3  park:R

26 players · value 2444 / 2444 (0 spare) · λ 8.000 · 2 variants
vs RHP lineup gets the friendly park side in 6 of 9 spots
LEGAL — every rule check passes
(23 of 26 have a live ask in the last shop snapshot)
objective: 45.1 weighted runs (bats 70/30 R/L, SP full, RP half, bench a tenth)

!! ratings past the curves' fitted range — the model extrapolates here, treat the number as a direction not a measurement:
   Ed Bailey                Power 166 (fitted 4–160)
   Eddie Yost               Eye 277 (fitted 37–204)
   Ryan Howard              Avoid Ks 49 (fitted 60–230)
   Felipe Alou              Eye 36 (fitted 37–204)
```
