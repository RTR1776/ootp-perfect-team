/**
 * Market — the PP terminal.
 *
 * Everything here prices QUALITY against the live market. Quality is the same
 * league-relative composite the roster audit uses (usage-weighted percentile
 * at the card's position across the HD pool), so "underpriced" means exactly:
 * more of the bar you are judged against, per PP, than the market is charging.
 *
 * Price semantics (see ootp meta conventions):
 *   Buy Order High = highest bid  = what you RECEIVE selling instantly
 *   Sell Order Low = lowest ask   = what you PAY buying instantly
 *   Last 10        = fair value   = consensus
 *   Last 10 (VAR)  = the variant's own market — a separate, pricier listing
 *
 * With one shop snapshot this page is a cross-section; every weekly upload
 * adds a snapshot and the movers board lights up automatically.
 */

import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, cardSnapshots, leagueSnapshots, leagueStints, uploads } from "@/db/schema";
import { auditCard, positionPercentiles, type StintLike } from "@/lib/analytics/league";
import { Card, CardContent } from "@/components/ui/card";
import { Placeholder } from "@/components/placeholder";

export const dynamic = "force-dynamic";

const SHOP_TO_CANONICAL: Array<[string, string]> = [
  ["POW", "Power"], ["EYE", "Eye"], ["Kav", "Avoid Ks"], ["BABr", "BABIP"], ["GAP", "Gap"],
  ["STU", "Stuff"], ["CON", "Control"], ["PBAB", "pBABIP"], ["HRA", "pHR"],
  ["CABI", "CatcherAbil"], ["CFRM", "CatcherFrame"], ["CARM", "Catcher Arm"],
  ["IFRNG", "Infield Range"], ["IFERR", "Infield Error"], ["IFARM", "Infield Arm"], ["TDP", "DP"],
  ["OFRNG", "OF Range"], ["OFERR", "OF Error"], ["OFARM", "OF Arm"],
];

function canonicalise(shop: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [c, s] of SHOP_TO_CANONICAL) {
    const v = shop[s];
    if (v != null && Number.isFinite(v)) out[c] = v;
  }
  return out;
}

function pp(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US");
}

interface MarketRow {
  cardId: number;
  name: string;
  title: string;
  pos: string;
  tier: string;
  cardValue: number;
  owned: number;
  score: number | null;
  buy: number | null;
  sell: number | null;
  last10: number | null;
  last10Var: number | null;
  /** quality percentile points per 1,000 PP of fair value. */
  valuePer1k: number | null;
  spreadPct: number | null;
  deltaL10: number | null;
}

async function loadMarket(): Promise<{
  rows: MarketRow[];
  snapshotDate: string | null;
  prevDate: string | null;
  hdPool: boolean;
} | null> {
  const shopUploads = await db
    .select()
    .from(uploads)
    .where(eq(uploads.kind, "shop_list"))
    .orderBy(desc(uploads.id))
    .limit(2);
  if (shopUploads.length === 0) return null;

  const [latest, prev] = shopUploads;
  const snaps = await db
    .select()
    .from(cardSnapshots)
    .where(eq(cardSnapshots.uploadId, latest.id));
  const prevSnaps = prev
    ? await db.select().from(cardSnapshots).where(eq(cardSnapshots.uploadId, prev.id))
    : [];
  const prevById = new Map(prevSnaps.map((s) => [s.cardId, s]));

  const universe = await db.select().from(cards);
  const byId = new Map(universe.map((u) => [u.cardId, u]));

  // Quality machinery from the latest HD league snapshots, when present.
  const leagueSnapRows = await db
    .select()
    .from(leagueSnapshots)
    .where(eq(leagueSnapshots.split, "all"))
    .orderBy(desc(leagueSnapshots.capturedOn), desc(leagueSnapshots.id));
  const latestByLeague = new Map<string, number>();
  for (const s of leagueSnapRows) {
    if (s.league !== "PEL" && !latestByLeague.has(s.league)) latestByLeague.set(s.league, s.id);
  }
  let pcts: ReturnType<typeof positionPercentiles> | null = null;
  if (latestByLeague.size > 0) {
    const stintRows = await db
      .select()
      .from(leagueStints)
      .where(inArray(leagueStints.snapshotId, [...latestByLeague.values()]));
    const pool: StintLike[] = stintRows.map((r) => ({
      cid: r.cid, name: r.name, pos: r.pos, org: r.org, clan: r.clan,
      isFreeAgent: r.isFreeAgent, isPitcher: r.isPitcher, val: r.val,
      isVariant: r.isVariant, cardYear: r.cardYear, ratings: r.ratings ?? {},
      pa: r.pa, ip: r.ip, use: r.use, war: r.war, stats: r.stats ?? {},
    }));
    pcts = positionPercentiles(pool, [
      "POW","EYE","Kav","BABr","GAP","STU","CON","PBAB","HRA",
      "CABI","CFRM","CARM","IFRNG","IFERR","IFARM","TDP","OFRNG","OFERR","OFARM",
    ]);
  }

  const rows: MarketRow[] = [];
  for (const snap of snaps) {
    const card = byId.get(snap.cardId);
    if (!card) continue;
    const pos = card.isPitcher ? (card.pitcherRole ?? "SP") : card.position;
    let score: number | null = null;
    if (pcts) {
      const res = auditCard(pos, canonicalise(card.ratings ?? {}), pcts);
      score = Number.isFinite(res.score) ? Math.round(res.score) : null;
    }
    const last10 = snap.last10 ?? null;
    const buy = snap.buyOrderHigh ?? null;
    const sell = snap.sellOrderLow ?? null;
    const prevSnap = prevById.get(snap.cardId);
    rows.push({
      cardId: snap.cardId,
      name: card.name,
      title: card.title,
      pos,
      tier: card.tier,
      cardValue: card.cardValue,
      owned: snap.owned,
      score,
      buy,
      sell,
      last10,
      last10Var: snap.last10Variant ?? null,
      valuePer1k:
        score != null && last10 != null && last10 >= 100
          ? Math.round((score / last10) * 1000 * 10) / 10
          : null,
      spreadPct:
        buy != null && sell != null && sell > 0 && buy > 0
          ? Math.round(((sell - buy) / sell) * 100)
          : null,
      deltaL10:
        prevSnap?.last10 != null && last10 != null ? last10 - prevSnap.last10 : null,
    });
  }

  return {
    rows,
    snapshotDate: latest.uploadedAt?.toISOString().slice(0, 10) ?? null,
    prevDate: prev?.uploadedAt?.toISOString().slice(0, 10) ?? null,
    hdPool: pcts != null,
  };
}

function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const up = value > 0;
  const flat = value === 0;
  return (
    <span
      className={
        flat ? "text-muted-foreground" : up ? "font-medium text-emerald-500" : "font-medium text-red-500"
      }
    >
      {up ? "▲" : flat ? "" : "▼"} {Math.abs(value).toLocaleString()}
    </span>
  );
}

function Table({
  head,
  children,
}: {
  head: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            {head.map((h, i) => (
              <th key={h + i} className={`py-2 pr-4 ${i >= 2 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono text-[13px]">{children}</tbody>
      </table>
    </div>
  );
}

export default async function MarketPage() {
  const data = await loadMarket();
  if (!data) {
    return (
      <Placeholder
        icon="tournaments"
        title="Market"
        description="Upload pt_card_list.csv on the Upload page — every upload snapshots all ~3,700 cards' prices and ownership, and this becomes the PP terminal: quality-per-price boards, spreads, variant premiums, and week-over-week movers."
      />
    );
  }

  const { rows, snapshotDate, prevDate, hdPool } = data;
  const listed = rows.filter((r) => (r.last10 ?? 0) > 0);
  const spreads = listed.filter((r) => r.spreadPct != null).map((r) => r.spreadPct!) as number[];
  const medianSpread = spreads.length
    ? spreads.sort((a, b) => a - b)[Math.floor(spreads.length / 2)]
    : null;
  const ownedRows = rows.filter((r) => r.owned > 0);
  const liquidation = ownedRows.reduce((s, r) => s + (r.buy ?? 0) * r.owned, 0);
  const fairValue = ownedRows.reduce((s, r) => s + (r.last10 ?? 0) * r.owned, 0);

  const buyBoard = listed
    .filter((r) => r.owned === 0 && r.score != null && r.score >= 55 && (r.sell ?? 0) > 0)
    .sort((a, b) => (b.valuePer1k ?? 0) - (a.valuePer1k ?? 0))
    .slice(0, 15);

  const sellBoard = ownedRows
    .filter((r) => r.score != null && r.score < 45 && (r.buy ?? 0) >= 500)
    .sort((a, b) => (b.buy ?? 0) - (a.buy ?? 0))
    .slice(0, 15);

  const premiumBoard = listed
    .filter((r) => (r.last10Var ?? 0) > 0 && (r.last10 ?? 0) >= 500 && r.score != null && r.score >= 60)
    .map((r) => ({ ...r, premium: Math.round(((r.last10Var! / r.last10!) - 1) * 100) }))
    .sort((a, b) => a.premium - b.premium)
    .slice(0, 12);

  const movers =
    prevDate == null
      ? null
      : listed
          .filter((r) => r.deltaL10 != null && Math.abs(r.deltaL10!) >= 100)
          .sort((a, b) => Math.abs(b.deltaL10!) - Math.abs(a.deltaL10!))
          .slice(0, 15);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Market</h1>
          <p className="text-sm text-muted-foreground">
            Snapshot {snapshotDate ?? "—"} · {listed.length.toLocaleString()} cards with live prices
            {prevDate ? ` · trend vs ${prevDate}` : " · upload next week's shop list to unlock movers"}
            {!hdPool && " · upload league exports to unlock quality scores"}
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Collection at fair value", `${pp(fairValue)} PP`],
          ["Instant liquidation (bids)", `${pp(liquidation)} PP`],
          ["Median bid-ask spread", medianSpread != null ? `${medianSpread}%` : "—"],
          ["Owned cards", `${ownedRows.length.toLocaleString()}`],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
              <div className="mt-1 font-mono text-xl font-semibold tabular-nums">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Buy board */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-1 text-sm font-semibold">Underpriced — quality per PP, unowned</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            League percentile at the card&apos;s position (HD usage-weighted) per 1,000 PP of fair
            value. Score ≥ 55 only — this board answers &quot;what is the cheapest real upgrade,&quot;
            not &quot;what is cheap.&quot; Ask = what you pay right now.
          </p>
          <Table head={["Pos", "Card", "Score", "Ask", "L10", "Pct / 1k PP"]}>
            {buyBoard.map((r) => (
              <tr key={r.cardId} className="border-b border-border/50">
                <td className="py-1.5 pr-4">{r.pos}</td>
                <td className="max-w-[320px] truncate py-1.5 pr-4 font-sans">{r.title}</td>
                <td className="py-1.5 pr-4 text-right">{r.score}</td>
                <td className="py-1.5 pr-4 text-right">{pp(r.sell)}</td>
                <td className="py-1.5 pr-4 text-right">{pp(r.last10)}</td>
                <td className="py-1.5 text-right font-medium text-emerald-500">{r.valuePer1k}</td>
              </tr>
            ))}
          </Table>
        </CardContent>
      </Card>

      {/* Sell board */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-1 text-sm font-semibold">Sell candidates — owned, below the bar, with a real bid</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Owned cards scoring under the 45th percentile at their position with at least 500 PP of
            standing bid. Production-guarded as always: check vL/vR splits before listing anyone you
            platoon. Bid = what you receive instantly.
          </p>
          <Table head={["Pos", "Card", "Score", "Bid", "L10", "Owned"]}>
            {sellBoard.map((r) => (
              <tr key={r.cardId} className="border-b border-border/50">
                <td className="py-1.5 pr-4">{r.pos}</td>
                <td className="max-w-[320px] truncate py-1.5 pr-4 font-sans">{r.title}</td>
                <td className="py-1.5 pr-4 text-right text-amber-500">{r.score}</td>
                <td className="py-1.5 pr-4 text-right font-medium text-emerald-500">{pp(r.buy)}</td>
                <td className="py-1.5 pr-4 text-right">{pp(r.last10)}</td>
                <td className="py-1.5 text-right">{r.owned}</td>
              </tr>
            ))}
          </Table>
        </CardContent>
      </Card>

      {/* Variant premiums */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-1 text-sm font-semibold">Cheapest variant entries on quality cards</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Variant fair value vs base fair value, for cards scoring ≥ 60. Typical premium runs
            5–15×; anything near or below +200% on a card this good is unusually cheap boosted power.
          </p>
          <Table head={["Pos", "Card", "Score", "Base L10", "VAR L10", "Premium"]}>
            {premiumBoard.map((r) => (
              <tr key={r.cardId} className="border-b border-border/50">
                <td className="py-1.5 pr-4">{r.pos}</td>
                <td className="max-w-[320px] truncate py-1.5 pr-4 font-sans">{r.title}</td>
                <td className="py-1.5 pr-4 text-right">{r.score}</td>
                <td className="py-1.5 pr-4 text-right">{pp(r.last10)}</td>
                <td className="py-1.5 pr-4 text-right">{pp(r.last10Var)}</td>
                <td className="py-1.5 text-right">{`+${r.premium}%`}</td>
              </tr>
            ))}
          </Table>
        </CardContent>
      </Card>

      {/* Movers */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-1 text-sm font-semibold">Movers</h2>
          {movers == null ? (
            <p className="text-xs text-muted-foreground">
              One snapshot so far. Upload the shop list again after the next card drop and this board
              shows the biggest week-over-week L10 moves — the creep, priced.
            </p>
          ) : movers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No moves of 100+ PP between snapshots.</p>
          ) : (
            <Table head={["Pos", "Card", "L10", "Δ vs prev", "Owned", "Score"]}>
              {movers.map((r) => (
                <tr key={r.cardId} className="border-b border-border/50">
                  <td className="py-1.5 pr-4">{r.pos}</td>
                  <td className="max-w-[320px] truncate py-1.5 pr-4 font-sans">{r.title}</td>
                  <td className="py-1.5 pr-4 text-right">{pp(r.last10)}</td>
                  <td className="py-1.5 pr-4 text-right">
                    <Delta value={r.deltaL10} />
                  </td>
                  <td className="py-1.5 pr-4 text-right">{r.owned || "—"}</td>
                  <td className="py-1.5 text-right">{r.score ?? "—"}</td>
                </tr>
              ))}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
