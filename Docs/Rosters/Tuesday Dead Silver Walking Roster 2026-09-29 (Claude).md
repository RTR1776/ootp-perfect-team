# Tuesday Dead Silver Walking — Claude pick, for the first run 2026-09-29

The new weekly in slot 145. It replaces Tuesday Up To 1969, catalogue row 549. It starts Tuesday 09-29 at 07:59 and sims every 10 minutes. The rules, from L.J.'s screenshot:
- 128 teams, best of seven
- Silver or lower (cards up to 79)
- Deadball (pre-1920) cards only
- 1919 strategy and stats, no DH
- 1911 Washington Park (AVG 1.005/.953, HR .919/.831, 2B 1.029, 3B .979), which is exactly the park table's 1911 row

The screenshot says nothing about variants; the 09-19 post had them on, so the rosters use them.

**Shape: 4 SP / 5 RP / 17 bats.** L.J. set the staff at 4 and 5.

## The one open rule: are 1920 cards "Deadball"?

The rules text says "pre-1920". The game's own card data puts every 1920 card in "Deadball (1871-1920)". Which reading the game enforces matters: three 1920 cards L.J. owns would start.

| Card | Spot | Runs, 1920 build | 1919-only build uses |
|---|---|---|---|
| Jack Tobin (61) | RF vs RHP | +12.9 | Keeler +6.6 |
| Joe Judge (74) | 1B, both lineups | +6.8 / +2.5 | Hoblitzel (VAR) −6.7 / Wagner −5.2 |
| Joe Dugan (65) | 2B vs LHP | +10.0 | Keister +8.9 (Keister moves to 3B) |

The 1920 build scores −22.9 weighted runs against −42.1 for the 1919-only one.

`Save Dead Silver Roster.command` asks first whether the game takes a 1920 card on this event's roster. **Check in game before answering: try adding Jack Tobin.**
- **Yes:** the event is saved with cards 1871–1920, and the 1920 roster goes to /build.
- **Anything else:** cards 1871–1919, and the 1919-only roster.

Either way the roster is saved as "Claude pick 2026-09-28". Both rosters were checked against their version of the new rules, applied in memory: ready. The 1920 roster fails the 1919 rules on exactly Judge, Tobin and Dugan.

## The environment

- **Scoring:** 3.90 runs a game, AVG .259, OBP .318, SLG .342, strikeouts 7.3%, homers 0.5% of PA. Small ball: a sac bunt with men on first and second and nobody out gains 0.14 runs.
- **What ratings pay:** BABIP pays twice what anything else does (+2.2 runs per 10 points for a left-handed bat; Eye, Gap, Power and Avoid K about +1). For arms, pBABIP pays most, then Control.
- **Gloves:** worth ×1.21 their usual, because so many balls are in play.
- **The park:** it favours left-handed bats by 0.39 runs a game (all-LHB 4.16 against all-RHB 3.77).

**Field reads:** there are no exports of this format yet. The build borrows the field of Daily Silver & Friends Deadball Slots (`--series silverandfriends`, 3 exports), the nearest event: 1919 RE, deadball cards, Silver and below.
- Its teams face left-handed pitching on only 10% of batters, so the lineup against RHP weighs 90%.
- A starter counts as 2.23 lineup spots and a reliever 0.26: deadball starters finish what they start.
- Those teams used about 5 starters and 2 relievers each. L.J.'s 5 relievers are all starter types (stamina 78–102), so they can go long.

**Pool:** 260 of his cards qualify (1919 and earlier, up to 79); 279 if 1920 counts. The whole field draws from this same short list.

## The roster (1919 and earlier)

Load file: `Inbox/rosters/deadsilver-claude-2026-09-29.txt`. −42.1 weighted runs (greedy −57.3) · legal · value 1,839 · 4 variants · two catchers.

    node --import tsx scripts/env-roster.ts --year 1919 --park "Washington Park" --park-year 1911 --max 79 \
      --card-year-max 1919 --size 26 --series silverandfriends --any-set --sp 4 --rp 5 --bats 17 \
      --role-trust 0.25 --optimize --starts 16 --name "Tuesday Dead Silver Walking"

Batting orders are from Build's new batting-order model, with the pitcher ninth. OBP/SLG are projected in this park against that hand. Here the order barely matters: the best order and the usual one both score 3.34 runs per nine.

```
vs RHP (runs/700 on the board)                     batting order        OBP/SLG
  C   Ted Easterly             -3.4                1  Tom Brown      LF  .338/.367
  1B  Dick Hoblitzel (VAR)     -6.7                2  Hoblitzel      1B  .324/.351
  2B  Nap Lajoie               -7.6                3  Easterly       C   .322/.352
  3B  Honus Wagner            -13.9                4  Keeler         RF  .328/.365
  SS  Dave Brain (VAR)         -0.6                5  Corkhill       CF  .318/.354
  LF  Tom Brown                +9.6                6  Wagner         3B  .311/.331
  CF  Pop Corkhill             -2.3                7  Lajoie         2B  .307/.343
  RF  Willie Keeler            +6.6                8  Brain          SS  .301/.340
                                                   9  Pitcher

vs LHP                                             batting order
  C   Wilbert Robinson         -7.3                1  Tillie Walker  CF  .328/.342
  1B  Honus Wagner             -5.2                2  Tom Brown      LF  .330/.357
  2B  Bill Keister             +8.9                3  Elberfeld      SS  .313/.338
  3B  Dave Brain (VAR)         +2.8                4  Keister        2B  .333/.367
  SS  Kid Elberfeld (VAR)      -7.2                5  Keeler         RF  .321/.358
  LF  Tom Brown                -1.5                6  Robinson       C   .309/.339
  CF  Tillie Walker            -0.6                7  Brain          3B  .301/.351
  RF  Willie Keeler            -2.1                8  Wagner         1B  .308/.341
                                                   9  Pitcher

Rotation: Phil Douglas −0.6 · Pretzels Getzien −1.0 · Frank Foreman (VAR) −1.3 · Dick Rudolph −1.9
Bullpen:  Stan Coveleski (CL) −2.4 · Joe McGinnity −2.4 · Mordecai Brown −2.5 · Frank Killen −2.5 · Christy Mathewson −2.6
Bench:    Emmet Heidrick, Branch Rickey, Aleck Smith, Joe Start, Deacon White (plus the vs-LHP starters)
```

## If 1920 counts

Load file: `Inbox/rosters/deadsilver-1920-claude-2026-09-29.txt`. −22.9 (greedy −45.8) · legal under 1871–1920 · value 1,852 · 3 variants. The build command is the same with `--card-year-max 1920`. The staff is the same nine arms. Hoblitzel (VAR) goes to the bench, and Keeler starts only against LHP.

```
vs RHP                                             batting order (3.44 runs/9, same as usual)
  C   Ted Easterly             -3.4                1  Tom Brown   LF    5  Keister     3B
  1B  Joe Judge                +6.8                2  Joe Judge   1B    6  Corkhill    CF
  2B  Nap Lajoie               -7.6                3  Easterly    C     7  Lajoie      2B
  3B  Bill Keister             -6.3                4  Jack Tobin  RF    8  Brain       SS
  SS  Dave Brain (VAR)         -0.6                                     9  Pitcher
  LF  Tom Brown                +9.6
  CF  Pop Corkhill             -2.3
  RF  Jack Tobin              +12.9

vs LHP                                             batting order (3.42 runs/9, +0.01 over usual)
  C   Wilbert Robinson         -7.3                1  Tillie Walker CF  5  Tom Brown  LF
  1B  Joe Judge                +2.5                2  Joe Judge     1B  6  Keeler     RF
  2B  Joe Dugan               +10.0                3  Joe Dugan     2B  7  Brain      SS
  3B  Bill Keister             +8.9                4  Keister       3B  8  Robinson   C
  SS  Dave Brain (VAR)         +2.8                                     9  Pitcher
  LF  Tom Brown                -1.5
  CF  Tillie Walker            -0.6
  RF  Willie Keeler            -2.1
```

## Caveats

- **Few runs:** the lineup is below average almost everywhere: 3B vs RHP is −13.9 with Wagner, or −6.3 with Keister if 1920 counts. There is little better to buy: he owns 260 of the 271 cards that qualify.
- **Every arm scores about the same,** −0.6 to −2.6, so the rotation order is a coin toss. Mathewson (102), McGinnity (101) and Rudolph (96) have the most stamina.
- **Borrowed field:** the field's handedness and staff weights come from a similar event, not this one. Rebuild after its first export is on file.
