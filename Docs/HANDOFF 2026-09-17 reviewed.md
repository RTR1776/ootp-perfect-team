# The 2026-09-17 chat handoff, checked against the code and the database

**Reviewed:** 2026-09-17, in the repo, with read access to Neon project `billowing-glitter-35624732` and the Vercel project.
**Source:** `OOTP-handoff-2026-09-17.md`, written by a chat session that had the Neon connector but not the code.

The chat session did not know what the app already does. About half of its recommendations were already built (some of them a week earlier), one of its "findings" is the same artifact it retracts elsewhere in the same document, and the projection model it wanted "put in the app" already was — in a stronger form than the one it proposed. What was genuinely missing is now built; each item below says which.

Legend: **VERIFIED** the claim holds · **WRONG** the claim does not hold · **ALREADY BUILT** the app did this before the handoff · **BUILT NOW** done in this session.

---

## 1. The three "things to fix"

### 1.1 "The upload route is silently failing" — partly VERIFIED, cause not what was implied; hardened NOW

What the database says: the newest `uploads` rows are #117 (shop list) and #118 (collection), both stamped 2026-09-15, both written by the CLI importer (`pnpm import:cards`; they carry the CLI's sha256). Nothing of any kind landed on 9/17. Vercel recorded **no runtime errors in the last 7 days** on the project, so the route did not throw.

Will Clark (100) and Mark Langston (91) are not "missing from the app's copy of the collection" — they are **not in the card table at all**, because they were released after the 9/15 shop list. No collection upload could have matched them without a newer shop list; the fix is a fresh pair of exports, not a route repair.

Why a 9/17 upload could vanish without a trace: the page runs a dry run, then needs a second click to commit; a 401 after a session expiry, a 422 on a shifted shop file, or a Neon HTTP payload rejection mid-write all left no record. Built now:

- every real write through `/api/upload` is recorded in `import_batches` (`upload:<kind>`, sha256, rows, published or failed with the error), and a mid-write failure comes back as a JSON 500 the page displays;
- a file already on record (same sha256, same kind) is recognised and not written twice, the same rule the CLI applies, so the two paths cannot double-load;
- the capture date defaults to the date in the filename (`collection 2026-09-15.csv`), not the upload day;
- insert chunks shrunk to what the Neon HTTP driver reliably takes (100 rows with a ratings blob);
- a per-tournament stats export dropped on the page gets told where it goes (the Mac filer) instead of "could not tell which league";
- `/upload` now leads with a freshness table — shop, collection, tournament play, dump, league, catalogue, calibration — each with its age and the exact refresh step, plus the last six web upload attempts and their outcome; `/build` turns amber when the collection is three or more days old.

The handoff's "interim workaround" (loading a collection straight into `uploads` + `collection_cards` through the connector) was not needed and was not done.

### 1.2 "/build has no defensive floors" — WRONG for the app; the search it implied is BUILT NOW

The Dietz-at-catcher roster came from the chat's own model, not from the app. The app has had a hard position floor since 2026-09-15 (`pos-floor.ts`: 70 everywhere, 50 in LF, none at 1B/DH — L.J.'s own rule of 9/16) and defence priced in runs since 9/16 (`fielding.ts`: ZR per rating point measured on the archive × 0.887 runs per ZR). `/build`'s scorer applies the floor; `env-roster` also prices gloves in runs and hill-climbs.

The handoff's proposed component floors (C ABI ≥ 55, IF RNG ≥ 90 at SS/2B…) are worse than what exists: the game's own `Pos Rating C` is −30 + 0.50·CatcherAbil + 0.50·CatcherFrame + 0.42·Catcher Arm (R² .981 over 380 catchers), so the position rating already is the composite the handoff wanted to rebuild by hand.

What was true: `/build`'s auto-fill stopped at the greedy fill and did not run env-roster's run-priced search. Built now: a shared objective (`roster-objective.ts` — runs per board with the glove in runs at the slot, boards weighted by the field's pitcher handedness, rotation in full, pen at 0.31, bench at 0.1) used by both `env-roster` and the page, and an **Optimise** button on `/build` that hill-climbs the board under every rule and the glove floor. The full search over a 3,300-card collection takes 4½ minutes in node (12 λ starts); the page prunes each slot to its best candidates by runs and runs from the greedy fill. Measured on Gold Rush: greedy 150.7 runs → pruned page search 175.1 in 17 s (top 120 per slot; 170.1 at 30, 173.8 at 60) → full CLI search 179.4. The page gets most of the gain in seconds; the CLI with `--starts 12` is still the reference build for a weekly event.

### 1.3 "The projection model gets rebuilt from a CSV every session — put it in the app" — the diagnosis is VERIFIED, the prescription was ALREADY BUILT, the missing piece is BUILT NOW

The chat sessions were refitting a 12-parameter regression on ~138 cards from whatever export was at hand, and that is exactly why cards reshuffled every time L.J. pushed back. But the app has not used a joint regression for scoring since 2026-09-13. Its model is the component model the handoff's §2.1 proposes: one curve per rating (K% ← Avoid K's, BB% ← Eye, HR ← Power, XBH ← Gap, BABIP ← BABIP; K/BB/HR for arms), each fitted on observed tournament play across 51 series normalised to their own field (`curves.json`, R² .72–.90 per component, the same order the handoff reports), combined through the environment's linear weights (`card-value.ts`, `run-env.ts`), read per board with the batter's side of the park, and blended with the card's own tournament play by precision (`observed-blend.ts`). `pnpm model:validate` ranks it at Spearman .54 bats / .40 arms against 12M PA — reproduced today.

What the app did still carry was "model v0": a linear regression of career wOBA on seven ratings (r² .28) that `/build` displayed as pWOBA/pFIP and used to rank the upgrade tab in SQL. That is the handoff's "12-parameter regression", still on screen. **Retired now**: `projection.ts`, `projection-coeffs.json` and `fit-projection.ts` are deleted; `projections.ts` reads the curve model back as a wOBA / AVG / OBP / SLG / K% / BB% / HR line (bats) or FIP / K9 / BB9 / HR9 (arms) in the event's own era and park, on the same wOBA weights and FIP constant the observed columns use, so projected and observed sit on one scale. The upgrade tab ranks by the scorer's runs. The Mac filer's quit step now recalibrates instead of refitting v0.

## 2. The methodology the chat "wants ported"

### 2.1 Component model — ALREADY BUILT (see 1.3). The one real difference: the handoff's BABIP fit (R .42) was per-card-season; pooled to ~8M balls in play the same curve fits at R² .77 (`curves.json`, refit note of 9/13). "You can buy batting average, just less of it than power" stands.

### 2.2 Calibration — VERIFIED in principle, wrong number, BUILT NOW on the app's model

The handoff's shrink of 0.32–0.38 is for the rating scale under its own linear model, which the curves already absorb. The question that matters for the app is whether a *modelled run* is a *real run*, and it was unmeasured. `pnpm model:calibrate` now answers it within a field (so the field level, which observed-blend builds from the model, cancels out):

| side | card-series lines | PA / BF | slope | r | rmse |
|---|---|---|---|---|---|
| bats | 5,046 | 10.9M | **0.511** | .58 | 9.3 runs/700 |
| arms | 4,342 | 11.5M | **0.483** | .54 | 5.8 runs/700 |

A card the curves put +10 runs above its field produced +5. Deciles climb monotonically on both sides. The scorer now applies the slope before observed play is blended and before gloves (measured in runs directly) are added — rankings on one scale do not move, the exchange rate between a bat, a glove and an arm does. Checked out of sample: the split-half blend (`pnpm observed:validate`) improves at every K above 2,000, and its peak moves from K = 2,500 (0.628 / 0.592) to K = 5,000 (**0.641 / 0.613**); K is now 5,000 everywhere. Calibration is stored in `web/src/data/model-calibration.json` and refreshed by the filer on quit.

The handoff's out-of-sample R of 0.47 / 0.29 (bats) and 0.21–0.28 (arms) describes its own model. The app's, on the same kind of test, is 0.64 / 0.61 blended.

### 2.3 Park-neutral pooling across series — ALREADY BUILT. `observed-blend.ts` centres each card on its series and pools by PA (FIP and BF for arms); the SQL in the handoff is a restatement of it, minus the field-level term the app adds so a Gold field and a Perfect field can share a scale.

### 2.4 Preserve platoon shape when blending — ALREADY BUILT, verbatim. `env-fit.ts`: "Blend on the both-hands read, then move both boards by the same amount." The Torres bug the handoff describes cannot happen in the app.

### 2.5 Dual-lineup objective with weights from the field's handedness — half ALREADY BUILT, half BUILT NOW

`env-roster` already optimised `w_R × (best nine vs RHP) + w_L × (best nine vs LHP)` with independent assignment per board. The weight was a flag defaulting to 0.30. Measured now off every export, per series (`series_meta.lhp_bf_share`, `lhb_pa_share`, computed at import and backfilled): 0.10 at the deadball events, 0.26 at Late Silver, 0.37 at Gold Rush, 0.44 at the Diamond weeklies, 0.58 at Sporer's Sandlot. `/build` and `env-roster --series` read it; the arm's park blend uses the field's left-handed-bat share the same way. (The handoff's Gold figure, 61.6% right-handed by innings, matches: 0.37 left.)

## 3. Corrections to existing notes

### 3.1 Retract "value spent predicts depth" — VERIFIED, and it also retires a RUNBOOK line

The mechanism is right: the export lists only cards that appeared, so deeper runs show more rows. The RUNBOOK's "roster size is the strongest single predictor of a deep run (26 cards reach round 3 in 42%…)" is the **same artifact** — rows in the export, not roster size — and is corrected there. Nothing in the scorer used either figure.

### 3.2 Zero-appearance cards dropped — VERIFIED (`jim.ts` notes 712,205 rows without one missing card id; the export is what played). Nothing infers roster size from it any more.

### 3.3 Variants — ALREADY BUILT. The app scores a variant on the ratings the collection export recorded for that copy (`card-forms.ts`, verified exact on 1,937 base copies), never a constant boost, and prices its separate market. The "10.4 runs against variants in one week" is noise on 16 pairs, as the handoff itself concludes.

### 3.4 Card creep / filter by release date — WRONG as a rule; the model already carries it

Tested in `model:calibrate`: residual (observed − calibrated model) by release month is flat — March −2.1, April +1.0, May +0.6, June +1.8, July +1.6, August −0.5, September +1.7 runs/700 for bats; arms 0.0 / +1.1 / −0.1 / −1.3 / +0.3 / −0.9 / −4.2 (13 cards). A launch-window base card underperforms because its ratings are lower, and the ratings are what the model reads; a date rule would double-count. What does show up by tier: Perfects run −1.3 (bats) / −1.9 (arms) after calibration, the curves extrapolating past their fitted range at the top — the `!! past the fitted range` warning already flags those cards.

## 4. Database notes — VERIFIED, with two corrections

Totals match exactly: 36,189 rows, 54 series, 3,860 cards, 12,370,433 PA, 2,886,690 IP. `observed_card_stats.war` is a sum (the importer adds it) — do not rate it. Column names as stated.

- **Tournament 540 field size**: the catalogue said 128; `my_results` shows 256 since 2026-08-20. **Fixed** to 256, and `pnpm catalogue:sync` now overwrites `entrants` with the newest run's scheduled size instead of only filling nulls.
- **The shop CSV "column-offset bug"**: it is real and the parser has handled it since the start — `extraFields: "drop"` with a tier-band tripwire that refuses a shifted file. Upload #117 parsed 4,198 cards cleanly. "Parse by rating fingerprint" is the collection matcher's job (no Card ID in that export), not the shop list's.
- The Neon 401s were the chat connector, not the app.

## 5. State of play

PTCS 7, day 11 of 28 (2026-09-17), points on the board against cwhit's projected cutoffs, events counted on their start night:

| category | banked | line | gap | days to close at pace |
|---|---|---|---|---|
| Diamond | 83 | 77 | clear | — |
| PD Weekly | 56 | 73 | 17 short | 4 |
| Cap | 99 | 129 | 30 short | 4 |
| Gold | 63 | 91 | 28 short | 5 |
| PD Daily | 128 | 269 | 141 short | 13 |
| Silver | 44 | 94 | 50 short | 13 |
| Open | 16 | 95 | 79 short | 55 (17 left) |
| Bronze | 9 | 107 | 98 short | 120 (17 left) |
| Iron, Live | 0 | 102, 136 | — | not entered |

Only Diamond is banked. Cap, Gold and PD Weekly are a good week away; Silver and PD Daily need the volume to continue to the end; Open and Bronze do not close at the current pace. An earlier version of this table (and of `pnpm ptcs:standing`) showed six categories "CLEAR": that was the projection, and it also carried last week's weeklies into this period (see §7).

## 6. What was done, in order (this session)

1. Verified every claim above against the database and code; no production table was modified except two additive columns on `series_meta` (backfilled), one `tournaments.entrants` value, and rows the app writes itself.
2. `pnpm model:calibrate` + `model-calibration.json`; calibration applied in the scorer and the projected lines; K → 5,000, re-validated out of sample.
3. `projections.ts` replaces model v0 on `/build` (pool table, upgrade tab, card faces, saved-roster summary); v0 files deleted; filer recalibrates instead of refitting.
4. Field handedness per series at import; used by `/build`, `env-roster --series`.
5. Shared `roster-objective.ts`; **Optimise** on `/build`; `candidateLimit` on the optimiser.
6. Upload route lineage, sha dedupe, filename dates, guidance; `/upload` freshness panel; `/build` stale warning.
7. Catalogue field sizes; RUNBOOK and README brought current; 46 tests.

8. Later the same night: Nightmare Cap rules and park logged, capped no-variant build, cwhit board comparison (`pnpm cwhit:compare`); window rule fixed and the category map fitted to the game's actual cutoffs; `pnpm import:collection` (collection of 2026-09-17 imported: 3,710 cards, 19 not yet in the shop list); **/cards**, a card explorer in the style of cwhit's card page — projection in a chosen event's environment, the blend, and every series' actual line against its field.

## 7. What is still open

- **Friday Nightmare Cap (569)** — rules now on file (catalogue row 569: cap 1,559, 50–74, no variants, no DH, 1955, 1936 Hinchliffe Stadium AVG 1.14 / HR .88 L .81 R, 128 teams, Bo7, STANDINGS Silver + Cap); park factors in `park-factors.json` and `reference/ballparks.csv`. `pnpm parse:restrictions` did not read the cap out of this blurb ("may not exceed 1559" and "No variants allowed" are not patterns it knows) — the row was filled by hand; teach the parser those two phrasings before the next new event. The capped build is in §8.
- **The period window rule was wrong, and the category map has now been fitted.** cwhit's Cycle 7 board (2026-09-17, built on the 9/14 dump; `reference/cwhit/2026-09-17 cycle7 targets.csv`) gave two checks the PTCS 6 berths never did. (1) Window: the old rule (a weekly counts seven days after its start) missed his current-QP column by 88 points over ten categories; counting every event on its start night matches him on nine of ten, the tenth being one event whose STANDINGS column reads Gold + Cap on the screen and Gold in his map. Fixed in `computeStandings` and `ptcs-standing`; `pnpm dumps:restandings` rewrote the stored standings. (2) Map: his last-cutoff column is the game's actual PTCS 6 line, and ours from the dump sat 10–15% under it in every tier and at half in Open and Live. The ledger's own STANDINGS tags (`pnpm standings:map`, 55 names) fixed nothing there — L.J.'s events were already mapped — so the rules for names he has never played were fitted against the actual cutoffs and cwhit's current 128th-place totals: a Live event scores in its tier AND Live, a cap or slots event with no tier word is Open + Cap, Negro Leagues is Open, a Live-named draft is PD + Live. With those the 9/14 dump reproduces PTCS 6 to the point in Gold (120), Diamond (90), Iron (129), Open (126) and PD Daily (326), within one in Silver and Bronze, and nine of ten of cwhit's PTCS 7 lines exactly; Cap (159 vs 165) and Live (171 vs 179) are the residue. cwhit's projected cutoffs stay the line for this cycle (`periods.targets`, the standing script); ours are now close enough to stand in when he has not posted.
- **Pitchers bat when DH is off.** cwhit's hitter board for 569 lists Luther Farrell and Ray Caldwell — pitcher cards — as hitters, because in a no-DH event the pitcher's own bat is a lineup slot. The app scores an arm on its arm only. Small for one event; worth a term in the objective for the no-DH series.
- **More data, more easily.** OOTP only exports the tournaments you are in, so the archive grows with your entries; the community route is cwhit's DCFC sheet (`cwhit stat requests 2026-09-04.md` lists what you can still supply him). Two things would move the model most: exports from the events you enter every week (the filer makes that one dialog), and any archived exports other DCFC members will share for series you do not play — the filer takes any `<series>_<run>.csv`.
- **Observed rows are per series, not per run.** The table cannot see time inside a series, so a card's observed line mixes April fields with September fields. Storing per-run aggregates would allow recency weighting; it is a schema change (≈700k rows) and was not started.
- Perfects underperform the calibrated model by 1–2 runs; the curves' top range is where the next refit should look (`pnpm curve:refit --min-den 400`).

## 8. The three builds L.J. asked for (calibrated model, 2026-09-17, collection of 9/15)

All three: `pnpm env:roster … --optimize --role-trust 0.25 --starts 12`, glove floor 70 (LF 50, 1B none), gloves in runs, K = 5,000. Runs are per 700 PA on that board after calibration.

### Thursday Night Gold Rush (540) — `--series goldweekly`, 1989 RE, 1979 Candlestick, DH, 40–89, no cap
Field: 37% of innings left-handed, 41% of PA by left-handed bats. Objective 179.4 (greedy 150.7). Value 2,102.

- **vs RHP:** Tait C · Carpenter 1B · Semien 2B · Blalock 3B · Cozart SS · Shoeless Joe Jackson LF · Lee Thomas (VAR) CF · Granderson RF · Scheinblum DH
- **vs LHP:** Zunino C · Frank Howard 1B · Brandon Lowe (VAR) 2B · Culpepper 3B · Cozart SS · Jackson LF · McGee CF · Granderson RF · Carpenter DH
- **SP:** Kaat · Peavy · Ostermueller · Dizzy Dean · Happ · **Pen:** Beggs (CL) · Reynolds · Lucas · Montgomery · Diaz · Bradford · Righetti · **Bench:** Culpepper · Zunino · Howard · Lowe · McGee

Against the handoff's 26: Culpepper plays third only against left-handers (+7 bat, +3 glove) and sits against right-handers; Scheinblum is DH-only; the platoon catcher pair (Tait / Zunino) replaces Mackey; the pen is deeper and the rotation shallower than the handoff had.

### Daily Late Silver (523) — `--series latesilver`, 1992 RE, 1992 Camden Yards, DH, 40–79
Field: only 26% of innings left-handed (lineups weighted 74/26), 51% of PA by left-handed bats. Objective 128.0 (greedy 98.4). Value 1,903. 19 exports and 1.03M PA on record for this series, so most of the roster is observed play as much as model.

- **vs RHP:** Porter C · Carpenter 1B · Blalock 2B · Boggs 3B · Genao SS · McGee LF · Lee Thomas (VAR) CF · Southworth RF · Gus Bell DH
- **vs LHP:** Zunino C · Cecil Fielder 1B · Woodie Held 2B · Arquette 3B · Genao SS · McGee LF · Shane Mack CF · Ruben Sierra RF · Carpenter DH
- **SP:** James McDonald (VAR) · Ostermueller · Jakie May (VAR) · deGrom · Montgomery · **Pen:** Diaz (CL) · Bankhead · Bradford · Morehead · Rudy May · Paige · **Bench:** Arquette · Sierra · Held · Fielder · Mack · Zunino

The field's most-used cards here (series_meta) are McGee 61%, Alfonzo 50%, Jackie Robinson 41%, Kruk 38%, Boggs 37%. McGee and Boggs are on this roster; the others are either not owned or not what the model prefers at the price — worth a look on the upgrade tab, which now ranks by the same runs.

### Friday Nightmare Cap (569) — 1955 RE, 1936 Hinchliffe Stadium (AVG 1.14, HR .88/.81), no DH, 50–74, **no variants**, **cap 1,559** (26 cards → 60 a card)
`pnpm env:roster --name "Friday Nightmare Cap" --year 1955 --park "Hinchliffe Stadium" --park-year 1936 --min 50 --max 74 --cap 1559 --variant-cap 0 --size 26 --optimize --role-trust 0.25 --starts 12`. The park lifts the environment to 5.18 R/G, .288 / .358 / .410 — a high-average, low-homer world, 0.10 R/G friendlier to left-handed bats. No exports of this series, so runs are the calibrated model plus each card's play elsewhere at the default 70/30 lineup weights. Objective **33.3** against the greedy fill's −31.6 (the cap makes greedy useless: 29 moves from the λ 2.67 start) and the uncapped ceiling of 84.5. Value 1,559 of 1,559.

- **vs RHP:** Porter C · Carpenter 1B · Blalock 2B · Kyle Seager 3B · Jefferson Rojas SS · Gus Bell LF · Southworth CF · Aaron Hicks RF
- **vs LHP:** Phegley C · Matt Davidson 1B · Rojas 2B · Carpenter 3B · Vern Stephens SS · Dave Harris LF · Jett Williams CF · Hicks RF
- **SP:** Bankhead · Ostermueller · Hershiser (53) · Bruce Hurst · **Pen:** Mike Marshall (CL, 57) · Antone · Strzelecki · Cade Gibson · Ribalta (all 50–51) · **Bench:** Lenny Harris · Jett Williams · Nap Lajoie (50) · Alika Williams · Dave Harris · Davidson · Phegley · Stephens · Lou Brock (51)

Where the cap went: the search spent on the vs-RHP board (seven of eight bats on the friendly side of the park, Carpenter +16.6, Bell +12.5, Blalock +11.5) and the top two starters, and paid for it with a 50–51 bullpen (each about −6 on the board, at 0.31 weight) and a vs-LHP board that is below league at catcher (Phegley −12.5) and short (Stephens −9.7). That is the objective's arithmetic, not a judgement about tonight's opponents: with 30% of plate appearances against left-handers the weak board costs less than a weak everyday lineup would. If the play is uncomfortable, the cheapest fix is a 55–60 right-handed catcher in place of Phegley, funded by dropping Porter (74) to a 65-class left-handed catcher.

**Rebuilt after the collection of 9/17 (pool 2,137; Andy McGaffigan 73 added provisionally from the export's own ratings as card −73001 until the shop list carries him):** objective 33.2, the same money spent the same way — McCarver C, Corkhill RF (145 glove), Plank SP1 in place of Porter, Hicks and Hershiser; McGaffigan reads +0.4 (FIP 4.94) in this park and does not make a capped 26. Friday Danksville (570; 2010 RE, 2026 Progressive Field, DH, 40–49, no cap on file, variants assumed allowed) built for fun at −159.8 vs greedy −181.7: Rosar C, Hack 1B, Baez (VAR) 2B, Brooks Robinson 3B, Elberfeld (VAR) SS, Rice/Sosa LF, Jackson/Hosey CF, Guerrero RF, Lucroy (VAR)/Horner DH; Kincannon, Gibson, Langston, Saunders, Pannone; Todd Jones CL. Both are in `Docs/OOTP roster brief 2026-09-17.docx`.

**Calibration against cwhit's boards (`pnpm cwhit:compare --date 2026-09-17 --year 1955 --park "Hinchliffe Stadium" --park-year 1936 --min 50 --max 74`, transcriptions in `reference/cwhit/`).** Spearman rank agreement, app blend vs cwhit:

| | vs cwhit observed (2 weeks) | vs cwhit projection | cwhit's own observed vs his projection |
|---|---|---|---|
| hitters | 0.61 (n 48) | 0.57 (n 26; ratings-only 0.62) | 0.51 (n 16) |
| pitchers | 0.31 (n 25) | 0.19 (n 26; ratings-only 0.40) | −0.03 (n 9) |

The hitter order agrees about as well as cwhit's own two-week sample agrees with his own projection, which is the ceiling for this kind of check. The pitcher boards barely agree with anything, cwhit's included: 100–300 IP is not a sample (Travis Wood .274 wOBA against over 110 IP is −7.3 on our 2,616 IP; Odorizzi .279 over 203 IP against cwhit's own .317 projection). Individual disagreements worth knowing: Gus Bell's .420 is 418 PA — both projections have him at .346; Jack Cust is cwhit's second-best cap value (.379) and only +4.2 here despite our own .380 over 1,116 PA: 858 of those PA are the Bronze weekly, a .355 field, so he is +.034 above his fields where Bell is +.038 above Silver fields of .308 on three times the sample — the app's read is field-adjusted and cwhit's board is not; Dave McNally (74, not owned) is cwhit's best arm at .296 and only +1.1 here on 1,163 IP of 4.61 FIP. Twelve names on his boards are not in the card table at that value (Bob Walk 73, Leon Durham 68, Mitch Webster 72, Joe Charboneau 72, …) — the shop list is from 9/15 and these look like later releases; refresh the card export.
