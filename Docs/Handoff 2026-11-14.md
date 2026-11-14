# Handoff — 2026-11-14 (a dual pick's bench card left off the load file)

Read after `Handoff 2026-11-12.md`, which still holds the access notes, the model and the open lists. Branch: `claude/adoring-mayer-n0gmzv`.

## What happened

Saturday Negro Leagues Slots (779: no DH, slots P4 D4 G4 S4 B5 I5, 26 cards), rebuilt 11-14 with
`current-rosters --only 779 --all --starts 1`: the load file held 25 cards. William Tenny (#84400), the backup
catcher, was on the board, in the roster check ("15 bats", "C backup: William Tenny 64") and in the depth chart
(U1 at C), but not in the BN lines or the load file. L.J. added him by hand as BN7 and re-saved (roster 2193).

## Why

- Ed Rile (#87165) plays 1B on both boards and SP1. A two-way card in both roles is one roster spot in two slots,
  so a dual pick has one bench key more than the event's shape: 5 SP / 7 RP / 14 bats has BN1–BN6, the pick has BN7.
- The rebuild seeds from the saved pick. `seedStart` took it as is (every shape key filled), BN7 included. The climb
  only moves the shape's keys, so Tenny sat in BN7 unpriced; the printout walks the shape, so BN7 was never
  printed; the load file is made from the printout. The roster check reads the board itself, so it counted him.
- The dual phase added its bench key as `BN${shape.benchKeys.length + 1}` = BN7 again. Each try put the new card's
  bat over Tenny: "dual: Ed Rile board holds 25 players, not 26: skipped" three times. That guard went in on 11-01
  for the same cause (Daily Diamond Cap, Early Years Cap).
- The utility men (U1/U2) are the depth chart's view of the bench; they are not slots and never went to the load
  file. Tenny was missing because his slot was.

## The fix

- `roster-fill.ts`: `boardShape` (the shape grown to every SP/RP/BN key the board holds), `offShapeKeys`,
  `nextBenchKey`, `shapeKeys`. `two-way.ts`: `bothRoles`, `playersOn`.
- `env-roster.ts`: a seed with one extra bench key per card in both roles climbs on its own shape and objective
  (BN7 priced, movable, printed); a seed with any other key the shape lacks is refilled. The dual phase's new key
  comes after the board's own bench (BN8 here), a card already in both roles is not re-tried, his arm never takes
  another two-way card's rotation slot, and a try must hold 26 players before it climbs. The printout grows the
  shape to the board once more (with a `!!` line if it had to) and prints any slot no shape can hold.
- `lib/load-file.ts`: the row format (`boardRow`) and its reader (`parseBoardRows`), shared by env-roster and
  current-rosters. A row that does not read is an error, not a skipped line.
- `current-rosters.ts` `toLoadFile`: the load file is held to the board's "26 players" and the roster check's
  "staff S SP / R RP / B bats" (`loadFileShortfalls`). A file that misses a card is not written, so it is not saved.
- Tests: `src/lib/load-file.test.ts` (5), on a 779-like board. 418 pass; typecheck clean.

## Result

The same command now writes `Inbox/rosters/nelslotsweekly-claude-2026-11-13.txt` (the tag is the Chicago day,
11-13 when it ran): 26 distinct cards, BN7 William Tenny. It is slot for slot roster 2193, so nothing needs saving.
The dual tries now come back as 26-player boards (Rile and Luther Farrell both ways, 373.9) and lose to the board
above by less than the 0.5-run margin.

## Still open (not touched)

- The climb's best (373.4) is two staff moves that `orderStaff` undoes before printing (372.8): optimiser audit
  item 9 in the 11-12 handoff (`orderStaff` ignores the dual correction and a two-way starter's bat).
- Tenny's bat is −32.1 runs; he is on the roster as the second catcher (the only C backup the check finds). L.J.'s
  standing wish for a real bat in the utility spot (11-12 handoff) is still open.
