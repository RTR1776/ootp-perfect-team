# League buys after HD452 (2026-10-04)

Kansas City Torrent - JW finished HD452 78-83: runs scored 763 (7th), allowed 791 (28th; league 714).

**Method.** Each card's results are pooled over every HD and PEL league snapshot in the database (base and variant kept apart):
- Bats: wOBA against that week's split league, in runs per 700 PA, lightly shrunk (+300 PA toward 0).
- Arms: FIP-component runs saved against that week's league ERA, per 200 IP (+150 IP shrink).
- Catcher defence: the measured formula from `Docs/League Model 2026-09-26.md`, in runs per 1,000 innings.
- Prices: shop list of 10-04 (upload 193). Variant prices are last-10.
- Scratch: `buy.py`, `var.py`, `arms.py` in the session scratchpad.

## Run prevention was not the arms

On their pooled league records, the 13 arms who pitched should have saved about **25 runs against average** in the innings they threw (≈689 allowed). They allowed 791. The ~100-run gap is not card quality:
- Team ZR −13.8 (26th) is about 12 runs.
- Most of the rest is the park and luck: K% 24th and HR% 25th this season, below what these same arms do elsewhere.
- **Check the home park before buying arms.** It also flatters the offense (7th in runs).

## Catcher

| Card | Bat vs RHP (PA) | Bat vs LHP (PA) | Defence /1,000 inn | Price |
|---|---|---|---|---|
| Ed Bailey VAR (owned) | −4.2 (1,126) | −14.3 (143) | ≈ −0.6 | — |
| Josh Gibson (owned) | −5.1 (87,859) | +1.8 (102,183) | −0.9 | — |
| **Ethan Salas VAR** | **+2.0 (3,677)** | **+6.1 (834)** | **+10.9 measured** | **~314k L10** |
| Ethan Salas | −4.7 (65,032) | −14.7 (16,663) | +5.2 | 150k |
| Josh Gibson VAR | +1.1 (8,199) | +9.9 (10,046) | ≈ 0 | ~1.31M L10 |
| Cal Raleigh | +1.2 (3,846) | +2.4 (4,728) | +3.6 | ~1.5M L10 |
| Mitchell Murray | −4.7 (2,914) | +8.4 (3,503) | −0.6 | no price |

Season value (56% of PA against RHP): the Bailey/Gibson platoon ≈ −2. **Salas VAR alone ≈ +15, so about +17 runs (~1.7 wins) for ~314k.** Raleigh ≈ +5 at 1.5M. Gibson VAR as the vs-LHP half adds ≈ +3.5 over base Gibson, at 1.3M.

## Arms (runs saved per 200 IP; season value at the role's innings)

Owned and under-used: **Willie Hernandez +9.7 over 13,079 IP**, and he threw 20 innings. He belongs at the back of the pen. Dave Stieb −3.6 (3,299 IP) is the arm to drop.

| Buy | Role | Per 200 IP (IP on record) | K% | Price | Season gain |
|---|---|---|---|---|---|
| **Kenley Jansen** | RP | +6.0 (23,044) | 20.2% | 99.5k | ≈ +4 over Stieb's 84 IP |
| **Eddie Plank** | SP | +5.3 (13,740) | 16.8% | 225k | ≈ +3.5 over Saberhagen/Haddix |
| Kirby Yates | RP | +10.4 (3,318) | 19.5% | 437.5k | ≈ +2 over Gossage |
| Aroldis Chapman | RP | +4.0 (19,654) | 21.0% | 153k | strikeouts, modest runs |
| Cannonball Morris | SP | +3.2 (19,489) | 18.4% | 536k | small |

Strikeout rate by itself isn't what saves runs here. The FIP edge already counts the strikeouts, and the best run-savers (Plank, Hershiser) are not high-K arms.
