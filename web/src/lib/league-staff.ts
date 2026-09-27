/**
 * L.J.'s league pitching staff for /league-card (UI plan §5, Phase 1): each
 * arm scored per role from league play, with a ratings estimate where the
 * sample is thin, the staff that scores best, and what one more arm adds.
 * The measures are lib/league-arms.ts'; this resolves names to cards and
 * scores them.
 *
 * A SCORE per role (edge per 9 innings over the league's arm):
 *   est   = k_arm × the tournament model's runs saved per 9, over the league's
 *           average arm (fit-arm-slope.ts; PT default era, neutral park)
 *   score = (IP·edge9 + 150·est) / (IP + 150)
 * so a big league sample speaks for itself and a small one leans on the
 * ratings instead of on zero. An arm no team has used as a starter is scored
 * as one from its ratings alone. A typed card face moves the league figure by
 * what the typed ratings change: k_arm × (its model − the base card's).
 */
import { envFitMaps } from "@/lib/analytics/env-fit";
import { eraTable } from "@/lib/analytics/tournament-env";
import { formRatings } from "@/lib/card-forms";
import {
  ARM_MODEL_FIT, ARM_PRIOR_IP, armKey, estimateEdge9, ipPerSlot, loadArmRows, poolArmEdges, type ArmEdge, type ArmRole, type StaffArm,
} from "@/lib/league-arms";
import type { LeagueFamily } from "@/lib/analytics/league-model";
import { normName, type HitterUniverse } from "@/lib/league-hitters";

/** A pitcher's card face in the collection export's words, and the shop names they fill. */
export const ARM_FACE_KEYS: Array<[face: string, shop: string]> = [
  ["STU vL", "Stuff vL"], ["STU vR", "Stuff vR"], ["CON vL", "Control vL"], ["CON vR", "Control vR"],
  ["HRA vL", "pHR vL"], ["HRA vR", "pHR vR"], ["PBABIP vL", "pBABIP vL"], ["PBABIP vR", "pBABIP vR"], ["STM", "Stamina"],
];

/** The shop card's values in card-face words, for prefilling the arm form. */
export function armFace(ratings: Record<string, number>): Record<string, number> {
  return Object.fromEntries(ARM_FACE_KEYS.map(([face, shop]) => [face, ratings[shop] ?? 0]));
}

export interface ArmPick {
  entry: string;
  label: string;
  cardId: number;
  /** The league line's key: the variant is its own card. */
  key: string;
  variant: boolean;
  ratings: Record<string, number>;
  /** The shop card's ratings, for what a typed face changes. */
  base: Record<string, number>;
}

/**
 * "Name" or "Name#cardId" to the copy L.J. owns: the variant when he owns it,
 * else the base; a name he doesn't own falls back to the shop card.
 */
export function resolveArms(entries: readonly string[], u: HitterUniverse): { arms: ArmPick[]; warnings: string[] } {
  const arms: ArmPick[] = [], warnings: string[] = [];
  for (const entry of entries) {
    const m = /^(.*?)\s*#(\d+)\s*$/.exec(entry);
    const name = m ? m[1] : entry, pinned = m ? Number(m[2]) : null;
    const mine = u.owned
      .filter((o) => o.cardId != null && (pinned != null ? o.cardId === pinned : normName(o.name ?? "") === normName(name)) && u.shopById.get(o.cardId!)?.isPitcher)
      .sort((a, b) => (b.cardValue ?? 0) - (a.cardValue ?? 0) || Number(b.isVariant) - Number(a.isVariant));
    const card = mine[0] ? u.shopById.get(mine[0].cardId!) : (pinned != null ? u.shopById.get(pinned) : u.shop.filter((s) => s.isPitcher && normName(s.name) === normName(name)).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0]);
    if (!card || !card.isPitcher) { warnings.push(`${name}: no pitcher by that name; left out`); continue; }
    const variant = !!mine[0]?.isVariant;
    const base = (card.ratings ?? {}) as Record<string, number>;
    if (!mine[0]) warnings.push(`${name}: not in the collection uploaded ${u.collectionOn ?? "—"}; using the shop card`);
    arms.push({
      entry, label: `${card.name} ${card.value}${variant ? " VAR" : ""}`, cardId: card.cardId, key: armKey({ cid: card.cardId, name: card.name, isVariant: variant }), variant,
      ratings: variant ? formRatings(base, (mine[0]!.ratings ?? null) as Record<string, number> | null) : base, base,
    });
  }
  return { arms, warnings };
}

export interface ArmScore {
  sp: number | null; rp: number | null;
  /** Where each score comes from: 150+ league innings in that role, or mostly the ratings. */
  spSource: "league" | "estimate"; rpSource: "league" | "estimate";
  spIp: number; rpIp: number;
  stamina: number | null;
}

/** The tournament model's runs saved per 9, per role, for each set of ratings. */
function modelPer9(list: { id: number; ratings: Record<string, number> }[], role: ArmRole): Map<number, number> {
  const fits = envFitMaps(list.map((x) => ({ cardId: x.id, isPitcher: true, bats: null, role, ratings: x.ratings })), { era: eraTable["0"].rates, park: null, roleTrust: 0.25 });
  const out = new Map<number, number>();
  for (const x of list) {
    const r = fits.runsR.get(x.id);
    if (r != null) out.set(x.id, (r * ARM_MODEL_FIT.bfPerIp * 9) / 700);
  }
  return out;
}

/**
 * Score each arm per role. `typed` holds an arm's card face as typed on the
 * form (card-face words), for the modelled card.
 */
export function scoreArms(arms: readonly ArmPick[], edges: Map<string, ArmEdge>, typed: Map<string, Record<string, number>> = new Map()): Map<string, ArmScore> {
  // Three reads per arm: as typed (or owned), as owned, and the base card.
  const rows = arms.flatMap((a, i) => {
    const t = typed.get(a.entry);
    return [
      { id: 3 * i, ratings: t && Object.keys(t).length ? formRatings(a.ratings, t) : a.ratings },
      { id: 3 * i + 1, ratings: a.ratings },
      { id: 3 * i + 2, ratings: a.base },
    ];
  });
  const per = { SP: modelPer9(rows, "SP"), RP: modelPer9(rows, "RP") };
  const out = new Map<string, ArmScore>();
  arms.forEach((a, i) => {
    // A variant no team has pitched reads off its base card's line.
    const own = edges.get(a.key);
    const edge = edgeFor(a, edges);
    const score = (role: ArmRole) => {
      const m = per[role];
      const now = m.get(3 * i), ref = own ? m.get(3 * i + 1) : m.get(3 * i + 2);
      if (now == null) return { score: null, source: "estimate" as const, ip: 0 };
      const est = estimateEdge9(now);
      const side = role === "SP" ? edge?.asSP : edge?.asRP;
      if (!side || ref == null) return { score: est, source: "estimate" as const, ip: 0 };
      // The league line, moved by what these ratings change over the ones it was pitched with.
      const league = side.edge9 + ARM_MODEL_FIT.k * (now - ref);
      return { score: (side.ip * league + ARM_PRIOR_IP * est) / (side.ip + ARM_PRIOR_IP), source: side.ip >= ARM_PRIOR_IP ? ("league" as const) : ("estimate" as const), ip: side.ip };
    };
    const sp = score("SP"), rp = score("RP");
    out.set(a.entry, {
      sp: sp.score, rp: rp.score, spSource: sp.source, rpSource: rp.source, spIp: sp.ip, rpIp: rp.ip,
      stamina: a.ratings.Stamina ?? edge?.stamina ?? null,
    });
  });
  return out;
}

export const toStaffArm = (a: ArmPick, s: ArmScore): StaffArm => ({ entry: a.entry, label: a.label, sp: s.sp, rp: s.rp, stamina: s.stamina });

/* The league lines change once a week: pooled once per split (and slot
   innings once per family), kept for five minutes. A failed read isn't kept. */
const TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; value: Promise<unknown> }>();
function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at <= TTL_MS) return hit.value as Promise<T>;
  const value = load();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => { if (cache.get(key)?.value === value) cache.delete(key); });
  return value;
}

/** Every family's arm lines pooled per card; `split` vL / vR is against left- / right-handed batters. */
export const leagueArmEdges = (split: "all" | "vL" | "vR" = "all") =>
  cached(`edges:${split}`, () => loadArmRows({ family: "all", split }).then(poolArmEdges));

/** Innings a rotation and a bullpen slot pitch in a week of this family. */
export const leagueIpPerSlot = (family: LeagueFamily) => cached(`ip:${family}`, () => ipPerSlot(family));

/** An arm's league edge per 9 against one side, both roles pooled by innings; null with no line. */
export function sideEdge(e: ArmEdge | undefined): { edge9: number; ip: number } | null {
  const parts = [e?.asSP, e?.asRP].filter((x): x is NonNullable<typeof x> => !!x && x.ip > 0);
  const ip = parts.reduce((n, x) => n + x.ip, 0);
  return ip > 0 ? { edge9: parts.reduce((n, x) => n + x.edge9 * x.ip, 0) / ip, ip } : null;
}

/** The league line for a pick: its own, or (a variant no team has pitched) its base card's. */
export function edgeFor(a: Pick<ArmPick, "key" | "cardId" | "variant">, edges: Map<string, ArmEdge>): ArmEdge | undefined {
  return edges.get(a.key) ?? (a.variant ? edges.get(armKey({ cid: a.cardId, name: "", isVariant: false })) : undefined);
}
