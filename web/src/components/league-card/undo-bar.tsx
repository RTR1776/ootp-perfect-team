/**
 * Undo and Redo for the whole Card Model, saying what each would take back:
 * "Undo: remove Mel Ott". It sits in the summary strip (UI plan C6).
 */
import { Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface UndoControls {
  canUndo: boolean; canRedo: boolean;
  undoLabel: string | null; redoLabel: string | null;
  undo: () => void; redo: () => void;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function UndoBar({ canUndo, canRedo, undoLabel, redoLabel, undo, redo }: UndoControls) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Button
        size="sm" variant="outline" disabled={!canUndo} onClick={undo} className="min-w-0 max-w-[15rem] sm:max-w-xs"
        title={undoLabel ? `Undo: ${lower(undoLabel)} (Ctrl+Z or ⌘Z)` : "Nothing to undo"}
      >
        <Undo2 /><span className="truncate">{undoLabel ? `Undo: ${lower(undoLabel)}` : "Undo"}</span>
      </Button>
      <Button
        size="sm" variant="ghost" disabled={!canRedo} onClick={redo}
        title={redoLabel ? `Redo: ${lower(redoLabel)} (Shift+Ctrl+Z or ⇧⌘Z)` : "Nothing to redo"}
      >
        <Redo2 />Redo
      </Button>
    </div>
  );
}
