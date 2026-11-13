/**
 * /today — what needs doing now.
 *
 * The daily signals were spread over four pages: the PTCS verdicts on /ptcs,
 * the exports to grab and the stale sources on /upload, the scoreboard, and
 * the next championship on /qualifying. This puts the lines that call for an
 * action on one screen, each linking to the page that acts on it. Nothing
 * here is computed differently: every block reads the same loader its own
 * page does (period-ledger and ptcs-progress, exports-to-grab, freshness,
 * the scoreboard file, qualifying's schedule).
 */
import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { periods } from "@/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { CATEGORIES } from "@/lib/ingest/constants";
import { loadPeriodLedger } from "@/lib/period-ledger";
import { cwhitLinesFor, standings, todayInChicago, verdictLabel, type StandingRow } from "@/lib/ptcs-progress";
import { loadExportsToGrab } from "@/lib/exports-to-grab";
import { loadFreshness } from "@/lib/freshness";
import { nextMilestone } from "@/lib/qualifying";
import type { StoredLines } from "@/lib/ptcs-projection";
import type { KindBoard, Scoreboard } from "@/lib/analytics/scoreboard";
import { cn } from "@/lib/utils";
import STORED_LINES from "@/data/ptcs-lines.json";
import BOARD from "@/data/scoreboard.json";

export const dynamic = "force-dynamic";

const md = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

function Block({ title, href, action, children }: { title: string; href: string; action: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <Link href={href} className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">{action}</Link>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/** Behind first, then the ones still short of safe; the safe and the unplayed go on one line under them. */
const urgency: Record<StandingRow["verdict"], number> = { behind: 0, "to-safe": 1, "on-pace": 2, "no-line": 3, safe: 4, "not-playing": 5 };

function ScoreLine({ label, k }: { label: string; k: KindBoard }) {
  const now = k.windows[0], before = k.windows[1];
  if (!now) return null;
  return (
    <li className="flex flex-wrap items-baseline gap-x-2">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{now.me.pct?.toFixed(1) ?? "—"}%</span>
      <span className="text-muted-foreground">of series, {now.me.ptsPer?.toFixed(2) ?? "—"} pts/entry</span>
      {now.rank != null && <span className="text-muted-foreground">· {now.rank} of {now.regulars}</span>}
      {before?.me.pct != null && <span className="text-xs text-muted-foreground">(was {before.me.pct.toFixed(1)}%)</span>}
    </li>
  );
}

export default async function TodayPage() {
  const today = todayInChicago();
  const allPeriods = await db.select().from(periods).orderBy(desc(periods.startsOn));
  const period = allPeriods.find((p) => p.startsOn <= today && today <= p.endsOn) ?? null;
  const [ledger, grab, sources] = await Promise.all([
    period ? loadPeriodLedger(period) : Promise.resolve(null),
    loadExportsToGrab(),
    loadFreshness(),
  ]);

  const stored = STORED_LINES as StoredLines;
  const targets = (period?.targets ?? {}) as Record<string, number>;
  const board = ledger && period
    ? standings(ledger.days, CATEGORIES, {
      totalDays: ledger.calendar.totalDays, daysLeft: ledger.calendar.daysLeft, dayIndex: ledger.calendar.elapsed,
      ourLines: targets,
      cwhitLines: stored.period === period.name ? cwhitLinesFor(stored.cwhit, { name: period.name, totalDays: ledger.calendar.totalDays }).lines : null,
    })
    : [];
  const open = board.filter((r) => r.verdict !== "safe" && r.verdict !== "not-playing").sort((a, b) => urgency[a.verdict] - urgency[b.verdict] || (b.gap ?? 0) - (a.gap ?? 0));
  const safe = board.filter((r) => r.verdict === "safe");
  const out = board.filter((r) => r.verdict === "not-playing");
  const lastLogged = ledger?.events[0]?.occurredOn ?? null;
  const logGap = lastLogged ? daysBetween(lastLogged, today) : null;

  const toGrab = grab.rows.filter((r) => !r.likelyGone);
  const gone = grab.rows.length - toGrab.length;
  const stale = sources.filter((s) => s.stale);
  const next = nextMilestone(today);
  const score = BOARD as unknown as Scoreboard;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Play"
        title="Today"
        description={period
          ? `${period.name}, day ${ledger?.calendar.elapsed} of ${ledger?.calendar.totalDays} · ${ledger?.calendar.daysLeft} day${ledger?.calendar.daysLeft === 1 ? "" : "s"} left, today included${next ? ` · ${next.name} ${md(next.on)}` : ""}`
          : `No PTCS period is in play today${next ? ` · next: ${next.name} ${md(next.on)}` : ""}`}
        about="The lines from PTCS, Upload and the Scoreboard that call for something today, each linking to the page that does it. Every number is read the way its own page reads it."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Block title={period ? `${period.name}: where to put entries` : "PTCS"} href="/ptcs" action="Log results · full table">
          {!period ? (
            <p className="text-sm text-muted-foreground">Nothing to chase until the next period opens.</p>
          ) : (
            <>
              {open.length === 0 ? (
                <p className="text-sm text-muted-foreground">Every category you play is safe.</p>
              ) : (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {open.map((r) => (
                    <li key={r.category} className="flex flex-wrap items-baseline gap-x-2">
                      <span className="w-24 shrink-0 font-medium">{r.category}</span>
                      <span className="font-mono tabular-nums">{r.total}{r.line != null && <span className="text-muted-foreground"> / {r.line}</span>}</span>
                      <span className={cn(r.verdict === "behind" ? "text-negative" : r.verdict === "on-pace" ? "text-positive" : "text-muted-foreground")}>{verdictLabel(r)}</span>
                      {r.verdict !== "behind" && r.needPerDay != null && r.needPerDay > 0 && <span className="text-xs text-muted-foreground">({r.needPerDay.toFixed(1)}/day to the line)</span>}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                {safe.length > 0 && <>Safe, stop feeding: {safe.map((r) => r.category).join(", ")}. </>}
                {out.length > 0 && <>Not playing: {out.map((r) => r.category).join(", ")}. </>}
                {lastLogged
                  ? <span className={cn(logGap != null && logGap > 1 && "text-warning")}>Results logged through {md(lastLogged)}{logGap != null && logGap > 1 ? ` (${logGap} days ago)` : ""}.</span>
                  : <span className="text-warning">No results logged this period.</span>}
              </p>
            </>
          )}
        </Block>

        <Block title="Exports to grab" href="/upload" action="Upload · the full list">
          {toGrab.length === 0 ? (
            <p className="text-sm text-muted-foreground">Every event you played in the last week is filed{gone > 0 ? `; ${gone} older one${gone === 1 ? " is" : "s are"} past the week the game keeps` : ""}.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-1 text-sm">
                {toGrab.slice(0, 8).map((r) => (
                  <li key={r.eventId} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="truncate">{r.name}</span>
                    <span className="text-xs text-muted-foreground">{md(r.on)}{r.ageDays >= 5 ? ` · ${7 - r.ageDays <= 0 ? "last day" : `${7 - r.ageDays} days left`}` : ""}{r.redo ? " · file it again" : ""}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                {toGrab.length > 8 && <>{toGrab.length - 8} more. </>}
                The game keeps an event&apos;s page for a week; after that its export is gone.
              </p>
            </>
          )}
        </Block>

        <Block title="Data that is getting old" href="/upload" action="Upload">
          {stale.length === 0 ? (
            <p className="text-sm text-muted-foreground">Every source is current.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {stale.map((s) => (
                <li key={s.key}>
                  <span className="font-medium">{s.label}</span> <span className="text-warning">{s.when}</span>
                  <span className="block text-xs text-muted-foreground">{s.you}</span>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title={`Scoreboard, last ${score.recentDays} days`} href="/scoreboard" action="By week, event and round">
          {score.tournaments.windows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scoreboard yet; it is written when a dump is loaded.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-1.5 text-sm">
                <ScoreLine label="Tournaments" k={score.tournaments} />
                <ScoreLine label="Drafts" k={score.drafts} />
              </ul>
              <p className="text-xs text-muted-foreground">Through {md(score.through)}, the newest dump. An average team wins 50% of its series.</p>
            </>
          )}
        </Block>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {[["/build", "Build a roster"], ["/draft/live", "Live draft"], ["/draft/live?e=custom", "Any draft"], ["/cards", "New cards"], ["/upgrades", "Upgrades"]].map(([href, label]) => (
          <Link key={href} href={href} className="rounded-md border border-border px-3 py-2 text-muted-foreground hover:border-primary hover:text-foreground">{label}</Link>
        ))}
      </div>
    </div>
  );
}
