/**
 * The roster report L.J. asks for every time (2026-10-27: "everytime I ask, this is what I
 * would like to see"): all 26 by card value then name, both lineups in batting order,
 * observed and projected stats per card, and the cards top teams play that we don't.
 *
 *   node --env-file=.env.local --import tsx scripts/roster-report.mts --tournament 567 \
 *     --file "../Inbox/rosters/goldfather-claude-2026-10-27 c311.txt" --log <dir>/567.txt
 *
 * --file: the load file current-rosters wrote (slot, name, #id). --log: env-roster's build log
 * for the same build; its batting orders and per-board runs are what /build shows.
 *
 * Proj: the model's runs per 700 PA on each board (from the log), and the slash line the
 * card's ratings make in the event's era and park (card-value hitterRates / pitcherRates →
 * run-env rateLine; a pitcher's is the line he allows, 35% LHB). Variants use the owned
 * copy's exported ratings (card-forms formRatings).
 * Obs: observed_card_stats for this series (wOBA / FIP, PA / IP, WAR per 600 PA or 200 IP);
 * when the series has none, every series pooled, and the report says so.
 * Top teams: the series' archived exports (Archive/Completed/<series>_*.csv), the top
 * quarter of teams by win%, cards on at least 20% of them that we don't carry; without
 * exports, the most-used cards in observed play inside the event's value window.
 */
import { readFileSync, readdirSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { eraFor, eraTable, parkFor } from "@/lib/analytics/tournament-env";
import { applyPark, blendPark, rateLine } from "@/lib/analytics/run-env";
import { hitterRates, pitcherRates } from "@/lib/analytics/card-value";
import { formRatings } from "@/lib/card-forms";
import { collectionVocab } from "@/lib/ingest/league";

const argv = process.argv.slice(2);
const val = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const TID = Number(val("tournament")), FILE = val("file")!, LOG = val("log");
if (!TID || !FILE) throw new Error("--tournament ID --file LOADFILE [--log BUILDLOG] are required");
const sql = neon(process.env.DATABASE_URL!);
const f3 = (n: number) => n.toFixed(3).replace(/^0/, "");
const f1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;

const [t] = await sql`select id, name, series, env_year, stadium, ratings_min, ratings_max from tournaments where id = ${TID}`;
const era = (eraFor(t.env_year ?? 2010)?.row ?? eraTable["0"]);
const park = t.stadium ? parkFor(t.stadium).row : null;

// ---- the roster: slot → card, from the load file
type Entry = { id: number; name: string; variant: boolean; slots: string[] };
const roster = new Map<string, Entry>();
for (const line of readFileSync(FILE, "utf8").split("\n")) {
  const m = /^(\S+)\s+(.+?)\s+#(\d+)\s*$/.exec(line.trim());
  if (!m || m[1].startsWith("#")) continue;
  const variant = /\(VAR\)/.test(m[2]), id = Number(m[3]), key = `${id}${variant ? "v" : ""}`;
  const e = roster.get(key) ?? { id, name: m[2].replace(/\s*\(VAR\)/, ""), variant, slots: [] };
  e.slots.push(m[1]);
  roster.set(key, e);
}
const ids = [...new Set([...roster.values()].map((e) => e.id))];
const cards = new Map((await sql`select card_id, name, card_value, bats, throws, position, ratings, is_pitcher from cards where card_id = any(${ids})`).map((c) => [Number(c.card_id), c]));
const [coll] = await sql`select id from uploads where kind = 'collection' order by uploaded_at desc, id desc limit 1`;
const varRatings = new Map((await sql`select abs(card_id) as id, ratings from collection_cards where upload_id = ${coll.id} and is_variant and abs(card_id) = any(${ids})`).map((r) => [Number(r.id), r.ratings]));
const ratingsOf = (e: Entry) => {
  const c = cards.get(e.id)!;
  const ex = e.variant ? varRatings.get(e.id) : null;
  return ex ? formRatings(c.ratings, collectionVocab(ex), c.position) : (c.ratings as Record<string, number>);
};

// ---- proj runs per board, batting orders, from the build log
const runs = new Map<string, number>(); // `${slot}` → runs
const glove = new Map<string, number>(); // lineup slot → glove runs at it
const orders: Record<"R" | "L", string[]> = { R: [], L: [] };
if (LOG) {
  let order: "R" | "L" | null = null;
  for (const line of readFileSync(LOG, "utf8").split("\n")) {
    const o = /^--- batting order vs ([RL])HP/.exec(line);
    if (o) { order = o[1] as "R" | "L"; continue; }
    if (line.startsWith("---")) order = null;
    if (order) { const m = /^\s+\d+\.\s+(.+?)\s+(C|1B|2B|3B|SS|LF|CF|RF|DH)$/.exec(line); if (m) orders[order].push(`${m[1]} ${m[2]}`); else if (/^\s+\d+\.\s+Pitcher/.test(line)) orders[order].push("Pitcher"); }
    const r = /^(\S+)\s+.+?\s+\d+\s+[LRS-]\s+\d*\s+([+-]\d+\.\d)\s/.exec(line);
    if (r && /^(R:|L:|SP\d|RP\d|CL|BN\d)/.test(r[1])) runs.set(r[1], Number(r[2]));
    const d = /^([RL]:\S+)\s.*\bDEF\s+\d+\/\s*\d+\s+([+-]\d+\.\d)/.exec(line);
    if (d) glove.set(d[1], Number(d[2]));
  }
}

// ---- proj slash lines
const slash = (e: Entry, split: "vR" | "vL") => {
  const c = cards.get(e.id)!; const r = ratingsOf(e);
  if (c.is_pitcher) {
    const L = pitcherRates(r, era.rates, "vL"), R = pitcherRates(r, era.rates, "vR");
    if (!L || !R) return null;
    const mix = Object.fromEntries(Object.keys(L).map((k) => [k, 0.35 * (L as any)[k] + 0.65 * (R as any)[k]])) as typeof L;
    return rateLine(park ? applyPark(mix, blendPark(park, 0.35)) : mix, era.rg);
  }
  const h = hitterRates(r, era.rates, split);
  if (!h) return null;
  const left = c.bats === "L" || (c.bats === "S" && split === "vR");
  return rateLine(park ? applyPark(h, blendPark(park, left ? 1 : 0)) : h, era.rg);
};

// ---- observed
const obsRows = await sql`select card_id, is_variant, is_pitcher, sum(pa)::float pa, sum(ip)::float ip, sum(war)::float war, sum(woba * pa)::float wpa, sum(fip * ip)::float fipip, sum(instances)::int n from observed_card_stats where card_id = any(${ids}) and series = ${t.series} group by 1, 2, 3`;
const seriesHas = obsRows.length > 0;
const obsAll = seriesHas ? obsRows : await sql`select card_id, is_variant, is_pitcher, sum(pa)::float pa, sum(ip)::float ip, sum(war)::float war, sum(woba * pa)::float wpa, sum(fip * ip)::float fipip, sum(instances)::int n from observed_card_stats where card_id = any(${ids}) group by 1, 2, 3`;
const obsOf = (e: Entry, pitcher: boolean) => {
  const rows = obsAll.filter((o) => Number(o.card_id) === e.id && !!o.is_pitcher === pitcher);
  const pick = rows.filter((o) => !!o.is_variant === e.variant);
  const use = pick.length ? pick : rows;
  const s = use.reduce((a, o) => ({ pa: a.pa + o.pa, ip: a.ip + o.ip, war: a.war + o.war, wpa: a.wpa + (o.wpa ?? 0), fipip: a.fipip + (o.fipip ?? 0) }), { pa: 0, ip: 0, war: 0, wpa: 0, fipip: 0 });
  if (pitcher) return s.ip >= 10 ? `${Math.round(s.ip)} IP, FIP ${(s.fipip / s.ip).toFixed(2)}, ${(200 * s.war / s.ip).toFixed(1)} WAR/200` : "—";
  return s.pa >= 30 ? `${Math.round(s.pa)} PA, wOBA ${f3(s.wpa / s.pa)}, ${(600 * s.war / s.pa).toFixed(1)} WAR/600` : "—";
};

// ---- the 26 by value, then name
const entries = [...roster.values()].map((e) => ({ e, c: cards.get(e.id)! }));
entries.sort((a, b) => b.c.card_value - a.c.card_value || a.e.name.localeCompare(b.e.name));
const roleOf = (e: Entry) => {
  const R = e.slots.filter((s) => s.startsWith("R:")).map((s) => s.slice(2)), L = e.slots.filter((s) => s.startsWith("L:")).map((s) => s.slice(2));
  const staff = e.slots.filter((s) => /^(SP\d|RP\d|CL)$/.test(s)), bench = e.slots.some((s) => s.startsWith("BN"));
  const parts: string[] = [];
  if (R.length && L.length && R.join() === L.join()) parts.push(R.join("/"));
  else { if (R.length) parts.push(`${R.join("/")} vs RHP`); if (L.length) parts.push(`${L.join("/")} vs LHP`); }
  if (staff.length) parts.push(staff.join("/"));
  if (bench || (!R.length && !L.length && !staff.length)) parts.push(R.length || L.length ? "bench vs the other hand" : "bench");
  return parts.join("; ");
};
const projOf = (e: Entry, pitcher: boolean) => {
  if (pitcher) {
    const slot = e.slots.find((s) => /^(SP\d|RP\d|CL)$/.test(s));
    const l = slash(e, "vR");
    return `${slot && runs.has(slot) ? f1(runs.get(slot)!) + " runs" : ""}${l ? `, opp ${f3(l.avg)}/${f3(l.obp)}/${f3(l.slg)}` : ""}`;
  }
  const rR = e.slots.find((s) => s.startsWith("R:")), rL = e.slots.find((s) => s.startsWith("L:")), bn = e.slots.find((s) => s.startsWith("BN"));
  const lr = slash(e, "vR"), ll = slash(e, "vL");
  const g = (k: string | undefined) => (k && glove.has(k) ? ` (glove ${f1(glove.get(k)!)})` : "");
  const rs = [rR && runs.has(rR) ? `vR ${f1(runs.get(rR)!)}${g(rR)}` : "", rL && runs.has(rL) ? `vL ${f1(runs.get(rL)!)}${g(rL)}` : "", !rR && !rL && bn && runs.has(bn) ? `${f1(runs.get(bn)!)}` : ""].filter(Boolean).join(" · ");
  return `${rs}${lr ? ` | vR ${f3(lr.avg)}/${f3(lr.obp)}/${f3(lr.slg)}` : ""}${ll ? ` · vL ${f3(ll.avg)}/${f3(ll.obp)}/${f3(ll.slg)}` : ""}`;
};
console.log(`## ${t.name}\n`);
console.log(`${t.env_year ?? "PT default"} environment · ${t.stadium ?? "neutral park"} · roster ${FILE.split("/").pop()}\n`);
console.log("| Val | Card | Hand | Roles | Projected | Observed" + (seriesHas ? " (this series)" : " (all events: no exports of this series on file)") + " |\n|---|---|---|---|---|---|");
let total = 0;
for (const { e, c } of entries) {
  total += c.card_value;
  const hand = c.is_pitcher ? c.throws : c.bats;
  console.log(`| ${c.card_value} | ${e.name}${e.variant ? " (VAR)" : ""} | ${hand} | ${roleOf(e)} | ${projOf(e, !!c.is_pitcher)} | ${obsOf(e, !!c.is_pitcher)} |`);
}
console.log(`\nTotal value ${total}. Projected runs are bat runs per 700 PA on each board, glove runs at the position in brackets, or 700 BF (arms) against this field's average; slash lines are the ratings' line in this era and park.\n`);
for (const h of ["R", "L"] as const) if (orders[h].length) console.log(`**vs ${h}HP:** ${orders[h].join(" · ")}\n`);

// ---- top teams' cards we don't carry
const owned = new Set((await sql`select abs(card_id) as id from collection_cards where upload_id = ${coll.id}`).map((r) => Number(r.id)));
const onRoster = new Set(ids);
const dir = "../Archive/Completed";
const files = t.series ? readdirSync(dir).filter((x) => x.startsWith(`${t.series}_`) && x.endsWith(".csv")) : [];
if (files.length) {
  const use = new Map<number, { n: number; name: string; val: number; var: number }>();
  let topTeams = 0;
  for (const f of files) {
    const rows = readFileSync(`${dir}/${f}`, "utf8").replace(/^﻿/, "").split("\n").map((l) => l.split(","));
    const h = rows[0], ix = (k: string) => h.indexOf(k);
    const [iO, iC, iV, iW, iL, iGS, iN, iVal] = [ix("ORG"), ix("CID"), ix("VAR"), ix("W"), ix("L"), ix("GS_1"), ix("Name"), ix("VAL")];
    const wl = new Map<string, [number, number]>();
    for (const r of rows.slice(1)) if (r.length >= h.length && Number(r[iGS]) > 0) { const a = wl.get(r[iO]) ?? [0, 0]; a[0] += Number(r[iW]) || 0; a[1] += Number(r[iL]) || 0; wl.set(r[iO], a); }
    const pct = [...wl].filter(([, [w, l]]) => w + l >= 5).map(([o, [w, l]]) => [o, w / (w + l)] as const).sort((a, b) => b[1] - a[1]);
    const top = new Set(pct.slice(0, Math.max(1, Math.floor(pct.length / 4))).map(([o]) => o));
    topTeams += top.size;
    const seen = new Set<string>();
    for (const r of rows.slice(1)) {
      if (r.length < h.length || !top.has(r[iO])) continue;
      const cid = Number(r[iC]), k = `${r[iO]}|${cid}`;
      if (!cid || seen.has(k)) continue;
      seen.add(k);
      const u = use.get(cid) ?? { n: 0, name: r[iN], val: Number(r[iVal]), var: 0 };
      u.n++; if (r[iV] === "Y") u.var++; use.set(cid, u);
    }
  }
  const list = [...use].filter(([id, u]) => !onRoster.has(id) && u.n / topTeams >= 0.2).sort((a, b) => b[1].n - a[1].n).slice(0, 12);
  console.log(`**Cards the top quarter of teams play that we don't** (${files.length} exports, ${topTeams} top teams):\n`);
  for (const [id, u] of list) console.log(`- ${u.name} ${u.val}: on ${Math.round(100 * u.n / topTeams)}% of top teams${u.var ? ` (${Math.round(100 * u.var / u.n)}% as variants)` : ""} — ${owned.has(id) ? "owned" : "not owned"}`);
} else {
  const lo = t.ratings_min ?? 0, hi = t.ratings_max ?? 999;
  const pop = await sql`select o.card_id, c.name, c.card_value, sum(o.instances)::int n from observed_card_stats o join cards c on c.card_id = o.card_id where c.card_value between ${lo} and ${hi} group by 1, 2, 3 order by n desc limit 40`;
  const list = pop.filter((p) => !onRoster.has(Number(p.card_id))).slice(0, 12);
  console.log(`**No exports of this series on file.** Most-used cards in observed play inside the value window (${lo}–${hi}) that we don't carry:\n`);
  for (const p of list) console.log(`- ${p.name} ${p.card_value}: ${p.n} event appearances — ${owned.has(Number(p.card_id)) ? "owned" : "not owned"}`);
}
process.exit(0);
