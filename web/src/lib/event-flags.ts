/**
 * An event's command-line flags (env-roster, roster-diff), read one way so the
 * two scripts get the same defaults. env-roster.ts documents each flag. Pure;
 * lib/event-model turns them into a pool and an objective.
 */
import type { RosterRules } from "@/lib/roster-rules";
import { LJ_FLOOR, parsePosFloor, type PosFloor } from "@/lib/pos-floor";
import { BENCH_WEIGHT_DEFAULT } from "@/lib/roster-objective";
import { OBS_K_DEFAULT } from "@/lib/analytics/calibration";

/** The flags that decide an event's pool and objective. See env-roster.ts for what each one is for. */
export interface EventFlags {
  year: number | null;
  /** The era correction (calibration.ts ERA_SLOPES) is on unless --no-era-correct; PT default reads as 2010. */
  eraYear: number | null;
  park: string | null;
  parkYear: number | null;
  dh: boolean;
  min: number | null;
  max: number | null;
  cap: number | null;
  size: number;
  name: string;
  variantCap: number | null;
  yearMin: number | null;
  yearMax: number | null;
  poolCsv: string | null;
  assumeVariant: number[];
  assumeOwned: number[];
  poolIds: number[];
  ban: string[];
  noLe: boolean;
  cardTypes: Set<number>;
  anySet: boolean;
  slots: Record<string, number> | null;
  field: boolean;
  minDef: number;
  minPos: PosFloor;
  roleTrust: number;
  obsK: number;
  obsExclude: string[];
  lhpShare: number | null;
  lhbShare: number | null;
  pitchLhb: number | null;
  noGloveScale: boolean;
  noTeamWeights: boolean;
  rpWeight: number | null;
  spWeight: number | null;
  benchWeight: number;
  series: string | null;
  bats: number | null;
  sp: number | null;
  rp: number | null;
  candidateLimit: number | null;
  minCatchers: number;
  minShortstops: number;
  minLongMen: number;
  backups: boolean;
}

export function readEventFlags(argv: readonly string[]): EventFlags {
  const flag = (k: string) => argv.includes(`--${k}`);
  const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
  const num = (k: string, d: number | null = null) => { const v = val(k); return v == null ? d : Number(v); };
  const ids = (k: string) => (val(k) ?? "").split(",").map((x) => Number(x.trim())).filter((n) => n > 0);
  const names = (k: string) => (val(k) ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  const year = num("year");
  const slots = (() => {
    const v = val("slots");
    if (!v) return null;
    const out: Record<string, number> = {};
    for (const part of v.split(/[,\s]+/).filter(Boolean)) {
      const m = /^([PDGSBI])(\d+)$/i.exec(part.trim());
      if (!m) throw new Error(`--slots: could not read "${part}" (want e.g. G13,I13)`);
      out[m[1].toUpperCase()] = Number(m[2]);
    }
    return out;
  })();
  return {
    year,
    eraYear: flag("no-era-correct") ? null : (year ?? 2010),
    park: val("park") ?? null,
    parkYear: num("park-year"),
    dh: flag("dh"),
    min: num("min"),
    max: num("max"),
    cap: num("cap"),
    size: num("size", 26)!,
    name: val("name", "ad-hoc event")!,
    variantCap: num("variant-cap"),
    yearMin: num("card-year-min"),
    yearMax: num("card-year-max"),
    poolCsv: val("pool") ?? null,
    assumeVariant: ids("assume-variant"),
    assumeOwned: ids("assume-owned"),
    poolIds: ids("pool-ids"),
    ban: names("ban"),
    noLe: flag("no-le"),
    cardTypes: new Set((val("card-types") ?? "").split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0)),
    anySet: flag("any-set"),
    slots,
    field: flag("field"),
    minDef: num("min-def", 0.6)!,
    minPos: parsePosFloor(val("min-pos")) ?? LJ_FLOOR,
    roleTrust: num("role-trust", 1)!,
    obsK: num("obs-k", OBS_K_DEFAULT)!,
    obsExclude: (val("obs-exclude") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    lhpShare: num("lhp-share"),
    lhbShare: num("lhb-share"),
    pitchLhb: num("pitch-lhb"),
    noGloveScale: flag("no-glove-scale"),
    noTeamWeights: flag("no-team-weights"),
    rpWeight: num("rp-weight"),
    spWeight: num("sp-weight"),
    benchWeight: num("bench-weight", BENCH_WEIGHT_DEFAULT)!,
    series: val("series") ?? null,
    bats: num("bats"),
    sp: num("sp"),
    rp: num("rp"),
    candidateLimit: num("candidate-limit"),
    minCatchers: num("min-catchers", 2)!,
    minShortstops: num("min-ss", 0)!,
    minLongMen: num("min-long", 2)!,
    backups: !flag("no-backups"),
  };
}

export function eventRules(f: EventFlags): RosterRules {
  return {
    name: f.name, dh: f.dh, ratingsMin: f.min, ratingsMax: f.max,
    cardYearMin: f.yearMin, cardYearMax: f.yearMax, isDraft: false,
    restrictions: { teamCap: f.cap, cards: f.size, variantCap: f.variantCap, variantsAllowed: f.variantCap !== 0, slots: f.slots, noLimitedEdition: f.noLe },
  };
}
