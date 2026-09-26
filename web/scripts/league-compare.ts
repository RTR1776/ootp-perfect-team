/**
 * What a card adds to YOUR league lineups, on the league model.
 *
 *   pnpm league:compare --roster "Leodalis De Vries,Heinie Manush,…" \
 *     --add "Jose Canseco#86912" \
 *     --add "Kevin Mitchell VAR#86911=K vL:139,BA vL:97,GAP vL:141,POW vL:250,EYE vL:212,K vR:98,BA vR:125,GAP vR:150,POW vR:190,EYE vR:172" \
 *     [--league PEL] [--year 2010] [--def-scale 1] [--no-dh]
 *
 * --roster: the hitters on the team, by name. Each resolves to the copy in
 *   the newest collection upload: the highest value, and the variant when both
 *   are owned. A name not owned falls back to the shop's best card of that
 *   name, with a warning.
 * --add: a candidate. "Name[#card id][=overrides]". Overrides are split
 *   ratings in the collection export's words (K vL, BA vL, GAP vL, POW vL,
 *   EYE vL, the vR five, DEF), for a variant known only from its card face.
 *   Each candidate is scored alone against the roster.
 * --year: the week's run environment. 2010 is the PT default; pass a theme's
 *   year (1989, 1959) when the game has announced one. The league model prices
 *   each rating for it.
 *
 * Per board, the best nine are solved exactly (Hungarian): bat on the league
 * model plus glove at the slot (fielding.ts runs × --def-scale), under L.J.'s
 * position floor, DH unconditional. A candidate's worth is the best lineup
 * with him minus the best lineup without him: the bench move and any
 * reshuffle are inside it. The boards are weighted by the league's measured
 * share of PA against LHP. Runs are per 700 PA per lineup slot, about a
 * season. Wins use runs per win = 1.5 × R/G + 3.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, collectionCards, uploads } from "@/db/schema";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { eraFor, eraTable } from "@/lib/analytics/tournament-env";
import { solveEnv } from "@/lib/analytics/run-env";
import { fieldingRuns } from "@/lib/analytics/fielding";
import { formRatings } from "@/lib/card-forms";
import { maxAssignment } from "@/lib/assign";
import { LJ_FLOOR, posFloorAt } from "@/lib/pos-floor";
import {
  boardRatings, envPrices, leagueFamily, leagueHitRuns, leagueLhpShare, outsideFit, LEAGUE_MODEL, type Board,
} from "@/lib/analytics/league-model";

const argv = process.argv.slice(2);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const all = (k: string) => argv.flatMap((a, i) => (a === `--${k}` ? [argv[i + 1]] : []));
const ROSTER = (val("roster") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const ADDS = all("add");
const FAMILY = leagueFamily(val("league", "PEL")!);
const YEAR = Number(val("year", "2010"));
const DEF_SCALE = Number(val("def-scale", "1"));
const DH = !argv.includes("--no-dh");
const SLOTS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", ...(DH ? ["DH"] : [])];
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
const f1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

interface Hitter { id: number; label: string; cardId: number; bats: string | null; ratings: Record<string, number>; note?: string }

async function main() {
  if (!ROSTER.length) throw new Error('--roster "Name,Name,…" is required');
  const era = eraFor(YEAR)?.row ?? eraTable["0"];
  const prices = envPrices(era.rates);
  const rg = solveEnv(era.rates, era.rg, null).RG;
  const rpw = 1.5 * rg + 3;
  const lhp = leagueLhpShare(FAMILY);

  const [latest] = await db.select({ id: uploads.id, at: uploads.uploadedAt }).from(uploads).where(eq(uploads.kind, "collection")).orderBy(desc(uploads.id)).limit(1);
  const owned = latest ? await db.select().from(collectionCards).where(eq(collectionCards.uploadId, latest.id)) : [];
  const shop = await db.select({ cardId: cards.cardId, name: cards.name, title: cards.title, value: cards.cardValue, pos: cards.position, isPitcher: cards.isPitcher, bats: cards.bats, ratings: cards.ratings }).from(cards);
  const shopById = new Map(shop.map((c) => [c.cardId, c]));

  const hitters: Hitter[] = [];
  const warn: string[] = [];
  for (const name of ROSTER) {
    const mine = owned.filter((o) => o.cardId != null && norm(o.name ?? "") === norm(name) && !shopById.get(o.cardId!)?.isPitcher)
      .sort((a, b) => (b.cardValue ?? 0) - (a.cardValue ?? 0) || Number(b.isVariant) - Number(a.isVariant));
    const pick = mine[0];
    if (pick) {
      const base = shopById.get(pick.cardId!)!;
      hitters.push({ id: hitters.length, label: `${base.name} ${base.value}${pick.isVariant ? " VAR" : ""}`, cardId: base.cardId, bats: base.bats,
        ratings: formRatings((base.ratings ?? {}) as Record<string, number>, (pick.ratings ?? null) as Record<string, number> | null, pick.pos ?? base.pos) });
    } else {
      const c = shop.filter((s) => !s.isPitcher && norm(s.name) === norm(name)).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
      if (!c) throw new Error(`no hitter named ${name}`);
      warn.push(`${name}: not in the collection uploaded ${latest?.at.toISOString().slice(0, 10) ?? "—"}; using the shop's ${c.title}`);
      hitters.push({ id: hitters.length, label: `${c.name} ${c.value}`, cardId: c.cardId, bats: c.bats, ratings: (c.ratings ?? {}) as Record<string, number> });
    }
  }
  const rosterIds = hitters.map((h) => h.id);
  const candidates: Hitter[] = ADDS.map((spec) => {
    const m = /^([^#=]+?)(?:#(\d+))?(?:=(.*))?$/.exec(spec.trim());
    if (!m) throw new Error(`bad --add "${spec}"`);
    const [, label, cid, over] = m;
    const baseName = label.replace(/\s+VAR$/i, "");
    const c = cid ? shopById.get(Number(cid)) : shop.filter((s) => !s.isPitcher && norm(s.name) === norm(baseName)).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
    if (!c) throw new Error(`no card for --add "${spec}"`);
    const exported: Record<string, number> = {};
    for (const part of (over ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
      const i = part.lastIndexOf(":");
      exported[part.slice(0, i).trim()] = Number(part.slice(i + 1));
    }
    const ratings = Object.keys(exported).length ? formRatings((c.ratings ?? {}) as Record<string, number>, exported, c.pos) : (c.ratings ?? {}) as Record<string, number>;
    const h: Hitter = { id: hitters.length, label: `${label.trim()} ${c.value}`, cardId: c.cardId, bats: c.bats, ratings, note: c.title };
    hitters.push(h);
    return h;
  });

  const fits = envFitMaps(hitters.map((h) => ({ cardId: h.id, isPitcher: false, bats: h.bats, ratings: h.ratings })),
    { era: era.rates, park: null, roleTrust: 0.25, eraYear: YEAR });
  const runs = new Map<number, Record<Board, number | null>>();
  for (const h of hitters) {
    const out: Record<Board, number | null> = { vL: null, vR: null };
    for (const b of ["vL", "vR"] as Board[]) {
      const br = boardRatings(h.ratings, b);
      const app = (b === "vL" ? fits.runsL : fits.runsR).get(h.id);
      if (!br || app == null) continue;
      out[b] = leagueHitRuns(app, br, FAMILY, b, prices);
      const off = outsideFit(br);
      if (off.length) warn.push(`${h.label} ${b}: ${off.join(", ")} is outside the league fit (extrapolated)`);
    }
    runs.set(h.id, out);
  }

  const cell = (h: Hitter, slot: string, b: Board): number => {
    const bat = runs.get(h.id)?.[b];
    if (bat == null) return -Infinity;
    if (slot === "DH") return bat;
    const pr = h.ratings[`Pos Rating ${slot}`] ?? 0;
    if (!(pr > 0) || pr < posFloorAt(LJ_FLOOR, slot)) return -Infinity;
    return bat + DEF_SCALE * fieldingRuns(slot, pr);
  };
  const solve = (ids: number[], b: Board) => {
    const pool = ids.map((i) => hitters[i]);
    const pick = maxAssignment(SLOTS.map((s) => pool.map((h) => cell(h, s, b))));
    if (!pick) return null;
    const lineup = SLOTS.map((s, i) => ({ slot: s, h: pool[pick[i]], v: cell(pool[pick[i]], s, b) }));
    return { lineup, total: lineup.reduce((a, x) => a + x.v, 0) };
  };

  console.log(`League model (${LEAGUE_MODEL.fittedAt}, ${LEAGUE_MODEL.source}).`);
  console.log(`${FAMILY} · run environment ${YEAR === 2010 ? "PT default (2010)" : YEAR} · rating prices ${Object.entries(prices).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(" ")} · vs-LHP share ${(lhp * 100).toFixed(0)}% · R/G ${rg.toFixed(2)}, ${rpw.toFixed(1)} runs per win · gloves ×${DEF_SCALE}`);
  for (const w of warn) console.log(`  !! ${w}`);
  console.log(`\nbats on the league model (runs per 700 PA above the league's average bat on that board):`);
  for (const h of hitters) {
    const r = runs.get(h.id)!;
    console.log(`  ${h.label.padEnd(28)} vs RHP ${r.vR == null ? "  —  " : f1(r.vR).padStart(6)}   vs LHP ${r.vL == null ? "  —  " : f1(r.vL).padStart(6)}${rosterIds.includes(h.id) ? "" : "   (candidate)"}`);
  }
  const show = (label: string, s: ReturnType<typeof solve>) => {
    if (!s) { console.log(`  ${label}: no legal lineup`); return; }
    console.log(`  ${label.padEnd(16)} ${f1(s.total).padStart(7)}  ${s.lineup.map((x) => `${x.slot} ${x.h.label.replace(/ \d+( VAR)?$/, "$1")}`).join(" · ")}`);
  };
  const base: Record<Board, ReturnType<typeof solve>> = { vR: solve(rosterIds, "vR"), vL: solve(rosterIds, "vL") };
  console.log(`\nbest lineups now:`);
  show("vs RHP", base.vR); show("vs LHP", base.vL);
  const summary: string[] = [];
  for (const c of candidates) {
    const withC: Record<Board, ReturnType<typeof solve>> = { vR: solve([...rosterIds, c.id], "vR"), vL: solve([...rosterIds, c.id], "vL") };
    console.log(`\nwith ${c.label} (${c.note}):`);
    show("vs RHP", withC.vR); show("vs LHP", withC.vL);
    const dR = (withC.vR?.total ?? 0) - (base.vR?.total ?? 0), dL = (withC.vL?.total ?? 0) - (base.vL?.total ?? 0);
    const season = (1 - lhp) * dR + lhp * dL;
    // DH only: the candidate straight into the DH slot, nothing else moves
    const dhOnly = (b: Board) => {
      const cur = base[b]?.lineup.find((x) => x.slot === "DH");
      const v = runs.get(c.id)?.[b];
      return cur && v != null ? Math.max(0, v - cur.v) : 0;
    };
    const seasonDh = (1 - lhp) * dhOnly("vR") + lhp * dhOnly("vL");
    summary.push(`  ${c.label.padEnd(28)} vs RHP ${f1(dR).padStart(6)}   vs LHP ${f1(dL).padStart(6)}   season ${f1(season).padStart(6)} runs = ${f1(season / rpw)} W   (DH only, nothing else moves: ${f1(seasonDh)})`);
  }
  if (summary.length) {
    console.log(`\nwhat each candidate adds (best lineup with him minus best lineup without; boards weighted ${Math.round((1 - lhp) * 100)}/${Math.round(lhp * 100)}):`);
    for (const s of summary) console.log(s);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
