# Branch restore list (2026-11-22)

Written before the branch cleanup in `Docs/GitHub Cleanup Plan 2026-11-22 (Claude).md`, step 2. Every branch the cleanup deletes is listed with its last commit, so any of them can be put back.

A cloud session can push only to its own branch, so **Clean Up Branches.command** does the cleanup on the Mac. It reads `Docs/Branch Cleanup 2026-11-22.tsv`, which lists the same branches.

## How to restore one

- **Merged by a PR:** open the PR on GitHub and press "Restore branch". GitHub keeps every PR's commits.
- **Tagged `archive/<name>`:** the branch had commits that no merged PR carried. The tag keeps them:
  `git push origin refs/tags/archive/<name>:refs/heads/claude/<name>`
- **Any of them:** `git push origin <commit>:refs/heads/<branch>`. This works only while GitHub still holds the commit.

## Not deleted

- `main`
- `claude/elegant-cannon-nu9vrr`: PR 202. It holds the rescued work from `adoring-mayer`, `magical-curie`, `pensive-einstein` and `gallant-noether`.

## What the 30 archive tags hold

Main's history was reset on 11-01, so main has no file versions older than that. Of what these branches hold, these paths never reached main at all:
- **Old docs:** `Security Review 2026-10-31.md` (lucid-ptolemy, epic-hamilton), `Pitching Fatigue 2026-10-19.md` and the PTCS 8 Championship rosters (festive-johnson), `Iron Push Rosters 2026-10-27` (wonderful-dirac), the 10-06 Quicks and some Exports To Grab pages.
- **PTCS 7 and 8 results notes:** the rows were logged to the database at the time.
- **One-off study scripts:** `gap.mts` (dreamy-curie), `gloveslope.mts` (awesome-galileo), the HR-control scripts (brave-pasteur), `fatigue_read.py` (festive-johnson), `event-flags.ts` / `event-model.ts` (zen-lovelace).
- **Superseded work:** `league-env.ts` (brave-matsumoto, PR 71, closed unmerged).
- Everything else they hold is older versions of files main has.

## Every branch

| Last commit | Branch | Commit | Status | Last message |
|---|---|---|---|---|
| 2026-11-19 | `claude/revert-backup-c-floor` | `e84b7b7d0163` | merged by PR | Draft engine: back to the pre-PR-200 backup catcher rule (L.J., 2026-11-19) |
| 2026-11-19 | `claude/laughing-murdock-61571b` | `ac2ba3ad7d5c` | merged by PR | Draft engine: backup catcher floor C 45 (L.J., 2026-11-19) |
| 2026-11-18 | `claude/optimizer-fixed-pool` | `0d55c146f8a8` | merged by PR | Builder: solve a fixed pool's arrangement exactly, and score the greedy fill like every cl |
| 2026-11-17 | `claude/ptms3-pd-two-picks` | `21d580035ad4` | merged by PR | PTMS 3 drafts: rounds of about 12 cards, keep 2; the pack stays up for the second pick |
| 2026-11-17 | `claude/ptms3-draft-screens` | `4d2f8a793761` | merged by PR | PTMS 3 drafts: the event screens' 13 rounds, keep and pricing per round |
| 2026-11-17 | `claude/ptms3-draft-board` | `10942bcb0eec` | merged by PR | PTMS 3 drafts: rounds from the game saves, Low of Lows bands, a board that follows the dra |
| 2026-11-17 | `claude/card-fit-arm-pricing` | `13ef18b141ea` | merged by PR | Card Fit: price an arm on the staff as the objective does |
| 2026-11-16 | `claude/youthful-wozniak-3btwng` | `ea25a3a78cc1` | merged by PR | Add lookup, runner and checker subagents and a user-level CLAUDE.md draft |
| 2026-11-16 | `claude/gallant-noether-pd1nj1` | `9fed207705d1` | 4 commits not in a merged PR: tag archive/gallant-noether-pd1nj1 | Rosters 2026-11-16: Daily Open Slots saved as roster 2217 (Clement for Pearce VAR); handof |
| 2026-11-15 | `claude/blissful-meitner-sompnk` | `30836aecf503` | 3 commits not in a merged PR: tag archive/blissful-meitner-sompnk | Monday Up And At Them Bronze 2216 (Claude pick 2026-11-15 mon) |
| 2026-11-14 | `claude/magical-curie-kdutbs` | `6bbec5b89b23` | in PR 202 | Handoff: two-way cards both ways (Card Fit, env-roster dual phase, the DH start-day rule) |
| 2026-11-14 | `claude/adoring-mayer-n0gmzv` | `2f8185091868` | in PR 202 | Saturday Negro Leagues Slots (779) rebuilt on the fix: 26 cards, Tenny at BN7 |
| 2026-11-13 | `claude/pensive-einstein-1x9flb` | `beb8bcc78fc3` | in PR 202 | PTCS 9 lines from the last whole day: day 7 of the 11-09 dumps |
| 2026-11-13 | `claude/intelligent-volta-2ia4hk` | `9f837812968f` | 1 commit not in a merged PR: tag archive/intelligent-volta-2ia4hk | Load files: Silver Quick and Gold Quick, built on the 11-13 collection |
| 2026-11-12 | `claude/buy-plan-unpriced` | `e1a19c12004b` | merged by PR | Upgrades and Buy Plan: list new and Clubhouse cards before they have a price |
| 2026-11-10 | `claude/ptms3` | `98a6608fcf76` | merged by PR | PTMS 3 tournament rosters (2031-2033) and handoff |
| 2026-11-10 | `claude/league-team-11-09` | `6b8891696869` | merged by PR | Merge remote-tracking branch 'origin/main' into claude/league-team-11-09 |
| 2026-11-09 | `claude/ptcs9-lines-11-09` | `134c099477a8` | merged by PR | PTCS 9 lines: projected from the 11-09 dump (day 8) |
| 2026-11-08 | `claude/buy-plan` | `4edb703b7152` | merged by PR | Buy Plan page: where to spend PP and CS across the tiers you play |
| 2026-11-07 | `claude/league-team-11-07` | `53641e243a22` | merged by PR | League team sheet as of 11-07 |
| 2026-11-07 | `claude/great-herschel-fd2ee4` | `4abfaa2f067d` | merged by PR | Optimiser: re-solve the staff around a new arm (staff tier, polish of the best boards) |
| 2026-11-05 | `claude/observed-curve-2026-11-04` | `1038d6565c85` | merged by PR | Weigh each run's observed play by its age (half-life 30 days) |
| 2026-11-05 | `claude/no-stats-exports` | `b31acebf26fc` | merged by PR | Stop fielding-only tourney exports; list them for re-export |
| 2026-11-05 | `claude/league-team-11-05` | `20220fb647f7` | merged by PR | League team sheet as of 11-05 |
| 2026-11-03 | `claude/ptcs8-pd-weekly-draft` | `7a968eedf141` | merged by PR | Draft helper: PTCS 8 Championship PD Weekly (Modified Perfectly Iron) |
| 2026-11-03 | `claude/pd-weekly-packs` | `c6d52e091dfb` | merged by PR | Draft helper: PTCS 8 PD Weekly packs are 2 cards, hitters and pitchers mixed |
| 2026-11-03 | `claude/of-range-arm-test` | `97cc2ead317b` | merged by PR | OF range + arm vs position rating: tested on wins, no change |
| 2026-11-03 | `claude/league-team-11-03` | `b5b5c9e275c9` | merged by PR | League team sheet: L.J.'s PEL roster on 11-03 |
| 2026-11-03 | `claude/league-multipliers` | `39bb77b817cd` | merged by PR | League scoring: the league's event multipliers, ordinary weeks at 2010 |
| 2026-11-03 | `claude/data-2026-11-03` | `7f6fd520c318` | merged by PR | Data and notes, 2026-11-03: PTCS 9 period, today's rosters and review, draft kit, handoff |
| 2026-11-02 | `claude/game-files-2026-11-02` | `0099720e4b6b` | merged by PR | Championship Silver rebuilt at 1905 Hilltop on the pen-leverage code (roster 1767, superse |
| 2026-11-02 | `claude/data-refresh-2026-11-02` | `4603baa15c85` | merged by PR | Data refresh 2026-11-02 from the Mac: model calibration (arm slope 0.6246, hit 0.5111), PT |
| 2026-11-02 | `claude/busy-faraday-f8zzdk` | `978c2c4e6b3a` | merged by PR | Leverage rebuild: 80 load files (not saved); load files keep env-roster's staff order; ski |
| 2026-11-02 | `claude/blissful-knuth-zkff22` | `97ec3ac0beac` | 6 commits not in a merged PR: tag archive/blissful-knuth-zkff22 | Handoff: PTCS 8 final standings (8 berths, 80 period CS) |
| 2026-11-01 | `claude/ecstatic-franklin-o7k9ec` | `3d5c09b4e760` | 28 commits not in a merged PR: tag archive/ecstatic-franklin-o7k9ec | Results 11-01 screen (Bronze Cap 17-32, NEL Slots 33-64; 5 dups) and rebuild files |
| 2026-10-31 | `claude/two-way-dual` | `114ed1011b6b` | in PR 202 | Two-way cards in both roles: one roster unit; env-roster dual phase |
| 2026-10-31 | `claude/lucid-ptolemy-wzbv3r` | `d8d109c52ab0` | 38 commits not in a merged PR: tag archive/lucid-ptolemy-wzbv3r | HD450 at 133 games: exports filed, wild-card odds, lineup and staff check |
| 2026-10-31 | `claude/epic-hamilton-1zkgyn` | `22eee84355ac` | 32 commits not in a merged PR: tag archive/epic-hamilton-1zkgyn | Refit rebuild complete (batch 17); handoff updated |
| 2026-10-29 | `claude/brave-pasteur-betlt6` | `410c5c7a74b4` | 5 commits not in a merged PR: tag archive/brave-pasteur-betlt6 | Handoff: 10-28 rebuild on collection 319 |
| 2026-10-27 | `claude/wonderful-dirac-85orhj` | `1095bd71595d` | 2 commits not in a merged PR: tag archive/wonderful-dirac-85orhj | Iron push rosters 10-27 on collection 311 (32 starts): Iron Lunch 1297 (Escobar, 2nd SS),  |
| 2026-10-26 | `claude/upgrades-page` | `7373f7d049e0` | merged by PR | Upgrades confirm route: 60 s maxDuration (Vercel answers at once; local dev has no limit) |
| 2026-10-26 | `claude/pd-draft-helper` | `51704c0d38ff` | merged by PR | Live draft helper for Laptophound's 5L Deadball and 6L Power Play (/draft/live) |
| 2026-10-23 | `claude/wizardly-turing-x158tu` | `9c4988deb8bc` | 7 commits not in a merged PR: tag archive/wizardly-turing-x158tu | NeL Slots 1128; handoff for the 10-23 new-card rebuild |
| 2026-10-23 | `claude/happy-knuth-iozr8d` | `8e747989e879` | 11 commits not in a merged PR: tag archive/happy-knuth-iozr8d | Nightmare Cap rebuilt (137.3, saved 1092) |
| 2026-10-21 | `claude/vigilant-goldberg-ggtiit` | `3562ea79a483` | merged by PR | Data from the Mac, 2026-10-21 |
| 2026-10-21 | `claude/relaxed-planck-xmy2eq` | `c38c2e66e7f6` | 3 commits not in a merged PR: tag archive/relaxed-planck-xmy2eq | Handoff: PEL mid-week read 10-21 |
| 2026-10-20 | `claude/festive-johnson-if2u74` | `113a7715f5ef` | 21 commits not in a merged PR: tag archive/festive-johnson-if2u74 | Remove stray empty handoff file |
| 2026-10-19 | `claude/zen-lovelace-uaqrrg` | `95c82865d553` | 1 commit not in a merged PR: tag archive/zen-lovelace-uaqrrg | roster-diff scores on env-roster's objective: shared event setup |
| 2026-10-19 | `claude/kind-davinci-1krbo4` | `db5b7ce8d254` | 7 commits not in a merged PR: tag archive/kind-davinci-1krbo4 | Rosters: Monday Wonky rebuilt on collection 262 (+5.0), Live Plus unchanged |
| 2026-10-16 | `claude/exciting-edison-kjww3p` | `beaf776a3659` | 6 commits not in a merged PR: tag archive/exciting-edison-kjww3p | Rules rebuild: every current event saved on collection 252 (73 rosters); NEL Slots with th |
| 2026-10-15 | `claude/optimistic-albattani-mvxzbv` | `7b6f4fbac096` | 5 commits not in a merged PR: tag archive/optimistic-albattani-mvxzbv | Handoff: 10-15 Clubhouse drop, collection 250, Thursday rosters |
| 2026-10-15 | `claude/ecstatic-noether-04epeu` | `7829f0777f80` | 1 commit not in a merged PR: tag archive/ecstatic-noether-04epeu | PTCS 8: log 10-14 results (12 new, 2 dup); handoff |
| 2026-10-14 | `claude/peaceful-darwin-fi88b9` | `d2b1c3df18ba` | 1 commit not in a merged PR: tag archive/peaceful-darwin-fi88b9 | Handoff: Soriano Card Fit, TW = Tournament Weekly |
| 2026-10-12 | `claude/great-cannon-um669j` | `e16861400a05` | 4 commits not in a merged PR: tag archive/great-cannon-um669j | Handoff: league 26 for the 2007 HD week |
| 2026-10-11 | `claude/rosters-2026-10-11-late` | `c61d0914a17f` | 1 commit not in a merged PR: tag archive/rosters-2026-10-11-late | Monday Bronze (692) and Live-Plus Slots Pop-up on v6; 10-11 exports imported |
| 2026-10-11 | `claude/awesome-galileo-3mw625` | `d40b535d2560` | 2 commits not in a merged PR: tag archive/awesome-galileo-3mw625 | Tourney exports to grab, 10-11 |
| 2026-10-08 | `claude/great-mendel-qx4w30` | `aebfff79655a` | merged by PR | Merge pull request #114 from RTR1776/claude/great-mendel-qx4w30 |
| 2026-10-07 | `claude/zen-maxwell-y2zkzy` | `5c0a02ff1a78` | 24 commits not in a merged PR: tag archive/zen-maxwell-y2zkzy | PTCS 8: 10-06 results logged (Dead Silver Walking win, +30 Silver) |
| 2026-10-07 | `claude/peaceful-euler-h6j7vh` | `9a7d35848077` | 3 commits not in a merged PR: tag archive/peaceful-euler-h6j7vh | Exports to grab 10-07: drop a no-op line |
| 2026-10-05 | `claude/gracious-brahmagupta-1e7nhq` | `1b40c68f6a8a` | 5 commits not in a merged PR: tag archive/gracious-brahmagupta-1e7nhq | NEL Slots rebuilt on collection 207 (roster 339); every non-Live current event now on the  |
| 2026-10-05 | `claude/amazing-darwin-dnris6` | `bfa2d79ea160` | merged by PR | Handoff: recommended rosters on /build, keeping them current, Brett |
| 2026-10-04 | `claude/dreamy-curie-q74ay7` | `0dbc23ae4d5a` | 19 commits not in a merged PR: tag archive/dreamy-curie-q74ay7 | Sunday Open Slots on collection 186 (374.0) |
| 2026-10-03 | `claude/keen-carson-yef2yb` | `88ef92ff1dec` | 1 commit not in a merged PR: tag archive/keen-carson-yef2yb | PTCS 7 Championship rosters rebuilt with the new cards (2026-10-03-ptcs7) |
| 2026-10-02 | `claude/quirky-galileo-4to7ou` | `230fb2c83a59` | 5 commits not in a merged PR: tag archive/quirky-galileo-4to7ou | Friday Nightmare Cap built on its own run #27 (format since 09-25), saved |
| 2026-10-01 | `claude/ecstatic-meitner-ight5r` | `6e0e6722c1b2` | merged by PR | Merge pull request #90 from RTR1776/claude/ecstatic-meitner-ight5r |
| 2026-09-30 | `claude/affectionate-pasteur-t3hwly` | `d15e31918b07` | merged by PR | Merge pull request #89 from RTR1776/claude/affectionate-pasteur-t3hwly |
| 2026-09-29 | `claude/interesting-dirac-183d7b` | `1e420e6cf4cd` | merged by PR | Rosters for every current event from the catalogue's rules; 18 events' rules confirmed; va |
| 2026-09-29 | `claude/brave-matsumoto-dc3f82` | `753bf78b27f0` | 1 commit not in a merged PR: tag archive/brave-matsumoto-dc3f82 | League run environment: declare env_year, carry it through /upload, filter pooled reads |
| 2026-09-27 | `claude/jolly-brahmagupta-pxct3i` | `38460f17c9c0` | merged by PR | Merge pull request #57 from RTR1776/claude/jolly-brahmagupta-pxct3i |
| 2026-09-26 | `claude/modest-fermi-cvfsir` | `81934f3f77b0` | merged by PR | Merge pull request #25 from RTR1776/claude/modest-fermi-cvfsir |
| 2026-09-26 | `claude/funny-brahmagupta-cm7oor` | `e064bdb88e26` | merged by PR | Merge pull request #19 from RTR1776/claude/funny-brahmagupta-cm7oor |
| 2026-09-23 | `claude/affectionate-bardeen-7tfrnl` | `cf7c16c00435` | merged by PR | Look and feel: brand, theme tokens, responsive shell, page states |
| 2026-09-21 | `claude/serene-sagan-o0kq2f` | `d179259bd616` | merged by PR | Rank the park pick against the list PEL actually offers |
| 2026-09-21 | `claude/great-leakey-a869bb` | `566fc160b58e` | in PR 202 | Merge claude/serene-sagan-o0kq2f — park-sweep keeps both sides |
| 2026-09-20 | `claude/relaxed-volta-owd0l3` | `34279eec4b9f` | 5 commits not in a merged PR: tag archive/relaxed-volta-owd0l3 | PTCS 7 results: 2026-09-19 evening screen (7 rows) |
