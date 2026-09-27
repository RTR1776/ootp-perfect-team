import { test } from "node:test";
import assert from "node:assert/strict";
import { initHistory, pushHistory, undoHistory, undoLabel, type History } from "./use-undoable";
import {
  edit, exportChange, exportLabel, freshState, lockMovesFrom, modelReducer, restoreState, scoreRequest, teamEdits,
  type CardBase, type LeagueExport, type ModelAction, type ModelState,
} from "./league-card-state";

const OTT = "Mel Ott#86272", WOOD = "Brandon Wood#86593", BAILEY = "Ed Bailey#86637", ROLEN = "Scott Rolen#86405";
const PIAZZA = "Mike Piazza#86463", CONNOR = "Roger Connor#86577", VAUGHAN = "Arky Vaughan#85021", SOTO = "Juan Soto#90001";
// The newest export (PEL, 09-27) and the one before it (HD451, 09-20), cut down.
const PEL: LeagueExport = { source: "PEL, week of 2026-09-27", roster: [OTT, WOOD, BAILEY, ROLEN, PIAZZA], family: "PEL" };
const HD: LeagueExport = { source: "HD451, week of 2026-09-20", roster: [OTT, WOOD, BAILEY, ROLEN, CONNOR, VAUGHAN], family: "HD" };
const WINFIELD: CardBase = {
  id: 12345, name: "Dave Winfield", title: "Dave Winfield 1979",
  base: {
    "EYE vR": 120, "EYE vL": 130, "POW vR": 150, "POW vL": 160, "GAP vR": 100, "GAP vL": 100,
    "BA vR": 90, "BA vL": 95, "K vR": 110, "K vL": 105, "POS RF": 80, "POS LF": 70, "POS C": 0,
  },
};

/** Actions through the same history the page keeps. */
const play = (h: History<ModelState>, ...actions: ModelAction[]) => actions.reduce((acc, a) => pushHistory(acc, modelReducer(acc.present, a), a), h);
const apply = (s: ModelState, ...actions: ModelAction[]) => actions.reduce(modelReducer, s);

test("removing a player takes his locks with him, and one undo brings both back", () => {
  let h = play(initHistory(freshState(PEL)), edit.lock("vR", "3B", WOOD), edit.lock("vR", "LF", OTT), edit.lock("vL", "RF", OTT));
  h = play(h, edit.remove(OTT));
  assert.ok(!h.present.bats.includes(OTT));
  assert.deepEqual(h.present.locks, { vR: { "3B": WOOD }, vL: {} });
  assert.equal(undoLabel(h), "Remove Mel Ott");
  h = undoHistory(h);
  assert.ok(h.present.bats.includes(OTT));
  assert.deepEqual(h.present.locks, { vR: { "3B": WOOD, LF: OTT }, vL: { RF: OTT } });
});

test("a lock moves a player within a board, and a lock that changes nothing is no step", () => {
  let s = apply(freshState(PEL), edit.lock("vR", "1B", WOOD), edit.lock("vR", "3B", WOOD));
  assert.deepEqual(s.locks.vR, { "3B": WOOD });
  assert.equal(modelReducer(s, edit.lock("vR", "3B", WOOD)), s);
  assert.equal(modelReducer(s, edit.lock("vR", "SS", SOTO)), s, "not on the team");
  assert.equal(modelReducer(s, edit.lock("vL", "3B", null)), s, "nothing to unlock");
  s = modelReducer(s, edit.lock("vR", "3B", OTT));
  assert.deepEqual(s.locks.vR, { "3B": OTT });
  assert.deepEqual(modelReducer(s, edit.lock("vR", "3B", null)).locks.vR, {});
  assert.equal(edit.lock("vR", "3B", WOOD).label, "Lock Brandon Wood at 3B vs RHP");
  assert.equal(edit.lock("vL", "C", null).label, "Unlock C vs LHP");

  // The toast "Moved Brandon Wood from 1B to 3B" needs to know where he was locked.
  const at1B = modelReducer(freshState(PEL), edit.lock("vR", "1B", WOOD));
  assert.equal(lockMovesFrom(at1B, "vR", "3B", WOOD), "1B");
  assert.equal(lockMovesFrom(at1B, "vR", "1B", WOOD), null, "same slot");
  assert.equal(lockMovesFrom(at1B, "vL", "3B", WOOD), null, "the other board is its own");
  assert.equal(lockMovesFrom(at1B, "vR", "3B", OTT), null);
  assert.equal(lockMovesFrom(at1B, "vR", "1B", null), null);
  assert.equal(modelReducer(freshState(PEL), edit.add(OTT)).bats.length, PEL.roster.length, "already on the team");
});

test("a side's step touches only the fields still at base (C3)", () => {
  const s = apply(freshState(PEL), edit.pickCard(WINFIELD), edit.face("EYE vL", "140"));
  const stepped = modelReducer(s, edit.step("vL", 7.5));
  const face = stepped.candidate!.face;
  assert.equal(face["EYE vL"], "140", "typed off the face: kept");
  assert.equal(face["POW vL"], "172");
  assert.equal(face["GAP vL"], "108");
  assert.equal(face["BA vL"], "102");
  assert.equal(face["K vL"], "113");
  for (const k of ["EYE vR", "POW vR", "GAP vR", "BA vR", "K vR", "POS RF"]) assert.equal(face[k], s.candidate!.face[k], `${k} untouched`);
  assert.equal(modelReducer(stepped, edit.step("vL", 7.5)), stepped, "nothing left at base: no step");
  assert.equal(modelReducer(s, edit.step("vR", 0)), s);

  const pos = modelReducer(stepped, edit.step("positions", 7.5)).candidate!.face;
  assert.equal(pos["POS RF"], "86");
  assert.equal(pos["POS LF"], "75");
  assert.equal(pos["POS C"], "", "a position it cannot play stays blank");
  assert.equal(edit.step("vR", 7.5).label, "+7.5% vs RHP");
  assert.equal(edit.step("positions", 10).label, "+10% positions");
});

test("each step and each field's typing is one undo step", () => {
  let h = play(initHistory(apply(freshState(PEL), edit.pickCard(WINFIELD))),
    edit.face("EYE vL", "1"), edit.face("EYE vL", "14"), edit.face("EYE vL", "140"));
  assert.equal(h.past.length, 1);
  assert.equal(undoLabel(h), "Edit Eye vs LHP");
  h = play(h, edit.step("vL", 7.5), edit.step("vR", 7.5));
  assert.equal(undoLabel(h), "+7.5% vs RHP");
  h = undoHistory(h);
  assert.equal(h.present.candidate!.face["POW vR"], "150");
  assert.equal(h.present.candidate!.face["POW vL"], "172");
  assert.equal(h.present.candidate!.face["EYE vL"], "140");
});

test("picking a card starts from its base; picking it again keeps the edits", () => {
  const s = apply(freshState(PEL), edit.pickCard(WINFIELD), edit.face("EYE vL", "140"));
  assert.equal(modelReducer(s, edit.pickCard(WINFIELD)), s);
  const soto = modelReducer(s, edit.pickCard({ id: 777, name: "Juan Soto", title: null, base: { "EYE vR": 150, "POS C": 0 } })).candidate!;
  assert.deepEqual(soto.face, { "EYE vR": "150", "POS C": "" });
  assert.equal(soto.include, true);
  assert.equal(modelReducer(s, edit.baseFace("Dave Winfield")).candidate!.face["EYE vL"], "130");
  assert.equal(modelReducer(s, edit.clearCard("Dave Winfield")).candidate, null);
});

test("Reset team goes back to the export's list and league and clears the locks", () => {
  const s = apply(freshState(PEL), edit.remove(OTT), edit.add(SOTO), edit.lock("vR", "DH", SOTO), edit.family("HD", "PEL"), edit.pickCard(WINFIELD));
  assert.equal(s.familyPinned, true);
  const r = modelReducer(s, edit.resetTeam(PEL));
  assert.deepEqual(r.bats, PEL.roster);
  assert.deepEqual(r.locks, { vR: {}, vL: {} });
  assert.equal(r.settings.family, "PEL");
  assert.equal(r.familyPinned, false);
  assert.equal(r.candidate?.id, WINFIELD.id, "the card stays");
  assert.equal(modelReducer(r, edit.resetTeam(PEL)), r, "already the export: no step");
});

test("a new export keeps hand-added players, drops the gone and their locks, and follows the league (C4)", () => {
  // Built from the HD451 export; Soto added by hand; Rolen taken off.
  const s = apply(freshState(HD), edit.add(SOTO), edit.remove(ROLEN), edit.lock("vR", "1B", CONNOR), edit.lock("vL", "DH", SOTO));
  assert.deepEqual(exportChange(s, PEL), { added: [ROLEN, PIAZZA], gone: [CONNOR, VAUGHAN] });
  assert.equal(exportChange(s, HD), null);

  const u = modelReducer(s, edit.updateTeam(PEL));
  assert.deepEqual(u.bats, [OTT, WOOD, BAILEY, ROLEN, PIAZZA, SOTO]);
  assert.deepEqual(u.locks, { vR: {}, vL: { DH: SOTO } });
  assert.equal(u.settings.family, "PEL");
  assert.equal(u.source, PEL.source);
  assert.equal(exportChange(u, PEL), null);
  assert.deepEqual(teamEdits(u), { added: 1, removed: 0 });

  const pinned = modelReducer(s, edit.family("LD", "HD"));
  assert.equal(modelReducer(pinned, edit.updateTeam(PEL)).settings.family, "LD", "a league he chose stays");
  assert.equal(modelReducer(pinned, edit.family("HD", "HD")).familyPinned, false, "choosing the export's own league is no pin");

  const kept = modelReducer(freshState(HD), edit.keepList(PEL));
  assert.deepEqual(kept.bats, HD.roster);
  assert.equal(exportChange(kept, PEL), null);
  assert.deepEqual(teamEdits(kept), { added: 2, removed: 1 });

  // The same week imported again with a hitter more is new too.
  const reimport = { ...PEL, roster: [...PEL.roster, SOTO] };
  assert.deepEqual(exportChange(freshState(PEL), reimport), { added: [SOTO], gone: [] });
  assert.equal(exportChange(freshState(PEL), { ...PEL, roster: [...PEL.roster].reverse() }), null, "order is not a change");
  assert.equal(exportChange(freshState(PEL), { source: null, roster: [], family: "HD" }), null, "no export on file");
});

test("restore: the saved state, cleaned; the league follows the export unless pinned", () => {
  const saved = JSON.parse(JSON.stringify({
    ...apply(freshState(HD), edit.add(SOTO), edit.pickCard(WINFIELD), edit.face("EYE vL", "140")),
    locks: { vR: { "3B": WOOD, XX: OTT, SS: "Nobody#1", "1B": WOOD }, vL: { C: 5 } },
  }));
  const r = restoreState(saved, null, PEL);
  assert.deepEqual(r.bats, [...HD.roster, SOTO]);
  assert.deepEqual(r.locks, { vR: { "3B": WOOD }, vL: {} });
  assert.equal(r.source, HD.source);
  assert.equal(r.settings.family, "PEL");
  assert.equal(r.candidate?.face["EYE vL"], "140");
  assert.deepEqual(exportChange(r, PEL)?.gone, [CONNOR, VAUGHAN]);

  const pinned = restoreState({ ...saved, familyPinned: true, settings: { ...saved.settings, family: "LD" } }, null, PEL);
  assert.equal(pinned.settings.family, "LD");
  assert.equal(pinned.familyPinned, true);

  assert.deepEqual(restoreState("nonsense", 42, PEL), freshState(PEL));
  const odd = restoreState({ bats: "x", settings: { year: "20x", glove: "2", park: 7 }, candidate: { id: -1 } }, null, PEL);
  assert.deepEqual(odd.bats, PEL.roster);
  assert.deepEqual(odd.settings, { family: "PEL", year: "2010", park: "", glove: "1" });
  assert.equal(odd.candidate, null);
});

test("v2 migrates: its list, locks and settings, taken as this export's list", () => {
  const v2 = { pool: [OTT, WOOD, SOTO], locks: { vR: { "3B": WOOD }, vL: {} }, family: "HD", year: "1998", park: "1945 Fenway Park", glove: "0.5" };
  const m = restoreState(null, v2, PEL);
  assert.deepEqual(m.bats, [OTT, WOOD, SOTO]);
  assert.deepEqual(m.locks, { vR: { "3B": WOOD }, vL: {} });
  assert.deepEqual(m.settings, { family: "HD", year: "1998", park: "1945 Fenway Park", glove: "0.5" });
  assert.equal(m.familyPinned, true, "v2 kept its league; one unlike the export's was his choice");
  assert.equal(exportChange(m, PEL), null);
  assert.deepEqual(teamEdits(m), { added: 1, removed: 3 });
  assert.deepEqual(restoreState(null, { pool: [] }, PEL).bats, PEL.roster);
  assert.equal(restoreState({ ...freshState(PEL), bats: [OTT] }, v2, PEL).bats.length, 1, "v3 wins over v2");
});

test("the request waits for a four-digit year and a listed park, and sends the card only when included", () => {
  const parks = new Set(["1945 Fenway Park"]);
  const s = freshState(PEL);
  assert.deepEqual(scoreRequest(s, parks).body, { roster: PEL.roster, locks: { vR: {}, vL: {} }, park: null, family: "PEL", year: 2010, defScale: 1 });
  assert.match(scoreRequest(modelReducer(s, edit.year("20")), parks).skip!, /four-digit/);
  assert.equal(scoreRequest(modelReducer(s, edit.park("1945 Fen")), parks).key, null);
  assert.equal(scoreRequest(modelReducer(s, edit.park("1945 Fenway Park ")), parks).body?.park, "1945 Fenway Park");
  assert.deepEqual(scoreRequest(freshState({ ...PEL, roster: [] }), parks), { key: null, skip: null });

  const card = apply(s, edit.pickCard(WINFIELD), edit.face("POW vR", ""), edit.face("POS RF", ""));
  const body = scoreRequest(card, parks).body!;
  assert.equal(body.cardId, WINFIELD.id);
  assert.equal(body.ratings!["EYE vR"], 120);
  assert.equal(body.ratings!["POW vR"], undefined, "a blank batting field keeps the shop value");
  assert.equal(body.ratings!["POS RF"], 0, "a blank position: cannot play there");
  const out = scoreRequest(modelReducer(card, edit.include("Dave Winfield", false)), parks);
  assert.equal(out.body!.cardId, undefined);
  assert.equal(out.key, scoreRequest(s, parks).key, "left out, it scores the team alone");
});

test("labels for the caption and the banner", () => {
  assert.equal(exportLabel("PEL, week of 2026-09-27"), "PEL, week of 09-27");
  assert.equal(exportLabel("your list"), "your list");
  assert.deepEqual(teamEdits(freshState(PEL)), { added: 0, removed: 0 });
});
