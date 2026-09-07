"use client";

/**
 * The league workbench board: filter bar, meta summary, sortable table.
 * Everything here is client-side over the pooled lines the page computed;
 * week / league scope / split change the URL and re-run the server query.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { TierDot } from "@/components/tier-badge";
import { cn } from "@/lib/utils";
import type { Tier } from "@/lib/tiers";
import { MY_ORG, MY_ORG_SHORT } from "@/lib/my-team";
import {
  HIT_POS, f1, f2, f3, pct1, hitterQual, pitcherQual,
  type HitterLine, type PitcherLine, type MetaSummary,
} from "@/lib/analytics/league-board";

type Kind = "hit" | "sp" | "rp";
interface Filters { week: string; scope: string; split: string }
interface Props {
  hitters: HitterLine[]; pitchers: PitcherLine[]; mineHitters: HitterLine[]; minePitchers: PitcherLine[];
  meta: MetaSummary; filters: Filters; weeks: string[]; leagues: string[];
  scopeInfo: { snapshots: { league: string; capturedOn: string; teams: number }[]; nWeeks: number; myLeague: string[] };
}

type HitCol = { key: keyof HitterLine; label: string; fmt: (v: number) => string; desc?: boolean; title?: string };
type PitCol = { key: keyof PitcherLine; label: string; fmt: (v: number) => string; desc?: boolean; title?: string };
const HIT_COLS: HitCol[] = [
  { key: "pa", label: "PA", fmt: (v) => String(Math.round(v)), desc: true },
  { key: "avg", label: "AVG", fmt: f3, desc: true },
  { key: "obp", label: "OBP", fmt: f3, desc: true },
  { key: "slg", label: "SLG", fmt: f3, desc: true },
  { key: "woba", label: "wOBA", fmt: f3, desc: true, title: "Weighted on-base average from the summed counting stats" },
  { key: "wobaReg", label: "wOBA*", fmt: f3, desc: true, title: "wOBA shrunk toward the pool mean over 600 PA - a one-roster season cannot outrank a 20-roster one on noise" },
  { key: "bbPct", label: "BB%", fmt: pct1, desc: true },
  { key: "kPct", label: "K%", fmt: pct1, desc: false },
  { key: "hr600", label: "HR/600", fmt: f1, desc: true },
  { key: "babip", label: "BABIP", fmt: f3, desc: true },
  { key: "xbhPct", label: "XBH%", fmt: pct1, desc: true, title: "Extra-base hits as a share of hits" },
  { key: "sb600", label: "SB/600", fmt: f1, desc: true },
  { key: "wraa600", label: "wRAA/600", fmt: f1, desc: true },
  { key: "war600", label: "WAR/600", fmt: f1, desc: true },
];
const PIT_COLS: PitCol[] = [
  { key: "ip", label: "IP", fmt: f1, desc: true },
  { key: "era", label: "ERA", fmt: f2, desc: false },
  { key: "fip", label: "FIP", fmt: f2, desc: false, title: "(13·HR + 3·(BB+HBP) − 2·K) / IP + 3.47" },
  { key: "fipReg", label: "FIP*", fmt: f2, desc: false, title: "FIP shrunk toward the pool mean over 150 IP" },
  { key: "siera", label: "SIERA", fmt: f2, desc: false, title: "OOTP's SIERA, innings-weighted across copies" },
  { key: "kPct", label: "K%", fmt: pct1, desc: true },
  { key: "bbPct", label: "BB%", fmt: pct1, desc: false },
  { key: "hr9", label: "HR/9", fmt: f2, desc: false },
  { key: "k9", label: "K/9", fmt: f1, desc: true },
  { key: "war200", label: "WAR/200", fmt: f1, desc: true },
];

function weekLabel(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  const sun = new Date(Date.UTC(y, m - 1, day)); const mon = new Date(sun); mon.setUTCDate(sun.getUTCDate() - 6);
  return `Week of ${mon.getUTCMonth() + 1}/${mon.getUTCDate()} (season ending ${m}/${day})`;
}

const isMine = (orgs: string[]) => orgs.includes(MY_ORG);

export function LeagueBoard({ hitters, pitchers, mineHitters, minePitchers, meta, filters, weeks, leagues, scopeInfo }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("hit");
  const [pos, setPos] = useState<string>("all");
  const [minSelf, setMinSelf] = useState<string>("");
  const [q, setQ] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null);
  const [limit, setLimit] = useState(150);
  const [showMeta, setShowMeta] = useState(true);

  const nav = (patch: Partial<Filters>) => {
    const f = { ...filters, ...patch };
    const p = new URLSearchParams(); if (f.week !== "latest") p.set("week", f.week); if (f.scope !== "all") p.set("league", f.scope); if (f.split !== "all") p.set("split", f.split);
    router.push(`/league${p.toString() ? `?${p}` : ""}`);
  };

  const defaultMin = kind === "hit" ? hitterQual(filters.split, scopeInfo.nWeeks) : pitcherQual(kind === "sp" ? "SP" : "RP", filters.split, scopeInfo.nWeeks);
  const min = minSelf === "" ? defaultMin : Number(minSelf) || 0;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (kind === "hit") {
      const src = mineOnly ? mineHitters : hitters;
      let r = src.filter((h) => h.pa >= min && (pos === "all" || h.pos === pos) && (!needle || h.name.toLowerCase().includes(needle)));
      const s = sort ?? { key: "wobaReg", desc: true };
      r = r.sort((a, b) => { const av = a[s.key as keyof HitterLine] as number, bv = b[s.key as keyof HitterLine] as number; return s.desc ? bv - av : av - bv; });
      return r as (HitterLine | PitcherLine)[];
    }
    const role = kind === "sp" ? "SP" : "RP";
    const src = mineOnly ? minePitchers : pitchers;
    let r = src.filter((p) => p.role === role && p.ip >= min && (!needle || p.name.toLowerCase().includes(needle)));
    const s = sort ?? { key: "fipReg", desc: false };
    r = r.sort((a, b) => { const av = a[s.key as keyof PitcherLine] as number, bv = b[s.key as keyof PitcherLine] as number; return s.desc ? bv - av : av - bv; });
    return r as (HitterLine | PitcherLine)[];
  }, [kind, pos, min, q, mineOnly, sort, hitters, pitchers, mineHitters, minePitchers]);

  const cols = kind === "hit" ? HIT_COLS : PIT_COLS;
  const clickSort = (key: string, desc: boolean | undefined) => setSort((s) => (s?.key === key ? { key, desc: !s.desc } : { key, desc: desc ?? true }));
  const scopeLabel = filters.scope === "all" ? "all leagues" : filters.scope === "HD" ? "High Diamond (pooled)" : filters.scope === "LD" ? "Low Diamond (pooled)" : filters.scope;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-eyebrow">League workbench</div>
          <h1 className="text-2xl font-semibold tracking-tight">League</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            League exports only — one line per card pooled across every roster it sits on ({scopeInfo.snapshots.length} snapshot{scopeInfo.snapshots.length === 1 ? "" : "s"}, {scopeLabel}, split {filters.split}). {MY_ORG} rows carry a <span className="rounded bg-primary/15 px-1 text-[10px] font-semibold text-primary">{MY_ORG_SHORT}</span> mark; &ldquo;{MY_ORG_SHORT} only&rdquo; shows your own copies&rsquo; lines instead of the pooled ones.
          </p>
        </div>
      </div>

      {/* server-side filters */}
      <Card><CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 py-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Week</span>
          <select className="rounded-md border border-border bg-background px-2 py-1" value={filters.week} onChange={(e) => nav({ week: e.target.value })}>
            <option value="latest">Most recent (per league)</option>
            <option value="all">All weeks pooled</option>
            {weeks.map((w) => <option key={w} value={w}>{weekLabel(w)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">League</span>
          <select className="rounded-md border border-border bg-background px-2 py-1" value={filters.scope} onChange={(e) => nav({ scope: e.target.value })}>
            <option value="all">All leagues</option>
            <option value="HD">High Diamond (all HD)</option>
            <option value="LD">Low Diamond (all LD)</option>
            <option value="PEL">Perfect (PEL)</option>
            {leagues.map((l) => <option key={l} value={l}>{l}{scopeInfo.myLeague.includes(l) ? ` · ${MY_ORG_SHORT}` : ""}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Split</span>
          <Seg options={[["all", "All"], ["vL", "vs LHP / LHB"], ["vR", "vs RHP / RHB"]]} value={filters.split} onChange={(v) => nav({ split: v })} />
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {scopeInfo.snapshots.map((s) => `${s.league} ${s.capturedOn.slice(5)}`).join(" · ")}
        </div>
      </CardContent></Card>

      {/* meta summary */}
      <Card><CardContent className="py-4">
        <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setShowMeta((v) => !v)}>
          <div><div className="label-eyebrow">Meta right now</div><div className="text-sm text-muted-foreground">Best qualified card at each spot (≥{meta.qual.pa} PA · SP ≥{meta.qual.spIp} IP · RP ≥{meta.qual.rpIp} IP), ordered by the regressed rate (wOBA* / FIP*) so one hot roster-season does not outrank twenty ordinary ones; and where your cards sit.</div></div>
          <span className="text-xs text-muted-foreground">{showMeta ? "hide" : "show"}</span>
        </button>
        {showMeta && (
          <div className="mt-4 grid gap-6 lg:grid-cols-3">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Best bats by position (wOBA)</div>
              <table className="w-full text-[13px]"><tbody>
                {HIT_POS.map((p) => { const b = meta.bestByPos[p]?.[0]; return (
                  <tr key={p} className="border-t border-border/60"><td className="py-1 pr-2 font-mono text-muted-foreground">{p}</td>
                    <td className="py-1 pr-2">{b ? <Name line={b} /> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-1 text-right font-mono">{b ? f3(b.woba) : ""}</td>
                    <td className="py-1 pl-2 text-right font-mono text-muted-foreground">{b ? `${b.teams} tm` : ""}</td></tr>); })}
              </tbody></table>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Best starters (FIP)</div>
              <MiniPit rows={meta.sp.slice(0, 8)} />
              <div className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Best relievers (FIP)</div>
              <MiniPit rows={meta.rp.slice(0, 6)} />
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{MY_ORG} vs the field</div>
              {meta.mine.hitters.length === 0 && meta.mine.sp.length === 0 ? <div className="text-sm text-muted-foreground">No {MY_ORG} rows in this scope — pick the league you play in.</div> : (
                <table className="w-full text-[13px]"><tbody>
                  {meta.mine.hitters.slice(0, 12).map((h) => (
                    <tr key={h.key} className="border-t border-border/60">
                      <td className="py-1 pr-2 font-mono text-muted-foreground">{h.pos}</td>
                      <td className="py-1 pr-2"><Name line={h} /></td>
                      <td className="py-1 text-right font-mono">{f3(h.woba)}</td>
                      <td className="py-1 pl-2 text-right"><Pct v={h.posPct} /></td>
                      <td className="py-1 pl-2 text-right font-mono text-muted-foreground" title={h.best ? `best ${h.pos}: ${h.best.name} ${f3(h.best.woba)}` : ""}>{h.best ? `${h.gapToBest >= 0 ? "+" : ""}${f3(h.gapToBest)}` : ""}</td>
                    </tr>))}
                  {[...meta.mine.sp, ...meta.mine.rp].slice(0, 8).map((p) => (
                    <tr key={p.key} className="border-t border-border/60">
                      <td className="py-1 pr-2 font-mono text-muted-foreground">{p.pos}</td>
                      <td className="py-1 pr-2"><Name line={p} /></td>
                      <td className="py-1 text-right font-mono">{f2(p.fip)}</td>
                      <td className="py-1 pl-2 text-right"><Pct v={p.posPct} /></td>
                      <td className="py-1 pl-2 text-right font-mono text-muted-foreground" title={p.best ? `best ${p.role}: ${p.best.name} ${f2(p.best.fip)}` : ""}>{p.best ? `${p.gapToBest >= 0 ? "+" : ""}${f2(p.gapToBest)}` : ""}</td>
                    </tr>))}
                </tbody></table>)}
              <div className="mt-1 text-[11px] text-muted-foreground">wOBA / FIP · percentile at the position among qualified cards · gap to the best.</div>
            </div>
          </div>
        )}
      </CardContent></Card>

      {/* client-side filters + table */}
      <Card><CardContent className="py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
          <Seg options={[["hit", "Hitters"], ["sp", "Starters"], ["rp", "Relievers"]]} value={kind} onChange={(v) => { setKind(v as Kind); setSort(null); setMinSelf(""); }} />
          {kind === "hit" && (
            <div className="flex flex-wrap gap-1">
              {["all", ...HIT_POS].map((p) => (
                <button key={p} type="button" onClick={() => setPos(p)} className={cn("rounded-md border px-2 py-0.5 font-mono text-xs", pos === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{p === "all" ? "All" : p}</button>))}
            </div>)}
          <label className="flex items-center gap-2"><span className="text-xs uppercase tracking-wide text-muted-foreground">Min {kind === "hit" ? "PA" : "IP"}</span>
            <input className="w-20 rounded-md border border-border bg-background px-2 py-1 font-mono" value={minSelf} placeholder={String(defaultMin)} onChange={(e) => setMinSelf(e.target.value)} /></label>
          <input className="w-48 rounded-md border border-border bg-background px-2 py-1" placeholder="Search a card…" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> {MY_ORG_SHORT} only</label>
          <span className="ml-auto text-xs text-muted-foreground">{rows.length} cards</span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3">Pos</th><th className="py-2 pr-3">Card</th><th className="py-2 pr-3 text-right">Tm</th>
              {cols.map((c) => (
                <th key={c.key as string} title={c.title} className={cn("cursor-pointer select-none py-2 pl-3 text-right whitespace-nowrap", sort?.key === c.key && "text-foreground")} onClick={() => clickSort(c.key as string, c.desc)}>
                  {c.label}{sort?.key === c.key ? (sort.desc ? " ▼" : " ▲") : ""}
                </th>))}
            </tr></thead>
            <tbody className="font-mono text-[13px]">
              {rows.slice(0, limit).map((r) => (
                <tr key={r.key} className={cn("border-b border-border/40", isMine(r.orgs) && "bg-primary/[0.06]")}>
                  <td className="py-1 pr-3 text-muted-foreground">{r.pos}</td>
                  <td className="py-1 pr-3 font-sans"><Name line={r} /></td>
                  <td className="py-1 pr-3 text-right text-muted-foreground">{r.teams}</td>
                  {cols.map((c) => <td key={c.key as string} className="py-1 pl-3 text-right">{c.fmt((r as unknown as Record<string, number>)[c.key as string])}</td>)}
                </tr>))}
              {rows.length === 0 && <tr><td colSpan={3 + cols.length} className="py-6 text-center font-sans text-muted-foreground">Nothing qualifies — lower the minimum.</td></tr>}
            </tbody>
          </table>
          {rows.length > limit && <button type="button" className="mt-3 text-xs text-primary" onClick={() => setLimit((l) => l + 150)}>Show {Math.min(150, rows.length - limit)} more</button>}
        </div>
      </CardContent></Card>
    </div>
  );
}

function Seg({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5">
      {options.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={cn("rounded px-2.5 py-1 text-xs font-medium", value === v ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>{l}</button>))}
    </div>
  );
}

function Name({ line }: { line: { name: string; val: number | null; tier: string | null; isVariant: boolean; cardYear: number | null; orgs: string[] } }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {line.tier && <TierDot tier={line.tier as Tier} />}
      <span>{line.name}</span>
      <span className="font-mono text-[11px] text-muted-foreground">{line.val ?? ""}{line.cardYear ? ` ${line.cardYear}` : ""}{line.isVariant ? " VAR" : ""}</span>
      {isMine(line.orgs) && <span className="rounded bg-primary/15 px-1 text-[10px] font-semibold text-primary">{MY_ORG_SHORT}</span>}
    </span>
  );
}

function Pct({ v }: { v: number }) {
  const tone = v >= 80 ? "text-emerald-500" : v >= 50 ? "text-foreground" : v >= 25 ? "text-amber-500" : "text-red-500";
  return <span className={cn("font-mono", tone)}>{v}<span className="text-[10px] text-muted-foreground">th</span></span>;
}

function MiniPit({ rows }: { rows: PitcherLine[] }) {
  return (
    <table className="w-full text-[13px]"><tbody>
      {rows.map((p) => (
        <tr key={p.key} className="border-t border-border/60">
          <td className="py-1 pr-2"><Name line={p} /></td>
          <td className="py-1 text-right font-mono">{f2(p.fip)}</td>
          <td className="py-1 pl-2 text-right font-mono text-muted-foreground">{pct1(p.kPct)}% K</td>
          <td className="py-1 pl-2 text-right font-mono text-muted-foreground">{p.teams} tm</td>
        </tr>))}
      {rows.length === 0 && <tr><td className="py-1 text-muted-foreground">—</td></tr>}
    </tbody></table>
  );
}
