# Every current event, 2026-09-29 (Claude)

L.J.: "do the updating for all the current tourneys not just bronze ... just current". Every event that ran within 8 days of the 09-29 dump now has a roster built on collection 174, the one with Matsui and the George Sisler variant. There are 63 of them, plus the 11 built earlier today and Dead Silver, which is left alone.

**What's out:**
- Quicks, drafts and EF events.
- Dead Silver: its 4 SP / 5 RP roster is L.J.'s own shape.

**How they were built:**
- `scripts/current-rosters.ts` read each event's rules from the catalogue (`lib/event-roster-args.ts`).
- Build settings: 26 cards, 14 bats / 5 SP / 7 RP, the optimiser from 16 starts.
- Each is legal on its event's rules.
- Load files are `Inbox/rosters/<series>-claude-2026-09-29-late.txt`, with every card pinned; the manifest is `Inbox/rosters/current-2026-09-29-late.tsv`.

## Rules L.J. confirmed (set by `Set Event Rules.command`, which then runs the save)

- **DH on:** Iron Lunch (also no variants and no park), Live Iron, Live Plus, and Iron & Friends OOTP Era Slots.
- **DH off:** Iron Dreamland and Gold Standard.
- **Monday Wonky Historical Slots:** the post's new format, live since 09-28. That's 13 Diamond, 7 Silver and 6 Bronze slots, cards up to 1949, 2009 RE, no DH, 2026 Coors Field.
- **Tuesday Sporer's Sandlot:** the new format, live since 09-29. Cards are 1980–2026 and 40–89, with a variant cap of 12 and no value cap, 1992 RE, DH, 1992 SkyDome.
- **Value windows:**
  - **Changed:** Daily Dank is cards 49 or lower with 13 variants (the catalogue said 40–59). Silver and Gold Cap is 70–89 (the catalogue said 50–89).
  - **Confirmed as they were:** Goldfather II, Golden Heart and Golden Age at 40–89, and Ice to See You at 90–99.
  - **Any card value (40–105):** Early Years Cap, Late 1900s, Living Deadball, 1950 to Now and Live Plus.

Until those rules are set, the save check shows these events as SKIP. That's by design: they were built to the new rules.

## Also fixed

- **A variant playing a position its base card lacks** failed the save checks. Nimmala's variant has a 2B rating in the export; the base card lists only 3B and SS.
  - roster-save now checks the form the roster actually plays, as Build's own check does.
  - So does Build's save API, which had been refusing to save such a roster.
- **A Live-only set rule now implies 2026 cards.** That answers the field guard that stopped Live Diamond, Live Silver, Live Open and Time Travelers.

## The rosters

Scores are on each event's own scale; compare them within a row. "0 in, 0 out" is a Bronze pick from earlier today, rebuilt on the new collection and unchanged. It's re-saved so Build stops flagging it.

| Event | Score | Saved pick it replaces | Changes |
|---|---|---|---|
| Daily All-Star Hardware Slots (9100139) | 368.5 | none saved | first roster |
| Daily Bronze 1910-59 (584) | -43.3 | Claude pick 2026-09-29 PM | 0 in, 0 out |
| Daily Bronze Only Cap (520) | 88.9 | Claude pick 2026-09-29 PM | 0 in, 0 out |
| Daily Bronze OOTP Era (633) | 68.5 | Claude pick 2026-09-29 PM | 0 in, 0 out |
| Daily Bronze PTCS 3 Replay Slots (773) | 122.6 | Claude pick 2026-09-29 PM | 0 in, 0 out |
| Daily Dank (515) | -195.6 | none saved | first roster |
| Daily Diamond (564) | 312.6 | none saved | first roster |
| Daily Diamond 1990 Onward (9100199) | 235.5 | none saved | first roster |
| Daily Diamond Cap (565) | 195.9 | none saved | first roster |
| Daily Diamond Jumble Slots (531) | 316 | none saved | first roster |
| Daily Diamond Up to 1969 (9100185) | 236.5 | none saved | first roster |
| Daily Diamonds are Forever (587) | 317.7 | none saved | first roster |
| Daily Early Silver (522) | 153.4 | none saved | first roster |
| Daily Early Years Cap (9100138) | 91.1 | none saved | first roster |
| Daily Gold Cap (563) | 209.5 | none saved | first roster |
| Daily Gold Slots (530) | 235.6 | none saved | first roster |
| Daily Gold Standard (9100198) | 195.1 | none saved | first roster |
| Daily Golden Age (9100166) | 40.4 | none saved | first roster |
| Daily Golden Heart (635) | 206.4 | none saved | first roster |
| Daily Goldfather II (567) | 214.3 | none saved | first roster |
| Daily High Silver-Low Gold Cap (9100191) | 190.3 | none saved | first roster |
| Daily Iron & Friends OOTP Era Slots (772) | 40.7 | none saved | first roster |
| Daily Iron Cap (517) | -77.5 | none saved | first roster |
| Daily Iron Dreamland (583) | -75.2 | none saved | first roster |
| Daily Iron Lunch (562) | -76.1 | none saved | first roster |
| Daily Iron Strikes Back (556) | -88.4 | none saved | first roster |
| Daily Late 1900s (9100194) | 271.4 | none saved | first roster |
| Daily Late Bronze (524) | 94.5 | Claude pick 2026-09-29 PM | 0 in, 0 out |
| Daily Late Iron (516) | -78.4 | none saved | first roster |
| Daily Late Silver (523) | 180.6 | none saved | first roster |
| Daily Live Diamond (532) | -30.9 | none saved | first roster |
| Daily Live Gold (528) | -60.6 | none saved | first roster |
| Daily Live Iron (518) | -227.3 | none saved | first roster |
| Daily Live Open (529) | 19.4 | none saved | first roster |
| Daily Live Plus (9100186) | 210.9 | none saved | first roster |
| Daily Live Silver (566) | -115 | none saved | first roster |
| Daily Low Bronze Only (519) | -15.2 | Claude pick 2026-09-29 PM | 0 in, 0 out |
| Daily Low Diamond Only (9100134) | 232.8 | none saved | first roster |
| Daily Low Gold Only (9100128) | 165.5 | none saved | first roster |
| Daily Low Silver Only (9100197) | 86.9 | none saved | first roster |
| Daily Open Slots (560) | 368.2 | none saved | first roster |
| Daily PTCS 2 Iron Replay (632) | -84.3 | none saved | first roster |
| Daily Roaring Silvers (9100183) | -17.2 | none saved | first roster |
| Daily Silver & Friends Slots (9100190) | 246.2 | none saved | first roster |
| Daily Silver Only Cap (9100125) | 126.5 | none saved | first roster |
| Daily Silver Slots (521) | 167.5 | none saved | first roster |
| Daily Silver Snapshots (9100165) | 77.4 | none saved | first roster |
| Daily Wide Open (533) | 418.7 | none saved | first roster |
| Dr. Dynastic's Daily Time Travelers Slots (9100193) | -5.8 | none saved | first roster |
| Friday Night Live Slots (543) | -2.2 | none saved | first roster |
| Monday Up And At Them Bronze (536) | 76.3 | Claude pick 2026-09-29 PM | 0 in, 0 out |
| Monday Wonky Historical Slots (544) | 175.2 | none saved | first roster |
| Sunday Open Main Event (547) | 414.2 | none saved | first roster |
| Sunday Open Slots (546) | 323.3 | none saved | first roster |
| Sunday Silver and Gold Cap (538) | 215.8 | none saved | first roster |
| Thursday CWhit's Cap Challenge 5 (9100187) | 296.8 | none saved | first roster |
| Thursday Night Gold Rush (540) | 235.6 | none saved | first roster |
| Thursday Splendid Silver Only Spectacular (537) | 121.4 | none saved | first roster |
| Tuesday Live (545) | 18.3 | none saved | first roster |
| Tuesday Sporer's Sandlot (539) | 207.3 | none saved | first roster |
| Wednesday 1950 to Now (550) | 197.9 | none saved | first roster |
| Wednesday Ice to See You (542) | 285.9 | none saved | first roster |
| Wednesday Night of the Living Deadball (551) | 127.1 | none saved | first roster |
