// In-place text editing. The editing session is a temporary affordance: it
// restores the element exactly before handing the result to edit_text, so the
// page DOM is only ever changed by the command layer.
import { executeCommand } from "../commands";
import { textOf } from "../describe";
import { elementOf } from "../registry";
import { store } from "../store";

interface Session {
  el: HTMLElement;
  elementId: string;
  stash: Node[];
  prevEditable: string | null;
  done: boolean;
}

let current: Session | null = null;

export const editingElement = () => current?.el ?? null;

export function startEditing(elementId: string) {
  if (current) save();
  const el = elementOf(elementId);
  if (!(el instanceof HTMLElement)) return;
  const text = textOf(el);
  current = {
    el,
    elementId,
    stash: Array.from(el.childNodes),
    prevEditable: el.getAttribute("contenteditable"),
    done: false,
  };
  const nodes: Node[] = [];
  text.split("\n").forEach((line, i) => {
    if (i) nodes.push(document.createElement("br"));
    nodes.push(document.createTextNode(line));
  });
  el.replaceChildren(...nodes);
  el.setAttribute("contenteditable", "plaintext-only");
  el.addEventListener("blur", onBlur);
  el.focus({ preventScroll: true });
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  store.set({ editingId: elementId, selectedId: elementId, noteEditingId: null });
}

function onBlur() {
  // Let clicks that caused the blur (e.g. on the action bar) run first.
  setTimeout(() => current && !current.done && document.activeElement !== current.el && save(), 0);
}

function finish(): { session: Session; text: string } | null {
  const s = current;
  if (!s || s.done) return null;
  s.done = true;
  current = null;
  const text = (s.el.innerText ?? "").replace(/\r/g, "").replace(/ /g, " ").replace(/\n+$/, "");
  s.el.removeEventListener("blur", onBlur);
  if (s.prevEditable === null) s.el.removeAttribute("contenteditable");
  else s.el.setAttribute("contenteditable", s.prevEditable);
  s.el.replaceChildren(...s.stash);
  getSelection()?.removeAllRanges();
  store.set({ editingId: null });
  return { session: s, text };
}

export function save() {
  const r = finish();
  if (r) void executeCommand("edit_text", { elementId: r.session.elementId, newText: r.text });
}

export function cancel() {
  finish();
}
