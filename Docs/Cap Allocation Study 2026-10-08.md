# Cap allocation study — 2026-10-08

L.J. asked how the engine builds cap rosters against how top players do it (RP punted, offense first?),
whether "stars + basement" beats "all middle", and how this changes with the run environment.

**Data:** `Tourney Data/Cap Exports/` (36 runs of 11 cap series, 3,365 teams; L.J. pushed them 10-08).
Rerun: `python3 -I web/scripts/cap-study/teams.py "Tourney Data/Cap Exports" teams.json && python3 -I web/scripts/cap-study/analyze.py teams.json`.
Every variable is demeaned within its event file, so teams are compared with their own field. Outcomes: run
differential per game and total wins (most of these events are Bo7 brackets).
Roles: lineup = hitters with ≥40% of the team's top PA; bench = other hitters; SP = GS/G ≥ 0.5; RP = other arms.
Eras by RE: pre-1930 (Early Years, 31 teams: too few to read), 1960s–70s (Nightmare 1971, CC5 1979: 710 teams), modern 1990s+ (2,624).

## Findings
- **Move 10% of the cap from the lineup into:** SP → −1.26 RD/G, −3.8 wins; RP → −0.53 RD/G, −1.1 wins; bench → −1.5 wins. All 2+ SE. In the 1960s–70s group SP is the worst place for extra cap (−3.7 RD/G per 10%); the lineup's place in the value window is what counts there (+0.40 RD/G per 0.1 of the window).
- **Shape at the same total:** more basement cards (bottom 20% of the window) +0.47 RD/G per 10% of the roster; more top-of-window "stars" −0.39. Spread (SD) +0.56 per 5 points. Cheap efficient cards fill slots; the freed cap buys upper-middle, not the priciest cards.
- **The rotation:** one ace near the top of the window helps (modern +0.18 RD/G per 0.1 of the window); the rest of the rotation and the pen placed higher hurts (−0.19, −0.17).
- **Best quarter vs the rest:** lineup 43.3% vs 42.0%, bench 12.0% vs 12.8%, SP 20.2% vs 20.8%, RP the same 24.5% but cheaper per arm (pen at 0.20 vs 0.25 of the window, 6.9 relievers vs 6.4), ace at 0.91 vs 0.88 of the window.
- This **reverses** the per-card WAR reading earlier the same day (SP upgrades looked best per value point): per-card WAR carries playing time and selection; the team-level comparison is the one to trust. **Don't raise the engine's SP weight for cap events.**

## The engine's builds against it
PTCS 7 Championship rosters (1970 RE): lineup 44–55% of the cap, SP ~20% with one or two aces and a cheap back end, pen 15–21% (40–45 cards in the wide windows). They already lean further toward "lineup + ace + basement pen" than the field's best quarter. Caveat: the cheapest pens (floor cards) sit at the edge of what the field tried, so the data can't confirm going that far. No rebuild recommended.
