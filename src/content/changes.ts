// The change model. Changes are plain data (serializable to storage) plus a
// runtime elementId that is re-resolved from `selector` after a reload.

/** The page a change was made on. Changes from every page of a site share one session. */
export interface PageRef {
  /** origin + pathname + search: the identity used for grouping. */
  key: string;
  url: string;
  title: string;
}

interface BaseChange {
  id: string;
  page: PageRef;
  /** Runtime element ID, or null when the element can't be found on the page. */
  elementId: string | null;
  /** Stable selector recorded when the change was first made (pre-change DOM). */
  selector: string;
  tag: string;
  section: string;
  /** Short visible text of the element when first changed. */
  snippet: string;
  /** Truncated outerHTML of the element when first changed. */
  contextHtml: string;
}

export interface EditChange extends BaseChange {
  type: "edit";
  oldText: string;
  newText: string;
}

export interface RemoveChange extends BaseChange {
  type: "remove";
}

export interface NoteChange extends BaseChange {
  type: "note";
  note: string;
}

export interface MoveChange extends BaseChange {
  type: "move";
  position: "before" | "after";
  targetId: string | null;
  targetSelector: string;
  targetSnippet: string;
  parentSelector: string;
}

export type Change = EditChange | RemoveChange | NoteChange | MoveChange;
export type ChangeType = Change["type"];

/** One reversible step: the change with this id goes from `before` to `after` (null = absent). */
export interface Patch {
  id: string;
  before: Change | null;
  after: Change | null;
  /** List position used when inserting. */
  index: number;
}

export interface HistoryEntry {
  label: string;
  patches: Patch[];
}

const RUNTIME_FIELDS = ["elementId", "targetId"] as const;

export function serialize(change: Change): Record<string, unknown> {
  const out: Record<string, unknown> = { ...change };
  for (const f of RUNTIME_FIELDS) delete out[f];
  return out;
}
