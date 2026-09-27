"use client";

/**
 * /league-card: L.J.'s league lineups and pitching staff on the league model,
 * built from a team list he keeps current, with slots he can lock, a home park
 * to try, and a card typed off its face to see what it adds. Scoring is
 * server side (/api/league-card), on the same model as `pnpm league:compare`.
 *
 * Every edit is one labelled step in one history (lib/league-card-state), so
 * Undo/Redo and Cmd/Ctrl+Z take back any of it, and edits that drop work say
 * so in a toast with Undo. The lineups and the staff rescore after each edit
 * on their own. The state is kept in this browser (localStorage
 * "league-card:v3"); the open tab is in the URL (?tab=staff).
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dismissToast, toast } from "@/components/ui/toast";
import {
  edit, modelReducer, restoreState, scoreRequest, STORE, STORE_V2, type CardBase, type CardKind, type LeagueExport, type ModelAction,
} from "@/lib/league-card-state";
import { useUndoable, useUndoKeys } from "@/lib/use-undoable";
import { selectUndoKeys } from "./bits";
import { CardPanel } from "./card-panel";
import { LineupsPanel } from "./lineups-panel";
import { StaffPanel } from "./staff-board";
import { TeamPanel } from "./team-panel";
import { UndoBar } from "./undo-bar";
import { useRescore } from "./use-rescore";

export interface CardOption { id: number; name: string; label: string; kind: CardKind }
interface Props {
  /** Cards to add or model: hitters "Dave Winfield 97 · 1979 RF", pitchers "Kenley Jansen 100 · 2017 CL · RP". */
  cards: CardOption[];
  parks: string[];
  /** The newest league export: his bats and arms that week, and its league. */
  league: LeagueExport;
}

type Tab = "lineups" | "staff";
const TABS: Array<[Tab, string]> = [["lineups", "Lineups"], ["staff", "Pitching staff"]];

/* Rendered in the browser only: the team, locks and settings come from this
   browser's storage, which the server cannot see, so the server sends a
   placeholder instead of markup that would not match. */
const noSubscribe = () => () => {};
export function LeagueCardModel(props: Props) {
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  return inBrowser ? <Model {...props} /> : <div className="text-sm text-muted-foreground">Loading your team…</div>;
}

const readSaved = (key: string): unknown => {
  try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; }
};

function Model({ cards, parks, league }: Props) {
  const {
    state, dispatch, seal, undo: undoStep, redo: redoStep, canUndo, canRedo, undoLabel, redoLabel,
  } = useUndoable(modelReducer, () => restoreState(readSaved(STORE), readSaved(STORE_V2), league));

  // Remembered in this browser; a blocked store just means nothing is kept.
  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private window or full */ }
  }, [state]);

  const parkSet = useMemo(() => new Set(parks), [parks]);
  const req = useMemo(() => scoreRequest(state, parkSet), [state, parkSet]);
  const score = useRescore(req.key);
  const { hurry } = score;

  // One Undo toast at a time: after another edit, an older one would undo the wrong step.
  const notice = useRef<number | null>(null);
  const dropNotice = useCallback(() => {
    if (notice.current != null) dismissToast(notice.current);
    notice.current = null;
  }, []);
  // The toast outlives the page (the Toaster is in the root layout): leaving closes it, since its Undo would act on nothing.
  useEffect(() => dropNotice, [dropNotice]);
  const undo = useCallback(() => { dropNotice(); hurry(); undoStep(); }, [dropNotice, hurry, undoStep]);
  const redo = useCallback(() => { dropNotice(); hurry(); redoStep(); }, [dropNotice, hurry, redoStep]);
  useUndoKeys(undo, redo);
  const onSelectKeys = useCallback((e: React.KeyboardEvent) => selectUndoKeys(undo, redo)(e), [undo, redo]);

  // Lineups or the staff; the open tab goes in the URL so a reload or Back keeps it.
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(window.location.search).get("tab") === "staff" ? "staff" : "lineups"));
  const openTab = useCallback((v: string) => {
    const next: Tab = v === "staff" ? "staff" : "lineups";
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "staff") url.searchParams.set("tab", next); else url.searchParams.delete("tab");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  /** Every edit goes through here. Typing (a coalescing edit) rescores after a pause; anything else at once. */
  const act = useCallback((a: ModelAction) => {
    dropNotice();
    hurry(a.coalesceKey == null);
    dispatch(a);
  }, [dropNotice, hurry, dispatch]);
  /** An edit that drops work, with a toast to take it back: "Removed Mel Ott · Undo". */
  const told = useCallback((a: ModelAction, message: string) => {
    if (modelReducer(state, a) === state) return;
    act(a);
    notice.current = toast({ message, action: { label: "Undo", onClick: undo } });
  }, [state, act, undo]);

  // The card on the form: its base values come from the server once per card.
  const bases = useRef(new Map<number, CardBase>());
  const picking = useRef(0);
  const [loading, setLoading] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const pickCard = useCallback(async (o: CardOption) => {
    const seq = ++picking.current;
    setCardError(null);
    let base = bases.current.get(o.id);
    if (!base) {
      setLoading(o.label);
      try {
        const r = await fetch(`/api/league-card?card=${o.id}`);
        const j = (await r.json().catch(() => ({}))) as Partial<Pick<CardBase, "kind" | "movement" | "observed">> & {
          name?: string; title?: string; face?: Record<string, number>; error?: string;
        };
        if (!r.ok || !j.face) throw new Error(j.error ?? "Could not load the card.");
        const arm = j.kind === "arm";
        base = {
          id: o.id, name: j.name ?? o.name, title: j.title ?? null, base: j.face, kind: arm ? "arm" : "bat",
          // A pitcher's Movement (shown, not modelled) and his league record by role.
          ...(arm ? { movement: j.movement ?? null, observed: j.observed ?? null } : {}),
        };
        bases.current.set(o.id, base);
      } catch (e) {
        if (seq === picking.current) {
          setLoading(null);
          setCardError(e instanceof TypeError ? "Could not reach the server to load the card." : (e as Error).message);
        }
        return;
      }
    }
    if (seq !== picking.current) return; // a later pick won
    setLoading(null);
    act(edit.pickCard(base));
  }, [act]);
  const clearCard = () => {
    picking.current++;
    setLoading(null);
    if (state.candidate) told(edit.clearCard(state.candidate.name), `Cleared ${state.candidate.name}`);
  };

  const c = state.candidate;
  const res = score.result;
  // A card's result shows only under that card: switching cards never shows the old one's.
  const scoredId = c?.kind === "arm" ? res?.candidateArm?.cardId : res?.candidate?.cardId;
  const cardResult = c?.include && !loading && scoredId === c.id ? res : null;
  const withArm = c?.kind === "arm" && cardResult?.candidateArm && cardResult.armAdd
    ? { name: c.name, arm: cardResult.candidateArm, staff: cardResult.armAdd.staff } : null;
  const status = { pending: score.pending, stale: score.stale, skip: req.skip ?? null, error: score.error, retry: score.retry };

  return (
    <div className="space-y-4">
      <TeamPanel state={state} league={league} cards={cards} result={res} act={act} told={told} />
      <Tabs value={tab} onValueChange={openTab}>
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <TabsList aria-label="Lineups or pitching staff">
                {TABS.map(([v, name]) => <TabsTrigger key={v} value={v}>{name}</TabsTrigger>)}
              </TabsList>
              <UndoBar canUndo={canUndo} canRedo={canRedo} undoLabel={undoLabel} redoLabel={redoLabel} undo={undo} redo={redo} />
            </div>
          </CardHeader>
          <CardContent>
            <TabsContent value="lineups" className="mt-0">
              <LineupsPanel
                state={state} exportFamily={league.family} result={res} withCard={cardResult?.with ?? null} {...status}
                act={act} told={told} seal={seal} onSelectKeys={onSelectKeys}
              />
            </TabsContent>
            <TabsContent value="staff" className="mt-0">
              <StaffPanel state={state} league={league} result={res} withArm={withArm} {...status} act={act} told={told} onSelectKeys={onSelectKeys} />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
      <CardPanel
        candidate={c} cards={cards} result={cardResult} pending={score.pending} stale={score.stale} loading={loading} cardError={cardError}
        onPick={(o) => void pickCard(o)} onClear={clearCard} act={act} seal={seal}
      />
      <datalist id="league-card-options">
        {cards.map((o) => <option key={o.id} value={o.label} />)}
      </datalist>
      <datalist id="league-card-parks">
        {parks.map((p) => <option key={p} value={p} />)}
      </datalist>
    </div>
  );
}
