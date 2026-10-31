# Arm model audit (2026-10-31)

Report only. No model code, config or data was changed.

**Data:** `observed_card_stats` as of today: 119 series, 11,658 arm lines with 300+ BF (1,382 cards, 28.0M BF) and 13,605 bat lines with 300+ PA. Each variant copy is scored on its own ratings.

**Model:** each line is scored in its own series' environment (era, park, field LHB share), the way `model-panel.ts` does it. The `-pre` partitions use their parent series' environment. The 7 series with no tournament row use the PT default.

**Correlations:**
- Every r below is computed within series and weighted by BF (or PA for bats).
- "RA" means runs allowed per 700 BF above the field. "FIP" means FIP runs per 700 BF above the field.

**Scripts:** `web/scripts/.scratch/arm31/` (gitignored): `panel.mts`, `noise.py`, `ceil.py`, `rel.py`, `splitexp.py`, `feat.py`.

## 0. Fix this first: the live arm calibration has been broken since 10-30

The `model-calibration.json` committed in fc15157 ("Data from the Mac, 2026-10-30") reads **pit slope 0.2609, r 0.42**. On 10-25 it read 0.58 and r 0.62. The slope is `applied`, so **since 10-30 env-fit has scaled every arm's runs by 0.26 instead of about 0.58**. Against bats and gloves, arms are priced at about 45% of what play says they are worth.

**Cause:** one card.
- Card **87329** has pHR vL 4, and it entered the archive through `dankdaily` and `c4q1`.
- The pHR curve has a positive curvature term (γ +0.25). Below its fitted window (44–179) it blows up: the HR multiplier is about 160×, and the model scores the card at **−2,842 runs/700 BF**.
- One line like that flattens the calibration fit.

| Arm fit, lines with 300+ BF | FIP r / slope | RA r / slope |
|---|---|---|
| model:calibrate frame (PT default), as shipped | 0.422 / 0.253 | 0.338 / 0.236 |
| same, without card 87329 | 0.634 / 0.572 | 0.505 / — |
| same, ratings clamped to each curve's fitted window | **0.652 / 0.614** | 0.526 / 0.578 |
| event environment, raw curves | 0.584 / 0.609 | 0.489 / 0.595 |
| event environment, clamped | **0.642 / 0.741** | **0.542 / 0.730** |
| production score now (0.26 × spread × raw + ARM_RATING_FIX) | 0.598 | 0.540 |
| production score with clamp and slope 0.58–0.61 | 0.640 | **0.566** |

**Other cards past the curve windows:**
- 7.3% of arm lines have a split rating below a curve's window, and 2.9% have one above it. The Stuff curve peaks near 203 and then turns down.
- Without 87329, clamping is still worth +0.014 RA r and +0.011 FIP r.
- On the 383 lines (63 cards) where the clamp moves the score by more than 1 run, RA r goes from 0.23 to 0.52.

## 1. Reliability ceiling

**Method:**
- **Sampling noise per BF/PA** comes from splitting each card's team-stints at random inside a single export: same event, same environment, different teams. That is 42 exports and about 3,000 card pairs, repeated 10 times.
- **FIP check:** the measured noise (0.0785 per BF) is close to the multinomial value (0.070). The gap is team-to-team variation, such as catcher framing.
- **Ceiling:** the most a perfect model could reach on the archive lines is √(1 − mean noise variance ÷ observed variance), using the line sizes the model is actually scored on.

| Noise, sd per 700 | Formula | At 1,000 BF/PA |
|---|---|---|
| Arms RA | 297/√BF | 9.4 |
| Arms FIP | 196/√BF | 6.2 |
| Bats wOBA runs | 380/√PA | 12.0 |

| Lines with ≥ | Arms RA ceiling | RA r (raw / production / clamped) | Arms FIP ceiling | FIP r (raw / clamped) | Bats ceiling | Bats r (production) |
|---|---|---|---|---|---|---|
| 300 | **0.72** | 0.49 / 0.54 / 0.54 | 0.85 | 0.58 / 0.64 | **0.73** | **0.70** |
| 1,000 | 0.80 | 0.59 / 0.61 / 0.60 | 0.90 | 0.64 / 0.66 | 0.83 | 0.74 |
| 3,000 | 0.87 | 0.65 / 0.67 / 0.66 | 0.94 | 0.66 / 0.67 | 0.90 | 0.77 |

**How much of the arms' gap is noise:**
- On RA at 300+ BF, the raw model's gap (1 − 0.49 = 0.51) splits into **0.28 noise and 0.23 model error**.
- At the production score (0.54), model error is 0.18. With clamp, slope and hand blend fixed (about 0.57), it is about 0.15.
- In variance terms, production arms explain 56% of what is explainable. Bats explain about 93% (0.70 of 0.73).
- So bats are near the ceiling and arms are not.
- **Caveat:** the ceiling counts the context a card persistently plays in as signal: the defence behind it, how it is used, and inherited runners. Not all of that is reachable from ratings.

**Other splits:**
- **Within one event**, arm RA is almost all noise: split-half r is 0.10 at about 690 BF per half (Spearman-Brown 0.19); FIP 0.48 → 0.64; bats 0.26 → 0.41 at about 560 PA per half. Single events are tier-restricted, so the real spread inside one is small.
- **Splitting a card's series into halves** (what was asked) gives *lower* ceilings than the model already reaches: FIP about 0.56, RA about 0.46, bats about 0.59. A card's runs above the field change from series to series because the field changes (an Iron arm is above average in an Iron event and below it in Open), and the model follows that. So this split is not a valid ceiling.

## 2. Arm attributes the model ignores

**Method:**
- **Target:** RA (and FIP) per 700 BF.
- **Base:** the clamped model plus the three terms production already carries in some form: RP/CL role, stamina, and ARM_RATING_FIX. With these the base reaches held-out RA r 0.600.
- **Features:** centred within series.
- **Splits:** card-clustered 50/50, ×20 random splits.
- **Gain:** change in held-out r. "Better" counts the splits (out of 20) where the feature improved held-out r.
- **Velocity:** read from the exports; covers 96% of BF.
- **Card table codes:** card `GB` 0–4 = EX GB…EX FB; `Arm Slot` 1–4 = SUB/SIDE/3-4/OTT. Both were checked against the exports and match 1:1. `pt_card_list.csv` has its pitcher columns shifted by one, so it was not used.

| Feature | RA gain (better /20) | RA effect, runs/700 BF saved | FIP gain (better /20) | Verdict |
|---|---|---|---|---|
| Hand-specific vL/vR blend (split gap × LHP) | +0.0017 (20) | LHP want LHB weight 0.35, RHP 0.50 (model 0.45 for all) | +0.0025 (16) | **Small, real** |
| Throws L | +0.0008 (18) | +0.78 ± 0.19 | −0.0008 (13) | Mostly the blend above |
| Hold | +0.0006 (16) | +0.20 per +10 | −0.0005 (9) | Too small |
| G/F tendency (per step toward FB) | +0.0002 (16) | +0.15 | −0.0002 (11) | Null |
| G/F categories | −0.0007 (9) | — | −0.0023 (9) | Null |
| Velocity | +0.0001 (12) | −0.09 per mph | −0.0011 (5) | Null (Stuff carries it) |
| Arm slot | −0.0002 (10) | side/sub −0.4, OTT +0.6 | −0.0031 (2) | Null |
| Pitch count | −0.0002 (8) | −0.17 per pitch | −0.0016 (3) | Null. Alone it reads −0.83 (20/20); that is a role/stamina proxy |
| Pitch grades (best three) | −0.0006 (6) | — | −0.0007 (11) | Null. Alone +0.014 (20/20); also a proxy |
| Pitcher type (GB'er / Finesse) | −0.0006 (3) | — | −0.0021 (7) | Null |
| pBABIP, overall or split | −0.0005 (4) | 0.00 per +10 | **+0.11 (20)** | Null on RA. On FIP it reads −1.2 per +10, see note |
| Movement | −0.0004 (3) | +0.05 per +10 | +0.023 (20) | Null on RA |
| Height | −0.0005 (8) | — | −0.0005 (12) | Null |
| Refit of the 4 rating curves (linear) | −0.0006 (9) | — | — | Null |
| …with curvature (squares) | +0.0047 (19) | pHR: low pHR worse than even the clamped curve | — | **Small, real** (extrapolation shape) |
| …by era band | −0.0001 (12) | — | — | Null |
| All new attributes together | −0.0007 (9) | — | +0.113 (20) | Null on RA |

**The known terms, added one at a time to the clamped model (RA):**

| Term | Gain (better /20) | Fitted size |
|---|---|---|
| Role RP/CL | +0.044 (20) | +5.3 beyond the trusted 0.25 |
| Stamina | +0.040 (20) | −0.81 per +10 |
| ARM_RATING_FIX | +0.029 (20) | coefficient 0.95 |

Role and stamina are bookkeeping on RA: inherited runners, and the per-batter stamina effect that is offset on purpose. ARM_RATING_FIX is real and right-sized.

**pBABIP note:**
- High-pBABIP arms strike out fewer and walk more than their Stuff and Control say: −1.4 and −0.9 runs per +10 pBABIP.
- They give that back on balls in play: +1.15.
- Net RA is about 0, which the near-flat pBABIP curve already prices.
- FIP-based tests (model:calibrate's target, and the observed blend) therefore misprice pBABIP.

## 3. Bugs and miscalibrations

1. **Calibration slope 0.26 is live** (§0).
   - **Fix:** clamp, or use a tangent extension, at each curve's `rating_range` in `card-value.ts mult`.
   - **Also:** make `model-calibrate.ts` robust, for example by dropping lines with |x| > 50.
   - **Then** re-run `model:calibrate`.
2. **vL/vR blend:**
   - Every arm uses `pitchLhbShare` 0.45. Play says about **0.35 for LHP and 0.50 for RHP**, which fits lineups stacking right-handed bats against lefties.
   - Bootstrap 90% intervals: RA 0.29–0.40 and 0.46–0.53; FIP 0.25–0.39 and 0.45–0.57.
   - `model-calibrate.ts` scores arms as 0.7·runsR + 0.3·runsL. That is a bat-board blend, and it gives every arm an effective LHB weight of about 0.56.
3. **Role effect:**
   - Implied roleTrust is 0.24 on FIP and 1.1–1.6 on RA (inherited runners).
   - **0.25 holds.** No change.
4. **ARM_RATING_FIX is not scaled by the slope.** On RA its weight relative to the raw curve fits at 1.8. That is 1.72 at slope 0.58, but 3.8 at today's 0.26. Fixing item 1 fixes this too.
5. **The calibration target is FIP in the PT-default frame.** It is blind to the pBABIP trade-off (§2 note). The two frames give the same r once clamped (0.65 vs 0.64), so the frame is fine; the target is what's wrong.
   - Consider RA with the role term at full booked strength for the arm slope.

## Ranked recommendations

| # | Build | Expected gain | Confidence |
|---|---|---|---|
| 1 | Clamp (or tangent-extend) arm ratings at the curve windows, make calibrate robust, re-fit: slope back to about 0.6 | RA r 0.54 → 0.57 for the production score (0.49 → 0.54 raw); FIP 0.60 → 0.64. Most important: arms get back their value against bats (currently ×0.45) | High; urgent, since every roster since 10-30 is affected |
| 2 | Hand-specific LHB share in the arm vL/vR blend (LHP 0.35, RHP 0.50), and the same in calibrate | +0.002 r | 20/20 RA, 16/20 FIP |
| 3 | Re-fit curve shape at the low end (pHR first) instead of a hard clamp | +0.005 r | 19/20 RA |
| — | G/F, velocity, slot, pitch count and grades, pitcher type, Movement, height, Hold, extra pBABIP | about 0 | Null held out |

**What remains:** after 1–3, arms sit at about 0.57 against a 0.72 ceiling on RA. No card attribute in the data closes that gap. What is left is mostly team context (defence behind the arm, usage, inherited-runner booking) and era-specific effects.
