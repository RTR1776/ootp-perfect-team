/**
 * Observed-data coverage for every running, non-draft tournament — and which
 * OLDER series (retired, renamed, pre-refresh) sit in a similar enough run
 * environment to supplement it.
 *
 *   node scripts/tourney-inventory.mjs && pnpm coverage        (from web/)
 *   → scripts/.coverage.json + ../Docs/Tourney Data Coverage <today>.md
 *
 * "Current rules" cut-offs (from Tourney Data/refresh-2026-09.json +
 * scripts/slot-map.json _cutover): Silver refreshed 2026-09 (first new daily
 * run 171), Bronze/Iron ~2026-08-26 (run 165). Gold, Diamond, Open, Live and
 * Cap have not been refreshed yet, so every file of theirs is current — until
 * their refresh lands, when they too become donor data for whatever the new
 * environment turns out to be.
 *
 * Similarity = the /environments offense-shape distance (R/G, K, HR, 1B, 2B
 * per PA, z-scored across the catalog) between the two events' era+park
 * solves, gated on the card-value window overlapping (a Bronze donor cannot
 * speak for a Diamond field however alike the parks are). Needs DATABASE_URL.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_LOCAL = resolve(__dirname, "..", ".env.local");
if (!process.env.DATABASE_URL && existsSync(ENV_LOCAL)) {
  for (const line of readFileSync(ENV_LOCAL, "utf8").split("\n")) {
    const i = line.indexOf("="); if (i < 0 || line.trimStart().startsWith("#")) continue;
    const k = line.slice(0, i).trim(); if (!process.env[k]) process.env[k] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}

import { sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { OFFENSE_KEYS, distance, eraFor, parkFor, solveFor, spreads, vectorOf, type EnvVector } from "../src/lib/analytics/tournament-env";

const ROOT = resolve(__dirname, "..", "..");
const INV = resolve(__dirname, ".inventory.json");
const DEST = resolve(ROOT, "Archive/Completed");
const TODAY = new Date().toISOString().slice(0, 10);

/** When each tier's refresh took effect. Tiers not listed have not been refreshed. */
const CUTOFF_DATE: Record<string, string | null> = { Silver: "2026-09-01", Bronze: "2026-08-26", Iron: "2026-08-26" };

/**
 * Which events the refresh actually CHANGED, from the refresh record: a
 * rename (the slot now runs a different tournament) or "now at <park>" (a park
 * move). An entry that merely restates the rules (Late Silver: "1992 RE, DH
 * on, 1992 Camden Yards" - same as before) leaves its history valid.
 * Returns slug -> "renamed" | "moved"; files under a renamed slot's OLD slug
 * are all pre-refresh, files under a moved event count only from the cutoff.
 */
function refreshChanges(): Map<string, "renamed" | "renamed-old" | "moved"> {
  const out = new Map<string, "renamed" | "renamed-old" | "moved">();
  const rf = resolve(ROOT, "Tourney Data/refresh-2026-09.json"), sm = resolve(__dirname, "slot-map.json");
  if (!existsSync(rf) || !existsSync(sm)) return out;
  const refresh = JSON.parse(readFileSync(rf, "utf8")) as Record<string, Record<string, { old?: string; new?: string | null; text?: string }>>;
  const slots = JSON.parse(readFileSync(sm, "utf8")) as Record<string, unknown> & { _cutover?: { renames?: Record<string, { old?: string; new?: string }> } };
  const renames = slots._cutover?.renames ?? {};
  for (const tier of ["silver", "bronze", "iron"]) {
    for (const [slot, e] of Object.entries(refresh[tier] ?? {})) {
      const slug = typeof slots[slot] === "string" ? (slots[slot] as string) : null;
      if (e.new) {
        if (slug) out.set(slug, "renamed");                       // the NEW slug: every file under it post-dates the rename
        const old = renames[slot]?.old; if (old) out.set(old, "renamed-old"); // the OLD slug: every file is pre-refresh
      } else if (/^now at /i.test(e.text ?? "") && slug) out.set(slug, "moved");
    }
  }
  return out;
}
const CHANGED = refreshChanges();

interface InvRow { tier: string; isDraft: boolean; name: string; ptid: string; series: string | null; cadence: string; runsOnFile: number; filesOnDisk: number; latestRun: number | null; latestDate: string | null; daysBehind: number | null; missingCount: number; numbering: string; retired: string; grabIds: string; cap: string; field: number; entries: number; pts: number; inCatalog: string }

async function main() {
  if (!existsSync(INV)) throw new Error("run node scripts/tourney-inventory.mjs first");
  const inv = JSON.parse(readFileSync(INV, "utf8")) as { tourneys: InvRow[]; today: string; window: number };
  const unwrap = (r: unknown): Record<string, unknown>[] => (Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows);
  const trs = unwrap(await db.execute(sql`select id, name, series, env_year, stadium, dh, mode, entrants, ratings_min, ratings_max, card_year_min, card_year_max, restrictions, retired, is_draft from tournaments`)) as unknown as { id: number; name: string; series: string | null; env_year: number | null; stadium: string | null; dh: boolean | null; mode: string | null; entrants: number | null; ratings_min: number | null; ratings_max: number | null; card_year_min: number | null; card_year_max: number | null; restrictions: Record<string, unknown> | null; retired: boolean; is_draft: boolean }[];
  const obs = new Map((unwrap(await db.execute(sql`select series, count(*)::int cards, sum(pa)::int pa, round(sum(ip))::int ip, sum(instances)::int stints from observed_card_stats group by series`)) as unknown as { series: string; cards: number; pa: number; ip: number; stints: number }[]).map((r) => [r.series, r]));

  // files on disk per series with run numbers
  const disk = new Map<string, number[]>();
  for (const f of readdirSync(DEST)) { const m = /^(.+)_(\d+)\.csv$/i.exec(f); if (m) disk.set(m[1], [...(disk.get(m[1]) ?? []), +m[2]].sort((a, b) => a - b)); }

  // environment vectors for every catalog row that has an era
  const byName = new Map(trs.map((t) => [t.name, t]));
  const bySeries = new Map<string, typeof trs[number]>();
  for (const t of trs) if (t.series && !bySeries.has(t.series)) bySeries.set(t.series, t);
  const vec = new Map<number, EnvVector>();
  for (const t of trs) {
    const era = eraFor(t.env_year); if (!era) continue;
    vec.set(t.id, vectorOf(solveFor(era.row, parkFor(t.stadium).row)));
  }
  const sd = spreads([...vec.values()], OFFENSE_KEYS);

  // Jaccard overlap of the two card-value windows (an unlisted bound = the
  // shop's real range, 10-102), so an open field is not a perfect donor for
  // a capped one just because it contains it.
  const overlap = (a: typeof trs[number], b: typeof trs[number]) => {
    const A: [number, number] = [a.ratings_min ?? 10, a.ratings_max ?? 102], B: [number, number] = [b.ratings_min ?? 10, b.ratings_max ?? 102];
    const inter = Math.max(0, Math.min(A[1], B[1]) - Math.max(A[0], B[0]));
    const union = Math.max(A[1], B[1]) - Math.min(A[0], B[0]);
    return union > 0 ? inter / union : 0;
  };

  type Out = InvRow & {
    id: number | null; envYear: number | null; stadium: string | null; dh: boolean | null; mode: string | null; slots: string | null; teamCap: number | null;
    cards: number; pa: number; ip: number; stints: number;
    currentFiles: number; currentRuns: string; preRefreshFiles: number; refreshed: boolean; change: "renamed" | "renamed-old" | "moved" | null; rg: number | null; kPct: number | null; hrPct: number | null;
    status: "good" | "thin" | "stale" | "none" | "pre-refresh-only"; why: string;
    donors: { series: string; name: string; files: number; dist: number; env: string; overlap: number }[];
  };
  const out: Out[] = [];
  for (const r of inv.tourneys) {
    if (r.isDraft || r.retired) continue;
    const t = (r.series && bySeries.get(r.series)) || byName.get(r.name) || null;
    const runs = r.series ? disk.get(r.series) ?? [] : [];
    const cutDate = CUTOFF_DATE[r.tier] ?? null;
    const isDaily = r.cadence === "daily";
    // Date each file off the event's OWN ladder (latest run ↔ latest date,
    // one run per day or per week): series keep their own counters, so a run
    // number alone says nothing about when it ran.
    const period = isDaily ? 1 : 7;
    const dateOf = (run: number): string | null => {
      if (r.latestRun == null || !r.latestDate) return null;
      const d = new Date(r.latestDate); d.setUTCDate(d.getUTCDate() - (r.latestRun - run) * period);
      return d.toISOString().slice(0, 10);
    };
    const change = r.series ? CHANGED.get(r.series) ?? null : null;
    // renamed: files under the old slug are all pre-refresh; the new slug's rows in the
    // catalog carry the new rules and the old slug is never the series of a running event
    // - but when the filer kept filing under the old slug after the rename, date them.
    const current = cutDate == null || !change || change === "renamed" ? runs
      : change === "renamed-old" ? []
      : runs.filter((n) => { const d = dateOf(n); return d == null ? false : d >= cutDate; });
    const pre = runs.length - current.length;
    const cut = change ? cutDate : null;
    const o = r.series ? obs.get(r.series) : undefined;
    const v = t ? vec.get(t.id) : undefined;
    let status: Out["status"], why: string;
    const days = r.daysBehind ?? 999;
    if (!runs.length) { status = "none"; why = "no export on file"; }
    else if (!current.length) { status = "pre-refresh-only"; why = `${pre} file(s), all before this event was ${change === "renamed-old" ? "renamed" : change} in the ${r.tier} refresh (${CUTOFF_DATE[r.tier]})`; }
    else if (current.length >= 5 && days <= 14) { status = "good"; why = `${current.length} current runs, newest ${days}d ago`; }
    else if (current.length >= 5) { status = "stale"; why = `${current.length} current runs but newest is ${days}d old`; }
    else { status = "thin"; why = `${current.length} current run(s)${pre ? ` (+${pre} pre-refresh)` : ""}, newest ${days}d ago`; }
    if (cut != null && runs.length && r.numbering !== "matches") why += ` · file numbers ${r.numbering}: pre/post split is approximate`;

    // donors: any series with files, similar env, overlapping window, not itself
    const donors: Out["donors"] = [];
    if (t && v) {
      for (const [series, files] of disk) {
        if (series === r.series) continue;
        const d = bySeries.get(series); if (!d) continue;
        const dv = vec.get(d.id); if (!dv) continue;
        const ov = overlap(t, d); if (ov < 0.5) continue;
        const dist = distance(v, dv, OFFENSE_KEYS, sd);
        if (dist > 1.25) continue;
        donors.push({ series, name: d.name, files: files.length, dist: Math.round(dist * 100) / 100, env: `${d.env_year ?? "?"} · ${d.stadium ?? "?"}`, overlap: Math.round(ov * 100) / 100 });
      }
      donors.sort((a, b) => a.dist - b.dist);
    }
    out.push({
      ...r, id: t?.id ?? null, envYear: t?.env_year ?? null, stadium: t?.stadium ?? null, dh: t?.dh ?? null, mode: t?.mode ?? null,
      slots: t?.restrictions?.slots ? Object.entries(t.restrictions.slots as Record<string, number>).map(([k, n]) => `${k}${n}`).join(" ") : null,
      teamCap: (t?.restrictions?.teamCap as number | null) ?? null,
      cards: o?.cards ?? 0, pa: o?.pa ?? 0, ip: o?.ip ?? 0, stints: o?.stints ?? 0,
      currentFiles: current.length, currentRuns: current.join(","), preRefreshFiles: pre, refreshed: cut != null, change,
      rg: v ? Math.round(v.rg * 100) / 100 : null, kPct: v ? Math.round(v.k * 1000) / 10 : null, hrPct: v ? Math.round(v.hr * 1000) / 10 : null,
      status, why, donors: donors.slice(0, 4),
    });
  }
  const tierOrder = ["Diamond", "Gold", "Silver", "Bronze", "Iron", "Open", "Live", "Cap", "Other"];
  out.sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier) || b.currentFiles - a.currentFiles || b.entries - a.entries);
  writeFileSync(resolve(__dirname, ".coverage.json"), JSON.stringify({ today: TODAY, window: inv.window, cutoffs: CUTOFF_DATE, rows: out }, null, 1));

  // ---- markdown
  const md: string[] = [`# Tourney data coverage — ${TODAY}`, "",
    `Running, non-draft events only (${out.length}). "Current" = files under the rules in force now. The Silver (Sep 1) and Bronze/Iron (Aug 26) refreshes only invalidate the history of events they RENAMED or MOVED to a new park; an event whose rules were merely restated (Late Silver, Silver Slots) keeps its files. Gold/Diamond/Open/Live/Cap have not been refreshed, so all of their files count — until their refresh lands, when the same rule will apply to them. OOTP serves only the last ${inv.window} days of runs, so "grab" ids are what can still be exported today. Donors = other series on disk whose era+park land within 1.25 SD of this event's offense shape AND whose card window overlaps at least half of this one's.`, ""];
  const counts: Record<string, number> = {}; for (const r of out) counts[r.status] = (counts[r.status] ?? 0) + 1;
  md.push(`**Status:** ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(" · ")}`, "");
  for (const tier of tierOrder) {
    const rs = out.filter((r) => r.tier === tier); if (!rs.length) continue;
    const c: Record<string, number> = {}; for (const r of rs) c[r.status] = (c[r.status] ?? 0) + 1;
    md.push(`## ${tier} (${rs.length}) — ${Object.entries(c).map(([k, n]) => `${k} ${n}`).join(", ")}`, "",
      "| Event | Env | Cap / rules | Field | Entries | Current runs | Pre-refresh | Card rows / PA | Newest | Grab now | Status | Refresh | Best donors (dist) |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|");
    for (const r of rs) {
      const env = `${r.envYear ?? "?"} · ${r.stadium ?? "?"}${r.dh === true ? " · DH" : r.dh === false ? " · no DH" : ""}`;
      const rules = [r.cap, r.slots ? `slots ${r.slots}` : null, r.teamCap ? `cap ${r.teamCap}` : null].filter(Boolean).join(" · ");
      const donors = r.donors.slice(0, 3).map((d) => `${d.name} ×${d.files} (${d.dist})`).join("; ");
      md.push(`| ${r.name} | ${env} | ${rules} | ${r.field || ""} | ${r.entries || ""} | ${r.currentFiles} | ${r.preRefreshFiles || ""} | ${r.cards ? `${r.cards} / ${r.pa.toLocaleString()}` : ""} | ${r.latestDate ? `${r.latestDate} (${r.daysBehind}d)` : ""} | ${r.missingCount || ""} | **${r.status}** | ${r.change === "renamed" ? "renamed (files are post-refresh)" : r.change === "renamed-old" ? "old name" : r.change ?? (CUTOFF_DATE[r.tier] ? "unchanged" : "not yet")} | ${donors} |`);
    }
    md.push("");
  }
  const docsDir = resolve(ROOT, "Docs");
  const mdPath = resolve(docsDir, `Tourney Data Coverage ${TODAY}.md`);
  writeFileSync(mdPath, md.join("\n"));
  console.log(`wrote ${mdPath}`);
  console.log(`status: ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(" · ")}`);
  for (const tier of tierOrder) {
    const rs = out.filter((r) => r.tier === tier); if (!rs.length) continue;
    console.log(`  ${tier.padEnd(8)} ${rs.length.toString().padStart(3)} events · good ${rs.filter((r) => r.status === "good").length} · stale ${rs.filter((r) => r.status === "stale").length} · thin ${rs.filter((r) => r.status === "thin").length} · pre-refresh-only ${rs.filter((r) => r.status === "pre-refresh-only").length} · none ${rs.filter((r) => r.status === "none").length}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
