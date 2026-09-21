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

## Stadium choices

| park | AvgL | AvgR | HR L | HR R | 2B | 3B | bats | arms | you | field | **edge** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **1971 Yankee Stadium** | 0.983 | 0.975 | 1.220 | 0.725 | 0.985 | 1.180 | +2.1 | −3.1 | −1.0 | −12.5 | **+11.5** |
| **1927 Bacharach Park** | 0.970 | 0.970 | 1.150 | 0.660 | 0.980 | 0.940 | +0.5 | −4.9 | −4.4 | −15.7 | **+11.3** |
| 1919 Sportsmans Park | 1.039 | 1.001 | 1.361 | 0.906 | 1.029 | 1.071 | +5.9 | +2.1 | +8.1 | −2.9 | +10.9 |
| 1928 Mack Park | 1.050 | 1.050 | 1.220 | 0.780 | 1.030 | 0.980 | +3.9 | +1.5 | +5.4 | −4.9 | +10.3 |
| **2026 PNC Field** (modern) | 1.020 | 0.930 | 1.150 | 0.810 | 0.955 | 0.816 | +1.6 | −3.6 | −1.9 | −11.3 | **+9.4** |
| 2026 Southwest University | 1.100 | 1.100 | 1.500 | 1.100 | 1.120 | 1.209 | +10.4 | +10.7 | +21.1 | +12.2 | +8.9 |
| 2026 Louisville Slugger | 1.060 | 0.950 | 1.150 | 0.890 | 1.027 | 1.024 | +3.0 | −0.9 | +2.1 | −5.8 | +7.9 |

Runs over 81 home games against the same field in the same park; ~10 runs = 1 win.
`bats`/`arms` split your half into lineup and staff, both against neutral.

**Avoid:** 1945 Fenway (−14.3), 1911 Bennett Park (−10.3), 1946 Fenway (−8.3),
1926 Navin Field (−8.0). All high-HR-to-RHB — the field's shape, not yours.

### Why it is the asymmetric park and not a bunker

You asked whether a strong staff lets you go extreme pitcher's park. Tested:

| park | HR L / R | bats | arms | you | field | **edge** |
|---|---|---|---|---|---|---|
| 1940 Rickwood Field | 0.600 / 0.500 | −8.4 | −12.6 | −21.0 | −24.0 | **+3.0** |
| 1930 Hamtramck | 0.620 / 0.600 | −5.9 | −5.9 | −11.8 | −13.2 | **+1.4** |
| 1926 Braves Field | 0.631 / 0.642 | −6.8 | −8.3 | −15.2 | −15.8 | **+0.6** |

Blanket suppression taxes your own offense as hard as theirs, **and it shrinks
your staff's own edge** — at Rickwood the arms lose 12.6 runs of value, because
there is less offense left to prevent. Net +3.

What you want is **targeted** suppression. The field is 57.2% RHB; you are 53.8%
effective LHB (switch hitters bat left vs RHP):

| share of PA | LHB | switch | RHB |
|---|---|---|---|
| Torrent | 33.8% | 20.0% | 46.1% |
| PEL field | 28.3% | 14.5% | 57.2% |

Bacharach '27 **is** a pitcher's park — AvgL and AvgR both 0.970 — it just
declines to tax the one thing you are good at. Yankee '71 is the same trade with
a triples kicker (3B 1.180). Either is worth ~8 runs more than the bunker.

One caveat the model does not price: in a heavily suppressed park a given run
differential converts to *more* wins (Pythagorean sensitivity rises as the run
level falls). That nudges the bunkers up somewhat — not by the 8 runs they trail.

### ⚠ Name traps

- **PNC Field** (Scranton/WB, +9.4) is not **PNC Park** (Pittsburgh, ~+1).
- **Truist Field** (Charlotte, HR 1.50/1.46) is not **Truist Park** (Atlanta).
- The park table carries **"Hichliffe Stadium"** and **"Hinchliffe Stadium"** as
  separate 1936 rows with identical factors. Same park, one misspelt. `parkTwins()`
  does not catch it because the normaliser only strips the suffix word.

## The vR bat, at a PEL-legal floor

`pnpm vl:dh --board vR --park "Bacharach Park" --park-year 1927 --min-value 100`

| vsRHP | vsLHP | split | val | B | year | name | pos | price |
|---|---|---|---|---|---|---|---|---|
| +41.1 | +41.1 | +0.0 | 100 | R | 1988 | **Jose Canseco** | RF | ~349,950 |
| +40.4 | +19.1 | +21.3 | 101 | R | 1995 | Albert Belle | LF | ~175,500 |
| +38.7 | +14.8 | +23.9 | 101 | L | 2016 | **David Ortiz** | DH | ~179,000 |
| +36.2 | −2.8 | +39.1 | 101 | L | 2013 | Chris Davis | 1B | ~102,334 |
| +34.9 | +39.4 | −4.5 | 102 | R | 1959 | Hank Aaron | RF | ~353,594 |
| +30.8 | +17.1 | +13.7 | 100 | L | 1929 | Lefty O'Doul | LF | ~63,318 |

Your own bar, same park: Ed Bailey +37.6 (but −26.5 vL), Hidalgo +34.3,
Banks +33.9, Ott +33.4.

**The park and the bat interact, so judge them together:**

| add | neutral vs field | best park edge | **total** | price |
|---|---|---|---|---|
| — | −1.5 | +11.5 | +10.0 | — |
| **Jose Canseco (R)** | **+39.3** | +6.3 (Sportsmans) | **+45.6** | ~350k |
| **David Ortiz (L)** | +28.7 | **+14.7** (Yankee '71) | **+43.4** | ~179k |
| Albert Belle (R) | +17.1 | +9.3 | +26.4 | ~176k |

Canseco is the best card on the board — a genuine no-split monster (+41.1 both
ways), RF 88 / LF 83, Speed 93, so he fields. But he is right-handed, so he
**halves your park edge**, and he costs double.

**Ortiz gets you within 2 runs of Canseco for half the money**, and he is the one
that compounds with the park rather than fighting it. PEL does run a DH (12 cards,
4,911 PA), so he is legal. Downside: DH-only (1B 59, OF 8, Speed 5) — he occupies
the DH slot and gives you no defensive flexibility. His vL is +14.8, so he is an
everyday bat, not a platoon piece (that is Chris Davis at −2.8).

Budget play: **Lefty O'Doul at ~63,000** — left-handed, +30.8/+17.1, no platoon hole.

Belle is the one to skip: right-handed like Canseco but 23 runs worse on the
neutral line.

## Before the season starts

1. **1971 Yankee Stadium** or **1927 Bacharach Park** — same decision, 0.2 runs
   apart. **2026 PNC Field** if you want a modern yard (+9.4). Check the name.
2. **David Ortiz** (~179k) unless you want to spend ~350k on Canseco and re-pick
   the park as Sportsmans '19. Do not buy Belle.
3. Skip the bunker parks — tested, worth +3 at best.
