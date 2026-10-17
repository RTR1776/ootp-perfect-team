import { test } from "node:test";
import assert from "node:assert/strict";
import { depthChart, type DepthCard } from "./depth-chart";

const bat = (id: number, name: string, pos: Record<string, number>, speed = 50): DepthCard =>
  ({ cardId: id, name, isPitcher: false, ratings: { Speed: speed, ...Object.fromEntries(Object.entries(pos).map(([p, v]) => [`Pos Rating ${p}`, v])) } });

test("utility men come off the bench, a glove sub appears where the bench glove is clearly better, pinch runners by speed", () => {
  const cards = [
    bat(1, "Slugger", { "2B": 70 }), bat(2, "Glove", { "2B": 120, SS: 110 }, 80), bat(3, "Util", { "2B": 90, SS: 90 }, 60),
    bat(4, "Starter SS", { SS: 115 }), bat(5, "Bench OF", { LF: 90 }, 90),
  ];
  const byId = new Map(cards.map((c) => [c.cardId, c]));
  const slots = { "R:2B": 1, "R:SS": 4, BN1: 2, BN2: 3, BN3: 5 };
  const runs: Record<number, number> = { 1: 15, 2: -5, 3: 2, 4: 3, 5: 4 };
  const d = depthChart({
    slots, cards: byId, lineupPos: ["2B", "SS"], hand: "R",
    bat: (id) => runs[id] ?? 0,
    glove: (pos, c) => ((c.ratings[`Pos Rating ${pos}`] ?? 0) - 100) * 0.2,
    floor: () => 60,
  });
  const b2 = d.rows.find((r) => r.pos === "2B")!;
  assert.deepEqual(b2.utility.map((u) => u.name), ["Util", "Glove"], "bat plus glove: Util 2+(-2)=0 beats Glove -5+4=-1");
  assert.equal(b2.defSub?.name, "Glove", "Glove's 2B is 10 runs better than the slugger's");
  const ss = d.rows.find((r) => r.pos === "SS")!;
  assert.equal(ss.defSub, null, "nobody on the bench gloves SS 3+ runs better than the starter");
  assert.deepEqual(d.pinchHit[0], "Bench OF");
  assert.ok(d.pinchRun[0].startsWith("Bench OF"));
});
