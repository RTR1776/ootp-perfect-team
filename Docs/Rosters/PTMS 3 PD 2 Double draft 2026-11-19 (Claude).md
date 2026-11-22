# PTMS 3 PD 2 Double 101+ (9130005): L.J.'s draft, 2026-11-19 (Claude)

**Saved as roster 2252, "L.J. draft 2026-11-19 (Claude lineup)".**
- Backup: `Docs/Archive/saved-rosters-2026-11-19-3.json.gz`.
- Load file: `Inbox/rosters/ptms3pd2-lj-draft-2026-11-19.txt`.
- Status is "draft" ("card-value eligibility not confirmed"), the same as PD 1's 2233.
- The drafted cards were saved with `--assume-owned` on all 26 ids, because draft cards aren't in the collection.

## How it was drafted

- **Method:** live, by screenshot.
  - L.J. pasted each 12-card pack.
  - Claude read the "POS Name" lines and value badges and ranked the pack with `web/scripts/.scratch/draft-pick.mts`. It runs engine.draftView, the same math as /draft/live.
  - Both picks of each keep-2 round were given in one reply.
- **Position counter:** the game shows a "Positions Seen/Total" counter. 12 each of C, 1B, 2B, 3B, SS, LF, CF and RF, plus 30 SP and 30 RP, make up the 156 cards. `--seen` takes a position the game has used up out of the later rounds.
- **Speed:** 13 rounds took about 25 minutes of the 30-minute clock.

| Round | Tier | Taken | Model's pick |
|---|---|---|---|
| 1 | P 101+ | Hamilton 103 LF, Utley 102 2B | same |
| 2 | P 100 | Matsui 100 DH, Moniak 100 CF | same |
| 3 | D | **Downing 90 LF, Longoria 94 3B** | Morejon 96 RP, Ward 98 CL (L.J.: "not an RP in Diamond"). Finished team 881.5 against 911.3; nearly all of the gap is the pen. |
| 4 | D | Vazquez 94 SP, Nimmala 94 3B | same (Nimmala tied with Doyle) |
| 5 | G | Hagen Smith 88 SP, Niedenfuer 88 RP | same |
| 6 | G | Randy Jones 83 SP, Pierre 82 CF | Henderson 87 SP was the model's nominal top. Its own plan didn't use him, so Claude passed; every pair was within 4 runs. |
| 7 | S | Mack 74 C, Ottavino 79 RP | same |
| 8 | S | Odorizzi 73 SP, Soto 76 RP | same |
| 9 | S | Gregorius 76 SS, deGrom 79 SP | same |
| 10 | B | Murphy 66 RP, Whitaker 63 2B | Flores Jr. C (see Downing below) |
| 11 | B | Furcal 69 SS, Nava 63 RF | same |
| 12 | B | Viola 69 SP, Hicks 60 RP | Viola + Butto, within 0.1 |
| 13 | I | Capps 55 RP, Fowler 53 CF | same |

## The roster

**vs RHP:**
- C Mack
- 1B Nimmala
- 2B Utley
- 3B Longoria
- SS Gregorius
- LF Moniak
- CF Pierre
- RF Hamilton
- DH Matsui

**vs LHP:** the same, except SS Furcal, LF Downing and CF Moniak.

- **Rotation:** Vazquez, deGrom, H. Smith, R. Jones, Odorizzi.
- **Closer:** Niedenfuer.
- **Pen:** Murphy, Ottavino, Soto, Capps, Viola (long), Hicks.
- **Bench:** Downing (backup C), Furcal, Whitaker, Nava, Fowler.

**Score: 235.9** (env-roster `--score` inside the pool). Gregorius at SS vs LHP scores 235.8, a tie.

## Two model bugs found (not fixed)

1. **Draft engine, backup catcher** (`lib/draft/engine.ts` slotRuns). L.J.'s 60 floor shuts out an off-position catcher but not a listed one.
   - Downing (C 45, frame 44) is −13.7 / −12.2 at C.
   - Flores Jr. (C 42) is −44.3 / −42.0.
   - Yet the engine counted only Flores as a backup C. L.J. caught it in round 10.
2. **env-roster `--pool-ids` exact solve.** On this 26 it put Moniak at 1B (rating 11, flagged "under floor") and benched Longoria. It reported 219.2. The hand lineup inside the floors scores 235.9 on the same objective, so the exact solve neither respects the floors nor finds this arrangement.
