/**
 * Cards — one card, every read the app has on it.
 *
 * What cwhit's card page shows and this one now does: the projection in a
 * chosen event's environment (wOBA / FIP against each hand, calibrated runs),
 * the blend the roster tools actually rank on, and what the card has DONE in
 * every series it has played — each line against that series' own field, so
 * a .380 in a Bronze field and a .346 in Silver fields can be compared.
 *
 *   /cards?q=banks              name search, PT default engine, neutral park
 *   /cards?q=banks&event=569    read in that event's era, park and field
 */
import { desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, collectionCards, seriesMeta, tournaments, uploads } from "@/db/schema";
import { projectCard, projectionEnvs } from "@/lib/analytics/projections";
import { eraFor, eraTable, parkFor } from "@/lib/analytics/tournament-env";
import { envFitMaps } from "@/lib/analytics/env-fit";
import { blendRuns, loadObservedRuns, OBS_K_DEFAULT } from "@/lib/analytics/observed-blend";

export const dynamic = "force-dynamic";
const asRows = <T,>(r: unknown): T[] => (Array.isArray(r) ? (r as T[]) : ((r as { rows?: T[] }).rows ?? []));
const f3 = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "—" : n.toFixed(3).replace(/^0/, ""));
const f2 = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "—" : n.toFixed(2));
const f1 = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}`);

type Obs = { card_id: number; series: string; is_pitcher: boolean; instances: number; pa: number; ip: number; woba: number | null; fip: number | null; field_woba: number | null; field_fip: number | null };

export default async function CardsPage({ searchParams }: { searchParams: Promise<{ q?: string; event?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const eventId = sp.event ? Number(sp.event) : null;

  const events = await db.select({ id: tournaments.id, name: tournaments.name, envYear: tournaments.envYear, stadium: tournaments.stadium })
    .from(tournaments).where(eq(tournaments.retired, false)).orderBy(tournaments.name);
  const ev = eventId ? (await db.select().from(tournaments).where(eq(tournaments.id, eventId)))[0] ?? null : null;
  const park = ev ? parkFor(ev.stadium) : null;
  const era = ev?.envYear != null ? eraFor(ev.envYear)?.row ?? eraTable["0"] : eraTable["0"];
  const meta = ev?.series ? (await db.select().from(seriesMeta).where(eq(seriesMeta.series, ev.series)))[0] ?? null : null;
  const lhp = meta?.lhpBfShare ?? 0.3, lhb = meta?.lhbPaShare ?? 0.35;
  const envs = projectionEnvs(era.rates, park?.row ?? null, lhb);
  const envLabel = ev
    ? `${ev.name} · ${ev.envYear ?? "PT default"} RE${park?.row ? ` @ ${park.label}` : " (no park factors on file → neutral)"} · field ${Math.round(lhp * 100)}% LHP`
    : "PT default engine, neutral park, 30% LHP";

  const hits = q.length >= 2
    ? await db.select().from(cards).where(ilike(cards.name, `%${q}%`)).orderBy(desc(cards.cardValue)).limit(40)
    : [];
  const ids = hits.map((c) => c.cardId);

  const [latest] = await db.select({ id: uploads.id, at: uploads.uploadedAt }).from(uploads).where(eq(uploads.kind, "collection")).orderBy(desc(uploads.id)).limit(1);
  const owned = new Map<number, boolean>();
  if (latest && ids.length) {
    for (const o of await db.select({ cardId: collectionCards.cardId, isVariant: collectionCards.isVariant }).from(collectionCards)
      .where(sql`${collectionCards.uploadId} = ${latest.id} and ${inArray(collectionCards.cardId, ids)}`)) {
      if (o.cardId != null) owned.set(o.cardId, owned.get(o.cardId) || !!o.isVariant);
    }
  }

  const obs = ids.length ? asRows<Obs>(await db.execute(sql`
    with f as (
      select series, is_pitcher, sum(woba * pa) / nullif(sum(pa), 0) woba, sum(fip * ip) / nullif(sum(ip), 0) fip
      from observed_card_stats group by 1, 2)
    select o.card_id, o.series, o.is_pitcher, o.instances, o.pa, o.ip, o.woba, o.fip, f.woba field_woba, f.fip field_fip
    from observed_card_stats o join f on f.series = o.series and f.is_pitcher = o.is_pitcher
    where o.card_id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})
    order by o.card_id, (o.pa + o.ip * 4.3) desc`)) : [];
  const obsBy = new Map<number, Obs[]>();
  for (const o of obs) obsBy.set(Number(o.card_id), [...(obsBy.get(Number(o.card_id)) ?? []), o]);

  const input = hits.map((c) => ({ cardId: c.cardId, isPitcher: c.isPitcher ?? false, bats: c.bats, role: c.pitcherRole, ratings: (c.ratings ?? {}) as Record<string, number> }));
  const fits = ids.length ? envFitMaps(input, { era: era.rates, park: park?.row ?? null, roleTrust: 0.25, leagueLhbShare: lhb }) : null;
  const both = (id: number) => { const r = fits?.runsR.get(id), l = fits?.runsL.get(id); return r == null || l == null ? null : (1 - lhp) * r + lhp * l; };
  const observed = ids.length ? await loadObservedRuns(ids, both) : new Map();

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4">
      <header>
        <h1 className="text-xl font-semibold">Cards</h1>
        <p className="text-sm text-muted-foreground">Projection, the roster tools&rsquo; blend, and every series the card has played — read in one event&rsquo;s environment.</p>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Name</span>
          <input name="q" defaultValue={q} placeholder="banks" className="rounded border border-border bg-background px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Read in</span>
          <select name="event" defaultValue={eventId ?? ""} className="max-w-[28rem] rounded border border-border bg-background px-2 py-1">
            <option value="">PT default engine, neutral park</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.name}{e.envYear ? ` · ${e.envYear}` : ""}{e.stadium ? ` · ${e.stadium}` : ""}</option>)}
          </select>
        </label>
        <button type="submit" className="rounded border border-border px-3 py-1">Show</button>
        <span className="text-xs text-muted-foreground">{envLabel}</span>
      </form>

      {q.length >= 2 && hits.length === 0 && <p className="text-sm text-muted-foreground">No card named like &ldquo;{q}&rdquo; in the card table.</p>}

      {hits.map((c) => {
        const p = projectCard({ isPitcher: c.isPitcher ?? false, bats: c.bats, ratings: (c.ratings ?? {}) as Record<string, number> }, envs, lhp);
        const model = both(c.cardId), o = observed.get(c.cardId);
        const blend = model == null ? null : blendRuns(model, o, OBS_K_DEFAULT);
        const rows = obsBy.get(c.cardId) ?? [];
        const isP = c.isPitcher ?? false;
        const own = owned.has(c.cardId) ? (owned.get(c.cardId) ? "owned (variant)" : "owned") : "not owned";
        return (
          <section key={c.cardId} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 className="text-base font-semibold">{c.name} <span className="font-mono text-muted-foreground">{c.cardValue}</span></h2>
              <span className="text-sm text-muted-foreground">{c.position}{c.pitcherRole ? ` ${c.pitcherRole}` : ""} · {isP ? `T ${c.throws ?? "?"}` : `B ${c.bats ?? "?"}`} · {c.year ?? "—"} · {c.cardType ?? ""} · <span className={owned.has(c.cardId) ? "text-emerald-400" : ""}>{own}</span></span>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div className="text-sm">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Projection in this environment</div>
                <table className="mt-1 font-mono text-xs tabular-nums">
                  <tbody>
                    <tr><td className="pr-3 text-muted-foreground">{isP ? "FIP" : "wOBA"}</td><td className="pr-3">{p ? (isP ? f2(p.all) : f3(p.all)) : "—"}</td><td className="pr-3 text-muted-foreground">vL {p ? (isP ? f2(p.vL) : f3(p.vL)) : "—"}</td><td className="text-muted-foreground">vR {p ? (isP ? f2(p.vR) : f3(p.vR)) : "—"}</td></tr>
                    <tr><td className="pr-3 text-muted-foreground">runs / 700, model</td><td className="pr-3">{f1(model)}</td><td className="pr-3 text-muted-foreground">vL {f1(fits?.runsL.get(c.cardId))}</td><td className="text-muted-foreground">vR {f1(fits?.runsR.get(c.cardId))}</td></tr>
                    <tr><td className="pr-3 text-muted-foreground">runs, blended with play</td><td className="pr-3 font-semibold">{f1(blend)}</td><td colSpan={2} className="text-muted-foreground">{o ? `${o.n.toLocaleString()} ${isP ? "BF" : "PA"} across ${o.series} series, ${f1(o.runs)} above their fields` : "no tournament play on record"}</td></tr>
                  </tbody>
                </table>
                {p?.flags.length ? <p className="mt-1 text-xs text-amber-400">past the fitted range: {p.flags.map((f) => `${f.rating} ${f.value}`).join(", ")}</p> : null}
              </div>
              <div className="text-sm">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Actual, by series (this card&rsquo;s line vs that series&rsquo; field)</div>
                {rows.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">nothing on record</p> : (
                  <table className="mt-1 w-full font-mono text-xs tabular-nums">
                    <thead className="text-muted-foreground"><tr><th className="text-left font-normal">series</th><th className="text-right font-normal">events</th><th className="text-right font-normal">{isP ? "IP" : "PA"}</th><th className="text-right font-normal">{isP ? "FIP" : "wOBA"}</th><th className="text-right font-normal">field</th><th className="text-right font-normal">vs field</th></tr></thead>
                    <tbody>
                      {rows.map((r) => {
                        const v = isP ? r.fip : r.woba, fv = isP ? r.field_fip : r.field_woba;
                        const d = v != null && fv != null ? (isP ? fv - v : v - fv) : null;
                        return (
                          <tr key={r.series}>
                            <td>{r.series}</td><td className="text-right">{r.instances}</td><td className="text-right">{isP ? Math.round(r.ip) : r.pa}</td>
                            <td className="text-right">{isP ? f2(v) : f3(v)}</td><td className="text-right text-muted-foreground">{isP ? f2(fv) : f3(fv)}</td>
                            <td className={`text-right ${d != null && d > 0 ? "text-emerald-400" : d != null && d < 0 ? "text-red-400" : ""}`}>{d == null ? "—" : `${d >= 0 ? "+" : ""}${isP ? d.toFixed(2) : d.toFixed(3).replace(/^(-?)0/, "$1")}`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>
        );
      })}
      {latest && <p className="text-xs text-muted-foreground">Ownership from the collection of {String(latest.at).slice(0, 10)}. Observed lines pool every instance of a series; &ldquo;vs field&rdquo; is the card against that series&rsquo; own average, which is the read the blend uses.</p>}
    </main>
  );
}
