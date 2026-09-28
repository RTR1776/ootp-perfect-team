/**
 * The Pitching staff tab (UI plan §5 D): his pitchers as a rotation (SP1–SP5)
 * and a bullpen (CL, RP1…), each slot's edge per 9 over the league's arm, the
 * league innings it rests on, and its runs a season. Each slot's select locks
 * an arm there and a 24px × beside it unlocks it, as on the lineup boards;
 * the rest fill themselves. With a modelled pitcher included,
 * the tables show the staff he would join: his row, and any arm he moves
 * between the rotation and the pen ("was SP5"). Every slot of a role pitches
 * the same innings, so an arm moving down the pen is no change. Like the
 * lineups, the staff rescores after every edit and dims while it comes.
 */
import { Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Select } from "@/components/ui/select";
import { signed } from "@/lib/format";
import {
  armLockCount, armLockMovesFrom, edit, listName, modelReducer, nameOf, ROTATION_SLOTS, STARTER_STAMINA,
  type LeagueExport, type ModelAction, type ModelState,
} from "@/lib/league-card-state";
import { cn } from "@/lib/utils";
import { cardWarning, innings, per9, ScoreStatus, staffWarning, toneClass } from "./bits";
import { BoardTotal } from "./board";
import type { ArmRow, ScoreResult, Staff, StaffSlot } from "./use-rescore";

type Role = "SP" | "RP";
const AS: Record<Role, string> = { SP: "a starter", RP: "a reliever" };

/** The modelled pitcher, included and scored: his row and the staff he would join. */
export interface StaffWith { name: string; arm: ArmRow; staff: Staff }

const isEstimate = (a: ArmRow | undefined, role: Role) => !!a && (role === "SP" ? a.spSource : a.rpSource) === "estimate";

/** "3,306 IP" of league play in the role, or a grey "est." where the ratings carry the number. */
function Sample({ arm, role, family }: { arm: ArmRow | undefined; role: Role; family: string }) {
  if (!arm) return null;
  const ip = role === "SP" ? arm.spIp : arm.rpIp;
  const inFamily = role === "SP" ? arm.spIpFamily : arm.rpIpFamily;
  if (isEstimate(arm, role)) {
    const why = ip > 0 ? `Mostly a ratings estimate: ${innings(inFamily)} IP as ${AS[role]} in ${family}, ${innings(ip - inFamily)} in other leagues` : `No league innings as ${AS[role]}: a ratings estimate`;
    return <span className="rounded bg-muted px-1 text-[11px] text-muted-foreground" title={why}>est.</span>;
  }
  const title = `League innings as ${AS[role]} (the card's, and its variant's where its ratings are known): ${innings(inFamily)} in ${family}, ${innings(ip - inFamily)} in other leagues`;
  return <span className="whitespace-nowrap rounded border border-border px-1 font-mono text-[11px]" title={title}>{innings(ip)} IP</span>;
}

function StaffTable({ title, role, family, slots, at, before, locks, options, rows, model, pending, stale, onLock, onSelectKeys }: {
  title: string;
  role: Role;
  /** The league family the edges are for (PEL, HD, LD). */
  family: string;
  slots: string[];
  /** Who pitches in each slot: the staff now, or with the modelled pitcher. */
  at: Map<string, StaffSlot>;
  /** With a modelled pitcher: this table's runs and each arm's slot before him. */
  before: { total: number; slotOf: Map<string, string> } | null;
  locks: Record<string, string>;
  /** What a slot's select offers, best first: [entry, label]. */
  options: Array<[entry: string, label: string]>;
  rows: Map<string, ArmRow>;
  /** The modelled pitcher's entry. */
  model: string | null;
  pending: boolean;
  /** The staff shown is from before the latest edit (pending, skipped or failed): dimmed. */
  stale: boolean;
  /** Lock a slot to an arm; null unlocks it. */
  onLock: (slot: string, entry: string | null) => void;
  onSelectKeys: (e: React.KeyboardEvent) => void;
}) {
  const total = at.size ? slots.reduce((n, s) => n + (at.get(s)?.runs ?? 0), 0) : null;
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold">{title}</span>
        {/* As on the lineup boards: "Total +12.4", and with a modelled arm "→ +14.0". */}
        <BoardTotal now={before ? before.total : total} next={before ? total : null} pending={pending} stale={stale} />
      </div>
      <table className={cn("w-full table-fixed text-xs transition-opacity", stale && "opacity-60")} aria-busy={pending}>
        <thead>
          <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
            <th className="w-9 py-1 font-medium">Slot</th>
            <th className="py-1 font-medium">{role === "SP" ? "Starter" : "Reliever"}</th>
            <th className="w-12 py-1 text-right font-medium" title="FIP-type runs per 9 innings better than the league's arm">Edge/9</th>
            <th className="hidden w-24 py-1 pl-2 text-right font-medium @md:table-cell" title="League innings in this role; est. is an estimate from ratings">Sample</th>
            <th className="w-12 py-1 text-right font-medium" title="Runs a season: edge × the slot's innings ÷ 9">Season</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => {
            const x = at.get(slot);
            const isModel = x != null && x.entry === model;
            // An arm the modelled one moves between the rotation and the pen.
            const was = x ? before?.slotOf.get(x.entry) : undefined;
            const moved = was != null && was.startsWith("SP") !== slot.startsWith("SP");
            // The icon marks a lock that held: the slot's arm is the one locked there.
            const held = locks[slot] != null && x?.entry === locks[slot];
            const arm = x ? rows.get(x.entry) : undefined;
            return (
              <tr key={slot} className={cn("border-b border-border/50 align-middle", isModel && "bg-primary/5")}>
                <td className="py-1 font-mono text-muted-foreground">{slot}</td>
                <td className="py-1 pr-2">
                  <div className="flex min-w-0 items-center gap-1">
                    {held && <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="Locked" />}
                    <Select
                      value={locks[slot] ?? ""}
                      onChange={(e) => onLock(slot, e.target.value || null)}
                      onKeyDown={onSelectKeys}
                      className={cn("h-7 min-w-0 flex-1 px-1.5 text-xs", isModel && "font-medium text-primary")}
                      aria-label={`${slot}: who pitches there`}
                    >
                      <option value="">{locks[slot] ? "Auto" : `Auto · ${x?.label ?? "—"}`}</option>
                      {options.map(([e, label]) => <option key={e} value={e}>{label}</option>)}
                    </Select>
                    {locks[slot] != null && (
                      <button
                        type="button" onClick={() => onLock(slot, null)} title={`Unlock ${slot}`} aria-label={`Unlock ${slot}`}
                        className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                  {moved && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{`was ${was}`}</div>}
                </td>
                <td className={cn("py-1 text-right font-mono", toneClass(x?.edge9, 2))}>
                  {per9(x?.edge9)}
                  {isEstimate(arm, role) && <div className="font-sans text-[10px] text-muted-foreground @md:hidden">est.</div>}
                </td>
                <td className="hidden py-1 pl-2 text-right @md:table-cell"><Sample arm={arm} role={role} family={family} /></td>
                <td className={cn("py-1 text-right font-mono", toneClass(x?.runs))}>{signed(x?.runs)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function StaffPanel({ state, league, result, withArm, pending, stale, skip, error, retry, act, told, onSelectKeys }: {
  state: ModelState;
  /** The newest export: Reset staff goes back to its pitchers. */
  league: LeagueExport;
  result: ScoreResult | null;
  /** The modelled pitcher, when he is included and scored. */
  withArm: StaffWith | null;
  pending: boolean;
  /** The staff shown is from before the latest edit. */
  stale: boolean;
  /** Why nothing is being scored (a half-typed year or park). */
  skip: string | null;
  error: string | null;
  retry: () => void;
  act: (a: ModelAction) => void;
  /** An edit that drops work, with its Undo toast. */
  told: (a: ModelAction, message: string) => void;
  onSelectKeys: (e: React.KeyboardEvent) => void;
}) {
  const now = result?.staff ?? null;
  const shown = withArm?.staff ?? now;
  const rows = new Map((result?.armPool ?? []).map((a) => [a.entry, a]));
  if (withArm) rows.set(withArm.arm.entry, withArm.arm);
  const locks = armLockCount(state.armLocks);
  const atExport = modelReducer(state, edit.resetStaff(league)) === state;
  const warnings = (result?.warnings ?? []).filter((w) => staffWarning(w, state.arms) && !cardWarning(w, result?.candidateArm?.label));
  const clearLocks = () => told(edit.clearArmLocks(locks), `Cleared ${locks} staff lock${locks === 1 ? "" : "s"}`);
  // An arm locks into one slot, so locking him elsewhere moves him: say so.
  const lock = (slot: string, entry: string | null) => {
    const from = armLockMovesFrom(state, slot, entry);
    if (from && entry) told(edit.armLock(slot, entry), `Moved ${nameOf(entry)} from ${from} to ${slot}`);
    else act(edit.armLock(slot, entry));
  };

  /** A slot's choices, best first: "Cliff Lee 100 VAR · +0.37/9 as SP". A rotation slot offers only arms that can start. */
  const lockedToStart = new Set(Object.entries(state.armLocks).filter(([slot]) => slot.startsWith("SP")).map(([, e]) => e));
  const canStart = (a: ArmRow) => a.stamina == null || a.stamina > STARTER_STAMINA || lockedToStart.has(a.entry);
  const options = (role: Role): Array<[string, string]> => {
    const score = (a: ArmRow) => (role === "SP" ? a.sp : a.rp);
    const scored = state.arms.map((e) => rows.get(e)).filter((a): a is ArmRow => a != null)
      .filter((a) => role === "RP" || canStart(a))
      .sort((a, b) => (score(b) ?? -Infinity) - (score(a) ?? -Infinity))
      .map((a): [string, string] => [a.entry, `${a.label} · ${per9(score(a))}/9 as ${role}`]);
    // Just added and not scored yet: by name, so a lock on him still shows.
    const unscored = state.arms.filter((e) => !rows.has(e)).map((e): [string, string] => [e, nameOf(e)]);
    return [...scored, ...unscored];
  };

  // Before the first result, the slots his list will fill, so the tables don't jump when it comes.
  const starters = Math.min(ROTATION_SLOTS.length, state.arms.length);
  const rotation = shown ? shown.rotation.map((x) => x.slot) : ROTATION_SLOTS.slice(0, starters);
  const bullpen = shown ? shown.bullpen.map((x) => x.slot) : Array.from({ length: state.arms.length - starters }, (_, i) => (i === 0 ? "CL" : `RP${i}`));
  const at = new Map([...(shown?.rotation ?? []), ...(shown?.bullpen ?? [])].map((x) => [x.slot, x]));
  const slotOf = new Map([...(now?.rotation ?? []), ...(now?.bullpen ?? [])].map((x) => [x.entry, x.slot]));
  const before = (group: StaffSlot[] | undefined) => (withArm && now ? { total: (group ?? []).reduce((n, x) => n + x.runs, 0), slotOf } : null);
  const sits = (withArm ? withArm.staff.out : now?.out ?? []).map((o) => o.label);
  // A lock on a slot the board doesn't have (RP8 once the pen is shorter) still holds his role: show it, so it can be released.
  const onBoard = new Set([...rotation, ...bullpen]);
  const offBoard = Object.entries(state.armLocks).filter(([slot]) => !onBoard.has(slot));
  const nowAt = new Map([...(shown?.rotation ?? []), ...(shown?.bullpen ?? [])].map((x) => [x.entry, x.slot]));
  const ip = now?.ipPerSlot;
  const family = result?.family ?? state.settings.family;
  const table = (title: string, role: Role, slots: string[]) => (
    <StaffTable
      title={title} role={role} family={family} slots={slots} at={at} before={before(role === "SP" ? now?.rotation : now?.bullpen)} locks={state.armLocks} options={options(role)} rows={rows}
      model={withArm?.arm.entry ?? null} pending={pending} stale={stale} onLock={lock} onSelectKeys={onSelectKeys}
    />
  );

  return (
    <div className="@container space-y-4">
      <p className="text-sm text-muted-foreground">
        Five starters and a bullpen from your pitchers. Lock a slot to force an arm there; the rest fill themselves. Runs are
        per season above the league&apos;s average arm.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className={cn("text-sm", stale && "opacity-60")}>
          {now && (
            <>
              <span className="font-semibold">{"Staff "}</span><span className={cn("font-mono", toneClass(now.total))}>{signed(now.total)}</span>{" runs a season"}
              {withArm && <>{" → "}<span className={cn("font-mono", toneClass(withArm.staff.total - now.total))}>{signed(withArm.staff.total)}</span>{` with ${withArm.name}`}</>}
              {sits.length > 0 && <span className="text-muted-foreground">{` · Sits: ${sits.join(", ")}`}</span>}
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {locks > 0 && (locks >= 3
            ? <ConfirmButton variant="ghost" prompt={`Clear all ${locks} staff locks?`} onConfirm={clearLocks}>{`Clear ${locks} locks`}</ConfirmButton>
            : <Button size="sm" variant="ghost" onClick={clearLocks}>{`Clear ${locks} lock${locks === 1 ? "" : "s"}`}</Button>)}
          {league.source && (
            <ConfirmButton
              variant="ghost" disabled={atExport}
              prompt={league.armLocks
                ? `Reset staff to ${listName(league.source)}, with its roles?`
                : `Reset staff to ${listName(league.source)}${locks ? ` and clear ${locks} lock${locks === 1 ? "" : "s"}` : ""}?`}
              onConfirm={() => told(edit.resetStaff(league), `Staff reset to ${listName(league.source)}`)}
            >
              {`Reset staff to ${listName(league.source)}`}
            </ConfirmButton>
          )}
        </div>
      </div>
      <ScoreStatus skip={skip} error={error} retry={retry} shown={now ? "The staff below is" : null} />
      {!state.arms.length && <p className="text-sm text-muted-foreground">No pitchers on your team. Add them under Your team; a pitcher from the list joins the staff.</p>}
      {state.arms.length > 0 && (
        <div className="grid gap-6 @min-[60rem]:grid-cols-2">
          {table("Rotation", "SP", rotation)}
          {table("Bullpen", "RP", bullpen)}
        </div>
      )}
      {offBoard.length > 0 && (
        <ul className="space-y-1 text-xs">
          {offBoard.map(([slot, entry]) => (
            <li key={slot} className="flex flex-wrap items-center gap-x-2">
              <Lock className="size-3 shrink-0 text-muted-foreground" aria-hidden />
              <span>{`${nameOf(entry)} is locked at ${slot}, which a staff this size doesn't have${nowAt.get(entry) ? `; he pitches at ${nowAt.get(entry)}.` : "."}`}</span>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => lock(slot, null)}>{`Unlock ${slot}`}</Button>
            </li>
          ))}
        </ul>
      )}
      {ip && (
        <p className={cn("text-[11px] text-muted-foreground", stale && "opacity-60")}>
          {`Edge per 9 = FIP-type runs better than each week's league. ${family} play counts most; a card's play in the other leagues is scaled to ${family} and weighs in where that is thin, and arms with little of either lean on a ratings estimate. The base card's line counts, and its variant's where the variant's ratings are known (his own copy, or the league export's). Season = edge × ${Math.round(ip.sp)} IP (starter) / ${Math.round(ip.rp)} IP (reliever). Leverage not modelled.`}
          {now?.week && result ? ` Slot innings: ${result.family}, week of ${now.week.slice(5)}.` : ""}
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="space-y-0.5 text-[11px] text-warning">
          {warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
    </div>
  );
}
