/**
 * Confirm a buy from the command line: the Upgrades page's third section
 * (lib/upgrade-confirm-server), for when the page runs where it can't spawn
 * env-roster (Vercel). Per event: the seeded rebuild without and with the
 * assumed cards, the objective's change and the cards that move. Nothing saved.
 *
 *   pnpm upgrade:confirm --events 9080004,9080005,9080008 --variant 12345 [--owned 87085]
 */
import { confirmBuy } from "@/lib/upgrade-confirm-server";

const argv = process.argv.slice(2);
const ids = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? (argv[i + 1] ?? "").split(",").map((x) => Number(x.trim())).filter((n) => n > 0) : []; };
const events = ids("events"), variants = ids("variant"), owned = ids("owned");
if (!events.length || !(variants.length || owned.length)) {
  console.error("usage: pnpm upgrade:confirm --events id[,id] [--variant id[,id]] [--owned id[,id]]");
  process.exit(1);
}

async function main() {
  let total = 0;
  for (const r of await Promise.all(events.map((e) => confirmBuy(e, variants, owned)))) {
    if (r.error) { console.log(`${r.event}: ${r.error}`); continue; }
    total += r.delta ?? 0;
    const card = (c: { name: string; val: number; variant: boolean }) => `${c.name}${c.variant ? " (VAR)" : ""} ${c.val}`;
    console.log(`${r.event}: ${r.before} → ${r.after} (${(r.delta ?? 0) >= 0 ? "+" : ""}${r.delta})${r.legal ? "" : " NOT LEGAL"} · ${r.seconds}s`);
    if (r.added.length || r.dropped.length) console.log(`  in: ${r.added.map(card).join(", ") || "-"}\n  out: ${r.dropped.map(card).join(", ") || "-"}`);
  }
  console.log(`total ${total >= 0 ? "+" : ""}${total.toFixed(1)} weighted runs over ${events.length} event${events.length === 1 ? "" : "s"}`);
  process.exit(0);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
