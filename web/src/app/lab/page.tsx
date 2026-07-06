"use client";

// Card Lab: paste rows from any OOTP export (header + card rows, CSV or TSV)
// and get instant v2-engine projections, a parity check against the stored
// dataset (when the CID already exists), and the lineup run-delta of adding
// the card to the active 26.

import * as React from "react";
import { useDataStore } from "@/lib/data";
import { loadCurves, parsePaste, projectParsed, type ParsedRow } from "@/lib/project";
import { compareLineups, type Hand } from "@/lib/optimizer";
import { loadParks, findPark, HOME_PARK_LABEL, NEUTRAL_PARK, type Park } from "@/lib/parks";
import { blendedWoba, blendedFip, isPitcher, cardWAR, type Card as CardType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TierBadge } from "@/components/tier-badge";
import { fmtRate } from "@/lib/utils";

interface TeamFile {
  activeCids: number[];
  variantCids: number[];
}

interface LabResult {
  card: CardType;
  parity: { stored: number; computed: number; metric: string } | null;
  deltaVsR: number | null;
  deltaVsL: number | null;
  displaces: string | null;
}

export default function LabPage() {
  const status = useDataStore((s) => s.status);
  const load = useDataStore((s) => s.load);
  const cards = useDataStore((s) => s.cards);

  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<LabResult[]>([]);
  const [team, setTeam] = React.useState<TeamFile | null>(null);
  const [park, setPark] = React.useState<Park>(NEUTRAL_PARK);

  React.useEffect(() => {
    load();
    fetch("/data/team.json").then((r) => r.json()).then(setTeam).catch(() => setTeam(null));
    loadParks()
      .then((ps) => setPark(findPark(HOME_PARK_LABEL, ps) ?? NEUTRAL_PARK))
      .catch(() => setPark(NEUTRAL_PARK));
  }, [load]);

  const run = React.useCallback(async () => {
    setError(null);
    try {
      const curves = await loadCurves();
      const rows: ParsedRow[] = parsePaste(text);
      const byCid = new Map(cards.map((c) => [c.cid, c]));
      const active = team
        ? (team.activeCids.map((id) => byCid.get(id)).filter(Boolean) as CardType[])
        : [];

      const out: LabResult[] = rows.slice(0, 20).map((row, i) => {
        const card = projectParsed(curves, row, -(i + 1));

        // parity: same CID already projected by the Python engine?
        let parity: LabResult["parity"] = null;
        const stored = card.cid > 0 ? byCid.get(card.cid) : undefined;
        if (stored) {
          if (!isPitcher(card) && stored.hitter_overall && card.hitter_overall) {
            parity = { metric: "wOBA", stored: stored.hitter_overall.wOBA, computed: card.hitter_overall.wOBA };
          } else if (isPitcher(card) && stored.pitcher_overall && card.pitcher_overall) {
            parity = { metric: "FIP", stored: stored.pitcher_overall.FIP, computed: card.pitcher_overall.FIP };
          }
        }

        // lineup impact: add the hypothetical to the active pool
        let deltaVsR: number | null = null;
        let deltaVsL: number | null = null;
        let displaces: string | null = null;
        if (active.length >= 9 && !isPitcher(card)) {
          const runFor = (hand: Hand) =>
            compareLineups(active, [...active, card], hand, park);
          const r = runFor("R");
          const l = runFor("L");
          deltaVsR = r.runsGained;
          deltaVsL = l.runsGained;
          const up = r.upgrades.find((u) => u.in.cid === card.cid);
          displaces = up ? `${up.out.name} (${up.position})` : null;
        }
        return { card, parity, deltaVsR, deltaVsL, displaces };
      });
      setResults(out);
    } catch (e) {
      setResults([]);
      setError(e instanceof Error ? e.message : "Parse failed");
    }
  }, [text, cards, team, park]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Card Lab</h1>
        <p className="text-sm text-muted-foreground">
          Paste the header row + card row(s) from any OOTP export (stats export,
          ratings CSV, or collection export). Projections use the same fitted
          curves as the Python engine; lineup impact is vs your active 26 in{" "}
          {park.label}.
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        placeholder={"POS,Name,First Name,Last Name,ORG,…\nSP,Trey Yesavage,Trey,…"}
        className="h-40 w-full rounded-md border border-border bg-card/50 p-3 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="flex items-center gap-3">
        <Button onClick={run} disabled={status !== "ready" || !text.trim()}>
          Project cards
        </Button>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {results.map((r) => (
          <LabCard key={r.card.cid + r.card.name} r={r} />
        ))}
      </div>
    </div>
  );
}

function LabCard({ r }: { r: LabResult }) {
  const c = r.card;
  const pit = isPitcher(c);
  const parityOk = r.parity && Math.abs(r.parity.stored - r.parity.computed) <= (pit ? 0.05 : 0.002);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {c.name}
          <span className="text-xs font-normal text-muted-foreground">
            {c.pos} · {c.bats}/{c.throws}
          </span>
          <TierBadge tier={c.tier} />
        </CardTitle>
        {r.parity && (
          <Badge variant={parityOk ? "secondary" : "outline"}>
            {parityOk ? "matches engine" : `Δ${r.parity.metric} ${(r.parity.computed - r.parity.stored).toFixed(3)}`}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!pit && c.hitter_overall && (
          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat label="wOBA" value={fmtRate(c.hitter_overall.wOBA)} />
            <Stat label="vL / vR" value={`${fmtRate(blendedWoba(c, "L") ?? 0)} / ${fmtRate(blendedWoba(c, "R") ?? 0)}`} />
            <Stat label="OPS" value={fmtRate(c.hitter_overall.OPS)} />
            <Stat label="WAR/600" value={String(cardWAR(c))} />
          </div>
        )}
        {pit && c.pitcher_overall && (
          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat label="FIP" value={c.pitcher_overall.FIP.toFixed(2)} />
            <Stat label="vL / vR" value={`${(blendedFip(c, "L") ?? 0).toFixed(2)} / ${(blendedFip(c, "R") ?? 0).toFixed(2)}`} />
            <Stat label="K/9" value={c.pitcher_overall["K/9"].toFixed(1)} />
            <Stat label="WAR/180" value={String(cardWAR(c))} />
          </div>
        )}
        {!pit && (r.deltaVsR !== null || r.deltaVsL !== null) && (
          <div className="rounded-md border border-border bg-accent/30 px-3 py-2 text-xs">
            <span className="font-medium">Lineup impact:</span>{" "}
            {r.deltaVsR !== null && <>vs RHP {r.deltaVsR >= 0 ? "+" : ""}{r.deltaVsR.toFixed(2)} r/g · </>}
            {r.deltaVsL !== null && <>vs LHP {r.deltaVsL >= 0 ? "+" : ""}{r.deltaVsL.toFixed(2)} r/g</>}
            {r.displaces && <> · displaces {r.displaces}</>}
            {r.deltaVsR !== null && r.deltaVsR <= 0 && r.deltaVsL !== null && r.deltaVsL <= 0 && (
              <> — doesn&apos;t crack the current 9</>
            )}
          </div>
        )}
        {c.defense && c.defense.positions.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Defense:{" "}
            {c.defense.positions
              .map((p) => `${p.pos} ${p.def_runs_per_162 >= 0 ? "+" : ""}${p.def_runs_per_162}`)
              .join(" · ")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card/60 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}
