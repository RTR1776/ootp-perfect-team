"use client";

/**
 * From your collection: every owned card off the team, scored as an addition
 * to it (POST /api/league-card/scan), so a new card shows what it is worth in
 * the league and goes on the team in one click. L.J., 2026-10-05: "when I get
 * new cards use optimize? Can you do the same for league?"
 *
 * The scan is for the team as it was when it ran; after any change the list
 * dims until it is run again. Cards already added drop out of it.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signed } from "@/lib/format";
import { cn } from "@/lib/utils";
import { edit, type ModelAction, type ModelState, type ScoreBody } from "@/lib/league-card-state";

interface ScanBat { entry: string; label: string; season: number; vR: string | null; vL: string | null; sitsR: string[]; sitsL: string[] }
interface ScanArm { entry: string; label: string; season: number; slot: string | null; replaces: string[]; sits: string[] }
interface Scan { minValue: number; collectionOn: string | null; park: string | null; scanned: { bats: number; arms: number }; bats: ScanBat[]; arms: ScanArm[] }

const short = (label: string) => label.replace(/ \d+( VAR)?$/, "$1");

function batWhere(b: ScanBat): string {
  const side = (name: string, slot: string | null, sits: string[]) =>
    slot ? `${name} ${slot}${sits.length ? ` (${sits.map(short).join(", ")} sits)` : ""}` : null;
  return [side("vs RHP", b.vR, b.sitsR), side("vs LHP", b.vL, b.sitsL)].filter(Boolean).join(" · ") || "bench";
}

export function CollectionPanel({ state, body, act }: {
  state: ModelState;
  /** The team's score request; null while the page can't score it. */
  body: ScoreBody | null;
  act: (a: ModelAction) => void;
}) {
  const [scan, setScan] = useState<{ key: string; data: Scan } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = body && JSON.stringify({ roster: body.roster, arms: body.arms, locks: body.locks, armLocks: body.armLocks, park: body.park, family: body.family, year: body.year, defScale: body.defScale });
  const stale = !!scan && scan.key !== request;

  const run = async () => {
    if (!request) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/league-card/scan", { method: "POST", headers: { "content-type": "application/json" }, body: request });
      const j = (await r.json().catch(() => ({}))) as Scan & { error?: string };
      if (!r.ok) setError(j.error ?? `Scan failed (HTTP ${r.status}).`);
      else setScan({ key: request, data: j });
    } catch (e) {
      setError(`Could not reach the server: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const onTeam = new Set([...state.bats, ...state.arms]);
  const bats = scan?.data.bats.filter((b) => !onTeam.has(b.entry)) ?? [];
  const arms = scan?.data.arms.filter((a) => !onTeam.has(a.entry)) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">From your collection</CardTitle>
        <CardDescription>
          {`Every card you own (value ${scan?.data.minValue ?? 90} and up) that isn't on the team,`} scored as an addition to it: bats against the lineups, arms against the staff, at this park and run environment. Run it after a collection upload.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => void run()} disabled={!request || busy}>{busy ? "Scanning…" : scan ? "Scan again" : "Scan my collection"}</Button>
          {scan && (
            <span className="text-xs text-muted-foreground">
              {`${scan.data.scanned.bats} bats and ${scan.data.scanned.arms} arms scanned from the collection of ${scan.data.collectionOn ?? "—"}${scan.data.park ? ` in ${scan.data.park}` : ""}.`}
              {stale && <span className="text-warning"> The team changed since; scan again for these numbers.</span>}
            </span>
          )}
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
        {scan && (
          <div className={cn("grid gap-4 md:grid-cols-2", stale && "opacity-60")}>
            <section aria-label="Bats" className="min-w-0 space-y-1">
              <h3 className="text-xs font-semibold">Bats that would start</h3>
              {bats.length ? (
                <ul className="space-y-1 text-xs">
                  {bats.map((b) => (
                    <li key={b.entry} className="flex items-start justify-between gap-2">
                      <span className="min-w-0"><span className="font-medium">{b.label}</span> <span className="tabular-nums">{signed(b.season)} runs</span><br /><span className="text-muted-foreground">{batWhere(b)}</span></span>
                      <Button size="sm" variant="outline" onClick={() => act(edit.add(b.entry))}>Add</Button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-muted-foreground">None of your other bats would start.</p>}
            </section>
            <section aria-label="Arms" className="min-w-0 space-y-1">
              <h3 className="text-xs font-semibold">Arms that would pitch</h3>
              {arms.length ? (
                <ul className="space-y-1 text-xs">
                  {arms.map((a) => (
                    <li key={a.entry} className="flex items-start justify-between gap-2">
                      <span className="min-w-0"><span className="font-medium">{a.label}</span> <span className="tabular-nums">{signed(a.season)} runs</span><br />
                        <span className="text-muted-foreground">{[a.slot, a.replaces.length ? `${a.replaces.map(short).join(", ")} out of the rotation` : "", a.sits.length ? `${a.sits.map(short).join(", ")} sits` : ""].filter(Boolean).join(" · ")}</span></span>
                      <Button size="sm" variant="outline" onClick={() => act(edit.addArm(a.entry))}>Add</Button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-muted-foreground">None of your other arms would make the staff better.</p>}
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
