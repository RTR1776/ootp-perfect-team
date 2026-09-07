# Tourney data coverage — 2026-09-07

## The short version

**Volume is not the problem; freshness and the refresh are.** 298 exports sit under running, non-draft events (278 under rules still in force), 10.1M plate appearances in the database. But 72 of 114 running events have no export at all, and the depth is concentrated in ten daily events — mostly Diamond and Gold, which are about to be refreshed.

**Where we are good (≥5 current runs, newest ≤14 days):** Diamond Heart (22), Diamond Slots (28), Gold Slots (18), Early Gold (15), Golden Heart (15), Low Gold Retrospecticus (13), Late Silver (16 — its rules were restated, not changed, in the Sep 1 refresh), Silver Slots (6, newest Sep 5), Diamond Quick (7). These are also the events you enter most (Diamond Heart 73 entries, Diamond Slots 54, Late Silver 33, Gold Slots 30).

**Where we are deep but stale:** Diamonds are Forever (31 runs, newest Aug 23), Low Diamond (20, Aug 21), Daily Diamond (18, Jul 11), Diamond & Friends Slots (7, Jul 12), Goldfather II (8, Jul 22). Each still has 7 grabbable runs today. Whether they are worth grabbing depends entirely on the Gold/Diamond refresh: a run exported today under the old rules is donor-grade the moment the event is renamed or moved, and full-value if the event is merely restated. **Recommendation: wait for the refresh post before spending screen time on Diamond/Gold dailies, then grab the first week of every changed event hard** — the 7-day window means the first runs under new rules are gone by the following week, and those are the runs that will decide the championship-style builds for the rest of the year.

**Where we are lacking and it matters (your chase categories):**

- **Silver, post-refresh.** Four events lost their history on Sep 1 and have 0–1 runs under the new rules: Roaring Silvers (0; the 8 Silver Heart runs are the same 1927 Yankee Stadium environment, but the card pool is now "up to 1929" only), Silver Snapshots (0; 8 Slamboree runs at the same 1986 Three Rivers environment, but Snapshots-only cards now), Silver Only Cap (0), Early Silver (0, moved to Marlins Park), Silver & Friends Slots (1 — the Sep 3 run that was filed under the old Deadball name; its HR/PA of 2.85% vs 0.45% for the deadball runs proves it ran under the new default era, so it was moved to `silverfriendsslots_100`), Low Silver Only (1). **This is the highest-value pull available right now: 6–7 runs of each are inside the window today and it closes one run per day.**
- **Cap.** You qualified in Cap with 220 points and it is the emptiest category on disk: Thursday CWhit's Cap Challenge 1 run (the +15 on Sep 3 came from it), Monday Gold Floor Cap 1 run from July, Daily Bronze Only Cap 2, and zero for Silver Only Cap, Gold Cap, Diamond Cap, Iron Cap, Open Low Cap, Friday Nightmare Cap, Saturday Bronze Cap, Mishmash Cap. Cap events are also the ones where the fill has to trade quality for value, which is exactly where observed results beat ratings. Second priority.
- **Gold weeklies.** Thursday Night Gold Rush, Sunday High Iron Floor / Gold Ceiling (the +10 G / +10 C on Sep 6), Tuesday Sporer's Sandlot and Monday Wonky Historical Slots have 1–3 runs each and only the last two weeks are grabbable. One export a week keeps them; missing a week loses it for good.
- **Bronze** is thin everywhere (2–3 runs post-refresh on five events, nothing on the rest), but it is not a chase category, so it is a "grab when convenient" tier.

**Iron, Live and Open** are almost empty and you skip them; nothing to do there beyond the Open events that feed Cap (Open Slots 2 runs, Sunday Open Slots 2).

## Using old data when the environment is similar

The "Best donors" column ranks every other series on disk by how close its era+park lands to the event's own run environment (the /environments offense-shape distance: R/G, K, HR, 1B, 2B per PA, in standard deviations), gated on the card-value windows overlapping by at least half. It confirms the idea works in a specific way: **environment transfers, card pool does not.** Roaring Silvers and Silver Snapshots have perfect environmental donors (distance 0) in their pre-refresh selves, and those donors are still only half-useful because the eligible cards changed. Conversely Sporer's Golden Childhood (1984 Tiger Stadium, 4 runs) can lean on Golden Heart (1977 Olympic, 15 runs, distance 0.74, full window overlap) and Late Silver (0.56, 80% overlap); Saturday Diamond Variety (2 runs) on Diamond Slots (28 runs, 0.57, same window); Thursday CWhit's Cap Challenge on Wednesday 1950 to Now (0.33). Events at the PT default environment (2010, Standard Stadium) all pool together at distance 0, which is why the projection fit is restricted to that environment today.

What the app does not yet do is USE a donor: /build and the projection read only the event's own series. The next modelling step (Stage 3 in the plan) is to score a card against a pooled, distance-weighted sample of its own event plus donors within ~0.75 SD and matching window — this report's donor lists are the seed for that, and the `.coverage.json` beside it carries the full ranking.

## What "ready" looks like for the importer

Since today the chain is hands-off: export from OOTP → the watcher catches the file → one dialog with the likely series pre-selected (fingerprinted on field size, card window, tier mix AND era rates, so a renamed event no longer matches its old self) → filed under its exact run id → imported into the database within a second or two → projection refit when you quit. Anything already sitting in Inbox/Tourney Stats is picked up on the next start. Five series that had files on disk but had never been imported (`bronzeptcs3`, `hittersfirst`, `lowsilveronly`, `silverandfriends`, `silverslotsdaily`) are in now.

Regenerate this report any time with `pnpm coverage` from `web/` (it re-reads the archive and the database).

Running, non-draft events only (115). "Current" = files under the rules in force now. The Silver (Sep 1) and Bronze/Iron (Aug 26) refreshes only invalidate the history of events they RENAMED or MOVED to a new park; an event whose rules were merely restated (Late Silver, Silver Slots) keeps its files. Gold/Diamond/Open/Live/Cap have not been refreshed, so all of their files count — until their refresh lands, when the same rule will apply to them. OOTP serves only the last 7 days of runs, so "grab" ids are what can still be exported today. Donors = other series on disk whose era+park land within 1.25 SD of this event's offense shape AND whose card window overlaps at least half of this one's.

**Status:** stale 6 · good 9 · thin 24 · none 72 · pre-refresh-only 4

## Diamond (14) — stale 5, good 3, thin 2, none 4

| Event | Env | Cap / rules | Field | Entries | Current runs | Pre-refresh | Card rows / PA | Newest | Grab now | Status | Refresh | Best donors (dist) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Daily Diamonds are Forever | 1987 · 1985 Wrigley Field · DH | 40-99 | 64 | 51 | 31 |  | 609 / 620,001 | 2026-08-23 (15d) | 7 | **stale** | not yet | Daily Low Gold Retrospectus ×13 (0.57); Daily Diamond Heart ×22 (0.75); Daily Sporer's Golden Childhood ×4 (0.85) |
| Daily Diamond Slots | 1975 · 1977 Atlanta Fulton County Stadium · DH | 40-99 | 64 | 54 | 28 |  | 1386 / 561,314 | 2026-08-27 (11d) | 7 | **good** | not yet | Saturday Diamond Variety ×2 (0.57); Daily Sporer's Golden Childhood ×4 (0.88); Daily Low Gold Retrospectus ×13 (0.93) |
| Daily Diamond Heart | 1958 · 1955 Fenway Park · no DH | 40-99 | 128 | 73 | 22 |  | 515 / 1,180,265 | 2026-08-28 (10d) | 7 | **good** | not yet | Daily Diamonds are Forever ×31 (0.75); Daily Sporer's Golden Childhood ×4 (1.13); Daily Late Silver ×16 (1.18) |
| Daily Low Diamond | 2010 · ? | 40-94 | 128 | 59 | 20 |  | 623 / 674,705 | 2026-08-21 (17d) | 7 | **stale** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Diamond Quick ×7 (0) |
| Daily Diamond | 2010 · 2025 Standard Stadium · DH | 40-99 | 64 | 43 | 18 |  | 503 / 483,767 | 2026-07-11 (58d) | 7 | **stale** | not yet | Daily Diamond & Friends Slots ×7 (0); Diamond Quick ×7 (0); Daily Goldfather II ×8 (0) |
| Daily Live Diamond | 2010 · 2026 Yankee Stadium · DH | 40-99 | 64 | 27 | 12 |  | 194 / 233,743 | 2026-06-30 (69d) | 7 | **stale** | not yet | Daily Live Silver ×1 (0); Sunday Open Main Event ×2 (0.46); Daily Diamond & Friends Slots ×7 (0.59) |
| Daily Diamond & Friends Slots | 2010 · 2023 Heinsohn Ballpark · no DH |  | 64 | 45 | 7 |  | 715 / 190,545 | 2026-07-12 (57d) | 7 | **stale** | not yet | Daily Diamond ×18 (0); Diamond Quick ×7 (0); Daily Goldfather II ×8 (0) |
| Diamond Quick | 2010 · 2025 Standard Stadium · DH | 40-99 | 16 |  | 7 |  | 296 / 31,689 |  |  | **good** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Daily Goldfather II ×8 (0) |
| Wednesday Ice to See You | 2010 · 2026 NBT Bank Stadium · DH | 40-99 | 128 | 17 | 3 |  | 663 / 331,317 | 2026-08-26 (12d) | 2 | **thin** | not yet | Wednesday 1950 to Now ×2 (0.52); Daily Diamond & Friends Slots ×7 (0.79); Daily Diamond ×18 (0.79) |
| Saturday Diamond Variety | 1975 · 1981 Metropolitan Stadium · no DH | 40-99 | 128 | 7 | 2 |  | 344 / 113,458 | 2026-08-30 (8d) | 1 | **thin** | not yet | Daily Diamond Slots ×28 (0.57); Daily Sporer's Golden Childhood ×4 (1) |
| Daily Diamond Cap | 1998 · 1993 Joe Robbie Stadium · no DH | 40-99 | 32 | 1 | 0 |  |  |  |  | **none** | not yet | Daily Open Slots ×2 (0.99) |
| EF 4T Diamond | 2010 · ? | 40-99 |  |  | 0 |  |  |  |  | **none** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Diamond Quick ×7 (0) |
| EF H2H Diamond | 2010 · ? | 40-99 |  |  | 0 |  |  |  |  | **none** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Diamond Quick ×7 (0) |
| Low Diamond Quick | 2010 · ? | 40-94 |  |  | 0 |  |  |  |  | **none** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Diamond Quick ×7 (0) |

## Gold (17) — good 4, stale 1, thin 5, none 7

| Event | Env | Cap / rules | Field | Entries | Current runs | Pre-refresh | Card rows / PA | Newest | Grab now | Status | Refresh | Best donors (dist) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Daily Gold Slots | 2010 · 2025 Standard Stadium · DH | 40-89 | 64 | 30 | 18 |  | 1220 / 492,033 | 2026-08-30 (8d) | 7 | **good** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Diamond Quick ×7 (0) |
| Daily Early Gold | 1920 · 1946 Ruppert Stadium · no DH | 40-89 | 64 | 27 | 15 |  | 776 / 604,933 | 2026-08-28 (10d) | 7 | **good** | not yet |  |
| Daily Golden Heart | 1977 · 1977 Olympic Stadium · DH | 40-89 | 64 | 25 | 15 |  | 362 / 413,551 | 2026-08-28 (10d) | 7 | **good** | not yet | Daily Silver Slamboree ×8 (0.49); Daily Late Silver ×16 (0.56); Daily Sporer's Golden Childhood ×4 (0.74) |
| Daily Low Gold Retrospecticus | 1962 · 1961 LA Wrigley Field 1961 · no DH | 40-84 | 64 | 22 | 13 |  | 483 / 260,287 | 2026-08-30 (8d) | 7 | **good** | not yet | Daily Diamonds are Forever ×31 (0.57); Daily Diamond Slots ×28 (0.93); Daily Sporer's Golden Childhood ×4 (1) |
| Daily Goldfather II | 2010 · 2025 Standard Stadium · DH | 40-89 | 64 | 10 | 8 |  | 512 / 222,366 | 2026-07-22 (47d) | 7 | **stale** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Diamond Quick ×7 (0) |
| Daily Sporer's Golden Childhood | 1984 · 1958 Tiger Stadium · DH | 40-89 | 64 | 12 | 4 |  | 217 / 80,784 | 2026-08-28 (10d) | 7 | **thin** | not yet | Daily Late Silver ×16 (0.56); Daily Silver Slamboree ×8 (0.71); Daily Golden Heart ×15 (0.74) |
| Sunday High Iron Floor and Gold Ceiling | 2010 · 2025 Standard Stadium · DH | 50-89 | 128 | 4 | 3 |  | 1389 / 168,069 | 2026-08-30 (8d) | 1 | **thin** | not yet | Daily Diamond ×18 (0); Diamond Quick ×7 (0); Daily Goldfather II ×8 (0) |
| Tuesday Sporer's Sandlot | 1993 · 1928 Mack Park · DH | 60-89 | 128 | 7 | 1 |  | 745 / 56,414 | 2026-08-26 (12d) | 2 | **thin** | not yet |  |
| Monday Wonky Historical Slots | 1945 · 2025 Tropicana Field · DH | 40-89 | 128 | 5 | 1 |  | 336 / 55,873 | 2026-08-24 (14d) | 2 | **thin** | not yet | Daily Silver & Friends Deadball Slots ×3 (1.12) |
| Thursday Night Gold Rush | 1989 · 1979 Candlestick Park · DH | 40-89 | 128 | 3 | 1 |  | 491 / 109,061 | 2026-08-27 (11d) | 2 | **thin** | not yet |  |
| Daily Gold Cap | 2010 · 1955 Fenway Park · DH | 40-89 | 32 |  | 0 |  |  |  |  | **none** | not yet |  |
| Daily Live Gold | 2019 · 2026 Wrigley Field · DH | 40-89 | 128 |  | 0 |  |  |  |  | **none** | not yet | Wednesday Ice to See You ×3 (0.28); Wednesday 1950 to Now ×2 (0.49); Daily Diamond & Friends Slots ×7 (0.54) |
| EF 4T Gold | 2010 · 2025 Standard Stadium · DH | 40-89 | 4 |  | 0 |  |  |  |  | **none** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Diamond Quick ×7 (0) |
| EF H2H Gold | 2010 · 2025 Standard Stadium · DH | 40-89 | 2 |  | 0 |  |  |  |  | **none** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Diamond Quick ×7 (0) |
| Gold Quick | 2010 · 2025 Standard Stadium · DH | 40-89 | 16 |  | 0 |  |  |  |  | **none** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Diamond Quick ×7 (0) |
| low gold | ? · 1961 LA Wrigley Field 1961 | 40-84 |  |  | 0 |  |  |  |  | **none** | not yet |  |
| Low Gold Quick | 1999 · ? | 40-84 |  |  | 0 |  |  |  |  | **none** | not yet | Daily Open Slots ×2 (0.11); Laptophound's Daily 6L Power Play ×8 (1.06) |

## Silver (18) — good 2, thin 3, pre-refresh-only 4, none 9

| Event | Env | Cap / rules | Field | Entries | Current runs | Pre-refresh | Card rows / PA | Newest | Grab now | Status | Refresh | Best donors (dist) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Daily Late Silver | 1992 · 1992 Camden Yards · DH | 40-79 | 64 | 33 | 16 |  | 601 / 914,661 | 2026-08-31 (7d) | 7 | **good** | unchanged | Daily Silver Slamboree ×8 (0.23); Daily Sporer's Golden Childhood ×4 (0.56); Daily Golden Heart ×15 (0.56) |
| Daily Silver Slots | 1977 · 1978 Riverfront Stadium · no DH | 40-79 · slots B5 I5 S16 | 64 | 13 | 6 |  | 815 / 117,567 | 2026-09-05 (2d) | 6 | **good** | unchanged | Daily Silver Slamboree ×8 (0.77); Daily Late Silver ×16 (0.98); Daily Golden Heart ×15 (1.04) |
| Thursday Silver Spectacular | 2010 · 2025 Standard Stadium · DH | 40-79 | 256 | 4 | 1 |  | 584 / 110,783 | 2026-08-27 (11d) | 2 | **thin** | unchanged | Daily Diamond ×18 (0); Diamond Quick ×7 (0); Daily Goldfather II ×8 (0) |
| Daily Low Silver Only | ? · Heinsohn Park · DH | 70-74 | 64 |  | 1 |  | 210 / 27,400 |  |  | **thin** | unchanged |  |
| Daily Silver & Friends Slots | ? · 2026 Daikin Park · DH | slots B1 D1 G1 I1 P1 S21 | 64 |  | 1 |  | 423 / 27,143 |  |  | **thin** | renamed (files are post-refresh) |  |
| Daily Silver Heart | 1927 · 1927 Yankee Stadium · no DH | 40-79 | 64 | 15 | 0 | 8 | 320 / 219,875 | 2026-08-29 (9d) | 7 | **pre-refresh-only** | old name |  |
| Daily Silver Slamboree | 1987 · 1986 Three Rivers Stadium · DH | 40-79 | 64 | 14 | 0 | 8 | 747 / 441,436 | 2026-08-29 (9d) | 7 | **pre-refresh-only** | old name | Daily Late Silver ×16 (0.23); Daily Golden Heart ×15 (0.49); Daily Sporer's Golden Childhood ×4 (0.71) |
| Daily Silver & Friends Deadball Slots | 1919 · 2026 Daikin Park · DH | slots B1 D1 G1 I1 P1 S21 | 64 | 13 | 0 | 3 | 270 / 83,896 | 2026-08-29 (9d) | 7 | **pre-refresh-only** | old name | Wednesday Night of the Living Deadball ×1 (0.3); Monday Wonky Historical Slots ×1 (1.12) |
| Daily Live Silver | 2010 · 2026 Yankee Stadium · DH | 40-79 | 64 | 3 | 0 | 1 | 241 / 55,825 | 2026-07-31 (38d) | 7 | **pre-refresh-only** | moved | Daily Live Diamond ×12 (0); Daily Diamond ×18 (0.59); Diamond Quick ×7 (0.59) |
| Friday Nightmare Cap | 1955 · 1936 Hinchliffe Stadium · no DH | 50-74 | 128 | 3 | 0 |  |  |  | 1 | **none** | unchanged | Daily Low Gold Retrospectus ×13 (0.93); Daily Bronze 1910-59 ×3 (1.01) |
| Daily Early Silver | 2010 · 2017 Marlins Park · DH | 40-79 | 64 |  | 0 |  |  |  |  | **none** | moved | Daily Live Diamond ×12 (1.04); Daily Live Silver ×1 (1.04); Daily Diamond ×18 (1.22) |
| Daily Roaring Silvers | 1927 · 1927 Yankee Stadium · no DH | 40-79 | 64 |  | 0 |  |  |  |  | **none** | renamed (files are post-refresh) | Daily Silver Heart ×8 (0) |
| Daily Silver Cap | 1998 · Heinsohn Park · DH | 40-79 · cap 1888 | 32 |  | 0 |  |  |  |  | **none** | unchanged | Daily Bronze OOTP Era ×3 (1.01); Laptophound's Daily 6L Power Play ×8 (1.23) |
| Daily Silver Only Cap | 1998 · Heinsohn Park · DH | 70-79 · cap 1888 | 64 |  | 0 |  |  |  |  | **none** | renamed (files are post-refresh) |  |
| Daily Silver Snapshots | 1987 · 1986 Three Rivers Stadium · DH | 40-79 | 128 |  | 0 |  |  |  |  | **none** | renamed (files are post-refresh) | Daily Silver Slamboree ×8 (0); Daily Late Silver ×16 (0.23); Daily Silver Slots ×6 (0.77) |
| EF 4T Silver | 2010 · ? | 40-79 |  |  | 0 |  |  |  |  | **none** | unchanged | Daily Diamond & Friends Slots ×7 (0); Daily Low Diamond ×20 (0); Sunday Open Slots ×2 (0) |
| EF H2H Silver | 2010 · ? | 40-79 |  |  | 0 |  |  |  |  | **none** | unchanged | Daily Diamond & Friends Slots ×7 (0); Daily Low Diamond ×20 (0); Sunday Open Slots ×2 (0) |
| Silver Quick | 2010 · 2025 Standard Stadium · DH | 40-79 | 16 |  | 0 |  |  |  |  | **none** | unchanged | Daily Diamond ×18 (0); Diamond Quick ×7 (0); Daily Goldfather II ×8 (0) |

## Bronze (17) — thin 5, none 12

| Event | Env | Cap / rules | Field | Entries | Current runs | Pre-refresh | Card rows / PA | Newest | Grab now | Status | Refresh | Best donors (dist) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Daily Bronze 1910-59 | 1959 · 1959 Seals Stadium · DH | 40-69 | 64 | 3 | 3 |  | 221 / 82,582 | 2026-08-27 (11d) | 7 | **thin** | renamed (files are post-refresh) |  |
| Daily Bronze OOTP Era | 2009 · Heinsohn Park · DH | 40-69 | 128 | 3 | 3 |  | 385 / 166,881 | 2026-09-07 (0d) | 6 | **thin** | renamed (files are post-refresh) | Laptophound's Daily 6L Power Play ×8 (0.64); Daily Silver Slots ×6 (1.25) |
| Daily Bronze Only Cap | 2019 · 2026 American Family Field · DH | 60-69 · cap 1689 | 64 | 2 | 2 |  | 453 / 54,531 | 2026-08-28 (10d) | 7 | **thin** | renamed (files are post-refresh) |  |
| Daily Bronze PTCS 3 Replay Slots | 1999 · 2000 Coors Field · DH | 40-69 · slots B18 I8 | 64 | 1 | 2 |  | 592 / 56,433 |  |  | **thin** | renamed (files are post-refresh) |  |
| Monday Up And At Them Bronze | 1995 · 2026 Rio Grande Credit Union Field at Isotopes Park · DH | 40-69 | 256 | 2 | 1 |  | 446 / 118,218 | 2026-08-24 (14d) | 2 | **thin** | unchanged |  |
| Daily Low Bronze | ? · ? |  | 64 | 6 | 0 |  |  |  | 7 | **none** | unchanged |  |
| Daily Return of the Bronze | ? · ? |  | 128 | 5 | 0 |  |  |  | 7 | **none** | unchanged |  |
| Bronze Quick | 2010 · 2025 Standard Stadium · DH | 40-69 | 16 |  | 0 |  |  |  |  | **none** | unchanged | Daily Goldfather II ×8 (0); Daily Gold Slots ×18 (0); Thursday Silver Spectacular ×1 (0) |
| Daily Bronze Only Curiosities | 2010 · 2005 Minute Maid Park · DH | 60-69 |  |  | 0 |  |  |  |  | **none** | renamed (files are post-refresh) | Daily Bronze Only Cap ×2 (0.6) |
| Daily Early Bronze | 1942 · 1945 Wrigley Field · no DH | 40-69 |  |  | 0 |  |  |  |  | **none** | unchanged | Daily Silver & Friends Deadball Slots ×3 (1); Wednesday Night of the Living Deadball ×1 (1.18) |
| Daily Late Bronze | 2010 · 2003 Dodger Stadium · DH | 40-69 | 64 |  | 0 |  |  |  |  | **none** | unchanged | Daily Live Silver ×1 (0.81) |
| Daily Live Bronze | 2010 · 2026 Kauffman Stadium · DH | 40-69 | 64 |  | 0 |  |  |  |  | **none** | moved | Daily Goldfather II ×8 (0.89); Daily Gold Slots ×18 (0.89); Thursday Silver Spectacular ×1 (0.89) |
| Daily Low Bronze Only | 1955 · 1955 Ebbets Field · no DH | 60-64 | 64 |  | 0 |  |  |  |  | **none** | renamed (files are post-refresh) |  |
| EF 4T Bronze | 2010 · ? | 40-69 |  |  | 0 |  |  |  |  | **none** | unchanged | Daily Diamond & Friends Slots ×7 (0); Daily Low Diamond ×20 (0); Sunday Open Slots ×2 (0) |
| EF H2H Bronze | 2010 · 2025 Standard Stadium · DH | 40-69 | 2 |  | 0 |  |  |  |  | **none** | unchanged | Daily Goldfather II ×8 (0); Daily Gold Slots ×18 (0); Thursday Silver Spectacular ×1 (0) |
| PTCS 6 Championship - Bronze | 1968 · 1964 Shea Stadium · no DH | 40-69 |  |  | 0 |  |  |  |  | **none** | unchanged | Tuesday Up To 1969 ×1 (0.85) |
| Saturday Bronze Cap | 2010 · 2025 Standard Stadium · DH | 40-69 | 128 |  | 0 |  |  |  |  | **none** | unchanged | Daily Goldfather II ×8 (0); Daily Gold Slots ×18 (0); Thursday Silver Spectacular ×1 (0) |

## Iron (15) — none 15

| Event | Env | Cap / rules | Field | Entries | Current runs | Pre-refresh | Card rows / PA | Newest | Grab now | Status | Refresh | Best donors (dist) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Daily Dank Iron | 1945 · 1945 Comiskey Park · no DH | 40-49 | 64 |  | 0 |  |  |  |  | **none** | unchanged |  |
| Daily Iron & Friends OOTP Era Slots | 1999 · ? | slots B1 D1 G1 I21 P1 S1 |  |  | 0 |  |  |  |  | **none** | unchanged | Daily Open Slots ×2 (0.11); Laptophound's Daily 6L Power Play ×8 (1.06) |
| Daily Iron Cap | 2010 · 2026 Isotopes Park · DH | 40-59 · cap 1300 | 32 |  | 0 |  |  |  |  | **none** | unchanged |  |
| Daily Iron Dreamland | 1907 · 1886 Swampoodle Grounds | 40-59 |  |  | 0 |  |  |  |  | **none** | unchanged |  |
| Daily Iron Lunch | 1966 · ? | 40-59 |  |  | 0 |  |  |  |  | **none** | unchanged | Tuesday Up To 1969 ×1 (1.05) |
| Daily Iron Strikes Back | 1987 · 1990 Anaheim Stadium · no DH | 40-59 | 64 |  | 0 |  |  |  |  | **none** | unchanged | Daily Bronze 1910-59 ×3 (1.2) |
| Daily Late Iron | 2010 · 2026 Chase Field · DH | 40-59 | 64 |  | 0 |  |  |  |  | **none** | unchanged | Daily Bronze OOTP Era ×3 (1.24) |
| Daily Live Iron | 2010 · 2026 Petco Park | 40-59 |  |  | 0 |  |  |  |  | **none** | unchanged | Sunday Open Main Event ×2 (0.66); Daily Diamond & Friends Slots ×7 (0.71); Daily Low Diamond ×20 (0.71) |
| EF 4T Iron | 2010 · ? | 40-59 |  |  | 0 |  |  |  |  | **none** | unchanged | Daily Diamond & Friends Slots ×7 (0); Daily Low Diamond ×20 (0); Sunday Open Slots ×2 (0) |
| EF H2H Iron | 2010 · ? | 40-59 |  |  | 0 |  |  |  |  | **none** | unchanged | Daily Diamond & Friends Slots ×7 (0); Daily Low Diamond ×20 (0); Sunday Open Slots ×2 (0) |
| Friday Danksville | 2010 · 2026 Progressive Field · DH | 40-49 | 256 |  | 0 |  |  |  |  | **none** | unchanged |  |
| Iron Quick | 2010 · 2025 Standard Stadium · DH | 40-59 | 16 |  | 0 |  |  |  |  | **none** | unchanged |  |
| Low Iron Quick | 2010 · Standard Stadium · DH | 40-49 |  |  | 0 |  |  |  |  | **none** | unchanged |  |
| PTCS 2 Iron Replay. | 1969 · 1964 Shea Stadium · no DH | 40-59 | 64 |  | 0 |  |  |  |  | **none** | renamed (files are post-refresh) | Daily Bronze 1910-59 ×3 (0.59) |
| Saturday Iron Warriors | 1987 · 1952 Yankee Stadium · DH | 40-59 | 256 |  | 0 |  |  |  |  | **none** | unchanged | Daily Bronze 1910-59 ×3 (0.65) |

## Open (16) — thin 6, none 10

| Event | Env | Cap / rules | Field | Entries | Current runs | Pre-refresh | Card rows / PA | Newest | Grab now | Status | Refresh | Best donors (dist) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Daily Open Slots | 2000 · 2025 Standard Stadium · DH |  | 64 | 5 | 2 |  | 821 / 56,626 | 2026-08-28 (10d) | 7 | **thin** | not yet | Laptophound's Daily 6L Power Play ×8 (0.98) |
| Sunday Open Main Event | 2010 · 2026 Dodger Stadium · DH |  | 256 | 5 | 2 |  | 744 / 218,483 | 2026-08-23 (15d) | 2 | **thin** | not yet | Daily Live Diamond ×12 (0.46); Daily Diamond & Friends Slots ×7 (0.63); Daily Diamond ×18 (0.63) |
| Sunday Open Slots | 2010 · 2025 Standard Stadium · DH |  | 128 | 5 | 2 |  | 1089 / 109,633 | 2026-07-26 (43d) | 2 | **thin** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Diamond Quick ×7 (0) |
| Daily Live Open | 2010 · 2025 Standard Stadium · DH | 40-100 | 128 | 7 | 1 |  | 202 / 39,212 | 2026-06-10 (89d) | 7 | **thin** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Diamond Quick ×7 (0) |
| Monday Gold Floor Cap | 2010 · 2025 Standard Stadium · DH | 80-105 | 128 | 7 | 1 |  | 590 / 54,049 | 2026-07-28 (41d) | 2 | **thin** | not yet |  |
| Wednesday Night of the Living Deadball | 1919 · 1871 Union Grounds (Brooklyn) · no DH |  | 128 | 3 | 1 |  | 167 / 56,196 | 2026-08-27 (11d) | 2 | **thin** | not yet | Daily Silver & Friends Deadball Slots ×3 (0.3) |
| Tuesday Live | 2010 · 2026 Oracle Park · DH | 40-100 | 256 | 2 | 0 |  |  |  | 2 | **none** | not yet | Daily Diamond & Friends Slots ×7 (0.49); Daily Diamond ×18 (0.49); Diamond Quick ×7 (0.49) |
| Friday Night Live Slots | 2010 · 2026 Daikin Park · DH | 40-105 | 128 | 1 | 0 |  |  |  |  | **none** | not yet | Daily Diamond & Friends Slots ×7 (0.21); Daily Diamond ×18 (0.21); Diamond Quick ×7 (0.21) |
| Daily Open 1930-89 | 1987 · 1986 Three Rivers Stadium · DH | 40-105 | 64 |  | 0 |  |  |  |  | **none** | not yet | Daily Silver Slamboree ×8 (0); Daily Late Silver ×16 (0.23); Daily Golden Heart ×15 (0.49) |
| Daily PTCS 4 Cap Replay | 2010 · 1995 Coors Field · DH | 40-105 · cap 1820 | 32 |  | 0 |  |  |  |  | **none** | renamed (files are post-refresh) |  |
| Daily Wide Open | 2010 · 2023 Fenway Park · DH | 40-105 | 64 |  | 0 |  |  |  |  | **none** | not yet | Thursday CWhit's Cap Challenge ×1 (0.69); Wednesday 1950 to Now ×2 (0.84); Daily Diamond & Friends Slots ×7 (1.18) |
| EF 4T Open | 2010 · ? |  |  |  | 0 |  |  |  |  | **none** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Diamond Quick ×7 (0) |
| EF H2H Open | 2010 · ? |  |  |  | 0 |  |  |  |  | **none** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Diamond Quick ×7 (0) |
| Live Quick | 2010 · 2025 Standard Stadium · DH | 40-100 | 16 |  | 0 |  |  |  |  | **none** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Diamond Quick ×7 (0) |
| Open Quick | 2010 · ? |  |  |  | 0 |  |  |  |  | **none** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Diamond Quick ×7 (0) |
| Open Slot Quick | 2010 · ? |  |  |  | 0 |  |  |  |  | **none** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Diamond Quick ×7 (0) |

## Live (1) — none 1

| Event | Env | Cap / rules | Field | Entries | Current runs | Pre-refresh | Card rows / PA | Newest | Grab now | Status | Refresh | Best donors (dist) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Live Slot Quick | 2010 · ? |  |  |  | 0 |  |  |  |  | **none** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Diamond Quick ×7 (0) |

## Cap (4) — thin 1, none 3

| Event | Env | Cap / rules | Field | Entries | Current runs | Pre-refresh | Card rows / PA | Newest | Grab now | Status | Refresh | Best donors (dist) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Thursday CWhit's Cap Challenge 4 | 2023 · 1936 Hinchliffe Stadium · no DH |  | 128 | 3 | 1 |  | 443 / 56,454 | 2026-08-27 (11d) | 2 | **thin** | not yet | Wednesday 1950 to Now ×2 (0.33); Daily Diamond & Friends Slots ×7 (0.58); Daily Diamond ×18 (0.58) |
| Daily Open High Cap | ? · ? |  | 32 | 2 | 0 |  |  |  | 7 | **none** | not yet |  |
| Daily Open Low Cap | 2010 · 2026 PNC Park · DH |  | 64 |  | 0 |  |  |  |  | **none** | not yet | Thursday CWhit's Cap Challenge ×1 (0.65); Daily Diamond & Friends Slots ×7 (0.68); Daily Diamond ×18 (0.68) |
| Thursday Mishmash Cap | 2010 · ? |  |  |  | 0 |  |  |  |  | **none** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Diamond Quick ×7 (0) |

## Other (13) — thin 2, none 11

| Event | Env | Cap / rules | Field | Entries | Current runs | Pre-refresh | Card rows / PA | Newest | Grab now | Status | Refresh | Best donors (dist) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Wednesday 1950 to Now | 2010 · 1979 Three Rivers Stadium · DH |  | 128 | 2 | 2 |  | 437 / 108,682 | 2026-08-26 (12d) | 2 | **thin** | not yet | Thursday CWhit's Cap Challenge ×1 (0.33); Wednesday Ice to See You ×3 (0.52); Daily Diamond & Friends Slots ×7 (0.67) |
| Tuesday Up to 1969 | 1968 · 1968 Busch Stadium · no DH |  | 128 | 2 | 1 |  | 242 / 53,010 | 2026-08-25 (13d) | 2 | **thin** | not yet |  |
| Dr. Dynastic's Daily Time Travelers Slots | ? · ? |  | 64 | 1 | 0 |  |  |  |  | **none** | not yet |  |
| Cwhit 4.2 | 2023 · ? |  |  |  | 0 |  |  |  |  | **none** | not yet | Thursday CWhit's Cap Challenge ×1 (0); Wednesday 1950 to Now ×2 (0.33); Daily Diamond & Friends Slots ×7 (0.58) |
| Cwhit4 | 2023 · ? |  |  |  | 0 |  |  |  |  | **none** | not yet | Thursday CWhit's Cap Challenge ×1 (0); Wednesday 1950 to Now ×2 (0.33); Daily Diamond & Friends Slots ×7 (0.58) |
| Daily Negro Leagues | 1944 · 1941 Penmar Park · no DH |  | 64 |  | 0 |  |  |  |  | **none** | not yet | Wednesday Night of the Living Deadball ×1 (1.05); Daily Silver & Friends Deadball Slots ×3 (1.12) |
| Daily Time Travelers Slots | 1919 · 1919 Fenway Park · DH |  | 64 |  | 0 |  |  |  |  | **none** | not yet | Daily Silver & Friends Deadball Slots ×3 (0.84); Wednesday Night of the Living Deadball ×1 (0.99); Monday Wonky Historical Slots ×1 (1.04) |
| My Custom Tournament | 2010 · ? |  |  |  | 0 |  |  |  |  | **none** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Diamond Quick ×7 (0) |
| PTMS 2 Tourney 1 | 2010 · ? |  |  |  | 0 |  |  |  |  | **none** | not yet | Daily Diamond & Friends Slots ×7 (0); Daily Diamond ×18 (0); Diamond Quick ×7 (0) |
| PTMS 2 Tourney 2 | ? · 1998 Wrigley Field |  |  |  | 0 |  |  |  |  | **none** | not yet |  |
| PTMS 2 Tourney 3 | 1962 · ? |  |  |  | 0 |  |  |  |  | **none** | not yet | Saturday Diamond Variety ×2 (1.1); Daily Sporer's Golden Childhood ×4 (1.24) |
| Quick Dank | 2025 · ? |  |  |  | 0 |  |  |  |  | **none** | not yet | Daily Diamond & Friends Slots ×7 (0.21); Daily Diamond ×18 (0.21); Diamond Quick ×7 (0.21) |
| Saturday Negro Leagues Slots | 1948 · 1930 Hamtramck Stadium · no DH |  | 128 |  | 0 |  |  |  |  | **none** | not yet |  |
