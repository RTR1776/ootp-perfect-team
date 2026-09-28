# Daily Bronze PTCS 3 Replay Slots — Claude pick, 2026-09-28

Event 773. Feeds Bronze and Cap; 64 teams, Bo7. The rules:
- 1999 RE, 2000 Coors Field, DH
- cards 40–69: at most 18 Bronze (60–69) and 8 Iron (40–59)
- variant cap 13

The catalogue row matches the game. L.J. asked for lineups and for the changes from his current 26 (his roster screenshot, 09-28).

**The environment:** 6.11 runs a game, HR 3.6% of PA. Power is worth about 6 runs per +10. The park leans 0.36 R/G toward right-handed bats. The field (6 exports of this event) throws left-handed to 36% of batters.

**The pool:** 2,273 owned cards from the collection of 09-26 evening.

    node --import tsx scripts/env-roster.ts --series bronzeptcs3 --year 1999 --park "Coors Field" --park-year 2000 --dh \
      --min 40 --max 69 --slots B18,I8 --variant-cap 13 --size 26 --optimize --starts 16 \
      --sp 5 --rp 7 --bats 14 --role-trust 0.25 --name "Bronze PTCS 3 Replay (free)"

The same run with `--must` on his 26 (the optimiser only arranges them) scores **32.2** weighted runs. The free run scores **112.8**: legal, value 1,637, 9 variants, two catchers.

Of the +80.6:

| Part | Gain |
|---|---|
| Lineup | +57.9 |
| Bullpen | +14.4 |
| Rotation | +7.6 |
| Bench | +0.7 |

The 18 Bronze / 8 Iron split binds on both rosters, so each Bronze card in means a Bronze card out.

Load file: `Inbox/rosters/bronzeptcs3-claude-2026-09-28.txt` (every card pinned by id). `roster:save --dry` passes it: 35 slots, ready. L.J. saved it to /build as "Claude pick 2026-09-28" on 09-28 (the script is removed).

```
vs RHP (runs per 700 PA on this board)      vs LHP
  RF  Deion Sanders            +8.2           1B  Steve Pearce             +15.6
  1B  Edward Florentino (VAR) +13.0           DH  Dave Harris              +20.2
  3B  Hank Blalock            +17.0           3B  Dave Brain (VAR)         +10.7
  DH  Wes Covington           +22.9           LF  Andruw Jones (VAR)       +10.2
  CF  Billy Southworth        +12.0           RF  Deion Sanders             +9.5
  SS  Dave Brain (VAR)         +8.6           C   Thayron Liranzo (VAR)     +6.0
  2B  Jhonny Level (VAR)       +7.7           CF  Dwayne Hosey              +4.4
  LF  Steve Pearce             +5.7           SS  Leo Cardenas              +3.8
  C   Thayron Liranzo (VAR)    +2.5           2B  Jhonny Level (VAR)        +2.8

Rotation: Ostermueller +6.0 · McDonald (VAR) +7.0 · Miller +1.1 · Witherspoon (VAR) +0.3 · Hurst −0.5
Bullpen:  Diaz (CL) +10.7 · Cimber (VAR) +6.0 · Paige +2.4 · Todd Jones (VAR) +0.3 · Marshall −1.0 · Carrasco −3.3 · Rondon −3.3
Bench:    Harris, Cardenas, Hosey, Andruw Jones (VAR), Ted Easterly (second catcher)
```

The batting order is a suggestion (on-base and speed on top, power 2–5); the model does not score order.

## Changes from his 26, biggest first (weighted runs, approximate)

1. **Deion Sanders in RF, about +17.** It moves others too:
   - vs RHP, Liranzo to C (Wilkins out) and Florentino to 1B;
   - vs LHP, Pearce to 1B, where Florentino was −6.0.
2. **Blalock at 3B vs RHP** for Rolen: −3.7 → +17.0, better glove. About +14.
3. **Diaz for Beachy**, about +9. Beachy is −8.8 even in relief; the optimiser started Oppor (−6.8) ahead of him.
4. **Covington at DH vs RHP** for Cust: +9.2 → +22.9. About +9.
5. **Hurst in the rotation** for Oppor, about +8.
6. **Level at 2B** for Scutaro, both boards, about +6.
7. **Allison out** (−12.3 vs LHP). Southworth takes CF vs RHP and Hosey vs LHP. About +6.
8. **Smaller:**
   - Paige for Perry (+5), Todd Jones for Reyes (+4), Harris at DH vs LHP for Incaviglia (+4).
   - Robinson and Scarborough go out for the Iron relievers Carrasco and Rondon: slightly worse arms, but they free Bronze spots for the bats.

- **Out:** Wilkins, Rolen, Allison, Cust, Incaviglia, Marte, Johnstone, Bo Jackson, Scutaro, Beachy, Oppor, Perry, Robinson, Scarborough, Reyes.
- **Staying:** Liranzo, Florentino, Brain, Pearce, Andruw Jones, Miller, McDonald, Ostermueller, Witherspoon, Cimber, Marshall.

## Caveats

- **Past the curves:** Diaz (pBABIP 25), Todd Jones (34) and Rondon (37) are below the fitted range (50–175). Their numbers are a direction, not a measurement.
- **His lineups weren't sent:** the 32.2 is his 26 arranged at their best, so the real gap may be larger.
