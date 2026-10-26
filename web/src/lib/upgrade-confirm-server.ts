/**
 * Confirm a buy (the Upgrades page's third section): the real rebuild for an
 * event, with the cards he is thinking of buying assumed his, against the same
 * rebuild without them. One-swap gains (Card Fit, the variant scan) are not
 * additive and miss the reshuffle a buy can force, so the answer to "is it
 * worth it" is the objective's change between two full builds.
 *
 * Both builds are env-roster as current-rosters runs it for a Claude pick (the
 * event's catalogue rules, its staff shape, L.J.'s floors, relief role trust
 * 0.25), seeded from the event's newest saved roster with one λ start each, so
 * they differ only by the assumed cards: --assume-variant (his base copy ×1.08
 * on the split ratings) and --assume-owned (a card he doesn't have). Nothing is
 * saved.
 *
 * It spawns the CLI, so it runs where the scripts are: the Mac's dev server or
 * `pnpm upgrade:confirm`. On Vercel it says so and gives the command.
 * Server only.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { rosterSlots, rosters, seriesMeta, tournaments, uploads } from "@/db/schema";
import { CLAUDE_PICK_FLAGS, eventRosterArgs, eventShape } from "@/lib/event-roster-args";
import { exportsPredate } from "@/lib/set-evidence-server";

export interface ConfirmCard { id: number; name: string; val: number; variant: boolean }
export interface ConfirmResult {
  eventId: number;
  event: string;
  /** The objective (weighted runs) of the rebuild without and with the assumed cards. */
  before: number | null;
  after: number | null;
  /** after − before: what the buy is worth in this event. */
  delta: number | null;
  legal: boolean;
  /** Cards the rebuild with the buy adds and drops against the rebuild without it. */
  added: ConfirmCard[];
  dropped: ConfirmCard[];
  /** Assumed cards that made the roster. */
  used: number[];
  seconds: number;
  error?: string;
}

/** The command that runs the same check from web/, for a server that can't spawn the CLI. */
export function confirmCommand(eventIds: readonly number[], variants: readonly number[], owned: readonly number[]): string {
  return ["pnpm upgrade:confirm", `--events ${eventIds.join(",")}`, variants.length ? `--variant ${variants.join(",")}` : "", owned.length ? `--owned ${owned.join(",")}` : ""].filter(Boolean).join(" ");
}

/** Where the CLI can't run: Vercel's functions carry neither the scripts nor tsx. */
export const canSpawnBuilds = () => !process.env.VERCEL;

interface Job { eventId: number; name: string; args: string[]; seed: string | null; rosterId: number | null; collectionId: number | null }

async function jobFor(eventId: number): Promise<Job> {
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, eventId));
  if (!t) throw new Error(`no event ${eventId}`);
  const since = (t.restrictions as { formatSince?: string } | null)?.formatSince;
  const stale = !!(t.series && since && (await exportsPredate(t.series, since)).stale);
  const r = eventRosterArgs(t, { seriesStale: stale });
  if (r.problems.length) throw new Error(`${t.name}: ${r.problems.join("; ")}`);
  const [meta] = t.series && !stale ? await db.select().from(seriesMeta).where(eq(seriesMeta.series, t.series)) : [];
  r.args.push(...eventShape(t, { seriesStale: stale, meta: meta ?? null }).args);

  const [[saved], [coll]] = await Promise.all([
    db.select({ id: rosters.id }).from(rosters).where(eq(rosters.tournamentId, eventId)).orderBy(desc(rosters.updatedAt), desc(rosters.id)).limit(1),
    db.select({ id: uploads.id }).from(uploads).where(eq(uploads.kind, "collection")).orderBy(desc(uploads.uploadedAt), desc(uploads.id)).limit(1),
  ]);
  let seed: string | null = null;
  if (saved) {
    // The saved roster as env-roster --seed lines (current-rosters newestSaved): "R:C #id", "SP1 #id", "BN1 #id".
    const slots = await db.select({ cardId: rosterSlots.cardId, slot: rosterSlots.slot, hand: rosterSlots.versusHand }).from(rosterSlots).where(eq(rosterSlots.rosterId, saved.id)).orderBy(rosterSlots.id);
    const dir = mkdtempSync(join(tmpdir(), "upgrade-confirm-"));
    seed = join(dir, `${eventId}-seed.txt`);
    writeFileSync(seed, `# seed: saved roster ${saved.id}\n${slots.map((s) => `${s.hand === "L" || s.hand === "R" ? `${s.hand}:` : ""}${s.slot} #${s.cardId}`).join("\n")}\n`);
  }
  return { eventId, name: t.name, args: r.args, seed, rosterId: saved?.id ?? null, collectionId: coll?.id ?? null };
}

/** One env-roster run's printout. */
function runBuild(job: Job, extra: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ["--import", "tsx", "scripts/env-roster.ts", ...job.args, ...CLAUDE_PICK_FLAGS, "--starts", "1", ...(job.seed ? ["--seed", job.seed] : []), ...extra];
    const child = spawn(process.execPath, args, { env: process.env, cwd: process.cwd() });
    let text = "";
    child.stdout.on("data", (d) => { text += d; });
    child.stderr.on("data", (d) => { text += d; });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(text) : reject(new Error((text.split("\n").find((l) => l.startsWith("!!")) ?? text.trim().split("\n").at(-1) ?? `env-roster exited ${code}`).slice(0, 300)))));
  });
}

/** The rostered cards in an env-roster printout: each row ends "#id"; "(VAR)" marks the variant. */
export function rosteredCards(text: string): Map<string, ConfirmCard> {
  const out = new Map<string, ConfirmCard>();
  const re = /^(R:\w+|L:\w+|SP\d|CL|RP\d+|BN\d+)\s+(.+?)\s{2,}(\d+)\s.*#(\d+)\s*$/;
  for (const l of text.split(/\r?\n/)) {
    const m = re.exec(l);
    if (!m) continue;
    const variant = /\(VAR\)$/.test(m[2]);
    const id = Number(m[4]);
    out.set(`${id}${variant ? "v" : ""}`, { id, name: m[2].replace(/\s*\(VAR\)$/, ""), val: Number(m[3]), variant });
  }
  return out;
}

const objectiveOf = (text: string) => { const v = Number(/^objective: ([-0-9.]+)/m.exec(text)?.[1] ?? NaN); return Number.isFinite(v) ? v : null; };

/**
 * The rebuild without the buy, per event, saved roster and collection: the same
 * for every card tried there, so a warm server runs it once.
 */
const baselines = new Map<string, Promise<string>>();

export async function confirmBuy(eventId: number, variants: readonly number[], owned: readonly number[]): Promise<ConfirmResult> {
  const t0 = Date.now();
  const job = await jobFor(eventId);
  const key = `${eventId}:${job.rosterId}:${job.collectionId}:${job.args.join(" ")}`;
  let base = baselines.get(key);
  if (!base) {
    base = runBuild(job, []);
    baselines.set(key, base);
    base.catch(() => baselines.delete(key));
  }
  const extra = [...(variants.length ? ["--assume-variant", variants.join(",")] : []), ...(owned.length ? ["--assume-owned", owned.join(",")] : [])];
  try {
    const [before, after] = await Promise.all([base, runBuild(job, extra)]);
    const a = rosteredCards(before), b = rosteredCards(after);
    const o0 = objectiveOf(before), o1 = objectiveOf(after);
    const assumed = new Set([...variants.map((id) => `${id}v`), ...owned.map((id) => `${id}`)]);
    return {
      eventId, event: job.name, before: o0, after: o1, delta: o0 != null && o1 != null ? Math.round((o1 - o0) * 10) / 10 : null,
      legal: /^LEGAL — every rule check passes/m.test(after),
      added: [...b].filter(([k]) => !a.has(k)).map(([, c]) => c),
      dropped: [...a].filter(([k]) => !b.has(k)).map(([, c]) => c),
      used: [...b.keys()].filter((k) => assumed.has(k)).map((k) => Number(k.replace(/v$/, ""))),
      seconds: Math.round((Date.now() - t0) / 1000),
    };
  } catch (e) {
    return { eventId, event: job.name, before: null, after: null, delta: null, legal: false, added: [], dropped: [], used: [], seconds: Math.round((Date.now() - t0) / 1000), error: e instanceof Error ? e.message : String(e) };
  }
}
