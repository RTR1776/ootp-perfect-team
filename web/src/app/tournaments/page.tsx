"use client";

// Tournament meta browser (tourneys.json from `python -m engine ingest`) plus
// the projection-calibration report (calibration_report.json).

import * as React from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useDataStore } from "@/lib/data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TierBadge } from "@/components/tier-badge";
import type { Tier } from "@/lib/types";

interface TourneyCard {
  cid: number;
  name: string;
  pos: string;
  tier: Tier;
  PA: number | null;
  wOBA: number | null;
  wOBA_rel?: number;
  IP: number | null;
  FIP: number | null;
  SIERA: number | null;
}
interface TourneysFile {
  generatedAt: string;
  tourneysIngested: { type: string; id: string; file: string; rows: number }[];
  types: Record<string, {
    tourneys: string[];
    cardCount: number;
    env: { wOBA: number | null; FIP: number | null; SIERA: number | null };
    cards: TourneyCard[];
  }>;
}
interface CalReport {
  fits: Record<string, { a: number; b: number; r2: number; n: number }>;
  groups: Record<string, { fit: { r2: number; n: number }; points: { name: string; n: number; proj: number; obs: number }[] }>;
  topMovers: { name: string; pos: string; n: number; delta: number }[];
}

export default function TournamentsPage() {
  const load = useDataStore((s) => s.load);
  const cards = useDataStore((s) => s.cards);
  const [data, setData] = React.useState<TourneysFile | null>(null);
  const [cal, setCal] = React.useState<CalReport | null>(null);
  const [type, setType] = React.useState<string>("");
  const [ownedOnly, setOwnedOnly] = React.useState(false);
  const [mode, setMode] = React.useState<"hitters" | "pitchers">("hitters");

  React.useEffect(() => {
    load();
    fetch("/data/tourneys.json").then((r) => r.json()).then((d: TourneysFile) => {
      setData(d);
      setType(Object.keys(d.types)[0] ?? "");
    }).catch(() => setData(null));
    fetch("/data/calibration_report.json").then((r) => r.json()).then(setCal).catch(() => setCal(null));
  }, [load]);

  const ownedCids = React.useMemo(
    () => new Set(cards.filter((c) => c.owned).map((c) => c.cid)),
    [cards],
  );

  const rows = React.useMemo(() => {
    if (!data || !type) return [];
    const t = data.types[type];
    if (!t) return [];
    let r = t.cards.filter((c) =>
      mode === "hitters" ? (c.PA ?? 0) >= 20 : (c.IP ?? 0) >= 5,
    );
    if (ownedOnly) r = r.filter((c) => ownedCids.has(c.cid));
    return r.sort((a, b) =>
      mode === "hitters"
        ? (b.wOBA_rel ?? 0) - (a.wOBA_rel ?? 0)
        : (a.SIERA ?? a.FIP ?? 99) - (b.SIERA ?? b.FIP ?? 99),
    ).slice(0, 100);
  }, [data, type, mode, ownedOnly, ownedCids]);

  if (!data) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Loading tournament data… (run `python -m engine ingest` after each tourney)
      </div>
    );
  }

  const env = data.types[type]?.env;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Tournaments</h1>
        <p className="text-sm text-muted-foreground">
          Observed results per tourney type — {data.tourneysIngested.length} exports ingested.
        </p>
      </div>

      <Tabs defaultValue="meta">
        <TabsList>
          <TabsTrigger value="meta">Tourney meta</TabsTrigger>
          <TabsTrigger value="calibration">Calibration</TabsTrigger>
        </TabsList>

        <TabsContent value="meta" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            >
              {Object.keys(data.types).map((t) => (
                <option key={t} value={t}>
                  {t} ({data.types[t].tourneys.length} tourney{data.types[t].tourneys.length > 1 ? "s" : ""})
                </option>
              ))}
            </select>
            <div className="flex gap-1">
              {(["hitters", "pitchers"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-md px-2.5 py-1 text-xs ${mode === m ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent"}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={ownedOnly} onChange={(e) => setOwnedOnly(e.target.checked)} />
              my cards only
            </label>
            {env && (
              <Badge variant="outline" className="ml-auto font-mono text-[11px]">
                env wOBA {env.wOBA ?? "–"} · FIP {env.FIP ?? "–"} · SIERA {env.SIERA ?? "–"}
              </Badge>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-card/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Card</th>
                  <th className="px-3 py-2">Pos</th>
                  <th className="px-3 py-2">Tier</th>
                  {mode === "hitters" ? (
                    <>
                      <th className="px-3 py-2 text-right">PA</th>
                      <th className="px-3 py-2 text-right">wOBA</th>
                      <th className="px-3 py-2 text-right">vs env</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2 text-right">IP</th>
                      <th className="px-3 py-2 text-right">FIP</th>
                      <th className="px-3 py-2 text-right">SIERA</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.cid} className="border-t border-border/60 hover:bg-accent/30">
                    <td className="px-3 py-1.5">
                      {c.name}
                      {ownedCids.has(c.cid) && (
                        <span className="ml-2 text-[10px] text-primary">owned</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{c.pos}</td>
                    <td className="px-3 py-1.5"><TierBadge tier={c.tier} /></td>
                    {mode === "hitters" ? (
                      <>
                        <td className="px-3 py-1.5 text-right font-mono">{c.PA ?? "–"}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{c.wOBA?.toFixed(3) ?? "–"}</td>
                        <td className={`px-3 py-1.5 text-right font-mono ${(c.wOBA_rel ?? 1) >= 1.05 ? "text-emerald-400" : (c.wOBA_rel ?? 1) <= 0.95 ? "text-red-400" : ""}`}>
                          {c.wOBA_rel ? `${((c.wOBA_rel - 1) * 100).toFixed(0)}%` : "–"}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-1.5 text-right font-mono">{c.IP?.toFixed(0) ?? "–"}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{c.FIP?.toFixed(2) ?? "–"}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{c.SIERA?.toFixed(2) ?? "–"}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="calibration" className="space-y-4">
          {!cal ? (
            <p className="text-sm text-muted-foreground">calibration_report.json not found — run `python -m engine calibrate`.</p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(cal.groups).map(([key, g]) => (
                  <div key={key} className="rounded-lg border border-border p-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium">{key}</span>
                      <span className="text-muted-foreground">R² {g.fit.r2} · n={g.fit.n}</span>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <ScatterChart margin={{ top: 6, right: 6, bottom: 4, left: -18 }}>
                        <CartesianGrid strokeOpacity={0.15} />
                        <XAxis dataKey="proj" type="number" domain={["dataMin", "dataMax"]} tick={{ fontSize: 10 }} name="projected" />
                        <YAxis dataKey="obs" type="number" domain={["dataMin", "dataMax"]} tick={{ fontSize: 10 }} name="observed" />
                        <ZAxis dataKey="n" range={[12, 120]} />
                        <ReferenceLine segment={[{ x: 0.8, y: 0.8 }, { x: 1.2, y: 1.2 }]} stroke="#888" strokeDasharray="4 4" />
                        <Tooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          content={({ payload }) => {
                            const p = payload?.[0]?.payload as { name?: string; proj?: number; obs?: number; n?: number } | undefined;
                            if (!p) return null;
                            return (
                              <div className="rounded border border-border bg-background px-2 py-1 text-xs">
                                {p.name} · proj {p.proj} · obs {p.obs} · n {p.n}
                              </div>
                            );
                          }}
                        />
                        <Scatter data={g.points} fill="#22d3ee" fillOpacity={0.55} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 text-xs font-medium">Biggest evidence movers (observed results vs calibrated projection)</div>
                <div className="grid gap-1 text-xs sm:grid-cols-2">
                  {cal.topMovers.slice(0, 16).map((m) => (
                    <div key={m.name + m.pos} className="flex justify-between border-b border-border/40 py-0.5">
                      <span>{m.name} <span className="text-muted-foreground">{m.pos}</span></span>
                      <span className="font-mono text-muted-foreground">
                        {m.delta > 0 ? "+" : ""}{m.delta} (n={m.n})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
