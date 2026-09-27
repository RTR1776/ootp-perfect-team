# League model — 2026-09-26

L.J.: league play normalises cards and seems to suppress them compared with tourneys. With this much league data, can it be modelled well enough to settle buys like Jose Canseco vs the Kevin Mitchell variant? Yes. The numbers below come from 4.9M PA of split play: 8 weekly seasons, PEL plus HD450–453 and LD404, including the 1959 and 1989 theme weeks. Refit 2026-09-27 with the 09-27 PEL week and the raw 09-20 files; nothing material moved. That PEL week was uploaded after its regular season had finished (top 699 PA, like other finished weeks).

## What normalisation does, measured

- Leagues rate a card against the talent rostered around it. Fed the app's tournament-calibrated runs alone, **league play returns 0.68 of the edge.** It is the same in PEL (0.69), every HD league (0.67–0.71), LD404 (0.76), and on both boards. That is the suppression L.J. sees.
- **The order holds, the spread shrinks.** The tournament model ranks league bats well, but it prices ratings differently. The league pays more, relative to the scaled tournament model, for Avoid K and Eye.
- **Defense is not compressed the same way.** A rough check of league ZR per rating point against the tournament fit:

  | Position | League ÷ tournament |
  |---|---|
  | 1B, 3B, LF | ~1 |
  | 2B | 1.3 |
  | SS | 1.8 |
  | C | 2.5 |
  | CF | 0.6 |
  | RF | 0.5 |

  These are noisy: listed position, not innings. `league-compare --def-scale` exists for this.
- **Theme weeks change the run environment.**
  - Ordinary weeks fit 2010–2013.
  - 2026-08-23 fits **1959** and 2026-09-20 fits **1989** (`league-era.ts`).
  - Each week is scored in its own environment.
  - In those theme weeks, Avoid K was worth about 0.55 of an ordinary week, and Power 0.63–0.78.

## The model

Per board (vs LHP / vs RHP), in runs per 700 PA above the league's average bat on that board:

    runs = 0.02 + 0.458·(app − app_lg)
           + price · (14.59·dlnK + 5.83·dlnBA + 2.23·dlnGAP + 5.78·dlnPOW + 10.68·dlnEYE)

- `app` is the app's calibrated tournament runs on that board, in the week's environment.
- `dln r` is ln(rating) minus the league's PA-weighted mean ln(rating) on that board. Measuring against the league's own average is the normalisation.
- `price` is each rating's value in the week's environment over the PT default: 1 in an ordinary week, re-priced in a theme week.

Fitted on card forms pooled over every team and week they played: 256 card-board lines, thousands of PA each.

**How well it predicts, held out:**

| | League model | Tournament model scaled ×0.68 |
|---|---|---|
| Cards never seen in the fit | **0.92** | 0.85 |
| Whole weeks held out | **0.85** | 0.78 |
| 1989 theme week | 0.82 | 0.78 |
| 1959 theme week | 0.72 | 0.72 |
| Current PEL week (09-27) | 0.78 | 0.66 |

On held-out cards the model explains roughly 90% of the real card-to-card spread (a pooled line's sampling noise is small).

**The data** is every copy's *played* split ratings, variants included: the export rows carry them.
- Files in `League Data/` are exact.
- Weeks that are only in the database use the shop card's splits. Those are exact for base copies. For variants, the variant's own overall boost is added (median error 1 point, max 5).

## Canseco vs the Kevin Mitchell variant

The PEL lineup regulars from L.J.'s screenshot, with his owned copies (Aaron 102, Piazza 101 VAR, …). The best nine are solved exactly per board, bat plus glove, under his position floor. PEL faces LHP 47% of the time.

| Candidate | adds vs RHP | adds vs LHP | Season | Wins |
|---|---|---|---|---|
| **Kevin Mitchell HH 100 variant** (vL K139 BA97 Gap141 Pow250 Eye212; vR K98 BA125 Gap150 Pow190 Eye172) | +2.7 | **+26.6** | **+13.9 runs** | **+1.4** |
| Kevin Mitchell HH 100 (base) | 0.0 | +18.2 | +8.6 | +0.9 |
| Jose Canseco LE/40 100 | +3.9 | +10.5 | +7.0 | +0.7 |

Figures from the 2026-09-27 refit; the 09-26 fit had +13.8 / +8.5 / +6.9.

- **The variant is worth about twice Canseco to this team.** The team's weakest bat is at DH against lefties (its best vs-LHP DH is Piazza, about league average), and the variant's vs-LHP line is the best bat on the board (+26.9).
- Canseco is slightly the better bat against RHP (+10.2 vs +8.9), but that side of the lineup is already strong. With the variant in, Canseco would add under a run.
- **The ranking survives every check:**

  | Scenario | Mitchell variant | Canseco |
  |---|---|---|
  | 1989 theme week | +12.2 | +8.2 |
  | HD instead of PEL | +13.3 | +6.9 |
  | gloves at half value | +14.7 | +7.8 |

- **One caveat:** the variant's vL Power 250 is beyond the fit's range (the highest seen is 233), a mild extrapolation.

Reproduce:

    pnpm league:compare --league PEL \
      --roster "Leodalis De Vries,Heinie Manush,Mike Piazza,Ernie Banks,Hank Aaron,Will Clark,Richard Hidalgo,Carlos Beltran,Scott Rolen,Mel Ott,Josh Gibson,Bret Boone" \
      --add "Jose Canseco#86912" \
      --add "Kevin Mitchell VAR#86911=K vL:139,BA vL:97,GAP vL:141,POW vL:250,EYE vL:212,K vR:98,BA vR:125,GAP vR:150,POW vR:190,EYE vR:172" \
      [--year 1989] [--league HD] [--def-scale 0.5]

## What league pays for (2026-09-27)

L.J. asked what league values: Avoid K (cwhit's early read, Bassler), BABIP, Gap, Eye.

**+10 in one rating**, in runs per 700 PA, on Carlos Beltran as the base (HD, 2010). The script is `scripts/.scratch/league-prices.ts`.

| Rating | League, at typical levels | League, from 60 | League ÷ tournament |
|---|---|---|---|
| Avoid K | 1.5–2.0 | 3.6–3.7 | 1.2–1.4 |
| Power | ~1.7, flat with level | 1.7 | ~0.6 (≈1.0 from 60) |
| BABIP | 1.2–1.5 | 2.1 | ~0.7 |
| Eye | 0.7–0.9 | 2.0 | 2.3–2.8 |
| Gap | ~0.4 | 0.7 | ~0.7 |

- **Avoid K is the best rating point in league**, level with Power. League pays 20–40% more for it than tournaments. cwhit was right.
- **Power:** tournaments pay more for each step the higher it goes, league doesn't (a flat ~1.7). A power bat still plays in league, but tournaments overprice it for league.
- **BABIP** matters. **Gap** hardly does.
- **Eye** is worth little per point at normal levels, but a low Eye costs real runs. League pays more than twice what tournaments do for it.
- The log terms make **fixing a weakness pay more than stacking a strength**: +10 Avoid K from 60 is worth 3.7 runs, from 140 it is 1.5.

**Defence:** a rough check (league vs tournament zone runs per rating point; noisy) gave:

| Position | League ÷ tournament |
|---|---|
| C | 2.5 |
| SS | 1.8 |
| 2B | 1.3 |
| 1B, 3B, LF | ~1 |
| CF | 0.6 |
| RF | 0.5 |

Bats count at about 0.68 of their tournament spread, so against the bat, C/SS/2B gloves matter more in league and the outfield less. The model still prices gloves at the tournament scale ("Glove weight" on the page) until the per-position fit is done.

## Copies of one card (2026-09-27)

L.J. asked whether a copy that starts badly should be cut, or whether it turns around. Every league week has many copies of the same card: hitters in 872 card-weeks, a median of 8 copies each. Pitchers in 663 card-weeks. Hershiser had 26–29 copies a PEL week.

- **Hitters:** the spread of wOBA between copies is 0.0241. PA sampling alone gives 0.0240. It is all luck, so there is no room for a copy that stays good or bad all season.
- **Pitchers:** the spread of FIP-type runs is 0.51. Luck alone gives 0.48, so about 89% is luck. The rest is small, probably role, park and usage.
- **So don't cut a copy for a cold 25–30% of a season.** Over the rest of it, expect what the card is, not what it has done. Cut a card for being worse than the alternative on the model, not for its line.
- No week has a mid-season snapshot yet, so first-half vs second-half can't be checked directly (see item 4 above). The spread already leaves no room for a lasting per-copy effect on hitters.

## Keeping it current

1. **Refit when a week lands:** `pnpm league:panel` then `python3 scripts/league-fit.py` (writes `src/data/league-model.json`; `--dry` to look first). It reads every week in `League Data/` and every league week in the database. When one week was uploaded twice, the newest copy wins.
2. **League imports now keep the split ratings** (`ingest/league.ts`), so a week uploaded through /upload or `pnpm import:league` gives the fit exact variant ratings.
3. **The 09-27 PEL week** (snapshots 97–99) is PEL's reference week. It was uploaded after the regular season had finished, so nothing is owed on it.
   - Export all / vL / vR, then either drop them on /upload or save them under `League Data/<Sunday>/`, where Push to GitHub.command commits them.
   - On /upload, check that "Season ends" reads the Sunday the league week ends (it defaults to it), then **press Commit**. Dropping the files only previews them.
   - A part-played upload and the finished one go under the same Sunday. Both are kept; the panel reads the newest per week, league and split. Upload the part-played one first.
4. **A mid-season export helps.** One part-played upload a week, plus the finished one, would show directly whether a copy's first half predicts its second (see "Copies of one card" below).

## Not done yet

- **Pitchers:** the same panel carries arm rows; the fit is bats only so far.
- **League defence:** fit per-position scales properly (innings at position), then default `--def-scale` from them.
- **A page:** done 2026-09-27. **/league-card** (League → Card Model) shows L.J.'s league lineups and what a card typed off its face adds to them.
  - The team list starts from his bats in the newest league export and is his to edit (the export also lists cards he has dropped). The list, locks and settings are remembered in the browser.
  - Any slot can be locked to a player. The best nine are solved around the locks.
  - A home park moves his bats at half weight. The footer says how much the park moved each board against a neutral park. The park path runs through the app-run term (0.458), so park swings here are smaller than park:sweep's tournament-scale numbers. park:sweep, which also counts his pitchers and the field, is still the park pick.
  - Pick the base card, type the variant's numbers and positions, then score it. A 7.5% variant step can fill a side you don't know.
  - It uses the same numbers as `league:compare`: both go through `lib/analytics/league-lineup.ts` and `lib/league-hitters.ts`.
