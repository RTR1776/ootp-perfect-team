"use client";

/**
 * The tournament roster builder. Pure client interactivity over data the
 * /build server page resolves: pick a slot, click or drag a card, fill a
 * roster.
 *
 * Projections are the calibrated curve model read in THIS event's era and
 * park (lib/analytics/projections.ts); Fit stays as the 0–99 percentile composite
 * within this tournament's legal pool. Observed numbers are THIS
 * tournament series only — career lines mix parks, eras and rule sets, so
 * they are deliberately absent here.
 *
 * Roster shape is sized per tournament from the community dumps
 * (series_meta avg hitters / SP / RP), so a 13-bat event gets four bench
 * slots and a 15-bat event gets six. Hitters may hold one slot in the
 * vs-RHP group (lineup + bench) and one in the vs-LHP lineup; pitchers one
 * staff slot.
 */

import type { SeriesBuild } from "@/lib/field-construction";
import { FieldConstruction } from "@/components/field-construction";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Info, Loader2, Redo2, Undo2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cardArtUrl } from "@/lib/card-art";
import { cn } from "@/lib/utils";
import { CARD_TYPE_NAME, CARD_TYPE_SHORT, confirmedNotes, describeRules, parseCardTypeRule, rosterSize, validateRoster, type RosterRules, type RosterSlot, type RuleIssue } from "@/lib/roster-rules";
import { isPageCheck } from "@/lib/roster-input";
import type { SetEvidence } from "@/lib/set-evidence";
import { RulesStrip } from "@/components/rules-strip";
import { SetFilter } from "@/components/set-filter";
import { dismissToast, toast, type ToastInput } from "@/components/ui/toast";
import { fillRoster, fitMaps, HIT_POS, rosterShape, type FillCard, type FillResult, type FillShape } from "@/lib/roster-fill";
import { LJ_FLOOR } from "@/lib/pos-floor";
import { batsLeftOn, envFitMaps } from "@/lib/analytics/env-fit";
import { hitterRates } from "@/lib/analytics/card-value";
import { calibrationSlope } from "@/lib/analytics/calibration";
import { bestOrder, obp, orderEnv, paLine, pitcherLine, shrink, slg } from "@/lib/batting-order";
import type { Confidence } from "@/lib/data-confidence";
import type { EraRates } from "@/lib/analytics/run-env";
import type { ParkRow } from "@/lib/analytics/tournament-env";
import { defaultToVariant, formRatings, hasVariantSplitRatings } from "@/lib/card-forms";
import { EMPTY_PROJ, projectCard, projectionEnvs, projOf, type Proj } from "@/lib/analytics/projections";
import { rosterObjective, LHP_SHARE_DEFAULT } from "@/lib/roster-objective";
import { searchCard, toPlainFits, type SearchBest, type SearchMessage, type SearchRequest } from "@/lib/roster-search";
import { fieldingRuns, gloveScale } from "@/lib/analytics/fielding";
import { date, ip, signed, stamp } from "@/lib/format";
import {
  EMPTY_BOARD, NO_ADJ, benchKeysOf, boardContent, boardDiff, boardKey, boardReducer, clampCount, diffText, droppedNote,
  parseSaved, restoreBoard, rpKeysOf, runsText, slotKeys, spKeysOf, toSaved,
  type BoardAction, type BoardDiff, type Counts, type Slots,
} from "@/lib/build-board";
import { useUndoable, useUndoKeys } from "@/lib/use-undoable";
import { FieldView } from "@/components/build/field-view";
import { BuyBox } from "@/components/build/buy-box";
import { CardList } from "@/components/build/card-list";
import { ShopBoard } from "@/components/build/shop-board";
import { SearchProgressBar, setSearchProgress } from "@/components/build/search-progress";

export interface ObservedLine {
  cardId: number;
  pa: number;
  ip: number;
  woba: number | null;
  fip: number | null;
  war: number;
  instances: number;
}

export type { Proj };

interface OrderRow { cardId: number | null; name: string; pos: string; obp: number; slg: number }
/** A lineup's recommended batting order and the usual one, each with its runs per nine innings. */
interface BattingOrder { rows: OrderRow[]; book: OrderRow[]; runs: number; bookRuns: number }

export interface BuilderCard {
  cardId: number;
  name: string;
  tier: string | null;
  val: number | null;
  pos: string;
  role: string | null;
  isPitcher: boolean;
  bats: string | null;
  year: number | null;
  active: boolean;
  variant: boolean;
  baseOwned: boolean;
  variantOwned: boolean;
  /** The player (bref id): one card per player on a roster. */
  player?: string | null;
  cardType: number | null;
  /** A Limited Edition card; a "No LE" event's rules read it. */
  le?: boolean;
  variantRatings: Record<string, number> | null;
  ratings: Record<string, number>;
  proj: Proj;
  obs: ObservedLine | null;
}

/**
 * What the page resolved about the event, so the client can score the pool
 * the way env-roster does. `observed` is [cardId, runs on the model's scale,
 * PA-or-BF, the base card's model runs] per card with tournament play on
 * record. The last one lets an owned variant keep its boost (env-fit).
 */
export interface BuilderEnv {
  rates: EraRates;
  park: ParkRow | null;
  /** How the field is handed, off its exports (series_meta) or the defaults. */
  lhpShare: number;
  lhbShare: number;
  /** Run-environment year, for the era correction (calibration.ts ERA_SLOPES). */
  eraYear?: number | null;
  observed: Array<[number, number, number, (number | null)?]>;
}

export interface UpgradeCard {
  cardId: number;
  name: string;
  tier: string | null;
  val: number | null;
  pos: string;
  isPitcher: boolean;
  year: number | null;
  bats: string | null;
  ratings: Record<string, number>;
  proj: Proj;
  /** Calibrated model runs per 700 in this event (no observed play — the card is not owned). */
  runs: number;
  /** The same, split by the hand of the opposing pitcher (hitters) — the shop board prices each board. */
  runsR: number | null;
  runsL: number | null;
  /** First seen in a shop upload within the last week. */
  isNew: boolean;
  clubhouse: boolean;
  last10: number | null;
  ask: number | null;
  /** The variant of a card you already own (ratings estimated; priced at the variant's last-10). */
  variant?: boolean;
  /** Card set (cards.card_type), so the Sets filter reaches the shop too. */
  cardType: number | null;
}

export interface CatalogGroup {
  label: string;
  items: { id: number; label: string; hasSeries: boolean; simRuns: number }[];
}

export interface SeriesMetaInfo {
  /** How the field spends its tiers, off the same exports (field-construction.ts). */
  construction?: SeriesBuild | null;
  files: number;
  avgTeams: number | null;
  avgSp: number | null;
  avgRp: number | null;
  avgBats: number | null;
  lhpBfShare: number | null;
  lhbPaShare: number | null;
  topCards: {
    cardId: number; name: string; pos: string; isPitcher: boolean;
    teams: number; pct: number; pa: number; ip: number;
  }[];
}

export interface TournamentInfo extends RosterRules {
  id: number;
  name: string;
  envYear: number | null;
  mode: string | null;
  stadium: string | null;
  dh: boolean | null;
  entrants: number | null;
  ratingsMin: number | null;
  ratingsMax: number | null;
  cardYearMin: number | null;
  cardYearMax: number | null;
  series: string | null;
  /** Set when this series' exports predate the event's current format (restrictions.formatSince) and were left out. */
  staleSeriesSince?: string | null;
  isDraft: boolean;
  /** Slots, roster cap, variant cap, card types - anything the value/year
   *  windows cannot express. */
  restrictions: {
    slots?: Record<string, number>;
    teamCap?: number;
    variantCap?: number;
    variantsAllowed?: boolean;
    cardTypes?: string[];
    teams?: number;
    /** YYYY-MM-DD the current era/park/rules took effect; this series' older exports are ignored. */
    formatSince?: string;
    /** Set when the value window was read off the event NAME rather than
     *  stated in the rules text or the databotai crawl. */
    valueWindowFrom?: string;
    cards?: number;
    /** The rules text as last captured from the game. */
    refreshText?: string;
    /** Provenance lines; L.J.'s confirmations among them (roster-rules confirmedNotes). */
    notes?: string[];
  } | null;
  retired: boolean;
  park: { name: string; avg: number | null; hr: number | null; b2: number | null; b3: number | null } | null;
  environment?: {
    eraLabel: string;
    parkLabel: string;
    parkFactors: { avgL: number; avgR: number; hrL: number; hrR: number } | null;
    runsPerGame: number | null;
  };
}

interface SavedRoster {
  id: number;
  name: string;
  slots: RosterSlot[];
  /** Saved against an older collection: its day, and the cards owned since that this event takes (lib/saved-roster-freshness). */
  builtOn?: string | null;
  newCards?: { cardId: number; variant: boolean }[];
}

type SlotKey = string; // "R:C", "L:DH", "SP1", "RP3", "CL", "BN2"
type View = "HIT" | "PIT" | "UPG" | "FIELD";
const FIELD_SPOTS = new Set(["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"]);

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const slotLabel = (k: SlotKey) => k.replace("R:", "vs RHP ").replace("L:", "vs LHP ");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/* The board shown while the history still holds the last event's (the render
   between an event switch and its restore): nothing, never the old board. */
const NO_SLOTS: Slots = {};
const NO_FORMS: Record<number, boolean> = {};
const NO_SETS: number[] = [];

/** How a search ended: finished, stopped (keep the best so far), cancelled by an event switch, or failed. */
interface SearchOutcome { best: SearchBest | null; ran: number; total: number; cut: boolean; how: "done" | "stopped" | "cancelled" | "failed" }

/** A bulk change's toast, written once the change has rendered (its runs need the new board's scores). */
interface Notice {
  tid: number;
  before: Slots;
  beforeRuns: number | null;
  say: (c: { diff: BoardDiff; after: Slots; runs: string; inOut: string }) => string;
  tone?: ToastInput["tone"];
  detail?: string;
}

/* Fit composite + percentile scoring live in src/lib/roster-fill.ts. */
function bestDefPos(r: Record<string, number>): { pos: string; val: number } {
  let pos = "—", val = 0;
  for (const p of HIT_POS) { const v = r[`Pos Rating ${p}`] ?? 0; if (v > val) { val = v; pos = p; } }
  return { pos, val };
}

const fmt3 = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(3).replace(/^0/, ""));
const fmt2 = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(2));
const fmtPts = (v: number | null | undefined) => (v == null || v === 0 ? "—" : v.toLocaleString());
const fr = (v: number | null | undefined) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}`);

/* ------------------------------------------------------------------ */
/* card metric bars — the in-game card face, split vL / vR             */
/* ------------------------------------------------------------------ */

/**
 * Bars are drawn against `scale` — the 99.9th percentile of every rating in
 * the card table, computed server-side (src/lib/rating-scale.ts) so the
 * ceiling climbs with each new card set instead of pegging. Anything above
 * it fills the track and still prints its number.
 */
interface MetricSpec { label: string; key: string; alt?: [string, string] }

const HIT_METRICS: MetricSpec[] = [
  { label: "AVK", key: "Avoid Ks", alt: ["Avoid K vL", "Avoid K vR"] },
  { label: "BABIP", key: "BABIP", alt: ["BABIP vL", "BABIP vR"] },
  { label: "GAP", key: "Gap", alt: ["Gap vL", "Gap vR"] },
  { label: "POW", key: "Power", alt: ["Power vL", "Power vR"] },
  { label: "EYE", key: "Eye", alt: ["Eye vL", "Eye vR"] },
];

const PIT_METRICS: MetricSpec[] = [
  { label: "STU", key: "Stuff", alt: ["Stuff vL", "Stuff vR"] },
  { label: "MOV", key: "Movement", alt: ["Movement vL", "Movement vR"] },
  { label: "CON", key: "Control", alt: ["Control vL", "Control vR"] },
  { label: "HRA", key: "pHR", alt: ["pHR vL", "pHR vR"] },
  { label: "BABIP", key: "pBABIP", alt: ["pBABIP vL", "pBABIP vR"] },
];

/** The overall rating, falling back to the split average when it is absent. */
function overall(r: Record<string, number>, m: MetricSpec): number | null {
  const v = r[m.key];
  if (v != null) return v;
  if (!m.alt) return null;
  const [l, rr] = [r[m.alt[0]], r[m.alt[1]]];
  if (l != null && rr != null) return (l + rr) / 2;
  return l ?? rr ?? null;
}

/**
 * OOTP's own rating colours — red at the bottom through orange, gold, green
 * and teal to blue and purple at the top. Thresholds are absolute (fitted to
 * the in-game card: 59 orange, 69 gold, 81 green, 92 teal, 130-150 blue, 190
 * purple) because the game grades the raw rating, not the card's rank; ~50 is
 * league average, so an average card sits in orange exactly as it does in PT.
 * Unlike the bar length, these do NOT move with the ceiling.
 */
const RATING_BANDS: { min: number; bar: string; text: string }[] = [
  { min: 175, bar: "bg-purple-500", text: "text-purple-500" },
  { min: 110, bar: "bg-blue-500", text: "text-blue-500" },
  { min: 90, bar: "bg-teal-500", text: "text-teal-500" },
  { min: 80, bar: "bg-green-500", text: "text-green-500" },
  { min: 65, bar: "bg-amber-400", text: "text-amber-600 dark:text-amber-400" },
  { min: 50, bar: "bg-orange-500", text: "text-orange-500" },
  { min: -Infinity, bar: "bg-red-500", text: "text-red-500" },
];

const bandOf = (v: number) => RATING_BANDS.find((b) => v >= b.min)!;

/**
 * One rating: the label, the number in its band colour, and a bar of the same
 * colour. Bar length runs against `scale` (see src/lib/rating-scale.ts) and
 * pegs at full for the handful of ratings above it — the number still reads
 * true.
 */
function MetricRow({ label, v, scale }: { label: string; v: number | null; scale: number }) {
  if (v == null) return null;
  const band = bandOf(v);
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-[38px] shrink-0 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn("w-[26px] shrink-0 text-right font-mono text-[10px] font-semibold [font-variant-numeric:tabular-nums]", band.text)}>
        {Math.round(v)}
      </span>
      <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", band.bar)} style={{ width: `${clamp((v / scale) * 100, 3, 100)}%` }} />
      </div>
    </div>
  );
}

function MetricBars({ r, isPitcher, scale }: { r: Record<string, number>; isPitcher: boolean; scale: number }) {
  const specs = isPitcher ? PIT_METRICS : HIT_METRICS;
  const def = bestDefPos(r);
  return (
    <div className="mt-2 flex flex-col gap-[4px]">
      {specs.map((m) => (
        <MetricRow key={m.label} label={m.label} v={overall(r, m)} scale={scale} />
      ))}
      {isPitcher
        ? <MetricRow label="STM" v={r["Stamina"] ?? null} scale={scale} />
        : def.val > 0 && <MetricRow label={`DEF ${def.pos}`} v={def.val} scale={scale} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* hover card preview — art loads only while hovered, never up front   */
/* ------------------------------------------------------------------ */

interface Peek {
  cardId: number;
  title: string;
  sub: string;
  isPitcher: boolean;
  ratings: Record<string, number> | null;
  stat: string;
  extra: string | null;
  top: number;
  left: number;
}

function peekFrom(
  el: HTMLElement,
  base: Omit<Peek, "top" | "left">,
): Peek {
  const r = el.getBoundingClientRect();
  const H = base.ratings ? 235 : 150;
  const W = 400;
  const top = Math.max(8, Math.min(r.top - 40, window.innerHeight - H - 8));
  const left = r.right + 10 + W > window.innerWidth ? Math.max(8, r.left - W - 10) : r.right + 10;
  return { ...base, top, left };
}

function CardPeek({ p, scale }: { p: Peek; scale: number }) {
  const [artOk, setArtOk] = useState(true);
  useEffect(() => setArtOk(true), [p.cardId]);
  return (
    <div
      className="pointer-events-none fixed z-50 flex w-[390px] gap-3 rounded-lg border border-border bg-background p-3 shadow-xl"
      style={{ top: p.top, left: p.left }}
    >
      {artOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cardArtUrl(p.cardId)}
          alt=""
          width={132}
          height={198}
          loading="lazy"
          onError={() => setArtOk(false)}
          className="h-[198px] w-[132px] shrink-0 self-start rounded object-cover"
        />
      )}
      <div className="min-w-0 flex-1 text-xs leading-relaxed">
        <div className="font-sans text-sm font-semibold leading-tight">{p.title}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{p.sub}</div>
        {p.ratings && <MetricBars r={p.ratings} isPitcher={p.isPitcher} scale={scale} />}
        <div className="mt-2 font-mono text-[11px] [font-variant-numeric:tabular-nums]">{p.stat}</div>
        {p.extra && <div className="mt-0.5 font-mono text-[11px] text-muted-foreground [font-variant-numeric:tabular-nums]">{p.extra}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function RosterBuilder({
  groups,
  tournament,
  pool: basePool,
  env,
  upgrades,
  meta,
  confidence = null,
  savedRosters,
  ratingScale,
  collectionDate,
  collectionAgeDays,
  setEvidence = null,
}: {
  groups: CatalogGroup[];
  tournament: TournamentInfo | null;
  pool: BuilderCard[];
  env: BuilderEnv | null;
  upgrades: UpgradeCard[];
  meta: SeriesMetaInfo | null;
  /** How much data stands behind this build (lib/data-confidence). */
  confidence?: Confidence | null;
  savedRosters: SavedRoster[];
  /** Full-bar rating value; see src/lib/rating-scale.ts. */
  ratingScale: number;
  collectionDate: string | null;
  /** Days since that snapshot, computed on the server so render stays pure. */
  collectionAgeDays: number | null;
  /** Which card sets and years this event's field has played (lib/set-evidence). */
  setEvidence?: SetEvidence | null;
}) {
  const router = useRouter();
  const collectionStale = collectionAgeDays != null && collectionAgeDays >= 3;
  /* The board — slots, copies, bench/SP/RP counts, card sets — is one value
     under one undo history (UI plan B3): every change is a labelled step,
     Undo/Redo and Cmd/Ctrl+Z take it back, and it is kept per event in this
     browser (build:board:<tid>) so a reload or a switch back restores it. It
     belongs to one event: until the switch to another has restored that
     one's board, the page shows an empty board, never the last event's. */
  const {
    state: board, dispatch, undo: undoStep, redo: redoStep, reset: resetBoard, canUndo, canRedo, undoLabel, redoLabel,
  } = useUndoable(boardReducer, EMPTY_BOARD);
  const tid = tournament?.id ?? null;
  const own = board.tid != null && board.tid === tid;
  const slots = own ? board.slots : NO_SLOTS;
  const forms = own ? board.forms : NO_FORMS;
  /* Lock / ban, per tournament: Optimise must carry every locked card and may
     not use a banned one (L.J.'s calls the model cannot make — "always two
     catchers", "Incaviglia belongs", "not Bunny Hearn"). */
  const [locks, setLocks] = useState<Set<number>>(() => new Set());
  const [bans, setBans] = useState<Set<number>>(() => new Set());
  /* Remembered per tournament in this browser, so a reload keeps them. */
  const lockKey = (tid: number) => `build:locks:${tid}`;
  const readLocks = (tid: number): { locks: number[]; bans: number[]; sets?: number[] } => {
    try { return JSON.parse(localStorage.getItem(lockKey(tid)) ?? "") ?? { locks: [], bans: [] }; } catch { return { locks: [], bans: [] }; }
  };
  /* L.J. always carries two catchers; Optimise honours it unless unticked. */
  const [twoCatchers, setTwoCatchers] = useState(true);
  const [twoShortstops, setTwoShortstops] = useState(true);
  const [twoLong, setTwoLong] = useState(true);
  const toggleIn = (set: Set<number>, id: number) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); return n; };
  const toggleLock = (id: number) => { setLocks((s) => toggleIn(s, id)); setBans((s) => { const n = new Set(s); n.delete(id); return n; }); };
  const toggleBan = (id: number) => { setBans((s) => toggleIn(s, id)); setLocks((s) => { const n = new Set(s); n.delete(id); return n; }); };
  /* Each card is shown in ONE form: whichever the user toggled, else the
     variant copy when it is the only one owned or when the event allows
     variants without a cap (same card value, better ratings — a free upgrade),
     else base. Variant ratings are the ones the collection export recorded
     for that copy (see card-forms.ts) — projections come from the same model
     as the base card, on the form's own ratings. A form is only used when
     that copy is owned: a saved roster or toggle naming the other copy falls
     back to the one in the collection (roster #23 stored the base Lennie
     Pearson, owned only as a variant, and failed its checks with no way to
     flip it — the toggle is disabled when the base is not owned). */
  const preferVariant = defaultToVariant(tournament);
  const lhpShare = env?.lhpShare ?? LHP_SHARE_DEFAULT;
  /* Gloves are worth more where more balls are put in play (fielding.ts gloveScale). */
  const glove = env ? gloveScale(env.rates) : 1;
  const envs = useMemo(() => (env ? projectionEnvs(env.rates, env.park, env.lhbShare) : null), [env]);
  const formPool = useMemo(() => basePool.map(c => {
    const verifiedVar = c.variantOwned && hasVariantSplitRatings(c.variantRatings, c.isPitcher);
    const want = forms[c.cardId] ?? (!c.baseOwned || (preferVariant && verifiedVar));
    const variant = want ? c.variantOwned || !c.baseOwned : !c.baseOwned && c.variantOwned;
    if (!variant) return { ...c, variant: false };
    const ratings = formRatings(c.ratings, c.variantRatings, c.pos);
    const verified = hasVariantSplitRatings(c.variantRatings, c.isPitcher);
    const proj = verified && envs
      ? projOf(projectCard({ isPitcher: c.isPitcher, bats: c.bats, ratings }, envs, lhpShare))
      : EMPTY_PROJ;
    return { ...c, variant: true, ratings, proj };
  }), [basePool, forms, preferVariant, envs, lhpShare]);

  /* Card sets. The event's set rule is enforced on the server (the pool only
     holds legal cards); the Sets chips narrow it further, and are how an event
     with no rule on file is kept to the sets the game allows. Everything that
     picks cards (the table, fills, Optimise, the Field view, the shop) reads
     `pool`; scoring and lookups read `formPool`, so a board card outside the
     chips is still scored, and flagged. Remembered per event with the locks,
     and part of the board's history: a change of sets refills the board, and
     one Undo takes back both. */
  const ruleTypes = useMemo(() => {
    const t = tournament?.restrictions?.cardTypes?.filter((x) => x.trim());
    if (!t?.length) return null;
    const parsed = t.map(parseCardTypeRule);
    return parsed.some((x) => x == null) ? null : [...new Set(parsed.flat() as number[])].sort((a, b) => a - b);
  }, [tournament]);
  const sets = own ? board.sets : NO_SETS;
  const restoreSets = (saved: number[] | undefined): number[] => {
    const kept = (saved ?? []).filter((t) => !ruleTypes || ruleTypes.includes(t));
    return kept.length ? kept : ruleTypes ?? [];
  };
  const inSets = (list: number[], t: number | null) => list.length === 0 || (t != null && list.includes(t));
  const pool = useMemo(() => (sets.length ? formPool.filter((c) => inSets(sets, c.cardType)) : formPool), [formPool, sets]);
  const setCounts = useMemo(() => {
    const n: Record<number, number> = {};
    for (const c of formPool) if (c.cardType != null) n[c.cardType] = (n[c.cardType] ?? 0) + 1;
    return n;
  }, [formPool]);
  const shopUpgrades = useMemo(() => (sets.length ? upgrades.filter((u) => inSets(sets, u.cardType)) : upgrades), [upgrades, sets]);
  const [selected, setSelected] = useState<SlotKey | null>(null);
  const [view, setView] = useState<View>("HIT");
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("proj");
  const [rosterName, setRosterName] = useState("");
  const [saving, setSaving] = useState(false);
  const [peek, setPeek] = useState<Peek | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const [dragPayload, setDragPayload] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<SlotKey | null>(null);
  const lastTid = useRef<number | null>(null);
  const lastName = useRef<string | null>(null);

  const dh = tournament?.dh ?? true;
  const lineupPos: string[] = useMemo(() => (dh ? [...HIT_POS, "DH"] : [...HIT_POS]), [dh]);

  /* roster shape — what teams actually roster in this series when we have
     exports, else the era's typical staff (eraStaff), hitters taking the rest */
  const target = useMemo(
    () => rosterShape(tournament?.envYear, lineupPos.length, tournament ? rosterSize(tournament) : 26, meta),
    [meta, lineupPos.length, tournament],
  );

  /* Slot counts = the series baseline plus whatever the user nudged for THIS
     tournament (the board's `adj`), so switching events resizes the board on
     the very first render (no effect round-trip, no stale bench slots). */
  const a = own ? board.adj : NO_ADJ;

  const baseline = useMemo(() => ({
    bench: Math.max(0, target.bats - lineupPos.length),
    sp: target.sp,
    rp: target.rp,
  }), [target, lineupPos.length]);

  const shape = useMemo(() => ({
    bench: clampCount("bench", baseline.bench + a.bench),
    sp: clampCount("sp", baseline.sp + a.sp),
    rp: clampCount("rp", baseline.rp + a.rp),
  }), [baseline, a.bench, a.sp, a.rp]);

  /** New bench / SP / RP counts, as one step. A slot the board loses takes its card off with it. */
  const changeCounts = (next: Counts, label: string) => {
    const c: Counts = { bench: clampCount("bench", next.bench), sp: clampCount("sp", next.sp), rp: clampCount("rp", next.rp) };
    const keep = new Set(slotKeys(lineupPos, c));
    const kept: Slots = {};
    for (const [k, v] of Object.entries(slots)) if (v != null && keep.has(k)) kept[k] = v;
    act({ type: "set", next: { adj: { bench: c.bench - baseline.bench, sp: c.sp - baseline.sp, rp: c.rp - baseline.rp }, slots: kept }, label });
  };
  const bump = (k: "bench" | "sp" | "rp", d: number) =>
    changeCounts({ ...shape, [k]: shape[k] + d }, `${k === "bench" ? "Bench" : k === "sp" ? "Starters" : "Relievers"} ${shape[k]} → ${clampCount(k, shape[k] + d)}`);

  const spKeys = useMemo(() => spKeysOf(shape.sp), [shape.sp]);
  const rpKeys = useMemo(() => rpKeysOf(shape.rp), [shape.rp]);
  const staffKeys = useMemo(() => [...spKeys, ...rpKeys], [spKeys, rpKeys]);
  const benchKeys = useMemo(() => benchKeysOf(shape.bench), [shape.bench]);
  /* Hitters the roster may carry = roster size less the staff slots, AS THE
     BOARD STANDS. It was the series baseline (target.bats), so a board with a
     staff slot taken off for a bat (or a saved 14-bat roster loaded) read as
     over the hitter limit to the optimiser and nothing it tried was legal
     (Saturday Bronze Cap, 2026-09-26). Not lineup + bench: a platoon bat who
     only starts vs LHP holds neither an R nor a bench slot. */
  const batsCap = Math.max(lineupPos.length, (tournament ? rosterSize(tournament) ?? 26 : 26) - shape.sp - shape.rp);

  const slotOrder: SlotKey[] = useMemo(() => [
    ...lineupPos.map((p) => `R:${p}`),
    ...lineupPos.map((p) => `L:${p}`),
    ...staffKeys,
    ...benchKeys,
  ], [lineupPos, staffKeys, benchKeys]);

  /* fit percentiles (pool is already tournament-legal) ----------------
     With an environment from the page this is env-fit's scorer - run
     environment, park, relief role at a quarter, the 50 position floor,
     observed play blended by precision - and the table's FIT column is its
     percentile. Without one (no era row at all) the rating composite. */
  const fits = useMemo(() => env
    ? envFitMaps(formPool, {
        era: env.rates, park: env.park, roleTrust: 0.25, minPosRating: LJ_FLOOR, leagueLhbShare: env.lhbShare, eraYear: env.eraYear,
        observed: new Map(env.observed.map(([id, runs, n, model]) => [id, { runs, n, model }])),
      })
    : fitMaps(formPool), [formPool, env]);
  const { fitR } = fits;
  /** The scorer's number for a card: calibrated runs per 700 in this event,
   *  observed play blended in, read at the field's pitcher handedness. */
  const envFits = env ? (fits as ReturnType<typeof envFitMaps>) : null;
  const runsOf = (id: number): number | null => {
    if (!envFits) return null;
    const r = envFits.runsR.get(id), l = envFits.runsL.get(id);
    return r == null || l == null ? null : (1 - lhpShare) * r + lhpShare * l;
  };

  const byId = useMemo(() => new Map(formPool.map((c) => [c.cardId, c])), [formPool]);

  /* batting order ------------------------------------------------------
     Each full lineup is played through nine innings on the run model's
     base/out chain (lib/batting-order), every batter on his own odds: his
     ratings against that pitcher hand, in this event's run environment and
     park, on the calibrated scale. The order with the most runs is shown,
     and the usual order (The Book) is scored beside it. With no DH the
     pitcher bats ninth. */
  const lineupKey = (hand: "R" | "L") => lineupPos.map((p) => `${slots[`${hand}:${p}`] ?? ""}${byId.get(slots[`${hand}:${p}`] ?? -1)?.variant ? "v" : ""}`).join(",");
  const orderKeyR = lineupKey("R"), orderKeyL = lineupKey("L");
  const battingOrders = useMemo(() => {
    if (!envFits || !env) return null;
    const chain = orderEnv(env.rates);
    const s = calibrationSlope("hit");
    const out: Partial<Record<"R" | "L", BattingOrder>> = {};
    for (const hand of ["R", "L"] as const) {
      const ids = lineupPos.map((p) => slots[`${hand}:${p}`]);
      if (ids.some((id) => id == null || !byId.has(id))) continue;
      const lines = ids.map((id) => {
        const c = byId.get(id!)!;
        const side = batsLeftOn(c.bats, hand) ? envFits.envLeft : envFits.envRight;
        const league = paLine(side.rates, side.park);
        const r = hitterRates(c.ratings, side.rates, hand === "R" ? "vR" : "vL");
        return r ? shrink(paLine(r, side.park), league, s) : league;
      });
      if (!dh) lines.push(pitcherLine(env.rates));
      const res = bestOrder(lines, chain, dh ? [] : [lineupPos.length]);
      const row = (i: number) => (i < ids.length
        ? { cardId: ids[i]!, name: byId.get(ids[i]!)!.name, pos: lineupPos[i], obp: obp(lines[i]), slg: slg(lines[i]) }
        : { cardId: null, name: "Pitcher", pos: "P", obp: obp(lines[i]), slg: slg(lines[i]) });
      out[hand] = { rows: res.order.map(row), book: res.book.map(row), runs: res.runs, bookRuns: res.bookRuns };
    }
    return out;
    // The keys stand for the two lineups: nothing else on the board moves the order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envFits, env, orderKeyR, orderKeyL, dh]);
  /** A lineup spot's place in the recommended order, for the save and the export; the spot's own index until the lineup is full. */
  const orderAt = (hand: string, pos: string, cardId: number): number => {
    const o = battingOrders?.[hand as "R" | "L"];
    const i = o ? o.rows.findIndex((r) => r.pos === pos && r.cardId === cardId) : -1;
    return i >= 0 ? i + 1 : lineupPos.indexOf(pos) + 1;
  };

  const serializeSlots = (source = slots): RosterSlot[] => slotOrder
    .filter(k => source[k] != null)
    .map(k => {
      const [a, b] = k.split(":");
      const cardId = source[k] as number;
      return { cardId, slot: b ?? a, versusHand: b ? a : "both",
        lineupOrder: b ? orderAt(a, b, cardId) : null,
        useVariant: byId.get(cardId)?.variant ?? false };
    });
  const baseValidation = tournament ? validateRoster(serializeSlots(), formPool, tournament) : null;
  /* The rules strip's items. A set or year rule that looks missing (the name
     or the field's play says there is one) keeps the board a draft, and so
     does a board card outside the chosen Sets chips. */
  const ruleItems = tournament ? describeRules(tournament, { used: baseValidation?.counts.tiers, evidence: setEvidence }) : [];
  const validation = baseValidation && (() => {
    const extra: RuleIssue[] = [];
    for (const i of ruleItems) {
      if ((i.key === "sets" || i.key === "years") && i.state === "suspect") extra.push({ code: `suspect-${i.key}`, message: i.detail ?? `${i.label}: ${i.text}` });
    }
    if (sets.length) {
      for (const id of new Set(serializeSlots().map((x) => x.cardId))) {
        const c = byId.get(id);
        if (c && !inSets(sets, c.cardType)) extra.push({ code: "outside-sets", cardId: id, message: `${c.name}: ${c.cardType != null ? CARD_TYPE_NAME[c.cardType] ?? `set ${c.cardType}` : "set unknown"} is not in the chosen sets.` });
      }
    }
    const incomplete = [...baseValidation.incomplete, ...extra];
    return { ...baseValidation, incomplete, ready: baseValidation.errors.length === 0 && incomplete.length === 0 };
  })();
  /* Issues that name a card mark its slots on the board. */
  const issuesByCard = new Map<number, string[]>();
  for (const e of [...(validation?.errors ?? []), ...(validation?.incomplete ?? [])]) {
    if (e.cardId != null) issuesByCard.set(e.cardId, [...(issuesByCard.get(e.cardId) ?? []), e.message]);
  }

  const posEligible = (c: BuilderCard, slot: SlotKey): boolean => {
    if (slot.startsWith("SP")) return c.isPitcher && (c.role === "SP" || c.role == null);
    if (slot.startsWith("RP") || slot === "CL") return c.isPitcher;
    if (slot.startsWith("BN")) return !c.isPitcher;
    const pos = slot.split(":")[1];
    if (pos === "DH") return !c.isPitcher;
    return !c.isPitcher && (c.ratings[`Pos Rating ${pos}`] ?? 0) > 0;
  };

  const nameOf = (id: number) => byId.get(id)?.name ?? `#${id}`;

  /** Put a card in a slot (clearing any other slot he holds in the same group), or empty it: one step. */
  const assign = (slot: SlotKey, cardId: number | null) => {
    const was = slots[slot] ?? null;
    act({
      type: "place", slot, id: cardId,
      label: cardId == null ? `Take ${was != null ? nameOf(was) : "the card"} off ${slotLabel(slot)}` : `Put ${nameOf(cardId)} at ${slotLabel(slot)}`,
    });
    if (cardId != null) setSelected(null);
  };

  /* table rows ------------------------------------------------------ */
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const wantPitcher = view === "PIT";
    const list = pool.filter((c) => {
      if (c.isPitcher !== wantPitcher) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (view === "PIT") {
        if (posFilter === "SP") return c.role === "SP";
        if (posFilter === "RP") return c.role !== "SP";
        return true;
      }
      if (posFilter === "ALL") return true;
      return (c.ratings[`Pos Rating ${posFilter}`] ?? 0) > 0;
    });
    // For FIP-flavored keys lower is better — flip the sign so one desc sort serves both.
    const dir = wantPitcher && ["proj", "pvl", "pvr", "obs"].includes(sortBy) ? -1 : 1;
    const key = (c: BuilderCard): number => {
      const miss = wantPitcher ? 99 : -1;
      switch (sortBy) {
        case "pvl": return c.proj.vL ?? miss;
        case "pvr": return c.proj.vR ?? miss;
        case "fit": return fitR.get(c.cardId) ?? -1;
        case "runs": {
          const r = runsOf(c.cardId);
          if (r == null) return -1e6;
          // Filtered to a fielding spot: rank on bat + glove there, the way the optimiser prices it.
          return !wantPitcher && FIELD_SPOTS.has(posFilter) ? r + glove * fieldingRuns(posFilter, c.ratings[`Pos Rating ${posFilter}`] ?? 0) : r;
        }
        case "obs": return (wantPitcher ? c.obs?.fip : c.obs?.woba) ?? miss;
        case "pa": return (wantPitcher ? c.obs?.ip : c.obs?.pa) ?? 0;
        case "val": return c.val ?? 0;
        default: return c.proj.all ?? miss;
      }
    };
    return list.sort((a, b) => dir * (key(b) - key(a)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, search, posFilter, sortBy, view, fitR, envFits, lhpShare, glove]);

  const upgradeRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shopUpgrades.filter((u) => (view !== "UPG" ? false : !q || u.name.toLowerCase().includes(q)));
  }, [shopUpgrades, search, view]);
  /* Two cards with one name (two Hank Aarons) show their year next to it. */
  const dupNames = useMemo(() => {
    const seen = new Map<string, number>();
    for (const c of formPool) seen.set(c.name, (seen.get(c.name) ?? 0) + 1);
    return new Set([...seen].filter(([, n]) => n > 1).map(([name]) => name));
  }, [formPool]);

  /* hover popovers --------------------------------------------------- */
  const projLine = (isP: boolean, p: Proj) =>
    isP
      ? `proj FIP ${fmt2(p.all)}  ·  vL ${fmt2(p.vL)} / vR ${fmt2(p.vR)}  ·  ${fr(p.runsAll)} runs/700 here`
      : `proj wOBA ${fmt3(p.all)}  ·  vL ${fmt3(p.vL)} / vR ${fmt3(p.vR)}  ·  ${fr(p.runsAll)} runs/700 here`;

  const peekPool = (e: React.MouseEvent<HTMLElement>, c: BuilderCard) => {
    const o = c.obs;
    const extra = o
      ? c.isPitcher
        ? `observed FIP ${fmt2(o.fip)} · ${ip(o.ip)} IP here`
        : `observed wOBA ${fmt3(o.woba)} · ${o.pa.toLocaleString()} PA here`
      : "no observed data in this tournament";
    setPeek(peekFrom(e.currentTarget, {
      cardId: c.cardId,
      title: c.name,
      sub: `${c.isPitcher ? c.role ?? "P" : c.pos} · VAL ${c.val ?? "?"}${c.bats ? ` · bats ${c.bats}` : ""}${c.variant ? " · VAR" : ""}`,
      isPitcher: c.isPitcher,
      ratings: c.ratings,
      stat: projLine(c.isPitcher, c.proj),
      extra,
    }));
  };

  const peekUpgrade = (e: React.MouseEvent<HTMLElement>, u: UpgradeCard) => {
    setPeek(peekFrom(e.currentTarget, {
      cardId: u.cardId,
      title: u.name,
      sub: `${u.pos} · VAL ${u.val ?? "?"}${u.tier ? ` · ${u.tier}` : ""}`,
      isPitcher: u.isPitcher,
      ratings: u.ratings,
      stat: projLine(u.isPitcher, u.proj),
      extra: `L10 ${fmtPts(u.last10)} · ask ${fmtPts(u.ask)}`,
    }));
  };

  const peekSlot = (e: React.MouseEvent<HTMLElement>, id: number) => {
    const c = byId.get(id);
    if (c) peekPool(e, c);
  };

  /* actions --------------------------------------------------------- */
  const clickCard = (c: BuilderCard) => {
    if (!selected) { toast({ message: "Pick a slot first, or drag the card straight onto one." }); return; }
    if (!posEligible(c, selected)) { toast({ message: `${c.name} can't fill ${slotLabel(selected)}.` }); return; }
    assign(selected, c.cardId);
  };

  /* drag & drop ------------------------------------------------------ */
  const startDrag = (e: React.DragEvent, payload: string) => {
    e.dataTransfer.setData("text/plain", payload);
    e.dataTransfer.effectAllowed = "move";
    setPeek(null);
    setDragPayload(payload);
  };

  const dropOnSlot = (target: SlotKey, payload: string) => {
    setDragOverSlot(null);
    setDragPayload(null);
    if (!payload) return;

    if (payload.startsWith("card:")) {
      const id = Number(payload.slice(5));
      const c = byId.get(id);
      if (!c) return;
      if (!posEligible(c, target)) { toast({ message: `${c.name} can't fill ${slotLabel(target)}.` }); return; }
      assign(target, id);
      return;
    }

    if (payload.startsWith("slot:")) {
      const from = payload.slice(5);
      if (from === target) return;
      const a = slots[from] ?? null;
      const b = slots[target] ?? null;
      const ca = a != null ? byId.get(a) : null;
      const cb = b != null ? byId.get(b) : null;
      if (ca && !posEligible(ca, target)) { toast({ message: `${ca.name} can't fill ${slotLabel(target)}.` }); return; }
      if (cb && !posEligible(cb, from)) { toast({ message: `${cb.name} can't fill ${slotLabel(from)}.` }); return; }
      if (!ca && !cb) return;
      act({
        type: "swap", from, to: target,
        label: ca && cb ? `Swap ${ca.name} and ${cb.name}` : `Move ${(ca ?? cb)!.name} to ${slotLabel(ca ? target : from)}`,
      });
    }
  };

  /** Dropping a rostered player back on the pool takes him off the roster. */
  const dropOnPool = (payload: string) => {
    setDragPayload(null);
    if (payload.startsWith("slot:")) assign(payload.slice(5), null);
  };

  /**
   * The greedy fill, from the cards the chips allow and never a banned one,
   * carrying every locked card the rules leave room for (fillOnce's `must`:
   * counted against the size, cap, tiers and variants before anything else is
   * picked). `use` overrides the locks, bans and sets in state: on an event
   * switch they are read from storage in the same render, before the state has
   * caught up. Locks it could not carry come back by reason: outside the chosen
   * sets, or no room under the rules.
   */
  const computeFill = (use?: { locks: number[]; bans: number[]; sets: number[] }) => {
    const lockIds = use ? new Set(use.locks) : locks, banIds = use ? new Set(use.bans) : bans, setList = use ? use.sets : sets;
    const candidates = formPool.filter((c) => inSets(setList, c.cardType) && !banIds.has(c.cardId));
    const inPool = new Set(candidates.map((c) => c.cardId));
    const must = new Set([...lockIds].filter((id) => inPool.has(id)));
    const { slots: next, lambda } = fillRoster(candidates, tournament!, { lineupPos, spKeys, rpKeys, benchKeys, bats: batsCap }, fits, must);
    const onBoard = new Set(Object.values(next));
    const outside = [...lockIds].filter((id) => !inPool.has(id) && !banIds.has(id) && byId.has(id)).map(nameOf);
    const missed = [...must].filter((id) => !onBoard.has(id)).map(nameOf);
    // Greedy picks can leave a spot only an unlocked card could fill; Optimise solves positions exactly.
    const empty = must.size ? slotOrder.filter((k) => next[k] == null).map(slotLabel) : [];
    return { next, lambda, missed, outside, empty };
  };
  /** What a fill left off, in words for the message line or a toast. */
  const lockNote = ({ missed, outside, empty }: { missed: string[]; outside: string[]; empty: string[] }) => [
    outside.length ? `Locked ${outside.join(", ")} ${outside.length === 1 ? "is" : "are"} outside the chosen sets, so left off.` : "",
    missed.length ? `Locked ${missed.join(", ")} did not fit on this fill — run Optimise.` : "",
    empty.length ? `With these locks the fill left ${empty.join(", ")} empty — run Optimise, which places positions exactly.` : "",
  ].filter(Boolean).join(" ");
  /** The fill's note when it could not carry every lock, else the plain "filled" line. */
  const fillNote = (fill: ReturnType<typeof computeFill>) => lockNote(fill)
    || `Draft roster filled${fill.lambda > 0 ? " under the cap (cheaper cards traded in where the budget ran out)" : ""} — check the Rules strip, then adjust.`;
  /** Reset to recommended: the greedy fill, as one step with a toast of what changed. */
  const autoFill = () => {
    if (!tournament) return;
    const fill = computeFill();
    const note = lockNote(fill);
    bulk({ type: "set", next: { slots: fill.next }, label: "Reset to recommended" }, {
      say: ({ runs, inOut }) => `Recommended board${runs ? `: ${runs}` : ""}. ${inOut}${note ? ` ${note}` : ""}`,
      same: `The board is already the recommended one.${note ? ` ${note}` : ""}`,
    });
  };

  /* New Sets chips refill the board from those sets, as one step: Undo (the
     toast's, or Cmd/Ctrl+Z) takes back the sets and the refill together. */
  const changeSets = (next: number[]) => {
    if (!tournament) return;
    const fill = computeFill({ locks: [...locks], bans: [...bans], sets: next });
    const label = next.length ? next.map((t) => CARD_TYPE_SHORT[t] ?? t).join(" + ") : "every set";
    const poolSize = formPool.filter((c) => inSets(next, c.cardType) && !bans.has(c.cardId)).length;
    const note = lockNote(fill);
    bulk({ type: "set", next: { sets: next, slots: fill.next }, label: `Sets: ${label}` }, poolSize === 0
      ? { tone: "error", say: () => `No cards in your pool from ${label}: the board is empty.` }
      : { say: ({ inOut }) => `Board refilled from ${label} (${poolSize} cards). ${inOut}${note ? ` ${note}` : ""}` });
  };

  /* The objective env-roster scores with: calibrated runs per board with
     defence in runs at the slot, boards weighted by the field's pitcher
     handedness, starters in full, relief arms at 0.31, bench at a tenth.
     Null without an environment (no era row at all). */
  const fillShape: FillShape = useMemo(
    () => ({ lineupPos, spKeys, rpKeys, benchKeys, bats: batsCap }),
    [lineupPos, spKeys, rpKeys, benchKeys, batsCap],
  );
  /* What a starter and a reliever face here, as multiples of a lineup slot's
     PA, measured off this series' exports; the objective's defaults (1.0 and
     0.31) when there are none. */
  const spWeight = meta?.construction?.spWeight ?? undefined;
  const rpWeight = meta?.construction?.rpWeight ?? undefined;
  const objective = useMemo(() => envFits
    ? rosterObjective(formPool as FillCard[], { shape: fillShape, runsR: envFits.runsR, runsL: envFits.runsL, lhpShare, spWeight, rpWeight, gloveScale: glove })
    : null, [envFits, formPool, fillShape, lhpShare, spWeight, rpWeight, glove]);
  const boardRuns = (source: Record<SlotKey, number | null>): number | null => {
    if (!objective) return null;
    const complete: Record<string, number> = {};
    for (const [k, v] of Object.entries(source)) if (v != null) complete[k] = v;
    return objective.objective(complete);
  };

  /* One Undo notice at a time: after another change, an older one's Undo
     would take back the wrong step. The toasts outlive the page (the Toaster
     is in the root layout), so leaving or switching events closes it too. */
  const notice = useRef<number | null>(null);
  const dropNotice = useCallback(() => {
    if (notice.current != null) dismissToast(notice.current);
    notice.current = null;
  }, []);
  /** The "Removed from your board" note: edits leave it open; a switch or leaving closes it. */
  const removedNote = useRef<number | null>(null);
  const dropRemovedNote = useCallback(() => {
    if (removedNote.current != null) dismissToast(removedNote.current);
    removedNote.current = null;
  }, []);
  /** Every change to the board goes through here, as one labelled step. */
  const act = (action: BoardAction) => {
    if (!own) return;
    dropNotice();
    dispatch(action);
  };
  const undo = useCallback(() => { dropNotice(); undoStep(); }, [dropNotice, undoStep]);
  const redo = useCallback(() => { dropNotice(); redoStep(); }, [dropNotice, redoStep]);
  useUndoKeys(undo, redo, tournament != null);

  /**
   * A bulk change (Reset to recommended, Optimise, Search longer, Load, Clear,
   * Sets): one step, then a toast saying what changed, with Undo: "Better
   * board: +311.4 → +359.5 runs (+48.1). In: Hank Aaron 1B. Out: Brandon
   * Wood." The toast is written once the change has rendered, when the new
   * board's runs can be read (a loaded roster brings its own copies). A change
   * that changes nothing is no step, and says `same` instead.
   */
  const pendingNotice = useRef<Notice | null>(null);
  const bulk = (action: BoardAction, n: { say: Notice["say"]; tone?: Notice["tone"]; detail?: string; same?: string }): boolean => {
    if (!tournament || !own) return false;
    if (boardReducer(board, action) === board) {
      if (n.same) toast({ message: n.same });
      return false;
    }
    act(action);
    pendingNotice.current = { tid: tournament.id, before: slots, beforeRuns: boardRuns(slots), say: n.say, tone: n.tone, detail: n.detail };
    return true;
  };
  useEffect(() => {
    const n = pendingNotice.current;
    if (!n || board.tid !== n.tid) return;
    pendingNotice.current = null;
    const diff = boardDiff(n.before, board.slots, slotOrder);
    const message = n.say({
      diff, after: board.slots, runs: runsText(n.beforeRuns, boardRuns(board.slots)),
      inOut: diffText(diff, board.slots, slotOrder, nameOf),
    });
    notice.current = toast({ message, tone: n.tone, detail: n.detail, action: { label: "Undo", onClick: () => { if (lastTid.current === n.tid) undo(); } } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  /* Sets are stored only when they differ from the event's rule, so a rule
     the catalogue widens or drops later reaches a board that never chose. */
  useEffect(() => {
    if (!tournament || lastTid.current !== tournament.id || board.tid !== tournament.id) return;
    const chosen = sets.join(",") !== (ruleTypes ?? []).join(",");
    try { localStorage.setItem(lockKey(tournament.id), JSON.stringify({ locks: [...locks], bans: [...bans], ...(chosen ? { sets } : {}) })); } catch { /* storage unavailable */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locks, bans, sets]);

  /** The latest render's board, locks, bans and actions, for code that runs after an await or from a toast. */
  const latest = useRef({ board, locks, bans, autoFill, bulk, boardRuns, slotOrder });
  useEffect(() => { latest.current = { board, locks, bans, autoFill, bulk, boardRuns, slotOrder }; });

  /* Optimise and Search longer (lib/roster-search.ts) run in a Web Worker
     (optimize.worker.ts), so the page stays usable while they climb and Stop
     works in both, keeping the best board found so far. Progress goes to the
     bar in the roster header (components/build/search-progress.tsx). A search
     belongs to the event it started on: switching events cancels it and
     drops its result. */
  const [optimizing, setOptimizing] = useState<"quick" | "deep" | null>(null);
  const searchRun = useRef<{ stop: () => void; cancel: () => void; startedAt: number } | null>(null);
  /** Stop, unless it is a double-click's second click on the button that just started the search. */
  const stopSearch = (e: React.MouseEvent) => {
    const run = searchRun.current;
    if (!run || e.detail > 1 || performance.now() - run.startedAt < 500) return;
    run.stop();
  };
  const startSearch = (req: SearchRequest, runTid: number) => new Promise<SearchOutcome>((resolve) => {
    const failed = (why: string) => toast({ tone: "error", message: `The search ${why}. Your board is unchanged.` });
    let w: Worker;
    try {
      w = new Worker(new URL("../lib/optimize.worker.ts", import.meta.url), { type: "module" });
    } catch {
      failed("could not start in this browser");
      setSearchProgress(null);
      resolve({ best: null, ran: 0, total: 0, cut: false, how: "failed" });
      return;
    }
    let last: Omit<SearchOutcome, "how"> = { best: null, ran: 0, total: 0, cut: false };
    let ended = false;
    const end = (how: SearchOutcome["how"]) => {
      if (ended) return;
      ended = true;
      w.terminate();
      searchRun.current = null;
      setSearchProgress(null);
      resolve(how === "cancelled" ? { best: null, ran: 0, total: last.total, cut: false, how } : { ...last, how });
    };
    searchRun.current = { stop: () => end("stopped"), cancel: () => end("cancelled"), startedAt: performance.now() };
    w.onmessage = (e: MessageEvent<SearchMessage>) => {
      // One already on its way when the event switched.
      if (lastTid.current !== runTid) { end("cancelled"); return; }
      const m = e.data;
      last = { best: m.best, ran: m.done, total: m.total, cut: m.cut ?? false };
      if (m.type === "done") { end("done"); return; }
      setSearchProgress({
        mode: req.mode, done: m.done, total: m.total, current: m.current ?? null,
        best: m.best && objective ? objective.objective(m.best.slots) : null,
      });
    };
    w.onerror = (err) => {
      err.preventDefault();
      failed(`failed${err.message ? `: ${err.message}` : ""}`);
      end("failed");
    };
    try {
      w.postMessage(req);
    } catch (e) {
      failed(`could not start (${e instanceof Error ? e.message : "the board could not be sent to it"})`);
      end("failed");
    }
  });

  /**
   * Optimise ("quick") or Search longer ("deep"): hill-climb from several
   * starting boards and keep the best, on calibrated runs with gloves priced
   * in runs, under every rule and L.J.'s glove floor (lib/roster-search.ts has
   * the starts, the settings and the time budget). The result is one step with
   * a toast of what changed; a board he changed while it ran is not
   * overwritten, the result is offered instead.
   */
  const optimize = async (mode: "quick" | "deep") => {
    if (!tournament || !objective || !envFits || !own || searchRun.current) return;
    const size = rosterSize(tournament) ?? 26;
    const slotsForPlayers = lineupPos.length + benchKeys.length + spKeys.length + rpKeys.length;
    // vs RHP the lineup and bench hold distinct bats, so these alone must fit.
    if (slotsForPlayers > size) {
      toast({ tone: "error", message: `The board has ${slotsForPlayers} player slots (${lineupPos.length + benchKeys.length} bats, ${spKeys.length} SP, ${rpKeys.length} RP) for a ${size}-man roster. Take a bench or staff slot off first.` });
      return;
    }
    const runTid = tournament.id;
    // An open Undo (the Sets toast's among them) would change the board under the search.
    dropNotice();
    const searchPool = (pool as FillCard[]).filter((c) => !bans.has(c.cardId)).map(searchCard);
    // Only locks the search can use are kept: one outside the chosen sets is
    // not in the pool, and would cost every board the must-carry penalty.
    const inPool = new Set(searchPool.map((c) => c.cardId));
    const keep = [...locks].filter((id) => inPool.has(id));
    const outside = [...locks].filter((id) => !inPool.has(id) && byId.has(id)).map(nameOf);
    // Compare against the board as the page scores and checks it. The
    // search's scores carry 1000 off per lock missing; so does this.
    const before = boardRuns(slots) ?? 0;
    const onNow = new Set(Object.values(slots).filter((v): v is number => v != null));
    const beforeSearch = before - 1000 * keep.filter((id) => !onNow.has(id)).length;
    // A card outside the chosen sets, or one banned since, is a break too: the search replaces it.
    const breaks = validation?.errors.length ? "broke a rule"
      : validation?.incomplete.some((i) => i.code === "outside-sets") ? "had a card outside the chosen sets"
      : [...onNow].some((id) => bans.has(id)) ? "had a banned card"
      : null;
    const current: FillResult = {};
    for (const k of slotOrder) { const id = slots[k]; if (id != null) current[k] = id; }
    const started = { board, locks, bans };
    setOptimizing(mode);
    setSearchProgress({ mode, done: 0, total: 0, current: null, best: null });
    let out: SearchOutcome;
    try {
      out = await startSearch({
        mode, board: current, pool: searchPool, rules: tournament as RosterRules, shape: fillShape, fits: toPlainFits(fits),
        runsR: [...envFits.runsR], runsL: [...envFits.runsL], lhpShare, spWeight, rpWeight, gloveScale: glove,
        locks: keep, minCatchers: twoCatchers ? 2 : 0, minShortstops: twoShortstops ? 2 : 0, minLongMen: twoLong ? 2 : 0,
      }, runTid);
    } finally {
      setOptimizing(null);
    }
    if (lastTid.current !== runTid || out.how === "cancelled" || out.how === "failed") return;
    const { best, ran, cut } = out;
    const climbs = plural(ran, mode === "quick" ? "start" : "climb");
    const outsideNote = outside.length ? `Locked ${outside.join(", ")} ${outside.length === 1 ? "is" : "are"} outside the chosen sets, so left off.` : "";
    if (!best) {
      toast(out.how === "stopped" && ran === 0
        ? { message: "Stopped before the first start finished. Nothing changed." }
        : ran === 0
          // The search found no complete board to start from: some slot has nobody left to fill it.
          ? { tone: "error", message: "No complete board to start from: a slot has no eligible card left. Check the bans, the Sets chips and the empty slots." }
          : { tone: "error", message: `No start reached a board that passes every rule (${ran} tried). Open the issues in the roster header.` });
      return;
    }
    const onBest = new Set(Object.values(best.slots));
    const missed = keep.filter((id) => !onBest.has(id)).map(nameOf);
    const tail = [
      breaks ? `Your board ${breaks}.` : "",
      missed.length ? `Locked ${missed.join(", ")} could not fit under the rules: check the cap, the slot counts and ${missed.length === 1 ? "his positions" : "their positions"}.` : "",
      outsideNote,
    ].filter(Boolean).join(" ");
    const detail = `Best of ${climbs}${cut ? " (the time limit stopped it)" : ""}, from ${best.from}, ${plural(best.moves, "move")}. Calibrated runs, both lineups at ${Math.round((1 - lhpShare) * 100)}/${Math.round(lhpShare * 100)} vs RHP/LHP, gloves priced in runs, positions solved exactly${locks.size || bans.size ? `; ${locks.size} locked, ${bans.size} banned` : ""}.`;
    const label = mode === "quick" ? "Optimise" : "Search longer";
    const found = objective.objective(best.slots);
    // He changed the board, the locks or the bans while it ran: his changes stay. The result is
    // offered if it beats the board he has now and still fits its slots (a bench or staff count
    // changed means it was built for another board).
    const now = latest.current;
    if (now.board !== started.board || now.locks !== started.locks || now.bans !== started.bans) {
      const nowRuns = now.boardRuns(now.board.slots) ?? 0;
      const sameShape = Object.keys(best.slots).every((k) => now.slotOrder.includes(k as SlotKey)) && now.slotOrder.length === slotOrder.length;
      if (!sameShape) {
        toast({ message: `The slot counts changed while the search ran, so its result (${signed(found)} runs) no longer fits your board. Run it again.`, detail });
        return;
      }
      if (found <= nowRuns + 1e-9) {
        toast({ message: `The board changed while the search ran. Nothing it found beats yours now (${signed(nowRuns)} runs).`, detail });
        return;
      }
      toast({
        message: `The board changed while the search ran, so its result was not applied: ${signed(found)} runs against your ${signed(nowRuns)}.`,
        detail,
        // A long search may end while he looks elsewhere: the offer stays until he closes it.
        duration: 0,
        action: {
          label: "Use it",
          onClick: () => {
            if (lastTid.current !== runTid || latest.current.slotOrder.length !== slotOrder.length) return;
            latest.current.bulk({ type: "set", next: { slots: best.slots }, label }, { say: ({ runs, inOut }) => `Search result${runs ? `: ${runs}` : ""}. ${inOut}`, detail });
          },
        },
      });
      return;
    }
    // A board that breaks a rule is replaced even by a lower-scoring legal one.
    if (!breaks && best.score <= beforeSearch + 1e-9) {
      toast({ message: `No better board found (${climbs}${cut ? ", stopped at the time limit" : ""}). Yours stays at ${signed(before)} runs.${outsideNote ? ` ${outsideNote}` : ""}` });
      return;
    }
    bulk({ type: "set", next: { slots: best.slots }, label }, {
      say: ({ runs, inOut }) => `${breaks ? "Legal board" : "Better board"}${runs ? `: ${runs}` : ""}. ${inOut}${tail ? ` ${tail}` : ""}`,
      detail,
    });
  };

  /* Switching events resets the view and cancels a running search (the
     event it started on keeps its board as it was); the next effect restores
     the new event's board. */
  const wantInit = useRef<number | null>(null);
  /** The event whose kept board this page may write: set once that board is restored or filled. */
  const inited = useRef<number | null>(null);
  /** The kept board as last written or restored, so an unchanged board is not written again. */
  const lastKept = useRef<string | null>(null);
  useEffect(() => {
    if (!tournament) {
      // Back to the picker (the logo, the Build link, Back): a running search stops too. Its
      // Stop lives in the roster header, which the picker page doesn't show.
      if (searchRun.current) {
        searchRun.current.cancel();
        toast({ message: `Search stopped: you left ${lastName.current ?? "the event"}. Nothing was changed.` });
      }
      dropRemovedNote();
      lastTid.current = null;
      return;
    }
    if (lastTid.current === tournament.id) return;
    const left = lastName.current;
    lastTid.current = tournament.id;
    lastName.current = tournament.name;
    setSelected(null);
    setSearch("");
    setPosFilter("ALL");
    dropNotice();
    dropRemovedNote();
    pendingNotice.current = null;
    if (searchRun.current) {
      searchRun.current.cancel();
      toast({ message: `Search stopped: you switched events. Nothing was changed on ${left ?? "the last event"}.` });
    }
    const saved = readLocks(tournament.id);
    setLocks(new Set(saved.locks ?? []));
    setBans(new Set(saved.bans ?? []));
    inited.current = null;
    wantInit.current = tournament.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament?.id]);

  /* The event's kept board (build:board:<tid>) comes back instead of a fresh
     fill; cards no longer in the pool come off and are named. With none kept,
     the greedy fill, which is not written until he changes it (a reload then
     fills again from the latest data). Either way the history starts here, so
     Undo never reaches the last event's board. With no pool at all (nothing
     loaded) a kept board is left alone. */
  const readBoard = (id: number) => {
    try { return parseSaved(localStorage.getItem(boardKey(id))); } catch { return null; }
  };
  const shapeKey = slotOrder.join("|");
  useEffect(() => {
    if (!tournament || wantInit.current !== tournament.id) return;
    wantInit.current = null;
    const id = tournament.id;
    const savedLocks = readLocks(id);
    const setList = restoreSets(savedLocks.sets);
    const kept = basePool.length ? readBoard(id) : null;
    if (kept) {
      const ids = new Set(basePool.map((c) => c.cardId));
      const r = restoreBoard(kept, { inPool: (cid) => ids.has(cid), baseline, lineupPos });
      const next = { tid: id, slots: r.slots, forms: r.forms, adj: r.adj, sets: setList };
      resetBoard(next);
      lastKept.current = JSON.stringify(boardContent(next, slotKeys(lineupPos, r.counts), r.counts));
      inited.current = id;
      const note = droppedNote(r.dropped);
      const restored = toast({
        message: `Restored your board from ${stamp(kept.savedAt)}.${note ? ` ${note}` : ""}`,
        action: { label: "Start from recommendation", onClick: () => { if (lastTid.current === id) latest.current.autoFill(); } },
        // A card taken off stays said until he closes it: it isn't the Undo notice, which the next edit closes.
        duration: note ? 0 : undefined,
      });
      if (note) removedNote.current = restored;
      else notice.current = restored;
      return;
    }
    const fill = computeFill({ locks: savedLocks.locks ?? [], bans: savedLocks.bans ?? [], sets: setList });
    const next = { tid: id, slots: fill.next, forms: {}, adj: NO_ADJ, sets: setList };
    resetBoard(next);
    lastKept.current = JSON.stringify(boardContent(next, slotOrder, shape));
    if (!basePool.length) return;
    inited.current = id;
    toast({ message: fillNote(fill) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament?.id, pool, shapeKey]);

  /* Keep the board per event on every change, so a reload or a switch back
     restores it: not before this event's board is restored (the empty board
     in between would overwrite it), and not while it is unchanged. */
  useEffect(() => {
    if (!tournament || board.tid !== tournament.id || inited.current !== tournament.id) return;
    const content = JSON.stringify(boardContent(board, slotOrder, shape));
    if (content === lastKept.current) return;
    lastKept.current = content;
    try {
      localStorage.setItem(boardKey(tournament.id), JSON.stringify(toSaved(board, slotOrder, shape, (id) => byId.get(id)?.name, Date.now())));
    } catch { /* storage unavailable: the board just isn't kept */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, shapeKey]);

  /* Leaving the page stops a running search (its worker would run on) and
     closes this page's toasts. After a tick: StrictMode's rehearsal unmount
     in development remounts at once, and must not close them. */
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const running = searchRun;
    return () => {
      mounted.current = false;
      running.current?.cancel();
      setTimeout(() => { if (!mounted.current) { dropNotice(); dropRemovedNote(); } }, 0);
    };
  }, [dropNotice, dropRemovedNote]);

  const save = async () => {
    if (!tournament) return;
    const name = rosterName.trim() || `${tournament.name} roster`;
    // The checks only this page makes (a set or year rule that looks missing,
    // a card outside the chosen sets) go with it, so the save is a draft too.
    const payload = {
      tournamentId: tournament.id,
      name,
      slots: serializeSlots(),
      requireReady: validation?.ready ?? false,
      checks: (validation?.incomplete ?? []).filter((i) => isPageCheck(i.code)),
    };
    setSaving(true);
    try {
      const res = await fetch("/api/rosters", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await res.json();
      if (res.ok) {
        toast({ tone: "success", message: `Saved “${name}”${result.validation?.ready ? ": ready." : " as a draft; rule checks remain."}` });
        router.refresh();
      } else toast({ tone: "error", message: result.error ?? `Save failed (${res.status}).` });
    } catch { toast({ tone: "error", message: "Could not save. Your roster is still here; try again." }); }
    finally { setSaving(false); }
  };

  /** Load a saved roster onto the board, in its own shape and copies: one step, with a toast of what changed. */
  /** A saved roster's newer cards, best first on this event's scorer: "Steve Pearce (VAR), Joe Dugan (VAR) and 2 more". */
  const newCardsLine = (r: SavedRoster, max = 4): string => {
    const cards = (r.newCards ?? [])
      .map((n) => ({ n, c: basePool.find((x) => x.cardId === n.cardId) }))
      .filter((x): x is { n: { cardId: number; variant: boolean }; c: NonNullable<typeof x.c> } => x.c != null)
      .sort((a, b) => (runsOf(b.n.cardId) ?? -99) - (runsOf(a.n.cardId) ?? -99));
    if (!cards.length) return "";
    const names = cards.slice(0, max).map(({ n, c }) => `${c.name}${n.variant ? " (VAR)" : ""}`);
    const more = cards.length - names.length;
    return more > 0 ? `${names.join(", ")} and ${more} more` : names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  };

  const loadSaved = (r: SavedRoster) => {
    const loaded: Slots = {};
    const savedForms: Record<number, boolean> = {};
    let maxBn = 0, maxSp = 0, maxRp = 0;
    for (const s of r.slots) {
      const key = s.versusHand === "R" || s.versusHand === "L" ? `${s.versusHand}:${s.slot}` : s.slot;
      loaded[key] = s.cardId;
      savedForms[s.cardId] = s.useVariant;
      const bn = /^BN(\d+)$/.exec(key); if (bn) maxBn = Math.max(maxBn, +bn[1]);
      const sp = /^SP(\d+)$/.exec(key); if (sp) maxSp = Math.max(maxSp, +sp[1]);
      const rp = /^RP(\d+)$/.exec(key); if (rp) maxRp = Math.max(maxRp, +rp[1]);
    }
    // The board takes the saved roster's own shape — shrinking as well as
    // growing — so a saved 14 bats / 6 SP / 6 RP does not sit on a board with
    // a 7th, empty relief slot that makes 27 when anything fills it.
    const c: Counts = r.slots.length
      ? { bench: clampCount("bench", maxBn), sp: clampCount("sp", maxSp), rp: clampCount("rp", maxRp + 1) }
      : shape;
    const keys = new Set(slotKeys(lineupPos, c));
    const next: Slots = {};
    for (const [k, id] of Object.entries(loaded)) if (keys.has(k)) next[k] = id;
    const switched = [...new Set(r.slots.map((s) => s.cardId))]
      .map((id) => basePool.find((x) => x.cardId === id))
      .filter((x): x is NonNullable<typeof x> => x != null && (savedForms[x.cardId] ? !x.variantOwned && x.baseOwned : !x.baseOwned && x.variantOwned));
    const switchedNote = switched.length ? ` Using the copy you own for ${switched.map((x) => x.name).join(", ")} (the saved copy is not in your collection); save again to keep it.` : "";
    const fresh = newCardsLine(r);
    const staleNote = fresh ? ` It was saved on the ${r.builtOn ? date(r.builtOn) : "older"} collection; since then you've got ${fresh}. Optimise to see what they add.` : "";
    bulk({
      type: "set",
      next: { slots: next, forms: savedForms, adj: { bench: c.bench - baseline.bench, sp: c.sp - baseline.sp, rp: c.rp - baseline.rp } },
      label: `Load “${r.name}”`,
    }, {
      say: ({ runs, inOut }) => `Loaded “${r.name}”${runs ? `: ${runs}` : ""}. ${inOut}${switchedNote}${staleNote}`,
      same: `“${r.name}” is already on the board.`,
    });
  };

  /* export ----------------------------------------------------------- */
  const download = (filename: string, content: string, mime: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportLineup = () => {
    if (!tournament) return;
    const name = rosterName.trim() || tournament.name;
    const line = (id: number | null | undefined) => {
      const c = id != null ? byId.get(id) : null;
      return c ? `${c.name} (${c.variant ? "VARIANT, " : ""}${c.pos}${c.bats ? `, ${c.bats}` : ""}, VAL ${c.val ?? "?"})` : "—";
    };
    const txt: string[] = [`${name} — ${new Date().toISOString().slice(0, 10)}`, ""];
    txt.push(validation?.ready ? "READY — passed recorded rules" : "DRAFT — not ready for entry", ...(validation?.errors.map(e=>e.message) ?? []), ...(validation?.incomplete.map(e=>e.message) ?? []), "");
    for (const hand of ["R", "L"] as const) {
      const o = battingOrders?.[hand];
      txt.push(`vs ${hand}HP${o ? " (batting order: the most runs on the run model)" : ""}`);
      if (o) o.rows.forEach((r, i) => txt.push(`  ${i + 1}. ${r.pos.padEnd(2)}  ${r.cardId == null ? "Pitcher" : line(r.cardId)}`));
      else lineupPos.forEach((p, i) => txt.push(`  ${i + 1}. ${p.padEnd(2)}  ${line(slots[`${hand}:${p}`])}`));
      txt.push("");
    }
    txt.push("Rotation");
    spKeys.forEach((k) => txt.push(`  ${k.padEnd(3)} ${line(slots[k])}`));
    txt.push("Bullpen");
    rpKeys.forEach((k) => txt.push(`  ${k.padEnd(3)} ${line(slots[k])}`));
    txt.push("Bench");
    benchKeys.forEach((k) => txt.push(`  ${k.padEnd(3)} ${line(slots[k])}`));

    const csv: string[] = ["Section,Slot,Order,Card ID,Name,Pos,Bats,VAL,Variant,Status"];
    const esc = (s: string) => (/[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    for (const k of slotOrder) {
      const id = slots[k];
      if (id == null) continue;
      const c = byId.get(id);
      if (!c) continue;
      const [a, b] = k.split(":");
      const section = b ? `vs ${a}HP` : k.startsWith("BN") ? "Bench" : "Staff";
      const order = b ? orderAt(a, b, id) : "";
      csv.push([section, b ?? a, order, c.cardId, esc(c.name), c.isPitcher ? c.role ?? "P" : c.pos, c.bats ?? "", c.val ?? "", c.variant ? "Y" : "N", validation?.ready ? "Ready" : "Draft"].join(","));
    }
    const day = new Date().toISOString().slice(0, 10);
    const base = name.replace(/[^A-Za-z0-9 _-]/g, "").trim().replace(/\s+/g, "_");
    download(`${base}_${day}.txt`, txt.join("\n"), "text/plain");
    download(`${base}_${day}.csv`, csv.join("\n"), "text/csv");
    toast({ message: "Exported the .txt lineup card and the .csv; both are in your Downloads folder." });
  };

  /* summary ---------------------------------------------------------- */
  const summary = useMemo(() => {
    const lineupIds = lineupPos.map((p) => slots[`R:${p}`]).filter((v): v is number => v != null);
    const hitters = lineupIds.map((id) => byId.get(id)!).filter(Boolean);
    const armsIds = staffKeys.map((k) => slots[k]).filter((v): v is number => v != null);
    const arms = armsIds.map((id) => byId.get(id)!).filter(Boolean);
    const mean = (xs: (number | null)[]) => {
      const v = xs.filter((x): x is number => x != null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const projWoba = mean(hitters.map((c) => c.proj.all));
    const projFip = mean(arms.map((c) => c.proj.all));
    const wpa = hitters.reduce((s, c) => s + (c.obs?.pa ?? 0), 0);
    const woba = wpa > 0
      ? hitters.reduce((s, c) => s + (c.obs?.woba ?? 0) * (c.obs?.pa ?? 0), 0) / wpa
      : null;
    const wip = arms.reduce((s, c) => s + (c.obs?.ip ?? 0), 0);
    const fip = wip > 0
      ? arms.reduce((s, c) => s + (c.obs?.fip ?? 0) * (c.obs?.ip ?? 0), 0) / wip
      : null;
    const defAvg = (() => {
      const vals = lineupPos.filter((p) => p !== "DH").map((p) => {
        const id = slots[`R:${p}`]; if (id == null) return null;
        return byId.get(id)?.ratings[`Pos Rating ${p}`] ?? null;
      }).filter((v): v is number => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    })();

    // distinct players carried: hitters across the vs-R group + both lineups
    const hitterIds = new Set<number>();
    for (const k of slotOrder) {
      const id = slots[k];
      if (id == null) continue;
      const c = byId.get(id);
      if (c && !c.isPitcher) hitterIds.add(id);
    }
    const spUsed = spKeys.filter((k) => slots[k] != null).length;
    const rpUsed = rpKeys.filter((k) => slots[k] != null).length;

    return {
      filled: slotOrder.filter((k) => slots[k] != null).length,
      total: slotOrder.length,
      runs: boardRuns(slots),
      projWoba, projFip, woba, fip, defAvg,
      hitterCount: hitterIds.size, spUsed, rpUsed,
      roster: hitterIds.size + spUsed + rpUsed,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, byId, slotOrder, spKeys, rpKeys, lineupPos, objective]);

  /* render ----------------------------------------------------------- */
  // A transition, so the old board stays up (dimmed) while the next event loads.
  const [switching, startSwitch] = useTransition();
  const pickTournament = (id: string) => startSwitch(() => router.push(id ? `/build?t=${id}` : "/build"));

  const obsTitle = (o: ObservedLine | null, isP: boolean) =>
    o == null
      ? "no observed data in this tournament"
      : isP
        ? `observed FIP ${fmt2(o.fip)} over ${ip(o.ip)} IP in this series · WAR ${o.war.toFixed(1)}`
        : `observed wOBA ${fmt3(o.woba)} over ${o.pa.toLocaleString()} PA in this series · WAR ${o.war.toFixed(1)}`;

  const Th = ({ id, label, title, right = true }: { id?: string; label: string; title?: string; right?: boolean }) => (
    <th
      className={cn("px-1.5 py-1.5", right && "text-right", id && "cursor-pointer select-none hover:text-foreground")}
      title={title}
      onClick={id ? () => setSortBy(id) : undefined}
    >
      {label}{id && sortBy === id ? " ↓" : ""}
    </th>
  );

  const Counter = ({ label, k, used, tgt }: { label: string; k: "bench" | "sp" | "rp"; used: number; tgt: number }) => (
    <div className="flex items-center gap-1">
      <span className="text-muted-foreground">{label}</span>
      <button onClick={() => bump(k, -1)} className="inline-flex size-6 items-center justify-center rounded border border-border leading-none hover:bg-muted" aria-label={`fewer ${label}`}>−</button>
      <span className="font-mono">{used}</span>
      <button onClick={() => bump(k, 1)} className="inline-flex size-6 items-center justify-center rounded border border-border leading-none hover:bg-muted" aria-label={`more ${label}`}>+</button>
      <span className="text-muted-foreground/70">/{tgt}</span>
    </div>
  );

  return (
    <div
      className={cn("flex flex-col gap-4", switching && "[&>*:not(:first-child)]:pointer-events-none [&>*:not(:first-child)]:opacity-50 [&>*]:transition-opacity")}
      aria-busy={switching}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-eyebrow mb-1">Play</div>
          <h1 className="page-title">Build</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Pick a tournament to build and check a roster from your owned cards.
            Drag cards onto slots, or between slots, to move them.
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
        {switching && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-label="Loading tournament" />}
        <select
          aria-label="Tournament"
          className="h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-60 sm:w-[26rem]"
          value={tournament ? String(tournament.id) : ""}
          onChange={(e) => pickTournament(e.target.value)}
          disabled={optimizing != null}
          title={optimizing ? "Stop the search first" : undefined}
        >
          <option value="">Choose a tournament…</option>
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}{c.hasSeries ? " ●" : ""}{c.simRuns ? ` (${c.simRuns})` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        </div>
      </div>

      <p className={cn("text-xs", collectionStale ? "text-warning" : "text-muted-foreground")}>
        Collection snapshot: {collectionDate ?? "not loaded"}{collectionStale ? ` — ${collectionAgeDays} days old; cards bought since are not in this pool. Refresh: pnpm import:cards SHOP COLLECTION DATE --commit, or drop both exports on /upload.` : ". Base and variant copies are checked separately."}
      </p>

      {!tournament ? (
        <p className="text-sm text-muted-foreground">
          ● marks tournaments with your observed stats. Counts are databotai sim runs. R = retired event.
        </p>
      ) : (
        <>
          {/* The event's rules, loud when one is missing or unreadable; then
              the event's facts in one muted line. */}
          <RulesStrip
            items={ruleItems}
            refreshText={tournament.restrictions?.refreshText ?? null}
            confirmed={confirmedNotes(tournament)}
            onUseSets={optimizing ? undefined : changeSets}
          >
            {confidence && (
              <span
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5"
                title={[confidence.headline, ...confidence.points.map((pt) => `${pt.label}: ${pt.text}`)].join("\n")}
              >
                <span className={cn("inline-block size-2 rounded-full", confidence.level === "good" ? "bg-positive" : confidence.level === "fair" ? "bg-warning" : "bg-negative")} />
                <span className="text-muted-foreground">Data</span>
                <span className="font-medium">{confidence.level}</span>
              </span>
            )}
          </RulesStrip>
          <p className="text-xs text-muted-foreground">
            {tournament.retired && <Badge variant="secondary" className="mr-2">Retired</Badge>}
            {[
              tournament.environment?.eraLabel ?? (tournament.envYear ? `era ${tournament.envYear}` : "PT default era"),
              tournament.stadium,
              tournament.park?.hr != null ? `park HR ×${tournament.park.hr.toFixed(2)}` : null,
              tournament.park?.avg != null ? `AVG ×${tournament.park.avg.toFixed(2)}` : null,
              tournament.mode,
              tournament.entrants ? `${tournament.entrants} teams` : null,
              tournament.staleSeriesSince
                ? `new format since ${tournament.staleSeriesSince}: its exports include older runs, so none are used`
                : meta && meta.files > 0 ? `field data: ${meta.files} runs` : "no field data yet",
            ].filter(Boolean).join(" · ")}
          </p>

          {objective && (
            <BuyBox
              upgrades={shopUpgrades}
              slots={slots}
              lineupPos={lineupPos}
              spKeys={spKeys}
              rpKeys={rpKeys}
              byId={byId}
              runsR={envFits?.runsR ?? null}
              runsL={envFits?.runsL ?? null}
              lhpShare={lhpShare}
              teamCap={(tournament?.restrictions as { teamCap?: number | null } | null)?.teamCap ?? null}
              onOpenShop={() => setView("UPG")}
            />
          )}

          <div className="rounded-lg border border-border p-3 text-xs leading-relaxed">
            <p className="font-semibold">Environment</p>
            <p className="mt-1 text-muted-foreground">
              {tournament.environment?.eraLabel} · {tournament.environment?.parkLabel}.
              {tournament.environment?.runsPerGame != null && ` Modeled environment: ${tournament.environment.runsPerGame.toFixed(2)} runs per team/game (35% left-handed batting); this is not a forecast for your roster.`}
            </p>
            {tournament.environment?.parkFactors && <p className="mt-1 text-muted-foreground">
              Park factors, left/right: AVG ×{tournament.environment.parkFactors.avgL.toFixed(3)}/×{tournament.environment.parkFactors.avgR.toFixed(3)};
              HR ×{tournament.environment.parkFactors.hrL.toFixed(3)}/×{tournament.environment.parkFactors.hrR.toFixed(3)}.
            </p>}
          </div>

          {meta && (
            <div className="rounded-lg border border-border p-3">
              <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-semibold">How teams build here</span>
                <span className="text-xs text-muted-foreground">
                  {meta.files} runs archived · ~{meta.avgTeams ?? "?"} teams/run ·
                  per team: {meta.avgSp ?? "?"} SP · {meta.avgRp ?? "?"} RP · {meta.avgBats ?? "?"} hitters
                </span>
              </div>
              {meta.construction && meta.construction.groups.length > 0 && (
                <FieldConstruction data={meta.construction} slots={(tournament?.restrictions?.slots as Record<string, number> | null | undefined) ?? null} />
              )}
              <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                {(["bats", "arms"] as const).map((kind) => (
                  <div key={kind}>
                    <div className="mb-0.5 font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">
                      most-used {kind === "bats" ? "hitters" : "pitchers"}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {meta.topCards
                        .filter((c) => (kind === "arms") === c.isPitcher)
                        .slice(0, 8)
                        .map((c) => (
                          <span
                            key={c.cardId}
                            className="cursor-default whitespace-nowrap"
                            onMouseEnter={(e) => {
                              const mine = byId.get(c.cardId);
                              setPeek(peekFrom(e.currentTarget, {
                                cardId: c.cardId,
                                title: c.name,
                                sub: `${c.pos} · used by ${c.teams} teams (${c.pct}%)`,
                                isPitcher: c.isPitcher,
                                ratings: mine?.ratings ?? null,
                                stat: mine ? projLine(c.isPitcher, mine.proj) : (c.isPitcher ? `${ip(c.ip)} IP here` : `${c.pa.toLocaleString()} PA here`),
                                extra: mine ? (c.isPitcher ? `${ip(c.ip)} IP here` : `${c.pa.toLocaleString()} PA here`) : null,
                              }));
                            }}
                            onMouseLeave={() => setPeek(null)}
                          >
                            {c.name} <span className="text-muted-foreground">{c.pct}%</span>
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            {/* pool table */}
            <div
              className="flex min-w-0 flex-col gap-2"
              onDragOver={(e) => { if (dragPayload?.startsWith("slot:")) e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); dropOnPool(e.dataTransfer.getData("text/plain")); }}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                {(["FIELD", "HIT", "PIT", "UPG"] as View[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => { setView(v); setPosFilter("ALL"); setSortBy("proj"); }}
                    className={cn(
                      "rounded-md border border-border px-3 py-1 text-xs font-semibold",
                      view === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {v === "FIELD" ? "Field" : v === "HIT" ? "Hitters" : v === "PIT" ? "Pitchers" : "Shop"}
                  </button>
                ))}
                <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 w-36 text-xs" />
                {view !== "UPG" && view !== "FIELD" && (view === "HIT" ? ["ALL", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"] : ["ALL", "SP", "RP"]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPosFilter(p)}
                    className={cn(
                      "rounded-full border border-border px-2 py-0.5 text-[11px]",
                      posFilter === p ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  popoverTarget="build-how"
                  className="ml-auto inline-flex items-center gap-1 rounded px-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <Info className="size-3.5" aria-hidden /> How these numbers work
                </button>
              </div>
              <HowTheNumbersWork env={env} tournament={tournament} hasMeasuredHands={meta?.lhpBfShare != null} ratingScale={ratingScale} />
              <SetFilter value={sets} onChange={changeSets} allowed={ruleTypes} counts={setCounts} disabled={optimizing != null} disabledTitle="Wait for the search to finish (or Stop it) before changing sets" />
              {(locks.size > 0 || bans.size > 0) && (
                <div className="flex flex-wrap items-center gap-1 text-[11px]">
                  {[...locks].map((id) => <button key={`l${id}`} type="button" onClick={() => toggleLock(id)} className="rounded bg-positive/20 px-1.5 py-0.5" title="Locked — click to unlock">🔒 {byId.get(id)?.name ?? `#${id}`} ×</button>)}
                  {[...bans].map((id) => <button key={`b${id}`} type="button" onClick={() => toggleBan(id)} className="rounded bg-negative/20 px-1.5 py-0.5" title="Banned — click to allow">⛔ {byId.get(id)?.name ?? `#${id}`} ×</button>)}
                  <button type="button" onClick={() => { setLocks(new Set()); setBans(new Set()); }} className="text-muted-foreground underline">clear</button>
                  <span className="text-muted-foreground">Every fill and Optimise keeps locked cards and skips banned ones.</span>
                </div>
              )}

              {view === "FIELD" ? (
                <FieldView
                  lineupPos={lineupPos}
                  slots={slots}
                  byId={byId}
                  pool={pool.filter((c) => !bans.has(c.cardId))}
                  upgrades={shopUpgrades}
                  runsR={envFits?.runsR ?? null}
                  runsL={envFits?.runsL ?? null}
                  lhpShare={lhpShare}
                  onPick={(slot, pos) => {
                    setSelected(slot);
                    setView("HIT");
                    setPosFilter(pos === "DH" ? "ALL" : pos);
                    setSortBy("runs");
                    toast({ message: `Picking for ${slotLabel(slot)}: sorted by bat + glove at ${pos}. Click a card to place it.` });
                  }}
                />
              ) : view !== "UPG" ? (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <Th label="Card" right={false} />
                        <Th label={view === "PIT" ? "Role" : "Pos"} right={false} />
                        <Th id="val" label="VAL" />
                        <Th id="fit" label="Fit" title="0–99 percentile of Runs within this legal pool (bats: with best-position defence)" />
                        <Th id="runs" label="Runs" title="Calibrated runs per 700 PA in this event's era and park, observed play blended in by precision — the number the optimiser uses" />
                        <Th id="proj" label={view === "PIT" ? "pFIP" : "pWOBA"} title="Projected in this event's era and park (curve model, calibrated)" />
                        <Th id="pvl" label="vL" title="Projection vs LHP/LHB" />
                        <Th id="pvr" label="vR" title="Projection vs RHP/RHB" />
                        <Th id="obs" label="Obs" title="Observed in this tournament only" />
                        <Th id="pa" label={view === "PIT" ? "IP" : "PA"} title="Observed volume in this tournament" />
                      </tr>
                    </thead>
                    <tbody className="font-mono text-[12.5px] leading-tight [font-variant-numeric:tabular-nums]">
                      {rows.slice(0, 400).map((c) => {
                        const inUse = slotOrder.some((k) => slots[k] === c.cardId);
                        return (
                          <tr
                            key={c.cardId}
                            draggable
                            onDragStart={(e) => startDrag(e, `card:${c.cardId}`)}
                            onDragEnd={() => { setDragPayload(null); setDragOverSlot(null); }}
                            onClick={() => clickCard(c)}
                            className={cn("cursor-pointer border-b border-border/50 hover:bg-muted/50", inUse && "bg-muted/60")}
                          >
                            <td
                              className="max-w-[220px] truncate px-1.5 py-1 font-sans"
                              onMouseEnter={(e) => peekPool(e, c)}
                              onMouseLeave={() => setPeek(null)}
                            >
                              {c.name}{dupNames.has(c.name) && c.year != null && <span className="text-muted-foreground"> ’{String(c.year).slice(2)}</span>}
                              {c.bats && <span className="ml-1 text-[10px] text-muted-foreground">{c.bats}</span>}
                              {c.cardType != null && <span className="ml-1 text-[10px] text-muted-foreground" title={CARD_TYPE_NAME[c.cardType]}>{CARD_TYPE_SHORT[c.cardType]}</span>}
                              {c.variantOwned && <button type="button" className="ml-2 rounded border px-1 text-[10px]" aria-label={`Use ${c.variant ? "base" : "variant"} ${c.name}`} disabled={!c.baseOwned} onClick={e=>{e.stopPropagation();act({ type: "set", next: { forms: { ...forms, [c.cardId]: !c.variant } }, label: `Use the ${c.variant ? "base" : "variant"} ${c.name}` });}}>{c.variant ? "VAR selected" : "Base · VAR owned"}</button>}
                              {inUse && <span className="ml-1 text-[10px] text-positive">●</span>}
                              <button type="button" title={locks.has(c.cardId) ? "Locked: Optimise must carry him (click to unlock)" : "Lock: Optimise must carry him"} aria-label={`${locks.has(c.cardId) ? "Unlock" : "Lock"} ${c.name}`} onClick={(e) => { e.stopPropagation(); toggleLock(c.cardId); }} className={cn("ml-1 rounded px-0.5 text-[11px]", locks.has(c.cardId) ? "bg-positive/20" : "opacity-30 hover:opacity-100")}>🔒</button>
                              <button type="button" title={bans.has(c.cardId) ? "Banned: Optimise will not use him (click to allow)" : "Ban: Optimise will not use him"} aria-label={`${bans.has(c.cardId) ? "Unban" : "Ban"} ${c.name}`} onClick={(e) => { e.stopPropagation(); toggleBan(c.cardId); }} className={cn("rounded px-0.5 text-[11px]", bans.has(c.cardId) ? "bg-negative/20" : "opacity-30 hover:opacity-100")}>⛔</button>
                            </td>
                            <td className="px-1.5">{c.isPitcher ? c.role ?? "P" : c.pos}</td>
                            <td className="px-1.5 text-right">{c.val ?? "—"}</td>
                            <td className="px-1.5 text-right">{fitR.get(c.cardId) ?? "—"}</td>
                            <td className="px-1.5 text-right font-semibold" title={env?.observed.some(([id]) => id === c.cardId) ? "model blended with this card's tournament play" : "model only — no tournament play on record"}>{fr(runsOf(c.cardId))}</td>
                            <td className="px-1.5 text-right">{c.isPitcher ? fmt2(c.proj.all) : fmt3(c.proj.all)}</td>
                            <td className="px-1.5 text-right text-muted-foreground">{c.isPitcher ? fmt2(c.proj.vL) : fmt3(c.proj.vL)}</td>
                            <td className="px-1.5 text-right text-muted-foreground">{c.isPitcher ? fmt2(c.proj.vR) : fmt3(c.proj.vR)}</td>
                            <td className="px-1.5 text-right" title={obsTitle(c.obs, c.isPitcher)}>
                              {c.isPitcher ? fmt2(c.obs?.fip) : fmt3(c.obs?.woba)}
                            </td>
                            <td className="px-1.5 text-right">{c.isPitcher ? ip(c.obs?.ip) : (c.obs?.pa?.toLocaleString() ?? "—")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <ShopBoard
                  upgrades={upgradeRows}
                  slots={slots}
                  lineupPos={lineupPos}
                  spKeys={spKeys}
                  rpKeys={rpKeys}
                  byId={byId}
                  runsR={envFits?.runsR ?? null}
                  runsL={envFits?.runsL ?? null}
                  lhpShare={lhpShare}
                  teamCap={(tournament?.restrictions as { teamCap?: number | null } | null)?.teamCap ?? null}
                  onPeek={peekUpgrade}
                  onLeave={() => setPeek(null)}
                />
              )}

              {view !== "UPG" && (
                <p className="text-xs text-muted-foreground">{rows.length} eligible cards{rows.length > 400 ? " (showing 400)" : ""}.</p>
              )}
            </div>

            {/* roster panel */}
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="whitespace-nowrap text-sm font-semibold" title={`${summary.filled} of ${summary.total} board slots filled (each lineup counts its own spots)`}>Roster {summary.roster}/{(tournament ? rosterSize(tournament) : null) ?? 26}</span>
                    {validation && (validation.ready ? (
                      <span className="rounded-full bg-positive/15 px-2 py-0.5 text-[11px] font-semibold text-positive" title="Legal under the rules on file · checked: value, slots, sets, years, cap, variants, positions">Legal</span>
                    ) : (
                      <button
                        type="button"
                        aria-expanded={showIssues}
                        onClick={() => setShowIssues((v) => !v)}
                        className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", validation.errors.length ? "bg-negative/15 text-negative" : "bg-warning/15 text-warning")}
                      >
                        {validation.errors.length + validation.incomplete.length} issue{validation.errors.length + validation.incomplete.length === 1 ? "" : "s"} {showIssues ? "▴" : "▾"}
                      </button>
                    ))}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="flex items-center">
                      <Button
                        size="icon" variant="ghost" className="size-8" onClick={undo} disabled={!canUndo}
                        aria-label={undoLabel ? `Undo: ${lower(undoLabel)}` : "Undo"}
                        title={undoLabel ? `Undo: ${lower(undoLabel)} (Ctrl+Z or ⌘Z)` : "Nothing to undo"}
                      >
                        <Undo2 />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="size-8" onClick={redo} disabled={!canRedo}
                        aria-label={redoLabel ? `Redo: ${lower(redoLabel)}` : "Redo"}
                        title={redoLabel ? `Redo: ${lower(redoLabel)} (Shift+Ctrl+Z or ⇧⌘Z)` : "Nothing to redo"}
                      >
                        <Redo2 />
                      </Button>
                    </span>
                    <Button size="sm" variant="outline" onClick={autoFill} disabled={optimizing != null} title="Refill the board with the greedy recommendation: locked cards kept, banned ones skipped">Reset to recommended</Button>
                    {optimizing === "quick"
                      ? <Button size="sm" onClick={stopSearch} title="Stop, and keep the best board found so far">Stop</Button>
                      : <Button size="sm" onClick={() => void optimize("quick")} disabled={optimizing != null || !objective} title={objective ? "Hill-climb from this board and a few other starts on calibrated runs, gloves priced in runs, under every rule and the glove floor, then polish the best two over every card you own. About a minute; Stop keeps the best so far." : "No run environment on file for this event"}>Optimise</Button>}
                    {optimizing === "deep"
                      ? <Button size="sm" variant="outline" onClick={stopSearch} title="Stop, and keep the best board found so far">Stop</Button>
                      : <Button size="sm" variant="outline" onClick={() => void optimize("deep")} disabled={optimizing != null || !objective} title="More starts, each climbed with Optimise's settings and a wider search, then the best three polished over every card you own. Several minutes; Stop keeps the best board so far.">Search longer</Button>}
                    <Button
                      size="sm" variant="outline" disabled={optimizing != null}
                      onClick={() => bulk({ type: "set", next: { slots: {} }, label: "Clear the board" }, { say: ({ diff }) => `Cleared the board (${plural(diff.removed.length, "player")} off).`, same: "The board is already empty." })}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <SearchProgressBar />
                {validation && !validation.ready && showIssues && (
                  <div className="mb-2 rounded border border-border p-2 text-xs" aria-live="polite">
                    <ul className="list-disc space-y-1 pl-4">
                      {validation.errors.map((e, i) => <li key={`e-${e.code}-${i}`} className="text-negative">{e.message}</li>)}
                      {validation.incomplete.map((e, i) => <li key={`i-${e.code}-${i}`} className="text-warning">{e.message}</li>)}
                    </ul>
                    <p className="mt-1 text-muted-foreground">{validation.counts.players}/{validation.counts.target ?? "?"} players · value {validation.counts.value}{tournament?.restrictions?.teamCap != null ? `/${tournament.restrictions.teamCap}` : ""} · {validation.counts.variants} variants</p>
                  </div>
                )}
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] [font-variant-numeric:tabular-nums]">
                  <Counter label="Bench" k="bench" used={shape.bench} tgt={baseline.bench} />
                  <Counter label="SP" k="sp" used={shape.sp} tgt={target.sp} />
                  <Counter label="RP" k="rp" used={shape.rp} tgt={target.rp} />
                  <button
                    type="button"
                    className="rounded border border-border px-1.5 py-0.5 hover:bg-muted"
                    title="5 starters, 7 relievers, the rest bats — L.J.'s shape for best-of-seven weeklies"
                    onClick={() => {
                      const size = (tournament ? rosterSize(tournament) : null) ?? 26;
                      changeCounts({ sp: 5, rp: 7, bench: Math.max(0, size - lineupPos.length - 12) }, "5 SP · 7 RP");
                    }}
                  >5 SP · 7 RP</button>
                  <label className="flex items-center gap-1" title="Optimise keeps at least two catchers on the roster">
                    <input type="checkbox" checked={twoCatchers} onChange={(e) => setTwoCatchers(e.target.checked)} /> 2 C
                  </label>
                  <label className="flex items-center gap-1" title="Optimise keeps a backup shortstop on the roster">
                    <input type="checkbox" checked={twoShortstops} onChange={(e) => setTwoShortstops(e.target.checked)} /> 2 SS
                  </label>
                  <label className="flex items-center gap-1" title="Optimise keeps two stamina arms (45+) in the pen">
                    <input type="checkbox" checked={twoLong} onChange={(e) => setTwoLong(e.target.checked)} /> 2 long
                  </label>
                </div>
                <div className="mb-2 text-[10.5px] text-muted-foreground">
                  Carrying <span className="font-mono">{summary.hitterCount}</span> hitters ·{" "}
                  <span className="font-mono">{summary.spUsed}</span> SP ·{" "}
                  <span className="font-mono">{summary.rpUsed}</span> RP ={" "}
                  <span className="font-mono">{summary.roster}</span> players.{" "}
                  {target.source === "observed"
                    ? `Typical here: ${target.bats} bats · ${target.sp} SP · ${target.rp} RP.`
                    : `${tournament?.staleSeriesSince ? `This event's exports include runs from before its ${tournament.staleSeriesSince} format, so none are used` : "No exports for this event yet"} — ${target.band} staff: ${target.sp} SP · ${target.rp} RP · ${target.bats} bats.`}
                </div>
                <div className="grid grid-cols-2 gap-x-3 text-xs [font-variant-numeric:tabular-nums]">
                  <div className="col-span-2" title="The objective: calibrated runs per 700 PA over both lineups (weighted by the field's pitcher handedness), rotation in full, bullpen at 0.31, bench at a tenth, gloves in runs at the slot">
                    Board runs <span className="float-right font-mono font-semibold">{fr(summary.runs)}</span>
                  </div>
                  <div>Proj wOBA <span className="float-right font-mono">{fmt3(summary.projWoba)}</span></div>
                  <div>Proj FIP <span className="float-right font-mono">{fmt2(summary.projFip)}</span></div>
                  <div>Obs wOBA <span className="float-right font-mono">{fmt3(summary.woba)}</span></div>
                  <div>Obs FIP <span className="float-right font-mono">{fmt2(summary.fip)}</span></div>
                  <div>Def (pos rtg) <span className="float-right font-mono">{summary.defAvg == null ? "—" : Math.round(summary.defAvg)}</span></div>
                </div>
              </div>

              {(["R", "L"] as const).map((hand) => (
                <div key={hand} className="rounded-lg border border-border p-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">vs {hand}HP</div>
                  {lineupPos.map((p) => (
                    <SlotRow
                      key={p} k={`${hand}:${p}`} label={p}
                      slots={slots} byId={byId} selected={selected} setSelected={setSelected} assign={assign}
                      dragOverSlot={dragOverSlot} setDragOverSlot={setDragOverSlot}
                      dragActive={dragPayload != null} startDrag={startDrag} dropOnSlot={dropOnSlot}
                      onPeek={peekSlot} clearPeek={() => setPeek(null)} issuesByCard={issuesByCard} bans={bans}
                    />
                  ))}
                  {env && <BattingOrderList order={battingOrders?.[hand] ?? null} hand={hand} />}
                </div>
              ))}

              <div className="rounded-lg border border-border p-3">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Staff</div>
                {staffKeys.map((k) => (
                  <SlotRow
                    key={k} k={k} label={k}
                    slots={slots} byId={byId} selected={selected} setSelected={setSelected} assign={assign}
                    dragOverSlot={dragOverSlot} setDragOverSlot={setDragOverSlot}
                    dragActive={dragPayload != null} startDrag={startDrag} dropOnSlot={dropOnSlot}
                    onPeek={peekSlot} clearPeek={() => setPeek(null)} issuesByCard={issuesByCard} bans={bans}
                  />
                ))}
              </div>

              <div className="rounded-lg border border-border p-3">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bench</span>
                  <span className="text-[10px] text-muted-foreground/70">{shape.bench} spots</span>
                </div>
                {benchKeys.length === 0
                  ? <div className="px-2 py-1 text-xs text-muted-foreground/60">No bench for this event — add one with +.</div>
                  : benchKeys.map((k) => (
                    <SlotRow
                      key={k} k={k} label={k}
                      slots={slots} byId={byId} selected={selected} setSelected={setSelected} assign={assign}
                      dragOverSlot={dragOverSlot} setDragOverSlot={setDragOverSlot}
                      dragActive={dragPayload != null} startDrag={startDrag} dropOnSlot={dropOnSlot}
                      onPeek={peekSlot} clearPeek={() => setPeek(null)} issuesByCard={issuesByCard} bans={bans}
                    />
                  ))}
              </div>

              <CardList slotOrder={slotOrder} slots={slots} byId={byId} />

              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Save · Export</div>
                <div className="flex gap-2">
                  <Input placeholder="Roster name" value={rosterName} onChange={(e) => setRosterName(e.target.value)} className="h-8" />
                  <Button size="sm" onClick={save} disabled={saving || summary.filled === 0}>{saving ? "Saving…" : validation?.ready ? "Save" : "Save draft"}</Button>
                </div>
                <Button size="sm" variant="outline" className="mt-2 w-full" onClick={exportLineup} disabled={summary.filled === 0}>
                  Export lineup (.txt + .csv)
                </Button>
                {savedRosters.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {savedRosters.map((r) => (
                      <button key={r.id} onClick={() => loadSaved(r)} className="rounded border border-border px-2 py-1 text-left text-xs hover:bg-muted/50">
                        {r.name} <span className="text-muted-foreground">({r.slots.length} slots)</span>
                        {r.newCards && r.newCards.length > 0 && (
                          <span
                            className="ml-1.5 rounded bg-primary/15 px-1 text-[10px] font-semibold text-primary"
                            title={`Saved on the ${r.builtOn ? date(r.builtOn) : "older"} collection. Cards you've got since that fit this event: ${newCardsLine(r, 12)}. Load it and Optimise to see what they add.`}
                          >
                            {r.newCards.length} new {r.newCards.length === 1 ? "card fits" : "cards fit"}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
          {peek && <CardPeek p={peek} scale={ratingScale} />}
        </>
      )}
    </div>
  );
}

/** The recommended batting order under a lineup, and how it compares with the usual one. */
function BattingOrderList({ order, hand }: { order: BattingOrder | null; hand: "R" | "L" }) {
  if (!order) return <div className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">Fill the lineup to see a batting order.</div>;
  const gain = order.runs - order.bookRuns;
  const same = order.rows.every((r, i) => r.pos === order.book[i].pos);
  const usual = order.book.map((r, i) => `${i + 1} ${r.name}`).join(" · ");
  return (
    <div className="mt-2 border-t border-border pt-2">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="font-semibold uppercase tracking-wide" title={`Every order is played through nine innings on the run model (this event's era and park, each batter's ratings vs ${hand}HP); this one scores the most. Speed and steals are not in it.`}>Batting order</span>
        <span className="text-right" title={`The usual order (The Book: the best three at 1, 2 and 4, on-base first, power 4-5): ${usual}. ${order.bookRuns.toFixed(2)} runs per nine innings.`}>
          {same || gain < 0.005 ? "same as the usual order" : `+${gain.toFixed(2)} runs/9 over the usual order`}
        </span>
      </div>
      <ol className="space-y-0.5 text-xs">
        {order.rows.map((r, i) => (
          <li key={`${r.pos}-${r.cardId}`} className="flex items-baseline gap-1.5">
            <span className="w-3 shrink-0 text-right font-mono text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 truncate">{r.name}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground">{r.pos}</span>
            <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground" title="Projected OBP / SLG against this pitcher hand, in this event">{fmt3(r.obp)}/{fmt3(r.slg)}</span>
          </li>
        ))}
      </ol>
      <div className="mt-1 text-right font-mono text-[10px] text-muted-foreground" title="Expected runs per nine innings for this lineup in this order, on the calibrated scale">{order.runs.toFixed(2)} runs/9</div>
    </div>
  );
}

function SlotRow({
  k, label, slots, byId, selected, setSelected, assign,
  dragOverSlot, setDragOverSlot, dragActive, startDrag, dropOnSlot, onPeek, clearPeek, issuesByCard, bans,
}: {
  k: SlotKey;
  label: string;
  slots: Record<SlotKey, number | null>;
  byId: Map<number, BuilderCard>;
  selected: SlotKey | null;
  setSelected: (k: SlotKey) => void;
  assign: (k: SlotKey, id: number | null) => void;
  dragOverSlot: SlotKey | null;
  setDragOverSlot: (k: SlotKey | null) => void;
  dragActive: boolean;
  startDrag: (e: React.DragEvent, payload: string) => void;
  dropOnSlot: (target: SlotKey, payload: string) => void;
  onPeek: (e: React.MouseEvent<HTMLElement>, id: number) => void;
  clearPeek: () => void;
  /** Rule issues that name this slot's card. */
  issuesByCard: Map<number, string[]>;
  bans: Set<number>;
}) {
  const id = slots[k] ?? null;
  const card = id != null ? byId.get(id) : null;
  const issues = id != null ? issuesByCard.get(id) : undefined;
  return (
    <div
      onClick={() => setSelected(k)}
      draggable={card != null}
      onDragStart={(e) => { if (card) startDrag(e, `slot:${k}`); }}
      onDragEnd={() => setDragOverSlot(null)}
      onDragOver={(e) => { if (dragActive) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverSlot !== k) setDragOverSlot(k); } }}
      onDragLeave={() => { if (dragOverSlot === k) setDragOverSlot(null); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dropOnSlot(k, e.dataTransfer.getData("text/plain")); }}
      className={cn(
        "flex items-center justify-between rounded px-2 py-0.5 text-sm",
        card ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        selected === k ? "bg-foreground/10 ring-1 ring-foreground/30" : "hover:bg-muted/40",
        dragOverSlot === k && "ring-2 ring-info/70 bg-info/10",
        issues && "border-l-2 border-negative",
      )}
    >
      <span className="w-8 shrink-0 font-mono text-[11px] text-muted-foreground">{label}</span>
      <span
        className={cn("min-w-0 flex-1 truncate px-1", !card && "text-muted-foreground/60")}
        onMouseEnter={(e) => { if (id != null) onPeek(e, id); }}
        onMouseLeave={clearPeek}
      >
        {card ? card.name : "empty"}
        {card?.cardType != null && <span className="ml-1 text-[10px] text-muted-foreground" title={CARD_TYPE_NAME[card.cardType]}>{CARD_TYPE_SHORT[card.cardType]}</span>}
      </span>
      {issues && <span className="mr-1 text-xs text-negative" title={issues.join("\n")} aria-label={issues.join("; ")}>⚠</span>}
      {id != null && bans.has(id) && <span className="mr-1 text-xs text-negative" title="Banned — Optimise will replace him" aria-label="banned">⛔</span>}
      {card && (
        <span className="mr-1 font-mono text-[11px] text-muted-foreground [font-variant-numeric:tabular-nums]">
          {card.isPitcher ? fmt2(card.proj.all) : fmt3(card.proj.all)}
        </span>
      )}
      {card && (
        <button
          onClick={(e) => { e.stopPropagation(); assign(k, null); }}
          className="ml-0.5 text-xs text-muted-foreground hover:text-foreground"
          aria-label={`clear ${label}`}
        >
          ×
        </button>
      )}
    </div>
  );
}

/**
 * "How these numbers work": the method notes that were two long footnotes (the
 * environment box and the foot of the pool), behind one (i) (UI plan B4). A
 * native popover: it closes on Escape or a click outside.
 */
function HowTheNumbersWork({ env, tournament, hasMeasuredHands, ratingScale }: {
  env: BuilderEnv | null;
  tournament: TournamentInfo;
  hasMeasuredHands: boolean;
  ratingScale: number;
}) {
  const hands = env
    ? `Lineups are weighted ${Math.round((1 - env.lhpShare) * 100)}/${Math.round(env.lhpShare * 100)} vs RHP/LHP and arms face ${Math.round(env.lhbShare * 100)}% left-handed bats${hasMeasuredHands ? ", measured off this event's exports" : tournament.staleSeriesSince ? `: the defaults, since this event's exports include runs from before its ${tournament.staleSeriesSince} format` : ": the defaults, with no exports for this event yet"}.`
    : "This event has no run environment on file, so Fit is the ratings composite and there are no Runs.";
  return (
    <div
      id="build-how"
      popover="auto"
      className="m-auto max-h-[80dvh] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-border bg-card p-4 text-xs leading-relaxed text-card-foreground shadow-xl backdrop:bg-black/30"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="text-sm font-semibold">How these numbers work</p>
        <button type="button" popoverTarget="build-how" popoverTargetAction="hide" aria-label="Close" className="rounded p-0.5 text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      <ul className="list-disc space-y-1.5 pl-4">
        <li><b>Runs</b> are calibrated model runs per 700 PA in this event&apos;s era and park, with this tournament&apos;s observed play blended in by precision (K = 5,000). {hands} <b>Fit</b> is the 0–99 percentile of Runs within this legal pool.</li>
        <li><b>pWOBA / pFIP</b> are the projected lines here. <b>Obs</b> and <b>PA / IP</b> are this tournament only.</li>
        <li><b>Reset to recommended</b> is the greedy fill. <b>Optimise</b> hill-climbs from your board and a few other starts on runs, with gloves priced in runs under the glove floor (70, LF 50, none at 1B), then polishes its best two boards over every card you own. <b>Search longer</b> tries more starts and a wider search, and polishes its best three: it matches Claude's full builds. Both keep locked cards and skip banned ones.</li>
        <li><b>Rules:</b> the value window, card years, card sets and slot tiers are checked in the pool; the cap, the variant limit and the roster size on the board. Legal means legal under the rules on file.</li>
        <li><b>Shop:</b> legal cards you don&apos;t own, ranked on the runs each would add to this board (one-card swap, glove at the spot, lineups weighted by the field&apos;s pitcher hand, relief at 0.31). Prices are from your latest shop upload; new drops are badged NEW for a week. Two buys at the same spot don&apos;t add.</li>
        <li>Hover a name for the card face (a full bar = {ratingScale}, the game&apos;s current ceiling); drag a name onto a slot to roster him. A variant is scored on the ratings your collection export recorded for that copy.</li>
      </ul>
    </div>
  );
}
