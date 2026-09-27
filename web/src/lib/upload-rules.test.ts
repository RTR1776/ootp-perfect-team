import { test } from "node:test";
import assert from "node:assert/strict";
import { chicagoDay } from "./format";
import {
  MAX_UPLOAD_BYTES, compareSaveOrder, defaultSavedAs, folderDateOf, isCsvName, lastSunday, latestDayFor, leagueWeekCheck, nameDateOf,
  olderThanOnFile, readDropped, saveInOrder, savePlan, shopListUpdatesCards, stampFor, supersededBy, tooLarge, tooLargeMessage,
  willSaveSummary, type SaveOutcome, type UploadKind,
} from "./upload-rules";

test("save order: shop list, collection, standings, league, dump; never NaN", () => {
  const staged = [
    { name: "collection.csv", kind: "collection" },
    { name: "dump.csv", kind: "dump" },
    { name: "pt_card_list.csv", kind: "shop_list" },
    { name: "mystery.csv", kind: "something-new" },
    { name: "pel_all.csv", kind: "league" },
  ];
  assert.deepEqual(
    [...staged].sort(compareSaveOrder).map((s) => s.kind),
    ["shop_list", "collection", "league", "dump", "something-new"],
  );
  // The old comparator returned NaN for a dump, which let the collection save first.
  for (const a of staged) for (const b of staged) assert.ok(Number.isFinite(compareSaveOrder(a, b)));
  // Within a kind, the older file saves first, so the newest lands last.
  const two = [{ kind: "shop_list", capturedOn: "2026-09-25" }, { kind: "shop_list", capturedOn: "2026-09-18" }];
  assert.deepEqual(two.sort(compareSaveOrder).map((s) => s.capturedOn), ["2026-09-18", "2026-09-25"]);
});

test("a batch saves the shop list first, and waits on it", async () => {
  const batch = (kinds: UploadKind[]) => kinds.map((kind, i) => ({ id: `${kind}-${i}`, kind, capturedOn: "2026-09-27" }));
  const run = async (kinds: UploadKind[], outcome: (kind: UploadKind) => SaveOutcome, cancelled: string[] = []) => {
    const sent: string[] = [], skipped: string[] = [], dropped: string[] = [];
    const tally = await saveInOrder(
      batch(kinds),
      async (item) => { sent.push(item.id); return outcome(item.kind); },
      { cancelled: (id) => cancelled.includes(id), onSkip: (item) => skipped.push(item.id), onCancel: (item) => dropped.push(item.id) },
    );
    return { sent, skipped, dropped, tally };
  };

  // Staged [collection, dump, shop_list]: the shop list saves first.
  const ok = await run(["collection", "dump", "shop_list"], () => "saved");
  assert.deepEqual(ok.sent, ["shop_list-2", "collection-0", "dump-1"]);
  assert.deepEqual(ok.tally, { saved: 3, already: 0, failed: 0, skipped: 0, cancelled: 0 });

  // The shop list fails: the collection is skipped, not matched against old cards; the league file still saves.
  const failed = await run(["collection", "league", "shop_list"], (kind) => (kind === "shop_list" ? "failed" : "saved"));
  assert.deepEqual(failed.sent, ["shop_list-2", "league-1"]);
  assert.deepEqual(failed.skipped, ["collection-0"]);
  assert.deepEqual(failed.tally, { saved: 1, already: 0, failed: 1, skipped: 1, cancelled: 0 });

  // A shop list already on file is not a failure.
  const already = await run(["collection", "shop_list"], (kind) => (kind === "shop_list" ? "already" : "saved"));
  assert.deepEqual(already.sent, ["shop_list-1", "collection-0"]);

  // A file removed while the batch runs is never sent.
  const cancelled = await run(["shop_list", "collection", "league"], () => "saved", ["collection-1"]);
  assert.deepEqual(cancelled.sent, ["shop_list-0", "league-2"]);
  assert.deepEqual(cancelled.dropped, ["collection-1"]);
  assert.deepEqual(cancelled.tally, { saved: 2, already: 0, failed: 0, skipped: 0, cancelled: 1 });

  // Removed mid-save, as it happens: the page removes a file while the first one is being written.
  const removed = new Set<string>();
  const live: string[] = [];
  await saveInOrder(batch(["league", "shop_list", "collection"]), async (item) => {
    live.push(item.id);
    if (item.kind === "shop_list") removed.add("league-0");
    return "saved";
  }, { cancelled: (id) => removed.has(id) });
  assert.deepEqual(live, ["shop_list-1", "collection-2"]);
});

test("older than on file: only where the newest file is the one the app reads", () => {
  assert.equal(olderThanOnFile("shop_list", "2026-09-18", "2026-09-25"), true);
  assert.equal(olderThanOnFile("collection", "2026-08-27", "2026-09-26"), true);
  assert.equal(olderThanOnFile("dump", "2026-09-14", "2026-09-21"), true);
  assert.equal(olderThanOnFile("shop_list", "2026-09-25", "2026-09-25"), false, "the same day is not older");
  assert.equal(olderThanOnFile("shop_list", "2026-09-27", "2026-09-25"), false);
  assert.equal(olderThanOnFile("shop_list", "2026-09-18", null), false, "nothing on file");
  assert.equal(olderThanOnFile("league", "2026-09-20", "2026-09-27"), false, "an older league week is a backfill");
  assert.equal(olderThanOnFile("standings", "2026-09-01", "2026-09-27"), false);
  assert.equal(olderThanOnFile("shop_list", "", "2026-09-25"), false);
});

test("a shop list moves card values only when it is the newest", () => {
  // On file: 09-25, uploaded 15:13 UTC with no date in its name.
  const onFile = { at: new Date("2026-09-25T15:13:01Z") };
  const older = stampFor("2026-09-18", onFile);
  assert.equal(older.toISOString(), "2026-09-18T12:00:00.000Z");
  assert.equal(shopListUpdatesCards(older, onFile.at), false, "a 09-18 list adds prices only");
  // A second 09-25 export is stamped after the one on file, so it is the one read.
  const sameDay = stampFor("2026-09-25", onFile);
  assert.equal(sameDay.toISOString(), "2026-09-25T15:13:02.000Z");
  assert.equal(shopListUpdatesCards(sameDay, onFile.at), true);
  const newer = stampFor("2026-09-27", onFile);
  assert.equal(newer.toISOString(), "2026-09-27T12:00:00.000Z");
  assert.equal(shopListUpdatesCards(newer, onFile.at), true);
  assert.equal(shopListUpdatesCards(older, null), true, "the first shop list ever");
  // 21:17 in Chicago on 09-26 is 02:17 UTC on 09-27: a file saved as 09-27 is still newer.
  assert.equal(stampFor("2026-09-27", { at: new Date("2026-09-27T02:17:24Z") }).toISOString(), "2026-09-27T12:00:00.000Z");
  // …and one saved as 09-26 is the same Chicago day, so it goes after it.
  assert.equal(stampFor("2026-09-26", { at: new Date("2026-09-27T02:17:24Z") }).toISOString(), "2026-09-27T02:17:25.000Z");
});

test("the page's warning and the route's guard agree on which shop list is older", () => {
  // The page warns by day (olderThanOnFile); the route decides by timestamp
  // (stampFor, then shopListUpdatesCards). Every day against every kind of
  // stamp on file: morning and evening UTC, noon, and a Chicago evening that
  // is already tomorrow in UTC.
  const stamps = ["2026-09-25T12:00:00Z", "2026-09-25T15:13:01Z", "2026-09-25T04:30:00Z", "2026-09-26T02:17:24Z", "2026-09-26T04:59:59Z"];
  for (const at of stamps) {
    const onFile = { at: new Date(at) };
    const onFileDay = chicagoDay(onFile.at)!;
    for (let d = 20; d <= 30; d++) {
      const day = `2026-09-${d}`;
      const older = olderThanOnFile("shop_list", day, onFileDay);
      assert.equal(shopListUpdatesCards(stampFor(day, onFile), onFile.at), !older, `${day} against ${at} (${onFileDay})`);
    }
  }
});

test("a YYYY-MM-DD folder names the league week", () => {
  assert.equal(folderDateOf("League Data/2026-09-20/pel_all.csv"), "2026-09-20");
  assert.equal(folderDateOf("2026-09-20/pel_all.csv"), "2026-09-20");
  assert.equal(folderDateOf("League Data/2026-09-20/extra/hd451_vL.csv"), "2026-09-20", "the nearest dated folder");
  assert.equal(folderDateOf("2026-09-13/2026-09-20/pel_vR.csv"), "2026-09-20");
  assert.equal(folderDateOf("pel_all.csv"), null);
  assert.equal(folderDateOf("League Data/pel_all 2026-09-20.csv"), null, "a date in the name is not a folder");
  assert.equal(folderDateOf("2026-09-31/pel_all.csv"), null, "not a real day");
});

test("dates in filenames", () => {
  const today = "2026-09-27";
  assert.equal(nameDateOf("pt_card_list 2026-09-18.csv", today), "2026-09-18");
  assert.equal(nameDateOf("pt27_tournaments_competitve_dump_20260921.csv", today), "2026-09-21");
  assert.equal(nameDateOf("pt_card_list 8.27.csv", today), "2026-08-27");
  assert.equal(nameDateOf("my cards 8.21.csv", today), "2026-08-21");
  assert.equal(nameDateOf("pt_card_list 12.30.csv", today), "2025-12-30", "never in the future");
  assert.equal(nameDateOf("pt_card_list.csv", today), null);
  assert.equal(nameDateOf("hd451_vl (1).csv", today), null);
  assert.equal(nameDateOf("pt_card_list 2026-02-30.csv", today), null);
  assert.equal(nameDateOf("pt_card_list 2026-10-05.csv", today), null, "a later day is a typo, not a date");
  assert.equal(nameDateOf("pt27_tournaments_competitve_dump_20261005.csv", today), null);
  assert.equal(nameDateOf("pel_all 2026-10-04.csv", "2026-09-30", latestDayFor("league", "2026-09-30")), "2026-10-04", "a league week can end on the coming Sunday");
});

test("nothing can be saved as a day after today, or after the league week's Sunday", () => {
  assert.equal(latestDayFor("shop_list", "2026-09-27"), "2026-09-27");
  assert.equal(latestDayFor("collection", "2026-09-30"), "2026-09-30");
  assert.equal(latestDayFor("league", "2026-09-30"), "2026-10-04", "Wednesday: this week's Sunday");
  assert.equal(latestDayFor("league", "2026-09-28"), "2026-09-27", "Monday: the week that just ended");
  assert.equal(latestDayFor("league", "2026-09-27"), "2026-09-27", "Sunday is its own");
  assert.equal(defaultSavedAs("shop_list", "pt_card_list 2026-10-05.csv", null, new Date(2026, 8, 27, 10)), "2026-09-27", "a typo'd name falls back to today");
  assert.equal(defaultSavedAs("collection", "collection.csv", "2026-10-05", new Date(2026, 8, 27, 10)), "2026-09-27", "so does a future folder");
});

test("the Saved as date a file starts with", () => {
  const monday = new Date(2026, 8, 28, 21, 30), wednesday = new Date(2026, 8, 30, 9, 0);
  assert.equal(defaultSavedAs("league", "pel_all.csv", "2026-09-20", monday), "2026-09-20", "the folder wins");
  assert.equal(defaultSavedAs("league", "pel_all.csv", null, monday), "2026-09-27", "Monday: the week that just ended");
  assert.equal(defaultSavedAs("league", "pel_all.csv", null, wednesday), "2026-10-04", "part-played: this week's Sunday");
  assert.equal(defaultSavedAs("league", "pel_all 2026-09-23.csv", null, wednesday), "2026-09-27", "a dated file goes to its Sunday");
  assert.equal(defaultSavedAs("shop_list", "pt_card_list 2026-09-18.csv", null, monday), "2026-09-18");
  assert.equal(defaultSavedAs("shop_list", "pt_card_list.csv", "2026-09-20", monday), "2026-09-20");
  assert.equal(defaultSavedAs("shop_list", "pt_card_list.csv", null, monday), "2026-09-28");
  assert.equal(defaultSavedAs("standings", "pt_standings_diamond_2026-08-02.csv", null, monday), "2026-09-28", "the name is the period, not the day pulled");

  // An export with no date in its name is dated by the file's own timestamp, not today.
  const written = new Date(2026, 8, 18, 22, 5);
  assert.equal(defaultSavedAs("shop_list", "pt_card_list.csv", null, monday, written), "2026-09-18", "an old undated shop list reads as old");
  assert.equal(defaultSavedAs("collection", "ptcardlist.csv", null, monday, written), "2026-09-18");
  assert.equal(defaultSavedAs("shop_list", "pt_card_list 2026-09-25.csv", null, monday, written), "2026-09-25", "a date in the name still wins");
  assert.equal(defaultSavedAs("shop_list", "pt_card_list.csv", "2026-09-20", monday, written), "2026-09-20", "so does a dated folder");
  assert.equal(defaultSavedAs("standings", "pt_standings_diamond_2026-08-02.csv", null, monday, written), "2026-09-18", "the day it was pulled");
  assert.equal(defaultSavedAs("league", "hd451_vl (1).csv", null, monday, written), "2026-09-20", "the week it was pulled in");
  assert.equal(defaultSavedAs("league", "pel_all.csv", "2026-09-27", monday, written), "2026-09-27", "the week folder wins");
  assert.equal(defaultSavedAs("shop_list", "pt_card_list.csv", null, monday, new Date(2026, 9, 2)), "2026-09-28", "a timestamp in the future is ignored");
  assert.equal(defaultSavedAs("shop_list", "pt_card_list.csv", null, monday, new Date(Number.NaN)), "2026-09-28");
});

test("size: the website stops at 4.4 MB and says what to do", () => {
  assert.equal(tooLarge(MAX_UPLOAD_BYTES), false);
  assert.equal(tooLarge(MAX_UPLOAD_BYTES + 1), true);
  assert.equal(tooLarge(1_765_590), false, "a shop list");
  assert.equal(tooLarge(8_212_546), true, "a tournaments dump");
  assert.equal(
    tooLargeMessage(8_000_000),
    "Too large for the website (8.0 MB; limit 4.5 MB). Community dumps: double-click Load Tourney Dumps.command on the Mac.",
  );
  assert.equal(isCsvName("pel_all.CSV"), true);
  assert.equal(isCsvName("pel_all.xlsx"), false);
});

test("two files of one kind in a batch: the newest is saved", () => {
  const items = [
    { id: "a", name: "pt_card_list 2026-09-18.csv", status: "ready", kind: "shop_list" as const, capturedOn: "2026-09-18" },
    { id: "b", name: "pt_card_list 2026-09-20.csv", status: "ready", kind: "shop_list" as const, capturedOn: "2026-09-20" },
    { id: "c", name: "t.csv", status: "ready", kind: "dump" as const, capturedOn: "2026-09-14", source: "tournaments" },
    { id: "d", name: "d.csv", status: "ready", kind: "dump" as const, capturedOn: "2026-09-21", source: "drafts" },
    { id: "e", name: "pel_all.csv", status: "ready", kind: "league" as const, capturedOn: "2026-09-20" },
    { id: "f", name: "pel_all (1).csv", status: "ready", kind: "league" as const, capturedOn: "2026-09-27" },
    { id: "g", name: "pt_card_list.csv", status: "saved", kind: "shop_list" as const, capturedOn: "2026-09-27" },
  ];
  const s = supersededBy(items);
  assert.deepEqual([...s.keys()], ["a"]);
  assert.equal(s.get("a")?.name, "pt_card_list 2026-09-20.csv");
  // A collection skipped by the last save still counts against a newer one.
  const again = supersededBy([
    { id: "x", name: "collection 2026-09-26.csv", status: "skipped", kind: "collection", capturedOn: "2026-09-26" },
    { id: "y", name: "collection 2026-09-27.csv", status: "ready", kind: "collection", capturedOn: "2026-09-27" },
  ]);
  assert.equal(again.get("x")?.id, "y");
});

test("Save sends only what is included", () => {
  const onFile = { date: "2026-09-25" };
  const item = (id: string, kind: UploadKind, capturedOn: string, over: { status?: string; forced?: boolean } = {}) =>
    ({ id, name: `${id}.csv`, status: over.status ?? "ready", kind, capturedOn, onFile, forced: over.forced });
  const ids = (s: Set<string>) => [...s].sort();

  // A 09-18 shop list against the 09-25 on file: held back, so "Save 0 files".
  const old = savePlan([item("shop-0918", "shop_list", "2026-09-18")]);
  assert.deepEqual(ids(old.older), ["shop-0918"]);
  assert.deepEqual(ids(old.included), []);
  // Include anyway puts it back.
  assert.deepEqual(ids(savePlan([item("shop-0918", "shop_list", "2026-09-18", { forced: true })]).included), ["shop-0918"]);

  // Two newer shop lists in one batch: the newest goes; the other is superseded unless included anyway.
  const two = savePlan([item("shop-0926", "shop_list", "2026-09-26"), item("shop-0927", "shop_list", "2026-09-27")]);
  assert.deepEqual(ids(two.included), ["shop-0927"]);
  assert.equal(two.superseded.get("shop-0926")?.id, "shop-0927");

  // Only previewed files go: not one previewing, saved, already saved or failed.
  const states = ["previewing", "saving", "saved", "already", "error"].map((status) => item(status, "league", "2026-09-27", { status }));
  assert.deepEqual(ids(savePlan(states).included), []);

  // League weeks and standings are never "older": a past week is a backfill.
  assert.deepEqual(ids(savePlan([{ ...item("pel", "league", "2026-09-13"), onFile: { date: "2026-09-27" } }]).included), ["pel"]);

  // A collection skipped because its shop list failed waits for a shop list that saves ahead of it…
  const skipped = item("coll", "collection", "2026-09-27", { status: "skipped" });
  const alone = savePlan([skipped, item("shop-failed", "shop_list", "2026-09-27", { status: "error" })]);
  assert.deepEqual(ids(alone.included), []);
  assert.equal(alone.shopGoes, false);
  // …goes when the shop list is dropped again…
  const both = savePlan([skipped, item("shop-again", "shop_list", "2026-09-27")]);
  assert.deepEqual(ids(both.included), ["coll", "shop-again"]);
  assert.equal(both.shopGoes, true);
  // …but not behind a shop list that is itself held back as older…
  assert.deepEqual(ids(savePlan([skipped, item("shop-old", "shop_list", "2026-09-18")]).included), []);
  // …and goes alone only when included anyway.
  assert.deepEqual(ids(savePlan([{ ...skipped, forced: true }]).included), ["coll"]);
});

test("Will save names each kind and its date", () => {
  const now = new Date("2026-09-27T15:00:00Z");
  const league = Array.from({ length: 15 }, () => ({ kind: "league" as const, capturedOn: "2026-09-27" }));
  assert.equal(
    willSaveSummary([...league, { kind: "collection", capturedOn: "2026-09-18" }, { kind: "shop_list", capturedOn: "2026-09-18" }], now),
    "shop list (Sep 18), collection (Sep 18), 15 league files (week ending Sep 27)",
  );
  assert.equal(
    willSaveSummary([{ kind: "league", capturedOn: "2026-09-20" }, { kind: "league", capturedOn: "2026-09-27" }], now),
    "2 league files (weeks ending Sep 20, Sep 27)",
  );
});

test("a league week reads back its leagues and flags missing splits", () => {
  const week = ["HD450", "HD451", "PEL"].flatMap((league) => ["all", "vL", "vR"].map((split) => ({ league, split })));
  assert.deepEqual(leagueWeekCheck(week), { leagues: ["HD450", "HD451", "PEL"], splits: ["all", "vL", "vR"], problems: [] });
  const gaps = leagueWeekCheck([...week.filter((f) => !(f.league === "PEL" && f.split === "vR")), { league: "HD451", split: "vL" }]);
  assert.deepEqual(gaps.problems, ["HD451 vL: 2 files; the last one saved is kept", "PEL: vR missing"]);
});

test("League week is stale once a newer Sunday has come", () => {
  assert.equal(lastSunday("2026-09-27"), "2026-09-27", "a Sunday is its own");
  assert.equal(lastSunday("2026-09-28"), "2026-09-27");
  assert.equal(lastSunday("2026-10-03"), "2026-09-27");
  assert.equal(lastSunday("2026-10-04"), "2026-10-04");
});

test("a dropped folder is read to the bottom, in batches", async () => {
  const file = (name: string) => ({ name, size: 10 }) as unknown as File;
  const fileEntry = (path: string) => ({
    isFile: true, isDirectory: false, name: path.split("/").pop()!, fullPath: `/${path}`,
    file: (ok: (f: File) => void) => ok(file(path.split("/").pop()!)),
  });
  const dirEntry = (path: string, children: unknown[], batch = 2) => {
    let at = 0;
    return {
      isFile: false, isDirectory: true, name: path.split("/").pop()!, fullPath: `/${path}`,
      createReader: () => ({
        // Hands back `batch` entries a call, then an empty batch, like Chrome's 100.
        readEntries: (ok: (e: unknown[]) => void) => { const out = children.slice(at, at + batch); at += batch; ok(out); },
      }),
    };
  };
  const week = dirEntry("2026-09-20", [
    fileEntry("2026-09-20/pel_vR.csv"),
    fileEntry("2026-09-20/pel_all.csv"),
    fileEntry("2026-09-20/.DS_Store"),
    fileEntry("2026-09-20/pel_vL.csv"),
    dirEntry("2026-09-20/more", [fileEntry("2026-09-20/more/hd450_all.csv")]),
  ]);
  const got = await readDropped([week, fileEntry("pt_card_list.csv")] as unknown as FileSystemEntry[]);
  assert.deepEqual(got.map((d) => d.path), [
    "2026-09-20/more/hd450_all.csv",
    "2026-09-20/pel_all.csv",
    "2026-09-20/pel_vL.csv",
    "2026-09-20/pel_vR.csv",
    "pt_card_list.csv",
  ]);
  assert.ok(got.every((d) => d.file && !d.error));
  const broken = { isFile: true, isDirectory: false, name: "x.csv", fullPath: "/x.csv", file: (_ok: unknown, fail: (e: Error) => void) => fail(new Error("gone")) };
  const [bad] = await readDropped([broken] as unknown as FileSystemEntry[]);
  assert.equal(bad.file, null);
  assert.match(bad.error ?? "", /Could not read x\.csv: gone/);
});
