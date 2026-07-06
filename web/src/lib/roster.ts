"use client";

import * as React from "react";

const KEY = "pt-optimizer:active-roster";

function read(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

function write(ids: number[]) {
  window.localStorage.setItem(KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event("pt-roster-change"));
}

export function useRoster() {
  const [ids, setIds] = React.useState<number[]>([]);

  React.useEffect(() => {
    setIds(read());
    const onChange = () => setIds(read());
    window.addEventListener("pt-roster-change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("pt-roster-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const add = React.useCallback((cid: number) => {
    const next = Array.from(new Set([...read(), cid]));
    write(next);
  }, []);

  const remove = React.useCallback((cid: number) => {
    write(read().filter((id) => id !== cid));
  }, []);

  const has = React.useCallback((cid: number) => ids.includes(cid), [ids]);

  return { ids, add, remove, has };
}
