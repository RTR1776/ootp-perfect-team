export type Tier = "Iron" | "Bronze" | "Silver" | "Gold" | "Diamond" | "Perfect";

export const TIER_COLORS: Record<Tier, string> = {
  Perfect: "#e879f9",
  Diamond: "#22d3ee",
  Gold: "#fbbf24",
  Silver: "#cbd5e1",
  Bronze: "#c2792e",
  Iron: "#64748b",
};

export const TIER_ORDER: Record<Tier, number> = {
  Perfect: 0,
  Diamond: 1,
  Gold: 2,
  Silver: 3,
  Bronze: 4,
  Iron: 5,
};
