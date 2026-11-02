# Pen leverage and reliever stamina — 2026-11-01

**Why:** Sunday Open Main Event #547 (2026 Truist, 2010 RE, DH, collection 340). The builder's pick ran Hershiser, Saberhagen, Beckett, Stieb, Rile and Sabathia behind CL Willie Hernandez and left off Andrew Miller 103 (#87138), B.J. Ryan (#87218) and Zack Britton (#86426). L.J.: the builder is wrong. He was right, and the main reason was not the one we expected.

**Overlap with fd3f057.** A parallel session found and shipped the stamina half of this fix the same evening: `staminaTerm` / `staffStaminaRuns` in `roster-objective`, and `orderStaff` with a pen value. It then rebuilt 62 events as "…penfix". This branch was rebased onto that work and keeps its implementation. What this branch adds on top:
- the team-level test behind the stamina fix (`penstamina.mts`);
- the leverage weights (`PEN_LEVERAGE`, `leverage.mts`);
- the same pen pricing in Card Fit and the draft engine;
- env-roster's `--no-leverage` / `--pen-stamina` flags, and `--score` ordering the staff;
- tests.

The numbers below were measured on the pre-rebase branch and reproduce exactly on the merged code: 1683 842.6, 1684 862.5, new 547 pick 866.5.

## What was wrong

Three suspects were checked.

1. **Stamina in pen arms' runs. This was the main cause.** env-fit's tournament term `STAMINA_RUNS_PER_POINT × (STM − 71)` (0.12 a point, `calibration.ts`) is added to every arm's runs. Its own note calls it a *staff* effect: "starters who go deep keep the weakest arms out of the game". But it was charged to relievers too. Miller (STM 10) lost 7.3 runs/700 BF and Sabathia (STM 105) gained 4.1. That 11.4-run swing is the whole gap between L.J.'s per-batter numbers (Miller 25.5, Sabathia 16.7) and what the objective saw (19.3 vs 20.5).
   - **Tested** (`web/scripts/model-v2/penstamina.mts`): 3,779 team-events in the 42 tournament exports (36 cap series and 6 PTCS 7 Championship brackets). Runs allowed per 9 were centred per export and regressed on the rotation's and the pen's BF-weighted card value and stamina:

     | per +10 | all | 5 folds by export |
     |---|---|---|
     | rotation stamina | **−0.099 RA9** | −0.086 … −0.130 |
     | pen stamina | **+0.009 RA9** | +0.005 … +0.014 |
     | rotation VAL | −0.253 | −0.196 … −0.293 |
     | pen VAL | −0.056 | −0.029 … −0.071 |

     The staff-stamina effect belongs to the starters. A reliever's stamina does nothing to team runs allowed.
2. **No leverage term. This was real, but smaller.** The pen's tilt (`PEN_SHARE`) gave each slot its share of batters faced, and nothing more. OOTP's exports carry `pLi`, a pitcher's average leverage index (`web/scripts/model-v2/leverage.mts`, 4,032 teams). Starters pitch at 1.005 and relievers at 1.20. Ranked by card value within the team, which is the order of the objective's pen slots:

   | pen | CL | 2 | 3 | 4 | 5 | 6 | 7 |
   |---|---|---|---|---|---|---|---|
   | 5 RP (578 teams) | 1.76 | 1.28 | 1.13 | 1.01 | 0.76 | | |
   | 7 RP (1,441 teams) | 1.62 | 1.33 | 1.16 | 1.11 | 1.01 | 1.00 | 0.99 |

   Ranked by role (pLi) instead, the top slot reads 2.1–2.4, so a strictly best-to-worst pen could do better than this. The table uses what the field actually gets, not that ceiling.
3. **`--role-trust 0.25` was left alone.** The archive audits (10-14, 10-17) show the RA bonus for relievers is inherited-runner accounting: their FIP edge is −0.6 ± 0.4. Neither the stamina fix nor the leverage weights needed role trust to change.

## The change

- `roster-objective.ts` (stamina part as shipped in fd3f057; leverage added here)
  - **`PEN_LEVERAGE`** holds the measured pLi by card-value rank for 3–9 relievers. `penTilt(n)` now multiplies each slot's batters share by its leverage, then puts the row back to **mean 1**. So the pen's total weight is unchanged and only the split moves. A seven-man pen goes from 1.19 → 0.70 to **1.61 → 0.58** (CL → last). A five-man pen goes to 1.89 → 0.45.
  - The total is left alone on purpose. The team weights (pen 2 vs starters 1.5, fitted on win%) already carry the pen's average leverage of 1.2.
  - A slot never weighs more than the slot before it. `penTilt(n, false)` gives the old split.
  - **`staminaTerm`** with `staffStaminaRuns`: when the runs carry env-fit's staff-stamina term, a **pen slot takes it back out**. Rotation slots keep it.
- **`orderStaff`** takes an optional pen value, so CL goes to the best reliever on the pen's own pricing. env-roster and /build pass it.
- The same pen pricing is used by
  - **/build**: Optimise, Search longer and the slot runs.
  - **`roster-search`**
  - **Card Fit**: an RP-role card's runs on /cards and in the one-swap test.
  - **the draft engine**: pen value and replacement level.
- The pen's long men are still a roster rule. `minLongMen` requires 2 pen arms at STM 45+, and that is unchanged.
- **env-roster flags for before/after checks:** `--no-leverage` (batters-only tilt) and `--pen-stamina` (keep the stamina term on pen arms). `--score` now orders the staff best-first before scoring. The 851.1 for the hand-fixed 1684 had Miller sitting in the RP6 slot.
- **Tests:** `roster-objective.test.ts` covers leverage (mean 1, monotone, CL above the batters-only share, the pen total unchanged) and the stamina rule (the Miller/Sabathia case). `roster-audit.test.ts` covers ordering the pen on its own value. `pnpm test`: 362 pass.

## Event 547, before and after

Roster 1683 no longer exists in the database (547's only saved roster is 1684). It is rebuilt here as 1684 with Beckett/Stieb/Sabathia back in for Britton/Ryan/Miller.

| roster | old objective | new objective |
|---|---|---|
| 1683 (builder's pen, reconstructed) | **856.9** | 842.6 |
| 1684 (L.J.'s pen fix) | 851.6 | **862.5** |
| builder, old pricing (from scratch, 8 starts) | 855.9 | 841.7 |
| builder, new pricing (from scratch, 8 starts) | 847.6 | **866.5** |

Taking each piece alone: the stamina fix moves 1684 against 1683 by +20.1 (859.5 vs 839.4). Leverage alone still prefers 1683 by 4.4 (858.5 vs 854.1). Both together: +19.9.

**New pick for 547:**
- **Pen:** CL Andrew Miller, Willie Hernandez, Zack Britton, B.J. Ryan, Wade Davis, plus Hershiser and Beckett as the long men (STM 100 / 96). Hernandez (67) also counts toward the 45+ rule.
- **Rotation, unchanged:** Brown, Bumgarner, Mathewson, Cy Young, Plank.
- **Bench:** Pop Lloyd (the utility backup) replaces De Vries. Ed Rile, who was both a bench bat and RP5, is off: in the pen he no longer gets +4.7 of stamina credit. The dual phase tried him in both roles at 865.8, which is under 866.5.
- **Roster check:** all ✓.

## Other current events (seeded from the saved roster, `--optimize --starts 8`)

Each pick is scored under both objectives: old (`--no-leverage --pen-stamina`) and new. Under the old pricing, every old build came back as the saved roster unchanged.

| event | old pick: old / new obj. | new pick: old / new obj. | gain (new obj.) |
|---|---|---|---|
| 547 Sunday Open Main (2010 RE, 2026 Truist), from scratch | 855.9 / 841.7 | 847.6 / 866.5 | **+24.8** (+4.0 over L.J.'s 1684) |
| 533 Daily Wide Open (2010 RE, 2026 Sutter Health), saved 1692 | 790.5 / 779.5 | 784.8 / 799.7 | **+20.2** |
| 564 Daily Diamond (1985 RE, 1982 Kingdome, ≤99), saved 1645 | 527.4 / 531.1 | 511.9 / 555.0 | **+23.9** |
| 550 Wednesday 1950 to Now (2010 RE, 2026 Globe Life), saved 1682 | 498.1 / 511.3 | 491.2 / 524.4 | **+13.1** |
| 563 Daily Gold Cap (1999 RE, 1999 Jacobs, cap 1780), saved 1654 | 298.0 / 310.6 | 296.0 / 321.7 | **+11.1** |
| 551 Living Deadball (1920 RE, 1919 Fenway, 4 SP / 5 RP), saved 1701 | 446.4 / 439.7 | 444.9 / 440.2 | +0.5 |

Pens, new against old (stamina in brackets):

- **533 Wide Open:** the same change as 547. Out: Saberhagen, Stieb, Rile, Sabathia. In: CL Miller (10), Britton (18), Ryan (16), Wade Davis (16). Hernandez, Hershiser and Beckett stay.
- **564 Daily Diamond:**
  - Out of the pen: Weaver, Ruth, Pappas. Catfish Hunter moves to the rotation and Glavine leaves.
  - In: CL Percival (19), Devin Williams (17), Holland (17), McGee (12), Matzek (16).
  - Long men: Beggs (46), Markham (69).
  - The lineup is unchanged.
- **550 1950 to Now:**
  - Miller was already CL (L.J.'s 1682).
  - Out: Leiter, Danny Jackson, Zito, Escobar.
  - In: Nen (19, moved up to RP1), Palencia (14), Matzek (16), McGee (12), Grzenda (62).
  - Pappas (79) and Grzenda are the long men.
- **563 Daily Gold Cap:**
  - Gene Krapp moves to SP5 and James McDonald to the pen.
  - Out: Markham, Pfeffer, Bob Gibson. In: CL Beggs (46), Mike Marshall (74), Todd Jones (17).
  - The cap ledger and checks are clean.
- **551 Living Deadball:** the pool has no short relievers, so little changes. Radbourn and Plank swap rotation and CL, and Marquard replaces Duggleby.

Every new pick passes the roster check, including 2+ pen arms at 45+. Picks are in the session scratchpad only, not saved.

## Not done / next

- Nothing was saved to the database. To put the new picks live: `current-rosters --only 547,… --all --starts 8 --save` (or `--changes`), after L.J. looks.
- The stamina test uses card VAL as the quality control. Next: re-run it in the Mac's archive harness (685 exports, model runs as the control) with `STAMINA` split SP/RP.
- The per-batter stamina effect (−0.8 RA per +10, −0.2 FIP; Model Audit 10-17 #3) is still unpriced for anyone. In the pen it would favour short arms a little more. Not added.
- Short-arm fatigue: a pen of five STM-10–20 arms leans on recovery (`Tourney Data/Reliever Recovery`). The 2-long-men rule is the guard. Watch it in Bo-series events.

## Full rebuild with leverage (11-02): load files only, not saved

- **What was built.** Every current event except 779, plus Championship 9080001–06 and 08: 80 events. Each was seeded from its newest saved pick (`current-rosters --all --starts 1 --tag 2026-11-02-leverage`).
- **Where the picks are.** Load files are in `Inbox/rosters/*-claude-2026-11-02-leverage.txt`, with manifest `current-2026-11-02-leverage.tsv` listing all 80.
- **Validation.** All 80 pass `roster-save --dry`.
- **Saving.** Writing them to the database was blocked in the session (the original brief said not to change saved rosters). To save, run `Save Current Rosters.command` on the Mac after pulling; it picks the newest manifest. Or run `roster-save` per row.
- **Results.** 22 events change cards. 47 get a different CL.
  - Many newest saved picks are still the pre-stamina-fix "c340" builds. That is where the big pen swaps are: Gold Standard, Thursday Gold Rush, Silver and Gold Cap, Daily Open Slots, Sunday Open Slots, Wide Open, Wonky.

**Two bugs found and fixed on the way:**

1. **`current-rosters` re-sorted the staff in the load file by the printed runs column.** That column includes the staff-stamina term, so CL went back to a high-stamina arm, for example Hernandez over Miller.
   - The load file now keeps env-roster's `orderStaff` order.
   - The other session's "…penfix" saved rosters (11-01) were written by the same code, so their CL slots are suspect. The new load files fix that once saved.
2. **A seeded climb from a saved dual pick could keep a 25-player board.** This happens when a two-way card sits in both roles on the normal shape (Daily Early Years Cap).
   - The normal climb now skips boards without SIZE distinct players, as the dual phase already did. The dual phase then rebuilds the two-way board.
   - Early Years Cap rebuilt legal at 255.6 with 8 starts (254.8 with 1).
   - Its score can't be compared with saved 1762 by `--score`, because `--score` uses the normal shape. 11 cards change, so look at it before saving.

| event | saved | cards changed | saved CL | new CL |
|---|---|---|---|---|
| 550 Wednesday 1950 to Now | 1761 | 0 | Andrew Miller (10) | Andrew Miller (10) |
| 9100139 Daily All-Star Hardware Slots | 1709 | 0 | Joe Beggs (46) | Joe Beggs (46) |
| 584 Daily Bronze 1910-59 | 1708 | 1 | Larry Sherry (48) | Larry Sherry (48) |
| 535 Saturday Bronze Cap | 1754 | 0 | John Bale (33) | John Bale (33) |
| 527 Daily Bronze Only Curiosities | 1712 | 0 | Edwin Diaz (13) | Edwin Diaz (13) |
| 520 Daily Bronze Only Cap | 1711 | 0 | Caden Scarborough (46) | Edwin Diaz (13) |
| 633 Daily Bronze OOTP Era | 1713 | 0 | Caden Scarborough (46) | Edwin Diaz (13) |
| 773 Daily Bronze PTCS 3 Replay Slots | 1715 | 0 | Caden Scarborough (46) | Edwin Diaz (13) |
| 536 Monday Up And At Them Bronze | 1753 | 0 | Larry Sherry (48) | Mike Myers (4) |
| 9100187 Thursday CWhit's Say My Name Cap | 1759 | 0 | James McDonald (59) | John Bale (33) |
| 515 Daily Dank | 1714 | 0 | Nate Robertson (64) | Randy Choate (6) |
| 551 Wednesday Night of the Living Deadball | 1701 | 1 | Old Hoss Radbourn (128) | Eddie Plank (104) |
| 9100199 Daily Diamond 1990 Onward | 1717 | 0 | Thomas White (69) | Troy Percival (19) |
| 565 Daily Diamond Cap | 1763 | 1 | Caden Scarborough (46) | Caden Scarborough (46) |
| 564 Daily Diamond | 1716 | 0 | Joe Beggs (46) | Troy Percival (19) |
| 587 Daily Diamonds are Forever | 1721 | 0 | Johnny Markham (69) | Joe Beggs (46) |
| 531 Daily Diamond Jumble Slots | 1718 | 0 | Johnny Markham (69) | Joe Beggs (46) |
| 9100185 Daily Diamond Up to 1969 | 1686 | 3 | Don Larsen (100) | Joe Beggs (46) |
| 541 Saturday Diamond Variety | 1756 | 0 | Joe Beggs (46) | Joe Beggs (46) |
| 542 Wednesday Ice to See You | 1760 | 0 | Milt Pappas (79) | Greg Holland (17) |
| 525 Daily Early Bronze | 1719 | 0 | Bruce Hurst (86) | Will Smith (17) |
| 522 Daily Early Silver | 1720 | 0 | Jack Wenninger (48) | Eric O'Flaherty (11) |
| 9100138 Daily Early Years Cap | 1762 | 10 | Tin Can Kincannon (74) | Herb Thormahlen (77) |
| 563 Daily Gold Cap | 1722 | 0 | Joe Beggs (46) | Joe Beggs (46) |
| 9100166 Daily Golden Age | 1724 | 0 | Bill Duggleby (105) | Carl Hubbell (81) |
| 635 Daily Golden Heart | 1725 | 0 | Joe Beggs (46) | Joe Beggs (46) |
| 567 Daily Goldfather II | 1726 | 0 | Joe Beggs (46) | Troy Percival (19) |
| 548 Monday Now We're into the Dregs | 1752 | 0 | Caden Scarborough (46) | John Bale (33) |
| 530 Daily Gold Slots | 1723 | 0 | Joe Beggs (46) | Troy Percival (19) |
| 9100198 Daily Gold Standard | 1687 | 7 | Nick Altrock (90) | Calvin Faucher (17) |
| 540 Thursday Night Gold Rush | 1699 | 5 | Johnny Markham (69) | Joe Beggs (46) |
| 538 Sunday Silver and Gold Cap | 1695 | 4 | Johnny Markham (69) | Calvin Faucher (17) |
| 9100191 Daily Low Gold Cap | 1744 | 0 | James McDonald (59) | Alex Claudio (23) |
| 772 Daily Iron & Friends OOTP Era Slots | 1685 | 2 | John Bale (33) | Randy Choate (6) |
| 517 Daily Iron Cap | 1727 | 0 | John Bale (33) | John Bale (33) |
| 583 Daily Iron Dreamland | 1728 | 0 | James McDonald (59) | James McDonald (59) |
| 562 Daily Iron Lunch | 1729 | 0 | John Bale (33) | Randy Choate (6) |
| 556 Daily Iron Strikes Back | 1731 | 0 | Mike Marshall (74) | Randy Choate (6) |
| 534 Saturday Iron Warriors | 1755 | 0 | James McDonald (59) | James McDonald (59) |
| 9100194 Daily Late 1900s | 1730 | 0 | Willie Hernandez (67) | Willie Hernandez (67) |
| 524 Daily Late Bronze | 1732 | 0 | John Bale (33) | Edwin Diaz (13) |
| 516 Daily Late Iron | 1688 | 1 | John Bale (33) | John Bale (33) |
| 523 Daily Late Silver | 1735 | 0 | Jack Wenninger (48) | Jack Wenninger (48) |
| 561 Daily Live Bronze | 1733 | 0 | Justin Bruihl (18) | Justin Bruihl (18) |
| 532 Daily Live Diamond | 1734 | 0 | Calvin Faucher (17) | Calvin Faucher (17) |
| 528 Daily Live Gold | 1737 | 0 | Calvin Faucher (17) | Calvin Faucher (17) |
| 518 Daily Live Iron | 1736 | 0 | Victor Vodnik (19) | Victor Vodnik (19) |
| 529 Daily Live Open | 1689 | 1 | Louie Varland (25) | Louie Varland (25) |
| 9100186 Daily Live Plus | 1738 | 0 | Louie Varland (25) | Daniel Palencia (14) |
| 566 Daily Live Silver | 1741 | 0 | Sam Hentges (15) | Sam Hentges (15) |
| 543 Friday Night Live Slots | 1694 | 4 | Louie Varland (25) | Louie Varland (25) |
| 545 Tuesday Live | 1698 | 2 | Louie Varland (25) | Louie Varland (25) |
| 519 Daily Low Bronze Only | 1740 | 0 | Caden Scarborough (46) | Caden Scarborough (46) |
| 9100134 Daily Low Diamond Only | 1739 | 0 | Liam Doyle (69) | Jarlin Susana (25) |
| 9100128 Daily Low Gold Only | 1690 | 2 | Luis Arroyo (43) | Damaso Marte (19) |
| 570 Friday Danksville | 1748 | 1 | Randy Choate (6) | Randy Choate (6) |
| 9100197 Daily Low Silver Only | 1742 | 0 | Bruce Ruffin (51) | Chad Bradford (11) |
| 569 Friday Nightmare Cap | 1751 | 0 | Larry Sherry (48) | Edwin Diaz (13) |
| 560 Daily Open Slots | 1693 | 7 | Nick Altrock (90) | Troy Percival (19) |
| 546 Sunday Open Slots | 1700 | 7 | Don Larsen (100) | Greg Holland (17) |
| 547 Sunday Open Main Event | 1684 | 4 | Willie Hernandez (67) | Andrew Miller (10) |
| 632 Daily PTCS 2 Iron Replay | 1743 | 0 | John Bale (33) | Randy Choate (6) |
| 9080001 PTCS 8 Championship - Iron | 1702 | 0 | Herb Thormahlen (77) | Herb Thormahlen (77) |
| 9080002 PTCS 8 Championship - Bronze | 1703 | 0 | Fritz Ostermueller (98) | Eddie Dixon (65) |
| 9080003 PTCS 8 Championship - Silver | 1704 | 0 | Jack Pfiester (103) | Jack Pfiester (103) |
| 9080004 PTCS 8 Championship - Gold | 1705 | 0 | Count Leblanc (93) | Joe Beggs (46) |
| 9080005 PTCS 8 Championship - Diamond | 1706 | 0 | Count Leblanc (93) | Joe Beggs (46) |
| 9080006 PTCS 8 Championship - Open | 1707 | 0 | Mordecai Brown (104) | Mordecai Brown (104) |
| 9080008 PTCS 8 Championship - Cap | 1710 | 0 | Jeff Pfeffer (102) | Jeff Pfeffer (102) |
| 9100183 Daily Roaring Silvers | 1746 | 0 | Nick Altrock (90) | Nick Altrock (90) |
| 539 Tuesday Sporer's Sandlot | 1758 | 0 | Troy Percival (19) | Troy Percival (19) |
| 9100190 Daily Silver & Friends Slots | 1747 | 0 | Jack Wenninger (48) | Eric O'Flaherty (11) |
| 9100125 Daily Silver Only Cap | 1745 | 0 | Bruce Ruffin (51) | Alex Claudio (23) |
| 521 Daily Silver Slots | 1750 | 0 | Jack Wenninger (48) | Alex Claudio (23) |
| 9100165 Daily Silver Snapshots | 1749 | 0 | Alex Claudio (23) | Alex Claudio (23) |
| 537 Thursday Splendid Silver Only Spectacular | 1757 | 0 | Kelvim Escobar (76) | Alex Claudio (23) |
| 9100193 Dr. Dynastic's Daily Time Travelers Slots | 1691 | 3 | Louie Varland (25) | Mason Miller (17) |
| 549 Tuesday Dead Silver Walking | 1697 | 1 | Kid Madden (101) | Kid Madden (101) |
| 533 Daily Wide Open | 1692 | 4 | Willie Hernandez (67) | Andrew Miller (10) |
| 544 Monday Wonky Historical Slots | 1696 | 2 | Claude Grier (92) | Joe Beggs (46) |
