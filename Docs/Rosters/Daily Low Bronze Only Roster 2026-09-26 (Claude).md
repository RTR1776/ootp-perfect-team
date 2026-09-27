# Daily Low Bronze Only — Claude pick, 2026-09-26

1955 RE, 1955 Ebbets Field, no DH, cards 60–64, variant cap 12, 64 teams, Bo5 (finals Bo7). Catalogue row 519 matches. 5 SP / 7 RP as in L.J.'s Bo7 builds; the field runs about 4.6 SP / 3.7 RP.

Load file: `Inbox/rosters/lowbronzeonly-claude-2026-09-26.txt`. Each card is pinned by id. `Save 09-26 Rosters.command` on the Mac saves it to /build as "Claude pick 2026-09-26".

    node --import tsx scripts/env-roster.ts --year 1955 --park "Ebbets Field" --park-year 1955 --min 60 --max 64 \
      --variant-cap 12 --size 26 --series lowbronzeonlydaily --optimize --starts 8 --sp 5 --rp 7 --bats 14 \
      --role-trust 0.25 --name "Daily Low Bronze Only"

−31.6 weighted runs (greedy −62.4; every card in the window is below league average, so read the numbers against each other) · legal · value 1,637 · 4 variants · two catchers · field 40% LHP (2 exports). Assenmacher (pBABIP 37) and Hunter (49) are past the curves' fitted range: their numbers are a direction, not a measurement.

```
vs RHP:
  C   Damon Berryhill               61 S   -16.4   glove 84 (-0.2)
  1B  Edward Florentino (VAR)       63 L    +8.8   glove 91 (+1.8)
  2B  Willie Randolph               60 R   -16.2   glove 118 (+0.7)
  3B  Kyle Seager                   64 L    -3.9   glove 116 (+3.3)
  SS  Jhonny Level (VAR)            64 S    -0.3   glove 94 (-1.8)
  LF  Bill Buckner (VAR)            64 L    +6.3   glove 68 (-2.2)
  CF  Jett Williams                 62 R   -14.0   glove 87 (-1.5)
  RF  Jack Tobin                    61 L    +5.5   glove 73 (-2.2)

vs LHP:
  C   Yadier Molina                 62 R   -12.6   glove 122 (+1.0)
  1B  Mark Bellhorn                 64 S   +11.8   glove 82 (+0.7)
  2B  Willie Randolph               60 R    -7.0   glove 118 (+0.7)
  3B  Jett Williams                 62 R    +1.7   glove 83 (-1.1)
  SS  Jhonny Level (VAR)            64 S    -4.7   glove 94 (-1.8)
  LF  Aaron Hicks                   63 S    -7.9   glove 69 (-2.1)
  CF  Byron Buxton                  64 R    +2.4   glove 122 (+0.5)
  RF  Joe Carter                    64 R    -0.4   glove 104 (+0.5)

Rotation:
  SP1 Roy Halladay                  61 R    -0.2   STM 73
  SP2 Bruce Hurst                   64 L    +1.3   STM 86
  SP3 Fritz Ostermueller            64 L    +7.3   STM 98
  SP4 Kyson Witherspoon (VAR)       63 R    -0.8   STM 59
  SP5 Jack Kralick                  64 L    -1.1   STM 83
Bullpen:
  CL  Caden Scarborough             64 R    -1.6   STM 46
  RP1 Nelson Chittum                61 R    -1.4   STM 24
  RP2 Paul Assenmacher              62 L    -1.7   STM 17
  RP3 Grant Wolfram                 64 L    -0.2   STM 19
  RP4 Hoby Milner                   62 L    -2.4   STM 15
  RP5 Tommy Hunter                  64 R    -1.0   STM 17
  RP6 Enyel De Los Santos           64 R    -2.4   STM 17
Bench only: Jim Thome (64, L, +4.7 vs RHP)

By value (26 cards, 4 variants):
   1.  64  Bill Buckner               LF  ← VARIANT
   2.  64  Bruce Hurst                SP
   3.  64  Byron Buxton               CF
   4.  64  Caden Scarborough          RP
   5.  64  Enyel De Los Santos        RP
   6.  64  Fritz Ostermueller         SP
   7.  64  Grant Wolfram              RP
   8.  64  Jack Kralick               SP
   9.  64  Jhonny Level               SS  ← VARIANT
  10.  64  Jim Thome                  BN
  11.  64  Joe Carter                 RF
  12.  64  Kyle Seager                3B
  13.  64  Mark Bellhorn              1B
  14.  64  Tommy Hunter               RP
  15.  63  Aaron Hicks                LF
  16.  63  Edward Florentino          1B  ← VARIANT
  17.  63  Kyson Witherspoon          SP  ← VARIANT
  18.  62  Hoby Milner                RP
  19.  62  Jett Williams              CF/3B
  20.  62  Paul Assenmacher           RP
  21.  62  Yadier Molina              C
  22.  61  Damon Berryhill            C
  23.  61  Jack Tobin                 RF
  24.  61  Nelson Chittum             RP
  25.  61  Roy Halladay               SP
  26.  60  Willie Randolph            2B
```
