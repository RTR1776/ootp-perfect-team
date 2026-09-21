# Perfect League — home park, staff fit and the vR bat, week of 2026-09-21

First PEL season. Roster read from the **HD451 2026-09-20** export (31 cards),
field from the **PEL 2026-09-20** export (36 teams), 2010 run environment,
collection upload 135 so the three variants score as the owned copy.

    pnpm park:sweep --league HD451 --on 2026-09-20 \
      --team "Kansas City Torrent - JW" --year 2010 --field PEL --top 20

> **Correction from the first draft of this note.** It recommended Fred McGriff
> and was wrong twice. He is a **95-value** card in a league whose bats sit at a
> 5th percentile of 100 — 3.3% of PEL bats are under 100 at all. And the two
> scripts were calling `envFitMaps` **without `eraYear`**, so the era correction
> was off and BABIP was under-priced ~2.3× and Gap ~1.5× — precisely McGriff's
> weak ratings (BABIP vR 88, Gap vR 97) against his elite ones (Power 220,
> Eye 233). The model was flattering exactly that archetype. Both scripts now
> pass `eraYear`, as `env-roster`, `roster-diff` and `cwhit-compare` always did.
> Every number below is post-fix. McGriff's own record: 59 PA, two series,
> +.016 and −.102 against field.

## What you are

| | you | PEL field | |
|---|---|---|---|
| **bats** | +214.2 | +225.7 | **−11.5** — below average |
| **arms** | +105.2 | +95.2 | **+10.0** — above average |
| total | +319.4 | +320.9 | −1.5 |

**You are a pitching-first club in PEL**, and the staff edge is real. Where it
comes from matters, though (IP-weighted, vs RHB):

| | you | field |
|---|---|---|
| Control | **135.3** | 132.5 |
| Movement | **137.8** | 135.9 |
| pBABIP | **140.4** | 135.4 |
| Stuff | 128.8 | **132.4** |
| HR avoidance | 137.1 | 136.7 |

A control/movement/contact-suppression staff, slightly light on pure Stuff —
which is the profile the engine rewards (`CON` β −0.94 beats `STU` β +0.53 about
2×). **But your HR avoidance is dead league-average**, so the park's HR factors
do not specially help or hurt your rotation. The rotation is *neutral* on the
park question; it neither argues for the pick below nor against it. The lineup
asymmetry is what decides it.

## Stadium choices — from YOUR available list

Ranked against the parks you actually have (your three screenshots, all levels —
you said required level is irrelevant). This supersedes the earlier ranking,
which was run against the whole historical table and picked two parks you cannot
choose (Bacharach '27, Yankee '71).

| park | AvgL | AvgR | HR L | HR R | 2B | 3B | bats | arms | you | field | **edge** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **1987 Yankee Stadium** | 1.099 | 0.953 | 1.088 | 0.969 | 0.965 | 0.847 | +2.9 | +0.3 | +3.2 | −2.2 | **+5.4** |
| **1952 Yankee Stadium** | 0.943 | 0.961 | 1.126 | 0.876 | 0.893 | 1.008 | +0.0 | −3.3 | −3.3 | −8.6 | **+5.3** |
| 1986 Three Rivers Stadium | 1.002 | 1.007 | 1.115 | 0.950 | 1.033 | 1.067 | +1.7 | +0.5 | +2.3 | −1.4 | +3.6 |
| 1911 Washington Park | 1.005 | 0.953 | 0.919 | 0.831 | 1.029 | 0.979 | −1.6 | −4.1 | −5.7 | −8.9 | +3.1 |
| 2026 Polar Park | 1.090 | 1.020 | 1.050 | 0.980 | 1.240 | 0.700 | +3.0 | +3.0 | +6.0 | +3.0 | +3.0 |
| 1945 Comiskey Park | 1.125 | 0.931 | 0.957 | 0.987 | 0.978 | 0.997 | +1.6 | −0.6 | +1.0 | −1.9 | +2.9 |
| 1980 Astrodome | 1.024 | 0.910 | 0.888 | 0.855 | 0.979 | 1.197 | −1.8 | −5.2 | −7.0 | −9.9 | +2.9 |
| 1940 Forbes Field | 1.045 | 1.026 | 0.942 | 0.847 | 0.971 | 1.229 | −0.3 | −0.5 | −0.8 | −3.6 | +2.8 |
| 2026 Oriole Park at Camden Yards | 1.030 | 1.034 | 1.060 | 0.945 | 0.963 | 1.013 | +1.3 | +1.4 | +2.7 | +0.1 | +2.7 |
| 1936 Hinchliffe Stadium | 1.140 | 1.140 | 0.880 | 0.810 | 1.070 | 1.000 | +1.2 | +4.9 | +6.2 | +3.8 | +2.4 |
| 1949 Polo Grounds | 0.800 | 0.816 | 1.192 | 1.069 | 0.902 | 0.967 | −1.5 | −7.4 | −9.0 | −10.7 | +1.8 |
| 1905 League Park | 1.200 | 1.089 | 0.883 | 0.929 | 0.913 | 0.884 | +2.2 | +5.4 | +7.6 | +5.9 | +1.7 |
| 1985 Wrigley Field | 1.039 | 1.018 | 1.187 | 1.144 | 0.958 | 1.025 | +3.9 | +4.4 | +8.2 | +7.1 | +1.1 |
| 1927 Sportsmans Park | 0.996 | 0.977 | 1.201 | 1.162 | 1.030 | 1.022 | +3.3 | +2.6 | +5.9 | +5.1 | +0.8 |
| 1992 Oriole Park at Camden Yards | 1.012 | 0.975 | 1.055 | 1.073 | 0.974 | 0.981 | +1.1 | +0.6 | +1.7 | +1.6 | +0.1 |

Runs over 81 home games against the same field in the same park; ~10 runs = 1 win.
`bats`/`arms` split your half into lineup and staff, both against neutral.

**The two Yankee Stadiums are the pick, and they are opposite routes to the same
number:**

- **1987** is a left-handed *average* park (AvgL 1.099 vs AvgR 0.953). It **adds**
  runs — your bats +2.9, staff untouched. Best raw edge, +5.4.
- **1952** is a left-handed *power* park that **suppresses** overall (HRL 1.126 /
  HRR 0.876, AvgL 0.943). Your production drops 3.3 but the field's drops 8.6.

**For a pitching-first club, 1952 is the better fit** even though it trails by
0.1 runs: it is the run-suppressing option, and in a low-run park a given run
differential converts to more wins (Pythagorean sensitivity rises as the run
level falls) — an effect the sweep does not price. If you buy a big bat instead,
1987 pulls ahead (+7.3 vs +6.7 with Ortiz).

Note **League Park 1905 scores only +1.7** despite the biggest LHB average factor
on your list (1.200) — because AvgR 1.089 is nearly as high, so it feeds the
field's right-handed bats too. Asymmetry is what pays, not raw LHB friendliness.
(That row was not in `reference/ballparks.csv`; added from your screenshot.)

Skip **1949 Polo Grounds** despite its LHB look: AvgL 0.800 guts your own contact.

### ⚠ Name traps

- **PNC Field** is not **PNC Park** (yours is PNC Park, 2026, +1.2).
- **Truist Field** (Charlotte, HR 1.50/1.46) is not **Truist Park** (Atlanta).
- The table carries **"Hichliffe Stadium"** and **"Hinchliffe Stadium"** as
  separate 1936 rows with identical factors. Same park, one misspelt; yours is
  the New York Black Yankees row.

## The vR bat — and your park list changes the answer

`pnpm vl:dh --board vR --park "Yankee Stadium" --park-year 1987 --min-value 100`

| vsRHP | vsLHP | split | val | B | year | name | pos | price |
|---|---|---|---|---|---|---|---|---|
| +41.1 | +41.1 | +0.0 | 100 | R | 1988 | **Jose Canseco** | RF | ~349,950 |
| +40.4 | +19.1 | +21.3 | 101 | R | 1995 | Albert Belle | LF | ~175,500 |
| +38.7 | +14.8 | +23.9 | 101 | L | 2016 | **David Ortiz** | DH | ~179,000 |
| +36.2 | −2.8 | +39.1 | 101 | L | 2013 | Chris Davis | 1B | ~102,334 |
| +30.8 | +17.1 | +13.7 | 100 | L | 1929 | Lefty O'Doul | LF | ~63,318 |

**Judged together with the park:**

| add | neutral vs field | best available park | **total** | price |
|---|---|---|---|---|
| — | −1.5 | +5.4 (Yankee '87) | +3.9 | — |
| **Jose Canseco (R)** | **+39.3** | +3.3 | **+42.6** | ~350k |
| David Ortiz (L) | +28.7 | +7.3 | +36.0 | ~179k |

**This reverses the earlier recommendation.** Against the full historical table
the best park was worth +11.5, so a left-handed bat that compounded with it beat
a better right-handed card. Your actual list tops out at +5.4 — the park term is
half as large, so it no longer overturns Canseco's 10.6-run advantage on the
neutral line. **Canseco is the pick if you can spend it**: +6.6 runs over Ortiz,
no platoon split at all (+41.1 both boards), and he fields (RF 88, LF 83,
Speed 93) rather than occupying the DH slot.

**Ortiz is the value play** — 85% of the benefit for half the money, and he is
the one that compounds with the park. **Lefty O'Doul at ~63,000** is the budget
version. Skip Belle: right-handed like Canseco but 23 runs worse on the neutral line.

## Before the season starts

1. **Yankee Stadium 1952** if you want to lean into the staff (run-suppressing,
   +5.3), **Yankee Stadium 1987** if you buy a bat (+5.4, +7.3 with Ortiz).
   They are 0.1 runs apart — this is a preference, not a mistake either way.
2. **Jose Canseco** (~350k) is the biggest single upgrade available, +42.6 total.
   **David Ortiz** (~179k) gets 85% of it. **Lefty O'Doul** (~63k) on a budget.
   Do not buy Belle.
3. Skip the bunker parks and skip Polo Grounds '49 — tested, they do not pay.
