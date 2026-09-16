/**
 * Ratings for a card FORM — the base copy or the variant copy you own.
 *
 * The collection export speaks a different vocabulary from the shop list, and
 * the mapping was verified 2026-09-07 on 1,937 owned BASE copies (collection
 * row vs shop row of the same card):
 *   BA vL/vR            == shop BABIP vL/vR            (exact on all 1,937)
 *   POW/GAP/EYE/K       == Power/Gap/Eye/Avoid K       (exact)
 *   STU/CON/HRA/PBABIP  == Stuff/Control/pHR/pBABIP    (exact, 1,582 pitchers)
 *   STM, SPE/STE/RUN, IF/OF defence == their shop names (exact)
 * The export carries NO Contact. Shop Contact is OOTP's composite of BABIP and
 * Avoid K — Contact ≈ 0.570·BABIP + 0.473·AvoidK − 3.6 (R² .974, RMSE 3.4 over
 * 2,296 hitters) — so a variant's Contact is rebuilt as base Contact plus the
 * composite's response to the variant's BABIP and Avoid-K deltas. Variant boosts
 * run 0–16 points, so that is accurate to well under a rating point.
 *
 * Variants are NOT a uniform boost (deltas 0–16, mean ≈ +5 on the hitting
 * splits, ≈ +3 on pitching): always use the exported ratings, never a constant.
 *
 * POSITION RATINGS. The export carries no per-position columns, only DEF — the
 * rating at the listed POS (equal to the shop's `Pos Rating <POS>` on all 1,926
 * owned base copies, 2026-09-16). The IF/OF component columns on a variant row
 * are the BASE card's (identical on all 83 owned hitter variants) even though
 * every one of those variants has a higher DEF, so the components cannot
 * rebuild the variant's defence. What can: variants scale every position by
 * the same factor as the listed one. Variant Nimmala (3B 119→128, ×1.076) is
 * SS 116 in-game; 108 × 1.076 = 116.2. So a variant's other positions are the
 * base ratings scaled by DEF / base-at-POS. Positions the base card does not
 * list stay unrated: the game rates every card at every position (Nimmala's
 * variant shows 1B 105 / 2B 126 / LF 84 / CF 60 / RF 75, none listed on the
 * card) but the dumps only carry the listed ones, and a linear fit from the
 * components underpredicts the unlisted ones by 11–22 points, so nothing is
 * invented for them.
 */
const RATING_KEYS: Record<string, string> = {
  "GAP vL": "Gap vL", "GAP vR": "Gap vR", "POW vL": "Power vL", "POW vR": "Power vR",
  "EYE vL": "Eye vL", "EYE vR": "Eye vR", "K vL": "Avoid K vL", "K vR": "Avoid K vR",
  "BA vL": "BABIP vL", "BA vR": "BABIP vR",
  "STU vL": "Stuff vL", "STU vR": "Stuff vR", "CON vL": "Control vL", "CON vR": "Control vR",
  "PBABIP vL": "pBABIP vL", "PBABIP vR": "pBABIP vR", "HRA vL": "pHR vL", "HRA vR": "pHR vR",
  STM: "Stamina", SPE: "Speed", STE: "Stealing", RUN: "Baserunning",
  "IF RNG": "Infield Range", "IF ERR": "Infield Error", "IF ARM": "Infield Arm", TDP: "DP",
  "OF RNG": "OF Range", "OF ERR": "OF Error", "OF ARM": "OF Arm",
};

/** Shop Contact as a function of BABIP and Avoid K (fit 2026-09-07, R² .974). */
export const CONTACT_COMPOSITE = { babip: 0.5702, avoidK: 0.4733 } as const;

/** Overall (unsplit) shop keys that move with their vL/vR pair. */
const OVERALL_OF_SPLIT: Record<string, string> = {
  Gap: "Gap", Power: "Power", Eye: "Eye", "Avoid K": "Avoid Ks", BABIP: "BABIP", Contact: "Contact",
  Stuff: "Stuff", Control: "Control", pHR: "pHR", pBABIP: "pBABIP",
};

export function formRatings(base: Record<string, number>, exported: Record<string, number> | null, pos?: string | null): Record<string, number> {
  const result = { ...base };
  if (!exported) return result;
  // Positions: scale the base card's listed positions by the variant's boost at
  // its own listed position (see the header note). `pos` is the card's listed
  // position — the same one the export's DEF refers to.
  const def = exported.DEF;
  const at = pos ? base[`Pos Rating ${pos}`] : undefined;
  if (pos && pos !== "DH" && pos !== "P" && Number.isFinite(def) && def! > 0 && at != null && at > 0 && def !== at) {
    const k = def! / at;
    for (const key of Object.keys(base)) {
      if (!key.startsWith("Pos Rating ") || key === "Pos Rating P") continue;
      const v = base[key];
      if (v > 0) result[key] = Math.round(v * k);
    }
    result[`Pos Rating ${pos}`] = def!;
  }
  // In-game numbers entered by hand (position-overrides.ts) beat the estimate.
  for (const [k, v] of Object.entries(exported)) {
    if (k.startsWith("POS ") && Number.isFinite(v)) result[`Pos Rating ${k.slice(4)}`] = v;
  }
  for (const [from, to] of Object.entries(RATING_KEYS)) {
    const n = exported[from];
    if (n != null && Number.isFinite(n)) result[to] = n;
  }
  // Contact: rebuilt from the deltas, not predicted from scratch, so a card
  // whose base Contact sits off the composite line keeps its own offset.
  for (const h of ["vL", "vR"]) {
    const c0 = base[`Contact ${h}`];
    const dB = (result[`BABIP ${h}`] ?? NaN) - (base[`BABIP ${h}`] ?? NaN);
    const dK = (result[`Avoid K ${h}`] ?? NaN) - (base[`Avoid K ${h}`] ?? NaN);
    if (c0 != null && Number.isFinite(dB) && Number.isFinite(dK)) {
      result[`Contact ${h}`] = Math.round(c0 + CONTACT_COMPOSITE.babip * dB + CONTACT_COMPOSITE.avoidK * dK);
    }
  }
  // Overall ratings: the export has none, so carry the mean split delta onto
  // the base overall. Keeps projWoba/projFip("all") coherent with the splits.
  for (const [stem, overall] of Object.entries(OVERALL_OF_SPLIT)) {
    const o = base[overall];
    const dL = (result[`${stem} vL`] ?? NaN) - (base[`${stem} vL`] ?? NaN);
    const dR = (result[`${stem} vR`] ?? NaN) - (base[`${stem} vR`] ?? NaN);
    if (o != null && Number.isFinite(dL) && Number.isFinite(dR)) result[overall] = Math.round(o + (dL + dR) / 2);
  }
  return result;
}

/** Enough exported splits to project this form, rather than a partial overlay. */
export function hasVariantSplitRatings(exported: Record<string, number> | null, isPitcher: boolean): boolean {
  const keys = isPitcher ? ["STU", "CON", "HRA"] : ["GAP", "POW", "EYE", "K", "BA"];
  return keys.every(k => ["vL", "vR"].every(s => Number.isFinite(exported?.[`${k} ${s}`])));
}

/**
 * Should an owned variant be the card's default form for this event? Yes when
 * variants are allowed with no cap: the variant has the same card value as the
 * base (L.J., 2026-09-07) and better ratings, so it is a free upgrade. With a
 * variant cap the user picks which few get the VAR form, so the default stays
 * base.
 */
export function defaultToVariant(rules: { restrictions?: { variantsAllowed?: boolean | null; variantCap?: number | null } | null } | null | undefined): boolean {
  const rx = rules?.restrictions;
  return rx?.variantsAllowed !== false && rx?.variantCap == null;
}
