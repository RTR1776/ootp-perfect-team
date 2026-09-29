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
