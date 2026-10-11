import { readFileSync, writeFileSync } from "node:fs";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, tournaments } from "@/db/schema";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { eraFor, parkFor } from "@/lib/analytics/tournament-env";
import { fieldingRuns } from "@/lib/analytics/fielding";
import { loadObservedBook, observedRunsFrom } from "@/lib/analytics/observed-blend";
const D = process.env.REV_DIR ?? "/tmp/ptcs7rev";
const cids = JSON.parse(readFileSync(`${D}/cids.json`, "utf8"));
const IDS: Record<string, number> = { bronze: 9070002, silver: 9070003, gold: 9070004, diamond: 9070005, open: 9070006, cap: 9070008 };
const out: any = {};
for (const [b, tid] of Object.entries(IDS)) {
  const [t] = await db.select().from(tournaments).where(inArray(tournaments.id, [tid]));
  const era = eraFor(t.envYear)!; const park = parkFor(t.stadium);
  const rows = await db.select().from(cards).where(inArray(cards.cardId, cids[b].cids));
  const pool = rows.map((c) => ({ cardId: c.cardId, isPitcher: c.isPitcher, bats: c.bats, ratings: c.ratings as Record<string, number>, role: c.pitcherRole }));
  const fits = envFitMaps(pool, { era: era.row.rates, park: park.row, eraYear: t.envYear, pitchLhbShare: cids[b].lhbShare });
  // Each card's play in OTHER events (the Championship itself excluded), on the model's scale.
  const lhp = cids[b].lhpShare;
  const both = (id: number) => { const r = fits.runsR.get(id), l = fits.runsL.get(id); return r == null || l == null ? null : (1 - lhp) * r + lhp * l; };
  const book = await loadObservedBook(cids[b].cids, Object.keys(IDS).map((k) => `ptcs7champ${k}`));
  const obs = observedRunsFrom(book, both);
  const m: any = {};
  for (const c of rows) {
    const r = c.ratings as Record<string, number>;
    const fr: Record<string, number> = {};
    for (const p of ["C","1B","2B","3B","SS","LF","CF","RF"]) { const v = r[`Pos Rating ${p}`]; if (v) fr[p] = fieldingRuns(p, v); }
    m[c.cardId] = { name: c.name, val: c.cardValue, p: c.isPitcher, bats: c.bats, throws: c.throws, role: c.pitcherRole, R: fits.runsR.get(c.cardId) ?? null, L: fits.runsL.get(c.cardId) ?? null, obs: obs.get(c.cardId)?.runs ?? null, n: obs.get(c.cardId)?.n ?? 0, fr, rt: r };
  }
  out[b] = { env: `${t.envYear} @ ${t.stadium} dh=${t.dh}`, cards: m };
  console.log(b, out[b].env, rows.length);
}
writeFileSync(`${D}/model.json`, JSON.stringify(out));
process.exit(0);
