/**
 * PTCS — the qualifying command center.
 *
 * Replaces PTCS6 Tracker.xlsx + PTCS6 Dashboard.html as the living surface:
 * category standings vs targets, pace with the three-scoring-day forecast
 * rule, the daily log, and the championship ladder (PTCS → PTMS → PTWC).
 *
 * Data: `periods` + `daily_totals` (imported from the tracker history and,
 * soon, written directly by result logging), plus the static ladder record in
 * `src/data/ptcs-ladder.json`.
 */

import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { dailyTotals, periods } from "@/db/schema";
import LADDER from "@/data/ptcs-ladder.json";
import { Card, CardContent } from "@/components/ui/card";
import { Placeholder } from "@/components/placeholder";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  "Iron", "Bronze", "Silver", "Gold", "Diamond",
  "Open", "Live", "Cap", "PD Daily", "PD Weekly",
] as const;

interface CategoryLine {
  category: string;
  total: number;
  target: number | null;
  gap: number | null;
  needPerDay: number | null;
  scoringDays: number;
  firstScoringIndex: number | null;
  projected: number | null;
  status: "qualified" | "on-pace" | "off-pace" | "not-started" | "tracking";
}

function statusChip(status: CategoryLine["status"]): { label: string; cls: string } {
  switch (status) {
    case "qualified":
      return { label: "QUALIFIED", cls: "border-emerald-500/50 text-emerald-400" };
    case "on-pace":
      return { label: "on pace", cls: "border-emerald-500/30 text-emerald-300" };
    case "off-pace":
      return { label: "off pace", cls: "border-amber-500/40 text-amber-400" };
    case "not-started":
      return { label: "not started", cls: "border-border text-muted-foreground" };
    default:
      return { label: "tracking", cls: "border-border text-muted-foreground" };
  }
}

export default async function PtcsPage() {
  const [period] = await db.select().from(periods).orderBy(desc(periods.id)).limit(1);
  if (!period) {
    return (
      <Placeholder
        icon="tournaments"
        title="PTCS"
        description="Run pnpm import:ptcs6 (or log results once result-entry ships) and this becomes the qualifying command center — category standings, pace, and the championship ladder."
      />
    );
  }

  const rows = await db
    .select()
    .from(dailyTotals)
    .where(eq(dailyTotals.periodId, period.id))
    .orderBy(asc(dailyTotals.occurredOn));

  const dates = [...new Set(rows.map((r) => r.occurredOn))].sort();
  const byDate = new Map<string, Map<string, { points: number; note: string | null }>>();
  for (const r of rows) {
    const m = byDate.get(r.occurredOn) ?? new Map();
    m.set(r.category, { points: r.points, note: r.note });
    byDate.set(r.occurredOn, m);
  }

  const totalDays = Math.round(
    (Date.parse(period.endsOn) - Date.parse(period.startsOn)) / 86400000,
  ) + 1;
  const elapsed = dates.length;
  const remaining = Math.max(0, totalDays - elapsed);
  const targets = (period.targets ?? {}) as Record<string, number>;

  const lines: CategoryLine[] = CATEGORIES.map((cat) => {
    const series = dates.map((d) => byDate.get(d)?.get(cat)?.points ?? 0);
    const total = series.reduce((s, v) => s + v, 0);
    const target = targets[cat] ?? null;
    const gap = target != null ? Math.max(0, target - total) : null;
    const scoringDays = series.filter((v) => v > 0).length;
    const firstScoringIndex = series.findIndex((v) => v > 0);

    // The forecast rule: no projection until a category has three scoring
    // days, and its rate runs from ITS OWN first scoring day — a deliberately
    // staggered start is a plan, not a deficit.
    let projected: number | null = null;
    if (scoringDays >= 3 && firstScoringIndex >= 0) {
      const activeDays = elapsed - firstScoringIndex;
      const rate = total / Math.max(1, activeDays);
      projected = Math.round(total + rate * remaining);
    }

    let status: CategoryLine["status"];
    if (target != null && total >= target) status = "qualified";
    else if (total === 0) status = "not-started";
    else if (projected == null) status = "tracking";
    else if (target != null && projected >= target) status = "on-pace";
    else status = "off-pace";

    return {
      category: cat,
      total,
      target,
      gap,
      needPerDay: gap != null && remaining > 0 ? Math.round((gap / remaining) * 10) / 10 : null,
      scoringDays,
      firstScoringIndex: firstScoringIndex < 0 ? null : firstScoringIndex,
      projected,
      status,
    };
  });

  const banked = lines.reduce((s, l) => s + l.total, 0);
  const onPace = lines.filter((l) => l.status === "on-pace" || l.status === "qualified").length;
  const rate = elapsed > 0 ? banked / elapsed : 0;

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
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{period.name}</h1>
          <p className="text-sm text-muted-foreground">
            {period.startsOn} → {period.endsOn} · feeds PTWC 2 ·{" "}
            {period.targetsAreOfficial ? "official targets" : "targets estimated from PTCS 5 × 5/4 — upload weekly standings to replace"}
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Points banked", banked.toLocaleString(), "all ten categories"],
          ["Period progress", `Day ${elapsed}`, `${remaining} of ${totalDays} left`],
          ["Points per day", rate.toFixed(1), "PTCS 5 ran 43.9"],
          ["Categories on pace", `${onPace} / ${lines.filter((l) => (l.target ?? 0) > 0).length}`, "incl. qualified"],
        ].map(([label, value, sub]) => (
          <Card key={label as string}>
            <CardContent className="pt-5 pb-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
              <div className="mt-1 font-mono text-xl font-semibold tabular-nums">{value}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category table */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-1 text-sm font-semibold">Category standings</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Projection appears once a category has three scoring days, and its rate runs from its own
            first scoring day — a staggered start is a plan, not a problem.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Progress</th>
                  <th className="py-2 pr-4 text-right">Total</th>
                  <th className="py-2 pr-4 text-right">Target</th>
                  <th className="py-2 pr-4 text-right">Gap</th>
                  <th className="py-2 pr-4 text-right">Need/day</th>
                  <th className="py-2 pr-4 text-right">Projected</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[13px]">
                {lines.map((l) => {
                  const chip = statusChip(l.status);
                  const pctOfTarget = l.target ? Math.min(100, (l.total / l.target) * 100) : 0;
                  return (
                    <tr key={l.category} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-sans">{l.category}</td>
                      <td className="py-2 pr-4">
                        <span className="relative inline-block h-2 w-32 overflow-hidden rounded-full bg-muted align-middle">
                          <span
                            className={cn(
                              "absolute inset-y-0 left-0 rounded-full",
                              l.status === "qualified" ? "bg-emerald-500" : "bg-primary",
                            )}
                            style={{ width: `${pctOfTarget}%` }}
                          />
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right">{l.total}</td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">{l.target ?? "—"}</td>
                      <td className="py-2 pr-4 text-right">{l.gap ?? "—"}</td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">{l.needPerDay ?? "—"}</td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">{l.projected ?? "—"}</td>
                      <td className="py-2 font-sans">
                        <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", chip.cls)}>
                          {chip.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Daily log */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-4 text-sm font-semibold">Daily log</h2>
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
                  const note = [...m.values()].find((v) => v.note)?.note ?? "";
                  const dayTotal = CATEGORIES.reduce((s, c) => s + (m.get(c)?.points ?? 0), 0);
                  return (
                    <tr key={d} className="border-b border-border/50" title={note}>
                      <td className="whitespace-nowrap py-1.5 pr-3">{d.slice(5)}</td>
                      {CATEGORIES.map((c) => {
                        const v = m.get(c)?.points ?? 0;
                        return (
                          <td
                            key={c}
                            className={cn(
                              "py-1.5 pr-3 text-right",
                              v === 0 ? "text-muted-foreground/40" : v >= 10 ? "font-semibold text-emerald-400" : "",
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
          <p className="mt-2 text-[11px] text-muted-foreground">
            Hover a row for the day&apos;s full event log. Result entry lands here next — until then the
            importer syncs from the tracker.
          </p>
        </CardContent>
      </Card>

      {/* Ladder */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-1 text-sm font-semibold">The championship ladder — PTCS → PTMS → PTWC</h2>
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
        </CardContent>
      </Card>
    </div>
  );
}
