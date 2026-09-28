import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeFilters, clearChip, clearFilters, countLine, countOfKind, defaultFilters, describeFilters, filterLines,
  filtersFromParams, filtersToParams, kindOf, minOf, ratedAt, valueRange, withKind, type FilterLine, type PlayedFilters,
} from "./played-filters";

const bat = (name: string, extra: Partial<FilterLine> = {}): FilterLine => ({
  name, val: 100, role: null, isPitcher: false, bats: "R", throws: "R", year: 1990, owned: false, n: 5000, cardType: 5, defPos: { "1B": 60 }, ...extra,
});
const arm = (name: string, role: string, extra: Partial<FilterLine> = {}): FilterLine => bat(name, { isPitcher: true, role, defPos: null, ...extra });

const LINES: FilterLine[] = [
  bat("Mike Piazza", { defPos: { C: 64, "1B": 55 }, cardType: 7 }),
  bat("Cal Raleigh", { bats: "S", defPos: { C: 100 }, cardType: 1, year: 2025 }),
  bat("Hank Aaron", { defPos: { RF: 87, LF: 85, "1B": 75, CF: 57 }, owned: true }),
  bat("José Ramírez", { bats: "S", val: 99, defPos: { "3B": 120 }, cardType: 1, year: 2022 }),
  bat("Gold Glover", { val: 85, bats: "L", defPos: { SS: 110 }, n: 200 }),
  arm("Walter Johnson", "SP", { throws: "R" }),
  arm("Kenley Jansen", "CL", { throws: "R", cardType: 1 }),
  arm("Billy Wagner", "RP", { throws: "L" }),
];
const names = (f: PlayedFilters) => filterLines(LINES, f).map((l) => l.name);
const base = defaultFilters();

test("kinds: a closer and a set-up man are relievers; only SP starts", () => {
  assert.deepEqual(LINES.map(kindOf), ["hit", "hit", "hit", "hit", "hit", "sp", "rp", "rp"]);
  assert.equal(countOfKind(LINES, "hit"), 5, "the count is out of the current kind only");
  assert.equal(countOfKind(LINES, "sp"), 1);
  assert.equal(countOfKind(LINES, "rp"), 2);
});

test("switching kind starts the hand and position over", () => {
  const f = withKind({ ...base, hand: "S", pos: "C", win: 5 }, "sp");
  assert.equal(f.hand, "all", "S on Starters matched nothing: 0 of 1,836");
  assert.equal(f.pos, "all");
  assert.equal(f.win, 5, "the value window is the round's, so it stays");
  assert.deepEqual(names(f), []);
  assert.deepEqual(names({ ...f, win: 0 }), ["Walter Johnson"]);
});

test("a position means L.J.'s glove floor there", () => {
  assert.deepEqual(names({ ...base, pos: "C" }), ["Mike Piazza", "Cal Raleigh"], "Piazza's C 64 clears the floor of 60");
  assert.deepEqual(names({ ...base, pos: "CF" }), [], "Aaron's CF 57 is under 60");
  assert.deepEqual(names({ ...base, pos: "LF" }), ["Hank Aaron"]);
  assert.deepEqual(names({ ...base, pos: "1B" }), ["Hank Aaron"], "first base has the floor too: Piazza's 1B 55 is under it");
  assert.equal(names({ ...base, pos: "DH" }).length, 4, "anyone can DH (the min PA still holds)");
  assert.equal(ratedAt({ RF: 87, LF: 85, "1B": 75, CF: 57 }), "RF 87 · LF 85 · 1B 75");
  assert.equal(ratedAt({ C: 64, "1B": 55 }), "C 64", "1B 55 is under the floor now");
});

test("hand: a switch hitter bats both ways, an arm throws one", () => {
  assert.deepEqual(names({ ...base, hand: "L" }), ["Cal Raleigh", "José Ramírez"], "the L bat under 300 PA is out");
  assert.deepEqual(names({ ...base, hand: "S" }), ["Cal Raleigh", "José Ramírez"]);
  assert.deepEqual(names({ ...base, kind: "rp", hand: "L" }), ["Billy Wagner"]);
});

test("min PA is 300 in the field; emptied, there is no minimum", () => {
  assert.equal(base.min, "300");
  assert.equal(minOf(base), 300);
  assert.equal(minOf({ min: "" }), 0);
  assert.ok(!names(base).includes("Gold Glover"));
  assert.ok(names({ ...base, min: "" }).includes("Gold Glover"));
});

test("value: a window, or typed bounds that replace it", () => {
  assert.deepEqual(valueRange({ win: 5, lo: "", hi: "" }), [80, 89]);
  assert.deepEqual(valueRange({ win: 5, lo: "95", hi: "" }), [95, 999], "a typed bound replaces the window, open on the other side");
  assert.deepEqual(names({ ...base, min: "", win: 5 }), ["Gold Glover"]);
  assert.deepEqual(names({ ...base, hi: "99" }), ["José Ramírez"]);
});

test("search ignores case and accents; sets, years and owned narrow", () => {
  assert.deepEqual(names({ ...base, q: "jose" }), ["José Ramírez"]);
  assert.deepEqual(names({ ...base, sets: [1] }), ["Cal Raleigh", "José Ramírez"]);
  assert.deepEqual(names({ ...base, y1: "2000" }), ["Cal Raleigh", "José Ramírez"]);
  assert.deepEqual(names({ ...base, y2: "1999" }), ["Mike Piazza", "Hank Aaron"]);
  assert.deepEqual(names({ ...base, own: true }), ["Hank Aaron"]);
});

test("the URL carries only what differs, and reads back the same", () => {
  assert.equal(filtersToParams(base).toString(), "", "a plain board is a plain URL");
  const f: PlayedFilters = { ...base, kind: "hit", win: 1, pos: "C", hand: "S", y1: "1990", y2: "2026", min: "1000", own: true, q: "aaron", sets: [5, 9] };
  const qs = filtersToParams(f).toString();
  assert.equal(qs, "win=101%2B&pos=C&hand=S&y1=1990&y2=2026&min=1000&own=1&q=aaron&sets=5%2C9");
  const p = new URLSearchParams(qs);
  assert.deepEqual(filtersFromParams((k) => p.get(k)), f);
  const empty = new URLSearchParams(filtersToParams({ ...base, min: "" }).toString());
  assert.equal(filtersFromParams((k) => empty.get(k)).min, "", "an emptied Min survives a reload");
});

test("junk in the URL is the default, and an arm never gets a hitter's filters", () => {
  const p = new URLSearchParams("kind=sp&pos=C&hand=S&lo=abc&win=platinum&min=-5&sets=99");
  const f = filtersFromParams((k) => p.get(k));
  assert.deepEqual(f, { ...base, kind: "sp" });
});

test("sets default to the event's rule, and stay inside it", () => {
  const rule = [5, 9];
  assert.deepEqual(defaultFilters(rule).sets, [5, 9]);
  assert.equal(filtersToParams(defaultFilters(rule), rule).toString(), "", "the rule's own sets are the default");
  const one = new URLSearchParams("sets=9,7");
  assert.deepEqual(filtersFromParams((k) => one.get(k), rule).sets, [9], "a set the rule bars is dropped");
  const all = new URLSearchParams("sets=all");
  assert.deepEqual(filtersFromParams((k) => all.get(k), rule).sets, []);
  assert.equal(filtersToParams({ ...defaultFilters(rule), sets: [] }, rule).toString(), "sets=all");
});

test("chips name what is in effect; clearing one, or all, goes back to the default", () => {
  const f: PlayedFilters = { ...base, win: 5, pos: "C", hand: "L", y1: "1990", min: "", own: true, q: "x", sets: [1] };
  assert.deepEqual(activeFilters(f).map((c) => c.label), ["Gold 80–89", "At C", "Bats L", "Years 1990+", "No min PA", "Owned only", "Sets Live"]);
  assert.deepEqual(activeFilters({ ...base, kind: "sp", lo: "90", hi: "99", min: "500" }).map((c) => c.label), ["Value 90–99", "Min BF 500"]);
  assert.deepEqual(activeFilters({ ...base, win: 1 }).map((c) => c.label), ["Value 101+"]);
  assert.deepEqual(activeFilters({ ...base, win: 3 }).map((c) => c.label), ["Perfect 100+"]);
  assert.equal(clearChip(f, "pos").pos, "all");
  assert.equal(clearChip(f, "min").min, "300");
  assert.deepEqual(clearChip({ ...f, sets: [] }, "sets", [5, 9]).sets, [5, 9]);
  assert.deepEqual(clearFilters({ ...f, kind: "rp" }), { ...base, kind: "rp" }, "the kind stays, the search goes");
  assert.equal(describeFilters({ ...base, pos: "C", q: " piazza " }), "At C · “piazza”");
});

test("the count names the kind, and the event when there is one", () => {
  assert.equal(countLine(1544, 2288, "hit"), "1,544 of 2,288 hitters");
  assert.equal(countLine(52, 187, "sp", "Daily All-Star Hardware Slots"), "52 of 187 starters legal in Daily All-Star Hardware Slots");
});
