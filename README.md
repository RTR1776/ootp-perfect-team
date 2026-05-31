# OOTP Perfect Team — personal optimizer

## What's in this folder

```
.
├── Ratings/                                  # Your full collection export (2,024 cards)
├── Current Stats/                            # ← drop weekly stat exports here
├── MLB Batting Year-by-Year Averages.xls     # League baselines (1870-2026)
├── data/
│   └── projections.json                      # Generated — every card with projected wOBA/FIP/WAR
├── engine/                                   # Python projection pipeline
│   ├── league_baselines.py
│   └── projections.py
├── STACK.md                                  # Recommended Next.js + Vercel stack for the app
└── README.md                                 # ← you are here
```

## What the engine does

For every card in your collection, it computes:

**Hitters** — projected line vs L, vs R, and overall (28%/72% PA blend):
BA / OBP / SLG / OPS / ISO / wOBA / K% / BB% / HR-rate / BABIP

**Pitchers** — projected line vs L, vs R, and overall (45%/55% blend):
FIP / K9 / BB9 / HR9 / wOBA-against / BABIP-against

**Defense** — runs above average per 162 G at each rated position, with positional adjustment

**Baserunning** — composite runs from SPE/STE/SR/RUN

**Value** — wRAA per 600 PA + BsR + best def → WAR per 600 PA (hitters) or WAR per 180 IP (pitchers)

## How it's calibrated

- Rating scale: collection mean ≈ 50, so 50 = MLB average for the category. Multiplier curve = `(rating/50)^0.55` so a rating of 100 ≈ 1.45× avg, 150 ≈ 1.79× avg. Gentle enough that extreme ratings don't blow up to unrealistic projections.
- League baselines: 2020-2026 average from `MLB Batting Year-by-Year Averages.xls`. Modern run environment: .244/.316/.404, wOBA .322, 4.46 R/G.
- Linear weights: contemporary Fangraphs (BB 0.69, 1B 0.89, 2B 1.27, 3B 1.62, HR 2.10).
- FIP constant: 3.10.

## Top of the leaderboard (sanity check)

Hitters: Yoenis Cespedes (1.20 OPS, .511 wOBA), John Beckwith, Tyler O'Neill, Xander Bogaerts, Buster Posey — all Diamond, all check out.

Pitchers: Steve Carlton (FIP 1.45, 13.6 K/9), Shane Bieber, Dwight Gooden, Devin Williams — Diamond aces dominating the top.

## Re-running

```bash
cd engine
python3 projections.py
# → writes data/projections.json (2024 cards)
```

## Next steps (in order)

1. **Tighten projections with feedback** — share a card you think is mis-rated; I'll tune the curves.
2. **Active roster** — tell me which CIDs are on your PT team so we can stop optimizing across the entire 2,024-card collection.
3. **Scaffold the webapp** — see STACK.md. Next.js + shadcn + DuckDB-WASM.
4. **Lineup optimizer** — given active roster + opponent SP hand + ballpark, return best 9.
5. **Draft engine** — for daily/weekly drafts, score each available pick by marginal runs added.
6. **Tournament meta scrape** — point me at the aggregator sites you read.
7. **Live stat blend** — once you drop weekly exports in `Current Stats/`, blend with projections.
