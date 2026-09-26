/**
 * Upload new card art from OOTP's local card cache to the project's Vercel
 * Blob store, so /cards and the /build peek can show it.
 *
 * Runs on L.J.'s Mac, where the game keeps its cache. Double-click
 * "Upload Card Art.command" in the project folder, or let "File OOTP
 * Exports.command" run it when it finishes. A cloud Claude session cannot
 * reach the desktop, so it cannot do this step itself.
 *
 * Source: <OOTP 27>/online_data/cache/cards. One 400×600 webp per card, named
 * <cid>_<hash>_<size>.webp; one file per card is enough, and the _6 file is
 * preferred. OOTP 27 lives in ~/Application Support on L.J.'s machine; the
 * standard ~/Library/Application Support is checked too, and
 * OOTP_CARD_CACHE overrides both.
 * Destination: cards/<cid>.webp at fixed paths, so the app can load art by
 * card id alone (src/lib/card-art.ts).
 *
 * Token: BLOB_READ_WRITE_TOKEN from the environment, web/.env.blob or
 * web/.env.local, whichever has it first. Exit code 2 means no token was found.
 *
 * Which cards are already uploaded: scripts/card-art-manifest.json (tracked,
 * the 2026-09-14 upload) plus scripts/.card-art-uploaded.json (gitignored,
 * written by every run since). New uploads are recorded only in the ignored
 * file, so a run never changes a tracked file and never blocks a git pull.
 * Before uploading, each card is checked against the store's public URL, so
 * a lost record causes no duplicate upload.
 *
 *   node scripts/upload-card-art.mjs            # upload what is new
 *   node scripts/upload-card-art.mjs --dry      # report only
 *   node scripts/upload-card-art.mjs --quiet    # one summary line (the filer uses this)
 *   node scripts/upload-card-art.mjs --force 85033,86819   # re-upload these ids
 *
 * With DATABASE_URL available (web/.env.local), it ends by listing the cards
 * in the app that still have no art. Those cards are not in OOTP's cache yet.
 * Open them once in the game (card shop or collection), then run this again.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, renameSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const QUIET = argv.includes("--quiet");
const forceIdx = argv.indexOf("--force");
const FORCE = new Set(forceIdx >= 0 ? String(argv[forceIdx + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean) : []);
const say = (...a) => { if (!QUIET) console.log(...a); };

const PUBLIC_BASE = "https://yenhspu3f9odyl6a.public.blob.vercel-storage.com";
const REL = "Out of the Park Developments/OOTP Baseball 27/online_data/cache/cards";
const cacheCandidates = [
  process.env.OOTP_CARD_CACHE,
  join(homedir(), "Application Support", REL),
  join(homedir(), "Library/Application Support", REL),
].filter(Boolean);
const CACHE = cacheCandidates.find((p) => existsSync(p));
if (!CACHE) {
  console.error(`OOTP's card cache was not found. Looked in:\n${cacheCandidates.map((p) => `  ${p}`).join("\n")}\nSet OOTP_CARD_CACHE to the folder that holds <cid>_<hash>_<size>.webp files.`);
  process.exit(3);
}

/** KEY=value from a dotenv file, quotes stripped; null when absent. */
function fromEnvFile(file, key) {
  try {
    const m = new RegExp(`^\\s*${key}\\s*=\\s*"?([^"\\r\\n]+?)"?\\s*$`, "m").exec(readFileSync(file, "utf8"));
    return m ? m[1] : null;
  } catch { return null; }
}
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || fromEnvFile(".env.blob", "BLOB_READ_WRITE_TOKEN") || fromEnvFile(".env.local", "BLOB_READ_WRITE_TOKEN");
if (!TOKEN && !DRY) {
  console.error("No BLOB_READ_WRITE_TOKEN in the environment, web/.env.blob or web/.env.local.\n"
    + "Get it from Vercel: project ootp-command-center > Storage > the Blob store > .env.local tab,\n"
    + "then run \"Upload Card Art.command\", which asks for it once and saves it to web/.env.blob.");
  process.exit(2);
}
const DATABASE_URL = process.env.DATABASE_URL || fromEnvFile(".env.local", "DATABASE_URL");

const TRACKED = "scripts/card-art-manifest.json";
const LOCAL = "scripts/.card-art-uploaded.json";
const readJson = (p, d) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return d; } };
const tracked = readJson(TRACKED, { uploaded: {} }).uploaded ?? {};
const local = readJson(LOCAL, { uploaded: {} });
local.uploaded ??= {};
const known = (cid) => Boolean(tracked[cid] || local.uploaded[cid]);
const saveLocal = () => {
  if (DRY) return;
  writeFileSync(`${LOCAL}.tmp`, JSON.stringify({ note: "Card art uploaded since the tracked manifest; written by upload-card-art.mjs, gitignored.", uploaded: local.uploaded }));
  renameSync(`${LOCAL}.tmp`, LOCAL);
};

// One file per card id, preferring the _6 size.
const byCid = new Map();
let newest = 0;
for (const f of readdirSync(CACHE)) {
  const m = /^(\d+)_[A-Za-z0-9-]+_(\d+)\.webp$/.exec(f);
  if (!m) continue;
  const [, cid, size] = m;
  const cur = byCid.get(cid);
  if (!cur || (size === "6" && cur.size !== "6")) byCid.set(cid, { f, size });
  try { newest = Math.max(newest, statSync(join(CACHE, f)).mtimeMs); } catch { /* unreadable file: skip */ }
}
const candidates = [...byCid.keys()].filter((cid) => FORCE.has(cid) || !known(cid));
say(`OOTP cache: ${byCid.size} cards (newest file ${newest ? new Date(newest).toISOString().slice(0, 10) : "?"}) · ${CACHE}`);
say(`already on record: ${byCid.size - candidates.length} · to check: ${candidates.length}${DRY ? "  (dry run: nothing is uploaded)" : ""}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function exists(cid) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(`${PUBLIC_BASE}/cards/${cid}.webp`, { method: "HEAD" });
      if (r.status === 200) return true;
      if (r.status === 404) return false;
    } catch { /* network blip: retry */ }
    await sleep(300 * attempt);
  }
  return false;
}

let uploaded = 0, present = 0, failed = 0, authRejected = false;
const failures = [];
async function handle(cid) {
  const force = FORCE.has(cid);
  if (!force && (await exists(cid))) { local.uploaded[cid] = 1; present++; return; }
  if (DRY) { uploaded++; return; }
  if (authRejected) { failed++; return; }
  const body = readFileSync(join(CACHE, byCid.get(cid).f));
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`https://blob.vercel-storage.com/cards/${cid}.webp`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${TOKEN}`,
          "x-api-version": "7",
          "x-content-type": "image/webp",
          "x-add-random-suffix": "0",
          "x-cache-control-max-age": "31536000",
          ...(force ? { "x-allow-overwrite": "1" } : {}),
        },
        body,
      });
      if (!res.ok) {
        const text = (await res.text()).slice(0, 150);
        // A token for no store answers 404 store_not_found; a bad secret, 401/403. Retrying cannot help.
        if (res.status === 401 || res.status === 403 || text.includes("store_not_found")) {
          authRejected = true; failed++;
          failures.push(`${cid}: ${res.status} ${text}`);
          return;
        }
        throw new Error(`${res.status} ${text}`);
      }
      local.uploaded[cid] = 1;
      uploaded++;
      if (uploaded % 100 === 0) { say(`  ${uploaded} uploaded…`); saveLocal(); }
      return;
    } catch (e) {
      if (attempt === 4) { failed++; failures.push(`${cid}: ${String(e).slice(0, 160)}`); return; }
      await sleep(500 * attempt * attempt);
    }
  }
}

const CONC = 8;
for (let i = 0; i < candidates.length; i += CONC) await Promise.all(candidates.slice(i, i + CONC).map(handle));
saveLocal();

const verb = DRY ? "would upload" : "uploaded";
const line = authRejected
  ? "card art: the store rejected the token, nothing uploaded. Delete web/.env.blob and run Upload Card Art.command to enter it again."
  : `card art: ${verb} ${uploaded} new, ${present} already in the store, ${failed} failed (OOTP cache ${byCid.size} cards)`;
console.log(QUIET ? line : `\n${line}`);
for (const f of failures.slice(0, 5)) console.error(`  FAIL ${f}`);

// Which cards in the app still have no art: not in the cache, so nothing above could upload them.
if (DATABASE_URL) {
  try {
    const { neon } = await import("@neondatabase/serverless");
    const rows = await neon(DATABASE_URL)`select card_id, title from cards where card_id > 0 order by card_id`;
    // In a dry run a cached card counts as covered: the real run would upload it.
    const noArt = rows.filter((r) => !known(String(r.card_id)) && !(DRY && byCid.has(String(r.card_id))));
    const notCached = noArt.filter((r) => !byCid.has(String(r.card_id)));
    const pre = QUIET ? "  " : "";
    if (noArt.length > notCached.length) { const k = noArt.length - notCached.length; console.log(`${pre}${k} card${k === 1 ? " is" : "s are"} in the cache but did not upload; run this again.`); }
    if (notCached.length) {
      console.log(`${pre}${notCached.length} of ${rows.length} cards in the app are not in OOTP's cache, so they have no art. Open them once in the game, then run this again.`);
      if (!QUIET) for (const r of notCached.slice(0, 15)) console.log(`    ${r.card_id}  ${r.title}`);
      if (!QUIET && notCached.length > 15) console.log(`    … and ${notCached.length - 15} more`);
    }
    if (!noArt.length && !QUIET) console.log(`every card in the app (${rows.length}) has art.`);
  } catch (e) {
    say(`(skipped the app-side check: ${String(e).slice(0, 120)})`);
  }
}
process.exit(authRejected ? 2 : failed > 0 ? 1 : 0);
