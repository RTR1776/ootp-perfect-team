"use client";

/**
 * The event's own ballpark behind the Build page's field (L.J., 2026-10-18:
 * "having the actual ballpark for that tourney - like visually the
 * dimensions/walls/etc"): the real outfield wall for that park and era,
 * thicker and brighter where it's taller, the distances on it, the warning
 * track, the infield and foul lines; and, in a strip above the field, the
 * park's name and year, its walls and its hitting factors.
 *
 * ParkBackdrop fills the same box as the generic FieldBackdrop, with home
 * plate and the infield where that one has them, so the position cards land
 * as before. The shape is drawn for the box's real width and height
 * (measured), so the foul lines meet square wherever the box is wide enough.
 * The field is dark in both themes, as the generic one is; ParkBanner uses
 * the theme's card colours. The banner sits outside the box because a phone
 * leaves no corner of it free of position cards.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  DESIGN_ASPECT, fieldShape, sectionOf, wallColor, wallProfile, type LabelKey, type ParkView,
} from "@/lib/park-shape";

const SPOT_NAME: Record<LabelKey, string> = {
  lf: "Left-field line", lcf: "Left-centre", cf: "Centre field", rcf: "Right-centre", rf: "Right-field line", deep: "Deepest point",
};

const FIELD = {
  foul: "#15301c", track: "#4d3a24", grass: "#1d3a22", dirt: "#45311c", chalk: "#ece6d4", pole: "#f2cf4a",
};

/** How far beyond the wall's top a distance sits, in px: signage atop the fence, clear of the cards below it. */
const SIGN_OFFSET = 9;

const fmtFt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

export function ParkBackdrop({ park }: { park: ParkView }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = React.useState(DESIGN_ASPECT);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setAspect(Math.round((width / height) * 100) / 100);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shape = React.useMemo(() => fieldShape(park.dims, aspect), [park.dims, aspect]);
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const { infield: inf, poles } = shape;
  const chalk = { stroke: FIELD.chalk, vectorEffect: "non-scaling-stroke" as const };

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0">
      <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id={`${uid}-wall`} gradientUnits="userSpaceOnUse" x1={shape.gradientX[0]} x2={shape.gradientX[1]} y1="0" y2="0">
            {shape.gradient.map((g, i) => <stop key={i} offset={g.offset} stopColor={g.color} />)}
          </linearGradient>
          <pattern id={`${uid}-mow`} width="100" height="6" patternUnits="userSpaceOnUse">
            <rect width="100" height="3" fill="#ffffff" fillOpacity="0.035" />
          </pattern>
        </defs>
        <path d={shape.foulPath} fill={FIELD.foul} />
        <path d={shape.fairPath} fill={FIELD.track} />
        <path d={shape.grassPath} fill={FIELD.grass} />
        <path d={shape.grassPath} fill={`url(#${uid}-mow)`} />
        <ellipse {...inf.dirt} fill={FIELD.dirt} />
        <path d={inf.grass} fill={FIELD.grass} />
        <path d={inf.paths} fill="none" {...chalk} strokeOpacity="0.45" strokeWidth="1" />
        <ellipse {...inf.mound} fill={FIELD.dirt} />
        <ellipse {...inf.plate} fill={FIELD.dirt} />
        {inf.bases.map((b, i) => (
          <rect key={i} x={b.x - 0.7} y={b.y - 0.7} width="1.4" height="1.4" fill={FIELD.chalk} fillOpacity="0.85" transform={`rotate(45 ${b.x} ${b.y})`} />
        ))}
        <line x1="50" y1="89" x2={poles.lf.x} y2={poles.lf.y} {...chalk} strokeOpacity="0.7" strokeWidth="1.25" />
        <line x1="50" y1="89" x2={poles.rf.x} y2={poles.rf.y} {...chalk} strokeOpacity="0.7" strokeWidth="1.25" />
        <path d={shape.wallPath} fill={`url(#${uid}-wall)`} stroke="#0b120d" strokeOpacity="0.6" strokeWidth="0.75" vectorEffect="non-scaling-stroke" />
        {[shape.samples[0], shape.samples[shape.samples.length - 1]].map((s) => (
          <line key={s.deg} x1={s.inner.x} y1={s.inner.y} x2={s.outer.x + (s.outer.x - s.inner.x) * 0.6} y2={s.outer.y + (s.outer.y - s.inner.y) * 0.6}
            stroke={FIELD.pole} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>

      {/* the distances, atop the wall; kept inside the box where a deep wall runs close to its edge, and
          above the position cards (on a phone the centre fielder's card reaches the wall) without taking their clicks */}
      {shape.labels.map((l) => {
        // Straight out from home, in px terms (the viewBox is stretched to the box).
        const t = (l.deg * Math.PI) / 180;
        const vx = Math.sin(t) * shape.kx * aspect, vy = -Math.cos(t) * shape.ky;
        const n = Math.hypot(vx, vy) || 1;
        const dx = (vx / n) * SIGN_OFFSET, dy = (vy / n) * SIGN_OFFSET;
        return (
          <span
            key={l.key}
            aria-hidden
            style={{
              left: `clamp(16px, calc(${l.at.x}% + ${dx.toFixed(1)}px), calc(100% - 16px))`,
              top: `max(8px, calc(${l.at.y}% + ${dy.toFixed(1)}px))`,
              borderColor: wallColor(l.wall ?? 8),
            }}
            className={cn(
              "absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded border bg-[#0a110c]/90 px-1 font-mono text-[10px] font-semibold leading-[14px] text-[#f4efe0] tabular-nums shadow-sm sm:text-[11px] sm:leading-[15px]",
              l.key === "deep" && "border-dashed text-[#f4efe0]/80",
            )}
          >
            {l.feet}
          </span>
        );
      })}

      <p className="sr-only">
        {park.stadium}: {shape.labels.map((l) => `${SPOT_NAME[l.key]} ${l.feet} feet${l.wall != null ? ` (wall ${fmtFt(l.wall)} feet)` : ""}`).join(", ")}.
      </p>
    </div>
  );
}

/** The park above the field: name and year, its walls, and what it does to a batted ball. */
export function ParkBanner({ park }: { park: ParkView }) {
  const heights = wallProfile(park.dims);
  const lo = Math.min(...heights.pts.map((p) => p[1])), hi = Math.max(...heights.pts.map((p) => p[1]));
  const top = heights.known ? heights.pts.reduce((best, p) => (p[1] > best[1] ? p : best)) : null;

  const walls = !heights.known ? "wall heights not on file" : lo === hi ? `${fmtFt(hi)}-ft wall` : `walls ${fmtFt(lo)}–${fmtFt(hi)} ft`;
  const extra: string[] = [];
  if (park.dims.assumed) extra.push("dimensions assumed");
  else if (park.asked != null && park.year !== park.asked) extra.push(`as of ${park.year}`);
  if (top && top[1] >= 15 && lo !== hi) extra.push(`${fmtFt(top[1])} ft in ${sectionOf(top[0])}`);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs">
      <span className="font-semibold text-foreground" title={`${park.dims.note}\nSource: ${park.dims.source}`}>{park.stadium}</span>
      <span className="flex items-center gap-1.5 text-muted-foreground" title="Wall drawn thicker and brighter where it's taller">
        {heights.known && (
          <span aria-hidden className="inline-block h-1.5 w-8 rounded-full" style={{ background: `linear-gradient(90deg, ${wallColor(lo)}, ${wallColor(hi)})` }} />
        )}
        {[walls, ...extra].join(" · ")}
      </span>
      {park.chips.length > 0 && (
        <span className="ml-auto flex flex-wrap items-center gap-1" title={`Park factors: ${park.factorLabel}`}>
          {park.chips.map((c) => (
            <span key={c.key} className="whitespace-nowrap rounded-full border border-border px-1.5 text-[11px] leading-[18px] text-muted-foreground">
              {c.label} <span className={cn("font-mono font-semibold", c.value > 1 ? "text-positive" : "text-negative")}>×{c.value.toFixed(2)}</span>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
