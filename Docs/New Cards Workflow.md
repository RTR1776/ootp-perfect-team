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
   - Load it, press Optimise, then save.
   - Or ask Claude to rebuild every current event (below).

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
