# Bronze rosters — Claude picks, 2026-09-28

L.J. is focusing on Bronze and asked for a roster in every current Bronze tournament. This doc has nine rosters, one for each tournament that scores in PTCS Bronze and wasn't already done today.

**Already saved on /build** as "Claude pick 2026-09-28", each with its own doc:
- Daily Bronze PTCS 3 Replay Slots (773)
- Monday Up And At Them Bronze (536)
- Monday Now We're into the Dregs (548)

**Left out:**
- Bronze Quick (504), and EF 4T Bronze and EF H2H Bronze (572, 578). They aren't in his results, and there are no exports for them.
- The Perfectly Bronze drafts. Drafts are picked live.

`Save Bronze Rosters.command` saves all nine to /build as "Claude pick 2026-09-28". It first checks each one against its event's rules (`roster:save --dry`; all nine pass from here, "ready"), then asks once. The load files are in `Inbox/rosters/`, with every card pinned by id.

## How they were built

- **Pool:** the collection of 09-26 evening (upload 144), which is the latest on file.
- **Settings:** the same model and settings as the PTCS 3 roster: 5 SP, 7 RP, 14 bats, two catchers, glove floor 60 at every position.
  - The field's exports set its left-handed pitching share, and weigh starters and relievers against a lineup spot.
  - Cards' observed play is blended in.
  - The command, run from `web/`, with each event's flags below:

    ```
    node --import tsx scripts/env-roster.ts <event's rules> --size 26 --optimize --starts 16 \
      --sp 5 --rp 7 --bats 14 --role-trust 0.25 [--series <slug>]
    ```

    ```
    519  --year 1955 --park "Ebbets Field" --park-year 1955 --min 60 --max 64 --variant-cap 12 --series lowbronzeonlydaily
    520  --year 2019 --park "American Family Field" --park-year 2026 --dh --min 60 --max 69 --cap 1689 --variant-cap 13 --series bronzeonlycapdaily
    524  --year 2010 --park "Dodger Stadium" --park-year 2003 --dh --min 40 --max 69 --series latebronze
    525  --year 1942 --park "Wrigley Field" --park-year 1945 --max 69 --variant-cap 0 --series earlybronze
    527  --year 2010 --park "Minute Maid Park" --park-year 2005 --dh --min 60 --max 69 --card-types 3,7,8 --series bronzecuriosity
    535  --year 2016 --park "Standard Stadium" --park-year 2025 --dh --min 40 --max 69 --cap 1386 --obs-exclude bronzecapweekly
    561  --year 2010 --park "Kauffman Stadium" --park-year 2026 --dh --min 40 --max 69 --card-types 1 --series livebronzedaily
    584  --year 1959 --park "Seals Stadium" --park-year 1959 --dh --min 40 --max 69 --card-year-min 1910 --card-year-max 1959 --series bronze10to50
    633  --year 2009 --park "Heinsohn Ballpark" --dh --min 40 --max 69 --card-year-min 1999 --card-year-max 2026 --series bronzeootp
    ```

- **Where the rules come from:** the catalogue, which for the dailies is the 09-02 refresh post. I didn't see the game's rules screens, so glance at each event's rules before entering. "Default RE" is read as 2010, the PT default.
- **Reading the scores:** they are weighted runs against the era's average card. **Compare them within an event, not across events.** A pool of 60–64 cards sits below average everywhere, so Low Bronze Only's −25 is not worse play than OOTP Era's +59.
- **Lineups:** listed by position. The model doesn't score batting order, so set it in game (on-base and speed on top, power 2–5).
- The staff is listed best first, and the best reliever closes.

| Event | Rules | Score (greedy) | Value | VAR | Field exports |
|---|---|---|---|---|---|
| Daily Low Bronze Only (519) | 1955 RE, 1955 Ebbets Field, no DH, 60–64, VAR cap 12 | −25.3 (−39.5) | 1,639 | 4 | 2 |
| Daily Bronze Only Cap (520) | 2019 RE, 2026 American Family Field, DH, 60–69, cap 1,689, VAR cap 13 | 78.2 (47.8) | 1,689 | 8 | 2 |
| Daily Late Bronze (524) | default RE, 2003 Dodger Stadium, DH, 40–69, Bo5 | 80.7 (49.6) | 1,699 | 8 | none |
| Daily Early Bronze (525) | 1942 RE, 1945 Wrigley Field, no DH, up to 69, no variants | 29.3 (−5.4) | 1,729 | 0 | 3 |
| Daily Bronze Only Curiosities (527) | default RE, 2005 Minute Maid Park, DH, 60–69, Rookie Sensation / Snapshot / Unsung Heroes only | 26.5 (−3.8) | 1,715 | 6 | 3 |
| Saturday Bronze Cap (535), for 10-03 | 2016 RE, 2025 Standard Stadium, DH, 40–69, cap 1,386 | 12.2 (−85.4) | 1,386 | 7 | left out (old format) |
| Daily Live Bronze (561) | 2010 RE, 2026 Kauffman Stadium, DH, 40–69, Live only | −155.4 (−162.6) | 1,740 | 0 | none |
| Daily Bronze 1910-59 (584) | 1959 RE, 1959 Seals Stadium, DH, 40–69, cards 1910–1959 | −61.8 (−91.0) | 1,636 | 3 | 8 |
| Daily Bronze OOTP Era (633) | 2009 RE, Heinsohn Park (neutral), DH, 40–69, cards 1999–2026 | 58.6 (24.4) | 1,677 | 7 | 9 |

## The core

The same cards carry most of these rosters. Across the 12 Bronze rosters (these nine plus PTCS 3, Monday Bronze and the Dregs), 18 cards make at least six:
- **Bats:** Florentino (VAR), Level (VAR), Tobin, Covington, Blalock, Deion Sanders, Pearce, Spiezio, Dave Harris, Brain (VAR), Southworth.
- **Arms:** Ostermueller (9 of 12), Witherspoon (VAR), Hurst, Bob Miller, McDonald (VAR), Edwin Diaz, Cimber (VAR).

A better Bronze bat or arm pays off in most of these events at once. The weak spots that keep recurring:
- a right-handed-hitting RF against LHP (Tobin starts there at −13 in Late Bronze and −18 in 1910-59);
- catcher against RHP;
- relievers past Diaz and Cimber.

## Daily Low Bronze Only (519)

Cards 60–64 only, no DH, 64 teams, Bo5 (final Bo7). This replaces the 09-26 pick, which was never saved. Since then the glove floor has dropped from 70 to 60 and the 09-27 exports have landed. The new pick has Willie Wilson in CF against RHP and Kluber in the rotation, and scores −25.3 where the old one scored −31.6.

```
vs RHP (runs per 700 PA on this board)      vs LHP
  C   Damon Berryhill          -16.7           C   Yadier Molina            -13.9
  1B  Edward Florentino (VAR)   +8.3           1B  Mark Bellhorn             +8.1
  2B  Willie Randolph          -15.9           2B  Willie Randolph           -6.6
  3B  Kyle Seager               -3.8           3B  Jett Williams             +1.8
  SS  Jhonny Level (VAR)        -0.2           SS  Jhonny Level (VAR)        -4.6
  LF  Bill Buckner (VAR)        +5.7           LF  Aaron Hicks               -7.8
  CF  Willie Wilson             -8.4           CF  Byron Buxton              +1.2
  RF  Jack Tobin                +7.2           RF  Joe Carter                -0.2

Rotation: Ostermueller +7.6 · Hurst +0.8 · Witherspoon (VAR) +0.2 · Halladay -0.6 · Kluber -1.2
Bullpen:  Scarborough (CL) -0.0 · Wolfram -0.6 · Tommy Hunter -1.5 · Kralick -1.7 · Assenmacher -1.9 · Chittum -2.2 · De Los Santos -2.7
Bench:    Hicks, Bellhorn, Jett Williams, Joe Carter, Buxton, Molina
```

The field carries 4.6 starters and 3.7 relievers, and the exports weigh a starter at 1.9 lineup spots. The rotation matters most here.

## Daily Bronze Only Cap (520)

Cards 60–69, cap 1,689 (spent to the point), variant cap 13 (8 used).

```
vs RHP (runs per 700 PA on this board)      vs LHP
  C   Tim McCarver              +1.2           C   Thayron Liranzo (VAR)     +0.9
  1B  Edward Florentino (VAR)   +9.7           1B  Scott Spiezio            +11.7
  2B  Jhonny Level (VAR)        +4.2           2B  Willie Randolph           -1.3
  3B  Hank Blalock             +14.7           3B  Dave Brain (VAR)          +7.3
  SS  Dave Brain (VAR)          +5.6           SS  Jhonny Level (VAR)        +0.4
  LF  Ed Morgan (VAR)           +2.9           LF  Ed Morgan (VAR)           +9.4
  CF  Deion Sanders             +4.8           CF  Jett Williams             +4.2
  RF  Jack Tobin                +8.3           RF  Deion Sanders             +5.3
  DH  Wes Covington            +22.0           DH  Dave Harris              +18.5

Rotation: Ostermueller +6.4 · Bob Miller +1.7 · Witherspoon (VAR) +0.5 · Hurst -0.3 · Halladay -1.3
Bullpen:  Diaz (CL) +11.2 · Cimber (VAR) +5.2 · Scarborough +1.2 · Assenmacher +1.1 · Don Robinson (VAR) +0.7 · Wolfram -0.5 · Orze -2.0
Bench:    Harris, Liranzo (VAR), Spiezio, Jett Williams, Randolph
```

## Daily Late Bronze (524)

Cards 40–69, Bo5. The park, 2003 Dodger Stadium, favours left-handed bats by 0.87 runs a game: its batting average factor is 1.037 for left-handed hitters against 0.871 for right-handed ones. Against RHP, eight of the nine bats hit from the left or switch-hit (Brain is the one right-handed bat). No export of this event is on file, so the field's handedness is the era's default.

```
vs RHP (runs per 700 PA on this board)      vs LHP
  C   Tim McCarver              +0.7           C   Thayron Liranzo (VAR)     +4.0
  1B  Edward Florentino (VAR)   +8.1           1B  Scott Spiezio             +7.7
  2B  Jhonny Level (VAR)        +2.3           2B  Alfonso Soriano           +6.8
  3B  Hank Blalock             +13.3           3B  Dave Brain (VAR)          +6.9
  SS  Dave Brain (VAR)          +3.1           SS  Jhonny Level (VAR)        -0.6
  LF  Deion Sanders             +3.3           LF  Steve Pearce             +11.2
  CF  Billy Southworth          +6.3           CF  Deion Sanders             +4.3
  RF  Jack Tobin               +10.1           RF  Jack Tobin               -12.9
  DH  Wes Covington            +20.4           DH  Dave Harris              +18.1

Rotation: Ostermueller +7.2 · McDonald (VAR) +6.7 · Bob Miller +2.3 · Hurst +0.4 · Witherspoon (VAR) +0.4
Bullpen:  Diaz (CL) +11.3 · Cimber (VAR) +5.2 · Paige +3.7 · Todd Jones (VAR) +2.3 · Bruihl +1.9 · Morillo +1.4 · O'Brien +1.0
Bench:    Harris, Liranzo (VAR), Soriano, Spiezio, Pearce
```

## Daily Early Bronze (525)

Cards up to 69, no variants, no DH, 128 teams.
- **The environment:** a small-ball 1942: 1.1% of PA are home runs and 7.6% strikeouts.
- **The park:** 1945 Wrigley favours right-handed bats by 0.79 runs a game.
- **The staff:** a starter is worth 1.8 lineup spots here, so the rotation carries a lot.

```
vs RHP (runs per 700 PA on this board)      vs LHP
  C   Tim McCarver              -3.7           C   Chris Cannizzaro          +2.0
  1B  Broderick Perkins         -1.1           1B  Scott Spiezio            +10.1
  2B  Hank Blalock             +11.5           2B  Mark Grudzielanek         -5.4
  3B  Kyle Seager               -1.8           3B  Honus Wagner              +0.0
  SS  Leo Cardenas             -11.8           SS  Leo Cardenas              -4.5
  LF  Deion Sanders             -0.6           LF  Steve Pearce             +10.7
  CF  Billy Southworth          +1.7           CF  Jett Williams             -0.3
  RF  Jack Tobin                +2.0           RF  Deion Sanders             +1.7

Rotation: Ostermueller +8.4 · Bob Miller +3.2 · Hurst +1.6 · Cool Papa Bell +0.8 · Jose Lima +0.4
Bullpen:  Diaz (CL) +11.3 · Paige +5.0 · Bruihl +2.1 · Jose A. Ferrer +1.5 · Morillo +1.3 · Chulk +0.6 · O'Brien +0.6
Bench:    Grudzielanek, Pearce, Jett Williams, Spiezio, Honus Wagner, Cannizzaro
```

The value window's floor is blank in the catalogue (up to 69), so Iron cards are allowed.

## Daily Bronze Only Curiosities (527)

Cards 60–69 from Rookie Sensation, Snapshot and Unsung Heroes only (388 of his cards). 2005 Minute Maid favours right-handed bats by 0.46 runs a game.

```
vs RHP (runs per 700 PA on this board)      vs LHP
  C   Ed Bailey                 -9.9           C   Chris Cannizzaro          +2.4
  1B  Bill Buckner (VAR)        +7.2           1B  Scott Spiezio             +9.9
  2B  Mark Grudzielanek         -7.3           2B  Mark Grudzielanek         -2.3
  3B  Honus Wagner             -12.1           3B  Honus Wagner              +1.6
  SS  Dave Brain (VAR)          +4.6           SS  Dave Brain (VAR)          +6.8
  LF  Deion Sanders             +4.1           LF  Ed Morgan (VAR)           +6.6
  CF  Billy Southworth          +5.9           CF  Byron Buxton              -0.7
  RF  Jack Tobin                +9.0           RF  Deion Sanders             +4.0
  DH  Wes Covington            +20.4           DH  Dave Harris              +18.0

Rotation: Bob Miller +2.0 · Halladay -1.0 · Kralick -2.7 · Red Lucas -3.1 · Chris Short -3.2
Bullpen:  Diaz (CL) +11.1 · Cimber (VAR) +5.3 · Clay Bryant +0.3 · Don Robinson (VAR) +0.0 · Assenmacher -0.4 · Chulk -0.9 · Marshall Bridges (VAR) -1.7
Bench:    Morgan (VAR), Harris, Spiezio, Cannizzaro, Buxton
```

Ostermueller, Hurst and Witherspoon aren't in these three sets, so the rotation is the thin part.

## Saturday Bronze Cap (535), for the 10-03 run

- **Rules:** cards 40–69, cap 1,386 (spent to the point), 2016 RE, neutral park.
- **Built for the new format**, which first runs 10-03. As the 09-27 handoff says for changed events, the build passes no `--series` and leaves the old-format exports out of every card's observed play (`--obs-exclude bronzecapweekly`).
- **Older picks:** the 09-19 and 09-26 picks for this event are still on /build under their own names.

```
vs RHP (runs per 700 PA on this board)      vs LHP
  C   Thayron Liranzo (VAR)     -3.2           C   Thayron Liranzo (VAR)     +1.4
  1B  Edward Florentino (VAR)   +9.4           1B  Steve Pearce             +11.5
  2B  Jhonny Level (VAR)        +3.1           2B  Jhonny Level (VAR)        -0.7
  3B  Hank Blalock             +14.5           3B  Dave Brain (VAR)          +6.8
  SS  Dave Brain (VAR)          +4.9           SS  Kid Elberfeld (VAR)       -8.8
  LF  Steve Pearce              +0.7           LF  Jack Tobin                -9.9
  CF  Deion Sanders             +5.3           CF  Deion Sanders             +5.8
  RF  Jack Tobin                +9.1           RF  Sammy Sosa                -5.5
  DH  Wes Covington            +21.9           DH  Gary Sheffield            -2.9

Rotation: McDonald (VAR) +6.6 · Ostermueller +6.5 · Bob Miller +1.8 · Tin Can Kincannon -3.4 · Bob Gibson -8.6
Bullpen:  Todd Jones (VAR) (CL) -0.6 · Reed Garrett -2.9 · Steve Farr -10.5 · R.T. Walker -10.7 · Ron Robinson -11.3 · Jerry Augustine -15.1 · Dwight Bernard -18.7
Bench:    Elberfeld (VAR), Sheffield, Charlie Eden, Buck Rodgers (second catcher), Sosa
```

**The cap goes on the bats against RHP and three starters (Ostermueller, Miller, McDonald).** The other two starters, the bullpen and the bench are 40–49 cards.
- With no exports for the new format, a reliever counts for 0.31 of a lineup spot (the era default), so the model spends little there.
- Four of the relievers (Todd Jones, Farr, Ron Robinson, Bernard) and two starters (Kincannon, Gibson) are past the fitted curves, so their numbers are rough.

## Daily Live Bronze (561)

Live cards only, 40–69 (1,020 of his cards), no variants.
- **The scores:** every Live Bronze card is flat, with ratings around 60–100, so every bat scores −8 to −17. The ranking is what counts: the whole field plays the same kind of card.
- **The data:** no export of this event is on file.
- **The ratings:** Live cards change with the real season. These are the 09-26 collection's ratings, so rebuild after a fresh collection upload.

```
vs RHP (runs per 700 PA on this board)      vs LHP
  C   Carter Jensen            -14.0           C   Luis Torrens             -16.8
  1B  Kody Clemens             -11.0           1B  Vladimir Guerrero Jr.     -8.1
  2B  Michael Massey           -13.9           2B  Michael Massey           -14.8
  3B  Royce Lewis              -13.2           3B  Royce Lewis              -13.2
  SS  Gunnar Henderson         -13.1           SS  Gunnar Henderson         -15.4
  LF  Daylen Lile              -11.6           LF  Mauricio Dubon           -12.9
  CF  Jackson Merrill          -12.1           CF  Jackson Merrill          -13.6
  RF  Jesus Sanchez            -11.9           RF  Teoscar Hernandez        -10.2
  DH  Vladimir Guerrero Jr.     -8.1           DH  Dominic Canzone          -11.0

Rotation: Andrew Alvarez -3.6 · Patrick Sandoval -4.2 · Bubba Chandler -4.2 · Janson Junk -4.6 · Martin Perez -5.1
Bullpen:  Bruihl (CL) +1.5 · Morillo +1.2 · O'Brien +0.8 · Jose A. Ferrer -0.2 · Brock Stewart -0.4 · Wolfram -0.5 · Evan Sisk -0.6
Bench:    Yoshida, Canzone, Teoscar Hernandez, Dubon, Torrens
```

## Daily Bronze 1910-59 (584)

Cards 40–69 from 1910–1959 (462 of his cards), 1959 Seals Stadium, 8 exports. The thinnest pool here: most of the lineup is below average, and the DH, the corner outfield and the rotation carry it.

```
vs RHP (runs per 700 PA on this board)      vs LHP
  C   Ted Easterly             -11.8           C   Gabby Hartnett            -4.7
  1B  Stan Hack                -10.4           1B  Jackie Robinson           -9.8
  2B  Joe Dugan                -12.7           2B  Joe Dugan                 +5.7
  3B  Jim Tabor                 -8.9           3B  Jim Tabor                -18.1
  SS  Honus Wagner             -19.2           SS  Honus Wagner              -0.4
  LF  Billy Southworth          +2.5           LF  Ed Morgan (VAR)           +6.3
  CF  Bob Allison (VAR)         +3.1           CF  Jim Landis (VAR)         -10.0
  RF  Jack Tobin                +6.1           RF  Jack Tobin               -18.3
  DH  Wes Covington            +17.7           DH  Dave Harris              +16.1

Rotation: Ostermueller +7.7 · Cool Papa Bell +0.1 · Red Lucas -2.1 · Tin Can Kincannon -2.4 · Mickey Haefner -3.6
Bullpen:  Paige (CL) +4.1 · Clay Bryant +0.4 · Roy Face -1.6 · Elmer Singleton -2.0 · Chittum -2.1 · Ken Lehman -3.4 · Christy Mathewson -3.7
Bench:    Harris, Morgan (VAR), Hartnett, Landis (VAR), Jackie Robinson
```

- **Where to buy:** 3B and RF against LHP (−18 each), and SS against RHP. Honus Wagner's 1913 card hits right-handers poorly on this board (power 46 against RHP, 113 against LHP).
- **Staff shape:** the field carries only 3.4 relievers. A sixth starter or a 15th bat in place of the 7th reliever is worth trying in game.

## Daily Bronze OOTP Era (633)

Cards 40–69 from 1999–2026, neutral park, 9 exports. The field throws left-handed to only 25% of batters, the lowest here, so the lineup against RHP counts three times as much.

```
vs RHP (runs per 700 PA on this board)      vs LHP
  C   Thayron Liranzo (VAR)     +0.2           C   Thayron Liranzo (VAR)     +5.1
  1B  Edward Florentino (VAR)  +11.0           1B  Scott Spiezio             +7.0
  2B  Hank Blalock             +14.8           2B  Alfonso Soriano           +8.6
  3B  Kyle Seager               +4.3           3B  Jefferson Rojas           +0.3
  SS  Jhonny Level (VAR)        +5.6           SS  Jhonny Level (VAR)        +1.0
  LF  Steve Pearce              +3.7           LF  Steve Pearce             +13.8
  CF  Kevin Kiermaier           -0.4           CF  Jett Williams             +4.9
  RF  Aaron Hicks               +6.2           RF  Aaron Hicks               +1.8
  DH  Jack Cust                 +7.5           DH  Jack Cust                 +4.3

Rotation: McDonald (VAR) +6.8 · Witherspoon (VAR) +0.3 · Tanner McDougal -1.0 · Halladay -1.2 · Jose Lima -2.5
Bullpen:  Diaz (CL) +11.0 · Cimber (VAR) +5.5 · Todd Jones (VAR) +1.7 · Bruihl +1.5 · Morillo +1.1 · O'Brien +0.7 · Scarborough +0.7
Bench:    Jett Williams, Spiezio, Rojas, Soriano, Carter Jensen (second catcher)
```

## Caveats

- **Past the fitted curves:** Edwin Diaz (pBABIP 25), Todd Jones (34), Assenmacher (37), Tommy Hunter (49) and Kincannon (36), plus Bronze Cap's Bob Gibson (44), Steve Farr (20), Ron Robinson (13) and Dwight Bernard (41). Their numbers are a direction, not a measurement.
- **No field data:** Late Bronze, Live Bronze and the new Bronze Cap have no usable exports. They use the era's default handedness and staff weights.
- **Collection date:** every roster uses the 09-26 collection. A card bought since isn't considered, and one sold since would fail the save check (that roster would be skipped, with a note).
