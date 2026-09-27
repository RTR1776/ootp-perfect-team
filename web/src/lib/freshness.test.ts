import { test } from "node:test";
import assert from "node:assert/strict";
import { freshnessSummary, type Source } from "./freshness";

const source = (over: Partial<Source>): Source => ({
  key: "shop", label: "Shop list", asOf: "2026-09-25", age: 2, staleAfter: 7, stale: false, when: "2d", detail: "", you: "", dev: "", ...over,
});

test("the header says what is stale, in plain words", () => {
  const now = new Date("2026-09-27T15:00:00Z");
  const current = [source({}), source({ key: "collection", label: "Collection", age: 1 })];
  assert.equal(freshnessSummary(current, now), "All 2 sources current");
  assert.equal(
    freshnessSummary([
      ...current,
      source({ key: "dump", label: "Community dump", asOf: "2026-09-21", age: 6, staleAfter: 5, stale: true }),
      source({ key: "league", label: "League week", asOf: "2026-09-20", age: null, stale: true }),
      source({ key: "catalogue", label: "Tournament catalogue", asOf: "2026-09-26", age: 1, stale: true }),
      source({ key: "play", label: "Tournament play", asOf: null, age: null, stale: true }),
    ], now),
    "4 stale: Community dump 6 days, League week ending Sep 20, Tournament catalogue 1 day, Tournament play: none on file",
  );
});
