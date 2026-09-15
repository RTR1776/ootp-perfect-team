/**
 * Played — the best cards by what they have actually done in tournaments.
 *
 * Built for Perfect Draft, where the pool on the screen is the game's, not
 * the collection, and every event's round rules differ ("101+ Round 1",
 * "20 cards", "random 1980-2004 RE"). A ranked board of every card with
 * tournament play on record, filterable by value window, position, hand
 * and year, is what can be pulled up mid-draft.
 *
 * One line per card. The ranking figure is the observed-blend number:
 * the card's deviation from each series' average, put on the model's scale
 * by the field's level, pooled over series by PA/BF, and blended with the
 * model at K = 2500 (observed-blend.ts, validated out of sample). The raw
 * wOBA / FIP shown alongside are pooled across every environment the card
 * played in, so they are context, not the ranking.
 *
 * Model runs are scored at the PT default engine and a neutral park - a
 * draft's environment is announced late or randomised, and the default is
 * the centre of what runs.
 */
import { unstable_cache } from "next/cache";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, collectionCards, importBatches, uploads } from "@/db/schema";
import { eraTable } from "@/lib/analytics/tournament-env";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { loadObservedRuns, blendRuns, OBS_K_DEFAULT } from "@/lib/analytics/observed-blend";
import { wobaOf, fipOf } from "@/lib/analytics/league";
import { PlayedBoard, type PlayedLine } from "@/components/played-board";
import { Placeholder } from "@/components/placeholder";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
const asRows = (r: unknown): Row[] => (Array.isArray(r) ? (r as Row[]) : ((r as { rows?: Row[] }).rows ?? []));
const num = (v: unknown) => (v == null ? 0 : Number(v));

/**
 * The board takes ~7s to compute (every card scored, 36k observed lines
 * pooled), so it is cached and keyed by the newest published observed
 * import and the newest collection upload: a new export or collection
 * makes a new entry, otherwise a draft-night reload is instant.
 */
async function buildLines(uploadId: number | null): Promise<{ lines: PlayedLine[]; collectionDate: string | null }> {
  const era = eraTable["0"] ?? eraTable["2010"];
  if (!era) return { lines: [], collectionDate: null };

  // Every card that has tournament play: totals and the raw pooled line.
  const played = asRows(await db.execute(sql`
    select o.card_id, bool_or(o.is_pitcher) is_pitcher, sum(o.pa)::float pa, sum(o.ip)::float ip,
           sum(o.instances)::int instances, count(*)::int series,
           max(o.series) filter (where o.is_pitcher) _unused
    from observed_card_stats o group by o.card_id`));
  if (!played.length) return { lines: [], collectionDate: null };
  const sums = asRows(await db.execute(sql`
    select card_id, e.key k, sum((e.value)::float) v
    from observed_card_stats, jsonb_each_text(counters) e
    group by card_id, e.key`));
  const counters = new Map<number, Record<string, number>>();
  for (const r of sums) {
    const id = num(r.card_id);
    const c = counters.get(id) ?? {};
    c[String(r.k)] = num(r.v);
    counters.set(id, c);
  }

  const universe = await db.select({
    cardId: cards.cardId, name: cards.name, cardValue: cards.cardValue, tier: cards.tier, position: cards.position,
    pitcherRole: cards.pitcherRole, isPitcher: cards.isPitcher, bats: cards.bats, throws: cards.throws, year: cards.year,
    cardType: cards.cardType, ratings: cards.ratings,
  }).from(cards);
  const fits = envFitMaps(universe.map((c) => ({
    cardId: c.cardId, isPitcher: c.isPitcher ?? false, bats: c.bats, role: c.pitcherRole,
    ratings: (c.ratings ?? {}) as Record<string, number>,
  })), { era: era.rates, park: null, roleTrust: 0.25 });
  const both = (id: number) => { const r = fits.runsR.get(id), l = fits.runsL.get(id); return r == null || l == null ? null : 0.7 * r + 0.3 * l; };

  const ids = played.map((p) => num(p.card_id));
  const observed = await loadObservedRuns(ids, both);

  const [latest] = uploadId != null
    ? await db.select({ id: uploads.id, at: uploads.uploadedAt }).from(uploads).where(eq(uploads.id, uploadId)).limit(1)
    : [];
  const owned = latest
    ? new Set((await db.select({ cardId: collectionCards.cardId }).from(collectionCards).where(eq(collectionCards.uploadId, latest.id))).map((o) => o.cardId))
    : new Set<number>();

  const byId = new Map(universe.map((c) => [c.cardId, c]));
  const stintLike = (c: Record<string, number>, ip: number, pa: number) => ({
    stats: c, ip, pa, use: 0, isPitcher: false, isFreeAgent: false, org: "", cid: null, name: "", pos: "",
    clan: null, val: null, tier: null, isVariant: false, cardYear: null, ratings: {}, war: 0,
  });
  const lines: PlayedLine[] = [];
  for (const p of played) {
    const id = num(p.card_id);
    const c = byId.get(id);
    if (!c) continue;
    const isP = !!p.is_pitcher;
    const model = both(id);
    const ob = observed.get(id);
    const n = ob?.n ?? (isP ? num(counters.get(id)?.BF) : num(p.pa));
    if (model == null && !ob) continue;
    const cnt = counters.get(id) ?? {};
    const r = (c.ratings ?? {}) as Record<string, number>;
    lines.push({
      cardId: id, name: c.name, val: c.cardValue, tier: c.tier, pos: c.position ?? "?", role: c.pitcherRole,
      isPitcher: isP, bats: c.bats, throws: c.throws, year: c.year, owned: owned.has(id),
      model: model ?? 0, obs: ob?.runs ?? null, n: Math.round(n), pa: Math.round(num(p.pa)), ip: Math.round(num(p.ip) * 10) / 10,
      series: num(p.series), instances: num(p.instances),
      blend: model == null ? (ob?.runs ?? 0) : blendRuns(model, ob, OBS_K_DEFAULT),
      woba: !isP && num(p.pa) > 0 ? Math.round(wobaOf([stintLike(cnt, 0, num(p.pa)) as never]) * 1000) / 1000 : null,
      fip: isP && num(p.ip) > 0 ? Math.round(fipOf([stintLike(cnt, num(p.ip), 0) as never]) * 100) / 100 : null,
      stamina: isP ? Math.round(r["Stamina"] ?? 0) : null,
      defPos: !isP ? Object.fromEntries(["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"].map((pos) => [pos, Math.round(r[`Pos Rating ${pos}`] ?? 0)]).filter(([, v]) => (v as number) > 0)) : null,
    });
  }
  lines.sort((a, b) => b.blend - a.blend);
  return { lines, collectionDate: latest?.at ? new Date(latest.at).toISOString().slice(0, 10) : null };
}

export default async function PlayedPage() {
  const [batch] = await db.select({ id: importBatches.id }).from(importBatches)
    .where(eq(importBatches.status, "published")).orderBy(desc(importBatches.id)).limit(1);
  const [upload] = await db.select({ id: uploads.id }).from(uploads).where(eq(uploads.kind, "collection")).orderBy(desc(uploads.id)).limit(1);
  const key = [`played`, String(batch?.id ?? 0), String(upload?.id ?? 0)];
  const cached = unstable_cache(() => buildLines(upload?.id ?? null), key, { revalidate: 3600, tags: ["played"] });
  const { lines, collectionDate } = await cached();
  if (!lines.length) return <Placeholder icon="tournaments" title="Played" description="Import tournament exports (File OOTP Exports.command) and this becomes the board of what has actually produced." />;
  return <PlayedBoard lines={lines} k={OBS_K_DEFAULT} collectionDate={collectionDate} />;
}
