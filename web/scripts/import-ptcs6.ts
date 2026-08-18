/**
 * Backfill the PTCS 6 qualifying history that predates the app.
 *
 *   pnpm import:ptcs6
 *
 * Source is `src/db/seed/ptcs6-history.json`, extracted once from the Daily Log
 * sheet of PTCS6 Tracker.xlsx. It is checked in deliberately: the spreadsheet
 * holds day × category totals with no per-event rows and no event ids, so there
 * is nothing to re-derive later and no reason to keep a spreadsheet parser in
 * the app. The JSON is now the record.
 *
 * Idempotent — a unique index on (period, day, category) means re-running
 * overwrites rather than duplicating.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { dailyTotals, periods } from "../src/db/schema";
import { CATEGORIES } from "../src/lib/ingest/constants";

interface History {
  period: {
    name: string;
    startsOn: string;
    endsOn: string;
    targets: Record<string, number>;
    targetsAreOfficial: boolean;
  };
  days: Array<{ date: string; points: Record<string, number>; note: string }>;
}

async function main() {
  const path = join(process.cwd(), "src/db/seed/ptcs6-history.json");
  const history = JSON.parse(readFileSync(path, "utf8")) as History;

  const unknown = Object.keys(history.period.targets).filter(
    (c) => !(CATEGORIES as readonly string[]).includes(c),
  );
  if (unknown.length) throw new Error(`Unknown categories in targets: ${unknown.join(", ")}`);

  /* Period — matched on name so a re-run updates rather than duplicates. */
  const existing = await db
    .select({ id: periods.id })
    .from(periods)
    .where(eq(periods.name, history.period.name));

  let periodId: number;
  if (existing.length > 0) {
    periodId = existing[0].id;
    await db
      .update(periods)
      .set({
        startsOn: history.period.startsOn,
        endsOn: history.period.endsOn,
        targets: history.period.targets,
        targetsAreOfficial: history.period.targetsAreOfficial,
      })
      .where(eq(periods.id, periodId));
  } else {
    const [row] = await db
      .insert(periods)
      .values({
        name: history.period.name,
        startsOn: history.period.startsOn,
        endsOn: history.period.endsOn,
        targets: history.period.targets,
        targetsAreOfficial: history.period.targetsAreOfficial,
      })
      .returning({ id: periods.id });
    periodId = row.id;
  }

  /* Days. A zero is meaningful — it records that the day was logged and scored
     nothing — so zeros are written rather than skipped. */
  const rows = history.days.flatMap((day) =>
    CATEGORIES.map((category) => ({
      periodId,
      occurredOn: day.date,
      category,
      points: day.points[category] ?? 0,
      note: day.note || null,
      source: "import" as const,
    })),
  );

  for (let i = 0; i < rows.length; i += 500) {
    await db
      .insert(dailyTotals)
      .values(rows.slice(i, i + 500))
      .onConflictDoUpdate({
        target: [dailyTotals.periodId, dailyTotals.occurredOn, dailyTotals.category],
        set: { points: sql`excluded.points`, note: sql`excluded.note` },
      });
  }

  /* Report — totals per category against target, worst gap first. */
  const totals = await db
    .select({
      category: dailyTotals.category,
      points: sql<number>`sum(${dailyTotals.points})::int`,
    })
    .from(dailyTotals)
    .where(and(eq(dailyTotals.periodId, periodId), eq(dailyTotals.source, "import")))
    .groupBy(dailyTotals.category);

  const byCategory = new Map(totals.map((t) => [t.category, Number(t.points)]));

  const start = new Date(`${history.period.startsOn}T00:00:00Z`);
  const end = new Date(`${history.period.endsOn}T00:00:00Z`);
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const elapsed = history.days.length;

  console.log(
    `\n${history.period.name} — ${history.period.startsOn} to ${history.period.endsOn}` +
      `  (day ${elapsed} of ${totalDays})\n`,
  );
  console.log(
    "  category      points  target    gap   /day needed   on pace for  (targets are " +
      (history.period.targetsAreOfficial ? "official)" : "ESTIMATES)"),
  );
  console.log("  " + "-".repeat(76));

  const ranked = CATEGORIES.map((category) => {
    const points = byCategory.get(category) ?? 0;
    const target = history.period.targets[category] ?? 0;
    const gap = Math.max(0, target - points);
    const remaining = Math.max(1, totalDays - elapsed);
    return { category, points, target, gap, perDay: gap / remaining, pace: (points / elapsed) * totalDays };
  }).sort((a, b) => b.perDay - a.perDay);

  for (const r of ranked) {
    const flag = r.gap === 0 ? "QUALIFIED" : r.pace >= r.target ? "on pace" : "BEHIND";
    console.log(
      `  ${r.category.padEnd(12)}${String(r.points).padStart(7)}` +
        `${String(r.target).padStart(8)}${String(r.gap).padStart(7)}` +
        `${r.perDay.toFixed(1).padStart(13)}${r.pace.toFixed(0).padStart(13)}   ${flag}`,
    );
  }

  const totalPoints = ranked.reduce((sum, r) => sum + r.points, 0);
  const totalGap = ranked.reduce((sum, r) => sum + r.gap, 0);
  console.log("  " + "-".repeat(76));
  console.log(
    `  ${"TOTAL".padEnd(12)}${String(totalPoints).padStart(7)}` +
      `${String(ranked.reduce((s, r) => s + r.target, 0)).padStart(8)}` +
      `${String(totalGap).padStart(7)}` +
      `${(totalGap / Math.max(1, totalDays - elapsed)).toFixed(1).padStart(13)}`,
  );
  console.log(
    `\n  ${rows.length} rows written across ${elapsed} days. ` +
      `Demonstrated rate ${(totalPoints / elapsed).toFixed(1)}/day.\n`,
  );
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
