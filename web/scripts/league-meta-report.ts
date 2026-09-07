/**
 * League meta one-pager -> ../Docs/League Meta <week>.html
 *
 *   pnpm league:meta            newest week in the DB
 *   pnpm league:meta 2026-09-06 a specific capturedOn (the Sunday)
 *
 * League exports only. Pools every league captured that week (all three
 * splits), one line per card across rosters, ranks by the regressed rate
 * (lib/analytics/league-board) and puts Kansas City Torrent's own lines
 * beside the best at each spot. Needs DATABASE_URL (reads .env.local).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const ENV = resolve(__dirname, "..", ".env.local");
if (!process.env.DATABASE_URL && existsSync(ENV)) for (const l of readFileSync(ENV, "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) { const k = l.slice(0, i).trim(); if (!process.env[k]) process.env[k] = l.slice(i + 1).trim().replace(/^["']|["']$/g, ""); } }

import { neon } from "@neondatabase/serverless";
import { MIN_PITCHER_SHARE } from "../src/lib/league-snapshots";
import { HIT_POS, f1, f2, f3, hitterLines, metaSummary, pct1, pitcherLines, withRegression, type HitterLine, type MyHitter, type PitcherLine, type MetaSummary, type BoardStint } from "../src/lib/analytics/league-board";
import { MY_ORG } from "../src/lib/my-team";

const sql = neon(process.env.DATABASE_URL!);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

async function load(week: string, split: string) {
  const snaps = (await sql.query(`select s.id, s.league, s.teams, count(*) filter (where t.is_pitcher) pitchers, count(*) total from league_snapshots s join league_stints t on t.snapshot_id = s.id where s.captured_on = $1 and s.split = $2 group by s.id`, [week, split])) as { id: number; league: string; teams: number; pitchers: string; total: string }[];
  const ok = snaps.filter((s) => Number(s.pitchers) / Number(s.total) >= MIN_PITCHER_SHARE);
  const rows = (await sql.query(`select snapshot_id "snapshotId", cid, name, pos, org, clan, is_free_agent "isFreeAgent", is_pitcher "isPitcher", val, tier, is_variant "isVariant", card_year "cardYear", pa, ip, use, war, ratings, stats from league_stints where snapshot_id = any($1)`, [ok.map((s) => s.id)])) as unknown as (BoardStint & { snapshotId: number })[];
  const lg = new Map(ok.map((s) => [s.id, s.league]));
  const stints = rows.map((r) => ({ ...r, league: lg.get(r.snapshotId)!, split, capturedOn: week }));
  const { hit, pit, meanWoba, meanFip } = withRegression(hitterLines(stints), pitcherLines(stints));
  const mine = stints.filter((s) => s.org === MY_ORG);
  const mineHit = hitterLines(mine).map((h) => ({ ...h, wobaReg: (h.woba * h.pa + meanWoba * 600) / (h.pa + 600) }));
  const minePit = pitcherLines(mine).map((p) => ({ ...p, fipReg: (p.fip * p.ip + meanFip * 150) / (p.ip + 150) }));
  return { leagues: ok.map((s) => s.league).sort(), teams: ok.reduce((a, s) => a + s.teams, 0), meta: metaSummary(hit, pit, mineHit, minePit, split, 1), hit, pit, mineHit, minePit, meanWoba, meanFip, myLeague: [...new Set(mine.map((s) => s.league))] };
}

const kc = (o: string[]) => (o.includes(MY_ORG) ? ' <span class="kc">KC</span>' : "");
const nm = (l: { name: string; val: number | null; cardYear: number | null; isVariant: boolean; orgs: string[] }) => `${esc(l.name)} <small>${l.val ?? ""}${l.cardYear ? ` ${l.cardYear}` : ""}${l.isVariant ? " VAR" : ""}</small>${kc(l.orgs)}`;
const hitRow = (h: HitterLine, extra = "") => `<tr${h.orgs.includes(MY_ORG) ? ' class="mine"' : ""}><td class="pos">${h.pos}</td><td>${nm(h)}</td><td>${f3(h.woba)}</td><td class="dim">${f3(h.wobaReg)}</td><td>${f3(h.obp)}</td><td>${f3(h.slg)}</td><td>${f1(h.hr600)}</td><td>${pct1(h.kPct)}</td><td>${pct1(h.bbPct)}</td><td>${f1(h.war600)}</td><td class="dim">${h.pa.toLocaleString()}</td><td class="dim">${h.teams}</td>${extra}</tr>`;
const hitRowC = (h: HitterLine) => `<tr${h.orgs.includes(MY_ORG) ? ' class="mine"' : ""}><td class="pos">${h.pos}</td><td>${nm(h)}</td><td>${f3(h.woba)}</td><td class="dim">${f3(h.wobaReg)}</td><td>${f3(h.obp)}</td><td>${f3(h.slg)}</td><td>${f1(h.hr600)}</td><td>${pct1(h.kPct)}</td><td class="dim">${h.pa.toLocaleString()}</td><td class="dim">${h.teams}</td></tr>`;
const HIT_HEAD_C = `<tr><th>Pos</th><th>Card</th><th>wOBA</th><th class="dim" title="regressed over 600 PA">wOBA*</th><th>OBP</th><th>SLG</th><th>HR/600</th><th>K%</th><th class="dim">PA</th><th class="dim">Tm</th></tr>`;
const pitRowC = (p: PitcherLine) => `<tr${p.orgs.includes(MY_ORG) ? ' class="mine"' : ""}><td class="pos">${p.pos}</td><td>${nm(p)}</td><td>${f2(p.fip)}</td><td class="dim">${f2(p.fipReg)}</td><td>${f2(p.era)}</td><td>${pct1(p.kPct)}</td><td>${pct1(p.bbPct)}</td><td>${f2(p.hr9)}</td><td class="dim">${p.ip.toFixed(0)}</td><td class="dim">${p.teams}</td></tr>`;
const PIT_HEAD_C = `<tr><th>Pos</th><th>Card</th><th>FIP</th><th class="dim" title="regressed over 150 IP">FIP*</th><th>ERA</th><th>K%</th><th>BB%</th><th>HR/9</th><th class="dim">IP</th><th class="dim">Tm</th></tr>`;
const HIT_HEAD = `<tr><th>Pos</th><th>Card</th><th>wOBA</th><th class="dim" title="regressed over 600 PA">wOBA*</th><th>OBP</th><th>SLG</th><th>HR/600</th><th>K%</th><th>BB%</th><th>WAR/600</th><th class="dim">PA</th><th class="dim">Tm</th>`;
const pitRow = (p: PitcherLine) => `<tr${p.orgs.includes(MY_ORG) ? ' class="mine"' : ""}><td class="pos">${p.pos}</td><td>${nm(p)}</td><td>${f2(p.fip)}</td><td class="dim">${f2(p.fipReg)}</td><td>${f2(p.era)}</td><td>${pct1(p.kPct)}</td><td>${pct1(p.bbPct)}</td><td>${f2(p.hr9)}</td><td>${f1(p.war200)}</td><td class="dim">${p.ip.toFixed(0)}</td><td class="dim">${p.teams}</td></tr>`;
const PIT_HEAD = `<tr><th>Pos</th><th>Card</th><th>FIP</th><th class="dim" title="regressed over 150 IP">FIP*</th><th>ERA</th><th>K%</th><th>BB%</th><th>HR/9</th><th>WAR/200</th><th class="dim">IP</th><th class="dim">Tm</th></tr>`;
const pctTone = (v: number) => (v >= 80 ? "good" : v >= 50 ? "" : v >= 25 ? "warn" : "bad");
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"}`;

async function main() {
  const weekArg = process.argv[2];
  const week = weekArg ?? ((await sql.query(`select max(captured_on)::text w from league_snapshots`)) as { w: string }[])[0].w;
  const A = await load(week, "all"), L = await load(week, "vL"), R = await load(week, "vR");
  const m: MetaSummary = A.meta;
  const [y, mo, d] = week.split("-").map(Number); const sun = new Date(Date.UTC(y, mo - 1, d)); const mon = new Date(sun); mon.setUTCDate(sun.getUTCDate() - 6);
  const weekLabel = `week of ${mon.getUTCMonth() + 1}/${mon.getUTCDate()} (seasons ending ${mo}/${d})`;

  const myByPos = new Map<string, MyHitter>();
  for (const h of [...m.mine.hitters].sort((a, b) => b.pa - a.pa)) if (!myByPos.has(h.pos)) myByPos.set(h.pos, h);
  const mostBats = [...A.hit].sort((a, b) => b.teams - a.teams).slice(0, 12);
  const mostArms = [...A.pit].sort((a, b) => b.teams - a.teams).slice(0, 12);

  const strong = m.mine.hitters.filter((h) => h.pa >= 200 && h.posPct >= 80).map((h) => `${h.name} (${h.pos}, ${f3(h.woba)}, ${ord(h.posPct)})`);
  const weak = m.mine.hitters.filter((h) => h.pa >= 200 && h.posPct < 40).map((h) => `${h.name} (${h.pos}, ${f3(h.woba)}, ${ord(h.posPct)})`);
  const spGood = m.mine.sp.filter((p) => p.posPct >= 70).map((p) => `${p.name} (${f2(p.fip)}, ${ord(p.posPct)})`);
  const spWeak = m.mine.sp.filter((p) => p.ip >= 60 && p.posPct < 40).map((p) => `${p.name} (${f2(p.fip)}, ${ord(p.posPct)})`);
  const rpWeak = m.mine.rp.filter((p) => p.ip >= 40 && p.posPct < 40).map((p) => `${p.name} (${f2(p.fip)}, ${ord(p.posPct)})`);

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>League Meta — ${esc(weekLabel)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--ink:#1a1a1a;--dim:#6b6b6b;--line:#e3e3e3;--kc:#1d4ed8;--kcbg:#e8efff;--good:#15803d;--warn:#b45309;--bad:#b91c1c;--bg:#fff}
@media (prefers-color-scheme:dark){:root{--ink:#e8e8e8;--dim:#9a9a9a;--line:#333;--kcbg:#1e2a4a;--kc:#8ab4ff;--good:#4ade80;--warn:#fbbf24;--bad:#f87171;--bg:#111}}
body{font:13px/1.4 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg);margin:0;padding:28px 36px;max-width:1180px}
h1{font-size:22px;margin:0 0 2px}h2{font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim);margin:26px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}
.sub{color:var(--dim);margin-bottom:6px}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--dim);text-align:right;padding:4px 6px;border-bottom:1px solid var(--line);white-space:nowrap}
th:nth-child(2),td:nth-child(2){text-align:left}td{padding:3px 6px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}td.pos{color:var(--dim);font-family:ui-monospace,Menlo,monospace;text-align:left}
td small{color:var(--dim);font-size:11px}.dim{color:var(--dim)}tr.mine td{background:var(--kcbg)}.kc{display:inline-block;background:var(--kc);color:#fff;font-size:9px;font-weight:700;padding:0 4px;border-radius:3px;vertical-align:middle;margin-left:2px}
.grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px}.grid>div{min-width:0;overflow-x:auto}.grid table{font-size:12px}.grid td,.grid th{padding:3px 4px}.good{color:var(--good);font-weight:600}.warn{color:var(--warn)}.bad{color:var(--bad);font-weight:600}
.verdict{background:var(--kcbg);border-left:3px solid var(--kc);padding:10px 14px;margin:8px 0 4px;font-size:13.5px}.verdict p{margin:4px 0}
.strip{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px}.strip span b{font-weight:600}
@media print{body{padding:10px}h2{break-after:avoid}table{break-inside:avoid}}
@media (max-width:900px){.grid{grid-template-columns:1fr}}
</style></head><body>
<h1>League meta — ${esc(weekLabel)}</h1>
<div class="sub">${A.leagues.join(" · ")} pooled (${A.teams} teams) · one line per card across every roster it sits on · ranked by the regressed rate (wOBA* / FIP*: shrunk toward the pool mean over 600 PA / 150 IP so one hot roster-season cannot outrank twenty ordinary ones) · qualifying: ≥${m.qual.pa} PA, SP ≥${m.qual.spIp} IP, RP ≥${m.qual.rpIp} IP · pool means wOBA ${f3(A.meanWoba)}, FIP ${f2(A.meanFip)} · <span class="kc">KC</span> = ${esc(MY_ORG)} (${A.myLeague.join(", ")})</div>

<h2>Kansas City Torrent vs the field</h2>
<div class="verdict">
<p><b>Bats above the field:</b> ${strong.length ? strong.join("; ") : "none at the 80th percentile"}.</p>
<p><b>Bats below it:</b> ${weak.length ? weak.join("; ") : "none under the 40th percentile with 200+ PA"}.</p>
<p><b>Rotation:</b> ${spGood.length ? `${spGood.join("; ")} ${spGood.length > 1 ? "are" : "is"} field-grade` : "no starter reaches the 70th percentile"}${spWeak.length ? `; ${spWeak.join("; ")} ${spWeak.length > 1 ? "are" : "is"} below the 40th` : ""}. <b>Bullpen:</b> ${rpWeak.length ? `${rpWeak.join("; ")} below the 40th` : "no reliever with 40+ IP is below the 40th percentile"}.</p>
<p class="dim" style="font-size:12px">Your lines come from ${A.myLeague.join("/")} competition while the pool is ${A.leagues.filter((l) => !A.myLeague.includes(l)).join("/")} as well, so a Torrent copy can out-hit its own pooled line (Beltran, Banks) partly because the pitching it faced was weaker. Read percentiles as "how the card performed", not a promise for the tier above; the League tab's league filter re-scores against any one league.</p>
</div>
<div class="grid">
<div><table><thead><tr><th>Pos</th><th>Your starter</th><th>wOBA</th><th>Pct</th><th>Best in the field</th><th>wOBA</th><th>Gap</th></tr></thead><tbody>
${HIT_POS.filter((p) => p !== "DH").map((p) => { const me = myByPos.get(p); const b = m.bestByPos[p]?.[0]; return `<tr><td class="pos">${p}</td><td>${me ? nm(me) : "<span class=dim>—</span>"}</td><td>${me ? f3(me.woba) : ""}</td><td class="${me ? pctTone(me.posPct) : ""}">${me ? ord(me.posPct) : ""}</td><td>${b ? nm(b) : ""}</td><td>${b ? f3(b.woba) : ""}</td><td class="${me && me.gapToBest < -0.03 ? "bad" : me && me.gapToBest < -0.015 ? "warn" : ""}">${me && b ? `${me.gapToBest >= 0 ? "+" : ""}${f3(me.gapToBest)}` : ""}</td></tr>`; }).join("\n")}
</tbody></table><div class="sub" style="margin-top:4px">Your starter = your highest-PA card at the spot; Pct = its wOBA percentile among qualified cards at that position across the pooled field; Gap = to the best card there.</div></div>
<div><table><thead><tr><th>Role</th><th>Your arm</th><th>FIP</th><th>ERA</th><th>K%</th><th>HR/9</th><th>Pct</th><th>IP</th></tr></thead><tbody>
${[...m.mine.sp, ...m.mine.rp].map((p) => `<tr><td class="pos">${p.pos}</td><td>${nm(p)}</td><td>${f2(p.fip)}</td><td>${f2(p.era)}</td><td>${pct1(p.kPct)}</td><td>${f2(p.hr9)}</td><td class="${pctTone(p.posPct)}">${ord(p.posPct)}</td><td class="dim">${p.ip.toFixed(0)}</td></tr>`).join("\n")}
</tbody></table><div class="sub" style="margin-top:4px">Pct = FIP percentile among qualified starters (SP) or relievers (RP/CL) in the pooled field. Best SP: ${m.sp[0] ? `${esc(m.sp[0].name)} ${f2(m.sp[0].fip)}` : "—"}; best RP: ${m.rp[0] ? `${esc(m.rp[0].name)} ${f2(m.rp[0].fip)}` : "—"}.</div></div>
</div>

<h2>Best bats by position — all splits</h2>
<table><thead>${HIT_HEAD}<th>2nd</th><th>3rd</th></tr></thead><tbody>
${HIT_POS.map((p) => { const b = m.bestByPos[p] ?? []; if (!b[0]) return `<tr><td class="pos">${p}</td><td class="dim" colspan="13">no qualified card</td></tr>`; return hitRow(b[0], `<td class="dim" style="text-align:left">${b[1] ? `${esc(b[1].name)} ${f3(b[1].woba)}` : ""}</td><td class="dim" style="text-align:left">${b[2] ? `${esc(b[2].name)} ${f3(b[2].woba)}` : ""}</td>`); }).join("\n")}
</tbody></table>

<div class="grid">
<div><h2>Best vs LHP (≥${L.meta.qual.pa} PA)</h2><table><thead>${HIT_HEAD_C}</thead><tbody>${L.meta.hitters.slice(0, 12).map(hitRowC).join("\n")}</tbody></table>
<div class="sub" style="margin-top:4px">Your best vs LHP: ${L.mineHit.filter((h) => h.pa >= 60).sort((a, b) => b.woba - a.woba).slice(0, 3).map((h) => `${esc(h.name)} ${f3(h.woba)} (${h.pa} PA)`).join(" · ") || "—"}</div></div>
<div><h2>Best vs RHP (≥${R.meta.qual.pa} PA)</h2><table><thead>${HIT_HEAD_C}</thead><tbody>${R.meta.hitters.slice(0, 12).map(hitRowC).join("\n")}</tbody></table>
<div class="sub" style="margin-top:4px">Your best vs RHP: ${R.mineHit.filter((h) => h.pa >= 120).sort((a, b) => b.woba - a.woba).slice(0, 3).map((h) => `${esc(h.name)} ${f3(h.woba)} (${h.pa} PA)`).join(" · ") || "—"}</div></div>
</div>

<div class="grid">
<div><h2>Best starters (≥${m.qual.spIp} IP)</h2><table><thead>${PIT_HEAD_C}</thead><tbody>${m.sp.slice(0, 12).map(pitRowC).join("\n")}</tbody></table></div>
<div><h2>Best relievers (≥${m.qual.rpIp} IP)</h2><table><thead>${PIT_HEAD_C}</thead><tbody>${m.rp.slice(0, 12).map(pitRowC).join("\n")}</tbody></table></div>
</div>

<div class="grid">
<div><h2>Best arms vs LHB (SP ≥${L.meta.qual.spIp} IP · RP ≥${L.meta.qual.rpIp})</h2><table><thead>${PIT_HEAD_C}</thead><tbody>${[...L.meta.sp.slice(0, 6), ...L.meta.rp.slice(0, 4)].map(pitRowC).join("\n")}</tbody></table></div>
<div><h2>Best arms vs RHB</h2><table><thead>${PIT_HEAD_C}</thead><tbody>${[...R.meta.sp.slice(0, 6), ...R.meta.rp.slice(0, 4)].map(pitRowC).join("\n")}</tbody></table></div>
</div>

<h2>What everyone is playing</h2>
<div class="strip">${mostBats.map((h) => `<span><b>${esc(h.name)}</b> ${h.pos} · ${h.teams}/${A.teams} · ${f3(h.woba)}${kc(h.orgs)}</span>`).join("")}</div>
<div class="strip" style="margin-top:6px">${mostArms.map((p) => `<span><b>${esc(p.name)}</b> ${p.pos} · ${p.teams}/${A.teams} · ${f2(p.fip)}${kc(p.orgs)}</span>`).join("")}</div>
<div class="sub" style="margin-top:14px">Generated ${new Date().toISOString().slice(0, 10)} by <code>pnpm league:meta ${week}</code> · the live, filterable version is the app's League tab.</div>
</body></html>`;
  const out = resolve(__dirname, "..", "..", "Docs", `League Meta ${week}.html`);
  writeFileSync(out, html);
  console.log(`wrote ${out}`);
  console.log(`field: ${A.leagues.join(",")} ${A.teams} teams | qualified ${m.hitters.length} bats, ${m.sp.length} SP, ${m.rp.length} RP | Torrent ${m.mine.hitters.length} bats, ${m.mine.sp.length} SP, ${m.mine.rp.length} RP`);
  console.log(`strong: ${strong.join("; ") || "-"}\nweak: ${weak.join("; ") || "-"}\nSP good: ${spGood.join("; ") || "-"} | SP weak: ${spWeak.join("; ") || "-"} | RP weak: ${rpWeak.join("; ") || "-"}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
