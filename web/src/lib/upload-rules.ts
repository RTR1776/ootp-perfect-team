/**
 * The rules /upload applies, as plain functions: which date a file is saved
 * under, whether it is older than what is on file, what Save sends and in
 * which order, the size the website takes, and reading a dropped week
 * folder. The route (api/upload) and the page (upload-queue) share them, and
 * they are tested without a browser or a database (upload-rules.test.ts).
 *
 * UI plan §4.8 U1–U4. On 09-26 a league upload was lost to a page that looked
 * saved, and an older shop list dropped on the page overwrote newer card
 * values; these rules are what stops both.
 */
import { chicagoDay, date as shortDate } from "@/lib/format";
import { leagueWeekOf } from "@/lib/league-week";

export type UploadKind = "shop_list" | "collection" | "standings" | "league" | "dump";

/**
 * Kinds where the newest file is the one the app reads, so saving an older one
 * rolls data back. League weeks and standings are dated snapshots instead: an
 * older one is a backfill of its own week or day.
 */
export const REPLACING_KINDS: ReadonlySet<UploadKind> = new Set<UploadKind>(["shop_list", "collection", "dump"]);

/** Save order: the collection is matched against the shop list's cards, so the shop list lands first. */
export const KIND_ORDER: Record<UploadKind, number> = { shop_list: 0, collection: 1, standings: 2, league: 3, dump: 4 };

export const KIND_LABEL: Record<UploadKind, string> = {
  shop_list: "Shop list",
  collection: "Collection",
  standings: "Category standings",
  league: "League export",
  dump: "Community dump",
};

/** How a kind reads inside a sentence: "the shop list on file", "Will save: 2 collections". */
const KIND_NOUN: Record<UploadKind, [one: string, many: string]> = {
  shop_list: ["shop list", "shop lists"],
  collection: ["collection", "collections"],
  standings: ["standings file", "standings files"],
  league: ["league file", "league files"],
  dump: ["community dump", "community dumps"],
};
export const kindNoun = (kind: UploadKind, n = 1) => KIND_NOUN[kind][n === 1 ? 0 : 1];

/**
 * Save order, never NaN: a kind the table doesn't know sorts last instead of
 * breaking the sort (a staged dump used to, so a collection could save before
 * the shop list and lose its new cards). Within a kind, older files first, so
 * the newest lands last.
 */
export function compareSaveOrder(
  a: { kind?: string | null; capturedOn?: string | null },
  b: { kind?: string | null; capturedOn?: string | null },
): number {
  const rank = (k?: string | null) => KIND_ORDER[k as UploadKind] ?? 99;
  return rank(a.kind) - rank(b.kind) || (a.capturedOn ?? "").localeCompare(b.capturedOn ?? "");
}

/* ------------------------------------------------------------------ dates */

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-09-31" is not a day; a filename or folder that looks like one must be real. */
export function isDay(s: string | null | undefined): s is string {
  if (!s || !ISO_DAY.test(s)) return false;
  const t = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === s;
}

/** Local calendar day, YYYY-MM-DD. `toISOString()` rolls to tomorrow every evening west of Greenwich. */
export function localDay(d: Date): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

/** A YYYY-MM-DD day as a local Date at noon (for leagueWeekOf, which reads local fields). */
const localNoon = (day: string) => new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 12);

/**
 * The date in a filename: "pt_card_list 2026-09-18.csv", the dumps'
 * "…_dump_20260921.csv", or the Mac's older "pt_card_list 8.27.csv" (this
 * year, or last year when this year's would be in the future). Null when the
 * name carries no date.
 */
export function nameDateOf(name: string, today: string, max = today): string | null {
  // A day after `max` is a typo, not a date: it would pin the file as the newest until then.
  const iso = /(\d{4}-\d{2}-\d{2})/.exec(name)?.[1];
  if (isDay(iso) && iso! <= max) return iso!;
  const compact = /(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)/.exec(name);
  const c = compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : null;
  if (c && isDay(c) && c <= max) return c;
  const md = /(?:^|[\s_(-])(\d{1,2})\.(\d{1,2})(?=\.csv$|[\s_)-]|$)/i.exec(name);
  if (md) {
    const mmdd = `${md[1].padStart(2, "0")}-${md[2].padStart(2, "0")}`;
    const year = Number(today.slice(0, 4));
    const guess = `${year}-${mmdd}`;
    const day = guess > today ? `${year - 1}-${mmdd}` : guess;
    if (isDay(day)) return day;
  }
  return null;
}

/**
 * The week a folder names: the nearest folder in the path called YYYY-MM-DD,
 * the way `League Data/2026-09-20/` is laid out (import-league.ts reads the
 * same). "League Data/2026-09-20/pel_all.csv" → "2026-09-20".
 */
export function folderDateOf(path: string): string | null {
  const dirs = path.split("/").slice(0, -1);
  for (let i = dirs.length - 1; i >= 0; i--) if (isDay(dirs[i])) return dirs[i];
  return null;
}

/**
 * The "Saved as" date a file starts with; the page shows it in a date input.
 * - League: the Sunday its week ends. A week folder names it; else the
 *   filename's date, the day the file was written, or today, moved to its Sunday.
 * - Standings: the day it was pulled (the day the file was written, else
 *   today) — the filename names the period.
 * - Everything else: the filename's date, the folder's, the day the file was
 *   written, else today.
 *
 * `modified` is the file's own timestamp (File.lastModified), which OOTP sets
 * when it writes the export. It dates an export whose name carries no date: an
 * old pt_card_list.csv dropped by mistake reads as older than the one on file,
 * not as today's. A timestamp in the future is ignored.
 */
/**
 * The latest day a file of this kind can be saved as: today, or for a league
 * week the Sunday it ends (the coming one, from Tuesday on). Readers take the
 * latest day, so a later one would pin the file as the newest until then, and
 * every real file before it would read as older. The route refuses a later
 * day; the page's date fields stop there.
 */
export function latestDayFor(kind: UploadKind | null | undefined, today: string): string {
  return kind === "league" ? leagueWeekOf(localNoon(today)) : today;
}

export function defaultSavedAs(kind: UploadKind, name: string, folderDate: string | null, now: Date, modified?: Date | null): string {
  const today = localDay(now);
  const written = modified && !Number.isNaN(modified.getTime()) && modified.getTime() <= now.getTime() ? modified : null;
  if (kind === "league") {
    if (folderDate && folderDate <= latestDayFor("league", today)) return folderDate;
    const named = nameDateOf(name, today, latestDayFor("league", today));
    return leagueWeekOf(named ? localNoon(named) : written ?? now);
  }
  const writtenDay = written ? localDay(written) : null;
  const folder = folderDate && folderDate <= today ? folderDate : null;
  if (kind === "standings") return folder ?? writtenDay ?? today;
  return nameDateOf(name, today) ?? folder ?? writtenDay ?? today;
}

/** The most recent Sunday on or before a day (a Sunday is its own). */
export function lastSunday(day: string): string {
  const t = new Date(`${day}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() - t.getUTCDay());
  return t.toISOString().slice(0, 10);
}

/* ------------------------------------------------------ older than on file */

/**
 * True when a file saved as `day` is older than the newest of its kind on file
 * (`onFileDay`, that upload's Chicago day). Only for kinds where the newest
 * file is the one the app reads; a day equal to the one on file is not older
 * (the route stamps it after the one on file, see stampFor).
 */
export function olderThanOnFile(kind: UploadKind | null | undefined, day: string | null | undefined, onFileDay: string | null | undefined): boolean {
  return !!kind && REPLACING_KINDS.has(kind) && isDay(day) && isDay(onFileDay) && day < onFileDay;
}

/**
 * The moment a dated upload is stamped with (uploads.uploaded_at, which every
 * reader orders by): noon UTC on its day, so the day survives any timezone.
 * A second file for the same Chicago day as the newest on file is stamped a
 * second after it, so the save that came later is the one the app reads.
 */
export function stampFor(day: string, onFile: { at: Date } | null): Date {
  const noon = new Date(`${day}T12:00:00Z`);
  if (onFile && chicagoDay(onFile.at) === day && noon.getTime() <= onFile.at.getTime()) {
    return new Date(onFile.at.getTime() + 1000);
  }
  return noon;
}

/**
 * Whether a shop list write may move card values (cards.card_value, tier,
 * ratings). Only when it is the newest shop list; an older one still adds its
 * prices to card_snapshots, so a backfill keeps Market's history whole.
 */
export function shopListUpdatesCards(at: Date, newestShopAt: Date | null): boolean {
  return newestShopAt == null || at.getTime() >= newestShopAt.getTime();
}

/* --------------------------------------------------------------- the batch */

export interface Staged {
  id: string;
  name: string;
  status: string;
  kind?: UploadKind | null;
  capturedOn?: string | null;
  /** Dumps: tournaments or drafts, which are separate files. */
  source?: string | null;
}

/** Previewed and not saved yet: still in the page's hands (a skipped file can go again). */
export const isPending = (it: { status: string }) => it.status === "ready" || it.status === "skipped";

/**
 * Two previewed files of one kind in one batch: the newest is saved and the
 * rest are "Superseded by <file> in this batch". League weeks and standings
 * are dated snapshots and never supersede each other. Ties go to the file
 * added last. A file skipped by the last save counts as previewed. Returns
 * superseded id → the file that supersedes it.
 */
export function supersededBy<T extends Staged>(items: T[]): Map<string, T> {
  const newest = new Map<string, T>();
  const key = (it: T) => `${it.kind}${it.kind === "dump" ? `:${it.source ?? ""}` : ""}`;
  const candidates = items.filter((it) => isPending(it) && it.kind && REPLACING_KINDS.has(it.kind));
  for (const it of candidates) {
    const cur = newest.get(key(it));
    if (!cur || (it.capturedOn ?? "") >= (cur.capturedOn ?? "")) newest.set(key(it), it);
  }
  const out = new Map<string, T>();
  for (const it of candidates) {
    const top = newest.get(key(it))!;
    if (top.id !== it.id) out.set(it.id, top);
  }
  return out;
}

export interface SavePlan<T> {
  /** Older than the newest of its kind on file. */
  older: Set<string>;
  /** Superseded id → the newer file of its kind in this batch. */
  superseded: Map<string, T>;
  /** What Save sends. */
  included: Set<string>;
  /** A shop list is set to save in this batch. */
  shopGoes: boolean;
}

/**
 * What Save sends. A previewed file goes unless it is older than what is on
 * file or superseded in this batch; "Include anyway" (`forced`) overrides
 * either. A collection skipped because its shop list failed waits for a shop
 * list that saves ahead of it in the same batch: saved alone, it would be
 * matched against the old cards and lose the new ones. Include anyway
 * overrides that too.
 */
export function savePlan<T extends Staged & { forced?: boolean; onFile?: { date: string | null } | null }>(items: T[]): SavePlan<T> {
  const superseded = supersededBy(items);
  const older = new Set(items.filter((it) => isPending(it) && olderThanOnFile(it.kind, it.capturedOn, it.onFile?.date)).map((it) => it.id));
  const goes = items.filter((it) => isPending(it) && (it.forced || (!older.has(it.id) && !superseded.has(it.id))));
  const shopGoes = goes.some((it) => it.kind === "shop_list");
  const included = new Set(goes.filter((it) => it.status !== "skipped" || shopGoes || it.forced).map((it) => it.id));
  return { older, superseded, included, shopGoes };
}

export type SaveOutcome = "saved" | "already" | "failed";

/**
 * Save a batch one file at a time, in save order. The collection is matched
 * against the shop list's cards, so when a shop list in the batch fails, the
 * batch's collections are skipped (`onSkip`) rather than matched against the
 * old cards. A file removed while the batch runs (`cancelled`) is not sent
 * (`onCancel`).
 */
export async function saveInOrder<T extends { id: string; kind?: UploadKind | null; capturedOn?: string | null }>(
  items: T[],
  save: (item: T) => Promise<SaveOutcome>,
  opts: { cancelled?: (id: string) => boolean; onSkip?: (item: T) => void; onCancel?: (item: T) => void } = {},
): Promise<Record<SaveOutcome | "skipped" | "cancelled", number>> {
  const tally = { saved: 0, already: 0, failed: 0, skipped: 0, cancelled: 0 };
  let shopFailed = false;
  for (const item of [...items].sort(compareSaveOrder)) {
    if (opts.cancelled?.(item.id)) {
      opts.onCancel?.(item);
      tally.cancelled++;
      continue;
    }
    if (item.kind === "collection" && shopFailed) {
      opts.onSkip?.(item);
      tally.skipped++;
      continue;
    }
    const outcome = await save(item);
    tally[outcome]++;
    if (item.kind === "shop_list" && outcome === "failed") shopFailed = true;
  }
  return tally;
}

/**
 * "shop list (Sep 18), collection (Sep 18), 15 league files (week ending Sep 27)".
 * In save order.
 */
export function willSaveSummary(items: { kind?: UploadKind | null; capturedOn?: string | null }[], now: Date = new Date()): string {
  const byKind = new Map<UploadKind, string[]>();
  for (const it of [...items].sort(compareSaveOrder)) {
    if (!it.kind) continue;
    const list = byKind.get(it.kind) ?? [];
    list.push(it.capturedOn ?? "");
    byKind.set(it.kind, list);
  }
  const days = (list: string[]) => [...new Set(list)].filter(Boolean).map((d) => shortDate(d, now)).join(", ");
  return [...byKind].map(([kind, list]) => {
    const n = list.length;
    const noun = `${n === 1 ? "" : `${n} `}${kindNoun(kind, n)}`;
    if (kind !== "league") return `${noun} (${days(list)})`;
    const weeks = new Set(list).size;
    return `${noun} (week${weeks === 1 ? "" : "s"} ending ${days(list)})`;
  }).join(", ");
}

const SPLITS = ["all", "vL", "vR"] as const;

/**
 * One league week's files, read back: "HD450, HD451, PEL × all/vL/vR", and
 * what is missing or doubled ("PEL: vR missing", "HD451 vL: 2 files").
 */
export function leagueWeekCheck(files: { league?: string | null; split?: string | null }[]): { leagues: string[]; splits: string[]; problems: string[] } {
  const seen = new Map<string, Map<string, number>>();
  for (const f of files) {
    if (!f.league) continue;
    const splits = seen.get(f.league) ?? new Map<string, number>();
    const split = f.split ?? "all";
    splits.set(split, (splits.get(split) ?? 0) + 1);
    seen.set(f.league, splits);
  }
  const leagues = [...seen.keys()].sort();
  const splits = SPLITS.filter((s) => leagues.some((l) => seen.get(l)!.has(s)));
  const problems: string[] = [];
  for (const l of leagues) {
    const have = seen.get(l)!;
    const missing = SPLITS.filter((s) => !have.has(s));
    if (missing.length) problems.push(`${l}: ${missing.join(", ")} missing`);
    for (const [s, n] of have) if (n > 1) problems.push(`${l} ${s}: ${n} files; the last one saved is kept`);
  }
  return { leagues, splits, problems };
}

/* ------------------------------------------------------------- the files */

/**
 * Vercel refuses a request body over 4.5 MB before the route runs (a bare
 * 413). The form adds a few hundred bytes, so the page stops at 4.4 MB and
 * says why instead of sending.
 */
export const MAX_UPLOAD_BYTES = 4_400_000;
export const tooLarge = (bytes: number) => bytes > MAX_UPLOAD_BYTES;
export const tooLargeMessage = (bytes: number) =>
  `Too large for the website (${(bytes / 1e6).toFixed(1)} MB; limit 4.5 MB). Community dumps: double-click Load Tourney Dumps.command on the Mac.`;

export const isCsvName = (name: string) => /\.csv$/i.test(name);
export const NOT_CSV = "Not a CSV. OOTP exports are .csv; re-export or save as CSV.";

/** One dropped file: its path inside the drop ("2026-09-20/pel_all.csv"), or why it couldn't be read. */
export interface Dropped { path: string; file: File | null; error?: string }

/**
 * Read what was dropped, folders to the bottom. `readEntries` hands a folder
 * back a batch at a time (100 in Chrome) and an empty batch at the end, so it
 * is called until it comes back empty. Hidden files (.DS_Store) are skipped.
 * Paths come back sorted, so a week's files list in a stable order.
 */
export async function readDropped(entries: FileSystemEntry[]): Promise<Dropped[]> {
  const out: Dropped[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.name.startsWith(".")) return;
    const path = entry.fullPath.replace(/^\/+/, "") || entry.name;
    try {
      if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        for (;;) {
          const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
          if (!batch.length) break;
          for (const child of batch) await walk(child);
        }
      } else {
        const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
        out.push({ path, file });
      }
    } catch (e) {
      out.push({ path, file: null, error: `Could not read ${path}: ${(e as Error)?.message ?? String(e)}` });
    }
  };
  for (const entry of entries) await walk(entry);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
