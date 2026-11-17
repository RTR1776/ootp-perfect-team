# PTMS 3 drafts and the draft board (Claude, 2026-11-17)

All three PTMS 3 Perfect Drafts are on Saturday 21 Nov. Each is fixed, 128 teams, best of nine, with a sim every 10 minutes. The rules are from L.J.'s event screens of 11-17.

## Update, 11-17 evening: the event screens list every round

L.J. sent the full draft screens. They settle every round question below, and two of the three formats on file were wrong. **This section wins over anything later in this file.**

| Round | PD 1 Low of Lows | PD 2 Double PD | PD 3 Modified Perfectly Bronze |
|---|---|---|---|
| 1 | 2 of 12, Perfect 100 | 2 of 12, Perfect 101+ | **1** of 12, Perfect |
| 2 | 2, Low Diamond 90-94 | 2, Perfect 100 | 2, Perfect |
| 3 | 2, Low Diamond 90-94 | 2, Diamond 90-99 | 2, Perfect |
| 4 | 2, Low Gold 80-84 | 2, Diamond 90-99 | 2, Perfect |
| 5 | 2, Low Gold 80-84 | 2, Gold 80-89 | **1**, Bronze 60-69 |
| 6 | 2, Low Gold 80-84 | 2, Gold 80-89 | **1**, Bronze |
| 7 | 2, Low Silver 70-74 | 2, Silver 70-79 | **1**, Bronze |
| 8 | 2, Low Silver 70-74 | 2, Silver 70-79 | 2, Bronze |
| 9 | 2, Low Silver 70-74 | 2, Silver 70-79 | 2, Bronze |
| 10 | 2, Low Bronze 60-64 | 2, Bronze 60-69 | 2, Bronze |
| 11 | 2, Low Bronze 60-64 | 2, Bronze 60-69 | 2, Bronze |
| 12 | 2, Low Bronze 60-64 | 2, Bronze 60-69 | 2, Bronze |
| 13 | 2, Low Iron 40-49 | 2, Iron 40-59 | **1**, Bronze |
| **Cards** | 2 P, 4 D, 6 G, 6 S, 6 B, 2 I (26) | 4 P (2 of them 101+), 4 D, 4 G, 6 S, 6 B, 2 I (26) | 7 P, 14 B (21) |
| Starts | 07:59 AM | **08:29** AM | 08:49 AM |

**What was wrong on file:**
- **PD 3** was 8 Perfect / 13 Bronze. It is **7 / 14**. Round 1 keeps 1 Perfect, and rounds 5-7 and 13 keep 1 Bronze. The save-file inference below got the 12-card rounds right and the counts wrong.
- **PD 2** was 1 Perfect 101+, 1 Perfect, 4 D, **6 G**. It is **2 + 2** Perfect and **4 Gold**. Start time 08:29, not 08:30.
- **PD 1's** split was right. Its Perfect round is **100 only**; the helper had it uncapped.

**What the helper does with it** (`lib/draft/formats.ts` `screens`):
- It knows which of the 13 rounds you're on from the picks made: "Round 5 of 13 · pick 1 of 1 from 12". A strip of 13 chips shows the rounds, done and to come.
- **Keep is per round.** In PD 3 the pack clears after one pick in rounds 1, 5-7 and 13, and stays up for a second pick in the others. The keep box is gone for these drafts.
- **The rounds to come are priced per round.** A "pick 1 of 12" round is the best of 12. A "pick 2 of 12" round is about the best of 8 for each pick. Before, every round was priced at 8.
- **Value bands:** PD 1 Perfect 100 only; PD 2 round 1 101+ and round 2 100 only. A typed 102 in PD 2 goes to the 101+ round and a 100 to the 100 round.
- If a screen on the day shows something else, setting the counts by hand under "picks left · set" drops the round list and gives back the keep box.

**Still assumed:** 128 teams in each (no exports), and positions mixed in each pack (the screens don't say).

| | PD 1 Low of Lows | PD 2 Double PD | PD 3 Modified Perfectly Bronze |
|---|---|---|---|
| Starts | 07:59 AM | 08:29 AM (was 08:30 on file) | 08:49 AM |
| Environment | 1986, DH | 2015, DH | 1939, no DH |
| Park | 1985 Veterans Stadium | 2015 Angel Stadium of Anaheim | 1940 Braves Field |
| Cards | up to 1986 | 1970 on | any year |
| Rounds in the helper (before the update above) | 2 P, 4 D, 6 G, 6 S, 6 B, 2 I (26) | 101+ round, 1 P, 4 D, 6 G, 6 S, 6 B, 2 I (26) | 8 P, then 13 B (21) |

The park factors on file match each screen to the third decimal.

## Confirmed from data

**Round order: usually top tier first.**
- The game keeps each Perfect Draft in a `draft_…pt` save folder. Its `text_data` log adds the drafted cards in pick order. I read copies of L.J.'s 17 saves from 11-11 to 11-17 and never wrote to the game folder.
- 6 of the 8 drafts that ran Perfect down to Iron dealt Perfect, then Diamond, Gold, Silver, Bronze, Iron. One mixed Perfect and Diamond picks before going down; one came in no order.
- Both Perfectly-X drafts (8 P + 18 I, and 12 P + 14 D) dealt all their Perfect picks first.
- The Bronze drafts go bottom up. The 6L Power Play dealt Bronze, then Iron, Bronze, Silver, Gold, so the 6L is not marked as ordered.
- So the order is likely, not confirmed, for PTMS 3. If a pack doesn't match, typing its first card sets the round.

**PD 3 is 8 Perfect, then 13 Bronze.** The screen says "four rounds of Perfect cards followed by nine of Bronze, you will only pick 21". Three points of evidence:
- **The game save:** the 26-card Perfectly Iron in the 11-11 save dealt 8 Perfect, then 18 Iron. That is 13 rounds of two picks, 4 Perfect and 9 Iron.
- **The cut to 21:** a draft that stops at 21 cards leaves 8 Perfect and 13 of the second tier.
- **PTCS 8's Modified Perfectly Iron** came out the same way. L.J.'s team (his 11-07 screenshots) had 8 Perfect cards and 13 Iron. The Perfect eight were Trout, Yastrzemski, Gibson, Hornsby, Jeter, Will Clark, Jud Wilson and Cedeno.
  - Trout is counted as the 103: he batted 2nd and 3rd. The other Trout card is a 51.
  - The helper had that event as 4 Perfect and 17 Iron, and PD 3 as 4 and 17. Both are fixed.

**PD 1's "bottom level of each tier" is the game's own "Low" band.** The catalogue's events define each band:

| Event | Band |
|---|---|
| Daily Low Diamond Only | 90–94 |
| Daily Low Gold Only | 80–84 |
| Daily Low Silver Only | 70–74 |
| Daily Low Bronze Only | 60–64 |
| Low Iron Quick | 49 and under |

- Tier values on file: Perfect 100–104, Diamond 90–99, Gold 80–89, Silver 70–79, Bronze 60–69, Iron 40–59.
- **L.J.'s reading doesn't match.** He read it as 94 and under for Perfect and 84 for Diamond. Each of those numbers is one tier off: 94 is the Diamond ceiling and 84 the Gold.
- **Not confirmed: the Perfect rounds.** No event on file defines a low Perfect band, so the helper leaves them uncapped (100–104).
  - If the PD 1 screen shows Perfect cards of 100 only, the board's Perfect column runs high.
  - Every typed card is still accepted.

**PD 2's round split.** The one Double 101+ draft on file is `strugglingsleep_170` (Daily Struggling to Sleep - DBL, 101+ RD1). It drafted exactly 2 P, 4 D, 6 G, 6 S, 6 B, 2 I on all 3 full teams.

## Assumed

- **PD 1's split** is borrowed from that same double draft. Two of L.J.'s recent ladder drafts in the saves (11-13 and 11-16) ran 4 P, 4 D, 4 G, 6 S, 6 B, 2 I instead, so the split varies by event.
  - If the screen shows another split, set it under **rounds left · set** on the live helper. It is kept per draft in the browser, and the board follows it.
- **PD 2's 101+ first round:** the 11-10 announcement says "Double 101+", but the 11-17 screen says only "Double PD".
- **What "double" means** is not on file. Every tier count in the double draft is even, and so is every ladder in the saves, so it may just mean two picks a round.
- **Packs (changed 11-17, second PR):** every round shows about 12 cards, positions mixed, and you keep 2, in all three drafts. See "What a round is" below.

## The big board

**Bug (reproduced 11-17).** `/draft?t=9130004/5/6`, the "Board by position" link on /ptms, ranked every tier together. The top 15 at C, SS, CF and SP were mostly Perfect cards in all three drafts, and PD 3 listed Diamond and Gold cards it can never deal. The board didn't follow any round, and its taken marks were a separate list that never saw the live helper's picks. The card-year limits were already applied (1871–1986 and 1970–2026).

**Fix.** For an event whose draft format is on file, the board is now a round board (`components/draft/round-board.tsx`):
- **It follows the draft's round.** That is the round chosen on the live helper; else the round the typed pack's first card fits; else the next round in order. Chips above the board look ahead at a later round until the next pick.
- **It shows only that round's pool:**
  - the round's tier, inside its value band;
  - only the groups the round can deal (the 6L's position rounds included);
  - only the cards the event allows.
- **It drops anyone drafted.** Picks are the live helper's, shared through the browser's storage, so a pick on either page leaves both, across tabs too.
  - Clicking a card on the board takes it as the round's pick. Undo takes it back.
- **It scores cards as the live helper does:** the production model in the event's environment and park, with glove and framing at this event's prices and L.J.'s glove floor.

Events without a format on file keep the old board.

**Live helper changes:**
- The round on screen defaults to the next round in order. Before, a draft with more than three kinds showed nothing until a round was clicked.
- Rounds play out in their real order.
- The round counts can be set on the page.
- The loader keeps only the tiers a draft's rounds deal from, so PD 3's replacement levels come from Perfect and Bronze cards only.

## Not done

- The catalogue rows 9130004–06 still say start "TBA" and no field size. I didn't write to the database. The screens give local times, so check the time zone before setting `firstSimEt` (it is ET).
- Three of the 11-13..11-14 saves dealt a 22-card Bronze draft: 18 B, 2 I, 1 S, 1 G. That isn't the 5L's 21-card format on file. Worth a look if those were 5L Deadball entries.

## What a round is (added 11-17, after L.J.'s account)

**L.J.'s account:**
- A Perfect round shows "12 or so" Perfect cards and you choose one.
- PD 3 is probably 4 Perfect rounds of 1 pick, then 9 Bronze rounds of 2: 22 cards, not the 21 the screen says.

**What the saves show.**
- The game numbers every card in a draft with a running ID (`7729NNN` in `players.dat`). In each 26-card draft the IDs rise with pick order and top out at 147–155, about 13 × 12.
- In five drafts the picks fall two to a block of 12, so each round is about 12 cards with 2 kept:

| Save (`saved_games/`) | Taken | Fit |
|---|---|---|
| `draft_7ea200000000000000003c4a7729.pt` (11-11 19:01) | 8 Perfect, then 18 Iron | 23 of 25 readable picks |
| `draft_7ea200000000000000003d7a7729.pt` (11-12, all Perfect) | 26 Perfect | 24 of 26 |
| `draft_7ea200000000000000003da67729.pt` (11-13, ladder) | ladder | 23 of 25 |
| `draft_7ea200000000000000003d187729.pt` (11-16, ladder) | ladder | 26 of 26 |
| `draft_7ea200000000000000003d557729.pt` (11-17, 12 P / 14 D) | 12 Perfect, 14 Diamond | 25 of 26 |

  - **"About 12 cards, keep 1" fits 0–1 picks in every draft.** It would need IDs up to about 312.
  - The 11-11 save is the one most like PD 3. Its 8 Perfect picks came 2 per block from the first four blocks (IDs 2, 8 | 16, 20 | 29, 31 | 43, ?), then 18 Iron 2 per block.
- **The other drafts don't fit a simple pattern:** 11-11 20:54, 11-14 01:15, 11-14 12:50, 11-14 18:20, 11-17 11:06, the 6L and the 22-card Bronze drafts. In the 11-17 11:06 save, the 4 Perfect picks all came from cards 1–10. So the mechanics vary by event.
- **This rests on one inference:** that the ID counts every card shown. The fit is close and the maximum matches 13 rounds of 12, but the game doesn't say so.
- **There is no PD 3 save**, and no Modified Perfectly Iron save is on disk. The 11-12 save (`…3d577729`) is an empty draft.

**Reconciled:**
- **12 cards a round:** L.J. is right.
- **One pick per Perfect round:** the data say no. His own PTCS 8 Modified Perfectly Iron team, the 21-card version, had 7 or 8 Perfect cards (8 if his Trout is the 103). With one Perfect pick a round it would have had 4.
- **So PD 3 stays 8 Perfect and 13 Bronze.** Nine 2-pick Bronze rounds would make 26 cards, so either the draft stops at 21, or some Bronze rounds keep 1. The cards come out 8 and 13 either way.
- **If the screen keeps only 1 Perfect a round,** set Perfect to 4 and Bronze to 17 under "picks left · set".

**The helper now:**
- defaults to packs of 12, keep 2, mixed, for PD 1, PD 2 and PD 3;
- keeps the pack up after the first pick, so the second comes from the same 11 cards;
- prices each pick as the best of about 8 (keeping 2 of 12);
- treats round counts as picks.

It is solo, not a snake draft: other drafters never enter it.
