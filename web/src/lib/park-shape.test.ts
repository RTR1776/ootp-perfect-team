import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chipText, dimsFor, dimsTable, factorChips, fieldShape, HOME, linear, monotone, parkView, profilePoints, wallColor, wallProfile,
  type ParkDims,
} from "./park-shape";

/** Every stadium a current event names (2026-10-18), and the ones with nothing on file. */
const EVENT_STADIUMS = [
  "2025 Standard Stadium", "Heinsohn Park", "2026 American Family Field", "2026 Wrigley Field", "2026 Fenway Park", "1964 Shea Stadium",
  "1955 Ebbets Field", "2026 Yankee Stadium", "2026 Coors Field", "2000 Coors Field", "1986 Three Rivers Stadium",
  "1977 Atlanta Fulton County Stadium", "1999 Jacobs Field", "2008 McAfee Coliseum", "1996 Dodger Stadium", "1919 Fenway Park",
  "1990 Metrodome", "2026 PNC Park", "1984 Jack Murphy Stadium", "1977 Kingdome", "2026 Globe Life Field", "1968 Busch Stadium",
  "2008 Shea Stadium", "2026 Citizens Bank Park", "2026 Truist Park", "1971 Yankee Stadium", "2026 Kauffman Stadium",
  "1996 Coors Field", "2026 Dell Diamond", "1886 Swampoodle Grounds", "1945 Comiskey Park", "1977 Olympic Stadium",
  "2026 Rate Field", "2026 Chase Field", "1945 Wrigley Field", "1992 SkyDome", "1958 Tiger Stadium", "1990 Anaheim Stadium",
  "2026 Heinsohn Ballpark", "1959 Seals Stadium", "1927 Yankee Stadium", "1978 Riverfront Stadium", "1984 Olympic Stadium",
  "1982 Kingdome", "1991 Cleveland Stadium", "2026 Great American Ball Park", "2026 Daikin Park", "1930 Hamtramck Stadium",
  "2003 Dodger Stadium", "1976 Jarry Park", "2026 Tropicana Field", "1968 Connie Mack Stadium", "1954 Griffith Stadium",
  "1936 Crosley Field", "2026 Petco Park", "2005 Minute Maid Park", "Standard Stadium", "2026 Isotopes Park", "1998 Wrigley Field",
  "1979 Candlestick Park", "1958 Crosley Field", "1992 Camden Yards", "1970 County Stadium", "1911 Washington Park",
  "2017 Marlins Park", "1890 Exposition Park", "1977 Wrigley Field", "2026 Sutter Health Park",
];
const NOT_ON_FILE = ["Heinsohn Park", "1886 Swampoodle Grounds", "2026 Heinsohn Ballpark"];

test("every current event's park has dimensions, but the three no source gives", () => {
  assert.equal(EVENT_STADIUMS.length, 68);
  const missing = EVENT_STADIUMS.filter((s) => dimsFor(s) == null);
  assert.deepEqual(missing, NOT_ON_FILE);
  // The event's own year is on file for every park that has dimensions: none is a nearest-year stand-in.
  for (const s of EVENT_STADIUMS) {
    const p = dimsFor(s);
    if (p && p.asked != null) assert.equal(p.year, p.asked, s);
  }
});

test("the era decides the park: Yankee Stadium 1927, 1971 and 2026 are three different fields", () => {
  const y27 = dimsFor("1927 Yankee Stadium")!, y71 = dimsFor("1971 Yankee Stadium")!, y26 = dimsFor("2026 Yankee Stadium")!;
  assert.equal(y27.name, "Yankee Stadium");
  assert.deepEqual([y27.dims.lf, y27.dims.cf, y27.dims.rf], [281, 470, 295]);
  assert.ok(profilePoints(y27.dims).some(([, ft]) => ft === 490), "Death Valley's 490 is on the 1927 wall");
  assert.deepEqual([y71.dims.lf, y71.dims.cf, y71.dims.rf], [301, 449, 296]);
  assert.deepEqual([y26.dims.lf, y26.dims.lcf, y26.dims.cf, y26.dims.rcf, y26.dims.rf], [318, 399, 408, 385, 314]);
  // Fenway before and after the Monster; Coors' walls by year.
  assert.equal(dimsFor("1919 Fenway Park")!.dims.wall.lf, 25);
  assert.equal(dimsFor("2026 Fenway Park")!.dims.wall.lf, 37);
  assert.equal(dimsFor("1996 Coors Field")!.dims.wall.rf, 14);
  assert.equal(dimsFor("2000 Coors Field")!.dims.wall.rf, 17);
});

test("nearest year on file, the way parkFor picks factors", () => {
  assert.equal(dimsFor("1930 Yankee Stadium")!.year, 1927);
  assert.equal(dimsFor("1960 Yankee Stadium")!.year, 1952, "a tie goes to the earlier year");
  assert.equal(dimsFor("2030 Yankee Stadium")!.year, 2026);
  assert.equal(dimsFor("Yankee Stadium")!.year, 2026, "no year: the latest");
  assert.equal(dimsFor("1966 Shea Stadium")!.year, 1964);
});

test("the catalogue's spellings find the table's parks", () => {
  assert.equal(dimsFor("1992 Camden Yards")!.name, "Oriole Park at Camden Yards");
  assert.equal(dimsFor("2008 McAfee Coliseum")!.name, "McAfee Stadium");
  assert.equal(dimsFor("2005 Minute Maid Park")!.name, "Minute Maid Park");
  assert.equal(dimsFor("2005 Minute Maid Park")!.dims.cf, 436, "Tal's Hill");
  assert.equal(dimsFor("2026 Daikin Park")!.name, "Daikin Park");
  assert.equal(dimsFor("2026 Great American Ball Park")!.name, "Great American Ballpark");
  assert.equal(dimsFor("2026 Isotopes Park")!.name, "Rio Grande Credit Union Field at Isotopes Park");
  assert.equal(dimsFor("1890 Exposition Park")!.name, "Expostition Park III");
  assert.equal(dimsFor("2025 Standard Stadium")!.dims.assumed, true);
  assert.equal(dimsFor("Standard Stadium")!.name, "Standard Stadium");
  assert.equal(dimsFor(null), null);
  assert.equal(dimsFor(""), null);
});

test("the data file: plausible feet, sourced, angles inside the lines", () => {
  for (const [park, years] of Object.entries(dimsTable)) {
    for (const [year, d] of Object.entries(years)) {
      const at = `${park} ${year}`;
      assert.match(year, /^\d{4}$/, at);
      for (const f of [d.lf, d.cf, d.rf]) assert.ok(f >= 250 && f <= 600, `${at}: ${f}`);
      for (const f of [d.lcf, d.rcf]) assert.ok(f == null || (f >= 280 && f <= 600), `${at}: ${f}`);
      for (const h of Object.values(d.wall)) assert.ok(h == null || (h > 0 && h < 60), `${at}: wall ${h}`);
      for (const [deg, ft] of d.extra ?? []) assert.ok(deg > -45 && deg < 45 && ft >= 250 && ft <= 600, `${at}: ${deg} ${ft}`);
      assert.match(d.source, /^https:\/\//, at);
      assert.ok(d.note.length > 10, at);
    }
  }
});

test("the curve passes through every measured point and never overshoots between them", () => {
  const pts: [number, number][] = [[-45, 310], [-22.5, 335], [-15, 379], [-7.5, 388], [0, 390], [7.5, 420], [22.5, 380], [45, 302]];
  const f = monotone(pts);
  for (const [x, y] of pts) assert.ok(Math.abs(f(x) - y) < 1e-9, `${x}`);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    for (let t = 0.1; t < 1; t += 0.1) {
      const v = f(x0 + (x1 - x0) * t);
      assert.ok(v >= Math.min(y0, y1) - 1e-9 && v <= Math.max(y0, y1) + 1e-9, `${x0}..${x1} at ${t}: ${v}`);
    }
  }
  assert.equal(linear([[-45, 37], [-15, 37], [-13, 18]], -30), 37);
  assert.equal(linear([[-45, 8], [45, 16]], 0), 12);
});

const plain: ParkDims = { lf: 330, lcf: 375, cf: 400, rcf: 375, rf: 330, wall: { lf: 8, lcf: 8, cf: 8, rcf: 8, rf: 8 }, note: "test park", source: "https://example.org" };

test("a symmetric park draws symmetric, from home at the generic diamond's plate", () => {
  const s = fieldShape(plain);
  const n = s.samples.length;
  assert.equal(n, 181);
  for (let i = 0; i < n; i++) {
    const a = s.samples[i], b = s.samples[n - 1 - i];
    assert.ok(Math.abs(a.inner.x - HOME.x + (b.inner.x - HOME.x)) < 1e-6 && Math.abs(a.inner.y - b.inner.y) < 1e-6, `${a.deg}`);
  }
  // The poles are on the foul lines, at 45 degrees on the box's design shape.
  const dx = HOME.x - s.poles.lf.x, dy = HOME.y - s.poles.lf.y;
  assert.ok(Math.abs(dx * 1.25 - dy) < 1e-6);
  // A 400-ft centre field sits by the generic outfield arc, inside the box.
  const cf = s.samples[(n - 1) / 2];
  assert.ok(cf.inner.y > 3 && cf.inner.y < 7, `${cf.inner.y}`);
  assert.deepEqual(s.labels.map((l) => [l.key, l.feet]), [["lf", 330], ["lcf", 375], ["cf", 400], ["rcf", 375], ["rf", 330]]);
});

test("deeper reads deeper, tall walls draw thicker, and nothing leaves the box", () => {
  const deep = fieldShape({ ...plain, cf: 470, lcf: 461, extra: [[-7.5, 490]] });
  const base = fieldShape(plain);
  const mid = (s: ReturnType<typeof fieldShape>) => s.samples[(s.samples.length - 1) / 2];
  assert.ok(mid(deep).inner.y < mid(base).inner.y, "a 470 centre field is drawn deeper than a 400 one");
  assert.ok(deep.labels.some((l) => l.key === "deep" && l.feet === 490), "the deepest corner gets its own label");
  for (const s of [deep, base, fieldShape({ ...plain, lf: 464, rf: 400 }), fieldShape(dimsFor("1890 Exposition Park")!.dims, 0.94)]) {
    for (const p of s.samples) {
      assert.ok(p.outer.y >= 2 && p.outer.x >= 1.9 && p.outer.x <= 98.1, `${p.deg}: ${p.outer.x}, ${p.outer.y}`);
    }
  }
  const monster = fieldShape(dimsFor("2026 Fenway Park")!.dims);
  const band = (s: (typeof monster.samples)[number]) => Math.hypot(s.outer.x - s.inner.x, s.outer.y - s.inner.y);
  const at = (deg: number) => monster.samples.find((x) => x.deg === deg)!;
  assert.ok(band(at(-30)) > 2 * band(at(30)), "the Green Monster is thick next to the right-field wall");
  assert.equal(monster.tallest!.feet, 37);
  assert.notEqual(wallColor(37), wallColor(8));
});

test("unknown walls draw at a nominal height and say so; null alleys aren't labelled", () => {
  const d = dimsFor("2026 Sutter Health Park")!.dims;
  assert.equal(wallProfile(d).known, false);
  const s = fieldShape(d);
  assert.equal(s.wallKnown, false);
  assert.deepEqual(s.labels.map((l) => l.key), ["lf", "cf", "rf"]);
});

test("factor chips: only what moves a line by 2% or more, biggest first", () => {
  const row = { team: null, avgL: 1.019, avgR: 0.98, hrL: 1.07, hrR: 1.0, d2: 1.02, d3: 0.9 };
  assert.deepEqual(factorChips(row).map(chipText), ["3B ×0.90", "HR vs LHB ×1.07", "AVG vs RHB ×0.98", "2B ×1.02"]);
  assert.deepEqual(factorChips(null), []);
  const fenway = parkView("2026 Fenway Park")!;
  assert.equal(fenway.name, "Fenway Park");
  assert.ok(fenway.chips.length > 0 && fenway.chips.length <= 4);
  assert.deepEqual(parkView("2025 Standard Stadium")!.chips, [], "a neutral park has no chips");
  assert.equal(parkView("Heinsohn Park"), null);
});
