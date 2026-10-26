import test from "node:test";
import assert from "node:assert/strict";
import {
  advise, assign, BACKUP_C_MISSING, BACKUP_C_WEIGHT, expectedBestOfN, makeEngine, playOut, poolOf, quickGain, slotRuns, starterBatRuns, teamPlan, spotOf,
  type DraftCard, type DraftCtx,
} from "./engine";
import { allRounds, type DraftFormat, type DraftGroup } from "./formats";
import { draftCtx } from "./load";
import { fieldPercentile } from "./study";
import { fieldingRuns, framingRuns } from "@/lib/analytics/fielding";
import { penTilt, PITCHER_BAT_RUNS, rotationTilt, STARTER_PA_SHARE } from "@/lib/roster-objective";

const ctx: DraftCtx = { dh: true, lhp: 0.3, glove: 1, frm: 1, eraYear: 2010, sp: 2, rp: 2, bench: 1, spW: 1.2, rpW: 1, benchW: 0.1 };
let next = 1;
const bat = (name: string, group: DraftGroup, runsR: number, runsL: number, pos: DraftCard["pos"], extra: Partial<DraftCard> = {}): DraftCard =>
  ({ id: next++, name, tier: "Bronze", val: 65, group, isPitcher: false, role: null, hand: "R", year: 2000, player: name, runsR, runsL, pos, ...extra });
const arm = (name: string, role: "SP" | "RP", runs: number, extra: Partial<DraftCard> = {}): DraftCard =>
  ({ id: next++, name, tier: "Bronze", val: 65, group: role, isPitcher: true, role, hand: "R", year: 2000, player: name, runsR: runs, runsL: runs, pos: {}, ...extra });

/** A small field with the replacement levels pinned by a few bad cards at every slot. */
function pool(extra: DraftCard[] = []): DraftCard[] {
  const filler: DraftCard[] = [];
  for (const p of ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"] as const) filler.push(bat(`bad ${p}`, p, -30, -30, { [p]: 60 }));
  filler.push(arm("bad SP", "SP", -20), arm("bad RP", "RP", -20));
  return [...filler, ...extra];
}

test("the expected best of a pack is the order statistic: brute force on a small pool", () => {
  const vals = [9, 7, 4, 2, 1];
  let sum = 0, n = 0;
  for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) for (let c = b + 1; c < 5; c++) { sum += Math.max(vals[a], vals[b], vals[c]); n++; }
  assert.ok(Math.abs(expectedBestOfN(vals, 3) - sum / n) < 1e-9);
  assert.equal(expectedBestOfN(vals, 9), 9, "a pack as big as the pool shows the best card");
  assert.equal(expectedBestOfN([], 6), 0);
  assert.ok(Math.abs(expectedBestOfN([5, 5, 5], 2) - 5) < 1e-9);
});

test("the assignment is optimal: every permutation of a small matrix", () => {
  const cost = [[4, 1, 3, 9], [2, 0, 5, 9], [3, 2, 2, 9]];
  const pick = assign(cost);
  const total = pick.reduce((s, j, i) => s + cost[i][j], 0);
  let best = Infinity;
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) {
    if (a === b || a === c || b === c) continue;
    best = Math.min(best, cost[0][a] + cost[1][b] + cost[2][c]);
  }
  assert.equal(total, best);
  assert.equal(new Set(pick).size, 3, "each row its own column");
});

test("a card plays its listed position below the glove floor, and anywhere else only at or above it", () => {
  const c = bat("Stone hands", "SS", 2, 1, { SS: 45, "2B": 55, "3B": 65 });
  assert.equal(slotRuns(c, "SS", "R", ctx), 2 + fieldingRuns("SS", 45), "his own position, rating 45");
  assert.equal(slotRuns(c, "2B", "R", ctx), null, "55 at second is under the 60 floor");
  assert.equal(slotRuns(c, "3B", "L", ctx), 1 + fieldingRuns("3B", 65));
  assert.equal(slotRuns(c, "DH", "R", ctx), 2);
  assert.equal(slotRuns(c, "DH", "R", { ...ctx, dh: false }), null);
  const catcher = bat("Framer", "C", 0, 0, { C: 80 }, { frame: 110 });
  assert.equal(slotRuns(catcher, "C", "R", { ...ctx, frm: 0.5 }), fieldingRuns("C", 80) + 0.5 * framingRuns(110, 2010));
});

test("a team's lineup is an exact assignment on each board: the better shortstop takes short, the other moves to second", () => {
  const ss1 = bat("Short A", "SS", 10, 10, { SS: 90, "2B": 85 });
  const ss2 = bat("Short B", "SS", 12, 12, { SS: 95 });
  const E = makeEngine(pool([ss1, ss2]), ctx);
  const plan = teamPlan(E, [E.byId.get(ss1.id)!, E.byId.get(ss2.id)!]);
  assert.equal(E.lineup[plan.R.indexOf(E.byId.get(ss2.id)!)], "SS");
  assert.equal(E.lineup[plan.R.indexOf(E.byId.get(ss1.id)!)], "2B");
  assert.equal(spotOf(E, plan, E.byId.get(ss1.id)!), "2B vR/vL");
  // Empty slots are replacement: they add nothing.
  const lone = teamPlan(E, [E.byId.get(ss2.id)!]);
  const k = E.lineup.indexOf("SS");
  assert.ok(Math.abs(lone.parts.lineup - ((1 - ctx.lhp) * E.cR[E.byId.get(ss2.id)!][k] + ctx.lhp * E.cL[E.byId.get(ss2.id)!][k])) < 1e-9);
});

test("the rotation takes SP cards only, best first on the tilt; an extra starter is a long man", () => {
  const a = arm("Ace", "SP", 20), b = arm("Two", "SP", 10), c = arm("Three", "SP", 5), r = arm("Closer", "RP", 15);
  const E = makeEngine(pool([a, b, c, r]), ctx);
  const ids = [a, b, c, r].map((x) => E.byId.get(x.id)!);
  const plan = teamPlan(E, ids);
  assert.deepEqual(plan.rotation, [ids[0], ids[1]]);
  assert.deepEqual(plan.pen, [ids[3], ids[2]], "closer first, the third starter relieves");
  const tilt = rotationTilt(2), pt = penTilt(2);
  const expectRot = tilt[0] * E.rotKey[ids[0]] + tilt[1] * E.rotKey[ids[1]];
  assert.ok(Math.abs(plan.parts.rotation - expectRot) < 1e-9);
  assert.ok(Math.abs(plan.parts.pen - ctx.rpW * (pt[0] * E.penC[ids[3]] + pt[1] * E.penC[ids[2]])) < 1e-9);
  assert.equal(spotOf(E, plan, ids[2]), "pen");
  assert.equal(spotOf(E, plan, ids[3]), "closer");
  // A reliever never starts, however good.
  const relieversOnly = teamPlan(E, [ids[3]]);
  assert.deepEqual(relieversOnly.rotation, []);
});

test("the quick gain matches the exact plan when nothing cascades, and counts the bumped man's move when something does", () => {
  const c1 = bat("Catcher", "C", 5, 5, { C: 80 });
  const ss = bat("Short", "SS", 4, 4, { SS: 80, "2B": 80 });
  const better = bat("Better short", "SS", 9, 9, { SS: 90 });
  const E = makeEngine(pool([c1, ss, better]), ctx);
  const [ic, is, ib] = [c1, ss, better].map((x) => E.byId.get(x.id)!);
  const base = teamPlan(E, [ic]);
  const exact = teamPlan(E, [ic, is]).value - base.value;
  assert.ok(Math.abs(quickGain(E, is, base) - exact) < 1e-9, "a shortstop into an empty short");
  const withSs = teamPlan(E, [ic, is]);
  const exact2 = teamPlan(E, [ic, is, ib]).value - withSs.value;
  const quick2 = quickGain(E, ib, withSs);
  assert.ok(Math.abs(quick2 - exact2) < 1e-6, `the old shortstop moves to second: quick ${quick2} vs exact ${exact2}`);
});

test("a backup catcher is worth a tenth of his value behind the plate, and having none costs a charge (L.J.'s two-catcher rule)", () => {
  const a = bat("Starter", "C", 10, 10, { C: 90 }), b = bat("Backup", "C", -5, -5, { C: 70 });
  const E = makeEngine(pool([a, b]), ctx);
  const ia = E.byId.get(a.id)!, ib = E.byId.get(b.id)!;
  const plan = teamPlan(E, [ia, ib]);
  assert.equal(plan.backup, ib);
  assert.ok(Math.abs(plan.parts.backup - BACKUP_C_WEIGHT * E.catchC[ib]) < 1e-9);
  const alone = teamPlan(E, [ia]);
  assert.equal(alone.parts.backup, -BACKUP_C_MISSING);
  assert.ok(Math.abs(quickGain(E, ib, alone) - (plan.value - alone.value)) < 1e-6, "the quick read sees the charge lifted");
});

test("with no DH a two-way starter's bat counts for his share of the starts", () => {
  const noDh = { ...ctx, dh: false };
  const ruth = arm("Two-way", "SP", 10, { batR: 20, batL: 10 });
  const expect = STARTER_PA_SHARE * ((1 - noDh.lhp) * (20 - PITCHER_BAT_RUNS) + noDh.lhp * (10 - PITCHER_BAT_RUNS));
  assert.ok(Math.abs(starterBatRuns(ruth, noDh) - expect) < 1e-9);
  assert.equal(starterBatRuns(ruth, ctx), 0, "a DH bats for him");
  const E = makeEngine(pool([ruth]), noDh);
  const i = E.byId.get(ruth.id)!;
  assert.ok(E.rotKey[i] > noDh.spW * (ruth.runsR - E.repl.SP), "his bat lifts his rotation value");
});

/* A toy draft: two catcher rounds and an open Bronze round, one-card packs where the pool is one card. */
const toy: DraftFormat = {
  series: "toy", eventId: 0, name: "Toy", short: "Toy", cards: 3, envYear: 2010, dh: true, teams: 2, mode: "Bo1",
  rounds: [
    { key: "B-C", label: "Bronze C", tier: "Bronze", groups: ["C"], count: 2, pack: "fixed" },
    { key: "B-SP", label: "Bronze SP", tier: "Bronze", groups: ["SP"], count: 1, pack: "fixed" },
  ],
  packSize: 2, confirmed: [], assumed: [],
};

test("the last pick is ranked on what it adds, nothing left to play out", () => {
  const a = arm("Good", "SP", 15), b = arm("Fair", "SP", 5);
  const E = makeEngine(pool([a, b]), ctx);
  const ia = E.byId.get(a.id)!, ib = E.byId.get(b.id)!;
  const rem = { "B-C": 0, "B-SP": 1 };
  const adv = advise(E, { format: toy, team: [], rem, round: toy.rounds[1], pack: [ib, ia], play: { packSize: 2 } });
  assert.deepEqual(adv.rows.map((r) => r.idx), [ia, ib]);
  assert.ok(Math.abs(adv.rows[0].score - teamPlan(E, [ia]).value) < 1e-9);
  assert.ok(adv.rows[0].delta > 0 && adv.rows[1].delta < 0);
});

test("the rounds left are priced in: take the catcher the second round can't replace", () => {
  // On offer now: a steady catcher, and one great vs RHP but poor vs LHP. The second catcher round can
  // bring the steady one or a lefty-killer. Platoon-R now and the steady man next covers both boards and
  // the backup job; steady now leaves the vs-RHP side to whoever comes. No DH, so nobody moves to DH.
  const steady = bat("Steady", "C", 6, 6, { C: 80 });
  const vR = bat("Platoon R", "C", 14, -20, { C: 80 });
  const vL = bat("Platoon L", "C", -20, 14, { C: 80 });
  const E = makeEngine(pool([steady, vR, vL]), { ...ctx, dh: false, lhp: 0.4 });
  const [is, ir] = [steady, vR].map((x) => E.byId.get(x.id)!);
  // Packs as big as the pool: the second round shows every catcher left.
  const adv = advise(E, { format: toy, team: [], rem: allRounds(toy), round: toy.rounds[0], pack: [is, ir], play: { packSize: 99 } });
  assert.equal(adv.rows[0].idx, ir);
  const after = playOut(E, toy, [ir], { "B-C": 1, "B-SP": 0 }, { packSize: 99 });
  assert.ok(after.team.includes(is), "the play-out takes the steady catcher second");
  // Packs as big as the pool make every expected pick certain, so the expected value is the team's exact value.
  assert.ok(Math.abs(after.value - after.plan.value) < 1e-6);
  assert.ok(adv.rows[0].score > adv.rows[1].score);
});

test("in a pick-a-position round the empty high-value slot's pack ranks first", () => {
  const f: DraftFormat = { ...toy, rounds: [{ key: "B", label: "Bronze", tier: "Bronze", groups: ["C", "SP"], count: 2, pack: "choose" }] };
  const c = bat("Catcher", "C", 0, 0, { C: 80 }), s1 = arm("Starter 1", "SP", 12), s2 = arm("Starter 2", "SP", 11);
  const E = makeEngine(pool([c, s1, s2]), { ...ctx, sp: 2, spW: 3 });
  const ic = E.byId.get(c.id)!;
  const adv = advise(E, { format: f, team: [ic], rem: { B: 2 }, round: f.rounds[0], play: { packSize: 2 } });
  assert.equal(adv.groups[0].group, "SP", "a catcher is in; the rotation is empty");
  assert.ok(adv.groups[0].delta === 0 && adv.groups[1].delta < 0);
});

test("slot prices follow the builder: L.J.'s era staff, the series' weights split over it, the era's team weights", () => {
  const five = { ...toy, cards: 21, envYear: 1916, dh: false };
  const { ctx: c5, tw } = draftCtx(five, { gloveScale: 1.1, lhp: 0.28, spWeight: 2.5, rpWeight: 0.4, staff: { sp: 3.3, rp: 3.4 } });
  assert.deepEqual([c5.sp, c5.rp, c5.bench], [4, 5, 4], "pre-1930: 4 SP, 5 RP, the rest bat");
  assert.ok(Math.abs(c5.spW - 2.5 * tw.sp * (3.3 / 4)) < 1e-9);
  assert.ok(Math.abs(c5.rpW - 0.4 * tw.rp * (3.4 / 5)) < 1e-9);
  assert.ok(Math.abs(c5.glove - 1.1 * tw.def) < 1e-9);
  assert.ok(Math.abs(c5.benchW - 0.0825) < 1e-9, "0.33 of a slot over four bench bats");
  const six = { ...toy, cards: 26, envYear: 1996, dh: true };
  const { ctx: c6 } = draftCtx(six, { gloveScale: 1, lhp: 0.3, spWeight: null, rpWeight: null, staff: null });
  assert.deepEqual([c6.sp, c6.rp, c6.bench], [5, 7, 5]);
  assert.equal(c6.frm, 0.5, "1994-2009 framing weight");
});

test("a finished team's place in the field reads off the study's percentiles", () => {
  const v = Array.from({ length: 101 }, (_, k) => 400 + 2 * k);
  assert.equal(fieldPercentile(v, 300), 0);
  assert.equal(fieldPercentile(v, 700), 100);
  assert.ok(Math.abs(fieldPercentile(v, 501)! - 50.5) < 1e-9);
  assert.equal(fieldPercentile([], 500), null);
});

test("a card that left the pool is out of what the rounds to come can bring, but still on the board and takeable", () => {
  const gone = bat("Gone", "SS", 30, 30, { SS: 90 }, { out: true });
  const here = bat("Here", "SS", 2, 2, { SS: 80 });
  const E = makeEngine(pool([gone, here]), ctx);
  const ig = E.byId.get(gone.id)!, ih = E.byId.get(here.id)!;
  assert.ok(!poolOf(E, "Bronze", ["SS"], new Set()).includes(ig));
  assert.ok(poolOf(E, "Bronze", ["SS"], new Set(), true).includes(ig));
  const f: DraftFormat = { ...toy, rounds: [{ key: "B-SS", label: "Bronze SS", tier: "Bronze", groups: ["SS"], count: 2, pack: "fixed" }] };
  const adv = advise(E, { format: f, team: [], rem: { "B-SS": 2 }, round: f.rounds[0], play: { packSize: 2 } });
  assert.equal(adv.rows[0].idx, ig, "the board still ranks it first");
  // The second round's expectation comes from the cards still in the pool, so the star is not counted on twice.
  const out = playOut(E, f, [ih], { "B-SS": 1 }, { packSize: 2 });
  assert.ok(!out.team.includes(ig));
});
