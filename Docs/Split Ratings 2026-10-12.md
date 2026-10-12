# Split ratings: do vs-LHP / vs-RHP ratings pay like overall ratings? (2026-10-12)

L.J. asked after the Daily Diamond 1990 Onward build started Brian Jordan (74; vs LHP BABIP 165, Gap 140) over his diamonds: the builder scores every bat on its split ratings, and nothing had checked that a split rating is worth what an overall rating is.

## Data

League split exports (the only source with each player's line against each hand): 39 complete league weeks across HD450–453, PEL and LD404 (HD452 10-01/10-08/10-10 partial copies dropped), base cards only. 6,666 card × week × split rows, 229 cards, 6.67M PA (3.0M vs LHP). Scripts: `web/scripts/model-v2/split-panel.mjs` (export), `split-fit.py` (fits). wOBA per rating point, converted to runs per 700 PA per +10 (÷1.2 wOBA scale); week × split fixed effects throughout.

Caveat: league play uses the meta's ~230 cards, so the range of ratings is narrower than in tournaments, and the environments are the league's (mostly 2010, plus theme weeks). The ratios below are what carry over; the levels are the league's.

## Results (runs per 700 PA per +10)

| | BABIP | Gap | Power | Eye | Avoid K | R² |
|---|---|---|---|---|---|---|
| A. overall ratings predict each split | 1.66 | 0.61 | 1.84 | 0.94 | 1.22 | 0.30 |
| B. split ratings predict each split | 1.55 | 0.72 | 1.87 | 1.12 | 1.60 | **0.45** |
| C. overall part | 1.83 | 0.66 | 1.82 | 1.12 | 1.47 | |
| C. split − overall deviation | **1.08** | 0.99 | 2.02 | 1.23 | 1.78 | |
| C. deviation ÷ overall | **0.59** | 1.50 | 1.11 | 1.10 | 1.21 | |
| E. same card, same week (vL − vR) ÷ A | **0.78** | 1.58 | 1.22 | 1.02 | 1.46 | |

- **Splits are real.** Split ratings explain each split's production far better than overall ratings: R² 0.45 vs 0.30, and 0.45 vs 0.29 on held-out cards (20 random halves). The builder is right to use them.
- **No extra platoon effect:** at equal ratings a lefty bat is no worse against lefties (intercepts ±0.004 wOBA). The ratings already carry the platoon split.
- **BABIP is the exception.** The part of a split BABIP that differs from the card's overall BABIP pays only 0.6–0.8 of an overall point (two designs, both well below 1). Power, Eye and Avoid K splits pay in full or more; Gap's ratio is high but on the smallest weight.
- Typical vs-LHP/vs-RHP gaps: median 13–17 points, 90th percentile 38–51.

## What it means for the builder

The builder pays a split BABIP point at the full (era) BABIP slope. On this evidence a card whose split BABIP is far above its overall (Brian Jordan: vs LHP 165, overall 128) is over-credited on that board by about (165−128)/10 × the era BABIP slope × 0.2–0.4: in the 1957 band (3.19 per +10) about 2.6–4.7 runs per 700 PA vs LHP.

Proposed fix (not applied; L.J. to decide): score BABIP on each board as overall + 0.7 × (split − overall), and leave the other four ratings on their splits. Check on the tournament archive before use, as with the earlier model fixes.

## Daily Diamond 1990 Onward, the case that started it

- Model (current): vs LHP Jordan +14.8, Waldschmidt (94) +9.4, Andruw Jones (99, no LF rating) +6.4; Jordan LF glove 146 vs 110.
- With Jordan, Zunino and Pena banned the best roster scores 417.3 against 428.5 (−11.2 for all three). Replacements: Cespedes (VAR) LF and Rainiel Rodriguez C vs LHP, Aidan Miller SS vs LHP, Nimmala SS vs RHP, Tartabull DH vs RHP.
- With the BABIP shrink, Jordan's lead over Waldschmidt vs LHP falls from 5.4 to about 1–3 runs before gloves.
- The field's 63% LHP share is this event's own (3 exports, 178 teams). L.J., 10-12: keep it.

## Applied 2026-10-12 (L.J.: "apply the BABIP fix and rebuild")

`SPLIT_TRUST = { BABIP: 0.6 }` in `web/src/lib/analytics/card-value.ts` (`trustedSplit`), read by `ratingOf` (the curves) and env-fit's era correction. Set at 0.6, the league's direct read, not the 0.7 first proposed: the tournament archive (8,991 card-series with 100+ PA, observed wOBA against the model blended by each series' own LHP share, within series) improves steadily as the trust falls — r 0.6280 at 1.0, 0.6319 at 0.7, 0.6331 at 0.55, 0.6352 at 0 — and most for cards with a 30+ point BABIP split (0.5636 → 0.5796 at 0.55). The archive sees only totals, so it is the weaker test of a split; it says "at least this much". Unit tests 282/282 before and after.
