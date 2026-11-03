# OF Range and Arm vs the position rating — 2026-11-03: tested, NOT changed

**Question.** The engine notes L.J.'s friends decoded (`OOTP_Engine_Decision_Reference.pdf`) say that outfield catch range uses OF Range alone. Arm and errors run through separate throwing and error paths.
- Would pricing OF defence from **OF Range + OF Arm** predict tournament wins better than the LF/CF/RF position rating?
- The same question for the infield: **range + arm + error** against the position rating.

**Answer: no.** The position rating is already almost exactly a weighted sum of the sub-ratings, and re-weighting them doesn't win games. No model or app code changed.

## 1. Stint level: the sub-ratings explain fielding a little better

**Data:** every export in `Archive/Completed` with fielding lines (826), stints of 100+ fielding innings, centred within each export.
- Outcome: runs per 1,400 innings = 0.887 × ZR + the export's `ARM` (arm runs).
- Script: `scripts/model-review/subrating-prices.py`.

| Pos | n | Position rating: runs/pt | R² | Range + Arm: runs/pt | R² | All sub-ratings R² |
|---|---|---|---|---|---|---|
| LF | 18,957 | 0.132 | .103 | 0.148 + 0.043 | .107 | .107 |
| CF | 26,418 | 0.125 | .061 | 0.171 + 0.045 | .062 | .063 |
| RF | 19,631 | 0.135 | .111 | 0.157 + 0.042 | .115 | .115 |
| 1B | 19,321 | 0.133 | .085 | | .057 | .072 (+err, TDP) |
| 2B | 22,798 | 0.204 | .164 | | .162 | .182 |
| 3B | 20,303 | 0.191 | .142 | | .107 | .145 |
| SS | 26,650 | 0.252 | .144 | | .117 | .151 |

**Outfield.**
- OF Error adds nothing.
- OF Arm predicts arm runs (the stint R² of `ARM` goes from ≤ .007 to .047–.088) but adds nothing to ZR.
- **The position rating is the sub-ratings:** regressed on range, arm and error it fits at R² .974–.988.
  - LF ≈ 1.07·rng + 0.20·arm + 0.21·err
  - CF ≈ 1.41·rng + 0.19·arm + 0.13·err
  - RF ≈ 1.00·rng + 0.47·arm + 0.17·err
- The only real difference is that the position rating spends a little weight on error. That leaves very little for a re-weighting to find.

**Infield.**
- Range + arm alone is worse than the position rating.
- With error and TDP added, the sub-ratings beat it only slightly (2B .182 vs .164, SS .151 vs .144), and 1B loses.

## 2. Wins: the outfield change loses

**Harness:** `scripts/model-v2/teams.mts` rebuilt with `MV2_TOURDIR=Archive/Completed MV2_NO_LEAGUE=1`.
- `dsub` now carries an `arm` gap beside `err` and `rng`, and each row carries the event's `gs` (glove scale).
- 65,646 team-events.

**Scoring:** `scripts/model-review/subrating-test.py`.
- Production TEAM_WEIGHTS by band.
- Win% r within each export, 40 export half-samples.
- **Both sides use centred gaps:** `dpos.lin` for the position rating, and `dsub` × glove scale for the sub-ratings. That avoids the 10-25 trap.
- Every other position keeps production's glove.

**Which comparisons matter:**
- **V0 against production** is what would ship: sub-rating prices rescaled to production's level at each position.
- **V1 against P1** puts both sides on the same footing, priced straight from the §1 stint fits.
- **Vfit against Pfit** lets each side fit its own free per-position weights on the other half.

Each cell is the change in mean r, with the number of half-samples (out of 40) where the variant was better in brackets.

| Band | n | Production r | V0: range+arm at prod level | R0: range alone | V1 vs P1 (equal footing) | Vfit vs Pfit (free fits) |
|---|---|---|---|---|---|---|
| **All** | 65,646 | .3728 | −.0000 (14) | −.0001 (1) | −.0000 (13) | −.0002 (6) |
| ≤1945 | 6,174 | .3115 | −.0001 (20) | +.0001 (25) | −.0001 (18) | −.0017 (9) |
| 1946–76 | 14,996 | .3642 | −.0002 (2) | −.0004 (1) | −.0003 (2) | −.0012 (1) |
| 1977–93 | 15,144 | .3827 | +.0000 (30) | −.0002 (2) | +.0000 (26) | −.0004 (15) |
| 1994–2009 | 8,266 | .3787 | −.0000 (14) | +.0001 (27) | −.0000 (15) | −.0008 (10) |
| 2010+ | 21,066 | .3890 | +.0001 (25) | −.0002 (5) | +.0001 (26) | −.0004 (10) |

- **No band clears the 37/40 bar.** 1946–76 loses outright.
- **Range alone** (dropping the arm) loses 1/40 overall.
- **Freely fitted sub-rating weights** do worse held out than freely fitted position weights in every band: they over-fit, and the arm and CF terms flip between halves.
- **For scale:** taking the OF glove out entirely costs −.0015 (0/40). The glove matters; how it's split doesn't.

## 3. Wins: the infield is under the bar

Infield variant: range + arm + error at production level (V0).

| Band | V0: subs at prod level | V1 vs P1 (equal footing) | Vfit vs Pfit (free fits) |
|---|---|---|---|
| **All** | +.0001 (35) | +.0001 (35) | −.0003 (5) |
| ≤1945 | +.0008 (34) | +.0009 (34) | −.0074 (0) |
| 1946–76 | +.0001 (25) | +.0001 (23) | −.0015 (8) |
| 1977–93 | +.0002 (28) | +.0002 (28) | −.0015 (5) |
| 1994–2009 | −.0002 (8) | −.0002 (8) | −.0043 (1) |
| 2010+ | +.0002 (32) | +.0001 (31) | −.0010 (4) |

- 35/40 overall is under the 37/40 bar, it loses in 1994–2009, and it collapses when fitted freely. Not wired.
- **Watch item:** before 1946, +.0008 (34/40) is the largest gain in this note. The 10-27 error test found nothing there with free fits (§5 of `Model Review 2026-10-25.md`), and the free fit loses here too. Re-test it if the pre-1946 archive grows.

## 4. Side observation (not acted on)

**P1** prices the OF position rating at its centred stint slope, about 30% above production (LF 0.132 / CF 0.125 / RF 0.135 against 0.098 / 0.096 / 0.108 runs per point).
- It beats production in 39/40 half-samples, but by only +.0001 r.
- The same treatment for the infield loses (0/40).
- That gain is too small to matter. Note it, don't chase it.

## Reading

**The engine notes can be right about the mechanism and still change nothing here.** OOTP's position rating already *is* range-heavy (CF puts 1.4× range on it) with a small arm share. That's close to what the engine uses, so the extra precision is worth about nothing on wins.

**Code:** none in the model or app.
- `teams.mts` gains the `arm` sub-rating gap and `gs` per row, for reproduction only. Nothing reads them in production.
- The two scripts are in `scripts/model-review/`.

**Don't redo this.**
