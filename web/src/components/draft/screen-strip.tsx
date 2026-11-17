"use client";

/**
 * The game's rounds for a draft whose event screen lists them (formats.ts
 * DraftFormat.screens), one chip each: done, the one the next pick comes
 * from, and the ones to come. Each chip reads like the screen's own line
 * ("Round 5: Pick 1 of 12 cards (Bronze 60-69)") on hover.
 */
import { screenAt, type DraftFormat } from "@/lib/draft/formats";
import { TIER_COLORS } from "@/lib/tiers";
import { cn } from "@/lib/utils";

export function ScreenStrip({ f, picksMade, packSize }: { f: DraftFormat; picksMade: number; packSize: number }) {
  if (!f.screens?.length) return null;
  const at = screenAt(f, picksMade);
  // Picks made by the end of each round.
  const ends = f.screens.reduce<number[]>((out, s) => [...out, (out.at(-1) ?? 0) + s.keep], []);
  return (
    <div className="flex flex-wrap items-center gap-1" aria-label="The game's rounds">
      {f.screens.map((s, k) => {
        const r = f.rounds.find((x) => x.key === s.round);
        const done = picksMade >= ends[k];
        const on = at?.no === k + 1;
        return (
          <span key={k}
            title={`Round ${k + 1}: pick ${s.keep} of ${packSize} cards (${r?.label ?? s.round})${on ? `, pick ${at!.taken + 1} of ${s.keep} next` : done ? ", done" : ""}`}
            className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px]",
              on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground", done && "opacity-40")}>
            <span className="inline-block size-1.5 rounded-full" style={{ backgroundColor: r ? TIER_COLORS[r.tier] : undefined }} />
            {k + 1}
            {s.keep > 1 && <span className="text-[9px]">×{s.keep}</span>}
          </span>
        );
      })}
    </div>
  );
}
