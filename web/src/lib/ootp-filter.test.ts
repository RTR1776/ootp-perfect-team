import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FIELD_CARD_ID, mergeFilter, parseFilterFile, rosterFilter, serializeFilterFile } from "./ootp-filter";

const fx = (n: string) => new Uint8Array(readFileSync(join(__dirname, "__fixtures__", n)));
const ORIG = fx("pt_all_ptcards_filters.orig");          // L.J.'s file before: one filter, "Sell Dupes"
const SITE = fx("pt_all_ptcards_filters.site-merged");   // the other site's merge of a 23-card Deadball roster into it
const DEADBALL = [85153, 86577, 85540, 83847, 86784, 86583, 86572, 86890, 82687, 85937, 86891, 87030, 86706, 85227, 86590, 86372, 84205, 86582, 86767, 86772, 86438, 86067, 86597];

test("both real files round-trip byte for byte", () => {
  for (const b of [ORIG, SITE]) assert.deepEqual(serializeFilterFile(parseFilterFile(b)), b);
});

test("reads the site's roster filter as OR-joined Card ID lines", () => {
  const f = parseFilterFile(SITE).filters[1];
  assert.equal(f.name, "Wednesday Night of the Living Deadball - DB");
  assert.deepEqual(f.criteria.map((c) => c.value), DEADBALL);
  assert.ok(f.criteria.every((c) => c.field === FIELD_CARD_ID && c.op === 1));
  assert.deepEqual(f.criteria.map((c) => c.join), [0, ...DEADBALL.slice(1).map(() => 1)]);
});

test("our merge produces exactly the file the site produced", () => {
  const { bytes, replaced, kept } = mergeFilter(ORIG, rosterFilter("Wednesday Night of the Living Deadball - DB", DEADBALL));
  assert.deepEqual(bytes, SITE);
  assert.equal(replaced, false);
  assert.equal(kept, 1);
});

test("re-exporting a roster replaces its filter instead of stacking copies", () => {
  const once = mergeFilter(ORIG, rosterFilter("Test", [1, 2, 3])).bytes;
  const twice = mergeFilter(once, rosterFilter("Test", [4, 4, 5]));
  assert.equal(twice.replaced, true);
  const fs = parseFilterFile(twice.bytes).filters;
  assert.deepEqual(fs.map((f) => f.name), ["Sell Dupes", "Test"]);
  assert.deepEqual(fs[1].criteria.map((c) => c.value), [4, 5]);
});

test("an empty or missing file starts a fresh one; junk is refused", () => {
  assert.equal(parseFilterFile(mergeFilter(new Uint8Array(), rosterFilter("X", [7])).bytes).filters.length, 1);
  assert.throws(() => parseFilterFile(new TextEncoder().encode("POS,Name,B,T\n")));
});

test("a name outside latin1 (emoji) still round-trips", () => {
  const f = rosterFilter("Splendid ⚾ 🔥", [1, 2]);
  const back = parseFilterFile(serializeFilterFile({ version: 0, filters: [f] }));
  assert.equal(back.filters[0].criteria.length, 2);
});
