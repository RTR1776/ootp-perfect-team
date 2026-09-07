# App audit evidence — September 6, 2026

This accompanies [the improvement plan](</Users/ljmac/Desktop/OOTP Perfect Team/Docs/APP_IMPROVEMENT_PLAN.md>). The configured database was inspected in a read-only transaction. Application code, imports, card ownership, rosters and tournament results were not changed.

## Evidence and reproducibility

- [evidence.json](</Users/ljmac/Desktop/OOTP Perfect Team/Docs/audit-2026-09-06/evidence.json>) records the measured inventory, SQL queries and source-date coverage. These are a snapshot, not perpetually current numbers.
- [audit.ts](</Users/ljmac/Desktop/OOTP Perfect Team/Docs/audit-2026-09-06/audit.ts>) reruns the database and latest-source checks. Run from `web` using the command in its header. It reads the existing environment file without printing credentials.
- [audit.ipynb](</Users/ljmac/Desktop/OOTP Perfect Team/Docs/audit-2026-09-06/audit.ipynb>) displays the saved evidence and the queries, and contains an optional refresh cell.
- Existing `pnpm verify:ingest`: **43/43 executed checks passed**. Collection and official-standings sections were skipped because their hardcoded expected files are missing. This was not a full ingest or end-to-end validation.
- Separately parsing and matching the actual Aug 27 files: 4,010 shop cards, valid tier bands, 3,500 collection rows, 3,425 classified exact matches, 75 classified variant matches, no unmatched rows. The source file has 122 header fields and 123 fields per card row; the current parser handles that known shape.
- The latest dumps contain 8,403 and 5,838 events respectively, with no duplicate IDs within either latest file. Their combined personal entries match the loaded 1,296 results. Earlier dumps overlap these snapshots; do not sum files as independent event sets.
- Development server started successfully and the browser displayed the login screen. Authenticated pages were reviewed in source, not exercised end-to-end. No production deployment or build verification was performed.

## Findings and confidence

| Finding | Severity / confidence | Evidence and consequence | Smallest useful remediation |
|---|---|---|---|
| Whole-roster legality is not enforced by the current auto-fill/save path | High / high | `build/page.tsx` filters value, year and tier presence; `RosterBuilder.autoFill` selects greedily. Known catalog rules include caps, slots and card types. A displayed recommendation can violate roster-wide limits. | Shared validator with fixture rosters covering known restrictions; ready-state gate on server and client |
| Variant selections are not persisted | High / high | `api/rosters/route.ts` always writes `useVariant: false`; builder uses shop ratings with a variant badge | Explicit card-form choice, effective ratings, and save/load round-trip checks |
| Recommendation methods disagree | High / high | `hitterRaw`/`pitcherRaw`, `projection.ts`, and Market's `auditCard` have separate objectives; projection functions accept no event context | One versioned scoring result used across features |
| Historical observations erase format and variant distinctions | High / high for structural gap; bias magnitude unmeasured | `observed_card_stats` primary key is `(series, card_id)`; importer aggregates over files without event/rules-version or variant keys | Retain event/stint facts and derive versioned context aggregates |
| A failed observed refresh can expose partial data | High / high for code path; no failure induced | Import deletes selected series then inserts batches, with retry but without atomic publication | Stage and validate before switching the active dataset |
| PTCS “QUALIFIED” can mean estimated target reached | High / high | Period has `targets_are_official=false`; page status is set solely by total ≥ target | Separate estimate/current cutoff/confirmed qualification |
| Current model validation is in-sample | High / high | `fit-projection.ts` evaluates weighted R² on the fitting rows; output .301 hitter / .375 pitcher | Chronological event-level holdout and simple baseline comparisons |
| Different sources describe different dates | Medium / high | Shop/collection Aug 27, dumps Aug 31, newest leagues Sep 6; HD451 falls back further | Source dates and freshness lineage on recommendations |
| HD451 Aug 30 export is incomplete | Medium / high, already mitigated | 4 pitchers / 473 rows = 0.85%; Aug 16 had 423 / 906 = 46.69% | Preserve existing fallback; request a complete export through normal import workflow |
| Observed IDs missing from current catalog | Medium / high | 152 of 30,321 aggregate rows reference 34 absent card IDs | Quarantine/reconcile IDs; preserve source evidence rather than dropping it |
| Test coverage can silently shrink | Medium / high | Two verification sections skipped even though the overall command passed | Fixed fixtures plus an explicit required-suite coverage report |
| Documentation is contradictory | Medium / high | Root README describes static JSON and removed routes; V3 partially describes current database app | One current architecture/workflow document; mark historical plans as historical |

## Source map

| Concern | Current source |
|---|---|
| Roster pool, ownership, upgrades | [build/page.tsx](</Users/ljmac/Desktop/OOTP Perfect Team/web/src/app/build/page.tsx>) |
| Auto-fill, defensive scoring, platoons, user workflow | [roster-builder.tsx](</Users/ljmac/Desktop/OOTP Perfect Team/web/src/components/roster-builder.tsx>) |
| Saved roster semantics | [rosters API](</Users/ljmac/Desktop/OOTP Perfect Team/web/src/app/api/rosters/route.ts>) |
| Current prediction model | [projection.ts](</Users/ljmac/Desktop/OOTP Perfect Team/web/src/lib/analytics/projection.ts>) and [fit-projection.ts](</Users/ljmac/Desktop/OOTP Perfect Team/web/scripts/fit-projection.ts>) |
| Alternative empirical model | [curves.py](</Users/ljmac/Desktop/OOTP Perfect Team/engine/curves.py>), [projections2.py](</Users/ljmac/Desktop/OOTP Perfect Team/engine/projections2.py>), [calibrate.py](</Users/ljmac/Desktop/OOTP Perfect Team/engine/calibrate.py>) |
| Import grain and refresh safety | [import-observed.ts](</Users/ljmac/Desktop/OOTP Perfect Team/web/scripts/import-observed.ts>), [upload API](</Users/ljmac/Desktop/OOTP Perfect Team/web/src/app/api/upload/route.ts>), [schema.ts](</Users/ljmac/Desktop/OOTP Perfect Team/web/src/db/schema.ts>) |
| League completeness | [league-snapshots.ts](</Users/ljmac/Desktop/OOTP Perfect Team/web/src/lib/league-snapshots.ts>) |
| PTCS sources and state labels | [ptcs/page.tsx](</Users/ljmac/Desktop/OOTP Perfect Team/web/src/app/ptcs/page.tsx>) and [dumps.ts](</Users/ljmac/Desktop/OOTP Perfect Team/web/src/lib/analytics/dumps.ts>) |
| Existing ingest checks | [verify-ingest.ts](</Users/ljmac/Desktop/OOTP Perfect Team/web/scripts/verify-ingest.ts>) |
| Personal strategic workflow | [HD450 post-mortem](</Users/ljmac/Desktop/OOTP Perfect Team/Torrent HD450 Post-Mortem.html>) and [championship comparables](</Users/ljmac/Desktop/OOTP Perfect Team/PTCS6 Championship Comparables.html>) |

## Interpretation limits

These inventory counts describe different grains. Card/series aggregates are not individual games, collection rows can be copies, and league rows are team stints rather than independent cards. Only 3,351 hitter-series aggregates reach 500 PA and 1,244 pitcher-series aggregates reach 400 IP; large total row counts alone do not establish strong evidence for every card in every format.

The `withVariantListing` name comes from the existing parser. It counts positive variant last-ten price values, which should not be interpreted as live executable asks without separate evidence.

The current market comparison pool selects non-PEL leagues; it now includes LD404 as well as HD leagues. A future level-specific value screen should separate or explicitly normalize competition levels rather than calling this a pure HD baseline.

The notebook and audit preserve quantitative checks. The older reports, model claims, and PDF draft heuristics were assessed as project context, not reproduced research. A successful parse or a high training fit does not prove a strategic recommendation correct.
