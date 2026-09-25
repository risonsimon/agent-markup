// The Shadow DOM host. Page CSS can't reach inside, and our CSS can't leak out.
import { CSS_TEXT } from "./styles";

declare const __SHADOW_MODE__: ShadowRootMode;

let host: HTMLElement | null = null;
let root: ShadowRoot | null = null;

export const HOST_TAG = "agent-markup-root";

export function ensureRoot(): ShadowRoot {
  if (root && host) return root;
  host = document.createElement(HOST_TAG);
  host.setAttribute(
    "style",
    "all: initial !important; position: fixed !important; inset: 0 !important; z-index: 2147483647 !important; pointer-events: none !important; display: block !important; contain: layout style !important;",
  );
  root = host.attachShadow({ mode: __SHADOW_MODE__ });
  const style = document.createElement("style");
  style.textContent = CSS_TEXT;
  root.appendChild(style);
  // Keep our UI's events from reaching the page's own bubble-phase handlers.
  for (const type of ["click", "dblclick", "mousedown", "mouseup", "pointerdown", "pointerup", "keydown", "keyup", "keypress", "input", "wheel", "focusin", "focusout", "contextmenu"]) {
    host.addEventListener(type, (e) => e.stopPropagation());
  }
  return root;
}

export function mountHost() {
  ensureRoot();
  if (!host!.isConnected) document.documentElement.appendChild(host!);
}

export function unmountHost() {
  host?.remove();
}

export const shadow = () => root;

/** True if the event originated inside Agent Markup's UI. */
export function isOurEvent(e: Event): boolean {
  return !!host && e.composedPath().includes(host);
}

export function isHost(el: Element | null): boolean {
  return !!el && el === host;
}

/** Tiny element builder. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = String(v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === "html") el.innerHTML = String(v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export const ICONS = {
  mark: '<svg viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" rx="4.5" fill="#1d1d20"/><path d="M5 3.8v8l2.1-2 1.5 3 1.2-.6-1.5-2.9h2.9z" fill="#f2f2f2"/><circle cx="11.6" cy="4.6" r="1.5" fill="var(--accent)"/></svg>',
  check: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3.5 8.5 3 3 6-7"/></svg>',
  move: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2.5v11M2.5 11 5 13.5 7.5 11M11 13.5v-11M8.5 5 11 2.5 13.5 5"/></svg>',
  drag: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><circle cx="5.5" cy="3.5" r="1.3"/><circle cx="10.5" cy="3.5" r="1.3"/><circle cx="5.5" cy="8" r="1.3"/><circle cx="10.5" cy="8" r="1.3"/><circle cx="5.5" cy="12.5" r="1.3"/><circle cx="10.5" cy="12.5" r="1.3"/></svg>',
  edit: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h10M8 4v9M5.5 13h5"/></svg>',
  remove: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.7 8.5h6.6l.7-8.5"/></svg>',
  note: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3 2.5h10v8l-3 3H3z"/><path d="M10 13.5v-3h3"/></svg>',
  undo: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 3 2.5 6l3 3"/><path d="M2.5 6H10a3.5 3.5 0 0 1 0 7H7"/></svg>',
  redo: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 3l3 3-3 3"/><path d="M13.5 6H6a3.5 3.5 0 0 0 0 7h3"/></svg>',
  chevron: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 4 4 4-4"/></svg>',
  close: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m4 4 8 8M12 4l-8 8"/></svg>',
  copy: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="5" y="5" width="8.5" height="8.5" rx="1.5"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/></svg>',
};
