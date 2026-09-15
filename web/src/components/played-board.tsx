"use client";

/**
 * The Played board: every card with tournament play, ranked by what it did,
 * with the filters a draft needs - value window (round rules), position,
 * hand, year, owned - and a search box. All client-side over the lines the
 * page computed.
 */

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TierDot } from "@/components/tier-badge";
import { cn } from "@/lib/utils";
import type { Tier } from "@/lib/tiers";

export interface PlayedLine {
  cardId: number; name: string; val: number | null; tier: string | null; pos: string; role: string | null;
  isPitcher: boolean; bats: string | null; throws: string | null; year: number | null; owned: boolean;
  /** Model runs per 700 PA (PT default engine, neutral park). */
  model: number;
  /** Observed runs per 700 on the model's scale; null with no play. */
  obs: number | null;
  /** PA (bats) or batters faced (arms) behind `obs`. */
  n: number;
  pa: number; ip: number; series: number; instances: number;
  /** The ranking figure: model and observed blended by precision. */
  blend: number;
  woba: number | null; fip: number | null;
  stamina: number | null;
  defPos: Record<string, number> | null;
}

type Kind = "hit" | "sp" | "rp";
type SortKey = "blend" | "obs" | "model" | "n" | "series" | "val" | "year" | "woba" | "fip" | "name";
const HIT_POS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
const WINDOWS: Array<[label: string, lo: number, hi: number]> = [
  ["Any", 0, 999], ["101+", 101, 999], ["100", 100, 100], ["Perfect", 100, 999], ["Diamond", 90, 99], ["Gold", 80, 89], ["Silver", 70, 79], ["Bronze", 60, 69], ["Iron", 40, 59],
];
const f1 = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;
const f2 = (v: number) => v.toFixed(2);
const f3 = (v: number) => v.toFixed(3).replace(/^0/, "");

function Seg<T extends string>({ options, value, onChange }: { options: Array<[T, string]>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={cn("rounded px-2.5 py-1 text-xs font-medium", value === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function PlayedBoard({ lines, k, collectionDate }: { lines: PlayedLine[]; k: number; collectionDate: string | null }) {
  const [kind, setKind] = useState<Kind>("hit");
  const [pos, setPos] = useState("all");
  const [win, setWin] = useState(0);
  const [lo, setLo] = useState(""), [hi, setHi] = useState("");
  const [hand, setHand] = useState("all");
  const [yLo, setYLo] = useState(""), [yHi, setYHi] = useState("");
  const [minN, setMinN] = useState("");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "blend", desc: true });
  const [limit, setLimit] = useState(150);

  const defaultMin = kind === "hit" ? 300 : 300;
  const rows = useMemo(() => {
    const vLo = lo ? Number(lo) : WINDOWS[win][1], vHi = hi ? Number(hi) : WINDOWS[win][2];
    const mn = minN ? Number(minN) : defaultMin;
    const ql = q.trim().toLowerCase();
    const out = lines.filter((l) => {
      if (kind === "hit" ? l.isPitcher : !l.isPitcher) return false;
      if (kind === "sp" && l.role !== "SP") return false;
      if (kind === "rp" && l.role === "SP") return false;
      if (l.val != null && (l.val < vLo || l.val > vHi)) return false;
      if (kind === "hit" && pos !== "all" && !(l.defPos && (l.defPos[pos] ?? 0) >= 50) && !(pos === "DH")) return false;
      if (hand !== "all") {
        const h = kind === "hit" ? l.bats : l.throws;
        if (hand === "S" ? h !== "S" : !(h === hand || (kind === "hit" && h === "S"))) return false;
      }
      if (yLo && (l.year ?? 0) < Number(yLo)) return false;
      if (yHi && (l.year ?? 9999) > Number(yHi)) return false;
      if (l.n < mn) return false;
      if (ownedOnly && !l.owned) return false;
      if (ql && !l.name.toLowerCase().includes(ql)) return false;
      return true;
    });
    const dir = sort.desc ? -1 : 1;
    out.sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") return dir * av.localeCompare(bv);
      return dir * ((av as number) - (bv as number));
    });
    return out;
  }, [lines, kind, pos, win, lo, hi, hand, yLo, yHi, minN, ownedOnly, q, sort, defaultMin]);

  const clickSort = (key: SortKey, desc = true) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc }));
  const Th = ({ k: key, label, title, desc = true, right = true }: { k: SortKey; label: string; title?: string; desc?: boolean; right?: boolean }) => (
    <th title={title} onClick={() => clickSort(key, desc)}
      className={cn("cursor-pointer select-none whitespace-nowrap py-2 pl-3", right && "text-right", sort.key === key && "text-foreground")}>
      {label}{sort.key === key ? (sort.desc ? " ▼" : " ▲") : ""}
    </th>
  );
  const isHit = kind === "hit";
  const nPlayed = lines.filter((l) => (isHit ? !l.isPitcher : l.isPitcher)).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="label-eyebrow">What has actually produced</div>
        <h1 className="text-2xl font-semibold tracking-tight">Played</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Every card with tournament play on record — {lines.length.toLocaleString()} cards, Jim-beater teams excluded — ranked by <span className="font-medium text-foreground">Runs</span>: what the card did against its fields, put on the model&rsquo;s scale, blended with the model by how much play it has (K = {k} PA/BF; a card with {(k * 2).toLocaleString()} on record is two-thirds observed). Built for a draft: set the round&rsquo;s value window, a position, a hand, and read down. wOBA / FIP are pooled across every era the card played, so they are context, not the ranking.
          {collectionDate ? <> Owned marks are from the {collectionDate} collection.</> : null}
        </p>
      </div>

      <Card><CardContent className="py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
          <Seg options={[["hit", "Hitters"], ["sp", "Starters"], ["rp", "Relievers"]]} value={kind} onChange={(v) => { setKind(v); setPos("all"); setSort({ key: "blend", desc: true }); }} />
          <div className="flex flex-wrap gap-1">
            {WINDOWS.map(([label], i) => (
              <button key={label} type="button" onClick={() => { setWin(i); setLo(""); setHi(""); }}
                className={cn("rounded-md border px-2 py-0.5 font-mono text-xs", win === i && !lo && !hi ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{label}</button>))}
            <input className="w-14 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-xs" placeholder="min" value={lo} onChange={(e) => setLo(e.target.value)} />
            <input className="w-14 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-xs" placeholder="max" value={hi} onChange={(e) => setHi(e.target.value)} />
          </div>
          {isHit && (
            <div className="flex flex-wrap gap-1">
              {["all", ...HIT_POS, "DH"].map((p) => (
                <button key={p} type="button" onClick={() => setPos(p)} title={p !== "all" && p !== "DH" ? `rated ${p} 50 or better` : undefined}
                  className={cn("rounded-md border px-2 py-0.5 font-mono text-xs", pos === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{p === "all" ? "Any pos" : p}</button>))}
            </div>)}
          <Seg options={[["all", isHit ? "Any bat" : "Any arm"], ["L", "L"], ["R", "R"], ...(isHit ? [["S", "S"] as [string, string]] : [])]} value={hand} onChange={setHand} />
          <label className="flex items-center gap-1.5"><span className="text-xs uppercase tracking-wide text-muted-foreground">Years</span>
            <input className="w-16 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-xs" placeholder="from" value={yLo} onChange={(e) => setYLo(e.target.value)} />
            <input className="w-16 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-xs" placeholder="to" value={yHi} onChange={(e) => setYHi(e.target.value)} /></label>
          <label className="flex items-center gap-1.5"><span className="text-xs uppercase tracking-wide text-muted-foreground">Min {isHit ? "PA" : "BF"}</span>
            <input className="w-16 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-xs" placeholder={String(defaultMin)} value={minN} onChange={(e) => setMinN(e.target.value)} /></label>
          <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={ownedOnly} onChange={(e) => setOwnedOnly(e.target.checked)} /> owned only</label>
          <input className="w-44 rounded-md border border-border bg-background px-2 py-1" placeholder="Search a card…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="ml-auto text-xs text-muted-foreground">{rows.length.toLocaleString()} of {nPlayed.toLocaleString()}</span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-2">#</th>
              <Th k="name" label="Card" desc={false} right={false} />
              <Th k="val" label="Val" />
              <th className="py-2 pl-3">Pos</th>
              <th className="py-2 pl-3">{isHit ? "B" : "T"}</th>
              <Th k="year" label="Year" />
              <Th k="blend" label="Runs" title="Observed and model blended by precision - the ranking. Runs per 700 PA (or BF, saved) above a league-average card in the PT default engine." />
              <Th k="obs" label="Observed" title="What the card did against its fields, on the model's scale. Null with no play." />
              <Th k="model" label="Model" title="The rating model alone, PT default engine, neutral park." />
              <Th k="n" label={isHit ? "PA" : "BF"} title="Plate appearances / batters faced on record - the weight behind Observed." />
              {isHit ? <Th k="woba" label="wOBA" title="Pooled across every series the card played - mixes eras" /> : <Th k="fip" label="FIP" desc={false} title="Pooled across every series the card played - mixes eras" />}
              {!isHit && <th className="py-2 pl-3 text-right">STM</th>}
              <Th k="series" label="Series" title="How many different tournament series the card has played in" />
              {isHit && <th className="py-2 pl-3">Rated</th>}
            </tr></thead>
            <tbody className="font-mono text-[13px]">
              {rows.slice(0, limit).map((r, i) => (
                <tr key={r.cardId} className={cn("border-b border-border/40", r.owned && "bg-primary/[0.06]")}>
                  <td className="py-1 pr-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-1 whitespace-nowrap font-sans">
                    <span className="inline-flex items-center gap-1.5">
                      {r.tier && <TierDot tier={r.tier as Tier} />}
                      <span className={cn(r.owned && "font-medium")}>{r.name}</span>
                      {r.owned && <span className="rounded bg-primary/15 px-1 text-[10px] font-semibold text-primary">own</span>}
                    </span>
                  </td>
                  <td className="py-1 pl-3 text-right">{r.val ?? "—"}</td>
                  <td className="py-1 pl-3 text-muted-foreground">{r.isPitcher ? r.role ?? r.pos : r.pos}</td>
                  <td className="py-1 pl-3 text-muted-foreground">{isHit ? r.bats ?? "" : r.throws ?? ""}</td>
                  <td className="py-1 pl-3 text-right text-muted-foreground">{r.year ?? ""}</td>
                  <td className={cn("py-1 pl-3 text-right font-semibold", r.blend >= 0 ? "text-foreground" : "text-muted-foreground")}>{f1(r.blend)}</td>
                  <td className="py-1 pl-3 text-right">{r.obs == null ? <span className="text-muted-foreground">—</span> : f1(r.obs)}</td>
                  <td className="py-1 pl-3 text-right text-muted-foreground">{f1(r.model)}</td>
                  <td className="py-1 pl-3 text-right">{r.n.toLocaleString()}</td>
                  <td className="py-1 pl-3 text-right">{isHit ? (r.woba == null ? "" : f3(r.woba)) : (r.fip == null ? "" : f2(r.fip))}</td>
                  {!isHit && <td className="py-1 pl-3 text-right text-muted-foreground">{r.stamina ?? ""}</td>}
                  <td className="py-1 pl-3 text-right text-muted-foreground">{r.series}</td>
                  {isHit && <td className="py-1 pl-3 text-[11px] text-muted-foreground whitespace-nowrap">
                    {r.defPos ? Object.entries(r.defPos).filter(([, v]) => v >= 50).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([p, v]) => `${p} ${v}`).join(" · ") : ""}
                  </td>}
                </tr>))}
            </tbody>
          </table>
          {rows.length > limit && (
            <button type="button" className="mt-3 text-xs text-primary hover:underline" onClick={() => setLimit((l) => l + 150)}>show {Math.min(150, rows.length - limit)} more</button>)}
        </div>
      </CardContent></Card>
    </div>
  );
}
