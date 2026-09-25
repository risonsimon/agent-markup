// The floating changes panel: list, undo/redo, clear all, copy prompt.
import type { Change } from "../changes";
import { executeCommand } from "../commands";
import { truncate } from "../describe";
import { store, type State } from "../store";
import { h, ICONS } from "./root";

const PANEL_KEY = "ui:panel";

function detail(c: Change): (Node | string)[] {
  switch (c.type) {
    case "edit":
      return [h("s", {}, truncate(c.oldText, 90) || "(empty)"), h("span", { class: "arrow" }, "→"), truncate(c.newText, 90) || "(empty)"];
    case "remove":
      return [c.snippet ? `“${truncate(c.snippet, 90)}”` : `<${c.tag}>`];
    case "note":
      return [`“${truncate(c.note, 140)}”`];
    case "move":
      return [`“${truncate(c.snippet || c.tag, 40)}” ${c.position} “${truncate(c.targetSnippet || "sibling", 40)}”`];
  }
}

const KIND_LABEL: Record<Change["type"], string> = { edit: "Edit text", remove: "Remove", note: "Note", move: "Move" };

export function createPanel() {
  const count = h("span", { class: "count" }, "0");
  const collapseBtn = h("button", { class: "icon-btn collapse", title: "Collapse", "aria-label": "Collapse panel", html: ICONS.chevron });
  const closeBtn = h("button", { class: "icon-btn", title: "Turn off Agent Markup (Alt+Shift+R)", "aria-label": "Turn off", html: ICONS.close });
  const head = h(
    "div",
    { class: "head" },
    h("span", { class: "logo" }),
    h("span", { class: "name" }, "Agent Markup"),
    count,
    h("span", { class: "browse" }, "Browsing"),
    h("span", { class: "grow" }),
    collapseBtn,
    closeBtn,
  );
  const list = h("ol", { class: "list" });
  const undoBtn = h("button", { class: "btn", title: "Undo (⌘/Ctrl+Z)", html: ICONS.undo + "<span>Undo</span>" });
  const redoBtn = h("button", { class: "btn", title: "Redo (⌘/Ctrl+Shift+Z)", html: ICONS.redo + "<span>Redo</span>" });
  const clearBtn = h("button", { class: "btn danger" }, "Clear all");
  const copyBtn = h("button", { class: "btn primary copy" });
  const body = h(
    "div",
    { class: "body" },
    list,
    h("div", { class: "tools" }, undoBtn, redoBtn, h("span", { class: "grow" }), clearBtn),
    copyBtn,
    h("div", { class: "foot", html: "Hold <kbd>Alt</kbd> to click and scroll the page normally." }),
  );
  const panel = h("div", { class: "panel", role: "region", "aria-label": "Agent Markup changes" }, head, body);

  undoBtn.addEventListener("click", () => void executeCommand("undo"));
  redoBtn.addEventListener("click", () => void executeCommand("redo"));
  closeBtn.addEventListener("click", () => void executeCommand("set_enabled", { enabled: false }));
  collapseBtn.addEventListener("click", () => setPanel({ collapsed: !store.get().panel.collapsed }));

  let confirmTimer = 0;
  clearBtn.addEventListener("click", () => {
    if (clearBtn.classList.contains("confirm")) {
      clearTimeout(confirmTimer);
      resetClear();
      void executeCommand("clear_all");
      return;
    }
    clearBtn.classList.add("confirm");
    clearBtn.textContent = "Click to confirm";
    confirmTimer = window.setTimeout(resetClear, 3000);
  });
  const resetClear = () => {
    clearBtn.classList.remove("confirm");
    clearBtn.textContent = "Clear all";
  };

  let copyLabelTimer = 0;
  let copyLabel: string | null = null;
  copyBtn.addEventListener("click", async () => {
    const res = await executeCommand("copy_prompt");
    if (!res.ok) flashCopy(res.error ?? "Copy failed", false);
  });
  const flashCopy = (text: string, ok: boolean) => {
    copyLabel = text;
    copyBtn.classList.toggle("done", ok);
    clearTimeout(copyLabelTimer);
    copyLabelTimer = window.setTimeout(() => {
      copyLabel = null;
      copyBtn.classList.remove("done");
      render(store.get());
    }, 1600);
    render(store.get());
  };

  // Dragging the panel by its header.
  head.addEventListener("pointerdown", (e) => {
    if ((e.target as Element).closest("button") || e.button !== 0) return;
    const r = panel.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    head.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const x = Math.min(Math.max(ev.clientX - dx, 4), innerWidth - r.width - 4);
      const y = Math.min(Math.max(ev.clientY - dy, 4), innerHeight - 40);
      applyPos(x, y);
    };
    const up = (ev: PointerEvent) => {
      head.removeEventListener("pointermove", move);
      head.removeEventListener("pointerup", up);
      const pr = panel.getBoundingClientRect();
      if (Math.abs(ev.clientX - dx - r.left) > 2 || Math.abs(ev.clientY - dy - r.top) > 2) setPanel({ x: pr.left, y: pr.top });
    };
    head.addEventListener("pointermove", move);
    head.addEventListener("pointerup", up);
  });

  function applyPos(x: number | null, y: number | null) {
    if (x === null || y === null) {
      panel.style.left = panel.style.top = "";
      panel.style.right = panel.style.bottom = "";
      return;
    }
    // Keep the panel on screen after viewport resizes.
    const cx = Math.min(Math.max(x, 4), Math.max(4, innerWidth - panel.offsetWidth - 4));
    const cy = Math.min(Math.max(y, 4), Math.max(4, innerHeight - 40));
    panel.style.left = `${cx}px`;
    panel.style.top = `${cy}px`;
    panel.style.right = panel.style.bottom = "auto";
  }

  function setPanel(patch: Partial<State["panel"]>) {
    const next = { ...store.get().panel, ...patch };
    store.set({ panel: next });
    void chrome.storage.local.set({ [PANEL_KEY]: next }).catch(() => {});
  }

  let lastToast = 0;
  let lastChanges: Change[] | null = null;
  function render(s: State) {
    if (s.toast && s.toast.at !== lastToast) {
      lastToast = s.toast.at;
      flashCopy(s.toast.text, true);
      return;
    }
    const n = s.changes.length;
    count.textContent = String(n);
    panel.classList.toggle("collapsed", s.panel.collapsed);
    collapseBtn.title = s.panel.collapsed ? "Expand" : "Collapse";
    applyPos(s.panel.x, s.panel.y);
    undoBtn.disabled = !s.canUndo;
    redoBtn.disabled = !s.canRedo;
    clearBtn.disabled = n === 0;
    copyBtn.replaceChildren(h("span", { html: ICONS.copy }), copyLabel ?? `Copy prompt (${n})`);

    if (s.changes === lastChanges) return;
    lastChanges = s.changes;
    if (!n) {
      list.replaceChildren(
        h(
          "li",
          { class: "empty", html: "<b>Click any element</b> to edit its text, remove it, add a note or drag it to reorder.<br>Your changes turn into one precise prompt for your coding agent." },
        ),
      );
      return;
    }
    list.replaceChildren(
      ...s.changes.map((c, i) => {
        const x = h("button", { class: "x", title: "Revert this change", "aria-label": `Revert change ${i + 1}`, html: ICONS.close });
        x.addEventListener("click", (e) => {
          e.stopPropagation();
          void executeCommand("revert_change", { changeId: c.id });
        });
        const item = h(
          "li",
          { class: `item${c.elementId ? "" : " missing"}`, title: c.elementId ? c.selector : "Element not found on the page" },
          h("span", { class: "num" }, String(i + 1)),
          h(
            "div",
            { class: "main" },
            h("div", { class: `kind k-${c.type}` }, KIND_LABEL[c.type], h("span", { class: "where" }, `<${c.tag}>`)),
            h("div", { class: "detail" }, ...detail(c)),
          ),
          x,
        );
        item.addEventListener("click", () => {
          if (c.elementId) void executeCommand("select_element", { elementId: c.elementId, scrollIntoView: true, flash: true });
        });
        return item;
      }),
    );
  }

  async function loadPosition() {
    const saved = (await chrome.storage.local.get(PANEL_KEY).catch(() => ({} as Record<string, unknown>)))[PANEL_KEY] as State["panel"] | undefined;
    if (saved) store.set({ panel: { collapsed: !!saved.collapsed, x: saved.x ?? null, y: saved.y ?? null } });
  }

  return { el: panel, render, loadPosition };
}
