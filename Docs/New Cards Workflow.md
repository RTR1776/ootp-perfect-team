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
   - Or ask Claude to rebuild them all and hand over a Mac script, as on 09-29.

## How it's scored

- **The same as Build:** each event's run environment and park, the field's hands off its exports, tournament play blended in, the glove at the spot (`lib/card-fit.ts`, `lib/card-fit-load.ts`).
- **Your team there:**
  - your newest saved roster for the event;
  - where none is saved, the best team your legal cards make, built without the card being placed.
- **The runs are one swap into that team.** That's the first move Optimise would weigh, not the reshuffle a cap or slot rule can force. So a big number in a cap event is a reason to open Build, not a finished roster.
- **Speed:** about seven seconds to place the new cards in all ~90 current events. The result is cached until an upload, a rules change or a saved roster changes it. Any other card is scored when opened (about five seconds the first time).
