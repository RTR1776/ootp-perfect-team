# Perfect League — home park pick, week of 2026-09-21

First PEL season. Roster read from the **HD451 2026-09-20** export (31 cards),
field read from the **PEL 2026-09-20** export (36 teams), 2010 run environment,
collection upload 135 so the three variants score as the owned copy.

    pnpm park:sweep --league HD451 --on 2026-09-20 \
      --team "Kansas City Torrent - JW" --year 2010 --field PEL \
      --add "Fred McGriff" --drop "Roger Connor" --top 20

## The pick

**1927 Bacharach Park**, with **1971 Yankee Stadium** an interchangeable second.

| park | AvgL | AvgR | HR L | HR R | 2B | 3B | you | field | **edge** |
|---|---|---|---|---|---|---|---|---|---|
| 1927 Bacharach Park | 0.970 | 0.970 | **1.150** | **0.660** | 0.980 | 0.940 | −9.0 | −16.7 | **+7.7** |
| 1971 Yankee Stadium | 0.983 | 0.975 | **1.220** | **0.725** | 0.985 | 1.180 | −3.2 | −10.8 | **+7.6** |
| 1928 Mack Park | 1.050 | 1.050 | 1.220 | 0.780 | 1.030 | 0.980 | +7.8 | +1.0 | +6.8 |
| 1919 Sportsmans Park | 1.039 | 1.001 | 1.361 | 0.906 | 1.029 | 1.071 | +12.5 | +5.8 | +6.7 |
| 2026 PNC Field | 1.020 | 0.930 | 1.150 | 0.810 | 0.955 | 0.816 | −4.7 | −10.5 | +5.8 |

Runs over 81 home games against the same field in the same park; ~10 runs = 1 win.

**Avoid:** 1945 Fenway (−9.5), 1911 Bennett Park (−7.3), 1926 Navin Field (−5.3),
1921 Baker Bowl (−4.8). All of them are high-HR-to-RHB parks, which is the field's
shape and not yours.

### Why

You are a **left-handed club in a right-handed league**, and by a wide margin:

| share of PA | LHB | switch | RHB | LHP share of IP |
|---|---|---|---|---|
| **Torrent** | 33.8% | 20.0% | 46.1% | 46.6% |
| **PEL field (36 teams)** | 28.3% | 14.5% | 57.2% | 49.3% |

Switch hitters bat left against right-handers, so **53.8% of your PA bat left against
the 57.2% of the field's that bat right.** A park multiplies both clubs, so it only
pays where you differ — and an 11-point handedness gap is the difference. Every park
at the top of the list has the same shape: HR to left-handed batters up, HR to
right-handed batters down. It feeds your half of the platoon and starves theirs.

The pitching side does not drive this — the LHP shares are close enough to cancel.

### How firm is it

Firm. Re-run on the **previous** week (HD453 2026-09-13 roster vs the same PEL field)
the top four are the same four parks, order swapped inside a tenth of a run:
Yankee '71 +3.9, Bacharach +3.9, Mack +3.8, Sportsmans +3.8. Fourteen of the top
twenty survive week to week. The bottom is just as stable — 1945 Fenway and 1911
Bennett Park are last both weeks.

The old counts-based `park-pick.py` does **not** agree with itself across those same
two weeks (the HR-vs-RHB edge swung +42 to −6). Ratings persist; one season of counts
does not. Use the sweep.

### ⚠ Two name traps

- **PNC Field** (Scranton/WB, +5.8) is not **PNC Park** (Pittsburgh, +1.2). Picking
  the wrong one costs 4.6 runs.
- **Truist Field** (Charlotte, HR 1.50/1.46) is not **Truist Park** (Atlanta, neutral).
  Truist Field is close to the worst park on this list for you.

## The vR bat, and why it is a left-handed one

Scored on the vs-RHP board **in 1927 Bacharach**, half-weighted for home games
(`pnpm vl:dh --board vR --park "Bacharach Park" --park-year 1927 --set Clubhouse`):

| | vsRHP | vsLHP | split | val | B | year | name | pos | price |
|---|---|---|---|---|---|---|---|---|---|
| **Clubhouse** | **+33.2** | −6.0 | +39.2 | 95 | L | 1989 | **Fred McGriff** | 1B | ~98,600 |
| Clubhouse | +32.6 | +17.8 | +14.9 | 101 | R | 1995 | Albert Belle | LF | ~175,500 |
| Clubhouse | **+22.6** | −5.4 | +28.0 | 95 | L | 1930 | **Goose Goslin** | LF | **~14,200** |
| Clubhouse | +21.5 | +20.1 | +1.4 | 100 | R | 2026 | Jordan Walker | RF | ~76,200 |
| Clubhouse | +20.6 | −7.3 | +27.9 | 100 | L | 1961 | Norm Cash | 1B | ~56,100 |
| Clubhouse | +25.7 | +36.9 | −11.1 | 102 | R | 1959 | Hank Aaron | RF | ~353,600 |

Open market, for comparison: David Ortiz 2016 (L, DH) +32.3 at ~179,000, Chris Davis
2013 (L, 1B) +26.5 at ~102,300, Jose Canseco 1988 (R) +31.5 at ~349,950.

**Take McGriff.** He is the best vR bat available to you at any price in this park,
he is the cheapest of the top tier, and — the part that matters — **he is left-handed,
so the park and the bat compound.** The sweep proves it rather than assuming it:

| roster | neutral vs field | Bacharach edge |
|---|---|---|
| as it stands | **−4.1** | +7.0 |
| **+ McGriff (L)** | **+0.8** | **+7.7** |
| + Belle (R) | — | **+5.3** |

Belle is the better card in a vacuum and the *worse* card here. He is right-handed, so
the park you want (HR to RHB 0.66) actively suppresses him, and adding him **drops**
the park edge from +7.0 to +5.3. McGriff raises it. That is a ~2.4-run swing in park
terms alone, on top of McGriff being 77,000 PP cheaper.

Swapping McGriff in for **Roger Connor** (1B, 96 PA — your lowest-use bat) moves the
club from 4.1 runs *below* the PEL average to 0.8 *above* it. With the park on top:
**about +8.5 runs, call it most of a win.** That is the honest size of this decision —
real, not a season-maker.

If PP is tight, **Goose Goslin at ~14,200** is the value play: a fifth of McGriff's
price for two-thirds of his vR production, and left-handed too.

Both are platoon cards (McGriff −6.0 vs LHP, Goslin −5.4). Sit them against lefties;
Ernie Banks (+27.1 vL) and Josh Gibson cover that side.

## Before the season starts

1. Pick **Bacharach Park 1927** (or Yankee Stadium 1971 — they are the same decision).
   Check the name twice; PNC Field ≠ PNC Park.
2. Sign **Fred McGriff** (~98,600), or **Goose Goslin** (~14,200) on a budget.
3. Bench **Roger Connor** against right-handers.
