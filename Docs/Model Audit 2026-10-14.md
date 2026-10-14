# Model audit — what are we missing? (2026-10-14)

L.J., after the framing question (cwhit: "framing is the most important thing"): "if we missed this, what else is important that we are overlooking — what are the top players seeing that our model doesn't?"

## Method

1. **Card-level residual scan** (`web/scripts/model-v2/audit-panel.ts` → `audit-scan.py`, `audit-checks.py`): every card-series in the tournament archive (observed_card_stats; 8,991 bat lines over 57 series, 5,801 arm lines) with the model's own prediction in that series' environment and park, field-hand blended, against what it did (wOBA runs per 700 PA; runs allowed per 700 BF). The residual (actual − model, within series) is regressed on each of the card's 86 ratings plus card value, card year, hand, LE. A finding counts only if both random halves of the series agree in sign and |t| > 3.
2. **Platoon check** on the league split exports (`audit-platoon.py`): each player's line against each hand, at equal split ratings.
3. **Framing** from the tournament exports on disk (`audit-framing.py`; the archive importer drops FRM): 42 exports, 3,394 catcher stints, 324k innings.
4. **Team level** (`audit-teams.py`): 1,124 team-events from the same 42 exports, win% on team-average traits, export fixed effects. Under-powered (R² 0.10 → 0.12); the full archive on the Mac would give 3,500+.

Model fit today: bats r 0.657 within series (slope 0.92); arms r 0.478 (slope 0.82 — the arms' spread is on average too wide).

## Findings, ranked by what they move

| # | What | Size | Evidence | In the model? | Fix |
|---|---|---|---|---|---|
| 1 | **Catcher framing** | +3.0 runs a season per +10 framing rating (tournaments); league 3.2. Framing runs spread −16 to +4 a season, against catcher ZR's −7 to +9 | r 0.68 over 324k tournament innings; league r 0.77 | **No** (catcher defense is ZR only; the archive has no FRM) | Add 0.30 × (framing − field mean) runs per 700 PA on the C slot; keep FRM in the archive importer |
| 2 | **Relievers beat their ratings** | +3.3 runs per 700 BF beyond the model (joint fit), +5.3 alone | t 15, both halves | Partly (roleRuns × roleTrust 0.25) | Raise role trust toward ~0.6–1.0; check on the archive |
| 3 | **Arm rating weights** | Stuff +0.3 and pHR +0.4 runs/700 BF per +10 under-credited; Control −0.3 over-credited; high-value arms underperform (−1.1 per +10 value) | both halves, t 5–6 | Weights from the 2010 curves | Refit Stuff/Control/pHR/pBABIP jointly against runs allowed (Movement is collinear with pHR/pBABIP, leave it out) |
| 4 | **Stamina per batter** | −0.8 runs/700 BF per +10 stamina (deep starters face the order 3–4 times) | t 14; already known (STAMINA note in calibration.ts) | Staff-level term only | Per-arm times-through-order term, offset by the staff stamina term; low priority |
| 5 | **Platoon beyond split ratings** | Lefty bats +1.8 runs/700 vs RHP, −1.6 vs LHP; switch +1.9 / −1.0 | League split exports, 6.7M PA | No | Hand term per board; ≈ +0.6 net for a lefty in a 64% RHP field |
| 6 | Catchers / middle infielders hit below their ratings | −0.8 runs/700 per sd of catcher rating; SS/2B −0.5 | both halves | No | Small; position bat penalty, later |
| 7 | **Stealing at team level** | +0.9 win% points per sd of team Stealing (both halves), more than SB runs explain (+0.2 runs/700 per sd card-level) | t 2.9, team level, small sample | Speed only | Needs the full archive before acting |
| 8 | LE cards beat the model | +2.6 runs/700 | t 3.9 | — | Unexplained; watch |

**Not problems:** card value does not predict bat residuals (the market knows nothing the ratings don't); Gap and Avoid K are priced right; BABIP splits fixed 10-12. The +3.5 runs/700 "lefty bats beat the model" in the tournament archive is mostly usage (lefties platooned onto the RHP side), not model error — only the ±1.7 platoon term in #5 is real.

## Proposed order

1. Framing (#1) — biggest, cleanest, cheapest.
2. Reliever trust (#2) and arm reweight (#3) together, validated on the archive at card level and on the six PTCS 7 Championship brackets at team level.
3. Platoon term (#5).
4. Re-run the team-level test on the full archive from the Mac (stealing, framing, stamina at team level).
Then one full rebuild.
