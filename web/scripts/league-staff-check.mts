/**
 * KC's league staff on the league arm model (lib/league-staff scoreArms + staffSolve), with each arm's raw
 * league edge vs LHB and vs RHB. Env EXTRA="Name,..." adds candidates (marked *); MINE="Name,..." replaces
 * the staff; FAMILY=PEL|HD (default PEL) is the tier whose arm lines and slot innings are used.
 *
 *   node --import tsx scripts/league-staff-check.mts
 */
import { loadHitterUniverse } from "@/lib/league-hitters";
import { resolveArms, scoreArms, toStaffArm, leagueArmLines, leagueIpPerSlot, leagueArmEdges, edgeFor, sideEdge } from "@/lib/league-staff";
import { staffSolve } from "@/lib/league-arms";
const MINE = (process.env.MINE ?? "Madison Bumgarner,Ben Sheets,Chris Sale,Mordecai Brown,Eddie Plank,Andrew Miller,Willie Hernandez,Zack Britton,Wade Davis,Louis Varland,Josh Hader,B.J. Ryan").split(",");
const FAMILY = (process.env.FAMILY ?? "PEL") as "PEL" | "HD";
const EXTRA = (process.env.EXTRA ?? "Craig Kimbrel,Robb Nen,Yoshinobu Yamamoto,Christy Mathewson,Koji Uehara,Kirby Yates,Orel Hershiser,Justin Verlander,Sandy Koufax").split(",").filter(Boolean);
const f2 = (n: number | null | undefined) => (n == null ? "  —  " : `${n >= 0 ? "+" : ""}${n.toFixed(2)}`);
const u = await loadHitterUniverse();
const { arms, warnings } = resolveArms([...MINE, ...EXTRA], u);
for (const w of warnings) console.log("  !!", w);
const lines = await leagueArmLines(FAMILY), ip = await leagueIpPerSlot(FAMILY);
const [eL, eR] = [await leagueArmEdges("vL"), await leagueArmEdges("vR")];
const sc = scoreArms(arms, lines);
console.log(`${FAMILY} slot innings: SP ${ip.sp.toFixed(0)}, RP ${ip.rp.toFixed(0)} (${ip.week})`);
console.log("arm                          SP/9    RP/9   PEL IP(sp/rp)  stam  | raw league vs LHB (IP)   vs RHB (IP)");
for (const a of arms) {
  const s = sc.get(a.entry)!;
  const l = sideEdge(edgeFor(a, eL)), r = sideEdge(edgeFor(a, eR));
  console.log(`  ${(a.label + (MINE.includes(a.entry) ? "" : " *")).padEnd(26)} ${f2(s.sp)}  ${f2(s.rp)}  ${String(Math.round(s.spIpFamily)).padStart(6)}/${String(Math.round(s.rpIpFamily)).padEnd(6)} ${String(s.stamina ?? "—").padStart(4)}  | ${f2(l?.edge9)} (${Math.round(l?.ip ?? 0)})   ${f2(r?.edge9)} (${Math.round(r?.ip ?? 0)})`);
}
const mineArms = arms.filter((a) => MINE.includes(a.entry)).map((a) => toStaffArm(a, sc.get(a.entry)!));
const st = staffSolve(mineArms, ip);
console.log(`\nbest staff from his 12: ${st.total.toFixed(1)} runs a season`);
console.log("  " + st.rotation.map((x) => `${x.slot} ${x.label} ${f2(x.edge9)}`).join(" · "));
console.log("  " + st.bullpen.map((x) => `${x.slot} ${x.label} ${f2(x.edge9)}`).join(" · "));
const all = arms.map((a) => toStaffArm(a, sc.get(a.entry)!));
const st2 = staffSolve(all, ip, {}, 12);
console.log(`\nbest 12 from his 12 + extras: ${st2.total.toFixed(1)}`);
console.log("  " + st2.rotation.map((x) => `${x.slot} ${x.label} ${f2(x.edge9)}`).join(" · "));
console.log("  " + st2.bullpen.map((x) => `${x.slot} ${x.label} ${f2(x.edge9)}`).join(" · "));
const st3 = staffSolve(mineArms, ip, {}, 11);
console.log(`\nhis best 11 (one arm off for a 15th bat): ${st3.total.toFixed(1)} (cost ${(st3.total - st.total).toFixed(1)}); out: ${st3.out.map((x) => x.label).join(", ")}`);
process.exit(0);
