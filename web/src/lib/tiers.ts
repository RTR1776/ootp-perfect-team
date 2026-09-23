export type Tier = "Iron" | "Bronze" | "Silver" | "Gold" | "Diamond" | "Perfect";

/** CSS variables (globals.css) so each theme gets a readable shade. */
export const TIER_COLORS: Record<Tier, string> = {
  Perfect: "var(--tier-perfect)",
  Diamond: "var(--tier-diamond)",
  Gold: "var(--tier-gold)",
  Silver: "var(--tier-silver)",
  Bronze: "var(--tier-bronze)",
  Iron: "var(--tier-iron)",
};

export const TIER_ORDER: Record<Tier, number> = {
  Perfect: 0,
  Diamond: 1,
  Gold: 2,
  Silver: 3,
  Bronze: 4,
  Iron: 5,
};

export const isTier = (t: unknown): t is Tier => typeof t === "string" && t in TIER_ORDER;
