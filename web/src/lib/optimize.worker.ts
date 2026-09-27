/// <reference lib="webworker" />
/**
 * /build's board search, off the main thread: Optimise (mode "quick") and
 * Search longer (mode "deep") both run here, so the page stays responsive and
 * Stop (terminating this worker) works in both. The search itself, its starts,
 * settings and time budget, is lib/roster-search.ts; the budget is checked
 * here, with this worker's own clock.
 */
import { runSearch, type SearchMessage, type SearchRequest } from "./roster-search";

self.onmessage = (e: MessageEvent<SearchRequest>) => {
  runSearch(e.data, (m: SearchMessage) => postMessage(m), () => performance.now());
};
