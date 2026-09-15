# RUNBOOK — how this project actually runs (2026-09-15)

Read this before the README's "weekly refresh" section, which describes an
older flow (the Python `engine`, `Tourney Stats/`, `Roster Templates/`) that
is no longer how anything gets in. Everything below is what is on disk and
what the last two weeks of commits use.

Three double-click files in the project root do the work. Claude commits;
L.J. pushes (Claude's shell has no credentials). Vercel deploys from the push.

## The weekly loop

| When | Do | What it runs | What it leaves |
|---|---|---|---|
| Every time a tournament ends | **File OOTP Exports.command** (or leave **Watch Tourney Stats.command** running while exporting) | files the export under its real event id, imports it (`import:observed --series X`, Jim-beater teams dropped), refits the projection when you quit | `Archive/Completed/<series>_<run>.csv`, `observed_card_stats`, `projection-coeffs.json` |
| Monday, after the community dump posts | **Load Tourney Dumps.command** | files `pt27_*dump*.csv` into `Tourney Data/`, imports new runs, refreshes `my_results`, prints PTCS standing + berth lines | `Tourney Data/pt27_*_dump_YYYYMMDD.csv`, `results`, `daily_totals` |
| Sunday, when the league season ends | `cd web && pnpm import:league "../League Data/YYYY-MM-DD"` | one folder per week, all/vL/vR per league | `league_snapshots`, `league_stints` |
| Cards bought/sold, new releases | export collection + card list from OOTP, then `pnpm import:cards SHOP COLLECTION YYYY-MM-DD --commit` | one transaction, sha-deduped; variants keep their own ratings | `uploads`, `cards`, `collection_cards` |
| PTCS results screen | paste rows into **/ptcs → Log results**, or `pnpm results:log --as-of DATE rows.txt` | keyed by the event id in parentheses, re-paste is a no-op | `results` |
| A tier refresh post | `Tourney Data/refresh-YYYY-MM.json` + `web/scripts/slot-map.json`, then `pnpm import:refresh --dry`, `pnpm import:refresh`, `pnpm retire`, `pnpm coverage` | | `tournaments` |
| Rules for a tournament you play | paste the blurb into the catalogue row's `restrictions` text; `pnpm parse:restrictions` reads OOTP's wording | 62 of 135 rows still have none, including most you enter | `tournaments.restrictions` |

## Building a roster

    cd web
    pnpm env:roster --name "Monday Gold Floor Cap" --year 2010 --min 80 --max 102 \
      --cap 2242 --size 26 --dh --bats 14 --sp 5 --rp 7 --optimize --role-trust 0.25

Defaults that are measured, not guessed (each has the evidence in its comment):

- `--min-pos 50` — nothing below a 50 position rating plays except 1B/DH (L.J.'s rule)
- `--rp-weight 0.31` — a relief arm faces 0.31 of a starter's batters (0.24 in deadball eras)
- `--role-trust 0.25` in `league-best` (1 in `env-roster`; pass 0.25) — most of the reliever bonus is inherited-runner accounting
- `--obs-k 2500` — observed play blended with the model; a card with the pool's median 5,600 PA is ~70% observed. `--obs-k 0` is model-only.
- `--slots G13,I13` — slots events; `--must "Name,Name"` forces cards in; `--ban` keeps them out

Do not compare `objective:` across different `--sp/--rp` shapes — an SP slot weighs 1.0 and an RP slot 0.31, so the total moves by arithmetic alone.

Other tools:

- `pnpm league:best --year 1989 --park "Huntington Park" --park-year 2026 --dh` — whole collection scored for a theme week
- `pnpm tourney:brief --series bronzeweekly` — what a series has rewarded, what you own, what it costs
- `pnpm arm:roles` — every arm with the role term in and out
- `pnpm berth:lines`, `pnpm cutoff:project` — where the PTCS lines sit and where they land
- `pnpm cap:finish` — complete a part-built capped roster

## Validation — run these after any model change

- `pnpm model:validate` — rank correlation of model runs vs observed play (hitters ~0.54, arms ~0.40 at 2026-09-15)
- `pnpm observed:validate` — is observed play predictive out of sample? (halves agree 0.52 / 0.46; blended with the model at K=2500, 0.63 / 0.59)
- `pnpm env:validate` — is the era term worth anything? (+0.008 near 2010; only pre-1930)
- `pnpm curve:refit` (dry) — curves vs the shipped ones; `--write` emits `curves.next.json`, copy to `curves.json` to ship
- `pnpm role:effect` — the reliever residual
- `cd web && node --import tsx --test src/lib/**/*.test.ts src/lib/*.test.ts` — 38 tests

## Data facts that bite

- **Jim teams.** A no-roster opponent is filled with placeholders and loses 50-0. The placeholders are not in the stats export; the team that beat them is, with the runs. 11.4% of all runs in the archive were this. `src/lib/ingest/jim.ts` drops those teams at import; the dropped list is on `import_batches.files[].dropped`. Anything fitted on `observed_card_stats` before 2026-09-15 saw the contamination.
- **Variants.** Same `card_id` as the base, different ratings. `collection_cards.ratings` is the owned copy; key a pool on `collection_cards.id`.
- **Tourney ids** come from the dumps, never from a calendar; L.J. does not enter every run of a series.
- **Two Truists.** Truist Park (Atlanta, neutral) vs Truist Field (Charlotte AAA, HR 1.50). `parkTwins()` warns.
- **Dump usernames vs export team names** are not joined anywhere. His own is `rtr1776` = Kansas City Torrent.
- **Roster size** is the strongest single predictor of a deep run in the archive: 26 cards reach round 3 in 42% of events, 24 cards 9%, ≤20 cards 4%.

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
GitHub.command** to push.
