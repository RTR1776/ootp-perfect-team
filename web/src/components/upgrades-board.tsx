"use client";

/**
 * The Upgrades page (lib/upgrades-load): pick the events that count, see what
 * each variant or card adds there and per 10k PP, tick the ones worth a look
 * and confirm them with the real rebuild (/api/upgrades/confirm).
 *
 * Gains are summed over the picked events on the page, so dropping a bracket
 * he won't qualify for (or won't play) re-ranks everything without a reload.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CardName } from "@/components/card-name";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { DataTable, type Column, type Sort } from "@/components/ui/data-table";
import { Segmented } from "@/components/ui/segmented";
import type { ShopUpgrade, UpgradeEvent, UpgradesData, VariantUpgrade } from "@/lib/upgrades-load";
import type { ConfirmResult } from "@/lib/upgrade-confirm-server";
import { date, pp, signed, tone } from "@/lib/format";
import { cn } from "@/lib/utils";

const num = "font-mono tabular-nums";
const TONE = { positive: "text-positive", negative: "text-negative" } as const;
const PICKED_TINT = "[--row-tint:color-mix(in_oklch,var(--primary)_10%,transparent)]";
/** A gain under this is inside the noise of one swap: hidden unless asked for. */
const SHOW_FLOOR = 0.5;

function Signed({ v, className }: { v: number | null | undefined; className?: string }) {
  const t = tone(v ?? null);
  return <span className={cn(num, t && TONE[t], className)}>{signed(v ?? null)}</span>;
}

const per10k = (gain: number, price: number | null) => (price != null && price > 0 ? (gain / price) * 10_000 : null);

/** A tick box for the confirm list. */
function Pick({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return <input type="checkbox" checked={on} onChange={onChange} aria-label={label} className="size-4 accent-[var(--primary)]" onClick={(e) => e.stopPropagation()} />;
}

/** "Cap CF vR · CF vL +6.7": one event's read, as a chip. */
function Chip({ e, children, muted = false, title }: { e: UpgradeEvent | undefined; children: React.ReactNode; muted?: boolean; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]", muted ? "bg-muted text-muted-foreground" : "bg-positive/10")}>
      <span className="font-medium">{e?.short ?? "?"}</span>{children}
    </span>
  );
}

type VRow = VariantUpgrade & { gain: number; value: number | null };
type SRow = ShopUpgrade & { gain: number; value: number | null; blocked: number };

export function UpgradesBoard({ data }: { data: UpgradesData }) {
  const router = useRouter();
  const events = useMemo(() => new Map(data.events.map((e) => [e.id, e])), [data.events]);
  const [picked, setPicked] = useState<Set<number>>(() => new Set(data.events.filter((e) => e.roster).map((e) => e.id)));
  const [all, setAll] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [vSort, setVSort] = useState<Sort | null>({ key: "gain", desc: true });
  const [sSort, setSSort] = useState<Sort | null>({ key: "gain", desc: true });
  const toggle = <T,>(set: Set<T>, x: T) => { const n = new Set(set); if (n.has(x)) n.delete(x); else n.add(x); return n; };

  const vRows: VRow[] = useMemo(() => data.variants.filter((v) => v.state === "buy").map((v) => {
    const gain = v.starts.filter((s) => picked.has(s.eventId)).reduce((a, s) => a + s.gain, 0);
    return { ...v, gain, value: per10k(gain, v.price) };
  }).filter((v) => v.starts.some((s) => picked.has(s.eventId)) && (all || v.gain >= SHOW_FLOOR)), [data.variants, picked, all]);
  const done = data.variants.filter((v) => v.state !== "buy" && v.starts.some((s) => picked.has(s.eventId)));

  const sRows: SRow[] = useMemo(() => data.shop.map((s) => {
    const rows = s.rows.filter((r) => picked.has(r.eventId));
    const gain = rows.filter((r) => r.status === "start").reduce((a, r) => a + r.gain, 0);
    return { ...s, rows, gain, value: per10k(gain, s.price), blocked: rows.filter((r) => r.status !== "start").length };
  }).filter((s) => s.rows.length && (all || s.gain >= SHOW_FLOOR)), [data.shop, picked, all]);

  const vCols: Column<VRow>[] = [
    { key: "pick", header: "", priority: 1, render: (v) => <Pick on={chosen.has(`v:${v.cardId}`)} onChange={() => setChosen((c) => toggle(c, `v:${v.cardId}`))} label={`Confirm ${v.name}'s variant`} /> },
    { key: "card", header: "Card", priority: 1, render: (v) => <CardName id={v.cardId} name={v.name} val={v.val} owned compact />, sortValue: (v) => v.name },
    {
      key: "where", header: "Where it starts", priority: 2,
      tip: "Each picked event where the base card starts, its spots there, and the runs its variant adds.",
      render: (v) => (
        <span className="flex flex-wrap gap-1">
          {v.starts.filter((s) => picked.has(s.eventId)).map((s) => (
            <Chip key={s.eventId} e={events.get(s.eventId)}>{s.where} <Signed v={s.gain} /></Chip>
          ))}
        </span>
      ),
    },
    { key: "gain", header: "Runs", align: "right", priority: 1, tip: "The variant's gain, summed over the picked events (roster objective units, one swap each).", render: (v) => <Signed v={v.gain} className="font-semibold" />, sortValue: (v) => v.gain },
    { key: "price", header: "Variant price", align: "right", priority: 1, tip: "Recent variant sales (last 10) on the newest shop list that has the card. A thin market: check the auction house before bidding.", render: (v) => <span className={num}>{v.price != null ? pp(v.price) : <span className="text-xs text-muted-foreground">no sales</span>}</span>, sortValue: (v) => v.price },
    { key: "value", header: "Runs / 10k PP", align: "right", priority: 1, render: (v) => (v.value != null ? <span className={num}>{v.value.toFixed(1)}</span> : <span className="text-muted-foreground">—</span>), sortValue: (v) => v.value },
  ];

  const sCols: Column<SRow>[] = [
    { key: "pick", header: "", priority: 1, render: (s) => <Pick on={chosen.has(`o:${s.card.id}`)} onChange={() => setChosen((c) => toggle(c, `o:${s.card.id}`))} label={`Confirm ${s.card.name}`} /> },
    { key: "card", header: "Card", priority: 1, render: (s) => <CardName id={s.card.id} name={s.card.name} val={s.card.val} tier={s.card.tier} year={s.card.year} set={s.card.set} compact />, sortValue: (s) => s.card.name },
    {
      key: "where", header: "Where it starts", priority: 2,
      tip: "Card Fit in each picked event: the spot and the runs one swap adds, after paying for room under the event's slots or cap. Grey: the one swap gains, but the slots or cap leave it no room.",
      render: (s) => (
        <span className="flex flex-wrap gap-1">
          {s.rows.map((r) => r.status === "start"
            ? <Chip key={r.eventId} e={events.get(r.eventId)} title={[r.swaps.map((w) => `${w.board === "staff" ? w.spot : `${w.spot} v${w.board}`} over ${w.out?.name ?? "(empty)"}`).join(" · "), r.room?.cost ? `room: ${r.room.note} (−${r.room.cost})` : ""].filter(Boolean).join("\n")}>{r.spot} <Signed v={r.gain} /></Chip>
            : <Chip key={r.eventId} e={events.get(r.eventId)} muted title={r.room?.note}>{signed(r.room?.gross ?? 0)} one swap, {r.room?.cost == null ? "no room" : `room −${r.room.cost}`}</Chip>)}
          {s.clash.filter((c) => picked.has(c.eventId)).map((c) => (
            <span key={`x${c.eventId}`} className="rounded px-1.5 py-0.5 text-[11px] text-warning ring-1 ring-warning/40" title="One card per player on a roster: that card would have to go. Confirm to see what the rebuild does.">
              {events.get(c.eventId)?.short}: your {c.name} ({c.val}) is the same player
            </span>
          ))}
        </span>
      ),
    },
    { key: "gain", header: "Runs", align: "right", priority: 1, tip: "Card Fit's gains summed over the picked events where it starts.", render: (s) => <Signed v={s.gain} className="font-semibold" />, sortValue: (s) => s.gain },
    { key: "price", header: "Price", align: "right", priority: 1, tip: "The lowest ask, else recent sales (last 10).", render: (s) => <span className={num} title={`ask ${s.card.ask ?? "none"} · last 10 ${s.card.last10 ?? "none"}`}>{pp(s.price)}</span>, sortValue: (s) => s.price },
    { key: "value", header: "Runs / 10k PP", align: "right", priority: 1, render: (s) => (s.value != null && s.gain > 0 ? <span className={num}>{s.value.toFixed(1)}</span> : <span className="text-muted-foreground">—</span>), sortValue: (s) => (s.gain > 0 ? s.value : null) },
  ];

  const groupOptions = data.groups.map((g) => ({ value: g.key, label: g.label }));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {groupOptions.length > 1 && (
          <Segmented aria-label="Event group" options={groupOptions} value={data.group.key} onChange={(k) => router.push(`/upgrades?group=${encodeURIComponent(k)}`)} />
        )}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">{data.group.label}: count</span>
          {data.events.map((e) => (
            <button
              key={e.id}
              type="button"
              aria-pressed={picked.has(e.id)}
              onClick={() => setPicked((p) => toggle(p, e.id))}
              title={`${e.name} · ${e.env}${e.rules.length ? ` · ${e.rules.join(" · ")}` : ""}${e.roster ? ` · saved roster ${e.roster.id} “${e.roster.name}”` : " · no saved roster: the best team your cards make"}`}
              className={cn("rounded-full px-2.5 py-1 ring-1", picked.has(e.id) ? "bg-primary/15 text-primary ring-primary/30" : "text-muted-foreground ring-border hover:text-foreground")}
            >
              {e.short}{!e.roster && " ·"}
            </button>
          ))}
          <Segmented
            aria-label="Rows"
            className="ml-auto"
            options={[{ value: "worth", label: `+${SHOW_FLOOR} runs or more` }, { value: "all", label: "Everything" }]}
            value={all ? "all" : "worth"}
            onChange={(v) => setAll(v === "all")}
          />
        </div>
      </div>

      <Section
        id="variants"
        title="Variant upgrades"
        summary={`${vRows.length} base starters whose variant adds ${all ? "anything" : `${SHOW_FLOOR}+ runs`}; ${done.length} already on the variant.`}
        help={<>
          <p>Every base card that starts on your newest saved roster in a picked event, scored again with its split ratings ×{data.boost} (the median boost across your own variants; a quarter sit nearer ×1.04, so read these as typical). Positions stay the base card&rsquo;s, so a glove&rsquo;s gain isn&rsquo;t counted.</p>
          <p>The gain is the card&rsquo;s own: it keeps its spots. A variant pays only while its base card keeps the job.</p>
          <p>{`Collection ${data.collectionDate ? date(data.collectionDate) : "?"}; prices from the newest shop list with the card (${data.shopDate ? date(data.shopDate) : "?"}).`}</p>
        </>}
      >
        <DataTable columns={vCols} rows={vRows} rowKey={(v) => v.cardId} sort={vSort} onSort={setVSort} rowClassName={(v) => (chosen.has(`v:${v.cardId}`) ? PICKED_TINT : undefined)} empty={<p className="p-4 text-sm text-muted-foreground">No base starter&rsquo;s variant adds {SHOW_FLOOR}+ runs in the picked events.</p>} />
        {done.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Done (the roster plays your variant): {done.filter((v) => v.state === "done").map((v) => v.name).join(", ") || "none"}.
            {done.some((v) => v.state === "owned") && <> You own the variant but the roster plays the base: {done.filter((v) => v.state === "owned").map((v) => v.name).join(", ")}.</>}
          </p>
        )}
      </Section>

      <Section
        id="shop"
        title="Cards you don't own"
        summary={`${sRows.length} cards with a price that start for you in a picked event${sRows.some((s) => s.blocked) ? ", or would but for the slots or cap" : ""}.`}
        help={<>
          <p>Every card legal in a picked event that you don&rsquo;t own and that has an ask or recent sales, placed by Card Fit: one swap into your saved roster.</p>
          <p>In a slots or cap event the swap must leave a legal 26. A card with no slot to sit in pays for the cheapest room: a card that starts nowhere off the roster (free), else one starter giving way to a card of yours that fits. Grey chips are swaps that gain, but whose room costs more than they add (or that no single move makes room for).</p>
        </>}
      >
        <DataTable columns={sCols} rows={sRows} rowKey={(s) => s.card.id} sort={sSort} onSort={setSSort} rowClassName={(s) => (chosen.has(`o:${s.card.id}`) ? PICKED_TINT : undefined)} empty={<p className="p-4 text-sm text-muted-foreground">No card you don&rsquo;t own starts for you in the picked events.</p>} />
      </Section>

      <ConfirmPanel data={data} picked={picked} chosen={chosen} clear={() => setChosen(new Set())} />
    </div>
  );
}

type RunState = { state: "running" } | { state: "done"; r: ConfirmResult } | { state: "error"; error: string; command?: string };

/** Confirm a buy: the seeded rebuild per event with the ticked cards assumed yours, against the same rebuild without them. */
function ConfirmPanel({ data, picked, chosen, clear }: { data: UpgradesData; picked: Set<number>; chosen: Set<string>; clear: () => void }) {
  const [runs, setRuns] = useState<Map<number, RunState>>(new Map());
  const [ran, setRan] = useState<string | null>(null);
  const variants = [...chosen].filter((k) => k.startsWith("v:")).map((k) => Number(k.slice(2)));
  const owned = [...chosen].filter((k) => k.startsWith("o:")).map((k) => Number(k.slice(2)));
  const names = [
    ...variants.map((id) => `${data.variants.find((v) => v.cardId === id)?.name ?? id} (VAR)`),
    ...owned.map((id) => data.shop.find((s) => s.card.id === id)?.card.name ?? String(id)),
  ];
  const cost = variants.reduce((a, id) => a + (data.variants.find((v) => v.cardId === id)?.price ?? 0), 0)
    + owned.reduce((a, id) => a + (data.shop.find((s) => s.card.id === id)?.price ?? 0), 0);
  // The events a ticked card reads anything in: where its variant starts, or where Card Fit places it.
  const eventIds = data.events.filter((e) => picked.has(e.id) && (
    variants.some((id) => data.variants.find((v) => v.cardId === id)?.starts.some((s) => s.eventId === e.id && s.gain > 0))
    || owned.some((id) => data.shop.find((s) => s.card.id === id)?.rows.some((r) => r.eventId === e.id))
  )).map((e) => e.id);
  const key = `${variants.join(",")}|${owned.join(",")}|${eventIds.join(",")}`;
  const busy = [...runs.values()].some((r) => r.state === "running");

  const run = async () => {
    setRan(key);
    setRuns(new Map(eventIds.map((id) => [id, { state: "running" }])));
    const queue = [...eventIds];
    // Each rebuild is two env-roster runs; three events at a time keeps the Mac responsive.
    const worker = async () => {
      for (let id = queue.shift(); id != null; id = queue.shift()) {
        let next: RunState;
        try {
          const res = await fetch("/api/upgrades/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: id, variants, owned }) });
          const body = await res.json();
          next = res.ok ? (body.error ? { state: "error", error: body.error } : { state: "done", r: body as ConfirmResult }) : { state: "error", error: body.error ?? `HTTP ${res.status}`, command: body.command };
        } catch (e) {
          next = { state: "error", error: e instanceof Error ? e.message : String(e) };
        }
        setRuns((m) => new Map(m).set(id, next));
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, eventIds.length) }, worker));
  };

  const results = [...runs].flatMap(([id, s]) => (s.state === "done" ? [{ id, r: s.r }] : []));
  const total = results.reduce((a, x) => a + (x.r.delta ?? 0), 0);
  const allDone = runs.size > 0 && results.length === runs.size;
  const card = (c: { name: string; val: number; variant: boolean }) => `${c.name}${c.variant ? " (VAR)" : ""} ${c.val}`;
  const command = [...runs.values()].find((s): s is Extract<RunState, { state: "error" }> => s.state === "error" && !!s.command);

  return (
    <Section
      id="confirm"
      title="Confirm a buy"
      summary={names.length ? `${names.join(", ")}: ${pp(cost)} PP, rebuilt in ${eventIds.length} event${eventIds.length === 1 ? "" : "s"}.` : "Tick cards above, then rebuild the events they play in."}
      help={<>
        <p>One-swap gains don&rsquo;t add up: two buys can want the same spot, and a buy can make the roster reshuffle around it. This runs the real rebuild (env-roster, as a Claude pick: the event&rsquo;s rules and staff shape, your floors) seeded from your saved roster, once with the ticked cards assumed yours and once without, and shows the objective&rsquo;s change and the cards that move. Nothing is saved.</p>
        <p>About a minute per event, three at a time. It runs on the Mac&rsquo;s dev server; elsewhere it gives the command to run there.</p>
      </>}
      actions={chosen.size > 0 && <Button variant="ghost" size="sm" onClick={clear} disabled={busy}>Clear</Button>}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={run} disabled={busy || !eventIds.length}>{busy ? "Rebuilding…" : ran === key && allDone ? "Run again" : "Rebuild with these"}</Button>
        <span className="text-xs text-muted-foreground">
          {eventIds.length ? eventIds.map((id) => data.events.find((e) => e.id === id)?.short).join(", ") : names.length ? "No picked event where a ticked card reads a gain." : null}
        </span>
      </div>
      {runs.size > 0 && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-muted-foreground">
                <th className="px-2 py-1.5 font-medium">Event</th>
                <th className="px-2 py-1.5 text-right font-medium">Without → with</th>
                <th className="px-2 py-1.5 text-right font-medium">Change</th>
                <th className="px-2 py-1.5 font-medium">In / out</th>
              </tr>
            </thead>
            <tbody>
              {[...runs].map(([id, s]) => {
                const e = data.events.find((x) => x.id === id);
                return (
                  <tr key={id} className="border-t border-border align-top">
                    <td className="px-2 py-1.5"><Link href={`/build?t=${id}`} prefetch={false} className="font-medium hover:underline">{e?.short ?? id}</Link></td>
                    {s.state === "running" && <td colSpan={3} className="animate-pulse px-2 py-1.5 text-xs text-muted-foreground">rebuilding…</td>}
                    {s.state === "error" && <td colSpan={3} className="px-2 py-1.5 text-xs text-warning">{s.error}{s.command && <code className="mt-1 block select-all text-foreground">{s.command}</code>}</td>}
                    {s.state === "done" && <>
                      <td className={cn(num, "px-2 py-1.5 text-right")}>{s.r.before?.toFixed(1) ?? "—"} → {s.r.after?.toFixed(1) ?? "—"}{!s.r.legal && <span className="ml-1 text-xs text-warning">not legal</span>}</td>
                      <td className="px-2 py-1.5 text-right"><Signed v={s.r.delta} className="font-semibold" /></td>
                      <td className="px-2 py-1.5 text-xs">
                        {s.r.added.length || s.r.dropped.length ? <>
                          <span className="text-positive">{s.r.added.map(card).join(", ") || "—"}</span>
                          <span className="text-muted-foreground"> for </span>
                          <span>{s.r.dropped.map(card).join(", ") || "—"}</span>
                        </> : <span className="text-muted-foreground">same 26</span>}
                        {s.r.error && <span className="text-warning"> {s.r.error}</span>}
                      </td>
                    </>}
                  </tr>
                );
              })}
            </tbody>
            {allDone && (
              <tfoot>
                <tr className="border-t border-border">
                  <td className="px-2 py-1.5 font-medium">Total</td>
                  <td className="px-2 py-1.5 text-right text-xs text-muted-foreground">{cost > 0 ? `${(total / cost * 10_000).toFixed(1)} runs / 10k PP` : ""}</td>
                  <td className="px-2 py-1.5 text-right"><Signed v={total} className="font-semibold" /></td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      {command && <p className="mt-2 text-xs text-muted-foreground">Or every event at once, from web/: <code className="select-all text-foreground">{`pnpm upgrade:confirm --events ${eventIds.join(",")}${variants.length ? ` --variant ${variants.join(",")}` : ""}${owned.length ? ` --owned ${owned.join(",")}` : ""}`}</code></p>}
    </Section>
  );
}
