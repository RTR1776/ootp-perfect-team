import { test } from "node:test";
import assert from "node:assert/strict";
import { boardReport, boardRow, loadFileCards, loadFileShortfalls, parseBoardRows, readLoadFile, type LoadLine } from "./load-file";
import { HIT_POS, boardShape, nextBenchKey, offShapeKeys, shapeKeys, type FillShape } from "./roster-fill";
import { auditRoster } from "./roster-audit";
import { validateRoster, type RosterRules, type RosterSlot } from "./roster-rules";
import { bothRoles, isTwoWayForm, playersOn, twoWayId, withTwoWayForms } from "./two-way";

/*
 * Saturday Negro Leagues Slots (tournament 779), 2026-11-14: no DH, slots P4 D4 G4 S4 B5 I5, 26 cards.
 * Ed Rile (#87165) is a two-way card at 1B on both boards and SP1. The saved pick the rebuild seeds from is
 * a dual pick: his second role frees a roster spot, held at BN7 by William Tenny (#84400), the backup
 * catcher. The event's shape (5 SP / 7 RP / 14 bats) has six bench keys.
 */
const rules: RosterRules = {
  name: "Saturday Negro Leagues Slots", dh: false, ratingsMin: null, ratingsMax: null, cardYearMin: 1896, cardYearMax: 1964, isDraft: false,
  restrictions: { slots: { P: 4, D: 4, G: 4, S: 4, B: 5, I: 5 } },
};
const eventShape: FillShape = {
  lineupPos: [...HIT_POS], bats: 14,
  spKeys: ["SP1", "SP2", "SP3", "SP4", "SP5"], rpKeys: ["CL", "RP1", "RP2", "RP3", "RP4", "RP5", "RP6"],
  benchKeys: ["BN1", "BN2", "BN3", "BN4", "BN5", "BN6"],
};

// Rile's 1B card with real pitching splits (lib/two-way canPitch), so the pool carries his arm form.
const rileBat = { "Pos Rating 1B": 62, Power: 120, Eye: 90, "Avoid Ks": 80, BABIP: 95, Gap: 90, "Stuff vL": 95, "Stuff vR": 100, "Control vL": 90, "Control vR": 92, "pHR vL": 95, "pHR vR": 98, "pBABIP vL": 90, "pBABIP vR": 91, Stamina: 80 };
// One card per tier slot: P4 D4 G4 S4 B5 I5 is 26.
const VALUES = [102, 101, 100, 104, 95, 94, 93, 92, 88, 87, 86, 85, 78, 77, 76, 75, 68, 67, 66, 65, 64, 58, 57, 56, 55, 54];
let n = 0;
const card = (cardId: number, name: string, isPitcher: boolean, ratings: Record<string, number>, role: string | null = isPitcher ? "SP" : null) =>
  ({ cardId, name, val: VALUES[n++]!, year: 1925, bats: "R", variant: false, isPitcher, role, cardType: 2, baseOwned: true, variantOwned: false, ratings });
const glove = (pos: string, r = 80) => ({ [`Pos Rating ${pos}`]: r, Power: 60, Eye: 60, "Avoid Ks": 60, BABIP: 60, Gap: 60 });
const arm = (stamina: number) => ({ Stuff: 70, Control: 70, pHR: 70, Stamina: stamina });

const rile = card(87165, "Ed Rile", false, rileBat);
const lineup = [
  card(87083, "Pythias Russ", false, glove("C", 70)), rile, card(86896, "Pop Lloyd", false, glove("SS", 90)), card(87309, "Jimmie Lyons", false, glove("CF", 95)),
  card(87438, "John Henry Russell", false, glove("2B", 90)), card(87325, "Candy Jim Taylor", false, glove("3B")), card(87267, "Lester Lockett", false, glove("LF")),
  card(87268, "Charlie Blackwell", false, glove("RF")),
];
const starters = [card(87086, "Claude Grier", true, arm(80)), card(84844, "Satchel Paige", true, arm(85)), card(85864, "Hilton Smith", true, arm(75)), card(86900, "Luther Farrell", true, { ...arm(70), Power: 60, Eye: 55, "Avoid Ks": 60, BABIP: 55, Gap: 50, "Power vL": 55, "Power vR": 62 })];
const pen = [87159, 84884, 87162, 87434, 87437, 86981, 87156].map((id, i) => card(id, `Reliever ${id}`, true, arm(i < 2 ? 60 : 30), "RP"));
const tenny = card(84400, "William Tenny", false, glove("C", 64));
const bench = [
  card(87081, "Esteban Montalvo", false, glove("LF", 70)), card(87269, "Tetelo Vargas", false, glove("RF", 84)), card(86982, "Connie Day", false, { ...glove("2B", 124), "Pos Rating SS": 108, "Pos Rating 3B": 110 }),
  card(87442, "Art Pennington", false, { ...glove("1B", 70), "Pos Rating CF": 60 }), card(87308, "Specs Clark", false, { ...glove("2B", 123), "Pos Rating SS": 105 }), card(87226, "Dan Kennard", false, glove("3B", 40)), tenny,
];
const pool = withTwoWayForms([...lineup, ...starters, ...pen, ...bench]);
const byId = new Map(pool.map((c) => [c.cardId, c]));

/** The saved dual pick, as env-roster's seed reads it. */
const board: Record<string, number> = {};
for (const c of lineup) {
  const pos = c === rile ? "1B" : Object.keys(c.ratings).find((k) => k.startsWith("Pos Rating "))!.slice(11);
  board[`R:${pos}`] = c.cardId; board[`L:${pos}`] = c.cardId;
}
board.SP1 = twoWayId(rile.cardId);
starters.forEach((c, i) => { board[`SP${i + 2}`] = c.cardId; });
pen.forEach((c, i) => { board[i === 0 ? "CL" : `RP${i}`] = c.cardId; });
bench.forEach((c, i) => { board[`BN${i + 1}`] = c.cardId; });

/** A board as the validator reads it. */
const slotsOf = (slots: Record<string, number>): RosterSlot[] => Object.entries(slots).map(([k, cardId]) => {
  const [a, b] = k.split(":");
  return { cardId, slot: b ?? a!, versusHand: b ? a! : "both", lineupOrder: null, useVariant: false };
});

/** The board as env-roster prints it: its rows (the shape's keys), the player count, the roster check. */
function printout(shape: FillShape, slots: Record<string, number>): string {
  const rows = [...shapeKeys(shape), ...offShapeKeys(shape, slots)].map((k) => {
    const id = slots[k];
    const c = id == null ? undefined : byId.get(id);
    return boardRow(k, c, 1.5, c && isTwoWayForm(c.cardId) ? ` ${c.isPitcher ? "SP" : ""} two-way (${c.isPitcher ? "pitching" : "hitting"})` : "");
  });
  const audit = auditRoster({ slots, cards: byId, lineupPos: shape.lineupPos, envYear: 2010, posFloor: null });
  return [...rows, `${playersOn(slots)} players · value 2014 · from seed · 0 variants`, "LEGAL — every rule check passes", "--- roster check ---", ...audit.map((l) => `  ${l.ok ? "✓" : "✗"} ${l.text}`)].join("\n");
}

/** The load file current-rosters writes from a printout: every row's card, pinned by id. */
const loadLines = (text: string): LoadLine[] => parseBoardRows(text).rows.map((r) => ({ key: r.key, cardId: r.cardId, variant: r.variant }));

test("a two-way card on a no-DH slots board: the load file holds every card the board and the roster check count", () => {
  // The board is a legal 26: Rile is one player in two slots, Tenny the 26th.
  const v = validateRoster(slotsOf(board), pool, rules);
  assert.deepEqual(v.errors, []);
  assert.equal(v.counts.players, 26);
  assert.deepEqual(bothRoles(board), [87165]);

  const shape = boardShape(eventShape, board);
  assert.deepEqual(shape.benchKeys, ["BN1", "BN2", "BN3", "BN4", "BN5", "BN6", "BN7"], "the board's own shape holds Tenny's BN7");
  assert.equal(shape.bats, 15);

  const text = printout(shape, board);
  assert.deepEqual(parseBoardRows(text).unread, []);
  const lines = loadLines(text);
  const report = boardReport(text);
  assert.equal(report.players, 26);
  assert.deepEqual(report.staff, { sp: 5, rp: 7, bats: 15 }, "the roster check: staff 5 SP / 7 RP / 15 bats");
  assert.match(text, /C {2}backup: William Tenny 64/);
  assert.equal(loadFileCards(lines).size, 26, "26 distinct cards in the load file");
  assert.equal(loadFileCards(lines).size, report.players);
  assert.deepEqual(loadFileShortfalls(lines, report), []);
  assert.deepEqual(lines.filter((l) => l.cardId === 84400), [{ key: "BN7", cardId: 84400, variant: false }]);
  assert.equal(lines.filter((l) => l.cardId === 87165).length, 3, "Rile on both boards at 1B and at SP1: one card, three lines");
});

test("the 11-14 printout (the event's six bench keys) is caught: Tenny missing, 25 cards against 26 players", () => {
  const text = printout(eventShape, board);
  const lines = loadLines(text);
  assert.equal(loadFileCards(lines).size, 25);
  assert.ok(!lines.some((l) => l.cardId === 84400));
  assert.deepEqual(loadFileShortfalls(lines, boardReport(text)), [
    "the load file holds 25 cards, the board 26 players",
    "14 bats in the load file, the roster check 15 bats",
  ]);
});

test("the dual phase on a board that already has Rile in both roles: the try's bench key is a new one, so all 26 stay", () => {
  // Luther Farrell (SP5) tried in both roles, as on 11-14: his bat takes the spot the try frees.
  const farrellBat = twoWayId(86900);
  assert.ok(byId.has(farrellBat), "Farrell's card has a bat form");
  const nk = nextBenchKey(eventShape, board);
  assert.equal(nk, "BN8", "BN7 is Tenny's");
  const tried: Record<string, number> = { ...board, [nk]: farrellBat };
  assert.equal(playersOn(tried), 26);
  assert.equal(tried.BN7, 84400, "Tenny keeps his spot");
  assert.deepEqual(bothRoles(tried).sort(), [86900, 87165]);
  assert.deepEqual(validateRoster(slotsOf(tried), pool, rules).errors, []);
  // The 11-14 key, counted from the event's six bench keys, was BN7 again: over Tenny, "board holds 25 players, not 26".
  assert.equal(playersOn({ ...board, [`BN${eventShape.benchKeys.length + 1}`]: farrellBat }), 25);
  // A board with no card in both roles frees BN7, as before.
  assert.equal(nextBenchKey(eventShape, Object.fromEntries(Object.entries(board).filter(([k]) => k !== "BN7"))), "BN7");
});

test("boardShape adds only what the board holds; off-shape keys are named", () => {
  const plain = Object.fromEntries(Object.entries(board).filter(([k]) => k !== "BN7"));
  assert.equal(boardShape(eventShape, plain), eventShape, "nothing more: the same shape");
  assert.deepEqual(offShapeKeys(eventShape, board), []);
  const withDh = { ...board, "R:DH": 87081 };
  assert.deepEqual(offShapeKeys(eventShape, withDh), ["R:DH"], "a DH slot in a no-DH event has no place in the shape");
  const sp6 = boardShape(eventShape, { ...board, SP6: 86900, RP7: 84884 });
  assert.deepEqual(sp6.spKeys, ["SP1", "SP2", "SP3", "SP4", "SP5", "SP6"]);
  assert.deepEqual(sp6.rpKeys, ["CL", "RP1", "RP2", "RP3", "RP4", "RP5", "RP6", "RP7"]);
});

test("a row that does not read is reported, not dropped; a load file reads back", () => {
  const long = boardRow("BN1", { cardId: 1, name: "Christobal Torriente-Smithers", val: 101, bats: "L", year: 1920 }, -3.2);
  assert.equal(parseBoardRows(long).rows[0]?.name, "Christobal Torriente-Smithers", "a long name leaves one space before the value");
  const empty = boardRow("BN2", undefined, null);
  const noYear = boardRow("BN3", { cardId: 2, name: "Nobody", val: 50, bats: "R", year: null }, 1);
  assert.deepEqual(parseBoardRows([empty, noYear].join("\n")).unread.length, 2);
  const file = "# header\nR:C Pythias Russ (VAR) #87083\nSP1 Ed Rile #87165\nBN7 William Tenny #84400\n";
  assert.deepEqual(readLoadFile(file), [
    { key: "R:C", cardId: 87083, variant: true }, { key: "SP1", cardId: 87165, variant: false }, { key: "BN7", cardId: 84400, variant: false },
  ]);
});
