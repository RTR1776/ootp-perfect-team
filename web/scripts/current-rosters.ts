/**
 * Rebuild Claude's roster for every current event, from the catalogue's rules,
 * after new cards (L.J., 2026-09-29: "do the updating for all the current
 * tourneys not just bronze ... just current").
 *
 * Current: not retired, not a draft, not an EF event or a Quick (--quicks adds
 * the Quicks), and its slot ran within --days (default 8) in the newest
 * tournaments dump. An event that already has a roster saved against the
 * newest collection is skipped unless --all. --only 521,532 picks events by id
 * (any event, current or not).
 *
 * Each event's flags come from lib/event-roster-args (the catalogue read the
 * way /build reads it); an event with a rule the flags can't carry is listed
 * and skipped. env-roster runs with the settings every Claude pick uses: 26
 * cards, 14 bats / 5 SP / 7 RP, relief role trust 0.25, the optimiser from 16
 * starts. Its field-set guard still stops an event whose exports say there is
 * a set rule the catalogue lacks.
 *
 * Each legal build becomes a load file in Inbox/rosters with every card pinned
 * by id, and the batch a manifest (Inbox/rosters/current-<tag>.tsv: event id,
 * load file, event name) that "Save Current Rosters.command" saves from on the
 * Mac. Nothing here writes to the database.
 *
 * --new-cards (L.J., 2026-09-30, after the Sabo LE: "a system in place so that
 * when new cards come out they are easily put in various tourney rosters where
 * they belong"): rebuild only the events where a card he got since that
 * event's saved roster would start, by Card Fit's one-swap test (the same
 * numbers /cards shows) and adds at least --min-gain runs (default 3), plus
 * current events with no saved roster. A rebuild
 * that comes out with the same cards as the saved roster is left out of the
 * manifest, so the Mac saves only rosters that change.
 *
 *   node --env-file=.env.local --import tsx scripts/current-rosters.ts --list
 *   node --env-file=.env.local --import tsx scripts/current-rosters.ts --new-cards --out /tmp/rosters [--jobs 5]
 *   node --env-file=.env.local --import tsx scripts/current-rosters.ts --out /tmp/rosters [--jobs 4] [--only 521,532] [--skip 549] [--patch rules.json] [--tag 2026-09-29-late] [--all] [--quicks]
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, collectionCards, rosterSlots, rosters, seriesMeta, tournaments, uploads } from "@/db/schema";
import { rosterShape } from "@/lib/roster-fill";
import { rosterSize } from "@/lib/roster-rules";
import { parseDump } from "@/lib/analytics/dumps";
import { eventGroupOf } from "@/lib/event-groups";
import { eventRosterArgs } from "@/lib/event-roster-args";
import { impliedBaseCopies } from "@/lib/ingest/collection";
import { newSince, savedCollectionId, type OwnedForms } from "@/lib/saved-roster-freshness";
import { loadCardFit } from "@/lib/card-fit-load";
import { exportsPredate } from "@/lib/set-evidence-server";
import { chicagoDay } from "@/lib/format";
import { editCatalogueRules, parseSlots, type CatalogueEdit } from "@/lib/catalogue-edit";

const argv = process.argv.slice(2);
const flag = (k: string) => argv.includes(`--${k}`);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const ROOT = process.env.OOTP_DATA_ROOT ?? "..";
const DAYS = Number(val("days", "8"));
const JOBS = Number(val("jobs", "4"));
const ONLY = (val("only") ?? "").split(",").map((s) => Number(s.trim())).filter((n) => n > 0);
/** Events to leave alone: a pick built to L.J.'s own shape (Dead Silver's 4 SP / 5 RP), or a format change not yet in the catalogue. */
const SKIP = new Set((val("skip") ?? "").split(",").map((s) => Number(s.trim())).filter((n) => n > 0));
/**
 * --patch rules.json: rule changes not in the catalogue yet, keyed by event id,
 * in catalogue:set's edit form (envYear, stadium, dh, value, cardYears, slots
 * as the game's line, teamCap, variantCap, noLimitedEdition, drop, text,
 * formatSince). They go through the same editCatalogueRules the catalogue
 * update uses, so a roster is built to the rules the Mac script is about to
 * write, and its save is checked against them once they are written.
 */
const PATCH: Record<string, Omit<CatalogueEdit, "at" | "slots"> & { slots?: string }> = val("patch") ? JSON.parse(readFileSync(val("patch")!, "utf8")) : {};
const OUT = val("out");
/**
 * --add rows.json: events not in the catalogue yet (an announced championship),
 * as tournament rows (import-ptcs6-championship --dry --json writes them). They
 * are built like any other; a row of the same id on file is replaced.
 */
const ADD: Record<string, unknown>[] = val("add") ? JSON.parse(readFileSync(val("add")!, "utf8")) : [];
/** --new-cards: the least a new card's one swap must add (runs) for its event to be rebuilt. */
// 3, not 1 (L.J. 10-08): a one-swap gain under 3 runs is inside the optimiser's ±3 run-to-run noise.
const MIN_GAIN = Number(val("min-gain", "3"));
/**
 * --tag: names the batch's load files, manifest and saved rosters ("Claude pick
 * <tag>"). Default the Chicago day; give a second batch the same day its own
 * (2026-09-29-late), so it doesn't replace that morning's picks of the same name.
 */
const TAG = val("tag") ?? chicagoDay(new Date())!;
/**
 * The roster shape (SP / RP / bats) is each event's own, as /build sizes it
 * (roster-fill rosterShape): the series' exports when they are the current
 * format, else the era table (a 1920 event carries 4 SP and 4 RP, L.J.
 * 2026-09-30; until then every build here was 5 / 7 / 14). --sp / --rp /
 * --bats override it for the whole batch.
 */
/**
 * Every build with a saved roster for its event is seeded from it (env-roster
 * --seed): one hill-climb from the saved board plus the new cards. So
 * --new-cards needs only a couple of λ starts as a cross-check (default 1, which
 * is λ 0 and λ 8), and a rebuild can never score below the saved roster.
 * --no-seed builds from scratch as before.
 */
const SEED = !flag("no-seed");
const BUILD = ["--optimize", "--starts", val("starts") ?? (flag("new-cards") && SEED ? "1" : "16"), "--role-trust", "0.25", ...(argv.includes("--compare-search") ? ["--compare-search"] : []),
  // Cards bought but not yet uploaded (env-roster --assume-owned); a roster carrying one saves only after the upload.
  ...(val("assume-owned") ? ["--assume-owned", val("assume-owned")!] : [])];

/** Each slot's newest run in the newest tournaments dump, as epoch seconds. */
function lastRuns(): { at: Map<number, number>; newest: number } {
  const dir = join(ROOT, "Tourney Data");
  const f = readdirSync(dir).filter((x) => /^pt27_tournaments_.*\.csv$/.test(x)).sort().at(-1);
  if (!f) throw new Error(`no tournaments dump in ${dir}`);
  const d = parseDump(readFileSync(join(dir, f), "utf8"));
  if (!d) throw new Error(`could not read ${f}`);
  const at = new Map<number, number>();
  for (const e of d.events) { const s = Math.floor(Number(e.id) / 10000); at.set(s, Math.max(at.get(s) ?? 0, e.start)); }
  return { at, newest: Math.max(...at.values()) };
}

interface Job { id: number; name: string; slug: string; args: string[]; notes: string[]; why?: string }

/** The cards owned in a collection upload, each form; a variant implies its base copy (not a clubhouse card's). */
async function ownedForms(uploadId: number, club: (id: number) => boolean): Promise<OwnedForms> {
  const rows = await db.select({ cardId: collectionCards.cardId, isVariant: collectionCards.isVariant }).from(collectionCards).where(eq(collectionCards.uploadId, uploadId));
  const base = new Set(rows.filter((r) => !r.isVariant && r.cardId != null).map((r) => r.cardId!));
  for (const id of impliedBaseCopies(rows, club)) base.add(id);
  return { base, variant: new Set(rows.filter((r) => r.isVariant && r.cardId != null).map((r) => r.cardId!)) };
}

/** Each event's newest saved roster: its collection and its cards (id, variant). */
async function newestSaved() {
  const all = await db.select({ id: rosters.id, t: rosters.tournamentId, name: rosters.name, notes: rosters.notes, at: rosters.updatedAt }).from(rosters);
  const by = new Map<number, (typeof all)[number]>();
  for (const r of all) {
    if (r.t == null) continue;
    const o = by.get(r.t);
    if (!o || r.at > o.at || (r.at.getTime() === o.at.getTime() && r.id > o.id)) by.set(r.t, r);
  }
  const slots = await db.select({ rosterId: rosterSlots.rosterId, cardId: rosterSlots.cardId, v: rosterSlots.useVariant, slot: rosterSlots.slot, hand: rosterSlots.versusHand })
    .from(rosterSlots).orderBy(rosterSlots.id);
  const cardsOf = new Map<number, Set<string>>();
  /** The roster as env-roster --seed lines: "R:C … #id", "SP1 … #id", "BN1 … #id". */
  const seedOf = new Map<number, string[]>();
  for (const s of slots) {
    let c = cardsOf.get(s.rosterId); if (!c) cardsOf.set(s.rosterId, (c = new Set())); c.add(`${s.cardId}${s.v ? "v" : ""}`);
    let l = seedOf.get(s.rosterId); if (!l) seedOf.set(s.rosterId, (l = []));
    l.push(`${s.hand === "L" || s.hand === "R" ? `${s.hand}:` : ""}${s.slot} #${s.cardId}`);
  }
  return new Map([...by].map(([t, r]) => [t, { id: r.id, name: r.name, collection: savedCollectionId(r.notes), cards: cardsOf.get(r.id) ?? new Set<string>(), seed: seedOf.get(r.id) ?? [] }]));
}

/**
 * --new-cards: which events a new card would start in. For each event, the cards
 * owned now that its saved roster's collection lacked (as Build's "N new cards
 * fit" chip counts them), then Card Fit's test: status "start" in that event.
 */
async function newCardEvents(events: { id: number; restrictions: unknown }[], latest: number, saved: Awaited<ReturnType<typeof newestSaved>>) {
  const universe = await db.select({ cardId: cards.cardId, title: cards.title, name: cards.name }).from(cards);
  const clubIds = new Set(universe.filter((c) => /clubhouse/i.test(c.title)).map((c) => c.cardId));
  const club = (id: number) => clubIds.has(id);
  const nameOf = new Map(universe.map((c) => [c.cardId, c.name]));
  const now = await ownedForms(latest, club);
  const pool = [...new Set([...now.base, ...now.variant])].map((id) => ({ cardId: id, baseOwned: now.base.has(id), variantOwned: now.variant.has(id) }));
  const thenBy = new Map<number, OwnedForms>();
  const perEvent = new Map<number, number[] | "no saved roster" | "saved roster has no collection">();
  for (const t of events) {
    const s = saved.get(t.id);
    if (!s) { perEvent.set(t.id, "no saved roster"); continue; }
    if (s.collection == null) { perEvent.set(t.id, "saved roster has no collection"); continue; }
    if (s.collection === latest) { perEvent.set(t.id, []); continue; }
    if (!thenBy.has(s.collection)) thenBy.set(s.collection, await ownedForms(s.collection, club));
    const rx = t.restrictions as { variantsAllowed?: boolean; variantCap?: number } | null;
    perEvent.set(t.id, newSince(pool, thenBy.get(s.collection)!, rx?.variantsAllowed !== false && rx?.variantCap !== 0).map((n) => n.cardId));
  }
  const targets = [...new Set([...perEvent.values()].flatMap((v) => (Array.isArray(v) ? v : [])))];
  console.log(`--new-cards: ${targets.length} card${targets.length === 1 ? "" : "s"} new to at least one event's saved roster; placing them with Card Fit…`);
  const fit = targets.length ? await loadCardFit(targets) : { cards: [] };
  const starts = new Map<number, string[]>();
  for (const { card, rows } of fit.cards) for (const r of rows) {
    const mine = perEvent.get(r.eventId);
    if (r.status !== "start" || r.gain < MIN_GAIN || !Array.isArray(mine) || !mine.includes(card.id)) continue;
    const l = starts.get(r.eventId) ?? [];
    l.push(`${nameOf.get(card.id) ?? card.id}${r.variant ? " (VAR)" : ""} ${r.spot} +${r.gain.toFixed(1)}`);
    starts.set(r.eventId, l);
  }
  const why = new Map<number, string | null>();
  for (const [id, v] of perEvent) why.set(id, typeof v === "string" ? v : starts.has(id) ? `new: ${starts.get(id)!.join(", ")}` : null);
  return why;
}

async function main() {
  const [latest] = await db.select({ id: uploads.id }).from(uploads).where(eq(uploads.kind, "collection")).orderBy(desc(uploads.uploadedAt), desc(uploads.id)).limit(1);
  if (!latest) throw new Error("no collection upload");
  const runs = lastRuns();
  const added = ADD.map((r) => ({ retired: false, isDraft: false, slot: null, ...r })) as unknown as (typeof tournaments.$inferSelect)[];
  const addedIds = new Set(added.map((r) => r.id));
  const all = [...(await db.select().from(tournaments)).filter((t) => !addedIds.has(t.id)), ...added].map((t) => {
    const p = PATCH[String(t.id)];
    if (!p) return t;
    const rx = (t.restrictions ?? null) as Record<string, unknown> | null;
    const edit: CatalogueEdit = { ...p, slots: p.slots ? parseSlots(p.slots, (rx as { cards?: number } | null)?.cards ?? 26) : undefined, at: chicagoDay(new Date())! };
    return { ...t, ...editCatalogueRules({ envYear: t.envYear, stadium: t.stadium, parkName: t.parkName, dh: t.dh, ratingsMin: t.ratingsMin, ratingsMax: t.ratingsMax, cardYearMin: t.cardYearMin, cardYearMax: t.cardYearMax, restrictions: rx }, edit) };
  });
  const saved = await db.select({ t: rosters.tournamentId, notes: rosters.notes }).from(rosters);
  const savedNow = await newestSaved();
  const fresh = new Set(saved.filter((r) => savedCollectionId(r.notes) === latest.id).map((r) => r.t));

  const current = all.filter((t) => {
    if (ONLY.length) return ONLY.includes(t.id);
    if (t.retired || t.isDraft) return false;
    const g = eventGroupOf(t);
    if (!g) return false;
    if (g === "Quicks") return flag("quicks");
    const last = t.slot != null ? runs.at.get(t.slot) : undefined;
    return last != null && (runs.newest - last) / 86400 <= DAYS;
  }).sort((a, b) => a.name.localeCompare(b.name));

  const why = flag("new-cards") ? await newCardEvents(current, latest.id, savedNow) : null;
  const metaBy = new Map((await db.select().from(seriesMeta)).map((m) => [m.series, m]));
  const jobs: Job[] = [], skipped: string[] = [];
  let noNew = 0;
  for (const t of current) {
    if (SKIP.has(t.id)) { skipped.push(`${t.id} ${t.name}: --skip`); continue; }
    if (why && !why.get(t.id)) { noNew++; continue; }
    if (!ONLY.length && !flag("all") && fresh.has(t.id)) { skipped.push(`${t.id} ${t.name}: already built on the newest collection`); continue; }
    const since = (t.restrictions as { formatSince?: string } | null)?.formatSince;
    const stale = !!(t.series && since && (await exportsPredate(t.series, since)).stale);
    const r = eventRosterArgs(t, { seriesStale: stale });
    if (r.problems.length) { skipped.push(`${t.id} ${t.name}: ${r.problems.join("; ")}`); continue; }
    const meta = t.series && !stale ? metaBy.get(t.series) ?? null : null;
    const sh = rosterShape(t.envYear, t.dh === true ? 9 : 8, rosterSize({ restrictions: t.restrictions } as Parameters<typeof rosterSize>[0]) ?? 26, meta, t.cardYearMin);
    r.args.push("--sp", val("sp") ?? String(sh.sp), "--rp", val("rp") ?? String(sh.rp), "--bats", val("bats") ?? String(sh.bats));
    r.notes.push(`shape ${val("sp") ?? sh.sp} SP / ${val("rp") ?? sh.rp} RP / ${val("bats") ?? sh.bats} bats (${val("sp") ? "--sp" : sh.source === "observed" ? "the series' exports" : `era table, ${sh.band}`})`);
    jobs.push({ id: t.id, name: t.name, slug: (t.series ?? `event${t.id}`).replace(/[^a-z0-9]/gi, "").toLowerCase(), args: r.args, notes: r.notes, why: why?.get(t.id) ?? undefined });
  }
  if (why) console.log(`--new-cards: ${noNew} current event${noNew === 1 ? "" : "s"} where no new card starts (or adds ${MIN_GAIN}+ runs) are left as saved.`);

  // Events that share a series (a championship's ten) get their id in the file name.
  const bySlug = new Map<string, number>();
  for (const j of jobs) bySlug.set(j.slug, (bySlug.get(j.slug) ?? 0) + 1);
  for (const j of jobs) if (bySlug.get(j.slug)! > 1) j.slug = `${j.slug}-${j.id}`;

  console.log(`${current.length} current event${current.length === 1 ? "" : "s"} (ran within ${DAYS} days of the dump's newest run); ${jobs.length} to build.`);
  for (const s of skipped) console.log(`  skip ${s}`);
  if (flag("list") || !OUT) {
    for (const j of jobs) console.log(`  ${j.id} ${j.name}${j.why ? `  [${j.why}]` : ""}\n      ${j.args.join(" ")}${j.notes.length ? `\n      (${j.notes.join("; ")})` : ""}`);
    if (!OUT && !flag("list")) console.log("\n--out DIR runs them.");
    process.exit(0);
  }

  mkdirSync(OUT, { recursive: true });
  const results: { job: Job; status: string; objective: number | null; file: string | null }[] = [];
  // The manifest is rewritten after every build, so a batch cut short keeps what it built.
  // A second batch the same day adds to the day's manifest; an event built again replaces its line.
  const writeManifest = (built: { job: Job; file: string | null }[]) => {
    const manifest = join(ROOT, "Inbox/rosters", `current-${TAG}.tsv`);
    const kept = existsSync(manifest) ? readFileSync(manifest, "utf8").split("\n").filter((l) => l.trim() && !built.some((r) => l.startsWith(`${r.job.id}\t`))) : [];
    const lines = [...kept, ...built.map((r) => `${r.job.id}\t${r.file}\t${r.job.name}`)].sort((a, b) => a.split("\t")[2].localeCompare(b.split("\t")[2]));
    writeFileSync(manifest, lines.join("\n") + "\n");
    return manifest;
  };
  let next = 0;
  const run = (job: Job) => new Promise<void>((resolve) => {
    const out = join(OUT, `${job.id}.txt`);
    const prior = SEED ? savedNow.get(job.id) : undefined;
    const seed = prior?.seed.length ? join(OUT, `${job.id}-seed.txt`) : null;
    if (seed) writeFileSync(seed, `# seed: saved roster ${prior!.id} "${prior!.name}"\n${prior!.seed.join("\n")}\n`);
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/env-roster.ts", ...job.args, ...BUILD, ...(seed ? ["--seed", seed] : [])], { env: process.env });
    let text = "";
    child.stdout.on("data", (d) => { text += d; });
    child.stderr.on("data", (d) => { text += d; });
    child.on("close", async (code) => {
      writeFileSync(out, text);
      const legal = /^LEGAL — every rule check passes/m.test(text);
      const objective = Number(/^objective: ([-0-9.]+)/m.exec(text)?.[1] ?? NaN);
      let file: string | null = null, status = code === 0 ? (legal ? "built" : "not legal") : "failed";
      if (status === "built") {
        try {
          file = await toLoadFile(text, job, latest.id);
          const prev = savedNow.get(job.id)?.cards;
          if (why && prev?.size && sameCards(readFileSync(join(ROOT, "Inbox/rosters", file), "utf8"), prev)) { status = "same cards as the saved roster"; file = null; }
        } catch (e) { status = `no load file: ${e instanceof Error ? e.message : e}`; }
      } else if (code !== 0) status = `failed: ${(text.split("\n").find((l) => l.startsWith("!!")) ?? text.trim().split("\n").at(-1) ?? "").slice(0, 160)}`;
      results.push({ job, status, objective: Number.isFinite(objective) ? objective : null, file });
      if (file) writeManifest([{ job, file }]);
      console.log(`  [${results.length}/${jobs.length}] ${job.id} ${job.name}: ${status}${Number.isFinite(objective) ? ` · ${objective}` : ""}`);
      resolve();
    });
  });
  await Promise.all(Array.from({ length: Math.min(JOBS, jobs.length) }, async () => { while (next < jobs.length) await run(jobs[next++]); }));

  const built = results.filter((r) => r.file);
  const manifest = writeManifest(built);
  writeFileSync(join(OUT, "summary.json"), JSON.stringify(results.map((r) => ({ id: r.job.id, name: r.job.name, status: r.status, objective: r.objective, file: r.file, why: r.job.why, notes: r.job.notes, args: r.job.args })), null, 2));
  console.log(`\n${built.length} of ${jobs.length} built and legal; manifest ${manifest}`);
  for (const r of results.filter((x) => x.status === "same cards as the saved roster")) console.log(`  UNCHANGED ${r.job.id} ${r.job.name}: the rebuild keeps the saved roster's cards`);
  for (const r of results.filter((x) => !x.file && x.status !== "same cards as the saved roster")) console.log(`  NOT BUILT ${r.job.id} ${r.job.name}: ${r.status}`);
  process.exit(0);
}

/** A load file's cards (every line pins "#id"; "(VAR)" marks the variant) against a saved roster's. */
function sameCards(loadFile: string, saved: ReadonlySet<string>): boolean {
  const mine = new Set<string>();
  for (const l of loadFile.split("\n")) { const m = /\s(.*?)\s#(\d+)\s*$/.exec(l); if (m && !l.startsWith("#")) mine.add(`${m[2]}${/\(VAR\)$/.test(m[1]) ? "v" : ""}`); }
  return mine.size === saved.size && [...mine].every((k) => saved.has(k));
}

/**
 * env-roster's printout as a roster:save load file, every card pinned by id:
 * matched by name, value and year among the cards owned in the collection
 * (a variant implies its base copy). Starters ace first; the best reliever closes.
 */
async function toLoadFile(text: string, job: Job, uploadId: number): Promise<string> {
  const owned = await db.select({ cardId: collectionCards.cardId, isVariant: collectionCards.isVariant }).from(collectionCards).where(eq(collectionCards.uploadId, uploadId));
  const universe = await db.select({ cardId: cards.cardId, name: cards.name, value: cards.cardValue, year: cards.year, isPitcher: cards.isPitcher, title: cards.title }).from(cards);
  const club = new Set(universe.filter((c) => /clubhouse/i.test(c.title)).map((c) => c.cardId));
  const base = new Set(owned.filter((o) => !o.isVariant && o.cardId != null).map((o) => o.cardId!));
  for (const id of impliedBaseCopies(owned, (i) => club.has(i))) base.add(id);
  const vars = new Set(owned.filter((o) => o.isVariant && o.cardId != null).map((o) => o.cardId!));
  const re = /^(R:\w+|L:\w+|SP\d|CL|RP\d+|BN\d+)\s+(.+?)\s{2,}(\d+)\s+([LRS])\s+(\d{4})\s+([+-]?\d+\.\d)/;
  const lines: string[] = [], bench: string[] = [], sps: { runs: number; pin: string }[] = [], rps: { runs: number; pin: string }[] = [];
  for (const l of text.split(/\r?\n/)) {
    const m = re.exec(l);
    if (!m) continue;
    const [, key, rawName, value, , year, runs] = m;
    const isVar = /\(VAR\)$/.test(rawName);
    const name = rawName.replace(/\s*\(VAR\)$/, "");
    const pitcher = /^(SP|RP|CL)/.test(key);
    let hits = universe.filter((c) => c.name.toLowerCase() === name.toLowerCase() && c.value === Number(value) && c.year === Number(year)
      && (isVar ? vars.has(c.cardId) : base.has(c.cardId) || vars.has(c.cardId)) && (key.startsWith("BN") || (c.isPitcher ?? false) === pitcher));
    // Two owned cards can share name, value and year (a Live card and a Future Legend, 10-05 Payton Tolle):
    // env-roster ends each row with the card's id, which settles it.
    const pinned = /\s#(\d+)\s*$/.exec(l);
    if (hits.length > 1 && pinned) hits = hits.filter((c) => c.cardId === Number(pinned[1]));
    if (hits.length !== 1) throw new Error(`${key} ${rawName} ${value} ${year}: ${hits.length} owned matches`);
    const pin = `${rawName} #${hits[0].cardId}`;
    if (key.startsWith("SP")) sps.push({ runs: Number(runs), pin });
    else if (key === "CL" || key.startsWith("RP")) rps.push({ runs: Number(runs), pin });
    else if (key.startsWith("BN")) bench.push(`${key} ${pin}`);
    else lines.push(`${key} ${pin}`);
  }
  const staff = [...sps.sort((a, b) => b.runs - a.runs).map((p, i) => `SP${i + 1} ${p.pin}`), ...rps.sort((a, b) => b.runs - a.runs).map((p, i) => `${i === 0 ? "CL" : `RP${i}`} ${p.pin}`)];
  const file = `${job.slug}-claude-${TAG}.txt`;
  const head = `# ${job.name} — Claude pick ${TAG.replace(/-([a-z]+)$/, " $1")}, rebuilt from the catalogue's rules by current-rosters (${job.args.filter((a) => a !== "--name" && a !== job.name).join(" ")})`;
  writeFileSync(join(ROOT, "Inbox/rosters", file), [head, ...lines, ...staff, ...bench].join("\n") + "\n");
  return file;
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
