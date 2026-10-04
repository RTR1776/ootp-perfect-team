# League plan for next HD week (2026-10-04, PEL data still to come)

Field: 119 teams from HD450–HD453, week of 10-04. Model: `park-sweep` / `league-best` / `league-compare --league HD452` (league model 09-28, catcher framing measured; HD family, 46% of PA vs LHP). Arms also read off every card's pooled HD+PEL results (`League Buys 2026-10-04 (Claude).md`).

## Where the team stands
- Neutral park: **+51.5 runs over the average HD team** — bats +50.4, arms +1.1. The offense is a top HD offense; the staff is an average HD staff.
- HD452 actual: 763 scored (7th) / 791 allowed (28th), 78-83. The model's arms say average; the gap is defense (team ZR −13.8, Soto −7.7 in RF), catchers, the park, and luck.

## Park (runs over 81 home games against the field in the same park; ~10 runs = 1 win)
| Park | Edge | Notes |
|---|---|---|
| 2026 Southwest University Park | +4.8 | AVG ×1.10, HR vs LHB ×1.50 — a launching pad; more balls in play falling for hits |
| **1919 Sportsman's Park** | **+4.8** | neutral AVG (1.04/1.00), LHB HR ×1.36, RHB HR ×0.91 — same edge, defense matters less |
| 1971 Yankee Stadium | +4.2 | low AVG, LHB HR ×1.22, RHB HR ×0.73 |
| 1945 Fenway Park | **−5.0** | the worst of 200+ for this roster (it was the 09-27 suggestion) |
Best to worst is ~10 runs. Recommendation: 1919 Sportsman's Park.

## Lineups (league model, gloves in runs)
- vs RHP: C Ed Bailey (VAR) · 1B Aaron · 2B De Vries · 3B Rolen · SS Banks · LF Manush · CF Hidalgo · RF Soto · DH Matsui.
- vs LHP: C Josh Gibson · 1B Aaron · 2B Boone · 3B Rolen · SS Banks · LF Manush · CF Ott · RF Soto · DH Matsui.
- With gloves weighted 1.5× (L.J.: defense matters): vs RHP Wood at 1B (glove 105) over Aaron (75); vs LHP Manush to CF, Aaron LF, De Vries 1B.
- Owned cards that change nothing: Bo Jackson, O'Doul, Mays, Cholowsky, Chris Davis, Hornsby, Simmons. Beltran: +0.7 runs (RF vs LHP, Soto to LF).

## Staff (pooled league runs saved per 200 IP)
- Rotation: Hershiser +5.3 (83k IP), Cliff Lee VAR +7.0, Cy Young VAR +4.1, Sabathia +2.4 (122k), Saberhagen +1.9; Haddix +1.2 long.
- Pen: Willie Hernandez +9.7 (closer), Britton +8.7, Kimbrel +7.0, Nen +2.7, Gossage +2.7, Palencia VAR +2.6, Fossas VAR. Stieb −3.6: off.
- No owned arm off the roster beats these on league results (best: Larry Jackson +3.7 on 893 IP).

## Buys, by runs per 100k
| Buy | Price | Season runs | Runs/100k |
|---|---|---|---|
| Kenley Jansen (RP, for Stieb) | 99.5k | ≈ +4 | 4.0 |
| Eddie Plank (SP, for Saberhagen/Haddix) | 225k | ≈ +3.5 | 1.6 |
| Aroldis Chapman (RP) | 153k | ≈ +2 | 1.3 |
| Cal Raleigh (C, both boards) | ~1.5M | +6.3 (+8 with gloves ×1.5) | 0.4–0.5 |
No cheap catcher helps: base Ethan Salas adds 0. The VARs aren't for sale; the new Yogi is out of budget.

## Park type (L.J. 10-04: Sportsman's Park and Southwest aren't choices; HD452 used 2026 Tropicana Field)
- 2026 Tropicana Field ranks 191st of 238 for this roster (edge −1.0). It boosts right-handed hitting (RHB AVG ×1.065, HR ×1.082), which helps the field more than this lefty-leaning lineup.
- A fit over all 238 parks (R² 0.999) gives edge ≈ 10.5·(LHB HR −1) + 8.0·(LHB AVG −1) − 7.0·(RHB HR −1) − 5.6·(RHB AVG −1), in runs per 81 home games. Doubles and triples don't matter.
- What to look for: **a lefty park.** LHB HR up (≥1.15), RHB HR down (≤0.90), LHB AVG at or above 1.00, RHB AVG at or below 1.00. How many runs a park allows overall barely matters; the left/right split is what counts.
