# PTMS 3 PD 3 Modified Perfectly Bronze (9130006): L.J.'s draft, 2026-11-19 (Claude)

**Saved as roster 2255, "L.J. draft 2026-11-19 (Claude lineup)".**
- Backup: `Docs/Archive/saved-rosters-2026-11-19-5.json.gz`.
- Load file: `Inbox/rosters/ptms3pd3-lj-draft-2026-11-19.txt`.
- Status is "draft", the same as 2233 and 2252: card-value eligibility isn't confirmed for draft events.
- Lineup: env-roster `--pool-ids`, the exact solve as fixed by PR 200, inside L.J.'s floors. Objective 262.5.
- Setup: 1939 run environment, no DH, 1940 Braves Field.

## The 21

**Batting order vs RHP:**
1. Raleigh C
2. McGonigle SS
3. C. Smith LF
4. Hamilton CF
5. Arias 2B
6. Williamson 3B
7. Castillo 1B
8. Barfield RF
9. Pitcher

**Batting order vs LHP:**
1. McGonigle SS
2. Arias 2B
3. Williamson 3B
4. C. Smith LF
5. Hamilton CF
6. Raleigh C
7. Barfield RF
8. J. Hernandez 1B
9. Pitcher

- **Rotation:** Kershaw, Wood, Getzien, Haefner, Powell.
- **Closer:** Matsui.
- **Pen:** Lines, McDougal (long), McLish.
- **Bench:** Avila (backup C), Simmons (SS backup), J. Hernandez (1B vs LHP), V. Scott II (CF backup).

**Roster check:**
- Three items fail:
  - only one stamina arm in the pen (McDougal);
  - no 2B backup on the bench at the 85 floor;
  - no RF backup at the 75 floor.
- None can be fixed with the 21 drafted.
- Avila is the only second catcher (C 52, a listed C).

## How it went

- Drafted live by screenshot with `web/scripts/.scratch/draft-pick.mts`, on the pre-PR-200 engine.
- **Perfect rounds:** McGonigle, Raleigh, Arias, C. Smith, Williamson, Hamilton, Kershaw, all the model's picks.
  - Round 2 graded +15.7 over a typical pack.
  - Round 4 gave Hamilton +37.5.
- **Bronze rounds:**
  - The model kept ranking bench bats first, by small margins. It counts on the keep-2 rounds to bring better starters, so it takes the card that changes the least.
  - L.J. picked on role inside that noise: McLish, Haefner, Simmons, Lines, V. Scott II, Barfield (+14.8), McDougal, Powell, J. Hernandez, Wood (+6.1), Matsui, Getzien (+5.1), Castillo, Avila.
- **Rod Carew** (2B 58, vs LHP BABIP 200 / Eye 119 / Power 5): the model had him −10.1 vs LHP. Not checked whether it under-rates extreme BABIP ratings; worth a look.

## Engine change that night

- PR 200's C 45 backup-catcher floor moved this draft's round-1 board: Lajoie went from −7.9 to −24.0.
  - Old-timers with a C rating counted as backup while starting elsewhere (Ed Williamson, 3B with C 47).
- On L.J.'s word the draft engine was put back to its pre-PR-200 rule in PR 201 (merged 5d65f5b). PR 200's fixed-pool builder fix stays.
