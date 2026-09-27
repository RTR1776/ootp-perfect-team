"use client";

/**
 * Model a card: pick the shop card, type the variant's numbers over its base
 * values, and step a side he can't see by the usual variant boost (UI plan
 * C3). An included card is scored into the lineups as he types.
 */
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { signed } from "@/lib/format";
import {
  BAT_STATS, BOARD_NAME, cardEdited, edit, fieldChanged, POSITION_KEYS, POSITIONS, sideKeys, untouched,
  type Board, type Candidate, type ModelAction,
} from "@/lib/league-card-state";
import { cn } from "@/lib/utils";
import { Eyebrow, toneClass } from "./bits";
import type { CardOption } from "./card-model";
import type { ScoreResult } from "./use-rescore";

const SIDES: Board[] = ["vR", "vL"];

function Field({ label, value, changed, onChange, onBlur }: { label: string; value: string; changed: boolean; onChange: (v: string) => void; onBlur: () => void }) {
  return (
    <label className="flex flex-col gap-1">
      <Eyebrow>{label}</Eyebrow>
      <Input
        inputMode="numeric" value={value} onBlur={onBlur}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
        className={cn("h-8 w-[4.5rem] px-2 font-mono", changed && "border-primary text-primary")}
      />
    </label>
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
    return pending ? <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />Scoring {c.name}…</p> : null;
  }
  return (
    <div className={cn("rounded-md border border-border bg-muted/20 px-3 py-2 text-sm transition-opacity", stale && "opacity-60")} aria-busy={pending}>
      {stale && !pending && <div className="mb-1 text-xs text-warning">Not scored for your latest edits; this is the last result.</div>}
      <div className="font-semibold">
        {cand.label}: <span className={toneClass(add.season)}>{signed(add.season)} runs a season</span>
        <span className="ml-2 font-normal text-muted-foreground">({signed(add.wins)} W)</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        As a bat: vs RHP <span className={cn("font-mono", toneClass(cand.vR))}>{signed(cand.vR)}</span>, vs LHP{" "}
        <span className={cn("font-mono", toneClass(cand.vL))}>{signed(cand.vL)}</span>. In your lineups it adds{" "}
        <span className="font-mono">{signed(add.dR)}</span> vs RHP and <span className="font-mono">{signed(add.dL)}</span> vs LHP;
        straight into the DH slot with nothing else moving, <span className="font-mono">{signed(add.dhOnly)}</span>. The lineups above show where it plays.
      </div>
    </div>
  );
}

export function CardPanel({ candidate: c, cards, result, pending, stale, loading, cardError, onPick, onClear, act, seal }: {
  candidate: Candidate | null;
  cards: CardOption[];
  /** The scored result for this card, or null (not included, or not scored yet). */
  result: ScoreResult | null;
  pending: boolean;
  /** The result shown is from before the latest edit. */
  stale: boolean;
  /** The card being fetched, while its base values load. */
  loading: string | null;
  cardError: string | null;
  onPick: (c: CardOption) => void;
  onClear: () => void;
  act: (a: ModelAction) => void;
  seal: () => void;
}) {
  const [step, setStep] = useState("7.5");
  const byLabel = useMemo(() => new Map(cards.map((o) => [o.label, o])), [cards]);
  const labelOf = useMemo(() => new Map(cards.map((o) => [o.id, o.label])), [cards]);
  const pct = Number(step);
  const stepOk = step !== "" && Number.isFinite(pct) && pct > 0 && pct <= 50;
  const stepText = `+${stepOk ? pct : step || "0"}%`;
  const edited = c ? cardEdited(c) : false;
  const shown = c && !loading ? c : null;

  const stepButton = (what: Board | "positions", keys: string[], name: string) => {
    const open = shown ? untouched(shown, keys).length > 0 : false;
    return (
      <Button
        size="sm" variant="outline" className="h-7 px-2" disabled={!stepOk || !open} onClick={() => act(edit.step(what, pct))}
        title={open ? `Step the ${name} ratings still at the card's base by ${stepText}` : `Every ${name} rating is already edited`}
      >
        {stepText} {name}
      </Button>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <CardTitle className="text-base">Model a card</CardTitle>
          {shown && <Switch checked={shown.include} onChange={(on) => act(edit.include(shown.name, on))}>Include in lineups</Switch>}
        </div>
        <CardDescription>
          Pick the base card; its ratings fill in. Type the variant&apos;s numbers over them, and step a side you can&apos;t see by
          the usual variant boost. A blank position is one it can&apos;t play.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-1 basis-72 flex-col gap-1">
            <Eyebrow>Card</Eyebrow>
            {/* Keyed by the card on the form, so an undo or a clear puts its name back. */}
            <Input
              key={c?.id ?? "none"} list="league-card-options" defaultValue={c ? labelOf.get(c.id) ?? c.name : ""} placeholder="Start typing a name…"
              onChange={(e) => { const o = byLabel.get(e.target.value); if (o) onPick(o); }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <Eyebrow>Variant step %</Eyebrow>
            <Input value={step} inputMode="decimal" onChange={(e) => setStep(e.target.value.replace(/[^0-9.]/g, "").slice(0, 4))} className="h-9 w-20 font-mono" />
          </label>
          {shown && <Button size="sm" variant="ghost" disabled={!edited} onClick={() => act(edit.baseFace(shown.name))}>Reset to base</Button>}
          {shown && (edited
            ? <ConfirmButton variant="ghost" prompt={`Clear ${shown.name} and your edits?`} onConfirm={onClear}>Clear card</ConfirmButton>
            : <Button size="sm" variant="ghost" onClick={onClear}>Clear card</Button>)}
        </div>
        {cardError && <p className="text-xs text-negative">{cardError}</p>}
        {loading && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />Loading {loading}…</p>}
        {shown?.title && <div className="text-xs text-muted-foreground">{shown.title}</div>}
        {shown && (
          <div className="space-y-3">
            {SIDES.map((side) => (
              <div key={side} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-16 text-xs font-semibold">{BOARD_NAME[side]}</span>
                  {stepButton(side, sideKeys(side), BOARD_NAME[side])}
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  {BAT_STATS.map(([k, name]) => {
                    const key = `${k} ${side}`;
                    return <Field key={key} label={name} value={shown.face[key] ?? ""} changed={fieldChanged(shown, key)} onChange={(v) => act(edit.face(key, v))} onBlur={seal} />;
                  })}
                </div>
              </div>
            ))}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-16 text-xs font-semibold">Glove</span>
                {stepButton("positions", POSITION_KEYS, "positions")}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                {POSITIONS.map((p) => {
                  const key = `POS ${p}`;
                  return <Field key={key} label={p} value={shown.face[key] ?? ""} changed={fieldChanged(shown, key)} onChange={(v) => act(edit.face(key, v))} onBlur={seal} />;
                })}
              </div>
            </div>
          </div>
        )}
        {shown && <CardResult c={shown} result={result} pending={pending} stale={stale} />}
      </CardContent>
    </Card>
  );
}
