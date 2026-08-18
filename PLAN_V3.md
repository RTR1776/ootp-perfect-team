# PLAN V3 — one app for everything OOTP

**Written:** 2026-08-17
**For:** whoever picks this up next (likely Claude Code)
**Supersedes:** PLAN.md / PROGRESS.md, which describe the v1 static-JSON build

---

## The one-paragraph version

There is already a working Next.js 16 app in `web/` — card explorer, lineup
optimizer, draft assistant, tournament meta browser, Card Lab. It is frozen,
because it reads static JSON that a local Python pipeline regenerates, and that
pipeline has been unrunnable since early July (three input directories moved).
Alongside it there are three standalone HTML tools and an xlsx tracker that L.J.
actually uses daily. V3 unifies all of it behind a Postgres database that the
app writes to directly from CSV uploads, so the thing stops depending on a
laptop-only Python step and starts being a website.

**The unlock:** `LJ Cards and Card Shop/pt_card_list.csv` already carries Card
ID, tier, position, era, all ratings, ownership counts, and four price columns
for all 3,708 cards in the game. One upload of that file is the entire card
universe plus the market plus base ownership. The old pipeline never used it as
the spine — it fingerprint-matched a collection export against a stale ratings
CSV and lived with an 80.8% hit rate. That whole layer can go.

---

## What exists today

| Thing | State | Fate in v3 |
|---|---|---|
| `web/` — Next 16, React 19, Tailwind 4, TanStack Table | Runs, data frozen at 2026-07-06 | **Keep and extend.** Do not rewrite. |
| `engine/` — Python projection engine, 41 files | `python -m engine build` broken; input dirs gone | **Keep as an offline refit tool.** Stops being on the critical path. |
| `PTCS6 Tracker.xlsx` + `PTCS6 Dashboard.html` | In daily use | **Replace** with the Tracker surface. Import the history. |
| `PT Card Lab.html` | Standalone projector, 96 era contexts | Already ported to `/lab`. Retire the HTML. |
| `PT Strategy Presets by Environment.html` | Standalone, 108 tournaments | **Fold into** the Roster Builder as the per-context strategy panel. |
| `data-store/`, `Tourney Standings/`, `Roster Templates/` | Raw CSV drops | Become uploads. |

### The engine is worth keeping

It is not scaffolding — it is a fitted model. `rate = env_rate × e^α × (rating/50)^β`,
verified to ±0.002 OPS and ±0.00 FIP across 401 cards, with per-component
coefficients in `engine/config/curves.json` and a calibration layer that blends
projections toward observed league performance. `web/src/lib/project.ts` is
already a TypeScript port of it and self-checks parity against the engine's own
output. V3 keeps that arrangement: Python refits the curves occasionally from
league exports, TypeScript evaluates them on every request.

**Blocker to hand back to L.J.:** the league-season CSVs (`pel_*.csv`,
`hd45*.csv`) that the calibration fits against are not on disk anywhere. Until
he re-exports them, the curves cannot be refit — but they also do not need to
be, since the fitted coefficients are committed.

---

## Architecture

```
Next.js 16 (App Router)          →  Vercel, one region
  ├── Server Components read Postgres directly
  ├── Route handlers accept CSV uploads and write to Postgres
  └── Signed-cookie auth in middleware — one password, whole app private

Postgres (Neon or Supabase free tier)
  ├── cards              the universe, keyed by OOTP Card ID
  ├── card_snapshots     append-only price + ownership per upload → history
  ├── collection_cards   variant ownership + active roster (fingerprint-matched)
  ├── contexts           108 tournament rule-sets: caps, era, DH, variant cap
  ├── periods / results  PTCS tracking, deduped on event id
  ├── standings          official cutoff lines
  └── rosters            saved builds per tournament

engine/ (Python, offline, optional)
  └── refits curves from league exports → engine/config/curves.json → committed
```

**Why a database and not more static JSON.** Three of the four v1 surfaces need
history, and JSON files cannot give it: price trends need repeated snapshots,
the tracker needs an append-only result log deduped across overlapping uploads,
and cutoff projection needs standings from successive periods. Snapshotting on
every upload gets all three for free and costs one table.

---

## The four v1 surfaces

### 1. Cards + variant coverage

The collection explorer. What is owned, by tier and position, and — the part
that has no answer today — **which variants are owned versus which merely exist
on the market**.

The ownership model is genuinely two-sourced and this trips everyone up:

- `pt_card_list.csv` → `owned` = copies of the **base** card. It cannot tell you
  whether the boosted variant is owned.
- The collection export → `VAR = Y` = the **variant** is owned. No Card ID, so
  it has to be matched.
- `Last 10 Price(VAR)` > 0 → a variant is **listed on the market**. Says nothing
  about ownership. 2,052 cards have a live variant listing; L.J. owns 39.

So the variant grid is: for each tier × position, cards owned, variants owned,
variants available to buy, and what the cheapest upgrade costs. That last column
is the one that turns the page from a report into a decision.

Current baseline from his data (3,708 cards, 3,015 owned, 3,069 copies):

| Tier | Cards | Owned | % |
|---|---|---|---|
| Iron | 1,205 | 1,060 | 88.0 |
| Bronze | 903 | 836 | 92.6 |
| Silver | 661 | 582 | 88.0 |
| Gold | 455 | 331 | 72.7 |
| Diamond | 310 | 174 | 56.1 |
| Perfect | 174 | 32 | 18.4 |

The collection is close to saturated below Gold. Check ownership before ever
recommending an acquisition — the interesting question at this point is almost
always *variants and Perfects*, not base cards.

### 2. Roster builder per tournament

Pick a context, get a legal roster from owned cards, optimised for that
context's run environment.

Legality is not decoration — every one of these is enforced by the game:
value ceiling/floor, team cap, **variant cap** (max boosted variants; 0 bans
them outright — 20 active contexts set one, 5 ban), DH on/off, era min/max, and
card-eligibility flags (live / unsung / snapshot / nel / fl / legend / hh /
allstar / rookie). The v1 app never enforced variant cap; v3 must.

Optimisation reuses `web/src/lib/optimizer.ts` and the era-as-pseudo-park trick
already in `lib/contexts.ts`: an era is expressed as component multipliers
against the modern window and composed onto the physical park, so the existing
park machinery applies it for free.

Absorbs Strategy Presets: each context shows its recommended strategy preset
(bunt/steal aggression by run environment), with the park factor applied to era
rates **before** the run-expectancy call — the AVG factor outweighs the HR
factor about 3:1, which is why homer-suppressing parks usually argue against
bunting rather than for it.

### 3. PTCS tracker

Replaces the xlsx and the HTML dashboard. Paste or upload results, get them
scored, see category standings and pace.

The scoring rules are already implemented and tested in `src/lib/scoring.ts`.
The mechanics that matter:

- **Points are by field size, not tier.** A win in a 64 is 25; in a 128 it is 30.
- **A field size changes for a given tournament name over the PT year** — OOTP
  shrinks events as the season goes on. Always read the size off the row.
- **Multi-category events award full points to each category.** `Silver,Cap` at
  2nd in a 64 is +15 Silver *and* +15 Cap. This is the single most important
  mechanic in the game.
- **`TW` is not a standing** in PT 27. `Dia,TW` scores Diamond only.
- **Results resolve late** — a day's events keep landing for a day or two, so
  overlapping uploads are normal. Dedupe on the event id in parentheses, never
  on the name: ids increment by one per day per event.
- **"Eliminated" with no placement scores nothing** — log 0 and note it.

Targets: estimated as the previous period's cutoff scaled by length until the
official standings land, then read straight off the real file. The 128th-place
line accumulates close to linearly, so `current × (totalDays / elapsedDays)` has
been the most accurate projection all season — show it as a band.

> **Open question — narrowed, not yet closed.** With the standings loaded, the
> derivation of the PTCS 6 targets is now fully recovered, and it is **rank 128**
> all the way down. Each target is the rank-128 line from the Jul 28 export,
> projected to the period end (× totalDays/elapsedDays), then scaled × 5/4 for
> PTCS 6's five weeks. It reproduces every published target exactly:
> Diamond 81→101, Gold 91→114, Silver 103→129, Open 103→129, Live 141→176,
> Cap 143→179, PD Daily 267→334, PD Weekly 77→96.
>
> So the whole tracker rests on an **assumption that a category grants 128
> berths**, which nobody has confirmed. It cannot be settled from the files on
> disk, because the only standings we have are mid-period (gotcha 8) and L.J.'s
> ranks in them predate his final week. What can be said: he was rank 103 in Cap
> and rank 87 in Live at capture and qualified in both; he was rank 286 in Silver
> and missed. That brackets the line loosely between roughly rank 100 and 200 —
> consistent with 128, and consistent with several other values.
>
> **What would settle it:** one standings export pulled *after* a period closes.
> Ask L.J. to grab the PTCS 6 files after Sep 6 and upload them with `capturedOn`
> set to the pull date. If the berth count turns out to be lower than 128, every
> target in the tracker is too low and the qualifying picture is harder than it
> currently reads.

### 4. Market / buy-sell

Prices from every snapshot, so this is where the database pays for itself.

- `Buy Order High` = highest bid = what you **receive** selling instantly.
- `Sell Order Low` = lowest ask = what you **pay** buying instantly.
- `Last 10 Price` = fair market value.
- `Last 10 Price(VAR)` = **variant** acquisition cost, typically 5-15× base and
  often 0 when none is listed. Pricing a variant at its base price is wrong.

Screens: price history per card, biggest movers between snapshots, sell
candidates, and cheapest path to filling a positional gap. Sell logic must be
production-guarded — rank by WAR rate and vL/vR splits, never by roster usage %.

---

## Data gotchas — do not rediscover these

1. **`pt_card_list.csv` rows carry 123 fields against a 122-field header.**
   One trailing empty column. Read naively, everything right of `era` shifts and
   `tier`, `owned`, and all four price columns land in the wrong place — with
   values that look plausible. The parser drops the extra field and asserts that
   tier codes partition `Card Value` into 40-59 / 60-69 / 70-79 / 80-89 / 90-99 /
   100-101. The upload endpoint **refuses to write** if that check fails.

2. **`tier` is a 0-5 code**, not the mission-value number. 0=Iron … 5=Perfect.
   `MissionValue` holds 1/2/5/10/15/50/75/200 — different column, different
   meaning.

3. **Contact/BA does not match between exports.** The collection's `BA vL/vR`
   differs from the shop's `Contact vL/vR` by roughly 6 points, while every other
   rating matches exactly. The fingerprint matcher excludes it. With it excluded,
   base cards match at distance **exactly 0** and variants at **5.75-9.25** — no
   overlap, so distance alone identifies variants. Verified 451/451.

4. **OOTP's 184-column stats export reuses column names.** `CON vL` appears
   twice: first is hitter contact, second (`CON vL_1`) is pitcher control.
   Reading the wrong one silently produced FIP errors of +11.7. The CSV reader
   de-duplicates headers pandas-style for exactly this reason.

5. **`json.dumps` writes literal `NaN`, which browsers reject.** This silently
   broke every data page in the v1 build until it was diagnosed. Any Python that
   emits JSON for the app must scrub NaN.

6. **Live cards' ratings drift weekly**, so any fingerprint match against them
   must be tolerance-based, not equality.

7. **`limit` semantics are unconfirmed** — mostly 0, occasionally 40-120.
   Ask L.J. before building anything on it.

8. **A standings export is a snapshot as of the day it was downloaded, NOT the
   final result for the period in its filename.** The eight PTCS 5 files are all
   named `period_5_(weeks_18-21)_-_jul_06th_till_aug_02nd`, but the data in them
   is from **Jul 28** — five days before the period closed. Verified beyond
   doubt: every one of the eight matches, exactly, the points *and* rank L.J.
   recorded in the "Official / Rank" columns of `PTCS5 Tracker.xlsx` (Diamond
   244/11, PD Daily 356/28, Gold 119/64, Live 134/87, Cap 127/103, Silver 30/286,
   Open 7/493, PD Weekly 6/735), and the file mtimes are Jul 28.

   This matters twice over. Cutoffs read off a mid-period file **understate** the
   final line, so "read the target straight off the real file" is wrong unless
   the file post-dates the period end. And the linear projection needs elapsed
   days counted from the capture date, not from the filename's start date. The
   `standings` table therefore carries `captured_on`, the upload route accepts it
   as a form field, and the upload page shows a date control on standings files
   defaulting to today — correct for a fresh pull, and overridable precisely
   because a backfill is not one.

---

## Phases

**Phase 0 — foundation. COMPLETE except the hosted database, which is L.J.'s to
create.** Verified end to end on 2026-08-17 against a local Postgres 14: schema
pushed from scratch, all ten real exports uploaded through the actual HTTP
route, PTCS 6 history imported, `pnpm build` green on all 13 routes.

- `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`
- `src/lib/ingest/` — csv, constants, pt-card-list, collection, standings
- `src/lib/scoring.ts`
- `src/app/api/upload/route.ts`, `src/app/api/login/route.ts`, `src/proxy.ts`
- `scripts/verify-ingest.ts` — **36/36 checks passing against the real exports**
- `src/app/upload/page.tsx` — drag-and-drop, dry-run preview, forced commit order
- `scripts/import-ptcs6.ts` + `src/db/seed/ptcs6-history.json`

What changed while closing it out:

- **`client.ts` picks its driver from the URL.** Neon's serverless driver speaks
  Neon's own HTTP protocol and cannot talk to an ordinary Postgres, which made
  the whole data layer untestable without deploying. It now uses neon-http for
  `*.neon.tech` and node-postgres otherwise, so the app runs locally. Same
  Drizzle API either way; `db` is typed as the node-postgres flavour because a
  union of the two collapses overloads like `.returning()`.
- **`middleware.ts` → `src/proxy.ts`.** Next 16 renamed the convention. The docs
  also state plainly that this layer is an *optimistic* check and not an
  authorisation boundary, so `/api/upload` — the only endpoint that writes — now
  verifies the session itself as well.
- **`/login` no longer breaks the build** (`useSearchParams` needs a Suspense
  boundary) and covers the app shell instead of rendering the nav to a
  signed-out visitor.
- **The PTCS 6 history went into a new `daily_totals` table, not `results`.**
  The spreadsheet holds day × category totals and free-text notes — there are no
  per-event rows and, critically, no event ids. Since the event id *is* the
  dedupe key, writing that into `results` would have meant inventing ids and
  quietly breaking overlap detection. `results` stays the per-event ledger for
  anything entered through the app. A day must be represented by one or the
  other, never both; the tracker sums across both and would otherwise double
  count.

Remaining phase-0 work — **all of it needs the hosted database first:**
1. ~~deps and scripts~~ — done, plus `pg`, `import:ptcs6`.
2. **L.J.:** create the Neon project, put `DATABASE_URL` / `AUTH_SECRET` /
   `APP_PASSWORD` in `web/.env.local`, run `pnpm db:push`. Account creation is
   the one step that cannot be automated.
3. ~~Upload page~~ — done.
4. Backfill — the sequence is verified and scripted; re-run it against Neon once
   the URL is in place. Set the standings `capturedOn` to **2026-07-28**, not
   today (see gotcha 8).
5. ~~PTCS 6 history~~ — done, `pnpm import:ptcs6`, idempotent.

**Phase 1 — Cards + variant coverage.** Rewire the existing card explorer from
`projections.json` to Postgres; add the tier × position variant grid. This is
also the proof that the data layer works end to end.

**Phase 2 — Tracker.** Highest daily value, and it retires an xlsx. Paste box →
scored preview with warnings → commit. Category standings, pace, projected
cutoffs, the championship ladder.

**Phase 3 — Roster builder.** Contexts table populated from
`data-src/OOTP26 Historic Tourney_Draft List.xlsx` via the existing
`engine/config_build.py`. Legality enforcement including variant cap, then the
optimizer, then the strategy preset panel.

**Phase 4 — Market.** Needs two or more snapshots to be interesting, so it wants
a couple of weeks of uploads behind it. Build it last, but start uploading
weekly from day one so the history exists when you get there.

**Later.** Draft assistant is already built at `/draft` and works; it is blocked
only on real pack schedules per DraftType. Projections/engine reintegration once
the league exports come back.

---

## Runbook

**Standing up the database (the one manual step).**

1. Create a project at https://neon.tech and copy the *pooled* connection string.
2. `cp web/.env.example web/.env.local` and fill in:
   - `DATABASE_URL` — the Neon string
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - `APP_PASSWORD` — whatever you will remember
3. `cd web && pnpm install && pnpm db:push`
4. `pnpm dev`, log in, go to `/upload`, and drop in this order:
   `pt_card_list.csv` → `mycardset.csv` → the eight files in `Tourney Standings/`.
   **Set the standings date control to 2026-07-28** — those exports are from Jul
   28, not today. The page forces the commit order regardless of drop order.
5. `pnpm import:ptcs6` — writes the 14 days of Aug 3-16 history and prints the
   pace table. Safe to re-run.

Expected after a clean backfill: 3,708 cards · 3,708 snapshots · 451 collection
rows at a 100% match rate with 39 variants · 7,977 standings rows · 140 daily
totals · 10 uploads.

**Developing without Neon.** Any local Postgres works — the client picks its
driver from the URL:

```
initdb -D /tmp/ootp-pg -U ootp --auth=trust
pg_ctl -D /tmp/ootp-pg -o "-p 55432 -h 127.0.0.1" start
createdb -h 127.0.0.1 -p 55432 -U ootp ootp
# DATABASE_URL="postgresql://ootp@127.0.0.1:55432/ootp"
```

**After touching anything in `src/lib/ingest/`:** `pnpm verify:ingest` (36 checks).

## Conventions

- **Ownership questions need both sources.** Base ownership from the shop
  snapshot, variant ownership from the collection. Neither alone is the answer.
- **Rank by production, not usage.** WAR rate and vL/vR splits. Roster share is
  a popularity contest, not evidence.
- **Reliability floors: 500 PA / 400 IP.** Sixty innings means nothing.
- **Points are violently convex.** A win in a 64 is 25; 17th-32nd is 1. When a
  category stalls, the diagnosis is nearly always finishes, not entries.
- **Never silently truncate.** If a screen caps at top-N or drops rows, say so on
  the screen.
- Run `pnpm verify:ingest` after touching anything in `src/lib/ingest/`.
