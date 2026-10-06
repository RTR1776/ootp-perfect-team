# Quick tiers, 2026-10-06 (collection 207)

L.J.: "put together the 3 strongest quicks I could play". Every Quick: PT default RE, neutral park, DH, variant limit 10, Bo5, 16 teams.

Method: for each tier, his best 26 (`env-roster --optimize --starts 8 --candidate-limit 40 --variant-cap 10 --sp 5 --rp 7 --bats 14`) against the same build from the whole catalogue (`--universe`, base forms only) — the most any field team can carry. Market = sum of the 26 cards' lowest asks in the last shop snapshot.

| Tier (max value) | His roster | Ceiling | Gap | Ceiling costs |
|---|---|---|---|---|
| Silver (79) | 165.7 | 168.7 | −3.0 | 575k |
| Bronze (69) | 91.8 | 100.5 | −8.7 | 260k |
| Gold (89) | 238.2 | 255.3 | −17.1 | 575k |
| Diamond (99) | 331.7 | 351.2 | −19.5 | 1,244k |
| Iron (59) | −84.9 | −60.5 | −24.4 | 66k |
| Low Diamond (94) | 257.4 | 288.0 | −30.6 | 667k |
| Low Iron (49) | −157.9 | −115.5 | −42.4 | 24k |

Picks: Silver, Bronze, Diamond. Rosters in this folder (env-roster output, all legal).
