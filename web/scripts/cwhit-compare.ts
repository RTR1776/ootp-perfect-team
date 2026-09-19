/**
 * Put the app's calibrated runs beside cwhit's boards for the same cards.
 *
 *   pnpm cwhit:compare --dir ../reference/cwhit --date 2026-09-17 \
 *     --year 1955 --park "Hinchliffe Stadium" --park-year 1936 --min 50 --max 74
 *
 * Reads the four transcribed CSVs (`<date> hitters observed.csv`, `<date>
 * hitters projected.csv`, `<date> pitchers observed.csv`, `<date> pitchers
 * projected.csv`) and, for every name it can match in the card table (name
 * plus VAL, case-insensitive), prints the app's model runs, the observed
 * blend the roster tools actually use, this collection's own observed line,
 * and cwhit's numbers. Ends with rank correlations so a disagreement is a
 * number and not an impression.
 *
 * Runs are per 700 PA (or BF) above a league-average card in the event's
 * environment; cwhit's wOBA / pwOBA are on his site's scale. Only the
 * ORDER is comparable, which is what the correlations measure.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, collectionCards, uploads } from "@/db/schema";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { loadObservedRuns, OBS_K_DEFAULT } from "@/lib/analytics/observed-blend";
import { eraTable, parkRow } from "@/lib/analytics/runenv-view";

const argv = process.argv.slice(2);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const num = (k: string, d: number | null = null) => { const v = val(k); return v == null ? d : Number(v); };
const DIR = val("dir", "../reference/cwhit")!;
const DATE = val("date");
if (!DATE) { console.error("--date YYYY-MM-DD is required (the prefix of the CSV files)"); process.exit(1); }
const YEAR = num("year"), PARK = val("park") ?? null, PARK_YEAR = num("park-year");
/** The era correction (calibration.ts ERA_SLOPES) is on unless --no-era-correct; PT default reads as 2010. */
const ERA_YEAR: number | null = argv.includes("--no-era-correct") ? null : (YEAR ?? 2010);
const MIN = num("min", 0)!, MAX = num("max", 999)!;
const OBS_K = num("obs-k", OBS_K_DEFAULT)!;
const LHP = num("lhp-share", 0.3)!, LHB = num("lhb-share", 0.35)!;
const ROLE_TRUST = num("role-trust", 0.25)!;

type Row = Record<string, string>;
const csv = (file: string): Row[] => {
  const p = join(DIR, file);
  if (!existsSync(p)) { console.log(`(no ${file})`); return []; }
  const [head, ...lines] = readFileSync(p, "utf8").split(/\r?\n/).filter((l) => l.trim());
  const cols = head.split(",");
  return lines.map((l) => {
    // A card name in the projected files carries commas inside quotes? No —
    // the transcriptions are plain, but keep quoted fields safe anyway.
    const cells: string[] = []; let cur = "", q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { cells.push(cur); cur = ""; } else cur += ch; }
    cells.push(cur);
    return Object.fromEntries(cols.map((c, i) => [c.trim(), (cells[i] ?? "").trim()]));
  });
};
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
const f1 = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "    —" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}`.padStart(5));
const f3 = (s: string | number | null | undefined) => { const n = typeof s === "number" ? s : Number(s); return Number.isNaN(n) || s === "" || s == null ? "  —  " : n.toFixed(3).replace(/^0/, ""); };

/** Spearman rank correlation over the pairs both sides have. */
function spearman(pairs: [number, number][]): { rho: number; n: number } {
  const n = pairs.length; if (n < 3) return { rho: NaN, n };
  const rank = (xs: number[]) => { const idx = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]); const r = new Array(n); idx.forEach(([, i], k) => { r[i] = k + 1; }); return r; };
  const a = rank(pairs.map((p) => p[0])), b = rank(pairs.map((p) => p[1]));
  const d2 = a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0);
  return { rho: 1 - (6 * d2) / (n * (n * n - 1)), n };
}

async function main() {
  const era = eraTable[String(YEAR)] ?? eraTable["0"];
  const pr = parkRow(PARK, PARK_YEAR);
  if (PARK && !pr) console.log(`!! no park factors on file for ${PARK_YEAR} ${PARK} — running neutral`);

  const universe = await db.select().from(cards);
  const [latest] = await db.select({ id: uploads.id }).from(uploads).where(eq(uploads.kind, "collection")).orderBy(desc(uploads.id)).limit(1);
  const owned = new Set(latest ? (await db.select({ cardId: collectionCards.cardId }).from(collectionCards).where(eq(collectionCards.uploadId, latest.id))).map((o) => o.cardId!) : []);

  const byKey = new Map<string, typeof universe>();
  for (const c of universe) {
    if ((c.cardValue ?? 0) < MIN || (c.cardValue ?? 0) > MAX) continue;
    const k = `${norm(c.name)}|${c.isPitcher ? "P" : "H"}`;
    byKey.set(k, [...(byKey.get(k) ?? []), c]);
  }
  const find = (name: string, v: string, pitcher: boolean) => {
    const hits = byKey.get(`${norm(name)}|${pitcher ? "P" : "H"}`) ?? [];
    const exact = hits.filter((c) => String(c.cardValue) === v);
    return (exact.length ? exact : hits).sort((a, b) => (b.cardValue ?? 0) - (a.cardValue ?? 0))[0] ?? null;
  };

  const hitObs = csv(`${DATE} hitters observed.csv`), hitProj = csv(`${DATE} hitters projected.csv`);
  const pitObs = csv(`${DATE} pitchers observed.csv`), pitProj = csv(`${DATE} pitchers projected.csv`);
  type Line = { name: string; val: string; card: (typeof universe)[number] | null; obs?: Row; proj?: Row };
  const merge = (obs: Row[], proj: Row[], pitcher: boolean): Line[] => {
    const m = new Map<string, Line>();
    for (const r of obs) { const k = norm(r.Name); m.set(k, { name: r.Name, val: r.VAL, card: find(r.Name, r.VAL, pitcher), obs: r }); }
    for (const r of proj) { const k = norm(r.Name); const l = m.get(k) ?? { name: r.Name, val: r.VAL, card: find(r.Name, r.VAL, pitcher) }; l.proj = r; m.set(k, l); }
    return [...m.values()];
  };
  const hitters = merge(hitObs, hitProj, false), pitchers = merge(pitObs, pitProj, true);
  const matched = [...hitters, ...pitchers].filter((l) => l.card).map((l) => l.card!);
  const missing = [...hitters, ...pitchers].filter((l) => !l.card).map((l) => `${l.name} ${l.val}`);
  if (missing.length) console.log(`!! not in the card table at that value: ${missing.join(" · ")}\n`);

  const input = matched.map((c) => ({ cardId: c.cardId, isPitcher: c.isPitcher, bats: c.bats, role: c.pitcherRole, ratings: (c.ratings ?? {}) as Record<string, number> }));
  const base = envFitMaps(input, { era: era.rates, park: pr, roleTrust: ROLE_TRUST, leagueLhbShare: LHB, eraYear: ERA_YEAR });
  const both = (m: { runsR: Map<number, number>; runsL: Map<number, number> }, id: number) => { const r = m.runsR.get(id), l = m.runsL.get(id); return r == null || l == null ? null : (1 - LHP) * r + LHP * l; };
  const observed = OBS_K > 0 ? await loadObservedRuns(matched.map((c) => c.cardId), (id) => both(base, id)) : undefined;
  const blend = envFitMaps(input, { era: era.rates, park: pr, roleTrust: ROLE_TRUST, observed, observedK: OBS_K, leagueLhbShare: LHB, eraYear: ERA_YEAR });

  // This collection's own observed line, PA-weighted across series.
  const ids = matched.map((c) => c.cardId);
  const own = new Map<number, { pa: number; ip: number; woba: number | null; fip: number | null }>();
  if (ids.length) {
    const rows = (await db.execute(sql`
      select card_id, sum(pa)::int as pa, sum(ip)::real as ip,
             case when sum(pa) > 0 then sum(woba * pa) / sum(pa) end as woba,
             case when sum(ip) > 0 then sum(fip * ip) / sum(ip) end as fip
      from observed_card_stats where card_id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) group by card_id`)) as unknown as { rows?: Record<string, unknown>[] } | Record<string, unknown>[];
    for (const r of Array.isArray(rows) ? rows : rows.rows ?? []) own.set(Number(r.card_id), { pa: Number(r.pa), ip: Number(r.ip), woba: r.woba == null ? null : Number(r.woba), fip: r.fip == null ? null : Number(r.fip) });
  }

  const envLabel = `${YEAR ?? "PT default"} RE${pr ? ` @ ${PARK_YEAR} ${PARK}` : " (neutral)"}`;
  console.log(`=== cwhit ${DATE} vs app · ${envLabel} · value ${MIN}–${MAX} · K = ${OBS_K} ===`);
  console.log(`app runs: per 700 PA/BF above a league-average card on the blended board (${Math.round((1 - LHP) * 100)}/${Math.round(LHP * 100)} R/L). "model" is ratings only, "blend" is what the roster tools use.\n`);

  const section = (title: string, lines: Line[], pitcher: boolean) => {
    if (!lines.length) return;
    console.log(`--- ${title} ---`);
    const cw = pitcher ? "wOBAA  pwOBAA" : " wOBA   pwOBA";
    console.log(`${"name".padEnd(22)} val own  model  blend   ours(n)        cwhit(n)   ${cw}  cap`);
    const sortKey = (l: Line) => (l.card ? both(blend, l.card.cardId) ?? -99 : -99);
    for (const l of [...lines].sort((a, b) => sortKey(b) - sortKey(a))) {
      const c = l.card;
      const model = c ? both(base, c.cardId) : null, bl = c ? both(blend, c.cardId) : null;
      const o = c ? own.get(c.cardId) : undefined;
      const ours = o ? (pitcher ? `${f3(o.fip)} FIP ${String(Math.round(o.ip)).padStart(4)}ip` : `${f3(o.woba)} ${String(o.pa).padStart(5)}pa`) : "      —       ";
      const cwN = l.obs ? (pitcher ? `${String(Math.round(Number(l.obs.IP))).padStart(4)}ip` : `${String(l.obs.PA).padStart(5)}pa`) : "     —";
      const cwObs = l.obs ? f3(pitcher ? l.obs.wOBAA : l.obs.wOBA) : "  —  ";
      const cwProj = l.proj ? f3(pitcher ? l.proj.pwOBAA : l.proj.pwOBA) : "  —  ";
      const cap = l.proj?.CapValue ? l.proj.CapValue.padStart(5) : "    —";
      console.log(`${l.name.padEnd(22)} ${String(l.val).padStart(3)} ${c && owned.has(c.cardId) ? " y " : (c ? " n " : " ? ")} ${f1(model)}  ${f1(bl)}   ${ours}  ${cwN}    ${cwObs}   ${cwProj}  ${cap}`);
    }
    // Correlations: app blend vs cwhit observed, app blend vs cwhit projection,
    // app model (no observed) vs cwhit projection (the purest ratings-vs-ratings read).
    const pairs = (get: (l: Line) => number | null, key: (l: Line) => string | undefined, sign: number) => lines.flatMap((l): [number, number][] => {
      const a = get(l), b = Number(key(l)); return a == null || !key(l) || Number.isNaN(b) ? [] : [[a, sign * b]];
    });
    const obsKey = (l: Line) => (pitcher ? l.obs?.wOBAA : l.obs?.wOBA), projKey = (l: Line) => (pitcher ? l.proj?.pwOBAA : l.proj?.pwOBA);
    const sign = pitcher ? -1 : 1; // for arms a lower wOBA against is better
    const rB = (l: Line) => (l.card ? both(blend, l.card.cardId) : null), rM = (l: Line) => (l.card ? both(base, l.card.cardId) : null);
    const s1 = spearman(pairs(rB, obsKey, sign)), s2 = spearman(pairs(rB, projKey, sign)), s3 = spearman(pairs(rM, projKey, sign));
    const s4 = spearman(lines.flatMap((l): [number, number][] => { const a = Number(obsKey(l)), b = Number(projKey(l)); return obsKey(l) && projKey(l) ? [[a, b]] : []; }));
    console.log(`rank agreement (Spearman): app blend vs cwhit observed ${s1.rho.toFixed(2)} (n ${s1.n}) · app blend vs cwhit projection ${s2.rho.toFixed(2)} (n ${s2.n}) · app model vs cwhit projection ${s3.rho.toFixed(2)} (n ${s3.n}) · cwhit's own observed vs projection ${s4.rho.toFixed(2)} (n ${s4.n})\n`);
  };
  section("hitters", hitters, false);
  section("pitchers", pitchers, true);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
