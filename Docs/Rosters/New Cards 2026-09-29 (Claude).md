# New cards — 2026-09-29 (afternoon)

L.J. pulled some of the new LEs and a few variants, and uploaded the shop list and his collection (uploads 172 and 173).

## What came in

- **LEs:** Nick Altrock (Silver SP 76, 1906) and Shawn Green (Iron 1B 59, 2004).
- **Variants:**
  - Bronze: Tanner McDougal (66, SP), Corey Kluber (64, SP), Julio Cruz (62, 2B)
  - Silver: Mel Harder (73, SP)
  - Gold: Norm Charlton (81, RP)
  - Iron: Freddy Galvis (58, SS), Jackie Robinson (58, 1B), Jonathan Villar (58, 3B)
- **New cards:** Yordan Alvarez (Perfect LF 100, Live), Tim Wallach (Silver 3B 78), Hubert Lockhart (Silver SP 75), Halley Harding (Silver SS 71), Pat Patterson (Bronze 2B 67, 1935) and Bullet Campbell (Iron SP 56, 1926).

## The export left out every base copy

- **What happened:** this afternoon's export lists all 201 of his variants without their base copy. The morning's listed both for 152 cards. As uploaded, the app would count 201 base copies as gone.
- **Where that hurts:** only in events that bar or cap variants. The Early Bronze pick plays base McDonald, Cimber and Buckner.
- **The rule, per L.J.:** he has both copies for most variants. In Iron, Bronze and Silver the base can be assumed; not always for clubhouse cards. LEs can't be variants.
- **The fix:** from now on, a variant listed without its base implies it (`impliedBaseCopies` in `lib/ingest/collection.ts`), unless it's a clubhouse card. None of his 201 is.
  - /upload adds those rows on every collection upload, marked "implied".
  - `Save New-Card Rosters.command` adds them to this afternoon's upload.
  - env-roster and roster-save apply the rule in memory, so the rosters below count the base copies.

## Rosters rebuilt

All 13 Claude-made rosters were rebuilt on upload 173, with the base copies implied and the same rules and settings. Nine took one of the new cards and are saved as "Claude pick 2026-09-29 PM" (load files `*-claude-2026-09-29pm.txt`). Every one passes its event's rules.

| Event | Old pick | Rebuilt | What changed |
|---|---|---|---|
| Live-Plus Bronze Pop-up (9300001) | −65.5 | −61.6 | The same 26, with McDougal as the variant: the top starter at +2.2. **For tonight, just switch McDougal to the variant in game** |
| Daily Bronze PTCS 3 Replay Slots (773) | 119.4 | 122.6 | McDougal (VAR) for Bruce Hurst |
| Daily Late Bronze (524) | 92.2 | 94.5 | McDougal (VAR) for Bruce Hurst |
| Daily Bronze Only Cap (520) | 86.7 | 88.9 | McDougal (VAR) and Grant Wolfram for Bob Miller and Nate Pearson |
| Monday Up And At Them Bronze (536) | 75.1 | 76.3 | McDougal (VAR) for Cool Papa Bell |
| Daily Bronze OOTP Era (633) | 64.2 | 68.5 | Kluber (VAR) for Jose Lima; McDougal as the variant |
| Daily Low Bronze Only (519) | −16.7 | −15.2 | Kluber as the variant |
| Daily Bronze 1910-59 (584) | −57.7 | −43.3 | Pat Patterson and Jackie Robinson (VAR) for Jim Tabor and Red Kress (VAR) |
| Tuesday Dead Silver Walking (549), for 10-06 | −17.6 | −10.8 | Nick Altrock (LE) for Christy Mathewson |

**Kept:**
- **Curiosities (527):** the rebuild is unchanged, 37.4.
- **Saturday Bronze Cap (535):** 20.6 to 20.4, no gain.
- **Early Bronze (525):** 42.1 to 44.3, but only one reshuffle and no new card.
- **Dregs (548):** −8.1 to −6.2, but seven swaps and no card from today.
- **Live Bronze (561):** not rebuilt; no new Live card is Bronze.

The scores are on each event's own scale, so compare them within a row.

## Today's LEs: worth buying?

Scored on Era Strength (five eras, his best card at the spot). None is a Bronze buy:

| LE | Tier, spot | Gain over his best (five-era average) | Price | Verdict |
|---|---|---|---|---|
| **Daniel Murphy** | Diamond 98, 1B / DH / 2B | **+9.7 at 1B**, +7.1 at DH, +3.4 at 2B; worst era +0.2 | not listed yet | **The standout, for Diamond events.** Watch for a listing |
| Tom Hall | Gold 88, RP | +1.1 (Gold), +0.1 (Diamond) | ~58k (last 10) | A small Gold bullpen upgrade |
| Pedro Alvarez | Gold 81, 1B / 3B | +0.7 / +0.5, and −20 to −23 in deadball | not listed | Only in modern eras |
| Chris Sabo | Bronze 66, 3B | −3.1 (−20.5 deadball, +6.6 runs himself modern) | 185k ask | No: he only helps in modern eras, and not by enough |
| Mark Koenig | Diamond 90, SS / 2B / 3B | −3.5 to −6.2 | 100k ask | No |

Hideki Matsui (Perfect 100) is outside Era Strength's tiers.
