# Saturday Diamond Variety — Claude pick, 2026-09-26

Built for the new weekly format from the 2026-09-19 post: 1952 RE, 1958 Tiger Stadium, no DH, cards 1910–1959, Diamond or lower, 26 cards, Bo7. The catalogue row (541) still carries last week's rules (1975 RE, Metropolitan Stadium, card types 2/6/7): updating it from the cloud session was blocked (production DB write), so it waits on L.J.'s OK. Until then /build's Optimise builds this event for the old format.

Load file: `Inbox/rosters/diamondvariety-claude-2026-09-26.txt`. Each card is pinned by id. `Save 09-26 Rosters.command` on the Mac saves it to /build as "Claude pick 2026-09-26", after moving row 541 to this week's rules.

    node --import tsx scripts/env-roster.ts --year 1952 --park "Tiger Stadium" --park-year 1958 --min 40 --max 99 \
      --card-year-min 1910 --card-year-max 1959 --size 26 --series diamondvariety --optimize --starts 8 \
      --sp 5 --rp 7 --bats 14 --role-trust 0.25 --name "Saturday Diamond Variety"

171.7 weighted runs (greedy 149.5) · legal · value 2,311 · 2 variants · two catchers · field 45% LHP (4 exports) · 813 of 820 pool cards have play on record.

```
vs RHP:
  C   Ed Bailey (VAR)               97 L   +35.1   glove 112 (+0.7)
  1B  Willie McCovey                93 L   +16.4   glove 76 (-0.1)
  2B  Larry Doby                    98 L    +9.5   glove 87 (-4.1)
  3B  Hank Thompson                 87 L   +13.3   glove 92 (+0.1)
  SS  Luke Appling                  92 R   +18.3   glove 110 (+0.4)
  LF  Shoeless Joe Jackson          88 L   +18.9   glove 88 (-0.6)
  CF  Willie Mays                   98 R    +9.4   glove 107 (-0.3)
  RF  Mickey Mantle                 88 S   +11.8   glove 119 (+1.8)

vs LHP:
  C   Roy Campanella                86 R    +3.7   glove 96 (+0.2)
  1B  Joe Adcock                    95 R   +21.4   glove 99 (+2.8)
  2B  Larry Doby                    98 L    +3.5   glove 87 (-4.1)
  3B  Eddie Yost                    92 R    +8.3   glove 76 (-2.0)
  SS  Luke Appling                  92 R    -1.6   glove 110 (+0.4)
  LF  Al Simmons                    99 R   +30.5   glove 90 (-0.4)
  CF  Willie Mays                   98 R   +27.2   glove 107 (-0.3)
  RF  Wilson Redus                  99 R    +4.8   glove 77 (-1.8)

Rotation:
  SP1 Larry Jackson                 92 R    +9.9   STM 92
  SP2 Carl Hubbell                  86 R    +8.4   STM 81
  SP3 Dutch Leonard                 97 R    +8.0   STM 92
  SP4 Sam Jones                     92 R    +8.3   STM 82
  SP5 Dizzy Dean                    88 R    +8.4   STM 98
Bullpen:
  CL  Seth Morehead                 78 L    +4.7   STM 24
  RP1 Pete Donohue                  96 R    +6.7   STM 73
  RP2 Jakie May (VAR)               72 R    +7.5   STM 69
  RP3 Fritz Ostermueller            64 L    +7.5   STM 98
  RP4 Milt Pappas                   96 R    +5.5   STM 79
  RP5 Luther Farrell                87 L    +5.6   STM 104
  RP6 Rube Marquard                 84 S    +5.2   STM 82
Bench only: Wes Covington (67, L, +15.2 vs RHP)

By value (26 cards, 2 variants):
   1.  99  Al Simmons                 LF
   2.  99  Wilson Redus               RF
   3.  98  Larry Doby                 2B
   4.  98  Willie Mays                CF
   5.  97  Dutch Leonard              SP
   6.  97  Ed Bailey                  C  ← VARIANT
   7.  96  Milt Pappas                RP
   8.  96  Pete Donohue               RP
   9.  95  Joe Adcock                 1B
  10.  93  Willie McCovey             1B
  11.  92  Eddie Yost                 3B
  12.  92  Larry Jackson              SP
  13.  92  Luke Appling               SS
  14.  92  Sam Jones                  SP
  15.  88  Dizzy Dean                 SP
  16.  88  Mickey Mantle              RF
  17.  88  Shoeless Joe Jackson       LF
  18.  87  Hank Thompson              3B
  19.  87  Luther Farrell             RP
  20.  86  Carl Hubbell               SP
  21.  86  Roy Campanella             C
  22.  84  Rube Marquard              RP
  23.  78  Seth Morehead              RP
  24.  72  Jakie May                  RP  ← VARIANT
  25.  67  Wes Covington              BN
  26.  64  Fritz Ostermueller         RP
```
