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
import { candidateHitter, loadHitterUniverse, normName, resolveRoster } from "@/lib/league-hitters";
import { leagueFamily, LEAGUE_MODEL } from "@/lib/analytics/league-model";
import { leagueLineups, type Lineup } from "@/lib/analytics/league-lineup";

const argv = process.argv.slice(2);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const all = (k: string) => argv.flatMap((a, i) => (a === `--${k}` ? [argv[i + 1]] : []));
const ROSTER = (val("roster") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const ADDS = all("add");
const FAMILY = leagueFamily(val("league", "PEL")!);
const YEAR = Number(val("year", "2010"));
const DEF_SCALE = Number(val("def-scale", "1"));
const DH = !argv.includes("--no-dh");
const f1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

async function main() {
  if (!ROSTER.length) throw new Error('--roster "Name,Name,…" is required');
  const u = await loadHitterUniverse();
  const { hitters, warnings: warn } = resolveRoster(ROSTER, u);
  const rosterIds = hitters.map((h) => h.id);
  const candidates = ADDS.map((spec) => {
    const m = /^([^#=]+?)(?:#(\d+))?(?:=(.*))?$/.exec(spec.trim());
    if (!m) throw new Error(`bad --add "${spec}"`);
    const [, label, cid, over] = m;
    const baseName = label.replace(/\s+VAR$/i, "");
    const c = cid ? u.shopById.get(Number(cid)) : u.shop.filter((s) => !s.isPitcher && normName(s.name) === normName(baseName)).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
    if (!c) throw new Error(`no card for --add "${spec}"`);
    const exported: Record<string, number> = {};
    for (const part of (over ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
      const i = part.lastIndexOf(":");
      exported[part.slice(0, i).trim()] = Number(part.slice(i + 1));
    }
    const h = candidateHitter(hitters.length, label, c, exported);
    hitters.push(h);
    return h;
  });

  const m = leagueLineups(hitters, { family: FAMILY, year: YEAR, defScale: DEF_SCALE, dh: DH });
  warn.push(...m.warnings);

  console.log(`League model (${LEAGUE_MODEL.fittedAt}, ${LEAGUE_MODEL.source}).`);
  console.log(`${FAMILY} · run environment ${YEAR === 2010 ? "PT default (2010)" : YEAR} · rating prices ${Object.entries(m.prices).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(" ")} · vs-LHP share ${(m.lhp * 100).toFixed(0)}% · R/G ${m.rg.toFixed(2)}, ${m.rpw.toFixed(1)} runs per win · gloves ×${DEF_SCALE}`);
  for (const w of warn) console.log(`  !! ${w}`);
  console.log(`\nbats on the league model (runs per 700 PA above the league's average bat on that board):`);
  for (const h of hitters) {
    const r = m.runs.get(h.id)!;
    console.log(`  ${h.label.padEnd(28)} vs RHP ${r.vR == null ? "  —  " : f1(r.vR).padStart(6)}   vs LHP ${r.vL == null ? "  —  " : f1(r.vL).padStart(6)}${rosterIds.includes(h.id) ? "" : "   (candidate)"}`);
  }
  const show = (label: string, s: Lineup | null) => {
    if (!s) { console.log(`  ${label}: no legal lineup`); return; }
    console.log(`  ${label.padEnd(16)} ${f1(s.total).padStart(7)}  ${s.lineup.map((x) => `${x.slot} ${x.label.replace(/ \d+( VAR)?$/, "$1")}`).join(" · ")}`);
  };
  const base = { vR: m.solve(rosterIds, "vR"), vL: m.solve(rosterIds, "vL") };
  console.log(`\nbest lineups now:`);
  show("vs RHP", base.vR); show("vs LHP", base.vL);
  const summary: string[] = [];
  for (const c of candidates) {
    const a = m.add(rosterIds, c.id, base);
    console.log(`\nwith ${c.label} (${c.note}):`);
    show("vs RHP", a.vR); show("vs LHP", a.vL);
    summary.push(`  ${c.label.padEnd(28)} vs RHP ${f1(a.dR).padStart(6)}   vs LHP ${f1(a.dL).padStart(6)}   season ${f1(a.season).padStart(6)} runs = ${f1(a.wins)} W   (DH only, nothing else moves: ${f1(a.dhOnly)})`);
  }
  if (summary.length) {
    console.log(`\nwhat each candidate adds (best lineup with him minus best lineup without; boards weighted ${Math.round((1 - m.lhp) * 100)}/${Math.round(m.lhp * 100)}):`);
    for (const s of summary) console.log(s);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
