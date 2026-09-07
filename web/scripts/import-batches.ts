/**
 * What did the importer actually do? The filer runs import:observed in the
 * background every time an export lands, so its outcome is a log line nobody
 * reads. This lists the import_batches record instead:
 *
 *   pnpm imports            # last 20 batches
 *   pnpm imports 50         # last 50
 *   pnpm imports --failed   # only failed / abandoned ones
 *
 * A "failed" batch never touched the live table - the series it names is
 * still whatever the previous published batch left there. Re-run
 * `pnpm import:observed --series <slug>` to try again.
 */

import { desc, eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { importBatches } from "../src/db/schema";

async function main() {
  const args = process.argv.slice(2);
  const failedOnly = args.includes("--failed");
  const limit = Number(args.find((a) => /^\d+$/.test(a)) ?? 20);

  const q = db.select().from(importBatches).orderBy(desc(importBatches.id)).limit(limit);
  const rows = failedOnly ? await q.where(eq(importBatches.status, "failed")) : await q;

  if (!rows.length) {
    console.log(failedOnly ? "no failed batches." : "no import batches recorded yet.");
    return;
  }
  const fmt = (d: Date | null) =>
    d ? d.toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "-";
  console.log(
    `  ${"#".padStart(5)}  ${"status".padEnd(9)} ${"kind".padEnd(9)} ${"rows".padStart(6)} ${"files".padStart(5)}  ${"started (CT)".padEnd(18)} scope`,
  );
  for (const b of rows) {
    const scope = b.scope.length > 4 ? `${b.scope.slice(0, 4).join(", ")} +${b.scope.length - 4}` : b.scope.join(", ");
    console.log(
      `  ${String(b.id).padStart(5)}  ${b.status.padEnd(9)} ${b.kind.padEnd(9)} ${String(b.rows ?? "-").padStart(6)} ${String(b.files.length).padStart(5)}  ${fmt(b.startedAt).padEnd(18)} ${scope}`,
    );
    if (b.error) console.log(`         ${b.error.split("\n")[0].slice(0, 110)}`);
  }
  const failed = rows.filter((b) => b.status === "failed").length;
  if (failed && !failedOnly) console.log(`\n  ${failed} failed batch(es) above - the live table kept the previous data for those series.`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
