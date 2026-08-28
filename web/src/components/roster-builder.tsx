"use client";

/**
 * The tournament roster builder. Pure client interactivity over data the
 * /build server page resolves: pick a slot, click a card, fill a roster.
 *
 * Projections are model v0 (observed wOBA/FIP regressed on ratings —
 * scripts/fit-projection.ts); Fit stays as the 0–99 percentile composite
 * within this tournament's legal pool. Observed numbers ride along per
 * column with PA/IP, full detail on hover. The pool arrives pre-filtered
 * to tournament-legal cards, split across Hitters / Pitchers views, with
 * an Upgrades view of the best legal cards not in the collection.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cardArtUrl } from "@/lib/card-art";
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

export interface Proj {
  all: number | null;
  vL: number | null;
  vR: number | null;
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
  proj: Proj;
  obs: ObservedLine | null;
  career: ObservedLine | null;
}

export interface UpgradeCard {
  cardId: number;
  name: string;
  tier: string | null;
  val: number | null;
  pos: string;
  isPitcher: boolean;
  year: number | null;
  proj: Proj;
  last10: number | null;
  ask: number | null;
}

export interface CatalogGroup {
  label: string;
  items: { id: number; label: string; hasSeries: boolean; simRuns: number }[];
}

export interface SeriesMetaInfo {
  files: number;
  avgTeams: number | null;
  avgSp: number | null;
  avgRp: number | null;
  avgBats: number | null;
  topCards: {
    cardId: number; name: string; pos: string; isPitcher: boolean;
    teams: number; pct: number; pa: number; ip: number;
  }[];
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
  retired: boolean;
  park: { name: string; avg: number | null; hr: number | null; b2: number | null; b3: number | null } | null;
}

interface SavedRoster {
  id: number;
  name: string;
  slots: { cardId: number; slot: string; versusHand: string | null; lineupOrder: number | null }[];
}

const HIT_POS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"] as const;
const STAFF_KEYS = ["SP1", "SP2", "SP3", "SP4", "SP5", "CL", "RP1", "RP2", "RP3", "RP4", "RP5"];
const BENCH_KEYS = ["BN1", "BN2", "BN3", "BN4", "BN5"];

type SlotKey = string; // "R:C", "L:DH", "SP1", "RP3", "CL", "BN2"
type View = "HIT" | "PIT" | "UPG";

/* ------------------------------------------------------------------ */
/* rating helpers (Fit composite)                                      */
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

const fmt3 = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(3).replace(/^0/, ""));
const fmt2 = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(2));
const fmtPts = (v: number | null | undefined) => (v == null || v === 0 ? "—" : v.toLocaleString());

/* ------------------------------------------------------------------ */
/* hover card preview — art loads only while hovered, never up front   */
/* ------------------------------------------------------------------ */

interface Peek {
  cardId: number;
  title: string;
  sub: string;
  stat: string;
  extra: string | null;
  top: number;
  left: number;
}

function peekFrom(el: HTMLElement, cardId: number, title: string, sub: string, stat: string, extra: string | null): Peek {
  const r = el.getBoundingClientRect();
  const H = 240;
  const top = Math.max(8, Math.min(r.top - 40, window.innerHeight - H - 8));
  const left = Math.min(r.right + 10, window.innerWidth - 330);
  return { cardId, title, sub, stat, extra, top, left };
}

function CardPeek({ p }: { p: Peek }) {
  const [artOk, setArtOk] = useState(true);
  useEffect(() => setArtOk(true), [p.cardId]);
  return (
    <div
      className="pointer-events-none fixed z-50 flex w-[320px] gap-3 rounded-lg border border-border bg-background p-3 shadow-xl"
      style={{ top: p.top, left: p.left }}
    >
      {artOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cardArtUrl(p.cardId)}
          alt=""
          width={132}
          height={198}
          loading="lazy"
          onError={() => setArtOk(false)}
          className="h-[198px] w-[132px] shrink-0 rounded object-cover"
        />
      )}
      <div className="min-w-0 text-xs leading-relaxed">
        <div className="font-sans text-sm font-semibold leading-tight">{p.title}</div>
        <div className="mt-0.5 text-muted-foreground">{p.sub}</div>
        <div className="mt-2 font-mono [font-variant-numeric:tabular-nums]">{p.stat}</div>
        {p.extra && <div className="mt-1 text-muted-foreground">{p.extra}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function RosterBuilder({
  groups,
  tournament,
  pool,
  upgrades,
  meta,
  savedRosters,
}: {
  groups: CatalogGroup[];
  tournament: TournamentInfo | null;
  pool: BuilderCard[];
  upgrades: UpgradeCard[];
  meta: SeriesMetaInfo | null;
  savedRosters: SavedRoster[];
}) {
  const router = useRouter();
  const [slots, setSlots] = useState<Record<SlotKey, number | null>>({});
  const [selected, setSelected] = useState<SlotKey | null>(null);
  const [view, setView] = useState<View>("HIT");
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("proj");
  const [rosterName, setRosterName] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [peek, setPeek] = useState<Peek | null>(null);
  const lastTid = useRef<number | null>(null);

  const peekPool = (e: React.MouseEvent<HTMLElement>, c: BuilderCard) => {
    const stat = c.isPitcher
      ? `pFIP ${fmt2(c.proj.all)}  ·  vL ${fmt2(c.proj.vL)} / vR ${fmt2(c.proj.vR)}`
      : `pWOBA ${fmt3(c.proj.all)}  ·  vL ${fmt3(c.proj.vL)} / vR ${fmt3(c.proj.vR)}`;
    const o = c.obs ?? c.career;
    const extra = o
      ? c.isPitcher
        ? `obs FIP ${fmt2(o.fip)} · ${Math.round(o.ip).toLocaleString()} IP · ${o.instances} runs`
        : `obs wOBA ${fmt3(o.woba)} · ${o.pa.toLocaleString()} PA · ${o.instances} runs`
      : "no observed data yet";
    setPeek(peekFrom(e.currentTarget, c.cardId, c.name,
      `${c.isPitcher ? c.role ?? "P" : c.pos} · VAL ${c.val ?? "?"}${c.bats ? ` · bats ${c.bats}` : ""}${c.variant ? " · VAR" : ""}`,
      stat, extra));
  };

  const peekUpgrade = (e: React.MouseEvent<HTMLElement>, u: UpgradeCard) => {
    const stat = u.isPitcher
      ? `pFIP ${fmt2(u.proj.all)}  ·  vL ${fmt2(u.proj.vL)} / vR ${fmt2(u.proj.vR)}`
      : `pWOBA ${fmt3(u.proj.all)}  ·  vL ${fmt3(u.proj.vL)} / vR ${fmt3(u.proj.vR)}`;
    const extra = `L10 ${fmtPts(u.last10)} · ask ${fmtPts(u.ask)}`;
    setPeek(peekFrom(e.currentTarget, u.cardId, u.name, `${u.pos} · VAL ${u.val ?? "?"} · ${u.tier ?? ""}`, stat, extra));
  };

  const dh = tournament?.dh ?? true;
  const lineupPos: string[] = dh ? [...HIT_POS, "DH"] : [...HIT_POS];
  const slotOrder: SlotKey[] = [
    ...lineupPos.map((p) => `R:${p}`),
    ...lineupPos.map((p) => `L:${p}`),
    ...STAFF_KEYS,
    ...BENCH_KEYS,
  ];

  /* fit percentiles (pool is already tournament-legal) ---------------- */
  const { fitR, fitL } = useMemo(() => {
    const hR = new Map<number, number>(), hL = new Map<number, number>();
    const pR = new Map<number, number>(), pL = new Map<number, number>();
    for (const c of pool) {
      if (c.isPitcher) { pR.set(c.cardId, pitcherRaw(c, 0.3)); pL.set(c.cardId, pitcherRaw(c, 1)); }
      else { hR.set(c.cardId, hitterRaw(c, 0.3)); hL.set(c.cardId, hitterRaw(c, 1)); }
    }
    const merge = (a: Map<number, number>, b: Map<number, number>) => new Map([...percentileMap(a), ...percentileMap(b)]);
    return { fitR: merge(hR, pR), fitL: merge(hL, pL) };
  }, [pool]);

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
    const wantPitcher = view === "PIT";
    const list = pool.filter((c) => {
      if (c.isPitcher !== wantPitcher) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (view === "PIT") {
        if (posFilter === "SP") return c.role === "SP";
        if (posFilter === "RP") return c.role !== "SP";
        return true;
      }
      if (posFilter === "ALL") return true;
      return (c.ratings[`Pos Rating ${posFilter}`] ?? 0) > 0;
    });
    // For FIP-flavored keys lower is better — flip the sign so one desc sort serves both.
    const dir = wantPitcher && ["proj", "pvl", "pvr", "obs", "car"].includes(sortBy) ? -1 : 1;
    const key = (c: BuilderCard): number => {
      const miss = wantPitcher ? 99 : -1;
      switch (sortBy) {
        case "pvl": return c.proj.vL ?? miss;
        case "pvr": return c.proj.vR ?? miss;
        case "fit": return fitR.get(c.cardId) ?? -1;
        case "obs": return (wantPitcher ? c.obs?.fip : c.obs?.woba) ?? miss;
        case "pa": return (wantPitcher ? c.obs?.ip : c.obs?.pa) ?? 0;
        case "car": return (wantPitcher ? c.career?.fip : c.career?.woba) ?? miss;
        case "val": return c.val ?? 0;
        default: return c.proj.all ?? miss;
      }
    };
    return list.sort((a, b) => dir * (key(b) - key(a)));
  }, [pool, search, posFilter, sortBy, view, fitR]);

  const upgradeRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return upgrades.filter((u) => (view !== "UPG" ? false : !q || u.name.toLowerCase().includes(q)));
  }, [upgrades, search, view]);

  /* actions --------------------------------------------------------- */
  const assign = (slot: SlotKey, cardId: number | null) => {
    setSlots((s) => ({ ...s, [slot]: cardId }));
    if (cardId != null) setSelected(null);
  };

  const clickCard = (c: BuilderCard) => {
    if (!selected) { setMsg("Pick a slot first (click one on the right)."); return; }
    if (!posEligible(c, selected)) { setMsg(`${c.name} can't fill ${selected.replace(":", " ")}.`); return; }
    if (used.has(c.cardId)) { setMsg(`${c.name} is already slotted — clear it first.`); return; }
    setMsg(null);
    assign(selected, c.cardId);
  };

  const autoFill = (silent = false) => {
    const next: Record<SlotKey, number | null> = {};
    const taken = new Set<number>();
    const fillLineup = (hand: "R" | "L") => {
      const fit = hand === "R" ? fitR : fitL;
      const order = [...lineupPos].sort((a, b) => {
        const n = (p: string) => (p === "DH" ? 999 : pool.filter((c) => !c.isPitcher && (c.ratings[`Pos Rating ${p}`] ?? 0) > 0).length);
        return n(a) - n(b);
      });
      for (const pos of order) {
        const cand = pool
          .filter((c) => !c.isPitcher && !taken.has(c.cardId) && (pos === "DH" || (c.ratings[`Pos Rating ${pos}`] ?? 0) > 0))
          .sort((a, b) => (fit.get(b.cardId) ?? 0) - (fit.get(a.cardId) ?? 0))[0];
        if (cand) { next[`${hand}:${pos}`] = cand.cardId; taken.add(cand.cardId); }
      }
      // both lineups share cards — free them for the other hand's picks
      if (hand === "R") for (const pos of lineupPos) { const id = next[`R:${pos}`]; if (id != null) taken.delete(id); }
    };
    fillLineup("R");
    fillLineup("L");
    const usedIds = new Set(Object.values(next).filter((v): v is number => v != null));
    const arms = pool.filter((c) => c.isPitcher && !usedIds.has(c.cardId))
      .sort((a, b) => (fitR.get(b.cardId) ?? 0) - (fitR.get(a.cardId) ?? 0));
    const sps = arms.filter((c) => c.role === "SP").slice(0, 5);
    sps.forEach((c, i) => { next[`SP${i + 1}`] = c.cardId; usedIds.add(c.cardId); });
    const cl = arms.find((c) => c.role === "CL" && !usedIds.has(c.cardId)) ?? arms.find((c) => !usedIds.has(c.cardId) && c.role !== "SP");
    if (cl) { next["CL"] = cl.cardId; usedIds.add(cl.cardId); }
    arms.filter((c) => !usedIds.has(c.cardId)).slice(0, 5).forEach((c, i) => { next[`RP${i + 1}`] = c.cardId; usedIds.add(c.cardId); });
    pool.filter((c) => !c.isPitcher && !usedIds.has(c.cardId) && ![...lineupPos].some((p) => next[`R:${p}`] === c.cardId || next[`L:${p}`] === c.cardId))
      .sort((a, b) => (fitR.get(b.cardId) ?? 0) - (fitR.get(a.cardId) ?? 0))
      .slice(0, 5)
      .forEach((c, i) => { next[`BN${i + 1}`] = c.cardId; });
    setSlots(next);
    setMsg(silent ? "Recommended roster filled — click any slot to tweak it." : null);
  };

  // Recommendations appear the moment a tournament is picked; switching
  // tournaments resets the board and re-recommends for the new pool.
  useEffect(() => {
    if (tournament && lastTid.current !== tournament.id) {
      lastTid.current = tournament.id;
      setSelected(null);
      setSearch("");
      setPosFilter("ALL");
      if (pool.length > 0) autoFill(true);
      else { setSlots({}); setMsg(null); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament?.id, pool]);

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

  /* export ----------------------------------------------------------- */
  const download = (filename: string, content: string, mime: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportLineup = () => {
    if (!tournament) return;
    const name = rosterName.trim() || tournament.name;
    const line = (id: number | null | undefined) => {
      const c = id != null ? byId.get(id) : null;
      return c ? `${c.name} (${c.pos}${c.bats ? `, ${c.bats}` : ""}, VAL ${c.val ?? "?"})` : "—";
    };
    const txt: string[] = [`${name} — ${new Date().toISOString().slice(0, 10)}`, ""];
    for (const hand of ["R", "L"] as const) {
      txt.push(`vs ${hand}HP`);
      lineupPos.forEach((p, i) => txt.push(`  ${i + 1}. ${p.padEnd(2)}  ${line(slots[`${hand}:${p}`])}`));
      txt.push("");
    }
    txt.push("Rotation");
    ["SP1", "SP2", "SP3", "SP4", "SP5"].forEach((k) => txt.push(`  ${k}  ${line(slots[k])}`));
    txt.push("Bullpen");
    ["CL", "RP1", "RP2", "RP3", "RP4", "RP5"].forEach((k) => txt.push(`  ${k.padEnd(3)} ${line(slots[k])}`));
    txt.push("Bench");
    BENCH_KEYS.forEach((k) => txt.push(`  ${k}  ${line(slots[k])}`));

    const csv: string[] = ["Section,Slot,Order,Card ID,Name,Pos,Bats,VAL"];
    const esc = (s: string) => (/[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    for (const k of slotOrder) {
      const id = slots[k];
      if (id == null) continue;
      const c = byId.get(id);
      if (!c) continue;
      const [a, b] = k.split(":");
      const section = b ? `vs ${a}HP` : k.startsWith("BN") ? "Bench" : "Staff";
      const order = b ? lineupPos.indexOf(b) + 1 : "";
      csv.push([section, b ?? a, order, c.cardId, esc(c.name), c.isPitcher ? c.role ?? "P" : c.pos, c.bats ?? "", c.val ?? ""].join(","));
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const base = name.replace(/[^A-Za-z0-9 _-]/g, "").trim().replace(/\s+/g, "_");
    download(`${base}_${stamp}.txt`, txt.join("\n"), "text/plain");
    download(`${base}_${stamp}.csv`, csv.join("\n"), "text/csv");
    setMsg("Exported .txt lineup card + .csv — both hit your Downloads folder.");
  };

  /* summary ---------------------------------------------------------- */
  const summary = useMemo(() => {
    const lineupIds = lineupPos.map((p) => slots[`R:${p}`]).filter((v): v is number => v != null);
    const hitters = lineupIds.map((id) => byId.get(id)!).filter(Boolean);
    const armsIds = STAFF_KEYS.map((k) => slots[k]).filter((v): v is number => v != null);
    const arms = armsIds.map((id) => byId.get(id)!).filter(Boolean);
    const mean = (xs: (number | null)[]) => {
      const v = xs.filter((x): x is number => x != null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const projWoba = mean(hitters.map((c) => c.proj.all));
    const projFip = mean(arms.map((c) => c.proj.all));
    const wpa = hitters.reduce((s, c) => s + (c.obs?.pa ?? c.career?.pa ?? 0), 0);
    const woba = wpa > 0
      ? hitters.reduce((s, c) => s + ((c.obs?.woba ?? c.career?.woba) ?? 0) * (c.obs?.pa ?? c.career?.pa ?? 0), 0) / wpa
      : null;
    const wip = arms.reduce((s, c) => s + (c.obs?.ip ?? c.career?.ip ?? 0), 0);
    const fip = wip > 0
      ? arms.reduce((s, c) => s + ((c.obs?.fip ?? c.career?.fip) ?? 0) * (c.obs?.ip ?? c.career?.ip ?? 0), 0) / wip
      : null;
    const defAvg = (() => {
      const vals = lineupPos.filter((p) => p !== "DH").map((p) => {
        const id = slots[`R:${p}`]; if (id == null) return null;
        return byId.get(id)?.ratings[`Pos Rating ${p}`] ?? null;
      }).filter((v): v is number => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    })();
    return {
      filled: Object.values(slots).filter((v) => v != null).length,
      total: slotOrder.length,
      projWoba, projFip, woba, fip, defAvg,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, byId]);

  /* render ----------------------------------------------------------- */
  const pickTournament = (id: string) => router.push(id ? `/build?t=${id}` : "/build");

  const obsTitle = (o: ObservedLine | null, isP: boolean) =>
    o == null
      ? "no observed data"
      : isP
        ? `observed FIP ${fmt2(o.fip)} over ${o.ip.toLocaleString()} IP · ${o.instances} runs · WAR ${o.war.toFixed(1)}`
        : `observed wOBA ${fmt3(o.woba)} over ${o.pa.toLocaleString()} PA · ${o.instances} runs · WAR ${o.war.toFixed(1)}`;

  const Th = ({ id, label, title, right = true }: { id?: string; label: string; title?: string; right?: boolean }) => (
    <th
      className={cn("px-1.5 py-1.5", right && "text-right", id && "cursor-pointer select-none hover:text-foreground")}
      title={title}
      onClick={id ? () => setSortBy(id) : undefined}
    >
      {label}{id && sortBy === id ? " ↓" : ""}
    </th>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Build</h1>
          <p className="text-sm text-muted-foreground">
            Pick a tournament — a recommended roster fills itself in. Click a slot, then a card, to tweak.
          </p>
        </div>
        <select
          className="h-9 max-w-full rounded-md border border-border bg-background px-3 text-sm"
          value={tournament ? String(tournament.id) : ""}
          onChange={(e) => pickTournament(e.target.value)}
        >
          <option value="">Choose a tournament…</option>
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}{c.hasSeries ? " ●" : ""}{c.simRuns ? ` (${c.simRuns})` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {!tournament ? (
        <p className="text-sm text-muted-foreground">
          ● marks tournaments with your observed stats. Counts are databotai sim runs. R = retired event.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            {tournament.retired && <Badge variant="secondary">Retired</Badge>}
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

          {meta && (
            <div className="rounded-lg border border-border p-3">
              <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-semibold">How teams build here</span>
                <span className="text-xs text-muted-foreground">
                  {meta.files} runs archived · ~{meta.avgTeams ?? "?"} teams/run ·
                  per team: {meta.avgSp ?? "?"} SP · {meta.avgRp ?? "?"} RP · {meta.avgBats ?? "?"} hitters
                </span>
              </div>
              <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                {(["bats", "arms"] as const).map((kind) => (
                  <div key={kind}>
                    <div className="mb-0.5 font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">
                      most-used {kind === "bats" ? "hitters" : "pitchers"}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {meta.topCards
                        .filter((c) => (kind === "arms") === c.isPitcher)
                        .slice(0, 8)
                        .map((c) => (
                          <span
                            key={c.cardId}
                            className="cursor-default whitespace-nowrap"
                            onMouseEnter={(e) =>
                              setPeek(peekFrom(e.currentTarget, c.cardId, c.name,
                                `${c.pos} · used by ${c.teams} teams (${c.pct}%)`,
                                c.isPitcher ? `${c.ip.toLocaleString()} IP in this series` : `${c.pa.toLocaleString()} PA in this series`,
                                null))}
                            onMouseLeave={() => setPeek(null)}
                          >
                            {c.name} <span className="text-muted-foreground">{c.pct}%</span>
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            {/* pool table */}
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(["HIT", "PIT", "UPG"] as View[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => { setView(v); setPosFilter("ALL"); setSortBy("proj"); }}
                    className={cn(
                      "rounded-md border border-border px-3 py-1 text-xs font-semibold",
                      view === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {v === "HIT" ? "Hitters" : v === "PIT" ? "Pitchers" : "Upgrades"}
                  </button>
                ))}
                <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 w-36 text-xs" />
                {view !== "UPG" && (view === "HIT" ? ["ALL", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"] : ["ALL", "SP", "RP"]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPosFilter(p)}
                    className={cn(
                      "rounded-full border border-border px-2 py-0.5 text-[11px]",
                      posFilter === p ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {view !== "UPG" ? (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <Th label="Card" right={false} />
                        <Th label={view === "PIT" ? "Role" : "Pos"} right={false} />
                        <Th id="val" label="VAL" />
                        <Th id="fit" label="Fit" title="0–99 rating composite within this legal pool" />
                        <Th id="proj" label={view === "PIT" ? "pFIP" : "pWOBA"} title="Model v0 projection from ratings" />
                        <Th id="pvl" label="vL" title="Projection vs LHP/LHB" />
                        <Th id="pvr" label="vR" title="Projection vs RHP/RHB" />
                        <Th id="obs" label="Obs" title="Observed in this tournament series — hover a value for detail" />
                        <Th id="pa" label={view === "PIT" ? "IP" : "PA"} title="Observed volume in this series" />
                        <Th id="car" label="Career" title="PA/IP-weighted across all your tourneys — hover for detail" />
                      </tr>
                    </thead>
                    <tbody className="font-mono text-[12.5px] leading-tight [font-variant-numeric:tabular-nums]">
                      {rows.slice(0, 400).map((c) => {
                        const inUse = used.has(c.cardId);
                        return (
                          <tr
                            key={c.cardId}
                            onClick={() => clickCard(c)}
                            className={cn("cursor-pointer border-b border-border/50 hover:bg-muted/50", inUse && "bg-muted/60")}
                          >
                            <td
                              className="max-w-[220px] truncate px-1.5 py-1 font-sans"
                              onMouseEnter={(e) => peekPool(e, c)}
                              onMouseLeave={() => setPeek(null)}
                            >
                              {c.name}
                              {c.bats && <span className="ml-1 text-[10px] text-muted-foreground">{c.bats}</span>}
                              {c.variant && <span className="ml-1 text-[10px] text-muted-foreground">VAR</span>}
                              {inUse && <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400">●</span>}
                            </td>
                            <td className="px-1.5">{c.isPitcher ? c.role ?? "P" : c.pos}</td>
                            <td className="px-1.5 text-right">{c.val ?? "—"}</td>
                            <td className="px-1.5 text-right">{fitR.get(c.cardId) ?? "—"}</td>
                            <td className="px-1.5 text-right font-semibold">{c.isPitcher ? fmt2(c.proj.all) : fmt3(c.proj.all)}</td>
                            <td className="px-1.5 text-right text-muted-foreground">{c.isPitcher ? fmt2(c.proj.vL) : fmt3(c.proj.vL)}</td>
                            <td className="px-1.5 text-right text-muted-foreground">{c.isPitcher ? fmt2(c.proj.vR) : fmt3(c.proj.vR)}</td>
                            <td className="px-1.5 text-right" title={obsTitle(c.obs, c.isPitcher)}>
                              {c.isPitcher ? fmt2(c.obs?.fip) : fmt3(c.obs?.woba)}
                            </td>
                            <td className="px-1.5 text-right">{c.isPitcher ? (c.obs?.ip?.toLocaleString() ?? "—") : (c.obs?.pa?.toLocaleString() ?? "—")}</td>
                            <td className="px-1.5 text-right text-muted-foreground" title={obsTitle(c.career, c.isPitcher)}>
                              {c.isPitcher ? fmt2(c.career?.fip) : fmt3(c.career?.woba)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-1.5 py-1.5">Card</th>
                        <th className="px-1.5">Pos</th>
                        <th className="px-1.5 text-right">VAL</th>
                        <th className="px-1.5">Tier</th>
                        <th className="px-1.5 text-right" title="Model v0 projection">Proj</th>
                        <th className="px-1.5 text-right">vL</th>
                        <th className="px-1.5 text-right">vR</th>
                        <th className="px-1.5 text-right" title="Fair market (last 10 sales)">L10</th>
                        <th className="px-1.5 text-right" title="Lowest ask — buy-it-now">Ask</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-[12.5px] leading-tight [font-variant-numeric:tabular-nums]">
                      {upgradeRows.map((u) => (
                        <tr key={u.cardId} className="border-b border-border/50">
                          <td
                            className="max-w-[220px] truncate px-1.5 py-1 font-sans"
                            onMouseEnter={(e) => peekUpgrade(e, u)}
                            onMouseLeave={() => setPeek(null)}
                          >
                            {u.name}
                          </td>
                          <td className="px-1.5">{u.pos}</td>
                          <td className="px-1.5 text-right">{u.val ?? "—"}</td>
                          <td className="px-1.5">{u.tier ?? "—"}</td>
                          <td className="px-1.5 text-right font-semibold">{u.isPitcher ? fmt2(u.proj.all) : fmt3(u.proj.all)}</td>
                          <td className="px-1.5 text-right text-muted-foreground">{u.isPitcher ? fmt2(u.proj.vL) : fmt3(u.proj.vL)}</td>
                          <td className="px-1.5 text-right text-muted-foreground">{u.isPitcher ? fmt2(u.proj.vR) : fmt3(u.proj.vR)}</td>
                          <td className="px-1.5 text-right">{fmtPts(u.last10)}</td>
                          <td className="px-1.5 text-right text-muted-foreground">{fmtPts(u.ask)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {view === "UPG"
                  ? `Best tournament-legal cards you don't own, by model-v0 projection, priced from the latest shop snapshot.`
                  : `${rows.length} eligible cards${rows.length > 400 ? " (showing 400)" : ""}. pWOBA/pFIP = model v0 (ratings → observed stats fit); hover Obs/Career for PA, runs and WAR. Variant limits and LIVE-only rules aren't enforced yet.`}
              </p>
            </div>

            {/* roster panel */}
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">Roster · {summary.filled}/{summary.total}</span>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => autoFill()}>Re-recommend</Button>
                    <Button size="sm" variant="outline" onClick={() => { setSlots({}); setMsg(null); }}>Clear</Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 text-xs [font-variant-numeric:tabular-nums]">
                  <div>Proj wOBA <span className="float-right font-mono">{fmt3(summary.projWoba)}</span></div>
                  <div>Proj FIP <span className="float-right font-mono">{fmt2(summary.projFip)}</span></div>
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
                {STAFF_KEYS.map((k) => (
                  <SlotRow key={k} k={k} label={k} slots={slots} byId={byId} selected={selected} setSelected={setSelected} assign={assign} />
                ))}
              </div>

              <div className="rounded-lg border border-border p-3">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bench</div>
                {BENCH_KEYS.map((k) => (
                  <SlotRow key={k} k={k} label={k} slots={slots} byId={byId} selected={selected} setSelected={setSelected} assign={assign} />
                ))}
              </div>

              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Save · Export</div>
                <div className="flex gap-2">
                  <Input placeholder="Roster name" value={rosterName} onChange={(e) => setRosterName(e.target.value)} className="h-8" />
                  <Button size="sm" onClick={save} disabled={saving || summary.filled === 0}>{saving ? "Saving…" : "Save"}</Button>
                </div>
                <Button size="sm" variant="outline" className="mt-2 w-full" onClick={exportLineup} disabled={summary.filled === 0}>
                  Export lineup (.txt + .csv)
                </Button>
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
          {peek && <CardPeek p={peek} />}
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
        "flex cursor-pointer items-center justify-between rounded px-2 py-0.5 text-sm",
        selected === k ? "bg-foreground/10 ring-1 ring-foreground/30" : "hover:bg-muted/40",
      )}
    >
      <span className="w-8 shrink-0 font-mono text-[11px] text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 flex-1 truncate px-1", !card && "text-muted-foreground/60")}>
        {card ? card.name : "empty"}
      </span>
      {card && (
        <span className="mr-1 font-mono text-[11px] text-muted-foreground [font-variant-numeric:tabular-nums]">
          {card.isPitcher ? fmt2(card.proj.all) : fmt3(card.proj.all)}
        </span>
      )}
      {card && (
        <button
          onClick={(e) => { e.stopPropagation(); assign(k, null); }}
          className="ml-0.5 text-xs text-muted-foreground hover:text-foreground"
          aria-label={`clear ${label}`}
        >
          ×
        </button>
      )}
    </div>
  );
}
