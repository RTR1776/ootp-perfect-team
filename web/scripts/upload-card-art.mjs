/**
 * Upload OOTP's local card-art cache to the project's Vercel Blob store.
 *
 * Source: ~/Application Support/.../OOTP Baseball 27/online_data/cache/cards
 * (400x600 webp per card, named <cid>_<hash>_<size>.webp; one variant per
 * card is enough — prefer the _6 file). Destination: cards/<cid>.webp with
 * deterministic paths, so the app can hotlink art by card id alone.
 *
 * Run from web/:  node scripts/upload-card-art.mjs
 * Needs .env.blob (vercel env pull .env.blob) for BLOB_READ_WRITE_TOKEN.
 * Idempotent: scripts/card-art-manifest.json records uploaded cids; delete
 * an entry (or the file) to re-upload. Rerun after new cards get art.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const CACHE = join(
  process.env.HOME,
  "Application Support/Out of the Park Developments/OOTP Baseball 27/online_data/cache/cards",
);
const env = readFileSync(".env.blob", "utf8");
const token = /BLOB_READ_WRITE_TOKEN="?([^"\r\n]+?)"?\r?\n/.exec(env)?.[1];
if (!token) throw new Error("BLOB_READ_WRITE_TOKEN not found in .env.blob");

const manifestPath = "scripts/card-art-manifest.json";
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : { base: null, uploaded: {} };

const byCid = new Map();
for (const f of readdirSync(CACHE)) {
  const m = /^(\d+)_[A-Za-z0-9-]+_(\d+)\.webp$/.exec(f);
  if (!m) continue;
  const [, cid, size] = m;
  const cur = byCid.get(cid);
  if (!cur || (size === "6" && cur.size !== "6")) byCid.set(cid, { f, size });
}
const todo = [...byCid.entries()].filter(([cid]) => !manifest.uploaded[cid]);
console.log(`cache cids: ${byCid.size} | already uploaded: ${byCid.size - todo.length} | to upload: ${todo.length}`);

let done = 0, failed = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function put([cid, { f }], attempt = 1) {
  try {
    const body = readFileSync(join(CACHE, f));
    const res = await fetch(`https://blob.vercel-storage.com/cards/${cid}.webp`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "x-api-version": "7",
        "x-content-type": "image/webp",
        "x-add-random-suffix": "0",
        "x-cache-control-max-age": "31536000",
      },
      body,
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 150)}`);
    const j = await res.json();
    if (!manifest.base) {
      manifest.base = j.url.replace(/\/cards\/\d+\.webp$/, "");
      console.log("public base:", manifest.base);
    }
    manifest.uploaded[cid] = 1;
    done++;
    if (done % 250 === 0) {
      console.log(`  ${done}/${todo.length}`);
      writeFileSync(manifestPath, JSON.stringify(manifest));
    }
  } catch (e) {
    if (attempt < 4) {
      await sleep(500 * attempt * attempt);
      return put([cid, { f }], attempt + 1);
    }
    failed++;
    if (failed <= 5) console.error(`FAIL ${cid}: ${String(e).slice(0, 200)}`);
  }
}

const CONC = 8;
for (let i = 0; i < todo.length; i += CONC) {
  await Promise.all(todo.slice(i, i + CONC).map(put));
}
writeFileSync(manifestPath, JSON.stringify(manifest));
console.log(`done: ${done} uploaded, ${failed} failed | base: ${manifest.base}`);
