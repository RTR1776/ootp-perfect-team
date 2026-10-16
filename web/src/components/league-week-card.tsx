/** This week in the league (lib/league-this-week): one card above the lineups. */

import { cn } from "@/lib/utils";
import type { LeagueWeek } from "@/lib/league-this-week";

const s1 = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;

export function LeagueWeekCard({ w }: { w: LeagueWeek }) {
  const diff = w.runsFor - w.runsAgainst;
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">This week · {w.league}</h2>
        <span className="text-xs text-muted-foreground">export of {w.on} · season so far</span>
      </div>
      <div className="grid gap-3 text-xs sm:grid-cols-4">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Runs</div>
          <div className="font-mono text-base">{w.runsFor} – {w.runsAgainst}</div>
          <div className={cn("font-mono", diff >= 0 ? "text-positive" : "text-negative")}>{diff >= 0 ? "+" : ""}{diff} · staff ERA {w.era?.toFixed(2) ?? "—"}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Bats doing most (wRAA/600)</div>
          {w.bats.best.map((b) => <div key={b.name} className="flex justify-between gap-2"><span className="truncate">{b.name}</span><span className="font-mono text-positive">{s1(b.wraa600)} <span className="text-muted-foreground">{b.pa}</span></span></div>)}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Bats doing least</div>
          {w.bats.worst.map((b) => <div key={b.name} className="flex justify-between gap-2"><span className="truncate">{b.name}</span><span className={cn("font-mono", b.wraa600 < 0 ? "text-negative" : "")}>{s1(b.wraa600)} <span className="text-muted-foreground">{b.pa}</span></span></div>)}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Arms (SIERA · IP)</div>
          {w.arms.best.map((a) => <div key={a.name} className="flex justify-between gap-2"><span className="truncate">{a.name}</span><span className="font-mono text-positive">{a.siera?.toFixed(2) ?? a.era.toFixed(2)} <span className="text-muted-foreground">{a.ip}</span></span></div>)}
          {w.arms.worst.map((a) => <div key={a.name} className="flex justify-between gap-2"><span className="truncate">{a.name}</span><span className="font-mono text-negative">{a.siera?.toFixed(2) ?? a.era.toFixed(2)} <span className="text-muted-foreground">{a.ip}</span></span></div>)}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Small numbers are PA or IP: a week is a small sample, so weigh the season model below over a hot or cold few games.</p>
    </div>
  );
}
