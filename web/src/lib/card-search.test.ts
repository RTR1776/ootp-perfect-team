import { test } from "node:test";
import assert from "node:assert/strict";
import { cardIndex, matchCards, normName, searchKey, type SearchCard } from "./card-search";

// The page sends the list by card value, highest first.
const CARDS: Array<SearchCard & { id: number }> = [
  { id: 1, name: "Hank Aaron", label: "Hank Aaron 102 · 1971 RF" },
  { id: 2, name: "Scott Rolen", label: "Scott Rolen 101 · 2004 3B", owned: "base" },
  { id: 3, name: "Dave Winfield", label: "Dave Winfield 97 · 1979 RF" },
  { id: 4, name: "Mel Ott", label: "Mel Ott 101 · 1929 RF", owned: "base" },
  { id: 5, name: "Hank Aaron", label: "Hank Aaron 95 · 1957 CF", owned: "variant" },
  { id: 6, name: "José Ramírez", label: "José Ramírez 99 · 2022 3B" },
  { id: 7, name: "Paul O'Neill", label: "Paul O'Neill 90 · 1994 RF" },
  { id: 8, name: "Kenley Jansen", label: "Kenley Jansen 100 · 2017 CL · RP", owned: "base" },
  { id: 9, name: "Mike Piazza", label: "Mike Piazza 101 · 1997 C", owned: "variant" },
];
const idx = cardIndex(CARDS);
const ids = (q: string, limit?: number) => matchCards(idx, q, limit).map((c) => c.id);

test("normName is the name as the rosters compare it", () => {
  assert.equal(normName("José  Ramírez"), "jose ramirez");
  assert.equal(normName("Paul O'Neill"), "paul oneill");
  assert.equal(normName("Hank Aaron 102"), "hank aaron");
  assert.equal(searchKey("Hank Aaron 102 · 1971 RF"), "hank aaron 102 1971 rf");
  assert.equal(searchKey("J.D. Martinez"), "jd martinez");
});

test("any part of any word matches, ignoring case and accents", () => {
  assert.deepEqual(ids("winf"), [3]);
  assert.deepEqual(ids("Dave Winfield"), [3], "the full name + Enter finds him");
  assert.deepEqual(ids("dave winfield 97 · 1979 rf"), [3], "so does the label the old datalist typed");
  assert.deepEqual(ids("ramirez"), [6]);
  assert.deepEqual(ids("RAMÍREZ"), [6]);
  assert.deepEqual(ids("oneill"), [7]);
  assert.deepEqual(ids("o'neill"), [7]);
  assert.deepEqual(ids("jansen rp"), [8], "every word must match; the role counts");
  assert.deepEqual(ids("xyz"), []);
  assert.deepEqual(ids("   "), [], "nothing typed, nothing listed");
});

test("owned cards come first, then a word that starts with what was typed, then the list's order", () => {
  assert.deepEqual(ids("aaron"), [5, 1], "his variant Aaron before the shop's higher card");
  assert.deepEqual(ids("aaron 1971"), [1], "a year picks one of two cards with the same name");
  // "ott": Mel Ott (owned, word start), Scott Rolen (owned, mid-word).
  assert.deepEqual(ids("ott"), [4, 2]);
  assert.deepEqual(ids("r"), [2, 4, 5, 8, 6, 1, 3, 7], "owned first (Rolen's word starts with r), then Ramírez, then value order");
  assert.equal(ids("r", 3).length, 3, "at most the limit");
  assert.equal(matchCards(cardIndex([...CARDS, ...CARDS]), "r").length, 8, "eight by default");
});
