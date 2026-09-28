import { test } from "node:test";
import assert from "node:assert/strict";
import { eventGroupOf, groupEvents } from "./event-groups";

const ev = (name: string, extra: { isDraft?: boolean; retired?: boolean } = {}) => ({ name, isDraft: false, retired: false, ...extra });

test("each event lands in one picker group", () => {
  assert.equal(eventGroupOf(ev("Daily Diamond Cap")), "Dailies — Diamond");
  assert.equal(eventGroupOf(ev("Daily Live Gold")), "Dailies — Gold", "a tier word wins over Live");
  assert.equal(eventGroupOf(ev("Daily Live Plus")), "Dailies — Live");
  assert.equal(eventGroupOf(ev("Daily All-Star Hardware Slots")), "Dailies — Other");
  assert.equal(eventGroupOf(ev("Friday Nightmare Cap")), "Weeklies — Friday");
  assert.equal(eventGroupOf(ev("Bronze Quick")), "Quicks");
  assert.equal(eventGroupOf(ev("Daily All-Gold", { isDraft: true })), "Perfect Drafts", "a draft is a draft, whatever its name");
  assert.equal(eventGroupOf(ev("PTCS 7 Diamond")), "Specials");
});

test("EF and retired events are in no picker", () => {
  assert.equal(eventGroupOf(ev("EF Gold H2H")), null);
  assert.equal(eventGroupOf(ev("Daily Diamond", { retired: true })), null);
});

test("groups come in the fixed order, and `first` leads", () => {
  const catalog = [ev("Specials Night"), ev("Daily All-Gold", { isDraft: true }), ev("Daily Iron"), ev("Monday Madness"), ev("Daily Iron Cap")];
  const plain = groupEvents(catalog, (c) => c.name);
  assert.deepEqual(plain.map((g) => g.label), ["Dailies — Iron", "Weeklies — Monday", "Perfect Drafts", "Specials"]);
  assert.deepEqual(plain[0].items, ["Daily Iron", "Daily Iron Cap"], "catalogue order within a group");
  const drafts = groupEvents(catalog, (c) => c.name, { first: ["Perfect Drafts"] });
  assert.deepEqual(drafts.map((g) => g.label), ["Perfect Drafts", "Dailies — Iron", "Weeklies — Monday", "Specials"]);
});
