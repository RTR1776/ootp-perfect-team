# OOTP Perfect Team workspace

Start every session by reading, in order:
1. `Docs/HANDOFF - read me first.md` — who L.J. is, scoring rules.
2. The newest `Docs/Handoff <date>.md` (sort by the date in the name) — access, authorised workflow, where
   things stand. Update it (or add a new dated one) before a long session ends.

The app lives in `web/` (Next.js; see `web/AGENTS.md` before touching it).

## Subagents (`.claude/agents/`)

Three agents, each on a different model. Judgement, model design and anything written to L.J. stay in the main
session; delegate only what is named here, and do small things yourself.

- `lookup` (Haiku): find where something is in the docs, code or data. Returns paths and quotes, no opinions.
- `runner` (Sonnet): run a fully specified job with long output (tests, a batch build, a script) and report the
  outcome. It writes nothing to the database or saved rosters unless the brief says so.
- `checker` (Opus): an independent read of a roster, a scored table, a number or a model change before L.J.
  acts on it. Brief it with the thing to check and where the evidence is, not with the answer you expect.

A subagent knows only what the brief tells it, so name the files, the event ids and what you want back.
