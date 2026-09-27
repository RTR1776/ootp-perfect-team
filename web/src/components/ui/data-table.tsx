"use client";

/**
 * The app's one table (UI plan G4): sortable, the ranked number always on
 * screen, and readable on a phone.
 *
 * - Columns carry a priority. 1 shows everywhere (at most four: the name, the
 *   sort key and two more), 2 from md, 3 from lg. Below md a tap on a row opens
 *   the hidden columns under it as "label: value".
 * - The header sticks. From md the table scrolls in its own box (a sticky
 *   header inside an overflow-x wrapper otherwise scrolls away with the page:
 *   /played's went to −1581px); below md the priority-1 columns fit, so the
 *   header sticks to the page under the app bar instead, with no nested
 *   scroll area to trap a thumb.
 * - The first column sticks left when the table scrolls sideways.
 * - `preset` adds a "Columns: Simple | Full" switch, remembered per page.
 */
import { Fragment, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  /** Header tooltip: what the number means. */
  tip?: string;
  align?: "left" | "right";
  /** 1: always · 2: md and up · 3: lg and up. Full-only columns hide in Simple. */
  priority: 1 | 2 | 3;
  /** Shown only with Columns: Full. */
  full?: boolean;
  /** Cell content. Defaults to String(row[key]). */
  render?: (row: T) => React.ReactNode;
  /** Plain value for sorting; a column without it can't be sorted. */
  sortValue?: (row: T) => number | string | null;
  /** Text for the phone detail row (defaults to render). */
  text?: (row: T) => React.ReactNode;
  className?: string;
}

export interface Sort { key: string; desc: boolean }

const HIDE: Record<Column<unknown>["priority"], string> = { 1: "", 2: "hidden md:table-cell", 3: "hidden lg:table-cell" };

const noSubscribe = () => () => {};
const readPreset = (preset: string | undefined): boolean => {
  if (!preset) return false;
  try { return localStorage.getItem(`${preset}:cols`) === "full"; } catch { return false; }
};

export function DataTable<T>({
  columns, rows, rowKey, sort, onSort, onRowClick, preset, rowClassName, empty, limit,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  /** Controlled sort; the table sorts `rows` itself by the column's sortValue. */
  sort?: Sort | null;
  onSort?: (next: Sort) => void;
  onRowClick?: (row: T) => void;
  /** localStorage key for the Simple | Full switch; omit for no switch. */
  preset?: string;
  rowClassName?: (row: T) => string | undefined;
  empty?: React.ReactNode;
  /** Render at most this many rows (the caller shows "Show more"). */
  limit?: number;
}) {
  // The saved choice is read after hydration (the server renders Simple); a click overrides it.
  const stored = useSyncExternalStore(noSubscribe, () => readPreset(preset), () => false);
  const [picked, setPicked] = useState<boolean | null>(null);
  const full = picked ?? stored;
  const [open, setOpen] = useState<string | number | null>(null);
  const pickPreset = (next: boolean) => {
    setPicked(next);
    if (preset) try { localStorage.setItem(`${preset}:cols`, next ? "full" : "simple"); } catch { /* storage unavailable */ }
  };

  const shown = columns.filter((c) => full || !c.full);
  const active = sort ? shown.find((c) => c.key === sort.key) : undefined;
  const sorted = active?.sortValue
    ? [...rows].sort((a, b) => {
        const x = active.sortValue!(a), y = active.sortValue!(b);
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        const d = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
        return sort!.desc ? -d : d;
      })
    : rows;
  const visible = limit != null ? sorted.slice(0, limit) : sorted;
  const hiddenOnPhone = shown.filter((c) => c.priority > 1);

  return (
    <div className="flex flex-col gap-1.5">
      {preset && (
        <div className="flex items-center gap-1 self-end text-[11px]" role="radiogroup" aria-label="Columns">
          <span className="text-muted-foreground">Columns</span>
          {([false, true] as const).map((f) => (
            <button
              key={String(f)}
              type="button"
              role="radio"
              aria-checked={full === f}
              onClick={() => pickPreset(f)}
              className={cn("rounded px-1.5 py-0.5", full === f ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "text-muted-foreground hover:text-foreground")}
            >
              {f ? "Full" : "Simple"}
            </button>
          ))}
        </div>
      )}
      <div className="rounded-lg border border-border md:max-h-[calc(100dvh-8rem)] md:overflow-auto md:overscroll-contain">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              {shown.map((c, i) => {
                const isActive = sort?.key === c.key;
                const canSort = !!c.sortValue && !!onSort;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    title={c.tip}
                    aria-sort={isActive ? (sort!.desc ? "descending" : "ascending") : undefined}
                    className={cn(
                      "sticky top-14 z-10 whitespace-nowrap bg-card px-2 py-1.5 text-[11px] font-medium text-muted-foreground shadow-[inset_0_-1px_0_var(--border)] md:top-0",
                      c.align === "right" ? "text-right" : "text-left",
                      i === 0 && "left-0 z-20",
                      HIDE[c.priority],
                      isActive && "text-foreground",
                    )}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-0.5 hover:text-foreground"
                        onClick={() => onSort!({ key: c.key, desc: isActive ? !sort!.desc : true })}
                      >
                        {c.header}{isActive && <span aria-hidden>{sort!.desc ? " ↓" : " ↑"}</span>}
                      </button>
                    ) : c.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="[font-variant-numeric:tabular-nums]">
            {visible.map((row) => {
              const k = rowKey(row);
              const expanded = open === k;
              return (
                <Fragment key={k}>
                  <tr
                    className={cn("h-8 hover:bg-muted/40", (onRowClick || hiddenOnPhone.length > 0) && "cursor-pointer md:cursor-default", onRowClick && "md:cursor-pointer", rowClassName?.(row))}
                    onClick={() => {
                      if (onRowClick) onRowClick(row);
                      else if (hiddenOnPhone.length) setOpen(expanded ? null : k);
                    }}
                    aria-expanded={!onRowClick && hiddenOnPhone.length ? expanded : undefined}
                  >
                    {shown.map((c, i) => (
                      <td
                        key={c.key}
                        className={cn(
                          "border-b border-border/50 px-2 py-1",
                          c.align === "right" && "text-right",
                          i === 0 && "sticky left-0 z-[5] bg-card",
                          sort?.key === c.key && "font-medium",
                          HIDE[c.priority],
                          c.className,
                        )}
                      >
                        {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                  {expanded && (
                    <tr className="md:hidden">
                      <td colSpan={shown.filter((c) => c.priority === 1).length} className="border-b border-border/50 bg-muted/30 px-3 py-2 text-xs">
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                          {hiddenOnPhone.map((c) => (
                            <Fragment key={c.key}>
                              <dt className="text-muted-foreground">{c.header}</dt>
                              <dd>{c.text ? c.text(row) : c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}</dd>
                            </Fragment>
                          ))}
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={shown.length} className="px-3 py-6 text-center text-muted-foreground">{empty ?? "Nothing to show."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
