# Draft Helper, 2026-10-26: Laptophound's 5L Deadball and 6L Power Play

A live page for Perfect Drafts: each round it ranks the cards you can take by
what your **finished** team is worth with each one, in the event's own run
environment, with the rounds still to come priced in. It runs in the app on its
own; nothing in a draft needs Claude.

**Where:** sidebar → **Draft** → **Live draft** tab (`/draft/live`). The old
by-position board is the **Board** tab.

## Using it mid-draft

1. Pick the event (6L Power Play or 5L Deadball). Picks are kept in this browser
   per event, so a reload loses nothing. **New draft** clears them.
2. Each round, either:
   - **type the cards in your pack**: a few letters, Enter, next card. The first
     card sets the round (6L: Bronze SS, Gold…). The list only offers that
     round's pool, so "molina" finds the Bronze one in a Bronze round. Or
   - **don't type; read the board.** The middle panel ranks the whole pool for
     the round. The best card in your pack is the highest one you see there.
3. The green box is the pick. **Enter on the empty box takes it.** "Take" on any
   row takes that one instead. **Undo pick** takes the last one back.
4. Keys: Esc clears the box (twice clears the pack), Backspace on an empty box
   drops the last card from the pack.
5. **5L only, before the pack:** "Open which position?" ranks the positions by
   what one more pack there should add. Click one to see that pool. If the 5L
   actually deals mixed packs, switch **Open rounds** to *mixed packs* (see open
   questions).

The right panel is your team as the engine would play it: lineups vs RHP and vs
LHP, rotation, pen, bench. Italic names are what the rounds left are expected to
bring, not picks. **Copy team as text** gives you the lineups to set in-game.

Speed: 20–110 ms a pick with a pack typed in, 100–250 ms to rank a whole pool,
all in a background worker. The page itself takes 1–3 s to load (every legal
card is scored on load).

## What a pick is worth

**A card's runs** are the production model's, scored exactly as Card Fit and
Build score cards (`lib/draft/load.ts`). The model is env-fit runs in the
event's run environment and park, role trust 0.25 and the tournament terms.
Observed play is left out, since production blends it at K = 1,000,000.

**A team's value** (`lib/draft/engine.ts` `teamPlan`) prices a team the way the
roster objective does, in runs over a replacement card at every slot:
- each board's lineup is an exact assignment of bats to positions, glove and
  framing included. Boards are weighted by the field's left-handed pitching.
- the rotation takes SP cards only; the pen takes any arm left over.
- with no DH, a two-way starter's bat counts for his share of plate appearances.
- the bench, a backup catcher, and a charge for having **no** second catcher
  (L.J.'s two-catcher rule; the model alone barely sees it).

**Glove floor:** a card always plays its listed position. Off it, L.J.'s
60 floor applies. A third of the pool's Bronze bats rate under 60 at their own
position, and the draft hands you one anyway.

**Each slot's price in each event** (shown on the page). These are
`teamWeights` for the era plus the series' measured innings, exactly as the
builder uses them:

| | 6L Power Play (1996, DH) | 5L Deadball (1916, no DH) |
|---|---|---|
| A bat run at a lineup spot | 1 (boards 68/32 vs RHP/LHP) | 1 (boards 65/35) |
| A glove run | ×1.17 | ×2.27 |
| Catcher framing | ×0.5 | ×1 |
| Each of the starters | 5 at ×1.16 | **4 at ×3.11** |
| Each of the relievers | 7 at ×1.01 | 5 at ×0.50 |
| Each bench bat | 5 at ×0.066 | 4 at ×0.083 |

In the 5L a starter's slot is worth about three lineup slots. A deadball starter
faces 2.5× a lineup slot's PA (measured on the October exports), and the era
weights starters at 1.5.

**The rounds to come.** For each candidate, the rounds left are played out in
expectation. Each round's pick is a card like the expected best of a pack of N
from that round's pool, and it fills whatever the team then needs. The score is
your picks' exact value plus each round's expected gain. That is how it knows:
- a second catcher round is coming;
- a Gold round may bring a bat;
- a deep pool can wait and a thin one can't.

Before a pick it ranks the 24 likeliest cards this way; the rest of the board
keeps a quick read, shown in grey.

**Out of the pool.** The draft pool rotates. Bob Miller's 1954 reliever went to
84 6L teams in August and to none of 486 in October. A card is treated as
having left the pool when the field drafted it in the earlier runs often enough
to expect 3+ picks now, and took it 0 times. That covers 79 cards in the 6L and
54 in the 5L. Such a card stays on the board, flagged "left pool?". It is left
out of what later rounds can bring, and it is still yours to take if it shows up
in a pack.

## The formats: what the data confirms, what is assumed

Read from every full team (all cards on file) in the exports L.J. filed 10-25
(`pnpm draft:study`).

**6L Power Play:** 26 rounds. Each count below is exact on all 304 full teams
(10-22..10-25):

| Rounds | Pool |
|---|---|
| 2 | Bronze C |
| 1 each | Bronze 1B (or DH), 2B, 3B, SS, LF, CF, RF |
| 5 | Bronze SP |
| 5 | Bronze RP (closers included) |
| 3 | Iron bats, never a catcher, never an arm |
| 2 | Silver, any position |
| 2 | Gold, any position |

The Bronze rounds are locked to a position. The 1996 environment, DH and 128
teams are L.J.'s (10-25). The DH is confirmed: pitchers took ~1% of PA in every
export on file.

**5L Deadball:** 21 rounds: 17 Bronze, 3 Iron, 1 Silver. Exact on all 199 full
teams; no position is fixed. A team's Bronze arms run from 3 to 9. Every team
has a catcher and 82% have two, so the drafter steers the positions. The 1916
environment is L.J.'s and the exports agree. October's HR/PA is .0043 and K/PA
.123, against .0044 expected for 1916 at 1936 Crosley. August's runs matched
1907 (.0027 against .0029).

**Not on file, so assumed (switchable on the page):**
- **5L:** each round you pick the position, then see a pack of it (your read).
  The page's other mode is mixed packs. The first-pick advice differs between
  the two.
- **6L:** the Iron, Silver and Gold packs mix positions.
- **Pack size: 6** (your July note). In the 6L's Bronze rounds, the field's
  most-drafted card at each position went to 11–28% of teams from pools of
  35–65. That implies at least 6–9 cards a pack, so the 6L may show more. Set
  it on the page.
- **Round order:** unknown for both (an older note says the 6L opens on a
  Bronze catcher round). The helper only needs to know which round you're in,
  and the first card you type tells it.
- **Other drafters' picks don't matter.** Every pack is yours alone: the same
  card sat on ~20 teams of one 6L run.

## What the uploaded results say

**Data:** 5L runs 219, 222–225 (552 teams, 199 full); 6L runs 222–225 (486
teams, 304 full).

**Survivor bias.** The export lists only cards that played. A team that goes
deeper plays more of its cards: win% against games played runs r 0.74. So any
team total over the cards on file rewards a deep run by itself. Every check
below uses **full teams**, or holds the number of cards on file fixed.

**Does the team value predict winning?**

| | 5L Deadball | 6L Power Play |
|---|---|---|
| r(value, win%), full teams, within run | **0.21** | 0.09 |
| same, all teams, cards on file held fixed | 0.16 | 0.08 |
| The market's read (sum of card values) | 0.05 / 0.00 | −0.02 / −0.14 |
| Win% by quarter of value, low → high | .471 · .483 · .499 · **.561** | .476 · .506 · .510 · .499 |
| Card by card, model runs vs runs in these events | bats r 0.59, arms r 0.30 | bats r 0.51, arms r 0.40 |

- **5L:** the model sorts teams. The top quarter by value won 56% against 47%
  for the bottom, and value beats the card-value sum.
- **6L:** too thin to say. Every 6L team has the same shape (19 Bronze, mostly
  position-locked), so teams differ little and series luck dominates.
  Card by card the model still tracks play in both events.
- Bats in the 6L played 1.4× the model's spread (slope 1.40). That is a watch
  item for the 1994–2009 calibration, not something these 4 files can fix.
- **Arm weight:** halving or doubling the pitching weight moves r by under 0.02
  in either event. Production weights stand; the data can't refit them.

**What winning teams drafted (full teams, win%):**
- **5L, starters:** teams with 5 SP cards won .534 (61 teams). Teams with ≤3,
  4 or 6+ won .495, .484 and .489. Thin, but it agrees with a starter slot
  priced at 3×.
- **5L, the Silver pick:** used on a bat .515 (139), on an SP .469 (51).
- **6L, Gold and Silver picks:** no signal. SP+bat .499 (160), bat+bat .504
  (44), SP+SP .489 (48).
- **The field's favourites against the model:**
  - 6L: Yadier Molina is the field's top Bronze C (28% of teams). The model has
    him 19th of 55: his bat is −31/−14 runs per 700, and framing is half-weight
    in this era. It takes Ernie Whitt (12%).
  - 6L: Octavio Dotel goes to 25% of teams and ranks 60th of 78 relievers on
    the model.

**Your own teams** (model value; percentile against that run's full teams):
- **6L:**
  - 223: 3-4, 88th
  - 225: 9-9, 91st
  - 222: 10-6, 93rd (a card never played, so a floor)
  - 224: 3-4, 9th (also a floor)
- **5L:**
  - 219: 3-4, 30th
  - 223: 4-6, 21st
  - 225: 10-7, 36th (floor)
  - 222: 6-5, 8th (floor)
  - 224: 10-6, 84th
- Your 6L drafts already grade near the top. **The 5L is where this should help
  most.** Three of your five 5L teams carried 3 SP cards. In 223 the Silver
  went to a backup catcher (Del Crandall). In 219 you had 6 SP cards, but all of
  them were 0 to −3 runs.

**Too thin to say:** the 6L team-level link; anything per clan; whether the
5L's Silver should be a bat (1.4 standard errors).

## Fixing the catalogue (for L.J. to run)

The catalogue rows still have the August formats. They say 5L 1907 and 6L 1999
with no DH, both 64 teams. The page uses your 10-25 settings and flags the
difference. This session's sandbox couldn't write the database. From `web/`:

```
pnpm catalogue:set --tournament 554 --year 1916 --format-since 2026-10-19 --note "L.J. 10-25: 1916 RE; Oct exports match 1916 at Crosley, Aug 1907" --commit
pnpm catalogue:set --tournament 555 --year 1996 --dh --format-since keep --note "L.J. 10-25: 1996 RE with DH; DH on in every export on file" --commit
```

What the two lines do:
- **5L, `--format-since 2026-10-19`:** that's the first run on file in the new
  environment. The next import will file the August 5L exports as old-format
  runs.
- **6L, `keep`:** keeps August and October pooled. DH was on in both, and
  1999 vs 1996 moves rates under 6%.
- **Field size (128) isn't there:** `catalogue:set` has no flag for it, and PTCS
  points read the dump's field size anyway.

## Keeping it current

- After filing new 5L/6L exports, run `pnpm draft:study` from `web/` and push
  `src/data/draft-study.json`. It refreshes the field's hands and staff, the
  "field" column, the out-of-pool list, the field's value percentiles and the
  model check. `--since N` sets the first current-format run when a format
  changes (now 219 for the 5L, 222 for the 6L, in `CURRENT_SINCE`).
- **Another draft** (a weekly PD) is one entry in `DRAFT_FORMATS` in
  `web/src/lib/draft/formats.ts`: its rounds, catalogue id, run environment and
  DH. The page lists it automatically. The study's round check confirms the
  rounds from exports, team by team.

## Open questions for L.J.

1. **5L:** each round, do you choose the position and then see a pack of it, or
   is the pack mixed? Set "Open rounds" to match.
2. **6L:** are the Iron, Silver and Gold packs mixed, or pick-a-position? Does
   it open on Bronze C?
3. **Pack size:** 6 cards, or more in the 6L?
4. **The Winter Classic** (top 64 qualify, you think): nothing about it is on
   file. A rules screenshot would let the page say what finish you need.

## Files

- `web/src/lib/draft/formats.ts`: the 5L and 6L rounds.
- `web/src/lib/draft/engine.ts`: team value, quick gains, the play-out, the advice.
- `web/src/lib/draft/load.ts`: scoring the cards; slot prices.
- `web/src/lib/draft/study.ts`: reads the study.
- `web/src/lib/draft/draft.worker.ts`: the engine off the main thread.
- `web/src/app/draft/live/page.tsx` and `web/src/components/draft/live-draft.tsx`: the page.
- `web/scripts/draft-study.ts`: `pnpm draft:study`.
- `web/src/data/draft-study.json`: its output.
- Tests: `web/src/lib/draft/engine.test.ts` and `formats.test.ts` (18 tests).
