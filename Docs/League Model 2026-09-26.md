# League model — 2026-09-26

L.J.: league play normalises cards and seems to suppress them compared with tourneys. With this much league data, can it be modelled well enough to settle buys like Jose Canseco vs the Kevin Mitchell variant? Yes. The numbers below come from 4.9M PA of split play: 8 weekly seasons, PEL plus HD450–453 and LD404, including the 1959 and 1989 theme weeks. Refit 2026-09-27 with the part-played PEL week and the raw 09-20 files; nothing material moved.

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
| Current PEL week (09-27, part-played) | 0.78 | 0.66 |

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

## Keeping it current

1. **Refit when a week lands:** `pnpm league:panel` then `python3 scripts/league-fit.py` (writes `src/data/league-model.json`; `--dry` to look first). It reads every week in `League Data/` and every league week in the database. When one week was uploaded twice, the newest copy wins.
2. **League imports now keep the split ratings** (`ingest/league.ts`), so a week uploaded through /upload or `pnpm import:league` gives the fit exact variant ratings.
3. **The current PEL week** was loaded part-played on 2026-09-27 (snapshots 97–99) and is now PEL's reference week. Re-upload the finished week under the same Sunday; the newest upload wins. Then refit.
   - Export all / vL / vR, then either drop them on /upload or save them under `League Data/<Sunday>/`, where Push to GitHub.command commits them.
   - On /upload, check that "Season ends" reads the Sunday the league week ends (it defaults to it), then **press Commit**. Dropping the files only previews them.
   - Use the same Sunday for the part-played week and the finished one. The panel keeps the newest upload per week, league and split.

## Not done yet

- **Pitchers:** the same panel carries arm rows; the fit is bats only so far.
- **League defence:** fit per-position scales properly (innings at position), then default `--def-scale` from them.
- **A page:** league-compare is CLI only. The /league page could take "add this card" the same way.
