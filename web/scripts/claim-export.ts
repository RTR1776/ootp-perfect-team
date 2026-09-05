/**
 * Identify a freshly-exported OOTP tourney stats CSV and file it.
 *   tsx scripts/claim-export.ts <snapshot.csv> [--yes]
 *
 * OOTP writes every export to the same filename and puts nothing inside it that
 * says which tournament it came from. So: fingerprint the contents (field size
 * from the row count, card pool from VAL/CYear/Tier) and match that against the
 * OUTSTANDING WORKLIST in "Grab Tourney Stats.command" — the list of things
 * L.J. is actually working through. That is a far stronger signal than the
 * catalog, whose restriction columns are null for most rows and which does not
 * contain newly-added tournaments at all.
 *
 * One outstanding entry of the right field size  → file it.
 * Several                                        → print them and ask (1/2/3).
 * None                                           → leave it, say why.
 *
 * NEVER overwrites: per L.J.'s 8/31 ruling a wrong run number costs only date
 * arithmetic, an overwrite costs a whole tournament's observations.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, renameSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

const ROOT = join(process.cwd(), "..");
const DEST = join(ROOT, "Archive/Completed");
const SCRIPT = join(ROOT, "Grab Tourney Stats.command");
const AUTO = process.argv.includes("--yes");

const src = process.argv[2];
if (!src || !existsSync(src)) { console.error("usage: claim-export.ts <csv>"); process.exit(2); }

/* ---------- fingerprint the export ---------- */
const lines = readFileSync(src, "utf8").split(/\r?\n/).filter((l) => l.trim().length);
const head = lines[0].split(",");
const iVAL = head.indexOf("VAL"), iYear = head.indexOf("CYear"),
      iOrg = head.indexOf("ORG"), iTier = head.indexOf("Tier");
if (iVAL < 0 || iYear < 0) { console.error("not a sortable-stats export"); process.exit(2); }
const rows = lines.slice(1).map((l) => l.split(","));
const nums = (i: number) => rows.map((r) => Number(r[i])).filter((v) => Number.isFinite(v) && v > 0);
const vals = nums(iVAL), years = nums(iYear);
const fp = {
  rows: rows.length, valMin: Math.min(...vals), valMax: Math.max(...vals),
  yearMin: Math.min(...years), yearMax: Math.max(...years),
  orgs: new Set(rows.map((r) => r[iOrg])).size,
  tiers: [...new Set(rows.map((r) => r[iTier]))].filter(Boolean).sort(),
};
const FIELD = [[32, 500, 900], [64, 1000, 1700], [128, 2000, 3400], [256, 4000, 6800]] as const;
const field = FIELD.find(([, lo, hi]) => fp.rows + 1 >= lo && fp.rows + 1 <= hi)?.[0] ?? null;

console.log(`  ${fp.rows} rows → ${field ?? "?"}-team field · VAL ${fp.valMin}-${fp.valMax} · ` +
            `CYear ${fp.yearMin}-${fp.yearMax} · ${fp.orgs} orgs · ${fp.tiers.join("/")}`);

/* ---------- the outstanding worklist ---------- */
const block = /WORKLIST=\$\(cat <<'LIST'\n([\s\S]*?)\nLIST/.exec(readFileSync(SCRIPT, "utf8"));
const work = (block ? block[1].split("\n") : [])
  .map((l) => l.trim().split(/\s+/))
  .filter((p) => p.length === 3 && !p[0].startsWith("#"))
  .map(([row, out, teams]) => ({ row: +row, out, teams: +teams }))
  .filter((w) => !existsSync(join(DEST, `${w.out}.csv`)));

let fits = work.filter((w) => !field || w.teams === field);

/* ---------- narrow by learning what each series looks like on disk ----------
 * Same tournament run twice = same tier mix and near-identical VAL/CYear
 * window. Any slug we already hold an export for can therefore be compared
 * directly against this one, which is far sharper than the catalog. */
function fingerprint(path: string) {
  try {
    const L = readFileSync(path, "utf8").split(/\r?\n/).filter((l) => l.trim().length);
    const h = L[0].split(","), v = h.indexOf("VAL"), y = h.indexOf("CYear"), t = h.indexOf("Tier");
    if (v < 0) return null;
    const R = L.slice(1).map((l) => l.split(","));
    const nn = (i: number) => R.map((r) => Number(r[i])).filter((x) => Number.isFinite(x) && x > 0);
    const vv = nn(v), yy = nn(y);
    return { valMin: Math.min(...vv), valMax: Math.max(...vv), yearMin: Math.min(...yy),
             yearMax: Math.max(...yy), tiers: [...new Set(R.map((r) => r[t]))].filter(Boolean).sort() };
  } catch { return null; }
}
const onDisk = existsSync(DEST) ? readdirSync(DEST) : [];
const scored = fits.map((w) => {
  const slug = w.out.replace(/_\d+$/, "");
  const prior = onDisk.find((f) => f.startsWith(slug + "_") && f.endsWith(".csv") && f !== `${w.out}.csv`);
  if (!prior) return { w, score: 0, why: "no prior export to compare" };
  const g = fingerprint(join(DEST, prior));
  if (!g) return { w, score: 0, why: "prior unreadable" };
  let score = 0;
  if (g.tiers.join("/") === fp.tiers.join("/")) score += 50;
  else if (g.tiers.some((t) => fp.tiers.includes(t))) score += 10;
  if (Math.abs(g.valMax - fp.valMax) <= 2) score += 25;
  if (Math.abs(g.valMin - fp.valMin) <= 2) score += 25;
  if (Math.abs(g.yearMin - fp.yearMin) <= 3) score += 15;
  if (Math.abs(g.yearMax - fp.yearMax) <= 3) score += 15;
  return { w, score, why: `vs ${prior}: VAL ${g.valMin}-${g.valMax} · ${g.tiers.join("/")}` };
}).sort((a, b) => b.score - a.score);

if (scored.length && scored[0].score >= 90 && (scored.length === 1 || scored[0].score >= scored[1].score + 40)) {
  console.log(`  fingerprint match (${scored[0].score}) — ${scored[0].why}`);
  fits = [scored[0].w];
} else if (scored.some((x) => x.score > 0)) {
  fits = scored.filter((x) => x.score > 0).map((x) => x.w).concat(scored.filter((x) => x.score === 0).map((x) => x.w));
}

function file(out: string) {
  const slug = out.replace(/_\d+$/, ""), n0 = Number(/_(\d+)$/.exec(out)?.[1] ?? 0);
  let run = n0, name = `${slug}_${run}.csv`;
  while (existsSync(join(DEST, name))) { run++; name = `${slug}_${run}.csv`; }   // never overwrite
  mkdirSync(DEST, { recursive: true });
  renameSync(src, join(DEST, name));
  console.log(`  ✓ filed ${name}${run !== n0 ? `  (bumped from _${n0}; that file already existed)` : ""}`);
}

if (fits.length === 1) { file(fits[0].out); process.exit(0); }

if (fits.length === 0) {
  writeFileSync(src.replace(/\.csv$/, ".txt"),
    `No outstanding worklist entry with a ${field}-team field.\n` +
    `${fp.rows} rows · VAL ${fp.valMin}-${fp.valMax} · CYear ${fp.yearMin}-${fp.yearMax} · ${fp.tiers.join("/")}\n`);
  console.log(`  ? nothing outstanding matches a ${field}-team field — left it in the inbox`);
  process.exit(3);
}

console.log(`  ? ${fits.length} outstanding ${field}-team entries — which was it?`);
fits.forEach((w, i) => console.log(`      ${i + 1}) ${w.out}`));
if (AUTO) { console.log("  (--yes given, not prompting) left in the inbox"); process.exit(3); }
const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question("      > ", (a) => {
  const pick = fits[Number(a.trim()) - 1];
  rl.close();
  if (!pick) { console.log("  left in the inbox"); process.exit(3); }
  file(pick.out); process.exit(0);
});
