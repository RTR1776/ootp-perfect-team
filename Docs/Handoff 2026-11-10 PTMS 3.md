# Handoff — 2026-11-10 (PTMS 3 setup). Read after `Handoff 2026-11-07.md`

Access and the authorised workflow are unchanged. Merged today: [PR 179](https://github.com/RTR1776/ootp-perfect-team/pull/179), which adds the PTMS 3 page, seed and draft formats.

## PTMS 3: Saturday 2026-11-21, all six events best of 9
L.J. qualified for both standings (memory: ptms3-qualifying) and enters all six. Points and standings work as in PTMS 1 and 2.

**Catalogue:** `web/src/db/seed/ptms3.json` holds the announcement verbatim plus a `rules` overlay. It was loaded with `import-ptcs6-championship.ts --seed src/db/seed/ptms3.json --id-base 9130000` as events **9130001–9130006** (series "PTMS 3"). Re-running it upserts.
- **9130001 T1 Open:** 1988 RE, 1996 Dodger Stadium, DH, variants on.
- **9130002 T2 Iron:** Cards ≤ 59. Card types are Negro League Star, Historical All-Star, Snapshot, Unsung Heroes and Hardware Heroes (codes 2,5,7,8,9). Variant cap 10. 1998 RE, 1999 Jacobs Field, DH.
- **9130003 T3 Slots:** P0 D8 G6 S6 B6 I0 (entered as ≤ 99). 2019 RE, 1995 Coors Field, DH, no variants.
- **9130004 PD 1 Low of Lows:** cards ≤ 1986, 1986 RE, DH, LE on, 1985 Veterans Stadium.
- **9130005 PD 2 Double 101+:** cards from 1970 on, 2015 RE, DH, LE on, 2015 Angel Stadium of Anaheim.
- **9130006 PD 3 Modified Perfectly Bronze:** 21 cards, 1939 RE, no DH, LE on, 1940 Braves Field.
- Every park has exact-year factors on file. Start times weren't announced (`firstSimEt` "TBA"). The categories are the nearest PTCS ones (Open / Iron / Cap / PD Daily ×2 / PD Weekly) because the importer needs one.

**Page:** `/ptms`, the "PTMS 3" tab beside PTMS · PTWC under PTCS. It shows each event's rules strip, park factors, newest saved roster and links to Build and Upgrades. For each draft it shows the rounds and their assumptions, with links to the live helper and the board.

**Drafts:** `lib/draft/formats.ts` has `ptms3pd1`, `ptms3pd2` and `ptms3pd3`, which appear in /draft/live's event list. No export of any of these formats is on file, so the rounds are partly assumed and flagged on the page. **Ask L.J. to confirm:**
- **PD 1 Low of Lows:** the standard 26 mix, P2 D4 G6 S6 B6 I2. It is unclear whether "Low of Lows" means each tier's low half; the helper can't filter by value inside a tier.
- **PD 2 Double 101+:** P2 (one of them the 101+ round 1) D4 G6 S6 B6 I2. That is the most of each tier on any team in `strugglingsleep_170`, a 101+ RD1 DBL. It is unclear whether "double" means two cards shown per pick or two kept.
- **PD 3 Modified Perfectly Bronze:** 4 Perfect then 17 Bronze, packs of 2, mixed. This copies PTCS 8's Modified Perfectly Iron (L.J., 11-03). The daily Perfectly Bronze runs 14 P / 12 B of 26.
- A draft kit like `PTCS 8 PD Weekly Draft Kit 2026-11-03` was **not** written for these. Do one per PD once the rounds are confirmed.

## Tournament rosters: "Claude pick 2026-11-10" on collection as of 11-10
Built with `current-rosters --only 9130001,9130002,9130003 --all --tag 2026-11-10-ptms3` (16 starts, staff polish, L.J.'s floors, era-table shape). The load files are `Inbox/rosters/ptms3-91300NN-claude-2026-11-10-ptms3.txt`. The full write-up, with the roster-report tables, both lineups, staff and `--- roster check ---` for each, is `Docs/Rosters/PTMS 3 Tournaments 2026-11-10 (Claude).md`.

| Event | Roster | Score | Notes |
|---|---|---|---|
| T1 Open | 2031 | 796.7 | 5 SP / 6 RP / 15 bats. Hader closes; rotation Brown, Yamamoto, Bumgarner, Mathewson, Cy Young (VAR) |
| T2 Iron | 2032 | −64.6 | Exactly 10 variants (the cap). Choate CL over Bale: the scorer's CL slot prefers him, 6.74 vs 5.07 |
| T3 Slots | 2033 | 487.0 | D8 G6 S6 B5 + Bresnahan (Iron) in a Bronze slot, under the backup rule |

- No PTMS 3 exports exist, so the field model is defaults.
- Rebuild after new cards with `current-rosters --changes … --only 9130001,9130002,9130003 --save`. Also consider a 4 SP / 5 RP / 17 version if L.J. wants the championship shape he used for PTCS 8 (memory: championship-staff-shape). These were built at the default 5/7/14.

## Still open
- The draft round questions above.
- The PTMS 3 drafts' `teams` are set to 128 (a guess).
- Everything under "Still open" in `Handoff 2026-11-07.md`.
