# Subagents vs one loop: article review (Claude, 2026-11-17)

**Source:** Anthropic, "Building agents: When to fold subagents into your main agent loop", Diane Sarkis, 2026-10-22.
https://claude.com/resources/articles/building-agents-when-to-fold-subagents-into-your-main-agent-loop

How it was read: WebFetch summary of the page, then a second pass that pulled the exact sentences behind each number used below. All seven checked out. It was not read line by line in a browser.

## What it says, in short

- **Default to one agent loop.** Keep procedures in skills and tools that load only when needed (short descriptions up front, full text on demand), not in separate subagents. In Anthropic's enterprise deployments this usually beat both one big prompt and a set of subagents on quality, cost and latency.
- **When subagents still pay:**
  - the one loop measurably degrades from context bloat;
  - tasks need parallel, throwaway fresh contexts;
  - the one agent can't pick the right tool, or its instructions conflict.
- **Costs of subagents:**
  - every handoff is a lossy summary (a "telephone game" when split by problem type);
  - each one is a nested model loop, so latency adds up; one customer's single loop ran about 2x faster;
  - each needs its own prompt, owner and evals.
- **If you keep subagents, split them by context, not by problem type.** Give each one work that needs little from the rest of the system and have it return a compact result. Its examples: independent research paths, clean-interface components, black-box verification.
- **Failure modes it names:**
  - "Frankenprompt": everyone adds rules to one system prompt until they conflict.
  - Subagent sprawl.
  - Evals that only score each team's own piece.
- **Method:**
  - Build a small end-to-end eval (10 golden examples is enough to start).
  - Fold in one subagent at a time and keep it only where folding scores worse.
  - Look at which tasks flipped, not just the total.
  - Run each task more than once: one regression in their test showed up in only one of two runs.
- **Other numbers:**
  - Tool choice degrades past about 30–50 tool definitions; group tools by intent and use deferred tool search.
  - Claude Code's system prompt was cut by over 80% for newer models, partly by moving material into skills and tools.

## How our setup compares

**Already in line (no change):**
- L.J.'s rule is to do the work in the main session unless a handoff clearly pays, which is the article's default.
- Our three agents are split by context, as it recommends:
  - `lookup` (Haiku) is an independent search that returns paths and quotes, a compact result.
  - `runner` (Sonnet) runs a job that is already decided and has long output, which keeps that output out of the main context.
  - `checker` (Opus) is black-box verification, one of its named good cases.
- None is a "specialist per problem type": there is no roster agent, PTCS agent or market agent. Keep it that way.
- Judgement and anything written to L.J. never leave the main loop. That avoids the telephone game where it matters most.

**Where we drift toward what it warns about:**
1. **Always-read docs act like a Frankenprompt.**
   - Every session starts by reading `HANDOFF - read me first.md` (153 lines) and the newest handoff. `Handoff 2026-11-12.md` is 361 lines and grows 20–40 lines a day.
   - Most of that is relevant only to one kind of task.
   - The fix the article points to is progressive disclosure: move a procedure into a skill that loads only when that task comes up.
2. **The roster procedure is re-derived each session.**
   - On 11-17 the Sporer's Sandlot build meant re-reading `current-rosters.ts` for the build flags and floors, `env-roster.ts` for `--show` and `--score`, and memories for the report format and save steps.
   - A project skill (`.claude/skills/roster/SKILL.md`) could hold it once:
     - event args from `current-rosters --only`;
     - the build;
     - `roster-report.mts`;
     - forced-card pricing (`--must`, compared with the free build, same seed and starts);
     - `--score` for a hand swap;
     - backup, then save;
     - the usual report format.
   - It would load only when L.J. asks for a roster. **Built 11-17 on L.J.'s yes** as `.claude/skills/roster/SKILL.md`. It also has the 15-second one-swap screen for new cards, so forced runs are only for confirming.
3. **Memory index.** `MEMORY.md` loads every session (about 25 lines). Fine at this size. Above roughly 50 lines, fold related entries.

**Doesn't apply here:**
- The central team and owner-per-skill model.
- MCP tool grouping (we have no tool sprawl of our own).
- Org-chart effects.
- Formal eval suites for the agent itself: a one-user workspace doesn't need them. The model has its own validation.

**Worth borrowing anyway:**
- **Change one thing at a time and check which cases flipped.** We already do this for model changes (the 11-12 time-split test).
- **Run twice when a result is surprising.** The roster optimiser is also nondeterministic across starts. Silver Only Cap 11-17: a forced Sutter run found 191.2 where 16 starts had stopped at a local optimum.
