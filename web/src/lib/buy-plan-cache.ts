/**
 * Buy Plan's read (lib/buy-plan-load), cached like Upgrades': one entry per
 * data version (card-fit-load fitVersion: a new import, collection, shop
 * list, rule change or saved roster) and newest logged result, since his
 * entries a week weight every gain. Server only.
 */
import { unstable_cache } from "next/cache";
import { fitVersion } from "@/lib/card-fit-load";
import { loadBuyPlan, newestResult, type BuyPlanData } from "@/lib/buy-plan-load";

/** Bump when the plan's numbers change, so cached results from the old code aren't served. */
const BUY_PLAN_CODE = "buy-plan-v3"; // v3 2026-11-14: Card Fit places a two-way card in both roles at once

export async function buyPlan(): Promise<BuyPlanData> {
  const [version, result] = await Promise.all([fitVersion(), newestResult()]);
  return unstable_cache(loadBuyPlan, [BUY_PLAN_CODE, result, ...version], { revalidate: 86_400, tags: ["card-fit"] })();
}
