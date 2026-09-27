import { test } from "node:test";
import assert from "node:assert/strict";
import { addArm, armKey, blendArm, ipPerSlotFrom, leagueArmRatings, poolArmEdges, roleOf, staffSolve, variantFace, type ArmRow, type ArmSide, type StaffArm } from "./league-arms";

const line = (o: Partial<ArmRow> & { snapshotId: number; name: string; ip: number; k: number; bb: number; hr: number; gs?: number; g?: number }): ArmRow => ({
  league: "HD451", capturedOn: "2026-09-20", org: o.org ?? "Team A", isFreeAgent: false, cid: o.cid ?? null, isVariant: o.isVariant ?? false, pos: o.pos ?? "SP",
  ...o,
  stats: { Ka: o.k, BBa: o.bb, HPa: 0, HRa: o.hr, IP: o.ip, GS_p: o.gs ?? 0, G_p: o.g ?? 0 },
});

test("edge per 9 is against each week's own league, starts and relief apart", () => {
  // Week 1 league core: (13·20 + 3·60 − 2·180) / 200 = 0.4 per IP.
  const rows = [
    line({ snapshotId: 1, name: "Ace", cid: 1, ip: 100, k: 110, bb: 20, hr: 8, gs: 16, g: 16 }),
    line({ snapshotId: 1, name: "Filler", cid: 2, org: "Team B", ip: 100, k: 70, bb: 40, hr: 12, gs: 16, g: 16 }),
    // The same Ace relieving for another team in week 2, in a tougher league.
    line({ snapshotId: 2, name: "Ace", cid: 1, org: "Team C", ip: 50, k: 60, bb: 10, hr: 2, g: 40, capturedOn: "2026-09-27" }),
    line({ snapshotId: 2, name: "Other", cid: 3, org: "Team D", ip: 150, k: 150, bb: 45, hr: 15, gs: 25, g: 25, capturedOn: "2026-09-27" }),
    line({ snapshotId: 2, name: "Free agent", cid: 4, org: "-", ip: 10, k: 0, bb: 30, hr: 9 }),
  ];
  const e = poolArmEdges(rows).get(armKey({ cid: 1, name: "Ace", isVariant: false }))!;
  // As SP, week 1: 100·0.4 − (13·8 + 3·20 − 2·110) = 40 + 56 = 96 over 100 IP.
  assert.equal(e.asSP!.edge9.toFixed(3), "0.960");
  assert.equal(e.asSP!.teams, 1);
  // As RP, week 2: league core (13·17 + 3·55 − 2·210)/200 = −0.17; 50·(−0.17) − (26 + 30 − 120) = 55.5 over 50.
  assert.equal(e.asRP!.edge9.toFixed(3), "1.110");
  assert.ok(e.asRP!.edge9Reg < e.asRP!.edge9, "shrunk toward 0 by the 150-inning prior");
  assert.equal(poolArmEdges(rows).has("c4"), false, "free agents have no line");
});

test("a line is a starter when most of its games were starts", () => {
  assert.equal(roleOf({ pos: "RP", stats: { G_p: 30, GS_p: 20 } }), "SP");
  assert.equal(roleOf({ pos: "SP", stats: { G_p: 40, GS_p: 5 } }), "RP");
  assert.equal(roleOf({ pos: "SP", stats: {} }), "SP");
});

test("slot innings come from each team's five most-started arms and the rest", () => {
  const rows: ArmRow[] = [];
  for (let t = 0; t < 5; t++) for (let i = 0; i < 12; i++) {
    rows.push(line({ snapshotId: 1, org: `T${t}`, name: `P${t}-${i}`, ip: i < 5 ? 180 + i : i < 11 ? 60 : 5, k: 0, bb: 0, hr: 0, gs: i < 5 ? 30 : 0, g: 30 }));
  }
  const ip = ipPerSlotFrom(rows);
  assert.equal(ip.sp, 182);
  assert.equal(ip.rp, 60, "under-10-inning arms are left out");
});

const arm = (entry: string, sp: number | null, rp: number | null, stamina: number | null = 60): StaffArm => ({ entry, label: entry, sp, rp, stamina });
const ip = { sp: 180, rp: 70 };

test("the rotation is the five arms that gain most from starting", () => {
  const arms = [arm("A", 0.4, 0.4), arm("B", 0.3, 0.3), arm("C", 0.2, 0.2), arm("D", 0.1, 0.1), arm("E", 0.05, 0.05), arm("Closer", 0.5, 0.6, 20), arm("F", -0.1, 0.3)];
  const s = staffSolve(arms, ip);
  assert.deepEqual(s.rotation.map((x) => x.entry), ["A", "B", "C", "D", "E"]);
  assert.equal(s.bullpen[0].entry, "Closer", "a low-Stamina arm can't start; best reliever closes");
  assert.equal(s.bullpen[0].slot, "CL");
  const total = (0.4 + 0.3 + 0.2 + 0.1 + 0.05) * 180 / 9 + (0.6 + 0.3) * 70 / 9;
  assert.equal(s.total.toFixed(4), total.toFixed(4));
  const locked = staffSolve(arms, ip, { SP: ["F"] });
  assert.ok(locked.rotation.some((x) => x.entry === "F"), "a lock puts him in the rotation");
  assert.equal(locked.rotation.length, 5);
});

test("adding an arm keeps the number of pitching spots: the weakest arm sits", () => {
  const arms = [arm("A", 0.4, 0.4), arm("B", 0.3, 0.3), arm("C", 0.2, 0.2), arm("D", 0.1, 0.1), arm("E", 0.05, 0.05), arm("Pen1", null, 0.2, 20), arm("Pen2", null, -0.3, 20)];
  const r = addArm(arms, arm("New", 0.35, 0.2), ip);
  assert.equal(r.slot?.role, "SP");
  assert.deepEqual(r.replaces, ["E"], "E leaves the rotation");
  assert.deepEqual(r.sits, ["Pen2"], "and the worst reliever stops pitching");
  // New starts over E (+0.30 a start's worth), E relieves in Pen2's place (+0.35 a pen slot's worth).
  assert.equal(r.season.toFixed(4), ((0.35 - 0.05) * 180 / 9 + (0.05 - -0.3) * 70 / 9).toFixed(4));
  const reliever = addArm(arms, arm("Closer", null, 0.29, 20), ip);
  assert.equal(reliever.slot?.slot, "CL");
  assert.equal(reliever.season.toFixed(4), ((0.29 - -0.3) * 70 / 9).toFixed(4), "a reliever's worth is over the arm he sends to the bench");
});

test("a locked arm sits in the slot he was locked to; runs don't move", () => {
  const arms: StaffArm[] = [
    { entry: "A", label: "A", sp: 0.4, rp: 0.3, stamina: 90 }, { entry: "B", label: "B", sp: 0.3, rp: 0.2, stamina: 90 },
    { entry: "C", label: "C", sp: 0.2, rp: 0.2, stamina: 90 }, { entry: "D", label: "D", sp: 0.1, rp: 0.1, stamina: 90 },
    { entry: "E", label: "E", sp: 0.0, rp: 0.0, stamina: 90 }, { entry: "F", label: "F", sp: null, rp: 0.5, stamina: 20 },
    { entry: "G", label: "G", sp: null, rp: -0.2, stamina: 20 },
  ];
  const ip = { sp: 180, rp: 70 };
  const free = staffSolve(arms, ip);
  const held = staffSolve(arms, ip, { SP: ["E"], RP: ["G"], at: { SP1: "E", CL: "G" } });
  assert.equal(held.rotation[0].entry, "E");
  assert.deepEqual(held.rotation.map((s) => s.slot), ["SP1", "SP2", "SP3", "SP4", "SP5"]);
  assert.equal(held.bullpen[0].entry, "G");
  assert.equal(held.bullpen[0].slot, "CL");
  assert.equal(held.bullpen[1].entry, "F", "the rest keep their order around the lock");
  assert.ok(Math.abs(held.total - free.total) < 1e-9, "the same arms in the same roles");
});

test("with one spot fewer than arms, a starter with a poor relief number sits instead of holding the rotation", () => {
  // Six can start. The greedy pick (five largest start-minus-relief gains) keeps Blue, whose relief is awful,
  // and benches Haddix; starting Haddix and sitting Blue is better.
  const arms = [arm("A", 0.4, 0.3), arm("B", 0.3, 0.2), arm("C", 0.25, 0.2), arm("D", 0.2, 0.15), arm("Blue", 0.0, -0.5), arm("Haddix", 0.1, 0.25), arm("Henke", null, 0.1, 25)];
  const s = staffSolve(arms, ip, {}, 6);
  assert.deepEqual(s.rotation.map((x) => x.entry).sort(), ["A", "B", "C", "D", "Haddix"]);
  assert.deepEqual(s.bullpen.map((x) => x.entry), ["Henke"]);
  assert.deepEqual(s.out.map((x) => x.entry), ["Blue"]);
});

test("the staff is the best split of starters, relievers and sitters (brute force)", () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const brute = (arms: StaffArm[], size: number, starters: number) => {
    const relievers = Math.min(size - starters, arms.length - starters);
    let best = -Infinity;
    const walk = (i: number, sp: number, rp: number, total: number) => {
      if (i === arms.length) { if (sp === starters && rp === relievers) best = Math.max(best, total); return; }
      const a = arms[i];
      const starts = a.sp != null && (a.stamina == null || a.stamina > 25);
      if (starts) walk(i + 1, sp + 1, rp, total + (a.sp! * ip.sp) / 9);
      walk(i + 1, sp, rp + 1, total + ((a.rp ?? a.sp ?? 0) * ip.rp) / 9);
      walk(i + 1, sp, rp, total);
    };
    walk(0, 0, 0, 0);
    return best;
  };
  for (let t = 0; t < 300; t++) {
    const n = 6 + Math.floor(rnd() * 4);
    const arms = Array.from({ length: n }, (_, i) => {
      const reliefOnly = rnd() < 0.3;
      return arm(`a${i}`, reliefOnly && rnd() < 0.5 ? null : rnd() - 0.4, rnd() < 0.1 ? null : rnd() - 0.4, reliefOnly ? 20 : 60);
    });
    const canStart = arms.filter((a) => a.sp != null && (a.stamina ?? 99) > 25).length;
    // A staff always has its rotation, so it is never smaller than that.
    for (const size of [n, n - 1, n - 2].filter((z) => z >= Math.min(5, canStart))) {
      const s = staffSolve(arms, ip, {}, size);
      const b = brute(arms, size, Math.min(5, canStart));
      assert.ok(Math.abs(s.total - b) < 1e-9, `trial ${t}, n ${n}, size ${size}: ${s.total} vs ${b}`);
      assert.equal(s.rotation.length + s.bullpen.length, Math.min(size, n));
    }
  }
});

test("adding an arm as a reliever (or a starter) puts him there, even where he'd score more elsewhere", () => {
  const arms = [arm("A", 0.4, 0.4), arm("B", 0.3, 0.3), arm("C", 0.2, 0.2), arm("D", 0.1, 0.1), arm("E", 0.05, 0.05), arm("Pen1", null, 0.2, 20), arm("Pen2", null, -0.3, 20)];
  const best = addArm(arms, arm("New", 0.35, 0.2), ip);
  assert.equal(best.slot?.role, "SP");
  const pen = addArm(arms, arm("New", 0.35, 0.2), ip, {}, "RP");
  assert.equal(pen.slot?.role, "RP");
  assert.deepEqual(pen.sits, ["Pen2"]);
  assert.ok(pen.season < best.season, "his best role is worth more");
  assert.equal(addArm(arms, arm("Closer", null, 0.29, 20), ip, {}, "RP").slot?.slot, "CL");
});

const side = (edge9: number, ip: number): ArmSide => ({ edge9, edge9Reg: 0, ip, teams: 1, weeks: 1 });

test("the family blend: with no play in the family and a family read as the others, it is the old pooled score", () => {
  const same = { a: 0, b: 1, w: 1000, n: 0 };
  const b = blendArm([{ fam: null, other: side(0.3, 600), shift: 0 }], 0.1, same);
  assert.equal(b.score.toFixed(6), ((600 * 0.3 + 150 * 0.1) / 750).toFixed(6));
  assert.deepEqual([b.ipFam, b.ipOther], [0, 600]);
  assert.equal(blendArm([], 0.1, same).score.toFixed(6), "0.100000", "no play anywhere: the ratings estimate");
});

test("the family blend: its own play leads once it is big; elsewhere counts through the family's slope", () => {
  const pel = { a: -0.01, b: 0.7, w: 4000, n: 55 };
  // 25,830 PEL innings at −0.03 against +0.13 elsewhere: close to his PEL line.
  const big = blendArm([{ fam: side(-0.03, 25830), other: side(0.13, 20000), shift: 0 }], 0.1, pel).score;
  const prior = -0.01 + 0.7 * ((20000 * 0.13 + 150 * 0.1) / 20150);
  assert.equal(big.toFixed(6), ((25830 * -0.03 + 4000 * prior) / 29830).toFixed(6));
  assert.ok(big < 0.01);
  // No PEL play: the other leagues' line, scaled to PEL.
  assert.equal(blendArm([{ fam: null, other: side(0.2, 20000), shift: 0 }], 0, pel).score.toFixed(4), (-0.01 + 0.7 * (20000 * 0.2 / 20150)).toFixed(4));
});

test("the family blend pools the base card's and the variant's lines, each moved to the ratings scored", () => {
  const same = { a: 0, b: 1, w: 1000, n: 0 };
  // Scoring the variant: its own line needs no move; the base line moves up by what the variant adds (+0.1).
  const b = blendArm([{ fam: null, other: side(0.1, 3000), shift: 0.1 }, { fam: null, other: side(0.25, 1000), shift: 0 }], 0.2, same);
  assert.equal(b.ipOther, 4000);
  assert.equal(b.score.toFixed(6), ((4000 * ((3000 * 0.2 + 1000 * 0.25) / 4000) + 150 * 0.2) / 4150).toFixed(6));
  // The family's lines move by the family's slope times the shift.
  const pel = { a: 0, b: 0.5, w: 0, n: 0 };
  assert.equal(blendArm([{ fam: side(0.1, 1000), other: null, shift: 0.2 }], 0, pel).score.toFixed(6), "0.200000");
});

test("a line's split ratings read in the shop's words, only when all are there", () => {
  const r = { "STU vL": 160, "STU vR": 139, "CON vL": 95, "CON vR": 90, "HRA vL": 130, "HRA vR": 120, "PBAB vL": 97, "PBAB vR": 99, STM: 19, CON: 106 };
  assert.deepEqual(leagueArmRatings(r), {
    "Stuff vL": 160, "Stuff vR": 139, "Control vL": 95, "Control vR": 90, "pHR vL": 130, "pHR vR": 120, "pBABIP vL": 97, "pBABIP vR": 99, Stamina: 19,
  });
  assert.equal(leagueArmRatings({ STU: 140, CON: 82, HRA: 122, PBAB: 107, STM: 25 }), null, "exports before 09-26 have no splits");
  assert.equal(leagueArmRatings(undefined), null);
});

test("a pin never takes a locked arm's spot or adds one: with the rotation or the pen all locked it is refused", () => {
  const arms = [arm("A", 0.4, 0.3), arm("B", 0.3, 0.2), arm("C", 0.2, 0.2), arm("D", 0.1, 0.1), arm("E", 0.05, 0.05), arm("P1", null, 0.2, 20), arm("P2", null, 0.1, 20)];
  const rotationLocked = { SP: ["A", "B", "C", "D", "E"], at: { SP1: "A", SP2: "B", SP3: "C", SP4: "D", SP5: "E" } };
  const starter = arm("Ace", 0.5, 0.1);
  const pinned = addArm(arms, starter, ip, rotationLocked, "SP");
  assert.equal(pinned.refused, "SP");
  assert.equal(pinned.with.rotation.length, 5, "no sixth starter");
  assert.equal(pinned.season.toFixed(6), addArm(arms, starter, ip, rotationLocked).season.toFixed(6), "the same as where he fits best");
  const penLocked = { RP: ["P1", "P2"], at: { CL: "P1", RP1: "P2" } };
  const reliever = addArm(arms, arm("Closer", null, 0.6, 20), ip, penLocked, "RP");
  assert.equal(reliever.refused, "RP");
  assert.ok(reliever.with.bullpen.some((x) => x.entry === "P1") && reliever.with.bullpen.some((x) => x.entry === "P2"), "both locked relievers still pitch");
  assert.equal(addArm(arms, arm("Closer", null, 0.6, 20), ip, {}, "RP").refused, null, "with a free spot the pin holds");
});

test("a staff never pitches more arms than it has spots: four starters and a fifth to add", () => {
  const four = [arm("A", 0.4, 0.3), arm("B", 0.3, 0.2), arm("C", 0.2, 0.2), arm("D", 0.1, 0.1)];
  const r = addArm(four, arm("E", 0.35, 0.1), ip);
  assert.equal(r.with.rotation.length + r.with.bullpen.length, 4);
  assert.deepEqual(r.sits, ["D"]);
  assert.equal(r.season.toFixed(6), (((0.35 - 0.1) * ip.sp) / 9).toFixed(6));
});

test("a variant's league ratings never fall below its base card's (an export's mixed-up column)", () => {
  const base = { "Stuff vL": 140, "Control vL": 95, "pHR vL": 120, Stamina: 60, "GB%": 50 };
  const league = { "Stuff vL": 150, "Control vL": 9, "pHR vL": 120, Stamina: 60 };
  assert.deepEqual(variantFace(base, league), { "Stuff vL": 150, "Control vL": 95, "pHR vL": 120, Stamina: 60, "GB%": 50 });
});

test("the family blend says how much of the score is the ratings estimate", () => {
  const pel = { a: 0, b: 1, w: 4000, n: 0 };
  assert.equal(blendArm([], 0.1, pel).estShare, 1, "no play anywhere");
  // 200 PEL innings and nothing elsewhere: still mostly the estimate under a 4,000-inning prior.
  assert.ok(blendArm([{ fam: side(0.2, 200), other: null, shift: 0 }], 0.1, pel).estShare > 0.9);
  // A big sample elsewhere carries the prior.
  assert.ok(blendArm([{ fam: null, other: side(0.2, 20000), shift: 0 }], 0.1, pel).estShare < 0.01);
});

test("a card's ratings come from its newest week; two exports of that week take each rating's highest", () => {
  const splits = (con: number) => ({ "STU vL": 150, "STU vR": 140, "CON vL": con, "CON vR": con, "HRA vL": 120, "HRA vR": 118, "PBAB vL": 100, "PBAB vR": 102, STM: 20 });
  const rows = [
    line({ snapshotId: 1, name: "Uehara", cid: 7, isVariant: true, ip: 30, k: 40, bb: 5, hr: 3, g: 30, capturedOn: "2026-09-20" }),
    { ...line({ snapshotId: 2, name: "Uehara", cid: 7, isVariant: true, ip: 30, k: 40, bb: 5, hr: 3, g: 30, capturedOn: "2026-09-27" }), ratings: splits(140) },
    { ...line({ snapshotId: 3, name: "Uehara", cid: 7, isVariant: true, org: "Team B", ip: 30, k: 40, bb: 5, hr: 3, g: 30, capturedOn: "2026-09-27" }), ratings: splits(6) },
    line({ snapshotId: 2, name: "Other", cid: 8, org: "Team C", ip: 100, k: 80, bb: 30, hr: 10, gs: 16, g: 16, capturedOn: "2026-09-27" }),
    line({ snapshotId: 3, name: "Other", cid: 8, org: "Team D", ip: 100, k: 80, bb: 30, hr: 10, gs: 16, g: 16, capturedOn: "2026-09-27" }),
  ];
  for (const order of [rows, [...rows].reverse()]) {
    const e = poolArmEdges(order).get(armKey({ cid: 7, name: "Uehara", isVariant: true }))!;
    assert.equal(e.ratings?.["Control vL"], 140, "HD451's 6 doesn't win");
    assert.equal(e.ratings?.["Stuff vL"], 150);
  }
});
