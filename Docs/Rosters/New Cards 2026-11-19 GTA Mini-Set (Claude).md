# New cards: GTA Mini-Set (shop list 416, 2026-11-19)

Eight cards, series "GTA Mini-Set", first seen in shop list 416 (11-19). None owned. The builds below assume Keuchel 87450 and Morton 87586 are owned (11-18 Clubhouse buys, not yet in a collection upload; the newest collection is 414).

| Card | Id | Value | Type |
|---|---|---|---|
| Gary Sheffield RF, FLO 1996 | 87573 | 103 | Historical All-Star |
| Jason Schmidt SP, SF 2003 | 87572 | 102 | Historical All-Star |
| Jason Giambi 1B, NYY 2002 | 87571 | 100 | Historical All-Star |
| Sandy Alcantara SP, MIA 2022 | 82679 | 99 | Hardware Heroes |
| Kyle Barraclough RP, MIA 2016 | 87568 | 73 | Unsung Heroes |
| Sal Frelick RF, MIL 2024 | 87565 | 66 | Hardware Heroes |
| Jason Schmidt SP, PIT 1999 | 87569 | 54 | Snapshot |
| Jason Vargas SP, KC 2017 | 87570 | 46 | Historical All-Star |

## Screen (Card Fit one swap, all 74 current events plus PTMS 3 T1–T3)

`current-rosters --changes --list --bought 87450,87586,<GTA ids> --min-gain -50`, then `--all --only` for the three events already built on 414 and PTMS 3. Weighted = sum of gain × L.J.'s entries a week (last 21 days of logged results, 56 events, 59.7 entries/wk; the 11-16 LE scan's method).

| Card | Weighted runs/wk | Starts | Gains |
|---|---|---|---|
| **Alcantara 99** | **94.8** | 8 of 13 legal (+ DAF) | Diamond 1990 Onward +17.8, DAF +8.9, Ice to See You +8.6, PTMS 3 T3 Slots +7.3, Diamond +5.7, Diamond Cap +4.4, Silver & Friends Slots +4.3, All-Star Hardware Slots +4.2, Diamond Jumble +4.1, Say My Name Cap +1.1 |
| **Sheffield 103** | **39.5** | 2 of 6 (+ Wide Open) | Late 1900s +9.2 (DH), Open Main Event +5.8 (DH), Wide Open +3.6 (DH) |
| Schmidt 102 | 11.8 | 3 of 7 | All-Star Hardware Slots +2.8; Open Slots / Open Main +0.3 / +0.2 (noise) |
| Schmidt 54 | 0.5 | 1 of 33 | Iron & Friends +1.4 (noise) |
| Barraclough 73 | 0.1 | 1 of 23 | Silver and Gold Cap +0.2 (noise) |
| Giambi 100, Frelick 66, Vargas 46 | 0 | 0 | start nowhere |

For scale (11-16 LE scan, same weighting): Kemp 268, Story 125, Thatcher 104, Encarnacion 74, Alburquerque 59.

## Forced builds (env-roster, 2 seeded starts from each event's saved roster)

Price = forced objective (`--must "#id"`) − free objective, same seed. Logs are in the session scratchpad (`force/<id>-{free,alc,shef}.txt`).

| Event | Free | Forced | Price | Screen | Where he plays |
|---|---|---|---|---|---|
| Diamond 1990 Onward (9100199) | 591.2 | 609.2 | **+18.0** | +17.8 | Alcantara SP1; Weaver to the pen, Tolle out |
| Diamonds are Forever (587) | 564.6 | 573.5 | **+8.9** | +8.9 | Alcantara SP1; Glavine out |
| Ice to See You (542) | 622.6 | 631.0 | **+8.4** | +8.6 | Alcantara SP1; Larsen out |
| PTMS 3 T3 Slots (9130003) | 492.0 | 499.3 | **+7.3** | +7.3 | Alcantara SP1 (a D slot); Ruth out of the rotation |
| Diamond (564) | 578.2 | 583.9 | **+5.7** | +5.7 | Alcantara SP2; Hahn out |
| Late 1900s (9100194) | 583.2 | 593.3 | **+10.1** | +9.2 | Sheffield DH both ways; Edgar to the bench, Gibson (VAR) LF vs RHP, Greenwell to the bench |
| Open Main Event (547) | 831.7 | 837.5 | **+5.8** | +5.8 | Sheffield DH both ways in place of Edgar |

The screen was within 0.9 runs of the forced build on all seven.

The free builds alone beat the saved rosters only slightly: DAF +2.7 over saved 2140 (from 11-12), and +1.0 to +1.4 in Late 1900s and Diamond. They don't need a rebuild for that alone.

## Ratings worth knowing

- **Alcantara 99:** Stuff 122 (vL 93 / vR 149), Control 131, Movement 129 (vL 148), pHR 138, pBABIP 112, **Stamina 109**. A right-handed workhorse; his weak side is Stuff vs LHB.
- **Sheffield 103:** Eye 281, Power 206 (vL 222 / vR 201), Avoid K 156 (vL 233), Contact 143. RF 52 sits under L.J.'s RF floor of 75, so he's a DH only.

## Market (shop list 416)

No sales yet. Buy orders: Schmidt 102 at 120k, Alcantara 12.5k, Barraclough 2.5k. Frelick sells at 55k; Vargas last-10 1,935. CS prices: need L.J.'s Clubhouse screenshot.

## PTMS 3

- **Tournaments (owned-card events):**
  - T3 Slots: Alcantara SP1, +7.3 (forced build).
  - T1 Open: legal for Sheffield, Schmidt 102, Giambi and Alcantara; none of them starts.
  - T2 Iron: Schmidt 54 and Vargas are legal; neither starts.
- **Drafts (Saturday 11-21):**
  - PD 1 is already drafted (roster 2233), and its 1986 card-year cap excludes every GTA card anyway.
  - The live helper loads the GTA cards from the database, so it already ranks them.
  - The table below is the gain to an empty team (`quickGain`) and the card's rank in its round's pool. Read it against the round's expected best of 8, which is about what a pick-2-of-12 pack yields.

| Draft · round | Card | Gain | Rank in pool | Best of 8 / of 12 | Read |
|---|---|---|---|---|---|
| PD 2 · Iron 40-59 | Schmidt 54 SP | +29.0 | 25 of 1,084 (2%) | +20.6 / +23.3 | take him |
| PD 2 · Diamond 90-99 | Alcantara 99 SP | +64.1 | 19 of 299 (6%) | +63.1 / +66.5 | take him |
| PD 2 · Bronze 60-69 | Frelick 66 RF | +34.6 | 54 of 779 (7%) | +33.5 / +36.9 | take him |
| PD 2 · Perfect 100 | Giambi 1B | +65.6 | 20 of 131 (15%) | +71.1 / +74.7 | second pick at best |
| PD 2 · Perfect 101+ | Sheffield | +82.6 | 23 of 88 (26%) | +97.2 / +101.4 | rarely |
| PD 2 · Perfect 101+ | Schmidt 102 SP | +71.5 | 38 of 88 (43%) | | no |
| PD 2 · Iron | Vargas SP | +15.6 | 143 of 1,084 (13%) | +20.6 | fallback only |
| PD 2 · Silver | Barraclough RP | +14.6 | 390 of 520 | +43.0 | no |
| PD 3 · Bronze 60-69 | Frelick 66 RF | +30.5 | 74 of 1,143 (7%) | +29.7 / +33.8 | take him |
| PD 3 · Perfect | Sheffield (no DH) | +82.9 | 41 of 323 (13%) | +90.3 / +96.2 | second pick of a 2-pick round |
| PD 3 · Perfect | Giambi | +66.9 | 89 of 323 (28%) | | rarely |
| PD 3 · Perfect | Schmidt 102 | +42.6 | 162 of 323 | | no |

## Verdict

- **Alcantara 99: buy.** He goes straight to SP1 in four Diamond events, and a stamina-109 arm is rare. About 95 runs a week on L.J.'s entry mix, between Encarnacion (74) and Thatcher (104). The PTMS 3 T3 gain (+7.3) is a one-off.
- **Sheffield 103: buy only at a fair price.** He's a DH only, and he displaces Edgar. Most of his value (~34 of 40 runs a week) is Late 1900s, which L.J. enters ~3.7 times a week.
- **Skip:** Schmidt 102, Giambi, Barraclough, Frelick, Schmidt 54, Vargas.
- Nothing is rebuilt or saved. After a buy, run `current-rosters --changes --bought <id>` (or wait for the next collection upload). PTMS 3 T3 (roster 2236) needs a rebuild before Saturday if Alcantara is bought.
- New cards deliver about 85% of their projection (memory `new-card-projection-check`).
