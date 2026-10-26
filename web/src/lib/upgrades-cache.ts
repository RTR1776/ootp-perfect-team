/**
 * The Upgrades page's reads (lib/upgrades-load), cached like Card Fit's: one
 * entry per group and data version (card-fit-load fitVersion: a new import,
 * collection, shop list, rule change or saved roster makes a new one).
 * Server only.
 */
import { unstable_cache } from "next/cache";
import { fitVersion } from "@/lib/card-fit-load";
import { loadUpgrades, resolveGroup, upgradeGroups, type UpgradesData } from "@/lib/upgrades-load";

/** Bump when the scan's numbers change, so cached results from the old code aren't served. */
const UPGRADES_CODE = "upgrades-v1";

export async function upgrades(groupKey: string | null | undefined): Promise<UpgradesData | null> {
  const version = await fitVersion();
  const groups = await unstable_cache(upgradeGroups, [UPGRADES_CODE, "groups", ...version], { revalidate: 86_400, tags: ["card-fit"] })();
  const group = await resolveGroup(groupKey, groups);
  if (!group) return null;
  return unstable_cache(() => loadUpgrades(group, groups), [UPGRADES_CODE, group.key, ...version], { revalidate: 86_400, tags: ["card-fit"] })();
}
