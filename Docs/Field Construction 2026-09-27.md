# How the field builds — clans, winners and L.J., 2026-09-27

**Where the data comes from.**
- L.J.'s first full `import:observed` run: 70 tournaments, 38,738 team-entries. It is in `web/src/data/field-construction.json`, and /build shows each event under "How teams build here".
- **Best quarter** means the top quarter of each run by wins.
- Each cell is the average cards per team at that tier: lineup bats / SP / RP. Bench bats are left out here.

## The clans win

| Clan | Entries | Events | Win % |
|---|---|---|---|
| HotL | 2,036 | 61 | .558 |
| CG | 572 | 39 | .560 |
| GH | 987 | 50 | .550 |
| JW | 395 | 39 | .540 |
| BFF | 358 | 38 | .527 |
| TBD | 523 | 40 | .516 |

The field averages .500.

## Where the clans put their slots

**The pattern: the top tiers go to bats and the rotation, almost never to relievers. The bullpen comes from the bottom tiers.**

**Daily Diamond Jumble Slots** (D12 G8 S3 B3; 2,144 entries):

| | Diamond | Gold | Silver | Bronze |
|---|---|---|---|---|
| Every team (.499) | 6.9 / 3.4 / 1.0 | 2.3 / 0.8 / 1.3 | 0.9 / 0.2 / 1.4 | 0.3 / 0.1 / 1.0 |
| Best quarter (.619) | 7.2 / 3.7 / 1.0 | 2.6 / 1.0 / 1.5 | 1.0 / 0.2 / 1.7 | 0.4 / 0.1 / 1.3 |
| HotL (.549) | 7.7 / 3.6 / **0.7** | 3.0 / 1.0 / 1.1 | 0.9 / 0.3 / 1.7 | 0.1 / 0.0 / 1.7 |
| CG (.561) | **8.0** / 3.5 / **0.1** | 2.4 / 1.0 / 0.5 | 0.9 / 0.0 / 1.5 | 0.4 / 0.0 / 1.4 |
| L.J. (.478) | 6.3 / 3.8 / 1.1 | 2.6 / 0.8 / **2.0** | 1.6 / 0.0 / 0.9 | 0.7 / 0.0 / 0.8 |

**Daily Gold Slots** (G12 S8 B6; 1,474 entries):

| | Gold | Silver | Bronze |
|---|---|---|---|
| Every team (.502) | 6.9 / 3.7 / 1.1 | 2.8 / 0.9 / 1.9 | 1.2 / 0.2 / 1.8 |
| Best quarter (.607) | 7.2 / 3.7 / 1.0 | 3.0 / 1.0 / 1.9 | 1.3 / 0.2 / 2.0 |
| CG (.577) | 7.6 / 3.9 / **0.4** | 2.9 / 0.9 / 1.7 | 1.8 / 0.0 / 1.8 |
| HotL (.532) | 7.7 / 3.5 / 0.7 | 3.1 / 1.2 / 1.6 | 1.0 / 0.0 / 2.3 |
| L.J. (.504) | **6.0** / 3.6 / **1.5** | 3.3 / 0.9 / 1.4 | 2.1 / 0.0 / 1.3 |

**Daily Silver Slots** (S16 B5 I5; 678 entries):

| | Silver | Bronze | Iron |
|---|---|---|---|
| Every team (.500) | 8.0 / 3.6 / 2.0 | 2.0 / 0.7 / 1.7 | 0.8 / 0.1 / 2.2 |
| Best quarter (.625) | 8.5 / 3.9 / 2.0 | 2.3 / 0.8 / 1.8 | 0.8 / 0.1 / 2.8 |
| HotL (.568) | **9.2** / 3.7 / **1.0** | 1.8 / 0.6 / 1.6 | 0.3 / 0.1 / 2.8 |
| L.J. (.488) | **6.8** / 3.5 / **3.0** | 3.5 / 0.7 / 1.3 | 0.5 / 0.5 / 2.0 |

**Monday Wonky Historical Slots** (G13 I13): every clan uses about 0.1 Gold reliever a team, against the field's 0.8.

**What L.J. does differently:** he spends top-tier slots on relievers and puts his bats lower, which is the opposite of the winners.
- **Gold Slots:** 1.5 Gold relievers against CG's 0.4, and 6.0 Gold bats against the best quarter's 7.2.
- **Silver Slots:** 3.0 Silver relievers against HotL's 1.0, and 6.8 Silver bats against HotL's 9.2.
- **Diamond Jumble:** 2.0 Gold relievers against CG's 0.5.

## Starters are worth more than a lineup slot, and far more in deadball

A starter's batters faced, as a multiple of a lineup slot's PA, measured per event:
- **Median 1.33**, ranging from 1.03 to 2.65. A reliever's median is 0.42.
- **Deadball events:** 5L Deadball 2.65, Silver & Friends Deadball Slots 2.23, Negro Leagues Slots 1.97, Wonky 1.84.
- **All-Star Hardware:** 1.35.

The builder used 1.0 and 0.31 everywhere. /build's Optimise and `env-roster --series` now use each event's own measurement, so they will spend more on the rotation where the rotation pitches more.

## Openers don't pay

- 209 of 38,738 team-entries used one (2+ starts at 2.2 IP or less a start). They won **.451**, against .500 for everyone else.
- By event it varies: Bronze OOTP Era .429, Silver Slamboree .603 and Goldfather .594, but the last two come from small samples.
- The same pitchers are no better per batter as openers than as starters (Model Review, 2026-09-27 additions).

## Handedness

Rotation L/R per team is in the table. No general "winners go left" signal shows up. JW ran 3.1 lefty starters in Diamond Jumble and went .477; GH ran 3 of 5 lefties in All-Star Hardware and went .620. Read it event by event.
