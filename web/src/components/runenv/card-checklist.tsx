"use client";

/**
 * The plain-language read of the selected era + ballpark: which card ratings
 * to chase and which to stop paying for. Every line comes off the same solved
 * environment the panels below show in numbers, so switching the era or the
 * park rewrites the list.
 *
 * Thresholds are set against the spread of every era on file (K% runs 3.8 to
 * 23.4, HR/PA 0.28 to 3.47, balls in play 64% to 91%), so "low" and "high"
 * mean low and high for this game, not for real MLB.
 */

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { handRead, leversOf, type EnvSpec, type Solved } from "@/lib/analytics/runenv-view";

type Tone = "chase" | "skip" | "info";
interface Item { tag: string; tone: Tone; head: string; body: string }

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

export function checklist(s: Solved, spec: EnvSpec): { headline: string; items: Item[] } | null {
  if (!s.line || !s.env) return null;
  const { kPct: k, hrPa: hr, bbPct: bb } = s.line;
  const bip = 1 - k - bb - hr;
  const items: Item[] = [];

  const deadball = hr < 0.01 && k < 0.11;
  const headline = deadball
    ? "Dead-ball game: almost no homers and few strikeouts. Contact, gap and speed win; power is nearly worthless."
    : hr > 0.028 && k > 0.18
      ? "Three-true-outcomes game: lots of homers and lots of strikeouts. Power first, then Avoid Ks."
      : k < 0.10
        ? "Contact game: strikeouts are rare, so nearly everything is put in play."
        : hr < 0.018
          ? "Low-power game: homers are scarce, so singles, doubles and walks carry the offense."
          : "Balanced game: no single rating dominates, so rank cards on their overall value.";

  // strikeouts
  if (k < 0.10) items.push({ tag: "Hitters", tone: "skip", head: "Don't pay for Avoid Ks",
    body: `Only ${pct(k)} of plate appearances are strikeouts. A bad Avoid K rating barely hurts here; spend on Eye, Gap and contact instead.` });
  else if (k > 0.18) items.push({ tag: "Hitters", tone: "chase", head: "Avoid Ks pays",
    body: `${pct(k)} strikeouts. Every ball put in play is worth a lot, so a bad Avoid K bat is a real liability.` });
  else items.push({ tag: "Hitters", tone: "info", head: "Avoid Ks: middling",
    body: `${pct(k)} strikeouts. It matters, but it's not the deciding rating.` });

  // power
  if (hr < 0.01) items.push({ tag: "Hitters", tone: "skip", head: "Power is nearly dead",
    body: `Homers are ${pct(hr, 2)} of plate appearances. A slugger's main tool does almost nothing; take the contact/gap bat over the power bat.` });
  else if (hr < 0.018) items.push({ tag: "Hitters", tone: "info", head: "Power buys less than usual",
    body: `Homers are scarce (${pct(hr, 2)} of PA). Power-only bats lose most of their value; a bat needs contact or eye too.` });
  else if (hr > 0.028) items.push({ tag: "Hitters", tone: "chase", head: "Pay for Power",
    body: `Homers are cheap here (${pct(hr, 2)} of PA). Power is the biggest single rating, so it's worth paying up for.` });

  // balls in play: defence and BABIP
  if (bip > 0.80) items.push({ tag: "Defense", tone: "chase", head: "Gloves matter more",
    body: `${pct(bip, 0)} of plate appearances end with the ball in play, so fielders touch almost every play. Put your best gloves up the middle, and pitchers' pBABIP counts more.` });
  else if (bip < 0.68) items.push({ tag: "Defense", tone: "info", head: "Gloves matter a bit less",
    body: `Only ${pct(bip, 0)} of plate appearances reach a fielder. Defense still counts, but a bat-first player costs you less here.` });

  // speed and small ball
  const sb = s.env.sbbe0, bunt = s.env.bunt_12_0;
  if (sb < 0.76) items.push({ tag: "Speed", tone: "chase", head: "Speed and steals pay",
    body: `A steal breaks even at ${pct(sb, 0)} success. Fast runners with good steal ratings add real runs.` });
  else if (sb > 0.80) items.push({ tag: "Speed", tone: "skip", head: "Don't run much",
    body: `A steal needs ${pct(sb, 0)} success to break even. Speed matters for extra bases, not for stealing.` });
  if (bunt >= 0.045) items.push({ tag: "Strategy", tone: "info", head: "Bunting works here",
    body: "Sacrificing with runners on 1st and 2nd and nobody out gains runs, so a good bunter at the bottom of the order helps." });
  else if (bunt < 0.005) items.push({ tag: "Strategy", tone: "info", head: "Don't bunt",
    body: "Giving up an out costs more than the extra base is worth." });

  // hitters and pitchers, straight from the lever solve
  const lv = leversOf(s);
  if (lv && lv.hit.length > 1) {
    const [a, b] = lv.hit, low = lv.hit[lv.hit.length - 1];
    items.push({ tag: "Hitters", tone: "chase", head: `Hitters: ${a.rating}, then ${b.rating}`,
      body: `+10 points of ${a.rating} is worth +${a.runs.toFixed(1)} runs per 700 PA here, ${b.rating} +${b.runs.toFixed(1)}; ${low.rating} is worth the least (+${low.runs.toFixed(1)}).` });
  }
  if (lv && lv.pit.length) {
    const top = lv.pit[0], low = lv.pit[lv.pit.length - 1];
    items.push({ tag: "Pitchers", tone: "chase", head: `Pitchers: ${top.rating} first`,
      body: `${top.rating} is the rating that saves the most runs here (+${top.runs.toFixed(1)} per 10 points); ${low.rating} saves the least (+${low.runs.toFixed(1)}).${hr < 0.01 ? " With almost no homers, pHR barely matters." : ""}` });
  }

  // the ballpark
  const f = s.parkRow;
  if (f) {
    const hand = handRead(spec);
    if (hand && Math.abs(hand.edge) >= 0.1) items.push({ tag: "Lineup", tone: "chase",
      head: `Tilt the lineup ${hand.edge > 0 ? "left" : "right"}-handed`,
      body: `An all-${hand.edge > 0 ? "left" : "right"} lineup scores ${Math.abs(hand.edge).toFixed(2)} runs a game more in this park. Home runs: ${hand.hrL.toFixed(2)} for left-handed bats, ${hand.hrR.toFixed(2)} for right-handed.` });
    if (f.d3 >= 1.15) items.push({ tag: "Park", tone: "chase", head: "Triples park",
      body: `Triples are up ${((f.d3 - 1) * 100).toFixed(0)}%. Gap-and-speed hitters gain extra bases here.` });
    const hrBlend = (f.hrL + f.hrR) / 2;
    if (hrBlend <= 0.9) items.push({ tag: "Park", tone: "skip", head: "Park kills homers",
      body: `Home runs are down ${((1 - hrBlend) * 100).toFixed(0)}%. Discount power bats and lean on contact.` });
    else if (hrBlend >= 1.1) items.push({ tag: "Park", tone: "chase", head: "Homer-friendly park",
      body: `Home runs are up ${((hrBlend - 1) * 100).toFixed(0)}%. Power bats gain, and so do pitchers with a good pHR rating.` });
  }

  return { headline, items };
}

const TONE: Record<Tone, string> = {
  chase: "border-positive/40 bg-positive/10 text-positive",
  skip: "border-negative/40 bg-negative/10 text-negative",
  info: "border-border bg-muted text-muted-foreground",
};

export function CardChecklist({ s, spec }: { s: Solved; spec: EnvSpec }) {
  const read = React.useMemo(() => checklist(s, spec), [s, spec]);
  if (!read) return null;
  return (
    <Card className="lg:col-span-3">
      <CardContent className="flex flex-col gap-3 p-5">
        <div>
          <div className="label-eyebrow">What to look for on cards</div>
          <p className="mt-1 text-sm font-medium">{read.headline}</p>
          <p className="text-xs text-muted-foreground">{s.eraLabel} · {s.parkLabel}</p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {read.items.map((it) => (
            <li key={it.head} className="flex gap-2 rounded-md border border-border p-2.5">
              <span className={cn("h-fit shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide", TONE[it.tone])}>
                {it.tag}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-medium">{it.head}</div>
                <p className="text-xs leading-relaxed text-muted-foreground">{it.body}</p>
              </div>
            </li>
          ))}
        </ul>
        {s.env?.preset && (
          <p className="border-t border-border pt-2 text-xs text-muted-foreground">
            In-game strategy preset: <span className="font-medium text-foreground">{s.env?.preset}</span>.
            The exact runs per rating are in &ldquo;What to buy here&rdquo; below.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
