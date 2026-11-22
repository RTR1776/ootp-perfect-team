# Thursday CWhit's Say My Name Cap (9100187): starters-weight check, 2026-11-19 (Claude)

**Saved as roster 2249, "Claude pick 2026-11-19". It replaces 2239.** The backup is `Docs/Archive/saved-rosters-2026-11-19.json.gz`. The load file is `Inbox/rosters/c4q1-claude-2026-11-19-ruth.txt` and the build log is `Inbox/rosters/9100187-2026-11-19-ruth-build.txt`. Morton (87586) was saved with `--assume-owned`; he isn't in collection upload 414 yet.

## Why it was rebuilt

L.J. asked why 2239 carried two 100 starters and an 89 starter, when cap rosters are usually built around bats. He also sent Cwhit's own roster:
- Starters: Gavin Williams 100, Koosman 98, Hurst 64, Ostermueller 64 (VAR), Chatwood 50.
- Bats: Bautista, Canseco, Lundy, Edgar and Rice at 100; Josuar Gonzalez 98; Granderson 97; Zunino 75; Rose and Victorino at 69.

Findings:
- **2239 was already bats-first.** Of the 735 cap points above the 40 floor, 459 go to the starting nine and 219 to the rotation.
- **The aces earned their price per cap point.** On the cap ledger, Johnson returned 1.56 runs per point and Niekro 1.42, against 1.27–1.48 for the 100 bats. That's at the 1.5 starter team weight (an SP slot counts about 1.8 lineup slots).
- **Cwhit's roster on our model** (both as base copies, his 8 unseen cards filled with our cheapest legal cards at his 339 points):
  - Starters at 1.5: 323.9 for him against 361.5 for 2239.
  - Starters at 1.0: 295.0 against 319.0.
  - The gap is all rotation: +22.8 runs per 700 batters faced to us.
- **Our floor would bench Ben Rice.** His 1B rating is 52, under our 60 floor. With the floor lifted for him, Rice at 1B is worth about +28 weighted runs on Cwhit's roster.
- **The field carries aces.** The best quarter of c4q1 teams (70 teams, .611) carry 2.4 starters at 90+; the average team carries 2.0.

## How much the starter weight matters

The 1.5 weight is L.J.'s 10-11 pick from a fitted range of 1–1.5; tournament win% is only about 17% skill. To emulate starters at 1.0, use `--sp-weight 0.8021` (= 1.28 × 0.94 / 1.5). Rosters scored on 11-19, 16-start builds:

| Roster | Starters 1.5 | Starters 1.0 | Worst-case loss |
|---|---|---|---|
| Ruth (best at 1.0), **saved 2249** | 419.9 | 378.9 | 2.8 |
| 2239 (11-18) | 420.8 | 374.1 | 4.8 |
| Three aces: Johnson, Cliff Lee (VAR), Niekro (best at 1.5) | 422.7 | 373.9 | 5.0 |

All three are within 5 runs of each other. The Ruth roster holds up best under either weight.

## Changes against 2239

- **Out:**
  - Starters: Niekro 100, Leblanc 89 (VAR).
  - Bats: Bo Jackson 88, Arquette 71 (VAR), Neale 42, Eden 40.
  - Pen: Reed Garrett 49.
- **In:**
  - Arms: Babe Ruth 97 (SP2, and also a bench bat as a two-way card), Ostermueller 64 (SP4), Morton 46 (long man).
  - Bats: Beltran 99 (CF), Walcott 89 (1B), Jerome Walton 43 (VAR, backup CF), Jim Maloney 41 (a pitcher card used as a bench bat).

**Observed play in this series:**
- Ruth: 165 IP, FIP 3.33 (Niekro had 3.26 over 353 IP).
- Beltran: 2079 PA, wOBA .348 (Bo Jackson had .336 over 3701 PA).
- Walcott: .403 over only 134 PA.
- The cost is Ostermueller at SP4: 4.19 FIP over 377 IP.

## The roster

- **Rotation:** Johnson, Ruth, Liriano, Ostermueller, McDonald (VAR).
- **Closer:** Bale (VAR).
- **Pen:** Choate, Thatcher, T. Jones (VAR), Morton, Kincannon, B. Gibson (VAR).
- **Bench:** Walton (VAR), Ruth, Amezaga, Pinkney, Maloney, Rodgers (VAR).

**vs RHP:**
1. Edgar DH
2. Bautista RF
3. K. Gibson LF
4. Beltran CF
5. Williamson 3B
6. Gordon 2B
7. Walcott 1B
8. Nimmala SS
9. Boone C

**vs LHP:**
1. Edgar DH
2. Bautista RF
3. Gordon 2B
4. Williamson 3B
5. Beltran CF
6. Nimmala SS
7. K. Gibson LF
8. Walcott 1B
9. Boone C

**Roster check:** all ✓.
- Shape: 5 SP / 7 RP / 15 bats (Ruth counted in both).
- Starters' stamina: Johnson 72, Ruth 104, Liriano 77, Ostermueller 98, McDonald 59.
- Long men in the pen: Morton 59, Kincannon 74, B. Gibson 69.
- Backups: C Rodgers 68; CF Walton 60 and Amezaga 95; Amezaga at every other position.

**Series record:** `scoreboard.json` has L.J. at 11 series won and 4 lost here, not the 12-4 given on 11-18.
