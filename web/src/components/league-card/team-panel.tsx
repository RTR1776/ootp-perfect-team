"use client";

/**
 * The team: the hitters the lineups are built from and the pitchers the staff
 * is built from, started from the newest league export and edited by hand.
 * One picker adds either; a pitcher joins the staff. When a newer export
 * arrives, a banner offers to take it while keeping the players he added (UI
 * plan C4).
 */
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { signed } from "@/lib/format";
import {
  armLockCount, edit, exportChange, exportLabel, lockCount, modelReducer, nameOf, teamEdits,
  type LeagueExport, type ModelAction, type ModelState,
} from "@/lib/league-card-state";
import { ArmRosterTable } from "./arm-roster-table";
import { Eyebrow, toneClass } from "./bits";
import type { CardOption } from "./card-model";
import type { ScoreResult } from "./use-rescore";

/** "From PEL, week of 09-27 · your edits: +1, −2". */
function caption(s: ModelState): string {
  if (!s.source) return s.bats.length || s.arms.length ? "Your own list; no league export on file" : "No league export yet. Add your players below";
  const { added, removed } = teamEdits(s);
  const edits = [added ? `+${added}` : "", removed ? `−${removed}` : ""].filter(Boolean).join(", ");
  return `From ${exportLabel(s.source)} · ${edits ? `your edits: ${edits}` : "no edits"}`;
}

/** "New: Mike Piazza, Hank Aaron · Gone: Roger Connor." */
function changeText({ added, gone }: { added: string[]; gone: string[] }): string {
  const parts = [added.length ? `New: ${added.map(nameOf).join(", ")}` : "", gone.length ? `Gone: ${gone.map(nameOf).join(", ")}` : ""].filter(Boolean);
  return parts.length ? `${parts.join(" · ")}.` : "Same players.";
}

export function TeamPanel({ state, league, cards, result, act, told }: {
  state: ModelState;
  league: LeagueExport;
  cards: CardOption[];
  result: ScoreResult | null;
  act: (a: ModelAction) => void;
  told: (a: ModelAction, message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const byLabel = useMemo(() => new Map(cards.map((c) => [c.label, c])), [cards]);
  const runs = new Map((result?.pool ?? []).map((p) => [p.entry, p]));
  const change = exportChange(state, league);
  const locks = lockCount(state.locks) + armLockCount(state.armLocks);
  const atExport = modelReducer(state, edit.resetTeam(league)) === state;

  // A pitcher from the list joins the staff; a hitter, the lineups.
  const add = (label: string) => {
    const c = byLabel.get(label);
    if (!c) { setQuery(label); return; }
    const entry = `${c.name}#${c.id}`;
    act(c.kind === "arm" ? edit.addArm(entry) : edit.add(entry));
    setQuery("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your team</CardTitle>
        <CardDescription>
          {caption(state)}. The export lists everyone who played for you that week, so take off anyone you&apos;ve dropped. Saved in this browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {change && league.source && (
          <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
            <p className="min-w-0 flex-1 basis-64">
              <span className="font-medium">New league export: {exportLabel(league.source)}.</span> {changeText(change)}
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => told(edit.updateTeam(league), `Team updated to ${exportLabel(league.source!)}`)}>Update team</Button>
              <Button size="sm" variant="ghost" onClick={() => act(edit.keepList(league))}>Keep my list</Button>
            </div>
          </div>
        )}
        <div className="grid gap-x-6 gap-y-4 xl:grid-cols-2">
          <section className="min-w-0 space-y-1.5" aria-label="Hitters">
            <h3 className="text-xs font-semibold">Hitters ({state.bats.length})</h3>
            <div className="flex flex-wrap gap-1.5">
              {state.bats.map((e) => {
                const r = runs.get(e);
                return (
                  <span key={e} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs">
                    <span>{r?.label ?? nameOf(e)}</span>
                    {r && (
                      <span className="font-mono text-muted-foreground">
                        R <span className={toneClass(r.vR)}>{signed(r.vR)}</span> · L <span className={toneClass(r.vL)}>{signed(r.vL)}</span>
                      </span>
                    )}
                    <button onClick={() => told(edit.remove(e), `Removed ${nameOf(e)}`)} aria-label={`Remove ${nameOf(e)}`} className="text-muted-foreground hover:text-negative">
                      <X className="size-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </section>
          <section className="min-w-0 space-y-1.5" aria-label="Pitchers">
            <h3 className="text-xs font-semibold">Pitchers ({state.arms.length})</h3>
            {state.arms.length
              ? <ArmRosterTable arms={state.arms} result={result} onRemove={(e) => told(edit.removeArm(e), `Removed ${nameOf(e)}`)} />
              : <p className="text-xs text-muted-foreground">No pitchers. Add one below.</p>}
          </section>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-1 basis-72 flex-col gap-1">
            <Eyebrow>Add a player (yours, or a shop card to try)</Eyebrow>
            <Input list="league-card-options" value={query} placeholder="Start typing a name…" onChange={(e) => add(e.target.value)} />
          </label>
          {league.source && (
            <ConfirmButton
              variant="ghost" disabled={atExport}
              prompt={`Reset team to the export${locks ? ` and clear ${locks} lock${locks === 1 ? "" : "s"}` : ""}?`}
              onConfirm={() => told(edit.resetTeam(league), "Team reset to the export")}
            >
              Reset to the export
            </ConfirmButton>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
