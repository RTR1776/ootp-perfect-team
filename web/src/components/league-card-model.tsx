"use client";

/**
 * /league-card: L.J.'s league lineups on the league model, built from a team
 * list he keeps current, with slots he can lock, a home park to try, and an
 * optional card typed off its face to see what it adds. Scoring is server side
 * (/api/league-card), on the same model as `pnpm league:compare`. The team,
 * locks and settings are remembered in this browser (localStorage).
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Loader2, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Family = "PEL" | "HD" | "LD";
type Board = "vR" | "vL";
interface Slot { slot: string; id: number; label: string; runs: number }
interface Lineup { lineup: Slot[]; total: number }
interface Result {
  family: Family; year: number; lhp: number; rpw: number; defScale: number; park: string | null;
  /** With a park: the same locks' best nine in a neutral park. */
  neutral: Record<Board, number | null> | null;
  roster: { source: string; entries: string[] };
  pool: Array<{ entry: string; label: string; vR: number | null; vL: number | null }>;
  now: Record<Board, Lineup | null>;
  candidate: { label: string; title: string; vR: number | null; vL: number | null } | null;
  with: Record<Board, Lineup | null> | null;
  add: { dR: number; dL: number; season: number; wins: number; dhOnly: number } | null;
  warnings: string[];
}

const SLOTS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];
const SIDES: Array<[Board, string]> = [["vL", "vs LHP"], ["vR", "vs RHP"]];
const STATS: Array<[string, string]> = [["EYE", "Eye"], ["POW", "Power"], ["GAP", "Gap"], ["BA", "BABIP"], ["K", "Avoid K"]];
const POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
const STORE = "league-card:v2";
const f1 = (n: number | null | undefined) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}`);
const tone = (n: number | null | undefined) => (n == null ? "" : n > 0.05 ? "text-positive" : n < -0.05 ? "text-negative" : "");
const nameOf = (entry: string) => entry.replace(/\s*#\d+\s*$/, "");
const Select = ({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={cn("h-9 rounded-md border border-border bg-background px-2 text-sm", className)} />
);
const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{children}</span>
);

function Field({ label, value, onChange, changed }: { label: string; value: string; onChange: (v: string) => void; changed: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <Eyebrow>{label}</Eyebrow>
      <Input inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
        className={cn("h-8 w-[4.5rem] px-2 font-mono", changed && "border-primary text-primary")} />
    </label>
  );
}

function Board({ title, board, pool, locks, setLock, now, next }: {
  title: string; board: Board; pool: string[]; locks: Record<string, string>; setLock: (slot: string, entry: string) => void;
  now: Lineup | null | undefined; next: Lineup | null | undefined;
}) {
  const at = (l: Lineup | null | undefined, slot: string) => l?.lineup.find((x) => x.slot === slot);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-semibold">{title}</span>
        <span className="font-mono text-muted-foreground">
          {f1(now?.total)}{next && <> → <span className={tone((next.total ?? 0) - (now?.total ?? 0))}>{f1(next.total)}</span></>}
        </span>
      </div>
      <table className="w-full text-xs">
        <tbody>
          {SLOTS.map((slot) => {
            const a = at(now, slot), b = at(next, slot);
            const moved = next && a && b && a.label !== b.label;
            return (
              <tr key={slot} className="border-b border-border/50 align-middle">
                <td className="w-8 py-1 font-mono text-muted-foreground">{slot}</td>
                <td className="w-40 py-1 pr-2">
                  <Select value={locks[slot] ?? ""} onChange={(e) => setLock(slot, e.target.value)} className="h-7 w-full text-xs" aria-label={`${board} ${slot}`}>
                    <option value="">Best available</option>
                    {pool.map((e) => <option key={e} value={e}>{nameOf(e)}</option>)}
                  </Select>
                </td>
                <td className={cn("py-1", moved && "font-medium text-primary")}>
                  {locks[slot] && <Lock className="mr-1 inline size-3 text-muted-foreground" />}
                  {(b ?? a)?.label ?? <span className="text-muted-foreground">—</span>}
                  {moved && <span className="ml-1 text-muted-foreground">(was {a!.label})</span>}
                </td>
                <td className={cn("w-14 py-1 text-right font-mono", tone((b ?? a)?.runs))}>{f1((b ?? a)?.runs)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface Props {
  cards: Array<{ id: number; name: string; label: string }>;
  parks: string[];
  roster: string[];
  rosterSource: string | null;
  defaultFamily: Family;
}
interface Stored { pool?: string[]; locks?: Record<Board, Record<string, string>>; family?: Family; year?: string; park?: string; glove?: string }

/* Rendered in the browser only: the team, locks and settings come from this
   browser's storage, which the server cannot see, so the server sends a
   placeholder instead of markup that would not match. */
const noSubscribe = () => () => {};
export function LeagueCardModel(props: Props) {
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  return inBrowser ? <LeagueCardModelInner {...props} /> : <div className="text-sm text-muted-foreground">Loading your team…</div>;
}

const readStore = (): Stored => {
  try { return (JSON.parse(localStorage.getItem(STORE) ?? "null") ?? {}) as Stored; } catch { return {}; }
};

function LeagueCardModelInner({ cards, parks, roster, rosterSource, defaultFamily }: Props) {
  const byLabel = useMemo(() => new Map(cards.map((c) => [c.label, c])), [cards]);
  const [stored] = useState(readStore);
  const [pool, setPool] = useState<string[]>(() => (Array.isArray(stored.pool) && stored.pool.length ? stored.pool : roster));
  const [locks, setLocks] = useState<Record<Board, Record<string, string>>>(() => (stored.locks?.vR && stored.locks?.vL ? stored.locks : { vR: {}, vL: {} }));
  const [family, setFamily] = useState<Family>(() => (stored.family && ["PEL", "HD", "LD"].includes(stored.family) ? stored.family : defaultFamily));
  const [year, setYear] = useState(() => (typeof stored.year === "string" ? stored.year : "2010"));
  const [park, setPark] = useState(() => (typeof stored.park === "string" ? stored.park : ""));
  const [glove, setGlove] = useState(() => (typeof stored.glove === "string" ? stored.glove : "1"));
  const [addQuery, setAddQuery] = useState("");

  // the modelled card (optional)
  const [query, setQuery] = useState("");
  const [card, setCard] = useState<{ id: number; label: string; title?: string } | null>(null);
  const [base, setBase] = useState<Record<string, number> | null>(null);
  const [face, setFace] = useState<Record<string, string>>({});
  const [step, setStep] = useState("7.5");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  // remembered in this browser; a blocked store just means nothing is kept
  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify({ pool, locks, family, year, park, glove })); } catch { /* not persisted */ }
  }, [pool, locks, family, year, park, glove]);

  const fill = (vals: Record<string, number>, k = 1) =>
    setFace(Object.fromEntries(Object.entries(vals).map(([key, v]) => [key, v > 0 ? String(Math.round(v * k)) : ""])));

  const pickCard = async (label: string) => {
    setQuery(label);
    const c = byLabel.get(label);
    if (!c) return;
    setCard(c); setError(null);
    const r = await fetch(`/api/league-card?card=${c.id}`);
    const j = (await r.json().catch(() => ({}))) as { face?: Record<string, number>; title?: string; error?: string };
    if (!r.ok || !j.face) { setError(j.error ?? "Could not load the card."); return; }
    setCard({ ...c, title: j.title });
    setBase(j.face);
    fill(j.face);
  };

  const addPlayer = (label: string) => {
    setAddQuery(label);
    const c = byLabel.get(label);
    if (!c) return;
    const entry = `${c.name}#${c.id}`;
    setPool((p) => (p.includes(entry) ? p : [...p, entry]));
    setAddQuery("");
  };
  const removePlayer = (entry: string) => {
    setPool((p) => p.filter((x) => x !== entry));
    setLocks((l) => ({
      vR: Object.fromEntries(Object.entries(l.vR).filter(([, e]) => e !== entry)),
      vL: Object.fromEntries(Object.entries(l.vL).filter(([, e]) => e !== entry)),
    }));
  };
  const setLock = (board: Board) => (slot: string, entry: string) =>
    setLocks((l) => {
      const next = Object.fromEntries(Object.entries(l[board]).filter(([s, e]) => s !== slot && e !== entry));
      if (entry) next[slot] = entry;
      return { ...l, [board]: next };
    });

  const score = useCallback(async (withCard: boolean) => {
    setBusy(true); setError(null);
    const ratings: Record<string, number> = {};
    for (const [k, v] of Object.entries(face)) ratings[k] = v === "" ? 0 : Number(v);
    try {
      const r = await fetch("/api/league-card", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roster: pool, locks, park: park.trim() || null, family, year: Number(year), defScale: Number(glove),
          ...(withCard && card ? { cardId: card.id, ratings } : {}),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as Result & { error?: string };
      if (!r.ok) setError(j.error ?? "Scoring failed.");
      else setResult(j);
    } catch (e) {
      setError(`Could not reach the server: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [face, pool, locks, park, family, year, glove, card]);

  // the lineups as they stand, on arrival
  const first = useRef(true);
  useEffect(() => {
    if (!first.current || !pool.length) return;
    first.current = false;
    void score(false);
  }, [pool, score]);

  const changed = (key: string) => base != null && (face[key] ?? "") !== (base[key] > 0 ? String(base[key]) : "");
  const runsByEntry = new Map((result?.pool ?? []).map((p) => [p.entry, p]));
  const lockCount = Object.keys(locks.vR).length + Object.keys(locks.vL).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your team&apos;s hitters ({pool.length})</CardTitle>
          <CardDescription>
            Started from {rosterSource ?? "no league export"} — the export lists everyone who batted for you that week, so
            take off anyone you have since dropped and add anyone new. Remembered in this browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {pool.map((e) => {
              const r = runsByEntry.get(e);
              return (
                <span key={e} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs">
                  <span>{r?.label ?? nameOf(e)}</span>
                  {r && <span className="font-mono text-muted-foreground">R <span className={tone(r.vR)}>{f1(r.vR)}</span> · L <span className={tone(r.vL)}>{f1(r.vL)}</span></span>}
                  <button onClick={() => removePlayer(e)} aria-label={`Remove ${nameOf(e)}`} className="text-muted-foreground hover:text-negative"><X className="size-3" /></button>
                </span>
              );
            })}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[18rem] flex-1 flex-col gap-1">
              <Eyebrow>Add a hitter (yours, or a shop card to try)</Eyebrow>
              <Input list="league-card-options" value={addQuery} placeholder="Start typing a name…" onChange={(e) => addPlayer(e.target.value)} />
            </label>
            <Button variant="ghost" onClick={() => { setPool(roster); setLocks({ vR: {}, vL: {} }); }}>Reset to the export</Button>
            {lockCount > 0 && <Button variant="ghost" onClick={() => setLocks({ vR: {}, vL: {} })}>Clear {lockCount} lock{lockCount === 1 ? "" : "s"}</Button>}
          </div>
          <datalist id="league-card-options">
            {cards.map((c) => <option key={c.id} value={c.label} />)}
          </datalist>
          <datalist id="league-card-parks">
            {parks.map((p) => <option key={p} value={p} />)}
          </datalist>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lineups</CardTitle>
          <CardDescription>
            The best nine per board around anything you lock. Set a slot to a player to lock him there (he plays it even below
            your position floor), leave it on Best available to let the solver fill it. Runs are per 700 PA above the league&apos;s
            average bat, glove included.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <Eyebrow>League</Eyebrow>
              <Select value={family} onChange={(e) => setFamily(e.target.value as Family)}>
                <option value="PEL">PEL</option><option value="HD">HD</option><option value="LD">LD</option>
              </Select>
            </label>
            <label className="flex flex-col gap-1">
              <Eyebrow>Run environment</Eyebrow>
              <Input value={year} onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} className="h-9 w-24 font-mono" title="2010 is the PT default; a theme week's year when one is announced" />
            </label>
            <label className="flex min-w-[15rem] flex-col gap-1">
              <Eyebrow>Home park (blank = neutral)</Eyebrow>
              <Input list="league-card-parks" value={park} placeholder="e.g. 1945 Fenway Park" onChange={(e) => setPark(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <Eyebrow>Glove weight</Eyebrow>
              <Select value={glove} onChange={(e) => setGlove(e.target.value)}>
                <option value="1">Full</option><option value="0.5">Half</option><option value="0">Bat only</option>
              </Select>
            </label>
            <Button onClick={() => void score(false)} disabled={busy || !pool.length}>
              {busy ? <><Loader2 className="animate-spin" /> Scoring…</> : "Score lineups"}
            </Button>
          </div>
          {error && <div className="rounded-md border border-negative/30 bg-negative/5 px-3 py-2 text-xs text-negative">{error}</div>}
          <div className="grid gap-6 md:grid-cols-2">
            <Board title="vs RHP" board="vR" pool={pool} locks={locks.vR} setLock={setLock("vR")} now={result?.now.vR} next={result?.with?.vR} />
            <Board title="vs LHP" board="vL" pool={pool} locks={locks.vL} setLock={setLock("vL")} now={result?.now.vL} next={result?.with?.vL} />
          </div>
          {result && (
            <div className="text-[11px] text-muted-foreground">
              {`${result.family} · run environment ${result.year === 2010 ? "PT default (2010)" : result.year} · ${result.park ? `home park ${result.park} (half weight)` : "neutral park"} · gloves ${result.defScale === 1 ? "full" : result.defScale === 0.5 ? "half" : result.defScale === 0 ? "off" : `×${result.defScale}`} · boards weighted ${Math.round((1 - result.lhp) * 100)}/${Math.round(result.lhp * 100)} · ${result.rpw.toFixed(1)} runs a win.`}
              {result.park && result.neutral && result.now.vR && result.now.vL && result.neutral.vR != null && result.neutral.vL != null && (
                <>
                  {" "}Against a neutral park the park moves these bats{" "}
                  <span className="font-mono">{f1(result.now.vR.total - result.neutral.vR)}</span> vs RHP and{" "}
                  <span className="font-mono">{f1(result.now.vL.total - result.neutral.vL)}</span> vs LHP.
                </>
              )}
              {" "}{result.park
                ? "The other team bats there too and it charges your pitchers, which this does not count, so use it to set the nine for a park; park:sweep makes the park pick."
                : "Picking a home park is park:sweep's job, which also counts your pitchers and the field."}
            </div>
          )}
          {result && result.warnings.length > 0 && (
            <ul className="space-y-0.5 text-[11px] text-warning">
              {result.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Model a card</CardTitle>
          <CardDescription>
            Pick the base card; its ratings fill in. Type over them with the numbers on the variant&apos;s face. A side you do not
            know can take the typical variant step (about +7.5%). A blank position is one it cannot play. The lineups above then
            show the team with it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[18rem] flex-1 flex-col gap-1">
              <Eyebrow>Card</Eyebrow>
              <Input list="league-card-options" value={query} placeholder="Start typing a name…" onChange={(e) => void pickCard(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <Eyebrow>Variant step %</Eyebrow>
              <Input value={step} onChange={(e) => setStep(e.target.value.replace(/[^0-9.]/g, ""))} className="h-9 w-20 font-mono" />
            </label>
            <Button variant="outline" disabled={!base} onClick={() => base && fill(base, 1 + Number(step || 0) / 100)}>Apply step to all</Button>
            <Button variant="ghost" disabled={!base} onClick={() => base && fill(base)}>Reset to base</Button>
            {card && <Button variant="ghost" onClick={() => { setCard(null); setBase(null); setFace({}); setQuery(""); setResult((r) => (r ? { ...r, candidate: null, with: null, add: null } : r)); }}>Clear</Button>}
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
              <Button onClick={() => void score(true)} disabled={busy || !pool.length}>
                {busy ? <><Loader2 className="animate-spin" /> Scoring…</> : "Score with this card"}
              </Button>
            </div>
          )}
          {result?.candidate && result.add && (
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
              <div className="font-semibold">
                {result.candidate.label}: <span className={tone(result.add.season)}>{f1(result.add.season)} runs a season</span>
                <span className="ml-2 font-normal text-muted-foreground">({f1(result.add.wins)} W)</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                As a bat: vs RHP <span className={cn("font-mono", tone(result.candidate.vR))}>{f1(result.candidate.vR)}</span>, vs LHP{" "}
                <span className={cn("font-mono", tone(result.candidate.vL))}>{f1(result.candidate.vL)}</span>. In your lineups it adds{" "}
                <span className="font-mono">{f1(result.add.dR)}</span> vs RHP and <span className="font-mono">{f1(result.add.dL)}</span> vs LHP;
                straight into the DH slot with nothing else moving, <span className="font-mono">{f1(result.add.dhOnly)}</span>. The lineups above show where it plays.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
