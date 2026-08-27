/**
 * Apply projection-coeffs.json (fit by scripts/fit-projection.ts) to a
 * card's ratings. Overall uses base ratings; vL/vR swap in the split
 * ratings where the card has them (base as fallback), so a platoon bat
 * shows a real split even though the fit itself is on overall lines.
 *
 * Model v0 is a global fit — no park/era terms. Clamps keep out-of-sample
 * cards (extreme ratings the observed pool never covered) on a stat scale.
 */

import coeffs from "./projection-coeffs.json";

interface Model {
  intercept: number;
  features: string[];
  coef: number[];
  n: number;
  r2: number;
}

const SPLIT_KEY: Record<string, { vL: string; vR: string }> = {
  Contact: { vL: "Contact vL", vR: "Contact vR" },
  Gap: { vL: "Gap vL", vR: "Gap vR" },
  Power: { vL: "Power vL", vR: "Power vR" },
  Eye: { vL: "Eye vL", vR: "Eye vR" },
  "Avoid Ks": { vL: "Avoid K vL", vR: "Avoid K vR" },
  BABIP: { vL: "BABIP vL", vR: "BABIP vR" },
  Stuff: { vL: "Stuff vL", vR: "Stuff vR" },
  Movement: { vL: "Movement vL", vR: "Movement vR" },
  Control: { vL: "Control vL", vR: "Control vR" },
  pHR: { vL: "pHR vL", vR: "pHR vR" },
  pBABIP: { vL: "pBABIP vL", vR: "pBABIP vR" },
};

export type Split = "all" | "vL" | "vR";

function apply(model: Model, r: Record<string, number>, split: Split, lo: number, hi: number): number | null {
  if (!model || model.n === 0) return null;
  let v = model.intercept;
  for (let i = 0; i < model.features.length; i++) {
    const base = model.features[i];
    const key = split === "all" ? base : SPLIT_KEY[base]?.[split] ?? base;
    const x = r[key] ?? r[base];
    if (x == null) return null;
    v += model.coef[i] * x;
  }
  return Math.min(hi, Math.max(lo, v));
}

export function projWoba(r: Record<string, number>, split: Split = "all"): number | null {
  return apply(coeffs.hit as Model, r, split, 0.18, 0.52);
}

export function projFip(r: Record<string, number>, split: Split = "all"): number | null {
  return apply(coeffs.pit as Model, r, split, 1.2, 9.5);
}

export const projectionMeta = {
  fittedAt: (coeffs as unknown as { fittedAt?: string | null }).fittedAt ?? null,
  hitN: (coeffs.hit as Model)?.n ?? 0,
  hitR2: (coeffs.hit as Model)?.r2 ?? 0,
  pitN: (coeffs.pit as Model)?.n ?? 0,
  pitR2: (coeffs.pit as Model)?.r2 ?? 0,
};
