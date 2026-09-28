# Monday Up And At Them Bronze — Claude pick, 2026-09-28

Run #28, Monday 07:05 CDT. The new format's first run: 1979 RE, 1977 Olympic Stadium, DH, cards 40–69, every set but Live, no variant limit (it was 1995 RE at 2026 Rio Grande Credit Union Field through run #27, an extreme hitters' park). Catalogue row 536 matches. 14 bats, 5 SP, 7 RP, as in L.J.'s Bo7 builds.

The environment: 4.28 runs a game, HR 1.96% of PA, K 12.5%. The park barely favours either side (0.03 R/G toward right-handed bats).

**Old and new are kept apart.** No Monday Bronze export was used: the five on file (#23–#27) are all the old format. The build passes no `--series`, so the field's shape and handedness come from the defaults, not from Rio Grande. `--obs-exclude bronzeweekly` (new) also leaves those exports out of every card's observed play elsewhere. With them left in, the lineups are the same and two arms change (67.1 against 67.3 weighted runs).

Load file: `Inbox/rosters/bronzeweekly-claude-2026-09-28.txt` (every card pinned by id). `Set Weekly Format Dates.command` saves it to /build as "Claude pick 2026-09-28". `roster:save --dry` passes it: 35 slots, ready.

    node --import tsx scripts/env-roster.ts --year 1979 --park "Olympic Stadium" --park-year 1977 --dh \
      --min 40 --max 69 --size 26 --card-types 2,3,4,5,6,7,8,9,10 --optimize --starts 16 \
      --sp 5 --rp 7 --bats 14 --role-trust 0.25 --obs-exclude bronzeweekly --name "Monday Up And At Them Bronze"

67.3 weighted runs (greedy 39.6) · legal · value 1,689 · 7 variants · two catchers · 1,253 eligible owned cards. No card is Live: 2026 cards here are Future Legends.

```
vs RHP (runs per 700 PA on this board):
  C   Tim McCarver                68 L   +0.8   glove 80 (-0.3)
  1B  Edward Florentino (VAR)     63 L   +7.9   glove 91 (+1.9)
  2B  Jhonny Level (VAR)          64 S   +1.8   glove 107 (-1.0)
  3B  Hank Blalock                68 L  +14.3   glove 105 (+1.9)
  SS  Dave Brain (VAR)            68 R   -0.7   glove 93 (-2.0)
  LF  Deion Sanders               69 L   +1.7   glove 131 (+2.9)
  CF  Billy Southworth            68 L   +5.1   glove 93 (-1.2)
  RF  Jack Tobin                  61 L   +8.0   glove 73 (-2.3)
  DH  Wes Covington               67 L  +19.3

vs LHP:
  C   Chris Cannizzaro            65 R   +0.6   glove 72 (-0.6)
  1B  Scott Spiezio               67 S  +10.1   glove 91 (+1.9)
  2B  Mark Grudzielanek           65 R   -1.1   glove 139 (+4.2)
  3B  Dave Brain (VAR)            68 R   +1.9   glove 99 (+1.1)
  SS  Jhonny Level (VAR)          64 S   -2.2   glove 94 (-1.8)
  LF  Steve Pearce                69 R   +9.3   glove 62 (-2.8)
  CF  Deion Sanders               69 L   +3.5   glove 120 (+0.4)
  RF  Jack Tobin                  61 L  -14.5   glove 73 (-2.3)
  DH  Dave Harris                 67 R  +14.0

Rotation:
  SP1 Fritz Ostermueller          64 L   +7.6   STM 98
  SP2 James McDonald (VAR)        55 L   +6.3   STM 59
  SP3 Bob Miller                  69 R   +2.7   STM 62
  SP4 Bruce Hurst                 64 L   +1.3   STM 86
  SP5 Cool Papa Bell              68 R   +0.3   STM 86
Bullpen:
  CL  Edwin Diaz                  67 R  +10.8   STM 13
  RP1 Adam Cimber (VAR)           69 R   +4.4   STM 17
  RP2 Satchel Paige               68 R   +3.6   STM 57
  RP3 Todd Jones (VAR)            43 L   +2.4   STM 17
  RP4 Vinnie Chulk                66 R   +0.8   STM 16
  RP5 Caden Scarborough           64 R   +0.8   STM 46
  RP6 Kyson Witherspoon (VAR)     63 R   +0.3   STM 59
```

- **Weak spot:** Tobin in right against lefties (−14.5). No other bat on the roster clears the 70 glove floor in right.
- **Past the curves:** Diaz (pBABIP 25) and Jones (34) are below the fitted range (50–175), so their numbers are a direction, not a measurement.
- **Bench:** the five bats that start only on one board: Pearce, Grudzielanek, Harris, Spiezio, Cannizzaro.
