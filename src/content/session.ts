// Change list, undo/redo history and persistence. commit() is the single path
// by which the change list and the page DOM are modified.
import { setOriginalTextLookup } from "./describe";
import { serialize, type Change, type HistoryEntry, type PageRef, type Patch } from "./changes";
import * as engine from "./engine";
import { elementOf, idOf } from "./registry";
import { store } from "./store";

const undoStack: HistoryEntry[] = [];
const redoStack: HistoryEntry[] = [];
let nextChangeId = 1;

/** All pages of a site share one session, so the prompt can cover a whole browsing session. */
const siteKey = () => `site:${location.origin}`;
/** Pre-session storage format: one list per page. */
const legacyPageKey = () => `page:${location.origin}${location.pathname}${location.search}`;

export const currentPageKey = () => `${location.origin}${location.pathname}${location.search}`;

export function currentPage(): PageRef {
  return { key: currentPageKey(), url: location.href, title: document.title };
}

export const isOnCurrentPage = (c: Change) => c.page.key === currentPageKey();

export function newChangeId(): string {
  return `ch_${nextChangeId++}`;
}

setOriginalTextLookup((el) => {
  const c = changes().find((c) => c.type === "edit" && elementOf(c.elementId) === el);
  return c?.type === "edit" ? c.oldText : undefined;
});

export function changes(): Change[] {
  return store.get().changes;
}

export function findChange(elementId: string, type: Change["type"]): Change | undefined {
  return changes().find((c) => c.elementId === elementId && c.type === type);
}

function applyToList(list: Change[], patch: Patch, dir: "forward" | "back"): Change[] {
  const to = dir === "forward" ? patch.after : patch.before;
  const i = list.findIndex((c) => c.id === patch.id);
  if (!to) return i === -1 ? list : list.filter((c) => c.id !== patch.id);
  if (i !== -1) return list.map((c) => (c.id === patch.id ? to : c));
  const at = Math.min(Math.max(patch.index, 0), list.length);
  return [...list.slice(0, at), to, ...list.slice(at)];
}

function run(patches: Patch[], dir: "forward" | "back") {
  let list = changes();
  const ordered = dir === "forward" ? patches : [...patches].reverse();
  for (const p of ordered) {
    if (dir === "forward") engine.transition(p.before, p.after);
    else engine.transition(p.after, p.before);
    list = applyToList(list, p, dir);
  }
  return list;
}

function update(list: Change[]) {
  store.set({ changes: list, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });
  const selected = elementOf(store.get().selectedId);
  if (selected && !(selected as HTMLElement).offsetParent && !selected.getClientRects().length) store.set({ selectedId: null });
  void persist(list);
}

/** Applies patches, records them as one undoable step. */
export function commit(label: string, patches: Patch[]) {
  if (!patches.length) return;
  const list = run(patches, "forward");
  undoStack.push({ label, patches });
  redoStack.length = 0;
  update(list);
}

export function undo(): string | null {
  const entry = undoStack.pop();
  if (!entry) return null;
  const list = run(entry.patches, "back");
  redoStack.push(entry);
  update(list);
  return entry.label;
}

export function redo(): string | null {
  const entry = redoStack.pop();
  if (!entry) return null;
  const list = run(entry.patches, "forward");
  undoStack.push(entry);
  update(list);
  return entry.label;
}

/**
 * Patch that inserts a new change or replaces the existing one with the same id.
 * New changes go after the last change from the same page, so the list stays
 * grouped by page and numbers match the prompt.
 */
export function patchFor(before: Change | undefined, after: Change | null): Patch {
  const list = changes();
  const id = before?.id ?? after?.id ?? newChangeId();
  let index = list.length;
  if (before) index = list.findIndex((c) => c.id === before.id);
  else if (after) {
    const last = list.map((c) => c.page.key).lastIndexOf(after.page.key);
    if (last !== -1) index = last + 1;
  }
  return { id, before: before ?? null, after, index };
}

// ---- Persistence -----------------------------------------------------------

async function persist(list: Change[]) {
  try {
    const key = siteKey();
    if (list.length) await chrome.storage.local.set({ [key]: { savedAt: Date.now(), changes: list.map(serialize) } });
    else await chrome.storage.local.remove(key);
  } catch (err) {
    console.warn("Agent Markup: could not save changes", err);
  }
}

function resolve(selector: string): string | null {
  if (!selector) return null;
  try {
    const found = document.querySelectorAll(selector);
    return found.length === 1 ? idOf(found[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Resolves elements for this page's changes that aren't on the page (not found
 * yet, or replaced by a client-side re-render) and applies them. Changes from
 * other pages are left alone. Returns how many are still missing.
 */
function applyMissing(): number {
  let missing = 0;
  let touched = false;
  const list = changes().map((c) => {
    if (!isOnCurrentPage(c)) return c;
    if (elementOf(c.elementId) && (c.type !== "move" || elementOf(c.targetId))) return c;
    const elementId = resolve(c.selector);
    const resolved = c.type === "move" ? { ...c, elementId, targetId: resolve(c.targetSelector) } : { ...c, elementId };
    if (!resolved.elementId || (resolved.type === "move" && !resolved.targetId)) {
      missing++;
      return c;
    }
    touched = true;
    engine.apply(resolved);
    return resolved;
  });
  if (touched) store.set({ changes: list });
  return missing;
}

/** Re-applies this page's changes, giving late-rendering pages (SPAs) a few more chances. */
async function applyWithRetries() {
  let missing = applyMissing();
  for (const delay of [300, 1000, 2500]) {
    if (!missing) break;
    await new Promise((r) => setTimeout(r, delay));
    missing = applyMissing();
  }
}

/** Loads this site's session and re-applies the current page's changes where elements can still be found. */
export async function restore() {
  const data = await chrome.storage.local.get([siteKey(), legacyPageKey()]);
  const site = (data[siteKey()] as { changes?: Change[] } | undefined)?.changes ?? [];
  const legacy = ((data[legacyPageKey()] as { changes?: Change[] } | undefined)?.changes ?? []).filter(
    (l) => !site.some((c) => c.id === l.id),
  );
  const list = [...site, ...legacy].map((c) => ({
    ...c,
    page: c.page ?? currentPage(),
    elementId: null,
    ...(c.type === "move" ? { targetId: null } : {}),
  })) as Change[];
  for (const c of list) {
    const n = Number(c.id.replace(/^ch_/, ""));
    if (n >= nextChangeId) nextChangeId = n + 1;
  }
  store.set({ changes: list, pageKey: currentPageKey() });
  if (legacy.length) {
    await persist(list);
    await chrome.storage.local.remove(legacyPageKey());
  }
  await applyWithRetries();
  watchUrl();
}

/** Client-side navigation (pushState, popstate) keeps this script alive, so follow URL changes. */
function watchUrl() {
  const check = () => {
    const key = currentPageKey();
    if (key === store.get().pageKey) return;
    store.set({ pageKey: key, selectedId: null, noteEditingId: null });
    void applyWithRetries();
  };
  addEventListener("popstate", check);
  (window as unknown as { navigation?: EventTarget }).navigation?.addEventListener("navigatesuccess", () => setTimeout(check, 0));
  setInterval(check, 500);
}
