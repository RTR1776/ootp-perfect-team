/**
 * PTCS — the qualifying command center.
 *
 * Answers "which categories need points, and when can I stop?" first: each
 * category against our projected line and cwhit's, with a safe mark past the
 * higher one (lib/ptcs-progress). Then result entry; the dump snapshot, the
 * daily log and the history sit folded below.
 *
 * Data: `periods` + three sources of points, merged by lib/result-ledger so
 * no event or day counts twice - `daily_totals` (the PTCS 6 tracker history,
 * imported), `results` (the per-event ledger written by result entry on this
 * page, keyed by event id) and `my_results` (every entry the community dump
 * saw; one never logged here still counts). Plus the static ladder record in
 * `src/data/ptcs-ladder.json`.
 */

import Link from "next/link";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { dailyTotals, myResults, periods, results, uploads } from "@/db/schema";
import type { DumpStandings } from "@/lib/analytics/dumps";
import LADDER from "@/data/ptcs-ladder.json";
import STORED_LINES from "@/data/ptcs-lines.json";
import type { StoredLines } from "@/lib/ptcs-projection";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ResultEntry } from "@/components/result-entry";
import { cn } from "@/lib/utils";
import { daysAgo, range } from "@/lib/format";
import { CATEGORIES } from "@/lib/ingest/constants";
import {
  FORECAST_MIN_DAYS, NOT_PLAYING_FROM_DAY, SAFE_MARGIN,
  lastDataIndex, periodCalendar, standings, todayInChicago, verdictLabel, type StandingRow, type Verdict,
} from "@/lib/ptcs-progress";
import { dumpEvent, mergeDays, type LedgerEvent } from "@/lib/result-ledger";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";

export const dynamic = "force-dynamic";

const CHIP: Record<Verdict, string> = {
  safe: "border-positive/50 text-positive",
  "to-safe": "border-foreground/30 text-foreground",
  "on-pace": "border-border text-foreground",
  behind: "border-warning/50 text-warning",
  "not-playing": "border-border text-muted-foreground",
  "no-line": "border-border text-muted-foreground",
};
const BAR: Record<Verdict, string> = {
  safe: "bg-positive",
  "to-safe": "bg-positive/45",
  "on-pace": "bg-foreground/45",
  behind: "bg-warning",
  "not-playing": "bg-muted-foreground/40",
  "no-line": "bg-muted-foreground/40",
};

/** "MM-DD" from an ISO date. */
const md = (iso: string) => iso.slice(5, 10);

export default async function PtcsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period: periodParam } = await searchParams;
  const allPeriods = await db.select().from(periods).orderBy(desc(periods.startsOn));
  const now = todayInChicago();
  // The period in play today; a ?period=<id> link shows a past one; else the latest.
  const period =
    allPeriods.find((p) => String(p.id) === periodParam) ??
    allPeriods.find((p) => p.startsOn <= now && now <= p.endsOn) ??
    allPeriods[0];
  if (!period) {
    return (
      <EmptyState
        icon="ptcs"
        title="PTCS"
        description="The qualifying command center — category standings, pace, and the championship ladder. It starts once a qualifying period exists."
        hint={<>From a terminal: <code className="font-mono">pnpm period:new &quot;PTCS 8&quot; START END</code></>}
      />
    );
  }

  const rows = await db
    .select()
    .from(dailyTotals)
    .where(eq(dailyTotals.periodId, period.id))
    .orderBy(asc(dailyTotals.occurredOn));
  // The per-event ledger for this period - what result entry writes.
  const ledger = await db
    .select()
    .from(results)
    .where(eq(results.periodId, period.id))
    .orderBy(desc(results.occurredOn), desc(results.id));
  const events: LedgerEvent[] = ledger.map((r) => ({
    eventId: r.eventId, name: r.name, occurredOn: r.occurredOn, categories: r.categories,
    points: r.points, fieldSize: r.fieldSize, placement: r.placement, eliminated: r.eliminated,
  }));

  // Latest community-dump standings, one per source (tournaments / drafts).
  const dumpUploads = await db
    .select({ report: uploads.report, uploadedAt: uploads.uploadedAt, filename: uploads.filename })
    .from(uploads)
    .where(and(
      eq(uploads.kind, "dump"),
      sql`${uploads.report}->'standings'->'window'->>'start' = ${period.startsOn}`,
      sql`${uploads.report}->'standings'->'window'->>'end' = ${period.endsOn}`,
    ))
    .orderBy(desc(uploads.uploadedAt), desc(uploads.id))
    .limit(10);
  const latestBySource = new Map<string, { standings: DumpStandings; dateMax: string }>();
  for (const u of dumpUploads) {
    const rep = u.report as { source?: string; dateMax?: string; standings?: DumpStandings } | null;
    if (rep?.source && rep.standings && !latestBySource.has(rep.source)) {
      latestBySource.set(rep.source, { standings: rep.standings, dateMax: rep.dateMax ?? "?" });
    }
  }
  const berthRows: { cat: string; pts: number; rank: number | null; scored: number; line: number; dateMax: string }[] = [];
  const pdSrc = latestBySource.get("drafts");
  const tourSrc = latestBySource.get("tournaments");
  for (const [cat, src] of [
    ["Diamond", tourSrc], ["Bronze", tourSrc], ["Silver", tourSrc], ["Gold", tourSrc],
    ["Cap", tourSrc], ["Open", tourSrc], ["Iron", tourSrc],
    ["PD Daily", pdSrc], ["PD Weekly", pdSrc],
  ] as const) {
    const c = src?.standings.categories[cat];
    if (c) berthRows.push({ cat, pts: c.pts, rank: c.rank, scored: c.scored, line: c.lines.l128, dateMax: src!.dateMax });
  }
  // The staler of the two dumps is how far the snapshot reaches.
  const snapshotThru = berthRows.map((r) => r.dateMax).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()[0] ?? null;
  const snapshotDay = snapshotThru ? Math.round((Date.parse(snapshotThru) - Date.parse(period.startsOn)) / 864e5) + 1 : null;

  // Every entry in the community record (import:myresults): the History fold,
  // and this period's events that were never logged here.
  const myRows = await db.select().from(myResults).orderBy(desc(myResults.startAt));
  interface SeriesAgg { name: string; entries: number; points: number; best: number; top16: number; last: Date }
  const bySeries = new Map<string, SeriesAgg>();
  for (const r of myRows) {
    const a = bySeries.get(r.name) ?? { name: r.name, entries: 0, points: 0, best: 999, top16: 0, last: r.startAt };
    a.entries++; a.points += r.points; a.best = Math.min(a.best, r.finish);
    if (r.finish <= 16) a.top16++;
    if (r.startAt > a.last) a.last = r.startAt;
    bySeries.set(r.name, a);
  }
  const seriesAgg = [...bySeries.values()].sort((a, b) => b.points - a.points);
  const totalEntries = myRows.length;
  const totalPoints = myRows.reduce((s, r) => s + r.points, 0);
  const wins = myRows.filter((r) => r.finish === 1).length;
  const recent = myRows.slice(0, 14);
  const dumpEvents = myRows
    .filter((r) => r.categories !== "")
    .map(dumpEvent)
    .filter((e) => period.startsOn <= e.occurredOn && e.occurredOn <= period.endsOn);

  const { today, dates, totalDays, elapsed, daysLeft, finished } = periodCalendar(period.startsOn, period.endsOn);
  // One source per day for the imported tracker; logged events and the dump's
  // never-logged ones count together, each event once.
  const days = mergeDays(
    dates, CATEGORIES,
    rows.map((r) => ({ occurredOn: r.occurredOn, category: r.category, points: r.points, note: r.note })),
    [...events, ...dumpEvents],
  );
  const byDate = new Map(days.map((d) => [d.date, d]));
  const conflicts = days.filter((d) => d.conflict);
  const loggedDays = days.filter((d) => d.source === "results").length;
  const dumpDays = days.filter((d) => d.source === "dump").length;
  const importDays = days.filter((d) => d.source === "import").length;
  // The dump events that count: never logged, and not on an imported day. Newest first.
  const unlogged = days.flatMap((d) => d.events.filter((e) => e.source === "dump")).reverse();
  const unloggedByCat = new Map<string, number>();
  for (const e of unlogged) for (const c of e.categories) unloggedByCat.set(c, (unloggedByCat.get(c) ?? 0) + e.points);
  const unloggedSummary = [...unloggedByCat].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([c, v]) => `+${v} ${c}`).join(", ");

  const targets = (period.targets ?? {}) as Record<string, number>;
  // Our line is the dump projection (`pnpm cutoff:project --write` sets the
  // targets above and this file together); cwhit's board rides beside it.
  const stored = STORED_LINES as StoredLines;
  const projection = stored.period === period.name ? stored : null;
  const cwhit = projection?.cwhit ?? null;
  const cwhitDate = cwhit?.file.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;

  const board = standings(days, CATEGORIES, {
    totalDays, daysLeft, dayIndex: elapsed, ourLines: targets, cwhitLines: cwhit?.lines ?? null,
  });
  const safe = board.filter((r) => r.verdict === "safe");
  const toPlay = board.filter((r) => r.verdict !== "safe" && r.verdict !== "not-playing");
  const lastIdx = lastDataIndex(days);
  const dataThru = lastIdx >= 0 ? dates[lastIdx] : null;

  // Freshness: how current the totals and the lines are.
  const lastLogged = events[0]?.occurredOn ?? null;
  const loggedAge = lastLogged ? daysAgo(lastLogged) : null;
  const notLogged = days.filter((d) => d.date < today && d.source === "none").length;
  const dumpAge = projection ? daysAgo(projection.dumpReach) : null;
  const stale = (loggedAge == null ? elapsed > 1 : loggedAge > 1) || (dumpAge != null && dumpAge > 5);

  const ladder = LADDER as unknown as {
    pointsTable: Record<string, number>;
    finishes: Array<{
      event: string;
      date: string;
      berths: Array<{ berth: string; standing: string; placement: string; points: number }>;
      tournamentPts: number;
      draftPts: number;
      note: string;
    }>;
    ladderRules: Record<string, string>;
  };
  const cumT = ladder.finishes.reduce((s, f) => s + f.tournamentPts, 0);
  const cumD = ladder.finishes.reduce((s, f) => s + f.draftPts, 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="PTCS qualifying"
        title={period.name}
        description={<>
          {range(period.startsOn, period.endsOn)} · {finished ? "finished" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`} · feeds PTWC 2
        </>}
        about={<>
          <p>
            <strong className="text-foreground">Our line</strong>{" "}
            {period.targetsAreOfficial
              ? "is the official cutoff."
              : projection
                ? `is the projected final 128th-place line: the day-${projection.day} dump (through ${md(projection.dumpReach)}) grown the way PTCS 5 and 6 grew from the same day.`
                : "is an estimate; run pnpm cutoff:project --write after a dump."}
            {cwhit && <> <strong className="text-foreground">cwhit line</strong> is his projected cutoff ({cwhit.file}).</>}
          </p>
          <p>
            <strong className="text-foreground">Safe at</strong> is the higher of the two lines plus {Math.round(SAFE_MARGIN * 100)}%, rounded up.
            Past it, stop feeding that category. <strong className="text-foreground">Still to get</strong> is the points from here to there.
          </p>
          <p>
            Totals count every result logged here, plus each entry in the community dump that was never logged (matched by event id).
            The dump never counts on a day the imported tracker covers.
          </p>
          <p>
            <strong className="text-foreground">Projected</strong> appears once a category has {FORECAST_MIN_DAYS} scoring days. Its pace runs from the
            category&apos;s own first scoring day to the last day with data, so a staggered start is a plan, not a deficit, and a day
            not logged yet doesn&apos;t drag it down. <strong className="text-foreground">Need/day</strong> spreads the gap to the line over the days
            left, today included.
          </p>
          <p>
            <strong className="text-foreground">Not playing:</strong> under a tenth of the line with fewer than {FORECAST_MIN_DAYS} scoring days,
            from day {NOT_PLAYING_FROM_DAY}. A category that starts scoring comes back.
          </p>
        </>}
        actions={allPeriods.length > 1 && (
          <nav className="flex gap-1 text-xs">
            {allPeriods.map((p) => (
              <Link
                key={p.id}
                href={p.id === period.id ? "/ptcs" : `/ptcs?period=${p.id}`}
                className={cn("rounded-full border px-2.5 py-0.5", p.id === period.id ? "border-primary text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
              >
                {p.name}
              </Link>
            ))}
          </nav>
        )}
      />

      {/* Freshness: how current the totals and the lines are */}
      {!finished && (
        <p className={cn("text-xs", stale ? "text-warning" : "text-muted-foreground")}>
          {lastLogged ? `Results logged through ${md(lastLogged)}` : "No results logged yet"}
          {notLogged > 0 && ` · ${notLogged} day${notLogged === 1 ? "" : "s"} not logged`}
          {projection
            ? ` · Our line: dump through ${md(projection.dumpReach)} (${dumpAge === 0 ? "today" : `${dumpAge}d old`})`
            : " · Our line: no projection stored"}
          {cwhitDate && ` · cwhit: ${md(cwhitDate)}`}
          {" · "}
          <Link href="/upload" className="underline underline-offset-2 hover:text-foreground">Upload a new dump</Link>
        </p>
      )}

      {/* KPI strip. Not-playing categories count in neither of the first two. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Safe — stop" value={safe.length} sub={safe.length ? <Joined items={safe.map((r) => r.category)} sep=", " /> : "none yet"} />
        <StatTile
          label="Still to play"
          value={toPlay.length}
          sub={toPlay.length ? <Joined items={toPlay.map((r) => (r.toSafe != null ? `${r.category} ${r.toSafe}` : r.category))} /> : "nothing"}
        />
        <StatTile label="Days left" value={daysLeft} sub="today included" />
        <StatTile
          label="Data thru"
          value={dataThru ? md(dataThru) : "—"}
          sub={projection || cwhitDate ? (
            <Joined items={[projection ? `lines ${md(projection.dumpReach)}` : null, cwhitDate ? `cwhit ${md(cwhitDate)}` : null].filter((s) => s != null)} />
          ) : undefined}
        />
      </div>

      {/* Category standings */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 text-sm font-semibold">Category standings</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Progress</th>
                  <th className="py-2 pr-4 text-right">Total</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">Our line</th>
                  {cwhit && <th className="whitespace-nowrap py-2 pr-4 text-right" title={cwhit.file}>cwhit line</th>}
                  <th className="whitespace-nowrap py-2 pr-4 text-right" title={`The higher line plus ${Math.round(SAFE_MARGIN * 100)}%, rounded up`}>Safe at</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right" title="Points from here to Safe at">Still to get</th>
                  <th className="py-2 pr-4 text-right" title="Points short of the higher line">Gap</th>
                  <th className="py-2 pr-4 text-right" title="The gap over the days left, today included">Need/day</th>
                  <th className="whitespace-nowrap py-2 pr-4 text-right">
                    Projected{dataThru && <span className="ml-1 font-normal normal-case tracking-normal">thru {md(dataThru)}</span>}
                  </th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[13px] tabular-nums">
                {board.map((r) => (
                  <tr key={r.category} className={cn("border-b border-border/50", r.verdict === "not-playing" && "opacity-60")}>
                    <td className="py-2 pr-4 font-sans">{r.category}</td>
                    <td className="py-2 pr-4"><ProgressBar r={r} /></td>
                    <td className="py-2 pr-4 text-right">
                      {r.total}
                      {r.fromDump > 0 && (
                        <div className="whitespace-nowrap font-sans text-[11px] text-muted-foreground">· {r.fromDump} from dump</div>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">{r.ourLine ?? "—"}</td>
                    {cwhit && <td className="py-2 pr-4 text-right text-muted-foreground">{r.cwhitLine ?? "—"}</td>}
                    <td className="py-2 pr-4 text-right">{r.safeAt ?? "—"}</td>
                    <td className="py-2 pr-4 text-right font-semibold">{r.toSafe || "—"}</td>
                    <td className="py-2 pr-4 text-right">{r.gap || "—"}</td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">{r.needPerDay?.toFixed(1) ?? "—"}</td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">{r.projected ?? "—"}</td>
                    <td className="py-2 font-sans">
                      <span className={cn("whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px]", CHIP[r.verdict])}>
                        {verdictLabel(r)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Result entry */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-1 text-sm font-semibold">Log results</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Paste the Your Tournaments rows as read. Each is scored from the points table (every tagged
            category gets the full amount, TW pays nothing) and keyed by the event id in parentheses, so an
            overlapping screenshot cannot count twice. Preview first; nothing is written until you log.
          </p>
          <ResultEntry
            asOfDefault={today}
            periodName={period.name}
            recent={events.slice(0, 80)}
          />
          {unlogged.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                In the dump but not logged ({unlogged.length}){unloggedSummary && ` — ${unloggedSummary}`}
              </summary>
              <p className="mt-2 text-muted-foreground">
                Counted in the totals above. Logging one later replaces its dump entry; it never counts twice.
              </p>
              <ul className="mt-2 max-h-64 divide-y divide-border/50 overflow-y-auto rounded-md border border-border">
                {unlogged.map((e) => (
                  <li key={e.eventId ?? `${e.occurredOn}-${e.name}`} className="flex items-center gap-2 px-2 py-1 font-mono text-[12px]">
                    <span className="w-12 shrink-0 text-muted-foreground">{md(e.occurredOn)}</span>
                    <span className="min-w-0 flex-1 truncate font-sans">{e.name}{e.eventId != null ? ` (${e.eventId})` : ""}</span>
                    <span className="shrink-0 text-muted-foreground">{e.finish}/{e.fieldSize}</span>
                    <span className="w-28 shrink-0 text-right">{e.points > 0 ? e.categories.map((c) => `+${e.points} ${c}`).join(", ") : "0"}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>

      {/* Berth lines from the community dump */}
      {berthRows.length > 0 && (
        <Fold title={<>Dump snapshot — {snapshotThru ? `day ${snapshotDay} (through ${md(snapshotThru)})` : "latest"}</>}>
          <p className="text-xs text-muted-foreground">
            Standings computed from the community dump: full finish orders × the points table. The line is the points at
            128th place today (berth counts unconfirmed). Drop a fresh dump on Upload to refresh.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-1.5 pr-2">Category</th>
                  <th className="px-2 text-right">Rank</th>
                  <th className="whitespace-nowrap px-2 text-right">Your pts (dump)</th>
                  <th className="whitespace-nowrap px-2 text-right">Line today (128th)</th>
                  <th className="whitespace-nowrap px-2 text-right">Cushion today</th>
                  <th className="whitespace-nowrap px-2 text-right">Teams scoring</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[13px] tabular-nums">
                {berthRows.map((r) => {
                  const cushion = r.pts - r.line;
                  const inside = r.rank != null && r.rank <= 128;
                  return (
                    <tr key={r.cat} className="border-b border-border/50">
                      <td className="py-1.5 pr-2 font-sans">{r.cat}</td>
                      <td className={cn("px-2 text-right", inside ? "text-positive" : "text-muted-foreground")}>
                        {r.rank ?? "—"}
                      </td>
                      <td className="px-2 text-right">{r.pts}</td>
                      <td className="px-2 text-right">{r.line}</td>
                      <td className={cn("px-2 text-right", cushion >= 0 ? "text-positive" : "text-negative")}>
                        {cushion >= 0 ? `+${cushion}` : cushion}
                      </td>
                      <td className="px-2 text-right text-muted-foreground">{r.scored.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Fold>
      )}

      {/* Daily log */}
      <Fold title="Daily log">
        <p className="text-xs text-muted-foreground">
          {loggedDays} of {dates.length} day{dates.length === 1 ? "" : "s"} from logged events
          {dumpDays > 0 && `, ${dumpDays} from the dump only`}
          {importDays > 0 && `, ${importDays} from the imported tracker`}.
          {conflicts.length > 0 && (
            <span className="text-warning">
              {" "}{conflicts.length} day{conflicts.length === 1 ? " has" : "s have"} both — logged events count, the imported total is shown in the hover note:{" "}
              {conflicts.map((d) => md(d.date)).join(", ")}.
            </span>
          )}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">Date</th>
                {CATEGORIES.map((c) => (
                  <th key={c} className="py-2 pr-3 text-right">{c.replace("PD ", "PD")}</th>
                ))}
                <th className="py-2 text-right">Day</th>
              </tr>
            </thead>
            <tbody className="font-mono text-[13px]">
              {dates.map((d) => {
                const m = byDate.get(d)!;
                const note = m.note ?? "";
                const dayTotal = CATEGORIES.reduce((s, c) => s + (m.points[c] ?? 0), 0);
                const fromDump = m.events.filter((e) => e.source === "dump").length;
                return (
                  <tr key={d} className={cn("border-b border-border/50", m.conflict && "bg-warning/5")} title={note}>
                    <td className="whitespace-nowrap py-1.5 pr-3">
                      {md(d)}
                      <span
                        className="ml-1 text-[10px] text-muted-foreground"
                        title={
                          m.source === "results" ? `${m.events.length - fromDump} logged event(s)${fromDump ? ` + ${fromDump} from the dump` : ""}`
                            : m.source === "dump" ? `${fromDump} event(s) from the dump, none logged`
                              : m.source === "import" ? "imported tracker total" : "nothing logged"
                        }
                      >
                        {m.conflict ? "!" : m.source === "results" ? (fromDump ? "✎d" : "✎") : m.source === "dump" ? "d" : m.source === "import" ? "·" : ""}
                      </span>
                    </td>
                    {CATEGORIES.map((c) => {
                      const v = m.points[c] ?? 0;
                      return (
                        <td
                          key={c}
                          className={cn(
                            "py-1.5 pr-3 text-right",
                            v === 0 ? "text-muted-foreground/40" : v >= 10 ? "font-semibold text-positive" : "",
                          )}
                        >
                          {v}
                        </td>
                      );
                    })}
                    <td className="py-1.5 text-right font-semibold">{dayTotal}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Hover a row for the day&apos;s event log. ✎ built from logged events · d from dump events never logged · imported tracker total · ! both on file.
        </p>
      </Fold>

      {/* History: team results from the dumps, and the ladder */}
      <Fold title="History">
        {totalEntries > 0 && (
          <section>
            <h3 className="mb-1 text-sm font-semibold">Team results — every entry in the community record</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              {totalEntries.toLocaleString()} entries · {wins} wins · {totalPoints.toLocaleString()} lifetime points.
              From the finish-order dumps (pnpm import:myresults after each new dump).
            </p>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
              <div className="overflow-x-auto">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By series (top 15 by points)</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-1.5 pr-2">Series</th>
                      <th className="px-2 text-right">In</th>
                      <th className="px-2 text-right">Pts</th>
                      <th className="px-2 text-right">Best</th>
                      <th className="px-2 text-right">Top-16</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-[13px] tabular-nums">
                    {seriesAgg.slice(0, 15).map((s) => (
                      <tr key={s.name} className="border-b border-border/50">
                        <td className="max-w-[220px] truncate py-1.5 pr-2 font-sans">{s.name}</td>
                        <td className="px-2 text-right">{s.entries}</td>
                        <td className="px-2 text-right font-semibold">{s.points}</td>
                        <td className={cn("px-2 text-right", s.best === 1 ? "text-positive" : "")}>{s.best}</td>
                        <td className="px-2 text-right text-muted-foreground">{s.top16}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="overflow-x-auto">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent entries</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-1.5 pr-2">Event</th>
                      <th className="px-2 text-right">Date</th>
                      <th className="px-2 text-right">Finish</th>
                      <th className="px-2 text-right">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-[13px] tabular-nums">
                    {recent.map((r) => (
                      <tr key={r.eventId} className="border-b border-border/50">
                        <td className="max-w-[220px] truncate py-1.5 pr-2 font-sans">{r.name}</td>
                        <td className="px-2 text-right text-muted-foreground">
                          {r.startAt.toISOString().slice(5, 10)}
                        </td>
                        <td className={cn("px-2 text-right", r.finish <= 8 ? "text-positive" : "")}>
                          {r.finish}/{r.fieldSize}
                        </td>
                        <td className="px-2 text-right">{r.points || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        <section>
          <h3 className="mb-1 text-sm font-semibold">The championship ladder — PTCS → PTMS → PTWC</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Cumulative: <span className="font-mono">{cumT}</span> tournament ·{" "}
            <span className="font-mono">{cumD}</span> perfect-draft points. Top 128 of each standing
            makes the PTMS. {ladder.ladderRules.convexity}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">Event</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Berths played</th>
                  <th className="py-2 pr-4 text-right">Tourney pts</th>
                  <th className="py-2 pr-4 text-right">PD pts</th>
                  <th className="py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {ladder.finishes.map((f) => (
                  <tr key={f.event} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium">{f.event}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{f.date}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {f.berths.length === 0
                        ? "—"
                        : f.berths.map((b) => `${b.berth} ${b.placement} (+${b.points})`).join(" · ")}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono">{f.tournamentPts}</td>
                    <td className="py-2 pr-4 text-right font-mono">{f.draftPts}</td>
                    <td className="py-2 text-xs text-muted-foreground">{f.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-2 text-xs text-muted-foreground lg:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <span className="font-medium text-foreground">PTWC 2 (Feb 21-22):</span>{" "}
              {ladder.ladderRules.ptwc2}
            </div>
            <div className="rounded-lg border border-border p-3">
              <span className="font-medium text-foreground">Depth beats breadth:</span>{" "}
              PTCS 4&apos;s single 9th-16th (20 pts) outscored PTCS 5&apos;s five berths (14 pts).
              Berths are the price of admission; points come from deep runs.
            </div>
          </div>
        </section>
      </Fold>
    </div>
  );
}

/** Items joined by `sep`, each kept on one line so a phone never splits "PD Daily 106". */
function Joined({ items, sep = " · " }: { items: string[]; sep?: string }) {
  return <>{items.map((s, i) => <span key={s}>{i > 0 && sep}<span className="whitespace-nowrap">{s}</span></span>)}</>;
}

/** A folded section: closed until he opens it. */
function Fold({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <details>
        <summary className="cursor-pointer select-none px-5 py-4 text-sm font-semibold">{title}</summary>
        <div className="flex min-w-0 flex-col gap-4 px-5 pb-5">{children}</div>
      </details>
    </Card>
  );
}

/**
 * Points against the safe mark, with a 1px tick at our line and a fainter one
 * at cwhit's. Full means safe; the fill takes the verdict's colour.
 */
function ProgressBar({ r }: { r: StandingRow }) {
  if (r.safeAt == null) return <span className="text-muted-foreground">—</span>;
  const at = (v: number) => `${Math.min(100, (v / r.safeAt!) * 100)}%`;
  const title = [`${r.total} of ${r.safeAt} (safe at)`, r.ourLine != null && `our line ${r.ourLine}`, r.cwhitLine != null && `cwhit ${r.cwhitLine}`].filter(Boolean).join(" · ");
  return (
    <span className="relative inline-block h-2 w-32 overflow-hidden rounded-full bg-muted align-middle" title={title}>
      <span className={cn("absolute inset-y-0 left-0 rounded-full", BAR[r.verdict])} style={{ width: at(r.total) }} />
      {r.ourLine != null && <span className="absolute inset-y-0 w-px bg-foreground/80" style={{ left: at(r.ourLine) }} />}
      {r.cwhitLine != null && <span className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: at(r.cwhitLine) }} />}
    </span>
  );
}
