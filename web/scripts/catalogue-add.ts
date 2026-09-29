/**
 * Add an event the catalogue doesn't have yet: a pop-up, or anything that
 * runs before a community dump lists it. catalogue:sync only learns events
 * from the dumps, so without this a pop-up can't be picked on /build until
 * after it has run.
 *
 * Dry by default: prints the row. --commit writes it.
 *
 *   pnpm exec tsx scripts/catalogue-add.ts --id 9300001 --name "Live-Plus Bronze Pop-up" \
 *     --series liveplusbronzepopup --year 2010 --stadium "2026 Yankee Stadium" --dh --value 40-69 \
 *     --card-years 2026-2026 --fee "1,000 PP" --mode "…" --text "…" --note "…" [--commit]
 *
 * Ids from 9300001 up are hand-added events (the game's own id isn't known
 * until a dump shows it). catalogue:sync later finds the row by its name or
 * series and fills in its slot, so the event keeps this id and its history.
 * --year 2010 is the PT default ("default strategy & stats settings"), as the
 * catalogue records it everywhere else.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { tournaments } from "@/db/schema";

const argv = process.argv.slice(2);
const flag = (k: string) => argv.includes(`--${k}`);
const val = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const range = (k: string): [number, number] | null => {
  const v = val(k); if (v == null) return null;
  const m = /^(\d+)-(\d+)$/.exec(v); if (!m) throw new Error(`--${k} takes A-B, got "${v}"`);
  return [Number(m[1]), Number(m[2])];
};
const KNOWN = new Set(["id", "name", "series", "year", "stadium", "dh", "no-dh", "value", "card-years", "fee", "mode", "entrants", "text", "note", "commit"]);

async function main() {
  const unknown = argv.filter((a) => a.startsWith("--") && !KNOWN.has(a.slice(2)));
  if (unknown.length) throw new Error(`unknown flag${unknown.length > 1 ? "s" : ""}: ${unknown.join(" ")} (see the header of scripts/catalogue-add.ts)`);
  const id = Number(val("id")), name = val("name")?.trim(), series = val("series")?.trim();
  if (!Number.isInteger(id) || id < 9300001 || id > 9399999) throw new Error("--id takes a hand-added id, 9300001 to 9399999");
  if (!name || !series) throw new Error("--name and --series are required");
  if (!flag("dh") && !flag("no-dh")) throw new Error("say --dh or --no-dh");
  const stadium = val("stadium") ?? null;
  const value = range("value"), years = range("card-years");
  const entrants = val("entrants") != null ? Number(val("entrants")) : null;
  const text = val("text"), note = val("note");
  const year = val("year") != null ? Number(val("year")) : null;

  const [byId] = await db.select({ id: tournaments.id, name: tournaments.name }).from(tournaments).where(eq(tournaments.id, id));
  const [byName] = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.name, name));
  if (byName && byName.id !== id) throw new Error(`"${name}" is already event ${byName.id}; change that one with catalogue:set`);

  const row = {
    id, name, series,
    envYear: year,
    stadium,
    parkName: stadium ? stadium.replace(/^\d{4}\s+/, "") : null,
    dh: flag("dh"),
    ratingsMin: value?.[0] ?? null,
    ratingsMax: value?.[1] ?? null,
    cardYearMin: years?.[0] ?? null,
    cardYearMax: years?.[1] ?? null,
    fee: val("fee") ?? null,
    mode: val("mode") ?? null,
    entrants,
    isDraft: false,
    retired: false,
    restrictions: {
      ...(year === 2010 ? { notes: ["default RE"] } : {}),
      ...(text ? { text } : {}),
      ...(note ? { textFrom: note } : {}),
      ...(value ? { valueConfirmed: new Date().toISOString().slice(0, 10) } : {}),
    },
  };
  console.log(`${byId ? "Update" : "Add"} event ${id}: ${name}`);
  for (const [k, v] of Object.entries(row)) if (k !== "id" && k !== "name") console.log(`  ${k}: ${JSON.stringify(v)}`);
  if (!flag("commit")) { console.log("\nDry run: nothing written yet (--commit saves it)."); process.exit(0); }
  await db.insert(tournaments).values(row).onConflictDoUpdate({ target: tournaments.id, set: { ...row, updatedAt: new Date() } });
  console.log(`\nSaved event ${id}.`);
  process.exit(0);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
