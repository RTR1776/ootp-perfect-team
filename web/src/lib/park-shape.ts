/**
 * The event's ballpark, drawn: which dimensions a stadium string gets, and the
 * shape they make on the Build page's field.
 *
 * Dimensions (data/park-dimensions.json) are filed under the park-factor
 * table's names and years, so a stadium resolves the way parkFor resolves it
 * (aliases, spelling) and takes the nearest year on file, the way parkFor
 * picks factors: 1927 and 1971 Yankee Stadium are different parks.
 *
 * Geometry works in degrees off straightaway centre, left field negative:
 * the foul poles at ±45, the alleys at ±22.5 unless a park files them
 * elsewhere (`at`), centre at 0, and any further measured points (`extra`).
 * A monotone curve through them is the wall, so it never bulges past a
 * measured point. The picture sits in the 100 × 100 viewBox the field
 * backdrop uses (stretched to its box), with home plate where the generic
 * diamond has it and a 400-ft centre field near the generic outfield arc; a
 * wall too deep for the box is eased in (never past the top), so deeper still
 * reads deeper, and the labels say the real number.
 */

import DIMS from "@/data/park-dimensions.json";
import { parkFor, type ParkRow } from "@/lib/analytics/tournament-env";

export type Feet = number | null;

export interface WallHeights { lf: Feet; lcf: Feet; cf: Feet; rcf: Feet; rf: Feet }

export interface ParkDims {
  /** Feet to the wall: the foul poles, the alleys and centre. An alley no source gives is null. */
  lf: number; lcf: Feet; cf: number; rcf: Feet; rf: number;
  /** Wall height in feet at the same five spots; null where no source gives it. */
  wall: WallHeights;
  /** Further measured points, [degrees off centre (left negative), feet]. */
  extra?: [number, number][];
  /** Degrees off centre for an alley figure that isn't at 22.5 (Fenway's 379 sits at 15). */
  at?: { lcf?: number; rcf?: number };
  /** A full wall-height profile, [degrees, feet], where five heights can't describe it (the Green Monster). */
  wallPts?: [number, number][];
  /** No source: a conventional park drawn in its place (Standard Stadium). */
  assumed?: boolean;
  note: string;
  source: string;
}

export const dimsTable = DIMS as unknown as Record<string, Record<string, ParkDims>>;
export const dimsNames = Object.keys(dimsTable).sort();

/** Names the dimension table files under the factor table's spelling ("Expostition Park III"). */
const DIMS_ALIAS: Record<string, string> = { "Exposition Park": "Expostition Park III" };

export interface DimsPick {
  /** The table's name for the park. */
  name: string;
  /** The year whose dimensions are drawn. */
  year: number;
  /** The year the event names, if any. */
  asked: number | null;
  dims: ParkDims;
}

/** The dimensions on file for an event's stadium ("1927 Yankee Stadium"), nearest year; null when none are. */
export function dimsFor(stadium: string | null): DimsPick | null {
  if (!stadium) return null;
  const m = /^(\d{4})\s+(.*)$/.exec(stadium.trim());
  const asked = m ? Number(m[1]) : null;
  const raw = (m ? m[2] : stadium).trim();

  const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  let key: string | null = null;
  if (/^standard stadium$/i.test(raw)) key = dimsTable["Standard Stadium"] ? "Standard Stadium" : null;
  else {
    const viaFactors = parkFor(stadium).name;
    for (const k of [viaFactors, raw, DIMS_ALIAS[raw]]) if (k && dimsTable[k]) { key = k; break; }
    if (!key) {
      const hits = dimsNames.filter((p) => flat(p) === flat(raw));
      if (hits.length === 1) key = hits[0];
    }
  }
  if (!key) return null;

  const years = Object.keys(dimsTable[key]).map(Number).sort((a, b) => a - b);
  const year = asked == null
    ? years[years.length - 1]
    : years.reduce((best, y) => (Math.abs(y - asked) < Math.abs(best - asked) ? y : best), years[0]);
  return { name: key, year, asked, dims: dimsTable[key][String(year)] };
}

/* ------------------------------------------------------------------ factors */

export interface FactorChip { key: keyof Omit<ParkRow, "team">; label: string; value: number }

const FACTOR_LABEL: [FactorChip["key"], string][] = [
  ["avgL", "AVG vs LHB"], ["avgR", "AVG vs RHB"], ["hrL", "HR vs LHB"], ["hrR", "HR vs RHB"], ["d2", "2B"], ["d3", "3B"],
];

/** The park's hitting factors that move a line by `min` (2%) or more, biggest first. */
export function factorChips(row: ParkRow | null, min = 0.02, limit = 6): FactorChip[] {
  if (!row) return [];
  return FACTOR_LABEL
    .map(([key, label]) => ({ key, label, value: row[key] }))
    .filter((c) => typeof c.value === "number" && Math.abs(c.value - 1) >= min - 1e-9)
    .sort((a, b) => Math.abs(b.value - 1) - Math.abs(a.value - 1))
    .slice(0, limit);
}

export const chipText = (c: FactorChip) => `${c.label} ×${c.value.toFixed(2)}`;

/** Everything the field needs about an event's park; null when no dimensions are on file. */
export interface ParkView {
  stadium: string;
  name: string;
  year: number;
  asked: number | null;
  dims: ParkDims;
  chips: FactorChip[];
  /** parkFor's label for the factors used ("Fenway Park 2026", "… → neutral"). */
  factorLabel: string;
}

export function parkView(stadium: string | null, chipLimit = 4): ParkView | null {
  const pick = dimsFor(stadium);
  if (!pick || !stadium) return null;
  const f = parkFor(stadium);
  return { stadium, ...pick, chips: factorChips(f.row, 0.02, chipLimit), factorLabel: f.label };
}

/* ----------------------------------------------------------------- geometry */

/** Points [degrees, feet] the wall passes through, by angle; the five come first at a shared angle. */
export function profilePoints(d: ParkDims): [number, number][] {
  const at = d.at ?? {};
  const pts: [number, number][] = [[-45, d.lf], [0, d.cf], [45, d.rf]];
  if (d.lcf != null) pts.push([-(at.lcf ?? 22.5), d.lcf]);
  if (d.rcf != null) pts.push([at.rcf ?? 22.5, d.rcf]);
  for (const [deg, ft] of d.extra ?? []) if (ft > 0 && deg > -45 && deg < 45) pts.push([deg, ft]);
  const seen = new Set<number>();
  return pts.filter(([deg]) => (seen.has(deg) ? false : (seen.add(deg), true))).sort((a, b) => a[0] - b[0]);
}

/** Wall heights [degrees, feet] by angle, and whether any came from a source (else a nominal 8 ft). */
export function wallProfile(d: ParkDims): { pts: [number, number][]; known: boolean } {
  if (d.wallPts?.length) return { pts: [...d.wallPts].sort((a, b) => a[0] - b[0]), known: true };
  const at = d.at ?? {};
  const w = d.wall;
  const pts = ([[-45, w.lf], [-(at.lcf ?? 22.5), w.lcf], [0, w.cf], [at.rcf ?? 22.5, w.rcf], [45, w.rf]] as [number, Feet][])
    .filter((p): p is [number, number] => p[1] != null && p[1] > 0);
  return pts.length ? { pts, known: true } : { pts: [[-45, 8], [45, 8]], known: false };
}

/** Piecewise-linear lookup, held flat past the ends. */
export function linear(pts: [number, number][], x: number): number {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    if (x <= x1) {
      const [x0, y0] = pts[i - 1];
      return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

/**
 * A monotone cubic (Fritsch–Carlson) through the points: smooth, exact at
 * each point, and never above or below its two neighbours in between, so a
 * curve through measured distances can't invent a deeper corner.
 */
export function monotone(pts: [number, number][]): (x: number) => number {
  const n = pts.length;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  if (n === 1) return () => ys[0];
  const h: number[] = [], s: number[] = [];
  for (let i = 0; i < n - 1; i++) { h.push(xs[i + 1] - xs[i]); s.push((ys[i + 1] - ys[i]) / h[i]); }
  const m: number[] = new Array(n);
  m[0] = s[0]; m[n - 1] = s[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (s[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / s[i], b = m[i + 1] / s[i], r = a * a + b * b;
    if (r > 9) { const t = 3 / Math.sqrt(r); m[i] = t * a * s[i]; m[i + 1] = t * b * s[i]; }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
}

export interface Pt { x: number; y: number }

/** Home plate in the backdrop's viewBox: where the generic diamond has it. */
export const HOME: Pt = { x: 50, y: 89 };
/** viewBox units per foot, up the page: a 400-ft centre field reaches y ≈ 5, the generic arc. */
export const KY = 0.21;
/** The box's design shape (aspect-[5/4]); the view measures the real one. */
export const DESIGN_ASPECT = 1.25;
const TOP = 2.5, SIDE = 2, KNEE = 20, TRACK_FT = 15;

/** How thick the wall is drawn, in feet of field, for a wall this tall: a 37-ft wall reads at a glance. */
export const wallThickness = (heightFt: number) => 2 + 0.42 * heightFt;

/** A wall height as a colour, low and muted to tall and gold (the field is dark in both themes). */
const RAMP: [number, [number, number, number]][] = [[6, [86, 113, 95]], [12, [141, 138, 79]], [20, [199, 154, 60]], [32, [240, 197, 82]]];
export function wallColor(heightFt: number): string {
  const h = Math.max(RAMP[0][0], Math.min(RAMP[RAMP.length - 1][0], heightFt));
  let i = 1;
  while (i < RAMP.length - 1 && h > RAMP[i][0]) i++;
  const [h0, c0] = RAMP[i - 1], [h1, c1] = RAMP[i];
  const t = h1 === h0 ? 0 : (h - h0) / (h1 - h0);
  const ch = (k: number) => Math.round(c0[k] + (c1[k] - c0[k]) * t).toString(16).padStart(2, "0");
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

export type LabelKey = "lf" | "lcf" | "cf" | "rcf" | "rf" | "deep";
/** A distance to paint: `at` is the top of the wall there, in the viewBox. */
export interface DistanceLabel { key: LabelKey; deg: number; feet: number; wall: number | null; at: Pt }

export interface WallSample { deg: number; feet: number; plotted: number; height: number; inner: Pt; outer: Pt; trackIn: Pt }

export interface FieldShape {
  kx: number;
  ky: number;
  samples: WallSample[];
  /** The wall itself, a band from its face out by its height. */
  wallPath: string;
  /** Fair ground to the wall's face (drawn as the warning track, grass over it). */
  fairPath: string;
  grassPath: string;
  foulPath: string;
  poles: { lf: Pt; rf: Pt };
  infield: { dirt: { cx: number; cy: number; rx: number; ry: number }; grass: string; mound: { cx: number; cy: number; rx: number; ry: number }; plate: { cx: number; cy: number; rx: number; ry: number }; bases: Pt[]; paths: string };
  /** Wall colour by x, for a horizontal gradient across the band. */
  gradient: { offset: number; color: string }[];
  gradientX: [number, number];
  labels: DistanceLabel[];
  tallest: { feet: number; deg: number } | null;
  wallKnown: boolean;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const r2 = (v: number) => Math.round(v * 100) / 100;
const pathOf = (pts: Pt[], close = true) => pts.map((p, i) => `${i ? "L" : "M"}${r2(p.x)} ${r2(p.y)}`).join(" ") + (close ? " Z" : "");

/** Ease a distance in under `max`, untouched until `KNEE` feet short of it. */
function ease(feet: number, max: number): number {
  const k = max - KNEE;
  return feet <= k ? feet : k + KNEE * Math.tanh((feet - k) / KNEE);
}

/** Which part of the field an angle is, in words: for tooltips and the tallest-wall line. */
export function sectionOf(deg: number): string {
  const a = Math.abs(deg);
  const side = deg < 0 ? "left" : "right";
  if (a < 7.5) return "centre";
  if (a < 33) return `${side}-centre`;
  return `${side} field`;
}

/**
 * The park drawn into the backdrop's viewBox for a box of this shape (width ÷
 * height). Pure: the same dims and aspect always give the same picture.
 */
export function fieldShape(d: ParkDims, aspect = DESIGN_ASPECT, step = 0.5): FieldShape {
  const ky = KY;
  const dist = monotone(profilePoints(d));
  const walls = wallProfile(d);

  const raw: { deg: number; feet: number; plotted: number; height: number; band: number }[] = [];
  for (let deg = -45; deg <= 45 + 1e-9; deg += step) {
    const feet = dist(deg);
    const height = linear(walls.pts, deg);
    const band = wallThickness(height);
    // The deepest a wall can be drawn at this angle with its band still inside the top of the box.
    const max = (HOME.y - TOP) / (ky * Math.cos(rad(deg))) - band;
    raw.push({ deg: r2(deg), feet, plotted: ease(feet, max), height, band });
  }
  // Equal feet across and up the box, unless the widest wall wouldn't fit across it.
  const widest = Math.max(...raw.map((s) => (s.plotted + s.band) * Math.abs(Math.sin(rad(s.deg)))));
  const kx = Math.min(ky / aspect, (HOME.x - SIDE) / widest);

  const polar = (deg: number, feet: number): Pt => ({ x: HOME.x + Math.sin(rad(deg)) * feet * kx, y: HOME.y - Math.cos(rad(deg)) * feet * ky });
  const xy = (X: number, Y: number): Pt => ({ x: HOME.x + X * kx, y: HOME.y - Y * ky });

  const samples: WallSample[] = raw.map((s) => ({
    deg: s.deg, feet: s.feet, plotted: s.plotted, height: s.height,
    inner: polar(s.deg, s.plotted), outer: polar(s.deg, s.plotted + s.band), trackIn: polar(s.deg, Math.max(0, s.plotted - TRACK_FT)),
  }));
  const home: Pt = { ...HOME };
  const wallPath = pathOf([...samples.map((s) => s.inner), ...samples.map((s) => s.outer).reverse()]);
  const fairPath = pathOf([home, ...samples.map((s) => s.inner)]);
  const grassPath = pathOf([home, ...samples.map((s) => s.trackIn)]);
  const poles = { lf: samples[0].inner, rf: samples[samples.length - 1].inner };

  // Foul ground: out from the lines to the stands, 60 ft behind the plate.
  const out = (deg: number, along: number, off: number): Pt => {
    const t = rad(deg), n = deg < 0 ? -1 : 1;
    return xy(Math.sin(t) * along + n * Math.cos(t) * off, Math.cos(t) * along - Math.sin(Math.abs(t)) * off);
  };
  const lfPole = samples[0].plotted, rfPole = samples[samples.length - 1].plotted;
  const foulPath = pathOf([
    out(-45, lfPole + 4, 14), out(-45, 140, 48), out(-45, 30, 58), xy(-30, -58), xy(0, -62), xy(30, -58),
    out(45, 30, 58), out(45, 140, 48), out(45, rfPole + 4, 14),
  ]);

  // The infield, true to scale: bases 90 ft apart, the dirt 95 ft round the mound.
  const b = 90 / Math.SQRT2;
  const bases = [xy(0, 0), xy(b, b), xy(0, 2 * b), xy(-b, b)];
  const centre = { X: 0, Y: b };
  const inset = (X: number, Y: number) => xy(centre.X + (X - centre.X) * 0.8, centre.Y + (Y - centre.Y) * 0.8);
  const infield = {
    dirt: { cx: HOME.x, cy: HOME.y - 60.5 * ky, rx: 95 * kx, ry: 95 * ky },
    grass: pathOf([inset(0, 0), inset(b, b), inset(0, 2 * b), inset(-b, b)]),
    mound: { cx: HOME.x, cy: HOME.y - 60.5 * ky, rx: 9 * kx, ry: 9 * ky },
    plate: { cx: HOME.x, cy: HOME.y, rx: 13 * kx, ry: 13 * ky },
    bases: bases.slice(1),
    paths: pathOf(bases),
  };

  // The wall's colour across the box, every few degrees and wherever the height turns.
  const gx0 = samples[0].outer.x, gx1 = samples[samples.length - 1].outer.x;
  const gradient: { offset: number; color: string }[] = [];
  for (const s of samples) {
    if (Math.round(s.deg * 2) % 6 !== 0 && !walls.pts.some(([deg]) => Math.abs(deg - s.deg) < step / 2)) continue;
    const offset = Math.max(0, Math.min(1, (s.outer.x - gx0) / (gx1 - gx0 || 1)));
    if (gradient.length && offset < gradient[gradient.length - 1].offset) continue;
    gradient.push({ offset: r2(offset * 100) / 100, color: wallColor(s.height) });
  }

  // Distance labels hang on the wall's top: the poles, the alleys, centre, and the deepest corner when it's beyond them.
  const at = d.at ?? {};
  const spot = (deg: number) => samples.reduce((best, x) => (Math.abs(x.deg - deg) < Math.abs(best.deg - deg) ? x : best), samples[0]).outer;
  const heightAt = (deg: number) => (walls.known ? Math.round(linear(walls.pts, deg) * 10) / 10 : null);
  const five: [LabelKey, number, Feet][] = [["lf", -45, d.lf], ["lcf", -(at.lcf ?? 22.5), d.lcf], ["cf", 0, d.cf], ["rcf", at.rcf ?? 22.5, d.rcf], ["rf", 45, d.rf]];
  const labels: DistanceLabel[] = five
    .filter((f): f is [LabelKey, number, number] => f[2] != null)
    .map(([key, deg, feet]) => ({ key, deg, feet, wall: heightAt(deg), at: spot(deg) }));
  const deepest = profilePoints(d).reduce((best, p) => (p[1] > best[1] ? p : best), [0, 0] as [number, number]);
  if (deepest[1] >= Math.max(...labels.map((l) => l.feet)) + 5 && !labels.some((l) => l.deg === deepest[0])) {
    labels.push({ key: "deep", deg: deepest[0], feet: deepest[1], wall: heightAt(deepest[0]), at: spot(deepest[0]) });
  }

  const top = walls.known ? walls.pts.reduce((best, p) => (p[1] > best[1] ? p : best)) : null;
  return {
    kx, ky, samples, wallPath, fairPath, grassPath, foulPath, poles, infield,
    gradient, gradientX: [r2(gx0), r2(gx1)], labels,
    tallest: top ? { feet: top[1], deg: top[0] } : null,
    wallKnown: walls.known,
  };
}
