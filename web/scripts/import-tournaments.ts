/**
 * Import the tournament catalog into Postgres.
 *
 * Sources (relative to OOTP_DATA_ROOT, default ".."):
 *   - "Tourney Data/databotai tourney details *.csv"  (newest file wins)
 *   - "reference/ballparks.csv"                        (park factors)
 *   - "Archive/Completed/*.csv"                        (optional — series slugs)
 *
 * Idempotent: parks and tournaments are upserted by primary key. The series
 * assignment matches each Completed-file prefix (earlygold, diamondsforever…)
 * to a tournament by name-slug containment and prints anything it cannot
 * place, so a bad guess is visible instead of silent.
 *
 * Run: pnpm import:tournaments   (needs DATABASE_URL)
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/db/client";
import { parks, tournaments } from "../src/db/schema";
import { sql } from "drizzle-orm";
import { parseCsv, num } from "../src/lib/ingest/csv";

const ROOT = process.env.OOTP_DATA_ROOT ?? "..";

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(daily|the|with|and|of|to|a|for)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Known filename-prefix → tournament-name pairs the slug match cannot be
 * trusted with. Every WEEKLY varname is pinned here (fuzzy matching on
 * tier words is what once sent goldweekly to Daily Early Gold's row). */
const SERIES_OVERRIDES: Record<string, string> = {
  "1950tonow": "Wednesday 1950 to Now",
  "bronze10to50": "Daily Bronze 1910-59",
  "bronzecapweekly": "Saturday Bronze Cap",
  "bronzeweekly": "Monday Up And At Them Bronze",
  "5ldeadball": "Laptophound's Daily 5L Deadball",
  "6lpowerplay": "Laptophound's Daily 6L Power Play",
  "c4q1": "Thursday Cwhit's Cap Challenge 1",
  "c4q2": "Thursday Cwhit's Cap Challenge 2",
  "c4q3": "Thursday Cwhit's Cap Challenge 3",
  "c4q4": "Thursday CWhit's Cap Challenge",  // catalog row carries no trailing number
  "deadballweekly": "Wednesday Night of the Living Deadball",
  "diamonddaily": "Daily Diamond",
  "diamondsforever": "Daily Diamonds are Forever",
  "diamondvariety": "Saturday Diamond Variety",
  "diamondweekly": "Wednesday Ice to See You",
  "goldfloorcapweekly": "Monday Gold Floor Cap",
  "goldweekly": "Thursday Night Gold Rush",
  "highironfloorgoldceilingweekly": "Sunday High Iron Floor and Gold Ceiling",
  "ironweekly": "Saturday Iron Warriors",
  "lgretro": "Daily Low Gold Retrospectus",
  "livelowdiamondweekly": "Monday Live Low Diamond",
  "liveopendaily": "Daily Live Open",
  "liveslotsweekly": "Friday Night Live Slots",
  "liveweekly": "Tuesday Live",
  "lowironweekly": "Friday Danksville",
  "mishmashcap": "Thursday Mishmash Cap",
  "nelslotsweekly": "Saturday Negro Leagues Slots",
  "nightmarecap": "Friday Nightmare Cap",
  "openslotsweekly": "Sunday Open Slots",
  "openweekly": "Sunday Open Main Event",
  "sandlot": "Tuesday Sporer's Sandlot",
  "silverweekly": "Thursday Silver Spectacular",
  "upto1969weekly": "Tuesday Up to 1969",
  "wonkyslots": "Monday Wonky Historical Slots",
};

async function main() {
  /* ---------------- parks ---------------- */
  const parkText = readFileSync(join(ROOT, "reference/ballparks.csv"), "utf8").replace(/^﻿/, "");
  const parkCsv = parseCsv(parkText);
  const parkRows = parkCsv.rows.map((r) => ({
    name: (r["Ballpark"] ?? "").trim(),
    team: (r["Team"] ?? "").trim() || null,
    avgL: num(r["Avg LHB"]),
    avgR: num(r["Avg RHB"]),
    hrL: num(r["HR LHB"]),
    hrR: num(r["HR RHB"]),
    b2: num(r["2B"]),
    b3: num(r["3B"]),
  })).filter((p) => p.name);
  // ballparks.csv can repeat a name (year variants share names) — last row wins
  const parkByName = new Map(parkRows.map((p) => [p.name, p]));
  const uniqueParks = [...parkByName.values()];
  for (let i = 0; i < uniqueParks.length; i += 200) {
    await db.insert(parks).values(uniqueParks.slice(i, i + 200)).onConflictDoUpdate({
      target: parks.name,
      set: {
        avgL: sql`excluded.avg_l`, avgR: sql`excluded.avg_r`,
        hrL: sql`excluded.hr_l`, hrR: sql`excluded.hr_r`,
        b2: sql`excluded.b2`, b3: sql`excluded.b3`,
      },
    });
  }
  // The generic tournament park has no factor row — a neutral one keeps
  // /build's park chips honest for the ~30 Standard Stadium events.
  if (!parkByName.has("Standard Stadium")) {
    await db.insert(parks).values({ name: "Standard Stadium", team: null, avgL: 1, avgR: 1, hrL: 1, hrR: 1, b2: 1, b3: 1 }).onConflictDoNothing();
    uniqueParks.push({ name: "Standard Stadium", team: null, avgL: 1, avgR: 1, hrL: 1, hrR: 1, b2: 1, b3: 1 });
  }
  const parkNames = uniqueParks.map((p) => p.name);
  console.log(`parks: ${uniqueParks.length} upserted (${parkRows.length} rows in csv)`);

  /* ---------------- tournaments ---------------- */
  const dir = join(ROOT, "Tourney Data");
  const detailFile = readdirSync(dir)
    .filter((f) => f.startsWith("databotai tourney details") && f.endsWith(".csv"))
    .sort()
    .pop();
  if (!detailFile) throw new Error(`no databotai tourney details csv under ${dir}`);
  const detCsv = parseCsv(readFileSync(join(dir, detailFile), "utf8"));

  // series slugs from Archive/Completed, when the archive is on this machine
  const completedDir = join(ROOT, "Archive/Completed");
  const prefixes = existsSync(completedDir)
    ? [...new Set(
        readdirSync(completedDir)
          .map((f) => f.replace(/_\d+\.csv$/i, ""))
          .filter((f) => /^[a-z0-9]+$/i.test(f)), // drops .DS_Store, subfolders, unrenamed csvs
      )]
    : [];

  // databotai leaves ratings_cap/card_year blank for restrictions it does not
  // encode as a NNNN - NNNN range, so an era-limited event arrives with no
  // limit at all and /build happily recommends modern cards for a 1919 deadball
  // tournament. These are read off OOTP's own RESTRICTIONS column and applied
  // after the CSV, using the same encoding databotai uses elsewhere ("<=1920
  // Era" is stored as 1800-1920, matching Daily Silver & Friends Deadball Slots).
  const RESTRICTION_OVERRIDES: Record<string, Partial<{
    ratingsMin: number; ratingsMax: number; cardYearMin: number; cardYearMax: number;
  }>> = {
    "Wednesday Night of the Living Deadball": { cardYearMin: 1800, cardYearMax: 1920 }, // "<=1920 Era"
    "Tuesday Up To 1969":                     { cardYearMin: 1800, cardYearMax: 1969 }, // "<=1969"
    "Daily Bronze OOTP Era":                  { cardYearMin: 1999, cardYearMax: 2026 }, // "Cards <= BRONZE; >=1999"
  };

  const range = (v: string | undefined) => {
    const m = (v ?? "").match(/(\d+)\s*-\s*(\d+)/);
    return m ? [Number(m[1]), Number(m[2])] : [null, null];
  };

  const rows = detCsv.rows
    .filter((r) => num(r["id"]) != null)
    .map((r) => {
      const title = (r["title"] ?? "").trim();
      const m = title.match(/^(.*?)\s+(\d{4})$/);
      const name = m ? m[1] : title;
      const envYear = m ? Number(m[2]) : null;
      const stadium = (r["stadium"] ?? "").trim() || null;
      const bare = stadium ? stadium.replace(/^\d{4}\s+/, "").trim() : null;
      // exact park match first, then unique containment either way
      let parkName: string | null = null;
      if (bare) {
        if (parkNames.includes(bare)) parkName = bare;
        else {
          const hits = parkNames.filter((p) => p.includes(bare) || bare.includes(p));
          if (hits.length === 1) parkName = hits[0];
        }
      }
      const [rMin, rMax] = range(r["ratings_cap"]);
      const [yMin, yMax] = range(r["card_year"]);
      return {
        id: num(r["id"])!,
        name,
        envYear,
        mode: (r["mode"] ?? "").trim() || null,
        stadium,
        parkName,
        fee: (r["fee"] ?? "").trim() || null,
        dh: (r["dh"] ?? "").trim() ? (r["dh"] ?? "").trim().toLowerCase() === "yes" : null,
        entrants: num(r["entrants"]),
        ratingsMin: rMin,
        ratingsMax: rMax,
        cardYearMin: yMin,
        cardYearMax: yMax,
        ...RESTRICTION_OVERRIDES[name],
        simRuns: num(r["sim_runs"]),
        series: null as string | null,
        isDraft: /\bPD\b|Draft|Laptop|Doc Rock/i.test(name),
      };
    });

  // assign series slugs — overrides claim their rows first so a fuzzy
  // prefix can never steal a row an override owns (diamondweekly once
  // grabbed "Daily Diamond" from diamonddaily this way).
  const unplaced: string[] = [];
  const claimed = new Set<(typeof rows)[number]>();
  for (const prefix of prefixes) {
    const overrideName = SERIES_OVERRIDES[prefix];
    if (!overrideName) continue;
    const hit = rows.find((t) => t.name.toLowerCase() === overrideName.toLowerCase());
    if (hit) { hit.series = prefix; claimed.add(hit); }
    else unplaced.push(prefix);
  }
  for (const prefix of prefixes) {
    if (SERIES_OVERRIDES[prefix]) continue;
    const base = prefix.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(weekly|daily)$/, "");
    const cands = [...new Set([base, base.replace(/and/g, ""), base.replace(/the/g, "")])].filter(Boolean);
    const scored = rows
      .filter((t) => !claimed.has(t))
      .flatMap((t) => {
        const s = slug(t.name);
        const dayless = slug(t.name.replace(/^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\s+/i, ""));
        return [...new Set([s, dayless])].map((v) => ({ t, v }));
      })
      .filter(({ v }) => cands.some((c) => v.includes(c) || c.includes(v)))
      .sort((a, b) => Math.abs(a.v.length - cands[0].length) - Math.abs(b.v.length - cands[0].length));
    const hit = scored[0]?.t;
    if (hit) { hit.series = prefix; claimed.add(hit); }
    else unplaced.push(prefix);
  }

  for (let i = 0; i < rows.length; i += 100) {
    await db.insert(tournaments).values(rows.slice(i, i + 100)).onConflictDoUpdate({
      target: tournaments.id,
      set: {
        name: sql`excluded.name`, envYear: sql`excluded.env_year`, mode: sql`excluded.mode`,
        stadium: sql`excluded.stadium`, parkName: sql`excluded.park_name`, fee: sql`excluded.fee`,
        dh: sql`excluded.dh`, entrants: sql`excluded.entrants`,
        ratingsMin: sql`excluded.ratings_min`, ratingsMax: sql`excluded.ratings_max`,
        cardYearMin: sql`excluded.card_year_min`, cardYearMax: sql`excluded.card_year_max`,
        simRuns: sql`excluded.sim_runs`, series: sql`excluded.series`, isDraft: sql`excluded.is_draft`,
        updatedAt: sql`now()`,
      },
    });
  }
  const withSeries = rows.filter((r) => r.series).length;
  const withPark = rows.filter((r) => r.parkName).length;
  console.log(`tournaments: ${rows.length} upserted from ${detailFile}`);
  console.log(`  park matched: ${withPark}/${rows.length} | series assigned: ${withSeries} of ${prefixes.length} prefixes`);
  if (unplaced.length) console.log("  UNPLACED series prefixes:", unplaced.join(", "));
  const unparked = rows.filter((r) => r.stadium && !r.parkName).map((r) => r.stadium);
  if (unparked.length) console.log("  stadiums with no park-factor match:", [...new Set(unparked)].join(" | "));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
