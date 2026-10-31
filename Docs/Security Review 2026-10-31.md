# Security review before making the repo public (2026-10-31)

L.J. asked whether `RTR1776/ootp-perfect-team` can be made public. Making it
public exposes every commit, not just the current files, so the whole history
was scanned.

## Clean

- **No credentials in the files or the history** (all 237 commits, every
  branch). Searched for Postgres/Neon connection strings with passwords,
  Neon `npg_` keys and `ep-…` hosts, Vercel Blob tokens, Anthropic, GitHub,
  AWS and Slack keys, and private-key blocks.
  - The only connection-string match is a masked placeholder in a UI mockup
    (`npg_••••@ep-quiet-lake-123456`).
  - `web/.env.example` holds placeholders only. `.env*` is gitignored
    (`web/.gitignore`), and no `.env` file was ever committed.
  - `Upload Card Art.command` writes the Blob token to `web/.env.blob`, which
    is gitignored.
- **The app's password is not in the repo.** `Data Drop Guide.html` says
  where it lives (`web/.env.local`), not what it is.
- **The deployed app is gated.** Every page and API route goes through
  `web/src/proxy.ts`, which requires a signed, httpOnly session cookie
  (`web/src/lib/auth.ts`, HS256 with `AUTH_SECRET`). Every route that writes
  (`/api/upload`, `/api/rosters`, `/api/results`, `/api/qualifying`,
  `/api/upgrades/confirm`) checks the session again itself. The secrets live
  in Vercel's environment, not the code.

## Fix or decide before going public

1. **Third-party material (remove, or get permission).** These are other
   people's work or paid/private guides:
   - `reference/cwhit/` (cwhit's projection boards and targets, transcribed
     from his site) and `Tourney Data/DCFCStats_App_Data_Entry *.xlsx`.
   - `Perfect Draft Daily Info/*.pdf` (three Perfect Draft guides by someone
     else).
   - `Tourney Data/databotai tourney details 2026-08-24.csv` (scraped from a
     site behind a Discord login).
   - `Docs/Rules/` and `reference/` copies of OOTP's PTCS rules PDF (published
     by OOTP; low risk, but it is their document).
   Deleting them in a new commit is not enough: they stay in the history. Either
   rewrite the history (`git filter-repo --path … --invert-paths`, then force-push
   and re-clone on the Mac), or publish a fresh public repo from a cleaned copy
   and keep this one private.
2. **The login has no rate limit.** The app URL appears in four files
   (`Data Drop Guide.html`, `Push to GitHub.command`, a handoff and
   `web/scripts/roster-roundtrip.ts`), so a public repo tells anyone where the
   login is. Make sure `APP_PASSWORD` is long and random. Adding a simple
   attempt limit to `/api/login` would close this fully.
3. **Personal details.**
   - Commit author email `ljcox1@gmail.com` on 66 commits (GitHub shows it on
     every one). Changing it needs a history rewrite (`git filter-repo
     --mailmap`); new commits can use the GitHub noreply address.
   - The handoff docs describe L.J. and his play in a personal voice, and name
     other players (cwhit, Liam) with commentary on their teams.
   - In-game usernames in the community dumps are public game data; low risk.

## Recommendation

Publish a **new public repo from a cleaned snapshot** (no history), with
item 1's files removed and the personal handoff docs moved out or trimmed, and
keep this private repo as the working copy. That avoids rewriting the history
the Mac's clone depends on. Separately, harden `/api/login` and confirm the
password strength, whichever way the repo goes.
