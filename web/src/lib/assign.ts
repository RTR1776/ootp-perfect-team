/**
 * Maximum-weight assignment — the Hungarian method.
 *
 * Given the hitters on a roster, which of them should play which position on
 * one board is an assignment problem, and it has an exact answer. The
 * optimiser's swap moves only ever change one or two slots at a time, so a
 * board that needs a three-way reshuffle (Gibson in from the bench at 1B, the
 * 1B over to third, the third baseman to short) was a local optimum it could
 * not leave. Solving the assignment outright removes that whole class of trap.
 *
 * `weights[row][col]`: rows are slots, cols are candidates; -Infinity (or any
 * non-finite value) marks a pairing that is not allowed. Rows must not
 * outnumber cols. Returns the column chosen for each row, or null when no
 * complete assignment uses only allowed pairings. O(rows² · cols) — a board is
 * 9 × 13, a few thousand operations.
 */
export function maxAssignment(weights: readonly (readonly number[])[]): number[] | null {
  const n = weights.length;
  if (n === 0) return [];
  const m = weights[0].length;
  if (n > m) return null;

  // Min-cost on negated weights; forbidden pairings cost BIG so they are only
  // chosen when nothing else completes the assignment (and then we say null).
  const BIG = 1e12;
  const cost = (i: number, j: number) => {
    const w = weights[i][j];
    return Number.isFinite(w) ? -w : BIG;
  };

  // 1-indexed potentials u (rows) and v (cols); p[j] = row matched to col j.
  const u = new Float64Array(n + 1);
  const v = new Float64Array(m + 1);
  const p = new Int32Array(m + 1);
  const way = new Int32Array(m + 1);
  const minv = new Float64Array(m + 1);
  const used = new Uint8Array(m + 1);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    minv.fill(Infinity);
    used.fill(0);
    do {
      used[j0] = 1;
      const i0 = p[j0];
      let delta = Infinity, j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost(i0 - 1, j - 1) - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0 !== 0);
  }

  const out = new Array<number>(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j] !== 0) out[p[j] - 1] = j - 1;
  for (let i = 0; i < n; i++) if (out[i] < 0 || !Number.isFinite(weights[i][out[i]])) return null;
  return out;
}
