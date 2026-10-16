/**
 * PTMS · PTWC — the road past the PTCS (L.J., 10-16: "Track PTCS, PTMS, PTWC
 * … all qualifying"), on the PT 27 rules (lib/qualifying):
 *
 * - PTMS 3 (Nov 21): his tournament and PD ladder points from PTCS 6-8; the
 *   top 128 of either standing goes.
 * - PTWC 2 (Feb 20-21): every source added up — weekly leaderboard points,
 *   PTCS 6-11 and PTMS 3-4 finishes, league seasons, PT Live / 50.
 *
 * Finishes, league places and Live points are entered here (/api/qualifying);
 * the weekly points and the league places by record are read from data
 * already on file (lib/qualifying-load).
 */

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { SectionTabs } from "@/components/section-tabs";
import { StatTile } from "@/components/stat-tile";
import { FinishEntry, LeagueEntry, LiveEntry, RemoveEntry } from "@/components/qualifying-entry";
import { cn } from "@/lib/utils";
import { BERTHS, LADDER_POINTS, LIVE_DIVISOR, PTMS_FEEDS, PTWC_CATEGORIES, SCHEDULE } from "@/lib/qualifying";
import { loadQualifying, type EventFinishes } from "@/lib/qualifying-load";

export const dynamic = "force-dynamic";

const md = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const daysTo = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 864e5);
const n1 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

export default async function QualifyingPage() {
  const q = await loadQualifying();
  const { ptwc2 } = q;
  const counted = q.league.weeks.filter((w) => w.points > 0 || w.source === "entered").length;
  const missing = q.league.weeks.filter((w) => !w.inProgress && w.source === "none");
  // PTCS 6-8 and PTMS 3 always; later events once something is entered for them.
  const shown = [...q.ptcs, ...q.ptms].filter((e) => ["PTCS 6", "PTCS 7", "PTCS 8", "PTMS 3"].includes(e.event) || e.rows.length > 0);
  const next = q.next;
  const defaultEvent = q.ptcs.find((e) => e.rows.length === 0 && e.event >= "PTCS 6")?.event ?? "PTCS 8";

  return (
    <div className="flex flex-col gap-4">
      <SectionTabs section="ptcs" />
      <PageHeader
        eyebrow="PTCS qualifying"
        title="PTMS · PTWC"
        description="Where you stand for PTMS 3 and PTWC 2: championship finishes, league seasons, PT Live and the weekly leaderboard points, added up the way the PT 27 rules count them."
        about={`PTCS and PTMS finishes earn 300 / 100 / 75 / 40 / 20 / 5 / 2 / 1 (1st to 65th-128th). PTMS 3 takes the top 128 of either standing over ${PTMS_FEEDS["PTMS 3"].join(", ")}. PTWC 2 adds league play from Aug 24, PT Live points ÷ ${LIVE_DIVISOR}, the weekly leaderboard points Aug 4 – Jan 31 (Cap and Live left out: no double-dipping), PTCS 6–11 and PTMS 3–4. League places come from each week's full export by record unless you enter the final place; the top 16 settle theirs in the playoffs.`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="PTMS 3 · Nov 21" value={<>{q.ptms3.tournament} <span className="text-muted-foreground">·</span> {q.ptms3.draft}</>}
          sub="tournament · PD points from PTCS 6–8; top 128 of either goes" />
        <StatTile label="PTWC 2 · Feb 20–21" value={n1(ptwc2.total)} sub="points so far, every source below" />
        <StatTile label="Next" value={next?.name ?? "—"} sub={next ? `${md(next.on)} · in ${daysTo(q.today, next.on)} days · ${next.note}` : "season over"} />
      </div>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">PTWC 2 points</h2>
        <table className="w-full text-sm">
          <tbody className="[&_td]:py-1.5">
            <Line label="Weekly leaderboard" value={ptwc2.weekly}
              note={<>Tournament and PD points from Aug 4{q.weekly.through ? ` to ${md(q.weekly.through)}` : ""}: {PTWC_CATEGORIES.map((c) => `${c} ${q.weekly.byCategory[c] ?? 0}`).join(" · ")}</>} />
            <Line label="PTCS 6–11 finishes" value={ptwc2.ptcs} note={`${q.ptcs.reduce((a, e) => a + e.rows.length, 0)} brackets entered`} />
            <Line label="PTMS 3–4 finishes" value={ptwc2.ptms} note={q.ptms.some((e) => e.rows.length) ? "" : "none yet"} />
            <Line label="League play" value={ptwc2.league}
              note={`${counted} week${counted === 1 ? "" : "s"} counted${missing.length ? `; ${missing.length} need a place (${missing.map((w) => md(w.week)).join(", ")})` : ""}`} />
            <Line label={`PT Live ÷ ${LIVE_DIVISOR}`} value={ptwc2.live} note={q.live.raw != null ? `${q.live.raw.toLocaleString()} leaderboard points on ${q.live.on ? md(q.live.on) : "?"}` : "not entered"} />
            <tr className="border-t border-border font-semibold"><td>Total</td><td className="text-right font-mono">{n1(ptwc2.total)}</td><td /></tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">The weekly points are most of it: every daily and weekly finish counts toward PTWC 2 as well as the PTCS, so a period you&apos;ve already qualified in still pays.</p>
      </Card>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">Championship finishes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-3">Event</th><th className="py-1.5 pr-3">Brackets</th>
                <th className="py-1.5 pr-3 text-right">Tourn</th><th className="py-1.5 text-right">PD</th>
              </tr>
            </thead>
            <tbody>{shown.map((e) => <FinishRow key={e.event} e={e} on={SCHEDULE.find((m) => m.name === e.event)?.on ?? null} />)}</tbody>
          </table>
        </div>
        <div className="mt-3"><FinishEntry events={[...q.ptcs, ...q.ptms].map((e) => e.event)} berths={BERTHS} placements={[...LADDER_POINTS]} defaultEvent={defaultEvent} /></div>
        <p className="mt-2 text-xs text-muted-foreground">A bracket you lost in round 1 of 128 is 65th-128th (1 pt), round 2 33rd-64th, round 3 17th-32nd, round 4 9th-16th. Saving a bracket again replaces it.</p>
      </Card>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">League seasons</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-3">Week</th><th className="py-1.5 pr-3">League</th><th className="py-1.5 pr-3 text-right">Record</th>
                <th className="py-1.5 pr-3 text-right">Place</th><th className="py-1.5 pr-3 text-right">Pts</th><th className="py-1.5">From</th>
              </tr>
            </thead>
            <tbody className="font-mono text-[13px]">
              {q.league.weeks.map((w) => (
                <tr key={w.week} className="border-b border-border/50">
                  <td className="py-1.5 pr-3 font-sans">{md(w.week)}</td>
                  <td className="py-1.5 pr-3">{w.league}</td>
                  <td className="py-1.5 pr-3 text-right">{w.record ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-right">{w.place != null ? `${w.place}${w.of ? ` / ${w.of}` : ""}` : "—"}</td>
                  <td className="py-1.5 pr-3 text-right">{w.inProgress ? "—" : w.points}</td>
                  <td className={cn("py-1.5 font-sans text-xs", w.source === "none" && !w.inProgress ? "text-warning" : "text-muted-foreground")}>
                    {w.inProgress ? "in progress" : w.source === "entered" ? <>entered{w.entryId != null && <RemoveEntry id={w.entryId} label={`the ${md(w.week)} place`} />}</>
                      : w.source === "record" ? "by record" : "enter the place"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3"><LeagueEntry weeks={q.league.weeks.filter((w) => !w.inProgress).map((w) => ({ week: w.week, league: w.league }))} /></div>
        <p className="mt-2 text-xs text-muted-foreground">
          Points by tier: Perfect 200 / 150 / 100 / 75 / 50 / 35 (1st, 2nd, 3rd-4th, 5th-8th, 9th-16th, 17th-last) · High Diamond 100 / 75 / 50 / 35 / 20 / 10 · Low Diamond 50 / 35 / 25 / 20 / 10 / 5 · High Gold 35 / 20 / 10 / 5 · Low Gold 20 / 10 / 5.
        </p>
      </Card>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">PT Live</h2>
        <p className="mb-2 text-xs text-muted-foreground">Your PT Live leaderboard points as the game shows them; PTWC 2 counts them ÷ {LIVE_DIVISOR} from Aug 24 to the end of the World Series.</p>
        <LiveEntry current={q.live.raw} />
      </Card>
    </div>
  );
}

function Line({ label, value, note }: { label: string; value: number; note: React.ReactNode }) {
  return (
    <tr className="border-b border-border/50 align-top">
      <td className="pr-3">{label}</td>
      <td className="pr-3 text-right font-mono">{n1(value)}</td>
      <td className="text-xs text-muted-foreground">{note}</td>
    </tr>
  );
}

function FinishRow({ e, on }: { e: EventFinishes; on: string | null }) {
  return (
    <tr className="border-b border-border/50 align-top">
      <td className="py-1.5 pr-3 whitespace-nowrap font-medium">{e.event}{on && <span className="ml-1 text-xs font-normal text-muted-foreground">{md(on)}</span>}</td>
      <td className="py-1.5 pr-3 text-xs">
        {e.rows.length === 0 ? <span className="text-muted-foreground">none entered</span>
          : e.rows.map((r) => (
            <span key={r.id} className="mr-2 inline-flex items-center whitespace-nowrap">
              {r.berth} {r.placement} <span className="ml-1 text-positive">+{r.points}</span>
              <RemoveEntry id={r.id} label={`${e.event} ${r.berth}`} />
            </span>
          ))}
      </td>
      <td className="py-1.5 pr-3 text-right font-mono">{e.tournament}</td>
      <td className="py-1.5 text-right font-mono">{e.draft}</td>
    </tr>
  );
}
