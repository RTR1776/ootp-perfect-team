# Improvement plan — 2026-11-12

L.J.: "take an overall look at our program, the engine, our results, etc. and put together a plan for improvements, whether engine, UI, testing." Then: "fully implement", and "make sure you think the model is the best it can be as well."

**How this was checked.** Results come from the 11-09 community dump. I ran the test suite and typecheck, read the handoffs and audits, and worked against the database. Four code audits ran in parallel (pricing model, optimiser, UI and drafts, data pipeline). Everything under "Fixed" I verified myself in the code and, where it touches data, in the database. Findings I have not re-checked are marked *audit*.

**Not done:** no live screenshots of the app. The UI section is from code.

**Where the work is:** [pull request 181](https://github.com/RTR1776/ootp-perfect-team/pull/181) (merged: sections 2 and 3) and [pull request 182](https://github.com/RTR1776/ootp-perfect-team/pull/182) (the draft setup, the scoreboard and the optimiser's cap tier).

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

   From the round of 32 on you win 56% (256–200); the top 25 win about 65%. Your teams beat weak fields as well as anyone's. They lose to good teams more often. The gap is there in every tier, Bronze (−11) and Iron (−9) included, so it is not only expensive cards. Variants could still be part of it in the low tiers.
4. **Points are convex, so this is where the points are.** A round-of-32 win in a 128 turns 3 points into 6 or more.
5. **One in five entries goes to an event that pays you under 2.5 a go.** Since 09-27 (events with 6+ entries; small samples, and some were taken for a category you needed):

   | Lowest | Entries | Pts/entry | | Highest | Entries | Pts/entry |
   |---|---|---|---|---|---|---|
   | Diamond Jumble Slots | 20 | 1.90 | | Daily Late Silver | 7 | 7.86 |
   | Bronze PTCS 3 Replay Slots | 17 | 2.06 | | Dead Silver Walking | 6 | 7.50 |
   | Daily Late 1900s | 13 | 2.38 | | Negro Leagues Slots | 6 | 6.33 |
   | All-Star Hardware Slots | 9 | 2.00 | | Silver Snapshots | 11 | 5.27 |
   | Daily Iron Lunch | 8 | 2.00 | | Goldfather II | 21 | 5.00 |

6. **In drafts the two events you enter most are your worst.** 5L Deadball and 6L Power Play: 47 entries since 09-17, 39–47 (45%), 1.1–1.5 points an entry. Your other daily drafts pay 2.2–3.4. You enter them for the October–December top-128 rewards, so the job is to get better at them (section 5, B).

---

## 2. Fixed tonight

| What was wrong | Effect | Now |
|---|---|---|
| **Position ratings wiped by every card-list import.** The list carries only the positions printed on a card; the harvest that fills the rest needs the Mac's archive. | After the 11-12 list, 2,717 ratings on 859 hitters read 0, 934 of them 60 or better (Carson Williams' 139 at 2B, the 2003 A-Rod's 132 at 3B). No roster built after the list that went in on the evening of 11-10 could use those positions. | The imports put them back themselves from the table the harvest already fills. Live table repaired: 0 missing. |
| **Results table stopped on 10-12.** The importer read the Quick dump as the newest. | /ptcs and /qualifying missed any PTCS 9 event you didn't screenshot. 262 Quick and EF events sat in the table with 1,159 points they never scored. | Fixed; table reloaded through 11-09 (2,273 events), Quick rows gone. |
| **The Monday loader still said PTCS 8.** | The 11-02 and 11-09 dumps were filed under PTCS 8, so /ptcs had no rank or 128th-place line for PTCS 9. | The loader works the period out from the dump. The two dumps are scored for PTCS 9. |
| **Speed and Stamina were blended away** in env-roster and Card Fit (so in every Claude pick, Upgrades and Buy Plan). Play is wOBA and FIP, which see neither, but the blend's reference carried both, so a card with 3,000 PA on record kept 30% of its own Speed or Stamina value. /build did it right. | A Stamina-104 starter with play was priced ~4 runs low in the rotation; a Stamina-10 reliever with play ~4 high in the pen. The CLI and /build disagreed about the same card. | One shared reference for every surface. Test added. |
| **Pen candidates ranked on the wrong number.** The search's shortlists ordered relievers on runs that still carried the stamina term the pen slot removes. | A Stamina-10 reliever sat 10.8 runs below a Stamina-100 arm of the same pen value, so short relievers were the ones cut from the lists. | Ranked on the pen's own price. |
| **A bad calibration could ship.** | 10-30: one card took the arm slope from 0.58 to 0.26 and every roster was mispriced for two days. | `model:calibrate` refuses to write a fit unlike the one in use. The 10-30 fit is a test case. |
| **The batch saved rosters that fail your roster check.** It looked only at the rule validator. | A build short a long man or a backup was saved as a Claude pick. | A ✗ in the roster check keeps a build out of the save. |
| **Nothing checked a change before it deployed.** | | CI runs typecheck and the tests on every pull request and push to main. |
| A bare `env-roster` priced relievers 3.4 runs high (role trust 1, not 0.25). | Only by-hand runs; the batch passed 0.25. | Default is 0.25. |

Tests went from 383 to 406; all pass.

### Built after the fixes

| What | Why | Where |
|---|---|---|
| **Live draft for any draft.** Enter the rounds by tier, the run environment, park and DH the event screen shows; the same engine runs on that. | The helper had six formats. About three quarters of your draft entries are other events, most in a random environment with no rules on file. | /draft/live → "Any draft" |
| **The draft board on a phone.** | At 390 px the card name had about 14 px and overlapped the next column. Checked in a browser. | /draft/live |
| **Scoreboard.** Your series record and points an entry by week, category, event and round, with your rank among regulars. Rewritten by every Monday's dump load. | Section 1 took two throwaway scripts. | /scoreboard, a tab under PTCS |
| **A cap tier in the optimiser:** one upgrade paid for by two cheaper cards. | Section 4, item 1. On the brute-force cases: 16 misses of 60 down to 10, average gap 0.73 runs down to 0.22, worst 10.1 down to 2.7, for 8% more time. | Roster builds and Search longer |
| **The search is now tested against brute force.** | Nothing compared the climb with a true best roster. | the test suite |
| **Rebuild of all 74 current events** on the fixed pricing, saved as "Claude pick 2026-11-12 review". Every roster as it stood before is backed up in `Docs/Archive`. | Section 5 A. | /build |

---

## 3. The model

**What I checked:** the pricing audit's ten findings, the calibration re-run on today's data, and the shape of the calibration.

**Where it is strong.** Bats sit near the noise ceiling: at 300+ PA the model correlates 0.70 with play against a ceiling of 0.73 (Arm Model Audit 10-31). On today's refit the calibrated model is within about a run of play in every value tier. By release month it is within 1.5 runs except March-release bats, which run 2.6 under. The pricing audit scored all 3,708 base cards in seven environments and found none that prices as NaN or blows up.

**Where it is not.**

1. **The bat calibration bends, and one slope hides it.** The app scales every bat's modelled runs by 0.50. Measured on 15,442 card-series lines:

   | Modelled runs above average | What a modelled run returns |
   |---|---|
   | below +16 | **0.66** |
   | above +16 | **0.35** |
   | one slope (in use) | 0.50 |

   So ordinary bats are squeezed too hard, and the gap between two elite bats is paid about half again too much. Held out by series, two slopes beat one in **40 of 40** half-splits, and in 38–39 of 40 when each event is scored in its own environment. It shows in every era band that has elite bats. Arms show no bend.

   **It is built and switched off.** Your bar for a pricing change is held-out wins, and that harness needs the Mac's archive. There is also a reading I can't rule out from here: elite bats sit on teams that go deep and face better pitching, which would flatten their lines without the ratings being wrong. `model:calibrate` now measures the bend at every refit. One flag turns it on (`hit.bend.applied` in `model-calibration.json`).
2. **Arms have room.** 0.54 against a ceiling of 0.72. Two held-out wins from the 10-31 audit were never built: the left-handed-batter share by pitcher hand (0.35 for LHP, 0.50 for RHP; the code uses 0.45), and the low end of the pHR curve.
3. **FIP can't see pBABIP**, and the blend reads arms against FIP. So a high-pBABIP arm's edge is shrunk by the blend the same way Speed was. Not fixed; it needs its own test.
4. **Surfaces that price differently** (*audit*, not yet fixed):
   - /build's Buy box and Shop tab use raw glove runs, no framing and no leverage.
   - Card Fit, Upgrades and Buy Plan weigh every pen and rotation slot alike. The builder weighs the closer 1.61 and the seventh arm 0.58, so a closer-grade buy is understated by up to 38%.
   - /cards' top panel applies no era correction.
   - The glove floor is 60 everywhere on /build and SS 85 / CF 90 / 2B 85 / RF 75 in Claude picks.
5. **No pinned prices.** Nothing fails when a change moves what the scorer says about a card.

---

## 4. The optimiser

From the optimiser audit, which tested the search against brute force on small cases. Two items are fixed (section 2). The rest:

1. **Under a cap the search is not exact.** On 60 random capped 13-man cases it missed the true best roster in 19 (mean gap 1.1 runs, worst 10.1). Uncapped it was exact every time. Most misses needed one upgrade paid for by two downgrades. **That move now exists** (the cap tier, above): 10 misses, mean gap 0.22. The ones left need a bat move and a staff re-solve together; an exact solver (item 7) is the way to close them.
2. **Position floors bind only cards moving in.** A board that starts with an under-floor glove keeps it unless replacing him gains runs, and reports legal.
3. **/build and the CLI are different searches.** The two-way dual phase is CLI-only. Optimise has no staff polish, seven starts and a 45-second cut, so its answer varies with how busy the machine is.
4. **The stamina repair runs after the search** and can cost a long man.
5. **Staff caps (5 / 7 / 12) are not in the search**, only in the starting shape.
6. **Speed.** One capped climb is 25 seconds and 477,000 whole-board evaluations, 18 seconds of it in pair moves.
7. **An exact answer is within reach.** The objective is linear enough for an integer program; even its bound alone would tell every build how far from best it is.

---

## 5. What is left, in order

### A. Rebuild the rosters (running)

Every Claude pick was built on the old blend, and ten were built while positions were missing. All 74 current events are being rebuilt from their saved rosters; this is a first pass (one climb each, plus the staff and cap polish). The events you play most deserve a deeper search afterwards.

### B. Drafts

- ~~Cover what you enter~~ and ~~the phone layout~~: done (section 2).
- **5L and 6L.** Find why they lose. The helper's own study found team value barely tracks wins in the 6L (r 0.09). This needs the Mac's export archive.
- **Log the pack, not just the pick**, so the helper can be graded.
- **Confirm the presets.** "Any draft" assumes each round's pack is mixed positions, six cards. Tell me where an event differs.

### C. Keep score automatically

- ~~A scoreboard page~~: done (section 2).
- Keep every pick (saved rosters are one per event and get replaced) and grade it when the run's export lands.
- Grade the seven pre-registered tests from 09-26, which the handoffs never show graded.

### D. Beat good teams

- Read the opponents' full rosters (`Data/OOTP saves 2026-11-02/all_rosters.csv`, 281,668 cards, no survivor bias): what do teams that reach the round of 16 carry that yours don't?
- Price against the teams you meet late, not the average field.
- The strategy-setting tests still open from 11-02.

### E. Model and optimiser

Sections 3 and 4, in the order listed there.

### F. Pipeline (*audit*)

- **The export archive is one copy on the Mac**, and the importer would shrink the database to match a damaged copy.
- **Neon keeps six hours of history and no snapshots.** Saved rosters, catalogue rules and price history live only there.
- Card and league imports are not transactions; a killed run leaves a partial upload as the newest.
- No team-count check on a filed export. Three sliver-sized files are live: `bronzeootp_165`, `latesilver_182`, `goldfather_181`.
- `observed_card_stats(card_id)` has no index (54,000 sequential scans on a 323 MB table).
- The period is still typed by hand in `cutoff-project.ts`, `berth-lines.ts` and `qualifying/page.tsx`.
- `engine/` (Python) is dead code. The README and RUNBOOK are stale in places.

### G. App (*audit*)

- **A Today page.** `/` redirects to /build, which opens on a select of every event. The daily signals are on four pages.
- **Work is stuck in one browser.** Draft picks and build boards live in localStorage; a draft started on the Mac is not on the phone.
- **"What to buy" is answered in six places on two scales.**
- **Search longer loses its result if you leave the page.**
- /build makes about 18 database calls one after another on each event switch.
- `roster-builder.tsx` is 2,444 lines. Four unused packages.

---

## 6. What I need from you

1. **Run the bend's win check on the Mac** (or have a session there do it). Build the team harness twice, bend off and on, then compare on wins:
   - `MV2_TOURDIR=Archive/Completed MV2_NO_LEAGUE=1 MV2_DIR=/tmp/h-off node --import tsx scripts/model-v2/teams.mts`
   - set `hit.bend.applied` to `true` in `web/src/data/model-calibration.json`, then the same command with `MV2_DIR=/tmp/h-on`
   - `python3 -I scripts/model-review/endtoend.py /tmp/h-off /tmp/h-on`

   Adopt at 37 of 40 or better.
2. **Start OOTP cloud sessions on the "LJC" environment.** It has the database variable, the site password and open network. Tonight's session started on "Default", which has none of them.
3. **`Handoff 2026-11-07.md` was never committed.** If it is on the Mac, push it; its "Still open" list is referenced and lost.
4. **Back up the archive.** One copy of 935 export files is the weakest point in the whole setup.
