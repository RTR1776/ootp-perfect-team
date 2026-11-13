/**
 * Put the harvested position ratings back on the base cards, from the
 * `card_positions` table (no export archive needed).
 *
 *   pnpm positions:reapply [--dry]
 *
 * The card-list imports run this themselves; this is the by-hand version, and
 * the check that nothing is missing. See lib/ingest/positions-reapply.ts.
 */
import { countMissingPositions, reapplyHarvestedPositions } from "@/lib/ingest/positions-reapply";

(async () => {
  const before = await countMissingPositions();
  console.log(`missing now: ${before.ratings} position ratings on ${before.cards} hitters`);
  if (process.argv.includes("--dry") || !before.ratings) { process.exit(0); }
  const done = await reapplyHarvestedPositions();
  const after = await countMissingPositions();
  console.log(`filled ${done.ratings} ratings on ${done.cards} cards; missing after: ${after.ratings}`);
  process.exit(after.ratings ? 1 : 0);
})().catch((e) => { console.error(String(e)); process.exit(1); });
