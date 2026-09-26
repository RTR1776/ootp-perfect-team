/**
 * The observed panel the model audit reads: one row per (series, card) with
 * the counters, the card's ratings, and the app's model runs computed in THAT
 * series' own environment (era year, park, field handedness). The model runs
 * come raw, calibrated without the era correction, and as the roster tools
 * use them (calibrated plus era correction). No observed blend.
 *
 *   pnpm model:panel                  # -> ../Archive/.model-panel.csv
 *   python3 scripts/model-audit.py ../Archive/.model-panel.csv
 *
 * First written for the 2026-09-26 review (Docs/Model Review 2026-09-26.md).
 * Series whose format changed (restrictions.formatSince) are flagged, not
 * dropped. The audit leaves them out because their older exports describe
 * another environment.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { eraFor, eraTable, parkFor } from "@/lib/analytics/tournament-env";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const asRows = (r: unknown): Row[] => (Array.isArray(r) ? (r as Row[]) : ((r as { rows?: Row[] }).rows ?? []));
const OUT = process.argv[2] ?? join(process.cwd(), "..", "Archive", ".model-panel.csv");

const HIT_KEYS = ["Avoid Ks", "Eye", "Power", "Gap", "BABIP", "Contact"];
const PIT_KEYS = ["Stuff", "Control", "pHR", "pBABIP", "Movement"];
const splitKey = (k: string, s: string) => (k === "Avoid Ks" ? `Avoid K ${s}` : `${k} ${s}`);
const CNT = ["K", "BB", "IBB", "HP", "HR", "b1", "b2", "b3", "H", "AB", "SF", "SB", "CS", "R", "Ka", "BBa", "HRa", "HPa", "Ra", "ER", "BF", "G_p", "GS_p", "ZR", "E"];

async function main() {
  const series = asRows(await db.execute(sql`
    select t.series, t.env_year, t.stadium, t.restrictions->>'formatSince' fs,
           (t.restrictions->'notes') @> '["default RE"]' default_re,
           t.ratings_min, t.ratings_max, t.name,
           m.lhp_bf_share lhp, m.lhb_pa_share lhb, m.files, m.avg_teams
    from tournaments t left join series_meta m on m.series = t.series
    where t.series in (select distinct series from observed_card_stats)`));
  const cards = asRows(await db.execute(sql`
    select card_id, name, card_value, card_type, is_pitcher, bats, throws, year, pitcher_role, released_on, ratings from cards`));
  const byId = new Map(cards.map((c) => [Number(c.card_id), c]));
  const lines = asRows(await db.execute(sql`
    select series, card_id, is_pitcher, instances, pa, ip, woba, fip, counters from observed_card_stats`));

  const header = ["series", "env_year", "env_known", "format_changed", "park", "lhp", "lhb", "files", "avg_teams", "val_min", "val_max",
    "card_id", "name", "is_pitcher", "instances", "pa", "ip", "woba", "fip", ...CNT,
    "raw_R", "raw_L", "cal_R", "cal_L", "cal_noera_R", "cal_noera_L", "nobab_R", "nobab_L", "norole_R", "norole_L", "nobabrole_R", "nobabrole_L",
    "card_value", "card_type", "year", "bats", "throws", "role", "stamina", "speed", "released",
    ...HIT_KEYS.flatMap((k) => [k, splitKey(k, "vL"), splitKey(k, "vR")]),
    ...PIT_KEYS.flatMap((k) => [k, `${k} vL`, `${k} vR`]),
    ...["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"].map((p) => `Pos Rating ${p}`)];
  const out: string[] = [header.map((h) => JSON.stringify(h)).join(",")];

  for (const s of series) {
    const envYear: number | null = s.env_year != null ? Number(s.env_year) : s.default_re ? 2010 : null;
    const era = eraFor(envYear)?.row ?? eraTable["0"];
    const park = parkFor(s.stadium ?? null).row;
    const lhp = s.lhp != null ? Number(s.lhp) : 0.3, lhb = s.lhb != null ? Number(s.lhb) : 0.35;
    const mine = lines.filter((l) => l.series === s.series);
    const pool = mine.map((l) => byId.get(Number(l.card_id))).filter(Boolean).map((c) => ({
      cardId: Number(c!.card_id), isPitcher: !!c!.is_pitcher, bats: c!.bats, role: c!.pitcher_role, ratings: (c!.ratings ?? {}) as Record<string, number>,
    }));
    const base = { era: era.rates, park, roleTrust: 0.25, leagueLhbShare: lhb };
    const raw = envFitMaps(pool, { ...base, calibrate: false });
    const cal = envFitMaps(pool, { ...base, eraYear: envYear ?? 2010 });
    const calNoEra = envFitMaps(pool, { ...base });
    const neutral = pool.map((c) => c.isPitcher ? { ...c, ratings: { ...c.ratings, pBABIP: 110, "pBABIP vL": 110, "pBABIP vR": 110 } } : c);
    const noBab = envFitMaps(neutral, { ...base, eraYear: envYear ?? 2010 });
    const noRole = envFitMaps(pool, { ...base, eraYear: envYear ?? 2010, roleTrust: 0 });
    const noBabRole = envFitMaps(neutral, { ...base, eraYear: envYear ?? 2010, roleTrust: 0 });
    for (const l of mine) {
      const id = Number(l.card_id), c = byId.get(id);
      if (!c) continue;
      const r = (c.ratings ?? {}) as Record<string, number>;
      const cn = (l.counters ?? {}) as Record<string, number>;
      const vals = [s.series, envYear ?? "", envYear != null ? 1 : 0, s.fs ? 1 : 0, s.stadium ?? "", lhp, lhb, s.files ?? "", s.avg_teams ?? "", s.ratings_min ?? "", s.ratings_max ?? "",
        id, c.name, l.is_pitcher ? 1 : 0, l.instances, l.pa, l.ip, l.woba ?? "", l.fip ?? "", ...CNT.map((k) => cn[k] ?? 0),
        raw.runsR.get(id) ?? "", raw.runsL.get(id) ?? "", cal.runsR.get(id) ?? "", cal.runsL.get(id) ?? "", calNoEra.runsR.get(id) ?? "", calNoEra.runsL.get(id) ?? "",
        noBab.runsR.get(id) ?? "", noBab.runsL.get(id) ?? "", noRole.runsR.get(id) ?? "", noRole.runsL.get(id) ?? "", noBabRole.runsR.get(id) ?? "", noBabRole.runsL.get(id) ?? "",
        c.card_value ?? "", c.card_type ?? "", c.year ?? "", c.bats ?? "", c.throws ?? "", c.pitcher_role ?? "", r.Stamina ?? "", r.Speed ?? "", c.released_on ? String(c.released_on).slice(0, 10) : "",
        ...HIT_KEYS.flatMap((k) => [r[k] ?? "", r[splitKey(k, "vL")] ?? "", r[splitKey(k, "vR")] ?? ""]),
        ...PIT_KEYS.flatMap((k) => [r[k] ?? "", r[`${k} vL`] ?? "", r[`${k} vR`] ?? ""]),
        ...["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"].map((p) => r[`Pos Rating ${p}`] ?? "")];
      out.push(vals.map((v) => (typeof v === "string" ? JSON.stringify(v) : String(v))).join(","));
    }
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, out.join("\n") + "\n");
  console.log(`${out.length - 1} rows, ${series.length} series -> ${OUT}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
