import test from "node:test";
import assert from "node:assert/strict";
import { armRole, batAt, bestTeam, fitIn, savedTeam, spotValue, type FitCtx, type ScoredForm } from "./card-fit";
import { fieldingRuns } from "@/lib/analytics/fielding";
import { RP_WEIGHT_DEFAULT } from "@/lib/roster-objective";

const ctx: FitCtx = { dh: true, lhp: 0.3, glove: 1 };
let next = 1;
const bat = (name: string, runsR: number, runsL: number, pos: ScoredForm["pos"], extra: Partial<ScoredForm> = {}): ScoredForm => {
  const id = next++;
  return { id, cardId: id, name, variant: false, isPitcher: false, role: null, runsR, runsL, pos, val: 60, ...extra };
};
const arm = (name: string, role: "SP" | "RP", runs: number): ScoredForm => {
  const id = next++;
  return { id, cardId: id, name, variant: false, isPitcher: true, role, runsR: runs, runsL: runs, pos: {}, val: 60 };
};

test("a bat's value at a spot adds the glove there; below the floor, or DH without a DH, it can't play", () => {
  const b = bat("Glove", 5, 1, { SS: 80, "1B": 40 });
  assert.equal(batAt(b, "SS", "R", ctx), 5 + fieldingRuns("SS", 80));
  assert.equal(batAt(b, "1B", "R", ctx), null, "40 is under L.J.'s 60 floor");
  assert.equal(batAt(b, "DH", "L", ctx), 1);
  assert.equal(batAt(b, "DH", "L", { ...ctx, dh: false }), null);
  assert.equal(spotValue(b, "DH", ctx), 0.7 * 5 + 0.3 * 1);
});

test("an arm's role is the card's own, else by stamina", () => {
  assert.equal(armRole("SP", 20), "SP");
  assert.equal(armRole("CL", 80), "RP");
  assert.equal(armRole(null, 25), "RP");
  assert.equal(armRole(null, 60), "SP");
});

test("the best team fills the scarce gloves first and plays each card once per board", () => {
  const ss = bat("Shortstop", 10, 10, { SS: 70, "1B": 70 });
  const first = bat("First", 8, 8, { "1B": 70 });
  const team = bestTeam([first, ss], ctx);
  assert.equal(team.R.SS?.name, "Shortstop");
  assert.equal(team.R["1B"]?.name, "First");
  assert.equal(team.R.DH, undefined, "no third bat for the DH");
});

test("a better bat starts: it replaces the card at its best spot on each board, weighted by the field's hands", () => {
  const inc = bat("Incumbent", 2, 6, { LF: 70 });
  const dh = bat("Designated", 3, 7, {});
  const team = bestTeam([inc, dh], ctx);
  assert.equal(team.R.DH?.name, "Designated");
  const newBat = bat("New", 10, 4, { LF: 70 });
  const fit = fitIn(newBat, team, [inc, dh, newBat], ctx)!;
  assert.equal(fit.status, "start");
  assert.equal(fit.spot, "LF");
  // vs RHP it beats the left fielder by 8 (the DH by 7); vs LHP it beats no one.
  assert.deepEqual(fit.swaps.map((s) => [s.board, s.spot, s.out?.name ?? null]), [["R", "LF", "Incumbent"]]);
  assert.ok(Math.abs(fit.gain - 0.7 * 8) < 1e-9);
  assert.equal(fit.rank, 1);
  assert.equal(fit.of, 2);
});

test("a card already on the roster is 'on'; a worse one is 'bench' with the card it falls short of", () => {
  const star = bat("Star", 20, 20, { CF: 80 });
  const team = bestTeam([star], { ...ctx, dh: false });
  const noDh = { ...ctx, dh: false };
  assert.equal(fitIn(star, team, [star], noDh)!.status, "on");
  const weak = bat("Weak", 5, 5, { CF: 80 });
  const fit = fitIn(weak, team, [star, weak], noDh)!;
  assert.equal(fit.status, "bench");
  assert.equal(fit.gain, 0);
  assert.equal(fit.short?.name, "Star");
  assert.equal(fit.rank, 2);
});

test("an arm replaces the weakest in its role, a reliever at the objective's relief weight", () => {
  const team = savedTeam([
    { formId: 101, slot: "SP1", versusHand: "both" }, { formId: 102, slot: "SP2", versusHand: "both" },
    { formId: 103, slot: "CL", versusHand: "both" }, { formId: 104, slot: "BN1", versusHand: "both" },
  ], new Map([
    [101, { ...arm("Ace", "SP", 9), id: 101, cardId: 101 }], [102, { ...arm("Fifth", "SP", 1), id: 102, cardId: 102 }],
    [103, { ...arm("Closer", "RP", 4), id: 103, cardId: 103 }],
  ]));
  assert.deepEqual([team.SP.length, team.RP.length], [2, 1]);
  const sp = fitIn(arm("New SP", "SP", 4), team, [], ctx)!;
  assert.equal(sp.swaps[0].out?.name, "Fifth");
  assert.equal(sp.gain, 3);
  const rp = fitIn(arm("New RP", "RP", 10), team, [], ctx)!;
  assert.ok(Math.abs(rp.gain - 6 * RP_WEIGHT_DEFAULT) < 1e-9);
  assert.equal(fitIn(arm("Worse SP", "SP", 0.5), team, [], ctx)!.status, "bench");
});

test("a saved roster's lineups are read per hand, and a variant slot resolves to the variant's form", () => {
  const base = bat("Pearce", 3, 9, { "1B": 70 });
  const variantForm: ScoredForm = { ...base, id: -base.cardId, variant: true, runsR: 6, runsL: 12 };
  const team = savedTeam([{ formId: -base.cardId, slot: "1B", versusHand: "L" }], new Map([[-base.cardId, variantForm]]));
  assert.equal(team.L["1B"]?.variant, true);
  assert.equal(team.R["1B"], undefined);
});

test("Card Fit prices an arm as the builder does: the series' weight split over the staff carried", async () => {
  const { armWeight } = await import("./card-fit");
  const ctx = { dh: true, lhp: 0.3, glove: 1, pit: 2, spWeight: 1.5, rpWeight: 0.4, fieldSp: 5, fieldRp: 6 };
  assert.ok(Math.abs(armWeight("SP", 5, ctx) - 1.5 * 2) < 1e-9);
  assert.ok(Math.abs(armWeight("RP", 8, ctx) - 0.4 * (6 / 8) * 2) < 1e-9);
  assert.ok(Math.abs(armWeight("RP", 7, { dh: true, lhp: 0.3, glove: 1 }) - 0.31) < 1e-9, "no series: the old defaults");
});

/*
 * PTCS 8 Championship Cap (2026-10-27): Card Fit put Webster McDonald (90) in
 * for Luther Farrell (66) at +13.9, but the Diamond and Perfect slots were full,
 * and full builds with him owned kept the roster as it was. In small: slots
 * P1 D1 S1 B2, a 102 and a 99 already in the rotation.
 */
const valued = (f: ScoredForm, val: number): ScoredForm => ({ ...f, val });
const capCase = (spareRuns: number, extraBench: ScoredForm[] = []) => {
  const rile = valued(arm("Rile", "SP", 9), 102), young = valued(arm("Young", "SP", 8), 99), farrell = valued(arm("Farrell", "SP", 2), 66);
  const cf = valued(bat("Speaker", 5, 5, { CF: 80 }), 68), backup = valued(bat("Backup", 1, 1, { CF: 70 }), 61);
  const spare = valued(arm("Spare", "SP", spareRuns), 75);
  const team = { R: { CF: cf }, L: { CF: cf }, SP: [rile, young, farrell], RP: [] };
  const onRoster = [rile, young, farrell, cf, backup, ...extraBench];
  const room = {
    slots: { P: 1, D: 1 + extraBench.length, S: 1, B: 2 }, cap: null,
    roster: new Map(onRoster.map((f) => [f.cardId, { val: f.val!, name: f.name }])),
    spares: [...onRoster, spare],
  };
  return { team, room, mcdonald: valued(arm("McDonald", "SP", 6), 90) };
};
const noDh = { ...ctx, dh: false };

test("Cap: one swap reads a start, but with the Diamond and Perfect slots full the card doesn't start", () => {
  const { team, room, mcdonald } = capCase(3);
  assert.equal(fitIn(mcdonald, team, [], noDh)!.gain, 4, "the old one-swap read: +4 over Farrell");
  const fit = fitIn(mcdonald, team, [], noDh, room)!;
  assert.equal(fit.status, "bench");
  assert.equal(fit.gain, 0);
  assert.equal(fit.room?.gross, 4);
  // Room for a third Diamond-or-better card means Young (99) giving way: to the 75 (8 → 3) or to Farrell (8 → 2).
  assert.equal(fit.room?.cost, 5);
  assert.match(fit.room!.note, /^Young \(99\) out for Spare \(75\)/);
});

test("Cap: room that costs less than the swap adds is paid out of the gain", () => {
  const { team, room, mcdonald } = capCase(5);
  const fit = fitIn(mcdonald, team, [], noDh, room)!;
  assert.equal(fit.status, "start");
  assert.ok(Math.abs(fit.gain - 1) < 1e-9, "4 over Farrell, less 3 for Young → the 75");
  assert.equal(fit.swaps[0].out?.name, "Farrell");
});

test("Cap: a Diamond card on the bench goes off the roster for free", () => {
  const benchDiamond = valued(bat("Bench Diamond", 0, 0, { CF: 70 }), 92);
  const { team, room, mcdonald } = capCase(3, [benchDiamond]);
  // One more D slot for the bench card: the saved roster holds as it is.
  const fit = fitIn(mcdonald, team, [], noDh, room)!;
  assert.equal(fit.status, "start");
  assert.equal(fit.gain, 4);
  assert.equal(fit.room?.cost, 0);
  assert.match(fit.room!.note, /off the roster/);
});

test("a value cap: the swap is paid for by a bench card's value, else it can't start", () => {
  const ss = valued(bat("Short", 2, 2, { SS: 80 }), 60), dh = valued(bat("Dee", 3, 3, {}), 65);
  const pricey = valued(bat("Pricey", 9, 9, { SS: 80 }), 95), cheap = valued(bat("Cheap", 0, 0, {}), 40);
  const team = { R: { SS: ss, DH: dh }, L: { SS: ss, DH: dh }, SP: [], RP: [] };
  const roster = (bench: ScoredForm) => new Map([ss, dh, bench].map((f) => [f.cardId, { val: f.val!, name: f.name }]));
  const benchStar = valued(bat("Bench Star", 0, 0, {}), 80);
  // 60 + 65 + 80 = 205 under a 225 cap; Pricey (95) in leaves Short idle, and only the 80 off the roster brings it back under.
  const ok = fitIn(pricey, team, [], ctx, { slots: null, cap: 225, roster: roster(benchStar), spares: [ss, dh, benchStar, cheap] })!;
  assert.equal(ok.status, "start");
  assert.ok(Math.abs(ok.gain - 7) < 1e-9);
  assert.match(ok.room!.note, /Bench Star off the roster/);
  // 60 + 65 + 40 = 165 under a 170 cap: no bench card is worth the 95, and Dee (65) giving way to Cheap (40) still leaves 195.
  const no = fitIn(pricey, team, [], ctx, { slots: null, cap: 170, roster: roster(cheap), spares: [ss, dh, cheap] })!;
  assert.equal(no.status, "bench");
  assert.equal(no.room?.cost, null);
});

test("without slots or a cap the room changes nothing", () => {
  const { team, room, mcdonald } = capCase(3);
  const fit = fitIn(mcdonald, team, [], noDh, { ...room, slots: null })!;
  assert.equal(fit.gain, 4);
  assert.equal(fit.room, null);
});

/*
 * Two-way cards in both roles (card-fit dualFitIn). Daily Silver & Friends Slots,
 * 2026-11-14: Ed Rile (1B/SP 102) read "bench SP, short of Bob Feller", his bat never
 * counted. In small: a five-man rotation with a weak fifth starter, Thomas at 1B and
 * Abrams at DH, Rile's arm 9 and his bat 20 at first.
 */
const twoWay = (name: string, batRuns: number, armRuns: number, pos: ScoredForm["pos"], val = 102) => {
  const b = valued(bat(name, batRuns, batRuns, pos), val);
  const a: ScoredForm = { ...b, id: b.cardId + 10_000_000, isPitcher: true, role: "SP", runsR: armRuns, runsL: armRuns, pos: {} };
  return { b, a };
};
const rileCase = () => {
  const { b: rile, a: rileArm } = twoWay("Rile", 20, 9, { "1B": 70 });
  const thomas = valued(bat("Thomas", 5, 5, { "1B": 70 }), 77), abrams = valued(bat("Abrams", 6, 6, { SS: 70 }), 78);
  const rot = [valued(arm("Reulbach", "SP", 10), 97), valued(arm("Feller", "SP", 9), 88), valued(arm("Escobar", "SP", 8), 78), valued(arm("Altrock", "SP", 7), 76), valued(arm("Ostermueller", "SP", 2), 64)];
  const team = { R: { "1B": thomas, DH: abrams }, L: { "1B": thomas, DH: abrams }, SP: rot, RP: [], bench: [] as ScoredForm[] };
  return { rile, rileArm, thomas, abrams, rot, team };
};

test("both roles, with a DH: his arm for the fifth starter and his bat at first, one roster spot", async () => {
  const { dualFitIn } = await import("./card-fit");
  const { rile, rileArm, team } = rileCase();
  // Alone: the arm adds 9 - 2 = 7; the bat 20 - 5 = 15 at first on both boards.
  assert.equal(fitIn(rileArm, team, [], ctx)!.gain, 7);
  assert.ok(Math.abs(fitIn(rile, team, [], ctx)!.gain - 15) < 1e-9);
  const fit = dualFitIn(rile, rileArm, team, [], ctx)!;
  assert.equal(fit.status, "start");
  assert.deepEqual(fit.swaps.map((s) => [s.board, s.spot, s.out?.name]), [["staff", "SP", "Ostermueller"], ["R", "1B", "Thomas"], ["L", "1B", "Thomas"]]);
  // On his starts (one in five) he DHs: Abrams sits and Thomas, now on the bench, plays first: 20 + 6 - 20 - 5 = 1 a start.
  assert.ok(Math.abs(fit.dual!.startDays - 0.2) < 1e-9);
  assert.ok(Math.abs(fit.gain - (7 + 15 - 0.2)) < 1e-9);
});

test("both roles, no DH: the sub plays first on his starts and his own bat is credited in them", async () => {
  const { dualFitIn } = await import("./card-fit");
  const { STARTER_PA_SHARE, PITCHER_BAT_RUNS } = await import("@/lib/roster-objective");
  const { rile, rileArm, team } = rileCase();
  const fit = dualFitIn(rile, rileArm, team, [], noDh)!;
  // A fifth of his first-base days go to Thomas (15 a game), and his bat bats for him on those days, over a pitcher's.
  const ownBat = 0.2 * STARTER_PA_SHARE * (20 - PITCHER_BAT_RUNS);
  assert.ok(Math.abs(fit.dual!.startDays - (0.2 * 15 - ownBat)) < 1e-9);
  assert.ok(Math.abs(fit.gain - (7 + 15 - 0.2 * 15 + ownBat)) < 1e-9);
});

test("both roles: a starter already in the rotation adds his bat, less his start days; a reliever can't take the field", async () => {
  const { dualFitIn } = await import("./card-fit");
  const { rile, rileArm, team, rot } = rileCase();
  const withArm = { ...team, SP: [...rot.slice(0, 4), rileArm] };
  const fit = dualFitIn(rile, rileArm, withArm, [], ctx)!;
  assert.deepEqual(fit.on, ["SP"]);
  assert.deepEqual(fit.swaps.map((s) => s.spot), ["1B", "1B"]);
  assert.ok(Math.abs(fit.gain - (15 - 0.2)) < 1e-9);
  assert.equal(dualFitIn(rile, { ...rileArm, role: "RP" }, team, [], ctx), null);
  assert.equal(dualFitIn(rile, rileArm, { ...team, RP: [rileArm] }, [], ctx), null);
});

test("both roles in a slots event: the Perfect slot is held, so the card holding it gives way and the swap names him", async () => {
  const { dualFitIn } = await import("./card-fit");
  const { rile, rileArm, thomas, abrams, rot, team } = rileCase();
  // Alex Rodriguez (102) holds the one Perfect slot at short; Polanco (77, SS 85) sits on the bench.
  const arod = valued(bat("Alex Rodriguez", 20, 20, { SS: 90 }), 102), polanco = valued(bat("Polanco", 2, 2, { SS: 85 }), 77);
  const braun = valued(bat("Braun", 1, 1, { "3B": 70 }), 74), bale = valued(arm("Bale", "RP", 1), 59);
  const t = { ...team, R: { ...team.R, SS: arod }, L: { ...team.L, SS: arod }, RP: [bale], bench: [braun, polanco] };
  const onRoster = [arod, thomas, abrams, ...rot, braun, polanco, bale];
  const room = {
    slots: { P: 1, D: 1, G: 1, S: 6, B: 1, I: 1 }, cap: null,
    roster: new Map(onRoster.map((f) => [f.cardId, { val: f.val!, name: f.name }])),
    spares: onRoster,
  };
  // His arm alone can't pay for the room (A-Rod to Polanco at short costs 18 plus the glove); with his bat it can.
  assert.equal(fitIn(rileArm, t, [], ctx, room)!.status, "bench");
  const fit = dualFitIn(rile, rileArm, t, [], ctx, room)!;
  assert.equal(fit.status, "start");
  assert.match(fit.room!.note, /^Alex Rodriguez \(102\) out for Polanco \(77\)/);
  assert.deepEqual(fit.swaps.map((s) => s.out?.name), ["Ostermueller", "Thomas", "Thomas"]);
  assert.ok(fit.gain > fitIn(rile, t, [], ctx, room)!.gain, "both roles beat his bat alone");
  assert.ok(Math.abs(fit.gain - (fit.room!.gross - fit.room!.cost!)) < 1e-9);
});

test("a saved roster's bench is kept apart: it starts nowhere", () => {
  const sub = bat("Sub", 1, 1, { "1B": 70 });
  const team = savedTeam([{ formId: sub.id, slot: "BN2", versusHand: "both" }], new Map([[sub.id, sub]]));
  assert.deepEqual(team.bench?.map((f) => f.name), ["Sub"]);
  assert.equal(Object.keys(team.R).length + team.SP.length, 0);
});

test("placeIn: both roles when they add more than either alone; his arm alone never ignores the bat that already plays", async () => {
  const { placeIn } = await import("./card-fit-load");
  const { rile, rileArm, team, rot, thomas } = rileCase();
  const sc = (t: typeof team) => ({ teamFor: () => t, forms: new Map([[rile.id, rile], [rileArm.id, rileArm]]), variantForms: new Set<number>(), ctx, room: null, pool: [] }) as never;
  const both = placeIn(sc(team), rile.cardId)!;
  assert.equal(both.f.id, rile.id);
  assert.ok(both.fit.dual && Math.abs(both.fit.gain - 21.8) < 1e-9);
  // His bat already at first: the arm's +7 gives back his start days (0.2), so it reads 6.8, not 7.
  const batOn = { ...team, R: { ...team.R, "1B": rile }, L: { ...team.L, "1B": rile }, bench: [thomas] };
  const armIn = placeIn(sc(batOn), rile.cardId)!;
  assert.ok(armIn.fit.dual);
  assert.deepEqual(armIn.fit.swaps.map((s) => s.spot), ["SP"]);
  assert.ok(Math.abs(armIn.fit.gain - 6.8) < 1e-9);
  // Already in both roles: on.
  assert.equal(placeIn(sc({ ...batOn, SP: [...rot.slice(0, 4), rileArm] }), rile.cardId)!.fit.status, "on");
});

test("placeIn, slots event where nothing starts: the both-ways read shows when it comes nearest, naming who gives way", async () => {
  const { placeIn } = await import("./card-fit-load");
  const { rile, rileArm, thomas, abrams, rot, team } = rileCase();
  // As on Silver & Friends (2026-11-14): Alex Rodriguez is worth far more at short than Rile adds, so nothing starts.
  const arod = valued(bat("Alex Rodriguez", 40, 40, { SS: 90 }), 102), polanco = valued(bat("Polanco", 2, 2, { SS: 85 }), 77);
  const braun = valued(bat("Braun", 1, 1, { "3B": 70 }), 74), bale = valued(arm("Bale", "RP", 1), 59);
  const t = { ...team, R: { ...team.R, SS: arod }, L: { ...team.L, SS: arod }, RP: [bale], bench: [braun, polanco] };
  const onRoster = [arod, thomas, abrams, ...rot, braun, polanco, bale];
  const room = { slots: { P: 1, D: 1, G: 1, S: 6, B: 1, I: 1 }, cap: null, roster: new Map(onRoster.map((f) => [f.cardId, { val: f.val!, name: f.name }])), spares: onRoster };
  const sc = { teamFor: () => t, forms: new Map([[rile.id, rile], [rileArm.id, rileArm]]), variantForms: new Set<number>(), ctx, room, pool: [] } as never;
  const p = placeIn(sc, rile.cardId)!;
  assert.equal(p.fit.status, "bench");
  assert.ok(p.fit.dual, "the both-ways read, not his arm alone");
  assert.match(p.fit.room!.note, /^Alex Rodriguez \(102\) out for Polanco \(77\)/);
  assert.deepEqual(p.fit.dual!.plan.map((s) => s.out?.name), ["Ostermueller", "Thomas", "Thomas"]);
  assert.ok(p.fit.short!.delta > fitIn(rileArm, t, [], ctx, room)!.short!.delta);
});
