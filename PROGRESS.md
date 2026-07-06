# PROGRESS — implementation state vs PLAN.md

> Read PLAN.md first for the full design. This file tracks what's actually
> built, decisions made along the way, and what's next. Keep it updated at the
> end of every working session.

**Last updated:** 2026-07-06 (session 2 — Fable; Days 1 AND 2 complete)

## Environment
- Python: **use `.venv/bin/python`** (repo-root venv; pandas 3.0.3 + lxml + openpyxl).
  Homebrew python3 is PEP-668-locked and missing lxml — don't use it.
- pandas 3.0 note: `pd.to_numeric(errors="ignore")` no longer exists; loaders use
  coerce-if-lossless instead (see `ootp_export._clean`).
- Web: `cd web && pnpm dev` (unchanged).

## Done ✅

### Config & rules (was Day 3 item 1 — pulled forward)
- `data-src/OOTP26 Historic Tourney_Draft List.xlsx` — LJ's tourney/draft rules
  sheet, now the **source of truth** for tournament + draft configs.
  Sheets: `Tournaments` (108 rule-version rows: value ceiling/floor, team caps,
  veCap*, DH, RE year vs modern, mode BOx[Fy], card eligibility flags
  live/unsung/snapshot/nel/fl/legend/hh/allstar/rookie, card era min/max, prize)
  and `Drafts` (51 PD events: DraftType, Default_RE Y|N + Year, mode, teams, DH).
  *veCap semantics still unconfirmed with LJ.*
- `engine/config_build.py` → `engine/config/tournaments.json` (full, incl.
  historical versions) + `web/public/data/contexts.json` (116 active contexts,
  each with **era-correct RE baselines** computed from the MLB year-by-year file
  over `[year-2, year+2]`, modern = 2020–2026). Spot-checked: deadball 1919
  HR/BIP 0.0069 vs modern 0.0455; 1970 R/G 3.90; 1999 R/G 4.91. ✓
- **Draft mechanics (LJ, 2026-07-06):** packs usually show **6 cards of one tier**
  (Perfect/Diamond/Gold/…); **26 total picks**; some packs pick 1, some 2; last
  round sometimes **pick 5 of Iron**; every DraftType has its own schedule; some
  types Diamond+Gold only. Encoded in `draftTypes` scaffold in tournaments.json —
  `packSchedule` is `null` per type until LJ fills round-by-round schedules.

### ETL (Day 1, core)
- `engine/ootp_export.py` — verified loaders:
  - `load_stats_export` (184-col): dash→NaN, stat blocks renamespaced to
    `bat_*/pit_*/fld_*` (raw `_1/_2` suffix mapping is in HIT/PIT/FLD_STATS lists).
  - `load_league_season` → 14,256 rows, 5 leagues × 3 splits. **Rows are
    card×team stints** — e.g. Tris Speaker on 43 PEL teams; aggregate by CID
    before analysis (top card = 17,283 PA season total). Only ~130–160 unique
    CIDs per league (concentrated meta).
  - `load_tourneys` / `parse_tourney_filename` (`<type>_<id>[_tourn_export].csv`).
  - `load_collection` (43-col; 2,687 cards, 26 active, 16 variants). Still no CID.
  - `observed_woba` / `observed_fip` helpers (verified: PEL PA≥300 mean wOBA .325).
- `engine/ingest.py` — tourney archive (`Tourney Stats/` canonical +
  `Tourney Stats examples/` read-only fallback; archive copy wins on dup id)
  → `web/public/data/tourneys.json`: per-type env means + per-CID aggregates
  (counting stats summed across stints, wOBA/FIP recomputed from sums,
  SIERA IP-weighted, `wOBA_rel` vs type env). Verified on the 3 examples:
  envs differ by type (FIP 3.45 dandf / 4.05 slots) — context matters. ✓

### Automation (new ask, session 2)
- `engine/watcher.py` — Python port of the R watcher (originals in
  `reference/r-watcher/`), plus auto-ingest: on export detect → prompt tourney
  ID → archive as `<label>_<id>.csv` → rebuild tourneys.json. First run creates
  `engine/config/watcher.json`; **LJ must set `watchDir`** (OOTP save folder
  containing `online_data/`; OOTP view must be saved as "Export", CWhit's view).
- `engine/__main__.py` — CLI: `.venv/bin/python -m engine config|ingest|watch|build`.

### Repo hygiene
- venv created; `app/` (empty) removed; R scripts archived under `reference/`.

### CID matching + projections regen (Day 1 finished) ✅
- **Tier mapping (LJ, 2026-07-06):** card VAL/CVAL → tier: <60 Iron, 60–69
  Bronze, 70–79 Silver, 80–89 Gold, 90–99 Diamond, 100–101 Perfect.
  `cid_match.tier_from_val`.
- **Old ratings CSV recovered from git** (`f9625c9:Ratings/...`, cached to
  `data-store/ratings_full_2026-05-30.csv`) — full 64-col schema incl. CID,
  CTier, per-position ratings. This is the projections.py input schema.
- `engine/cid_match.py` — collection→CID matcher. Match rate **80.8%**
  (2,171/2,687); unmatched are mostly post-May Iron/Bronze commons never seen
  in league/tourney exports (only 4 Diamonds, 0 Perfects missed). Key lessons
  encoded there: collection spells handedness out (Right/Left/Switch vs R/L/S);
  collection "CON vL/vR" = pitcher control = old-CSV "CON vL_1/vR_1"; **Live
  cards' ratings drift weekly** so fingerprinting is tolerance-based similarity
  (|Δ|/25 scale), not equality; CID-collision pass keeps best score.
- `engine/pool_build.py` — merged master pool (old CSV base + ACT/BUY/VAR
  refresh from collection + 609 post-May cards synthesized from 184-col
  exports; hitter CON≈BA substitution, MOV absent→engine skips) →
  **projections.json regenerated: 2,633 cards, 0 errors**, `owned` +
  `ratings_source` fields added; team.json refreshed (26 active, 14 variants).
  `pnpm build` passes on the new data. ✓
- NOTE: **active roster fully turned over since May** (now Pujols/Wagner/
  Speaker/Campanella/Paige era-mix) — old memory rosters are obsolete;
  team.json is the truth.
- CLI now: `config | ingest | match | projections | watch | build` (build =
  everything; ~2 min).

### Day 2 calibration ✅ — WITH A MAJOR ENGINE FIX
- **v1 engine was broken for pitchers** (diagnosed by component): the
  hand-tuned `(rating/50)^0.55` curve saturates at PT rating ranges —
  projected K/9 averaged 16.75 vs observed 7.58 (corr 0.22), HR/9 2× too high,
  so composite FIP ordering was noise (corr 0.03) even though the sim follows
  ratings tightly (raw STU→K9 +0.84, CON→BB9 −0.88).
- **`engine/curves.py`**: fits log(rate/env) = α + β·log(rating/50) per
  component from the league vL/vR files (ratings+outcomes same rows).
  R²: hit K .88, BB .87, HR .78, XBH .57, BABIP .26; pit K .68, BB .74,
  HR .51, BABIP .17 (DIPS lives — pitchers barely control BABIP, like real
  baseball). Rating range 4–230 so low-tier extrapolation is covered.
- **`engine/projections2.py`**: v2 engine on fitted curves, in the
  **modern-PT-league frame** (env rates in curves.json; payload has `pt_env`
  {wOBA .3232, FIP 4.055}). v2 validation: projK9↔obsK9 corr **+0.885**
  (means 7.80 vs 7.58), projFIP↔obsFIP **+0.61**. Overall lines = 28/72 (hit)
  / 45/55 (pit) blends of splits.
- **Manager platooning discovered**: hitters' PA-share vs L averages .372,
  sd .128, corr +0.77 with the card's platoon gap → observed 'all' split is
  usage-contaminated. Calibration fits **splits only**; overall is constructed.
  (Kept in evidence as `*_obs_rel_all_usage` for reference.)
- **`engine/observed.py`** (env-relative observed metrics; league-strength
  offsets: PEL pitchers +3.1% FIP vs HD — applied; hitters −0.4% — ignored)
  and **`engine/calibrate.py`**: weighted fits obs_rel ~ a+b·proj_rel per
  split — **b 0.78–1.03, R² 0.54–0.70** (in the plan's target zone).
  Shrinkage blend k=220 PA / 60 IP. Every card now carries an `evidence`
  block: `woba/fip_cal_rel_vL/vR`, `blend_rel`, absolute `*_blend_vL/vR/all`,
  obs values + n, sources, `siera_obs`. Report artifact:
  `web/public/data/calibration_report.json` (scatter points + topMovers).
- Spot-checks: Speaker (70k PA) blend snaps to obs; Whitey Ford blend 3.74 vs
  cal 3.94 (earned by 8k IP); small-sample relievers properly shrunk.
  `pnpm build` passes.
- CLI now: `config | ingest | match | curves | projections | calibrate |
  watch | build` (build chains everything).

## Not done yet ⏳ (in priority order)

1. **Day 3 webapp** note: the lineup optimizer should consume
   `evidence.woba_blend_vL/vR` (fall back to projection when absent) — that's
   the whole point of Day 2. Explorer wOBA/FIP columns now show PT-frame
   values (lower than v1's MLB-frame numbers — expected, not a bug).
2. **Collection re-export with CID+Tier** still wanted (kills the 516-card
   unmatched tail + removes fingerprint fragility for Live cards). When it
   lands: extend `load_collection`/`pool_build` to prefer the export's CID and
   report diffs vs the matcher.
3. **Day 2 leftovers (minor)**: tourney observations feed evidence pooling for
   the 'all' split only (no split files exist per tourney); consider
   uncertainty flags in UI for cards with n<150 PA. MOV rating dropped from v2
   pitcher model (not present in 184-col exports; league data can't fit it).
4. **Day 3 webapp** — context switcher consuming `contexts.json` (already
   shipped to public/data), `/tournaments` page over `tourneys.json`, Card Lab
   with TS projection port (port projections2.py — the v2 curve engine — NOT
   projections.py; curves.json ships to the app or gets inlined).
5. **Day 4 draft helper** — needs `packSchedule` per DraftType from LJ (config
   scaffold ready); draft-board precompute (`python -m engine draft-board`) not
   started.
6. PLAN.md Day 5 items; fold `web/.git` into root repo (still separate).

## Open questions for LJ
- `veCap` column meaning in the Tournaments sheet? (stored raw meanwhile)
- Pack schedules per DraftType (round-by-round: tier, shown, picks) — fill in
  `engine/config/tournaments.json → draftTypes`. Also: is the 15:00 clock global
  per draft or per pick, and which types are "Speed"-clocked?
- Collection re-export with CID + Tier columns.
- `watchDir` path for the watcher config (your OOTP save folder).
