/**
 * What the PTCS berth line will END at, projected from where it is now —
 * the newest dump's 128th-place total grown by how the same line grew from
 * day N in PTCS 5 and PTCS 6. The method lives in lib/ptcs-projection.ts.
 *
 *   pnpm cutoff:project [--day N] [--write]
 *
 * --write makes this the line everywhere: it stores the projection (with
 * cwhit's board beside it) in src/data/ptcs-lines.json for /ptcs, and sets the
 * period's targets in the database. load:dumps runs it after every dump.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { projectCutoffs, readCwhitTargets, type StoredLines } from "@/lib/ptcs-projection";
import { todayInChicago } from "@/lib/ptcs-progress";

const PERIOD = { name: "PTCS 7", start: "2026-09-07", end: "2026-10-04" };
const argv = process.argv.slice(2);
const raw = (() => { const i = argv.indexOf("--day"); return i >= 0 ? argv[i + 1] : undefined; })();
if (argv.includes("--day") && !/^\d+$/.test(raw ?? "")) { console.error(`--day takes a whole number of days, got ${raw === undefined ? "nothing" : JSON.stringify(raw)}`); process.exit(1); }
const WRITE = argv.includes("--write");
if (WRITE && raw !== undefined) { console.error("--write stores the line the dumps support; drop --day"); process.exit(1); }

async function main() {
  const p = projectCutoffs({ period: PERIOD, dir: join(process.cwd(), "..", "Tourney Data"), day: raw !== undefined ? Number(raw) : undefined });
  const cwhit = readCwhitTargets(join(process.cwd(), "..", "reference", "cwhit"));
  const N = p.day;

  console.log(`\n${PERIOD.name} · day ${N} of ${p.periodDays} · where the line is now and where it lands\n`);
  const forced = raw !== undefined && N !== p.dumpDay;
  if (forced) console.log(`  day ${N} ← --day${Number(raw) === N ? "" : ` (clamped from ${raw})`}, overriding the day ${p.dumpDay} the dumps reach`);
  console.log(`  ${forced ? "dumps  " : `day ${N} ←`} ${p.binding.file} (${p.binding.kind}, reaches ${p.binding.reach})`);
  for (const s of p.sources) if (s.file !== p.binding.file) console.log(`  also    ${s.file} (${s.kind}, reaches ${s.reach})`);
  const today = todayInChicago();
  const calendarDay = Math.min(p.periodDays, Math.max(1, Math.round((Date.parse(today) - Date.parse(PERIOD.start)) / 864e5) + 1));
  if (p.dumpDay < 1) console.log(`  ⚠ the newest dump ends BEFORE ${PERIOD.name} opened — there is no day-N read here at all`);
  else if (calendarDay > p.dumpDay) console.log(`  ⚠ today is ${today}, day ${calendarDay} — the dump stops at day ${p.dumpDay}, ${calendarDay - p.dumpDay} day(s) back, and so does every line below`);
  if (p.sources[0].reach !== p.sources[1].reach) console.log(`  ⚠ the two dumps end on different days; the earlier one sets N`);
  console.log();
  console.log(`  category     you  rank   line now |  P5 d${N} → P5 end  ×    |  P6 scaled ×  |  PROJECTED   cwhit  verdict`);
  for (const l of p.lines) {
    const verdict = l.rank == null ? "not entered"
      : l.rank <= 128 ? `IN now, ${l.you >= l.projected ? "already past the projected line" : `needs ${l.projected - l.you} more`}`
      : `out — ${l.projected - l.you} short of the projection`;
    const cw = cwhit?.lines[l.category];
    console.log(`  ${l.category.padEnd(11)} ${String(l.you).padStart(4)} ${String(l.rank ?? "—").padStart(5)} ${String(l.now).padStart(9)} | ` +
      `${String(l.p5.atN).padStart(5)} →${String(l.p5.end).padStart(5)} ${l.p5.mult.toFixed(2).padStart(6)} | ` +
      `${l.p6.mult.toFixed(2).padStart(12)} | ${String(l.projected).padStart(9)}  ${String(cw ?? "—").padStart(6)}  ${verdict}`);
  }
  console.log(`\n  "line now" is the 128th-place total through day ${N} of ${p.periodDays} (${p.binding.reach}), so it is small by`);
  console.log(`  construction. The multiplier is how much that same line grew from day ${N} over the rest of PTCS 5`);
  console.log(`  (the same 28-day shape) averaged with PTCS 6 rescaled to ${p.periodDays} days.`);
  console.log(cwhit ? `  cwhit is his projected cutoff (${cwhit.file}), shown for comparison.\n` : `  No cwhit board transcribed under reference/cwhit/.\n`);

  if (!WRITE) return;
  const projected = Object.fromEntries(p.lines.map((l) => [l.category, l.projected]));
  const stored: StoredLines = {
    period: PERIOD.name, day: N, periodDays: p.periodDays, dumpReach: p.binding.reach, dumpFile: p.binding.file,
    writtenOn: today, projected, cwhit,
  };
  const out = join(process.cwd(), "src", "data", "ptcs-lines.json");
  writeFileSync(out, JSON.stringify(stored, null, 2) + "\n");
  console.log(`  wrote src/data/ptcs-lines.json (commit it so /ptcs shows cwhit beside the line)`);
  // The database only when asked to write, so a plain read runs without .env.local.
  const { db } = await import("@/db/client");
  const { periods } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const upd = await db.update(periods).set({ targets: projected, targetsAreOfficial: false })
    .where(eq(periods.startsOn, PERIOD.start)).returning({ id: periods.id });
  console.log(upd.length ? `  set ${PERIOD.name} targets to the projection (period ${upd[0].id})\n` : `  ⚠ no period starts ${PERIOD.start} — targets not written\n`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
