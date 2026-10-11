# PTCS 7 Championship — where the model missed (2026-10-11)

Six brackets (Bronze, Silver, Gold, Diamond, Open, Cap; PD Daily/Weekly not in), all 1970 RE at 1971 Dodger Stadium, DH. Jim-beater teams dropped. Every card that played scored on the production model (env-fit, each bracket's own field handedness), compared with what it did. Scripts: `web/scripts/ptcs7champ-review/` (cids.py → model.mts → review.py, teams.py).

## Card level (slope of observed on model; 1.0 = calibrated)
- **Bats: calibrated.** r 0.32–0.35, slope 0.99–1.04 (2,653 bats with 50+ PA). Mis-priced ratings (joint fit, runs/700 PA per +10 beyond the model): BABIP −0.95 ± 0.23 (over-credited; the Expansion-band era slope 2.05 looks too strong here), Avoid Ks −0.49 ± 0.15 (over), Gap +0.53 ± 0.21 (under). Power, Eye, Speed fine.
- **Arms: spread too narrow.** FIP-based slope 1.39–1.55 (r 0.29). Stuff is under-priced beyond that (+0.88 ± 0.12 per +10), Control slightly (+0.35 ± 0.12). Same finding as Daily Diamond 1990 Onward on 10-05 (1.47×).
- **Defense: far too narrow.** Observed ZR+ARM+FRM per 700 PA against fielding.json runs: slope 1.84 overall; C 4.4, CF 2.9, SS 2.25, 3B 1.76, RF 1.79, LF 1.89, 2B 1.34, 1B 1.19. Model sd 2.5 runs/700 vs observed 13.9 (much of that is noise, but the slope is not biased by noise in the observed side).

## Team level (run differential per game on the model's three components)
- 670 team-brackets: offence 0.54 ± 0.16, defence 2.44 ± 0.91, pitching 2.90 ± 0.37. Observed ZR/G enters at 1.02 ± 0.18 (a fielding run is a run). Deeper teams face better opponents, which shrinks all three, so read these as relative: per modelled run, pitching and defence bought several times what offence bought.
- **Our six rosters were built offence-first:** model offence percentile 97 Gold, 96 Diamond, 98 Open, 78 Cap, 64 Silver; defence 7–47; pitching 30–56 (78 Bronze). Deep teams (30+ games) are balanced: offence ~55–85, defence ~30–80, pitching ~73–82. **Liam's Mt Etna was 92–96th percentile pitching in every bracket.**

## Fixes, in order (validate on the archive before changing defaults)
1. Arms ×~1.4 in the optimiser (SP and RP weight, or the arm curve's spread) and more Stuff.
2. Gloves ×~1.8 overall, more at C/CF/SS (per-position multipliers on fielding.ts); then the planned refit on total defensive runs (ZR + ARM + FRM).
3. Bats: trim the era BABIP slope for 1961–76 and Avoid Ks; add a little Gap.
4. One event, one environment: check each against `model-validate` / `residual-multi` across all series before it goes in.

## Done 2026-10-11: fixes 1 and 2, checked on the archive
Archive check (`web/scripts/ptcs7champ-review/archive.mts` + `archive.py`, run from `web/`): the production scorer in each series' own environment, 66 archived series (9.5k bat lines, 8.0k arm lines with 50+ PA/BF) plus the six Championship brackets.
- **Before:** bats 0.93 (fine). Arms 1.17 overall, but by era 1946–76 1.60, 1977–93 1.31, 2010/default 0.92 — the pitcher calibration was fitted in the 2010 frame. Gloves (with gloveScale) 1.41 overall, flat by era, by position C 1.81, 1B 1.07, 2B 1.45, 3B 1.35, SS 1.85, LF 1.40, CF 1.91, RF 1.41.
- **Two-fold by series:** the glove factors and the two mid-century arm bands held in both halves; other arm bands flipped, so they stay at 1.
- **Changed:** `calibration.ts` ARM_ERA_SPREAD (×1.5 for 1946–76 environments, ×1.3 for 1977–93) applied in env-fit to pitchers; `fielding.ts` FIELDING_CALIBRATION (C 1.61, 1B 1.0, 2B 1.29, 3B 1.20, SS 1.64, LF 1.24, CF 1.69, RF 1.25 = slope × 0.887 runs/ZR).
- **After:** arms 1.01 archive / 0.94 Championship; gloves 1.05 archive (target 1.13 in ZR units) / 1.20 Championship; every position 1.02–1.18. Tests 276/276.
- **Not done:** catcher framing (FRM is not in the archive's counters); era bands ≤1945 and 1994+ for arms; fix 3 (BABIP/Avoid K/Gap). League tools use the same glove runs: vs RHP the league model now plays Banks 3B, Brett DH, Matsui sits.

## Team level after the fixes (`teamtest.py`, 670 team-brackets)
- Model team total vs run differential per game: corr 0.374 (old) → 0.393 (fixed). Luck ceiling at these game counts ≈ 0.45–0.65.
- Track record (observed blend from other events) does NOT help here: ratings only 0.396, K=5000 0.376, K=500 0.365.
- Fitted weights, held-out across bracket halves (4 splits, all improve +0.004 to +0.021): offence 0.3–0.8, defence 1.5–4.4, pitching 1.5–1.9 (relative to the model's runs).
- Residual traits (what the fixed model still misses): arm pBABIP +0.16, arm Stamina +0.14, team Speed +0.13, arm Control +0.11, starter share of BF +0.10, LHB share −0.08.
- Next (proposed, not done): optimiser weights for 1946–93 environments (pitching ×1.6, gloves ×2 relative to bats), a starter-stamina term, more Control/pBABIP/Speed; validate on the archive at card level and on the Championship at team level before use.
