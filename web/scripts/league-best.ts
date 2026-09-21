/**
 * The best 26 out of the WHOLE COLLECTION for a theme-week run environment —
 * not out of the 26 already rostered.
 *
 * The point L.J. made: he owns ~3,500 cards, and an older card that was never
 * worth a slot in the league's default 2010 environment can be worth one in
 * 1989, because the environment moves what each rating buys. So every card gets
 * scored, and the report carries a Δenv column — 1989 value minus 2010 value at
 * a neutral park — which is the number that says "this card is good HERE",
 * separate from "this card is good".
 *
 *   pnpm league:best --year 1989 --base-year 2010 --park "Truist Field" --park-year 2026
 *
 * --league / --team / --on / --upload all DEFAULT TO THE NEWEST DATA rather
 * than to the week they were written against, and what they resolved to is
 * printed. There is no --dh: the DH slot is unconditional.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { eraTable, parkRow, parkTwins } from "@/lib/analytics/runenv-view";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { marginalRatings, roleRuns } from "@/lib/analytics/card-value";
import { rateLine, solveEnv, blendPark, applyPark } from "@/lib/analytics/run-env";
import { HIT_POS } from "@/lib/roster-fill";
import { readFileSync } from "node:fs";
import { mergeCopyRatings } from "@/lib/ingest/collection";
import { resolveLeagueScope } from "@/lib/league-scope";

const asRows = <T,>(r: any): T[] => (Array.isArray(r) ? r : r.rows ?? []);
const argv = process.argv.slice(2);
const val = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const num = (k: string, d: number | null = null) => { const v = val(k); return v == null ? d : Number(v); };

const YEAR = val("year", "1989")!, BASE = val("base-year", "2010")!;
const PARK = val("park") ?? null, PARK_YEAR = num("park-year");
const MINVAL = num("min-value", 0)!;
const NSP = num("sp", 5)!, NRP = num("rp", 7)!, NBAT = num("bats", 14)!;
/*
 * These four used to be hardcoded to the week the script was written
 * (upload 65, HD453, 2026-09-13) and went stale in place: a run would score
 * a months-old collection against a team that had since moved leagues and
 * report it without complaint. lib/league-scope resolves them from the newest
 * data — park-sweep had the same four pinned to its own week, so the
 * resolution lives there rather than in either script. A flag still wins.
 */
const UPLOAD_ARG = num("upload"), LEAGUE_ARG = val("league") ?? null;
const TEAM_ARG = val("team") ?? null, ON_ARG = val("on") ?? null;
let UPLOAD = 0, LEAGUE = "", TEAM = "", ON = "";

async function resolveScope() {
  const sc = await resolveLeagueScope({ league: LEAGUE_ARG, team: TEAM_ARG, on: ON_ARG, upload: UPLOAD_ARG });
  ({ league: LEAGUE, team: TEAM, on: ON, upload: UPLOAD } = sc);
  console.log(sc.summary);
  for (const n of sc.notes) console.log(`  !! ${n}`);
}
const SHOW = num("show", 30)!;
const f1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;
/** vs-RHP is ~70% of plate appearances; roster-fill uses the same 0.3 weight. */
const WL = 0.3;

async function main() {
  await resolveScope();
  const era = eraTable[YEAR]!, eraBase = eraTable[BASE]!;
  const pr = PARK ? parkRow(PARK, PARK_YEAR) : null;
  if (PARK && !pr) console.log(`!! no factors on file for ${PARK_YEAR} ${PARK}`);
  const twins = parkTwins(PARK);
  if (twins.length) console.log(`!! NAME COLLISION: "${PARK}" (hrL ${pr?.hrL} hrR ${pr?.hrR}) is not ${twins.join(" / ")}. Check which one your park picker is showing.`);
  /** Home park, half the games. */
  const half = pr ? { avgL: 1 + (pr.avgL! - 1) / 2, avgR: 1 + (pr.avgR! - 1) / 2,
    hrL: 1 + (pr.hrL! - 1) / 2, hrR: 1 + (pr.hrR! - 1) / 2,
    d2: 1 + (pr.d2! - 1) / 2, d3: 1 + (pr.d3! - 1) / 2 } as any : null;

  const bp = half ? blendPark(half, 0.35) : null;
  const solved = solveEnv(era.rates, era.rg, bp);
  const line = rateLine(bp ? applyPark(era.rates, bp) : era.rates, solved.RG);
  const lineB = rateLine(eraBase.rates, solveEnv(eraBase.rates, eraBase.rg, null).RG);
  console.log(`\n=== whole-collection board · ${YEAR} RE ${pr ? `· ${PARK_YEAR} ${PARK} (home only, half weight)` : "· neutral park"} ===`);
  console.log(`${YEAR}: R/G ${solved.RG.toFixed(2)}  K% ${(line.kPct * 100).toFixed(1)}  HR/PA ${(line.hrPa * 100).toFixed(2)}%  AVG ${line.avg.toFixed(3)} OBP ${line.obp.toFixed(3)} SLG ${line.slg.toFixed(3)}`);
  console.log(`${BASE}: K% ${(lineB.kPct * 100).toFixed(1)}  HR/PA ${(lineB.hrPa * 100).toFixed(2)}%  AVG ${lineB.avg.toFixed(3)} OBP ${lineB.obp.toFixed(3)} SLG ${lineB.slg.toFixed(3)}   (the league's usual environment)`);

  /* ---- pool: every card owned, joined for handedness and role ---- */
  const raw = asRows<any>(await db.execute(sql`
    select cc.id row_id, cc.card_id, coalesce(c.name, cc.name) name, coalesce(c.card_value, cc.card_value) val,
           c.tier, c.year, c.bats, c.throws, c.is_pitcher, c.pitcher_role, c.position,
           c.ratings ratings, cc.ratings copy_ratings, cc.is_variant, cc.match_distance, cc.pos cpos
    from collection_cards cc
    left join cards c on c.card_id = cc.card_id
    where cc.upload_id = ${UPLOAD}`));
  /**
   * The collection upload is a snapshot and the roster has moved since, so any
   * card currently rostered is folded in whether or not it was in that upload.
   * Without this the "dropping" list prints bare card ids.
   */
  const extra = asRows<any>(await db.execute(sql`
    select distinct st.cid card_id, coalesce(c.name, st.name) name, c.card_value val, c.tier, c.year,
           c.bats, c.throws, c.is_pitcher, c.pitcher_role, c.position, c.ratings,
           null::jsonb copy_ratings, false is_variant, st.pos cpos
    from league_stints st
    join league_snapshots ls on ls.id = st.snapshot_id
    left join cards c on c.card_id = st.cid
    where ls.league = ${LEAGUE} and ls.split = 'all' and ls.captured_on = ${ON} and st.org = ${TEAM}`));
  const seen = new Set(raw.map((r) => Number(r.card_id)));
  for (const e of extra) if (!seen.has(Number(e.card_id))) raw.push(e);
  /** Mid-week roster moves the weekly export has not caught up with. */
  const rosterNow = new Set(extra.map((e) => Number(e.card_id)));
  const EDIT = val("roster-edit");
  if (EDIT) {
    const e = JSON.parse(readFileSync(EDIT, "utf8"));
    for (const nm of e.drop ?? []) {
      const hit = raw.find((r) => r.name === nm);
      if (hit) rosterNow.delete(Number(hit.card_id));
    }
    for (const a of e.add ?? []) {
      /**
       * A hand-entered card usually also appears in the collection export as an
       * unmatched row with no position ratings. The hand-entered copy is the
       * better one — it has the full card screen behind it — so the export's
       * row is dropped rather than scored alongside it as a second player.
       */
      for (let i = raw.length - 1; i >= 0; i--) if (raw[i].name === a.name) raw.splice(i, 1);
      if (!seen.has(Number(a.cardId))) raw.push({ card_id: a.cardId, name: a.name, val: a.val, tier: a.val >= 100 ? "Perfect" : "Diamond",
        year: a.year ?? null, bats: a.bats, is_pitcher: a.isPitcher, pitcher_role: a.isPitcher ? a.pos : null,
        position: a.isPitcher ? null : a.pos, ratings: a.ratings, copy_ratings: null, is_variant: false, cpos: a.pos });
      rosterNow.add(Number(a.cardId));
    }
    for (const nm of e.addFromCards ?? []) {
      const [c] = asRows<any>(await db.execute(sql`
        select card_id, name, card_value val, tier, year, bats, is_pitcher, pitcher_role, position, ratings
        from cards where name = ${nm} order by card_value desc limit 1`));
      if (!c) { console.log(`!! ${nm} not in the cards table`); continue; }
      if (!seen.has(Number(c.card_id))) raw.push({ ...c, copy_ratings: null, is_variant: false, cpos: c.is_pitcher ? c.pitcher_role : c.position });
      rosterNow.add(Number(c.card_id));
    }
    console.log(`roster edit applied: out ${(e.drop ?? []).join(", ") || "—"} · in ${[...(e.add ?? []).map((a: any) => a.name), ...(e.addFromCards ?? [])].join(", ") || "—"}`);
  }
  const missing = raw.filter((r) => r.is_pitcher == null).length;
  const pool = raw
    .filter((r) => (r.ratings || r.copy_ratings) && Number(r.val) >= MINVAL)
    .map((r) => {
      const isP = r.is_pitcher ?? /^(SP|RP|CL|P)$/.test(String(r.cpos ?? ""));
      /**
       * KEY ON THE OWNED COPY, NOT THE CARD.
       *
       * Several rows can share one card_id: a variant matches to its base card,
       * and so does any copy the shop list is too old to contain. Keying the fit
       * maps on card_id silently collapses them, and the survivor is whichever
       * row was scored last — which is how an 84-value Josh Gibson, force-matched
       * to the 101 at a distance of 39.5, overwrote the real one and dropped him
       * 27 runs. collection_cards.id is one row per owned copy, so it cannot
       * collide.
       */
      return {
        cardId: r.row_id ?? r.card_id, realId: r.card_id, name: r.name, val: Number(r.val), tier: r.tier, year: r.year,
        bats: r.bats ?? "R", isPitcher: isP,
        role: isP ? (r.pitcher_role ?? r.cpos ?? null) : (r.position ?? r.cpos ?? null),
        /**
         * A variant is matched to its BASE card, so cards.ratings is the base
         * line. Scoring a variant off it throws away exactly the thing that
         * makes it a variant — the Cy Young variant is 9 points of Stuff better
         * than the card it matched to. The collection export carries each owned
         * copy's own numbers, so they are overlaid here.
         */
        /**
         * A FAR MATCH IS NOT A MATCH. The matcher always returns its nearest
         * shop card, so a copy the shop list predates comes back attached to a
         * different card entirely. Past a small distance the base ratings are
         * someone else's, so only the copy's own numbers are used — which means
         * no position ratings, so the card can only DH. That is the honest
         * consequence of an unresolvable row, and it shows up as a low score
         * rather than as a phantom star.
         */
        ratings: (Number(r.match_distance ?? 0) > 10
          ? mergeCopyRatings(null, r.copy_ratings)
          : mergeCopyRatings(r.ratings, r.copy_ratings, r.position ?? r.cpos)) as Record<string, number>,
        isVariant: !!r.is_variant,
        far: Number(r.match_distance ?? 0) > 10,
      };
    });
  const varN = pool.filter((c) => (c as any).isVariant).length;
  const farN = pool.filter((c) => (c as any).far).length;
  console.log(`\npool: ${pool.length} owned cards scored (upload ${UPLOAD}), ${varN} of them variants scored on their own boosted ratings` +
    (varN ? "" : "") +
    (missing ? `; ${missing} rows had no cards-table match` : "") +
    (farN ? `; ${farN} matched too far off (distance > 10) to trust the base card and use only their own ratings — export a fresh pt_card_list to resolve them` : ""));

  /* ---- score: theme environment (with park) and the league default (neutral) ---- */
  const fit = envFitMaps(pool as any, { era: era.rates, park: half });
  const base = envFitMaps(pool as any, { era: eraBase.rates, park: null });
  const mix = (f: any, id: number) => (1 - WL) * (f.runsR.get(id) ?? -1e6) + WL * (f.runsL.get(id) ?? -1e6);
  const V = new Map<number, number>(), D = new Map<number, number>(), R = new Map<number, number>();
  /** Δenv is park-free on both sides, so it is the environment alone. */
  const neutral = envFitMaps(pool as any, { era: era.rates, park: null });

  /**
   * RAW Δ IS A TRAP. 1989 scores ~0.8 runs a game fewer than 2010, so there is
   * simply less run-scoring edge to have and EVERY good card's runs-above-average
   * shrinks. Subtracting straight would rank the whole Perfect tier as "hurt by
   * 1989" and hand the gainers list to cards worth nothing in either year.
   *
   * So the base environment is rescaled to this one's spread first (ratio of
   * standard deviations, fit separately for bats and arms). What survives is
   * card-specific: did this card move relative to the field. The rank column is
   * the same question asked without any scaling at all.
   */
  const sd = (xs: number[]) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };
  const scaleFor = (isP: boolean) => {
    const ids = pool.filter((c) => c.isPitcher === isP).map((c) => c.cardId);
    return sd(ids.map((i) => mix(neutral, i))) / sd(ids.map((i) => mix(base, i)));
  };
  const SCALE = { bat: scaleFor(false), arm: scaleFor(true) };
  console.log(`\nspread ${YEAR} vs ${BASE}: bats ×${SCALE.bat.toFixed(3)}, arms ×${SCALE.arm.toFixed(3)}` +
    ` — Δ below is measured AFTER rescaling ${BASE} by this, so it is card-specific, not the era's compression`);

  const rankIn = (f: any, isP: boolean) => {
    const board = pool.filter((c) => c.isPitcher === isP).sort((a, b) => mix(f, b.cardId) - mix(f, a.cardId));
    return new Map(board.map((c, i) => [c.cardId, i + 1]));
  };
  const rNew = [rankIn(neutral, false), rankIn(neutral, true)];
  const rOld = [rankIn(base, false), rankIn(base, true)];
  for (const c of pool) {
    const k = c.isPitcher ? 1 : 0, s2 = c.isPitcher ? SCALE.arm : SCALE.bat;
    V.set(c.cardId, mix(fit, c.cardId));
    D.set(c.cardId, mix(neutral, c.cardId) - s2 * mix(base, c.cardId));
    R.set(c.cardId, (rOld[k].get(c.cardId) ?? 0) - (rNew[k].get(c.cardId) ?? 0));
  }
  const v = (c: any) => V.get(c.cardId) ?? -1e6, d = (c: any) => D.get(c.cardId) ?? 0, rk = (c: any) => R.get(c.cardId) ?? 0;

  console.log(`\n+10 rating buys in ${YEAR} — LHB: ${marginalRatings(fit.envLeft, "hit").map((x) => `${x.rating} ${f1(x.runs)}`).join("  ")}`);
  console.log(`                       RHB: ${marginalRatings(fit.envRight, "hit").map((x) => `${x.rating} ${f1(x.runs)}`).join("  ")}`);
  console.log(`                      arms: ${marginalRatings(fit.envPitch, "pit").map((x) => `${x.rating} ${f1(x.runs)}`).join("  ")}`);

  /* ---- who is on the roster now ---- */
  const cur = rosterNow;
  const mark = (c: any) => (cur.has(c.realId ?? c.cardId) ? "*" : " ");

  const posOf = (c: any, p: string) => c.ratings[`Pos Rating ${p}`] ?? 0;
  const bestPos = (c: any) => Math.max(...HIT_POS.map((p) => posOf(c, p)));
  const bats = pool.filter((c) => !c.isPitcher).sort((a, b) => v(b) - v(a));
  const arms = pool.filter((c) => c.isPitcher).sort((a, b) => v(b) - v(a));

  const row = (c: any, extra = "") =>
    `  ${mark(c)}${String(c.val).padStart(3)} ${String(c.tier ?? "?").slice(0, 7).padEnd(7)} ${String(c.year ?? "").padStart(4)} ` +
    `${(String(c.name).slice(0, 22) + (c.isVariant ? " \u2726" : "")).padEnd(25)} ${f1(v(c)).padStart(7)}  ${f1(d(c)).padStart(6)} ${String(rk(c) > 0 ? `+${rk(c)}` : rk(c)).padStart(5)}  ${extra}`;

  console.log(`\n--- top ${SHOW} BATS in the collection (* = on the roster now) ---`);
  console.log(`   val tier    year name                        ${YEAR}     Δadj Δrank  best position`);
  bats.slice(0, SHOW).forEach((c) => {
    const bp2 = HIT_POS.map((p) => [p, posOf(c, p)] as const).sort((a, b) => b[1] - a[1])[0];
    console.log(row(c, `${c.bats}  ${bp2[0]} ${Math.round(bp2[1])}`));
  });

  console.log(`\n--- top ${SHOW} ARMS in the collection ---`);
  console.log(`   val tier    year name                        ${YEAR}     Δadj Δrank  role STM`);
  arms.slice(0, SHOW).forEach((c) => console.log(row(c, `${String(c.role ?? "").padEnd(3)} ${String(Math.round(c.ratings["Stamina"] ?? 0)).padStart(3)}`)));

  /* ---- the cards the ENVIRONMENT promotes, regardless of level ---- */
  console.log(`\n--- biggest ${BASE} → ${YEAR} GAINERS (who this week specifically helps) ---`);
  [...pool].filter((c) => v(c) >= 8).sort((a, b) => d(b) - d(a)).slice(0, 18)
    .forEach((c) => console.log(row(c, c.isPitcher ? "arm" : "bat")));
  console.log(`\n--- biggest LOSERS (same list, other end) ---`);
  [...pool].filter((c) => v(c) >= 8).sort((a, b) => d(a) - d(b)).slice(0, 10)
    .forEach((c) => console.log(row(c, c.isPitcher ? "arm" : "bat")));

  /* ---- the 26 ---- */
  /**
   * The role adjustment is what the card is USED as, not what it is labelled.
   * Scoring Gossage as a closer (+4.9) and then printing him in the rotation
   * would be reading the bonus for one job and doing the other, so each arm is
   * re-scored on the scale of the job being filled: starters carry the SP
   * penalty, relievers the RP/CL bonus. Stamina is the gate — an 18-stamina arm
   * cannot start whatever its value says.
   */
  const stm = (c: any) => c.ratings["Stamina"] ?? 0;
  /**
   * THE TAPER WAS WRONG, AND SO IS MOST OF THE BONUS. This used to shrink the
   * relief bonus with stamina — (70 - stm) / 45, gone by 70 — on the theory
   * that the effect is times-through-the-order and a high-stamina arm does not
   * face a lineup once. 327 archived tournament exports say otherwise.
   *
   * The same card, in the same format, starting and relieving (1,442 paired
   * card-formats, 184k innings): moving to the pen is worth -0.19 RA9. By
   * stamina band: 56-65 -0.12, 66-70 -0.22, 71-75 -0.17, 76-80 -0.27, 81-90
   * -0.15, 91+ -0.19. There is no gradient above ~55, so it is not a
   * times-through-the-order effect and the taper has no basis. Flat it is.
   *
   * What the bonus IS, mostly, is inherited-runner accounting: relievers in
   * those exports inherit 195,240 runners and 30.6% of them score charged to
   * the pitcher who left them. Charge them back and the reliever RA9 goes from
   * 4.48 to 5.85. FIP, which cannot be gamed that way, says the same card gets
   * +0.04 WORSE in the pen, not better. So only a quarter of the fitted
   * constant survives as something a roster decision should act on.
   *
   *   --role-trust 1  restores the old full-strength bonus.
   */
  const ROLE_TRUST = num("role-trust", 0.25)!;
  const relShare = (_st: number) => ROLE_TRUST;
  const asRuns = (c: any, as: "SP" | "RP") =>
    as === "SP" ? -roleRuns("SP", stm(c)) : relShare(stm(c)) * -roleRuns(c.role === "CL" ? "CL" : "RP", stm(c));
  const reScore = (c: any, as: "SP" | "RP") =>
    v(c) + asRuns(c, as) - (-roleRuns(c.role, stm(c)));
  const canStart = (c: any) => stm(c) >= 60 || c.role === "SP";
  const sp = arms.filter(canStart).sort((a, b) => reScore(b, "SP") - reScore(a, "SP")).slice(0, NSP);
  const spIds = new Set(sp.map((c) => c.cardId));
  /**
   * A STARTER MAY RELIEVE. The old gate here capped bullpen eligibility at
   * stamina 70 on the same times-through-the-order reasoning. The field does
   * not play that way: across the archived exports 42% of teams use at least
   * one SP-labelled card in relief (mean 0.93 per team), those arms have a
   * median stamina of 74, and they throw 1.52 innings an appearance against a
   * reliever's 1.22. Teams that go deep carry MORE of them — with roster size
   * held at 26+, the SP share of the staff runs 48.3% for teams out in round 1
   * to 51.7% for teams reaching round 4, with RP count falling the other way.
   */
  const RPMAX = num("rp-max-stamina", 999)!;
  const rp = arms.filter((c) => !spIds.has(c.cardId) && stm(c) < RPMAX)
    .sort((a, b) => reScore(b, "RP") - reScore(a, "RP")).slice(0, NRP);
  const staff = [...sp, ...rp];

  // starters: scarce positions first, then bench with a backup catcher forced
  const slots = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];
  /**
   * ASSIGNMENT, NOT GREED. Filling scarce positions first and taking the best
   * bat left over put Rolen (137 at third) on the bench so Brandon Wood could
   * play third at 91 — a greedy ordering can always be beaten by a swap it
   * already passed. Every slot is scored with roster-fill's own objective (the
   * offence percentile blended with the position rating at 17%), then the
   * assignment is improved by single moves and pairwise swaps until nothing
   * gains, which for nine slots reaches the optimum.
   */
  const canPlay = (c: any, p: string) => p === "DH" || (posOf(c, p) > 0 && posOf(c, p) >= 0.6 * bestPos(c));
  /**
   * DEFENCE IN RUNS, NOT PERCENTILES. roster-fill blends a defence percentile
   * at 17%, which ranks similar cards fine but breaks down at the top of a
   * 3,500-card board: it benched Mel Ott (+52 bat) for George Springer (+29)
   * because Springer's glove percentile is higher, valuing 39 points of right-
   * field rating above 23 runs of offence. So the position rating is converted
   * to runs on the classic positional spread — a full 40-point rating step is
   * worth this many runs per 700 PA, most up the middle, almost nothing at
   * first. This is the ONE number here not derived from L.J.'s own data; it is
   * a standard defensive-spectrum assumption, and it only ever decides ties
   * between bats that are close.
   */
  const DEFW = num("def-weight", 1)!;   // sensitivity handle: 0 = bat only, 2 = double
  const DEF_RUNS: Record<string, number> = Object.fromEntries(
    Object.entries({ C: 8, SS: 8, CF: 7, "2B": 6, "3B": 5, RF: 3, LF: 3, "1B": 2, DH: 0 })
      .map(([k, x]) => [k, x * DEFW]));
  const defRuns = (c: any, p: string) => p === "DH" ? 0 : (DEF_RUNS[p] ?? 3) * ((posOf(c, p) - 80) / 40);
  const at = (c: any, p: string) => canPlay(c, p) ? v(c) + defRuns(c, p) : -1e6;
  const cands = bats.slice(0, 60);
  const lineup: Record<string, any> = {};
  const taken = new Set<number>();
  for (const p of [...slots].sort((a, b) =>
    cands.filter((c) => canPlay(c, a)).length - cands.filter((c) => canPlay(c, b)).length)) {
    const c = cands.filter((x) => !taken.has(x.cardId) && canPlay(x, p)).sort((x, y) => at(y, p) - at(x, p))[0];
    if (c) { lineup[p] = c; taken.add(c.cardId); }
  }
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    for (const p of slots) {                       // single move: bring a bench bat in
      const cur0 = lineup[p]; const base0 = cur0 ? at(cur0, p) : -1e6;
      const better = cands.filter((c) => !taken.has(c.cardId) && at(c, p) > base0)
        .sort((x, y) => at(y, p) - at(x, p))[0];
      if (better) { if (cur0) taken.delete(cur0.cardId); lineup[p] = better; taken.add(better.cardId); moved = true; }
    }
    for (const a of slots) for (const b of slots) {  // pairwise swap
      if (a === b || !lineup[a] || !lineup[b]) continue;
      const now = at(lineup[a], a) + at(lineup[b], b);
      const alt = at(lineup[b], a) + at(lineup[a], b);
      if (alt > now + 1e-9) { const t = lineup[a]; lineup[a] = lineup[b]; lineup[b] = t; moved = true; }
    }
    if (!moved) break;
  }
  /** A backup catcher has to actually be a catcher — a 1B with an 11 behind
   *  the plate is not one, and the roster is unusable without a second. */
  const bc = bats.find((c) => !taken.has(c.cardId) && posOf(c, "C") >= 0.6 * bestPos(c) && posOf(c, "C") > 0);
  if (bc) taken.add(bc.cardId);
  const bench = [...(bc ? [bc] : []), ...bats.filter((c) => !taken.has(c.cardId)).slice(0, NBAT - 9 - (bc ? 1 : 0))];

  console.log(`\n--- ceiling by tier: the best card each tier can offer in ${YEAR} ---`);
  for (const t of ["Perfect", "Diamond", "Gold", "Silver", "Bronze", "Iron"]) {
    const tb = bats.filter((c) => c.tier === t), ta = arms.filter((c) => c.tier === t);
    if (!tb.length && !ta.length) continue;
    console.log(`  ${t.padEnd(8)} ${String(tb.length + ta.length).padStart(4)} owned   best bat ${tb[0] ? `${tb[0].name} ${f1(v(tb[0]))}` : "—"}`.padEnd(62) +
      `   best arm ${ta[0] ? `${ta[0].name} ${f1(v(ta[0]))}` : "—"}`);
  }

  console.log(`\n--- best available AT EACH POSITION, whole collection ---`);
  for (const p of slots) {
    const top = bats.filter((c) => canPlay(c, p)).slice(0, 3);
    console.log(`  ${p.padEnd(3)} ${top.map((c) => `${cur.has(c.realId ?? c.cardId) ? "*" : ""}${c.name} ${f1(v(c))}${p === "DH" ? "" : `/${Math.round(posOf(c, p))}`}`).join("   ·   ")}`);
  }

  console.log(`\n=== BEST 26 FROM THE WHOLE COLLECTION · ${YEAR}${pr ? ` · ${PARK_YEAR} ${PARK}` : ""} ===`);
  console.log(`  --- lineup ---`);
  slots.filter((p) => lineup[p]).sort((a, b) => v(lineup[b]) - v(lineup[a]))
    .forEach((p, i) => {
      const c = lineup[p];
      console.log(`  ${String(i + 1).padStart(2)}. ${p.padEnd(3)}${row(c, p === "DH" ? "" : `DEF ${Math.round(posOf(c, p))}/${Math.round(bestPos(c))} ${f1(defRuns(c, p))}`).slice(2)}`);
    });
  console.log(`  --- bench (${bench.length}) ---`);
  bench.forEach((c) => {
    const bp2 = HIT_POS.map((p) => [p, posOf(c, p)] as const).sort((a, b) => b[1] - a[1])[0];
    console.log(row(c, `${c.bats}  ${bp2[0]} ${Math.round(bp2[1])}${c.cardId === bc?.cardId ? "  (backup C)" : ""}`));
  });
  console.log(`  --- rotation (${sp.length}) ---`);
  sp.forEach((c) => console.log(row(c, `STM ${String(Math.round(stm(c))).padStart(3)}  as SP ${f1(reScore(c, "SP"))}`)));
  console.log(`  --- bullpen (${rp.length}) ---`);
  rp.forEach((c) => console.log(row(c, `STM ${String(Math.round(stm(c))).padStart(3)}  as RP ${f1(reScore(c, "RP"))}`)));

  const picked = new Set([...Object.values(lineup).map((c: any) => c.cardId), ...bench.map((c) => c.cardId), ...staff.map((c) => c.cardId)]);
  const realOf = (id: number) => pool.find((c) => c.cardId === id)?.realId ?? id;
  const pickedReal = new Set([...picked].map(realOf));
  const inN = [...pickedReal].filter((id) => cur.has(id)).length;
  console.log(`\n  ${inN} of the best 26 are already on the roster; ${26 - inN} would be changes.`);
  console.log(`  rostered but not in the best 26: ${[...cur].filter((id) => !pickedReal.has(id)).map((id) => pool.find((c) => (c.realId ?? c.cardId) === id)?.name ?? id).join(", ") || "—"}`);
  console.log(`  adding:   ${[...picked].filter((id) => !cur.has(realOf(id))).map((id) => pool.find((c) => c.cardId === id)?.name ?? id).join(", ") || "—"}`);
  process.exit(0);
}
main();
