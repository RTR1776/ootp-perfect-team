/**
 * Print the PTCS standings history the dump imports already computed —
 * my points/rank plus the 64th/100th/128th-place lines, per category, per dump:
 *
 *   pnpm standings
 *
 * Reads the stored uploads.report, so it never re-parses a dump.
 */

import { desc } from "drizzle-orm";
import { db } from "../src/db/client";
import { uploads } from "../src/db/schema";

type Snap = { day: string; pts: number; rank: number | null; l64: number; l100: number; l128: number };

async function main() {
  const rows = await db.select().from(uploads).orderBy(desc(uploads.id)).limit(200);
  const hist: Record<string, Snap[]> = {};
  for (const r of rows) {
    if (r.kind !== "dump") continue;
    const rep = r.report as any;
    const day = (r.uploadedAt as Date)?.toISOString().slice(0, 10);
    for (const [cat, c] of Object.entries<any>(rep?.standings?.categories ?? {})) {
      (hist[cat] ??= []).push({ day, pts: c.pts, rank: c.rank, l64: c.lines.l64, l100: c.lines.l100, l128: c.lines.l128 });
    }
  }
  for (const [cat, snaps] of Object.entries(hist)) {
    snaps.sort((a, b) => (a.day < b.day ? -1 : 1));
    console.log(`\n${cat}`);
    for (const s of snaps) {
      const margin = s.pts - s.l128;
      console.log(
        `  ${s.day}  pts=${String(s.pts).padStart(4)} rank=${String(s.rank ?? "—").padStart(5)}` +
          `  l64=${String(s.l64).padStart(4)} l100=${String(s.l100).padStart(4)} l128=${String(s.l128).padStart(4)}` +
          `  vs128=${(margin >= 0 ? "+" : "") + margin}`,
      );
    }
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
