# Tourney tests: the app's predictions, written down before the games

Each `<date> <series>.json` holds what the app predicted for every legal card in
one event, and the series' observed counters at that moment:
- **model**: calibrated runs per 700, from ratings alone
- **blend**: the model with observed play mixed in, which is what /build ranks on

`… predictions.csv` is the readable top of each board (150 bats, 100 arms).
Commit a snapshot before the run it is meant to test.

Once the run's export is filed (File OOTP Exports imports it), `grade` takes
the difference between the database now and the snapshot. That difference is
the run itself, every card in the field. Both boards are scored against it.

    cd web
    pnpm tourney:test snapshot --tournament 9100186 --types 1,6     # Daily Live Plus: Live + Future Legend
    pnpm tourney:test grade --file "../reference/tourney-tests/2026-09-26 liveplus.json" \
        --cwhit "../reference/cwhit/2026-09-27"                     # cwhit is optional

In a cloud session with no `web/.env.local`, run `node --import tsx scripts/tourney-test.ts …`.

## Taken 2026-09-26 (before any of these ran again)

| file | event | why |
|---|---|---|
| `liveplus` | Daily Live Plus (Live + Future Legend, PNC Park 2026) | the Culpepper variant's kind of event |
| `livediamonddaily` | Daily Live Diamond | Live, Diamond cap |
| `bronzeootp` | Daily Bronze OOTP Era | PTCS Bronze. The model's weakest field (r 0.29 on the archive). |
| `lowbronzeonlydaily` | Daily Low Bronze Only | PTCS Bronze |
| `openslotsdaily` | Daily Open Slots | PTCS Open |
| `goldweekly` | Thursday Night Gold Rush | park now resolved to GABP 2026 (it ran neutral before) |
| `goldfather` | Daily Goldfather II | big, steady field: the control |

## What to screenshot on cwhit's site, for the comparison

For the event you will play, before it runs:
1. **Hitter projections**, filtered to the event's card pool (value window; Live and Future Legend for Live Plus), sorted by pwOBA. Get about the top 40.
2. **Pitcher projections**, same filter, sorted by pwOBAA. About the top 30.

After the run has finished and your export is filed, the observed boards are optional: the export already covers every card in the field. They are still worth one screenshot each, because they cover more runs than yours:

3. **Observed hitters**
4. **Observed pitchers**

Claude transcribes them to `reference/cwhit/<date> hitters projected.csv` and the three sibling files, with the columns in the existing files, then runs `grade --cwhit`.

## Reading a grade

One run is a few thousand PA across the whole field, so a card's line is a few dozen PA. Single-run correlations run well below the archive's.

The archive's numbers, for bats:
- 0.69 from the model alone
- 0.73 with the observed blend

For arms: 0.52 against FIP, 0.42 against runs allowed.

Grade after several runs (one snapshot, graded later) for a steadier read. Compare the app and cwhit on the cards both project; n is printed beside every r.
