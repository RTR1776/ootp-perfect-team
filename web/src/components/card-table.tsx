"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { type Card, cardWAR } from "@/lib/types";
import type { Mode } from "@/lib/data";
import { TierDot } from "@/components/tier-badge";
import { fmtRate, fmtNum, cn } from "@/lib/utils";

const num = "text-right tabular-nums";

function hitterColumns(): ColumnDef<Card>[] {
  return [
    {
      id: "tier",
      header: "",
      enableSorting: false,
      size: 28,
      cell: ({ row }) => <TierDot tier={row.original.tier} />,
    },
    {
      accessorKey: "name",
      header: "Name",
      size: 200,
      cell: ({ row }) => (
        <span className="font-medium text-foreground">{row.original.name}</span>
      ),
    },
    { accessorKey: "pos", header: "POS", size: 56 },
    {
      id: "bt",
      header: "B/T",
      size: 56,
      accessorFn: (c) => `${c.bats}/${c.throws}`,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {row.original.bats}/{row.original.throws}
        </span>
      ),
    },
    {
      id: "avg",
      header: "AVG",
      size: 64,
      accessorFn: (c) => c.hitter_overall?.BA ?? 0,
      cell: ({ getValue }) => <Num>{fmtRate(getValue<number>())}</Num>,
      meta: { numeric: true },
    },
    {
      id: "obp",
      header: "OBP",
      size: 64,
      accessorFn: (c) => c.hitter_overall?.OBP ?? 0,
      cell: ({ getValue }) => <Num>{fmtRate(getValue<number>())}</Num>,
      meta: { numeric: true },
    },
    {
      id: "slg",
      header: "SLG",
      size: 64,
      accessorFn: (c) => c.hitter_overall?.SLG ?? 0,
      cell: ({ getValue }) => <Num>{fmtRate(getValue<number>())}</Num>,
      meta: { numeric: true },
    },
    {
      id: "woba",
      header: "wOBA",
      size: 70,
      accessorFn: (c) => c.hitter_overall?.wOBA ?? 0,
      cell: ({ getValue }) => (
        <Num className="font-semibold text-foreground">{fmtRate(getValue<number>())}</Num>
      ),
      meta: { numeric: true },
    },
    {
      id: "war",
      header: "WAR",
      size: 64,
      accessorFn: (c) => cardWAR(c),
      cell: ({ getValue }) => (
        <Num className="font-semibold text-primary">{fmtNum(getValue<number>())}</Num>
      ),
      meta: { numeric: true },
    },
    {
      id: "wobaL",
      header: "vL wOBA",
      size: 76,
      accessorFn: (c) => c.hitter_vL?.wOBA ?? 0,
      cell: ({ getValue }) => <Num className="text-muted-foreground">{fmtRate(getValue<number>())}</Num>,
      meta: { numeric: true },
    },
    {
      id: "wobaR",
      header: "vR wOBA",
      size: 76,
      accessorFn: (c) => c.hitter_vR?.wOBA ?? 0,
      cell: ({ getValue }) => <Num className="text-muted-foreground">{fmtRate(getValue<number>())}</Num>,
      meta: { numeric: true },
    },
  ];
}

function pitcherColumns(): ColumnDef<Card>[] {
  return [
    {
      id: "tier",
      header: "",
      enableSorting: false,
      size: 28,
      cell: ({ row }) => <TierDot tier={row.original.tier} />,
    },
    {
      accessorKey: "name",
      header: "Name",
      size: 200,
      cell: ({ row }) => (
        <span className="font-medium text-foreground">{row.original.name}</span>
      ),
    },
    { accessorKey: "pos", header: "POS", size: 56 },
    {
      id: "throws",
      header: "T",
      size: 48,
      accessorFn: (c) => c.throws,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.throws}</span>,
    },
    {
      id: "fip",
      header: "FIP",
      size: 64,
      accessorFn: (c) => c.pitcher_overall?.FIP ?? 0,
      cell: ({ getValue }) => (
        <Num className="font-semibold text-foreground">{fmtNum(getValue<number>(), 2)}</Num>
      ),
      meta: { numeric: true },
    },
    {
      id: "k9",
      header: "K/9",
      size: 64,
      accessorFn: (c) => c.pitcher_overall?.["K/9"] ?? 0,
      cell: ({ getValue }) => <Num>{fmtNum(getValue<number>())}</Num>,
      meta: { numeric: true },
    },
    {
      id: "bb9",
      header: "BB/9",
      size: 64,
      accessorFn: (c) => c.pitcher_overall?.["BB/9"] ?? 0,
      cell: ({ getValue }) => <Num>{fmtNum(getValue<number>(), 2)}</Num>,
      meta: { numeric: true },
    },
    {
      id: "wobaAgainst",
      header: "wOBA-against",
      size: 110,
      accessorFn: (c) => c.pitcher_overall?.wOBA_against ?? 0,
      cell: ({ getValue }) => <Num>{fmtRate(getValue<number>())}</Num>,
      meta: { numeric: true },
    },
    {
      id: "war",
      header: "WAR",
      size: 64,
      accessorFn: (c) => cardWAR(c),
      cell: ({ getValue }) => (
        <Num className="font-semibold text-primary">{fmtNum(getValue<number>())}</Num>
      ),
      meta: { numeric: true },
    },
  ];
}

function Num({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn(num, className)}>{children}</span>;
}

export function CardTable({ data, mode }: { data: Card[]; mode: Mode }) {
  const router = useRouter();
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "war", desc: true }]);
  const columns = React.useMemo(
    () => (mode === "pitchers" ? pitcherColumns() : hitterColumns()),
    [mode]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const parentRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 12,
  });

  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = items.length ? items[0].start : 0;
  const paddingBottom = items.length ? totalSize - items[items.length - 1].end : 0;

  return (
    <div
      ref={parentRef}
      className="relative h-[calc(100vh-19rem)] overflow-auto rounded-xl border border-border bg-card/40"
    >
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-border">
              {hg.headers.map((header) => {
                const numeric =
                  (header.column.columnDef.meta as { numeric?: boolean } | undefined)?.numeric;
                const sorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
                return (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={cn(
                      "label-eyebrow select-none px-3 py-2.5",
                      numeric ? "text-right" : "text-left",
                      canSort && "cursor-pointer hover:text-foreground"
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        numeric && "flex-row-reverse"
                      )}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort &&
                        (sorted === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <ChevronsUpDown className="size-3 opacity-40" />
                        ))}
                    </span>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: paddingTop }} colSpan={columns.length} />
            </tr>
          )}
          {items.map((vi) => {
            const row = rows[vi.index];
            return (
              <tr
                key={row.id}
                onClick={() => router.push(`/card/${row.original.cid}`)}
                className="cursor-pointer border-b border-border/60 transition-colors hover:bg-accent/60"
              >
                {row.getVisibleCells().map((cell) => {
                  const numeric =
                    (cell.column.columnDef.meta as { numeric?: boolean } | undefined)?.numeric;
                  return (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className={cn("px-3 py-2", numeric ? "text-right" : "text-left")}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr>
              <td style={{ height: paddingBottom }} colSpan={columns.length} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
