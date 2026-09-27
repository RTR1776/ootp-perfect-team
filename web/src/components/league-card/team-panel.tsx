"use client";

/**
 * The team: the hitters the lineups are built from and the pitchers the staff
 * is built from, started from the newest league export and edited by hand
 * (UI plan C6). Two tables, starters first and the bench (or the arms who
 * sit) greyed below; one search in the footer adds either kind, a pitcher to
 * the staff. When a newer export arrives, the banner at the top of the page
 * offers to take it while keeping the players he added (C4).
 */
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { CardCombobox } from "@/components/card-combobox";
import {
  armLockCount, edit, exportChange, exportLabel, lockCount, modelReducer, nameOf, teamEdits,
  type LeagueExport, type ModelAction, type ModelState,
} from "@/lib/league-card-state";
import { ArmRosterTable } from "./arm-roster-table";
import type { CardOption } from "./card-model";
import { RosterTable } from "./roster-table";
import type { ScoreResult } from "./use-rescore";

/** "From PEL, week of 09-27 · your edits: +1, −2". */
function caption(s: ModelState): string {
  if (!s.source) return s.bats.length || s.arms.length ? "Your own list; no league export on file" : "No league export yet: add your players below";
  const { added, removed } = teamEdits(s);
  const edits = [added ? `+${added}` : "", removed ? `−${removed}` : ""].filter(Boolean).join(", ");
  return `From ${exportLabel(s.source)} · ${edits ? `your edits: ${edits}` : "no edits"}`;
}

/** "New: Mike Piazza, Hank Aaron · Gone: Roger Connor." */
function changeText({ added, gone }: { added: string[]; gone: string[] }): string {
  const parts = [added.length ? `New: ${added.map(nameOf).join(", ")}` : "", gone.length ? `Gone: ${gone.map(nameOf).join(", ")}` : ""].filter(Boolean);
  return parts.length ? `${parts.join(" · ")}.` : "Same players.";
}

/** A newer league export than the one his lists follow: take it (keeping the players he added), or keep his list. */
export function ExportBanner({ state, league, act, told }: {
  state: ModelState;
  league: LeagueExport;
  act: (a: ModelAction) => void;
  told: (a: ModelAction, message: string) => void;
}) {
  const change = exportChange(state, league);
  if (!change || !league.source) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
      <p className="min-w-0 flex-1 basis-64">
        <span className="font-medium">{`New league export: ${exportLabel(league.source)}. `}</span>{changeText(change)}
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => told(edit.updateTeam(league), `Team updated to ${exportLabel(league.source!)}`)}>Update team</Button>
        <Button size="sm" variant="ghost" onClick={() => act(edit.keepList(league))}>Keep my list</Button>
      </div>
    </div>
  );
}

export function TeamPanel({ state, league, cards, result, act, told }: {
  state: ModelState;
  league: LeagueExport;
  cards: CardOption[];
  result: ScoreResult | null;
  act: (a: ModelAction) => void;
  told: (a: ModelAction, message: string) => void;
}) {
  const locks = lockCount(state.locks) + armLockCount(state.armLocks);
  const atExport = modelReducer(state, edit.resetTeam(league)) === state;
  const onTeam = useMemo(() => new Set([...state.bats, ...state.arms]), [state.bats, state.arms]);
  // A pitcher from the list joins the staff; a hitter, the lineups.
  const add = (c: CardOption) => {
    const entry = `${c.name}#${c.id}`;
    act(c.kind === "arm" ? edit.addArm(entry) : edit.add(entry));
  };

  return (
    <Card className="@container">
      <CardHeader>
        <CardTitle className="text-base">Your team</CardTitle>
        <CardDescription>
          {state.source
            ? `${caption(state)}. The export lists everyone who played for you that week, so take off anyone you've dropped. Saved in this browser.`
            : `${caption(state)}. Saved in this browser.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="min-w-0 space-y-1" aria-label="Hitters">
          <h3 className="text-xs font-semibold">{`Hitters (${state.bats.length})`}</h3>
          {state.bats.length
            ? <RosterTable bats={state.bats} result={result} onRemove={(e) => told(edit.remove(e), `Removed ${nameOf(e)}`)} />
            : <p className="text-xs text-muted-foreground">No hitters. Add them below.</p>}
        </section>
        <section className="min-w-0 space-y-1" aria-label="Pitchers">
          <h3 className="text-xs font-semibold">{`Pitchers (${state.arms.length})`}</h3>
          {state.arms.length
            ? <ArmRosterTable arms={state.arms} result={result} onRemove={(e) => told(edit.removeArm(e), `Removed ${nameOf(e)}`)} />
            : <p className="text-xs text-muted-foreground">No pitchers. Add one below.</p>}
        </section>
        <div className="flex flex-wrap items-end gap-2 border-t border-border/60 pt-4">
          <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
            <label htmlFor="lc-add" className="text-xs text-muted-foreground">Add a player (yours, or a shop card to try)</label>
            <CardCombobox id="lc-add" options={cards} onPick={add} noun="player" note={(c) => (onTeam.has(`${c.name}#${c.id}`) ? "on team" : null)} />
          </div>
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
