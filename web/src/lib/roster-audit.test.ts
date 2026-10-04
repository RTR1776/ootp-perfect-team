import { test } from "node:test";
import assert from "node:assert/strict";
import { auditRoster, orderStaff, starterStaminaFloor } from "./roster-audit";
import { LJ_FLOOR } from "./pos-floor";

const bat = (id: number, name: string, pos: Record<string, number>) => ({ cardId: id, name, isPitcher: false, ratings: Object.fromEntries(Object.entries(pos).map(([p, v]) => [`Pos Rating ${p}`, v])) });
const arm = (id: number, name: string, stm: number) => ({ cardId: id, name, isPitcher: true, ratings: { Stamina: stm } });

test("the audit flags a missing backup SS, a short starter, a crowded pen and no long man", () => {
  const cards = [bat(1, "Banks", { SS: 133 }), bat(2, "Wood", { "1B": 105 }), bat(3, "Rolen", { "3B": 137 })];
  const pitchers = Array.from({ length: 13 }, (_, i) => arm(100 + i, `P${i}`, i < 6 ? 70 : 20));
  pitchers[0].ratings.Stamina = 30;
  const slots: Record<string, number> = { "R:SS": 1, "L:SS": 1, "R:1B": 2, "L:1B": 2, "R:3B": 3, "L:3B": 3 };
  pitchers.forEach((p, i) => { slots[i < 6 ? `SP${i + 1}` : i === 6 ? "CL" : `RP${i - 6}`] = p.cardId; });
  const lines = auditRoster({ slots, cards: new Map([...cards, ...pitchers].map((c) => [c.cardId, c])), lineupPos: ["1B", "3B", "SS"], envYear: 2010, posFloor: LJ_FLOOR });
  const bad = lines.filter((l) => !l.ok).map((l) => l.text);
  assert.ok(bad.some((t) => t.startsWith("staff 6 SP / 7 RP")), "6 SP, 13 arms");
  assert.ok(bad.some((t) => t.includes("SHORT: P0")), "a starter at stamina 30");
  assert.ok(bad.some((t) => t.startsWith("no long man")));
  assert.ok(bad.some((t) => t.startsWith("SS backup: NONE")), "Banks never rests");
});

test("older eras ask more of a starter", () => {
  assert.ok(starterStaminaFloor(1910) > starterStaminaFloor(1960));
  assert.ok(starterStaminaFloor(1960) > starterStaminaFloor(2010));
});

test("the closer is the best reliever and SP1 the best starter", () => {
  const v: Record<number, number> = { 1: 7, 2: 11, 3: 9, 10: -1, 11: 10, 12: 4 };
  const o = orderStaff({ SP1: 1, SP2: 2, SP3: 3, CL: 10, RP1: 11, RP2: 12, "R:C": 50 }, (id) => v[id]);
  assert.deepEqual([o.SP1, o.SP2, o.SP3, o.CL, o.RP1, o.RP2, o["R:C"]], [2, 3, 1, 11, 12, 10, 50]);
});
