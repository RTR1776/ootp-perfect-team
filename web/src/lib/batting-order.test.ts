import test from "node:test";
import assert from "node:assert/strict";
import { bestOrder, bookOrder, gameRuns, obp, orderEnv, pitcherLine, shrink, slg, type PaLine } from "./batting-order";
import { probs, solveEnv } from "@/lib/analytics/run-env";
import { eraTable } from "@/lib/analytics/tournament-env";

const era = eraTable["0"].rates;
const env = orderEnv(era);
const avg = probs(era);
/** A batter with his on-base and power scaled from the league line. */
const bat = (ob: number, pw: number): PaLine => {
  const p = { ...avg, BB: avg.BB * ob, B1: avg.B1 * ob, HR: avg.HR * pw, B2: avg.B2 * pw };
  return { ...p, OUT: 1 - p.K - p.BB - p.HR - p.B1 - p.B2 - p.B3 };
};
const perms = (a: number[]): number[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));

test("nine identical batters score the chain's own run expectancy nine times", () => {
  const re = solveEnv(era, eraTable["0"].rg).reStart;
  assert.ok(Math.abs(gameRuns(Array(9).fill(avg), env) - 9 * re) < 1e-6);
});

test("the order matters: a star leading off scores more than the same star batting ninth", () => {
  const star = bat(1.5, 1.5);
  const first = gameRuns([star, ...Array(8).fill(avg)], env);
  const ninth = gameRuns([...Array(8).fill(avg), star], env);
  assert.ok(first > ninth, `${first} vs ${ninth}`);
});

test("the climb finds the best of every order, and never does worse than the usual one", () => {
  const lines = [bat(1.3, 0.6), bat(0.9, 1.6), bat(1.1, 1.1), bat(1.0, 1.4), bat(1.2, 0.8), bat(0.85, 0.7)];
  const r = bestOrder(lines, env);
  let best = -Infinity;
  for (const p of perms([0, 1, 2, 3, 4, 5])) best = Math.max(best, gameRuns(p.map((i) => lines[i]), env));
  assert.ok(Math.abs(r.runs - best) < 1e-9, `${r.runs} vs ${best}`);
  assert.ok(r.runs >= r.bookRuns - 1e-12);
  assert.deepEqual([...r.order].sort(), [0, 1, 2, 3, 4, 5]);
});

test("with no DH the pitcher stays ninth", () => {
  const lines = [...[1.3, 0.9, 1.1, 1.0, 1.2, 0.9, 1.0, 0.8].map((x, i) => bat(x, 2 - x + i * 0.01)), pitcherLine(era)];
  const r = bestOrder(lines, env, [8]);
  assert.equal(r.order[8], 8);
  assert.equal(r.book[8], 8);
});

test("the usual order leads off with the best on-base man of the top three", () => {
  const lines = [bat(0.8, 0.8), bat(1.4, 0.9), bat(1.0, 1.8), bat(1.1, 1.5), bat(0.9, 0.9), bat(0.9, 1.0), bat(0.8, 1.0), bat(0.85, 0.85), bat(0.8, 0.9)];
  const o = bookOrder(lines, env);
  const top3 = [...lines.keys()].sort((a, b) => gameRuns(Array(9).fill(lines[b]), env) - gameRuns(Array(9).fill(lines[a]), env)).slice(0, 3);
  assert.ok(top3.includes(o[0]) && top3.includes(o[1]) && top3.includes(o[3]), "the best three bat 1, 2 and 4");
  assert.equal(o[0], [...top3].sort((a, b) => obp(lines[b]) - obp(lines[a]))[0]);
});

test("shrinking pulls a line to the league's; a pitcher hits like one", () => {
  const b = bat(1.4, 1.6);
  assert.deepEqual(shrink(b, avg, 1), b);
  for (const [k, v] of Object.entries(shrink(b, avg, 0))) assert.ok(Math.abs(v - avg[k as keyof PaLine]) < 1e-12);
  const p = pitcherLine(era);
  assert.ok(obp(p) < 0.22 && slg(p) < 0.25, `${obp(p)} ${slg(p)}`);
});
