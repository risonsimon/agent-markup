// Page overlay: hover outline + label, selection outline, floating action bar,
// drag-to-reorder among siblings, note pins and the note editor.
import { executeCommand } from "../commands";
import { stableSelector, truncate } from "../describe";
import { elementOf, idOf } from "../registry";
import { store } from "../store";
import { editingElement, startEditing } from "./inlineEdit";
import { h, ICONS, isHost } from "./root";

export interface Overlay {
  el: HTMLElement;
  setHover(el: Element | null): void;
  setBrowsing(on: boolean): void;
  isDragging(): boolean;
  cancelDrag(): void;
  frame(): void;
}

type Rect = { top: number; left: number; width: number; height: number };

function place(node: HTMLElement, r: Rect) {
  node.style.transform = `translate(${Math.round(r.left)}px, ${Math.round(r.top)}px)`;
  node.style.width = `${Math.round(r.width)}px`;
  node.style.height = `${Math.round(r.height)}px`;
}

function moveTo(node: HTMLElement, x: number, y: number) {
  node.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

const visibleRect = (el: Element | null) => {
  if (!el || !el.isConnected) return null;
  const r = el.getBoundingClientRect();
  return r.width || r.height ? r : null;
};

export function createOverlay(): Overlay {
  const hoverBox = h("div", { class: "box hover" });
  const tag = h("div", { class: "tag" });
  const selectedBox = h("div", { class: "box selected" });
  const dragSrcBox = h("div", { class: "box dragging-src" });
  const flashBox = h("div", { class: "box flash" });
  const dropLine = h("div", { class: "drop-line" });
  const pins = h("div", { class: "pins" });

  // ---- Action bar ----
  const handle = h("button", { class: "handle", title: "Drag to reorder among siblings", "aria-label": "Drag to reorder", html: ICONS.drag });
  const noteLabel = h("span", {}, "Note");
  const actions = h(
    "div",
    { class: "actions", style: "display:contents" },
    handle,
    h("span", { class: "sep" }),
    h("button", { title: "Edit text", onclick: () => onEdit(), html: ICONS.edit + "<span>Edit text</span>" }),
    h("button", { class: "danger", title: "Remove", onclick: () => onRemove(), html: ICONS.remove + "<span>Remove</span>" }),
    h("button", { title: "Note", onclick: () => onNote(), html: ICONS.note }, noteLabel),
  );
  const editHint = h("span", { class: "hint", html: "<kbd>Enter</kbd> save · <kbd>Esc</kbd> cancel · <kbd>⇧ Enter</kbd> newline" });
  const bar = h("div", { class: "bar", role: "toolbar", "aria-label": "Agent Markup actions" }, actions, editHint);

  const selected = () => elementOf(store.get().selectedId);
  const onEdit = () => {
    const id = store.get().selectedId;
    if (id) startEditing(id);
  };
  const onRemove = () => {
    const id = store.get().selectedId;
    if (id) void executeCommand("remove_element", { elementId: id });
  };
  const onNote = () => {
    const id = store.get().selectedId;
    if (id) store.set({ noteEditingId: id });
  };

  // ---- Note editor ----
  const noteText = h("textarea", { placeholder: 'e.g. "Make this bigger" or "Use our brand color"', "aria-label": "Note" });
  const noteTarget = h("span");
  const noteDelete = h("button", { class: "btn danger", onclick: () => saveNote("") }, "Delete");
  const noteBox = h(
    "div",
    { class: "note-editor", role: "dialog", "aria-label": "Note" },
    h("div", { class: "title" }, "Note", noteTarget),
    noteText,
    h(
      "div",
      { class: "row" },
      h("span", { class: "spacer" }, "⌘/Ctrl + Enter to save"),
      noteDelete,
      h("button", { class: "btn", onclick: () => store.set({ noteEditingId: null }) }, "Cancel"),
      h("button", { class: "btn primary", onclick: () => saveNote(noteText.value) }, "Save"),
    ),
  );
  const saveNote = (note: string) => {
    const id = store.get().noteEditingId;
    store.set({ noteEditingId: null });
    if (id) void executeCommand("add_note", { elementId: id, note });
  };
  noteText.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      saveNote(noteText.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      store.set({ noteEditingId: null });
    }
  });

  const layer = h("div", { class: "layer" }, hoverBox, selectedBox, dragSrcBox, flashBox, dropLine, pins, tag, bar, noteBox);

  // ---- Hover ----
  let hoverEl: Element | null = null;
  let hoverLabelFor: Element | null = null;
  function setHover(el: Element | null) {
    hoverEl = el;
    if (el && el !== hoverLabelFor) {
      hoverLabelFor = el;
      const sel = stableSelector(el);
      const r = el.getBoundingClientRect();
      tag.replaceChildren(
        h("b", {}, el.localName),
        sel !== el.localName ? h("span", {}, " " + truncate(sel, 60)) : "",
        h("span", { class: "dim" }, `  ${Math.round(r.width)}×${Math.round(r.height)}`),
      );
    }
  }

  // ---- Drag to reorder ----
  let drag: { el: Element; id: string; pointerId: number; drop: { targetId: string; position: "before" | "after" } | null } | null = null;

  handle.addEventListener("pointerdown", (e) => {
    const el = selected();
    if (!el || e.button !== 0) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    drag = { el, id: idOf(el), pointerId: e.pointerId, drop: null };
  });
  handle.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag.drop = null;
    dropLine.classList.remove("show");
    const parent = drag.el.parentElement;
    let hit = document.elementFromPoint(e.clientX, e.clientY);
    if (!parent || !hit || isHost(hit)) return;
    while (hit && hit.parentElement !== parent) hit = hit.parentElement;
    if (!hit || hit === drag.el) return;
    const r = hit.getBoundingClientRect();
    const horizontal = Array.from(parent.children).some((s) => {
      if (s === hit) return false;
      const o = s.getBoundingClientRect();
      return o.height > 0 && Math.min(o.bottom, r.bottom) - Math.max(o.top, r.top) > Math.min(o.height, r.height) / 2;
    });
    const position: "before" | "after" = horizontal
      ? e.clientX < r.left + r.width / 2 ? "before" : "after"
      : e.clientY < r.top + r.height / 2 ? "before" : "after";
    const noop = position === "before" ? drag.el.nextElementSibling === hit : drag.el.previousElementSibling === hit;
    if (noop) return;
    drag.drop = { targetId: idOf(hit), position };
    const edge = position === "before" ? 0 : 1;
    if (horizontal) place(dropLine, { left: r.left + r.width * edge - 1.5, top: r.top, width: 3, height: r.height });
    else place(dropLine, { left: r.left, top: r.top + r.height * edge - 1.5, width: r.width, height: 3 });
    dropLine.classList.add("show");
  });
  const endDrag = (commit: boolean) => {
    if (!drag) return;
    const { id, drop, pointerId } = drag;
    drag = null;
    dropLine.classList.remove("show");
    dragSrcBox.classList.remove("show");
    if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    if (commit && drop) void executeCommand("move_element", { elementId: id, targetId: drop.targetId, position: drop.position });
  };
  handle.addEventListener("pointerup", () => endDrag(true));
  handle.addEventListener("pointercancel", () => endDrag(false));

  // ---- Render loop ----
  let lastFlashAt = 0;
  // Fill and focus the note editor as soon as it opens, before the next keystroke.
  store.subscribe((s, prev) => {
    const nid = s.noteEditingId;
    if (nid === prev.noteEditingId) return;
    const nel = elementOf(nid);
    if (!nid || !nel) return;
    const existing = s.changes.find((c) => c.type === "note" && c.elementId === nid) as { note: string } | undefined;
    noteText.value = existing?.note ?? "";
    noteDelete.style.display = existing ? "" : "none";
    noteTarget.textContent = `<${nel.localName}>`;
    noteBox.classList.add("show");
    noteText.focus({ preventScroll: true });
  });
  let pinKey = "";

  function frame() {
    const s = store.get();
    const editing = editingElement();

    const hr = !drag && hoverEl !== selected() ? visibleRect(hoverEl) : null;
    hoverBox.classList.toggle("show", !!hr);
    tag.classList.toggle("show", !!hr);
    if (hr) {
      place(hoverBox, hr);
      const ty = hr.top > 24 ? hr.top - 22 : Math.min(hr.bottom + 4, innerHeight - 22);
      moveTo(tag, Math.max(4, Math.min(hr.left, innerWidth - tag.offsetWidth - 4)), ty);
    }

    const sel = selected();
    const sr = visibleRect(sel);
    selectedBox.classList.toggle("show", !!sr);
    selectedBox.classList.toggle("editing", !!editing);
    bar.classList.toggle("show", !!sr);
    actions.style.display = editing ? "none" : "contents";
    editHint.style.display = editing ? "" : "none";
    if (sr && sel) {
      place(selectedBox, sr);
      const bh = bar.offsetHeight || 34;
      const bw = bar.offsetWidth || 300;
      let y = sr.top - bh - 6;
      if (y < 6) y = sr.bottom + 6 + bh < innerHeight ? sr.bottom + 6 : Math.max(6, sr.top + 6);
      moveTo(bar, Math.max(6, Math.min(sr.left, innerWidth - bw - 6)), Math.min(y, innerHeight - bh - 6));
      const hasNote = s.changes.some((c) => c.type === "note" && c.elementId === s.selectedId);
      noteLabel.textContent = hasNote ? "Edit note" : "Note";
    }

    if (drag) {
      const dr = visibleRect(drag.el);
      dragSrcBox.classList.toggle("show", !!dr);
      if (dr) place(dragSrcBox, dr);
    }

    // Flash
    if (s.flash && s.flash.at !== lastFlashAt) {
      lastFlashAt = s.flash.at;
      flashBox.classList.remove("show");
      void flashBox.offsetWidth; // restart animation
      flashBox.classList.add("show");
      flashBox.dataset.id = s.flash.elementId;
    }
    if (flashBox.classList.contains("show")) {
      const fr = visibleRect(elementOf(flashBox.dataset.id));
      if (fr && Date.now() - lastFlashAt < 1000) place(flashBox, fr);
      else flashBox.classList.remove("show");
    }

    // Note pins, numbered by position in the change list.
    const notes = s.changes.map((c, i) => ({ c, n: i + 1 })).filter(({ c }) => c.type === "note" && c.elementId);
    const key = notes.map(({ c, n }) => `${c.id}:${n}`).join(",");
    if (key !== pinKey) {
      pinKey = key;
      pins.replaceChildren(
        ...notes.map(({ c, n }) =>
          h(
            "button",
            {
              class: "pin",
              title: (c as { note: string }).note,
              "data-el": c.elementId,
              onclick: () => {
                void executeCommand("select_element", { elementId: c.elementId });
                store.set({ noteEditingId: c.elementId });
              },
            },
            String(n),
          ),
        ),
      );
    }
    for (const pin of Array.from(pins.children) as HTMLElement[]) {
      const pr = visibleRect(elementOf(pin.dataset.el));
      pin.style.display = pr ? "" : "none";
      if (pr) moveTo(pin, Math.min(Math.max(pr.right - 12, 2), innerWidth - 22), Math.max(pr.top - 10, 2));
    }

    // Note editor
    const nid = s.noteEditingId;
    const nel = elementOf(nid);
    const nr = visibleRect(nel);
    noteBox.classList.toggle("show", !!nr);
    if (nr) {
      const w = 280, hh = noteBox.offsetHeight || 170;
      let y = nr.bottom + 8;
      if (y + hh > innerHeight - 8) y = Math.max(8, nr.top - hh - 8 - (sr ? 40 : 0));
      moveTo(noteBox, Math.max(8, Math.min(nr.left, innerWidth - w - 8)), Math.min(y, innerHeight - hh - 8));
    }
  }

  return {
    el: layer,
    setHover,
    setBrowsing: (on) => layer.classList.toggle("browsing", on),
    isDragging: () => !!drag,
    cancelDrag: () => endDrag(false),
    frame,
  };
}
