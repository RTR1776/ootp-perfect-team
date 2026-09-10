/**
 * The wire shape of the owned-card pool — no database imports, so a client
 * component can read it without dragging `pg` into the browser bundle.
 */

/** Ratings with a fitted rate curve, in the order they are flattened. */
export const HIT_KEYS = ["Avoid Ks", "Eye", "Power", "Gap", "BABIP"] as const;
export const PIT_KEYS = ["Stuff", "Control", "pHR", "pBABIP"] as const;

/** Overall / vL / vR column names for each. */
export const RATING_SPLITS: Record<string, [string, string]> = {
  "Avoid Ks": ["Avoid K vL", "Avoid K vR"],
  Eye: ["Eye vL", "Eye vR"],
  Power: ["Power vL", "Power vR"],
  Gap: ["Gap vL", "Gap vR"],
  BABIP: ["BABIP vL", "BABIP vR"],
  Stuff: ["Stuff vL", "Stuff vR"],
  Control: ["Control vL", "Control vR"],
  pHR: ["pHR vL", "pHR vR"],
  pBABIP: ["pBABIP vL", "pBABIP vR"],
};

export interface PoolCard {
  id: number;
  name: string;
  pos: string;
  role: string | null;
  isP: boolean;
  bats: string | null;
  value: number;
  year: number | null;
  tier: string;
  active: boolean;
  variant: boolean;
  /** Flattened [all, vL, vR] per rating, in HIT_KEYS / PIT_KEYS order. */
  r: number[];
}

export interface Pool { cards: PoolCard[]; asOf: string | null; count: number }
