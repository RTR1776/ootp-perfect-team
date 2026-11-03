# PTCS 8 PD Weekly draft kit (Claude, 2026-11-03)

**The event:** Modified Perfectly Iron PD (catalogue 9080010). 21 cards, 1919 run environment, no DH, 1914 Griffith Stadium, best of 9, Saturday 11-07 at 11:30 ET.

**Assumed, tell me if wrong:**
- 4 Perfect rounds, then 17 Iron (21 in all).
- Each round you pick the position, then see a pack of 6.

**The park is a strong lefty park:**
- AVG: L 1.052, R 0.992.
- HR: L 1.178, R 0.902.
- 2B 0.93, 3B 1.13. The game's park settings have one doubles and one triples factor for both hands.
- The outfield is enormous: about 433 ft average in LF (464 down the line), 420 in CF, 361 in RF. That's the deepest LF of any PTCS 8 park. In this park an LF glove is worth more than the model credits (see the PTCS 8 review).

**Live helper:** `/draft/live` once PR 166 merges, choosing "PTCS 8 PD Weekly". Type each pack's cards in and it gives the best pick with the rounds left priced in. Scores are runs over a replacement card in this environment and park, with gloves in, so the same scale as Build.

## Perfect rounds: use all four on position players

What a Perfect pick gains over the Iron card you'd otherwise draft at that spot. Each figure is the expected best card of a 6-card pack:

| Spot | Best of 6 Perfects | Best of 6 Irons | Gain from the Perfect |
|---|---|---|---|
| 2B | 101.5 | 34.3 | **67.2** |
| LF | 86.1 | 21.0 | **65.2** |
| CF | 88.5 | 26.9 | **61.6** |
| SS | 97.1 | 36.2 | 60.8 |
| 3B | 85.4 | 24.8 | 60.6 |
| RF | 81.2 | 22.0 | 59.2 |
| C | 70.0 | 19.5 | 50.5 |
| 1B | 77.9 | 22.1 | 55.9 |
| SP | 42.6 | 10.8 | 31.8 |
| RP | 16.4 | 4.2 | 12.2 |

- **Order: 2B, LF, CF, then SS or 3B.** At 2B, Chase Utley, Ross Barnes and Pop Lloyd are the biggest bats in the pool.
- The PTCS 8 prize cards, Nap Lajoie 104 and Roger Bresnahan 103, are left out of the pack figures; they're almost certainly not draftable. They still appear in the lists below.
- In LF the best Iron options are weak and the park makes the glove matter, so LF ranks above CF.
- **SS is the spot where Iron is deepest.** Ozzie Smith (59, SS 140), Chris Taylor and Specs Clark are all decent, so a Perfect SS gains less than its raw number suggests.
- **Not an SP.** A Perfect SP gains about 32 runs, about half what a bat gains. I also weighted starters for deadball complete games (about 2.1 lineup slots each, against the default 1.5), and the SP still only reaches about 45. Iron SPs are thin, but the Perfect bat gain is bigger.
- **Never an RP**, as you said.
- **When to break the rule:** only if the packs are mixed and every bat in a Perfect pack is poor. Take a Perfect SP (Mathewson, Bumgarner, Verlander, Mordecai Brown) only when the best bat in the pack gains under about 35.

## Iron rounds (17)

**Shape:** 4 lineup spots, 1 backup C, 4 SP, 5 RP and 3 bench (the model's pre-1930 shape: 4 SP and 5 RP).

**Priorities:**
- **Gloves first in the infield and CF.** Iron bats are all below average. A good glove at SS, 2B, 3B or CF is worth more than a few points of bat in deadball. Examples: Ozzie Smith 59, Santiago Espinal 55, Ray Dandridge 47 at 3B, and Norris Hopper 53 in CF.
- **Iron catchers are bad bats.** Take the glove: Ossee Schrecongost or Jose Molina.
- **SP:**
  - Big Jeff Pfeffer (59) and Lefty Grove (48) are the clear top two.
  - Two-way starters (an own bat shown in the SP table) add value because pitchers hit here.
- **The pen barely matters.** Iron relievers are all about −5 to −9 runs per 700 batters faced. Take them last.

## Perfect rounds: the best cards at each spot

**Perfect 2B** (19 cards)

| Score | Card | Val | Year | Bats | vR / vL at slot | Bat vR / vL | Positions |
|---|---|---|---|---|---|---|---|
| 114.5 | Nap Lajoie | 104 | 1901 | R | +115.3 / +112.5 | +51.9 / +50.9 | 1B 99 2B 119 3B 97 SS 99 |
| 107.3 | Chase Utley | 102 | 2009 | L | +106.4 / +109.2 | +33.4 / +38.0 | 2B 139 |
| 104.6 | Ross Barnes | 102 | 1873 | R | +103.4 / +107.5 | +32.3 / +38.2 | 2B 135 3B 99 SS 109 |
| 102.5 | Pop Lloyd | 101 | 1924 | L | +106.9 / +92.2 | +39.2 / +26.2 | 1B 90 2B 128 3B 119 SS 114 |
| 93.4 | Tommy Hinzo | 100 | 1987 | S | +94.5 / +90.6 | +27.3 / +25.2 | 2B 127 3B 96 SS 102 |
| 92.5 | Fred Dunlap | 101 | 1884 | R | +92.1 / +93.5 | +23.5 / +26.6 | 2B 130 RF 93 |
| 91.5 | Rogers Hornsby | 101 | 1921 | R | +91.2 / +92.2 | +24.5 / +27.2 | 2B 126 3B 108 SS 108 LF 76 |
| 87.3 | Jackie Robinson | 100 | 1949 | R | +88.7 / +84.0 | +15.7 / +12.7 | 1B 92 2B 139 3B 119 LF 110 |

**Perfect LF** (18 cards)

| Score | Card | Val | Year | Bats | vR / vL at slot | Bat vR / vL | Positions |
|---|---|---|---|---|---|---|---|
| 94.0 | Carl Yastrzemski | 103 | 1967 | L | +97.1 / +86.7 | +42.6 / +31.7 | LF 149 |
| 90.4 | Ted Williams | 102 | 1942 | L | +93.1 / +84.2 | +45.7 / +36.3 | LF 119 RF 112 |
| 82.9 | Rickey Henderson | 101 | 1981 | R | +84.3 / +79.7 | +31.4 / +26.3 | LF 142 CF 134 |
| 82.8 | Ed Delahanty | 103 | 1893 | R | +83.6 / +81.0 | +32.2 / +29.0 | 1B 67 2B 34 LF 136 |
| 79.5 | Heinie Manush | 102 | 1928 | L | +83.2 / +70.9 | +36.7 / +24.0 | LF 115 CF 97 |
| 65.4 | Cody Bellinger | 100 | 2026 | L | +65.0 / +66.3 | +12.8 / +13.7 | 1B 64 LF 139 CF 127 RF 134 · best at RF 65.9 |
| 58.6 | Hank Greenberg | 102 | 1940 | R | +53.6 / +70.4 | +19.7 / +36.0 | 1B 68 LF 62 · best at 1B 65.4 |
| 57.7 | Lefty O'Doul | 100 | 1929 | L | +60.4 / +51.3 | +23.6 / +14.1 | LF 74 RF 70 |

**Perfect CF** (22 cards)

| Score | Card | Val | Year | Bats | vR / vL at slot | Bat vR / vL | Positions |
|---|---|---|---|---|---|---|---|
| 103.6 | Mike Trout | 103 | 2018 | R | +103.6 / +103.4 | +52.0 / +50.9 | LF 152 CF 144 · best at LF 107.0 |
| 88.6 | Duke Snider | 103 | 1954 | L | +91.2 / +82.5 | +48.8 / +39.3 | CF 104 RF 111 · best at RF 92.8 |
| 87.0 | Rick Ankiel | 102 | 2000 | L | +92.3 / +74.6 | +43.4 / +24.9 | LF 143 CF 132 RF 149 · best at RF 94.6 |
| 81.6 | Billy Hamilton | 102 | 1894 | L | +82.7 / +79.0 | +37.6 / +33.0 | LF 129 CF 116 RF 114 · best at LF 86.1 |
| 81.4 | Andruw Jones | 102 | 1996 | R | +81.1 / +82.1 | +28.5 / +28.7 | CF 148 RF 155 · best at RF 86.9 |
| 76.9 | Kenny Lofton | 101 | 1994 | L | +77.8 / +74.7 | +27.5 / +23.6 | CF 138 |
| 75.0 | Henry Kimbro | 100 | 1947 | L | +76.2 / +72.2 | +28.7 / +23.9 | LF 137 CF 126 · best at LF 79.1 |
| 72.8 | Walker Jenkins | 101 | 2026 | L | +77.0 / +62.9 | +32.3 / +17.4 | LF 127 CF 114 RF 117 · best at LF 77.3 |

**Perfect SS** (22 cards)

| Score | Card | Val | Year | Bats | vR / vL at slot | Bat vR / vL | Positions |
|---|---|---|---|---|---|---|---|
| 100.8 | Corey Seager | 103 | 2023 | L | +103.7 / +94.0 | +35.2 / +25.5 | SS 119 |
| 100.2 | Leodalis De Vries | 102 | 2026 | S | +103.6 / +92.2 | +37.3 / +25.9 | 2B 130 3B 116 SS 115 · best at 2B 102.0 |
| 99.2 | Derek Jeter | 100 | 1999 | R | +102.1 / +92.4 | +35.7 / +26.1 | SS 115 |
| 93.9 | Franklin Arias | 102 | 2026 | R | +94.2 / +93.5 | +27.2 / +26.6 | 2B 129 SS 116 · best at 2B 94.7 |
| 93.7 | Ozzie Smith | 100 | 1987 | S | +93.9 / +93.2 | +8.3 / +7.7 | SS 150 |
| 90.9 | Jimmy Rollins | 100 | 2007 | S | +90.8 / +91.1 | +22.7 / +23.1 | SS 118 |
| 90.3 | Ernie Banks | 102 | 1959 | R | +87.5 / +96.7 | +11.2 / +20.5 | 1B 107 3B 133 SS 133 |
| 88.7 | Hughie Jennings | 101 | 1896 | R | +88.2 / +89.9 | +22.4 / +24.1 | SS 114 |

**Perfect 3B** (22 cards)

| Score | Card | Val | Year | Bats | vR / vL at slot | Bat vR / vL | Positions |
|---|---|---|---|---|---|---|---|
| 96.4 | George Brett | 103 | 1985 | L | +104.1 / +78.5 | +53.6 / +29.3 | 1B 88 3B 88 |
| 90.1 | Alex Rodriguez | 102 | 2007 | R | +92.7 / +84.2 | +28.7 / +21.5 | 3B 123 SS 107 |
| 87.0 | Scott Rolen | 101 | 2002 | R | +82.9 / +96.5 | +13.5 / +28.5 | 3B 137 |
| 79.2 | Miguel Cabrera | 102 | 2012 | R | +78.1 / +81.9 | +33.0 / +38.1 | 1B 101 3B 74 · best at 1B 85.3 |
| 72.2 | Jud Wilson | 100 | 1927 | L | +75.6 / +64.2 | +26.3 / +16.1 | 1B 65 2B 81 3B 85 |
| 71.7 | John McGraw | 101 | 1899 | L | +73.3 / +67.8 | +26.3 / +22.1 | 3B 79 |
| 70.9 | Tommy Harper | 101 | 1970 | R | +72.4 / +67.4 | +22.3 / +18.6 | 2B 101 3B 87 LF 107 CF 85 RF 95 · best at 2B 75.4 |
| 70.9 | Ed Williamson | 100 | 1884 | R | +70.0 / +72.9 | +8.4 / +12.5 | C 47 3B 117 SS 106 |

**Perfect RF** (22 cards)

| Score | Card | Val | Year | Bats | vR / vL at slot | Bat vR / vL | Positions |
|---|---|---|---|---|---|---|---|
| 95.0 | Charlie Smith | 103 | 1929 | L | +95.1 / +94.6 | +40.5 / +37.2 | 2B 94 3B 98 LF 139 RF 144 |
| 84.6 | Vladimir Guerrero | 102 | 2000 | R | +82.5 / +89.3 | +27.9 / +31.9 | RF 144 |
| 76.4 | Reggie Jackson | 102 | 1977 | L | +79.8 / +68.3 | +44.7 / +30.5 | CF 55 RF 69 |
| 74.7 | Tony Gwynn | 100 | 1986 | L | +73.4 / +77.8 | +17.5 / +19.1 | CF 131 RF 149 |
| 73.4 | Frank Schulte | 102 | 1911 | L | +75.1 / +69.5 | +34.8 / +26.4 | LF 92 RF 89 |
| 70.7 | Juan Soto | 102 | 2024 | L | +72.7 / +66.1 | +31.8 / +22.5 | LF 87 RF 91 |
| 69.4 | Jose Canseco | 100 | 1988 | R | +67.3 / +74.2 | +27.2 / +31.4 | LF 83 RF 88 |
| 64.1 | Mel Ott | 101 | 1934 | L | +63.4 / +65.7 | +22.5 / +22.1 | CF 70 RF 91 |

**Perfect C** (22 cards)

| Score | Card | Val | Year | Bats | vR / vL at slot | Bat vR / vL | Positions |
|---|---|---|---|---|---|---|---|
| 97.2 | Roger Bresnahan | 103 | 1906 | R | +98.3 / +94.6 | +40.6 / +38.2 | C 115 1B 64 3B 57 CF 85 RF 112 |
| 75.0 | Yadier Molina | 100 | 2006 | R | +74.1 / +77.0 | +12.9 / +17.1 | C 133 |
| 72.0 | Ethan Salas | 101 | 2026 | L | +75.7 / +63.5 | +16.4 / +5.5 | C 120 |
| 69.5 | Yogi Berra | 102 | 1956 | L | +75.4 / +55.7 | +22.9 / +4.5 | C 98 LF 56 |
| 67.1 | Mitchell Murray | 101 | 1926 | R | +66.6 / +68.3 | +10.8 / +13.8 | C 109 |
| 65.3 | Cal Raleigh | 101 | 2025 | S | +65.7 / +64.5 | +7.9 / +8.0 | C 100 |
| 63.6 | Josh Gibson | 101 | 1939 | R | +62.5 / +66.3 | +7.1 / +12.2 | C 108 1B 77 3B 43 |
| 63.4 | Jack Clements | 100 | 1895 | L | +66.7 / +55.9 | +19.6 / +10.2 | C 69 |

**Perfect 1B** (21 cards)

| Score | Card | Val | Year | Bats | vR / vL at slot | Bat vR / vL | Positions |
|---|---|---|---|---|---|---|---|
| 82.1 | Albert Pujols | 102 | 2011 | R | +82.1 / +82.1 | +35.0 / +32.8 | 1B 91 3B 56 |
| 80.8 | Will Clark | 100 | 1989 | L | +85.8 / +69.3 | +38.6 / +20.0 | 1B 91 |
| 78.3 | Dan Brouthers | 101 | 1889 | L | +79.4 / +75.6 | +33.5 / +27.5 | 1B 87 |
| 77.1 | Roger Connor | 101 | 1885 | S | +76.9 / +77.6 | +28.8 / +27.3 | 1B 94 2B 32 3B 30 CF 48 |
| 75.1 | Ed Rile | 102 | 1927 | L | +76.1 / +72.8 | +30.5 / +24.9 | 1B 86 |
| 74.6 | David Ortiz | 103 | 2007 | L | +83.3 / +54.4 | +47.9 / +16.8 | 1B 52 |
| 64.5 | Eddie Murray | 100 | 1984 | S | +66.4 / +60.0 | +17.1 / +8.5 | 1B 98 |
| 63.3 | Mark Teixeira | 101 | 2007 | S | +63.7 / +62.3 | +18.4 / +14.8 | 1B 85 |

**Perfect SP** (83 cards)

| Score | Card | Val | Year | Throws | Runs/700 BF | STM | Own bat (vR/vL) |
|---|---|---|---|---|---|---|---|
| 53.1 | Christy Mathewson | 103 | 1905 | R | +19.6 | 111 | -27/-25 |
| 52.5 | Madison Bumgarner | 103 | 2014 | L | +19.1 | 110 | -28/-19 |
| 46.7 | Justin Verlander | 103 | 2011 | R | +19.3 | 98 | — |
| 45.9 | Mordecai Brown | 103 | 1909 | R | +18.7 | 104 | — |
| 43.7 | Lefty Grove | 102 | 1931 | L | +17.3 | 104 | — |
| 43.1 | Cannonball Morris | 102 | 1886 | L | +16.3 | 120 | -57/-54 |
| 42.0 | Grover Cleveland Alexander | 101 | 1911 | R | +13.0 | 94 | -36/-27 |
| 41.5 | Bret Saberhagen | 102 | 1989 | R | +15.8 | 106 | — |

## Iron rounds: the best cards at each spot

**Iron C** (130 cards)

| Score | Card | Val | Year | Bats | vR / vL at slot | Bat vR / vL | Positions |
|---|---|---|---|---|---|---|---|
| 35.4 | Ossee Schrecongost | 48 | 1907 | R | +34.3 / +37.9 | -14.2 / -9.3 | C 80 1B 37 |
| 30.7 | Jose Molina | 52 | 2012 | R | +30.6 / +31.0 | -30.4 / -28.7 | C 118 |
| 28.6 | Yasmani Grandal | 49 | 2020 | S | +30.6 / +24.1 | -23.3 / -28.4 | C 85 1B 51 |
| 25.3 | Rick Wilkins | 57 | 1996 | L | +31.9 / +9.8 | -12.1 / -32.9 | C 60 1B 51 |
| 24.5 | Ted Easterly | 58 | 1910 | L | +36.0 / -2.4 | -8.2 / -45.2 | C 62 RF 59 |
| 23.2 | Buddy Rosar | 49 | 1944 | R | +23.4 / +22.7 | -29.7 / -29.1 | C 96 |
| 21.7 | Braxton Fulford | 57 | 2026 | R | +21.3 / +22.6 | -25.2 / -22.6 | C 67 LF 10 |
| 21.2 | Bob Uecker | 42 | 1962 | R | +27.8 / +6.0 | -18.3 / -38.8 | C 66 |
| 21.1 | Hunter Feduccia | 58 | 2026 | L | +21.9 / +19.3 | -22.5 / -23.8 | C 58 1B 13 |
| 20.8 | Lou Criger | 51 | 1902 | R | +19.7 / +23.2 | -25.4 / -20.6 | C 66 |

**Iron 1B** (75 cards)

| Score | Card | Val | Year | Bats | vR / vL at slot | Bat vR / vL | Positions |
|---|---|---|---|---|---|---|---|
| 31.3 | Julio Franco | 47 | 2006 | R | +33.2 / +26.8 | -10.6 / -19.2 | 1B 80 3B 41 |
| 28.7 | George Sisler | 48 | 1928 | L | +33.9 / +16.7 | -0.9 / -20.3 | 1B 50 LF 51 |
| 28.3 | Shawn Green | 59 | 2004 | L | +32.3 / +19.1 | -16.3 / -31.8 | 1B 96 RF 61 |
| 28.2 | Broderick Perkins | 57 | 1980 | L | +38.2 / +4.8 | +0.1 / -35.5 | 1B 61 RF 59 |
| 25.5 | Todd Helton | 45 | 2010 | L | +23.1 / +31.1 | -21.9 / -16.2 | 1B 84 |
| 25.1 | Jackie Robinson | 58 | 1947 | R | +21.5 / +33.5 | -20.5 / -10.7 | 1B 74 |
| 23.8 | Andres Galarraga | 59 | 1995 | R | +24.3 / +22.8 | -19.9 / -23.5 | 1B 81 |
| 23.3 | Eddie Waitkus | 52 | 1949 | L | +24.6 / +20.3 | -16.8 / -23.3 | 1B 72 |
| 22.9 | Klondike Douglass | 55 | 1898 | L | +25.2 / +17.4 | -12.6 / -22.6 | C 12 1B 60 |
| 21.9 | Scoops Carey | 52 | 1902 | R | +17.6 / +32.0 | -20.2 / -8.0 | 1B 60 |

**Iron 2B** (102 cards)

| Score | Card | Val | Year | Bats | vR / vL at slot | Bat vR / vL | Positions |
|---|---|---|---|---|---|---|---|
| 63.5 | Santiago Espinal | 55 | 2022 | R | +63.3 / +63.9 | -1.5 / +0.9 | 2B 122 3B 72 SS 92 LF 82 RF 58 |
| 50.9 | Nap Lajoie | 50 | 1905 | R | +56.9 / +36.8 | -4.1 / -22.4 | 1B 96 2B 114 |
| 50.1 | Nico Hoerner | 48 | 2021 | R | +52.3 / +44.9 | -9.2 / -14.8 | 2B 115 3B 77 SS 88 LF 80 CF 56 |
| 47.4 | Burgess Whitehead | 58 | 1937 | R | +47.0 / +48.4 | -22.6 / -19.5 | 2B 132 3B 113 |
| 41.8 | Connie Day | 50 | 1921 | R | +41.4 / +42.8 | -24.4 / -21.3 | 2B 124 3B 110 SS 108 |
| 41.7 | Mark Lemke | 48 | 1996 | S | +42.6 / +39.6 | -12.1 / -13.4 | 2B 101 |
| 40.3 | Wally Backman | 47 | 1988 | S | +44.1 / +31.5 | -10.6 / -21.4 | 2B 101 3B 88 |
| 39.0 | Javier Baez | 49 | 2021 | R | +36.9 / +44.0 | -15.0 / -6.0 | 2B 95 SS 82 |
| 38.0 | Johnny Evers | 48 | 1910 | L | +37.4 / +39.4 | -17.8 / -14.0 | 2B 102 |
| 35.6 | Creepy Crespi | 51 | 1941 | R | +31.6 / +44.9 | -26.5 / -11.4 | 2B 108 |

**Iron 3B** (98 cards)

| Score | Card | Val | Year | Bats | vR / vL at slot | Bat vR / vL | Positions |
|---|---|---|---|---|---|---|---|
| 48.4 | Ray Dandridge | 47 | 1935 | R | +45.2 / +55.9 | -17.2 / -5.2 | 3B 119 |
| 36.7 | Brooks Robinson | 49 | 1963 | R | +37.2 / +35.6 | -33.0 / -33.2 | 3B 139 |
| 32.6 | David Bell | 56 | 2002 | R | +32.6 / +32.6 | -28.2 / -27.0 | 1B 83 2B 120 3B 115 SS 107 · best at 2B 35.5 |
| 32.4 | Matt Williams | 58 | 1997 | R | +31.4 / +34.7 | -25.7 / -21.0 | 3B 105 |
| 30.9 | Jim Doyle | 56 | 1911 | R | +31.8 / +28.8 | -20.2 / -22.0 | 3B 92 |
| 29.9 | Jeimer Candelario | 56 | 2021 | S | +32.5 / +23.9 | -6.0 / -13.4 | 1B 87 3B 57 · best at 1B 38.4 |
| 28.5 | Stan Hack | 46 | 1944 | L | +32.2 / +19.8 | -6.3 / -17.5 | 1B 77 3B 57 · best at 1B 33.9 |
| 28.2 | Bill Bradley | 56 | 1905 | R | +29.9 / +24.4 | -21.0 / -25.2 | 3B 89 |
| 28.1 | Aaron Boone | 59 | 1999 | R | +30.8 / +21.9 | -24.7 / -32.3 | 3B 101 SS 91 |
| 23.8 | Jose Tena | 57 | 2026 | L | +24.1 / +22.9 | -15.6 / -15.5 | 2B 49 3B 60 SS 13 LF 32 RF 17 |

**Iron SS** (90 cards)

| Score | Card | Val | Year | Bats | vR / vL at slot | Bat vR / vL | Positions |
|---|---|---|---|---|---|---|---|
| 64.1 | Ozzie Smith | 59 | 1982 | S | +63.9 / +64.6 | -16.2 / -15.5 | SS 140 |
| 54.5 | Chris Taylor | 59 | 2018 | R | +58.6 / +45.0 | +2.6 / -10.9 | 2B 112 3B 97 SS 96 LF 111 CF 94 · best at 2B 58.0 |
| 50.1 | Specs Clark | 56 | 1920 | L | +52.8 / +43.8 | -8.1 / -17.1 | 2B 123 SS 105 · best at 2B 54.0 |
| 50.0 | Sam Bankhead | 49 | 1943 | R | +49.2 / +52.0 | -20.0 / -17.1 | SS 120 |
| 44.9 | Alcides Escobar | 52 | 2014 | R | +44.0 / +47.0 | -5.9 / -3.0 | SS 85 |
| 41.0 | Bill Russell | 49 | 1978 | R | +37.4 / +49.5 | -15.3 / -3.1 | SS 90 |
| 38.0 | Jose Vizcaino | 55 | 1997 | S | +39.1 / +35.2 | -21.8 / -25.6 | 2B 122 3B 104 SS 105 · best at 2B 41.4 |
| 36.6 | Freddy Galvis | 58 | 2019 | S | +34.6 / +41.2 | -26.9 / -20.2 | 2B 121 SS 106 · best at 2B 39.0 |
| 36.5 | Ozzie Guillen | 43 | 1989 | L | +38.9 / +30.9 | -25.3 / -33.3 | SS 111 |
| 36.0 | Willy Adames | 59 | 2022 | R | +34.5 / +39.5 | -28.6 / -23.6 | 2B 127 SS 109 · best at 2B 39.6 |

**Iron LF** (101 cards)

| Score | Card | Val | Year | Bats | vR / vL at slot | Bat vR / vL | Positions |
|---|---|---|---|---|---|---|---|
| 36.0 | Ken Berry | 55 | 1966 | R | +33.8 / +41.0 | -16.4 / -9.8 | LF 131 CF 115 RF 126 |
| 35.4 | Red Killefer | 45 | 1915 | R | +33.8 / +39.2 | -9.8 / -4.9 | LF 103 CF 89 |
| 33.2 | Vince Coleman | 55 | 1985 | S | +34.1 / +31.1 | -9.7 / -13.2 | LF 104 CF 87 RF 100 |
| 29.0 | Ron LeFlore | 48 | 1980 | R | +29.1 / +28.8 | -11.7 / -12.5 | LF 91 CF 72 |
| 24.4 | Drew Waters | 56 | 2026 | S | +25.0 / +23.0 | -13.7 / -16.1 | LF 82 CF 16 RF 22 |
| 23.4 | Garret Anderson | 49 | 2008 | L | +21.2 / +28.7 | -27.4 / -20.4 | LF 124 |
| 23.0 | Jonny Gomes | 58 | 2005 | R | +22.1 / +25.1 | -12.7 / -10.2 | LF 66 RF 78 · best at RF 26.3 |
| 21.4 | Isaac Collins | 59 | 2026 | S | +21.4 / +21.4 | -17.2 / -17.7 | 2B 21 3B 6 LF 82 RF 10 |
| 20.9 | Samad Taylor | 59 | 2026 | R | +20.2 / +22.6 | -16.1 / -14.2 | 2B 63 LF 72 RF 23 |
| 20.3 | Brandon Lockridge | 50 | 2026 | R | +19.1 / +23.3 | -21.5 / -17.7 | 1B 19 LF 90 CF 30 RF 26 |

**Iron CF** (95 cards)

| Score | Card | Val | Year | Bats | vR / vL at slot | Bat vR / vL | Positions |
|---|---|---|---|---|---|---|---|
| 53.5 | Norris Hopper | 53 | 2007 | R | +51.1 / +59.2 | +4.8 / +12.0 | LF 137 CF 121 RF 131 · best at LF 58.8 |
| 47.1 | Milt Thompson | 58 | 1989 | L | +49.7 / +41.2 | +5.0 / -4.4 | LF 121 CF 114 RF 111 · best at LF 50.2 |
| 36.6 | Bill Tuttle | 59 | 1959 | R | +36.9 / +35.9 | -10.6 / -12.4 | 3B 82 CF 126 |
| 34.8 | Carlos Beltran | 58 | 1999 | S | +35.7 / +32.9 | -9.9 / -13.6 | CF 118 |
| 34.7 | Austin Jackson | 48 | 2010 | R | +36.6 / +30.2 | -3.2 / -10.5 | CF 93 |
| 31.2 | Deion Sanders | 53 | 1995 | L | +38.2 / +14.7 | -0.9 / -25.2 | CF 90 |
| 29.5 | Dwayne Hosey | 49 | 1995 | S | +27.1 / +34.9 | -7.5 / -0.7 | LF 90 CF 71 RF 76 · best at LF 35.2 |
| 29.4 | Maurice Archdeacon | 45 | 1924 | L | +27.0 / +34.8 | -6.3 / +0.6 | LF 85 CF 65 RF 81 · best at LF 35.3 |
| 29.2 | Oris Hockett | 55 | 1944 | L | +29.4 / +28.6 | -6.4 / -8.1 | LF 98 CF 76 RF 89 · best at LF 35.7 |
| 27.2 | Chuck Carr | 47 | 1993 | S | +27.2 / +27.3 | -15.4 / -16.2 | CF 105 |

**Iron RF** (88 cards)

| Score | Card | Val | Year | Bats | vR / vL at slot | Bat vR / vL | Positions |
|---|---|---|---|---|---|---|---|
| 36.1 | Vladimir Guerrero | 48 | 1997 | R | +35.9 / +36.4 | -11.7 / -14.0 | CF 94 RF 117 |
| 35.0 | Jason Heyward | 57 | 2018 | L | +33.3 / +39.1 | -15.9 / -12.8 | CF 109 RF 123 |
| 32.3 | Todd Benzinger | 50 | 1987 | S | +29.0 / +40.2 | -24.4 / -15.9 | 1B 55 LF 137 CF 121 RF 139 |
| 30.2 | Jesus Alou | 59 | 1970 | R | +28.1 / +35.2 | -7.3 / -3.0 | LF 69 RF 70 |
| 26.1 | Bob Bowman | 55 | 1957 | R | +27.7 / +22.4 | -6.2 / -14.2 | LF 65 RF 64 |
| 22.7 | Greasy Neale | 42 | 1919 | L | +22.9 / +22.3 | -13.8 / -17.2 | LF 80 CF 58 RF 75 · best at LF 23.5 |
| 21.8 | Brian Jordan | 50 | 1994 | R | +22.3 / +20.5 | -18.5 / -23.2 | LF 91 CF 61 RF 91 |
| 21.0 | Luis Lara | 58 | 2026 | S | +20.5 / +22.1 | -23.9 / -25.2 | LF 30 CF 91 RF 105 |
| 19.9 | Walt French | 44 | 1927 | L | +27.9 / +1.0 | -8.5 / -38.2 | LF 78 CF 56 RF 74 · best at LF 20.4 |
| 19.5 | Jonny DeLuca | 59 | 2026 | R | +17.7 / +23.7 | -24.7 / -21.5 | LF 34 CF 84 RF 97 |

**Iron SP** (292 cards)

| Score | Card | Val | Year | Throws | Runs/700 BF | STM | Own bat (vR/vL) |
|---|---|---|---|---|---|---|---|
| 23.5 | Big Jeff Pfeffer | 59 | 1906 | R | +2.1 | 98 | -46/-48 |
| 21.2 | Lefty Grove | 48 | 1940 | L | +0.6 | 77 | -40/-63 |
| 17.2 | Justin Verlander | 58 | 2006 | R | -0.4 | 83 | — |
| 15.2 | Herb Thormahlen | 47 | 1919 | L | -1.7 | 77 | — |
| 15.0 | Marco Estrada | 49 | 2015 | R | -1.9 | 68 | — |
| 14.5 | Fred Goldsmith | 59 | 1882 | R | -5.0 | 93 | -37/-34 |
| 14.4 | Edwin Jackson | 58 | 2009 | R | -2.8 | 82 | -55/-63 |
| 14.4 | Jeff Francis | 53 | 2007 | L | -2.3 | 75 | — |
| 13.8 | Orel Hershiser | 53 | 1995 | R | -2.7 | 74 | — |
| 13.3 | Bullet Campbell | 56 | 1926 | R | -3.5 | 75 | -58/-54 |
| 13.2 | Thomas Pannone | 48 | 2026 | L | -3.1 | 70 | — |
| 12.6 | Ossie Orwoll | 57 | 1928 | L | -8.1 | 56 | -20/-19 |
| 12.5 | Bill Pulsipher | 56 | 1995 | L | -3.5 | 87 | — |
| 12.4 | Earl Wilson | 55 | 1962 | R | -4.5 | 89 | -50/-64 |
| 12.1 | Jerry Ujdur | 49 | 1982 | R | -3.8 | 81 | — |

**Iron RP** (368 cards)

| Score | Card | Val | Year | Throws | Runs/700 BF | STM | Own bat (vR/vL) |
|---|---|---|---|---|---|---|---|
| 6.3 | Pat Perry | 58 | 1989 | L | -4.4 | 35 | — |
| 5.9 | Tyler Kinley | 57 | 2026 | R | -7.4 | 15 | — |
| 5.7 | Grant Anderson | 59 | 2026 | R | -7.4 | 19 | — |
| 5.6 | Lake Bachar | 57 | 2026 | R | -7.1 | 23 | — |
| 5.5 | Seranthony Dominguez | 59 | 2026 | R | -8.1 | 15 | — |
| 5.3 | Randy Choate | 45 | 2013 | L | -9.6 | 6 | — |
| 5.1 | Sparky Lyle | 51 | 1979 | L | -5.6 | 41 | — |
| 5.1 | Roger Mason | 55 | 1993 | R | -7.8 | 23 | — |
| 5.1 | Steve Farr | 43 | 1989 | R | -7.7 | 24 | — |
| 5.0 | Tim Hill | 54 | 2026 | L | -8.9 | 15 | — |
| 4.9 | Greg Weissert | 57 | 2026 | R | -9.0 | 16 | — |
| 4.8 | John Schreiber | 59 | 2026 | R | -9.2 | 15 | — |
