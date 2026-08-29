/**
 * Regenerates src/data/eras.json and src/data/park-factors.json.
 *
 *   node scripts/build-env-data.mjs        (run from web/)
 *
 * Eras: the Card Lab's fitted rate profiles are the source of truth where they
 * exist (they are fitted to PT itself, not to MLB); every other year is derived
 * from reference/MLB Batting Year-by-Year Averages.xls. The ball-in-play
 * denominator MUST subtract sacrifice hits — 1 - K/PA - BB/PA - HBP/PA - SH/PA
 * — which is what reproduces the seven MLB-derived eras the Card Lab already
 * carried (to 0.005%); leaving SH in runs HR/2B/3B/BABIP ~2% hot.
 *
 * Parks: ballparks.csv keyed by name AND year. The `parks` DB table is keyed by
 * name alone, which throws the year away — and Coors Field 1996 (AVG 1.14, HR
 * 1.05) versus Coors Field 2000 (AVG 1.09, HR 1.27) are different ballparks.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd(), "..");
const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

/* ---------------- eras ---------------- */
const html = readFileSync(resolve(ROOT, "PT Strategy Presets by Environment.html"), "utf8");
const cardLab = JSON.parse(/^const D=(\[.*\]);$/m.exec(html)[1]);

const xls = readFileSync(resolve(ROOT, "reference/MLB Batting Year-by-Year Averages.xls"), "utf8");
const trs = xls.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
const cells = (tr) => [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => strip(m[1]));
const header = cells(trs[0]);
const col = Object.fromEntries(header.map((h, i) => [h, i]));

const eras = {};
for (const e of cardLab) {
  eras[e.year] = { rates: e.rates, rg: e.R_g, src: e.src, preset: e.preset };
}
let derived = 0;
for (const tr of trs.slice(1)) {
  const c = cells(tr);
  if (c.length < header.length || !/^\d{4}$/.test(c[0])) continue;
  const year = +c[0];
  if (eras[year]) continue;                          // Card Lab wins
  const n = (k) => (c[col[k]] === "" || c[col[k]] === "-" ? null : +c[col[k]]);
  const [PA, H, B2, B3, HR, BB, SO, HBP, RG] = ["PA","H","2B","3B","HR","BB","SO","HBP","R/G"].map(n);
  if ([PA, H, B2, B3, HR, BB, SO, HBP, RG].some((v) => v == null)) continue;
  const K = SO / PA, bb = BB / PA, hbp = HBP / PA;
  const bip = 1 - K - bb - hbp - (n("SH") ?? 0) / PA;
  const hr = HR / PA / bip;
  eras[year] = {
    rates: {
      K, BB: bb, HBP: hbp, HR: hr,
      B2: B2 / PA / bip, B3: B3 / PA / bip,
      BABIP: (H - HR) / PA / (bip * (1 - hr)),
    },
    rg: RG, src: "MLB-derived", preset: null,
  };
  derived++;
}
writeFileSync("src/data/eras.json", JSON.stringify(eras));

/* ---------------- parks ---------------- */
const csv = readFileSync(resolve(ROOT, "reference/ballparks.csv"), "utf8").replace(/^﻿/, "");
const lines = csv.trim().split(/\r?\n/);
const ph = lines[0].split(",");
const P = (row, k) => row[ph.indexOf(k)];
const parks = {};
for (const line of lines.slice(1)) {
  const r = line.split(",");
  const name = P(r, "Ballpark").trim();
  (parks[name] ??= {})[P(r, "Year").trim()] = {
    team: P(r, "Team") === "None" ? null : P(r, "Team"),
    avgL: +P(r, "Avg LHB"), avgR: +P(r, "Avg RHB"),
    hrL: +P(r, "HR LHB"), hrR: +P(r, "HR RHB"),
    d2: +P(r, "2B"), d3: +P(r, "3B"),
  };
}
writeFileSync("src/data/park-factors.json", JSON.stringify(parks));

console.log(`eras: ${Object.keys(eras).length} (${cardLab.length} Card Lab + ${derived} MLB-derived)`);
console.log(`parks: ${Object.keys(parks).length} names, ${lines.length - 1} name+year rows`);
