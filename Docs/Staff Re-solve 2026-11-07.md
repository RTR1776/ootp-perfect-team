# Staff re-solve in the optimiser — 2026-11-07

**Why:** Saturday Bronze Cap (event 535, collection upload #358). current-rosters built it at **110.9** from 15 starts, with Satchel Paige (68) closing and Tin Can Kincannon (45) at SP5. A ban test on Paige, seeded from that board, climbed to **114.3** in 6 moves:
- Livan Hernandez (68, SP, #87261) took Paige's cap points as SP3.
- Kincannon moved to the pen.
- Todd Jones (VAR) closed.

Both boards are legal at exactly 1386/1386, and `env-roster --score` gives 110.9 and 114.3. That's "cap always sacrifices the bullpen" again: the 68 points were worth more in the rotation. The optimiser couldn't find the move on its own.

## What was wrong

A climb move puts one card in one slot. Since 09-26 the climb re-solves the bats' positions as an assignment after every move (`lib/assign.ts`, the Josh Gibson fix), but it never did that for the staff. So a new arm was only ever scored in the slot he moved into.

- **Hernandez for Paige is a legal single swap** at a full cap (68 for 68). But the swap put Hernandez in Paige's slot, closing, where he is worth less than Paige, so it lost.
- **It pays only with the staff re-sorted:** Hernandez starts, the SP5 (Kincannon) drops to the pen, and the best reliever (Todd Jones) closes. Eight staff slots change between the two boards.
- **No pair move does it either.** Hernandez into SP5 sends Kincannon off the roster and breaks the cap by 23. Every pair still scores each new arm in the slot he moved into.

Reproduced today on the unchanged code with no seed (14 λ starts): best **110.8**, with the same staff (Paige CL, Kincannon SP5). It differs from the 114.3 board only in the staff: Paige for Hernandez, and the arms' order.

## The change

**`web/src/lib/roster-optimize.ts`: the staff tier (`staffTier` option).**
- **The staff is re-solved like the bats.** Which arms on the roster start, which relieve, and in what order is a max-weight assignment (`maxAssignment`) over the staff slots. It uses each slot's `slotValue`: a rotation slot weighs its share of the starts, a pen slot its share of the batters times leverage. Starter slots take SP-role (or role-less) arms only, as before.
- **It's a tier, tried only where the plain climb stops.** When no single move and no pair helps, the climb tries:
  1. the arms on the board, re-solved as they are;
  2. a new arm for any arm on the staff, re-solved around him. This includes a reliever who can't start coming in for a starter, with a pen arm who can start moving up.
  3. Only if neither helps, pairs with a new arm on one side or both: a new arm plus a bat move (a cheaper starter in for the closer pays for a bat), or two new arms.

  It takes the best move found. If anything improves, the ordinary climb carries on from there.
- **Priced from its parts.** What the staff adds depends only on which arms it holds: the slot values less the long-men penalty. So each set of arms is solved once and remembered. A pair's worth is that, plus what its bat move adds on its own (the two touch different slots). Only a move that could beat the best so far is built, checked with `legal()` (cap, slots, two-way rules) and scored on the full objective. That took the tier from about 25 s to 3 s in a trap-seeded Bronze run.

**Where it runs: a polish, not every climb.**
- **env-roster:** every λ and seed start climbs exactly as before. Then the best 3 distinct boards climb on with the staff tier (`--staff-polish N`, default 3, 0 turns it off).
  - Those boards are already where the plain moves stop, so their first pass goes straight to the tier (`atOptimum`).
  - The dual phase's climbs get the tier too, since they compete with the polished board.
  - The printout has a `staff polish` line with each board's before and after.
- **/build:** Search longer gets the tier in its full-pool polish of its best 3 boards. Optimise doesn't. On Bronze Cap, with the machine busy, the tier added 22 s to its 76 s search for 0.1 run (103.1 → 103.2).
- **Unchanged:** callers that don't pass `staffTier` climb exactly as before (`cap-finish`, `roster-corrected`, `roster-diff`).

**Two versions that didn't make it.**
- **Re-solving on every move** finished *lower* on Bronze Cap's 14 unseeded starts: best **107.0**, against 110.8.
  - The climb is steepest-first, so the big re-solve gains changed the path each start took.
  - The starts ended on boards whose last fix (Reed Garrett back in the pen for Jerry Augustine, Charlie Eden for Harold Baines) needs a reliever outside the pair lists' top 10.
  - As a tier, a climb follows its old path to its old stopping point and only climbs on from there, so it can't finish below where it used to.
- **The tier on every start** (before the part-by-part pricing) found the same best board, 114.3, for **36% more CPU** (1,024 s against 751 s, run side by side). Much of that was real climbing: every start that found a staff move climbed on. Polishing only the best 3 boards keeps the result and bounds the cost: +22% at first, **+11%** once the polish skips its redundant first pass.

**Tests** (`roster-optimize.test.ts`), each failing on the old code:
- a starter in for the closer. Without `staffTier` the climb is unchanged, and a polish with `atOptimum` lands on the same board;
- a reliever who can't start, in for a starter;
- a pair: a dearer starter in for the closer, paid by a cheaper bat.

## Results

All builds use the flags current-rosters gives each event (L.J.'s floors, role trust 0.25), on collection upload #358. **Old** is main before this change; **new** is this branch. The machine was busy with other work throughout, so CPU times only compare within a pair run side by side.

### Saturday Bronze Cap (535)

| build | old | new |
|---|---|---|
| `current-rosters --only 535 --all --no-seed` (14 λ starts) | 110.8, Paige CL, Kincannon SP5 · 559 s | **114.3** · 620 s (+11%) |
| env-roster seeded from that 110.8 board, `--starts 1` | 110.8, no move | **114.3** in 1 move |
| `current-rosters --only 535 --all`, as given | 114.3 (the seed, roster 2014, is already the hand-found board) | 114.3 |

- The new board is the hand-found one: Hernandez SP3, Kincannon RP4, Todd Jones CL, 1386/1386, every roster check ✓.
- From the unseeded build: `staff polish, best 3 boards: λ 1.00 110.8 -> 114.3 (1 move); λ 2.00 102.7 (no change); λ 0.50 101.9 -> 103.7 (2 moves)`.
- In the seeded build the same polish takes λ 1.00 from 110.8 to 114.3, so the build no longer needs the seed to get there.

### Other cap and slots events

current-rosters, seeded from each event's saved roster, 16 λ starts:

| event | seed | old | new | staff polish |
|---|---|---|---|---|
| Daily Diamond Cap (565) | roster 1912 | 362.3 | 362.3 | no change on its 3 boards |
| Friday Nightmare Cap (569) | roster 2001 | 211.4 | 211.4 | no change |
| Daily Gold Cap (563) | roster 1920 | 339.6 | **340.7** | best board 339.6 → 340.7 (2 moves) |
| PTCS 8 Championship – Cap (9080008, slots) | roster 2013 | 365.7 | 365.7 | no change on the best board |

- **No drops.**
- **Daily Gold Cap's +1.1 is the Bronze pattern again:**
  - Walbert Urena (82, SP) comes in as SP3.
  - Johnny Markham (VAR) leaves the pen.
  - James McDonald (VAR) moves from SP5 to the pen.
  - Tsung-Che Cheng (VAR) → Javier Baez (VAR) on the bench pays the cap.
- This batch ran before the polish skipped its first pass. Skipping it only drops a search that finds nothing, so the scores stand.
- Old batch 4,430 s CPU, new batch 3,627 s. The old one ran under heavier load, so read that as "no blow-up", not as a speedup.

### Where the time goes

Bronze Cap, 4 λ starts, before the polish skipped its first pass:
- main climbs 203 s;
- polish 41.5 s for 3 boards;
- dual phase 16.6 s.

The polish was mostly the full single-and-pair search each board starts with. That search finds nothing on a board where the same moves already stopped, so env-roster's polish now skips it (`atOptimum`).

## Not done

- **Nothing saved to the database.** The new Daily Gold Cap board (340.7) exists only in scratch. The next current-rosters rebuild will find it.
- **No-DH two-way starters (not changed here).** env-roster's last step, `orderStaff`, sorts the rotation by pitching runs alone. With no DH, the objective also counts a two-way starter's bat by his share of the starts, so the re-sort can cost a few tenths. Daily Diamond Cap climbed to 362.5 and printed 362.3, with Babe Ruth sorted to SP3. The old code does the same.
- **The starter stamina floor.** The staff tier ignores it, as the climb always has; env-roster's stamina repair still runs after the climb.
