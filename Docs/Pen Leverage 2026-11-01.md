# Pen leverage and reliever stamina — 2026-11-01

**Why:** Sunday Open Main Event #547 (2026 Truist, 2010 RE, DH, collection 340). The builder's pick ran Hershiser, Saberhagen, Beckett, Stieb, Rile and Sabathia behind CL Willie Hernandez and left off Andrew Miller 103 (#87138), B.J. Ryan (#87218) and Zack Britton (#86426). L.J.: the builder is wrong. He was right, and the main reason was not the one we expected.

**Overlap with fd3f057.** A parallel session found and shipped the stamina half of this fix the same evening: `staminaTerm` / `staffStaminaRuns` in `roster-objective`, and `orderStaff` with a pen value. It then rebuilt 62 events as "…penfix". This branch was rebased onto that work and keeps its implementation. What this branch adds on top:
- the team-level test behind the stamina fix (`penstamina.mts`);
- the leverage weights (`PEN_LEVERAGE`, `leverage.mts`);
- the same pen pricing in Card Fit and the draft engine;
- env-roster's `--no-leverage` / `--pen-stamina` flags, and `--score` ordering the staff;
- tests.

The numbers below were measured on the pre-rebase branch and reproduce exactly on the merged code: 1683 842.6, 1684 862.5, new 547 pick 866.5.

## What was wrong

Three suspects were checked.

1. **Stamina in pen arms' runs. This was the main cause.** env-fit's tournament term `STAMINA_RUNS_PER_POINT × (STM − 71)` (0.12 a point, `calibration.ts`) is added to every arm's runs. Its own note calls it a *staff* effect: "starters who go deep keep the weakest arms out of the game". But it was charged to relievers too. Miller (STM 10) lost 7.3 runs/700 BF and Sabathia (STM 105) gained 4.1. That 11.4-run swing is the whole gap between L.J.'s per-batter numbers (Miller 25.5, Sabathia 16.7) and what the objective saw (19.3 vs 20.5).
   - **Tested** (`web/scripts/model-v2/penstamina.mts`): 3,779 team-events in the 42 tournament exports (36 cap series and 6 PTCS 7 Championship brackets). Runs allowed per 9 were centred per export and regressed on the rotation's and the pen's BF-weighted card value and stamina:

     | per +10 | all | 5 folds by export |
     |---|---|---|
     | rotation stamina | **−0.099 RA9** | −0.086 … −0.130 |
     | pen stamina | **+0.009 RA9** | +0.005 … +0.014 |
     | rotation VAL | −0.253 | −0.196 … −0.293 |
     | pen VAL | −0.056 | −0.029 … −0.071 |

     The staff-stamina effect belongs to the starters. A reliever's stamina does nothing to team runs allowed.
2. **No leverage term. This was real, but smaller.** The pen's tilt (`PEN_SHARE`) gave each slot its share of batters faced, and nothing more. OOTP's exports carry `pLi`, a pitcher's average leverage index (`web/scripts/model-v2/leverage.mts`, 4,032 teams). Starters pitch at 1.005 and relievers at 1.20. Ranked by card value within the team, which is the order of the objective's pen slots:

   | pen | CL | 2 | 3 | 4 | 5 | 6 | 7 |
   |---|---|---|---|---|---|---|---|
   | 5 RP (578 teams) | 1.76 | 1.28 | 1.13 | 1.01 | 0.76 | | |
   | 7 RP (1,441 teams) | 1.62 | 1.33 | 1.16 | 1.11 | 1.01 | 1.00 | 0.99 |

   Ranked by role (pLi) instead, the top slot reads 2.1–2.4, so a strictly best-to-worst pen could do better than this. The table uses what the field actually gets, not that ceiling.
3. **`--role-trust 0.25` was left alone.** The archive audits (10-14, 10-17) show the RA bonus for relievers is inherited-runner accounting: their FIP edge is −0.6 ± 0.4. Neither the stamina fix nor the leverage weights needed role trust to change.

## The change

- `roster-objective.ts` (stamina part as shipped in fd3f057; leverage added here)
  - **`PEN_LEVERAGE`** holds the measured pLi by card-value rank for 3–9 relievers. `penTilt(n)` now multiplies each slot's batters share by its leverage, then puts the row back to **mean 1**. So the pen's total weight is unchanged and only the split moves. A seven-man pen goes from 1.19 → 0.70 to **1.61 → 0.58** (CL → last). A five-man pen goes to 1.89 → 0.45.
  - The total is left alone on purpose. The team weights (pen 2 vs starters 1.5, fitted on win%) already carry the pen's average leverage of 1.2.
  - A slot never weighs more than the slot before it. `penTilt(n, false)` gives the old split.
  - **`staminaTerm`** with `staffStaminaRuns`: when the runs carry env-fit's staff-stamina term, a **pen slot takes it back out**. Rotation slots keep it.
- **`orderStaff`** takes an optional pen value, so CL goes to the best reliever on the pen's own pricing. env-roster and /build pass it.
- The same pen pricing is used by
  - **/build**: Optimise, Search longer and the slot runs.
  - **`roster-search`**
  - **Card Fit**: an RP-role card's runs on /cards and in the one-swap test.
  - **the draft engine**: pen value and replacement level.
- The pen's long men are still a roster rule. `minLongMen` requires 2 pen arms at STM 45+, and that is unchanged.
- **env-roster flags for before/after checks:** `--no-leverage` (batters-only tilt) and `--pen-stamina` (keep the stamina term on pen arms). `--score` now orders the staff best-first before scoring. The 851.1 for the hand-fixed 1684 had Miller sitting in the RP6 slot.
- **Tests:** `roster-objective.test.ts` covers leverage (mean 1, monotone, CL above the batters-only share, the pen total unchanged) and the stamina rule (the Miller/Sabathia case). `roster-audit.test.ts` covers ordering the pen on its own value. `pnpm test`: 362 pass.

## Event 547, before and after

Roster 1683 no longer exists in the database (547's only saved roster is 1684). It is rebuilt here as 1684 with Beckett/Stieb/Sabathia back in for Britton/Ryan/Miller.

| roster | old objective | new objective |
|---|---|---|
| 1683 (builder's pen, reconstructed) | **856.9** | 842.6 |
| 1684 (L.J.'s pen fix) | 851.6 | **862.5** |
| builder, old pricing (from scratch, 8 starts) | 855.9 | 841.7 |
| builder, new pricing (from scratch, 8 starts) | 847.6 | **866.5** |

Taking each piece alone: the stamina fix moves 1684 against 1683 by +20.1 (859.5 vs 839.4). Leverage alone still prefers 1683 by 4.4 (858.5 vs 854.1). Both together: +19.9.

**New pick for 547:**
- **Pen:** CL Andrew Miller, Willie Hernandez, Zack Britton, B.J. Ryan, Wade Davis, plus Hershiser and Beckett as the long men (STM 100 / 96). Hernandez (67) also counts toward the 45+ rule.
- **Rotation, unchanged:** Brown, Bumgarner, Mathewson, Cy Young, Plank.
- **Bench:** Pop Lloyd (the utility backup) replaces De Vries. Ed Rile, who was both a bench bat and RP5, is off: in the pen he no longer gets +4.7 of stamina credit. The dual phase tried him in both roles at 865.8, which is under 866.5.
- **Roster check:** all ✓.

## Other current events (seeded from the saved roster, `--optimize --starts 8`)

Each pick is scored under both objectives: old (`--no-leverage --pen-stamina`) and new. Under the old pricing, every old build came back as the saved roster unchanged.

| event | old pick: old / new obj. | new pick: old / new obj. | gain (new obj.) |
|---|---|---|---|
| 547 Sunday Open Main (2010 RE, 2026 Truist), from scratch | 855.9 / 841.7 | 847.6 / 866.5 | **+24.8** (+4.0 over L.J.'s 1684) |
| 533 Daily Wide Open (2010 RE, 2026 Sutter Health), saved 1692 | 790.5 / 779.5 | 784.8 / 799.7 | **+20.2** |
| 564 Daily Diamond (1985 RE, 1982 Kingdome, ≤99), saved 1645 | 527.4 / 531.1 | 511.9 / 555.0 | **+23.9** |
| 550 Wednesday 1950 to Now (2010 RE, 2026 Globe Life), saved 1682 | 498.1 / 511.3 | 491.2 / 524.4 | **+13.1** |
| 563 Daily Gold Cap (1999 RE, 1999 Jacobs, cap 1780), saved 1654 | 298.0 / 310.6 | 296.0 / 321.7 | **+11.1** |
| 551 Living Deadball (1920 RE, 1919 Fenway, 4 SP / 5 RP), saved 1701 | 446.4 / 439.7 | 444.9 / 440.2 | +0.5 |

Pens, new against old (stamina in brackets):

- **533 Wide Open:** the same change as 547. Out: Saberhagen, Stieb, Rile, Sabathia. In: CL Miller (10), Britton (18), Ryan (16), Wade Davis (16). Hernandez, Hershiser and Beckett stay.
- **564 Daily Diamond:**
  - Out of the pen: Weaver, Ruth, Pappas. Catfish Hunter moves to the rotation and Glavine leaves.
  - In: CL Percival (19), Devin Williams (17), Holland (17), McGee (12), Matzek (16).
  - Long men: Beggs (46), Markham (69).
  - The lineup is unchanged.
- **550 1950 to Now:**
  - Miller was already CL (L.J.'s 1682).
  - Out: Leiter, Danny Jackson, Zito, Escobar.
  - In: Nen (19, moved up to RP1), Palencia (14), Matzek (16), McGee (12), Grzenda (62).
  - Pappas (79) and Grzenda are the long men.
- **563 Daily Gold Cap:**
  - Gene Krapp moves to SP5 and James McDonald to the pen.
  - Out: Markham, Pfeffer, Bob Gibson. In: CL Beggs (46), Mike Marshall (74), Todd Jones (17).
  - The cap ledger and checks are clean.
- **551 Living Deadball:** the pool has no short relievers, so little changes. Radbourn and Plank swap rotation and CL, and Marquard replaces Duggleby.

Every new pick passes the roster check, including 2+ pen arms at 45+. Picks are in the session scratchpad only, not saved.

## Not done / next

- Nothing was saved to the database. To put the new picks live: `current-rosters --only 547,… --all --starts 8 --save` (or `--changes`), after L.J. looks.
- The stamina test uses card VAL as the quality control. Next: re-run it in the Mac's archive harness (685 exports, model runs as the control) with `STAMINA` split SP/RP.
- The per-batter stamina effect (−0.8 RA per +10, −0.2 FIP; Model Audit 10-17 #3) is still unpriced for anyone. In the pen it would favour short arms a little more. Not added.
- Short-arm fatigue: a pen of five STM-10–20 arms leans on recovery (`Tourney Data/Reliever Recovery`). The 2-long-men rule is the guard. Watch it in Bo-series events.
