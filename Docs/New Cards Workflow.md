# New cards: where each one goes

L.J., 2026-09-29: new cards come in batches (a release, pulls, variants), and he wants to see quickly where each one goes. The app's answer is **Card Fit**, on the Cards page.

## After a release or a pull

1. **Upload on /upload:**
   - The shop list, for a release: new cards enter the card table with their ratings and prices.
   - The collection export, for cards you got: pulls and variants. A variant listed without its base copy implies the base (not for a clubhouse card).
2. **Open Cards (no search):**
   - **New to your collection:** what you got since the collection before.
   - **New in the shop:** cards a shop list first listed within a week of the newest one.
   - Each row says how many current events the card would start in, out of those it is legal in, plus the top three with the runs it adds and the spot.
   - Rows tinted green start somewhere.
3. **Tap a card:**
   - The full table covers every current event it is legal in.
   - The *Your team* column gives the runs one swap adds, whom it replaces, and whether a cap event has room.
   - *Rank* is its place at the spot among every legal card (cwhit's rank, in that event's own environment).
   - *Played here* is its own line in the event's series.
   - Filter by event tier, or show only the events where it starts.
4. **Open the event (its name links to Build):**
   - The saved roster shows "N new cards fit".
   - Load it, press Optimise (about a minute) or Search longer (several minutes), then save.
   - Since 09-30 these match Claude's full builds (below), so there's no need to ask Claude.
   - Claude's batch rebuild (below) is still there for doing many events at once.

## Card changes, the quick path (10-26): sold, bought, or a new upload

L.J., 10-26: "make sure we have a quickish way to update rosters when card changes, they will typically be 10 or less at a time".

**One command** rebuilds and saves only the events that need it:

    node --env-file=.env.local --import tsx scripts/current-rosters.ts --changes --sold 86621 --bought 87236,87185 --out /tmp/rosters --save

It rebuilds a current event when:
- **A card is gone.** Its saved roster holds a card he no longer has: one passed with `--sold`, or any card the newest collection upload lacks (found on its own).
- **A gained card would start.** Card Fit's one-swap test, `--min-gain` runs (default 3), for a card passed with `--bought`, or for any card new in the collection since that event's saved roster.

How it works:
- Each build starts from the event's saved roster plus one λ start, so ten changes take minutes, not the hours of a full rebuild.
- `--bought` cards count as owned until a collection upload lists them, and `--save` saves them too.
- `--sold` cards are out of every pool, even while the upload still lists them.
- `--save` writes each legal build as "Claude pick <tag>" and replaces the event's earlier Claude pick. Without it, the batch is a manifest for `Save Current Rosters.command`.
- `--list` in place of `--out … --save` shows which events would rebuild and why ("gone: Ernie Banks", "new: Ernie Clement SS +16.0"), without building.

- Every build uses L.J.'s position floors (SS 85, CF 90, 2B 85, RF 75, 60 elsewhere) and builds Tuesday Dead Silver Walking to his 4 SP / 5 RP. Both are defaults in `current-rosters` since 10-26; `--extra "--min-pos …"` overrides the floors.

**On the Mac:** double-click `Update Rosters For Card Changes.command`. It asks for the sold and bought card ids, shows the list, and builds and saves on a typed y.

**League** is not part of this. After a change to the league 26, re-run `league-compare`; see the newest League Plan.

## The fast path: rebuild only where a new card starts (`--new-cards`)

L.J., 2026-09-30, after the Sabo LE: "we need to make sure we have a system in place so that when new cards come out they are easily put in various tourney rosters where they belong … needs to be efficient."

After he uploads the shop list and collection on /upload, the whole loop is:

1. **Claude runs** `scripts/current-rosters.ts --new-cards --out <dir> --jobs 4`. About 10 s to triage, then a few minutes per batch of builds.
   - For every current event it takes the cards owned now that the event's saved roster's collection didn't have (the same count as Build's "N new cards fit" chip).
   - It places them with Card Fit, the same numbers /cards shows.
   - It rebuilds only the events where one of them **starts** and its one swap adds at least `--min-gain` runs (default 1). Current events with no saved roster are rebuilt too.
   - A rebuild that comes out with **the same cards** as the saved roster is left out of the manifest ("UNCHANGED").
   - The printout lists each rebuilt event with the card that triggered it (`[new: Chris Sabo 3B +8.2]`).
2. **L.J. runs** Push to GitHub, then `Save Current Rosters.command`. It saves only the rosters that changed.

On 09-30 (Sabo LE, Boone UH, Estrada, Montalvo), this was 25 of 74 current events instead of all 74.

For buy advice, the same Card Fit numbers for the shop's new cards he doesn't own are on /cards (no search, "New in the shop").

## Rebuilding every current event at once

`scripts/current-rosters.ts` rebuilds Claude's pick for every current event from the catalogue's rules.

- **Current:**
  - not retired, and not a draft, an EF event or a Quick;
  - ran in the past 8 days of the newest tournaments dump.
- **Skipped:**
  - an event that already has a roster on the newest collection;
  - an event with a rule the flags can't carry (for example, no DH rule on file).
- **Each event's settings:** read from the catalogue the way Build reads it (`lib/event-roster-args.ts`, tested):
  - its run environment, park, DH, value window and card years;
  - its set rule, slots, cap, variant cap and No LE;
  - its own exports, or none where they predate the current format.
- **The build:** 26 cards, 14 bats / 5 SP / 7 RP, the optimiser from 16 starts.
- **Output:**
  - every legal build becomes a load file in `Inbox/rosters`, with every card pinned by id;
  - the batch becomes a manifest, `Inbox/rosters/current-<tag>.tsv`; the tag is the day unless `--tag` names it.
- **Saving:** `Save Current Rosters.command` on the Mac saves the newest manifest as "Claude pick <tag>". It checks each roster first and asks once. Keep it; every batch uses it.

      node --env-file=.env.local --import tsx scripts/current-rosters.ts --list
      node --env-file=.env.local --import tsx scripts/current-rosters.ts --out <dir> --jobs 5 [--skip 549] [--only 521,532] [--all] [--quicks]

Use `--skip` for an event built to L.J.'s own shape (Dead Silver: 4 SP / 5 RP) or one whose new format isn't in the catalogue yet.

## How it's scored

- **The same as Build:** each event's run environment and park, the field's hands off its exports, tournament play blended in, the glove at the spot (`lib/card-fit.ts`, `lib/card-fit-load.ts`).
- **Your team there:**
  - your newest saved roster for the event;
  - where none is saved, the best team your legal cards make, built without the card being placed.
- **The runs are one swap into that team.** That's the first move Optimise would weigh, not the reshuffle a cap or slot rule can force. So a big number in a cap event is a reason to open Build, not a finished roster.
- **Speed:** about seven seconds to place the new cards in all ~90 current events. The result is cached until an upload, a rules change or a saved roster changes it. Any other card is scored when opened (about five seconds the first time).

## Build's search vs Claude's builds (2026-09-30)

L.J.: "I don't want to have you put lineups in there, we should just make sure the optimizer is as good as you are."

**How it was measured:** `env-roster --compare-search` (or `--compare-only`) runs /build's Optimise and Search longer (`lib/roster-search.ts`) on the CLI build's exact inputs.

**What was wrong:** Build's search climbed only each slot's top 120 candidates. It missed trades that need a card outside that list, which matters most under a tight cap. Saturday Bronze Cap: Optimise 8.8, Claude 20.3.

**The fix:** after the narrow climbs, each mode takes its best 2 or 3 boards and climbs them once more over the full pool (`POLISH`). Optimise also tries λ 8.

| Event | Claude (CLI) | Optimise before → after | Search longer before → after |
|---|---|---|---|
| Saturday Bronze Cap | 20.3 | 8.8 → **20.3** | 18.8 → **20.3** |
| Daily Bronze Only Cap | 95.0 | 94.6 → 94.6 | 94.6 → 94.6 |
| Daily Late Bronze | 100.6 | 100.6 → 100.6 | 100.6 → 100.6 |
| Daily Gold Cap | 209.1 | 211.3 → **214.9** | 213.2 → **214.8** |
| Daily Gold Slots | 239.7 | 234.5 → 234.5 | — → **239.7** |

**Result:**
- Search longer matches or beats Claude's builds on every event measured (within 0.4 runs).
- Optimise does too on three of five, in about a minute.
- For a big event, press Search longer.
