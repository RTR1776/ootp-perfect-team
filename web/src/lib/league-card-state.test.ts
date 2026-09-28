import { test } from "node:test";
import assert from "node:assert/strict";
import { initHistory, pushHistory, undoHistory, undoLabel, type History } from "./use-undoable";
import {
  armLockMovesFrom, BAT_STATS, edit, exportChange, exportLabel, freshState, fromRoster, listName, lockMovesFrom, modelReducer, needsNumber, restoreState, rosterSource, scoreRequest, teamEdits,
  type CardBase, type LeagueExport, type ModelAction, type ModelState,
} from "./league-card-state";

const OTT = "Mel Ott#86272", WOOD = "Brandon Wood#86593", BAILEY = "Ed Bailey#86637", ROLEN = "Scott Rolen#86405";
const PIAZZA = "Mike Piazza#86463", CONNOR = "Roger Connor#86577", VAUGHAN = "Arky Vaughan#85021", SOTO = "Juan Soto#90001";
const LEE = "Cliff Lee#85693", STIEB = "Dave Stieb#86958", HENKE = "Tom Henke#85918", BLUE = "Vida Blue#85756";
const BRITTON = "Zack Britton#86426", JANSEN = "Kenley Jansen#85705", HOLLAND = "Derek Holland#80001";
// The newest export (PEL, 09-27) and the one before it (HD451, 09-20), cut down. The same staff both weeks.
const ARMS = [LEE, STIEB, HENKE, BLUE, BRITTON];
const PEL: LeagueExport = { source: "PEL, week of 2026-09-27", roster: [OTT, WOOD, BAILEY, ROLEN, PIAZZA], arms: ARMS, family: "PEL" };
const HD: LeagueExport = { source: "HD451, week of 2026-09-20", roster: [OTT, WOOD, BAILEY, ROLEN, CONNOR, VAUGHAN], arms: ARMS, family: "HD" };
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
  assert.equal(exportChange(freshState(PEL), { source: null, roster: [], arms: [], family: "HD" }), null, "no export on file");
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
  const oldPark = restoreState({ ...saved, settings: { ...saved.settings, park: "2005 Minue Maid Park" } }, null, PEL);
  assert.equal(oldPark.settings.park, "2005 Minute Maid Park", "a park saved under its old spelling still scores");
});

test("v2 migrates: this export's list keeps its league; any other list stays his, and the banner offers the export", () => {
  const same = { pool: [...PEL.roster].reverse(), locks: { vR: { "3B": WOOD }, vL: {} }, family: "HD", year: "1998", park: "1945 Fenway Park", glove: "0.5" };
  const m = restoreState(null, same, PEL);
  assert.deepEqual(m.locks, { vR: { "3B": WOOD }, vL: {} });
  assert.deepEqual(m.settings, { family: "HD", year: "1998", park: "1945 Fenway Park", glove: "0.5" });
  assert.equal(m.familyPinned, true, "the same hitters with another league: his choice");
  assert.equal(exportChange(m, PEL), null);
  // A list from an older export (HD451's week, saved in HD) read after the PEL week landed.
  const old = { pool: HD.roster, locks: { vR: {}, vL: {} }, family: "HD", year: "2010", park: "", glove: "1" };
  const o = restoreState(null, old, PEL);
  assert.deepEqual(o.bats, HD.roster, "his list is kept");
  assert.equal(o.settings.family, "PEL", "the league follows the export, not the old list's");
  assert.equal(o.familyPinned, false);
  assert.deepEqual(exportChange(o, PEL), { added: [ROLEN, PIAZZA].filter((e) => !HD.roster.includes(e)), gone: [CONNOR, VAUGHAN] }, "the banner offers the new export");
  assert.deepEqual(restoreState(null, { pool: [] }, PEL).bats, PEL.roster);
  assert.equal(restoreState({ ...freshState(PEL), bats: [OTT] }, same, PEL).bats.length, 1, "v3 wins over v2");
});

test("the request waits for a four-digit year and a listed park, and sends the card only when included", () => {
  const parks = new Set(["1945 Fenway Park"]);
  const s = freshState(PEL);
  assert.deepEqual(scoreRequest(s, parks).body, { roster: PEL.roster, locks: { vR: {}, vL: {} }, park: null, family: "PEL", year: 2010, defScale: 1, arms: ARMS, armLocks: {} });
  assert.match(scoreRequest(modelReducer(s, edit.year("20")), parks).skip!, /pick a year/);
  assert.equal(scoreRequest(modelReducer(s, edit.park("1945 Fen")), parks).key, null);
  assert.equal(scoreRequest(modelReducer(s, edit.park("1945 Fenway Park ")), parks).body?.park, "1945 Fenway Park");
  assert.deepEqual(scoreRequest(freshState({ ...PEL, roster: [] }), parks), { key: null, skip: null }, "no hitters: nothing to score, staff or not");

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

test("the run environment is picked from a list: one step each, and a saved year off the list starts at the PT default (C7)", () => {
  let h = play(initHistory(freshState(PEL)), edit.year("1987"), edit.year("1998"));
  assert.equal(h.past.length, 2, "a pick is not typing: each is its own step");
  assert.equal(undoLabel(h), "Set run environment to 1998");
  assert.equal(edit.year("2010").label, "Set run environment to the PT default");
  h = undoHistory(h);
  assert.equal(h.present.settings.year, "1987");

  const years = new Set(["2010", "1998", "1987"]);
  const saved = (year: string) => JSON.parse(JSON.stringify({ ...freshState(PEL), settings: { ...freshState(PEL).settings, year } }));
  assert.equal(restoreState(saved("1998"), null, PEL, years).settings.year, "1998");
  assert.equal(restoreState(saved("20"), null, PEL, years).settings.year, "2010", "half-typed in the old box");
  assert.equal(restoreState(saved("1850"), null, PEL, years).settings.year, "2010", "no run environment on file");
  assert.equal(restoreState(null, { pool: PEL.roster, year: "1850" }, PEL, years).settings.year, "2010", "v2 too");
});

test("a blank or 0 rating needs a number and is left out, so the card keeps its shop value; a blank position can't play (C7)", () => {
  assert.deepEqual(BAT_STATS.map(([, name]) => name), ["Avoid K", "BABIP", "Gap", "Power", "Eye"], "the card face's order");
  const s = apply(freshState(PEL), edit.pickCard(WINFIELD), edit.face("POW vR", ""), edit.face("EYE vL", "0"), edit.face("POS LF", ""), edit.face("GAP vR", "105"));
  const c = s.candidate!;
  assert.equal(needsNumber(c, "POW vR"), true);
  assert.equal(needsNumber(c, "EYE vL"), true, "0 is no rating");
  assert.equal(needsNumber(c, "GAP vR"), false);
  assert.equal(needsNumber(c, "POS LF"), false, "a blank position is a choice");
  assert.equal(needsNumber(c, "POS C"), false);
  const r = scoreRequest(s, new Set()).body!.ratings!;
  assert.equal(r["POW vR"], undefined);
  assert.equal(r["EYE vL"], undefined);
  assert.equal(r["GAP vR"], 105);
  assert.equal(r["POS LF"], 0);
  assert.equal(r["POS RF"], 80);
  assert.equal(r["POS C"], 0);
  // Cleared and typed back: the same request as the untouched card.
  const back = apply(s, edit.face("POW vR", "150"), edit.face("EYE vL", "130"), edit.face("POS LF", "70"), edit.face("GAP vR", "100"));
  assert.equal(scoreRequest(back, new Set()).key, scoreRequest(apply(freshState(PEL), edit.pickCard(WINFIELD)), new Set()).key);
});

test("labels for the caption and the banner", () => {
  assert.equal(exportLabel("PEL, week of 2026-09-27"), "PEL, week of 09-27");
  assert.equal(exportLabel("your list"), "your list");
  assert.deepEqual(teamEdits(freshState(PEL)), { added: 0, removed: 0 });
});

/* ------------------------------------------------------------ the staff */

test("removing an arm takes his staff lock with him; one undo brings both back; the labels name him", () => {
  let h = play(initHistory(freshState(PEL)), edit.armLock("CL", HENKE), edit.armLock("SP1", BLUE));
  h = play(h, edit.removeArm(BLUE));
  assert.deepEqual(h.present.arms, [LEE, STIEB, HENKE, BRITTON]);
  assert.deepEqual(h.present.armLocks, { CL: HENKE });
  assert.equal(undoLabel(h), "Remove Vida Blue");
  h = undoHistory(h);
  assert.deepEqual(h.present.arms, ARMS);
  assert.deepEqual(h.present.armLocks, { CL: HENKE, SP1: BLUE });
  assert.deepEqual(h.present.bats, PEL.roster, "the hitters don't move");

  assert.equal(edit.addArm(JANSEN).label, "Add Kenley Jansen to the staff");
  assert.equal(edit.armLock("CL", HENKE).label, "Lock Tom Henke at CL");
  assert.equal(edit.armLock("SP1", null).label, "Unlock SP1");
  assert.equal(edit.resetStaff(PEL).label, "Reset staff to the export");
  assert.equal(edit.clearArmLocks(2).label, "Clear 2 staff locks");
  const added = modelReducer(freshState(PEL), edit.addArm(JANSEN));
  assert.deepEqual(added.arms, [...ARMS, JANSEN]);
  assert.equal(modelReducer(added, edit.addArm(JANSEN)), added, "already on the staff");
  assert.equal(modelReducer(added, edit.removeArm(SOTO)), added, "not on the staff");
});

test("a staff lock moves an arm between slots; a lock that changes nothing is no step", () => {
  let s = apply(freshState(PEL), edit.armLock("RP3", HENKE), edit.armLock("CL", HENKE));
  assert.deepEqual(s.armLocks, { CL: HENKE });
  assert.equal(modelReducer(s, edit.armLock("CL", HENKE)), s);
  assert.equal(modelReducer(s, edit.armLock("CL", JANSEN)), s, "not on the staff");
  assert.equal(modelReducer(s, edit.armLock("SP9X", LEE)), s, "no such slot");
  assert.equal(modelReducer(s, edit.armLock("SP2", null)), s, "nothing to unlock");
  s = modelReducer(s, edit.armLock("CL", BRITTON));
  assert.deepEqual(s.armLocks, { CL: BRITTON }, "the slot takes the new arm");
  assert.deepEqual(modelReducer(s, edit.armLock("CL", null)).armLocks, {});
  assert.deepEqual(s.locks, { vR: {}, vL: {} }, "the lineup locks are their own");

  // The toast "Moved Tom Henke from RP3 to CL" needs to know where he was locked.
  const atRP3 = modelReducer(freshState(PEL), edit.armLock("RP3", HENKE));
  assert.equal(armLockMovesFrom(atRP3, "CL", HENKE), "RP3");
  assert.equal(armLockMovesFrom(atRP3, "RP3", HENKE), null, "same slot");
  assert.equal(armLockMovesFrom(atRP3, "CL", BLUE), null);
  assert.equal(armLockMovesFrom(atRP3, "CL", null), null);

  const two = apply(freshState(PEL), edit.armLock("SP1", LEE), edit.armLock("CL", HENKE));
  assert.deepEqual(modelReducer(two, edit.clearArmLocks(2)).armLocks, {});
  const none = freshState(PEL);
  assert.equal(modelReducer(none, edit.clearArmLocks(0)), none, "no staff locks: no step");
});

test("Reset staff goes back to the export's pitchers and clears the staff locks; Reset team resets the staff too", () => {
  const s = apply(freshState(PEL), edit.removeArm(BLUE), edit.addArm(JANSEN), edit.armLock("CL", JANSEN), edit.remove(OTT), edit.lock("vR", "3B", WOOD));
  const r = modelReducer(s, edit.resetStaff(PEL));
  assert.deepEqual(r.arms, ARMS);
  assert.deepEqual(r.armLocks, {});
  assert.ok(!r.bats.includes(OTT), "the hitters are left as they were");
  assert.deepEqual(r.locks.vR, { "3B": WOOD });
  assert.equal(modelReducer(r, edit.resetStaff(PEL)), r, "already the export's staff: no step");

  const t = modelReducer(s, edit.resetTeam(PEL));
  assert.deepEqual(t.arms, ARMS);
  assert.deepEqual(t.armLocks, {});
  assert.deepEqual(t.bats, PEL.roster);
  assert.equal(modelReducer(t, edit.resetTeam(PEL)), t);
  assert.notEqual(modelReducer(apply(freshState(PEL), edit.armLock("SP1", LEE)), edit.resetTeam(PEL)).armLocks.SP1, LEE, "a staff lock is no longer the export");
});

test("a new export's pitchers: arms he added stay, arms that left go with their locks", () => {
  const next: LeagueExport = { ...PEL, source: "PEL, week of 2026-10-04", arms: [LEE, STIEB, HENKE, BRITTON, HOLLAND] };
  const s = apply(freshState(PEL), edit.addArm(JANSEN), edit.armLock("SP5", BLUE), edit.armLock("CL", JANSEN));
  assert.deepEqual(exportChange(s, next), { added: [HOLLAND], gone: [BLUE] });
  const u = modelReducer(s, edit.updateTeam(next));
  assert.deepEqual(u.arms, [LEE, STIEB, HENKE, BRITTON, HOLLAND, JANSEN]);
  assert.deepEqual(u.armLocks, { CL: JANSEN });
  assert.equal(exportChange(u, next), null);
  assert.deepEqual(teamEdits(u), { added: 1, removed: 0 });

  const kept = modelReducer(s, edit.keepList(next));
  assert.deepEqual(kept.arms, s.arms, "Keep my list keeps his staff");
  assert.equal(exportChange(kept, next), null);
  assert.deepEqual(teamEdits(kept), { added: 2, removed: 1 }, "Jansen and Blue on, Holland off");

  // The same week imported again with a pitcher more is new too.
  assert.deepEqual(exportChange(freshState(PEL), { ...PEL, arms: [...ARMS, HOLLAND] }), { added: [HOLLAND], gone: [] });
});

test("restore: a state saved before the staff follows the export's pitchers; a staff he emptied stays empty", () => {
  // Saved by PR 4a: arms [] and armLocks {} were placeholders, and there was no exportArms.
  const v4a = JSON.parse(JSON.stringify({ ...freshState(PEL), arms: [], exportArms: undefined, armLocks: { CL: HENKE } }));
  assert.equal("exportArms" in v4a, false);
  const r = restoreState(v4a, null, PEL);
  assert.deepEqual(r.arms, ARMS);
  assert.deepEqual(r.exportArms, ARMS);
  assert.deepEqual(r.armLocks, {});
  assert.equal(exportChange(r, PEL), null, "no banner: it is this export's list");

  const emptied = JSON.parse(JSON.stringify(apply(freshState(PEL), ...ARMS.map((e) => edit.removeArm(e)))));
  const e = restoreState(emptied, null, PEL);
  assert.deepEqual(e.arms, [], "his choice");
  assert.deepEqual(teamEdits(e), { added: 0, removed: ARMS.length });
  assert.deepEqual(scoreRequest(e, new Set()).body?.arms, [], "sent as empty, so the server doesn't fall back to the export");

  const saved = JSON.parse(JSON.stringify({
    ...apply(freshState(PEL), edit.addArm(JANSEN), edit.armLock("CL", JANSEN)),
    armLocks: { CL: JANSEN, SP1: LEE, SP2: LEE, XX: STIEB, RP1: "Nobody#1" },
  }));
  const k = restoreState(saved, null, PEL);
  assert.deepEqual(k.arms, [...ARMS, JANSEN]);
  assert.deepEqual(k.armLocks, { CL: JANSEN, SP1: LEE }, "a known slot, an arm on the staff, one slot each");

  const v2 = restoreState(null, { pool: PEL.roster, locks: {}, family: "PEL" }, PEL);
  assert.deepEqual(v2.arms, ARMS, "a v2 list had no staff: the export's");
});

const JANSEN_CARD: CardBase = {
  id: 85705, kind: "arm", name: "Kenley Jansen", title: "Historical All-Star CL Kenley Jansen LAD 2017",
  base: { "STU vL": 118, "STU vR": 160, "CON vL": 137, "CON vR": 147, "HRA vL": 93, "HRA vR": 150, "PBABIP vL": 108, "PBABIP vR": 133, STM: 19 },
  movement: { vL: 98, vR: 144 },
  observed: { asSP: null, asRP: { edge9: 0.2928, ip: 20754.7, teams: 397, weeks: 9 } },
};

test("an arm card: its face, typed and stepped per side, and the request sends it with blanks left out", () => {
  const s = apply(freshState(PEL), edit.pickCard(JANSEN_CARD), edit.face("STU vR", "170"), edit.face("STM", ""));
  const c = s.candidate!;
  assert.equal(c.kind, "arm");
  assert.equal(c.observed?.asRP?.teams, 397);
  assert.equal(edit.face("STU vR", "170").label, "Edit Stuff vs RHB");
  assert.equal(edit.face("STM", "20").label, "Edit Stamina");
  assert.equal(edit.face("PBABIP vL", "1").label, "Edit pBABIP vs LHB");

  const stepped = modelReducer(s, edit.armStep("vR", 7.5)).candidate!.face;
  assert.equal(stepped["STU vR"], "170", "typed off the face: kept");
  assert.equal(stepped["CON vR"], "158");
  assert.equal(stepped["HRA vR"], "161");
  assert.equal(stepped["PBABIP vR"], "143");
  assert.equal(stepped["STU vL"], "118", "the other side stays");
  assert.equal(stepped.STM, "", "Stamina stays");
  assert.equal(edit.armStep("vL", 7.5).label, "+7.5% vs LHB");

  const body = scoreRequest(s, new Set()).body!;
  assert.equal(body.cardId, 85705);
  assert.equal(body.ratings!["STU vR"], 170);
  assert.equal(body.ratings!.STM, undefined, "blank: the shop value");
  assert.equal(Object.keys(body.ratings!).length, 8);
  assert.deepEqual(body.arms, ARMS);
  const out = scoreRequest(modelReducer(s, edit.include("Kenley Jansen", false)), new Set());
  assert.equal(out.body!.cardId, undefined);

  // Kept across a reload, record and all.
  const r = restoreState(JSON.parse(JSON.stringify(s)), null, PEL).candidate!;
  assert.equal(r.kind, "arm");
  assert.deepEqual(r.movement, { vL: 98, vR: 144 });
  assert.deepEqual(r.observed, { asSP: null, asRP: { edge9: 0.2928, ip: 20754.7, teams: 397, weeks: 9 } });
  assert.equal(r.face["STU vR"], "170");
  assert.equal(restoreState(JSON.parse(JSON.stringify(apply(s, edit.pickCard(WINFIELD)))), null, PEL).candidate!.kind, "bat");
});

test("a modelled pitcher can be put in the rotation or the pen; the choice is one undo step and goes in the request", () => {
  const JANSEN_CARD: CardBase = { id: 85705, kind: "arm", name: "Kenley Jansen", title: null, base: { "STU vL": 150, STM: 19 } };
  let h = play(initHistory(freshState(PEL)), edit.pickCard(JANSEN_CARD), edit.armRole("Kenley Jansen", "RP"));
  assert.equal(h.present.candidate?.role, "RP");
  assert.equal(undoLabel(h), "Model Kenley Jansen as a reliever");
  assert.equal(scoreRequest(h.present, new Set()).body?.candidateRole, "RP");
  assert.equal(modelReducer(h.present, edit.armRole("Kenley Jansen", "RP")), h.present, "the same choice is no step");
  h = play(h, edit.armRole("Kenley Jansen", null));
  assert.equal(scoreRequest(h.present, new Set()).body?.candidateRole, undefined, "wherever he scores best");
  assert.equal(edit.armRole("Kenley Jansen", null).label, "Put Kenley Jansen where he scores best");
  assert.equal(edit.armRole("Kenley Jansen", "SP").label, "Model Kenley Jansen as a starter");
  const bat = apply(freshState(PEL), edit.pickCard(WINFIELD));
  assert.equal(modelReducer(bat, edit.armRole("Dave Winfield", "SP")), bat, "a hitter has no role to pick");
  const restored = restoreState(JSON.parse(JSON.stringify({ ...h.present, candidate: { ...h.present.candidate, role: "SP" } })), null, PEL);
  assert.equal(restored.candidate?.role, "SP");
});

// His team sheet of 09-28: Soto in, Piazza out of this cut-down list, and his lineups and staff roles.
const SHEET: LeagueExport = {
  source: rosterSource("2026-09-28"), roster: [OTT, WOOD, BAILEY, ROLEN, SOTO], arms: ARMS, family: "HD",
  locks: { vR: { RF: SOTO, C: BAILEY, "2B": WOOD }, vL: { RF: SOTO, "3B": ROLEN, C: PIAZZA } },
  armLocks: { SP1: LEE, CL: BRITTON, RP1: HOLLAND },
};

test("a team sheet starts the page with its lineups and staff roles, for players on its lists", () => {
  const s = freshState(SHEET);
  assert.deepEqual(s.locks, { vR: { RF: SOTO, C: BAILEY, "2B": WOOD }, vL: { RF: SOTO, "3B": ROLEN } }, "Piazza is not on the list, so his lock is left out");
  assert.deepEqual(s.armLocks, { SP1: LEE, CL: BRITTON });
  assert.equal(listName(s.source), "your roster");
  assert.equal(exportLabel(s.source!), "your roster of 09-28");
  assert.ok(fromRoster(s.source) && !fromRoster(PEL.source));
});

test("Update team takes a sheet's lineups in place of his locks; an export keeps his", () => {
  const mine = apply(freshState(PEL), edit.lock("vR", "LF", OTT), edit.armLock("RP1", HENKE));
  const toSheet = apply(mine, edit.updateTeam(SHEET));
  assert.deepEqual(toSheet.bats, [OTT, WOOD, BAILEY, ROLEN, SOTO]);
  assert.deepEqual(toSheet.locks.vR, { RF: SOTO, C: BAILEY, "2B": WOOD });
  assert.deepEqual(toSheet.armLocks, { SP1: LEE, CL: BRITTON });
  assert.equal(toSheet.source, SHEET.source);
  assert.equal(exportChange(toSheet, SHEET), null, "no banner once the list follows the sheet");
  const toExport = apply(mine, edit.updateTeam(HD));
  assert.deepEqual(toExport.locks.vR, { LF: OTT }, "an export keeps his own locks");
  assert.deepEqual(toExport.armLocks, { RP1: HENKE });
});

test("Reset goes back to the sheet's lineups, and is no step when already there", () => {
  const s = freshState(SHEET);
  assert.equal(modelReducer(s, edit.resetTeam(SHEET)), s);
  assert.equal(modelReducer(s, edit.resetStaff(SHEET)), s);
  const moved = apply(s, edit.lock("vR", "RF", OTT), edit.armLock("SP1", STIEB));
  const back = apply(moved, edit.resetTeam(SHEET));
  assert.deepEqual(back.locks, s.locks);
  assert.deepEqual(back.armLocks, s.armLocks);
  assert.deepEqual(apply(moved, edit.resetStaff(SHEET)).armLocks, s.armLocks);
});
