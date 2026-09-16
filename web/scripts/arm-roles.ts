/**
 * SP-IN-THE-BULLPEN: what the field does, and what it would cost L.J.
 *
 * The model currently scores every arm with a role term (roleRuns): an RP card
 * gets -3.79 runs/700 BF, a CL -4.94, an SP +0.82. That ~4.6-run gap is why an
 * SP card essentially never wins a bullpen slot, even when it is the better
 * card. The measured basis for that gap is runs allowed, and runs allowed for a
 * reliever is inflated by inherited-runner accounting (30% of inherited runners
 * score and are charged to the man who left them). On FIP the gap is ~0.
 *
 * So this prints every arm twice: with the role term (what the optimiser sees)
 * and without it (pure card quality), plus value efficiency.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, collectionCards, uploads } from "@/db/schema";
import { eraTable } from "@/lib/analytics/runenv-view";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { roleRuns } from "@/lib/analytics/card-value";
import { formRatings } from "@/lib/card-forms";

const argv = process.argv.slice(2);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const num = (k: string, d: number | null = null) => { const v = val(k); return v == null ? d : Number(v); };
const MIN = num("min", 80)!, MAX = num("max", 102)!;
const YEAR = val("year", "2010")!;

const main = async () => {
  const era = eraTable[YEAR]!;
  const [latest] = await db.select({ id: uploads.id }).from(uploads)
    .where(eq(uploads.kind, "collection")).orderBy(desc(uploads.id)).limit(1);
  const owned = await db.select({ cardId: collectionCards.cardId, isVariant: collectionCards.isVariant, ratings: collectionCards.ratings })
    .from(collectionCards).where(eq(collectionCards.uploadId, latest!.id));
  const baseSet = new Set(owned.filter((o) => !o.isVariant).map((o) => o.cardId!));
  const variants = new Map(owned.filter((o) => o.isVariant).map((o) => [o.cardId!, o.ratings]));
  const universe = await db.select().from(cards);
  const byId = new Map(universe.map((c) => [c.cardId, c]));

  const pool: any[] = [];
  for (const cid of [...new Set(owned.map((o) => o.cardId!))]) {
    const c = byId.get(cid); if (!c) continue;
    if (c.cardValue == null || c.cardValue < MIN || c.cardValue > MAX) continue;
    const base = (c.ratings ?? {}) as Record<string, number>;
    const vr = variants.get(cid) ?? null;
    const ratings = vr ? formRatings(base, vr, c.position) : base;
    if (!vr && !baseSet.has(cid)) continue;
    pool.push({ cardId: cid, name: c.name, val: c.cardValue, year: c.year, isPitcher: c.isPitcher,
      role: c.pitcherRole, cardType: c.cardType, ratings, bats: c.bats, variant: vr != null });
  }
  const fits = envFitMaps(pool, { era: era.rates, park: null });
  const arms = pool.filter((c) => c.isPitcher).map((c) => {
    const stm = c.ratings["Stamina"] ?? 0;
    const withRole = fits.runsR.get(c.cardId) ?? -99;
    const pure = withRole + roleRuns(c.role, stm);       // strip the role term
    return { ...c, stm, withRole, pure, perPt: pure / c.val };
  });
  const f = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;
  const row = (a: any, i: number) =>
    `${String(i + 1).padStart(3)}. ${a.name.padEnd(24)}${String(a.val).padStart(4)} ${String(a.role ?? "").padEnd(3)} STM ${String(Math.round(a.stm)).padStart(3)}  quality ${f(a.pure).padStart(6)}  as-scored ${f(a.withRole).padStart(6)}  per pt ${(a.perPt).toFixed(3)}${a.variant ? "  VAR" : ""}`;

  console.log(`=== ${MIN}-${MAX} arms, ${YEAR} RE, neutral park — ${arms.length} owned\n`);
  console.log("--- TOP 30 BY PURE CARD QUALITY (role term removed) ---");
  [...arms].sort((a, b) => b.pure - a.pure).slice(0, 30).forEach((a, i) => console.log(row(a, i)));
  console.log("\n--- BEST RELIEF-LABELLED ARMS (RP/CL), by quality ---");
  [...arms].filter((a) => a.role !== "SP").sort((a, b) => b.pure - a.pure).slice(0, 14).forEach((a, i) => console.log(row(a, i)));
  console.log("\n--- BEST SP-LABELLED ARMS, by quality ---");
  [...arms].filter((a) => a.role === "SP").sort((a, b) => b.pure - a.pure).slice(0, 14).forEach((a, i) => console.log(row(a, i)));
  const BAND = num("band-max", 89)!;
  const band = arms.filter((a) => a.val <= BAND);
  console.log(`\n=== THE CAP BAND: arms at ${MIN}-${BAND} (what a 2242/26 build can actually afford) ===`);
  console.log("--- relief-labelled, by quality ---");
  band.filter((a) => a.role !== "SP").sort((a, b) => b.pure - a.pure).slice(0, 14).forEach((a, i) => console.log(row(a, i)));
  console.log("--- SP-labelled, by quality ---");
  band.filter((a) => a.role === "SP").sort((a, b) => b.pure - a.pure).slice(0, 14).forEach((a, i) => console.log(row(a, i)));
  console.log("--- band, by runs PER VALUE POINT (all roles) ---");
  band.sort((a, b) => b.perPt - a.perPt).slice(0, 20).forEach((a, i) => console.log(row(a, i)));

  const { writeFileSync } = await import("node:fs");
  writeFileSync("/tmp/arms.json", JSON.stringify(arms.map((a) => ({
    name: a.name, val: a.val, role: a.role, stm: Math.round(a.stm),
    pure: Number(a.pure.toFixed(2)), scored: Number(a.withRole.toFixed(2)), variant: a.variant,
  }))));
  console.log("\nwrote /tmp/arms.json");
  process.exit(0);
};
main();
