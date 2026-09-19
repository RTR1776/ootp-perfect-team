# RUNBOOK — how this project actually runs (2026-09-17)

Read this before the README's "weekly refresh" section, which describes an
older flow (the Python `engine`, `Tourney Stats/`, `Roster Templates/`) that
is no longer how anything gets in. Everything below is what is on disk and
what the last two weeks of commits use.

Three double-click files in the project root do the work. Claude commits;
L.J. pushes (Claude's shell has no credentials). Vercel deploys from the push.

## The weekly loop

| When | Do | What it runs | What it leaves |
|---|---|---|---|
| Every time a tournament ends | **File OOTP Exports.command** (or leave **Watch Tourney Stats.command** running while exporting) | files the export under its real event id, imports it (`import:observed --series X`, Jim-beater teams dropped, field handedness measured), recalibrates the model when you quit (`pnpm model:calibrate`) | `Archive/Completed/<series>_<run>.csv`, `observed_card_stats`, `series_meta`, `web/src/data/model-calibration.json` (commit it) |
| Monday, after the community dump posts | **Load Tourney Dumps.command** | files `pt27_*dump*.csv` into `Tourney Data/`, imports new runs, refreshes `my_results`, prints PTCS standing + berth lines | `Tourney Data/pt27_*_dump_YYYYMMDD.csv`, `results`, `daily_totals` |
| Sunday, when the league season ends | `cd web && pnpm import:league "../League Data/YYYY-MM-DD"` | one folder per week, all/vL/vR per league | `league_snapshots`, `league_stints` |
| Cards bought/sold, new releases | export collection + card list from OOTP, then `pnpm import:cards SHOP COLLECTION YYYY-MM-DD --commit` — or drop both files on **/upload** from any machine | one transaction, sha-deduped either way; variants keep their own ratings; every web attempt is recorded in `import_batches` (`pnpm imports`) and /upload shows how old every source is | `uploads`, `cards`, `collection_cards` |
| PTCS results screen | paste rows into **/ptcs → Log results**, or `pnpm results:log --as-of DATE rows.txt` | keyed by the event id in parentheses, re-paste is a no-op | `results` |
| A tier refresh post | `Tourney Data/refresh-YYYY-MM.json` + `web/scripts/slot-map.json`, then `pnpm import:refresh --dry`, `pnpm import:refresh`, `pnpm retire`, `pnpm coverage` | | `tournaments` |
| Rules for a tournament you play | paste the blurb into the catalogue row's `restrictions` text; `pnpm parse:restrictions` reads OOTP's wording | 62 of 135 rows still have none, including most you enter | `tournaments.restrictions` |

## Building a roster

    cd web
    pnpm env:roster --name "Monday Gold Floor Cap" --series goldfloorcapweekly --year 2010 --min 80 --max 102 \
      --cap 2242 --size 26 --dh --optimize --role-trust 0.25 --starts 12

`--series slug` reads the field off its exports: staff shape, the share of innings thrown left-handed (the vs-LHP lineup's weight) and the share of PA by left-handed bats (an arm's park blend). Without it the era table and 0.30 / 0.35 stand in. `--starts 12` finishes in ~4½ minutes on the whole collection; 64 is the exhaustive run.

**/build does the same thing in the browser** (2026-09-17): the Runs column is the calibrated model with observed play blended in, Re-recommend is the greedy fill, and **Optimise** hill-climbs the board on runs with gloves priced in runs under the glove floor — each slot's top 120 candidates from the greedy fill, so it takes seconds rather than minutes (Gold Rush: 175 of the CLI's 179 runs, from 151 greedy). The upgrade tab ranks unowned legal cards by the same runs.

Defaults that are measured, not guessed (each has the evidence in its comment):

- **calibration** (`src/data/model-calibration.json`, `pnpm model:calibrate`): within a field, +10 modelled runs came back as +5.1 for bats and +4.8 for arms, so the model's runs are scaled by 0.51 / 0.48 before observed play is blended in and before gloves are added. Rankings on one scale do not move; the bat-for-glove and bat-for-arm exchange rates do. Re-run after new exports; the filer does it on quit.

- `--min-pos "70,1B:0,LF:50"` (the default) — L.J.'s glove floor as of 2026-09-16: 70 everywhere, 50 in LF, none at 1B/DH. A bare number is that floor everywhere but 1B/DH. The hill-climb enforces it too.
- defence is priced in runs (`src/data/fielding.json`, `pnpm fielding:fit` to refit): 0.155 runs per rating point per 700 PA at 2B, .138 SS, .133 3B, .125 1B, .086 RF, .079 LF, .057 CF, .032 C — measured as ZR per point on the archive × the 0.89 runs per ZR that OOTP's own WAR pays. The lineup print shows each glove's runs after DEF.
- `--rp-weight 0.31` — a relief arm faces 0.31 of a starter's batters (0.24 in deadball eras)
- `--role-trust 0.25` in `league-best` (1 in `env-roster`; pass 0.25) — most of the reliever bonus is inherited-runner accounting
- `--obs-k 5000` — observed play blended with the calibrated model; a card with the pool's median 5,600 PA is ~53% observed. Was 2500 on the uncalibrated scale; 5000 is where held-out prediction peaks now (0.641 / 0.613). `--obs-k 0` is model-only.
- `--slots G13,I13` — slots events; `--must "Name,Name"` forces cards in; `--ban` keeps them out

Do not compare `objective:` across different `--sp/--rp` shapes — an SP slot weighs 1.0 and an RP slot 0.31, so the total moves by arithmetic alone.

**Perfect Draft:** the **Played** tab (`/played`) — every card with tournament play, ranked by observed runs on the model's scale (calibrated, blended at K=5000), with the round's value window, position, hand, year and owned filters. Pool is the game's, not the collection. Cached per import, so it opens instantly on draft night.

Other tools:

- `pnpm league:best --year 1989 --park "Huntington Park" --park-year 2026 --dh` — whole collection scored for a theme week
- `pnpm tourney:brief --series bronzeweekly` — what a series has rewarded, what you own, what it costs
- `pnpm arm:roles` — every arm with the role term in and out
- `pnpm berth:lines`, `pnpm cutoff:project` — where the PTCS lines sit and where they land
- `pnpm cap:finish` — complete a part-built capped roster
- `pnpm roster:diff --roster my.txt --series goldweekly --year 1989 --park "Candlestick Park" --park-year 1979 --dh --min 40 --max 89` — score the roster you have LOADED (one slot per line: `R:3B Hank Thompson`, `SP1 Jim Kaat`, `CL …`, `BN2 …`) and list the swaps in the order the search takes them, biggest first, so a mid-week change is three moves and not a rebuild. A card not yet in the card table (released after the last shop list) gets a stand-in and a warning.
- `pnpm cwhit:compare --date 2026-09-17 --year 1955 --park "Hinchliffe Stadium" --park-year 1936 --min 50 --max 74` — the app's runs beside cwhit's boards for the same cards, with rank correlations. Transcribe his screens into `reference/cwhit/<date> {hitters,pitchers} {observed,projected}.csv` (column names in the existing files) when you cannot get his CSV; a two-week observed board is a sample for bats (300 PA) and noise for arms (100 IP).
- `pnpm import:collection "collection - manage cards.csv" [--date YYYY-MM-DD]` — the /upload page's collection import from the command line: same parse, shop matching, position overrides and lineage; a file already imported (same sha256) is skipped. Cards the shop list does not know yet come back "unmatched" — refresh pt_card_list.csv first when that number is not near zero.
- **Provisional cards.** A card the collection export carries but the shop list does not yet (a release after the last `pt_card_list.csv`) comes back "unmatched" and is invisible to every roster tool. Stop-gap used 2026-09-17 for Andy McGaffigan 73: a `cards` row with a NEGATIVE card_id (−73001) built from the export's own ratings (`STU/CON/PBABIP/HRA vL/vR` → `Stuff/Control/pBABIP/pHR vL/vR`, `STM` → Stamina), and the collection row pointed at it. When the real shop list lands, delete the negative row and re-run `pnpm import:collection` so the row matches the real id: `delete from cards where card_id < 0`.
- `pnpm standings:map` — learn the game's STANDINGS tag per event name from every result logged off the Your Tournaments screen and write `src/data/standings-tags.json` (commit it). `categoriesOf` reads that first; names it has never seen fall through to rules that were FITTED to the game's actual PTCS 6 cutoffs (a Live event is its tier + Live, a cap or slots event with no tier word is Open + Cap, a Live draft is PD + Live, Negro Leagues is Open). Run after logging results, then `pnpm dumps:restandings`.
- **/cards** — one card, every read: projection in a chosen event's environment (wOBA / FIP by hand, calibrated runs), the blend the roster tools rank on, and the card's actual line in every series it has played against that series' own field. `?q=name&event=<id>`.
- `pnpm dumps:restandings` — rewrite the standings stored on every dump upload from the files in Tourney Data/. Run it after any change to the window rule or the category map in `dumps.ts`; the /ptcs berth rows read the stored copy.
- **Lines.** `pnpm ptcs:standing` uses cwhit's projected cutoffs when a transcription of his "Cycle N qualification targets" board exists in `reference/cwhit/<date> cycleN targets.csv` (newest wins) and shows the dump-derived line beside it; `periods.targets` on the /ptcs page carries the same numbers. His last-cutoff column is the game's actual; ours from the dump undercounts wherever the category map misses events.
- `pnpm record [--user x] [--size 128] [--weekly|--daily] [--series "..."]` — series W–L by round, series and month, exact from the dump's finishing order (verified against the published cwhitman/spatrick4 tables)

## Validation — run these after any model change

- `pnpm model:validate` — rank correlation of model runs vs observed play (hitters ~0.54, arms ~0.40 at 2026-09-15; unchanged by calibration, which is a rescale)
- `pnpm model:calibrate` — is a modelled run a real run? Within-field slope, deciles in runs, residual by release month and tier. Writes the calibration the scorer applies. (2026-09-17: 0.51 / 0.48; residual flat by release month, so no "launch card" rule is needed; Perfects −1.3 / −1.9)
- `pnpm observed:validate` — is observed play predictive out of sample? (halves agree 0.52 / 0.46; blended with the calibrated model at K=5000, 0.641 / 0.613)
- `pnpm env:validate` — is the era term worth anything? (+0.008 near 2010; only pre-1930)
- `pnpm curve:refit` (dry) — curves vs the shipped ones; `--write` emits `curves.next.json`, copy to `curves.json` to ship
- `pnpm role:effect` — the reliever residual
- `cd web && node --import tsx --test src/lib/**/*.test.ts src/lib/*.test.ts` — 46 tests

## Data facts that bite

- **Jim teams.** A no-roster opponent is filled with placeholders and loses 50-0. The placeholders are not in the stats export; the team that beat them is, with the runs. 11.4% of all runs in the archive were this. `src/lib/ingest/jim.ts` drops those teams at import; the dropped list is on `import_batches.files[].dropped`. Anything fitted on `observed_card_stats` before 2026-09-15 saw the contamination.
- **Variants.** Same `card_id` as the base, different ratings. `collection_cards.ratings` is the owned copy; key a pool on `collection_cards.id`. The collection export has no position columns, only DEF (rating at the listed POS); a variant's other positions scale by the same boost (`card-forms.ts`).
- **Positions.** The shop dump lists only a card's rated positions; the game rates every card at every position and the stat exports show all eight per card form. `pnpm positions:harvest` (load:dumps step 3c) fills the unlisted ones on base cards and stamps owned variant copies; `card_positions` is the harvested table. A defense page read off the game by hand goes in `src/data/position-overrides.json` (`pnpm positions:apply`).
- **A file you swapped in by hand is not re-imported.** `import:observed` hashes
  content, so it WILL pick up a changed file — but only when something runs it.
  Replacing `Archive/Completed/<series>_<run>.csv` outside the filer leaves the
  old rows live (2026-09-19: a 2-team sliver of diamondvariety_26 sat in the DB
  for an hour after the full 121-team export replaced it on disk). Run
  `pnpm import:observed --series <slug>` after any hand swap.
- **Check team counts on a filing push.** A stat export taken from the wrong
  screen carries only your own matchup: ~50 rows and 2 teams against ~3,000 and
  120+. They import clean and quietly dilute the series. Quarantined ones live
  in `Archive/Truncated/`.
- **Tourney ids** come from the dumps, never from a calendar; L.J. does not enter every run of a series.
- **Two Truists.** Truist Park (Atlanta, neutral) vs Truist Field (Charlotte AAA, HR 1.50). `parkTwins()` warns.
- **Dump usernames vs export team names** are not joined anywhere. His own is `rtr1776` = Kansas City Torrent.
- **Roster size is NOT measurable from a stat export.** The export lists only cards that appeared in a game, so a team that plays more rounds shows more rows; "26 cards reach round 3 in 42% of events, 24 cards 9%" (an earlier note here) is rows-in-export vs depth, the same artifact as "value spent predicts depth". L.J. enters 26 every time. Fill the roster; do not read a roster-size edge into the archive.
- **Field handedness varies a lot.** `series_meta.lhp_bf_share` runs from 0.10 (the deadball events) to 0.58 (Sporer's Sandlot); the vs-LHP board's weight and an arm's park blend come from it, not from 0.30 / 0.35.
- **Field sizes change.** Thursday Night Gold Rush went 128 → 256 on 8/20 and the catalogue said 128 for a month. `pnpm catalogue:sync` now overwrites `entrants` with the newest run's scheduled size.

## Where things live

- `Archive/Completed/` — every tournament stats export (346 files, 54 series). Gitignored; the only copy.
- `Tourney Data/` — the community finish-order dumps. The permanent record; tournaments retire.
- `League Data/YYYY-MM-DD/` — weekly league exports.
- `LJ Cards and Card Shop/` — collection and card-list exports.
- `_to_delete/` — things Claude could not delete from its sandbox (git lock files, scratch scripts). Safe to empty.
- `engine/` — the Python engine from July/August. Not on the weekly path since 2026-09-07; keep or retire.
- `Docs/HANDOFF - read me first.md` (2026-08-06) and `Docs/PROGRESS.md` (2026-07-06) — history, not current state.

## Git from Claude's side

Claude's shell is a sandbox: it can commit but not push, and cannot delete
files, so a stale `.git/index.lock` or `HEAD.lock` gets moved to
`_to_delete/gitlocks/` rather than removed. Double-click **Push to
- `pnpm roster:corrected --series X --year Y --park … --min … --max … [--card-types 2,6,7] [--roster start.txt] [--alternatives 6] [--max-passes 0] [--no-correct]` — env-roster's pricing with the era-slopes correction applied to bats before the observed blend (the per-rating gap between what play returned in that era band and what the calibrated model pays). Prints the evidence first (model, corrected, blend, and the card's own line in this series), then the six best legal cards per slot when asked, then the roster. `--max-passes 0` scores a hand-built roster as loaded. Used for Diamond Variety 2026-09-19.
- `pnpm era:slopes` — what each rating is worth per era, measured from play: within-series (fixed-effects) slopes with series-clustered errors, beside the model's own calibrated line per band. The read as of 2026-09-19: BABIP under-priced 2–3× in every era, Gap 1.5×, everything before 1960 scaled down too hard; Power, Eye and Avoid Ks right in modern play. Next step is a per-component calibration, not a per-era curve refit.
