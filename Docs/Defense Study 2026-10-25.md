# Defense Study, 2026-10-25: how bad a glove can you play?

L.J.'s question: where is it fine to play the bat over bad defense, and how bad is OK, in tournaments? League data is normalized, so this uses only the raw tournament exports.

**Data:** 701 tournament exports in `Archive/Completed`:
- 882k fielder lines and 689k pitcher lines.
- Each line has the card's rating at all 8 positions, plus ZR, outfield ARM runs, catcher framing (FRM) and innings fielded.
- Team level: 14,678 team-events in 694 exports.

**Scripts:** `web/scripts/defense-study/` (`load.py`, `curve.py`, `team.py`, `oop.py`, `table.py`).

**Units:**
- Runs per full season: 1,400 innings in the field, the same scale as the model's bat runs per 700 PA.
- Ratings are measured against the field: the innings-weighted average rating at that position in the same export.

## 1. ZR undercounts defense by about 30%
- Method: team runs allowed per 1,400 IP, regressed on HR, BB+HBP, K and the team's ZR + ARM + FRM, within each export.
- Result: each ZR run is **1.30 ± 0.03 runs allowed**.
- So ZR does not capture all of defense's value. Every ZR-based number below is multiplied by 1.30.

## 2. What a glove costs, by position
Cost is in runs per season, measured against an average glove for that field. The first four cost columns come from per-card curves (ZR + ARM + FRM, ×1.30).

| Pos | Field avg rating | −10 | −20 | −30 | −45 | Team-level fit, per +10 | Model now, per +10 (×2 team weight) |
|---|---|---|---|---|---|---|---|
| C  | 87  | 2.7 | 6.6 | 11.3 | 14.8 | 4.1 (incl. framing) | 1.0 + framing (≈4.2 per +10 FRM) |
| 1B | 77  | 2.6 | 4.6 | 6.0  | 6.5  | 1.7 | 2.5 |
| 2B | 112 | 4.4 | 7.0 | 9.4  | 12.0 | 5.1 | 4.0 |
| 3B | 91  | 3.5 | 6.9 | 9.8  | 10.7 | 2.0 | 3.2 |
| SS | 106 | 3.9 | 7.1 | 10.2 | 14.4 | 5.2 | 4.5 |
| LF | 97  | 3.3 | 6.4 | 9.1  | 12.8 | 3.1 | 2.0 |
| CF | 111 | 2.3 | 4.5 | 6.3  | 8.7  | 3.4 | 1.9 |
| RF | 98  | 3.4 | 5.5 | 7.4  | 10.2 | 2.2 | 2.2 |

**How the team-level fit was run:**
- Team runs allowed, regressed on the team's innings-weighted rating at each position, within each export.
- Pitching was held fixed by its outcomes (HR, BB+HBP, K).
- Catcher is the exception: holding K and BB would absorb framing, so catcher pitching was held by pitcher ratings instead.
- SEs are about ±0.5–0.9 per +10, from bootstrapping exports.

**The two methods disagree at 3B and CF:**
- At 3B the per-card curves read higher than the team fit. At CF they read lower.
- Read those two as ranges: 3B 2–3.5 runs per +10, CF 2.3–3.4.

## 3. The shape: no cliff, except catcher and LF
- **Mostly linear** down to about 20–30 points under the field.
- **Flattens at 1B, 3B and 2B** below about −30: extra slope −0.6 to −1.1 per +10, t 3–7.
  - At 1B, even a glove 45 points under the field costs only ~6.5 runs.
- **Steepens at C and LF** below −20: +0.7 and +1.1 per +10, t 4–5. Those are the real cliffs.
  - A very bad catcher costs ~15 runs: the framing and blocking add up.
- **Flat at the top for 1B, LF and RF.** Above +15 a better glove there buys almost nothing.

## 4. Out of position: no extra penalty
- Test: residual glove runs after the rating, for cards playing a spot 15+ points below their best one.
  - SS: +0.05 runs. CF: +0.08. 3B: +0.5.
  - 2B: +2.3. RF: +2.1. 1B: +1.2.
- In other words, natural shortstops at 2B and natural CFs in RF play *better* than their rating there.
- The displayed rating at the position is what plays. The web search found a former OOTP developer's forum post saying tournament cards carry no experience at new positions. That is consistent: the experience is already baked into the rating shown.

## 5. Environment
- High-BIP events (above the median 28.7 balls in play per 9) raise infield glove value by 15–25%: SS 3.5 vs 2.8 per +10, 2B 2.7 vs 2.2.
- Catcher goes the other way: framing is worth more in high-K events (3.2 vs 1.6 per +10).
- The archive's environments sit in a narrow band (IQR 27.4–29.9 BIP per 9), so this is a second-order effect. Deadball wasn't separated out.

## 6. The trade: glove points against bat points
The 2010 environment prices +10 Power at ≈ +5.1 runs per 700 PA, +10 Avoid K at +3.3, BABIP +1.8, Eye +1.2.

| Position | 10 glove points ≈ |
|---|---|
| SS, 2B | ~10 Power points |
| C | ~8 Power points |
| CF, LF | 6–7 Power points |
| 3B, RF | ~4 Power points |
| 1B | ~3–4 Power points, and the curve flattens below −30 |

**Rules of thumb:**
- **1B:** always play the bat. The worst glove on file costs ~6 runs a season.
- **RF and 3B:** the bat wins unless the glove is 30+ under the field *and* the bat gain is under ~8 runs per 700 PA.
- **LF:** fine to −20. Below that it steepens, so a −30 LF needs a ~9-run bat edge.
- **CF:** each point is cheaper than SS, but the model under-prices it (1.9 vs a measured 3.4 per +10). A −28 CF (Bautista at 83 vs a field of 111) costs ~6–10 runs; the model says ~5.
- **SS and 2B:** the steepest per point (~0.5 runs each). A −30 SS costs ~10 runs, which is what separates a +40 bat from a +50 bat.
- **C:** framing dominates, and it falls off a cliff below −20. Don't go there.

**Short tournaments:** these are per-game rates, so the trade is the same in a Bo7 bracket as over a season. Only the noise is bigger.

## 7. What the model does now, and what's open
`roster-objective` prices gloves as `fielding.json` slope × 0.887 × FIELDING_CALIBRATION × team weight 2 × the environment's glove scale.

**Against the team-level fit:**
- **Under-priced:** CF (1.9 vs 3.4), LF (2.0 vs 3.1), 2B a little (4.0 vs 5.1).
- **Over-priced:** 3B (3.2 vs 2.0) and 1B (2.5 vs 1.7).
- SS and RF are close. Catcher, framing included, is close.
- The model is also linear, so it doesn't see the flattening at 1B/3B/2B or the C/LF cliffs.

**Why this isn't wired in yet:** the 10-17 audit found that raising all glove factors toward the ZR-implied values made win prediction worse in 40 of 40 half-samples. A per-position change, with the shape terms added, needs the same test on the `teams.mts` win harness before it goes in.

## Outside research (web, 2026-10-25)
Very little is published.
- **The only per-point table:** a hobby project's fit of ZR against the 20–80 DEF rating in a single league. Runs per 10 DEF: CF 8.8, SS 8.6, 3B 7.4, RF 7.1, 2B 6.6, LF 5.0, 1B 2.4, C 0.8. One league and not Perfect Team, so I didn't use it. https://github.com/boba-jjang/ootp-consultation/pull/58
- **Framing:** OOTP's developer, years ago: the best framer is worth ~+3 wins and the worst ~−2. https://forums.ootpdevelopments.com/showthread.php?p=3284711
- **Position ratings:** a forum fit for OOTP 26 says each component is piecewise linear with cut points. That describes how the *displayed rating* is built, not how it turns into runs. https://forums.ootpdevelopments.com/showthread.php?t=363743
- **Minimums:** American Circuit's essays give league minimums: SS Range 65+, CF Range 65+, 2B Range and Turn DP 55+. That is opinion, with no data behind it.
- **Out of position:** a former developer's forum post says tournament cards carry no experience at new positions. https://forums.ootpdevelopments.com/showthread.php?t=313446
- **Caveat:** the forums blocked direct reads and Reddit was blocked, so the forum items above come from search summaries.
