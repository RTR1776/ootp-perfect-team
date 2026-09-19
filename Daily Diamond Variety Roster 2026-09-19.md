# Saturday Diamond Variety — 2026-09-19

1975 RE · 1981 Metropolitan Stadium · NO DH · Diamond or lower · Negro League Star + Future Legend + Snapshot only (card_type 2/6/7) · 128 teams Bo7 · start 7:59pm

    pnpm env:roster --series diamondvariety --year 1975 --park "Metropolitan Stadium" \
      --park-year 1981 --min 40 --max 99 --card-types 2,6,7 \
      --min-pos "70,1B:0,LF:50,C:65" --size 26 --optimize --role-trust 0.25 --starts 12


=== Diamond Variety + Gibson ===
1975 RE @ 1981 Metropolitan Stadium · DH off · value 40–99 · cap none · 26 players
R/G 4.44  AVG 0.263  OBP 0.333  SLG 0.382  K% 13.0  HR/PA 1.89%  preset Traditional
sac bunt (1st & 2nd, 0 out) +0.041 runs · steal break-even 79.0% (0 out) / 75.6% (1 out)
park: all-LHB lineup 4.54 R/G vs all-RHB 4.38 — 0.16 R/G swing toward LEFT-handed bats
card types: restricted to 2, 6, 7 (2 Negro League Star, 6 Future Legend, 7 Snapshot)

pool: 1152 eligible owned cards — 668 bats (239L / 68S / 361R), 484 arms
field (diamondvariety, 3 exports): 43% of batters faced thrown left-handed · 46% of PA by left-handed bats · 14.1 bats / 5.9 SP / 4.8 RP per team
shape: 14 bats / 6 SP / 6 RP (1960s–70s) · out-of-position guard 60% of best · glove floor 70 (1B 0, LF 50, C 65) · defence priced in runs (fielding.json)
observed play: 1148 of 1152 pool cards have innings on record (median 1518 PA/BF); K = 5000

+10 rating, runs/700 PA — LHB: Power +3.3  BABIP +2.2  Avoid Ks +1.8  Eye +1.5  Gap +0.9
                          RHB: Power +3.1  BABIP +2.1  Avoid Ks +1.7  Eye +1.4  Gap +0.9
                         arms: pBABIP +1.2  pHR +1.1  Control +1.0  Stuff +0.9

optimiser: 11 λ starts hill-climbed; best 187.1 runs vs 168.3 greedy (+18.8), 32 moves from λ 1.33

--- lineup vs RHP ---   (name, value, bats, year, runs/700 PA on this board)
R:C     Tom Young                   91  L  1929    +7.1  park:L DEF  67/ 67 -0.7
R:1B    Shoeless Joe Jackson        88  L  1915   +20.4  park:L DEF  73/ 88 -0.5
R:2B    Aidan Miller                98  R  2026    +8.8  park:R DEF 123/123 +1.5
R:3B    Hank Thompson               87  L  1953   +14.3  park:L DEF  92/ 92 +0.1
R:SS    Honus Wagner                99  R  1903   +14.3  park:R DEF 113/114 +0.9
R:LF    Al Simmons                  99  R  1930   +15.8  park:R DEF  90/ 90 -0.4
R:CF    Jon Nunnally                82  L  1997    +9.8  park:L DEF  87/100 -1.5
R:RF    Chick Stahl                 93  L  1899   +15.3  park:L DEF 126/129 +2.4

--- lineup vs LHP ---
L:C     Josh Gibson                 84  R  1946    +9.3  park:R DEF  69/ 75 -0.7
L:1B    Josh Vitters                95  R  2012   +15.9  park:R DEF  92/ 92 +1.9
L:2B    Aidan Miller                98  R  2026   +12.8  park:R DEF 123/123 +1.5
L:3B    Arjun Nimmala (VAR)         94  R  2026    +9.1  park:R DEF 128/128 +4.9
L:SS    Honus Wagner                99  R  1903   +13.5  park:R DEF 113/114 +0.9
L:LF    Al Simmons                  99  R  1930   +26.2  park:R DEF  90/ 90 -0.4
L:CF    Chick Stahl                 93  L  1899   +14.6  park:L DEF 111/129 -0.1
L:RF    Shoeless Joe Jackson        88  L  1915   +12.9  park:L DEF  83/ 88 -1.3

--- rotation ---
SP1     J.A. Happ                   87  L  2015   +12.3   SP STM  62
SP2     Sam Jones                   92  R  1921    +8.7   SP STM  82
SP3     Connelly Early              96  L  2026    +7.6   SP STM  75
SP4     Jordan Montgomery           77  L  2023    +7.6   SP STM  87
SP5     Payton Tolle                99  L  2026    +8.2   SP STM  70
SP6     Larry Jackson               92  R  1959    +9.2   SP STM  92

--- bullpen ---
CL      Joe Sambito                 98  L  1980    +8.8   RP STM  24
RP1     Noah Schultz                92  L  2026    +6.9   SP STM  56
RP2     Andrew Miller               99  L  2016    +7.1   RP STM  13
RP3     Shane Reynolds              81  R  1999    +6.7   SP STM  79
RP4     Gary Lucas                  86  L  1986    +7.3   RP STM  24
RP5     Jake McGee (VAR)            99  L  2012    +8.9   RP STM  12

--- bench ---
BN1     Josh Vitters                95  R  2012    +5.6  park:R
BN2     Larry Doby                  98  L  1946   +13.0  park:L
BN3     Arjun Nimmala (VAR)         94  R  2026    +6.4  park:R
BN4     Gus Bell                    70  L  1955   +12.8  park:L
BN5     Ethan Holliday              95  L  2026   +13.8  park:L
BN6     Josh Gibson                 84  R  1946    +5.1  park:R

26 players · value 2371 · λ 1.333 · 2 variants
vs RHP lineup gets the friendly park side in 5 of 8 spots

--- order inputs (rostered bats) ---
  Shoeless Joe Jackson   L EYE  95 (86/99)  POW  74 (77/73)  K 188  BABIP 127  GAP 122  SPE  81
  Al Simmons             R EYE  65 (85/58)  POW 120 (129/117)  K 132  BABIP 141  GAP 128  SPE  61
  Chick Stahl            L EYE 112 (90/122)  POW  86 (92/85)  K 149  BABIP 116  GAP 105  SPE  80
  Hank Thompson          L EYE 139 (108/150)  POW 125 (91/138)  K 102  BABIP  76  GAP  78  SPE  78
  Honus Wagner           R EYE  79 (72/81)  POW  89 (100/86)  K 165  BABIP 120  GAP 118  SPE  93
  Ethan Holliday         L EYE 152 (140/156)  POW 129 (108/136)  K  66  BABIP 105  GAP  95  SPE  51
  Larry Doby             L EYE  87 (90/86)  POW 105 (101/107)  K  72  BABIP 129  GAP 134  SPE  62
  Gus Bell               L EYE  72 (61/76)  POW 103 (71/118)  K 105  BABIP  91  GAP  92  SPE  59
  Jon Nunnally           L EYE 114 (82/128)  POW 110 (77/125)  K  57  BABIP 125  GAP  97  SPE  75
  Aidan Miller           R EYE 156 (176/149)  POW 145 (152/143)  K  77  BABIP  94  GAP  96  SPE  93
  Tom Young              L EYE  83 (83/84)  POW  96 (77/104)  K  95  BABIP  97  GAP 114  SPE  67
  Arjun Nimmala          R EYE 108 (113/106)  POW 140 (142/139)  K  89  BABIP 126  GAP 126  SPE  72
  Josh Vitters           R EYE  64 (77/60)  POW  94 (108/90)  K 121  BABIP 127  GAP 133  SPE  55
  Josh Gibson            R EYE  79 (84/78)  POW 153 (161/151)  K  70  BABIP  83  GAP 138  SPE  56
LEGAL — every rule check passes
(25 of 26 have a live ask in the last shop snapshot)
objective: 187.1 weighted runs (bats 57/43 R/L, SP 1.0, RP 0.31, bench 0.1)
points: lineup(both boards, 11 bats) 1010 · rotation 543 · bullpen 555 · bench-only 263

!! ratings past the curves' fitted range — the model extrapolates here, treat the number as a direction not a measurement:
   Shane Reynolds           pBABIP 47 (fitted 50–175)
EXIT 0
