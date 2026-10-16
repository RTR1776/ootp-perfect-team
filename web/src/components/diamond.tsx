/**
 * The ball field the lineup views share (Build's Field view, Needs, the
 * league lineups): a fan of outfield grass, the infield dirt and the bases,
 * drawn to fill its box, and where each position sits on it in % (left, top).
 */

export const FIELD_SPOT: Record<string, [number, number]> = {
  CF: [50, 12], LF: [20, 30], RF: [80, 30],
  SS: [35, 50], "2B": [65, 50],
  "3B": [21, 70], "1B": [79, 70],
  C: [50, 91], DH: [14, 91],
};

/** The box a position card sits in: 27% of the field's width, centred on its spot. */
export const SPOT_BOX = "absolute w-[27%] min-w-[92px] max-w-[176px] -translate-x-1/2 -translate-y-1/2";

export function FieldBackdrop() {
  return (
    <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
      <path d="M50 95 L3 46 Q50 -40 97 46 Z" fill="#1d3a22" stroke="#5b4a2e" strokeWidth="1.2" />
      <ellipse cx="50" cy="76" rx="21" ry="19" fill="#3b2a17" />
      <polygon points="50,61 63,75 50,89 37,75" fill="none" stroke="#e8e2d0" strokeOpacity="0.5" strokeWidth="0.5" />
    </svg>
  );
}

/** "Juan Soto" → "Soto"; "Andy Van Slyke" → "Van Slyke": a platoon pair's short names. */
export const surname = (n: string) => n.split(" ").slice(1).join(" ") || n;
