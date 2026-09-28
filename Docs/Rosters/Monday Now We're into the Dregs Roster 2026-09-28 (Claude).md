# Monday Now We're into the Dregs — Claude pick, 2026-09-28

Run #28 (1440028), Monday 19:59. Feeds Bronze, Cap and TW. 128 teams, Bo7. Rules from L.J.'s screenshot:
- cards 50–64 (High Iron to Low Bronze), cap 1468 (56.5 a card; an unused spot counts 50)
- 1994 RE, DH, 1996 Dodger Stadium (AVG .954/.958, HR .850/.925, 2B .896, 3B .774)
- variants on, no set rule

This is the new format's first run: the slot was Monday Gold Floor Cap (80–105, 2025 Standard Stadium, cap 2242) through #27. The catalogue still has the old rules (row 548), so the build passes the rules by hand and no `--series`. `--obs-exclude goldfloorcapweekly` keeps the old exports out; no card here could have played in them anyway.

Load file: `Inbox/rosters/dregs-claude-2026-09-28.txt`, with every card pinned by id; by name alone, Lajoie and Andruw Jones would resolve to L.J.'s 99s. `Save Dregs Roster.command` first gives event 548 these rules, then saves the roster to /build as "Claude pick 2026-09-28".

**The environment:** 4.37 runs a game, HR 2.41% of PA, K 15.9%. The park is a pitchers' park and leans 0.15 R/G toward right-handed bats. The model gives the vs-RHP lineup the friendly side of the park in 7 of 9 spots.

**The pool:** 1,360 owned cards from the collection of 09-26 evening. Anything bought since isn't in it.

    node --import tsx scripts/env-roster.ts --year 1994 --park "Dodger Stadium" --park-year 1996 --dh \
      --min 50 --max 64 --cap 1468 --size 26 --optimize --starts 16 --sp 5 --rp 7 --bats 14 \
      --role-trust 0.25 --obs-exclude goldfloorcapweekly --name "Monday Now We're into the Dregs"

−8.1 weighted runs (greedy −84.4) · legal · value 1468 of 1468 · 6 variants. The cap is the whole story: every reliever is a 50 so the bats and the top of the rotation can be 60+.

```
vs RHP (runs per 700 PA on this board):
  C   Damon Berryhill             61 S   -7.0   glove 84 (-0.2)
  1B  Edward Florentino (VAR)     63 L  +10.1   glove 91 (+1.7)
  2B  Nap Lajoie                  50 R  -11.2   glove 114 (+0.1)
  3B  Kyle Seager                 64 L   +3.5   glove 116 (+3.2)
  SS  Jhonny Level (VAR)          64 S   +4.8   glove 107 (-1.7)
  LF  Aaron Hicks                 63 S   +5.6   glove 71 (-2.0)
  CF  Jett Williams               62 R   -4.7   glove 93 (-1.4)
  RF  Jay Bruce                   58 L   +4.3   glove 73 (-2.1)
  DH  Jack Cust                   63 L   +6.9

vs LHP:
  C   Josh Phegley                51 R  -11.6   glove 71 (-0.6)
  1B  Edward Florentino (VAR)     63 L   -8.6   glove 91 (+1.7)
  2B  Jett Williams               62 R   +3.8   glove 93 (-3.0)
  3B  Kyle Seager                 64 L  -14.1   glove 116 (+3.2)
  SS  Jhonny Level (VAR)          64 S   -0.2   glove 107 (-1.7)
  LF  Andruw Jones (VAR)          57 R   +7.9   glove 103 (+0.6)
  CF  Dave Henderson              50 R   -4.7   glove 105 (-0.4)
  RF  Aaron Hicks                 63 S   +0.6   glove 71 (-2.2)
  DH  Jack Cust                   63 L   +4.0

Rotation (the builder's order is not a ranking; pitch the two best first, they get two starts in seven):
  Fritz Ostermueller          64 L   +7.2   STM 98
  James McDonald (VAR)        55 L   +6.7   STM 59
  Bruce Hurst                 64 L   +0.5   STM 86
  Kyson Witherspoon (VAR)     63 R   +0.3   STM 59
  Roy Halladay                61 R   -0.8   STM 73
Bullpen (all value 50-51):
  CL  Cade Gibson             51 L   -6.6   STM 21
      Jerry Don Gleaton       50 L   -6.7   STM 20
      Orlando Ribalta         51 R   -7.0   STM 15
      Don August (VAR)        50 R   -7.8   STM 69 (long man)
      Peter Strzelecki        50 R   -7.8   STM 17
      Hayden Juenger          50 R   -8.2   STM 21
      Lyon Richardson         50 S   -9.0   STM 36
Bench: Lou Brock (51 L), Lenny Harris (52 L), plus Henderson, Andruw Jones and Phegley, who start only vs LHP.
```

**Batting order.** The app doesn't model the order yet. This one puts on-base and speed at the top and power in the 2–5 spots, then the rest by runs:
- vs RHP: Hicks, Florentino, Level, Cust, Bruce, Seager, Williams, Berryhill, Lajoie.
- vs LHP: Williams, Andruw Jones, Hicks, Cust, Level, Henderson, Florentino, Phegley, Seager.

**Weak spots:**
- vs LHP, the left side of the order is the problem. Seager (−14.1), Phegley (−11.6) and Florentino (−8.6) all start. The only other catcher is Berryhill, a switch hitter who is worse from the right.
- The bullpen is all replacement level (−6.6 to −9.0). With the rotation this deep in stamina (Ostermueller 98, Hurst 86), let the starters go long.
- Lajoie at 2B vs RHP (−11.2) is a 50-value card the cap pays for. The position solve found no better way to cover that board with this roster.

The builder printed Juenger in the CL slot, but it weighs every bullpen slot the same, so that label isn't a pick. Gibson has the best numbers of the seven, so he closes here.
