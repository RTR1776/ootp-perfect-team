/**
 * Loads the card sets and years a series' field played (lib/set-evidence.ts
 * reads them). Server only: it queries the database.
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, observedCardStats } from "@/db/schema";
import { summariseSetEvidence, type SetEvidence } from "@/lib/set-evidence";

/** One series' evidence, or null when it has no exports on file. */
export async function loadSetEvidence(series: string): Promise<SetEvidence | null> {
  return (await loadSetEvidenceMany([series])).get(series) ?? null;
}

/** Evidence for many series in one query, keyed by series. */
export async function loadSetEvidenceMany(series: readonly string[]): Promise<Map<string, SetEvidence>> {
  const out = new Map<string, SetEvidence>();
  if (!series.length) return out;
  // (series, card_id) is the table's key, so each card counts once per series.
  const rows = await db
    .select({ series: observedCardStats.series, cardId: observedCardStats.cardId, cardType: cards.cardType, year: cards.year })
    .from(observedCardStats)
    .innerJoin(cards, eq(cards.cardId, observedCardStats.cardId))
    .where(inArray(observedCardStats.series, [...series]));
  const bySeries = new Map<string, { cardType: number | null; year: number | null }[]>();
  for (const r of rows) {
    const list = bySeries.get(r.series) ?? [];
    list.push({ cardType: r.cardType, year: r.year });
    bySeries.set(r.series, list);
  }
  for (const [s, list] of bySeries) {
    const e = summariseSetEvidence(list);
    if (e) out.set(s, e);
  }
  return out;
}
