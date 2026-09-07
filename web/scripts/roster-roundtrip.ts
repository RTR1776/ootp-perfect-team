/**
 * End-to-end check of the roster API against a running app: log in, POST a
 * known-good roster through the parser + validator + atomic insert, read it
 * back with every slot and `useVariant` intact, exercise the 400/422 paths,
 * then delete the test rows straight from the DB.
 *
 *   pnpm test:rosters                 # against the production app
 *   pnpm test:rosters http://localhost:3000
 *
 * Needs APP_PASSWORD + DATABASE_URL (read from .env.local). Uses the newest
 * saved roster for tournament 9060008 (Cap) as the template unless --roster N.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const ENV_LOCAL = resolve(__dirname, "..", ".env.local");
if (existsSync(ENV_LOCAL)) {
  for (const line of readFileSync(ENV_LOCAL, "utf8").split("\n")) {
    if (line.trimStart().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    if (!process.env[key]) process.env[key] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}

import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../src/db/client";
import { rosters, rosterSlots } from "../src/db/schema";

const args = process.argv.slice(2);
const BASE = args.find((a) => a.startsWith("http")) ?? "https://ootp-command-center.vercel.app";
const rosterArg = args[args.indexOf("--roster") + 1];
const TEMPLATE = args.includes("--roster") && rosterArg ? Number(rosterArg) : null;
const TOURNAMENT = 9060008;
const NAME = `__roundtrip ${new Date().toISOString()}`;

async function main() {
  const pw = process.env.APP_PASSWORD;
  if (!pw) throw new Error("APP_PASSWORD missing");
  const login = await fetch(`${BASE}/api/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) });
  assert.equal(login.status, 200, "login");
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  assert.ok(cookie, "session cookie");
  const H = { "content-type": "application/json", cookie };

  // template: a saved roster for the tournament
  const [tpl] = TEMPLATE
    ? await db.select().from(rosters).where(eq(rosters.id, TEMPLATE))
    : await db.select().from(rosters).where(eq(rosters.tournamentId, TOURNAMENT)).orderBy(desc(rosters.id)).limit(1);
  assert.ok(tpl, "a saved roster to copy");
  const tplSlots = await db.select().from(rosterSlots).where(eq(rosterSlots.rosterId, tpl.id));
  assert.ok(tplSlots.length >= 26, `template has ${tplSlots.length} slots`);
  const slots = tplSlots.map((s) => ({ cardId: s.cardId, slot: s.slot, versusHand: s.versusHand, lineupOrder: s.lineupOrder, useVariant: s.useVariant }));
  const nVar = slots.filter((s) => s.useVariant).length;
  console.log(`template roster #${tpl.id} "${tpl.name}": ${slots.length} slots, ${nVar} variant forms`);

  const created: number[] = [];
  try {
    // 1. unauthenticated → 401
    const anon = await fetch(`${BASE}/api/rosters`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(anon.status, 401, "anonymous POST is refused");

    // 2. malformed → 400
    const bad = await fetch(`${BASE}/api/rosters`, { method: "POST", headers: H, body: JSON.stringify({ name: NAME, tournamentId: tpl.tournamentId, slots: [{ cardId: slots[0].cardId, slot: "QB" }] }) });
    assert.equal(bad.status, 400, "unknown slot name → 400");

    // 3. a form you don't own → 422 not-owned, nothing saved
    const notOwned = slots.map((s, i) => (i === 0 ? { ...s, useVariant: !s.useVariant } : s));
    const r422 = await fetch(`${BASE}/api/rosters`, { method: "POST", headers: H, body: JSON.stringify({ name: NAME, tournamentId: tpl.tournamentId, slots: notOwned, requireReady: true }) });
    const j422 = await r422.json() as { error: string; validation?: { errors: { code: string }[] } };
    // flipping a form is only invalid when that form is NOT owned; a card owned both ways stays legal
    if (r422.status === 422) assert.ok(j422.validation?.errors.some((e) => e.code === "not-owned" || e.code === "mixed-form"), `422 names the form: ${j422.error}`);
    else { assert.equal(r422.status, 200, "flipped form on a both-owned card saves"); created.push((await r422.clone().json() as { rosterId: number }).rosterId); }

    // 4. the real thing, requireReady
    const ok = await fetch(`${BASE}/api/rosters`, { method: "POST", headers: H, body: JSON.stringify({ name: NAME, tournamentId: tpl.tournamentId, slots, requireReady: true }) });
    const jok = await ok.json() as { ok?: boolean; rosterId?: number; error?: string; validation: { ready: boolean; errors: { message: string }[]; incomplete: { message: string }[] } };
    assert.equal(ok.status, 200, `ready save: ${jok.error ?? ""} ${[...(jok.validation?.errors ?? []), ...(jok.validation?.incomplete ?? [])].map((e) => e.message).join(" | ")}`);
    assert.ok(jok.rosterId, "rosterId returned");
    assert.equal(jok.validation.ready, true, "validator says ready");
    created.push(jok.rosterId!);

    // 5. read back
    const get = await fetch(`${BASE}/api/rosters?tournamentId=${tpl.tournamentId}`, { headers: { cookie } });
    assert.equal(get.status, 200, "GET");
    const list = (await get.json() as { rosters: { id: number; name: string; slots: { cardId: number; slot: string; versusHand: string | null; lineupOrder: number | null; useVariant: boolean }[] }[] }).rosters;
    const mine = list.find((r) => r.id === jok.rosterId);
    assert.ok(mine, "saved roster is listed");
    assert.equal(mine!.name, NAME);
    assert.equal(mine!.slots.length, slots.length, "every slot came back");
    const key = (s: { cardId: number; slot: string; versusHand: string | null }) => `${s.versusHand}:${s.slot}:${s.cardId}`;
    const sent = new Map(slots.map((s) => [key(s), s]));
    for (const s of mine!.slots) {
      const o = sent.get(key(s));
      assert.ok(o, `unexpected slot ${key(s)}`);
      assert.equal(s.useVariant, o!.useVariant, `useVariant preserved on ${key(s)}`);
      assert.equal(s.lineupOrder, o!.lineupOrder, `lineupOrder preserved on ${key(s)}`);
    }
    assert.equal(mine!.slots.filter((s) => s.useVariant).length, nVar, "variant count preserved");
    console.log(`OK: roster #${jok.rosterId} round-tripped ${mine!.slots.length} slots (${nVar} variant) against ${BASE}`);
  } finally {
    if (created.length) {
      await db.delete(rosters).where(inArray(rosters.id, created));
      console.log(`cleaned up roster(s) ${created.join(", ")}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
