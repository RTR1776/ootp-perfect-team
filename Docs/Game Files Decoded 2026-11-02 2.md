# Game Files Decoded, 2026-11-02

L.J.: "dig in and figure out more about the game so we can dominate — how are the operations determined, etc."

First time we've read the game's own install and save files. Until now we only had CSV exports and one copy of `totalmods.csv`.
- **Install:** `~/Library/Application Support/Steam/steamapps/common/Out of the Park Baseball 27/` (`G` below).
- **Saves:** `/Users/ljmac/Application Support/Out of the Park Developments/OOTP Baseball 27/` (not under `~/Library`).

Nothing in either folder was modified; everything was parsed from copies.

**Kept from this session:**
- Scripts: `web/scripts/ootp-saves/`
- Outputs: `Data/OOTP saves 2026-11-02/`
  - `all_rosters.csv`
  - `fingerprint.csv`
  - `survey.txt`
  - `park_factors.csv`
  - `league_doubles.txt`
  - `bin_strings.txt` (the `strings` dump of the game binary, used for the `bin:` line refs below)

## 1. Every opponent's full roster is on disk (the big one)

Each tournament the game has loaded leaves a `saved_games/7ea1…pt` (64/128) or `7ea2…pt` (256) folder. 111 are on disk now.

**How the roster data is stored:**
- `text_data.dat` is a ZIP holding a plain SQLite database. Its `league_transactions` table logs "Placed POS player_N on the active roster" for every card on every team.
- `players.dat` (raw little-endian structs after a 0xAC header) gives, per `player_N`:
  - the plain ratings
  - card type and card value
  - the **PT Card ID**, the same id as `pt_card_list.csv`
  - the card title
- `world.dat` holds the era year (u16 at +11 after the "Great Glove Award" string) and a 16-double array of era environment ratios (fields not yet named).

**Extracted:** `all_rosters.csv`, 281,668 cards across 111 tournaments.
- Columns: folder, era year, team, pos, name, card_id, value, type, title.
- 91% of transaction lines matched a card. The misses are mostly in 256-team folders, possibly because eliminated teams' cards get pruned (not checked).
- Most teams come out at 25 cards.

**Why it matters:** exports list only cards that played (survivor bias; see memory "Export survivor bias"). These are whole rosters, bench and pen included, for the entire field. They can replace the export-based picture behind `field-construction.json`: what the best quarter carries and how much cap they put into SP, RP and bats.

**Not in the folder:**
- The tournament's display name (the league is just "Tournament Conference").
- Box scores and game logs (both empty).
- Full play-by-play. `replays/*.rpl` hold highlights of watched games only.

**Labelling folders:** L.J.'s own 25-card Torrent roster is in each folder. Match it against his template rosters in `online_data/rtr1776/TemplateRosters_rtr1776.tr/*.tr` (one per tournament name, 26 internal ids each). Failing that, use era + tier band + team count (`fingerprint.csv`).

**Would take real reverse-engineering:**
- opponents' lineups, depth charts and strategy settings (`teams.dat`)
- the DH flag and park id
- `human_managers.dat` (obfuscated)
- the encrypted blob in `.tr`

To make `teams.dat` tractable: snapshot a folder before and after a known roster or strategy change, then diff the two.

## 2. How outcomes are decided (from the game's own text)

Refs: `chg:N` is a line in `G/changes.txt`; `gui:N` a line in `G/data/text/gui_translations.xml`; `bin:N` a line in `bin_strings.txt`.

**At-bat resolution is pitch by pitch and physical.**
- Release notes: pitch mix, then location, then swing, then contact, then exit velocity and launch angle, then landing spot, then fielder. The engine got a "large update to the overall model for pitch location, swing rates, contact rates, exit velocity, ball landing location" (chg:390).
- Later patches retuned "ball landing locations/difficulties, impact of defense" (chg:189).
- Our power law (`OOTP ENGINE DECODED.md`) is a reduced form of this, and still fits the outcomes well.
- **Refinement:** "balls in play are mostly luck / DIPS lives" is too strong. Where balls land and how fielders get to them is modelled. That fits pBABIP being under-priced in 1946–93 (Model Review 10-25 §3).

**What the era setting does and doesn't do.**
- **Does:** sets league stats and the AI's strategy baselines. Events play "with strategy & stats settings that resemble the year" (gui:120985), including "how often players bunt, or how often closers are used" (gui:82941).
- **Does not:** rescale card ratings.
  - `era_modifiers.txt` is loaded only by `LEAGUE::import_historical_creation_modifiers` (bin:44204). It builds historical players' ratings.
  - Tested on 813 archived exports. Scaling ratings by the year's modifier fits worse in 8 of 9 rating/rate pairs (χ² 9,438 against 2,058 unscaled).
  - The Stuff→K slope is flat across eras (0.97–1.02× of 2010).
  - So it is not the source of our fitted per-era fixes (`ARM_ERA_SPREAD`, `ARM_RATING_FIX`). Those still have no mechanical explanation. Best untested guess: the rate-to-runs step or the FIP yardstick they were fitted on.

**Team chemistry is gone in PT 27:** "completely removed" (chg:440–441). Momentum is a Drive-for-the-Pennant feature only.

**Arm and framing runs are "balanced to league totals"** (chg:423). A framing edge is measured against the field's catchers, which supports keeping framing weight modest.

**Parks.**
- Tournament rules state AVG and HR by batter hand, and 2B/3B overall (gui:139712). Our `d2`/`d3` handling is right.
- Factors are capped (AVG 0.80–1.20, HR 0.50–1.50) and already include weather and altitude (gui:57532).
- The HR-by-hand split is the biggest park lever.

**Starter and reliever stamina.** The era SP/RP stamina modifier "Modifies how many pitches a SP is allowed in a game" (gui:140310). It is a pitch allowance, not a fatigue rate.

## 3. Strategy settings worth using (inferred from the settings that exist; not yet tested)

- **Situational grid.** Every strategy setting can differ by time (Early 1–6, Late 7–8, Last 9+) × score (Large/Small Trail, Close, Small/Large Lead) (gui:106757–106813).
  - Set "All Times / All Scores" first, then fine-tune.
  - Steals: minimum everywhere (Strategy Settings doc). Open them only in Last + Close, if at all.
- **Reliever fatigue.** "RP Rest when fatigue %" and the per-reliever "tired" override (gui:147561, 148477) can enforce the 28–30 pitch readiness cliff automatically. A threshold around 55–60% would skip arms that threw 30+ yesterday (they show 33–47%).
- **Deadball 90+ stamina starters:**
  - Hook toward "+5 (Very Slow)" (bin:34649).
  - Turn off "Aggressive Tiredness Hook" (gui:34044).
  - Set the pitch cap at 150–170.
- **Bullpen roles.** The roles are Opener, Follower, High Leverage, Stopper, Setup, Specialist and Mop-up, plus "Avoid high leverage" (bin:60140–60185, gui:60632). The AI reads leverage (`misc/li_table.txt`), so the best reliever may be worth more as High Leverage than as a 9th-inning-only closer. Test it.
- **Rotation.** "Always start highest rested" (gui:35437) is worth testing on multi-game days.
- **Lineups and depth charts.** The PT auto depth chart was retuned to "value splits more" (chg:54). Set them by hand anyway.
- **Manager presets.** The 75 `.str` files are 15 situation rows × 24 signed settings (−4..+4) plus a fixed 9-byte trailer. The columns are only partly mapped (col 10 ≈ pitch-around, 11 ≈ intentional walk).

## 4. Data fixes found (not yet applied)

| Fix | Why | Size |
|---|---|---|
| ~~Rebuild `eras.json` 1920–48 from `era_stats.txt`~~ **Tested, rejected** (§4a) | Our K rates run low there: 1925 0.049 vs the game's 0.070 per PA (−30%), 1946 −16%, 2010 matches. But the swap predicts wins worse. | — |
| ✅ Swapped `Data/OOTP game files/totalmods.csv` for `G/data/database/total_modifiers.txt` (11-02; old copy kept, see `README.txt` there) | Same columns, values r 0.85–0.99 against the old copy; a different version. On the archive the game's file predicts steals slightly better (SBSuccess t 23.0 vs 22.0, attempts 8.9 vs 7.0). The error study (`errtest.py`, 65,646 team-events) reads the same with either: no error term helps in any band. | No setting or model change |
| ✅ Park typos fixed in `reference/ballparks.csv`, the source (11-02) | Fenway 1975 hrL 0.985; Constellation 2026 avgL 0.83; Hilltop 1903 avgR 1.001; Comiskey 1945 d2 0.975. Also Shea 2008 avgR 0.961: that fix (28b68d5) was only in the JSON, so a regenerate would have undone it. | — |
| ✅ Parks added (11-02) | Yankee Stadium 1934, Baker Bowl 1933, **Hilltop 1905**. Regenerated with `build-env-data.mjs`: exactly these 7 rows changed and `eras.json` came out identical. | **PTCS 8 Championship Silver plays at 1905 Hilltop.** It had been scored at 1903 (AVG 1.00/1.01, HR 1.21/1.21, 2B 1.01, 3B 1.12) instead of 1.08/1.08, 1.26/1.13, 0.90, 1.32. Rebuilt and saved: roster 1767, "Claude pick 2026-11-02-hilltop lev", on the pen-leverage code; 1766 is superseded. Against the same code at the old park, one pen change (Mathewson for Altrock); the run level goes 4.3 → 4.9 R/G. |
| `park-dimensions.json` | The game has 7 distances and 7 wall heights for all 240 PT parks; ours covers 51. Daikin CF 409 vs 436; Isotopes 340/400/340 vs 320/427/323. | Medium |

### 4a. The pre-1949 era table test (L.J. asked to fix it; the test says don't)

**Setup:**
- Four win harnesses over `Archive/Completed` (`scripts/model-v2/teams.mts`, `MV2_NO_LEAGUE=1`), with the same production code; only the inputs below differ.
- 65,646 team-events. 75 pre-1949 exports (6,174 teams): 1888, 1907, 1919, 1920, 1925, 1927, 1935, 1942, 1945.
- Scored at production TEAM_WEIGHTS. Win% r within export, 40 export half-samples.
- Scripts: `web/scripts/ootp-saves/eras-from-game.py` (builds the variant table), `eras-wincheck.py` (compare).

| Change against production | ≤1920 | 1921–48 | All pre-1949 |
|---|---|---|---|
| Game `era_stats` for ≤1948 | 0.0000 (17/40) | −0.0024 (0/40) | −0.0005 (3/40) |
| …pitching component alone | −0.0014 (2/40) | −0.0052 (0/40) | −0.0022 (0/40) |
| Drop the ≤1945 Stuff fix (`ARM_RATING_FIX`) | −0.0050 (0/40) | −0.0015 (12/40) | −0.0046 (0/40) |
| Game table and no Stuff fix | −0.0046 (0/40) | −0.0030 (6/40) | −0.0045 (0/40) |

**Reading:**
- Offense doesn't move (+0.0001). The `ERA_SLOPES` bat slopes are fitted from play, so the era's K rate barely reaches bats.
- Pitching gets worse, most of all in 1921–48, where the K gap is largest.
- The Stuff fix is real value. It is not covering for the missing strikeouts, because the game table does not replace it.

**So `eras.json` stays as it is.** It agrees with the Model Review's finding that PT fields strike out at only 0.45 of the era's K rate: PT does not play the full MLB environment of the year. A table that matches the game's league file is not a better yardstick for pricing cards in PT.

`park-factors.json` otherwise matches `pt_ballparks.txt` on 233 of 238 rows. `era_ballparks.txt` is a different, Lahman-style table; PT uses `pt_ballparks`.

## 5. Dead ends (don't redo)
- `misc/hints_english.txt` is trivia and quotes only. `data/help` maps dialogs to wiki URLs.
- `misc/xba|xslg|xwoba_table.txt` are exit velocity × launch angle grids for the displayed expected stats.
- `config/engine.cfg` is the global frequency sliders, all at 100.
- `tables/` is UI layouts only.
- `online_data/` holds card images, team graphics and the CSV exports. There are no tournament definitions or market data.
- Card ratings do not change by event era: 4,514 cards seen in several eras differ only by variant or level.

## Next, by value
1. **Field composition from full rosters:** label the 111 folders, join to `pt_card_list.csv`, and rebuild what the field (and its winners) carries by tier, era, size and cap.
2. ~~`eras.json` rebuild for pre-1949~~: tested, rejected (§4a).
3. **Settings tests:** steal grid, RP fatigue threshold, High Leverage role.
4. ~~Park and `totalmods` fixes~~: done 11-02 (§4).
5. **Decode `teams.dat`** for opponents' lineups and strategy.
