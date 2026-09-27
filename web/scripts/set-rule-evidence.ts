/**
 * Audit every active event's card-set and card-year rules against what its
 * field actually plays. Read-only.
 *
 *   node --env-file=.env.local --import tsx scripts/set-rule-evidence.ts
 *
 * Prints, per event:
 * - rules on file that the field has broken (a set or year the rule forbids
 *   was played). The exports are pooled over every run on file, so a format
 *   change also shows here: the share of plays outside the rule tells which;
 * - no rule on file, but the field plays three sets or fewer, or one card
 *   year: a `catalogue:set` line to add the rule (L.J. confirms first);
 * - no rule and no exports, but the name suggests one: confirm by name.
 *
 * lib/set-evidence.ts has the thresholds. This is how 2026-09-27 found
 * All-Star Hardware (HAS + HH only) and the Live-only events.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, observedCardStats, tournaments } from "@/db/schema";
import { CARD_TYPE_SHORT, parseCardTypeRule } from "@/lib/roster-rules";
import { evidenceLine, evidenceRule, setsNarrow, yearsNarrow } from "@/lib/set-evidence";
import { loadSetEvidenceMany } from "@/lib/set-evidence-server";

/** Names that usually mean a set rule (the same test the rules strip uses). */
const SUSPECT_NAME = /all-?star|hardware|snapshot|negro|unsung|rookie|legend|future|veteran|\blive\b/i;

async function main() {
  // EF events play the game's default rules (build/page.tsx hides them too).
  const events = (await db.select().from(tournaments).where(eq(tournaments.retired, false)).orderBy(tournaments.name))
    .filter((t) => !/^EF\b/.test(t.name));
  const evidence = await loadSetEvidenceMany([...new Set(events.map((t) => t.series).filter((s): s is string => !!s))]);

  const broken: string[] = [], propose: string[] = [], confirm: string[] = [], wide: string[] = [];
  let ruled = 0, silent = 0;
  for (const t of events) {
    const types = (t.restrictions as { cardTypes?: string[] } | null)?.cardTypes ?? [];
    const e = t.series ? evidence.get(t.series) ?? null : null;
    const label = `${t.name} (${t.id})`;
    const hasYears = t.cardYearMin != null || t.cardYearMax != null;
    if (types.length || hasYears) {
      ruled++;
      if (!e) continue;
      const parsed = types.map(parseCardTypeRule);
      if (parsed.some((a) => a == null)) { broken.push(`${label}: set rule not understood: ${types.join(" / ")}`); continue; }
      const allowed = types.length ? (parsed as number[][]).flat() : null;
      const outside = allowed ? e.types.filter((c) => !allowed.includes(c)) : [];
      const yearsOut = hasYears && ((t.cardYearMin != null && e.yearMin != null && e.yearMin < t.cardYearMin) || (t.cardYearMax != null && e.yearMax != null && e.yearMax > t.cardYearMax));
      if (!outside.length && !yearsOut) continue;
      const share = await playsOutside(t.series!, allowed, t.cardYearMin, t.cardYearMax);
      const what = [
        outside.length ? `sets ${outside.map((c) => `${CARD_TYPE_SHORT[c]} ${e.counts[c]}`).join(", ")} (rule: ${types.join(" / ")})` : null,
        yearsOut ? `cards ${e.yearMin}–${e.yearMax} (rule: ${t.cardYearMin ?? "…"}–${t.cardYearMax ?? "…"})` : null,
      ].filter(Boolean).join("; ");
      broken.push(`${label}: ${(share * 100).toFixed(0)}% of plays break the rule on file — ${what}`);
      continue;
    }
    if (!e) {
      if (SUSPECT_NAME.test(t.name)) confirm.push(label); else silent++;
    } else if (setsNarrow(e)) {
      propose.push(`${label}: ${evidenceLine(e)}\n    pnpm catalogue:set --tournament ${t.id} --card-types "${evidenceRule(e)}" --note "card sets read off the field's exports"`);
    } else if (yearsNarrow(e)) {
      propose.push(`${label}: every card played is a ${e.yearMin} card, ${evidenceLine(e)}\n    pnpm catalogue:set --tournament ${t.id} --card-years ${e.yearMin}-${e.yearMax} --note "card years read off the field's exports"`);
    } else {
      wide.push(`${label}: ${evidenceLine(e)}`);
    }
  }

  const section = (title: string, lines: string[]) => {
    console.log(`\n${title} (${lines.length})`);
    for (const l of lines) console.log(`  ${l}`);
  };
  console.log(`${events.length} active events · ${ruled} carry a set or year rule`);
  section("Rules the field has broken — a small share is usually an older format; a large one means check the event in game", broken);
  section("No rule on file, narrow field — proposed rules, confirm with L.J. before running", propose);
  section("No rule and no exports, but the name suggests one — confirm by name", confirm);
  section("No rule on file, the field plays many sets — probably open", wide);
  console.log(`\n${silent} more events have no rule, no exports and a neutral name.`);
  process.exit(0);
}

/** Share of the series' card-runs (instances) whose card the rule forbids. */
async function playsOutside(series: string, allowed: number[] | null, yearMin: number | null, yearMax: number | null): Promise<number> {
  const rows = await db.select({ type: cards.cardType, year: cards.year, n: observedCardStats.instances })
    .from(observedCardStats).innerJoin(cards, eq(cards.cardId, observedCardStats.cardId))
    .where(eq(observedCardStats.series, series));
  let all = 0, out = 0;
  for (const r of rows) {
    all += r.n;
    const badSet = allowed != null && (r.type == null || !allowed.includes(r.type));
    const badYear = r.year != null && ((yearMin != null && r.year < yearMin) || (yearMax != null && r.year > yearMax));
    if (badSet || badYear) out += r.n;
  }
  return all ? out / all : 0;
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
