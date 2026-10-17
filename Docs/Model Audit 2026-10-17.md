# Model audit on the 10-17 archive (2026-10-17)

L.J. 10-17: re-run the model audit on the new data (the archive took 61 import batches on 10-17; newest games 10-16; the Mac's recalibration reads hit slope 0.506, pit 0.557). Report only: nothing under `web/src` was changed.

## Method

1. **Card-level residual scan, two ways.**
   - *The 10-14 method, unchanged* (`web/scripts/model-v2/audit-panel.ts` → `audit-scan.py`, `audit-checks.py`): 9,806 bat lines and 6,316 arm lines in 59 series (10-14: 8,991 / 5,801 in 57).
   - *Extended panel* (`web/scripts/.scratch/a17-panel.mts`). It uses the production environment: `eraFor` (2010-listed events run in the PT default), `parkFor(stadium)`, and the 11 "default RE" series at 2010, as Card Fit does. The six PTCS 7 Championship brackets are kept out of every fit and used as a held-out test. Arms are read off `runsR`, which is what `roster-objective` uses; the 10-14 scan used 0.5 R + 0.5 L boards, which gives vs-LHB about 63% of the weight. Size: 11,674 bat lines and 7,513 arm lines in 70 series, 19.3M PA and 19.6M BF. The team terms (Speed, staff Stamina) are off, as on 10-14.
   - Arms are scored on two targets: runs allowed (as on 10-14) and FIP runs.
   - **Rule for a finding:** the residual (actual − slope × model, within series) is regressed on the feature. A finding counts when |t| > 3 with **series-clustered** SEs (stricter than 10-14's per-line robust SEs) and the two halves agree in sign in **all 5** random series splits.
2. **Corrections check.** Each correction applied 10-11…10-14 was re-measured on the extended panel. Framing used the exports on disk.
3. **Observed-play blend.** Three tests:
   - (a) Card level, leave-one-series-out, through the production code path (`a17-blend.mts`): `observedRunsFrom` on the archive minus the target series and its `-pre` partitions, field floor on, deviation form.
   - (b) The same in residual form (`a17-blend2.py`). This allows a runs-allowed track record for arms.
   - (c) Team level (`a17-teams.mts`, the `teams.mts` harness, tournaments only): 3,580 team-events in the 42 exports on disk, with the current archive as the track record (own series excluded).
4. **Team-level checks of candidate changes** on the same 3,580 team-events (`a17-teamtest.py`).
5. **Fielding components vs the composite Pos Rating** (L.J.'s question, added during the run). Tested twice:
   - On the archive: ZR per 700 PA.
   - On the 42 exports: per 1,000 innings fielded, with each copy's own ratings, ARM runs and double plays turned.
   - Same rule as above, plus a 2-fold-by-export out-of-sample comparison.

**What could not be re-run, plainly:**
- **Held-out time.** `observed_card_stats` holds one line per series × card summed over all the series' files, with no dates. The per-file staged lines are swept after publish, and batch records keep only file names. A "train before 10-09, test after" split is therefore impossible; held-out series is used instead.
- **Framing and the team-level trait regression.** The only exports with FRM on disk are the same 42 as on 10-14 (36 cap + 6 Championship), and the archive still drops FRM. Both reproduce exactly (framing +2.95 runs per +10, r 0.68; team R² 0.099 → 0.120, Stealing +0.93 win% per sd, t 2.9) but are not new evidence.
- **Platoon (#5 on 10-14).** There has been no league upload since 10-11, so this was not re-run.

How much bigger the data is: the 10-17 batches added **62 new tournament files across 38 series**. At line level the 10-14 panel grew 9%, so most of the growth is more PA inside existing lines.

## Model fit

| | 10-14 | 10-17, 10-14 method | 10-17, production read |
|---|---|---|---|
| Bats (wOBA) r / slope within series | 0.657 / 0.92 | 0.661 / 0.90 | **0.675 / 0.92** |
| Arms (runs allowed) r / slope | 0.478 / 0.82 | 0.510 / 0.76 | **0.537 / 0.84** |
| Arms (FIP) r / slope | — | — | 0.624 / 0.77 |
| Championship (never fitted): bats / arms FIP / arms RA | — | — | 0.678 / 0.98 · 0.675 / 0.72 · 0.312 / 0.41 |

By era band (production read, terms off; r / slope):

| Band | Bats | Arms RA | Arms FIP |
|---|---|---|---|
| ≤1920 (6 series) | 0.726 / 0.98 | 0.444 / 1.24 | 0.285 / 0.42 |
| 1921–45 (4) | 0.630 / 0.93 | 0.401 / 1.34 | 0.165 / 0.40 |
| 1946–76 (12) | 0.661 / 0.88 | 0.635 / 0.84 | 0.656 / 0.72 |
| 1977–93 (11) | 0.709 / 0.94 | 0.563 / 0.83 | 0.628 / 0.72 |
| 1994–2009 (11) | 0.603 / 0.88 | 0.546 / 0.86 | 0.676 / 0.85 |
| 2010+ (26) | 0.687 / 0.93 | 0.481 / 0.82 | 0.605 / 0.82 |

- **Bats** are fine in every band.
- **Arms:** across series the median slope is 1.00 on runs allowed and 0.80 on FIP. The pooled 0.84 is pulled down by a few big series.
- **One outlier series:** Diamond & Friends Slots (188 arm lines) has an arm slope of −0.56 on RA and −0.13 on FIP. Its Perfect starters ran 4–16 runs/700 BF under the model and its Diamond starters 12–15 over. This is unexplained and worth a look (see #1 below).
- **Team terms at card level:** with the terms on, card-level arms r falls 0.537 → 0.381 (the Stamina term gives a stamina-30 reliever −4.9 runs/700 BF) and bats 0.675 → 0.650 (the Speed term; wOBA has no baserunning in it). That is expected: these terms price team effects measured at team level on 10-11, and this audit could not re-test them on new team data.

## Findings, ranked by size

| # | What | Size | Evidence | vs 10-14 | In the model? |
|---|---|---|---|---|---|
| 1 | **Variant copies are counted as base cards** | ~25% of all PA+BF in the 42 exports is played by variant copies; Perfect cards only 4–13%. Variants average +4–5 on each bat rating and +3–4 on each arm rating (1,597 cards with both rows). Archive residual per unit of a card's variant share: **+2.9 runs/700 PA (bats), +2.7 RA / +3.5 FIP per 700 BF (arms)** | Card level t 4–5 (clustered), 5/5 splits. **Team level:** scoring variant play at +3.7 (bat) / +2 (arm) lifts win% r **0.390 → 0.402, better in 40/40 half-samples**. A free fit peaks near +10 (r 0.410); part of that may be owner strength. The 09-26 note had a Level 5 variant at +8/+9 runs. | **NEW** | No. `import-observed.ts` keys lines by series + card id, so variant stints merge into the base card. `teams.mts` scores every copy at base ratings. |
| 2 | Relievers beat their ratings on runs allowed | +5.0 runs/700 BF alone, +3.5 jointly; **FIP −0.6 ± 0.4** | t 12.6, 5/5 | Held (+5.3 / +3.3) | roleTrust 0.25; this is inherited-runner accounting (see corrections) |
| 3 | Stamina per batter | −0.77 per +10 (RA), −0.19 (FIP) | t −14 / −4, 5/5 | Held (−0.8) | Staff term, offset on purpose |
| 4 | Lefty / switch bats and big split gaps "beat" the model | Lefty +3.1, switch +1.7 runs/700 PA; \|Power vL−vR\| +1.1 per sd, \|BABIP vL−vR\| +0.75 per sd | 5/5 | Held | Platoon usage, not model error: platoon bats face their good side |
| 5 | **Iron bats under their ratings** against other tiers in the same series | −5.5 ± 1.1 runs/700 PA (−4.5 with a curvature term) | 20 of 23 mixed series negative, 5/5 | **NEW, contradicted at team level** | No. On the 42 exports an Iron offset makes runs-scored r 0.318 → 0.314 and win% worse in 39/40 half-samples. Do not act. |
| 6 | Catcher / middle-infield bats under, 1B / LF over | By primary position: C −1.9 ± 0.45, 2B −1.15 ± 0.47, SS −0.4 ± 0.4, **1B +2.0 ± 0.4**, LF +1.2 ± 0.4 runs/700 PA. Per sd of C rating −0.74 (t −5.2) | 5/5 | Held (−0.8 / −0.5 per sd); 1B and LF new | No. Constant per slot, so it rarely changes a pick. |
| 7 | **Live cards in mixed fields** | Bats −8.0 runs/700 PA (−4 to −11 in each of the 4 mixed series); arms −2.6 RA, −0.6 FIP | **Under-powered:** 4 series, 176 Live bat lines; team level neutral (22/40) | **NEW** | No. The archive scores old play at today's Live ratings, which move with updates; likely the same fix as #1. |
| 8 | Arm rating weights | On RA, Stuff +0.16 and pHR +0.12 per +10 (n.s.). On FIP, pHR +0.36 ± 0.11 (5/5), Stuff +0.18. Control −0.24 ± 0.08 on RA (5/5) but 0.0 on FIP. Card value −1.2 per +10 on RA, −0.2 ± 0.5 on FIP. | — | **Shrank** (Stuff and pHR were +0.3 / +0.4). Control held, still split by target. Value held on RA, gone on FIP. | ARM_RATING_FIX |
| 9 | Relief arms' spread too wide | RP/CL slope 0.70 (RA) / 0.61 (FIP) vs SP 0.83 / 0.81 | Half-sample range 0.58–0.81, below SP in every band from 1946 | **NEW view** | Team level wants *more* pen weight (rp 3 beats 2 in 34/40, +0.002), so do not shrink relievers on their own |
| 10 | Glove ZR per modelled run | 1.22 vs the 1.13 target, about 8% short. C 1.36, SS 1.27, LF 1.30, 3B 1.24, CF 1.22; deadball band 1.54 | Halves | **NEW reading** | Team level: raising the factors is worse in 40/40 (see corrections) |
| 11 | LE bats | +2.35 ± 0.69 runs/700 PA (+3.1 with variant share held: LEs can't be variants); arms 0.0 | 5/5 | Held (+2.6) | No, unexplained |
| 12 | BABIP over-priced | Play pays 2.14 runs per +10, the model 2.50; below the model in every band, both halves (1946–76 2.16 vs 2.62, 1977–93 2.29 vs 2.86, 2010+ 1.82 vs 2.11) | Joint rating-price fit | **NEW** (moderate); not tested at team level | ERA_SLOPES BABIP |
| 13 | Deadball speed | ≤1920 environments: +0.79 ± 0.17 runs/700 PA per +10 Speed in wOBA beyond the model; 5 of 6 series positive | **Under-powered:** 6 series | **NEW** | The Speed term is flat across eras |
| 14 | Stealing | Stolen-base runs +0.08 per +10 Stealing/Speed (+0.26 per sd); team +0.93 win% per sd (t 2.9) | Card level 5/5; team: same 42 exports | Held (no new team data) | Speed term only |
| 15 | Framing by era | Same 42 exports: 0.118 / 0.282 / 0.298 per Frame point per 1,000 inn. The one **PT-default-RE** series (High Iron Floor Gold Ceiling, 6 exports, 575 stints) reads **0.42**; each export 0.40–0.44 | Reproduction; default RE is one event | Held; default RE new | TOURNEY_FRAMING uses 0.297 for default-RE events |
| 16 | Fielding components (range / error / arm / DP) against the composite Pos Rating | On total defensive runs, out of sample the components beat the composite by **≤ +0.006 r** (LF/RF +0.004, CF −0.006, 2B/SS +0.003…+0.006, 3B −0.003, 1B −0.011). Play's weights are close to the game's own composite, except at 3B (arm > error > range) | 42 exports, 9,748 stints, 1.57M innings, 2-fold by export × 5 seeds; see the section below | **NEW** (L.J.'s question) | Composite only; it holds |

**Not problems:**
- Power, Eye, Gap and Avoid K are priced right overall (play vs model per +10: 2.39 / 2.43, 0.71 / 0.74, 0.81 / 0.76, 1.05 / 1.03).
- Card value does not predict bat residuals (−0.3 ± 1.1 per +10).
- The pitch-mix features (pitch count −0.7 per pitch, Curveball, Changeup) are role proxies: with role and stamina held, pitch count is −0.12 ± 0.10.
- Infield Arm, GB, Hold and Pos Rating P read on RA but not on FIP: fielding and balls in play, not pitching skill.

## The 10-11 … 10-14 corrections: do they still hold?

| Correction | In code | What the new data says | Outside noise? | Verdict |
|---|---|---|---|---|
| Framing by era (fielding.ts) | 0.116 / 0.281 / 0.297 per Frame point per 1,000 inn | 0.118 ± 0.004 / 0.282 ± 0.038 / 0.298, export-clustered. Same 42 exports, no new FRM anywhere. The default-RE event reads 0.42. | No; default RE is one series | **Holds.** Cannot be re-tested until FRM is in the archive. |
| ARM_RATING_FIX | pHR +0.68–0.98 (1946+), Stuff +0.3–0.75 (≤2009) per +10 | Remaining miss on RA is +0.1–0.2 per +10 in every band from 1946, each within 1.5 SE. FIP still reads pHR +0.3–0.4 short (1946–2009). In a joint fit, the coefficient on the fix's own runs is 1.26 (RA) / 1.55 (FIP), so the fix is not too big. | No | **Holds** |
| ARM_ERA_SPREAD | ×1.5 (1946–76), ×1.3 (1977–93) | RA band slopes 0.84 / 0.83 against 2010+ 0.82: relative 1.02 / 1.01. FIP 0.72 / 0.72 against 0.82: relative 0.88 (as if ×1.32 / ×1.14). ≤1945: RA 1.24–1.34 (as if a ×1.5 were missing), FIP 0.40 (the opposite). | No for 1946–93 (half-sample ranges overlap). ≤1945: the two targets disagree. RA there carries team defence, and FIP cannot see balls in play. | **Holds.** ≤1945 unresolved; leave at 1. |
| FIELDING_CALIBRATION | C 1.61, 1B 1.0, 2B 1.29, 3B 1.20, SS 1.64, LF 1.24, CF 1.69, RF 1.25 | Implied (ZR, 100+ PA): C 1.94 ± 0.07, 1B 1.02, 2B 1.33, 3B 1.32, SS 1.85 ± 0.10, LF 1.43, CF 1.83, RF 1.33 | At card level, C yes (4.6 SE); SS, LF, 3B ~2 SE; the rest no. At team level, raising to these factors lowers win% r 0.3901 → 0.3896, worse in 40/40. | **Hold the factors.** The team weight def 2 was fitted with them and already prices the gap. |
| SPLIT_TRUST BABIP 0.6 | 0.6 | Archive best fit: righties 0.62 ± 0.27, switch 0.54 ± 0.33. Lefties −1.6: a lefty with a big split is platooned onto the RHP side, so the field-hand blend is wrong for him. Pooled −0.36. | No for R and S; lefties confounded | **Holds.** The league split exports are the clean test (not re-run; no new league data). |
| roleTrust 0.25 | 0.25 | Best trust on FIP 0.34 ± 0.09 (bands 0.18–0.76); on RA 2.2, which is inherited-runner accounting | No (FIP) | **Holds** |

## Defence components: range, error, arm, DP (L.J.: "range is most important, then error")

`fieldingRuns` prices a fielder by the composite `Pos Rating <pos>` only. The question is whether the components (IF Range / Error / Arm / TDP, OF Range / Error / Arm) carry information beyond the composite. Scripts: `a17-defcomp.py` (archive), `a17-defexp.py` and `a17-defdp.py` (exports).

**What each defence counter counts:**
- **Errors are inside ZR.** In the exports, a fielder's errors correlate 0.79 with routine zone balls he did not convert, and ZR is built from zone balls made vs expected. So ZR − errors would double-count.
- **ZR does not count outfield arm runs** (the export's ARM column) or **double plays turned** (DP_1).
- The archive keeps only ZR and E, per PA. A card that DHs piles up PA without fielding, so errors per PA mostly measure time in the field.
- **The clean test is therefore the 42 exports:** each copy's own ratings (variants included), per 1,000 innings fielded (IP_1), on the total target: ZR for 1B and 3B, ZR + ARM for outfielders, ZR + v × DP for 2B/SS.

**Out of sample, the components do not beat the composite on total defensive runs** (2-fold by export × 5 seeds):

| Group | Stints | Composite r | Components − composite, held out | Play's weights (range = 1): range / error / arm / DP | The game's composite (range = 1) |
|---|---|---|---|---|---|
| 1B | 1,174 | 0.295 | −0.011 (better 3/10) | 1 / 0.57 / 0.21 / 0.18 | 1 / 1.00 / 0.45 / 0.48 (R² 0.71: the 1B rating holds more than these four) |
| 2B/SS, ZR + 0.2 × DP | 3,193 | 0.436 | +0.003 (7/10) | 1 / 0.32 / 0.34 / 0.55 | 1 / 0.46 / 0.19 / 0.39 |
| 3B | 1,248 | 0.362 | −0.003 (4/10) | 1 / 1.95 / 2.75 / 0.03 | 1 / 1.10 / 1.58 / 0.30 |
| LF/RF, ZR + ARM | 2,546 | 0.341 | +0.004 (7/10) | 1 / −0.04 / 0.24 / — | 1 / 0.17 / 0.30 |
| CF, ZR + ARM | 1,587 | 0.274 | −0.006 (2/10) | 1 / 0.06 / 0.25 / — | 1 / 0.09 / 0.14 |

- **2B/SS and the DP value:** the 2B/SS row holds for any DP value from 0.1 to 0.4 runs per participation (+0.003 to +0.010). On ZR alone, which ignores DP, the components gain +0.015.
- **Tests that look like gains but are not:** the archive test (ZR per 700 PA, 70 series) shows component gains of +0.03 to +0.06 in the outfield and +0.03 at 2B/SS, with Arm and DP "beyond the composite" at |t| 4–12. Those come from the composite paying for arm and DP, which ZR cannot see. Once ARM runs or DP are added, the gain disappears.
- **Error rating beyond the composite:**
  - It predicts **errors per chance** everywhere (t 3.6–9.9, 5/5).
  - It also predicts **more chances** at 3B: range lowers chances per inning (t −3.8) and error raises them (t +6.2), presumably because the sure-handed corner takes more balls.
  - In the outfield its run value is near zero; on ZR + ARM in LF/RF it even reads −0.19 per +10 (t −3.7, 5/5).
- **L.J.'s ordering holds where it can be measured:**
  - At 2B/SS: range ≫ error ≈ arm.
  - At 1B: range > error.
  - In the outfield: range ≫ arm, error ≈ 0.
  - **Not at 3B**, where play pays arm and error more than range, as the game's own 3B composite already does.
- **Proposed change: none.** The composite is the better or equal predictor held out. What would help is the data: keep IP_1, TC, DP_1 and ARM in the archive (proposal 6).

## The observed-play blend, re-tested

**Card level, leave-one-series-out**, production code path (bats wOBA runs; arms with the production FIP-based book):

| K | 1e6 (now) | 50,000 | 20,000 | 10,000 | 5,000 | 2,000 |
|---|---|---|---|---|---|---|
| Bats r | 0.680 | 0.709 | 0.716 | **0.718** | 0.716 | 0.711 |
| Bats MSE (runs², per line) | 87.0 | 80.1 | 78.3 | **78.0** | 78.4 | 79.9 |
| Arms, FIP book → FIP r | 0.637 | 0.702 | 0.717 | 0.722 | **0.723** | 0.720 |
| Arms, FIP book → runs-allowed r | **0.537** | 0.519 | 0.503 | 0.491 | 0.480 | 0.469 |
| Championship bats r | 0.681 | 0.699 | **0.701** | 0.701 | 0.700 | 0.697 |

**Bats are robust at card level:**
- Residual form: 0.679 → 0.723 at K 5,000 (MSE −12%).
- Better in 20/20 half-samples (+0.033 to +0.062), and +0.035 two-fold by series.
- Cards with under 10% variant play: 0.672 → 0.720. Live and non-Live cards both gain.
- With the field floor off, the gain is smaller (peak 0.706).
- Once the known patterns (hand, split gaps, position, LE, value, Speed) are in the base model, the blend still adds +0.028 (0.691 → 0.722). About 60% of the gain is card-specific; the rest is usage the blend learns.

**Arms do not gain:**
- The FIP book predicts FIP better but runs allowed **worse**. A card's FIP residual is mostly FIP's blindness to pBABIP, which repeats from series to series.
- An RA-based book lifts runs-allowed r 0.541 → 0.576 at K 10,000. For SP cards alone it is flat (0.568 → 0.572): what it learns is the relievers' inherited-runner accounting.

**Team level** (3,580 team-events, 42 exports; off + 2 def + 2 pit; win% within export):

| K | 1e6 | 50,000 | 20,000 | 10,000 | 5,000 | 2,000 |
|---|---|---|---|---|---|---|
| Win%, bats blended | **0.3864** | 0.3861 | 0.3854 | 0.3847 | 0.3840 | 0.3831 |
| Runs scored, bats blended | 0.319 | **0.323** | 0.323 | 0.323 | 0.321 | 0.320 |
| Win%, arms blended | **0.3866** | 0.3852 | 0.3829 | 0.3808 | 0.3790 | 0.3769 |
| Runs allowed, arms blended | **0.347** | 0.344 | 0.340 | 0.336 | 0.332 | 0.327 |

Bats blended at K 10,000 against off, over 40 half-samples of exports: median −0.0014, better in 8/40.

**Verdict: don't turn it back on.**
- **Bats:** −12% card-level error, but no gain in team wins: −0.002 at K 10,000, within noise but leaning negative, and +0.004 on runs scored at K 20,000–50,000.
- **Arms:** worse at both levels with the FIP book.

**Limits of this test:**
- Every test used play in *other* events only. Production would also blend the event's own past series, which is probably the most useful part, and that cannot be tested without dated lines.
- The archive's variant contamination (#1) also leaks into the track record.

## Proposed changes

1. **Keep variant play apart (data pipeline, not model).**
   - **Change:** in `import-observed.ts`, key archive lines by series + card + variant flag, or store the ratings each copy played with (export rows carry them). In `teams.mts` and any team harness, score each copy at its own ratings.
   - **Expected:**
     - About −3 runs/700 on the archive lines of variant-heavy cards.
     - Cleaner calibration, ERA_SLOPES, glove factors and Perfect-vs-Diamond comparisons.
     - On the team harness, win% r 0.390 → **0.402** at the ratings-implied boost; up to 0.410 if real boosts are nearer the Level 5 +8/+9.
     - The same fix stores Live cards' as-played ratings (#7).
   - **Validated:** card level t 4–5, 5/5 splits; team level 40/40 half-samples. It changes no roster pick by itself; it corrects what every calibration is measured against.
2. **After 1: re-run `model:calibrate`, `era:slopes`, the glove check, and TEAM_WEIGHTS (`tourfit.py`), then repeat this audit.**
   - **Expected:** the arm slope and the Perfect/value readings move a little. The variant-share correction alone lifts the arm slope 0.81 → 0.82 and the FIP r 0.644 → 0.652.
   - **Validated:** only partly here; this needs the cleaned archive.
3. **Leave `OBS_K_DEFAULT` at 1e6.**
   - **Expected:** no change.
   - **Validated:** see the blend section above.
   - **If anything:** a bats-only "observed" column in Card Fit at K ≈ 10,000 as information, not in the objective. Re-test at team level after 1 and on the Mac's full export set.
4. **Test the pen weight (TEAM_WEIGHTS rp) at 2.5–3** on the Mac's full exports.
   - **Expected:** win% r +0.002 at rp 3 (34/40 half-samples here); 10-11's held-out fits also chose 2.5–4.
   - **Status:** under-powered on 42 exports. Do not shrink relievers' card spread (#9) on its own.
5. **No change** to ARM_RATING_FIX, ARM_ERA_SPREAD, FIELDING_CALIBRATION, SPLIT_TRUST BABIP 0.6, roleTrust 0.25, the framing bands, or the composite Pos Rating as the glove. Each holds within noise, or the card-level gap is already priced at team level (gloves). Fielding components do not beat the composite held out (#16).
6. **Archive hygiene:**
   - Keep FRM in the importer; proposed 10-14, still not done.
   - Keep the fielding counters IP_1, TC, DP_1 and ARM. Defence can then be measured per inning on the whole archive rather than per PA on 42 exports.
   - Keep per-file, dated card lines, so held-out-time tests and own-series blend tests become possible.

**Watch list (under-powered or contradicted; do not act yet):**
- Live cards in mixed fields (−8, 4 series).
- Iron bats (−5.5 at card level, contradicted at team level).
- Deadball speed (+0.8 per +10, 6 series).
- BABIP priced ~15% high (not team-tested).
- Default-RE framing 0.42 (one event; check the next default-RE export with FRM).
- The ≤1945 arm spread (RA and FIP disagree).
- The Diamond & Friends Slots anomaly.

Scripts: `web/scripts/.scratch/a17-*.mts` / `a17*.py` (gitignored; the Python scripts read the panel from that session's scratchpad: edit `S0` to re-run). Outputs: `web/scripts/.scratch/a17-out/`.

## Refit on the clean archive (2026-10-17, evening)

Done after L.J.'s full re-import (batch 446, variant play split across all 89 series) and the new `model:calibrate` (hit slope 0.5243, pit 0.5775).

- **Team harness (`scripts/model-v2/teams.mts`):**
  - Variant copies are now scored as their own form: id −cid, rated `formRatings(base, the copy's exported ratings)`. League stints read `is_variant` and `ratings` from the database.
  - Before this, every copy was scored at the base card's ratings.
- **Win% correlation, equal weights:** 0.386 → **0.402**.
  - Run diff/G: 0.432 → 0.451. Games played: 0.288 → 0.302.
  - The ceiling from luck is ~0.41 (17% of win% variance is skill), so the model now reads most of what is readable.
  - This is the harness measuring correctly. Rosters already scored L.J.'s variants as their own form, so no pick changes from it.
- **TEAM_WEIGHTS (`tourfit.py`, `penfit.py`, 3,580 team-events in 42 exports):**

  | gloves | SP / RP | win% r (before) | win% r (clean) |
  |---|---|---|---|
  | 2 | 1.5 / 2 (production) | 0.3903 | **0.4061** |
  | 2 | 2 / 2 | 0.3864 | 0.4027 |
  | 2 | 1.5 / 2.5 | 0.3920 | 0.4075 |
  | 1.5 | 1 / 2.5 (grid best) | 0.3942 | 0.4092 |

  - 5-fold held out by event: the chosen weights score 0.4066. Production scores 0.4061 on the full set, so it is already at the held-out optimum.
  - The folds picked starters 1 and pen 2–3, the same as on 10-11.
  - Per-era glove/pitching bests moved by one grid step at most (1946–76 gloves 2 → 3, 2010+ pitching 2 → 1.5) and still don't beat one pooled weight held out.
- **Decision: no change to TEAM_WEIGHTS.**
  - Pen 2.5 is +0.0014, inside noise. Item 4 stands: re-test on the Mac's full export set.
