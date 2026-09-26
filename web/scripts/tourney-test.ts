/**
 * A pre-registered test of the model on one tournament: write down what the
 * app predicts BEFORE a run, then grade it against that run alone.
 *
 *   pnpm tourney:test snapshot --tournament 9100186 [--types 1,6] [--min 40 --max 100]
 *   pnpm tourney:test grade --file "../reference/tourney-tests/2026-09-26 liveplus.json" \
 *        [--min-pa 100] [--min-bf 100] [--cwhit "../reference/cwhit/2026-09-27"]
 *
 * SNAPSHOT scores every card on the app's scale in the event's environment
 * (era, park, the field's handedness): the model from ratings alone and the
 * blend the roster tools use (observed play mixed in at K = 5,000). It also
 * records the series' observed counters as they stand. Commit the file, so the
 * prediction is on record before the games are played.
 *
 * GRADE reads the series again after the run's export has been filed (File OOTP
 * Exports imports it). The run's own lines are the difference between the two
 * readings, every card in the field and not only what fits on a screenshot.
 * Each side is then scored against that run:
 *   bats  runs above the run's field from wOBA (the 1.25 scale the app uses)
 *   arms  runs saved per 700 BF, from FIP and from runs allowed
 * with PA- or BF-weighted Pearson r, Spearman rho and n. With --cwhit
 * "<dir>/<date>", cwhit's transcribed projection boards ("<date> hitters
 * projected.csv", "<date> pitchers projected.csv", as for cwhit:compare) are
 * matched by name and value. They are graded on the same run, on the cards
 * both sides cover.
 *
 * A single run is ~3,000 PA across the field, so one card's line is a few
 * dozen PA: expect correlations well under the archive's 0.69 / 0.53 and read
 * the n. Grading after several runs (one snapshot, grade later) is fine: the
 * difference covers everything filed since the snapshot.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, seriesMeta, tournaments } from "@/db/schema";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { bothHands, loadObservedRuns, OBS_K_DEFAULT } from "@/lib/analytics/observed-blend";
import { eraFor, eraTable, parkFor } from "@/lib/analytics/tournament-env";
import { wobaOf, fipOf } from "@/lib/analytics/league";

const argv = process.argv.slice(2);
const cmd = argv[0];
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const num = (k: string, d: number) => { const v = val(k); return v == null ? d : Number(v); };
type Row = Record<string, unknown>;
const asRows = (r: unknown): Row[] => (Array.isArray(r) ? (r as Row[]) : ((r as { rows?: Row[] }).rows ?? []));
const n = (v: unknown) => (v == null ? 0 : Number(v));
const WOBA_SCALE = 1.25;

interface Prediction {
  cardId: number; name: string; val: number | null; type: number | null; isPitcher: boolean;
  /** Calibrated model runs per 700, read at the field's handedness. No observed play. */
  model: number | null;
  /** What the roster tools rank on: the model with observed play blended in (K = 5,000). */
  blend: number | null;
  /** Observed PA / BF behind the blend, across every series on record. */
  obsN: number;
}
interface Snapshot {
  takenAt: string;
  tournament: { id: number; name: string; series: string; envYear: number | null; stadium: string | null; min: number | null; max: number | null; types: number[] | null; lhp: number; lhb: number };
  before: Record<string, { pa: number; ip: number; counters: Record<string, number> }>;
  predictions: Prediction[];
}

const stint = (counters: Record<string, number>, ip: number, pa: number) => ({
  stats: counters, ip, pa, use: 0, isPitcher: false, isFreeAgent: false, org: "", cid: null, name: "", pos: "",
  clan: null, val: null, tier: null, isVariant: false, cardYear: null, ratings: {}, war: 0,
});

async function seriesLines(series: string) {
  return asRows(await db.execute(sql`
    select card_id, is_pitcher, pa, ip, counters from observed_card_stats where series = ${series}`));
}
const key = (cardId: unknown, isPitcher: unknown) => `${n(cardId)}${isPitcher ? "p" : "h"}`;
/** The counters grading reads: wOBA's for bats, FIP's and runs allowed for arms. Nothing else is stored. */
const KEEP = { h: ["BB", "IBB", "HP", "b1", "b2", "b3", "HR", "AB", "SF"], p: ["Ka", "BBa", "HPa", "HRa", "Ra", "BF"] } as const;
const keep = (counters: Record<string, number>, isPitcher: boolean) =>
  Object.fromEntries((isPitcher ? KEEP.p : KEEP.h).map((k) => [k, n(counters?.[k])]));
const r2 = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100);

async function snapshot() {
  const tid = num("tournament", NaN);
  if (!Number.isFinite(tid)) throw new Error("--tournament <catalogue id> is required");
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tid));
  if (!t) throw new Error(`no tournament ${tid}`);
  if (!t.series) throw new Error(`${t.name} has no series slug, so its exports cannot be found`);
  const rx = (t.restrictions ?? {}) as { notes?: string[]; cardTypes?: number[] };
  const envYear = t.envYear ?? (rx.notes?.includes("default RE") ? 2010 : null);
  const era = eraFor(envYear)?.row ?? eraTable["0"];
  const park = parkFor(t.stadium).row;
  const [m] = await db.select().from(seriesMeta).where(eq(seriesMeta.series, t.series));
  const lhp = m?.lhpBfShare ?? 0.3, lhb = m?.lhbPaShare ?? 0.35;
  const typesArg = val("types");
  const types = typesArg ? typesArg.split(",").map(Number) : rx.cardTypes ?? null;
  const min = val("min") != null ? num("min", 0) : t.ratingsMin, max = val("max") != null ? num("max", 999) : t.ratingsMax;

  const universe = await db.select({
    cardId: cards.cardId, name: cards.name, cardValue: cards.cardValue, cardType: cards.cardType, isPitcher: cards.isPitcher,
    bats: cards.bats, throws: cards.throws, pitcherRole: cards.pitcherRole, ratings: cards.ratings,
  }).from(cards);
  const lines = await seriesLines(t.series);
  const played = new Set(lines.map((l) => n(l.card_id)));
  const legal = (c: (typeof universe)[number]) =>
    (min == null || (c.cardValue ?? 0) >= min) && (max == null || (c.cardValue ?? 0) <= max) && (!types || types.includes(c.cardType ?? -1));
  const pool = universe.filter((c) => legal(c) || played.has(c.cardId));

  const input = universe.map((c) => ({ cardId: c.cardId, isPitcher: c.isPitcher ?? false, bats: c.bats, role: c.pitcherRole, ratings: (c.ratings ?? {}) as Record<string, number> }));
  const opts = { era: era.rates, park, roleTrust: 0.25, leagueLhbShare: lhb, eraYear: envYear ?? 2010 };
  const model = envFitMaps(input, opts);
  const both = (id: number) => { const r = model.runsR.get(id), l = model.runsL.get(id); return r == null || l == null ? null : (1 - lhp) * r + lhp * l; };
  const observed = await loadObservedRuns(pool.map((c) => c.cardId), both, bothHands(model));
  const blended = envFitMaps(input.filter((c) => observed.has(c.cardId)), { ...opts, observed, observedK: OBS_K_DEFAULT });

  const predictions: Prediction[] = pool.map((c) => {
    const id = c.cardId, ob = observed.get(id);
    const bR = blended.runsR.get(id), bL = blended.runsL.get(id);
    return {
      cardId: id, name: c.name, val: c.cardValue, type: c.cardType, isPitcher: c.isPitcher ?? false,
      model: r2(both(id)),
      blend: r2(bR != null && bL != null ? (1 - lhp) * bR + lhp * bL : both(id)),
      obsN: Math.round(ob?.n ?? 0),
    };
  });
  const snap: Snapshot = {
    takenAt: new Date().toISOString(),
    tournament: { id: t.id, name: t.name, series: t.series, envYear, stadium: t.stadium, min, max, types, lhp, lhb },
    before: Object.fromEntries(lines.map((l) => [key(l.card_id, l.is_pitcher), { pa: n(l.pa), ip: n(l.ip), counters: keep((l.counters ?? {}) as Record<string, number>, !!l.is_pitcher) }])),
    predictions,
  };
  const out = val("out") ?? join("..", "reference", "tourney-tests", `${snap.takenAt.slice(0, 10)} ${t.series}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(snap));
  const f1 = (v: number | null) => (v == null ? "  —  " : `${v >= 0 ? "+" : ""}${v.toFixed(1)}`);
  const board = (p: boolean, k: number) => predictions.filter((x) => x.isPitcher === p && x.blend != null).sort((a, b) => b.blend! - a.blend!).slice(0, k);
  const csv = ["name,val,type,side,model,blend,obs_n", ...[...board(false, 150), ...board(true, 100)]
    .map((x) => [JSON.stringify(x.name), x.val, x.type, x.isPitcher ? "arm" : "bat", x.model?.toFixed(2) ?? "", x.blend?.toFixed(2) ?? "", x.obsN].join(","))];
  writeFileSync(out.replace(/\.json$/, " predictions.csv"), csv.join("\n") + "\n");
  console.log(`${t.name} · ${envYear ?? "default"} RE · ${t.stadium ?? "no park"} · VAL ${min ?? "—"}-${max ?? "—"}${types ? ` · types ${types.join(",")}` : ""} · field LHP ${(lhp * 100).toFixed(0)}%`);
  const unseen = pool.filter((c) => !played.has(c.cardId)).length;
  console.log(`${predictions.length} cards scored: ${played.size} with play in this series, ${unseen} legal and not yet seen here. Series counters recorded for ${lines.length} lines.`);
  for (const p of [false, true]) {
    console.log(`\ntop ${p ? "arms" : "bats"} by blend (runs/700, model in brackets):`);
    for (const x of board(p, 15)) console.log(`  ${f1(x.blend).padStart(6)} (${f1(x.model)})  ${x.name} ${x.val}${x.obsN ? ` · ${x.obsN.toLocaleString()} obs` : ""}`);
  }
  console.log(`\nwrote ${out}\nand   ${out.replace(/\.json$/, " predictions.csv")}\nCommit both before the run. After the export is filed: pnpm tourney:test grade --file "${out}"`);
}

/* -------------------------------------------------------------- grading */
function wstats(pairs: { x: number; y: number; w: number }[]) {
  const W = pairs.reduce((s, p) => s + p.w, 0);
  if (pairs.length < 3 || !(W > 0)) return { r: NaN, slope: NaN, rho: NaN, n: pairs.length };
  const mx = pairs.reduce((s, p) => s + p.w * p.x, 0) / W, my = pairs.reduce((s, p) => s + p.w * p.y, 0) / W;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of pairs) { sxx += p.w * (p.x - mx) ** 2; syy += p.w * (p.y - my) ** 2; sxy += p.w * (p.x - mx) * (p.y - my); }
  const rank = (v: number[]) => { const o = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]); const r = new Array(v.length); o.forEach(([, i], k) => { r[i] = k; }); return r as number[]; };
  const a = rank(pairs.map((p) => p.x)), b = rank(pairs.map((p) => p.y)), k = pairs.length;
  const rho = 1 - (6 * a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0)) / (k * (k * k - 1));
  return { r: sxy / Math.sqrt(sxx * syy), slope: sxy / sxx, rho, n: k };
}

type CRow = Record<string, string>;
function readCsv(p: string): CRow[] {
  if (!existsSync(p)) return [];
  const [head, ...rows] = readFileSync(p, "utf8").split(/\r?\n/).filter((l) => l.trim());
  const cols = head.split(",").map((c) => c.trim());
  return rows.map((l) => {
    const cells: string[] = []; let cur = "", q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { cells.push(cur); cur = ""; } else cur += ch; }
    cells.push(cur);
    return Object.fromEntries(cols.map((c, i) => [c, (cells[i] ?? "").trim()]));
  });
}
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

async function grade() {
  const file = val("file");
  if (!file || !existsSync(file)) throw new Error("--file <snapshot.json> is required");
  const snap = JSON.parse(readFileSync(file, "utf8")) as Snapshot;
  const MIN_PA = num("min-pa", 100), MIN_BF = num("min-bf", 100);
  const now = await seriesLines(snap.tournament.series);

  // The run(s) since the snapshot: counters now minus counters then, per card and side.
  const runs = new Map<string, { cardId: number; isPitcher: boolean; pa: number; ip: number; c: Record<string, number> }>();
  for (const l of now) {
    const k = key(l.card_id, l.is_pitcher), before = snap.before[k];
    const c: Record<string, number> = {};
    for (const kk of l.is_pitcher ? KEEP.p : KEEP.h) c[kk] = n(((l.counters ?? {}) as Record<string, number>)[kk]) - n(before?.counters?.[kk]);
    const pa = n(l.pa) - n(before?.pa), ip = n(l.ip) - n(before?.ip);
    if (pa < 0 || ip < -1e-6 || Object.values(c).some((v) => v < 0)) continue; // a replaced file: not a clean difference
    if (pa === 0 && !(c.BF > 0)) continue;
    runs.set(k, { cardId: n(l.card_id), isPitcher: !!l.is_pitcher, pa, ip, c });
  }
  const hit = [...runs.values()].filter((r) => !r.isPitcher && r.pa > 0);
  const arm = [...runs.values()].filter((r) => r.isPitcher && r.c.BF > 0);
  if (!hit.length && !arm.length) { console.log("No new play in this series since the snapshot. File the run's export first."); process.exit(0); }
  const sum = (rows: typeof hit, k: string) => rows.reduce((s, r) => s + n(r.c[k]), 0);
  const fieldH: Record<string, number> = {}, fieldP: Record<string, number> = {};
  for (const k of ["BB", "IBB", "HP", "b1", "b2", "b3", "HR", "AB", "SF"]) fieldH[k] = sum(hit, k);
  for (const k of ["Ka", "BBa", "HPa", "HRa", "Ra", "BF"]) fieldP[k] = sum(arm, k);
  const fieldPa = hit.reduce((s, r) => s + r.pa, 0), fieldIp = arm.reduce((s, r) => s + r.ip, 0);
  const wobaField = wobaOf([stint(fieldH, 0, fieldPa) as never]);
  const fipField = fipOf([stint(fieldP, fieldIp, 0) as never]);
  const raField = fieldP.Ra / fieldP.BF;
  console.log(`${snap.tournament.name} (${snap.tournament.series}) · snapshot ${snap.takenAt.slice(0, 16).replace("T", " ")} UTC`);
  console.log(`new play since: ${fieldPa.toLocaleString()} PA over ${hit.length} bats (field wOBA ${wobaField.toFixed(3)}), ${Math.round(fieldP.BF).toLocaleString()} BF over ${arm.length} arms (FIP ${fipField.toFixed(2)}, RA/9 ${(fieldP.Ra / fieldIp * 9).toFixed(2)})`);

  const pred = new Map(snap.predictions.map((p) => [key(p.cardId, p.isPitcher), p]));
  const obsHit = hit.filter((r) => r.pa >= MIN_PA).map((r) => {
    const w = wobaOf([stint(r.c, 0, r.pa) as never]);
    return { r, y: ((w - wobaField) / WOBA_SCALE) * 700, w: r.pa, p: pred.get(key(r.cardId, false)) };
  }).filter((x) => x.p);
  const obsArm = arm.filter((r) => r.c.BF >= MIN_BF).map((r) => {
    const fip = fipOf([stint(r.c, r.ip, 0) as never]);
    return {
      r, w: r.c.BF, p: pred.get(key(r.cardId, true)),
      yFip: r.ip > 0 ? (-((fip - fipField) / 9) * r.ip / r.c.BF) * 700 : NaN,
      yRa: -(r.c.Ra / r.c.BF - raField) * 700,
    };
  }).filter((x) => x.p);

  // cwhit's projections, matched by name (and value when given).
  const cw = val("cwhit");
  const cwHit = new Map<string, number>(), cwArm = new Map<string, number>();
  if (cw) {
    // Keyed by name + value, and by name alone as a fallback when the value was not transcribed.
    const put = (m: Map<string, number>, r: CRow, v: number) => { m.set(`${norm(r.Name)}|${r.VAL ?? ""}`, v); if (!m.has(`${norm(r.Name)}|`)) m.set(`${norm(r.Name)}|`, v); };
    for (const r of readCsv(`${cw} hitters projected.csv`)) if (r.pwOBA) put(cwHit, r, Number(r.pwOBA));
    for (const r of readCsv(`${cw} pitchers projected.csv`)) if (r.pwOBAA) put(cwArm, r, -Number(r.pwOBAA));
    console.log(`cwhit projections read from ${cw} …projected.csv`);
  }
  const cwOf = (m: Map<string, number>, p: Prediction) => m.get(`${norm(p.name)}|${p.val ?? ""}`) ?? m.get(`${norm(p.name)}|`) ?? null;

  const fmt = (s: ReturnType<typeof wstats>) => Number.isNaN(s.r) ? "   —" : `r ${s.r.toFixed(3)}  rho ${s.rho.toFixed(3)}  slope ${s.slope.toFixed(2)}  n ${s.n}`;
  const report: string[] = [];
  const line = (label: string, s: ReturnType<typeof wstats>) => { const t = `  ${label.padEnd(34)} ${fmt(s)}`; console.log(t); report.push(t); };
  const section = (title: string) => { console.log(`\n${title}`); report.push("", title); };

  section(`BATS — runs above the run's field from wOBA, ${obsHit.length} cards with ${MIN_PA}+ PA`);
  line("app model (ratings only)", wstats(obsHit.filter((x) => x.p!.model != null).map((x) => ({ x: x.p!.model!, y: x.y, w: x.w }))));
  line("app blend (what /build ranks on)", wstats(obsHit.filter((x) => x.p!.blend != null).map((x) => ({ x: x.p!.blend!, y: x.y, w: x.w }))));
  if (cwHit.size) {
    const both = obsHit.filter((x) => x.p!.blend != null && cwOf(cwHit, x.p!) != null);
    line("  on cards cwhit projects: app blend", wstats(both.map((x) => ({ x: x.p!.blend!, y: x.y, w: x.w }))));
    line("  on cards cwhit projects: app model", wstats(both.map((x) => ({ x: x.p!.model!, y: x.y, w: x.w }))));
    line("  on cards cwhit projects: cwhit pwOBA", wstats(both.map((x) => ({ x: cwOf(cwHit, x.p!)!, y: x.y, w: x.w }))));
  }
  for (const [tgt, label] of [["yFip", "FIP"], ["yRa", "runs allowed"]] as const) {
    const rows = obsArm.filter((x) => Number.isFinite(x[tgt]));
    section(`ARMS — runs saved per 700 BF from ${label}, ${rows.length} arms with ${MIN_BF}+ BF`);
    line("app model (ratings only)", wstats(rows.filter((x) => x.p!.model != null).map((x) => ({ x: x.p!.model!, y: x[tgt], w: x.w }))));
    line("app blend (what /build ranks on)", wstats(rows.filter((x) => x.p!.blend != null).map((x) => ({ x: x.p!.blend!, y: x[tgt], w: x.w }))));
    if (cwArm.size) {
      const both = rows.filter((x) => x.p!.blend != null && cwOf(cwArm, x.p!) != null);
      line("  on cards cwhit projects: app blend", wstats(both.map((x) => ({ x: x.p!.blend!, y: x[tgt], w: x.w }))));
      line("  on cards cwhit projects: cwhit -pwOBAA", wstats(both.map((x) => ({ x: cwOf(cwArm, x.p!)!, y: x[tgt], w: x.w }))));
    }
  }
  const out = file.replace(/\.json$/, ` graded ${new Date().toISOString().slice(0, 10)}.txt`);
  writeFileSync(out, [`${snap.tournament.name} (${snap.tournament.series}), snapshot ${snap.takenAt}`, `new play: ${fieldPa} PA, ${Math.round(fieldP.BF)} BF`, ...report].join("\n") + "\n");
  console.log(`\nwrote ${out}`);
}

(cmd === "snapshot" ? snapshot() : cmd === "grade" ? grade() : Promise.reject(new Error("usage: tourney-test snapshot|grade …")))
  .then(() => process.exit(0))
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
