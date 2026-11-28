# Tourney refresh, December 2026 (Claude, prepared 2026-11-28)

**Source:** the OOTP forum post "Tournament Refresh Work in Progress" by Nicolino Di Benedetto (PT Director of Product Management), dated 11-25.
- **First wave:** Daily Iron, Bronze, Silver and Gold, "aiming for some time next week". No date is given.
- **Later waves:** Diamond, Open and Weekly next, then the Perfect Drafts.

The post is filed as `Tourney Data/refresh-2026-12.json`: 40 slots, keyed by slot. Every entry is marked `deferred`, so nothing reaches the catalogue until the formats are live.

## What changes for the events L.J. plays

- **Renamed: a new event on the same slot.**
  - Bronze PTCS 3 Replay Slots → **Low Bronze Cap** (1355 cap, Default RE, Camden Yards).
  - Bronze Only Cap → **Bronze Cap** (1280 cap, 1999 RE, Variant Cap 10, Cinergy Field). The 60 floor goes.
  - Silver & Friends Slots → **Silver Analytics Era to Live-Plus** (2015–26 cards, 2019 RE, Tropicana Field).
  - Silver Only Cap → **Silver Cap** (Bo7, 1470 cap, 1983 RE, Variant Cap 9, Jack Murphy Stadium). The 70 floor goes.
  - Early Years Cap → **Keeping it 100 Cap** (cards up to 100, 1818 cap, Default RE, DH, American Family Field).
  - PTCS 2 Iron Replay → **Iron Up to 1969** (1968 RE, no DH, Variant Cap 8, KC Municipal).
  - Iron Strikes Back → **Iron 1970-Present** (2019 RE, DH, Coors Field).
  - Bronze Only Curiosities → **Bronze Up to 1945 (PTCS 8 Replay)** (1919 RE, no DH, South Side Park).
  - Bronze 1910-59 → **Bronze 1946-2025** (1984 RE, Busch Stadium).
  - Bronze OOTP Era → **Bronze Heart** (1930–89 cards, 1966 RE, no DH, Memorial Stadium).
  - Quick 108 → Diamond Analytics Era to Live-Plus Quick.
  - New slot 200 → Deadball Quick Slots.
- **Same event, new environment:**
  - **Iron:** Iron Lunch, Late Iron, Dank, Iron Cap, Live Iron, Iron Dreamland, Iron & Friends.
  - **Bronze:** Early Bronze (LE off), Late Bronze, Live Bronze, Low Bronze Only.
  - **Silver:** Early Silver (LE off), Late Silver, Live Silver, Silver Slots (now 1961–2014 cards), Silver Snapshots (2000 RE, Turner Field), Roaring Silvers, Low Silver Only.
  - **Gold:** Low Gold Only, Goldfather II, Gold Cap, Live Gold, Gold Slots (15 G / 6 S / 5 B, 2015–26 cards), Golden Age, Golden Heart, Low Gold Cap, Gold Standard.
  - **Open:** Time Travelers Slots.

**Every saved roster for these 40 events is built for the old format.** They all need a rebuild on go-live day.

## Go-live day

1. **The day:** L.J. tells Claude the Chicago day the new formats first ran, or Claude reads it off the first new title in Your Tournaments or the dump.
2. **Write the catalogue** from `web/`:

       node --import tsx scripts/refresh-apply.ts --file "../Tourney Data/refresh-2026-12.json" --live YYYY-MM-DD --commit

   - Each row keeps its id and series.
   - Renamed slots start from a clean slate: no old card sets, slots, caps or floors.
   - The old rules go under `restrictions.previousFormat`.
   - `formatSince` is set to the go-live day.
3. **Rebuild:** `current-rosters --only <ids> --all --out ../Inbox/rosters --jobs 6`, then save on L.J.'s yes. The ids are in the dry run's first column.
4. **Nothing to do on the Mac.** The filer's first import of each series files every pre-go-live run under `<slug>-preYYYYMMDD`. Until then, /build already sets those exports aside.
5. **Later waves:** Diamond, Open, Weekly and Perfect Drafts go in as new sections of a refresh json when their post appears. Use the same script.

**Before go-live,** `refresh-apply.ts --patch-out <file>` writes the new rules for `current-rosters --patch`. That pre-builds rosters for the new formats without touching the catalogue.
- Tested on Silver Snapshots (11-28): the current roster scores 166.1 under the new rules, and the rebuild scores 188.6.

## What was prepared (11-28)

- **`web/scripts/refresh-apply.ts` (`pnpm refresh:apply`):**
  - Dry by default. `--patch-out` writes a pre-build patch. `--live D --commit` writes the catalogue. `--only` limits it to some slots.
  - The dry run of all 40 lists every change. Every park resolves: the post's "Heinsohn Park" is "Heinsohn Ballpark" in the parks table.
- **Parser** (`lib/ingest/restrictions.ts`, tested) now reads:
  - "Cards up to 100 overall" (a value ceiling);
  - "Max Rebirth Era (1945) cards" (a year ceiling);
  - parks named "… Bowl" (Baker Bowl);
  - "LE off" (no Limited Edition cards).
- **Hand entries in the json, each with a `why`:**
  - card years from three names: 1970-Present, 1946-2025, Up to 1969;
  - Deadball Quick's "Deadball cards only" read as cards to 1919, because Deadball isn't a card set.
- **Smaller changes:**
  - `catalogue-edit` takes `envYear: null` for "Default RE".
  - `current-rosters --patch` takes a `name` for a renamed event.
- **Not changed on purpose:**
  - `slot-map.json`: series slugs stay. The format date does the split, as it did for 5L.
  - `import:refresh`: it would seed new rows for renamed slots.
