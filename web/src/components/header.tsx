"use client";

import * as React from "react";
import { Search, Trophy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { useDataStore } from "@/lib/data";
import { useContextStore, type TournamentContext } from "@/lib/contexts";

function ContextSwitcher() {
  const load = useContextStore((s) => s.load);
  const contexts = useContextStore((s) => s.contexts);
  const selectedKey = useContextStore((s) => s.selectedKey);
  const select = useContextStore((s) => s.select);

  React.useEffect(() => {
    load();
  }, [load]);

  const groups = React.useMemo(() => {
    const by: Record<string, TournamentContext[]> = {};
    for (const c of contexts) (by[c.kind] ??= []).push(c);
    for (const k of Object.keys(by)) by[k].sort((a, b) => a.label.localeCompare(b.label));
    return by;
  }, [contexts]);

  if (!contexts.length) return null;
  const selected = contexts.find((c) => c.key === selectedKey);
  const era = selected?.reYear ? ` · RE ${selected.reYear}` : "";

  return (
    <div className="flex items-center gap-2" title={`Tournament context${era}`}>
      <Trophy className="size-4 shrink-0 text-muted-foreground" />
      <select
        value={selectedKey}
        onChange={(e) => select(e.target.value)}
        className="h-8 max-w-56 truncate rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
      >
        {(["season", "tournament", "draft"] as const).map(
          (kind) =>
            groups[kind] && (
              <optgroup
                key={kind}
                label={{ season: "Season", tournament: "Tournaments", draft: "Perfect Drafts" }[kind]}
              >
                {groups[kind].map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                    {c.reYear ? ` (${c.reYear})` : ""}
                  </option>
                ))}
              </optgroup>
            ),
        )}
      </select>
    </div>
  );
}

export function Header() {
  const search = useDataStore((s) => s.filters.search);
  const setSearch = useDataStore((s) => s.setSearch);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur">
      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search players by name…"
          className="pl-9"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <ContextSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
