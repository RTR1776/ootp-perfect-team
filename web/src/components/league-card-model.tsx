"use client";

/**
 * /league-card form: pick a card, type the numbers off its face (a variant in
 * the shop, say), and see what it adds to the league lineups. Scoring is
 * server side (/api/league-card), on the same model as `pnpm league:compare`.
 */

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Family = "PEL" | "HD" | "LD";
type Board = "vR" | "vL";
interface Slot { slot: string; id: number; label: string; runs: number }
interface Lineup { lineup: Slot[]; total: number }
interface Result {
  family: Family; year: number; lhp: number; rpw: number; defScale: number;
  roster: { source: string; names: string[] };
  candidate: { label: string; title: string; vR: number | null; vL: number | null };
  now: Record<Board, Lineup | null>;
  with: Record<Board, Lineup | null>;
  add: { dR: number; dL: number; season: number; wins: number; dhOnly: number };
  warnings: string[];
}

const SIDES: Array<[Board | "vL", string]> = [["vL", "vs LHP"], ["vR", "vs RHP"]];
const STATS: Array<[string, string]> = [["EYE", "Eye"], ["POW", "Power"], ["GAP", "Gap"], ["BA", "BABIP"], ["K", "Avoid K"]];
const POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
const f1 = (n: number | null | undefined) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}`);
const tone = (n: number | null | undefined) => (n == null ? "" : n > 0.05 ? "text-positive" : n < -0.05 ? "text-negative" : "");
const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className="h-9 rounded-md border border-border bg-background px-2 text-sm" />
);

function Field({ label, value, onChange, changed }: { label: string; value: string; onChange: (v: string) => void; changed: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <Input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
        className={cn("h-8 w-[4.5rem] px-2 font-mono", changed && "border-primary text-primary")}
      />
    </label>
  );
}

function LineupTable({ title, now, next }: { title: string; now: Lineup | null; next: Lineup | null }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-semibold">{title}</span>
        <span className="font-mono text-muted-foreground">
          {f1(now?.total)} → <span className={tone((next?.total ?? 0) - (now?.total ?? 0))}>{f1(next?.total)}</span>
        </span>
      </div>
      <table className="w-full text-xs">
        <tbody>
          {(next?.lineup ?? now?.lineup ?? []).map((s, i) => {
            const before = now?.lineup[i];
            const moved = before && before.label !== s.label;
            return (
              <tr key={s.slot} className="border-b border-border/50">
                <td className="w-9 py-1 font-mono text-muted-foreground">{s.slot}</td>
                <td className={cn("py-1", moved && "font-medium text-primary")}>
                  {s.label}
                  {moved && <span className="ml-1 text-muted-foreground">(was {before!.label})</span>}
                </td>
                <td className={cn("py-1 text-right font-mono", tone(s.runs))}>{f1(s.runs)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function LeagueCardModel({ cards, roster, rosterSource, defaultFamily }: {
  cards: Array<{ id: number; label: string }>;
  roster: string[];
  rosterSource: string | null;
  defaultFamily: Family;
}) {
  const byLabel = useMemo(() => new Map(cards.map((c) => [c.label, c])), [cards]);
  const [query, setQuery] = useState("");
  const [card, setCard] = useState<{ id: number; label: string; title?: string } | null>(null);
  const [base, setBase] = useState<Record<string, number> | null>(null);
  const [face, setFace] = useState<Record<string, string>>({});
  const [family, setFamily] = useState<Family>(defaultFamily);
  const [year, setYear] = useState("2010");
  const [glove, setGlove] = useState("1");
  const [step, setStep] = useState("7.5");
  const initialRoster = roster.join(", ");
  const [rosterText, setRosterText] = useState(initialRoster);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const fill = (vals: Record<string, number>, k = 1) =>
    setFace(Object.fromEntries(Object.entries(vals).map(([key, v]) => [key, v > 0 ? String(Math.round(v * k)) : ""])));

  const pick = async (label: string) => {
    setQuery(label);
    const c = byLabel.get(label);
    if (!c) return;
    setCard(c); setResult(null); setError(null);
    const r = await fetch(`/api/league-card?card=${c.id}`);
    const j = (await r.json().catch(() => ({}))) as { face?: Record<string, number>; title?: string; error?: string };
    if (!r.ok || !j.face) { setError(j.error ?? "Could not load the card."); return; }
    setCard({ ...c, title: j.title });
    setBase(j.face);
    fill(j.face);
  };

  const score = async () => {
    if (!card) return;
    setBusy(true); setError(null);
    const ratings: Record<string, number> = {};
    for (const [k, v] of Object.entries(face)) ratings[k] = v === "" ? 0 : Number(v);
    try {
      const r = await fetch("/api/league-card", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cardId: card.id, ratings, family, year: Number(year), defScale: Number(glove),
          // Left untouched, the server reads the team from the newest league export itself.
          roster: rosterText === initialRoster ? undefined : rosterText.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as Result & { error?: string };
      if (!r.ok) { setError(j.error ?? "Scoring failed."); setResult(null); }
      else setResult(j);
    } catch (e) {
      setError(`Could not reach the server: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const changed = (key: string) => base != null && (face[key] ?? "") !== (base[key] > 0 ? String(base[key]) : "");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">The card</CardTitle>
          <CardDescription>
            Pick the base card; its ratings fill in. Type over them with the numbers on the variant&apos;s face.
            A side you do not know can take the typical variant step (about +7.5%). A blank position is one it cannot play.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[18rem] flex-1 flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Card</span>
              <Input list="league-card-options" value={query} placeholder="Start typing a name…" onChange={(e) => void pick(e.target.value)} />
              <datalist id="league-card-options">
                {cards.map((c) => <option key={c.id} value={c.label} />)}
              </datalist>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Variant step %</span>
              <Input value={step} onChange={(e) => setStep(e.target.value.replace(/[^0-9.]/g, ""))} className="h-9 w-20 font-mono" />
            </label>
            <Button variant="outline" disabled={!base} onClick={() => base && fill(base, 1 + Number(step || 0) / 100)}>Apply step to all</Button>
            <Button variant="ghost" disabled={!base} onClick={() => base && fill(base)}>Reset to base</Button>
          </div>
          {card?.title && <div className="text-xs text-muted-foreground">{card.title}</div>}

          {base && (
            <div className="space-y-3">
              {SIDES.map(([side, label]) => (
                <div key={side} className="flex flex-wrap items-end gap-2">
                  <span className="w-16 pb-2 text-xs font-semibold">{label}</span>
                  {STATS.map(([k, name]) => (
                    <Field key={k} label={name} value={face[`${k} ${side}`] ?? ""} changed={changed(`${k} ${side}`)}
                      onChange={(v) => setFace((f) => ({ ...f, [`${k} ${side}`]: v }))} />
                  ))}
                </div>
              ))}
              <div className="flex flex-wrap items-end gap-2">
                <span className="w-16 pb-2 text-xs font-semibold">Glove</span>
                {POSITIONS.map((p) => (
                  <Field key={p} label={p} value={face[`POS ${p}`] ?? ""} changed={changed(`POS ${p}`)}
                    onChange={(v) => setFace((f) => ({ ...f, [`POS ${p}`]: v }))} />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">League</span>
              <Select value={family} onChange={(e) => setFamily(e.target.value as Family)}>
                <option value="PEL">PEL</option><option value="HD">HD</option><option value="LD">LD</option>
              </Select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Run environment</span>
              <Input value={year} onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} className="h-9 w-24 font-mono" title="2010 is the PT default; a theme week's year when one is announced" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Glove weight</span>
              <Select value={glove} onChange={(e) => setGlove(e.target.value)}>
                <option value="1">Full</option><option value="0.5">Half</option><option value="0">Bat only</option>
              </Select>
            </label>
            <Button onClick={() => void score()} disabled={!card || busy}>
              {busy ? <><Loader2 className="animate-spin" /> Scoring…</> : "Score it"}
            </Button>
          </div>

          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              Team hitters ({rosterText.split(/[,\n]/).filter((s) => s.trim()).length}) — {rosterSource ? `from ${rosterSource}` : "none on file"}; edit to try a different team
            </summary>
            <textarea
              value={rosterText}
              onChange={(e) => setRosterText(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
            />
          </details>
          {error && <div className="rounded-md border border-negative/30 bg-negative/5 px-3 py-2 text-xs text-negative">{error}</div>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {result.candidate.label}: <span className={tone(result.add.season)}>{f1(result.add.season)} runs a season</span>
              <span className="ml-2 font-normal text-muted-foreground">({f1(result.add.wins)} W)</span>
            </CardTitle>
            <CardDescription>
              As a bat, runs per 700 PA above the {result.family} average: vs RHP <span className={cn("font-mono", tone(result.candidate.vR))}>{f1(result.candidate.vR)}</span>,
              vs LHP <span className={cn("font-mono", tone(result.candidate.vL))}>{f1(result.candidate.vL)}</span>.
              In your lineups it adds <span className="font-mono">{f1(result.add.dR)}</span> vs RHP and <span className="font-mono">{f1(result.add.dL)}</span> vs LHP
              (boards weighted {Math.round((1 - result.lhp) * 100)}/{Math.round(result.lhp * 100)}; {result.rpw.toFixed(1)} runs a win).
              Straight into the DH slot with nothing else moving it would add <span className="font-mono">{f1(result.add.dhOnly)}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              <LineupTable title="vs RHP — now → with the card" now={result.now.vR} next={result.with.vR} />
              <LineupTable title="vs LHP — now → with the card" now={result.now.vL} next={result.with.vL} />
            </div>
            {result.warnings.length > 0 && (
              <ul className="space-y-0.5 text-[11px] text-warning">
                {result.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )}
            <div className="text-[11px] text-muted-foreground">
              {`Team: ${result.roster.source}. Run environment ${result.year === 2010 ? "PT default (2010)" : result.year}. Gloves at ${result.defScale === 1 ? "full" : result.defScale === 0.5 ? "half" : result.defScale === 0 ? "zero" : `×${result.defScale}`} weight. `}
              The league&apos;s outfield defence looked closer to half its tournament value in a rough check, so try Half for an outfield glove.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
