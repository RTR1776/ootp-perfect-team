/**
 * Verification harness for the ingest layer.
 *
 * Run this after ANY change to the parsers:
 *   pnpm verify:ingest
 *
 * It parses L.J.'s real exports and asserts the numbers we have independently
 * confirmed. The tier-band assertion in particular is the tripwire for the
 * pt_card_list column-offset bug: if the offset handling regresses, the tier
 * codes stop partitioning Card Value and this fails loudly instead of the app
 * quietly showing wrong prices.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseShopList } from "../src/lib/ingest/pt-card-list";
import {
  matchCollectionToShop,
  parseCollection,
} from "../src/lib/ingest/collection";
import { parseStandings } from "../src/lib/ingest/standings";
import { scoreBatch, scoreResult } from "../src/lib/scoring";

const ROOT = process.env.OOTP_DATA_ROOT ?? join(process.cwd(), "..");

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail = "") {
  checks++;
  if (condition) {
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n${title}\n${"-".repeat(title.length)}`);
}

function read(relative: string): string | null {
  const path = join(ROOT, relative);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

/* ---------------------------------------------------------------- */

section("pt_card_list.csv — the card universe");
const shopText = read("LJ Cards and Card Shop/pt_card_list.csv");
let shopCards: ReturnType<typeof parseShopList>["cards"] = [];

if (!shopText) {
  console.log("  skip — file not found under OOTP_DATA_ROOT");
} else {
  const shop = parseShopList(shopText);
  shopCards = shop.cards;
  const s = shop.stats;

  check("header is 122 fields", s.headerFields === 122, `got ${s.headerFields}`);
  check(
    "data rows carry one extra field (the offset bug)",
    s.dataFields === 123,
    `got ${s.dataFields}`,
  );
  check(
    "tier codes partition Card Value with no overlap",
    s.tierBandsValid,
    s.tierBandsValid ? "offset handled correctly" : "COLUMNS ARE SHIFTED",
  );
  check("all rows parsed", shop.skipped.length === 0, `${shop.skipped.length} skipped`);
  check("card count", s.total === 3708, `${s.total} cards`);
  check("owned cards", s.ownedCards === 3015, `${s.ownedCards}`);
  check("owned copies", s.ownedCopies === 3069, `${s.ownedCopies}`);
  check(
    "six tiers present",
    Object.keys(s.byTier).length === 6,
    JSON.stringify(s.byTier),
  );
  console.log(`  info owned by tier: ${JSON.stringify(s.ownedByTier)}`);
  console.log(`  info cards with a live variant listing: ${s.withVariantListing}`);

  const zobrist = shop.cards.find((c) => c.cardId === 85352);
  check("known card resolves", !!zobrist, zobrist?.title ?? "not found");
  if (zobrist) {
    check("  tier", zobrist.tier === "Gold", zobrist.tier);
    check("  position", zobrist.position === "2B", zobrist.position);
    check("  switch hitter", zobrist.bats === "S", String(zobrist.bats));
    check("  era is Modern", zobrist.eraCode === 7, zobrist.eraLabel ?? "");
    check(
      "  variant priced far above base",
      (zobrist.market.last10Variant ?? 0) > (zobrist.market.last10 ?? 0) * 5,
      `base ${zobrist.market.last10} vs variant ${zobrist.market.last10Variant}`,
    );
  }
}

/* ---------------------------------------------------------------- */

section("collection export — variant ownership");
const collectionText =
  read("LJ Cards and Card Shop/mycardset.csv") ??
  read("Roster Templates/KC Torrent Current Cards.csv");

if (!collectionText || shopCards.length === 0) {
  console.log("  skip — needs both the collection and the shop list");
} else {
  const collection = parseCollection(collectionText);
  check("rows parsed", collection.stats.total > 0, `${collection.stats.total} cards`);
  check("variants detected", collection.stats.variants > 0, `${collection.stats.variants}`);

  const { matched, matchRate } = matchCollectionToShop(collection.cards, shopCards);
  check("match rate is 100%", matchRate === 1, `${(matchRate * 100).toFixed(1)}%`);

  const exact = matched.filter((m) => m.matchQuality === "exact").length;
  const variantish = matched.filter((m) => m.matchQuality === "variant").length;
  console.log(`  info exact-distance matches: ${exact}, boosted-distance: ${variantish}`);

  // Non-variants land at distance exactly 0 and variants around 6-9, with no
  // overlap. If that separation ever closes, the fingerprint needs revisiting.
  const baseMax = Math.max(
    ...matched.filter((m) => !m.isVariant && m.matchDistance != null).map((m) => m.matchDistance!),
  );
  const varMin = Math.min(
    ...matched.filter((m) => m.isVariant && m.matchDistance != null).map((m) => m.matchDistance!),
  );
  check(
    "base and variant distances do not overlap",
    baseMax < varMin,
    `base max ${baseMax.toFixed(2)} < variant min ${varMin.toFixed(2)}`,
  );
}

/* ---------------------------------------------------------------- */

section("standings export — real cutoff lines");
const standingsName =
  "pt_standings_tournament_daily_diamond_period_5_(weeks_18-21)_-_jul_06th_till_aug_02nd.csv";
const standingsText = read(`Tourney Standings/${standingsName}`);

if (!standingsText) {
  console.log("  skip — file not found");
} else {
  const standings = parseStandings(standingsText, standingsName);
  check("category from filename", standings.category === "Diamond", String(standings.category));
  check("period from filename", standings.period === 5, String(standings.period));
  check("rows parsed", standings.rows.length > 100, `${standings.rows.length} rows`);
  check("rank 1 is first", standings.rows[0]?.rank === 1, standings.rows[0]?.user ?? "");
  console.log(`  info cutoffs: ${JSON.stringify(standings.cutoffs)}`);
}

/* ---------------------------------------------------------------- */

section("scoring — the mechanic that decides everything");

const win64 = scoreResult({
  name: "Daily Low Bronze (1220155)",
  standingsTag: "Bronze",
  field: "64 / 64 - Bo5F7",
  status: "Winner!",
});
check("win in a 64 = 25", win64.points === 25, `${win64.points}`);
check("event id parsed", win64.eventId === 1220155, String(win64.eventId));

const multi = scoreResult({
  name: "Daily Silver & Friends Deadball Slots (1900080)",
  standingsTag: "Silver,Cap",
  field: "64 / 64 - Bo7",
  status: "2nd Place",
});
check("2nd in a 64 = 15", multi.points === 15, `${multi.points}`);
check("both categories credited", multi.categories.length === 2, multi.categories.join("+"));
check("day total counts it twice", multi.totalPoints === 30, `${multi.totalPoints}`);

const tw = scoreResult({
  name: "Saturday Diamond Variety (1590022)",
  standingsTag: "Dia,TW",
  field: "128 / 128 - Bo7",
  status: "3rd/4th Place",
});
check("TW is not a standing", tw.categories.length === 1, tw.categories.join("+"));
check("3rd-4th in a 128 = 15", tw.points === 15, `${tw.points}`);

const capTw = scoreResult({
  name: "Thursday CWhit's Cap Challenge 4 (1870014)",
  standingsTag: "Gld,Cp,TW",
  field: "128 / 128 - Bo7",
  status: "65th-128th Place",
});
check("Cap still credited alongside TW", capTw.categories.length === 2, capTw.categories.join("+"));
check("65th-128th in a 128 = 0", capTw.points === 0, `${capTw.points}`);

const elim = scoreResult({
  name: "Thursday Overnight Under the Covers (2360021)",
  standingsTag: "PD Weekly",
  field: "256 / 256 - Bo7",
  status: "Eliminated",
});
check("eliminated scores nothing", elim.points === 0 && elim.eliminated, "flagged");

const impossible = scoreResult({
  name: "Test (999999)",
  standingsTag: "Gold",
  field: "64 / 64 - Bo7",
  status: "65th-128th Place",
});
check(
  "impossible placement warns",
  impossible.warnings.some((w) => /impossible/i.test(w)),
  impossible.warnings[0] ?? "",
);

const batch = scoreBatch(
  [
    {
      name: "Trying to Look Busy - D&G (2110152)",
      standingsTag: "PD Daily",
      field: "64 / 64 - Bo5F7",
      status: "3rd/4th Place",
    },
    {
      name: "Trying to Look Busy - D&G (2110153)",
      standingsTag: "PD Daily",
      field: "64 / 64 - Bo5F7",
      status: "17th-32nd Place",
    },
    {
      name: "Trying to Look Busy - D&G (2110153)",
      standingsTag: "PD Daily",
      field: "64 / 64 - Bo5F7",
      status: "17th-32nd Place",
    },
  ],
  [],
);
check("consecutive-day instances both kept", batch.rows.length === 2, `${batch.rows.length} rows`);
check("re-sent row deduped", batch.duplicates.length === 1, `${batch.duplicates.length}`);
check("PD Daily total", batch.byCategory["PD Daily"] === 11, `${batch.byCategory["PD Daily"]}`);

/* ---------------------------------------------------------------- */

console.log(`\n${failures === 0 ? "PASS" : "FAIL"} — ${checks - failures}/${checks} checks\n`);
process.exit(failures === 0 ? 0 : 1);
