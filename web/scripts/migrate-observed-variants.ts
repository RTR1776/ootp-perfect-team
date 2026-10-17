/**
 * One-off: give the tournament archive its variant dimension now
 * (src/lib/ingest/observed-schema.ts; the importer also does it before every
 * run). Existing rows become base rows until the archive is re-imported
 * (pnpm import:observed), which splits each card's variant play onto its own row.
 *
 *   node --import tsx scripts/migrate-observed-variants.ts
 */
import { ensureObservedVariantColumns } from "../src/lib/ingest/observed-schema";

ensureObservedVariantColumns().then(() => { console.log("observed_card_stats: is_variant + ratings, keyed by series + card + variant"); process.exit(0); }, (e) => { console.error(e); process.exit(1); });
