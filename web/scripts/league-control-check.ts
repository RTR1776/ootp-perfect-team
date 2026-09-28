/**
 * Does the league's pitcher Control match the shop's? Read-only.
 *
 * A base card plays at its shop ratings, so for base-card pitchers the league
 * export's CON / CON vL / CON vR must equal the card's Control / Control vL /
 * Control vR. When they don't, the import read the wrong column: HD451 of
 * 2026-09-27 came in OOTP's 338-column view, where hitter Contact shares the
 * name, and stored Contact (median 9) as Control (median ~110).
 *
 *   node --env-file=.env.local --import tsx scripts/league-control-check.ts --week 2026-09-27
 *   ... --week 2026-09-27 --files ~/Downloads/hd451_all.csv ...
 *
 * --week: every stored snapshot of that week, per league and split.
 * --files: parse each file with THIS checkout's parser and run the same check,
 *   and confirm the file is the export already stored for its league, split and
 *   week (same cards on the same teams with the same PA and IP). Exits 1 if a
 *   file fails either, so a script can stop before re-importing.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { parseLeagueExport, type LeagueStint } from "@/lib/ingest/league";

const asRows = <T,>(r: unknown): T[] => (Array.isArray(r) ? r : (r as { rows?: T[] }).rows ?? []);
const argv = process.argv.slice(2);
const weekAt = argv.indexOf("--week");
const WEEK = weekAt >= 0 ? argv[weekAt + 1] : undefined;
const filesAt = argv.indexOf("--files");
const FILES = filesAt >= 0 ? argv.slice(filesAt + 1).filter((a) => !a.startsWith("--")) : [];
if (!WEEK || !/^\d{4}-\d{2}-\d{2}$/.test(WEEK)) {
  console.error("usage: league-control-check.ts --week YYYY-MM-DD [--files <csv...>]");
  process.exit(1);
}

/** League key → shop key. */
const PAIRS: Array<[string, string]> = [["CON", "Control"], ["CON vL", "Control vL"], ["CON vR", "Control vR"]];
/** At least this share must match; a handful of mid-week rating changes is fine. */
const PASS = 0.95;

type Arm = { cid: number; ratings: Record<string, number> };

/** Matches per key, over base-card pitchers the shop knows. */
async function score(arms: Arm[]) {
  const cids = [...new Set(arms.map((a) => a.cid))];
  const shop = new Map<number, Record<string, number>>();
  if (cids.length) {
    const rows = asRows<{ card_id: number; ratings: Record<string, number> }>(await db.execute(sql`
      select card_id, ratings from cards
      where card_id in (${sql.join(cids.map((c) => sql`${c}`), sql`, `)})`));
    for (const r of rows) shop.set(r.card_id, r.ratings);
  }
  const known = arms.filter((a) => shop.has(a.cid));
  const hits = PAIRS.map(([k, s]) => known.filter((a) => a.ratings[k] === shop.get(a.cid)![s]).length);
  const vl = known.map((a) => a.ratings["CON vL"]).filter((v) => v != null).sort((a, b) => a - b);
  return { n: known.length, hits, median: vl.length ? vl[Math.floor(vl.length / 2)] : null };
}

const line = (label: string, s: Awaited<ReturnType<typeof score>>) =>
  `  ${label.padEnd(22)} ${String(s.n).padStart(4)} base arms · ` +
  PAIRS.map(([k], i) => `${k} ${s.hits[i]}/${s.n}`).join(" · ") +
  ` · median CON vL ${s.median ?? "-"}`;
const ok = (s: Awaited<ReturnType<typeof score>>) => s.n > 0 && s.hits.every((h) => h >= PASS * s.n);

async function main() {
  const snaps = asRows<{ id: number; league: string; split: string }>(await db.execute(sql`
    select id, league, split from league_snapshots where captured_on = ${WEEK} order by league, split`));

  console.log(`Stored, week of ${WEEK} — league Control vs the shop's:`);
  if (!snaps.length) console.log("  no snapshots that week");
  for (const s of snaps) {
    const arms = asRows<Arm>(await db.execute(sql`
      select cid, ratings from league_stints
      where snapshot_id = ${s.id} and is_pitcher and not is_variant and cid is not null`));
    const r = await score(arms);
    console.log(line(`${s.league} ${s.split}`, r) + (ok(r) ? "" : "   ← wrong"));
  }
  if (!FILES.length) process.exit(0);

  let failed = 0;
  console.log(`\nFiles, read by this checkout's parser:`);
  for (const file of FILES) {
    const name = basename(file);
    let parsed;
    try { parsed = parseLeagueExport(readFileSync(file, "utf8"), name); }
    catch (e) { console.log(`  ${name}: cannot read (${(e as Error).message})`); failed++; continue; }
    const label = `${parsed.league ?? "?"} ${parsed.split}`;
    const arms = parsed.stints
      .filter((st) => st.isPitcher && !st.isVariant && st.cid != null)
      .map((st) => ({ cid: st.cid!, ratings: st.ratings }));
    const r = await score(arms);
    console.log(line(label, r) + `   (${name})`);
    if (!ok(r)) {
      console.log(`    ✗ Control does not match the shop: this checkout's parser is not the fixed one.`);
      failed++;
    }

    const snap = snaps.find((s) => s.league === parsed.league && s.split === parsed.split);
    if (!snap) { console.log(`    ✗ nothing stored for ${label} on ${WEEK} to compare against`); failed++; continue; }
    const stored = asRows<{ cid: number | null; org: string; pos: string; pa: number; ip: number }>(await db.execute(sql`
      select cid, org, pos, pa, ip from league_stints where snapshot_id = ${snap.id}`));
    const key = (x: { cid: number | null; org: string; pos: string; pa: number; ip: number }) =>
      `${x.cid}|${x.org}|${x.pos}|${x.pa}|${Number(x.ip).toFixed(2)}`;
    const want = new Map<string, number>();
    for (const x of stored) want.set(key(x), (want.get(key(x)) ?? 0) + 1);
    let same = 0;
    for (const st of parsed.stints as LeagueStint[]) {
      const k = key(st);
      const left = want.get(k) ?? 0;
      if (left > 0) { same++; want.set(k, left - 1); }
    }
    const identical = same === stored.length && same === parsed.stints.length;
    console.log(
      `    ${identical ? "✓" : "✗"} ${same} of ${parsed.stints.length} rows match the ${stored.length} stored for ${label} ${WEEK}` +
      (identical ? " — the same export" : " — not the export that was imported"),
    );
    if (!identical) failed++;
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
