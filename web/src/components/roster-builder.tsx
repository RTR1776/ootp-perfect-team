"use client";

/**
 * The tournament roster builder. Pure client interactivity over data the
 * /build server page resolves: pick a slot, click a card, fill a roster.
 *
 * "Fit" is the interim projection: the audit composite (hitters EYE .30 /
 * K-avoid .22 / POW .21 / GAP .10 / DEF .17; pitchers HRA .33 / STU .31 /
 * CON .28 / pBABIP .08), vL/vR-blended .3/.7, percentile-scaled 0-99 within
 * the tournament-legal pool. It gets replaced by the raw-regime model when
 * the modeling phase lands; observed wOBA/FIP sit beside it on purpose.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ObservedLine {
  cardId: number;
  pa: number;
  ip: number;
  woba: number | null;
  fip: number | null;
  war: number;
  instances: number;
}

export interface BuilderCard {
  cardId: number;
  name: string;
  tier: string | null;
  val: number | null;
  pos: string;
  role: string | null;
  isPitcher: boolean;
  bats: string | null;
  year: number | null;
  active: boolean;
  variant: boolean;
  ratings: Record<string, number>;
  obs: ObservedLine | null;
  career: ObservedLine | null;
}

export interface TournamentInfo {
  id: number;
  name: string;
  envYear: number | null;
  mode: string | null;
  stadium: string | null;
  dh: boolean | null;
  entrants: number | null;
  ratingsMin: number | null;
  ratingsMax: number | null;
  cardYearMin: number | null;
  cardYearMax: number | null;
  series: string | null;
  isDraft: boolean;
  park: { name: string; avg: number | null; hr: number | null; b2: number | null; b3: number | null } | null;
}

interface SavedRoster {
  id: number;
  name: string;
  slots: { cardId: number; slot: string; versusHand: string | null; lineupOrder: number | null }[];
}

const HIT_POS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"] as const;

type SlotKey = string; // "R:C", "L:DH", "SP1", "RP3", "CL", "BN2"

/* ------------------------------------------------------------------ */
/* rating helpers                                                      */
/* ------------------------------------------------------------------ */

function blend(r: Record<string, number>, base: string, vl: string, vr: string, wL = 0.3): number {
  const l = r[vl], rr = r[vr];
  if (l != null && rr != null) return wL * l + (1 - wL) * rr;
  return r[base] ?? l ?? rr ?? 0;
}

function bestDef(r: Record<string, number>): number {
  let best = 0;
  for (const p of HIT_POS) best = Math.max(best, r[`Pos Rating ${p}`] ?? 0);
  return best;
}

function hitterRaw(c: BuilderCard, wL: number): number {
  const r = c.ratings;
  return (
    0.3 * blend(r, "Eye", "Eye vL", "Eye vR", wL) +
    0.22 * blend(r, "Avoid Ks", "Avoid K vL", "Avoid K vR", wL) +
    0.21 * blend(r, "Power", "Power vL", "Power vR", wL) +
    0.1 * blend(r, "Gap", "Gap vL", "Gap vR", wL) +
    0.17 * bestDef(r)
  );
}

function pitcherRaw(c: BuilderCard, wL: number): number {
  const r = c.ratings;
  return (
    0.33 * blend(r, "pHR", "pHR vL", "pHR vR", wL) +
    0.31 * blend(r, "Stuff", "Stuff vL", "Stuff vR", wL) +
    0.28 * blend(r, "Control", "Control vL", "Control vR", wL) +
    0.08 * blend(r, "pBABIP", "pBABIP vL", "pBABIP vR", wL)
  );
}

function percentileMap(values: Map<number, number>): Map<number, number> {
  const sorted = [...values.values()].sort((a, b) => a - b);
  const out = new Map<number, number>();
  for (const [id, v] of values) {
    let lo = 0, hi = sorted.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] <= v) lo = m + 1; else hi = m; }
    out.set(id, Math.round((lo / sorted.length) * 99));
  }
  return out;
}

/* ------------------------------------------------------------------ */

export function RosterBuilder({
  catalog,
  tournament,
  pool,
  savedRosters,
}: {
  catalog: { id: number; label: string; simRuns: number; hasSeries: boolean }[];
  tournament: TournamentInfo | null;
  pool: BuilderCard[];
  savedRosters: SavedRoster[];
}) {
  const router = useRouter();
  const [slots, setSlots] = useState<Record<SlotKey, number | null>>({});
  const [selected, setSelected] = useState<SlotKey | null>(null);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<string>("ALL");
  const [legalOnly, setLegalOnly] = useState(true);
  const [sortBy, setSortBy] = useState<"fit" | "woba" | "pa" | "cwoba" | "val">("fit");
  const [rosterName, setRosterName] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const dh = tournament?.dh ?? true;
  const lineupPos: string[] = dh ? [...HIT_POS, "DH"] : [...HIT_POS];

  /* legality + fit ------------------------------------------------- */
  const legal = (c: BuilderCard): string | null => {
    if (!tournament) return null;
    const { ratingsMin, ratingsMax, cardYearMin, cardYearMax } = tournament;
    if (ratingsMax != null && (c.val ?? 0) > ratingsMax) return `VAL ${c.val} > cap ${ratingsMax}`;
    if (ratingsMin != null && (c.val ?? 0) < ratingsMin) return `VAL ${c.val} < floor ${ratingsMin}`;
    if (cardYearMin != null && c.year != null && c.year < cardYearMin) return `year ${c.year} < ${cardYearMin}`;
    if (cardYearMax != null && c.year != null && c.year > cardYearMax) return `year ${c.year} > ${cardYearMax}`;
    return null;
  };

  const { fitR, fitL } = useMemo(() => {
    const legalPool = pool.filter((c) => legal(c) == null);
    const hR = new Map<number, number>(), hL = new Map<number, number>();
    const pR = new Map<number, number>(), pL = new Map<number, number>();
    for (const c of legalPool) {
      if (c.isPitcher) { pR.set(c.cardId, pitcherRaw(c, 0.3)); pL.set(c.cardId, pitcherRaw(c, 1)); }
      else { hR.set(c.cardId, hitterRaw(c, 0.3)); hL.set(c.cardId, hitterRaw(c, 1)); }
    }
    const merge = (a: Map<number, number>, b: Map<number, number>) => new Map([...percentileMap(a), ...percentileMap(b)]);
    return { fitR: merge(hR, pR), fitL: merge(hL, pL) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, tournament?.id]);

  const byId = useMemo(() => new Map(pool.map((c) => [c.cardId, c])), [pool]);
  const used = useMemo(() => new Set(Object.values(slots).filter((v): v is number => v != null)), [slots]);

  const posEligible = (c: BuilderCard, slot: SlotKey): boolean => {
    if (slot.startsWith("SP")) return c.isPitcher && (c.role === "SP" || c.role == null);
    if (slot.startsWith("RP") || slot === "CL") return c.isPitcher;
    if (slot.startsWith("BN")) return true;
    const pos = slot.split(":")[1];
    if (pos === "DH") return !c.isPitcher;
    return !c.isPitcher && (c.ratings[`Pos Rating ${pos}`] ?? 0) > 0;
  };

  /* table rows ------------------------------------------------------ */
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = pool.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (posFilter === "SP") return c.isPitcher && c.role === "SP";
      if (posFilter === "RP") return c.isPitcher && c.role !== "SP";
      if (posFilter === "HIT") return !c.isPitcher;
      if (posFilter !== "ALL") return !c.isPitcher && (c.ratings[`Pos Rating ${posFilter}`] ?? 0) > 0;
      return true;
    });
    if (legalOnly) list = list.filter((c) => legal(c) == null);
    const key = (c: BuilderCard): number => {
      switch (sortBy) {
        case "woba": return c.isPitcher ? -(c.obs?.fip == null ? 99 : c.obs.fip) : c.obs?.woba ?? -1;
        case "pa": return c.isPitcher ? c.obs?.ip ?? 0 : c.obs?.pa ?? 0;
        case "cwoba": return c.isPitcher ? -(c.career?.fip == null ? 99 : c.career.fip) : c.career?.woba ?? -1;
        case "val": return c.val ?? 0;
        default: return fitR.get(c.cardId) ?? -1;
      }
    };
    return list.sort((a, b) => key(b) - key(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, search, posFilter, legalOnly, sortBy, fitR, tournament?.id]);

  /* actions --------------------------------------------------------- */
  const slotOrder: SlotKey[] = [
    ...lineupPos.map((p) => `R:${p}`),
    ...lineupPos.map((p) => `L:${p}`),
    "SP1", "SP2", "SP3", "SP4", "SP5", "CL", "RP1", "RP2", "RP3", "RP4", "RP5",
    "BN1", "BN2", "BN3", "BN4", "BN5",
  ];

  const assign = (slot: SlotKey, cardId: number | null) => {
    setSlots((s) => ({ ...s, [slot]: cardId }));
    if (cardId != null) {
      const next = slotOrder.find((k) => k !== slot && (slots[k] ?? null) == null && k.startsWith(slot.split(":")[0].charAt(0) === slot.charAt(0) ? slot.split(":")[0] + ":" : ""));
      setSelected(next ?? null);
    }
  };

  const clickCard = (c: BuilderCard) => {
    if (!selected) { setMsg("Pick a slot first (click one on the right)."); return; }
    if (!posEligible(c, selected)) { setMsg(`${c.name} can't fill ${selected.replace(":", " ")}.`); return; }
    if (used.has(c.cardId)) { setMsg(`${c.name} is already slotted — clear it first.`); return; }
    setMsg(null);
    assign(selected, c.cardId);
  };

  const autoFill = () => {
    const next: Record<SlotKey, number | null> = {};
    const taken = new Set<number>();
    const legalPool = pool.filter((c) => legal(c) == null);
    const fillLineup = (hand: "R" | "L") => {
      const fit = hand === "R" ? fitR : fitL;
      const order = [...lineupPos].sort((a, b) => {
        const n = (p: string) => (p === "DH" ? 999 : legalPool.filter((c) => !c.isPitcher && (c.ratings[`Pos Rating ${p}`] ?? 0) > 0).length);
        return n(a) - n(b);
      });
      for (const pos of order) {
        const cand = legalPool
          .filter((c) => !c.isPitcher && !taken.has(c.cardId) && (pos === "DH" || (c.ratings[`Pos Rating ${pos}`] ?? 0) > 0))
          .sort((a, b) => (fit.get(b.cardId) ?? 0) - (fit.get(a.cardId) ?? 0))[0];
        if (cand) { next[`${hand}:${pos}`] = cand.cardId; taken.add(cand.cardId); }
      }
      // both lineups share cards — free them for the other hand's picks
      if (hand === "R") for (const pos of lineupPos) { const id = next[`R:${pos}`]; if (id != null) taken.delete(id); }
    };
    fillLineup("R");
    fillLineup("L");
    // staff: SPs, closer, pen — a card used in a lineup can't also pitch
    const usedIds = new Set(Object.values(next).filter((v): v is number => v != null));
    const arms = legalPool.filter((c) => c.isPitcher && !usedIds.has(c.cardId))
      .sort((a, b) => (fitR.get(b.cardId) ?? 0) - (fitR.get(a.cardId) ?? 0));
    const sps = arms.filter((c) => c.role === "SP").slice(0, 5);
    sps.forEach((c, i) => { next[`SP${i + 1}`] = c.cardId; usedIds.add(c.cardId); });
    const cl = arms.find((c) => c.role === "CL" && !usedIds.has(c.cardId)) ?? arms.find((c) => !usedIds.has(c.cardId) && c.role !== "SP");
    if (cl) { next["CL"] = cl.cardId; usedIds.add(cl.cardId); }
    arms.filter((c) => !usedIds.has(c.cardId)).slice(0, 5).forEach((c, i) => { next[`RP${i + 1}`] = c.cardId; usedIds.add(c.cardId); });
    // bench: best remaining hitters
    legalPool.filter((c) => !c.isPitcher && !usedIds.has(c.cardId) && ![...lineupPos].some((p) => next[`R:${p}`] === c.cardId || next[`L:${p}`] === c.cardId))
      .sort((a, b) => (fitR.get(b.cardId) ?? 0) - (fitR.get(a.cardId) ?? 0))
      .slice(0, 5)
      .forEach((c, i) => { next[`BN${i + 1}`] = c.cardId; });
    setSlots(next);
    setMsg(null);
  };

  const save = async () => {
    if (!tournament) return;
    const name = rosterName.trim() || `${tournament.name} roster`;
    const payload = {
      tournamentId: tournament.id,
      name,
      slots: Object.entries(slots)
        .filter(([, v]) => v != null)
        .map(([k, v]) => {
          const [a, b] = k.split(":");
          const isLineup = b != null;
          return {
            cardId: v as number,
            slot: isLineup ? b : a,
            versusHand: isLineup ? a : "both",
            lineupOrder: isLineup ? lineupPos.indexOf(b) : null,
          };
        }),
    };
    setSaving(true);
    const res = await fetch("/api/rosters", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (res.ok) { setMsg(`Saved “${name}”.`); router.refresh(); }
    else setMsg(`Save failed (${res.status}).`);
  };

  const loadSaved = (r: SavedRoster) => {
    const next: Record<SlotKey, number | null> = {};
    for (const s of r.slots) {
      const key = s.versusHand === "R" || s.versusHand === "L" ? `${s.versusHand}:${s.slot}` : s.slot;
      next[key] = s.cardId;
    }
    setSlots(next);
    setMsg(`Loaded “${r.name}”.`);
  };

  /* summary ---------------------------------------------------------- */
  const summary = useMemo(() => {
    const lineupIds = lineupPos.map((p) => slots[`R:${p}`]).filter((v): v is number => v != null);
    const hitters = lineupIds.map((id) => byId.get(id)!).filter(Boolean);
    const armsIds = ["SP1", "SP2", "SP3", "SP4", "SP5", "CL", "RP1", "RP2", "RP3", "RP4", "RP5"]
      .map((k) => slots[k]).filter((v): v is number => v != null);
    const arms = armsIds.map((id) => byId.get(id)!).filter(Boolean);
    const wobaOfCard = (c: BuilderCard) => c.obs?.woba ?? c.career?.woba ?? null;
    const fipOfCard = (c: BuilderCard) => c.obs?.fip ?? c.career?.fip ?? null;
    const wpa = hitters.reduce((s, c) => s + (c.obs?.pa ?? c.career?.pa ?? 0), 0);
    const woba = wpa > 0
      ? hitters.reduce((s, c) => s + (wobaOfCard(c) ?? 0) * (c.obs?.pa ?? c.career?.pa ?? 0), 0) / wpa
      : null;
    const wip = arms.reduce((s, c) => s + (c.obs?.ip ?? c.career?.ip ?? 0), 0);
    const fip = wip > 0
      ? arms.reduce((s, c) => s + (fipOfCard(c) ?? 0) * (c.obs?.ip ?? c.career?.ip ?? 0), 0) / wip
      : null;
    const defAvg = (() => {
      const vals = lineupPos.filter((p) => p !== "DH").map((p) => {
        const id = slots[`R:${p}`]; if (id == null) return null;
        return byId.get(id)?.ratings[`Pos Rating ${p}`] ?? null;
      }).filter((v): v is number => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    })();
    const fitAvg = (ids: number[], m: Map<number, number>) =>
      ids.length ? ids.reduce((s, id) => s + (m.get(id) ?? 0), 0) / ids.length : null;
    return {
      filled: Object.values(slots).filter((v) => v != null).length,
      total: slotOrder.length,
      hitFit: fitAvg(lineupIds, fitR),
      armFit: fitAvg(armsIds, fitR),
      woba, fip, defAvg,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, byId, fitR]);

  /* render ----------------------------------------------------------- */
  const fmt3 = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(3).replace(/^0/, ""));
  const fmt2 = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(2));

  const pickTournament = (id: string) => router.push(id ? `/build?t=${id}` : "/build");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Build</h1>
          <p className="text-sm text-muted-foreground">
            Pick a tournament, click a slot, click a card. Fit is the interim projection; wOBA/FIP are observed.
          </p>
        </div>
        <select
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          value={tournament ? String(tournament.id) : ""}
          onChange={(e) => pickTournament(e.target.value)}
        >
          <option value="">Choose a tournament…</option>
          {catalog.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}{c.hasSeries ? " ●" : ""} {c.simRuns ? ` (${c.simRuns})` : ""}
            </option>
          ))}
        </select>
      </div>

      {!tournament ? (
        <p className="text-sm text-muted-foreground">
          ● marks tournaments with your observed stats. Counts are databotai sim runs.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            {tournament.envYear && <Badge variant="outline">era {tournament.envYear}</Badge>}
            {tournament.stadium && <Badge variant="outline">{tournament.stadium}</Badge>}
            {tournament.park?.hr != null && <Badge variant="outline">park HR ×{tournament.park.hr.toFixed(2)}</Badge>}
            {tournament.park?.avg != null && <Badge variant="outline">park AVG ×{tournament.park.avg.toFixed(2)}</Badge>}
            {tournament.mode && <Badge variant="outline">{tournament.mode}</Badge>}
            {tournament.entrants && <Badge variant="outline">{tournament.entrants} teams</Badge>}
            <Badge variant="outline">{tournament.dh === false ? "no DH" : "DH"}</Badge>
            {tournament.ratingsMax != null && <Badge variant="outline">cards {tournament.ratingsMin ?? 40}–{tournament.ratingsMax}</Badge>}
            {tournament.cardYearMin != null && <Badge variant="outline">years {tournament.cardYearMin}–{tournament.cardYearMax}</Badge>}
            {tournament.series
              ? <Badge>observed: {tournament.series}</Badge>
              : <Badge variant="outline">no observed data yet</Badge>}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* pool table */}
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Input placeholder="Search cards…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-48" />
                {["ALL", "HIT", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "SP", "RP"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPosFilter(p)}
                    className={cn(
                      "rounded-full border border-border px-2.5 py-0.5 text-xs",
                      posFilter === p ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p}
                  </button>
                ))}
                <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={legalOnly} onChange={(e) => setLegalOnly(e.target.checked)} />
                  legal only
                </label>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-2">Card</th>
                      <th className="px-2">Pos</th>
                      <th className="cursor-pointer px-2 text-right" onClick={() => setSortBy("val")}>VAL</th>
                      <th className="cursor-pointer px-2 text-right" onClick={() => setSortBy("fit")}>Fit{sortBy === "fit" ? " ↓" : ""}</th>
                      <th className="cursor-pointer px-2 text-right" onClick={() => setSortBy("woba")} title="Observed in this tournament">
                        {`Obs ${tournament.series ? "wOBA/FIP" : "—"}`}{sortBy === "woba" ? " ↓" : ""}
                      </th>
                      <th className="cursor-pointer px-2 text-right" onClick={() => setSortBy("pa")}>PA/IP{sortBy === "pa" ? " ↓" : ""}</th>
                      <th className="cursor-pointer px-2 text-right" onClick={() => setSortBy("cwoba")} title="PA-weighted across all your tourneys">Career{sortBy === "cwoba" ? " ↓" : ""}</th>
                      <th className="px-2" />
                    </tr>
                  </thead>
                  <tbody className="font-mono text-[13px] [font-variant-numeric:tabular-nums]">
                    {rows.slice(0, 400).map((c) => {
                      const why = legal(c);
                      const inUse = used.has(c.cardId);
                      return (
                        <tr
                          key={c.cardId}
                          onClick={() => why == null && clickCard(c)}
                          className={cn(
                            "border-b border-border/50",
                            why == null ? "cursor-pointer hover:bg-muted/50" : "opacity-40",
                            inUse && "bg-muted/60",
                          )}
                        >
                          <td className="px-2 py-1.5 font-sans">
                            {c.name}
                            {c.variant && <span className="ml-1 text-xs text-muted-foreground">VAR</span>}
                            {why && <span className="ml-2 rounded bg-muted px-1.5 text-[10px] text-muted-foreground">{why}</span>}
                          </td>
                          <td className="px-2">{c.isPitcher ? c.role ?? "P" : c.pos}</td>
                          <td className="px-2 text-right">{c.val ?? "—"}</td>
                          <td className="px-2 text-right font-semibold">{fitR.get(c.cardId) ?? "—"}</td>
                          <td className="px-2 text-right">{c.isPitcher ? fmt2(c.obs?.fip) : fmt3(c.obs?.woba)}</td>
                          <td className="px-2 text-right">{c.isPitcher ? (c.obs?.ip ?? "—") : (c.obs?.pa ?? "—")}</td>
                          <td className="px-2 text-right">{c.isPitcher ? fmt2(c.career?.fip) : fmt3(c.career?.woba)}</td>
                          <td className="px-2 text-right text-xs text-muted-foreground">{inUse ? "slotted" : ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                {rows.length} cards{rows.length > 400 ? " (showing 400)" : ""}. Fit = interim rating composite scaled 0–99 within the legal pool — the raw-tourney model replaces it later. Variant limits and LIVE-only rules aren’t enforced yet.
              </p>
            </div>

            {/* roster panel */}
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">Roster · {summary.filled}/{summary.total}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={autoFill}>Auto-fill</Button>
                    <Button size="sm" variant="outline" onClick={() => { setSlots({}); setMsg(null); }}>Clear</Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 text-xs [font-variant-numeric:tabular-nums]">
                  <div>Lineup fit <span className="float-right font-mono">{summary.hitFit == null ? "—" : Math.round(summary.hitFit)}</span></div>
                  <div>Staff fit <span className="float-right font-mono">{summary.armFit == null ? "—" : Math.round(summary.armFit)}</span></div>
                  <div>Obs wOBA <span className="float-right font-mono">{fmt3(summary.woba)}</span></div>
                  <div>Obs FIP <span className="float-right font-mono">{fmt2(summary.fip)}</span></div>
                  <div>Def (pos rtg) <span className="float-right font-mono">{summary.defAvg == null ? "—" : Math.round(summary.defAvg)}</span></div>
                </div>
              </div>

              {(["R", "L"] as const).map((hand) => (
                <div key={hand} className="rounded-lg border border-border p-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">vs {hand}HP</div>
                  {lineupPos.map((p) => (
                    <SlotRow key={p} k={`${hand}:${p}`} label={p} slots={slots} byId={byId} selected={selected} setSelected={setSelected} assign={assign} />
                  ))}
                </div>
              ))}

              <div className="rounded-lg border border-border p-3">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Staff</div>
                {["SP1", "SP2", "SP3", "SP4", "SP5", "CL", "RP1", "RP2", "RP3", "RP4", "RP5"].map((k) => (
                  <SlotRow key={k} k={k} label={k} slots={slots} byId={byId} selected={selected} setSelected={setSelected} assign={assign} />
                ))}
              </div>

              <div className="rounded-lg border border-border p-3">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bench</div>
                {["BN1", "BN2", "BN3", "BN4", "BN5"].map((k) => (
                  <SlotRow key={k} k={k} label={k} slots={slots} byId={byId} selected={selected} setSelected={setSelected} assign={assign} />
                ))}
              </div>

              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Save</div>
                <div className="flex gap-2">
                  <Input placeholder="Roster name" value={rosterName} onChange={(e) => setRosterName(e.target.value)} className="h-8" />
                  <Button size="sm" onClick={save} disabled={saving || summary.filled === 0}>{saving ? "Saving…" : "Save"}</Button>
                </div>
                {savedRosters.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {savedRosters.map((r) => (
                      <button key={r.id} onClick={() => loadSaved(r)} className="rounded border border-border px-2 py-1 text-left text-xs hover:bg-muted/50">
                        {r.name} <span className="text-muted-foreground">({r.slots.length} slots)</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SlotRow({
  k, label, slots, byId, selected, setSelected, assign,
}: {
  k: SlotKey;
  label: string;
  slots: Record<SlotKey, number | null>;
  byId: Map<number, BuilderCard>;
  selected: SlotKey | null;
  setSelected: (k: SlotKey) => void;
  assign: (k: SlotKey, id: number | null) => void;
}) {
  const id = slots[k] ?? null;
  const card = id != null ? byId.get(id) : null;
  return (
    <div
      onClick={() => setSelected(k)}
      className={cn(
        "flex cursor-pointer items-center justify-between rounded px-2 py-1 text-sm",
        selected === k ? "bg-foreground/10 ring-1 ring-foreground/30" : "hover:bg-muted/40",
      )}
    >
      <span className="w-9 shrink-0 font-mono text-xs text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 flex-1 truncate px-1", !card && "text-muted-foreground/60")}>
        {card ? card.name : "empty"}
      </span>
      {card && (
        <button
          onClick={(e) => { e.stopPropagation(); assign(k, null); }}
          className="ml-1 text-xs text-muted-foreground hover:text-foreground"
          aria-label={`clear ${label}`}
        >
          ×
        </button>
      )}
    </div>
  );
}
