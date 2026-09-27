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
