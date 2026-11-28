/**
 * Apply a tier refresh post to the catalogue on the day it goes live, with
 * the format date that splits each event's old exports from its new ones.
 *
 *   pnpm refresh:apply --file "../Tourney Data/refresh-2026-12.json"                  (dry: prints every change)
 *   pnpm refresh:apply --file … --patch-out ../Inbox/rosters/refresh-patch.json        (rules for current-rosters --patch)
 *   pnpm refresh:apply --file … --live 2026-12-02 --commit                             (writes the catalogue)
 *   [--only 125,165] limits it to those slots.
 *
 * Why not import:refresh: that script seeds a NEW row for a renamed slot and
 * retires the old one, which predates the format date. Since 2026-11 a slot
 * keeps its row and series through a rename (the 5L precedent): the row is
 * renamed, its rules rewritten, the old rules kept under
 * restrictions.previousFormat, and restrictions.formatSince set to the day the
 * new format first ran. From then on
 *   - /build sets the series' old exports aside as this event's own play
 *     (exportsPredate), and
 *   - the filer's next import of the series files every run before that day
 *     under "<slug>-preYYYYMMDD" (import-observed), so the series becomes the
 *     new format's play with no hand work.
 *
 * A renamed slot starts from a clean slate: card sets, slots, caps, variant
 * and LE rules, card years and the value window are what the post and the new
 * name say, not what the old event had. A restated slot ("is now 1977 RE,
 * 1977 Oakland Coliseum") keeps every rule the post doesn't mention.
 *
 * Entries marked `deferred` are applied only with --live (the post went up
 * before the deploy). Hand overrides on an entry, always with a `why`:
 * cardYears [min, max] and value [min, max] for what a name says and the
 * parser can't read ("Daily Iron 1970-Present"); eraNotSet when "X cards only"
 * names an era (Deadball) rather than a card set.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { parks, tournaments } from "@/db/schema";
import { editCatalogueRules, type CatalogueEdit, type CatalogueRules } from "@/lib/catalogue-edit";
import { parseRestrictions, tierWindowFromName } from "@/lib/ingest/restrictions";
import { chicagoDay } from "@/lib/format";

const argv = process.argv.slice(2);
const val = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const flag = (k: string) => argv.includes(`--${k}`);
const KNOWN = new Set(["file", "live", "commit", "patch-out", "only"]);
const SECTIONS = ["iron", "bronze", "silver", "gold", "diamond", "open", "weekly"];
/** The parks table's spelling where the post's differs. */
const PARK_ALIAS: Record<string, string> = { "Heinsohn Park": "Heinsohn Ballpark" };
/** Restriction keys a renamed slot does not inherit from the event it replaces. */
const OLD_EVENT_KEYS = ["cardTypes", "slots", "teamCap", "variantCap", "variantsAllowed", "noLimitedEdition", "valueConfirmed",
  "valueWindowFrom", "notes", "teams", "bestOf", "reRandom", "text", "refreshNote", "seededFrom"];

interface Entry {
  old: string | null; new: string | null; text: string; deferred?: string; added?: boolean;
  cardYears?: [number, number]; value?: [number, number]; why?: string;
  /** The post's "X cards only" is an era, not a card set ("Deadball cards only"): use cardYears instead. */
  eraNotSet?: boolean;
}

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

async function main() {
  const unknown = argv.filter((a) => a.startsWith("--") && !KNOWN.has(a.slice(2)));
  if (unknown.length) throw new Error(`unknown flag: ${unknown.join(" ")} (see the header of scripts/refresh-apply.ts)`);
  const file = val("file");
  if (!file) throw new Error("--file <refresh json> is required");
  const LIVE = val("live");
  if (LIVE != null && !isDay(LIVE)) throw new Error(`--live takes YYYY-MM-DD, got "${LIVE}"`);
  if (flag("commit") && !LIVE) throw new Error("--commit needs --live YYYY-MM-DD: the Chicago day the new formats first ran");
  const only = val("only")?.split(",").map(Number);
  const refresh = JSON.parse(readFileSync(file, "utf8"));
  const today = chicagoDay(new Date())!;
  // Without --live (a dry run, or rules for a pre-build) the format date is a
  // placeholder after today, so a pre-build already treats every export on
  // file as the old format's.
  const since = LIVE ?? new Date(Date.parse(`${today}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const note = `${file.split("/").pop()} (${refresh.source?.split(",")[0] ?? "refresh post"}, ${refresh.capturedOn ?? "?"})`;

  const parkNames = (await db.select({ name: parks.name }).from(parks)).map((p) => p.name);
  const sq = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
  const resolvePark = (bare: string): string | null => {
    const b = PARK_ALIAS[bare] ?? bare;
    if (parkNames.includes(b)) return b;
    const hits = parkNames.filter((p) => p.includes(b) || b.includes(p));
    if (hits.length === 1) return hits[0];
    const s2 = parkNames.filter((p) => sq(p) === sq(b));
    return s2.length === 1 ? s2[0] : null;
  };
  const rows = await db.select().from(tournaments);
  const patch: Record<string, Record<string, unknown>> = {};
  const writes: { id: number; set: Record<string, unknown> }[] = [];
  const problems: string[] = [];

  for (const section of SECTIONS) {
    for (const [slotStr, e] of Object.entries((refresh[section] ?? {}) as Record<string, Entry>)) {
      const slot = Number(slotStr);
      if (only && !only.includes(slot)) continue;
      if (e.deferred && !LIVE && flag("commit")) continue;
      const live = rows.filter((t) => t.slot === slot && !t.retired);
      const t = live.length === 1 ? live[0] : live.find((x) => e.old && sq(x.name).includes(sq(e.old).replace(/^daily/, "")));
      if (!t) { problems.push(`${slot} ${e.new ?? e.old}: ${live.length ? `${live.length} live rows on the slot, none named like "${e.old}"` : "no live catalogue row on this slot"}`); continue; }
      const renamed = e.new != null && sq(e.new) !== sq(t.name);
      const name = e.new ?? t.name;
      const r = parseRestrictions(e.text);
      if (e.eraNotSet) r.cardTypes = null;
      const rx = (t.restrictions ?? {}) as Record<string, unknown>;

      // Park: the post's year and name, spelled as the parks table has it.
      let stadium: string | undefined, parkName: string | null | undefined;
      if (r.park) {
        const year = /^(\d{4})\s+/.exec(r.park)?.[1];
        const bare = r.park.replace(/^\d{4}\s+/, "").trim();
        parkName = resolvePark(bare);
        if (!parkName) problems.push(`${slot} ${name}: park "${r.park}" is not in the parks table (no park factors)`);
        stadium = `${year ? `${year} ` : ""}${parkName ?? bare}`;
      }
      const defaultRe = r.notes.includes("default RE");
      const years: [number, number] | null | undefined = e.cardYears
        ?? (r.yearMin != null || r.yearMax != null ? [r.yearMin ?? 1800, r.yearMax ?? 2026] : renamed ? null : undefined);
      const noLe = r.notes.includes("no LE");

      const edit: CatalogueEdit = {
        at: today, formatSince: since, note,
        envYear: r.reYear ?? (defaultRe ? null : undefined),
        stadium, dh: r.dh ?? undefined, cardYears: years,
        teamCap: r.teamCap ?? (renamed ? null : undefined),
        variantCap: r.variantCap ?? (renamed ? null : undefined),
        noLimitedEdition: noLe ? true : renamed ? false : undefined,
        cardTypes: r.cardTypes ?? undefined,
        slots: r.slots ?? undefined,
        drop: renamed ? OLD_EVENT_KEYS.filter((k) => !(k === "cardTypes" && r.cardTypes) && !(k === "slots" && r.slots)) : undefined,
      };
      const before: CatalogueRules = { envYear: t.envYear, stadium: t.stadium, parkName: t.parkName, dh: t.dh, ratingsMin: t.ratingsMin,
        ratingsMax: t.ratingsMax, cardYearMin: t.cardYearMin, cardYearMax: t.cardYearMax, restrictions: t.restrictions ?? null };
      const after = editCatalogueRules(before, edit);
      if (parkName !== undefined) after.parkName = parkName;
      const ra = after.restrictions!;
      ra.refreshText = e.text; ra.refreshedName = name;
      if (r.variantsAllowed != null && r.variantCap == null) ra.variantsAllowed = r.variantsAllowed;
      if (r.teams != null) ra.teams = r.teams;
      if (r.bestOf != null) ra.bestOf = r.bestOf;
      const notes = r.notes.filter((n) => n !== "no LE");
      if (notes.length) ra.notes = renamed ? notes : [...new Set([...(Array.isArray(rx.notes) ? rx.notes as string[] : []).filter((n) => !/default RE|random RE/.test(n) || defaultRe), ...notes])];
      else if (!defaultRe && r.reYear != null && Array.isArray(ra.notes)) ra.notes = (ra.notes as string[]).filter((n) => n !== "default RE");
      if (Array.isArray(ra.notes) && !ra.notes.length) delete ra.notes;
      if (e.why) ra.refreshNote = e.why;

      // Value window: stated, or what the new name says. A renamed "Silver
      // Only Cap" that became "Silver Cap" loses its floor.
      const win = tierWindowFromName(name);
      let vmin: number | null | undefined, vmax: number | null | undefined, valueFrom: string | undefined;
      if (e.value) { [vmin, vmax] = e.value; valueFrom = `entry: ${e.why ?? "hand override"}`; }
      else if (r.valueMin != null || r.valueMax != null) { vmin = r.valueMin ?? 40; vmax = r.valueMax; valueFrom = "post"; }
      else if (renamed) { vmin = win?.min ?? (win ? 40 : null); vmax = win?.max ?? null; valueFrom = win ? `name: ${win.basis}` : undefined; }
      if (vmin !== undefined) {
        after.ratingsMin = vmin === 40 && vmax == null ? null : vmin;
        after.ratingsMax = vmax ?? null;
        if (valueFrom?.startsWith("name")) ra.valueWindowFrom = valueFrom; else delete ra.valueWindowFrom;
      }

      const set: Record<string, unknown> = { ...after };
      if (renamed) set.name = name;
      if (r.bestOf != null) set.mode = `BO${r.bestOf}`;
      if (r.teams != null) set.entrants = r.teams;
      if (t.isDraft && e.added) set.isDraft = false;

      // Print what changes.
      const lines: string[] = [];
      if (renamed) lines.push(`name: "${t.name}" → "${name}"`);
      for (const k of ["envYear", "stadium", "parkName", "dh", "ratingsMin", "ratingsMax", "cardYearMin", "cardYearMax"] as const) {
        if (JSON.stringify((before as any)[k]) !== JSON.stringify((after as any)[k])) lines.push(`${k}: ${JSON.stringify((before as any)[k])} → ${JSON.stringify((after as any)[k])}`);
      }
      for (const k of ["mode", "entrants", "isDraft"] as const) if (set[k] !== undefined && set[k] !== (t as any)[k]) lines.push(`${k}: ${JSON.stringify((t as any)[k])} → ${JSON.stringify(set[k])}`);
      for (const k of new Set([...Object.keys(rx), ...Object.keys(ra)])) {
        if (["previousFormat", "textFrom", "refreshText", "refreshedName", "formatSince", "formatSinceFrom"].includes(k)) continue;
        if (JSON.stringify(rx[k]) !== JSON.stringify(ra[k])) lines.push(`restrictions.${k}: ${JSON.stringify(rx[k]) ?? "—"} → ${JSON.stringify(ra[k]) ?? "(removed)"}`);
      }
      console.log(`${String(t.id).padStart(8)}  slot ${slot}  ${name}${renamed ? "  (renamed)" : ""}${e.deferred && !LIVE ? "  [not live yet]" : ""}`);
      for (const l of lines) console.log(`            ${l}`);
      if (!lines.length) console.log("            no change");
      console.log(`            formatSince → ${since}${LIVE ? "" : " (placeholder until --live)"}`);

      writes.push({ id: t.id, set });
      // current-rosters --patch: catalogue:set's edit form, with the window and
      // park already resolved, so a pre-build reads exactly what --commit writes.
      patch[String(t.id)] = {
        ...(renamed ? { name } : {}),
        ...(edit.envYear !== undefined ? { envYear: edit.envYear } : {}),
        ...(stadium ? { stadium } : {}), ...(edit.dh !== undefined ? { dh: edit.dh } : {}),
        ...(vmin !== undefined ? { value: [after.ratingsMin ?? 40, after.ratingsMax ?? 110] } : {}),
        ...(years !== undefined ? { cardYears: years } : {}),
        ...(edit.teamCap !== undefined ? { teamCap: edit.teamCap } : {}),
        ...(edit.variantCap !== undefined ? { variantCap: edit.variantCap } : {}),
        ...(edit.noLimitedEdition !== undefined ? { noLimitedEdition: edit.noLimitedEdition } : {}),
        ...(r.cardTypes ? { cardTypes: r.cardTypes } : {}),
        ...(r.slots ? { slots: Object.entries(r.slots).map(([k, n]) => `${k}${n}`).join(", ") } : {}),
        ...(edit.drop?.length ? { drop: edit.drop } : {}),
        formatSince: since,
      };
    }
  }

  if (problems.length) { console.log("\nCHECK:"); for (const p of problems) console.log(`  ${p}`); }
  if (val("patch-out")) { writeFileSync(val("patch-out")!, JSON.stringify(patch, null, 1)); console.log(`\npatch for current-rosters --patch: ${val("patch-out")} (${Object.keys(patch).length} events)`); }
  if (!flag("commit")) { console.log(`\n${writes.length} events. Dry run: nothing written (--live YYYY-MM-DD --commit writes).`); process.exit(0); }
  for (const w of writes) await db.update(tournaments).set({ ...w.set, updatedAt: new Date() } as any).where(eq(tournaments.id, w.id));
  console.log(`\nWrote ${writes.length} events, format date ${since}. Old rules are under restrictions.previousFormat.`);
  process.exit(0);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
