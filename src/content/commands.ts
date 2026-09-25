// The CommandRegistry: every action (UI, keyboard, future AI) runs through
// executeCommand(name, params). Handlers validate against the shared JSON
// Schemas, mutate via session.commit(), and return structured results.
import { COMMAND_DEFINITIONS, getDefinition, getToolDefinitions, type CommandName } from "../commands/definitions";
import { validate } from "../commands/validate";
import type { CommandResult } from "../shared/messages";
import type { Change, EditChange, MoveChange, NoteChange, RemoveChange } from "./changes";
import { copyText } from "./clipboard";
import { contextHtml, sectionOf, snippet, stableSelector, textOf } from "./describe";
import * as engine from "./engine";
import { buildPrompt } from "./prompt";
import { find, outline } from "./query";
import { elementOf } from "./registry";
import * as session from "./session";
import { store } from "./store";

class CommandError extends Error {}

type Handler = (params: any) => unknown | Promise<unknown>;

function requireElement(elementId: string): Element {
  const el = elementOf(elementId);
  if (!el) throw new CommandError(`Unknown element "${elementId}". Use find_elements or get_page_outline to get element IDs.`);
  if (el === document.documentElement || el === document.body) throw new CommandError("Can't change <html> or <body>");
  return el;
}

function base(el: Element, elementId: string) {
  return {
    id: session.newChangeId(),
    page: session.currentPage(),
    elementId,
    selector: stableSelector(el),
    tag: el.localName,
    section: sectionOf(el),
    snippet: snippet(el, 80),
    contextHtml: contextHtml(el),
  };
}

/** The public shape of a change for callers (list_changes). */
function view(c: Change, i: number) {
  const onThisPage = session.isOnCurrentPage(c);
  return { number: i + 1, ...c, onThisPage, found: onThisPage && !!elementOf(c.elementId) };
}

const handlers: Record<CommandName, Handler> = {
  select_element({ elementId, scrollIntoView, flash }: { elementId: string | null; scrollIntoView?: boolean; flash?: boolean }) {
    if (elementId === null) {
      store.set({ selectedId: null, noteEditingId: null });
      return { selectedId: null };
    }
    const el = requireElement(elementId);
    if (scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" });
    store.set({ selectedId: elementId, noteEditingId: null, ...(flash ? { flash: { elementId, at: Date.now() } } : {}) });
    return { selectedId: elementId, tag: el.localName, text: snippet(el), selector: stableSelector(el) };
  },

  edit_text({ elementId, newText }: { elementId: string; newText: string }) {
    const el = requireElement(elementId);
    const before = session.findChange(elementId, "edit") as EditChange | undefined;
    const oldText = before?.oldText ?? textOf(el);
    const text = newText.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
    if (!before && text === oldText) return { changed: false };
    if (before && text === before.newText) return { changed: false, changeId: before.id };
    // Editing back to the original text removes the change.
    const after: EditChange | null =
      text === oldText ? null : { ...(before ?? base(el, elementId)), type: "edit", oldText, newText: text };
    const patch = session.patchFor(before, after);
    session.commit("Edit text", [patch]);
    return { changed: true, changeId: patch.id, oldText, newText: text };
  },

  remove_element({ elementId }: { elementId: string }) {
    const el = requireElement(elementId);
    if (session.findChange(elementId, "remove")) throw new CommandError("Element is already removed");
    const after: RemoveChange = { ...base(el, elementId), type: "remove" };
    session.commit("Remove", [session.patchFor(undefined, after)]);
    if (store.get().selectedId === elementId) store.set({ selectedId: null });
    return { changeId: after.id };
  },

  add_note({ elementId, note }: { elementId: string; note: string }) {
    const el = requireElement(elementId);
    const before = session.findChange(elementId, "note") as NoteChange | undefined;
    const text = note.trim();
    if (!before && !text) return { changed: false };
    if (before && before.note === text) return { changed: false, changeId: before.id };
    const after: NoteChange | null = text ? { ...(before ?? base(el, elementId)), type: "note", note: text } : null;
    const patch = session.patchFor(before, after);
    session.commit(text ? "Note" : "Delete note", [patch]);
    return { changed: true, changeId: patch.id };
  },

  move_element({ elementId, targetId, position }: { elementId: string; targetId: string; position: "before" | "after" }) {
    const el = requireElement(elementId);
    const target = requireElement(targetId);
    if (el === target) throw new CommandError("An element can't be moved relative to itself");
    if (el.contains(target)) throw new CommandError("An element can't be moved inside itself");
    if (!el.parentElement || !target.parentElement || target.parentElement === document.documentElement)
      throw new CommandError("That target can't hold a moved element");
    const already = position === "before" ? el.nextElementSibling === target : el.previousElementSibling === target;
    if (already) return { changed: false };

    const before = session.findChange(elementId, "move") as MoveChange | undefined;
    // Check against the original position: moving back there drops the change.
    if (before) engine.unapply(before);
    const backHome = position === "before" ? el.nextElementSibling === target : el.previousElementSibling === target;
    const fresh = before ? null : base(el, elementId);
    // Selectors are taken with the element in its original place.
    const fromParentSelector = stableSelector(el.parentElement!);
    const parentSelector = stableSelector(target.parentElement);
    const targetSelector = stableSelector(target);
    if (before) engine.apply(before);

    const after: MoveChange | null = backHome
      ? null
      : {
          ...(before ?? fresh!),
          type: "move",
          position,
          targetId,
          targetSelector,
          targetSnippet: snippet(target, 60),
          parentSelector,
          fromParentSelector,
        };
    const patch = session.patchFor(before, after);
    session.commit("Move", [patch]);
    return { changed: true, changeId: patch.id };
  },

  revert_change({ changeId }: { changeId: string }) {
    const before = session.changes().find((c) => c.id === changeId);
    if (!before) throw new CommandError(`Unknown change "${changeId}"`);
    session.commit("Revert", [session.patchFor(before, null)]);
    return { reverted: changeId };
  },

  undo() {
    const label = session.undo();
    return { undone: label, canUndo: store.get().canUndo, canRedo: store.get().canRedo };
  },

  redo() {
    const label = session.redo();
    return { redone: label, canUndo: store.get().canUndo, canRedo: store.get().canRedo };
  },

  clear_all() {
    const list = session.changes();
    session.commit(
      "Clear all",
      list.map((c) => session.patchFor(c, null)).reverse(),
    );
    return { cleared: list.length };
  },

  list_changes() {
    return session.changes().map(view);
  },

  get_prompt() {
    return { prompt: buildPrompt(session.changes()), count: session.changes().length };
  },

  async copy_prompt() {
    const prompt = buildPrompt(session.changes());
    await copyText(prompt);
    store.set({ toast: { text: "Copied", at: Date.now() } });
    return { prompt, count: session.changes().length };
  },

  find_elements(params: { query?: string; text?: string; selector?: string; limit?: number }) {
    if (!params.query && !params.text && !params.selector) throw new CommandError("Provide query, text or selector");
    return find(params);
  },

  get_page_outline({ limit, includeSelectors }: { limit?: number; includeSelectors?: boolean }) {
    return outline(limit ?? 200, includeSelectors ?? false);
  },

  set_enabled({ enabled }: { enabled: boolean }) {
    store.set({ enabled, ...(enabled ? {} : { selectedId: null, editingId: null, noteEditingId: null }) });
    return { enabled };
  },
};

export type CommandListener = (name: string, params: unknown, result: CommandResult) => void;
const listeners = new Set<CommandListener>();

/** Run a command by name. Validates params and never throws. */
export async function executeCommand(name: string, params: unknown = {}): Promise<CommandResult> {
  const def = getDefinition(name);
  if (!def) return { ok: false, error: `Unknown command "${name}". Available: ${COMMAND_DEFINITIONS.map((d) => d.name).join(", ")}` };
  const p = params ?? {};
  const invalid = validate(p, def.parameters);
  if (invalid) return { ok: false, error: invalid };
  let result: CommandResult;
  try {
    const data = await handlers[def.name](p);
    result = { ok: true, data };
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : String(err) };
    if (!(err instanceof CommandError)) console.error(`Agent Markup: ${name} failed`, err);
  }
  for (const l of listeners) l(name, p, result);
  return result;
}

/** Observe every executed command (e.g. to log or mirror actions to an agent). */
export function onCommand(listener: CommandListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const CommandRegistry = { executeCommand, getToolDefinitions, onCommand, definitions: COMMAND_DEFINITIONS };
