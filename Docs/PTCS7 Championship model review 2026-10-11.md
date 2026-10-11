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
