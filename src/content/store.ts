// One small store for changes, history state and UI state. The UI subscribes
// and re-renders; only the command layer writes `changes`/history fields.
import type { Change } from "./changes";

export interface State {
  enabled: boolean;
  changes: Change[];
  /** The page currently shown (origin + path + search); follows client-side navigation. */
  pageKey: string;
  canUndo: boolean;
  canRedo: boolean;
  selectedId: string | null;
  /** Element being edited in place, if any. */
  editingId: string | null;
  /** Element whose note editor is open, if any. */
  noteEditingId: string | null;
  /** Bumped to trigger a flash animation on an element. */
  flash: { elementId: string; at: number } | null;
  panel: { collapsed: boolean; x: number | null; y: number | null };
  toast: { text: string; at: number } | null;
}

type Listener = (state: State, prev: State) => void;

class Store {
  private state: State = {
    enabled: false,
    changes: [],
    pageKey: "",
    canUndo: false,
    canRedo: false,
    selectedId: null,
    editingId: null,
    noteEditingId: null,
    flash: null,
    panel: { collapsed: false, x: null, y: null },
    toast: null,
  };
  private listeners = new Set<Listener>();
  private scheduled = false;
  private prev = this.state;

  get(): State {
    return this.state;
  }

  set(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    // Batch notifications to one per microtask.
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      const prev = this.prev;
      this.prev = this.state;
      for (const l of this.listeners) l(this.state, prev);
    });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const store = new Store();
