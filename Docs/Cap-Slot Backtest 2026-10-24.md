# Cap/slot backtest (2026-10-24)

L.J. wanted the app and Claude to build winning rosters in cap and slot events. The question underneath it was the trade between a Perfect slot (or 100 cap points) on a starter and the same slot on a bat. Sunday Open Slots made it concrete: we build 5 Perfect starters, while the field's top 16 average 3.0 Perfect starters and 4.8 Perfect bats.

## Data

- **Events:** every current catalogue event with a team cap or slot rules: 24 events, 131 exports, filed from 09-01 and after each event's `formatSince`.
- **Control:** the 32 current events with neither: 178 exports.
- **Scoring:** a scratch copy of `scripts/model-v2/teams.mts` scored every team in every export on the production model: env-fit in the event's own era and park, variants as their own form, and Jim-beater teams dropped.
- **Size:** 7,660 cap/slot team-events and 17,261 control team-events.

## Fit

The target is each team's win% minus its event's average. The score is:

    bats + glove × gloves + framing + SP × starters + RP × pen

all in runs per game. The weights were searched on a grid, with 5-fold cross-validation split by event so no event is in both halves.

| | Production (glove 2, SP 1.5, RP 2) | Refit, held out | Regression: SP per bat run (80% range) |
|---|---|---|---|
| **Cap/slot** | **0.396** | 0.397 | **1.79 (1.46–2.16)** |
| Cap only | 0.425 | 0.423 | 1.86 (1.11–3.14) |
| Slots only | 0.384 | 0.381 | 1.74 (1.35–2.18) |
| Control | 0.389 | 0.389 | 1.44 (1.20–1.69) |

Other regression weights in cap/slot events: glove 1.77 (1.19–2.36), pen 2.73 (2.27–3.36).

SP weight sweep in cap/slot events (glove 2, pen 2): 0.5 → .387, 1.0 → .393, 1.25 → .395, **1.5 → .396**, 2.0 → .395, 3.0 → .392.

## Findings

1. **Production weights are already right for cap and slot events.** A refit doesn't beat them out of sample, so nothing changes.
2. **Starters are worth more here, not less.** In cap/slot events a starter run is worth about 1.8 bat runs, against 1.44 in the control. Cutting the starter weight to 1.0 makes predictions worse. The 5-Perfect-starter builds stand: the field under-spends on pitching in these events.
3. **The pen may be under-weighted.** Its regression weight is 2.7 against the production 2, but a held-out pen weight above 2 adds nothing measurable, so it stays at 2. Re-check with more weeks.
4. **The model predicts cap/slot results as well as it predicts any event** (0.40 against 0.39 in the control). Tournament win% is mostly bracket luck. About 0.41 is the most any ratings model can reach (measured 10-17), and we're close to it.

## Our own results (KC in these exports)

| | Exports | Model rank in field | Actual finish | W-L |
|---|---|---|---|---|
| Cap/slot | 106 | top 30% | top 38% | 857-688 (.554) |
| Control | 167 | top 22% | top 40% | 1376-1055 (.566) |
| Cap/slot, before 10-12 | 72 | top 37% | top 41% | .554 |
| Cap/slot, 10-12 on | 34 | top 16% | top 33% | .556 |

- **Results match the edge.** The model rates our rosters +0.48 runs a game over the field in cap/slot events, which works out to about .55 win%, and we're at .554. Finishes swing on the bracket.
- **The rebuilds since 10-12 rate much higher.** Our rosters went from top 37% of the field to top 16% on the model. Win% hasn't moved yet, but 541 games is only good to about ±.02.
- **We bring a below-average roster in two events:**
  - Daily Silver Slots: model rank 62–83% in six of seven exports.
  - Time Travelers Slots: 68%.

  These need cards, or skipping, more than a better build.

## Still to do

- **Weight each rotation slot by its real share of starts.** In Open Slots and Gold Cap, SP1 makes about 24% of starts and SP5 about 16%. The objective counts all five equally.
- **Credit two-way pitchers for batting in no-DH events.** Ed Rile is the case.

## Data problem found

`Archive/Completed/timetravelersslots_117.csv` and `_118.csv` are byte-for-byte identical (sha 2d45e408…), so one of them is mislabelled. Both went into cwhit's 10-24 upload folder as different runs.
