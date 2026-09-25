// Page overlay: hover outline + label, selection outline, floating action bar,
// drag-to-reorder among siblings, note pins and the note editor.
import { executeCommand } from "../commands";
import { snippet, stableSelector, truncate } from "../describe";
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
  node.style.translate = `${Math.round(r.left)}px ${Math.round(r.top)}px`;
  node.style.width = `${Math.round(r.width)}px`;
  node.style.height = `${Math.round(r.height)}px`;
}

function moveTo(node: HTMLElement, x: number, y: number) {
  node.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
}

const visibleRect = (el: Element | null) => {
  if (!el || !el.isConnected) return null;
  const r = el.getBoundingClientRect();
  return r.width || r.height ? r : null;
};

const SKIP = /^(script|style|template|link|meta|noscript)$/;
const isShown = (el: Element) => !SKIP.test(el.localName) && !isHost(el) && el.getClientRects().length > 0;

/** Visible element siblings of `el` (excluding it). */
function siblingsOf(el: Element): Element[] {
  const parent = el.parentElement;
  return parent ? Array.from(parent.children).filter((c) => c !== el && isShown(c)) : [];
}

/**
 * The element a drag should move: `el`, or — when `el` is an only child, like
 * the text inside a nav link — its nearest ancestor (a few levels up) that has
 * visible siblings. Falls back to `el` itself.
 */
export function movableUnit(el: Element): Element | null {
  if (el === document.body || el === document.documentElement) return null;
  let n: Element | null = el;
  for (let depth = 0; n && n !== document.body && depth < 6; depth++) {
    if (siblingsOf(n).length) return n;
    n = n.parentElement;
  }
  return el;
}

type Drop = { sibling: Element; position: "before" | "after"; horizontal: boolean; rect: DOMRect };

const nextShown = (n: Element) => { let s = n.nextElementSibling; while (s && !isShown(s)) s = s.nextElementSibling; return s; };
const prevShown = (n: Element) => { let s = n.previousElementSibling; while (s && !isShown(s)) s = s.previousElementSibling; return s; };

/** Before/after `target`, split along the axis its row flows in. Null if that's where `unit` already is. */
function sideOf(unit: Element, target: Element, x: number, y: number): Drop | null {
  const r = target.getBoundingClientRect();
  const row = [target, ...siblingsOf(target)].map((el) => ({ el, r: el.getBoundingClientRect() }));
  // Horizontal when the target shares a row with another item (flex rows, grids, inline runs).
  const horizontal = row.some(({ el, r: o }) => el !== target && Math.min(o.bottom, r.bottom) - Math.max(o.top, r.top) > Math.min(o.height, r.height) / 2);
  const position: "before" | "after" = horizontal ? (x < r.left + r.width / 2 ? "before" : "after") : y < r.top + r.height / 2 ? "before" : "after";
  if (position === "before" ? nextShown(unit) === target : prevShown(unit) === target) return null;
  return { sibling: target, position, horizontal, rect: r };
}

const nearestTo = (els: Element[], x: number, y: number) => {
  const dist = (r: DOMRect) => Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
  let best: Element | null = null, bestD = Infinity;
  for (const el of els) {
    const d = dist(el.getBoundingClientRect());
    if (d < bestD) (best = el), (bestD = d);
  }
  return best;
};

const hasOwnText = (el: Element) => Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.nodeValue?.trim());

/**
 * Where a drag would drop.
 * 1. Near the unit's own siblings: snap to the nearest sibling (reordering).
 * 2. Anywhere else: before/after the element under the pointer, which moves
 *    the unit into that element's container.
 */
function dropTarget(unit: Element, x: number, y: number): Drop | null {
  const siblings = siblingsOf(unit);
  if (siblings.length) {
    const group = [unit, ...siblings].map((el) => el.getBoundingClientRect());
    const m = 12;
    const inGroup =
      x >= Math.min(...group.map((r) => r.left)) - m && x <= Math.max(...group.map((r) => r.right)) + m &&
      y >= Math.min(...group.map((r) => r.top)) - m && y <= Math.max(...group.map((r) => r.bottom)) + m;
    if (inGroup) {
      const nearest = nearestTo([unit, ...siblings], x, y);
      return nearest && nearest !== unit ? sideOf(unit, nearest, x, y) : null;
    }
  }

  const root = document.body;
  const hit = document.elementsFromPoint(x, y).find((el) => !isHost(el) && !unit.contains(el) && el !== document.documentElement) ?? root;
  let target: Element | null = hit;
  // Over a container's padding or gap (or over the unit's own ancestors): use its nearest child.
  const kids = (el: Element) => Array.from(el.children).filter((c) => isShown(c) && c !== unit);
  if (hit === root || hit.contains(unit) || (!hasOwnText(hit) && kids(hit).length > 1 && !kids(hit).some((c) => {
    const r = c.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }))) {
    target = nearestTo(kids(hit), x, y);
  }
  if (!target) return null;
  // Text-level elements (a link inside a paragraph) target their block instead.
  while (target.parentElement && target.parentElement !== root && getComputedStyle(target).display === "inline") target = target.parentElement;
  // Same-box wrappers collapse to the outermost one, so the drop reads as "before this block".
  for (let p = target.parentElement; p && p !== root && !p.contains(unit); p = p.parentElement) {
    const a = target.getBoundingClientRect(), b = p.getBoundingClientRect();
    if (Math.abs(a.left - b.left) > 2 || Math.abs(a.top - b.top) > 2 || Math.abs(a.right - b.right) > 2 || Math.abs(a.bottom - b.bottom) > 2) break;
    target = p;
  }
  if (target === unit || unit.contains(target) || target === root || !target.parentElement) return null;
  return sideOf(unit, target, x, y);
}

export function createOverlay(): Overlay {
  const hoverBox = h("div", { class: "box hover" });
  const tag = h("div", { class: "tag" });
  const selectedBox = h(
    "div",
    { class: "box selected" },
    ...["tl", "tr", "bl", "br"].map((c) => h("span", { class: `corner ${c}` })),
  );
  const dragSrcBox = h("div", { class: "box dragging-src" });
  const flashBox = h("div", { class: "box flash" });
  const dropLine = h("div", { class: "drop-line" });
  const dropParent = h("div", { class: "box drop-parent" });
  const pins = h("div", { class: "pins" });

  // ---- Action bar ----
  const handle = h("button", {
    class: "handle",
    title: "Drag to reorder among siblings, or use the arrow keys",
    "aria-label": "Reorder: drag, or press the arrow keys to move before or after a sibling",
    html: ICONS.drag,
  });
  const live = h("div", { class: "sr", "aria-live": "polite" });
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
  const editHint = h("span", { class: "hint", html: "<kbd>↵</kbd> Save<span class='dot'></span><kbd>Esc</kbd> Cancel<span class='dot'></span><kbd>⇧↵</kbd> New line" });
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
  const noteText = h("textarea", { placeholder: "“Make this bigger”", "aria-label": "Note for your coding agent" });
  const noteTarget = h("span");
  const noteDelete = h("button", { class: "btn danger", onclick: () => saveNote("") }, "Delete note");
  const noteBox = h(
    "div",
    { class: "note-editor", role: "dialog", "aria-label": "Note" },
    h("div", { class: "title" }, "Note", noteTarget),
    noteText,
    h(
      "div",
      { class: "row" },
      h("span", { class: "spacer", html: `<kbd>${/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"}</kbd><kbd>↵</kbd>` }),
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

  const layer = h("div", { class: "layer" }, hoverBox, selectedBox, dragSrcBox, dropParent, flashBox, dropLine, pins, tag, bar, noteBox, live);

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
        h("span", { class: "t-tag" }, el.localName),
        sel !== el.localName ? h("span", { class: "t-sel" }, truncate(sel, 56)) : "",
        h("span", { class: "t-dim" }, `${Math.round(r.width)} × ${Math.round(r.height)}`),
      );
    }
  }

  // ---- Drag to reorder ----
  // What moves is the "unit": the selection itself, or — when the selection is
  // an only child, like an <a> inside an <li> — its nearest ancestor that has
  // visible siblings. Drop targets are found geometrically (nearest sibling to
  // the pointer), so gaps between items and overlapping page layers don't matter.
  let drag: { el: Element; id: string; pointerId: number; drop: { targetId: string; position: "before" | "after" } | null } | null = null;

  const unitOf = (el: Element | null) => (el ? movableUnit(el) : null);
  const updateHandle = () => {
    const sel = selected();
    const unit = unitOf(sel);
    handle.disabled = !unit;
    handle.setAttribute("aria-disabled", String(!unit));
    handle.title = !unit
      ? "This element can't be moved"
      : unit === sel
        ? "Drag to move anywhere on the page; arrow keys reorder among siblings"
        : `Drag to move the surrounding <${unit.localName}> anywhere; arrow keys reorder it among its siblings`;
  };
  store.subscribe((s, prev) => {
    if (s.selectedId !== prev.selectedId || s.changes !== prev.changes) updateHandle();
  });

  handle.addEventListener("pointerdown", (e) => {
    const unit = unitOf(selected());
    if (!unit || e.button !== 0) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    drag = { el: unit, id: idOf(unit), pointerId: e.pointerId, drop: null };
  });
  handle.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag.drop = null;
    dropLine.classList.remove("show");
    dropParent.classList.remove("show");
    const target = dropTarget(drag.el, e.clientX, e.clientY);
    if (!target) return;
    // Moving into another container: outline where it will land.
    const into = target.sibling.parentElement;
    if (into && into !== drag.el.parentElement && into !== document.body) {
      place(dropParent, into.getBoundingClientRect());
      dropParent.classList.add("show");
    }
    const { sibling, position, horizontal, rect: r } = target;
    drag.drop = { targetId: idOf(sibling), position };
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
    dropParent.classList.remove("show");
    dragSrcBox.classList.remove("show");
    if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    if (commit && drop) void executeCommand("move_element", { elementId: id, targetId: drop.targetId, position: drop.position });
  };
  // Keyboard reordering: arrows move the unit before the previous / after the next visible sibling.
  handle.addEventListener("keydown", (e) => {
    const back = e.key === "ArrowUp" || e.key === "ArrowLeft";
    const fwd = e.key === "ArrowDown" || e.key === "ArrowRight";
    const el = unitOf(selected());
    if ((!back && !fwd) || !el) return;
    e.preventDefault();
    const step = (n: Element | null) => (back ? n?.previousElementSibling : n?.nextElementSibling) ?? null;
    let target = step(el);
    while (target && !isShown(target)) target = step(target);
    if (!target) {
      live.textContent = back ? "Already first among its siblings." : "Already last among its siblings.";
      return;
    }
    const position = back ? "before" : "after";
    void executeCommand("move_element", { elementId: idOf(el), targetId: idOf(target), position }).then((r) => {
      live.textContent = r.ok ? `Moved ${position} “${snippet(target, 40) || target.localName}”.` : (r.error ?? "Couldn’t move.");
    });
  });
  handle.addEventListener("pointerup", () => endDrag(true));
  handle.addEventListener("pointercancel", () => endDrag(false));

  // Hovering or focusing the handle previews the element that will move.
  let handleActive = false;
  for (const [ev, on] of [["pointerenter", true], ["pointerleave", false], ["focus", true], ["blur", false]] as const)
    handle.addEventListener(ev, () => (handleActive = on));

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

    const preview = drag?.el ?? (handleActive ? unitOf(sel) : null);
    if (preview && preview !== sel) {
      const pr = visibleRect(preview);
      dragSrcBox.classList.toggle("show", !!pr);
      if (pr) place(dragSrcBox, pr);
    } else if (!drag) dragSrcBox.classList.remove("show");
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
