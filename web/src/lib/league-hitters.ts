/**
 * The hitters a league lineup question is asked about: the team's bats
 * resolved to the copies L.J. owns, and a candidate card built from the shop
 * card plus ratings typed off a card face (a variant in the shop, say).
 * Shared by scripts/league-compare.ts and /league-card.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, collectionCards, leagueSnapshots, leagueStints, uploads } from "@/db/schema";
import { formRatings } from "@/lib/card-forms";
import { isMyOrg } from "@/lib/my-team";
import type { LineupHitter } from "@/lib/analytics/league-lineup";

type R = Record<string, number>;
export interface ShopHitter { cardId: number; name: string; title: string; value: number | null; pos: string | null; isPitcher: boolean | null; bats: string | null; ratings: R | null; year: number | null }
export interface CardHitter extends LineupHitter { cardId: number; note?: string; /** The roster entry it came from. */ entry?: string }
export interface HitterUniverse {
  collectionOn: string | null;
  owned: (typeof collectionCards.$inferSelect)[];
  shop: ShopHitter[];
  shopById: Map<number, ShopHitter>;
}

export const normName = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

export async function loadHitterUniverse(): Promise<HitterUniverse> {
  const [latest] = await db.select({ id: uploads.id, at: uploads.uploadedAt }).from(uploads).where(eq(uploads.kind, "collection")).orderBy(desc(uploads.id)).limit(1);
  const owned = latest ? await db.select().from(collectionCards).where(eq(collectionCards.uploadId, latest.id)) : [];
  const shop = (await db.select({ cardId: cards.cardId, name: cards.name, title: cards.title, value: cards.cardValue, pos: cards.position, isPitcher: cards.isPitcher, bats: cards.bats, ratings: cards.ratings, year: cards.year }).from(cards)) as ShopHitter[];
  return { collectionOn: latest?.at.toISOString().slice(0, 10) ?? null, owned, shop, shopById: new Map(shop.map((c) => [c.cardId, c])) };
}

/**
 * Each name resolves to the copy in the newest collection upload: the highest
 * value, and the variant when both are owned. A name not owned falls back to
 * the shop's best card of that name, with a warning; an unknown name throws
 * when strict, otherwise it is skipped with a warning. "Name#12345" pins the
 * card: the owned copy of that card id (the variant when both are owned), else
 * the shop card.
 */
export function resolveRoster(names: string[], u: HitterUniverse, strict = true): { hitters: CardHitter[]; warnings: string[] } {
  const hitters: CardHitter[] = [];
  const warnings: string[] = [];
  for (const entry of names) {
    const m = /^(.*?)\s*#(\d+)\s*$/.exec(entry);
    const name = m ? m[1] : entry, pinned = m ? Number(m[2]) : null;
    const mine = u.owned.filter((o) => o.cardId != null && (pinned != null ? o.cardId === pinned : normName(o.name ?? "") === normName(name)) && !u.shopById.get(o.cardId!)?.isPitcher)
      .sort((a, b) => (b.cardValue ?? 0) - (a.cardValue ?? 0) || Number(b.isVariant) - Number(a.isVariant));
    const pick = mine[0];
    if (pick) {
      const base = u.shopById.get(pick.cardId!)!;
      hitters.push({ id: hitters.length, label: `${base.name} ${base.value}${pick.isVariant ? " VAR" : ""}`, cardId: base.cardId, bats: base.bats, entry,
        ratings: formRatings((base.ratings ?? {}) as R, (pick.ratings ?? null) as R | null, pick.pos ?? base.pos) });
      continue;
    }
    const byId = pinned != null ? u.shopById.get(pinned) : undefined;
    const c = byId && !byId.isPitcher ? byId : u.shop.filter((s) => !s.isPitcher && normName(s.name) === normName(name)).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
    if (!c) {
      if (strict) throw new Error(`no hitter named ${name}`);
      warnings.push(`${name}: no hitter by that name; left out`);
      continue;
    }
    warnings.push(`${name}: not in the collection uploaded ${u.collectionOn ?? "—"}; using the shop's ${c.title}`);
    hitters.push({ id: hitters.length, label: `${c.name} ${c.value}`, cardId: c.cardId, bats: c.bats, entry, ratings: (c.ratings ?? {}) as R });
  }
  return { hitters, warnings };
}

/**
 * A candidate: the shop card with ratings typed off a card face laid over it,
 * in the collection export's words (EYE vL, POW vR, BA vL, K vR, GAP vL,
 * POS CF, DEF). Keys not given keep the shop card's values.
 */
export function candidateHitter(id: number, label: string, card: ShopHitter, exported: R): CardHitter {
  const ratings = Object.keys(exported).length ? formRatings((card.ratings ?? {}) as R, exported, card.pos) : (card.ratings ?? {}) as R;
  return { id, label: `${label.trim()} ${card.value}`, cardId: card.cardId, bats: card.bats, ratings, note: card.title };
}

/** Shop rating names in the card-face (export) words the candidate form takes. */
export const FACE_KEYS: Array<[face: string, shop: string]> = [
  ...(["vL", "vR"] as const).flatMap((h) => [
    [`EYE ${h}`, `Eye ${h}`], [`POW ${h}`, `Power ${h}`], [`GAP ${h}`, `Gap ${h}`], [`BA ${h}`, `BABIP ${h}`], [`K ${h}`, `Avoid K ${h}`],
  ] as Array<[string, string]>),
  ...["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"].map((p) => [`POS ${p}`, `Pos Rating ${p}`] as [string, string]),
];

/** The card's own values in card-face words, for prefilling a form. */
export function faceRatings(card: ShopHitter): Record<string, number> {
  const r = (card.ratings ?? {}) as R;
  return Object.fromEntries(FACE_KEYS.map(([face, shop]) => [face, r[shop] ?? 0]));
}

/**
 * L.J.'s team's bats in the newest league week it appears in, as "Name#cardId"
 * entries. The export lists everyone who batted for the team that week, so a
 * card traded away mid-week is still on it; the page lets him edit the list.
 */
export async function myLeagueBats(): Promise<{ league: string; on: string; names: string[] } | null> {
  const rows = await db.select({ id: leagueSnapshots.id, league: leagueSnapshots.league, on: leagueSnapshots.capturedOn, org: leagueStints.org, name: leagueStints.name, cid: leagueStints.cid, isPitcher: leagueStints.isPitcher })
    .from(leagueStints).innerJoin(leagueSnapshots, eq(leagueSnapshots.id, leagueStints.snapshotId))
    .where(and(eq(leagueSnapshots.split, "all"), sql`${leagueStints.org} ilike 'kansas city torrent%'`))
    .orderBy(desc(leagueSnapshots.capturedOn), desc(leagueSnapshots.id));
  const mine = rows.filter((r) => isMyOrg(r.org));
  if (!mine.length) return null;
  const newest = mine[0].id;
  const names = [...new Set(mine.filter((r) => r.id === newest && !r.isPitcher).map((r) => (r.cid != null ? `${r.name}#${r.cid}` : r.name)))];
  return { league: mine[0].league, on: String(mine[0].on).slice(0, 10), names };
}
