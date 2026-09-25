// Page event interception while Agent Markup is on. Clicks are swallowed in the
// capture phase and turned into selections, except inside our UI or while Alt
// is held ("browse" mode).
import { executeCommand } from "../commands";
import { idOf } from "../registry";
import { store } from "../store";
import { cancel, editingElement, save, startEditing } from "./inlineEdit";
import type { Overlay } from "./overlay";
import { isOurEvent } from "./root";

const BLOCKED = ["click", "dblclick", "auxclick", "mousedown", "mouseup", "pointerdown", "pointerup", "submit"] as const;

function isTypingTarget(e: Event): boolean {
  const t = e.composedPath()[0] as HTMLElement | undefined;
  if (!t || !(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t.localName === "textarea" || (t.localName === "input" && !/^(checkbox|radio|button|submit|reset|range|color|file)$/.test((t as HTMLInputElement).type));
}

/** The page element an event targets, or null for <html>/<body>. SVG parts resolve to their outermost <svg>. */
function pageTarget(e: Event): Element | null {
  if (!(e.target instanceof Element)) return null;
  let t: Element = e.target;
  if (t instanceof SVGElement) {
    let svg: SVGElement = t;
    while (svg.ownerSVGElement) svg = svg.ownerSVGElement;
    t = svg;
  }
  if (t === document.documentElement || t === document.body) return null;
  return t;
}

export function createInterceptor(overlay: Overlay) {
  let browsing = false;
  let redispatching = false;

  const setBrowsing = (on: boolean) => {
    if (on === browsing) return;
    browsing = on;
    overlay.setBrowsing(on);
    if (on) overlay.setHover(null);
  };

  function onBlocked(e: Event) {
    if (redispatching || isOurEvent(e)) return;
    const me = e as MouseEvent;
    if (me.altKey !== undefined && e.type !== "submit") setBrowsing(me.altKey);

    if (browsing) {
      // Alt+click on a link downloads it in Chrome. Re-dispatch as a plain click
      // so links and client-side routers behave like a normal click.
      if (e.type === "click" && me.altKey && e.composedPath().some((n) => n instanceof HTMLAnchorElement && n.hasAttribute("href"))) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const init: MouseEventInit = {
          bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: 0,
          clientX: me.clientX, clientY: me.clientY, screenX: me.screenX, screenY: me.screenY,
          ctrlKey: me.ctrlKey, metaKey: me.metaKey, shiftKey: me.shiftKey, altKey: false, detail: me.detail,
        };
        redispatching = true;
        try {
          (e.composedPath()[0] as Element).dispatchEvent(new MouseEvent("click", init));
        } finally {
          redispatching = false;
        }
      }
      return;
    }

    const target = pageTarget(e);
    const editing = editingElement();
    if (editing && target && editing.contains(target)) {
      // Let the caret move inside the element being edited, but keep the page's
      // handlers (and link navigation) out of it.
      if (e.type === "click" || e.type === "dblclick" || e.type === "auxclick" || e.type === "submit") e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type === "pointerdown" && editing) save();
    if (e.type === "click" && me.button === 0) {
      store.set({ noteEditingId: null });
      void executeCommand("select_element", { elementId: target ? idOf(target) : null });
    }
    // Double-click is a shortcut for "Edit text".
    if (e.type === "dblclick" && me.button === 0 && target) startEditing(idOf(target));
  }

  function onPointerMove(e: PointerEvent) {
    setBrowsing(e.altKey);
    if (browsing || overlay.isDragging() || isOurEvent(e)) {
      if (!overlay.isDragging()) overlay.setHover(null);
      return;
    }
    overlay.setHover(pageTarget(e));
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Alt") {
      setBrowsing(true);
      return;
    }
    const editing = editingElement();
    if (editing && e.composedPath().includes(editing)) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        save();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
      // Keep page shortcuts from firing while typing.
      e.stopImmediatePropagation();
      return;
    }
    if (isTypingTarget(e)) return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (mod && !e.altKey && (key === "z" || key === "y")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      void executeCommand(key === "y" || e.shiftKey ? "redo" : "undo");
      return;
    }
    if (e.key === "Escape") {
      if (overlay.isDragging()) overlay.cancelDrag();
      else if (store.get().noteEditingId) store.set({ noteEditingId: null });
      else if (store.get().selectedId) void executeCommand("select_element", { elementId: null });
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.key === "Alt") setBrowsing(false);
  }
  const onBlur = () => setBrowsing(false);
  const onLeave = () => overlay.setHover(null);

  return {
    attach() {
      for (const t of BLOCKED) window.addEventListener(t, onBlocked, true);
      window.addEventListener("pointermove", onPointerMove, { capture: true, passive: true });
      window.addEventListener("keydown", onKeyDown, true);
      window.addEventListener("keyup", onKeyUp, true);
      window.addEventListener("blur", onBlur);
      document.documentElement.addEventListener("mouseleave", onLeave);
    },
    detach() {
      for (const t of BLOCKED) window.removeEventListener(t, onBlocked, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      setBrowsing(false);
      overlay.setHover(null);
    },
  };
}
