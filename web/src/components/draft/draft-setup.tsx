"use client";

/**
 * Setting up any draft for the live helper (lib/draft/custom): the rounds by
 * tier, and the run environment, park and DH the event screen shows. Built to
 * be filled in on a phone before the clock starts: presets for the mixes he
 * enters, six number boxes, and one button.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
  customQuery, DRAFT_PRESETS, MAX_CARDS, MIN_CARDS, mixCards, parseMix, TIERS_HIGH_TO_LOW, TIER_LETTER, YEAR_MAX, YEAR_MIN,
  type CustomDraft, type TierMix,
} from "@/lib/draft/custom";
import { TIER_COLORS, type Tier } from "@/lib/tiers";
import { cn } from "@/lib/utils";

const field = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const label = "flex flex-col gap-1 text-xs text-muted-foreground";

/** "1996 Dodger Stadium" to its two boxes; a bare name has no year. */
function splitPark(park: string | null | undefined): { name: string; year: string } {
  const m = /^(\d{4})\s+(.*)$/.exec(park ?? "");
  return m ? { name: m[2], year: m[1] } : { name: park ?? "", year: "" };
}

export function DraftSetup({ drafts, parks, initial, errors, open }: {
  /** Catalogue drafts, for the event's own card rules. */
  drafts: { id: number; name: string }[];
  parks: string[];
  initial: CustomDraft | null;
  errors: string[];
  /** Shown expanded (nothing set up yet, or something to fix). */
  open: boolean;
}) {
  const router = useRouter();
  const p0 = splitPark(initial?.park);
  const [mix, setMix] = React.useState<TierMix>(initial?.mix ?? {});
  const [year, setYear] = React.useState(initial ? String(initial.year) : "");
  const [dh, setDh] = React.useState(initial?.dh ?? true);
  const [parkName, setParkName] = React.useState(p0.name);
  const [parkYear, setParkYear] = React.useState(p0.year);
  const [pack, setPack] = React.useState<"mixed" | "choose">(initial?.pack ?? "mixed");
  const [packSize, setPackSize] = React.useState(String(initial?.packSize ?? 6));
  const [teams, setTeams] = React.useState(String(initial?.teams ?? 64));
  const [eventId, setEventId] = React.useState(initial?.eventId ? String(initial.eventId) : "");
  const [name, setName] = React.useState(initial?.name ?? "");
  const [show, setShow] = React.useState(open);

  const cards = mixCards(mix);
  const y = Number(year);
  const problems: string[] = [];
  if (cards < MIN_CARDS || cards > MAX_CARDS) problems.push(`rounds add up to ${cards}; a draft is ${MIN_CARDS} to ${MAX_CARDS} cards`);
  if (!Number.isInteger(y) || y < YEAR_MIN || y > YEAR_MAX) problems.push(`run environment year, ${YEAR_MIN} to ${YEAR_MAX}`);

  const start = () => {
    if (problems.length) return;
    const park = parkName.trim() ? `${/^\d{4}$/.test(parkYear) ? `${parkYear} ` : ""}${parkName.trim()}` : null;
    const picked = drafts.find((d) => String(d.id) === eventId);
    const draft: CustomDraft = {
      mix, year: y, dh, park, pack, packSize: Math.max(2, Math.min(15, Number(packSize) || 6)),
      name: name.trim() || picked?.name || "", eventId: picked ? picked.id : null, teams: Number(teams) || 64,
    };
    router.push(`/draft/live?${customQuery(draft)}`);
    setShow(false);
  };

  if (!show) {
    return (
      <button onClick={() => setShow(true)} className="self-start rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
        Change this draft&apos;s setup
      </button>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div>
          <h2 className="text-sm font-semibold">Set up any draft</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Enter what the event screen shows. Most daily and weekly drafts run in a random environment and park, so nothing on file can know them.
          </p>
        </div>
        {errors.length > 0 && <ul className="text-xs text-negative">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}

        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Rounds by tier</span>
          <div className="flex flex-wrap gap-2">
            {DRAFT_PRESETS.map((p) => (
              <button key={p.name} title={p.note} onClick={() => { setMix(parseMix(p.mix) ?? {}); if (!name.trim()) setName(p.name); }}
                className="rounded-md border border-border px-3 py-2 text-sm hover:border-primary hover:text-foreground">
                {p.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {TIERS_HIGH_TO_LOW.map((t: Tier) => (
              <label key={t} className={label}>
                <span style={{ color: TIER_COLORS[t] }}>{t}</span>
                <input type="number" inputMode="numeric" min={0} max={MAX_CARDS} value={mix[t] ?? ""} placeholder="0" aria-label={`${t} rounds (${TIER_LETTER[t]})`}
                  onChange={(e) => { const v = Math.max(0, Math.min(MAX_CARDS, Math.round(Number(e.target.value) || 0))); setMix((m) => ({ ...m, [t]: v })); }}
                  className={cn(field, "w-16")} />
              </label>
            ))}
            <span className={cn("pb-2 text-sm tabular-nums", cards >= MIN_CARDS && cards <= MAX_CARDS ? "text-muted-foreground" : "text-negative")}>{cards} cards</span>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className={label}>
            Run environment (year)
            <input type="number" inputMode="numeric" min={YEAR_MIN} max={YEAR_MAX} value={year} placeholder="1996" onChange={(e) => setYear(e.target.value)} className={cn(field, "w-28")} />
          </label>
          <label className={label}>
            Park
            <input list="draft-setup-parks" value={parkName} placeholder="neutral if blank" onChange={(e) => setParkName(e.target.value)} className={cn(field, "w-56")} />
            <datalist id="draft-setup-parks">{parks.map((p) => <option key={p} value={p} />)}</datalist>
          </label>
          <label className={label}>
            Park year
            <input type="number" inputMode="numeric" min={YEAR_MIN} max={YEAR_MAX} value={parkYear} placeholder="newest" onChange={(e) => setParkYear(e.target.value)} className={cn(field, "w-24")} />
          </label>
          <label className="flex h-9 items-center gap-2 text-sm">
            <input type="checkbox" checked={dh} onChange={(e) => setDh(e.target.checked)} className="size-4" />
            DH
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className={label}>
            Packs
            <select value={pack} onChange={(e) => setPack(e.target.value === "choose" ? "choose" : "mixed")} className={cn(field, "w-44")}>
              <option value="mixed">mixed positions</option>
              <option value="choose">you pick a position</option>
            </select>
          </label>
          <label className={label}>
            Cards a pack
            <input type="number" inputMode="numeric" min={2} max={15} value={packSize} onChange={(e) => setPackSize(e.target.value)} className={cn(field, "w-20")} />
          </label>
          <label className={label}>
            Teams
            <select value={teams} onChange={(e) => setTeams(e.target.value)} className={cn(field, "w-24")}>
              {[32, 64, 128, 256].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className={label}>
            Event (for its card rules; optional)
            <select value={eventId} onChange={(e) => { setEventId(e.target.value); const d = drafts.find((x) => String(x.id) === e.target.value); if (d) setName(d.name); }} className={cn(field, "w-64 max-w-full")}>
              <option value="">none</option>
              {drafts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className={label}>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="shown on the page" maxLength={80} className={cn(field, "w-56")} />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={start} disabled={problems.length > 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40">
            Start this draft
          </button>
          {problems.length > 0 && <span className="text-xs text-muted-foreground">Still needed: {problems.join("; ")}.</span>}
        </div>
      </CardContent>
    </Card>
  );
}
