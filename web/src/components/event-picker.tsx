"use client";

/**
 * The event picker (UI plan G5): a button naming the current event that opens
 * a searchable list. Every typed word must appear in the event's name, so
 * "hardware" or "gold cap" finds it at once instead of scrolling 160 options.
 * With nothing typed, the events used last come first.
 *
 * Keyboard: ↑/↓ to move, Enter to pick, Escape (or a click outside) to close.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PickerEvent { id: number; label: string; hasSeries?: boolean; era?: string | null }
export interface PickerGroup { label: string; items: PickerEvent[] }

/** The "no event" choice on Cards, Played and Market: read at the PT default. */
export const NO_EVENT_ID = 0;

export function EventPicker({
  groups, value, onPick, recent = [], allowNone = false, noneLabel = "PT default (no event)", placeholder = "Choose a tournament…", disabled, disabledTitle,
}: {
  groups: PickerGroup[];
  /** The picked event id; null for none. */
  value: number | null;
  onPick: (id: number | null) => void;
  /** Event ids used last, newest first. */
  recent?: number[];
  /** Offer "PT default (no event)" first; it picks NO_EVENT_ID. */
  allowNone?: boolean;
  noneLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  disabledTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const all = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const byId = useMemo(() => new Map(all.map((e) => [e.id, e])), [all]);
  const current = value != null ? byId.get(value) ?? null : null;

  // The flat list the keyboard walks: none, then recent, then the groups; filtered by every typed word.
  const sections = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const match = (e: PickerEvent) => words.every((w) => e.label.toLowerCase().includes(w));
    const out: { label: string | null; items: { id: number | null; label: string; hasSeries?: boolean; era?: string | null }[] }[] = [];
    if (allowNone && !words.length) out.push({ label: null, items: [{ id: NO_EVENT_ID, label: noneLabel }] });
    if (!words.length && recent.length) {
      const items = recent.map((id) => byId.get(id)).filter((e): e is PickerEvent => !!e);
      if (items.length) out.push({ label: "Recent", items });
    }
    for (const g of groups) {
      const items = g.items.filter(match);
      if (items.length) out.push({ label: g.label, items });
    }
    return out;
  }, [q, groups, recent, byId, allowNone, noneLabel]);
  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (id: number | null) => { setOpen(false); setQ(""); onPick(id); };
  /** Move the highlight and keep it in view: Enter picks what is highlighted. */
  const move = (to: number) => { setCursor(to); document.getElementById(`${listId}-${to}`)?.scrollIntoView({ block: "nearest" }); };
  const onKey = (e: React.KeyboardEvent) => {
    // Tab leaves the list closed, as Escape does; the focus still moves on.
    if (e.key === "Escape" || e.key === "Tab") { setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); move(Math.min(flat.length - 1, cursor + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(Math.max(0, cursor - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); const it = flat[cursor]; if (it) pick(it.id); }
  };

  let n = -1;
  return (
    <div ref={box} className="relative w-full sm:w-[26rem]">
      <button
        type="button"
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); setCursor(0); setTimeout(() => input.current?.focus(), 0); }}
        className="flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={cn("truncate", !current && value !== NO_EVENT_ID && "text-muted-foreground")}>
          {current?.label ?? (value === NO_EVENT_ID && allowNone ? noneLabel : placeholder)}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 z-40 mt-1 w-full rounded-md border border-border bg-card shadow-xl sm:w-[28rem]">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={input}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={flat[cursor] ? `${listId}-${cursor}` : undefined}
              value={q}
              onChange={(e) => { setQ(e.target.value); setCursor(0); }}
              onKeyDown={onKey}
              placeholder="Search events — e.g. hardware, gold cap"
              className="h-10 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <ul id={listId} role="listbox" className="max-h-[60vh] overflow-y-auto py-1">
            {sections.map((s, si) => (
              <li key={`${s.label ?? "none"}-${si}`} role="presentation">
                {s.label && <div className="px-3 pb-0.5 pt-2 text-[11px] font-medium text-muted-foreground">{s.label}</div>}
                <ul role="presentation">
                  {s.items.map((it) => {
                    n++;
                    const idx = n;
                    return (
                      <li
                        key={`${s.label}-${it.id}`}
                        id={`${listId}-${idx}`}
                        role="option"
                        aria-selected={it.id === value}
                        onMouseEnter={() => setCursor(idx)}
                        onClick={() => pick(it.id)}
                        className={cn("flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-sm", idx === cursor && "bg-muted", it.id === value && "font-semibold")}
                      >
                        <span className="truncate">{it.label}</span>
                        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                          {it.era && <span className="rounded border border-border px-1">{it.era}</span>}
                          {it.hasSeries === false && <span>no play data</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
            {flat.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">No event matches “{q}”.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
