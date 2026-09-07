# A stronger Perfect Team app for Kansas City Torrent

Prepared September 6, 2026. Based on the current working tree, read-only queries against the configured database, the latest local exports, existing reports and guides, and official PT27 announcements. This is a proposed implementation plan; the application and its database were not modified.

**Recommendation: keep the existing Next.js/Postgres foundation and build a consistent decision engine around it.** The largest improvement is to connect your collection, tournament rules, observed performance, roster choices, and results into one dependable workflow. Better presentation should make those decisions easier to act on.

## What I understand about your game and your work

You are solving several related problems with different objectives:

| Activity | Decision the app should help you make |
|---|---|
| League play | Which owned cards should receive the plate appearances and innings, against each hand? Where is the team losing runs? |
| Constructed tournaments | What is the strongest legal roster for this event's restrictions, era, park, and series format? |
| Perfect Draft | Which offered pick most improves the eventual roster, given remaining rounds and positional supply? |
| Collection and market | What should I keep, buy, or upgrade, and which useful roles would a sale remove? |
| PTCS and championships | Where should I direct limited entries, and how do I prepare for the actual championship formats? |

Your existing research emphasizes production over popularity, meaningful sample sizes, platoons, positional fit, variant ownership, and environment-specific performance. The HD450 post-mortem and championship-comparables report are especially good product briefs: they explain a decision and connect it to evidence. Their individual conclusions still need validation; they should not become unquestioned model rules.

The deck-building aspect matters as much as individual talent. A card's value depends on the alternative it replaces, the scarce tier/variant/cap slot it consumes, and the other jobs the roster must cover. A high card rating is not an adequate optimization target.

PTCS qualification, championship-ladder scoring, and PTWC accumulation must remain distinct. Full points can feed multiple qualifying categories, but the PT27 rules exclude Live/Cap double-counting from the relevant PTWC standings. Scheduled field size determines qualifying points even when an event launches short. [Official PT27 rules](https://forums.ootpdevelopments.com/attachment.php?attachmentid=1106832&d=1773951439).

## What actually exists now

The old July handoff and progress notes describe a different app. The current app has Build, PTCS, League Meta, Market, Environments, and Upload. The home page redirects to Build. There is no current `/draft` or `/lab` route despite their description in earlier plans.

The database connection works. The old missing-league-data blocker is obsolete. The Python engine remains useful research infrastructure, but its model is not the model currently used by the web builder.

| Asset | Verified inventory | Practical value |
|---|---|---|
| Latest shop export, Aug 27 | 4,010 card IDs; 3,436 reported owned IDs; 3,500 copies | Card universe, ownership and market snapshots |
| Latest collection, Aug 27 | 3,500 rows; 75 variants; 26 active rows | Variant and active-roster evidence; current parser matches all rows |
| Completed tournament archive | 338 CSV files, about 443 MB | Rebuildable event-level performance evidence |
| League source folders | 44 CSV files across five dated folders | Repeated league observations and vL/vR splits |
| Loaded league history | 47 snapshots; 41,375 stint rows | Includes snapshots beyond those five source folders |
| Loaded tournament performance | 30,321 card/series aggregates, 48 series, 3,742 card IDs | Broad coverage, with uneven sample sizes |
| Latest community dumps | 8,403 tournament events and 5,838 draft events | Finish-order history; each latest file has unique event IDs |
| Your loaded results | 705 tournament entries and 591 draft entries | Personal event-selection and performance baseline |
| Tournament catalog | 128 entries, 124 not retired | Existing foundation for rules and environment selection |
| Market history | Three shop uploads; 11,691 snapshot rows | Early price history, not yet a rich market time series |
| PTCS history | 350 daily category rows covering Aug 3–Sep 6 | Existing period history worth preserving |

There are currently zero saved rosters, zero event-ledger `results` rows, and zero official `standings` rows in the configured database. Personal dump results are in a separate populated table. This distinction matters when evaluating which workflows are actually in use.

Freshness is mixed: shop/collection stop at Aug 27, community dumps at Aug 31, and some leagues reach Sep 6. HD451's Aug 30 `all` snapshot contains only four pitchers in 473 rows; the existing completeness filter correctly falls back to Aug 16. Keep this protection and make source dates visible wherever recommendations use it.

## The gaps with the highest impact

**1. The automatic builder is a heuristic, with incomplete legality enforcement.** It greedily fills positions using fixed rating weights. The current filters cover card value/year and allowed tiers, but do not enforce the whole roster's value cap, variant cap, exact tier allocation, card-type restrictions, or a canonical roster-size constraint. The catalog contains seven entries with team caps, eight with variant caps, six with slot rules, and four with card-type rules, so this is not a hypothetical edge case. Rules of unknown meaning must produce an explicit incomplete-validation state.

**2. Variant ownership is displayed without a complete variant decision model.** Builder cards are collapsed by Card ID and receive shop ratings plus a variant badge. There is no explicit base-versus-variant choice with its own effective ratings. The save endpoint writes `useVariant: false` for every slot. Fix identity, ratings, selection and persistence together.

**3. The three recommendation surfaces disagree about quality.** Displayed projections use the current linear model; automatic roster selection uses a fixed rating composite; Market uses a league percentile composite divided by price. The builder's fitted projections do not take park or era as inputs. Its right-handed lineup fit also uses a 30/70 split blend rather than pure versus-RHP ratings. These differences prevent a coherent explanation of why a card is recommended.

**4. The current model needs evaluation before stronger claims.** The Sep 6 coefficient file reports hitter R² ≈ .301 on 1,013 cards and pitcher R² ≈ .375 on 847 cards. These are training-fit statistics, not held-out predictive accuracy. Training uses overall observed lines and current card ratings; split predictions substitute split ratings afterward. The minimum fitting samples are 100 PA / 25 IP, different from the 500 PA / 400 IP reliability floors in your working conventions. Small samples can contribute with shrinkage, but should not earn a high-confidence badge.

**5. Tournament history loses important distinctions.** Stored observed aggregates are keyed by series and Card ID, without event date, rules version, split, or variant identity. Current import also sums all numeric stat fields into a counters object, so downstream consumers must distinguish additive counts from rates. New formats can inherit old series labels. The official refresh announcements include changing eras, parks, caps and draft structures; pooling before and after a refresh risks mixing different games. [Official refresh thread](https://forums.ootpdevelopments.com/showthread.php?t=371153).

**6. Tracking and importing still require disconnected manual steps.** The PTCS page reads daily totals and separate dump summaries. It can label an estimated target as “QUALIFIED”; elapsed time is counted from logged dates rather than the calendar. The export helper still hands off to separate import/refit commands. The observed importer deletes existing series rows before inserting replacements, exposing a partial-refresh failure mode.

**7. Some checks offer incomplete assurance.** The existing ingest harness passes 43/43 checks, but skips the collection and official-standings sections because its expected files are absent. I separately verified the actual Aug 27 collection: 100% parser match coverage, including all 75 variants. Coverage is not proof that every identity assignment is correct; ambiguous same-player cards still deserve targeted fixtures. There are also 152 observed aggregate rows referencing 34 card IDs absent from the current catalog; retain them as unresolved evidence until reconciled.

Code references and reproducible measurements are in the accompanying [audit notes](</Users/ljmac/Desktop/OOTP Perfect Team/Docs/audit-2026-09-06/NOTES.md>).

## The experience to build

**Today:** a short prioritized list of decisions: improve a platoon using owned cards, repair an illegal saved roster after a rules change, refresh stale collection data, or prepare for an upcoming championship. Each item explains why it matters and opens the relevant comparison.

**Build:** select league or tournament, choose owned-only or a PP budget, lock your preferred players, and compare the current roster with recommended alternatives. Show the unique roster alongside vL/vR assignments, rotation, bullpen roles, bench coverage and rule budgets. Selecting a player shows the actual replacement and its estimated impact, with uncertainty.

**Cards and Market:** a searchable collection with base/variant choices, position coverage, price history and saved-roster usage. An upgrade is valuable when it improves one of your builds. A card can be a league sell candidate and a tournament staple at the same time; show that before proposing a sale. Treat variant last-ten prices as historical price evidence, not proof of a currently purchasable listing.

**Compete:** PTCS progress, event selection, results and championship preparation in one place. Keep the current Environments explorer as a deeper analysis tool and connect its comparables to actual eligible cards and available samples.

**Draft:** a dedicated pack-entry workspace with fast keyboard input, roster needs, remaining rounds, undo and automatic session recovery. Rank marginal roster improvement and scarcity; support multiple picks per pack. Keep unverified round schedules visibly uncertain.

**Data:** one inbox and a health view. A normal refresh should report what changed, what was rejected, which source is now current, and which recommendations changed. Preserve raw files for replay.

## Delivery plan

The order below assumes stronger rosters and card decisions are the main goal. Effort ranges are planning estimates for focused implementation, not commitments; they overlap and depend on rule verification and model results.

| Stage | Deliverable | Acceptance condition | Rough effort |
|---|---|---|---|
| 1. Trustworthy builds | Canonical card forms, full rule validator, accurate variant save/load, source freshness, honest PTCS status labels | A roster cannot be labeled ready when it violates a known rule; base/variant choices survive reload | 4–7 working days |
| 2. Reliable evidence | Event-level tournament history, rules versions, rating snapshots, atomic imports, explicit source lineage | Replaying a file changes no totals; failed imports retain the previous complete dataset; historical formats remain separable | 5–8 days |
| 3. Better decisions | Shared context-aware scorer and constrained optimizer with explanations | Feasible rosters beat or match the current heuristic under the same objective; predictive improvements survive chronological holdouts | 7–12 days |
| 4. Daily workflow | Today view, marginal-value market, PTCS ledger and championship workspace | Complete import → assess → compare → save → review result without a separate spreadsheet or ad hoc script | 5–8 days |
| 5. Live drafting | Format-aware draft assistant using the shared scorer | Replay supported draft formats with legal final rosters, multi-pick rounds, undo and reload recovery | 5–8 days |

### Stage 1: make roster recommendations safe to act on

Create one rule validator used by pool filtering, automatic selection, manual edits, saved-roster loading, and the server save endpoint. Separate individual-card eligibility from whole-roster constraints. Use tournament-defined roster sizes; do not impose 26 on draft formats that use another size.

Represent selectable card forms explicitly: Card ID, base/variant form, effective ratings, ownership evidence and rating date. Preserve both forms when owned. Do not assume a universal variant boost without verifying its rule or using exported ratings.

Validate tier allocations, total value, allowed card types and years, variant rules, unique roster membership, positions, and handed lineups. Count shared players once across vL/vR lineups. Score defense at the assigned position rather than the player's best position anywhere.

Add focused regression fixtures for capped, slots, variants-off, year-restricted and card-type-restricted events, plus save/load and platoon-roster cases. Separate “draft saved with warnings” from “ready for this event.”

### Stage 2: preserve the evidence needed to learn

Add an immutable import-batch record with file hash, parser version, captured date, ingestion time, completeness status and source file. Publish derived data only after the batch validates; use a supported transaction path or staged batches with an atomic active-version switch.

Store tournament instances and player stints before aggregation, including event identity, rules version, variant when available, opponent hand when available, ratings as observed and counting stats. Attach aliases to event families without rewriting historical rules. Unknown attributes stay unknown; they must not default to base cards or modern environments.

Keep captured time separate from upload time. Store card-rating history, especially for Live cards. Build one canonical ownership view that reconciles shop counts and collection forms, rather than letting each page choose its own definition.

Recompute rates from their correct denominators, preserve innings as outs or exact thirds internally, and aggregate stints before ranking cards. Never add `all`, `vL`, and `vR` observations together. Extend completeness validation beyond pitcher share to required stat blocks, valid IDs, and partition coverage.

### Stage 3: build and prove one decision engine

Evaluate the existing linear model, the Python component-rate model, and a simple empirical shrinkage baseline against identical held-out data. The older “engine decoded” document is a model hypothesis and prior validation claim, not proof of access to OOTP's internal simulator.

Fit split outcomes where split observations exist. Account for era, handed park effects, competition level, role and rating date. Use context-specific observations when sufficient, otherwise cautiously borrow from comparable environments and show the extra uncertainty. Similar run environments do not automatically imply similar card pools or opponent strength.

Hold out whole later events/weeks; do not randomly split rows that share the same tournament. Add new-card holdouts, exposure-weighted error, rank agreement and calibration of uncertainty. Judge low tiers, Perfects, variants and unusual eras separately. Promote a new model only if it improves the relevant held-out decisions.

Initially show batting and pitching gains separately where run conversion is not validated. Add run-differential estimates once calibrated, then use them consistently for Build, Market and Draft. Model defense, catcher contribution, baserunning, stamina and pitching roles in stages; do not attach false precision to weakly estimated effects.

Use constrained optimization for roster membership and lineup assignment, with explicit cap/slot budgets and user locks. Start with assignment plus bounded search or an appropriate integer solver; evaluate deployment constraints before choosing a dependency. Benchmark optimality on small exhaustive examples and compare realistic builds against the old greedy baseline. Return the best feasible roster and disclose a solver timeout or optimality gap when relevant.

### Stage 4: turn analysis into action and measure the result

Create a result ledger keyed by real event ID and reconcile spreadsheet daily totals as aggregate adjustments. Replacing a day's historical aggregate with event-level evidence must not double-count it. Track event date, scheduled field size, actual field size, placement, category tags and rules version separately. Use official scoring rules and tiebreakers; distinguish reconstructed standings from official captures.

Use calendar time in the correct timezone. Show “above estimated line,” “inside current cutoff,” and “qualification confirmed” as different states. Fit event-selection estimates to your results with shrinkage toward format-level priors, accounting for duration, concurrent slots, category gaps and expiring opportunities. Backtest cutoff forecasts by capture date before showing qualification probabilities.

Connect the market to saved rosters: compare owned-only improvements first, then marginal gains per PP for a specific budget. Price the actual form, expose stale prices and missing asks, protect locked/mission-relevant cards when that information is available, and account for transaction costs before estimating sale proceeds.

Save roster versions and associate them with subsequent event results. Automatically generate a post-event review: what changed, which players received the opportunities, where observed performance differed from expectations, and what warrants another look. One lucky or unlucky tournament is not causal evidence that a roster change worked.

### Stage 5: rebuild the draft assistant around current formats

Recover reusable logic from history only after checking it against the present data model. The guides provide useful principles—tiers, scarcity, defensive fit—but fixed supply quotas and round sequences need game-specific evidence.

Create versioned schedules from confirmed formats, with user-editable overrides for unknown rounds. Provide immediate alternatives, role coverage, expected remaining supply, multiple-pick handling, speed-clock support and a no-network session fallback. Log offered cards as well as chosen cards so future evaluation can compare actual alternatives.

## The first milestone I would build

**A trustworthy championship roster comparison for one of your actual target berths.** Use the existing championship-comparables work, current owned cards and an exact ruleset. Deliver legal base/variant selections, both handed lineups, clear source dates, save/reload fidelity, and a short explanation of the top substitutions. Use the same validator across all five target berths before expanding the optimizer.

This is timely: OOTP's Sep 3 announcement schedules PTCS 6 for Sep 12 and specifies distinct environments for Bronze, Silver, Gold, Diamond and Cap. Cap includes a 1610 roster cap, making complete legality immediately relevant. This is a proposed proving ground, not an assertion that every berth is confirmed. [Official PTCS 6 formats](https://forums.ootpdevelopments.com/showthread.php?t=371946).

For a near-term championship deadline, ship this narrow milestone and reliable imports first. The new statistical model should remain in comparison mode until its validation passes.

## How we will know it improved

Track five concrete outcomes: zero known rule violations in ready rosters; zero duplicate or partial-import totals; better held-out predictive/ranking performance than the frozen baseline; fewer manual steps and less time to prepare a roster; and measured changes in personal results over comparable events, with uncertainty.

Keep the current framework, database, ingestion parsers, latest-complete snapshot protection, environment calculations and raw archive. Avoid a wholesale rewrite, a second live application model, automatic buy/sell execution, or a generic chat interface before these workflows work. A later natural-language explanation layer can cite the computed evidence; it should not invent rankings.

Remaining user choices are the relative priority of leagues, constructed tournaments and drafts; PP budget and protected cards; and which championship berth is the first test case. These do not block the shared legality and data work. Current pack schedules and any ambiguous rule semantics require verification before the affected formats can be labeled fully supported.

## Scope and confidence

The inventory and code findings above were directly checked. Existing analytical reports were read for workflow and intent, not independently reproduced in full. The local app started and its login page rendered; an authenticated visual walkthrough and end-to-end interaction test were not completed. No new model was fitted, no optimizer implemented, and no gameplay improvement is being claimed yet.

Supporting material: [audit notes](</Users/ljmac/Desktop/OOTP Perfect Team/Docs/audit-2026-09-06/NOTES.md>), [reproducible evidence](</Users/ljmac/Desktop/OOTP Perfect Team/Docs/audit-2026-09-06/evidence.json>), and the audit notebook alongside them.
