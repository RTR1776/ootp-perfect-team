# OOTP Perfect Team Webapp — 5-Day Finalization Plan

**Owner:** LJ (RTR1776 / KC Torrent). Personal desktop webapp — no mobile, no auth, no deployment needed (runs locally via `pnpm dev`).

**Goal:** Finish the app so LJ can (1) find his best lineup/roster for any tournament context (era run-environment + ballpark), (2) model new cards the day they drop, and (3) get live pick recommendations during 15-minute Perfect Draft events.

This plan is written to be executed by an LLM agent working in this repo. Every schema below was verified against the actual files on 2026-07-06. Trust these over intuition — OOTP export column names are weird.

> **⚠️ Execution has started — read `PROGRESS.md` before doing anything.** It tracks what's already built (config builder, ETL loaders, tourney ingest, watcher, CLI), decisions made (use `.venv/bin/python`; pandas 3 quirks), and the current next-step queue. Sections of this plan marked ✅ below are done.

---

## 0. Current state (verified)

### What exists and works
- **`web/`** — Next.js 16 + React 19 + TS + Tailwind 4 app (its own git repo, separate from root). Working routes: `/` (card explorer, virtualized table, filters), `/card/[cid]` (detail), `/roster` (localStorage starred roster), `/lineup` (park- and platoon-aware lineup optimizer in pure TS: `src/lib/optimizer.ts`, `src/lib/parks.ts`). Stubbed: `/draft`, `/tournaments`. Data loaded client-side from `web/public/data/{projections.json, ballparks.json, team.json}` — all present. `pnpm build` passes.
- **`engine/`** — Python. `projections.py` converts OOTP card ratings (1–250 scale, 50 ≈ MLB avg, soft-exponent multipliers k=0.55) into projected splits/WAR; `league_baselines.py` builds MLB-average baselines from `MLB Batting Year-by-Year Averages.xls` for a year window (currently hardcoded 2020–2026).
- **`web/public/data/projections.json`** — last good engine output (2,024 cards, 2026-05-30). Schema: top-level `{baselines, card_count, cards[]}`; hitter splits `hitter_vL/vR/overall` use `BA` (not AVG) + `OBP,SLG,OPS,ISO,wOBA,BABIP,K%,BB%,HR_rate`; pitcher splits use bracketed `K/9,BB/9,HR/9` + `FIP,wOBA_against,BABIP_against,stamina,hold`; `value` = hitters `{wRAA_per_600, BsR_per_162, best_def_runs_162, WAR_per_600}` / pitchers `{RAA_per_180IP, WAR_per_180IP}`; `defense.positions[]` nested; meta `cid,name,pos,bats,throws,tier,buy,sell,lock,var` (`buy`/`sell` are space-separated strings; closer pos is `CL`).

### What's broken / stale
- The engine's input `Ratings/...full_roster_ratings.csv` was **deleted** — the engine cannot re-run until a new collection export replaces it (see §1 and User Actions).
- Root git has uncommitted deletions (`README.md`, `STACK.md`, `data/*`, `Ratings/*`) — intentional reorg, needs committing.
- `app/` is an empty directory — delete it.
- `.~lock.PTCS4 Live Tracker.xlsx#` is a LibreOffice lock file — gitignore it.
- `projections.json` is 5 weeks stale and predates the current card pool.

### New data (the reason for this plan)

**A. `Most recent League Season/` — 15 CSVs, one season of real PT results.**
Perfect League (`pel_*`) + four High Diamond leagues (`hd450–hd453`), each as 3 files: overall, `vL`, `vR`. 874–1,118 rows each. **184 identical columns** containing BOTH card ratings AND actual accumulated stats in the same row, keyed by `CID`. This is gold: it lets us *calibrate* the theoretical engine against observed PT outcomes.
Key columns (verbatim): meta `POS,Name,ORG,B,T,VAL,CID,Tier,Title,VAR,VLvl,CYear,CEra`; hitter ratings overall + splits `BABIP,GAP,POW,EYE,K's`, `BA vL,GAP vL,POW vL,EYE vL,K vL`, same `vR`; pitcher ratings `STU,CON,PBABIP,HRA` + vL/vR variants, pitch mix `FB,CH,CB,SL,SI,...`, `G/F,VELO,STM,HLD`; defense `C ABI,C FRM,C ARM,IF RNG,IF ERR,IF ARM,TDP,OF RNG,OF ERR,OF ARM` + per-position ratings `P,C,1B,2B,3B,SS,LF,CF,RF`; running `SPE,SR,STE,RUN`; **hitting stats** `G,GS,PA,AB,H,1B_1,2B_1,3B_1,HR,RBI,R,BB,IBB,HP,SH,SF,K,GIDP,wRC,wRAA,WAR,SB,CS,wSB,UBR`; **pitching stats** `G_1,GS_1,W,L,IP,BF,AB_1,1B_2,2B_2,3B_2,HR_1,ER,BB_1,K_1,HP_1,...,WAR_1,rWAR,SIERA`; **fielding** `TC,A,PO,E,ZR,EFF,FRM,ARM`.
Gotchas: `-` (dash) = null; duplicate base names get pandas-style `_1`/`_2` suffixes (hitting vs pitching vs fielding blocks); `Y`/`N` booleans; UTF-8, plain CSV.

**B. `Tourney Stats examples/` — 3 CSVs, same 184-column format**, one per tournament instance (`diamondandfriends_36`, `diamondheart_88`, `diamondslotsdaily_109`; 1.3k–3k rows). LJ gets one of these from **every** tourney he plays — the pipeline must treat "a folder of tourney CSVs" as an append-only dataset tagged by tournament type parsed from filename (`<type>_<id>.csv`).

**C. `Roster Templates/KC Torrent Current Cards.csv` — LJ's current collection export (2,687 cards, 43 columns).**
Headers (verbatim): `POS,Name,B,T,BA vL,GAP vL,POW vL,EYE vL,K vL,BA vR,GAP vR,POW vR,EYE vR,K vR,STU vL,CON vL,PBABIP vL,HRA vL,STU vR,CON vR,PBABIP vR,HRA vR,STM,C ABI,C FRM,C ARM,IF RNG,IF ERR,IF ARM,TDP,OF RNG,OF ERR,OF ARM,DEF,SPE,STE,SR,RUN,ACT,CVAL,REL,L10,BUY,VAR`.
**⚠️ No `CID` column and no `Tier` column.** See User Actions — the fix is a re-export with CID included; the fallback is name+B/T+ratings fingerprint matching against the 184-col files.

**D. `Roster Templates/TemplateRosters_rtr1776.tr/` — 13 binary OOTP roster templates** (`Daily_Diamond_Slots_7.4.tr`, `PTCS-Diamond_6.5.tr`, `Wednesday_1950_to_Now.tr`, `Thursday_Live_Open_Weekly.tr`, ...). Proprietary binary — **do not parse**. Their names enumerate the tournament formats LJ plays; the rules for each live in a hand-maintained config (§3).

**E. `MLB Batting Year-by-Year Averages.xls`** — ⚠️ actually an **HTML table** despite the extension (Baseball-Reference export, 1870–2026, 30 cols incl. `R/G,PA,AB,H,1B,2B,3B,HR,BB,SO,BA,OBP,SLG,HBP,SF,BIP`). `league_baselines.py` already parses it correctly; keep using `pd.read_html`. This is the **run-environment (RE) source**: a tournament's era setting (e.g., "1950 to Now", CEra column, deadball events) maps to a year window here.

**F. `ballparks.csv`** (root) — 236 parks × `Ballpark,Team,Year,Avg LHB,Avg RHB,HR LHB,HR RHB,2B,3B` multipliers. Already mirrored as `web/public/data/ballparks.json`. Home park: **2013 Citi Field**.

**G. `Perfect Draft Daily Info/` — 3 strategy PDFs** defining how the draft helper should think (summarized in §4; no need to re-read).

**H. `PTCS4 Live Tracker.xlsx`** — hand-maintained qualifying-points tracker (Dashboard + Daily Log sheets). Stretch goal only (§6).

**I. `data-src/OOTP26 Historic Tourney_Draft List.xlsx`** *(added 2026-07-06)* — LJ's hand-maintained rules database: `Tournaments` sheet (108 rule-versions: value ceiling/floor, team value caps, DH, RE year vs modern, series mode, card-type eligibility flags, card era min/max) and `Drafts` sheet (51 PD events with DraftType + RE setting). **This replaces hand-authoring `tournaments.json`** — `engine/config_build.py` generates config + per-context RE baselines from it. When LJ adds new tourneys to the sheet, rerun `python -m engine config`.

**J. `reference/r-watcher/*.R`** — LJ's old R-based OOTP export watcher, ported to Python at `engine/watcher.py` (watch → rename `<label>_<id>.csv` → auto-ingest → rebuild tourneys.json).

---

## 1. Architecture

Keep the existing split; don't introduce new infra. No database — the volumes (≤ ~20k rows total) filter instantly in pandas and in the browser.

```
engine/  (Python, pandas)             web/  (Next.js, all client-side)
  ETL: OOTP exports → canonical         reads static JSON from public/data/
  calibration vs observed stats         optimizer + projection math in TS
  context builder (era × park)          UI: explorer / lineup / draft / tournaments
        └────────── writes ──────────► web/public/data/*.json
```

- **`engine/` becomes a small CLI**: `python -m engine build` (full rebuild), `python -m engine ingest-tourney <csv>` (append one tourney file). One entrypoint, subcommands via argparse. Outputs versioned JSON artifacts into `web/public/data/`.
- **All projection math that must run interactively (Card Lab, draft helper) gets a TypeScript port** in `web/src/lib/project.ts`, verified against Python outputs (§5 acceptance tests). The Python engine stays the source of truth for batch artifacts; TS handles single-card what-ifs so the app needs no server.
- **Context = (RE year-window, park, league-strength baseline).** Every value the app shows is computed *within a context*; the UI gets a global context switcher (defaults: PT Season → 2020–2026 RE, 2013 Citi Field, PEL baseline).

Repo hygiene (do first, 15 min): commit the pending deletions with message "Reorganize: replace data/+Ratings with League Season / Tourney / Roster Template exports"; delete empty `app/`; add `.~lock*` and `*.xlsx#` to `.gitignore`; move `ballparks.csv` and the MLB xls under a new `data-src/` dir (update `league_baselines.py` path).

---

## 2. Day 1 — Data engine: unified ETL + regenerated projections

**Outcome:** one command rebuilds everything from current exports; the stale projections.json is replaced.

> Status: items 1–2 ✅ (built as `engine/ootp_export.py` + `engine/config_build.py`, tested; plus `engine/ingest.py`, `engine/watcher.py`, `engine/__main__.py` CLI). Items 3–5 (projections regen, team.json refresh, runbook) remain — see PROGRESS.md.

1. **`engine/ootp_export.py`** — loader for the 184-col format:
   - `load_export(path) -> DataFrame`: dtype coercion, `-` → NaN, `Y/N` → bool, normalize the `_1/_2` suffix blocks into namespaced columns (`bat_PA`, `pit_IP`, `fld_ZR` …), attach `source` + `split` (`all|vL|vR`) from filename.
   - `load_league_season(dir) -> DataFrame`: loads all 15 files, adds `league` (`pel|hd450..hd453`), merges the three splits per league into one row per CID with `_vL`/`_vR` stat suffixes.
   - `load_tourneys(dir) -> DataFrame`: same, adds `tourney_type`, `tourney_id` from filename.
   - `load_collection(path) -> DataFrame`: the 43-col format; parse `ACT` (Yes/blank), `VAR`, `BUY`, `CVAL`, `L10`.
   - **CID resolution** for the collection file: exact match on `(Name, B, T, POS)` + ratings fingerprint (the vL/vR rating columns appear in both formats) against the union of 184-col files + old projections.json. Emit `unmatched.csv` for manual review. If LJ provides a CID-bearing re-export (User Actions), this collapses to a trivial join — build it anyway as the fallback path.
2. **`engine/context.py`** — `Context(era_window, park_name, league_baseline)`. Wraps `load_baselines(window)` (already parameterized) + park factor lookup from `ballparks.csv`. Named presets in `engine/config/tournaments.json` (see §3).
3. **Re-point `projections.py`** at the collection DataFrame (ratings columns map 1:1 — same names, only fewer of them; overall ratings can be derived as PA-weighted vL/vR blend consistent with the old CSV's convention — check old projections.json baselines for the 28%/72% split already used). Regenerate `projections.json` for all 2,687 collection cards + keep the union of league/tourney-seen cards (with `owned: false`) so the draft helper can score cards LJ doesn't own. Preserve the existing output schema exactly (the webapp reads it); add new optional fields only.
4. **Refresh `team.json`** activeCids from `ACT == Yes` in the collection export.
5. **Runbook** in `engine/README.md`: the 3 manual export steps in OOTP → file drop locations → `python -m engine build`.

**Acceptance:** `python -m engine build` runs clean from the repo as-is; new projections.json has ≥ 2,687 cards; `pnpm build` still passes; explorer + lineup pages work on the new data; unmatched-CID count reported and < 5% (or 0 with re-export).

---

## 3. Day 2 — Calibration: theory meets observed PT results

**Outcome:** projections stop being purely theoretical — they're corrected against ~14k player-seasons of actual PT sim results, with sample-size-aware blending. This is the "data engine" core.

1. **Observed metrics** (`engine/observed.py`) from league + tourney rows:
   - Hitters: observed wOBA per split from counting stats — `wOBA = (0.69·(BB−IBB) + 0.72·HP + 0.89·1B + 1.27·2B + 1.62·3B + 2.10·HR) / (AB + BB − IBB + SF + HP)` (weights already in engine baselines). Keep `PA` alongside.
   - Pitchers: observed FIP from `HR_1, BB_1, HP_1, K_1, IP`; carry the export's `SIERA` directly. Keep `IP`/`BF`.
   - Express everything **relative to that file's league mean** (wOBA+ / FIP− style, PA- or BF-weighted league mean) so PEL and HD leagues pool despite different talent levels and park mixes.
2. **Calibration fit** (`engine/calibrate.py`): for cards with decent samples (hitters PA ≥ 300, pitchers IP ≥ 50), regress observed relative performance on engine-projected relative performance, per split. Start linear (`obs ≈ a + b·proj`); inspect residuals vs each major rating (POW, EYE, K's, STU, HRA, GAP) and add at most 1–2 correction terms if a rating shows systematic bias (OOTP's sim is known to over/under-weight things the analytic formulas miss). Persist coefficients to `engine/config/calibration.json` and report R² per split — expect ~0.6–0.8; if lower, check the join and league-mean normalization before touching the model.
3. **Blended truth** per card: empirical-Bayes shrinkage of observed toward calibrated projection — `blend = (n·obs + k·proj_cal) / (n + k)` with `k ≈ 220 PA` for hitter wOBA, `k ≈ 60 IP` for pitcher FIP/SIERA (tune so that blend ≈ midpoint at the PD guide's "signal → decision-grade" boundary). Cards never observed just get `proj_cal`.
4. **Artifact:** extend each card in projections.json with an `evidence` block: `{PA_obs, IP_obs, wOBA_obs_vL/vR, SIERA_obs, wOBA_blend_vL/vR, fip_blend_vL/vR, leagues_seen[], tourneys_seen[]}`. The optimizer and draft board consume the *blend*, falling back to projection.
5. **Validation page data:** write `web/public/data/calibration_report.json` (scatter data: projected vs observed, per split, with n) — surfaced in the app on Day 3 so LJ can eyeball trust.

**Acceptance:** calibration report shows sensible fit (monotone, R² reported); a spot-check of 5 known cards (e.g., Cespedes, Chapman, Fried from the active roster) shows blended values between projection and observation; lineup optimizer output changes only modestly (sanity guard — flag if any card moves > 15 lineup ranks).

---

## 4. Day 3 — Webapp: tournament contexts, /tournaments page, Card Lab

**Outcome:** every view is context-aware; new cards can be modeled in minutes; tourney data is browsable.

1. **Context switcher** (global, in header; Zustand): presets from `engine/config/tournaments.json`, hand-authored once from the 13 `.tr` template names + LJ's knowledge. Schema per entry:
   ```json
   {"key": "daily_diamond_slots", "label": "Daily Diamond Slots", "era": [2020, 2026],
    "park": "Citi Field 2013" | "neutral" | "<park name>", "leagueBaseline": "pel|hd|tourney:<type>",
    "roster": {"size": 26, "SP": 5, "RP": 7, "C": 2, "...": "..."},
    "tierCaps": {"Diamond": null, "Gold": null}, "notes": ""}
   ```
   Fill in what's known; leave `null` + TODO comments where LJ must supply rules (era/park/caps per template). **RE scaling:** recompute run values with `load_baselines(era)`-derived weights per context — the engine pre-exports `web/public/data/contexts.json` with baselines + wOBA weights per preset so the TS side never parses the xls.
2. **`/lineup` upgrades:** consume `wOBA_blend` (evidence-weighted) instead of raw projection; context switcher replaces the current home/away toggle (park comes from context, keep manual override); show per-slot evidence badges (obs PA behind each number) so LJ knows when he's looking at signal vs projection.
3. **`/tournaments`:** load a new `web/public/data/tourneys.json` (built by `ingest-tourney`): per tournament type — league-mean run environment, top performers, and **"my cards vs field"**: for each card LJ owns that appeared, percentile of observed wOBA/SIERA within that tourney type. Table + simple distribution strip; nothing fancy.
4. **Card Lab (`/lab`):** model new cards the day they drop.
   - Input: paste one or more rows copied from any OOTP export (auto-detect 184-col or 43-col header, tab- or comma-separated), or manual entry of the ~12 core ratings.
   - Engine: TS port `web/src/lib/project.ts` of `project_hitter_platoon` / `project_pitcher_platoon` / defense / baserun / WAR (formulas in `engine/projections.py`; constants: rating center 50, k=0.55 with 0.30 for contact→K, FIP constant 3.10, PA split 28/72, positional adjustments C +12.5 … DH −17.5).
   - Output: full projected card in the current context, side-by-side vs any roster card at the same position, and "lineup impact": re-run the existing optimizer with the hypothetical card added — show run-delta and who it displaces. Save-to-scratch (localStorage) so modeled cards persist.

**Acceptance:** TS projections match Python within ±0.002 wOBA / ±0.05 FIP on 20 random cards (write a jest/vitest fixture generated by the Python engine); pasting a card row from a 184-col CSV renders a full card + lineup delta in < 2s; context switch visibly re-ranks the lineup (e.g., deadball era compresses HR-dependent bats).

---

## 5. Day 4 — Live draft helper (`/draft`)

**Outcome:** during a 15-minute Perfect Draft, LJ types a few characters per offered card and gets an instant, context-aware pick recommendation.

Design principles (from the PD strategy PDFs, which the implementation should encode literally):
- **Tiers over ranks** — cluster by gaps in the blended metric; within-tier decisions go to fit/defense/scarcity, not hairline stat edges.
- **Sample-size trust** — the blend from Day 2 already encodes this (150–600 PA = signal, 1500+ = measurement).
- **Quota depletion / urgency** — with fixed positional quotas and finite rounds, urgency = unfilled quota vs expected future supply.
- **Replacement level** — a pick's value is its edge over what you'll realistically get later at that position/role.
- **Role curve** — starters and rotation first; alert on impossible endgames ("Round 8, 1 SP" trap).

Build:
1. **Draft board precompute** (`python -m engine draft-board --context <key>`): for every card in the known pool (union of all exports), context-adjusted runs value (park + era + platoon-balanced), tier assignment per position bucket (C/1B/2B/3B/SS/LF/CF/RF/DH-bat/SP/RP-CL) via gap clustering — sort by value, break tiers where the gap exceeds `max(0.010 wOBA-equivalent, 1.5× median local gap)`; replacement level per bucket = mean value of the tier that straddles the expected last-fillable pick. Output `web/public/data/draftboard_<context>.json` (small: value, tier, pos, names, cid).
2. **Draft config** — mechanics confirmed by LJ (2026-07-06): packs usually show **6 cards of one tier** (Perfect/Diamond/Gold/…); **26 total picks**; some packs pick 1, some pick 2; last round sometimes pick-5-of-Iron; some types are Diamond+Gold only; **every DraftType has its own schedule**. The 20 DraftTypes are scaffolded in `engine/config/tournaments.json → draftTypes` with `packSchedule: null` — LJ fills round-by-round `{packTier, shown, picks}` per type (see User Actions). The draft UI must drive entirely off `packSchedule` so new types are config-only.
3. **UI (`/draft`):** three panes —
   - *Pack entry:* one search box with fuzzy autocomplete over the board (first 3–4 letters; ranked by pool relevance), Enter adds to current pack; 3–8 cards per pack; big **"Best pick"** verdict with the why: `VAR +X runs · Tier 1 of 3 at SS · quota 0/2 · urgency HIGH` and one-line comparisons for the rest. Keyboard-only operation (arrows + Enter to pick, Esc clears pack). This must be usable in < 20 seconds per pack.
   - *Roster tracker:* quota grid (filled/required per bucket), role-curve warning banner when `needed > plausibly_available_in(picks_remaining)`.
   - *Clock:* count-down from config total; per-pack elapsed; turns amber < 5:00, red < 2:00.
   - Recommendation score = `blend_runs_above_replacement × scarcity_multiplier + urgency_bonus + defense_tiebreak` where scarcity_multiplier reflects remaining higher-tier supply at that position in the pool (seen cards are removed from supply as they're entered), urgency_bonus kicks in when quota risk crosses the threshold, and defense (existing `def_runs_per_162`) breaks within-tier ties. Keep every weight in one exported `DRAFT_WEIGHTS` object for post-draft tuning.
   - *Post-draft:* export drafted roster to localStorage + a one-click "run lineup optimizer on drafted team".
4. **Dry run:** simulate a full 13-round draft from one of the tourney CSVs' card pools; fix any interaction slower than ~2s/pack.

**Acceptance:** full simulated draft completable in < 10 minutes of wall time using keyboard only; recommendations visibly respect quota urgency (starves a bucket → its cards jump the board); weights tunable in one place; works offline (all static JSON).

---

## 6. Day 5 — Validation, polish, docs, stretch

1. **End-to-end drill:** fresh OOTP exports → `engine build` → app reflects them; model one hypothetical new card in Lab; run one mock draft. Fix friction found.
2. **Calibration visibility:** small `/tournaments` tab rendering `calibration_report.json` scatter (projected vs observed) so trust is inspectable.
3. **Docs:** root `README.md` — what each folder is, weekly refresh runbook (export → build → done), where tournament configs live and how to add a new template. Update `web/README` run instructions.
4. **Git:** commit everything; decide whether to fold `web/`'s separate git repo into the root repo (recommended: yes — remove `web/.git`, drop `web/` from root `.gitignore`, one history).
5. **Stretch (only if time):** PTCS tracker port of `PTCS4 Live Tracker.xlsx` into `/tournaments` (points needed vs 128th-place cutoff); auto-watch folder for new tourney CSVs; buy/sell value screen using `BUY`/`CVAL` from the collection export.

---

## User Actions (LJ — do these early, everything else is unblocked without them but better with them)

1. **Re-export your collection from OOTP with the `CID` (Card ID) and `Tier` columns included** (same view that produced `KC Torrent Current Cards.csv` — add CID/Tier to the visible columns before exporting). Drop it in `Roster Templates/`. Kills the fuzzy-matching fallback.
2. ~~Fill in tournament template config~~ ✅ superseded — the xlsx (data-src/) now generates it; keep the xlsx updated with new tourneys and rerun `python -m engine config`. Still open: confirm what the `vecap`/`vecapnum` columns mean.
3. **Fill pack schedules per DraftType** in `engine/config/tournaments.json → draftTypes` (round-by-round: pack tier, cards shown, picks taken; 26 total). Also confirm: is 15:00 global or per-pick, and which types run "Speed" clocks. General mechanics (6-card tier packs, 1–2 picks, iron finale) already captured ✅.
3b. **Set `watchDir`** in `engine/config/watcher.json` (your OOTP save folder containing `online_data/`) so `python -m engine watch --label <type>` works.
4. Keep dropping **every tourney's stats CSV** into `Tourney Stats examples/` (or a renamed `Tourney Stats/`) named `<type>_<id>.csv` — the meta model gets better with each one.

## Verified gotchas (do not rediscover these)

- `MLB Batting Year-by-Year Averages.xls` is **HTML**, not xls — `pd.read_html` only.
- 184-col CSVs: `-` = null; `_1/_2` suffixes disambiguate hitting/pitching/fielding stat blocks; `HLD` appears twice (rating vs stat `HLD_1`).
- Collection CSV (43-col) has **no CID/Tier**.
- projections.json field names are non-obvious: `BA` not AVG, bracketed `K/9`, closer pos `CL`, `buy`/`sell` space-separated strings.
- `.tr` files are proprietary binary — never parse them.
- shadcn CLI is broken in `web/` — hand-author UI primitives like the existing ones.
- `web/` is currently its own git repo — changes there don't show in root `git status`.
