# Model review — 2026-09-26

L.J. asked for a fresh look: how well do ratings predict how cards actually play, and can the engine be tuned from the play we have? Every number below comes from the archive in `observed_card_stats`: 69 series, 16M PA. Reproduce them with `pnpm model:panel`, then `python3 scripts/model-audit.py ../Archive/.model-panel.csv`.

## Bottom line

- **Bats are close to what this data can support.** Within a field, the model ranks bats at **r 0.69** against how they played. That is about 64% of the real spread between cards once sampling noise is removed.
  - With the card's play in other events blended in (what /build ranks on), a held-out event is predicted at **0.73**.
  - The scale is right: the slope is 0.98 in each event's own environment.
- **Arms are the weak half:**
  - r 0.52 against FIP and 0.42 against runs allowed, with role held equal.
  - Starters 0.46. **Relievers 0.29.**
- **Two real errors, both fixed:**
  - Owned variants lost most of their boost (PR #26).
  - Five parks never resolved, including Thursday Night Gold Rush's (this PR).
- **The remaining limit is the data, not the curves.** The observed table does not know which copies were variants, or what a Live card's ratings were when it played. Every fit and the blend inherit that blur. Fixing it is next step 1.

## How good it is, in numbers

**Bats:** 5,221 card-series lines with 300+ PA, 1,218 cards.

| | r |
|---|---|
| Raw curves | 0.63 |
| Calibrated + era correction (what /build uses) | 0.69 |
| The same, on events held out of the fit | 0.66–0.68 (the era slopes were fitted on these events) |
| Plus the card's observed play elsewhere (the blend, K 5,000) | **0.73** |
| Fields capped at 70 or less (Iron/Bronze) | **0.41** |
| Fields capped 70–80 / 80–90 / 90–100 / above | 0.70 / 0.64 / 0.75 / 0.77 |

**Arms:** 4,506 lines, 1,024 cards.

| | r |
|---|---|
| vs FIP | 0.52 |
| vs FIP, pBABIP switched off (FIP cannot see it) | 0.65 |
| vs runs allowed | 0.42 |
| vs runs allowed, pBABIP switched off | 0.39. pBABIP earns its place. |
| Starters, vs runs allowed | 0.46 |
| **Relievers, vs runs allowed** | **0.29** |

## Fixed

1. **Variants in the observed blend** (PR #26, live).
   - Before: the blend pulled an owned variant back to the base card's observed level.
   - Kaelen Culpepper's FLF 20 has 59,593 PA on record, so his Level 5 variant scored +3.0 in Daily Live Gold where +8.8 is right.
   - Now the base card's *deviation from its ratings* carries over to the variant. Base cards: no change.
2. **Parks** (this PR). Catalogue spellings the park table files under another name ran neutral:
   - "2026 Great American Ball Park": **Thursday Night Gold Rush** (a HR ×1.14–1.17 park)
   - "Heinsohn Park": four Silver/Bronze/Gold dailies (neutral on file anyway)
   - "2008 McAfee Coliseum": Oakland
   - "2005 Minute Maid Park": now Daikin Park

   Only "1890 Exposition Park" is still unknown (no factors on file). On Gold Rush the fix adds about a run to good bats and barely reorders the top of the board.

## Tested, and not better than what ships

So nobody re-derives these.

| Idea | Result |
|---|---|
| Refit the rating curves within each field, and let each outcome depend on every rating | No gain in runs (0.666 vs 0.669 on the same frame). The structure below is real, but the runs don't move. |
| Take each event's environment from its own exports, not the MLB era table | +0.05 on raw curves, about +0.02 at best once the correction is refit. It rescues some Bronze events (Bronze Only Cap 0.11 → 0.52) and costs some Gold ones (Golden Heart −0.09). |
| Recalibrate the era table to how PT plays (below) | +0.014 raw, ~0 after the correction. Arms ±0.01. |
| Fit the correction jointly per era band | +0.01 on held-out cards, **worse on held-out events** (0.61–0.63). Overfits the few events in each band. |
| Weight a card's observed play by how similar the event is (tier, era) | No gain. Pooled play at K = 5,000 is right (0.73 at 5k and at 10k). |

## What the play says about PT's engine

Each effect is measured within a field, holding the other ratings fixed. Units are the change in the log rate per unit of log rating.

**Bats:**
- K, BB and BABIP each follow one rating: Avoid K, Eye and BABIP.
- **HR per ball in play falls with Avoid K** (−0.50), Eye (−0.15) and BABIP (−0.18) at the same Power (+0.71). The app lets only Power move HR, so it overpays contact bats for homers.
- **Doubles + triples rise with BABIP** (+0.26) as well as Gap (+0.68). The app lets only Gap move them, which is part of why BABIP looked under-priced 2–3×.
- Triples' share of extra-base hits follows Speed (+0.72).

**Arms:**
- K follows Stuff, and **flattens at high Stuff**: 0.54 at Stuff 110, 0.37 at 150.
- BB follows Control.
- HR per ball in play follows pHR. **High-Stuff arms give up more HR per ball in play** (+0.23).
- BABIP against barely moves with pBABIP (−0.05; Movement −0.16). Runs allowed still respond to it.
- **Movement carries the most weight** when runs allowed are fitted on all five pitching ratings together. The app does not read Movement.

**Per point, ratings pay about the same in every tier:** +12 to +20% HR per +10 Power, −7 to −9% K per +10 Avoid K, from Iron to Perfect.

**PT's "run environment" year moves play only part of the way to that MLB season.** This is the share of the season's difference from 2010 that shows up in play:

| | share |
|---|---|
| K | 47% |
| BB | ~0 |
| HR | 72% |
| Doubles + triples | 45% |
| BABIP | ~all |

Even at 2010, K, BB and HR run 12–16% below the model's level.

For example, 1927 Silver Heart plays 2.8× the K the 1927 table implies, and 2010 events 0.7–0.9×. The era correction had been absorbing this. To model it instead, use these factors, fitted on 42 events: `log(obs/pred) = a + b·log(era/2010)`

| | a | b |
|---|---|---|
| K | −0.141 | −0.527 |
| BB | −0.179 | −0.975 |
| HR | −0.132 | −0.281 |
| Doubles + triples | −0.065 | −0.552 |

## Next, in order

1. **Record the ratings each copy actually played with.**
   - Every export row carries its ratings, VAR and VLvl, and the parser already reads them (`LeagueStint.ratings`, `isVariant`). `import-observed` then throws them away and keys everything on the base card.
   - Plan: keep the PA/BF-weighted sums of the played split ratings and the variant share of PA in a new `played` jsonb column on `observed_card_stats` and its stage table. Then run one full `pnpm import:observed` on the Mac.
   - Then:
     - the blend measures each card against the ratings it had, so other players' variants stop inflating a base card and a variant's boost is not partly counted twice;
     - Live cards stop being judged on today's ratings for last month's play;
     - every fit above gets cleaner.
2. **Run the tourney tests.** Seven events are on record from before their next runs (`reference/tourney-tests/`); grade each after its export is filed, with cwhit's projection boards beside them.
3. **Bronze and Iron.** The model is weakest there: r 0.41, about 0.35 on events it has not seen. In those fields, trust observed play (the blend) over ratings, and grade the Bronze snapshots first.
4. **The environment recalibration above.** Ship it only together with a refit of the calibration and the era correction, which absorb the same effect today.
5. **Relievers.** Their projections are the least reliable part of the model (0.29). Price relief arms with that in mind, and lean on observed play where a reliever has it.

Analysis scripts: `web/scripts/model-panel.ts` (the panel) and `web/scripts/model-audit.py` (the numbers above). The one-off experiments are summarised here and were not kept.
