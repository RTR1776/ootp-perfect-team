"use client";

/**
 * A live draft's state, kept per format in this browser: the live helper
 * (/draft/live) and the board (/draft?t=<event>) read and write the same
 * entry, so a pick taken on either shows on both, in this tab or another one
 * (the browser's storage event carries it across tabs).
 */
import * as React from "react";
import { freshDraft, type LiveSaved } from "@/lib/draft/live-state";

export { freshDraft, withPick, type LiveSaved } from "@/lib/draft/live-state";

export const liveStoreKey = (series: string) => `draft-live:v1:${series}`;

function read(series: string, packSize: number): LiveSaved {
  const s = freshDraft(packSize);
  try {
    const raw = localStorage.getItem(liveStoreKey(series));
    if (raw) return { ...s, ...(JSON.parse(raw) as Partial<LiveSaved>) };
  } catch { /* storage unavailable */ }
  return s;
}

/** The draft kept in this browser for one format; it survives a reload and follows the other page. */
export function useLiveDraft(series: string, packSize: number) {
  const [saved, setSaved] = React.useState<LiveSaved>(() => freshDraft(packSize));
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from browser storage after mount
    setSaved(read(series, packSize));
    setLoaded(true);
    const onStorage = (e: StorageEvent) => { if (e.key === liveStoreKey(series)) setSaved(read(series, packSize)); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [series, packSize]);
  const update = React.useCallback((f: (s: LiveSaved) => LiveSaved) => {
    setSaved((prev) => {
      const next = f(prev);
      try { localStorage.setItem(liveStoreKey(series), JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, [series]);
  return [saved, update, loaded] as const;
}
