# Improvement plan — 2026-11-12

L.J.: "take an overall look at our program, the engine, our results, etc. and put together a plan for improvements, whether engine, UI, testing."

**How this was checked.** Results come from the 11-09 community dump (scripts in the session scratchpad; the method is `pnpm record`'s). I ran the test suite and typecheck, read the handoffs and audits, and queried the database read-only. Four code audits ran in parallel (pricing model, optimiser, UI and drafts, data pipeline); I re-checked the claims I rely on. Anything not re-checked is marked *audit*.

**Not done:** no live screenshots. This cloud environment has no `DATABASE_URL` or site password, so the app could not be run against data. The UI section is from code.

---

## 1. Where you stand

### Constructed tournaments

| Window | Entries | Series W–L | Win % | Pts/entry | Rank among regulars |
|---|---|---|---|---|---|
| May – Sep 16 (before the builder) | 853 | 1003–839 | 54.5% | 2.39 | 255 of 1,094 |
| Sep 27 – Nov 9 | 405 | 650–395 | **62.2%** | **3.53** | **54 of 760** |
| Top 10 players, Sep 27 – Nov 9 | | | 68%+ | 4.9+ | |

"Regulars" are players with 200+ events in the first window and 100+ in the second. An average team wins 50% of its series.

### Perfect Drafts

| Window | Entries | Series W–L | Win % | Pts/entry | Rank among regulars |
|---|---|---|---|---|---|
| May – Sep 16 | 676 | 782–664 | 54.1% | 2.40 | 163 of 888 |
| Sep 27 – Nov 9 | 198 | 226–195 | 53.7% | 2.33 | 158 of 686 |
| Top 10 players, Sep 27 – Nov 9 | | | 60%+ | 3.6+ | |

### What the numbers say

1. **Tournaments moved 8 points. Drafts did not move.** The builder work and your collection's growth landed in the same weeks, so the 8 points can't be split between them from this data. Drafts use no collection, and they are flat, so the draft helper has shown nothing yet.
2. **The gain is in the rule-heavy and middle tiers.** Series win %, before 09-17 → since:

   | Silver | Gold | Cap / slots | Open | Diamond | Bronze | Iron |
   |---|---|---|---|---|---|---|
   | 54 → **67** | 49 → **62** | 49 → **63** | 49 → **60** | 57 → 59 | 58 → 60 | 57 (thin before) |

3. **The gap to the top is in the late rounds.** Since 09-27, 64- and 128-team events, by teams left in the bracket:

   | Teams left | You | Your % | Top 25 % | Gap |
   |---|---|---|---|---|
   | 128 | 117–38 | 75.5 | 71.8 | +3.7 |
   | 64 | 210–107 | 66.2 | 70.8 | −4.6 |
   | 32 | 117–93 | 55.7 | 67.8 | **−12.1** |
   | 16 | 69–48 | 59.0 | 65.3 | −6.3 |
   | 8 | 39–30 | 56.5 | 65.2 | −8.7 |
   | 4 | 21–18 | 53.8 | 61.0 | −7.1 |
   | 2 | 10–11 | 47.6 | 59.7 | −12.1 |

   From the round of 32 on you win 56% (256–200); the top 25 win about 65%. Your teams beat weak fields as well as anyone's. They lose to good teams more often. The late-round gap is there in every tier, Bronze (−11) and Iron (−9) included, so it is not only expensive cards. Variants could still be part of it in the low tiers.
4. **Points are convex, so this is where the points are.** A round-of-32 win in a 128 turns 3 points into 6+.
5. **One in five entries goes to an event that pays you under 2.5 a go.** Since 09-27 (events with 6+ entries; small samples, and some were taken for a category you needed):

   | Lowest | Entries | Pts/entry | | Highest | Entries | Pts/entry |
   |---|---|---|---|---|---|---|
   | Diamond Jumble Slots | 20 | 1.90 | | Daily Late Silver | 7 | 7.86 |
   | Bronze PTCS 3 Replay Slots | 17 | 2.06 | | Dead Silver Walking | 6 | 7.50 |
   | Daily Late 1900s | 13 | 2.38 | | Negro Leagues Slots | 6 | 6.33 |
   | All-Star Hardware Slots | 9 | 2.00 | | Silver Snapshots | 11 | 5.27 |
   | Daily Iron Lunch | 8 | 2.00 | | Goldfather II | 21 | 5.00 |

6. **In drafts the two events you enter most are your worst.** 5L Deadball and 6L Power Play: 47 entries since 09-17, 39–47 (45%), 1.1–1.5 points an entry. Your other daily drafts pay 2.2–3.4. Since the helper went live on 10-26 the two are 18–20 in 20 entries, which is too few to judge.

---

## 2. Broken right now (found tonight, both checked in the code and the database)

1. **Your results table stopped on 10-12.** `web/scripts/import-myresults.ts:28` picks the "newest" dump by file name, and since 10-19 the Quick dump sorts last ("quick" after "competitve"). The fix for this already exists (`newestDumpFile`); this caller was missed.
   - `my_results` has nothing after 10-12, so on /ptcs and /qualifying a PTCS 9 event you played but never screenshotted is not counted, and "Exports to grab" on /upload only sees logged events.
   - It also loaded **262 Quick and EF events carrying 1,159 points** with category tags. Nearly all sit in PTCS 6 (540 points); PTCS 8's PD Daily has 20 that don't belong.
2. **The Monday dump loader still says PTCS 8.** `Load Tourney Dumps.command:19` passes `--period "PTCS 8"`. The 11-02 and 11-09 dumps were stored with the PTCS 8 window, and no dump on file carries the PTCS 9 window, so /ptcs has no rank or 128th-place snapshot for PTCS 9. The projected lines are right (they come from `cutoff-project.ts`, which was edited by hand).
3. **The period is typed in by hand in four places.** The command file, `cutoff-project.ts:17`, `berth-lines.ts:22` (stops at PTCS 7) and `qualifying/page.tsx:36`. Each rollover something goes stale without an error. The next one is 12-07.
4. **`Handoff 2026-11-07.md` is not in git.** The 11-10 handoff says to read it first and points at its "Still open" list.

---

## 3. The plan

Ranked by what I expect each to return for the work.

### A. Keep score automatically (small; do first)

Nothing in the app answers "is this working?". Tonight's tables took two throwaway scripts. Every other item here needs this to prove itself.

- **Scoreboard page** from the dumps alone: series win %, points an entry and rank among regulars by week, tier and event; the round-by-round split against the top 25; drafts beside tournaments.
- **Keep every pick.** Saved rosters are one per event (108 rows for 108 events) and get replaced. Keep each "Claude pick" with its date and the model's score.
- **Grade each run when its export lands:** which of the pick's cards you actually played, the model's predicted edge over the field against what happened, and the series result. Over a month this says whether higher-scored rosters win more, by tier.
- **Grade the seven pre-registered tests from 09-26.** They were written down before the games and, as far as the handoffs show, never graded. Then take a snapshot automatically at every save.
- **Event EV on the picker:** your points an entry beside each event, with the sample size.

### B. Drafts (the largest untouched lever)

Drafts are 40% of your entries, feed three categories, and have not improved all year.

- **Cover what you enter.** The live helper has six formats: 5L, 6L, the PTCS 8 PD Weekly and the three PTMS 3 drafts. About three quarters of your draft entries since 10-01 (All-Gold, All-Diamond, All-Silver, the Perfectos, the weeklies) have only the old Board tab. A format is one entry in `lib/draft/formats.ts`.
- **Decide on 5L and 6L.** They pay you half what the other dailies do. The helper's own study found team value barely tracks wins in the 6L (r 0.09). Fix them, or move those 40-odd entries a month.
- **Log the pack, not just the pick.** Without what was offered, the helper can't be graded.
- **Use drafts to test the model.** Everyone drafts from the same pool, so a draft result is the cleanest read on whether the pricing is right.
- **Phone layout** for /draft/live (see G).

### C. Beat good teams

- **Read the opponents' full rosters.** `Data/OOTP saves 2026-11-02/all_rosters.csv` has 281,668 cards across 111 tournaments with no survivor bias. Compare the teams that reach the round of 16 with yours, by tier: variant share, staff shape, handedness, top-heavy against balanced. This was item 1 of the 11-02 "still open" list.
- **Price against the teams you meet late.** The objective scores runs against the average field. Test a field weighted by how far each team went (their lineups' handedness, their arms).
- **Strategy settings.** Still open from 11-02: the steal grid, the reliever fatigue threshold, the High Leverage role.

### D. Engine

- **Bats are near the ceiling; arms are not.** At 300+ PA/BF the bat model correlates 0.70 with play against a noise ceiling of 0.73. Arms are at 0.54 against 0.72 (Arm Model Audit 10-31).
- **Two held-out arm wins from 10-31 were never built:** the hand-specific LHB blend (0.35 for LHP, 0.50 for RHP) and the low end of the pHR curve.
- **Bronze and Iron** are the model's weakest fields and your weakest early rounds (Iron 58.5% with 64+ teams left).
- **Pin the scorer.** A fixed set of cards with their expected runs, checked in the test suite, so a change that moves prices is seen before a roster is built on it.
- *(pricing audit still running; this section will grow)*

### E. Optimiser

- **/build and the CLI are different optimisers.** The two-way dual phase runs only in `env-roster`. The staff polish runs in `env-roster` and in Search longer, not in Optimise.
- **An exactness check.** The position assignment is tested against brute force. The roster climb as a whole is never compared with a true optimum, even on a small case.
- *(optimiser audit still running)*

### F. Pipeline and guard rails

- **A check before every merge.** There is no CI. Tests and typecheck take 7 seconds and pass (383 of 383; typecheck clean). Lint can't gate yet: 17 errors in `src/`, all in `roster-builder.tsx`, and 311 in `scripts/` *(audit)*.
- **One source for "the current period"**, from the periods table and today's date (§2.3).
- **A calibration guard.** The 10-30 arm-slope collapse (0.58 → 0.26) went live for two days. Refuse to write a calibration whose slope moves more than a set amount without a flag.
- **A page smoke test.** `scripts/check-layout.mjs` exists but isn't wired in, skips eight pages and can't see a page that renders its error screen *(audit)*.
- *(pipeline audit still running)*

### G. App

All from the UI audit; the first, fourth and last I re-checked.

- **A Today page.** `/` redirects to /build, which opens on a select of every event. The daily signals are on four pages: PTCS verdicts, exports to grab, the league week, new cards.
- **/draft/live on a phone.** Seven fixed columns leave about 14 px for the card name at 390 px wide, and "Take" is about 20 px tall (computed from the classes, not rendered).
- **Work is stuck in one browser.** Draft picks, build boards and league-card state live in localStorage. A draft started on the Mac is not on the phone.
- **"What to buy" is answered in six places on two scales.** Market ranks on a league percentile; Needs, By era, Buy plan, Upgrades and Build's Shop rank on model runs.
- **Search longer loses its result if you leave the page**, after minutes of work.
- **/build makes about 18 database calls one after another** on each event switch.
- **`roster-builder.tsx` is 2,444 lines**; one component in it is 1,875.
- **Four unused packages**: react-table, react-virtual, zustand, recharts.
- Sound: auth on every route, undo/redo on /build, keyboard entry in the live draft, dark mode.

---

## 4. Decisions I need from you

1. **The two fixes in §2.** I'm writing them on a branch with tests now. Merge tonight (PR, Vercel green, merge, as usual)? And may I delete the 262 Quick rows from `my_results`? After the merge, one run of Load Tourney Dumps on the Mac refills it through 11-09 and stamps the dumps with PTCS 9.
2. **Order.** I'd do A, then B. Agree, or is something else hurting more?
3. **5L and 6L.** Do you enter them for Live points, or would you rather move those entries?
4. **Cloud access.** Do you want `DATABASE_URL` and the site password added to this environment, as on the old one? Without them a session can't run the app or the pnpm database scripts.
