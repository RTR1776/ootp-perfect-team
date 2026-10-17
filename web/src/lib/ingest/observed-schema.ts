/**
 * The tournament archive's variant dimension (2026-10-17): observed_card_stats
 * and its stage carry is_variant and the copies' ratings, keyed by series +
 * card + variant. Idempotent; the importer runs it before every import, so the
 * Mac migrates the table the first time it runs the new importer, and
 * scripts/migrate-observed-variants.ts runs it by hand.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export async function ensureObservedVariantColumns(): Promise<void> {
  for (const t of ["observed_card_stats", "observed_card_stats_stage"]) {
    await db.execute(sql.raw(`alter table ${t} add column if not exists is_variant boolean not null default false`));
    await db.execute(sql.raw(`alter table ${t} add column if not exists ratings jsonb`));
  }
  const pk = await db.execute(sql`select conrelid::regclass::text t, conname from pg_constraint
    where conrelid::regclass::text in ('observed_card_stats', 'observed_card_stats_stage') and contype = 'p'`);
  const name = (t: string) => (pk.rows as { t: string; conname: string }[]).find((r) => r.t === t)?.conname;
  if (name("observed_card_stats") !== "observed_card_stats_series_card_id_is_variant_pk") {
    await db.execute(sql`alter table observed_card_stats drop constraint if exists observed_card_stats_series_card_id_pk`);
    await db.execute(sql`alter table observed_card_stats add constraint observed_card_stats_series_card_id_is_variant_pk primary key (series, card_id, is_variant)`);
  }
  if (name("observed_card_stats_stage") !== "observed_card_stats_stage_batch_id_series_card_id_is_variant_pk") {
    await db.execute(sql`alter table observed_card_stats_stage drop constraint if exists observed_card_stats_stage_batch_id_series_card_id_pk`);
    await db.execute(sql`alter table observed_card_stats_stage add constraint observed_card_stats_stage_batch_id_series_card_id_is_variant_pk primary key (batch_id, series, card_id, is_variant)`);
  }
}
