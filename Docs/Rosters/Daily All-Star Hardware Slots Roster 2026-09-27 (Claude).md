# Daily All-Star Hardware Slots — Claude pick, 2026-09-27 (corrected)

**Card rule: Historical All-Star (type 5) and Hardware Heroes (type 9) only.**
- The first version of this roster missed the rule and used De Vries, Manush, Hidalgo and others. Do not use it.
- The field's own exports confirm the rule: every card played in this event is type 5 (209 cards) or type 9 (111).
- The catalogue row (9100139) doesn't carry the rule yet; add `cardTypes: ["Historical All-Star", "Hardware Heroes"]` from the Mac with `catalogue:set`.

**The event:** slots 8 Perfect / 6 Diamond / 3 Gold / 3 Silver / 3 Bronze / 3 Iron, PT default RE, DH on, 2008 McAfee Coliseum (a pitchers' park). It is a 32-team Bo7 bracket.

## Lineups

| # | vs RHP | Pos | vs LHP | Pos |
|---|---|---|---|---|
| 1 | Ernie Banks | SS | Scott Rolen | 3B |
| 2 | Hank Aaron | LF | Ernie Banks | SS |
| 3 | Ed Bailey (VAR) | C | Hank Aaron | 1B |
| 4 | Mike Piazza (VAR) | DH | Mike Piazza (VAR) | DH |
| 5 | Mel Ott | CF | Bret Boone | 2B |
| 6 | Bo Jackson | RF | Willie Mays | CF |
| 7 | Scott Rolen | 3B | Mel Ott | RF |
| 8 | Lee Thomas (VAR) | 1B | Bo Jackson | LF |
| 9 | Bret Boone | 2B | Mike Zunino | C |

Bench: Hank Blalock (pinch hitter vs RHP), Ty Wigginton. Mays and Zunino start vs LHP.

Against RHP, Ott plays CF (rated 70, the floor). With the glove counted he still beats Mays there by about 11 runs per 700 PA against RHP (+22.7 vs +11.9). Swap Mays in only if you'd rather have the glove.

## Pitching

- **Rotation:**
  1. Bret Saberhagen
  2. Cliff Lee (VAR)
  3. Jim Kaat (VAR)
  4. Steve Carlton (VAR)
  5. Dave Stieb (VAR)
- **Closer:** Dave Righetti.
- **Setup:** Andrew Bailey.
- **Middle relief:** Jake Peavy, Brad Hand, Billy Wagner.
- **Long relief:** Jose Lima.
- **Mop-up:** Mike Marshall, Todd Jones (VAR).
- The builder lists Todd Jones as CL; that is only slot order.

## 1–26 by value

| # | Card | Value | Set | Card id |
|---|---|---|---|---|
| 1 | Bret Boone | 102 | HH | 86701 |
| 2 | Bret Saberhagen | 102 | HH | 86915 |
| 3 | Ernie Banks | 102 | HH | 86621 |
| 4 | Hank Aaron | 102 | HH | 86655 |
| 5 | Mel Ott | 101 | AS | 86272 |
| 6 | Mike Piazza **(VAR)** | 101 | HH | 86463 |
| 7 | Scott Rolen | 101 | HH | 86405 |
| 8 | Cliff Lee **(VAR)** | 100 | AS | 85693 |
| 9 | Willie Mays | 98 | AS | 86634 |
| 10 | Ed Bailey **(VAR)** | 97 | AS | 86637 |
| 11 | Steve Carlton **(VAR)** | 96 | AS | 85109 |
| 12 | Andrew Bailey | 94 | HH | 85192 |
| 13 | Dave Stieb **(VAR)** | 89 | AS | 85911 |
| 14 | Bo Jackson | 88 | AS | 86966 |
| 15 | Jim Kaat **(VAR)** | 87 | HH | 85114 |
| 16 | Dave Righetti | 85 | AS | 85870 |
| 17 | Jake Peavy | 83 | HH | 82683 |
| 18 | Lee Thomas **(VAR)** | 77 | AS | 86145 |
| 19 | Brad Hand | 76 | AS | 86251 |
| 20 | Mike Zunino | 75 | AS | 86431 |
| 21 | Jose Lima | 69 | AS | 84852 |
| 22 | Billy Wagner | 68 | AS | 85778 |
| 23 | Hank Blalock | 68 | AS | 86433 |
| 24 | Mike Marshall | 57 | HH | 84720 |
| 25 | Ty Wigginton | 54 | AS | 86086 |
| 26 | Todd Jones **(VAR)** | 43 | AS | 86434 |

- **Slots:** 8 Perfect (6 bats, 2 starters). The six Diamond slots hold 4 Diamonds plus 2 Gold cards, and Gold, Silver, Bronze and Iron hold 3 each. Legal on every rule check.
- **Variants:** 8.
- **Score:** 326.8 on the builder's scale, using the event's measured staff weights (SP 1.35, RP 0.41). The search lands on the same roster with or without Saberhagen forced in. Forcing Hershiser in as well scores 326.1.

Reproduce:

    node --import tsx scripts/env-roster.ts --park "McAfee Coliseum" --park-year 2008 --dh \
      --slots P8,D6,G3,S3,B3,I3 --size 26 --series allstarhardwareslots --optimize --starts 16 \
      --role-trust 0.25 --card-types 5,9 --name "Daily All-Star Hardware Slots"
