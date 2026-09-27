/**
 * L.J.'s league pitching staff for /league-card (UI plan §5, Phase 1): each
 * arm scored per role from league play, with a ratings estimate where the
 * sample is thin, the staff that scores best, and what one more arm adds.
 * The measures are lib/league-arms.ts'; this resolves names to cards and
 * scores them.
 *
 * A SCORE per role (edge per 9 innings over the league's arm), in the
 * team's league family (lib/league-arms blendArm):
 *   est   = k_arm × the tournament model's runs saved per 9, over the league's
 *           average arm (fit-arm-slope.ts; PT default era, neutral park)
 *   the card's play in the other families, shrunk toward est by 150 IP and
 *   scaled to this family (a PEL edge runs about 0.73× the same card's edge
 *   elsewhere), is the prior for its play in this family
 * so a big sample in the team's own league speaks for itself, play elsewhere
 * counts through the family's slope, and the ratings fill in the rest. Every
 * line of the card counts, the base card's and its variant's, each moved by
 * what the ratings scored change over the ones it pitched with: k_arm × (the
 * model's runs for these ratings − for those). So a variant and the same face
 * typed on the form score the same, owned or not.
 */
import { envFitMaps } from "@/lib/analytics/env-fit";
import { eraTable } from "@/lib/analytics/tournament-env";
import { formRatings } from "@/lib/card-forms";
import {
  ARM_MODEL_FIT, armKey, blendArm, estimateEdge9, familyFit, ipPerSlot, loadArmRows, poolArmEdges, variantFace,
  type ArmEdge, type ArmLine, type ArmRole, type StaffArm,
} from "@/lib/league-arms";
import { leagueFamily, type LeagueFamily } from "@/lib/analytics/league-model";
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
  /** The ratings of the variant he owns of this card, if he owns one. */
  varRatings: Record<string, number> | null;
}

/** The ratings of a variant of this card that he owns; null when he owns none. */
export function ownedVariant(cardId: number, u: HitterUniverse): Record<string, number> | null {
  const v = u.owned.filter((o) => o.cardId === cardId && o.isVariant).sort((a, b) => (b.cardValue ?? 0) - (a.cardValue ?? 0))[0];
  const card = u.shopById.get(cardId);
  return v && card ? formRatings((card.ratings ?? {}) as Record<string, number>, (v.ratings ?? null) as Record<string, number> | null) : null;
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
      varRatings: ownedVariant(card.cardId, u),
    });
  }
  return { arms, warnings };
}

export interface ArmScore {
  sp: number | null; rp: number | null;
  /** Where each score mostly comes from: league play, or the ratings estimate (over half its weight). */
  spSource: "league" | "estimate"; rpSource: "league" | "estimate";
  /** League innings in the role behind each score, every family; and those in the team's family. */
  spIp: number; rpIp: number;
  spIpFamily: number; rpIpFamily: number;
  stamina: number | null;
}

/** Each card's league lines in one family, and in the others. */
export interface ArmLines { family: LeagueFamily; fam: Map<string, ArmEdge>; other: Map<string, ArmEdge> }

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
 * Score each arm per role in the team's league family. `typed` holds an
 * arm's card face as typed on the form (card-face words), for the modelled card.
 */
export function scoreArms(arms: readonly ArmPick[], lines: ArmLines, typed: Map<string, Record<string, number>> = new Map()): Map<string, ArmScore> {
  // The typed face, where there is one: it also carries Stamina, which decides who can start.
  const faced = arms.map((a) => {
    const t = typed.get(a.entry);
    return t && Object.keys(t).length ? formRatings(a.ratings, t) : a.ratings;
  });
  const baseKey = (a: ArmPick) => armKey({ cid: a.cardId, name: "", isVariant: false });
  const varKey = (a: ArmPick) => armKey({ cid: a.cardId, name: "", isVariant: true });
  // What the variant pitched with: the copy he owns, else what its newest league line says.
  const varFaces = arms.map((a) => {
    if (a.varRatings) return a.varRatings;
    const r = lines.fam.get(varKey(a))?.ratings ?? lines.other.get(varKey(a))?.ratings;
    return r ? variantFace(a.base, r) : null;
  });
  // Three reads per arm: as scored, the base card, and its variant.
  const rows = arms.flatMap((a, i) => [
    { id: 3 * i, ratings: faced[i] },
    { id: 3 * i + 1, ratings: a.base },
    ...(varFaces[i] ? [{ id: 3 * i + 2, ratings: varFaces[i]! }] : []),
  ]);
  const per = { SP: modelPer9(rows, "SP"), RP: modelPer9(rows, "RP") };
  const fit = familyFit(lines.family);
  const out = new Map<string, ArmScore>();
  arms.forEach((a, i) => {
    const score = (role: ArmRole) => {
      const m = per[role], now = m.get(3 * i);
      if (now == null) return { score: null, source: "estimate" as const, ip: 0, ipFamily: 0 };
      const side = (e: ArmEdge | undefined) => (role === "SP" ? e?.asSP : e?.asRP) ?? null;
      const versions = [{ key: baseKey(a), ref: m.get(3 * i + 1) }, ...(varFaces[i] ? [{ key: varKey(a), ref: m.get(3 * i + 2) }] : [])];
      const own: ArmLine[] = versions
        .filter((v): v is { key: string; ref: number } => v.ref != null)
        .map((v) => ({ fam: side(lines.fam.get(v.key)), other: side(lines.other.get(v.key)), shift: ARM_MODEL_FIT.k * (now - v.ref) }));
      const b = blendArm(own, estimateEdge9(now), fit);
      return { score: b.score, source: b.estShare > 0.5 ? ("estimate" as const) : ("league" as const), ip: b.ipFam + b.ipOther, ipFamily: b.ipFam };
    };
    const sp = score("SP"), rp = score("RP");
    const line = lines.fam.get(a.key) ?? lines.other.get(a.key);
    out.set(a.entry, {
      sp: sp.score, rp: rp.score, spSource: sp.source, rpSource: rp.source, spIp: sp.ip, rpIp: rp.ip, spIpFamily: sp.ipFamily, rpIpFamily: rp.ipFamily,
      stamina: faced[i].Stamina ?? line?.stamina ?? null,
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

/** Every family's pitcher lines of one split, read once. */
const armRows = (split: "all" | "vL" | "vR") => cached(`rows:${split}`, () => loadArmRows({ family: "all", split }));

/** Every family's arm lines pooled per card; `split` vL / vR is against left- / right-handed batters. */
export const leagueArmEdges = (split: "all" | "vL" | "vR" = "all") =>
  cached(`edges:${split}`, () => armRows(split).then(poolArmEdges));

/** Each card's lines in one league family and in the others, for scoring a team of that family. */
export const leagueArmLines = (family: LeagueFamily) => cached(`lines:${family}`, async (): Promise<ArmLines> => {
  const rows = await armRows("all");
  return {
    family,
    fam: poolArmEdges(rows.filter((r) => leagueFamily(r.league) === family)),
    other: poolArmEdges(rows.filter((r) => leagueFamily(r.league) !== family)),
  };
});

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
