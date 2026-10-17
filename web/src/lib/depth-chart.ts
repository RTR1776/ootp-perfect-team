/**
 * The game's depth chart for a built roster (L.J., 2026-10-17: "you can pick
 * every 3rd game or whatever or just set when tired ... also can set
 * defensive subs, so if we want to start someone for the bat, can get a def
 * sub in"). Per fielding position, against one hand's lineup:
 *
 * - Utility 1 and 2: the players off the field against that hand (bench, the
 *   other hand's platoon starters, or the DH, who moves out to the field on a
 *   starter's rest day) who can play it at the floor, best first by bat plus
 *   glove there. The game starts them when the starter is tired, or on the
 *   schedule set beside them.
 * - A defensive sub where a bench glove beats the starter's by DEF_SUB_RUNS a
 *   season or more: the starter is in for his bat, the sub finishes games. The
 *   DH is never one (sending him out to the field mid-game gives up the DH).
 *
 * Plus pinch hitters (the bench's best bats against that hand) and pinch
 * runners (the bench's fastest). Pure: env-roster prints it, /build can show it.
 */

export interface DepthCard { cardId: number; name: string; isPitcher: boolean; ratings: Record<string, number> }

export interface DepthRow {
  pos: string;
  starter: string | null;
  utility: { name: string; rating: number }[];
  defSub: { name: string; runs: number } | null;
}

export interface DepthChart { rows: DepthRow[]; pinchHit: string[]; pinchRun: string[] }

/** Glove runs a season a bench man must add over the starter to be worth a late-inning defensive sub. */
export const DEF_SUB_RUNS = 3;
const FIELD = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];

export function depthChart(o: {
  slots: Readonly<Record<string, number>>;
  cards: ReadonlyMap<number, DepthCard>;
  lineupPos: readonly string[];
  hand: "R" | "L";
  /** Bat runs a season against this hand. */
  bat: (cardId: number) => number;
  /** Glove runs a season at a position (framing included at C). */
  glove: (pos: string, c: DepthCard) => number;
  floor: (pos: string) => number;
  name?: (c: DepthCard) => string;
}): DepthChart {
  const nm = o.name ?? ((c: DepthCard) => c.name);
  const lineup = new Set(o.lineupPos.map((p) => o.slots[`${o.hand}:${p}`]).filter((id) => id != null));
  const hitters = [...new Set(Object.values(o.slots))].map((id) => o.cards.get(id)).filter((c): c is DepthCard => c != null && !c.isPitcher);
  const bench = hitters.filter((c) => !lineup.has(c.cardId));
  const dh = o.lineupPos.includes("DH") ? o.cards.get(o.slots[`${o.hand}:DH`]) : undefined;
  const offField = dh && !dh.isPitcher ? [...bench, dh] : bench;
  const rating = (c: DepthCard, pos: string) => c.ratings[`Pos Rating ${pos}`] ?? 0;

  const rows: DepthRow[] = o.lineupPos.filter((p) => FIELD.includes(p)).map((pos) => {
    const starter = o.cards.get(o.slots[`${o.hand}:${pos}`]);
    const can = (from: DepthCard[]) => from.filter((c) => rating(c, pos) >= Math.max(1, o.floor(pos)));
    const utility = can(offField)
      .sort((a, b) => o.bat(b.cardId) + o.glove(pos, b) - (o.bat(a.cardId) + o.glove(pos, a)))
      .slice(0, 2)
      .map((c) => ({ name: nm(c), rating: rating(c, pos) }));
    let defSub: DepthRow["defSub"] = null;
    if (starter) {
      const mine = o.glove(pos, starter);
      const best = can(bench).sort((a, b) => o.glove(pos, b) - o.glove(pos, a))[0];
      const runs = best ? o.glove(pos, best) - mine : 0;
      if (best && runs >= DEF_SUB_RUNS) defSub = { name: nm(best), runs: Math.round(runs * 10) / 10 };
    }
    return { pos, starter: starter ? nm(starter) : null, utility, defSub };
  });
  const pinchHit = [...bench].sort((a, b) => o.bat(b.cardId) - o.bat(a.cardId)).slice(0, 4).map(nm);
  const pinchRun = [...bench].sort((a, b) => (b.ratings.Speed ?? 0) - (a.ratings.Speed ?? 0)).slice(0, 3).map((c) => `${nm(c)} (SPE ${c.ratings.Speed ?? "?"})`);
  return { rows, pinchHit, pinchRun };
}
