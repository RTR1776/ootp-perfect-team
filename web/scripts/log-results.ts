/**
 * Log PTCS results from the command line - the same code path as the page.
 *
 *   pnpm results:log [--as-of YYYY-MM-DD] [--dry] rows.txt
 *   pbpaste | pnpm results:log --dry
 *
 * Rows are Your Tournaments lines (see lib/result-lines). --dry previews;
 * without it, new rows are written. Event ids already on file are reported
 * as duplicates and skipped, so replaying a file is harmless.
 */

import { readFileSync } from "node:fs";
import { deleteResult, enterResults } from "../src/lib/result-entry-server";

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const asOfIdx = args.indexOf("--as-of");
  const asOf = asOfIdx >= 0 ? args[asOfIdx + 1] ?? null : null;
  const delIdx = args.indexOf("--delete");
  if (delIdx >= 0) {
    const id = Number(args[delIdx + 1]);
    const n = await deleteResult(id);
    console.log(n ? `removed event ${id}` : `no logged result with event id ${id}`);
    return;
  }
  const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--as-of");
  const text = file ? readFileSync(file, "utf8") : readFileSync(0, "utf8");

  const out = await enterResults({ text, asOf, dryRun: dry });
  if (!out.ok) { console.error(out.error); process.exit(1); }
  const v = out.value;
  console.log(`screen read on ${v.asOf}${dry ? " (dry run - nothing written)" : ""}\n`);
  for (const r of v.rows) {
    const tag = r.status === "new" ? "NEW " : r.status === "duplicate" ? "dup " : "?!  ";
    const pts = r.categories.length ? r.categories.map((c) => `+${r.points} ${c}`).join("/") : "-";
    console.log(`  ${tag} ${(r.occurredOn ?? "????-??-??").slice(5)}  ${r.name.slice(0, 44).padEnd(46)} ${String(r.eventId ?? "").padStart(7)}  ${(r.eliminated ? "elim" : r.placement ?? "?").padEnd(10)} ${String(r.fieldSize ?? "").padStart(3)}  ${pts}`);
    for (const p of r.problems) console.log(`         ${p}`);
  }
  const by = Object.entries(v.summary.byCategory).map(([c, n]) => `${c} +${n}`).join(", ");
  console.log(`\n  ${v.summary.new} new, ${v.summary.duplicates} already logged, ${v.summary.problems} unreadable${by ? ` - ${dry ? "would add" : "added"} ${by}` : ""}${v.saved != null ? `; ${v.saved} written` : ""}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
