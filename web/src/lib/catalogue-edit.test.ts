import { test } from "node:test";
import assert from "node:assert/strict";
import { editCatalogueRules, type CatalogueRules } from "./catalogue-edit";

const lastWeek: CatalogueRules = {
  envYear: 1975, stadium: "1981 Metropolitan Stadium", parkName: "Metropolitan Stadium", dh: false,
  ratingsMin: 40, ratingsMax: 99, cardYearMin: null, cardYearMax: null,
  restrictions: { text: "Negro League Star+Future Legend+Snapshot only.", cards: 26, cardTypes: ["Negro League Star+Future Legend+Snapshot"], pendingRefresh: "1952 RE next week" },
};

test("a weekly format change: new era, park and card years; the card-kind rule dropped", () => {
  const next = editCatalogueRules(lastWeek, {
    envYear: 1952, stadium: "1958 Tiger Stadium", cardYears: [1910, 1959], drop: ["cardTypes", "pendingRefresh"],
    text: "Diamond or lower. Cards 1910-1959.", note: "2026-09-19 weekly post", at: "2026-09-26",
  });
  assert.equal(next.envYear, 1952);
  assert.equal(next.stadium, "1958 Tiger Stadium");
  assert.equal(next.parkName, "Tiger Stadium");
  assert.deepEqual([next.cardYearMin, next.cardYearMax], [1910, 1959]);
  assert.deepEqual([next.ratingsMin, next.ratingsMax, next.dh], [40, 99, false], "untouched fields keep their values");
  const r = next.restrictions!;
  assert.equal(r.cardTypes, undefined);
  assert.equal(r.pendingRefresh, undefined);
  assert.equal(r.cards, 26, "other restriction keys stay");
  assert.equal(r.text, "Diamond or lower. Cards 1910-1959.");
  assert.equal(r.textFrom, "2026-09-19 weekly post");
  const prev = r.previousFormat as Record<string, unknown>;
  assert.equal(prev.envYear, 1975);
  assert.equal(prev.stadium, "1981 Metropolitan Stadium");
  assert.deepEqual((prev.restrictions as Record<string, unknown>).cardTypes, ["Negro League Star+Future Legend+Snapshot"]);
});

test("previousFormat keeps only the last format, and a null window clears the years", () => {
  const once = editCatalogueRules(lastWeek, { envYear: 1952, cardYears: [1910, 1959], at: "2026-09-26" });
  const twice = editCatalogueRules(once, { envYear: 2010, cardYears: null, at: "2026-10-03" });
  assert.deepEqual([twice.cardYearMin, twice.cardYearMax], [null, null]);
  const prev = twice.restrictions!.previousFormat as Record<string, unknown>;
  assert.equal(prev.envYear, 1952);
  assert.equal((prev.restrictions as Record<string, unknown>).previousFormat, undefined, "no nesting");
});

test("a card-set rule the catalogue was missing is added, and the old rules kept", () => {
  const next = editCatalogueRules({ ...lastWeek, restrictions: { slots: { P: 8 } } }, {
    cardTypes: ["Historical All-Star+Hardware Heroes"], note: "field exports: only these two sets played", at: "2026-09-27",
  });
  assert.deepEqual(next.restrictions!.cardTypes, ["Historical All-Star+Hardware Heroes"]);
  assert.deepEqual(next.restrictions!.slots, { P: 8 });
  assert.equal((next.restrictions!.previousFormat as { restrictions: Record<string, unknown> }).restrictions.cardTypes, undefined);
});


import { keepHandRules } from "./catalogue-edit";

test("a refresh import keeps hand-set rules unless the post states them", () => {
  const onFile = { slot: 139, refreshText: "old", cardTypes: ["Historical All-Star+Hardware Heroes"], textFrom: "L.J. 2026-09-27", slots: { P: 8 } };
  const fresh = { slot: 139, refreshText: "Slots: 8 Perfect…", slots: { P: 8, D: 6 } };
  const kept = keepHandRules(onFile, fresh);
  assert.deepEqual(kept.cardTypes, ["Historical All-Star+Hardware Heroes"]);
  assert.equal(kept.textFrom, "L.J. 2026-09-27");
  assert.deepEqual(kept.slots, { P: 8, D: 6 }, "what the post states wins");
  assert.equal(kept.refreshText, "Slots: 8 Perfect…");
  const posted = keepHandRules(onFile, { ...fresh, cardTypes: ["Live"] });
  assert.deepEqual(posted.cardTypes, ["Live"], "a set rule in the post replaces the kept one");
  assert.deepEqual(keepHandRules(null, fresh), fresh);
});

test("a value window set by hand is confirmed: the name-inferred marker goes", () => {
  const dank: CatalogueRules = { ...lastWeek, ratingsMin: 40, ratingsMax: 59, restrictions: { valueWindowFrom: "refresh post section: iron (name has no tier word - confirm on screen)" } };
  const set = editCatalogueRules(dank, { value: [40, 59], at: "2026-09-27" });
  assert.equal(set.restrictions?.valueWindowFrom, undefined);
  assert.equal((set.restrictions?.previousFormat as { restrictions: Record<string, unknown> }).restrictions.valueWindowFrom, dank.restrictions!.valueWindowFrom, "kept in the previous format");
  assert.equal(editCatalogueRules(dank, { dh: true, at: "2026-09-27" }).restrictions?.valueWindowFrom, dank.restrictions!.valueWindowFrom, "other edits leave it");
});

import { parseSlots } from "./catalogue-edit";

test("a slot line reads as the game means it: the spots it leaves go to the next tier down", () => {
  assert.deepEqual(parseSlots("P6, D4, G4, S4, B4"), { P: 6, D: 4, G: 4, S: 4, B: 4, I: 4 }, "Daily Open Slots");
  assert.deepEqual(parseSlots("Slots: P8, D6, G4, S3, B3"), { P: 8, D: 6, G: 4, S: 3, B: 3, I: 2 }, "Sunday Open Slots");
  assert.deepEqual(parseSlots("P8, D8, G4, S4, B2"), { P: 8, D: 8, G: 4, S: 4, B: 2, I: 0 }, "Time Travelers: a full 26");
  assert.deepEqual(parseSlots("SLOTS: 12 Gold, 8 Silver, 6 Bronze, 0 Iron"), { P: 0, D: 0, G: 12, S: 8, B: 6, I: 0 }, "the summary's words; no Perfect or Diamond");
  assert.deepEqual(parseSlots("P6, D4"), { P: 6, D: 4, G: 16, S: 0, B: 0, I: 0 });
  assert.throws(() => parseSlots("P20, D8"), /more than a 26-card roster/);
  assert.throws(() => parseSlots("no slots here"), /no tier/);
  const next = editCatalogueRules(lastWeek, { slots: parseSlots("P6, D4, G4, S4, B4"), at: "2026-09-27" });
  assert.deepEqual(next.restrictions?.slots, { P: 6, D: 4, G: 4, S: 4, B: 4, I: 4 });
});
