# Live-Plus Bronze Pop-up — Claude pick, 2026-09-29

A one-off pop-up, starting Tuesday 09-29 at 18:59 and simming every 10 minutes. The rules, from L.J.'s screenshot:
- 1,000 PP entry
- Bronze or lower (cards up to 69), 2026 cards only
- default strategy and stats settings (the PT default run environment), DH
- 2026 Yankee Stadium (AVG .967/.975, HR 1.068/1.035, 2B .955, 3B .854), which matches the park table's 2026 row
- a quadruple round robin in 16-team pools (60 games), then the top 8 go to a best-of-9 bracket

It wasn't in the catalogue: catalogue:sync only learns events from the community dumps. `Save Pop-up Roster.command` adds it as event 9300001 (with the new `scripts/catalogue-add.ts`) and saves this roster to /build as "Claude pick 2026-09-29". The roster passes the event's rules, checked in memory before the event exists.

## The environment

- **Scoring:** PT default, 4.37 runs a game, strikeouts 22.6%, homers 3.2% of PA. The park is close to neutral (0.02 runs a game toward left-handed bats).
- **What ratings pay:** power, +5.5 runs per 10 points, then Avoid K at +3.2. For arms, pHR then Stuff.
- **Borrowed field:** the pop-up has no exports, so the build borrows **Daily Live Plus** (`--series liveplus`, 7 exports): the same 2026-only card rule, without the Bronze cap.
  - Its teams face left-handed pitching on **45% of batters**, far above the usual 30%. So the lineup against LHP weighs 45% here.
  - A starter counts as 1.25 lineup spots and a reliever 0.39.
- **Shape:** 5 SP / 7 RP / 14 bats. The round robin is 60 games, so the whole staff pitches.

**Pool:** 1,039 of his cards qualify: 1,020 of the 1,021 Live cards rated Bronze or lower, all 18 Future Legends from 2026, and one 2026 Snapshot. The Future Legends carry the roster, most of all his four variants.

    node --import tsx scripts/env-roster.ts --park "Yankee Stadium" --park-year 2026 --dh --max 69 \
      --card-year-min 2026 --card-year-max 2026 --size 26 --series liveplus --optimize --starts 16 \
      --sp 5 --rp 7 --bats 14 --role-trust 0.25 --name "Live-Plus Bronze Pop-up"

(No `--year`: env-roster then reads the PT default row. `--year 2010` reads MLB's 2010 instead; see the handoff.)

−65.5 weighted runs (greedy −76.9) · legal · value 1,719 · 4 variants · two catchers. Live cards rate flat, so most bats are below the era's average card. The whole field draws from the same cards.

```
vs RHP (runs/700 on the board)          batting order                   OBP/SLG
  C   Thayron Liranzo (VAR)   -3.0      1  Jett Williams          3B   .309/.359
  1B  Edward Florentino (VAR) +9.3      2  Edward Florentino (VAR) 1B  .315/.394
  2B  Jefferson Rojas         -7.8      3  Thayron Liranzo (VAR)  C    .308/.380
  3B  Jett Williams           -8.1      4  Jhonny Level (VAR)     SS   .305/.414
  SS  Jhonny Level (VAR)      +3.8      5  Jefferson Rojas        2B   .304/.396
  LF  Daylen Lile            -11.0      6  Daylen Lile            LF   .294/.383
  CF  Roldy Brito             -9.5      7  Kody Clemens           RF   .290/.392
  RF  Kody Clemens           -10.1      8  Vladimir Guerrero Jr.  DH   .303/.364
  DH  Vladimir Guerrero Jr.   -7.4      9  Roldy Brito            CF   .303/.361

vs LHP
  C   Thayron Liranzo (VAR)   +1.0      1  Jett Williams          3B   .321/.389
  1B  Vladimir Guerrero Jr.   -6.7      2  Thayron Liranzo (VAR)  C    .312/.391
  2B  Jefferson Rojas         -1.1      3  Jhonny Level (VAR)     SS   .304/.393
  3B  Jett Williams           +4.0      4  Jefferson Rojas        2B   .311/.410
  SS  Jhonny Level (VAR)      +0.1      5  Mauricio Dubon         LF   .300/.376
  LF  Mauricio Dubon         -11.3      6  Vladimir Guerrero Jr.  1B   .304/.365
  CF  Roldy Brito             -8.6      7  Dominic Canzone        DH   .294/.381
  RF  Teoscar Hernandez       -9.3      8  Teoscar Hernandez      RF   .295/.372
  DH  Dominic Canzone        -10.1      9  Roldy Brito            CF   .303/.360

Rotation: Kyson Witherspoon (VAR) +0.5 · Tanner McDougal −0.9 · Andrew Alvarez −3.4 · Jake Bloss −3.5 · Patrick Sandoval −4.2
Bullpen:  Justin Bruihl (CL) +1.7 · Juan Morillo +1.4 · Caden Scarborough +1.3 · Riley O'Brien +1.0 · Evan Sisk +0.1 · Grant Wolfram −0.4 · Jose A. Ferrer −0.6
Bench:    Dominic Canzone, Teoscar Hernandez, Masataka Yoshida, Mauricio Dubon, Carter Jensen (second catcher)
```

The batting order is from Build's batting-order model. It matches the usual order to the hundredth of a run on both boards (3.88 and 3.89 runs a game), so any sensible order is fine here.

## Upgrades

There is almost nothing to buy. He owns every card this event takes but one Live card: Johan Rojas, a 59 CF who scores about −20 here, no upgrade. Live cards don't come as variants.

So the upgrades are **Future Legend variants of cards on this roster**. Each was scored at the typical variant bump (+5 hitting, +3 pitching; real variants vary), against the same card's base form. Prices are the variants' last-10 averages on the 09-29 shop list.

| Variant | Slot | Gain | Price (L10) | Verdict |
|---|---|---|---|---|
| Jake Bloss (VAR) | SP | +1.6 runs/700 BF, ×1.25 for a starter | ~3,500 | **Best value** |
| Tanner McDougal (VAR) | SP | +1.4, ×1.25 | ~13,600 | Good |
| Roldy Brito (VAR) | CF, both lineups | +3.3 | ~37,400 | Worth it if you'll use him elsewhere |
| Jefferson Rojas (VAR) | 2B, both lineups | +3.6 | ~168,000 | Too dear for this |
| Jett Williams (VAR) | 3B, both lineups | +3.4 | ~154,000 | Too dear for this |
| Caden Scarborough (VAR) | RP | +1.2, ×0.39 for a reliever | ~57,900 | No |

- **Other variants:** cheap ones of cards not on the roster (Trey Gibson ~1,700, Winston Santos ~4,100, Jimmy Crooks ~2,400, Trei Cruz ~1,000) don't displace anyone on this model.
- **Timing:** the round robin is 60 games, so any gain counts over a long stretch. But this is one event: buy only what also helps elsewhere. Brito, Bloss and McDougal are all in the Bronze pool.
- **On Build:** once the event is in the catalogue, its shop board lists these variant offers for this event, priced. Build's own Optimise there assumes the usual 30% left-handed pitching until the pop-up has exports of its own. The saved pick uses Daily Live Plus's 45%, so trust the pick over a fresh Optimise for the lineup against LHP.
