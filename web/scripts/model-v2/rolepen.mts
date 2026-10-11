/**
 * Two penalties people talk about (L.J. 10-11): a starter pitching in relief, and a bat at DH.
 * Paired within a card and one league season / one tournament export, so the environment cancels:
 *  arms: the same card used as a starter by some teams and in relief by others (FIP and ERA per 9);
 *  bats: the same card listed at DH by some teams and at a fielding position by others (wOBA-ish runs per 600: wRAA).
 */
import { readFileSync, readdirSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { parseLeagueExport } from "@/lib/ingest/league";
const sql = neon(process.env.DATABASE_URL!);
type Row = { unit: string; cid: number; org: string; pos: string; isPitcher: boolean; pa: number; ip: number; stats: any; role?: string };
const units: { kind: string; rows: Row[] }[] = [];
const snaps = (await sql.query(`select id, league, captured_on::date::text wk from league_snapshots where split='all' and not (league='HD452' and captured_on::date in ('2026-10-01','2026-10-08','2026-10-10'))`)) as any[];
const lrows = (await sql.query(`select snapshot_id sid, cid, org, pos, is_pitcher, pa, ip, stats from league_stints where snapshot_id = any($1) and not is_free_agent and cid is not null`, [snaps.map((s: any) => s.id)])) as any[];
const bySid = new Map<number, Row[]>();
for (const r of lrows) (bySid.get(r.sid) ?? bySid.set(r.sid, []).get(r.sid)!).push({ unit: `L${r.sid}`, cid: r.cid, org: r.org, pos: r.pos, isPitcher: r.is_pitcher, pa: r.pa ?? 0, ip: r.ip ?? 0, stats: r.stats });
for (const rows of bySid.values()) units.push({ kind: "league", rows });
const files: string[] = [];
for (const f of readdirSync("../Tourney Data/Cap Exports").filter((x) => x.endsWith(".csv"))) files.push(`../Tourney Data/Cap Exports/${f}`);
for (const b of ["bronze", "silver", "gold", "diamond", "open", "cap"]) files.push(`../Tourney Data/PTCS7 Championship/${b}_all.csv`);
for (const f of files) {
  const { stints } = parseLeagueExport(readFileSync(f, "utf8"), f.split("/").pop()!) as any;
  units.push({ kind: "tour", rows: stints.filter((s: any) => !s.isFreeAgent && s.cid != null).map((s: any) => ({ unit: f, cid: s.cid, org: s.org, pos: s.pos, isPitcher: s.isPitcher, pa: s.pa ?? s.stats.PA ?? 0, ip: s.ip ?? 0, stats: s.stats })) });
}
const cards = new Map(((await sql.query(`select card_id, pitcher_role from cards`)) as any[]).map((c) => [c.card_id, c.pitcher_role]));
for (const kind of ["league", "tour"]) {
  // ---- arms
  let wF = 0, dF = 0, dE = 0, pairs = 0, dK = 0, dBB = 0, dHR = 0;
  // ---- bats
  let wB = 0, dB = 0, bpairs = 0;
  for (const u of units.filter((x) => x.kind === kind)) {
    const byCard = new Map<number, Row[]>();
    for (const r of u.rows) (byCard.get(r.cid) ?? byCard.set(r.cid, []).get(r.cid)!).push(r);
    for (const [cid, rs] of byCard) {
      const arms = rs.filter((r) => r.isPitcher && r.ip > 0);
      if (arms.length >= 2 && cards.get(cid) === "SP") {
        const start = arms.filter((r) => { const g = r.stats.G_p ?? 0, gs = r.stats.GS_p ?? 0; return g > 0 && gs >= 0.5 * g; });
        const rel = arms.filter((r) => (r.stats.GS_p ?? 0) === 0 && (r.stats.G_p ?? 0) > 0);
        const agg = (a: Row[]) => { const ip = a.reduce((s, r) => s + r.ip, 0); const g = (k: string) => a.reduce((s, r) => s + (r.stats[k] ?? 0), 0); return { ip, f: (13 * g("HRa") + 3 * (g("BBa") + g("HPa")) - 2 * g("Ka")) / ip, e: 9 * g("ER") / ip, k: g("Ka") / g("BF"), bb: g("BBa") / g("BF"), hr: g("HRa") / g("BF") }; };
        if (start.length && rel.length) {
          const s = agg(start), r = agg(rel); if (s.ip < 20 || r.ip < 10) continue;
          const w = Math.min(s.ip, r.ip); wF += w; dF += w * (r.f - s.f); dE += w * (r.e - s.e); dK += w * (r.k - s.k); dBB += w * (r.bb - s.bb); dHR += w * (r.hr - s.hr); pairs++;
        }
      }
      const bats = rs.filter((r) => !r.isPitcher && r.pa > 0);
      if (bats.length >= 2) {
        const dh = bats.filter((r) => r.pos === "DH"), fld = bats.filter((r) => r.pos !== "DH" && r.pos !== "PH");
        const per = (a: Row[]) => { const pa = a.reduce((s, r) => s + r.pa, 0); return { pa, v: 600 * a.reduce((s, r) => s + (r.stats.wRAA ?? 0), 0) / pa }; };
        if (dh.length && fld.length) { const d = per(dh), f = per(fld); if (d.pa < 60 || f.pa < 60) continue; const w = Math.min(d.pa, f.pa); wB += w; dB += w * (d.v - f.v); bpairs++; }
      }
    }
  }
  console.log(`\n${kind.toUpperCase()}`);
  console.log(`  SP cards in relief vs the same card starting (${pairs} pairs, ${wF.toFixed(0)} paired IP): FIP ${(9 * dF / wF).toFixed(2)} per 9 (+ = worse in relief), ERA ${(dE / wF).toFixed(2)}, K% ${(100 * dK / wF).toFixed(1)}, BB% ${(100 * dBB / wF).toFixed(1)}, HR% ${(100 * dHR / wF).toFixed(2)}`);
  console.log(`  bats at DH vs the same card in the field (${bpairs} pairs, ${wB.toFixed(0)} paired PA): ${(dB / wB).toFixed(1)} runs per 600 PA (- = worse at DH)`);
}
