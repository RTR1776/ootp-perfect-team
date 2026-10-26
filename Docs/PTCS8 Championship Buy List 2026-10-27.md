# PTCS 8 Championship: what to buy (2026-10-27)

L.J.: improve the deadball Championship teams this week, ahead of next week's price spike. Variants, LEs and other cards; about 40k PP now, more coming. A big Halloween deadball drop is expected this week, and few pre-1946 cards next week.

## Rosters rebuilt on collection 311 (saved, "Claude pick 2026-10-27 ch8")

| Bracket | Park | Roster |
|---|---|---|
| Iron | 1880 Agricultural County Fair Ground | 1255 |
| Bronze | 1903 South Side Park | 1256 |
| Silver | 1905 Hilltop Park | 1260 |
| Gold | 1876 Hartford Ball Club Grounds | 1259 |
| Diamond | 1920 Ebbets Field | 1258 |
| Open | 1885 Messer Street Grounds | 1261 |
| Cap | 1906 Columbia Park (slots P4 D4 G4 S4 B4 I6) | 1257 |

All are 1919 environment, no DH, cards from 1945 or earlier. **Rebuild after the Halloween drop.**

## The variant boost is +8%
Of L.J.'s 287 owned variants, every split rating sits at ×1.08 of the base card (median; Stuff 1.081, Contact 1.083, pHR 1.080, pBABIP 1.082, BABIP 1.082, Gap 1.083, Eye 1.080, Avoid K 1.082, Power 1.081). That is about +6 to +7 points. A quarter come in near ×1.04. Check: `web/scripts/.scratch/varboost2.mts`.

## Variant upgrades for every base card that starts
**Method:** 116 base cards in starting roles across the seven saved rosters, each scored as base and as ×1.08 in its bracket's park. Bats 70/30 by board, SP ×1.5, RP ×0.62 (the brackets' objective weights). The gain is per card, summed over the brackets it starts in. Prices are recent variant sales (last 10). Script: `web/scripts/.scratch/var-scan.mts`.

**Buy now, cheap and clear:**

| Variant | Gain (runs) | Recent price | Where |
|---|---|---|---|
| Fred Goldsmith | +4.7 | 148 | Iron SP |
| Ted Easterly | +3.1 | 186 | Iron |
| Vince DiMaggio | +2.7 | 192 | Iron |
| Larry French | +2.0 | 111 | Iron RP |
| Maurice Archdeacon | +4.1 | 911 | Iron |
| Tim Keefe | +2.2 | 721 | Iron RP |
| Walt French | +3.0 | 2,481 | Iron |
| Pretzels Getzien | +3.4 | 2,074 | Bronze SP |

- The Iron set is about +22 runs for under 5k, but only if Iron qualifies (85 points short).
- Prices that low are last sales. Check the auction house before bidding high.

**Best mid-price buys:**

| Variant | Gain | Price | Where |
|---|---|---|---|
| **Roy Thomas** (82) | **+19.8** | 40,043 | Diamond 5.4, Gold 5.3, Cap 5.2, Open 3.9 |
| Frank Grube (60) | +4.3 to +5.3 | 11,101 (auction bid 8,003) | Bronze C |
| Jack Burdock (87) | +5.2 to +6.8 | 18,510 (auction 8,888) | Gold 2B |
| Mack Eggleston (88) | +4.3 (build) | 20,864 (auction 7,434) | Gold C vs LHP |
| Ray Dandridge (88) | +3.4 | 11,412 | Gold |
| Tom Brown (66) | +7.9 | 30,376 | Bronze 4.0, Silver 3.9 |

**The auction list:**
- **Buy:** Grube, Burdock, Eggleston.
- **Fine if cheap:** Eddie Collins (Diamond +1.8, bid 10k), Connie Day (Iron +2.1, Bronze +1.4).
- **Pricey for the gain:** Biz Mackey (Silver +4.5, Gold +3.5) at 65k.
- **Skip:** Hafey (Gold +1.6) at 44k+. Neale (+0.7).
- **Don't start:** Gooch, McQuinn, Keister, Tierney, Montalvo and Tabor. Bob Boone, Molina and Semien are post-1945 and not eligible.
- **Not owned:** Pryor and Speaker base cards don't start (Card Fit), so their variants are unlikely to.

**Big gains, but no variant sales on file (look in the auction house):**
- Charlie Blackwell (+15.4)
- Luke Appling (+15.3)
- Johnny Bassler (+12.5)
- Sam Streeter (+9.1)
- Hank Gowdy (+8.6)
- Tetelo Vargas (+8.1)
- Frankie Frisch (+5.2)
- Dizzy Dean (+5.2)

**Gains at a ratio that doesn't pay:** Manush, Hornsby, Pop Lloyd, Rile, Cy Young, Plank, Hilton Smith (0.0 to 0.2 runs per 10k PP).

## Cards he doesn't own (59 pre-1946 cards with an ask)
- Card Fit's one-swap gains put several starting pitchers into Cap (Webster McDonald +13.9 at 10k, Hubbell +11.9, Faber +6.2). **None held in full builds:** with all three assumed owned, Cap stays at 334.2 (9 starts). Card Fit ignores Cap's slot limits; the Diamond and Perfect slots hold better cards. McDonald adds +1.4 in Diamond.
- Nothing else he doesn't own starts at +1 for a reasonable ask (Hodapp 110k, Brouthers 150k, Greenberg 262k and up).
- **Wait for the Halloween drop.** Then rebuild all seven and rerun this scan before spending big.

## Timing and aging
- Pre-1946 cards don't change ratings week to week (only Live cards do). The risk to a buy is being replaced by a new card.
- A variant pays only while its base card keeps the job. Roy Thomas, Grube and Burdock all start by clear margins.
- This week's Halloween drop is the last real influx before the Championship. Rebuild right after it; next week's lineups should hold to 11-07.

## Parks and defense
**What the model does:** glove value scales with balls in play by era (gloveScale), not by park. 1919 is a high balls-in-play era, so every bracket already prices gloves about 20–35% above a modern event.

**The parks:**
- **Triples parks** (big outfield gaps): Hilltop (Silver, 3B 1.12) and Ebbets (Diamond, 1.09). Outfield range plausibly matters more there.
- **Hitters' park:** Columbia (Cap, AVG 1.08–1.10, 2B 1.14, HR vs LHB 1.37).
- **Pitchers' parks:** South Side (Bronze) and Messer (Open).

**Untested:** park-by-glove interaction is not in the model and has not been tested. It is testable on the win harness (outfield range against park 2B/3B factors).
