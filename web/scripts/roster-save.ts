/**
 * Save a roster file as a named roster on /build for a catalogue tournament,
 * so a build made at the command line shows up in the page's saved-roster
 * list for that event (same tables and the same validation the /api/rosters
 * POST uses, minus the browser).
 *
 *   pnpm roster:save --file Inbox/rosters/x.txt --tournament 541 --name "Claude pick 2026-09-19"
 *
 * The file is one slot per line: "R:3B Hank Thompson", "L:C Josh Gibson",
 * "SP1 …", "CL …", "RP3 …", "BN2 …"; pin a variant with "Name (VAR)". Names
 * match the card table case-insensitively; the higher value wins a tie.
 */
import { readFileSync } from "node:fs";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, collectionCards, tournaments, uploads } from "@/db/schema";
import { HIT_POS } from "@/lib/roster-fill";
import { cardEligibility, validateRoster, type RosterRules, type RosterSlot } from "@/lib/roster-rules";

const argv = process.argv.slice(2);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const FILE = val("file"), TID = Number(val("tournament")), NAME = val("name");
if (!FILE || !TID || !NAME) { console.error("usage: pnpm roster:save --file FILE --tournament ID --name NAME"); process.exit(1); }

async function main() {
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, TID));
  if (!t) throw new Error(`no tournament ${TID}`);
  const [latest] = await db.select({ id: uploads.id }).from(uploads).where(eq(uploads.kind, "collection")).orderBy(desc(uploads.id)).limit(1);
  const owned = latest ? await db.select().from(collectionCards).where(eq(collectionCards.uploadId, latest.id)) : [];
  const base = new Set(owned.filter((c) => !c.isVariant).map((c) => c.cardId)), variants = new Set(owned.filter((c) => c.isVariant).map((c) => c.cardId));
  const universe = await db.select().from(cards);
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  const lineupPos = t.dh ? [...HIT_POS, "DH"] : [...HIT_POS];
  const rules = { ...t, restrictions: t.restrictions as RosterRules["restrictions"] } as unknown as RosterRules;
  const asCard = (c: (typeof universe)[number]) => ({ cardId: c.cardId, name: c.name, val: c.cardValue, year: c.year, isPitcher: c.isPitcher, role: c.pitcherRole, ratings: (c.ratings ?? {}) as Record<string, number>, cardType: c.cardType, baseOwned: base.has(c.cardId), variantOwned: variants.has(c.cardId) });
  const slots: RosterSlot[] = [];
  for (const l of readFileSync(FILE!, "utf8").split(/\r?\n/).map((x) => x.trim()).filter((x) => x && !x.startsWith("#"))) {
    const m = /^(\S+)\s+(.+)$/.exec(l); if (!m) continue;
    const key = m[1].toUpperCase(); let who = m[2].trim();
    const wantVar = /\(VAR\)$/i.test(who); who = who.replace(/\s*\(VAR\)$/i, "");
    const wantPitcher = /^(SP|RP|CL)/.test(key);
    const hits = universe.filter((c) => norm(c.name) === norm(who) && c.isPitcher === wantPitcher && (wantVar ? variants.has(c.cardId) : base.has(c.cardId) || variants.has(c.cardId)))
      .sort((a, b) => (b.cardValue ?? 0) - (a.cardValue ?? 0));
    // A name can be several cards (a 84 and a 100+); take the legal one for THIS event first.
    const legal = hits.filter((c) => cardEligibility(asCard(c), rules).errors.length === 0);
    const c = (legal.length ? legal : hits)[0];
    if (!c) { console.error(`!! ${l}: not owned / not in the card table`); process.exit(1); }
    const [a, b] = key.split(":");
    slots.push({ cardId: c.cardId, slot: b ?? a, versusHand: b ? a : "both", lineupOrder: b ? lineupPos.indexOf(b) + 1 : null, useVariant: wantVar || (!base.has(c.cardId) && variants.has(c.cardId)) });
  }
  const v = validateRoster(slots, universe.map(asCard), rules);
  console.log(`${t.name}: ${slots.length} slots · ${v.ready ? "ready" : "DRAFT: " + [...v.errors, ...v.incomplete].map((e) => e.message).join(" | ")}`);
  const notes = JSON.stringify({ version: 1, status: v.ready ? "ready" : "draft", collectionUploadId: latest?.id, checkedAt: new Date().toISOString(), validation: v, via: "roster:save", file: FILE });
  const json = JSON.stringify(slots.map((s) => ({ card_id: s.cardId, slot: s.slot, versus_hand: s.versusHand, lineup_order: s.lineupOrder, use_variant: s.useVariant })));
  if (argv.includes("--replace")) await db.execute(sql`delete from rosters where tournament_id = ${TID} and name = ${NAME}`);
  const saved = (await db.execute(sql`
    with saved as (insert into rosters(name, tournament_id, notes) values (${NAME}, ${TID}, ${notes}) returning id),
    inserted as (
      insert into roster_slots(roster_id, card_id, slot, versus_hand, lineup_order, use_variant)
      select saved.id, s.card_id, s.slot, s.versus_hand, s.lineup_order, s.use_variant
      from saved cross join jsonb_to_recordset(${json}::jsonb) as s(card_id integer, slot text, versus_hand text, lineup_order integer, use_variant boolean)
      returning roster_id)
    select id from saved where exists (select 1 from inserted)`)) as unknown as { rows?: { id: number }[] } | { id: number }[];
  const id = (Array.isArray(saved) ? saved : saved.rows ?? [])[0]?.id;
  console.log(`saved as roster ${id} — /build → ${t.name} → saved rosters → "${NAME}"`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
