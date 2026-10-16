"use client";

/** The small forms on /qualifying: a PTCS or PTMS finish, a league place, PT Live points. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SELECT = "h-8 rounded-md border border-border bg-background px-2 text-xs";

function useSend() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function send(init: RequestInit & { url?: string }) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(init.url ?? "/api/qualifying", { headers: { "content-type": "application/json" }, ...init });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setMsg(data.error ?? `Request failed (${res.status}).`); return false; }
      router.refresh();
      return true;
    } finally { setBusy(false); }
  }
  return { busy, msg, send };
}

export function FinishEntry({ events, berths, placements, defaultEvent }: { events: string[]; berths: readonly string[]; placements: { placement: string; points: number }[]; defaultEvent: string }) {
  const { busy, msg, send } = useSend();
  const [event, setEvent] = useState(defaultEvent);
  const [berth, setBerth] = useState(berths[0]);
  const [placement, setPlacement] = useState(placements[placements.length - 1].placement);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <select aria-label="Event" className={SELECT} value={event} onChange={(e) => setEvent(e.target.value)}>{events.map((e) => <option key={e}>{e}</option>)}</select>
      <select aria-label="Bracket" className={SELECT} value={berth} onChange={(e) => setBerth(e.target.value)}>{berths.map((b) => <option key={b}>{b}</option>)}</select>
      <select aria-label="Finish" className={SELECT} value={placement} onChange={(e) => setPlacement(e.target.value)}>
        {placements.map((p) => <option key={p.placement} value={p.placement}>{p.placement} · {p.points} pts</option>)}
      </select>
      <Button size="sm" disabled={busy} onClick={() => send({ method: "POST", body: JSON.stringify({ kind: "finish", event, berth, placement }) })}>Save finish</Button>
      {msg && <span className="text-negative">{msg}</span>}
    </div>
  );
}

export function LeagueEntry({ weeks }: { weeks: { week: string; league: string }[] }) {
  const { busy, msg, send } = useSend();
  const [week, setWeek] = useState(weeks[weeks.length - 1]?.week ?? "");
  const [league, setLeague] = useState(weeks[weeks.length - 1]?.league ?? "");
  const [place, setPlace] = useState("");
  const pick = (w: string) => { setWeek(w); const l = weeks.find((x) => x.week === w)?.league; if (l && l !== "?") setLeague(l); };
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <select aria-label="Week" className={SELECT} value={week} onChange={(e) => pick(e.target.value)}>
        {weeks.map((w) => <option key={w.week} value={w.week}>week of {w.week.slice(5)}</option>)}
      </select>
      <Input aria-label="League" className="h-8 w-24 text-xs" placeholder="HD452" value={league} onChange={(e) => setLeague(e.target.value)} />
      <Input aria-label="Final place" inputMode="numeric" className="h-8 w-20 text-xs" placeholder="place" value={place} onChange={(e) => setPlace(e.target.value.replace(/\D/g, ""))} />
      <Button size="sm" disabled={busy || !place || !league} onClick={async () => { if (await send({ method: "POST", body: JSON.stringify({ kind: "league", week, league, place: Number(place) }) })) setPlace(""); }}>Save place</Button>
      {msg && <span className="text-negative">{msg}</span>}
    </div>
  );
}

export function LiveEntry({ current }: { current: number | null }) {
  const { busy, msg, send } = useSend();
  const [points, setPoints] = useState(current != null ? String(current) : "");
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Input aria-label="PT Live points" inputMode="numeric" className="h-8 w-28 text-xs" placeholder="Live points" value={points} onChange={(e) => setPoints(e.target.value.replace(/\D/g, ""))} />
      <Button size="sm" disabled={busy || !points} onClick={() => send({ method: "POST", body: JSON.stringify({ kind: "live", points: Number(points) }) })}>Save</Button>
      {msg && <span className="text-negative">{msg}</span>}
    </div>
  );
}

export function RemoveEntry({ id, label }: { id: number; label: string }) {
  const { busy, send } = useSend();
  return (
    <button type="button" disabled={busy} title={`Remove ${label}`} aria-label={`Remove ${label}`}
      onClick={() => send({ method: "DELETE", url: `/api/qualifying?id=${id}` })}
      className="ml-1 inline-flex items-center text-muted-foreground hover:text-negative disabled:opacity-50">
      <X className="size-3" />
    </button>
  );
}
