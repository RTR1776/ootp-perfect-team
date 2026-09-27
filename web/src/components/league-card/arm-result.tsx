/**
 * What a modelled pitcher adds, only ever for the card on the form: runs a
 * season and wins on the same number of pitching spots, where his number
 * comes from (league play, or his ratings where the sample is thin), the slot
 * he takes and who sits, and the staff he would join. He goes wherever he
 * scores best, or where L.J. puts him: the rotation or the pen.
 */
import { Loader2 } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { signed } from "@/lib/format";
import { cardEdited, edit, nameOf, STARTER_STAMINA, type ArmSlotRole, type Candidate, type ModelAction } from "@/lib/league-card-state";
import { cn } from "@/lib/utils";
import { innings, per9, toneClass } from "./bits";
import type { ScoreResult, StaffSlot } from "./use-rescore";

type Role = ArmSlotRole;
type RoleChoice = Role | "best";
const ROLES: Array<[role: Role | null, label: string]> = [[null, "Best"], ["SP", "Starter"], ["RP", "Reliever"]];

export function ArmResult({ c, result, pending, stale, act }: {
  c: Candidate; result: ScoreResult | null; pending: boolean; stale: boolean;
  act: (a: ModelAction) => void;
}) {
  if (!c.include) return <p className="text-xs text-muted-foreground">Left out of the staff. Switch on Include in the staff to score it.</p>;
  const arm = result?.candidateArm, add = result?.armAdd;
  if (!result || !arm) {
    return pending ? <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />Scoring {c.name}…</p> : null;
  }
  if (arm.sp == null && arm.rp == null) {
    return <p className="text-xs text-warning">{`No score for ${c.name} with these ratings: is one of them 0?`}</p>;
  }
  const canStart = arm.sp != null && (arm.stamina == null || arm.stamina > STARTER_STAMINA);
  // A starter he can't be (Stamina typed down since) is scored where he fits best.
  const chosen = c.role === "SP" && !canStart ? null : (c.role ?? null);
  // The role he'd pitch in; one who wouldn't pitch is read as his card is (Stamina).
  const role: Role = add?.slot?.role ?? chosen ?? (canStart ? "SP" : "RP");
  const other: Role = role === "SP" ? "RP" : "SP";
  const score = (r: Role) => (r === "SP" ? arm.sp : arm.rp);
  const ip = (r: Role) => (r === "SP" ? arm.spIp : arm.rpIp);
  const ipFamily = (r: Role) => (r === "SP" ? arm.spIpFamily : arm.rpIpFamily);
  const estimate = (r: Role) => (r === "SP" ? arm.spSource : arm.rpSource) === "estimate";

  // "1,200 IP in PEL, 8,000 elsewhere": his own league's play counts most.
  const elsewhere = ip(role) - ipFamily(role);
  const where = `${innings(ipFamily(role))} IP in ${result.family}${elsewhere > 0 ? `, ${innings(elsewhere)} elsewhere` : ""}`;
  let from: string;
  if (estimate(role)) from = `Mostly the ratings estimate: ${per9(score(role))}/9 as ${role} (${ip(role) > 0 ? `${where}` : "no league sample"}).`;
  else if (cardEdited(c)) from = `League play moved by your edits: ${per9(score(role))}/9 as ${role}, from ${where}.`;
  else from = `League: ${per9(score(role))}/9 as ${role}, from ${where}.`;

  // "Vida Blue 101" → "Vida Blue", for "Vida Blue sits".
  const names = new Map(result.armPool.map((a) => [a.label, nameOf(a.entry)]));
  const who = (labels: string[]) => labels.map((l) => names.get(l) ?? l).join(" and ");
  const slot = !add
    ? "Add pitchers to your team to see where he would pitch."
    : !add.slot
      ? "Wouldn't pitch: every arm on your staff scores better."
      : `Slots in at ${add.slot.slot}${add.replaces.length ? `, replaces ${who(add.replaces)}` : ""}${add.sits.length ? `; ${who(add.sits)} ${add.sits.length === 1 ? "sits" : "sit"}` : ""}.`;
  const otherRole = !canStart
    ? `Stamina ${arm.stamina ?? "—"}: relief only.`
    : score(other) != null ? `As a ${other === "SP" ? "starter" : "reliever"}: ${per9(score(other))}/9${estimate(other) ? ", estimate" : ""}.` : null;
  const staffList = (slots: StaffSlot[]) => slots.map((x, i) => (
    <span key={x.slot}>
      {i > 0 && ", "}
      {x.entry === arm.entry ? <span className="font-medium text-foreground">{c.name}</span> : nameOf(x.entry)}
    </span>
  ));

  return (
    <div className={cn("rounded-md border border-border bg-muted/20 px-3 py-2 text-sm transition-opacity", stale && "opacity-60")} aria-busy={pending}>
      {stale && !pending && <div className="mb-1 text-xs text-warning">Not scored for your latest edits; this is the last result.</div>}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="font-semibold">
          {arm.label}:{" "}
          {add
            ? <><span className={toneClass(add.season)}>{signed(add.season)} runs a season</span><span className="ml-2 font-normal text-muted-foreground">({signed(add.wins)} W)</span></>
            : <span className="font-normal text-muted-foreground">no staff to join</span>}
        </div>
        <Segmented<RoleChoice>
          aria-label={`Where ${c.name} pitches`}
          // His stored choice, even a Starter he can't be right now (the note says so): Best stays clickable.
          value={c.role ?? "best"}
          onChange={(v) => act(edit.armRole(c.name, v === "best" ? null : v))}
          options={ROLES.map(([r, label]) => ({
            value: r ?? "best", label, disabled: r === "SP" && !canStart,
            title: r === "SP" && !canStart ? `Stamina ${arm.stamina ?? "—"}: relief only` : r ? `What he adds as a ${r === "SP" ? "starter" : "reliever"}` : "Wherever he scores best",
          }))}
        />
      </div>
      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        <p>{from}</p>
        <p>{slot}{otherRole ? ` ${otherRole}` : ""}</p>
        {c.role === "SP" && !canStart && <p className="text-warning">{`Stamina ${arm.stamina ?? "—"}: can't start; shown where he fits best.`}</p>}
        {add?.refused && (
          <p className="text-warning">
            {`Every ${add.refused === "SP" ? "rotation" : "bullpen"} spot is locked: unlock one to see him as a ${add.refused === "SP" ? "starter" : "reliever"}. Shown where he fits best.`}
          </p>
        )}
        {add?.slot && result.staff && (
          <>
            <p className="pt-1">
              The staff he would join: <span className={cn("font-mono", toneClass(add.staff.total - result.staff.total))}>{signed(add.staff.total)}</span> runs a
              season (now <span className="font-mono">{signed(result.staff.total)}</span>).
            </p>
            <p>Rotation: {staffList(add.staff.rotation)}.</p>
            <p>Bullpen: {staffList(add.staff.bullpen)}.</p>
          </>
        )}
      </div>
    </div>
  );
}
