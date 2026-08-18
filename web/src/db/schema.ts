/**
 * Postgres schema for the OOTP Perfect Team app (Drizzle ORM).
 *
 * Design notes worth keeping in mind before changing anything here:
 *
 * 1. `cards` is the universe, keyed by OOTP's own Card ID. Ratings live in a
 *    JSONB blob rather than 90 columns — we filter and sort on tier / position /
 *    era / value, and read individual ratings only on a card page or in the
 *    projector, so indexing them is not worth the schema churn every time OOTP
 *    adds a column.
 *
 * 2. `cardSnapshots` is append-only. Every pt_card_list upload writes a new row
 *    per card, which gives price history and ownership history for free. This
 *    is the main reason for a real database instead of static JSON.
 *
 * 3. Ownership is split deliberately: `cardSnapshots.owned` is copies of the
 *    BASE card (from the shop list) and `collectionCards.isVariant` is whether
 *    the boosted VARIANT is owned (from the collection export). The shop list
 *    cannot tell you the second thing. Any "what do I own" query needs both.
 */

import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Uploads                                                             */
/* ------------------------------------------------------------------ */

export const uploads = pgTable("uploads", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(), // shop_list | collection | standings | results
  filename: text("filename").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
  rowCount: integer("row_count"),
  /** Parser stats + warnings, kept so a bad ingest can be diagnosed later. */
  report: jsonb("report").$type<Record<string, unknown>>(),
});

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

export const cards = pgTable(
  "cards",
  {
    cardId: integer("card_id").primaryKey(),
    title: text("title").notNull(),
    name: text("name").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    nickName: text("nick_name"),

    tier: text("tier").notNull(), // Iron..Perfect
    cardValue: integer("card_value").notNull(),
    position: text("position").notNull(), // P, C, 1B..RF, DH
    pitcherRole: text("pitcher_role"), // SP | RP | CL | null
    isPitcher: boolean("is_pitcher").notNull(),
    bats: text("bats"),
    throws: text("throws"),

    year: integer("year"),
    eraCode: integer("era_code"),
    eraLabel: text("era_label"),
    team: text("team"),
    franchise: text("franchise"),
    series: text("series"),
    badge: text("badge"),
    cardType: integer("card_type"),
    cardSubType: text("card_sub_type"),
    brefId: text("bref_id"),
    releasedOn: date("released_on"),

    ratings: jsonb("ratings").$type<Record<string, number>>().notNull(),

    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("cards_tier_pos_idx").on(t.tier, t.position),
    index("cards_era_idx").on(t.eraCode),
    index("cards_value_idx").on(t.cardValue),
    index("cards_name_idx").on(t.name),
  ],
);

/** Append-only price + ownership history, one row per card per upload. */
export const cardSnapshots = pgTable(
  "card_snapshots",
  {
    uploadId: integer("upload_id")
      .notNull()
      .references(() => uploads.id, { onDelete: "cascade" }),
    cardId: integer("card_id")
      .notNull()
      .references(() => cards.cardId, { onDelete: "cascade" }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),

    /** Copies of the base card owned. 0 = not owned. */
    owned: integer("owned").notNull().default(0),
    /** Highest bid — what you receive selling instantly. */
    buyOrderHigh: integer("buy_order_high"),
    /** Lowest ask — what you pay buying instantly. */
    sellOrderLow: integer("sell_order_low"),
    /** Fair market value. */
    last10: integer("last10"),
    /** Variant listing — a separate, much pricier market. 0/null = none listed. */
    last10Variant: integer("last10_variant"),
    missionValue: integer("mission_value"),
    limit: integer("limit"),
    packs: integer("packs"),
  },
  (t) => [
    primaryKey({ columns: [t.uploadId, t.cardId] }),
    index("snap_card_time_idx").on(t.cardId, t.capturedAt),
  ],
);

/**
 * The collection export, matched to card ids by rating fingerprint.
 * Carries the two things the shop list cannot: variant ownership and the
 * active-roster flag.
 */
export const collectionCards = pgTable(
  "collection_cards",
  {
    id: serial("id").primaryKey(),
    uploadId: integer("upload_id")
      .notNull()
      .references(() => uploads.id, { onDelete: "cascade" }),
    cardId: integer("card_id").references(() => cards.cardId, { onDelete: "set null" }),

    name: text("name").notNull(),
    pos: text("pos"),
    cardValue: integer("card_value"),
    isVariant: boolean("is_variant").notNull().default(false),
    isActive: boolean("is_active"),
    released: text("released"),

    /** 0 for a clean base-card match; ~6-9 for a variant; higher = suspect. */
    matchDistance: real("match_distance"),
    matchQuality: text("match_quality"), // exact | variant | fuzzy | unmatched
  },
  (t) => [
    index("collection_card_idx").on(t.cardId),
    index("collection_upload_idx").on(t.uploadId),
  ],
);

/* ------------------------------------------------------------------ */
/* Tournament contexts (from OOTP26 Historic Tourney_Draft List.xlsx)   */
/* ------------------------------------------------------------------ */

export const contexts = pgTable(
  "contexts",
  {
    id: text("id").primaryKey(), // slug, e.g. "daily-silver-friends-deadball-slots"
    name: text("name").notNull(),
    family: text("family").notNull(), // season | tournament | draft
    tierTag: text("tier_tag"), // Silver, Gold, ... as it feeds standings

    /** Roster legality rules. */
    valueCeiling: integer("value_ceiling"),
    valueFloor: integer("value_floor"),
    teamCap: integer("team_cap"),
    /** Max boosted variant cards allowed. 0 = variants banned outright. */
    variantCap: integer("variant_cap"),
    dh: boolean("dh"),
    eraMin: integer("era_min"),
    eraMax: integer("era_max"),
    /** Run-environment year the sim uses, vs modern. */
    reYear: integer("re_year"),
    mode: text("mode"), // Bo7, Bo5F7, ...
    fieldSize: integer("field_size"),
    /** live / unsung / snapshot / nel / fl / legend / hh / allstar / rookie flags. */
    eligibility: jsonb("eligibility").$type<Record<string, boolean>>(),
    prize: text("prize"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("contexts_family_idx").on(t.family)],
);

/* ------------------------------------------------------------------ */
/* PTCS tracking                                                       */
/* ------------------------------------------------------------------ */

export const periods = pgTable("periods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // "PTCS 6"
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  /** Per-category qualifying targets. Estimated until standings land. */
  targets: jsonb("targets").$type<Record<string, number>>(),
  targetsAreOfficial: boolean("targets_are_official").notNull().default(false),
});

/**
 * One row per tournament entry that resolved. Points are stored per category
 * because a single event can feed two or three, each receiving the full amount.
 */
export const results = pgTable(
  "results",
  {
    id: serial("id").primaryKey(),
    periodId: integer("period_id")
      .notNull()
      .references(() => periods.id, { onDelete: "cascade" }),
    /**
     * OOTP's per-instance event id, parsed from "(1900080)" in the name.
     * THE dedup key — ids increment by one per day per event, so the same
     * tournament on consecutive days has different ids. Unique so a re-uploaded
     * overlapping screenshot cannot double-count.
     */
    eventId: integer("event_id"),
    occurredOn: date("occurred_on").notNull(),
    name: text("name").notNull(),
    standingsTag: text("standings_tag"),
    categories: jsonb("categories").$type<string[]>().notNull(),
    fieldSize: integer("field_size"),
    placement: text("placement"),
    eliminated: boolean("eliminated").notNull().default(false),
    /** Points awarded to EACH listed category. */
    points: integer("points").notNull().default(0),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("results_event_idx").on(t.eventId),
    index("results_period_date_idx").on(t.periodId, t.occurredOn),
  ],
);

/**
 * The official standings exports — real point lines, not estimates.
 *
 * CAREFUL: a standings export is a snapshot as of the moment it was downloaded,
 * NOT the final result for the period named in its filename. The PTCS 5 files
 * are named "period 5 (weeks 18-21) - jul 06th till aug 02nd" but were exported
 * on Jul 28, five days before the period closed — verified by matching all
 * eight files against the rank/points L.J. recorded in PTCS5 Tracker.xlsx.
 *
 * So `capturedOn` is load-bearing: cutoffs read off a mid-period file understate
 * the final line, and the linear projection (line × totalDays / elapsedDays)
 * needs the elapsed days to be measured from this date, not from the filename.
 * Treat a cutoff as final only when capturedOn is at or after the period end.
 */
export const standings = pgTable(
  "standings",
  {
    id: serial("id").primaryKey(),
    uploadId: integer("upload_id")
      .notNull()
      .references(() => uploads.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    period: integer("period"),
    weeks: text("weeks"),
    /** Date the export was taken. Defaults to the upload date. */
    capturedOn: date("captured_on"),
    rank: integer("rank").notNull(),
    user: text("user").notNull(),
    team: text("team"),
    points: integer("points").notNull(),
    played: integer("played"),
  },
  (t) => [index("standings_cat_rank_idx").on(t.category, t.period, t.rank)],
);

/**
 * Per-day, per-category point totals.
 *
 * This exists because the PTCS 6 history that predates the app lives in a
 * spreadsheet as day × category totals with free-text notes — there are no
 * per-event rows and, critically, no event ids. Writing that into `results`
 * would mean inventing event ids, which are the dedupe key, so a later upload
 * of the same day could not be recognised as an overlap.
 *
 * `results` stays the per-event ledger for anything entered through the app.
 * A day should be represented by ONE of the two, never both — the tracker sums
 * across both sources and would otherwise double count. `source` records which
 * path a day came in by so that conflict can be detected and shown.
 */
export const dailyTotals = pgTable(
  "daily_totals",
  {
    id: serial("id").primaryKey(),
    periodId: integer("period_id")
      .notNull()
      .references(() => periods.id, { onDelete: "cascade" }),
    occurredOn: date("occurred_on").notNull(),
    category: text("category").notNull(),
    points: integer("points").notNull().default(0),
    /** The day's free-text log line. Kept whole — it is the only record of which events fired. */
    note: text("note"),
    source: text("source").notNull().default("import"), // import | manual
  },
  (t) => [
    // Re-running the importer overwrites rather than duplicates.
    uniqueIndex("daily_totals_day_cat_idx").on(t.periodId, t.occurredOn, t.category),
  ],
);

/** Championship-ladder finishes — a separate scoring system from the above. */
export const ptcsFinishes = pgTable("ptcs_finishes", {
  id: serial("id").primaryKey(),
  event: text("event").notNull(), // "PTCS 5"
  occurredOn: date("occurred_on"),
  berth: text("berth"), // which category berth was played
  standing: text("standing").notNull(), // tournament | perfect_draft
  placement: text("placement").notNull(),
  points: integer("points").notNull(),
});

/* ------------------------------------------------------------------ */
/* Rosters                                                             */
/* ------------------------------------------------------------------ */

export const rosters = pgTable("rosters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contextId: text("context_id").references(() => contexts.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const rosterSlots = pgTable(
  "roster_slots",
  {
    id: serial("id").primaryKey(),
    rosterId: integer("roster_id")
      .notNull()
      .references(() => rosters.id, { onDelete: "cascade" }),
    cardId: integer("card_id")
      .notNull()
      .references(() => cards.cardId, { onDelete: "cascade" }),
    slot: text("slot").notNull(), // C, 1B, ..., SP1..SP4, RP1..RP5, BENCH
    lineupOrder: integer("lineup_order"),
    /** Which platoon lineup this slot belongs to. */
    versusHand: text("versus_hand"), // L | R | both
    /** Denormalised so a saved roster survives a variant being sold. */
    useVariant: boolean("use_variant").notNull().default(false),
  },
  (t) => [index("roster_slots_roster_idx").on(t.rosterId)],
);
