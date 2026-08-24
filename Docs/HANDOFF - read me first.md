# HANDOFF — read this first

**For:** the next Claude working with L.J. (RTR1776 / Kansas City Torrent) on OOTP Perfect Team.
**Written:** 2026-08-06, end of a long thread. Everything below is verified, not remembered.

---

## Who you're working with

L.J. plays **OOTP Perfect Team** — a card-collecting baseball sim (think Hearthstone with rosters). He's fluent in the vocabulary; don't explain the game to him. He is sharp, checks your work, and **has caught you being wrong more than once.** When he pushes back, he's usually right — verify before defending.

Corrections he's made that stuck:
- "Your minimums are wack" — 60 IP is meaningless. Use **500 PA / 400 IP** floors.
- "Usage matters less than actual production" — rank by WAR rate + vL/vR splits, never roster %.
- "Variants aren't always available" — variant cards are a *separate, pricier* market listing.
- "It doesn't matter how I get there" — sequencing categories is fine; there's no timing penalty. (He was right; I'd overstated "start day one.")
- "We still have Saturday, lol" — count the calendar carefully before declaring doom.

He likes directness, hates padding, and says **"WE GRIND"** when he wants execution over planning.

---

## The two workstreams

### 1. PTCS qualifying tracker (the daily one)

This is the recurring work. Every day or two he pastes a **screenshot of tournament results**; you score them and update the tracker.

**How to score a screenshot.** Each row has: tournament name, **STANDINGS** column (which categories it feeds), **TEAMS** (field size), and **STATUS** (placement). Apply the official points table:

| Finish | 256 | 128 | 64 | 32 |
|---|---|---|---|---|
| 1st | 40 | 30 | 25 | 20 |
| 2nd | 30 | 20 | 15 | 10 |
| 3rd–4th | 20 | 15 | 10 | 6 |
| 5th–8th | 15 | 10 | 6 | 3 |
| 9th–16th | 10 | 6 | 3 | 1 |
| 17th–32nd | 6 | 3 | 1 | 0 |
| 33rd–64th | 3 | 1 | 0 | — |
| 65th–128th | 1 | 0 | — | — |

Bracket exits map to placements: Rd1 out of a 128 = 65th–128th, Rd2 = 33rd–64th, Rd3 = 17th–32nd, QF = 5th–8th, semi = 3rd/4th.

**A tournament can feed 2–3 categories at once** (e.g. `Dia,Cp` = Diamond + Cap). Award the full points to *each*. This is the single most important mechanic in the whole game.

**Always check for duplicate tournament IDs** before adding — he re-sends overlapping screenshots and has explicitly asked you to check. IDs increment by 1 each day per event (Daily Live All Night 2260142 → 2260143).

**Current state — PTCS 6, Aug 3 – Sep 6 (35 days), chasing ALL 10 categories.**
Tracker: `PTCS6 Tracker.xlsx`. Builder: `engine/trackers/tracker6b.py` (edit the `DAYS` list, re-run, copy the xlsx to the workspace folder).

As of Aug 6 (day 4): Diamond 56/101, Cap 39/179, Silver 14/129, PD Daily 15/334, Gold 4/114, Open 4/129, Live 2/176, **Iron 0/135, Bronze 0/130, PD Weekly 0/96.**

Targets are PTCS5's final cutoffs × 5/4 (PTCS6 is 5 weeks, PTCS5 was 4). **Replace with official numbers when week-1 standings CSVs arrive** — he drops them in `Tourney Standings/`.

**PTCS 5 finished 5 of 6 berths** (Diamond, PD Daily, Gold, Live, Cap ✅ — Silver missed by 16). That's the benchmark.

### 2. The app (`web/` + `engine/`)

A working Next.js 16 personal app: card explorer, lineup optimizer, draft assistant, tournament meta browser, Card Lab. **It runs but is frozen** — `python -m engine build` cannot execute because three input dirs referenced by hardcoded paths are gone (`Most recent League Season/`, `Tourney Stats/`, `Tourney Stats examples/`) and `reference/` moved after the last commit. The UI reads static JSON frozen at 2026-07-06.

Full modernization plan: `APP_PLAN_V2.md` (in outputs; may need regenerating). Phase 0 is unbreaking the pipeline — half a day of path config.

**Blocker to flag:** the league-season CSVs (`pel_*.csv`, `hd45*.csv`) are the calibration backbone and are **not on disk anywhere**. He needs to re-export them before the engine can refit.

---

## What you built that still works

| File | What it does |
|---|---|
| `OOTP ENGINE DECODED.md` | The reference doc — how ratings become outcomes |
| `PT Card Lab.html` | Interactive projector: sliders → full projected line, 96 era contexts |
| `engine/trackers/card_projector.py` | CLI projector; `--explain` prints the multiplier table, `--validate` checks vs known cards |
| `engine/trackers/tourney_ev.py` | His EV per tournament from 368 real entries |
| `engine/trackers/rotation_v3.py` | The rotation study |
| `engine/trackers/tracker6b.py` | **PTCS6 tracker builder — this is the one you'll use daily** |
| `engine/trackers/meta_engine2.py` | Meta analysis (usage + production + shop prices) |

⚠️ **The outputs folder is scratch and clears between sessions.** Anything that matters goes in the workspace folder. Build xlsx files in the sandbox, then `cp` them across — writing xlsx directly to the mount has corrupted files twice. If a copy fails with "Resource deadlock avoided," retry 2–3 times with a sleep.

---

## The findings — hard-won, don't re-derive

**The OOTP engine, decoded.** Every rating maps to an outcome through one power law:
```
rate = env_rate × e^α × (rating / 50)^β
```
Verified to **±0.002 OPS and ±0.00 FIP** across 401 cards. Coefficients live in `engine/config/curves.json`.

| Rating | β | R² | Read |
|---|---|---|---|
| **POW** | +1.33 | .78 | most powerful rating in the game; increasing returns |
| EYE | +1.04 | .87 | nearly linear, reliable |
| K-avoid | −0.76 | .88 | tightest fit |
| **BA (contact)** | **+0.16** | **.26** | ⚠️ nearly worthless — DIPS lives inside OOTP |
| **CON (pitcher)** | −0.94 | .74 | beats Stuff ~2× |
| STU | +0.53 | .68 | weaker than the market thinks |
| PBABIP | −0.11 | .17 | ⚠️ noise |

**Gotcha that cost a debugging cycle:** OOTP's 184-column exports reuse column names. `CON vL` appears twice — first is *hitter contact*, second (`CON vL_1`) is *pitcher control*. Reading the wrong one silently produced FIP errors of +11.7.

**Rotation study (6,175 tournaments, whole PT27 season).** L.J. hypothesised strong players qualify early then rotate out, softening late fields. **Tested and largely false:** elite players ease off in *Diamond/Gold* (−10%, −5% entries) but barely in Iron/Bronze (−2%). 48–50 of every top-50 stay active. Critically, repeat entrants finish **slightly worse** late (+0.2 to +0.8 percentile) because bubble grinders replace departing sharks. **No edge in waiting.**
*(First run showed a dramatic −75% "ROTATE OUT" — that was a bug: periods 2–3 are exactly 4 weeks so the "weeks 4–5" window was one week divided by two. Normalize per day.)*

**His tournament EV, from 368 real entries.** 45.3 avg finish percentile, 8 wins, 14% top-8.
Best events: **Diamonds are Forever 4.46 pts/entry**, Diamond & Friends Slots 3.93 (also feeds Cap), Daily Diamond 2.77.
**He scores better in 64-team fields (2.72/entry) than 128s (1.75)** — but 128s pay ~50% more at the top, so take 128s when he needs a *big* score and 64s when accumulating.

**Points are violently convex.** A win in a 64 = 25; 17th–32nd = 1. Deep runs matter far more than volume. Cap sat at 5% for two weeks then a single Winner (+25) doubled it overnight. When a category stalls, the diagnosis is almost always *finishes*, not entries.

**Cutoff projection method (validated).** The 128th-place line accumulates **linearly** — week 1 → week 2 was 1.9–2.1×. So projected final = current line × (total days / elapsed days). This has been the most accurate method all season. beckdawg's community method (max non-outlier weekly gain × weeks) runs slightly high; Cwhit's projections run lowest. Showing a LOW/HIGH band beats false precision.

---

## The strategic picture for PTCS 6

Needs ~43/day across 10 categories; his demonstrated rate is 43.9/day. **Tight but feasible** — and the benchmark understates him, since in PTCS 5 entries landing in untracked categories scored nothing.

**The real enemy is overshoot, not timing.** PTCS 5 wasted **418 points above cutoffs** (Diamond +202, PD Daily +136). At ~99% utilization he can't afford that again. So: **watch the Gap column; when a category hits 0, stop feeding it and redirect.**

**Sequencing is fine** — hammer one category, then switch. Points don't decay and fields don't shift late. **One exception:** PD Weekly fires ~5×/week and those chances *expire*. Start it in week 3 and the remaining events must pay 6.4 each instead of 3.8.

**Multi-tag events are the whole game.** `Daily Live <Tier>` → tier + Live. `<Tier> Cap/Slots` → tier + Cap. Live drafts → PD Daily + Live. **Live and Cap should never need a dedicated slot.**

**Entry limits:** 4 tournaments + 3 drafts **concurrent**, not daily. Events fire on fixed times all day and free the slot, so he runs 10–15 tournaments/day. An idle slot is the only true waste.

---

## Working notes

- Save a fresh tracker after each update and present it with `mcp__cowork__present_files`.
- He often sends results mid-turn; fold them in rather than finishing the old answer.
- Don't narrate tool calls. Give him the table and the one thing that matters.
- When the odds are long, **say so plainly** — he'd rather have 5.5% than false hope. He responds well to explicit probability (Monte Carlo off his empirical finish distribution works nicely).
- Memory files exist at the space's memory dir covering his profile, the data conventions, and the production-over-usage rule.
