import { test } from "node:test";
import assert from "node:assert/strict";
import { freshCutoff, isBuyCandidate, isClubhouseTitle, isFresh, NEW_CARD_DAYS } from "./upgrade-candidates";

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

test("a card is new for a week after the newest card on file", () => {
  const cutoff = freshCutoff([day("2026-11-01"), day("2026-11-12"), day("2026-09-20")]);
  assert.equal(cutoff, day("2026-11-12").getTime() - NEW_CARD_DAYS * 86_400_000);
  assert.equal(isFresh(day("2026-11-12"), cutoff), true);
  assert.equal(isFresh(day("2026-11-05"), cutoff), true);
  assert.equal(isFresh(day("2026-11-04"), cutoff), false);
  assert.equal(isFresh(day("2026-09-20").getTime(), cutoff), false);
});

test("with no cards on file nothing is new", () => {
  const cutoff = freshCutoff([]);
  assert.equal(isFresh(day("2026-11-12"), cutoff), false);
});

test("Clubhouse titles", () => {
  assert.equal(isClubhouseTitle("Clubhouse - Baseball Reference 10 SP Sandy Koufax LAD 1963"), true);
  assert.equal(isClubhouseTitle("clubhouse - Rookie of the Year 1B Sal Stewart CIN 2025"), true);
  assert.equal(isClubhouseTitle("Mariners 50th Anniversary CF Ken Griffey Jr. SEA 1996"), false);
  assert.equal(isClubhouseTitle("Award Winners - Clubhouse Hero 2B Somebody 1990"), false);
  assert.equal(isClubhouseTitle(null), false);
});

test("a card is placed when it has a price, is new, or is a Clubhouse card", () => {
  assert.equal(isBuyCandidate({ priced: true, fresh: false, clubhouse: false }), true);
  assert.equal(isBuyCandidate({ priced: false, fresh: true, clubhouse: false }), true);
  assert.equal(isBuyCandidate({ priced: false, fresh: false, clubhouse: true }), true);
  assert.equal(isBuyCandidate({ priced: false, fresh: false, clubhouse: false }), false);
});
