"use client";

/**
 * Model a card (UI plan C7, C9): find the shop card by any part of its name,
 * type the variant's numbers over its base values, and step a side he can't
 * see by the usual variant boost (C3). The form reads like the card face: one
 * table in the face's order, vs RHP | vs LHP (a pitcher's: vs RHB | vs LHB),
 * each field with its base value under it and the change in colour once
 * edited. A blank rating says "needs a number" and is left out, so the card
 * keeps its shop value there; a blank position is one it can't play. An
 * included card is scored as he types: a hitter into the lineups, a pitcher
 * into the staff (Movement shows but isn't modelled).
 */
import { Fragment, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { CardCombobox } from "@/components/card-combobox";
import { signed } from "@/lib/format";
import {
  ARM_STATS, armSideKeys, BAT_STATS, BATTER_NAME, BOARD_NAME, cardEdited, edit, faceText, fieldChanged, needsNumber, POSITION_KEYS, POSITIONS, sideKeys,
  STAMINA, untouched, type Board, type Candidate, type ModelAction,
} from "@/lib/league-card-state";
import { cn } from "@/lib/utils";
import { ArmResult } from "./arm-result";
import { toneClass } from "./bits";
import type { CardOption } from "./card-model";
import type { ScoreResult } from "./use-rescore";

/** The boards' order: vs RHP, then vs LHP. */
const SIDES: Board[] = ["vR", "vL"];

/** One typed rating: the input, its base value under it, and the change in colour once edited. */
function Field({ c, k, label, act, seal, position = false }: {
  c: Candidate; k: string; label: string; act: (a: ModelAction) => void; seal: () => void;
  /** A glove rating: blank means the card can't play there, not a missing number. */
  position?: boolean;
}) {
  const value = c.face[k] ?? "";
  const base = c.base[k] ?? 0;
  const changed = fieldChanged(c, k);
  const missing = !position && needsNumber(c, k);
  const d = changed && value !== "" && base > 0 ? Number(value) - Math.round(base) : null;
  let caption: React.ReactNode;
  if (missing) caption = <span className="text-negative">needs a number</span>;
  else if (position && value === "") caption = base > 0 ? <span className="text-warning">{`off · base ${faceText(base)}`}</span> : "can't play";
  else caption = <>{base > 0 ? `base ${faceText(base)}` : "base —"}{d ? <span className={cn("font-mono", toneClass(d, 0))}>{` ${signed(d, 0)}`}</span> : null}</>;
  return (
    <div className="min-w-0">
      <Input
        inputMode="numeric" value={value} onBlur={seal} aria-label={label} aria-invalid={missing || undefined}
        onChange={(e) => act(edit.face(k, e.target.value.replace(/[^0-9]/g, "").slice(0, 3)))}
        className={cn("h-8 px-2 font-mono", position ? "w-14" : "w-16", changed && !missing && "border-primary text-primary", missing && "border-negative")}
      />
      <div className="mt-0.5 whitespace-nowrap text-[11px] text-muted-foreground">{caption}</div>
    </div>
  );
}

function Switch({ checked, onChange, children }: { checked: boolean; onChange: (on: boolean) => void; children: React.ReactNode }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full border transition-colors", checked ? "border-primary bg-primary" : "border-border bg-muted")}>
        <span className={cn("absolute left-0 top-0.5 size-3.5 rounded-full bg-background shadow-sm transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
      </span>
      {children}
    </button>
  );
}

/** What the card adds, only ever for the card on the form. */
function CardResult({ c, result, pending, stale }: { c: Candidate; result: ScoreResult | null; pending: boolean; stale: boolean }) {
  if (!c.include) return <p className="text-xs text-muted-foreground">Left out of the lineups. Switch on Include in lineups to score it.</p>;
  const cand = result?.candidate, add = result?.add;
  if (!cand || !add) {
    return pending ? <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />{`Scoring ${c.name}…`}</p> : null;
  }
  return (
    <div className={cn("rounded-md border border-border bg-muted/20 px-3 py-2 text-sm transition-opacity", stale && "opacity-60")} aria-busy={pending}>
      {stale && !pending && <div className="mb-1 text-xs text-warning">Not scored for your latest edits; this is the last result.</div>}
      <div className="font-semibold">
        {`${cand.label}: `}<span className={toneClass(add.season)}>{`${signed(add.season)} runs a season`}</span>
        <span className="ml-2 font-normal text-muted-foreground">{`(${signed(add.wins)} W)`}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {`As a bat: vs RHP ${signed(cand.vR)}, vs LHP ${signed(cand.vL)}. In your lineups it adds ${signed(add.dR)} vs RHP and ${signed(add.dL)} vs LHP; straight into the DH slot with nothing else moving, ${signed(add.dhOnly)}. The lineups show where it plays.`}
      </p>
    </div>
  );
}

export function CardPanel({ candidate: c, cards, result, pending, stale, loading, cardError, onPick, onClear, act, seal }: {
  candidate: Candidate | null;
  /** Hitters and pitchers to model, owned ones marked. */
  cards: CardOption[];
  /** The scored result for this card, or null (not included, or not scored yet). */
  result: ScoreResult | null;
  pending: boolean;
  /** The result shown is from before the latest edit. */
  stale: boolean;
  /** The card being fetched, while its base values load. */
  loading: string | null;
  /** Why the card could not be loaded; shown under the Card box. */
  cardError: string | null;
  onPick: (c: CardOption) => void;
  onClear: () => void;
  act: (a: ModelAction) => void;
  seal: () => void;
}) {
  const [step, setStep] = useState("7.5");
  const [boost, setBoost] = useState<Record<string, string>>({});
  const boostEntries = Object.entries(boost).filter(([, v]) => v !== "" && v !== "-" && Number.isFinite(Number(v)) && Number(v) !== 0);
  const boostDeltas = boostEntries.length ? Object.fromEntries(boostEntries.map(([k, v]) => [k, Number(v)])) : null;
  const labelOf = useMemo(() => new Map(cards.map((o) => [o.id, o.label])), [cards]);
  const pct = Number(step);
  const stepOk = step !== "" && Number.isFinite(pct) && pct > 0 && pct <= 50;
  const stepText = `+${stepOk ? pct : step || "0"}%`;
  const edited = c ? cardEdited(c) : false;
  const shown = c && !loading ? c : null;
  const arm = shown?.kind === "arm";

  /** A step on the fields still at base: "+7.5%", named in full for a screen reader and the tooltip. */
  const stepButton = (keys: string[], name: string, what: (pct: number) => ModelAction) => {
    const open = shown ? untouched(shown, keys).length > 0 : false;
    return (
      <Button
        size="sm" variant="outline" className="h-6 px-1.5 text-[11px]" disabled={!stepOk || !open} onClick={() => act(what(pct))}
        aria-label={`${stepText} ${name}`}
        title={open ? `Step the ${name} ratings still at the card's base by ${stepText}` : `Every ${name} rating is already edited`}
      >
        {stepText}
      </Button>
    );
  };
  const field = (k: string, label: string, position = false) => shown && <Field key={k} c={shown} k={k} label={label} act={act} seal={seal} position={position} />;
  const sideHead = (side: Board, name: string, keys: string[], what: (pct: number) => ModelAction) => (
    <div key={side} className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <span className="text-xs font-semibold">{name}</span>
      {stepButton(keys, name, what)}
    </div>
  );

  return (
    <Card className="@container">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <CardTitle className="text-base">Model a card</CardTitle>
          {shown && <Switch checked={shown.include} onChange={(on) => act(edit.include(shown.name, on))}>{arm ? "Include in the staff" : "Include in lineups"}</Switch>}
        </div>
        <CardDescription>
          {`Pick the base card, a hitter or a pitcher; its ratings fill in. Type the variant's numbers over them, and step a side you can't see by the usual variant boost.${arm ? "" : " A blank position is one it can't play."}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
            <label htmlFor="lc-card" className="text-xs text-muted-foreground">Card</label>
            {/* Keyed by the card on the form, so an undo or a clear puts its name back. */}
            <CardCombobox key={c?.id ?? "none"} id="lc-card" options={cards} onPick={onPick} selected={c ? labelOf.get(c.id) ?? c.name : ""} keepPick noun="card" />
            {cardError && <p role="alert" className="text-xs text-negative">{cardError}</p>}
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Variant step %</span>
            <Input value={step} inputMode="decimal" onChange={(e) => setStep(e.target.value.replace(/[^0-9.]/g, "").slice(0, 4))} className="h-9 w-20 font-mono" />
          </label>
          {shown && (
            <div className="flex items-center gap-1 self-end">
              <Button size="sm" variant="ghost" disabled={!edited} onClick={() => act(edit.baseFace(shown.name))}>Reset to base</Button>
              {edited
                ? <ConfirmButton variant="ghost" prompt={`Clear ${shown.name} and your edits?`} onConfirm={onClear}>Clear card</ConfirmButton>
                : <Button size="sm" variant="ghost" onClick={onClear}>Clear card</Button>}
            </div>
          )}
        </div>
        {loading && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />{`Loading ${loading}…`}</p>}
        {shown?.title && <div className="text-xs text-muted-foreground">{shown.title}</div>}
        {shown && !arm && (
          <div className="space-y-4">
            <div role="group" aria-label="Batting ratings" className="grid grid-cols-[5rem_1fr_1fr] items-start gap-x-2 gap-y-1.5">
              <div />
              {SIDES.map((side) => sideHead(side, BOARD_NAME[side], sideKeys(side), (p) => edit.step(side, p)))}
              {BAT_STATS.map(([k, name]) => (
                <Fragment key={k}>
                  <div className="pt-1.5 text-xs">{name}</div>
                  {SIDES.map((side) => field(`${k} ${side}`, `${name} ${BOARD_NAME[side]}`))}
                </Fragment>
              ))}
            </div>
            <div role="group" aria-label="Variant boost" className="flex flex-wrap items-end gap-2">
              <span className="w-full text-xs text-muted-foreground">Variant boost: points over the base card, both sides, as the shop lists them</span>
              {BAT_STATS.map(([k, name]) => (
                <label key={k} className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-muted-foreground">{name}</span>
                  <Input value={boost[k] ?? ""} inputMode="numeric" aria-label={`Variant boost to ${name}`}
                    onChange={(e) => setBoost((b) => ({ ...b, [k]: e.target.value.replace(/[^0-9-]/g, "").slice(0, 3) }))} className="h-8 w-14 font-mono" />
                </label>
              ))}
              <Button size="sm" variant="outline" disabled={!boostDeltas} onClick={() => boostDeltas && act(edit.boost(boostDeltas))}>Apply</Button>
            </div>
            <div role="group" aria-label="Glove ratings" className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold">Glove</span>
                {stepButton(POSITION_KEYS, "positions", (p) => edit.step("positions", p))}
              </div>
              <div className="grid grid-cols-4 gap-x-2 gap-y-2 @min-[36rem]:grid-cols-8">
                {POSITIONS.map((p) => (
                  <div key={p} className="min-w-0">
                    <div className="font-mono text-[11px] text-muted-foreground">{p}</div>
                    {field(`POS ${p}`, `Glove at ${p}`, true)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {shown && arm && (
          <div role="group" aria-label="Pitching ratings" className="grid grid-cols-[5rem_1fr_1fr] items-start gap-x-2 gap-y-1.5">
            <div />
            {SIDES.map((side) => sideHead(side, BATTER_NAME[side], armSideKeys(side), (p) => edit.armStep(side, p)))}
            {ARM_STATS.map(([k, name]) => (
              <Fragment key={k}>
                <div className="pt-1.5 text-xs">{name}</div>
                {SIDES.map((side) => field(`${k} ${side}`, `${name} ${BATTER_NAME[side]}`))}
                {/* The card face's Movement sits under Stuff: shown, not modelled. */}
                {k === "STU" && shown.movement && (
                  <>
                    <div className="text-xs text-muted-foreground" title="Not modelled; its parts are pHR and pBABIP">Movement</div>
                    {SIDES.map((side) => (
                      <div key={side} className="px-2 pb-1 font-mono text-xs text-muted-foreground" title="Not modelled; its parts are pHR and pBABIP">
                        {shown.movement?.[side] ?? "—"}
                      </div>
                    ))}
                  </>
                )}
              </Fragment>
            ))}
            <div className="pt-1.5 text-xs">Stamina</div>
            {field(STAMINA, "Stamina")}
            <div />
          </div>
        )}
        {shown && (arm
          ? <ArmResult c={shown} result={result} pending={pending} stale={stale} act={act} />
          : <CardResult c={shown} result={result} pending={pending} stale={stale} />)}
      </CardContent>
    </Card>
  );
}
