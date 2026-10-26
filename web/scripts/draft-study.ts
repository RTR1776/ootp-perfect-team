/**
 * What the Perfect Draft exports say, for the live draft helper (/draft/live).
 *
 *   pnpm draft:study                                   both Laptophound events
 *   pnpm draft:study --series 5ldeadball --since 222   one series, from run 222
 *   pnpm draft:study --dir "../Archive/Completed" --dry
 *   pnpm draft:study --through 2026-10-25   the last day the exports cover (default yesterday)
 *
 * Reads the series' current-format exports (<series>_<run>.csv, run >= --since)
 * and, per series:
 * - the field as the importer measures it (field-construction, series_meta):
 *   left-handed share of batters faced and of plate appearances, a starter's
 *   and a reliever's batters faced over a lineup slot's PA, staff per team;
 * - the round structure: what every full team drafted, by tier and listed
 *   position (the format check behind lib/draft/formats.ts);
 * - how often the field drafted each card (the page's "field" column), and
 *   which cards anyone drafted at all: the pool rotates, and a strong card
 *   nobody took lately is treated as out of it (engine.ts Engine.absent);
 * - every team scored by the helper's engine (lib/draft/engine teamPlan) in
 *   the event's environment, against its record: the model check;
 * - L.J.'s teams.
 * Then it writes src/data/draft-study.json (commit it with Push to GitHub).
 * Nothing here changes the database. --dry prints without writing.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseLeagueExport, type LeagueStint } from "@/lib/ingest/league";
import { staffPerTeam, summariseSeries, teamBuilds, type TeamBuild } from "@/lib/field-construction";
import { isMyOrg } from "@/lib/my-team";
import { loadDraft } from "@/lib/draft/load";
import { makeEngine, teamPlan, type Engine } from "@/lib/draft/engine";
import { DRAFT_FORMATS, type DraftFormat } from "@/lib/draft/formats";
import { DRAFT_STUDY, type DraftStudy, type StudySeries, type StudyTeam } from "@/lib/draft/study";

const argv = process.argv.slice(2);
const val = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const DIR = path.resolve(val("dir") ?? "../Archive/Completed");
const DRY = argv.includes("--dry");
/** First run on file in each series' current format (Docs/Draft Helper 2026-10-26.md). */
const CURRENT_SINCE: Record<string, number> = { "5ldeadball": 219, "6lpowerplay": 222 };
const OUT = path.resolve("src/data/draft-study.json");
/** The last day the exports speak for: cards first listed after it can't be in them. Default yesterday (Chicago). */
const THROUGH = val("through") ?? new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

const r1 = (x: number) => Math.round(x * 10) / 10;
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
function pearson(x: number[], y: number[]): number {
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}

interface Team {
  file: string;
  org: string;
  build: TeamBuild;
  ids: number[];
  runsFor: number;
  runsAgainst: number;
}

function readRun(file: string): { stints: LeagueStint[]; teams: Team[] } {
  const text = readFileSync(path.join(DIR, file), "utf8");
  const { stints } = parseLeagueExport(text, file);
  const builds = new Map(teamBuilds(stints).map((t) => [t.org, t]));
  const byOrg = new Map<string, LeagueStint[]>();
  for (const s of stints) {
    if (s.isFreeAgent || !s.org) continue;
    const list = byOrg.get(s.org) ?? [];
    list.push(s);
    byOrg.set(s.org, list);
  }
  const teams: Team[] = [];
  for (const [org, rows] of byOrg) {
    const build = builds.get(org);
    if (!build) continue;
    teams.push({
      file, org, build,
      ids: [...new Set(rows.map((s) => s.cid).filter((c): c is number => c != null))],
      runsFor: rows.filter((s) => !s.isPitcher).reduce((a, s) => a + (s.stats.R ?? 0), 0),
      runsAgainst: rows.filter((s) => s.isPitcher).reduce((a, s) => a + (s.stats.Ra ?? 0), 0),
    });
  }
  return { stints, teams };
}

/** Left-handed share of batters faced, and of plate appearances (a switch hitter at 0.7, his share against right-handers). */
function hands(stints: readonly LeagueStint[]): { lhp: number | null; lhb: number | null } {
  let bfL = 0, bf = 0, paL = 0, pa = 0;
  for (const s of stints) {
    if (s.isFreeAgent) continue;
    if (s.isPitcher) { const b = s.stats.BF ?? 0; bf += b; if (s.throws === "L") bfL += b; }
    else { pa += s.pa; paL += s.pa * (s.bats === "L" ? 1 : s.bats === "S" ? 0.7 : 0); }
  }
  return { lhp: bf > 0 ? r3(bfL / bf) : null, lhb: pa > 0 ? r3(paL / pa) : null };
}

function composition(f: DraftFormat, E: Engine, full: Team[], notes: string[]): void {
  const counts = new Map<string, number[]>();
  for (const t of full) {
    const c = new Map<string, number>();
    for (const id of t.ids) {
      const i = E.byId.get(id);
      if (i == null) continue;
      const card = E.cards[i];
      const key = `${card.tier} ${card.group}`;
      c.set(key, (c.get(key) ?? 0) + 1);
      c.set(card.tier, (c.get(card.tier) ?? 0) + 1);
    }
    for (const [k, n] of c) { const list = counts.get(k) ?? []; list.push(n); counts.set(k, list); }
  }
  // Each round kind against the teams: how many full teams drafted exactly its count.
  for (const r of f.rounds) {
    const per = full.map((t) => t.ids.filter((id) => {
      const i = E.byId.get(id);
      return i != null && E.cards[i].tier === r.tier && r.groups.includes(E.cards[i].group);
    }).length);
    const exact = per.filter((n) => n === r.count).length;
    notes.push(`${r.label} (${r.pack}, ${r.count}): ${exact} of ${full.length} full teams drafted exactly ${r.count} (range ${Math.min(...per)}-${Math.max(...per)}).`);
  }
  // Pack size from the most-drafted card at each position-locked round: P(offered) ≈ count × N / pool.
  for (const r of f.rounds.filter((x) => x.pack === "fixed")) {
    const pool = E.cards.filter((c, i) => c.tier === r.tier && r.groups.includes(c.group) && !E.absent[i]);
    const freq = new Map<number, number>();
    for (const t of full) for (const id of t.ids) {
      const i = E.byId.get(id);
      if (i != null && pool.includes(E.cards[i])) freq.set(id, (freq.get(id) ?? 0) + 1);
    }
    const top = Math.max(0, ...freq.values()) / Math.max(1, full.length);
    const legal = E.cards.filter((c) => c.tier === r.tier && r.groups.includes(c.group)).length;
    notes.push(`${r.label}: ${pool.length} cards in the pool (${legal} legal), ${freq.size} drafted by full teams, the most-drafted on ${(top * 100).toFixed(1)}% of them → packs of at least ~${(top * pool.length / r.count).toFixed(1)}.`);
  }
}

/**
 * Card by card: the model's runs against what each card did in these events,
 * pooled over the files. Bats: wRAA per 700 PA against the both-hands read;
 * arms: runs allowed per 700 batters under the field's rate against runs saved.
 * Weighted by playing time; slope 1 means the scale matches play.
 */
function cardCheck(E: Engine, lhp: number, stints: readonly LeagueStint[]): { bats: { n: number; r: number; slope: number }; arms: { n: number; r: number; slope: number } } {
  const bat = new Map<number, { pa: number; wraa: number }>(), arm = new Map<number, { bf: number; ra: number }>();
  let bfAll = 0, raAll = 0;
  for (const s of stints) {
    if (s.isFreeAgent || s.cid == null || E.byId.get(s.cid) == null) continue;
    if (s.isPitcher) {
      const bf = s.stats.BF ?? 0, ra = s.stats.Ra ?? 0;
      const a = arm.get(s.cid) ?? { bf: 0, ra: 0 };
      a.bf += bf; a.ra += ra; arm.set(s.cid, a);
      bfAll += bf; raAll += ra;
    } else {
      const b = bat.get(s.cid) ?? { pa: 0, wraa: 0 };
      b.pa += s.pa; b.wraa += s.stats.wRAA ?? 0; bat.set(s.cid, b);
    }
  }
  const fit = (pts: { x: number; y: number; w: number }[]) => {
    const W = pts.reduce((a, p) => a + p.w, 0) || 1;
    const mx = pts.reduce((a, p) => a + p.w * p.x, 0) / W, my = pts.reduce((a, p) => a + p.w * p.y, 0) / W;
    let sxy = 0, sxx = 0, syy = 0;
    for (const p of pts) { sxy += p.w * (p.x - mx) * (p.y - my); sxx += p.w * (p.x - mx) ** 2; syy += p.w * (p.y - my) ** 2; }
    return { n: pts.length, r: r3(sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0), slope: r3(sxx > 0 ? sxy / sxx : 0) };
  };
  const lgRa = bfAll > 0 ? raAll / bfAll : 0;
  const batPts = [...bat].filter(([, b]) => b.pa >= 100).map(([id, b]) => {
    const c = E.cards[E.byId.get(id)!];
    return { x: (1 - lhp) * c.runsR + lhp * c.runsL, y: (b.wraa / b.pa) * 700, w: b.pa };
  });
  const armPts = [...arm].filter(([, a]) => a.bf >= 100).map(([id, a]) => {
    const c = E.cards[E.byId.get(id)!];
    return { x: c.runsR, y: -(a.ra / a.bf - lgRa) * 700, w: a.bf };
  });
  return { bats: fit(batPts), arms: fit(armPts) };
}

async function study(series: string): Promise<StudySeries | null> {
  const f = DRAFT_FORMATS[series];
  const since = Number(val("since") ?? CURRENT_SINCE[series] ?? 0);
  const files = readdirSync(DIR)
    .filter((n) => new RegExp(`^${series}_(\\d+)\\.csv$`).test(n) && Number(/_(\d+)\.csv$/.exec(n)![1]) >= since)
    .sort((a, b) => Number(/_(\d+)\./.exec(a)![1]) - Number(/_(\d+)\./.exec(b)![1]));
  if (!files.length) { console.log(`${series}: no exports from run ${since} in ${DIR}`); return null; }
  const runs = files.map((file) => ({ file, ...readRun(file) }));
  const summary = summariseSeries(runs.map((r) => r.teams.map((t) => t.build)));
  const h = hands(runs.flatMap((r) => r.stints));
  const seen = [...new Set(runs.flatMap((r) => r.teams.flatMap((t) => t.ids)))].sort((a, b) => a - b);
  // The pool rotates. A card the field drafted in the earlier runs, often enough to expect 3+ picks in
  // these, and picked 0 times here has left it (Bob Miller's 1954 reliever: 84 August 6L teams, no October one).
  const prior = readdirSync(DIR).filter((n) => new RegExp(`^${series}_(\\d+)\\.csv$`).test(n) && Number(/_(\d+)\.csv$/.exec(n)![1]) < since);
  const before = new Map<number, number>();
  for (const file of prior) for (const t of readRun(file).teams) for (const id of t.ids) before.set(id, (before.get(id) ?? 0) + 1);
  const now = new Set(seen);
  const leftPool = [...before].filter(([id, k]) => !now.has(id) && (k * files.length) / prior.length >= 3).map(([id]) => id).sort((a, b) => a - b);
  const field = {
    files, lhpBfShare: h.lhp, lhbPaShare: h.lhb, spWeight: summary.spWeight, rpWeight: summary.rpWeight,
    staff: (() => { const s = staffPerTeam(summary); return s ? { sp: r1(s.sp), rp: r1(s.rp) } : null; })(),
    seen, seenThrough: THROUGH, out: leftPool,
  };
  const data = await loadDraft(series, field);
  if (!data) throw new Error(`${series}: no catalogue row ${f.eventId}`);
  const E = makeEngine(data.cards, data.ctx);

  const teams = runs.flatMap((r) => r.teams);
  const full = teams.filter((t) => t.ids.length === f.cards);
  const missing = new Set<number>();
  const scored = teams.map((t) => {
    const idxs = t.ids.map((id) => { const i = E.byId.get(id); if (i == null) missing.add(id); return i; }).filter((i): i is number => i != null);
    const plan = teamPlan(E, idxs);
    const games = t.build.w + t.build.l;
    return {
      t, value: plan.value, bats: plan.parts.lineup + plan.parts.bench + plan.parts.backup, arms: plan.parts.rotation + plan.parts.pen,
      win: games > 0 ? t.build.w / games : 0.5, rd: games > 0 ? (t.runsFor - t.runsAgainst) / games : 0, games,
      full: t.ids.length === f.cards,
      cardValue: idxs.reduce((a, i) => a + E.cards[i].val, 0),
    };
  }).filter((s) => s.games > 0);

  /*
   * The export lists only cards that played, and a team that goes deeper plays
   * more of its cards (win% against games played, r 0.74), so any total over
   * the cards on file rewards going deep by itself. The check uses full teams
   * only, every drafted card on file, centred within each run (a bracket's
   * record is relative to its own field); the sum of card values is the
   * market's read on the same teams, for comparison.
   */
  const byFile = new Map<string, typeof scored>();
  for (const s of scored) if (s.full) byFile.set(s.t.file, [...(byFile.get(s.t.file) ?? []), s]);
  const cx: number[] = [], cb: number[] = [], ca: number[] = [], cw: number[] = [], cr: number[] = [], cv: number[] = [];
  const quarters = [[], [], [], []] as number[][];
  for (const [, list] of byFile) {
    const mv = mean(list.map((s) => s.value)), mb = mean(list.map((s) => s.bats)), ma = mean(list.map((s) => s.arms));
    const mw = mean(list.map((s) => s.win)), mr = mean(list.map((s) => s.rd)), mc = mean(list.map((s) => s.cardValue));
    for (const s of list) { cx.push(s.value - mv); cb.push(s.bats - mb); ca.push(s.arms - ma); cw.push(s.win - mw); cr.push(s.rd - mr); cv.push(s.cardValue - mc); }
    const sorted = [...list].sort((a, b) => a.value - b.value);
    sorted.forEach((s, k) => quarters[Math.min(3, Math.floor((4 * k) / sorted.length))].push(s.win));
  }
  // Every team, with the cards on file held fixed within each run (a fairer read than full teams alone, which are mostly the deep runs).
  const px: number[] = [], pw: number[] = [], pv: number[] = [];
  const allByFile = new Map<string, typeof scored>();
  for (const s of scored) allByFile.set(s.t.file, [...(allByFile.get(s.t.file) ?? []), s]);
  for (const [, list] of allByFile) {
    const n = list.map((s) => s.t.ids.length);
    const res = (ys: number[]) => {
      const mn = mean(n), my = mean(ys);
      let sxy = 0, sxx = 0;
      for (let i = 0; i < n.length; i++) { sxy += (n[i] - mn) * (ys[i] - my); sxx += (n[i] - mn) ** 2; }
      const b = sxx > 0 ? sxy / sxx : 0;
      return ys.map((y, i) => y - my - b * (n[i] - mn));
    };
    px.push(...res(list.map((s) => s.value))); pw.push(...res(list.map((s) => s.win))); pv.push(...res(list.map((s) => s.cardValue)));
  }

  // L.J.'s teams against the full teams of their own run (his value is a floor when a card of his never played).
  const lj: StudyTeam[] = [];
  for (const s of scored) {
    if (!isMyOrg(s.t.org)) continue;
    const field = (byFile.get(s.t.file) ?? []).filter((x) => x !== s).map((x) => x.value);
    const below = field.filter((v) => v < s.value).length;
    lj.push({ file: s.t.file, org: s.t.org, w: s.t.build.w, l: s.t.build.l, value: r1(s.value), pct: Math.round((100 * below) / Math.max(1, field.length)), full: s.full });
  }
  const fieldSorted = full.map((t) => scored.find((s) => s.t === t)?.value).filter((v): v is number => v != null).sort((a, b) => a - b);
  const fieldValues = fieldSorted.length
    ? Array.from({ length: 101 }, (_, k) => r1(fieldSorted[Math.min(fieldSorted.length - 1, Math.round((k / 100) * (fieldSorted.length - 1)))]))
    : [];

  const shares: Record<string, number> = {};
  for (const t of full) for (const id of t.ids) shares[id] = (shares[id] ?? 0) + 1;
  for (const id of Object.keys(shares)) shares[id] = r3(shares[id] / full.length);

  const notes: string[] = [];
  composition(f, E, full, notes);
  if (prior.length) {
    const names = leftPool.map((id) => E.byId.get(id)).filter((i): i is number => i != null).slice(0, 8).map((i) => `${E.cards[i].name} (${E.cards[i].tier} ${E.cards[i].group}, ${before.get(E.cards[i].id)} picks before)`);
    notes.push(`Out of the pool now: ${leftPool.length} cards drafted in the ${prior.length} earlier runs and not in these${names.length ? `, e.g. ${names.join(", ")}` : ""}.`);
  }
  if (missing.size) notes.push(`${missing.size} drafted cards are not in the legal pool (left out of the team values).`);

  // Would a lighter or heavier price on the arms have fit these results better? (Too few teams to refit; a read.)
  const sens = [0.5, 0.75, 1, 1.5, 2].map((k) => `×${k} ${pearson(cb.map((b, i) => b + k * ca[i]), cw).toFixed(3)}`);
  notes.push(`Arms' weight against bats, r with win% on full teams: ${sens.join(", ")} (production is ×1).`);

  // What full teams drafted, against their record: count of SP cards, and what the top tiers went to.
  const fullScored = scored.filter((x) => x.full);
  const cls = (i: number) => (E.cards[i].isPitcher ? (E.cards[i].role === "SP" ? "SP" : "RP") : "bat");
  const by = (label: string, key: (x: (typeof fullScored)[number]) => string) => {
    const g = new Map<string, number[]>();
    for (const x of fullScored) { const k = key(x); g.set(k, [...(g.get(k) ?? []), x.win]); }
    const rows = [...g].sort((a, b) => a[0].localeCompare(b[0])).map(([k, w]) => `${k}: ${mean(w).toFixed(3)} (${w.length})`);
    notes.push(`Win% of full teams by ${label}: ${rows.join(", ")}.`);
  };
  const idxOf = (x: (typeof fullScored)[number]) => x.t.ids.map((id) => E.byId.get(id)).filter((i): i is number => i != null);
  by("SP cards drafted", (x) => { const n = idxOf(x).filter((i) => cls(i) === "SP").length; return n <= 3 ? "≤3" : n >= 6 ? "6+" : String(n); });
  for (const tier of ["Gold", "Silver"] as const) {
    if (!f.rounds.some((r) => r.tier === tier)) continue;
    by(`what the ${tier} picks were`, (x) => idxOf(x).filter((i) => E.cards[i].tier === tier).map(cls).sort().join("+") || "none");
  }

  // What the top quarter by record did differently, by tier and role.
  const top = [...byFile.values()].flatMap((list) => [...list].sort((a, b) => b.win - a.win).slice(0, Math.ceil(list.length / 4)));
  const roleMix = (list: typeof scored) => {
    const out: Record<string, number> = {};
    for (const s of list) for (const id of s.t.ids) {
      const i = E.byId.get(id);
      if (i == null) continue;
      const c = E.cards[i];
      const k = `${c.tier[0]} ${c.isPitcher ? c.role : "bat"}`;
      out[k] = (out[k] ?? 0) + 1 / list.length;
    }
    return Object.entries(out).sort().map(([k, v]) => `${k} ${v.toFixed(2)}`).join(", ");
  };
  notes.push(`Cards a team, top quarter by record: ${roleMix(top)}.`);
  notes.push(`Cards a team, every team: ${roleMix(scored)}.`);

  const out: StudySeries = {
    ...field,
    teams: teams.length, fullTeams: full.length,
    shares, fieldValues,
    validation: {
      teams: cx.length, rWin: r3(pearson(cx, cw)), rRuns: r3(pearson(cx, cr)),
      quarters: quarters.map((q) => r3(mean(q))), rBats: r3(pearson(cb, cw)), rArms: r3(pearson(ca, cw)),
      rCardValue: r3(pearson(cv, cw)),
      allTeams: scored.length, rWinAll: r3(pearson(px, pw)), rCardValueAll: r3(pearson(pv, pw)),
      cards: cardCheck(E, data.ctx.lhp, runs.flatMap((r) => r.stints)),
    },
    lj, notes,
  };

  console.log(`\n=== ${f.name} (${series}) — ${files.length} exports from run ${since}: ${files.join(", ")}`);
  console.log(`teams ${teams.length}, full ${full.length}; field: LHP ${field.lhpBfShare} of BF, LHB ${field.lhbPaShare} of PA; SP ${field.spWeight} / RP ${field.rpWeight} of a lineup slot; staff ${JSON.stringify(field.staff)}`);
  console.log(`slot prices: glove ×${data.ctx.glove.toFixed(2)}, framing ×${data.ctx.frm}, one SP ${data.ctx.spW.toFixed(2)} (${data.ctx.sp}), one RP ${data.ctx.rpW.toFixed(2)} (${data.ctx.rp}), bench ${data.ctx.benchW.toFixed(3)} (${data.ctx.bench}); vs LHP board ${data.ctx.lhp}`);
  console.log(`model check, ${out.validation!.teams} full teams centred within run: r(value, win%) ${out.validation!.rWin}, r(value, run diff/G) ${out.validation!.rRuns}; bats-only r ${out.validation!.rBats}, arms-only r ${out.validation!.rArms}; sum of card values r ${out.validation!.rCardValue}`);
  console.log(`every team, cards on file held fixed: r(value, win%) ${out.validation!.rWinAll} (sum of card values ${out.validation!.rCardValueAll}), ${out.validation!.allTeams} teams`);
  const cc = out.validation!.cards;
  console.log(`card by card, model runs against play here: bats r ${cc.bats.r} slope ${cc.bats.slope} (${cc.bats.n} cards, 100+ PA); arms r ${cc.arms.r} slope ${cc.arms.slope} (${cc.arms.n} cards, 100+ BF)`);
  console.log(`win% by quarter of team value (low → high): ${out.validation!.quarters.map((q) => q.toFixed(3)).join(" · ")}`);
  console.log(`field's finished teams: p10 ${fieldValues[10]}, p50 ${fieldValues[50]}, p90 ${fieldValues[90]}`);
  for (const t of lj) console.log(`L.J. ${t.file}: ${t.w}-${t.l}, value ${t.value}${t.full ? "" : " (a card never played: a floor)"}, ${t.pct}th percentile of that run's full teams`);
  for (const n of notes) console.log(`  · ${n}`);
  if (data.differences.length) console.log(`catalogue differs: ${data.differences.join("; ")}`);
  return out;
}

async function main() {
  const only = val("series");
  const list = only ? [only] : Object.keys(DRAFT_FORMATS);
  const next: DraftStudy = { generatedAt: new Date().toISOString().slice(0, 10), series: { ...DRAFT_STUDY.series } };
  for (const s of list) {
    if (!DRAFT_FORMATS[s]) throw new Error(`no draft format for ${s} (lib/draft/formats.ts)`);
    const r = await study(s);
    if (r) next.series[s] = r;
  }
  if (DRY) { console.log("\n--dry: nothing written"); return; }
  writeFileSync(OUT, JSON.stringify(next) + "\n");
  console.log(`\nwrote ${path.relative(process.cwd(), OUT)}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
