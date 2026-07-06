# OOTP Perfect Team — Optimizer & Draft Assistant

Personal analytics webapp for OOTP 27 Perfect Team: lineup optimization by
tournament context, new-card modeling, tourney meta tracking, and a live
draft assistant. Everything runs locally; no server, no accounts.

**Working docs:** [PLAN.md](PLAN.md) is the design; [PROGRESS.md](PROGRESS.md)
is the implementation state (read it first in any new work session).

## Quick start

```bash
# refresh all derived data from the exports in this repo (~9s)
.venv/bin/python -m engine build

# run the app
cd web && pnpm dev        # -> http://localhost:3000
```

## The weekly refresh runbook

1. **Collection changed** (bought/sold cards, new releases): in OOTP, export
   your collection view (ideally with `CID` and `Tier` columns visible) and
   replace `Roster Templates/KC Torrent Current Cards.csv`.
2. **League season ended**: export each league's stats (all/vL/vR) into
   `Most recent League Season/` using the existing file names
   (`pel_*.csv`, `hd45x*.csv`).
3. **After every tourney**: either run the watcher while OOTP is open —

   ```bash
   .venv/bin/python -m engine watch --label diamondslotsdaily
   ```

   (first run creates `engine/config/watcher.json`; set `watchDir` to your
   OOTP save folder containing `online_data/`; the OOTP view must be saved as
   "Export") — or drop the export into `Tourney Stats/` named
   `<type>_<id>.csv` and run `.venv/bin/python -m engine ingest`.
4. **New tournaments announced**: add rows to
   `data-src/OOTP26 Historic Tourney_Draft List.xlsx`, then
   `.venv/bin/python -m engine config`.
5. Run `.venv/bin/python -m engine build` and reload the app.

## Engine CLI

| command | does |
|---|---|
| `config` | xlsx → `engine/config/tournaments.json` + `web/public/data/contexts.json` (era RE baselines per context) |
| `ingest [files…]` | archive tourney exports → `tourneys.json` aggregates |
| `match` | resolve CIDs for the collection export (fingerprint matcher) |
| `curves` | refit empirical rating→outcome curves from league data |
| `projections` | rebuild `projections.json` + `team.json` from the merged pool |
| `calibrate` | fit projections vs observed; write `evidence` blends + calibration report |
| `watch --label L` | watch OOTP export folder; archive + ingest automatically |
| `build` | all of the above in order |

## How the numbers work (one paragraph)

Card ratings → component rates via **empirically fitted curves** (`curves.py`,
fit on a full league season where ratings and outcomes live in the same rows)
→ projected splits in the modern-PT-league frame (`projections2.py`) →
**calibrated** against observed results and **blended** by sample size
(`calibrate.py`; 220 PA / 60 IP half-weights), stored per card as `evidence`
→ the app applies **context** (era expressed as park-like multipliers × the
physical park) and optimizes lineups / scores draft picks in runs per game.
Observed "overall" stats are usage-biased (managers platoon), so everything
calibrates on vL/vR splits; overall lines are constructed 28/72 (hitters) and
45/55 (pitchers).

## Repo map

| path | what |
|---|---|
| `engine/` | Python package (CLI above); config in `engine/config/` |
| `web/` | Next.js app (Explorer / Roster / Lineup / Draft / Tournaments / Card Lab) |
| `web/public/data/` | generated JSON artifacts the app reads |
| `data-src/` | source-of-truth inputs (tourney/draft rules xlsx) |
| `Most recent League Season/` | league stats exports (calibration backbone) |
| `Tourney Stats/`, `Tourney Stats examples/` | per-tourney exports archive |
| `Roster Templates/` | collection export + binary `.tr` templates (never parsed) |
| `data-store/` | generated intermediates (git-ignored) |
| `reference/r-watcher/` | original R watcher (replaced by `engine watch`) |
| `MLB Batting Year-by-Year Averages.xls` | RE source, 1871–2026 (**actually HTML** — `pd.read_html`) |
| `ballparks.csv` | 236-park factor DB |

## Environment

- Python: use the repo venv (`.venv/bin/python`) — system python is
  PEP-668-locked and lacks lxml. Recreate with
  `python3 -m venv .venv && .venv/bin/pip install pandas lxml openpyxl`.
- Web: `pnpm` (Next 16 — **read `web/AGENTS.md` before writing code there**).
