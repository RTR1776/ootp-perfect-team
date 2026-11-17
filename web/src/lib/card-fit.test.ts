import test from "node:test";
import assert from "node:assert/strict";
import { armRole, batAt, bestTeam, fitIn, savedTeam, spotValue, staffSwap, type FitCtx, type ScoredForm } from "./card-fit";
import { fieldingRuns } from "@/lib/analytics/fielding";
import { rosterObjective, RP_WEIGHT_DEFAULT, rotationTilt, staffStaminaRuns, type ObjectiveOptions } from "@/lib/roster-objective";
import type { FillCard } from "@/lib/roster-fill";
import { twoWayId } from "@/lib/two-way";

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
 * P1 D1 S1 B2, a 102 and a 99 already in the rotation. A three-man rotation
 * weighs its slots by their share of the starts (rotationTilt): Farrell's SP3
 * slot counts ROT[2] of an average start, Young's SP2 ROT[1].
 */
const ROT = rotationTilt(3);
const near = (a: number | null | undefined, b: number) => a != null && Math.abs(a - b) < 1e-9;
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
  assert.ok(near(fitIn(mcdonald, team, [], noDh)!.gain, 4 * ROT[2]), "the old one-swap read: +4 over Farrell at SP3");
  const fit = fitIn(mcdonald, team, [], noDh, room)!;
  assert.equal(fit.status, "bench");
  assert.equal(fit.gain, 0);
  assert.ok(near(fit.room?.gross, 4 * ROT[2]));
  // Room for a third Diamond-or-better card means Young (99) giving way: to the 75 (8 → 3) or to Farrell (8 → 2).
  assert.ok(near(fit.room?.cost, 5 * ROT[1]));
  assert.match(fit.room!.note, /^Young \(99\) out for Spare \(75\)/);
});

test("Cap: room that costs less than the swap adds is paid out of the gain", () => {
  const { team, room, mcdonald } = capCase(7);
  const fit = fitIn(mcdonald, team, [], noDh, room)!;
  assert.equal(fit.status, "start");
  assert.ok(near(fit.gain, 4 * ROT[2] - 1 * ROT[1]), "4 over Farrell at SP3, less 1 at SP2 for Young → the 75");
  assert.equal(fit.swaps[0].out?.name, "Farrell");
});

test("Cap: a Diamond card on the bench goes off the roster for free", () => {
  const benchDiamond = valued(bat("Bench Diamond", 0, 0, { CF: 70 }), 92);
  const { team, room, mcdonald } = capCase(3, [benchDiamond]);
  // One more D slot for the bench card: the saved roster holds as it is.
  const fit = fitIn(mcdonald, team, [], noDh, room)!;
  assert.equal(fit.status, "start");
  assert.ok(near(fit.gain, 4 * ROT[2]));
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
  assert.ok(near(fit.gain, 4 * ROT[2]));
  assert.equal(fit.room, null);
});

/* ------------------------------------------------- arms, as the objective prices them */

/** Arms as card-fit-load scores them: `pen` is the runs in a pen slot; runsR keeps the staff-stamina term for a starter and drops it for a reliever. */
const arms = (specs: [name: string, role: "SP" | "RP", pen: number, stamina: number][]): ScoredForm[] => specs.map(([name, role, pen, stamina]) => {
  const raw = pen + staffStaminaRuns({ isPitcher: true, ratings: { Stamina: stamina } });
  const runs = role === "RP" ? pen : raw;
  return { ...arm(name, role, runs), pen, stamina };
});
const fillCard = (f: ScoredForm, ratings: Record<string, number>): FillCard => ({
  cardId: f.id, name: f.name, val: 60, year: 2000, isPitcher: f.isPitcher, role: f.role, cardType: 4,
  ratings, baseOwned: true, variantOwned: false, variant: false,
});
/** The roster objective's value of these arms in these slots, every order tried: the order the builder's search settles on. */
function objectiveBest(keys: string[], ids: number[], score: (board: Record<string, number>) => number): number {
  let best = -Infinity;
  const go = (rest: number[], board: Record<string, number>) => {
    if (!rest.length) { best = Math.max(best, score(board)); return; }
    rest.forEach((id, i) => go(rest.filter((_, j) => j !== i), { ...board, [keys[keys.length - rest.length]]: id }));
  };
  go(ids, {});
  return best;
}

/*
 * PTMS 3 T2 Iron (2026-11-17), roster 2218's pen as Card Fit read it: Carter
 * Capps (RP, Stamina 19) screened +6.0 in place of Bob Gibson (VAR), the pen's
 * worst arm and one of its two long men. Builds forced to carry Capps gave +1.4,
 * with Capps in for Todd Jones and the long men kept.
 */
test("a reliever takes the place the builder can give him: the pen re-sorted at its tilt, its two long men kept", () => {
  const ctx: FitCtx = { dh: true, lhp: 0.3, glove: 1, pit: 2, pitSp: 1, pitRp: 2.5 };
  const pen = arms([
    ["Bale", "RP", 9.3, 33], ["Choate", "RP", 4.7, 6], ["Thatcher", "RP", 0.8, 7], ["Marshall", "RP", -0.7, 74],
    ["Carrasco", "RP", -2.5, 20], ["Jones", "RP", -2.9, 17], ["Gibson", "SP", -8.5, 69],
  ]);
  const [capps] = arms([["Capps", "RP", -1.1, 19]]);
  const keys = ["CL", "RP1", "RP2", "RP3", "RP4", "RP5", "RP6"];
  const objective = (staff: ScoredForm[]) => {
    const all = [...staff, capps];
    // env-fit's runs carry the staff-stamina term; the objective takes it out in every pen slot (staminaTerm).
    const runs = new Map(all.map((f) => [f.id, f.pen! + staffStaminaRuns({ isPitcher: true, ratings: { Stamina: f.stamina! } })]));
    const o: ObjectiveOptions = { shape: { lineupPos: [], spKeys: [], rpKeys: keys, benchKeys: [], bats: 0 }, runsR: runs, runsL: runs, rpWeight: RP_WEIGHT_DEFAULT * 2.5, staminaTerm: true };
    const obj = rosterObjective(all.map((f) => fillCard(f, { Stamina: f.stamina! })), o);
    return objectiveBest(keys, staff.map((f) => f.id), obj.objective);
  };
  const team = { R: {}, L: {}, SP: [], RP: pen };
  const fit = fitIn(capps, team, [], ctx)!;
  assert.equal(fit.swaps[0].out?.name, "Jones", "not Gibson: Marshall and Gibson are the pen's only long men");
  assert.equal(staffSwap("RP", pen, pen[6], capps, ctx), null);
  const jonesOut = pen.map((f) => (f.name === "Jones" ? capps : f));
  assert.ok(near(fit.gain, objective(jonesOut) - objective(pen)), `the objective's gain: ${fit.gain}`);
  assert.ok(fit.gain > 1 && fit.gain < 1.5, "about +1.2, as the forced builds and the --score swap read it");

  // A third long man frees Gibson's place.
  const deeper = pen.map((f) => (f.name === "Carrasco" ? { ...f, stamina: 50 } : f));
  const fit3 = fitIn(capps, { ...team, RP: deeper }, [], ctx)!;
  assert.equal(fit3.swaps[0].out?.name, "Gibson");
  assert.ok(near(fit3.gain, objective(deeper.map((f) => (f.name === "Gibson" ? capps : f))) - objective(deeper)));
});

/*
 * Friday Nightmare Cap (2026-11-17), roster 2179's rotation: Francisco Liriano
 * (SP) screened +12.5, his forced build +9.0. With no DH, Cool Papa Bell bats
 * in his starts, which the objective credits over a pitcher's bat; and Liriano
 * goes in at SP1, the rest sliding down a slot.
 */
test("a starter is priced on the rotation re-sorted at SP1's tilt, a two-way starter's bat counted with no DH", () => {
  const ctx: FitCtx = { dh: false, lhp: 0.3343, glove: 1, pit: 2, pitSp: 1.5, spWeight: 1.59, fieldSp: 4.8 };
  const rot = arms([["Escobar", "SP", 9.7, 76], ["Montgomery", "SP", 7.3, 87], ["Conley", "SP", 6.0, 95], ["Dean", "SP", 4.5, 90], ["Bell", "SP", 1.1, 86]]);
  const bell = rot[4];
  bell.bat = { runsR: -32.5, runsL: -33.2 };
  const [liriano] = arms([["Liriano", "SP", 11.28, 77]]);
  const keys = ["SP1", "SP2", "SP3", "SP4", "SP5"];
  const objective = (staff: ScoredForm[]) => {
    const all = [...rot, liriano];
    const runsR = new Map(all.map((f) => [f.id, f.runsR])), runsL = new Map(runsR);
    runsR.set(twoWayId(bell.id), bell.bat!.runsR); runsL.set(twoWayId(bell.id), bell.bat!.runsL);
    const batForm: FillCard = { ...fillCard(bell, {}), cardId: twoWayId(bell.id), isPitcher: false, role: null };
    const o: ObjectiveOptions = { shape: { lineupPos: ["SS"], spKeys: keys, rpKeys: [], benchKeys: [], bats: 1 }, runsR, runsL, lhpShare: ctx.lhp, spWeight: 1.59 * 1.5, fieldSp: 4.8 };
    const obj = rosterObjective([...all.map((f) => fillCard(f, { Stamina: f.stamina! })), batForm], o);
    return objectiveBest(keys, staff.map((f) => f.id), obj.objective);
  };
  const fit = fitIn(liriano, { R: {}, L: {}, SP: rot, RP: [] }, [], ctx)!;
  assert.equal(fit.swaps[0].out?.name, "Bell");
  assert.ok(near(fit.gain, objective(rot.map((f) => (f === bell ? liriano : f))) - objective(rot)), `the objective's gain: ${fit.gain}`);
  // The old read: (12.0 - 2.9) at the flat starter weight, Bell's bat left out.
  assert.ok(near(liriano.runsR, 12) && fit.gain < 9.1 * 2.2896 - 4, `${fit.gain}`);
});
