# OOTP Perfect Team Command Center

A personal analytics app and toolkit for **OOTP Baseball 27 Perfect Team**. It
scores every card in the game for a given tournament's run environment and
park, builds and optimises tournament rosters, tracks PTCS qualifying, models
league play, and helps during Perfect Drafts.

It is built around one player's collection and workflow (the Kansas City
Torrent, `RTR1776`), but the model, the optimiser and the import pipeline are
general.

## What it does

| Area | Pages and tools |
|---|---|
| **Cards** | `/cards`: search the whole card table; **Card Fit** places a new card in every current event against your saved roster, with the runs it adds and whom it replaces |
| **Rosters** | `/build`: build a legal roster for any catalogued tournament (cap, slots, card years, variant limits, DH, park), then **Optimise** or **Search longer**. Roster rules (at most 5 SP and 7 RP, 2 long men, backups at C and SS, a 4-man rotation before 1970) are enforced |
| **Run environments** | `/runenv`, `/environments`, `/eras`: what each era and park does to every rating |
| **Tournaments** | `/meta`, `/played`, `/market`: what the field plays, how each card has actually performed, and shop prices |
| **Qualifying** | `/ptcs`, `/qualifying`: log results from the Your Tournaments screen, see category totals against projected cutoffs, and the Clubhouse Stars leaderboards |
| **League** | `/league`, `/league-card`: league lineups and staff from league play, what a card adds, and "from your collection" scans |
| **Drafts** | `/draft`: a by-position board and a live draft helper that ranks each pack by what your finished team is worth |
| **Upgrades** | `/upgrades`: variant scans and cards you don't own, priced against the shop |
| **Data** | `/upload`: drop shop lists, collection exports and league exports from any machine |

## How a card is valued

1. **Ratings → rates.** Each rating maps to a component rate through curves
   fitted on observed tournament play (`web/src/data/curves.json`,
   `pnpm curve:refit`). Power and Eye drive offense, Contact barely does;
   pitcher Control beats Stuff.
2. **Environment.** The rates are set in the event's era profile and park and
   read on that environment's linear weights, per board (vs RHP and vs LHP,
   with each side of the park).
3. **Calibration.** Within a tournament field the curves overstate the spread,
   so runs are scaled to what play actually returns (`pnpm model:calibrate`,
   refit every time new exports are filed).
4. **Roster objective.** Gloves in runs at the slot, catcher framing, the two
   lineups weighted by the field's measured left-handed pitching, starters and
   relievers weighted by the innings the field's own staffs throw, then a
   hill-climb under every roster rule (`web/src/lib/roster-objective.ts`,
   `roster-optimize.ts`).

League play uses its own fitted models (`web/src/data/league-*.json`), since a
162-game league compresses talent differently from a tournament.

## Stack

- **App:** Next.js 16 (App Router) + TypeScript in `web/`, deployed on Vercel.
  Read `web/AGENTS.md` before changing it: this Next.js version differs from
  older docs.
- **Database:** Postgres (Neon in production, any Postgres locally) through
  Drizzle ORM. Schema in `web/src/db/schema.ts`.
- **Card art:** Vercel Blob.
- **Scripts:** TypeScript run with `tsx` (`web/scripts/`), plus macOS
  double-click `.command` files in the project root for the weekly data loop.
- **Legacy:** `engine/` is the original Python pipeline (July 2026). It is no
  longer on the data path.

## Getting started

```bash
cd web
pnpm install
cp .env.example .env.local      # then fill it in (see below)
pnpm db:push                    # create the tables
pnpm dev                        # http://localhost:3000
```

`web/.env.local` needs:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | A Postgres connection string. Neon URLs use the serverless driver; anything else uses node-postgres. |
| `AUTH_SECRET` | At least 32 random characters for signing the session cookie (`openssl rand -base64 32`). |
| `APP_PASSWORD` | The single login password. Use a long random one if the app is on the public web. |
| `BLOB_READ_WRITE_TOKEN` | Only for uploading card art (kept in `web/.env.blob`). |

The app is single-user: every page and API route sits behind one password and
a signed, httpOnly session cookie (`web/src/proxy.ts`, `web/src/lib/auth.ts`).

Checks before a commit:

```bash
cd web
pnpm typecheck
pnpm lint
pnpm test
```

## The data loop

[RUNBOOK.md](RUNBOOK.md) has the full table. In short:

| When | Run |
|---|---|
| A tournament ends | **File OOTP Exports.command**, or leave **Watch Tourney Stats.command** running while exporting. Files the export under its event id, imports it and refits the model on quit. |
| Monday's community dump posts | **Load Tourney Dumps.command** |
| Cards bought, sold or released | Drop the shop list and collection export on `/upload`, or `pnpm import:cards` |
| A league week ends | `pnpm import:league "../League Data/YYYY-MM-DD"` |
| Results screen | Paste rows into `/ptcs`, or `pnpm results:log --as-of DATE rows.txt` |
| After any of the above | **Push to GitHub.command** (pulls, commits the Mac's data files, pushes; Vercel redeploys) |

## Useful scripts

All run from `web/` (most need `DATABASE_URL`).

| Script | What it does |
|---|---|
| `scripts/current-rosters.ts --changes --save` | Rebuild and save only the current events a card change affects (new card starts, or a saved card is gone) |
| `scripts/current-rosters.ts --all --only ID,… --save` | Full re-search of named events |
| `pnpm env:roster` (`scripts/env-roster.ts`) | Build one roster from flags: `--year`, `--park`, `--dh`, value window, cap, slots, `--pool-ids` for a drafted pool |
| `pnpm roster:diff` | Score a roster you have and list the best swaps |
| `pnpm roster:save` | Save a load file to `/build` as a named roster |
| `scripts/ptcs-standing.ts` | PTCS category totals, cutoff lines and what each category needs per day |
| `pnpm league:compare` | What a card adds to your league lineups |
| `pnpm park:sweep` | Rank home parks for the league |
| `pnpm model:calibrate` | Refit the model against observed play |

## Repository layout

```
web/                 Next.js app, scripts, model data (src/data/*.json)
Docs/                Handoffs, studies, plans, roster write-ups (Docs/Rosters/)
Tourney Data/        Community dumps, PTCS result screens, clubhouse prices
League Data/         League exports, one folder per week
Inbox/rosters/       Roster load files and manifests from batch rebuilds
reference/           Reference material used by the model
engine/              Legacy Python pipeline
*.command            macOS double-click scripts for the data loop
```

For background, start with `Docs/HANDOFF - read me first.md` (scoring rules
and how the project is worked on), then the newest `Docs/Handoff <date>.md`.
`Docs/OOTP ENGINE DECODED.md` explains how ratings become outcomes.

## Not affiliated

This is a fan-made tool. OOTP Baseball and Perfect Team are trademarks of Out
of the Park Developments. Card data and screenshots come from the game.
