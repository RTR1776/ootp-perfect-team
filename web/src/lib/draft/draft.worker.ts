/// <reference lib="webworker" />
/**
 * The live draft helper's advice off the main thread (lib/draft/engine.ts
 * draftView): playing out every candidate's rounds left takes 100-350 ms, and
 * mid-draft the page must keep taking keystrokes. One worker per event: "init"
 * builds the engine from the page's cards, each "view" answers one state.
 */
import { draftView, makeEngine, type DraftCard, type DraftCtx, type DraftView, type Engine, type ViewInput } from "./engine";

export type DraftWorkerRequest =
  | { type: "init"; cards: DraftCard[]; ctx: DraftCtx }
  | { type: "view"; id: number; input: ViewInput };

export type DraftWorkerResponse =
  | { type: "view"; id: number; view: DraftView }
  | { type: "error"; id: number; message: string };

let engine: Engine | null = null;

self.onmessage = (e: MessageEvent<DraftWorkerRequest>) => {
  const m = e.data;
  if (m.type === "init") { engine = makeEngine(m.cards, m.ctx); return; }
  try {
    if (!engine) throw new Error("the draft engine was not started");
    postMessage({ type: "view", id: m.id, view: draftView(engine, m.input, () => performance.now()) } satisfies DraftWorkerResponse);
  } catch (err) {
    postMessage({ type: "error", id: m.id, message: err instanceof Error ? err.message : String(err) } satisfies DraftWorkerResponse);
  }
};
