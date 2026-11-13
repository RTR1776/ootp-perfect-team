/**
 * /scoreboard — is this working?
 *
 * L.J.'s series record and points an entry, tournaments and drafts side by
 * side: against the players who enter as often as he does, by week, by
 * category, by event, and round by round against the 25 best regulars.
 * All of it is read off the community dumps (lib/analytics/scoreboard), which
 * list every field in finishing order, so nothing here is modelled.
 *
 * The page shows src/data/scoreboard.json, which `pnpm scoreboard` writes
 * after each Monday's dump (load:dumps runs it).
 */
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { SectionTabs } from "@/components/section-tabs";
import type { KindBoard, Line, Scoreboard } from "@/lib/analytics/scoreboard";
import { cn } from "@/lib/utils";
import BOARD from "@/data/scoreboard.json";

const board = BOARD as unknown as Scoreboard;
const md = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
const num = (v: number | null, d = 2) => (v == null ? "—" : v.toFixed(d));
const th = "whitespace-nowrap py-2 pr-4 font-normal";
const td = "whitespace-nowrap py-1.5 pr-4";

/** An average team wins half its series; colour only a clear side of that. */
const tone = (v: number | null, n: number) => (v == null || n < 20 ? "" : v >= 58 ? "text-positive" : v < 48 ? "text-negative" : "");

function Record({ l }: { l: Line }) {
  return (
    <>
      <td className={cn(td, "text-right")}>{l.entries}</td>
      <td className={cn(td, "text-right")}>{l.won}–{l.lost}</td>
      <td className={cn(td, "text-right", tone(l.pct, l.won + l.lost))}>{pct(l.pct)}</td>
      <td className={cn(td, "text-right")}>{num(l.ptsPer)}</td>
    </>
  );
}
const RecordHead = () => (
  <>
    <th className={cn(th, "text-right")}>Entries</th>
    <th className={cn(th, "text-right")} title="Series won and lost, exact from the finishing order">Series</th>
    <th className={cn(th, "text-right")}>Win %</th>
    <th className={cn(th, "text-right")} title="PTCS points per entry">Pts/entry</th>
  </>
);

function Section({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-2 overflow-x-auto">{children}</div>
    </div>
  );
}

const Table = ({ children }: { children: React.ReactNode }) => <table className="w-full text-sm">{children}</table>;
const Head = ({ children }: { children: React.ReactNode }) => (
  <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">{children}</tr></thead>
);
const Body = ({ children }: { children: React.ReactNode }) => <tbody className="font-mono text-[13px] tabular-nums">{children}</tbody>;
const Row = ({ children, dim }: { children: React.ReactNode; dim?: boolean }) => <tr className={cn("border-b border-border/50", dim && "text-muted-foreground")}>{children}</tr>;

function Kind({ title, k, minShown }: { title: string; k: KindBoard; minShown: number }) {
  const now = k.windows[0];
  if (!now) return null;
  const events = k.events.filter((e) => e.entries >= minShown);
  const byPts = [...events].sort((a, b) => (b.ptsPer ?? 0) - (a.ptsPer ?? 0));
  return (
    <Card>
      <CardContent className="flex flex-col gap-6 pt-6">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="text-base font-semibold">{title}</h2>
          <span className="text-sm text-muted-foreground">
            {now.label.toLowerCase()}: <span className={cn("font-mono", tone(now.me.pct, now.me.won + now.me.lost))}>{pct(now.me.pct)}</span> of series,{" "}
            <span className="font-mono">{num(now.me.ptsPer)}</span> points an entry
            {now.rank != null && <>, <span className="font-mono text-foreground">{now.rank}</span> of {now.regulars} regulars</>}
          </span>
        </div>

        <Section title="Against the field" note={`Regulars are players with at least the number of events shown in that window. An average team wins 50% of its series.`}>
          <Table>
            <Head>
              <th className={th}>Window</th>
              <RecordHead />
              <th className={cn(th, "text-right")} title="Place among the regulars on series win %">Rank</th>
              <th className={cn(th, "text-right")}>10th best</th>
              <th className={cn(th, "text-right")}>Median</th>
            </Head>
            <Body>
              {k.windows.map((w) => (
                <Row key={w.label}>
                  <td className={cn(td, "font-sans")}>{w.label} <span className="block text-xs text-muted-foreground sm:inline">{md(w.from)} – {md(w.to)}</span></td>
                  <Record l={w.me} />
                  <td className={cn(td, "text-right")} title={`${w.minEntries}+ events`}>{w.rank != null ? `${w.rank} of ${w.regulars}` : `— of ${w.regulars}`}</td>
                  <td className={cn(td, "text-right")}>{pct(w.tenthPct)}</td>
                  <td className={cn(td, "text-right")}>{pct(w.medianPct)}</td>
                </Row>
              ))}
            </Body>
          </Table>
        </Section>

        {k.rounds.length > 0 && (
          <Section title="Round by round" note={`${now.label}, by teams left in the bracket, beside the 25 best regulars. Early rounds are the weak end of the field; late rounds are the good teams.`}>
            <Table>
              <Head>
                <th className={th}>Teams left</th>
                <th className={cn(th, "text-right")}>You</th>
                <th className={cn(th, "text-right")}>Your %</th>
                <th className={cn(th, "text-right")}>Top 25 %</th>
                <th className={cn(th, "text-right")}>Gap</th>
              </Head>
              <Body>
                {k.rounds.map((r) => {
                  const gap = r.pct != null && r.topPct != null ? r.pct - r.topPct : null;
                  return (
                    <Row key={r.left} dim={r.played < 10}>
                      <td className={td}>{r.left}</td>
                      <td className={cn(td, "text-right")}>{r.won}–{r.played - r.won}</td>
                      <td className={cn(td, "text-right")}>{pct(r.pct)}</td>
                      <td className={cn(td, "text-right")}>{pct(r.topPct)}</td>
                      <td className={cn(td, "text-right", gap != null && r.played >= 20 && (gap <= -8 ? "text-negative" : gap >= 3 ? "text-positive" : ""))}>
                        {gap == null ? "—" : `${gap >= 0 ? "+" : "−"}${Math.abs(gap).toFixed(1)}`}
                      </td>
                    </Row>
                  );
                })}
              </Body>
            </Table>
          </Section>
        )}

        <Section title="By category" note={`${now.label}, with everything before it beside each.`}>
          <Table>
            <Head>
              <th className={th}>Category</th>
              <RecordHead />
              <th className={cn(th, "text-right")}>Win % before</th>
              <th className={cn(th, "text-right")}>Pts/entry before</th>
            </Head>
            <Body>
              {k.groups.map((g) => (
                <Row key={g.group} dim={g.entries < 10}>
                  <td className={cn(td, "font-sans")}>{g.group}</td>
                  <Record l={g} />
                  <td className={cn(td, "text-right")}>{pct(g.before.pct)}</td>
                  <td className={cn(td, "text-right")}>{num(g.before.ptsPer)}</td>
                </Row>
              ))}
            </Body>
          </Table>
        </Section>

        {events.length > 0 && (
          <Section title="By event" note={`${now.label}, events with ${minShown}+ entries, best points an entry first. A handful of entries is a small sample; the top and bottom of this list move a lot from week to week.`}>
            <Table>
              <Head>
                <th className={th}>Event</th>
                <th className={cn(th, "text-right")}>Field</th>
                <RecordHead />
                <th className={cn(th, "text-right")}>Top 8</th>
                <th className={cn(th, "text-right")}>Won</th>
              </Head>
              <Body>
                {byPts.map((e) => (
                  <Row key={e.name}>
                    <td className={cn(td, "max-w-[16rem] truncate font-sans")} title={e.name}>{e.name}</td>
                    <td className={cn(td, "text-right")}>{e.size}</td>
                    <Record l={e} />
                    <td className={cn(td, "text-right")}>{e.top8}</td>
                    <td className={cn(td, "text-right")}>{e.titles}</td>
                  </Row>
                ))}
              </Body>
            </Table>
          </Section>
        )}

        <Section title="By week" note="Weeks start on Monday, as PTCS weeks do.">
          <Table>
            <Head>
              <th className={th}>Week of</th>
              <RecordHead />
              <th className={cn(th, "text-right")}>Top 8</th>
              <th className={cn(th, "text-right")}>Won</th>
            </Head>
            <Body>
              {[...k.weeks].reverse().map((w) => (
                <Row key={w.week}>
                  <td className={cn(td, "font-sans")}>{md(w.week)}</td>
                  <Record l={w} />
                  <td className={cn(td, "text-right")}>{w.top8}</td>
                  <td className={cn(td, "text-right")}>{w.titles}</td>
                </Row>
              ))}
            </Body>
          </Table>
        </Section>
      </CardContent>
    </Card>
  );
}

export default function ScoreboardPage() {
  const has = board.tournaments.windows.length > 0 || board.drafts.windows.length > 0;
  return (
    <div className="flex flex-col gap-4">
      <SectionTabs section="ptcs" />
      <PageHeader
        eyebrow="Play"
        title="Scoreboard"
        description={has ? `Your series record and points an entry, beside the field's. Through ${md(board.through)}, the newest dump.` : "Your series record and points an entry, beside the field's."}
        about={
          <>
            <p>
              The community dump lists every event&apos;s whole field in finishing order. In a knockout bracket the finish fixes the record, so
              series won and lost are exact for every player. Quick and EF events are left out, and so is any event whose field is not a full bracket.
            </p>
            <p>
              It updates with each Monday&apos;s dump (Load Tourney Dumps runs <code className="font-mono">pnpm scoreboard</code>). Results you have
              logged since then are on the PTCS tab; they reach this page with the next dump.
            </p>
          </>
        }
      />
      {has ? (
        <>
          <Kind title="Tournaments" k={board.tournaments} minShown={5} />
          <Kind title="Perfect Drafts" k={board.drafts} minShown={4} />
        </>
      ) : (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">No scoreboard yet. Run <code className="font-mono">pnpm scoreboard</code> after loading a dump.</CardContent></Card>
      )}
    </div>
  );
}
