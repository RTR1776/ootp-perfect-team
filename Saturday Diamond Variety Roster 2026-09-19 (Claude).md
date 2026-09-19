# Saturday Diamond Variety — Claude's pick, 2026-09-19

1975 RE · 1981 Metropolitan Stadium · no DH · Diamond or lower · Negro League Star + Future Legend + Snapshot only (card_type 2/6/7) · 128 teams, Bo7 · starts Sat 7:59pm · field 43% LHP / 46% LHB (three exports).

Priced with `pnpm roster:corrected` (the era-slopes correction on top of the calibrated model, then the observed blend), then the vs-RHP infield re-seated by hand; the search finds nothing better from it. 184.3 weighted runs under corrected pricing against 182.9 for the model's own build (`Daily Diamond Variety Roster 2026-09-19.md`). Load file: `Inbox/rosters/diamondvariety-claude-2026-09-19.txt`.

    pnpm roster:corrected --series diamondvariety --year 1975 --park "Metropolitan Stadium" --park-year 1981 \
      --min 40 --max 99 --card-types 2,6,7 --min-pos "70,1B:0,LF:50,C:65" \
      --roster Inbox/rosters/diamondvariety-claude-2026-09-19.txt --max-passes 0

## vs RHP (57% of plate appearances)

| pos | player | val | B | runs | glove | here (3 exports) |
|---|---|---|---|---|---|---|
| C | Tom Young | 91 | L | +7.6 | 67, −0.7 | 1,040 PA .276 |
| 1B | Shoeless Joe Jackson | 88 | L | +20.2 | 73, −0.5 | 1,613 PA .328 |
| 2B | Hank Thompson | 87 | L | +15.7 | 88, −3.9 | 142 PA .355 |
| 3B | Honus Wagner | 99 | R | +13.6 | 114, +3.1 | 7,819 PA .317 |
| SS | Ethan Holliday | 95 | L | +15.2 | 87, −2.7 | 2,207 PA .314 |
| LF | Al Simmons | 99 | R | +11.7 | 90, −0.4 | 5,816 PA .327 |
| CF | Chick Stahl | 93 | L | +13.1 | 111, −0.1 | 2,064 PA .319 |
| RF | Zyhir Hope | 86 | L | +11.8 | 105, +0.6 | 584 PA .326 |

Order: Stahl, Jackson, Thompson, Holliday, Wagner, Simmons, Hope, Young, pitcher.

## vs LHP (43%)

| pos | player | val | B | runs | glove | here |
|---|---|---|---|---|---|---|
| C | Josh Gibson | 84 | R | +7.7 | 69, −0.7 | 58 PA .356 |
| 1B | Josh Vitters | 95 | R | +19.0 | 92, +1.9 | 1,250 PA .323 |
| 2B | Aidan Miller | 98 | R | +11.3 | 123, +1.5 | 4,462 PA .314 |
| 3B | Arjun Nimmala (VAR) | 94 | R | +9.3 | 128, +4.9 | 2,866 PA .313 |
| SS | Honus Wagner | 99 | R | +12.0 | 113, +0.9 | |
| LF | Al Simmons | 99 | R | +25.9 | 90, −0.4 | |
| CF | Chick Stahl | 93 | L | +16.0 | 111, −0.1 | |
| RF | Shoeless Joe Jackson | 88 | L | +12.2 | 83, −1.3 | |

Order: Stahl, Wagner, Simmons, Nimmala, Vitters, Miller, Jackson, Gibson, pitcher.

## Staff

- **Rotation:** J.A. Happ (L, +12.5; 218 IP here, 3.65) · Larry Jackson (R, +9.3; 184 IP, 3.70) · Payton Tolle (L, +8.5; 3,493 IP, 3.82) · Sam Jones (R, +8.3; 528 IP, 3.95) · Jordan Montgomery (L, +8.2) · Connelly Early (L, +7.7; 1,594 IP, 3.87)
- **Pen:** Joe Sambito CL (L, +8.5; 991 IP, 4.07) · Jake McGee (VAR, L, +8.0) · Noah Schultz (L, +7.3) · Pete Donohue (R, +6.9; 1,534 IP, 4.06; the long man, stamina 73) · Andrew Miller (L, +6.7) · Gary Lucas (L, +6.6)
- **Bench:** Vitters, Miller, Nimmala, Gibson (the vs-LHP starters) · Gus Bell (L, +12.8 vs RHP, the pinch bat) · JJ Wetherholt (VAR, L, +11.5 vs RHP, covers 2B/SS)

26 cards · value 2,388 · 3 variants · legal.

## Why

- **The pricing.** `pnpm era:slopes` shows play in 1961–76 environments returning 2.05 runs per +10 BABIP where the calibrated model pays 1.06, and 1.37 per +10 Avoid Ks against 0.88; Power 2.13 against 1.58. The correction adds those gaps per rating point before the blend. It moved three slots: Zyhir Hope for Nunnally in right vs RHP (BABIP 120 vR, and .326 in 584 PA here), Donohue for Reynolds in the pen, Wetherholt for Doby on the bench. The rest of the roster is fixed by play, not ratings — Wagner has 141,000 PA on record, Simmons 74,000, Jackson 77,000 — so no re-pricing of the ratings moves them.
- **The re-seat vs RHP.** Holliday (+15.2) was on the bench because his only position is short and Wagner is better there. Wagner is a 114 at third, Thompson an 88 at second, so Wagner 3B / Holliday SS / Thompson 2B / Miller to the bench scores 104.1 on that board against 102.5, +1.4 on the objective after the gloves. It puts two below-average gloves in the infield against right-handers; the runs already pay for that.
- **Catchers.** Tom Young's .276 here is 1,040 PA against a .303 field, about 1.6 standard errors low, and his 21,000 PA elsewhere say +7.6; there is no other left-handed catcher within five runs of him (Tait +2.0, Johnson −2.0). Gibson vs LHP needs the catcher floor at 65 (he is a 69); the alternatives are all below zero.
- **Two arms the field likes that are not here.** Red Faber (98) is rostered by 60% of the field and is a 4.26 FIP against a 4.21 field over 3,448 innings here; Donohue at 4.06 over 1,534 is the better long man. Larry Jackson's +9.3 rests on 9,500 BF, less than the others, but 184 innings here at 3.70 agree.
- **What could go wrong.** Thompson's .355 here is 142 PA, noise; his 13,000 PA elsewhere are the reason he plays. Hope's 584 PA is a modest sample for the one slot the correction changed; Nunnally (+9.5 vR, CF 100) is the fallback and is one card away.
