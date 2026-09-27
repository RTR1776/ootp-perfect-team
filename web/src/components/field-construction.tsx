/**
 * Where the field's tiers go, for /build's "How teams build here" panel: per
 * team, how many Perfect / Diamond / … cards were lineup bats (+ bench), starters
 * and relievers. Rows are every team, the best quarter by record, each clan
 * with enough entries, and L.J. (lib/field-construction.ts builds them).
 */
import type { SeriesBuild } from "@/lib/field-construction";
import type { TierCode } from "@/lib/roster-rules";

const TIERS: TierCode[] = ["P", "D", "G", "S", "B", "I"];
const NAME: Record<TierCode, string> = { P: "Perfect", D: "Diamond", G: "Gold", S: "Silver", B: "Bronze", I: "Iron" };
const f = (n: number) => (n === 0 ? "0" : n.toFixed(1).replace(/\.0$/, ""));
const pct = (p: number | null) => (p == null ? "" : ` · ${p.toFixed(3).replace(/^0/, "")}`);

export function FieldConstruction({ data, slots }: { data: SeriesBuild; slots: Record<string, number> | null }) {
  const used = (t: TierCode) => data.groups.some((g) => g.tiers[t]);
  const tiers = TIERS.filter((t) => (slots ? (slots[t] ?? 0) > 0 || used(t) : used(t)));
  return (
    <div className="mb-2">
      <div className="mb-0.5 font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">
        where the tiers go · cards per team: bats (+bench) · SP · RP
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr className="text-left text-[10.5px] text-muted-foreground">
              <th className="py-0.5 pr-3 font-normal">{data.teams} team-entries, {data.files} run{data.files === 1 ? "" : "s"}</th>
              {tiers.map((t) => (
                <th key={t} className="whitespace-nowrap py-0.5 pr-5 font-normal">
                  {NAME[t]}{slots?.[t] != null ? ` (${slots[t]})` : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.groups.map((g) => (
              <tr key={g.key} className={g.key === "mine" ? "text-primary" : ""}>
                <td className="whitespace-nowrap py-0.5 pr-3">
                  {g.label}
                  <span className="text-muted-foreground"> {g.n}{pct(g.winPct)}</span>
                </td>
                {tiers.map((t) => {
                  const c = g.tiers[t];
                  return (
                    <td key={t} className="whitespace-nowrap py-0.5 pr-5 font-mono">
                      {c ? <>{f(c.bats)}{c.bench > 0 && <span className="text-muted-foreground">+{f(c.bench)}</span>} · {f(c.sp)} · {f(c.rp)}</> : <span className="text-muted-foreground">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.spWeight != null && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          Here a starter faced {data.spWeight}× the batters a lineup slot gets PA, a reliever {data.rpWeight ?? "?"}×. Optimise weighs the staff by
          those instead of the defaults (1.0 / 0.31).
        </div>
      )}
    </div>
  );
}
