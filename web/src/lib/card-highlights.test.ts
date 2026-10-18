import { test } from "node:test";
import assert from "node:assert/strict";
import type { CardFitData, FitCard, FitRow } from "./card-fit-load";
import { alsoOn, buildHighlights, byStrength, groupByDay, highlightOf, meter, pickSpotlight, priceOf, shortEvent, standing, tierOf, worthOf, type Highlight } from "./card-highlights";

const card = (id: number, extra: Partial<FitCard> = {}): FitCard => ({
  id, name: `Card ${id}`, val: 80, tier: null, pos: "SS", role: null, hand: "R", year: 2007, set: 7, le: false,
  firstSeen: "2026-10-16", owned: { base: false, variant: false }, ask: null, last10: null, last10Variant: null, ...extra,
});

const row = (eventId: number, status: FitRow["status"], gain = 0, extra: Partial<FitRow> = {}): FitRow => ({
  spot: "SS", runsR: 0, runsL: 0, value: 0, rank: 3, of: 80, status, gain, swaps: [], on: [], short: null,
  eventId, variant: false, played: null, capCost: null, ...extra,
});

const events = [101, 102, 103, 104, 105].map((id) => ({ id, name: id === 101 ? "Daily Gold Slots" : `Weekly ${id}` })) as CardFitData["events"];

const data = (cards: CardFitData["cards"]): CardFitData => ({ events, cards, collectionDate: "2026-10-17", shopDate: "2026-10-17" });

const h = (id: number, best: number, starts: number, extra: Partial<Highlight> = {}): Highlight => ({
  card: card(id), tier: "Gold", mine: false, newVariant: false, legal: 10, starts, on: 0, best, top: [], ...extra,
});

test("a card's highlight: starts counted, the best three events by gain, names shortened", () => {
  const x = highlightOf({
    card: card(1),
    rows: [row(102, "start", 4), row(101, "start", 12.5, { spot: "DH", variant: true }), row(103, "on"), row(104, "start", 7), row(105, "start", 1), row(106, "bench")],
  }, (id) => events.find((e) => e.id === id)?.name);
  assert.equal(x.legal, 6);
  assert.equal(x.starts, 4);
  assert.equal(x.on, 1);
  assert.equal(x.best, 12.5);
  assert.deepEqual(x.top.map((t) => [t.event, t.gain, t.spot]), [["Gold Slots", 12.5, "DH"], ["Weekly 104", 7, "SS"], ["Weekly 102", 4, "SS"]]);
  assert.equal(x.top[0].variant, true);
  assert.equal(x.top.length, 3, "at most three");
  const none = highlightOf({ card: card(2), rows: [row(101, "bench"), row(106, "on")] }, () => undefined);
  assert.equal(none.best, 0);
  assert.deepEqual(none.top, []);
});

test("an event missing from the list still gets a name", () => {
  const x = highlightOf({ card: card(1), rows: [row(999, "start", 3)] }, () => undefined);
  assert.equal(x.top[0].event, "Event 999");
});

test("strongest first: gain, then starts, then rosters already on, then value, then name", () => {
  const xs = [h(1, 5, 2), h(2, 9, 1), h(3, 5, 4), h(4, 0, 0, { on: 3 }), h(5, 0, 0), h(6, 0, 0, { card: card(6, { val: 95 }) })];
  assert.deepEqual([...xs].sort(byStrength).map((x) => x.card.id), [2, 3, 1, 4, 6, 5]);
});

test("the spotlight is the biggest gain; ties go to more starts; none when nothing starts", () => {
  assert.equal(pickSpotlight([h(1, 20, 3), h(2, 31, 1), h(3, 4, 9)])?.card.id, 2);
  assert.equal(pickSpotlight([h(1, 20, 3), h(2, 20, 5)])?.card.id, 2);
  assert.equal(pickSpotlight([h(1, 0, 0, { on: 4 }), h(2, 0, 0)]), null);
  assert.equal(pickSpotlight([]), null);
});

test("the shop's cards group by the day they appeared, newest day first, strongest first within it", () => {
  const at = (id: number, day: string, best: number) => h(id, best, best > 0 ? 1 : 0, { card: card(id, { firstSeen: day }) });
  const days = groupByDay([at(1, "2026-10-14", 3), at(2, "2026-10-16", 1), at(3, "2026-10-14", 9), at(4, "2026-10-18", 0), at(5, "2026-10-16", 6)]);
  assert.deepEqual(days.map((d) => d.day), ["2026-10-18", "2026-10-16", "2026-10-14"]);
  assert.deepEqual(days.map((d) => d.cards.map((x) => x.card.id)), [[4], [5, 2], [3, 1]]);
  assert.deepEqual(days.map((d) => d.starting), [0, 2, 2]);
});

test("his new cards come out of the shop's list, and the spotlight looks at both", () => {
  const d = data([
    { card: card(1, { val: 64, firstSeen: "2026-08-22", owned: { base: true, variant: true } }), rows: [row(101, "start", 28.3)] },
    { card: card(2, { val: 102, firstSeen: "2026-10-16" }), rows: [row(101, "start", 46.3), row(102, "start", 10)] },
    { card: card(3, { val: 85, firstSeen: "2026-10-16", owned: { base: true, variant: false } }), rows: [row(101, "on")] },
    { card: card(4, { val: 52, firstSeen: "2026-10-18" }), rows: [] },
  ]);
  const out = buildHighlights({ data: d, pulled: [1, 3], variants: [1] });
  assert.equal(out.spotlight?.card.id, 2, "the shop's card has the biggest gain");
  assert.equal(out.max, 46.3);
  assert.deepEqual(out.yours.map((x) => x.card.id), [1, 3]);
  assert.equal(out.yours[0].newVariant, true);
  assert.equal(out.yours[1].newVariant, false);
  assert.deepEqual(out.shop.map((g) => [g.day, g.cards.map((x) => x.card.id)]), [["2026-10-18", [4]], ["2026-10-16", [2]]]);
  assert.deepEqual(out.tiers, [{ tier: "Iron", n: 1 }, { tier: "Bronze", n: 1 }, { tier: "Gold", n: 1 }, { tier: "Perfect", n: 1 }]);
  assert.equal(out.shown, 4);
  assert.equal(out.starting, 2);
});

test("a tier filter narrows every part, the spotlight included, but not the tier chips", () => {
  const d = data([
    { card: card(1, { val: 64 }), rows: [row(101, "start", 8)] },
    { card: card(2, { val: 102 }), rows: [row(101, "start", 46.3)] },
    { card: card(3, { val: 61 }), rows: [row(101, "start", 3)] },
  ]);
  const bronze = buildHighlights({ data: d, pulled: [3] }, "Bronze");
  assert.equal(bronze.spotlight?.card.id, 1);
  assert.deepEqual(bronze.yours.map((x) => x.card.id), [3]);
  assert.deepEqual(bronze.shop.flatMap((g) => g.cards.map((x) => x.card.id)), [1]);
  assert.deepEqual(bronze.tiers.map((t) => t.tier), ["Bronze", "Perfect"]);
  const diamond = buildHighlights({ data: d, pulled: [] }, "Diamond");
  assert.equal(diamond.spotlight, null);
  assert.equal(diamond.shown, 0);
  assert.equal(diamond.max, 0);
});

test("a card that isn't one of his can't be a new variant, and a missing variants list is none", () => {
  const d = data([{ card: card(1), rows: [] }]);
  assert.equal(buildHighlights({ data: d, pulled: [], variants: [1] }).shop[0].cards[0].newVariant, false);
  assert.equal(buildHighlights({ data: d, pulled: [1] }).yours[0].newVariant, false);
});

test("the tier is the card's own when on file, else its value's", () => {
  assert.equal(tierOf({ tier: "Diamond", val: 80 }), "Diamond");
  assert.equal(tierOf({ tier: null, val: 100 }), "Perfect");
  assert.equal(tierOf({ tier: "??", val: 59 }), "Iron");
  assert.equal(tierOf({ tier: null, val: 70 }), "Silver");
});

test("the headline says plainly where it starts, or why it doesn't", () => {
  assert.equal(standing({ starts: 11, legal: 12, on: 0 }), "Starts in 11 of 12 events");
  assert.equal(standing({ starts: 1, legal: 1, on: 0 }), "Starts in 1 of 1 event");
  assert.equal(standing({ starts: 0, legal: 30, on: 3 }), "Already on 3 rosters");
  assert.equal(standing({ starts: 0, legal: 30, on: 1 }), "Already on 1 roster");
  assert.equal(standing({ starts: 0, legal: 44, on: 0 }), "Doesn't start anywhere yet (legal in 44)");
  assert.equal(standing({ starts: 0, legal: 0, on: 0 }), "Not legal in any current event");
  assert.equal(alsoOn({ starts: 4, on: 3 }), "already on 3 rosters");
  assert.equal(alsoOn({ starts: 0, on: 3 }), null, "the headline says it already");
  assert.equal(alsoOn({ starts: 4, on: 0 }), null);
});

test("the meter is the gain against the biggest shown, clamped", () => {
  assert.equal(meter(23, 46), 0.5);
  assert.equal(meter(50, 46), 1);
  assert.equal(meter(0, 46), 0);
  assert.equal(meter(5, 0), 0);
});

test("price: his, else the ask, else the last 10, else not listed", () => {
  assert.deepEqual(priceOf({ owned: { base: true, variant: true }, ask: 100, last10: 90 }), { text: "yours (variant)", kind: "yours" });
  assert.deepEqual(priceOf({ owned: { base: true, variant: false }, ask: 100, last10: 90 }), { text: "yours", kind: "yours" });
  const ask = priceOf({ owned: { base: false, variant: false }, ask: 34_999, last10: 25_655 });
  assert.equal(ask.text, "35k");
  assert.equal(ask.kind, "ask");
  assert.match(ask.title ?? "", /34,999.*25,655/);
  assert.equal(priceOf({ owned: { base: false, variant: false }, ask: null, last10: 385_000 }).text, "L10 385k");
  assert.equal(priceOf({ owned: { base: false, variant: false }, ask: null, last10: null }).kind, "none");
});

test("what his new card sells for is the form he got", () => {
  assert.equal(worthOf({ last10: 1668, last10Variant: 9000 }, true), 9000);
  assert.equal(worthOf({ last10: 1668, last10Variant: 9000 }, false), 1668);
  assert.equal(worthOf({ last10: null, last10Variant: null }, true), null);
});

test("event names lose a leading Daily only", () => {
  assert.equal(shortEvent("Daily Gold Slots"), "Gold Slots");
  assert.equal(shortEvent("Friday Daily Grind"), "Friday Daily Grind");
});
