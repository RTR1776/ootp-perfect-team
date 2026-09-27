/**
 * How the field spends its card tiers in a tournament.
 *
 * Per team: how many Perfect / Diamond / … cards went to lineup bats, bench
 * bats, starters and relievers, with the team's record, clan, and whether it
 * is L.J.'s. import:observed builds this from each export: the rows carry ORG,
 * VAL and the stat line. Per series it is summarised into groups for /build:
 * - every team
 * - the best quarter by record in each run
 * - each clan with enough entries
 * - L.J.
 *
 * Each group also carries its rotation's handedness and its lineups' (L.J.:
 * in a left-handed power park, stack the rotation one way and make the
 * field burn its platoons), and how often it used an opener, with the
 * openers' record against everyone else's.
 *
 * It also measures the playing time behind the roster objective's weights:
 * what a starter and a reliever face, each as a multiple of a lineup slot's
 * PA (roster-objective spWeight / rpWeight). In Daily All-Star Hardware Slots
 * a starter faced 55 batters to a lineup slot's 45 PA, so the default 1.0
 * undersold the rotation there.
 */
import { tierCode, TIER_ORDER, type TierCode } from "@/lib/roster-rules";
import { isMyOrg } from "@/lib/my-team";
import type { LeagueStint } from "@/lib/ingest/league";

export const ROLES = ["bats", "bench", "sp", "rp"] as const;
export type Role = (typeof ROLES)[number];
export type TierRoles = Partial<Record<TierCode, Record<Role, number>>>;

export interface TeamBuild {
  org: string;
  clan: string | null;
  mine: boolean;
  w: number;
  l: number;
  tiers: TierRoles;
  /** The team's plate appearances, and what its starters and relievers faced. */
  pa: number;
  spBf: number;
  rpBf: number;
  /** Starters and relievers who faced a batter. */
  sp: number;
  rp: number;
  /** Starters by the arm they throw with; lineup bats by the side they hit from. */
  hands: Hands;
  /** Started a reliever-length pitcher: 2+ starts at 2.2 innings a start or fewer. */
  opener: boolean;
}

export interface Hands { spL: number; spR: number; batsL: number; batsR: number; batsS: number }

export interface GroupBuild {
  key: string;
  label: string;
  /** Team-entries in the group. */
  n: number;
  winPct: number | null;
  /** Average cards per team at each tier and role. */
  tiers: TierRoles;
  /** Average starters by hand and lineup bats by hand, per team. */
  hands: Hands;
  /** Share of the group's teams that used an opener. */
  openerShare: number;
}

export interface SeriesBuild {
  files: number;
  teams: number;
  /** A starter's / reliever's batters faced over a lineup slot's PA. Null when too little play. */
  spWeight: number | null;
  rpWeight: number | null;
  /** Teams that used an opener, and their record against everyone else's. */
  openers: { teams: number; winPct: number | null; othersWinPct: number | null };
  groups: GroupBuild[];
}

/** A bat under this share of a full-time slot's PA was a bench bat. */
const BENCH_SHARE = 0.25;
const CLAN_LABEL: Record<string, string> = { HOTL: "HotL" };
const MIN_CLAN_ENTRIES = 3;

const emptyRoles = (): Record<Role, number> => ({ bats: 0, bench: 0, sp: 0, rp: 0 });

/** One run's teams, from the export's rows (free agents and unnamed rows skipped). */
export function teamBuilds(stints: readonly LeagueStint[]): TeamBuild[] {
  const byOrg = new Map<string, LeagueStint[]>();
  for (const s of stints) {
    if (!s.org || s.org === "-" || s.isFreeAgent) continue;
    const list = byOrg.get(s.org) ?? [];
    list.push(s);
    byOrg.set(s.org, list);
  }
  const out: TeamBuild[] = [];
  for (const [org, rows] of byOrg) {
    const bats = rows.filter((s) => !s.isPitcher), arms = rows.filter((s) => s.isPitcher);
    const pa = bats.reduce((a, s) => a + (s.pa || 0), 0);
    const cut = BENCH_SHARE * (pa / 9);
    const t: TeamBuild = {
      org, clan: rows[0].clan, mine: isMyOrg(org), w: 0, l: 0, tiers: {}, pa, spBf: 0, rpBf: 0, sp: 0, rp: 0,
      hands: { spL: 0, spR: 0, batsL: 0, batsR: 0, batsS: 0 }, opener: false,
    };
    const count = (s: LeagueStint, role: Role) => {
      if (s.val == null || !Number.isFinite(s.val)) return;
      const tier = tierCode(s.val);
      (t.tiers[tier] ??= emptyRoles())[role] += 1;
    };
    for (const s of bats) {
      const lineup = (s.pa || 0) >= cut && s.pa > 0;
      count(s, lineup ? "bats" : "bench");
      if (lineup) {
        if (s.bats === "L") t.hands.batsL += 1;
        else if (s.bats === "S") t.hands.batsS += 1;
        else if (s.bats === "R") t.hands.batsR += 1;
      }
    }
    for (const s of arms) {
      const g = s.stats.G_p ?? 0, gs = s.stats.GS_p ?? 0, bf = s.stats.BF ?? 0;
      const starter = g > 0 ? gs >= 1 && gs >= 0.5 * g : s.pos === "SP";
      count(s, starter ? "sp" : "rp");
      t.w += s.stats.W ?? 0;
      t.l += s.stats.L ?? 0;
      if (bf > 0) {
        if (starter) { t.spBf += bf; t.sp += 1; } else { t.rpBf += bf; t.rp += 1; }
      }
      if (starter && bf > 0) {
        if (s.throws === "L") t.hands.spL += 1;
        else if (s.throws === "R") t.hands.spR += 1;
      }
      if (gs >= 2 && (s.ip || 0) / gs <= 2.2) t.opener = true;
    }
    out.push(t);
  }
  return out;
}

function average(label: string, key: string, teams: TeamBuild[]): GroupBuild {
  const tiers: TierRoles = {};
  for (const tier of [...TIER_ORDER].reverse()) {
    const sum = emptyRoles();
    let any = false;
    for (const t of teams) {
      const c = t.tiers[tier];
      if (!c) continue;
      any = true;
      for (const r of ROLES) sum[r] += c[r];
    }
    if (any) tiers[tier] = Object.fromEntries(ROLES.map((r) => [r, Math.round((sum[r] / teams.length) * 10) / 10])) as Record<Role, number>;
  }
  const hands = Object.fromEntries((["spL", "spR", "batsL", "batsR", "batsS"] as const).map((k) =>
    [k, Math.round((teams.reduce((a, t) => a + t.hands[k], 0) / teams.length) * 10) / 10])) as unknown as Hands;
  return {
    key, label, n: teams.length, winPct: winPct(teams), tiers, hands,
    openerShare: Math.round((teams.filter((t) => t.opener).length / teams.length) * 100) / 100,
  };
}

function winPct(teams: TeamBuild[]): number | null {
  const w = teams.reduce((a, t) => a + t.w, 0), l = teams.reduce((a, t) => a + t.l, 0);
  return w + l > 0 ? Math.round((w / (w + l)) * 1000) / 1000 : null;
}

/** A series' runs (one array of teams per export) summarised for /build. */
export function summariseSeries(runs: TeamBuild[][]): SeriesBuild {
  runs = runs.filter((teams) => teams.length > 0);
  const all = runs.flat();
  if (!all.length) return { files: 0, teams: 0, spWeight: null, rpWeight: null, openers: { teams: 0, winPct: null, othersWinPct: null }, groups: [] };
  const top = runs.flatMap((teams) =>
    [...teams].sort((a, b) => b.w - a.w || (b.w / Math.max(1, b.w + b.l)) - (a.w / Math.max(1, a.w + a.l))).slice(0, Math.ceil(teams.length / 4)));
  const groups: GroupBuild[] = [average("Every team", "all", all), average("Best quarter by record", "top", top)];
  const clans = new Map<string, TeamBuild[]>();
  for (const t of all) if (t.clan) clans.set(t.clan, [...(clans.get(t.clan) ?? []), t]);
  for (const [clan, teams] of [...clans].sort((a, b) => b[1].length - a[1].length)) {
    if (teams.length >= MIN_CLAN_ENTRIES) groups.push(average(CLAN_LABEL[clan] ?? clan, `clan:${clan}`, teams));
  }
  const mine = all.filter((t) => t.mine);
  if (mine.length) groups.push(average("You", "mine", mine));

  const pa = all.reduce((a, t) => a + t.pa, 0);
  const slotPa = all.length ? pa / 9 / all.length : 0;
  const per = (bf: number, n: number) => (n > 0 && slotPa > 0 ? Math.round((bf / n / slotPa) * 100) / 100 : null);
  const spN = all.reduce((a, t) => a + t.sp, 0), rpN = all.reduce((a, t) => a + t.rp, 0);
  const enough = all.length >= 8;
  const openers = all.filter((t) => t.opener), others = all.filter((t) => !t.opener);
  return {
    files: runs.length,
    teams: all.length,
    spWeight: enough ? per(all.reduce((a, t) => a + t.spBf, 0), spN) : null,
    rpWeight: enough ? per(all.reduce((a, t) => a + t.rpBf, 0), rpN) : null,
    openers: { teams: openers.length, winPct: winPct(openers), othersWinPct: winPct(others) },
    groups,
  };
}
