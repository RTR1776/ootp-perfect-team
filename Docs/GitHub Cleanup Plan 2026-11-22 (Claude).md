# GitHub cleanup plan (2026-11-22)

L.J., after the 11-22 push: "alot of other stuff, not sure all needed on github, maybe make a clean up plan."

Each step says who does it and what it needs from L.J.

**Status (11-22 evening, after L.J.'s "Proceed"):**
- **Step 1:** done, in PR 202.
- **Step 2:** the restore list and `Clean Up Branches.command` are written. The cloud proxy refused the tag push (403: a session pushes only to its own branch), so L.J. runs the command on the Mac after PR 202 merges.
- **Step 3:** done.
- **Step 4:** the dump loader now does it on each Monday load; there is no separate command. `LJ Cards and Card Shop/` stays, because `verify-ingest.ts` reads its card list.
- **Step 5:** done; all six one-time commands had run.
- **Step 6:** L.J.'s call; not answered yet.

## Where things stand

- **The repo is public**, 73 MB on GitHub, 3,228 files. The pack is 62 MB, so size isn't a problem.
- **Clutter is the problem:**
  - **77 branches, no open PRs.** 27 are merged. 43 date from before main's history was reset on 11-01, and their "ahead by 500–1,000 commits" is just the old history. 7 are recent and unmerged.
  - **`Inbox/rosters`:** 2,044 files (1,698 load files, 199 manifests, build logs and seeds) from every rebuild since September. Only the newest manifest is ever used. The rosters themselves live in the database, with backups.
  - **`Tourney Data/`:** 294 MB on disk, 217 MB of it community dumps. **Each weekly dump is cumulative:** 11-16's has every event of 08-17's and 11-09's. Every script reads only the newest dump, except `dumps-restandings`, which re-scores each stored upload when the scoring rules change and skips files that aren't on disk.
  - **Root:** 18 `.command` files, 5 of them one-time jobs that are done.
- **Push to GitHub** sends all of `League Data`, `Tourney Data`, `web/src/data`, `reference` and `Docs` straight to main. That's where today's 78 files came from. Most of it belongs there.
- **No secrets found:** no key, SSH or `.env` files anywhere in any branch's history (checked 11-22; the only hit is `web/.env.example`, which has no values).

## The plan, in order

### 1. Rescue the unmerged work (Claude, cloud; one PR each, L.J. merges)

Three branches hold finished, tested code that never got a PR. All three now conflict with main, so each needs rebasing and its tests rerun:

| Branch | What it fixes | Why it matters |
|---|---|---|
| `claude/adoring-mayer-n0gmzv` | Load files keep every card on the board, a two-way pick's BN7 included (`lib/load-file.ts`) | The 26th-card drop came back on 11-15 (All-Star Hardware, DeJong). |
| `claude/magical-curie-kdutbs` | Card Fit scores a two-way card in both roles; a two-way starter in a DH event bats on his start days (`lib/dual-seed.ts`) | The 11-14 handoff lists it as still open. |
| `claude/pensive-einstein-1x9flb` | The PTCS line reads the dump's last whole day, not the partial one | The 11-13 handoff: "every Monday dump has the same partial last day." |

Also worth keeping:
- **`claude/gallant-noether-pd1nj1`:** the league lineup tools from the 11-16 PEL plan (`league-lineup-blend.mts`, `league-order.mts`, `league-staff-check.mts`, `league-resid.py`). The HD plan needs them: they blend lineups with league history and keep DH-only bats at DH. Its model JSONs are older than today's and get dropped.
- **Results files never pushed:** `Tourney Data/PTCS9 Results/2026-11-16.txt` (gallant-noether) and `2026-11-15b.txt` (blissful-meitner). The rows themselves should already be in `my_results`; check before copying the files.

### 2. Delete the dead branches (Claude, after step 1 and L.J.'s OK)

- **First, write a restore list:** every branch name and its last commit, kept in `Docs/`. Any branch can be pushed back from it as long as GitHub still holds the commit.
- **Delete** the 27 merged branches, the 43 pre-reset ones and the 7 recent ones once rescued. Keep `main` and the working branch.
- **Result:** about 77 branches down to 2.
- **Going forward:** each session deletes its branch once its PR merges. GitHub can do this automatically: Settings → General → "Automatically delete head branches". Worth turning on.

### 3. Prune `Inbox/rosters` (Claude)

- **Keep:** the newest 14 days of manifests and their load files.
- **Delete:** the rest from git. The rosters are already in the database, plus `Docs/Archive/saved-rosters-*.json.gz` and the Mac's backups.
- **Stop committing build logs and seeds:** add `Inbox/rosters/*-seed.txt` and `Inbox/rosters/[0-9]*.txt` to `.gitignore`. They're working files.
- **Mac side:** deleting files in git deletes them from the Mac folder at the next pull. That's fine here: `Save Current Rosters.command` only reads the newest manifest.

### 4. Old dumps out of git (one Mac command, then Claude)

- **Problem:** a deletion made in the cloud removes the files from the Mac at the next pull, and the Mac is their only other copy.
- **The Mac does it, with a one-time `Tidy Repo.command`:**
  1. Move every dump but the newest of each kind (tournaments, drafts, quick) into `Archive/dumps/`, which git already ignores.
  2. Commit the removal and push.
- **Code change:** `dumps-restandings` looks in `Archive/dumps/` as well as `Tourney Data/`.
- **Going forward:** **Load Tourney Dumps.command** moves the older dump into `Archive/dumps/` after loading the new one.
- **Result:** the checkout drops by about 200 MB. The history keeps every dump, so GitHub's size doesn't shrink, and that's fine.
- **Same rule for `LJ Cards and Card Shop/`:** August–September collections and card lists that the database has replaced.

### 5. Retire the one-time Mac commands (Claude; L.J. confirms each is done)

Remove `After The 11-12 Review`, `Fix Deadball Date`, `Split Gold Rush`, `Split Weekly Formats` and `Set Weekly Format Dates`.
- Each says "double-click this once", and the handoffs record them as run.
- `Thursday Rosters.command` is probably done too; check with L.J.
- The rest stay, since they're the Mac's daily tools.

### 6. Public or private (L.J. decides)

The repo is public, so anyone can read:
- your collection, results and PTCS plans;
- every handoff;
- other players' rosters from game saves (`all_rosters.csv`, the PTMS field rosters);
- friends' data (cwhit's sheets, DCFCStats).

On 10-27 it was kept public. The reason wasn't recorded.

Going private costs nothing that's in use. Vercel's free plan deploys private repos from a personal account, and CI gets 2,000 free minutes a month. If it stays public, steps 3–4 matter more, and third-party data (friends' sheets, other players' saves) should stay on the Mac.

## Not in the plan

- **Rewriting history to shrink the repo.** 73 MB is fine. A rewrite breaks the Mac's checkout and every open branch, and it was done once already (11-01).
- **Reorganising `Docs/`.** It's the sessions' shared memory (7 MB). Handoffs quote paths, and moving files breaks them. Note: a folder named `Archive` is ignored at any depth by the `Archive/` rule, so `Docs/Archive` files only get in by force-add.
