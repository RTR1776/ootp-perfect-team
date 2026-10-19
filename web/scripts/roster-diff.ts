/**
 * Score the roster you actually have loaded, then list the swaps worth
 * making, biggest first — so a change mid-week is the top three moves and
 * not a rebuild.
 *
 *   pnpm roster:diff --roster my.txt --series goldweekly --year 1989 \
 *     --park "Candlestick Park" --park-year 1979 --dh --min 40 --max 89
 *
 * Takes env-roster's event flags (--slots, --sp/--rp/--bats, --role-trust,
 * --min-pos, --obs-exclude, --no-team-weights, …) with env-roster's defaults:
 * pass the same ones the roster was built with.
 *
 * The roster file is one slot per line, "R:3B Hank Thompson", "L:C Mike
 * Zunino", "SP1 Jim Kaat", "CL Joe Beggs", "RP3 …", "BN2 …". Lines starting
 * with # are ignored. A line ending "#86429" (env-roster's and current-rosters'
 * load files) is that card id. Otherwise names match the card table
 * case-insensitively; when you own more than one legal card of that name the
 * higher value wins — pin one with "Name 87" (or "Name (VAR)" for the variant
 * form).
 *
 * The pool, environment and objective are env-roster's own (lib/event-model),
 * so "your roster as loaded" is the number env-roster prints as "objective:"
 * for the same board. The climb is env-roster's too, one pass at a time from
 * YOUR roster so each step's gain is printed in the order the hill-climb takes
 * them, which is steepest-first. From an env-roster optimum it finds nothing.
 */
import { readFileSync } from "node:fs";
import { validateRoster, type RosterSlot } from "@/lib/roster-rules";
import { BACKUP_PENALTY, backupPositions, longMenShort, missingBackups, optimizeRoster } from "@/lib/roster-optimize";
import { climbOptions, eventModel, eventRules, loadEventPool, readEventFlags, type EventCard } from "@/lib/event-model";
import { LONG_MAN_STAMINA } from "@/lib/roster-audit";
import { cardIdOf, formIdForSlot } from "@/lib/two-way";

const argv = process.argv.slice(2);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const num = (k: string, d: number | null = null) => { const v = val(k); return v == null ? d : Number(v); };

const ROSTER = val("roster");
if (!ROSTER) { console.error("--roster FILE is required"); process.exit(1); }
const F = readEventFlags(argv);
const MAX_MOVES = num("max-moves", 30)!;
const f1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

async function main() {
  const rules = eventRules(F);
  // The setup's own lines (pool, field, weights) are printed with --verbose.
  const log = argv.includes("--verbose") ? console.log : () => {};
  const ev = await loadEventPool(F, rules, log);
  const { pool } = ev;

  /* ---- the roster file ---- */
  const lines = readFileSync(ROSTER!, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const fileKeys = lines.map((l) => (/^(\S+)/.exec(l)?.[1] ?? "").toUpperCase());
  const count = (re: RegExp) => fileKeys.filter((k) => re.test(k)).length;
  const fileSp = count(/^SP\d+$/), fileRp = count(/^(RP\d+|CL)$/), fileBn = count(/^BN\d+$/);
  const lineupSize = F.dh ? 9 : 8;
  // The staff shape is the FILE's when it lists a staff (a name that fails to
  // match still counts as a slot), else the event's (--sp/--rp/--bats, the series).
  const shapeOverride = fileSp && fileRp ? { sp: fileSp, rp: fileRp, bats: Math.max(lineupSize + fileBn, F.size - fileSp - fileRp) } : null;
  const m = await eventModel(F, rules, ev, { log, shapeOverride });
  const { shape, lineupPos, objective, rank, defAt, fits } = m;

  const slots: Record<string, number> = {};
  const unmatched: string[] = [], ambiguous: string[] = [];
  const poolById = new Map(pool.map((c) => [c.cardId, c]));
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  for (const l of lines) {
    const mm = /^(\S+)\s+(.+)$/.exec(l); if (!mm) continue;
    const key = mm[1].toUpperCase();
    let who = mm[2].trim();
    const idPin = /\s*#(\d+)$/.exec(who);
    if (idPin) {
      // A load file's card id; a two-way card's arm (or bat) slot means its other form.
      const id = formIdForSlot(Number(idPin[1]), key, (x) => poolById.get(x));
      if (poolById.has(id)) { slots[key] = id; continue; }
      who = who.slice(0, -idPin[0].length);
    }
    const wantVar = /\(VAR\)$/i.test(who); who = who.replace(/\s*\(VAR\)$/i, "");
    const valPin = /\s(\d{2,3})$/.exec(who); if (valPin) who = who.slice(0, -valPin[0].length);
    const hits = pool.filter((c) => norm(c.name) === norm(who) && (valPin ? c.val === Number(valPin[1]) : true) && (wantVar ? c.variant : true));
    const wantPitcher = /^(SP|RP|CL)/.test(key);
    const fit = hits.filter((c) => c.isPitcher === wantPitcher);
    // Different cards of one name: the higher value is the one in play (a
    // variant shares its base's value and is already the pool's form of it).
    const pick = (fit.length ? fit : hits).sort((a, b) => (b.val ?? 0) - (a.val ?? 0))[0];
    if (!pick) { unmatched.push(l); continue; }
    const others = (fit.length ? fit : hits).filter((c) => c.cardId !== pick.cardId);
    if (others.length) ambiguous.push(`${key} ${pick.name}: took the ${pick.val} (#${cardIdOf(pick.cardId)}) over ${others.map((c) => `the ${c.val}${c.variant ? " VAR" : ""} (#${cardIdOf(c.cardId)})`).join(", ")}`);
    slots[key] = pick.cardId;
  }
  if (ambiguous.length) console.log(`!! more than one card of that name in your legal pool — pin with "Name 87" or "#id":\n   ${ambiguous.join("\n   ")}`);
  if (unmatched.length) console.log(`!! not in your legal pool (check the name, value window, or the collection date): ${unmatched.join(" · ")}`);

  const missing = [...shape.lineupPos.flatMap((p) => [`R:${p}`, `L:${p}`]), ...shape.spKeys, ...shape.rpKeys, ...shape.benchKeys].filter((k) => slots[k] == null);
  if (missing.length) console.log(`!! slots the file did not fill (or whose card is not on record): ${missing.join(", ")} — the best available card is stood in so the rest can be scored`);
  // Two cards of one name get their value too, so a swap between them reads as one.
  const nameCount = new Map<string, number>();
  for (const c of pool) nameCount.set(`${c.name}|${c.isPitcher}`, (nameCount.get(`${c.name}|${c.isPitcher}`) ?? 0) + 1);
  const nameOf = (id: number | undefined) => {
    const c = id != null ? poolById.get(id) : undefined;
    return c ? `${c.name}${(nameCount.get(`${c.name}|${c.isPitcher}`) ?? 0) > 1 ? ` ${c.val}` : ""}${c.variant ? " (VAR)" : ""}` : "—";
  };
  const runsAt = (key: string, id: number) => {
    const c = poolById.get(id); if (!c) return null;
    const pos = key.includes(":") ? key.split(":")[1] : "";
    const r = key.startsWith("L:") ? fits.runsL.get(id) : fits.runsR.get(id);
    return r == null ? null : r + (pos && pos !== "DH" ? defAt(id, pos) : 0);
  };

  for (const k of missing) {
    const used = new Set(Object.values(slots));
    const pos = k.includes(":") ? k.split(":")[1] : k;
    const ok = (c: EventCard) => /^SP\d+$/.test(pos) ? c.isPitcher && c.role === "SP" : /^(RP\d+|CL)$/.test(pos) ? c.isPitcher : !c.isPitcher && (pos === "DH" || /^BN/.test(pos) || (c.ratings[`Pos Rating ${pos}`] ?? 0) >= 70);
    const best = pool.filter((c) => ok(c) && !used.has(c.cardId)).sort((a, b) => rank(k, b) - rank(k, a))[0];
    if (best) { slots[k] = best.cardId; console.log(`   ${k}: standing in ${best.name}`); }
  }
  const start = objective(slots);
  const v = validateRoster(Object.entries(slots).map(([k, cardId]): RosterSlot => {
    const [a, b] = k.split(":");
    return { cardId, slot: b ?? a, versusHand: b ? a : "both", lineupOrder: b ? lineupPos.indexOf(b) + 1 : null, useVariant: poolById.get(cardId)?.variant ?? false };
  }), pool, rules);
  const pr = m.pr;
  console.log(`\n=== ${F.series ?? "roster"} · ${F.year ?? "PT default"} RE${pr ? ` @ ${F.parkYear} ${F.park}` : ""} · ${F.dh ? "DH" : "no DH"} · lineups ${Math.round((1 - m.lhpShare) * 100)}/${Math.round(m.lhpShare * 100)} R/L${m.meta ? " (field)" : " (default)"} ===`);
  console.log(`shape ${shape.bats} bats / ${shape.spKeys.length} SP / ${shape.rpKeys.length} RP${shapeOverride ? " (the file's)" : ""} · weights SP ${m.spWeight.toFixed(2)}, RP ${m.rpWeight.toFixed(2)}, bench ${m.benchWeight}, gloves ×${m.glove.toFixed(2)} (env-roster's; --verbose for the setup)`);
  console.log(`your roster as loaded: ${start.toFixed(1)} runs · ${v.ready ? "legal" : "NOT LEGAL: " + [...v.errors, ...v.incomplete].map((e) => e.message).join(" | ")}`);

  const opts = { ...climbOptions(F, m), maxPasses: 1 };
  const noBackup = F.backups ? missingBackups(slots, poolById, backupPositions(pool, rules, F.minPos)) : [];
  const longShort = longMenShort(slots, poolById, F.minLongMen);
  if (noBackup.length) console.log(`!! no bench backup at ${noBackup.join(", ")} — the search charges ${BACKUP_PENALTY} runs each`);
  if (longShort) console.log(`!! ${longShort} long man${longShort === 1 ? "" : "en"} short of ${F.minLongMen} (pen arms with stamina ${LONG_MAN_STAMINA}+) — the search charges ${BACKUP_PENALTY} runs each`);
  console.log(`\nweakest slots as they stand (runs on that board, glove included):`);
  const keys = [...lineupPos.flatMap((p) => [`R:${p}`, `L:${p}`]), ...shape.spKeys, ...shape.rpKeys];
  const weak = keys.map((k) => ({ k, r: runsAt(k, slots[k]) ?? 0 })).sort((a, b) => a.r - b.r).slice(0, 6);
  for (const w of weak) console.log(`  ${w.k.padEnd(6)} ${nameOf(slots[w.k]).padEnd(28)} ${f1(w.r)}`);

  /* ---- one pass of env-roster's climb at a time, from your roster ---- */
  let cur = { ...slots }, n = 0;
  console.log(`\nswaps in the order the search takes them (steepest first) — do the top few and stop:`);
  while (n < MAX_MOVES) {
    const r = optimizeRoster(cur, pool, rules, shape, opts);
    // From an illegal start (two catchers, long men, the glove floor) any legal board is a step up.
    if (r.moves === 0 || !r.legal || (r.startLegal && r.score <= r.startScore + 1e-9)) break;
    n++;
    const before = objective(cur), after = objective(r.slots);
    const changed = Object.keys({ ...cur, ...r.slots }).filter((k) => cur[k] !== r.slots[k]);
    const was = new Set(Object.values(cur)), now = new Set(Object.values(r.slots));
    const out = [...was].filter((id) => !now.has(id)).map(nameOf), inn = [...now].filter((id) => !was.has(id)).map(nameOf);
    const head = out.length || inn.length ? `${out.join(", ") || "—"}  →  ${inn.join(", ") || "—"}` : "re-arrange";
    // The search also charges a missing backup or long man; a step that only fixes one gains no runs.
    const fix = Math.abs(r.score - r.startScore - (after - before)) > 0.05 ? `  [search ${f1(r.score - r.startScore)}: fixes a roster check]` : "";
    console.log(`\n${String(n).padStart(2)}. ${f1(after - before)} runs  (${before.toFixed(1)} → ${after.toFixed(1)})   ${head}${fix}`);
    for (const k of changed) console.log(`      ${k.padEnd(6)} ${nameOf(cur[k])} → ${nameOf(r.slots[k])}`);
    cur = r.slots;
  }
  const end = objective(cur);
  console.log(`\nafter ${n} move${n === 1 ? "" : "s"}: ${end.toFixed(1)} runs (${f1(end - start)}); value ${[...new Set(Object.values(cur))].reduce((s, id) => s + (poolById.get(id)?.val ?? 0), 0)}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
