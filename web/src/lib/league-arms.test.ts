import { test } from "node:test";
import assert from "node:assert/strict";
import { addArm, armKey, ipPerSlotFrom, poolArmEdges, roleOf, staffSolve, type ArmRow, type StaffArm } from "./league-arms";

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
