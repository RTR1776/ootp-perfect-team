/**
 * Championship rosters — build, check and (optionally) save a legal roster for
 * each PTCS 6 championship berth from the latest collection, with the SAME fill
 * (lib/roster-fill), validator (lib/roster-rules) and card forms
 * (lib/card-forms) that /build uses. Prints a markdown report.
 *
 *   pnpm champ:rosters                       # the five berths, report only
 *   pnpm champ:rosters --save                # also save each as a roster
 *   pnpm champ:rosters --ids 9060008 --save  # one event
 *
 * Saved rosters are named "<event> · auto <date>"; re-running replaces a roster
 * of the same name for that event. Needs DATABASE_URL (read from .env.local).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_LOCAL = resolve(__dirname, "..", ".env.local");
if (!process.env.DATABASE_URL && existsSync(ENV_LOCAL)) {
  for (const line of readFileSync(ENV_LOCAL, "utf8").split("\n")) {
    if (line.trimStart().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    if (!process.env[key]) process.env[key] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { cards, cardSnapshots, collectionCards, rosters, seriesMeta, tournaments, uploads } from "../src/db/schema";
import { formRatings, hasVariantSplitRatings } from "../src/lib/card-forms";
import { fillRoster, fitMaps, HIT_POS, hitterRaw, pitcherRaw, type FillCard, type FillShape } from "../src/lib/roster-fill";
import { cardEligibility, validateRoster, type RosterRules, type RosterSlot } from "../src/lib/roster-rules";
import { projFip, projWoba } from "../src/lib/analytics/projection";

const DEFAULT_IDS = [9060002, 9060003, 9060004, 9060005, 9060008]; // Bronze, Silver, Gold, Diamond, Cap
const args = process.argv.slice(2);
const SAVE = args.includes("--save");
const idsArg = args[args.indexOf("--ids") + 1];
const IDS = args.includes("--ids") && idsArg ? idsArg.split(",").map(Number) : DEFAULT_IDS;
const TODAY = new Date().toISOString().slice(0, 10);

type PoolCard = FillCard & { pos: string; tier: string; bats: string | null; projAll: number | null; projL: number | null; projR: number | null };

async function main() {
  const [latest] = await db.select({ id: uploads.id, at: uploads.uploadedAt }).from(uploads).where(eq(uploads.kind, "collection")).orderBy(desc(uploads.id)).limit(1);
  if (!latest) throw new Error("No collection upload.");
  const [shop] = await db.select({ id: uploads.id }).from(uploads).where(eq(uploads.kind, "shop_list")).orderBy(desc(uploads.id)).limit(1);
  const owned = await db.select({ cardId: collectionCards.cardId, isVariant: collectionCards.isVariant, ratings: collectionCards.ratings })
    .from(collectionCards).where(eq(collectionCards.uploadId, latest.id));
  const baseSet = new Set(owned.filter((o) => !o.isVariant).map((o) => o.cardId!));
  const variants = new Map(owned.filter((o) => o.isVariant).map((o) => [o.cardId!, o.ratings]));
  const ownedIds = [...new Set(owned.map((o) => o.cardId!))];
  const universe = await db.select().from(cards);
  const byId = new Map(universe.map((c) => [c.cardId, c]));
  const prices = shop
    ? new Map((await db.select({ cardId: cardSnapshots.cardId, ask: cardSnapshots.sellOrderLow, last10: cardSnapshots.last10 })
        .from(cardSnapshots).where(eq(cardSnapshots.uploadId, shop.id))).map((p) => [p.cardId, p]))
    : new Map<number, { cardId: number; ask: number | null; last10: number | null }>();

  const out: string[] = [`# PTCS 6 championship rosters — built ${TODAY}`, "",
    `Collection snapshot: upload ${latest.id} (${latest.at.toISOString().slice(0, 10)}), ${ownedIds.length} distinct cards owned, ${variants.size} variants. Fill = /build's auto-fill (lib/roster-fill); checks = lib/roster-rules. Variants are used wherever owned and allowed — same card value, better ratings.`, ""];

  for (const id of IDS) {
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    if (!t) { out.push(`## ${id}: not in catalog`, ""); continue; }
    const rules: RosterRules = { ...t, restrictions: t.restrictions as RosterRules["restrictions"] };
    const rx = rules.restrictions;
    const variantsOk = rx?.variantsAllowed !== false;

    // ---- pool: every owned card in the form it will be used in
    const pool: PoolCard[] = [];
    for (const cid of ownedIds) {
      const c = byId.get(cid);
      if (!c) continue;
      const base = (c.ratings ?? {}) as Record<string, number>;
      const vr = variants.get(cid) ?? null;
      const useVariant = variantsOk && vr != null && hasVariantSplitRatings(vr, c.isPitcher);
      const ratings = useVariant ? formRatings(base, vr) : base;
      const card: PoolCard = {
        cardId: cid, name: c.name, val: c.cardValue, year: c.year, isPitcher: c.isPitcher, role: c.pitcherRole,
        cardType: c.cardType, ratings, baseOwned: baseSet.has(cid), variantOwned: vr != null,
        variant: useVariant || !baseSet.has(cid), pos: c.position ?? "", tier: c.tier ?? "", bats: c.bats,
        projAll: c.isPitcher ? projFip(ratings) : projWoba(ratings),
        projL: c.isPitcher ? projFip(ratings, "vL") : projWoba(ratings, "vL"),
        projR: c.isPitcher ? projFip(ratings, "vR") : projWoba(ratings, "vR"),
      };
      if (card.variant && !card.variantOwned) continue;
      if (cardEligibility(card, rules).errors.length) continue;
      pool.push(card);
    }

    // ---- shape, as /build sizes it
    const lineupPos = t.dh ? [...HIT_POS, "DH"] : [...HIT_POS];
    const [m] = t.series ? await db.select().from(seriesMeta).where(eq(seriesMeta.series, t.series)) : [];
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const bats = clamp(Math.round(m?.avgBats ?? lineupPos.length + 4), lineupPos.length, 22);
    const sp = clamp(Math.round(m?.avgSp ?? 5), 1, 9);
    const rp = clamp(26 - bats - sp, 1, 12);
    const shape: FillShape = {
      lineupPos, bats,
      spKeys: Array.from({ length: sp }, (_, i) => `SP${i + 1}`),
      rpKeys: ["CL", ...Array.from({ length: rp - 1 }, (_, i) => `RP${i + 1}`)],
      benchKeys: Array.from({ length: bats - lineupPos.length }, (_, i) => `BN${i + 1}`),
    };

    const fits = fitMaps(pool);
    const { slots, lambda } = fillRoster(pool, rules, shape, fits);
    const poolById = new Map(pool.map((c) => [c.cardId, c]));
    const rosterSlotsOut: RosterSlot[] = Object.entries(slots).map(([k, cardId]) => {
      const [a, b] = k.split(":");
      return { cardId, slot: b ?? a, versusHand: b ? a : "both", lineupOrder: b ? lineupPos.indexOf(b) + 1 : null, useVariant: poolById.get(cardId)?.variant ?? false };
    });
    const v = validateRoster(rosterSlotsOut, pool, rules);

    // ---- report
    const window = `${rules.ratingsMin ?? "—"}–${rules.ratingsMax ?? "—"}`;
    out.push(`## ${t.name}`, "",
      `${(rx as { announcedText?: string })?.announcedText ?? ""}`, "",
      `Pool: ${pool.length} eligible owned cards (${pool.filter((c) => !c.isPitcher).length} bats / ${pool.filter((c) => c.isPitcher).length} arms), value window ${window}, years ${rules.cardYearMin ?? "—"}–${rules.cardYearMax ?? "—"}${rx?.teamCap ? `, cap ${rx.teamCap}` : ""}. Shape ${bats} bats / ${sp} SP / ${rp} RP${m ? ` (series typical)` : " (default)"}.`,
      "",
      `**${v.ready ? "READY — passes every recorded rule" : "NOT READY"}** · ${v.counts.players}/${v.counts.target} players · value ${v.counts.value}${rx?.teamCap ? `/${rx.teamCap}` : ""} · ${v.counts.variants} variants${lambda > 0 ? ` · cap penalty λ=${lambda.toFixed(3)}` : ""}`);
    if (!v.ready) out.push("", ...[...v.errors, ...v.incomplete].map((e) => `- ${e.message}`));
    out.push("");
    const line = (cid: number | undefined, hand: "R" | "L" | null) => {
      const c = cid != null ? poolById.get(cid) : undefined;
      if (!c) return "—";
      const proj = hand === "L" ? c.projL : hand === "R" ? c.projR : c.projAll;
      const fit = hand === "L" ? fits.fitL.get(c.cardId) : fits.fitR.get(c.cardId);
      const pr = c.isPitcher ? (proj == null ? "" : `pFIP ${proj.toFixed(2)}`) : (proj == null ? "" : `pWOBA ${proj.toFixed(3).replace(/^0/, "")}`);
      return `${c.name}${c.variant ? " (VAR)" : ""} · ${c.isPitcher ? c.role ?? "P" : c.pos}${c.bats ? ` ${c.bats}` : ""} · ${c.tier} ${c.val} · ${pr} · fit ${fit}`;
    };
    for (const hand of ["R", "L"] as const) {
      out.push(`### vs ${hand}HP`, "", "| # | Pos | Card |", "|---|---|---|");
      lineupPos.forEach((p, i) => out.push(`| ${i + 1} | ${p} | ${line(slots[`${hand}:${p}`], hand)} |`));
      out.push("");
    }
    out.push("### Rotation and bullpen", "", "| Slot | Card |", "|---|---|");
    for (const k of [...shape.spKeys, ...shape.rpKeys]) out.push(`| ${k} | ${line(slots[k], null)} |`);
    out.push("", "### Bench", "", "| Slot | Card |", "|---|---|");
    for (const k of shape.benchKeys) out.push(`| ${k} | ${line(slots[k], null)} |`);
    out.push("");

    // ---- substitutions: next-best OWNED alternative for each vs-RHP starter
    const rostered = new Set(Object.values(slots));
    out.push("### Next-best owned alternative at each position (vs RHP, by fit)", "", "| Pos | Starter | Alternative | Fit Δ |", "|---|---|---|---|");
    for (const p of lineupPos) {
      const sid = slots[`R:${p}`]; const s = sid != null ? poolById.get(sid) : undefined;
      const alt = pool.filter((c) => !c.isPitcher && !rostered.has(c.cardId) && (p === "DH" || (c.ratings[`Pos Rating ${p}`] ?? 0) > 0))
        .sort((a, b) => (fits.fitR.get(b.cardId) ?? 0) - (fits.fitR.get(a.cardId) ?? 0))[0];
      if (!s) continue;
      out.push(`| ${p} | ${s.name} (${fits.fitR.get(s.cardId)}) | ${alt ? `${alt.name} · ${alt.tier} ${alt.val}` : "—"} | ${alt ? (fits.fitR.get(alt.cardId) ?? 0) - (fits.fitR.get(s.cardId) ?? 0) : ""} |`);
    }
    out.push("");

    // ---- upgrades: legal UNOWNED cards that would outscore a current starter at a position they play
    const starters = new Map<string, PoolCard>();
    for (const p of lineupPos) { const sid = slots[`R:${p}`]; if (sid != null) starters.set(p, poolById.get(sid)!); }
    const rotation = shape.spKeys.map((k) => slots[k]).filter((x): x is number => x != null).map((cid) => poolById.get(cid)!);
    const worstSp = rotation.sort((a, b) => pitcherRaw(a, 0.45) - pitcherRaw(b, 0.45))[0];
    const headroom = rx?.teamCap != null ? rx.teamCap - v.counts.value : null;
    type Up = { name: string; tier: string; val: number | null; replaces: string; delta: number; valDelta: number; ask: number | null; last10: number | null };
    const ups: Up[] = [];
    const ownedSet = new Set(ownedIds);
    for (const c of universe) {
      if (ownedSet.has(c.cardId)) continue;
      const r = (c.ratings ?? {}) as Record<string, number>;
      const probe: FillCard = { cardId: c.cardId, name: c.name, val: c.cardValue, year: c.year, isPitcher: c.isPitcher, role: c.pitcherRole, cardType: c.cardType, ratings: r, baseOwned: true, variantOwned: false, variant: false };
      if (cardEligibility(probe, rules).errors.length) continue;
      const price = prices.get(c.cardId);
      if (c.isPitcher) {
        if (!worstSp || c.pitcherRole !== "SP") continue;
        const d = pitcherRaw(probe, 0.45) - pitcherRaw(worstSp, 0.45);
        if (d > 0) ups.push({ name: c.name, tier: c.tier ?? "", val: c.cardValue, replaces: `${worstSp.name} (SP${shape.spKeys.length > 1 ? `, weakest of ${shape.spKeys.length}` : ""})`, delta: d, valDelta: (c.cardValue ?? 0) - (worstSp.val ?? 0), ask: price?.ask ?? null, last10: price?.last10 ?? null });
      } else {
        let best: { p: string; d: number } | null = null;
        for (const [p, s] of starters) {
          if (p !== "DH" && (r[`Pos Rating ${p}`] ?? 0) <= 0) continue;
          const d = hitterRaw(probe, 0) - hitterRaw(s, 0);
          if (d > 0 && (!best || d > best.d)) best = { p, d };
        }
        if (best) ups.push({ name: c.name, tier: c.tier ?? "", val: c.cardValue, replaces: `${starters.get(best.p)!.name} (${best.p})`, delta: best.d, valDelta: (c.cardValue ?? 0) - (starters.get(best.p)!.val ?? 0), ask: price?.ask ?? null, last10: price?.last10 ?? null });
      }
    }
    ups.sort((a, b) => b.delta - a.delta);
    const fmtPP = (n: number | null) => (n == null || n === 0 ? "—" : n.toLocaleString());
    out.push(`### Upgrade candidates you don't own (legal here, would outscore a current starter)${headroom != null ? ` — cap headroom ${headroom}` : ""}`, "",
      `| Card | Tier/Val | Replaces | Raw Δ | Val Δ${headroom != null ? " (fits cap?)" : ""} | Ask PP | Last-10 PP |`, "|---|---|---|---|---|---|---|");
    for (const u of ups.slice(0, 12)) {
      const fits = headroom == null ? "" : u.valDelta <= headroom ? " ✓" : ` ✗ (needs ${u.valDelta - headroom} more)`;
      out.push(`| ${u.name} | ${u.tier} ${u.val ?? "?"} | ${u.replaces} | +${u.delta.toFixed(1)} | ${u.valDelta > 0 ? "+" : ""}${u.valDelta}${fits} | ${fmtPP(u.ask)} | ${fmtPP(u.last10)} |`);
    }
    if (!ups.length) out.push("| — | | | | | | |");
    out.push("", `Raw Δ is the Fit composite on the shop's ratings (not a percentile) — a rough ordering, not a run estimate. Ask = lowest sell order; 99,999 is OOTP's placeholder for no real ask. Prices from shop upload ${shop?.id ?? "?"}.`, "");

    // ---- save
    if (SAVE) {
      const name = `${t.name} · auto ${TODAY}`;
      const existing = await db.select({ id: rosters.id }).from(rosters).where(and(eq(rosters.tournamentId, t.id), eq(rosters.name, name)));
      if (existing.length) await db.delete(rosters).where(inArray(rosters.id, existing.map((e) => e.id)));
      const notes = JSON.stringify({ version: 1, status: v.ready ? "ready" : "draft", source: "scripts/champ-rosters.ts", collectionUploadId: latest.id, lambda, checkedAt: new Date().toISOString(), validation: v });
      const payload = JSON.stringify(rosterSlotsOut.map((s) => ({ card_id: s.cardId, slot: s.slot, versus_hand: s.versusHand, lineup_order: s.lineupOrder, use_variant: s.useVariant })));
      const saved = await db.execute(sql`
        with saved as (
          insert into rosters(name,tournament_id,notes) values(${name},${t.id},${notes}) returning id
        ), inserted as (
          insert into roster_slots(roster_id,card_id,slot,versus_hand,lineup_order,use_variant)
          select saved.id,s.card_id,s.slot,s.versus_hand,s.lineup_order,s.use_variant
          from saved cross join jsonb_to_recordset(${payload}::jsonb)
          as s(card_id integer,slot text,versus_hand text,lineup_order integer,use_variant boolean)
          returning roster_id
        ) select id from saved where exists(select 1 from inserted)`);
      const rows = (Array.isArray(saved) ? saved : (saved as unknown as { rows: unknown[] }).rows) as { id: number }[];
      out.push(`Saved as roster #${rows[0]?.id} "${name}" (${v.ready ? "ready" : "draft"}).`, "");
    }
  }
  console.log(out.join("\n"));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
