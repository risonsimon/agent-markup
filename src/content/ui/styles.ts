/* Hallmark · component: page-markup overlay (action bar · panel · note editor · page marks)
 * genre: modern-minimal · theme: custom (warm graphite + signal orange, anchor hue 60)
 * states: default · hover · focus · active · disabled · error · success
 * contrast: ink-3 ≥ 5.3:1 on every surface · accent outline 3.95:1 on white pages · accent-ink on accent 4.6:1
 */
// One accent (signal orange) marks things on the page; the UI chrome is warm
// graphite. Every colour, duration and easing is a named token.
export const CSS_TEXT = /* css */ `
:host { all: initial; }
* { box-sizing: border-box; }

.layer {
  /* Surfaces (dark, warm-tinted toward the accent) */
  --color-bg:          oklch(19.5% 0.004 60);
  --color-bg-raised:   oklch(23.5% 0.005 60);
  --color-bg-hover:    oklch(24.5% 0.005 60);
  --color-bg-active:   oklch(27.5% 0.006 60);
  --color-line:        oklch(29% 0.006 60);
  --color-line-strong: oklch(35% 0.006 60);

  /* Text */
  --color-ink:   oklch(93.5% 0.004 70);
  --color-ink-2: oklch(78% 0.006 65);
  --color-ink-3: oklch(66% 0.006 65);

  /* Accent: page marks, pins, note icon */
  --color-accent:      oklch(62% 0.2 42);
  --color-accent-text: oklch(75% 0.15 52);
  --color-accent-ink:  oklch(20% 0.02 45);
  --color-accent-wash: oklch(62% 0.2 42 / .08);
  --color-accent-wash-strong: oklch(62% 0.2 42 / .18);
  --color-mark-paper:  oklch(98.5% 0.003 70);

  /* Semantic */
  --color-danger:       oklch(68% 0.18 22);
  --color-danger-hover: oklch(73% 0.16 22);
  --color-danger-ink:   oklch(20% 0.02 25);

  /* Light primary button */
  --color-light:       oklch(93.5% 0.004 70);
  --color-light-hover: oklch(97.5% 0.003 70);
  --color-on-light:    oklch(21% 0.005 60);
  --color-count-bg:    oklch(86% 0.005 65);
  --color-count-ink:   oklch(38% 0.006 60);

  --color-drag-src:      oklch(58% 0.006 65);
  --color-drag-src-wash: oklch(58% 0.006 65 / .12);
  --color-focus: oklch(96% 0.004 70);

  --shadow-float: 0 0 0 1px oklch(10% 0.01 60 / .55), 0 1px 1px oklch(10% 0.01 60 / .15),
    0 4px 10px oklch(10% 0.01 60 / .2), 0 16px 36px oklch(10% 0.01 60 / .28);
  --shadow-mark: 0 1px 2px oklch(10% 0.01 60 / .25);
  --shadow-pin: 0 2px 6px oklch(10% 0.01 60 / .28);
  --shadow-kbd: inset 0 -1px 0 oklch(10% 0.01 60 / .35);

  --ease-out: cubic-bezier(.16, 1, .3, 1);
  --dur-micro: 120ms;
  --dur-short: 200ms;

  --font-ui: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;

  position: fixed; inset: 0; pointer-events: none;
  font: 400 13px/1.45 var(--font-ui);
  color: var(--color-ink); letter-spacing: -.003em;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  font-variant-numeric: tabular-nums;
}
button { font: inherit; color: inherit; background: none; border: 0; margin: 0; padding: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
button:focus-visible, textarea:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
svg { display: block; flex: none; }
kbd {
  display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 4px;
  font: 500 10.5px/1 var(--font-mono); color: var(--color-ink-2); background: var(--color-bg-raised); border-radius: 4px;
  box-shadow: inset 0 0 0 1px var(--color-line), var(--shadow-kbd);
}
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* ---- Page marks ---- */
.box { position: fixed; top: 0; left: 0; display: none; pointer-events: none; }
.box.show { display: block; }
.hover { box-shadow: inset 0 0 0 1px var(--color-accent); background: var(--color-accent-wash); border-radius: 1px; }
.selected { box-shadow: 0 0 0 1.5px var(--color-accent); border-radius: 1px; }
.selected.editing { box-shadow: none; outline: 1.5px dashed var(--color-accent); outline-offset: 3px; }
.selected.editing .corner { display: none; }
.corner {
  position: absolute; width: 7px; height: 7px; background: var(--color-mark-paper); border-radius: 1.5px;
  box-shadow: 0 0 0 1.5px var(--color-accent), var(--shadow-mark);
}
.corner.tl { top: -4px; left: -4px; } .corner.tr { top: -4px; right: -4px; }
.corner.bl { bottom: -4px; left: -4px; } .corner.br { bottom: -4px; right: -4px; }
.dragging-src { outline: 1.5px dashed var(--color-drag-src); outline-offset: 2px; background: var(--color-drag-src-wash); }
.flash { box-shadow: 0 0 0 2px var(--color-accent); background: var(--color-accent-wash-strong); border-radius: 2px; }
.flash.show { animation: am-flash 1s var(--ease-out) forwards; }
@keyframes am-flash { 0%, 45% { opacity: 1; } 100% { opacity: 0; } }

/* Hover label, DevTools-style */
.tag {
  position: fixed; top: 0; left: 0; display: none; align-items: center; gap: 7px; max-width: min(460px, calc(100vw - 24px)); height: 20px; padding: 0 7px;
  white-space: nowrap; overflow: hidden; font: 500 11px/1 var(--font-mono); letter-spacing: 0;
  background: var(--color-bg); color: var(--color-ink-2); border-radius: 5px; box-shadow: var(--shadow-float);
}
.tag.show { display: flex; }
.tag .t-tag { color: var(--color-accent-text); font-weight: 600; }
.tag .t-sel { overflow: hidden; text-overflow: ellipsis; color: var(--color-ink); }
.tag .t-dim { color: var(--color-ink-3); }

/* Drop indicator with end caps */
.drop-line { position: fixed; top: 0; left: 0; display: none; background: var(--color-accent); border-radius: 1px; }
.drop-line.show { display: block; }
.drop-line::before, .drop-line::after {
  content: ""; position: absolute; width: 7px; height: 7px; border-radius: 50%; background: var(--color-mark-paper); box-shadow: 0 0 0 2px var(--color-accent);
}
.drop-line::before { left: -3px; top: -3px; }
.drop-line::after { right: -3px; bottom: -3px; }

/* ---- Action bar ---- */
.bar {
  position: fixed; top: 0; left: 0; display: none; pointer-events: auto; align-items: center; gap: 1px; height: 34px; padding: 3px;
  background: var(--color-bg); border-radius: 9px; box-shadow: var(--shadow-float); white-space: nowrap;
  transform-origin: top left;
  transition: opacity var(--dur-micro) var(--ease-out), scale var(--dur-micro) var(--ease-out);
}
.bar.show { display: flex; }
@starting-style { .bar.show { opacity: 0; scale: .96; } }
.bar button {
  display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 9px; border-radius: 6px;
  color: var(--color-ink); font-weight: 500; font-size: 12.5px;
  transition: background-color var(--dur-micro) var(--ease-out), color var(--dur-micro) var(--ease-out), scale var(--dur-micro) var(--ease-out);
}
.bar button svg { color: var(--color-ink-3); transition: color var(--dur-micro) var(--ease-out); }
.bar button:active { scale: .97; background: var(--color-bg-active); }
.bar .handle { padding: 0 6px; cursor: grab; touch-action: none; }
.bar .handle:active { cursor: grabbing; }
.bar .sep { width: 1px; height: 16px; background: var(--color-line-strong); margin: 0 3px; }
.bar .hint { display: inline-flex; align-items: center; gap: 5px; padding: 0 8px; color: var(--color-ink-2); font-size: 12px; }
.bar .hint .dot { width: 3px; height: 3px; border-radius: 50%; background: var(--color-ink-3); margin: 0 4px; }

/* ---- Note pins ---- */
.pin {
  position: fixed; top: 0; left: 0; pointer-events: auto; width: 20px; height: 20px; border-radius: 10px 10px 10px 3px;
  display: flex; align-items: center; justify-content: center;
  background: var(--color-accent); color: var(--color-accent-ink); font: 700 10.5px/1 var(--font-ui);
  box-shadow: 0 0 0 2px var(--color-mark-paper), var(--shadow-pin);
}

/* ---- Note editor ---- */
.note-editor {
  position: fixed; top: 0; left: 0; display: none; pointer-events: auto; width: min(288px, calc(100vw - 16px)); padding: 10px;
  background: var(--color-bg); border-radius: 12px; box-shadow: var(--shadow-float);
  transform-origin: top left;
  transition: opacity var(--dur-short) var(--ease-out), scale var(--dur-short) var(--ease-out);
}
.note-editor.show { display: block; }
@starting-style { .note-editor.show { opacity: 0; scale: .97; } }
.note-editor .title { display: flex; align-items: baseline; gap: 6px; padding: 0 2px 8px; font-weight: 600; font-size: 12.5px; }
.note-editor .title span { font: 500 11px/1 var(--font-mono); color: var(--color-ink-3); }
.note-editor textarea {
  display: block; width: 100%; min-height: 76px; resize: vertical; padding: 8px 10px; margin: 0;
  font: inherit; font-size: 13px; line-height: 1.5; color: var(--color-ink);
  background: var(--color-bg-raised); border: 0; border-radius: 7px; box-shadow: inset 0 0 0 1px var(--color-line);
}
.note-editor textarea::placeholder { color: var(--color-ink-3); }
.note-editor textarea:focus { box-shadow: inset 0 0 0 1px var(--color-line-strong); }
.note-editor .row { display: flex; gap: 6px; align-items: center; margin-top: 10px; }
.note-editor .row .spacer { flex: 1; display: inline-flex; align-items: center; gap: 3px; color: var(--color-ink-3); font-size: 11.5px; }

/* ---- Buttons ---- */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 30px; padding: 0 11px;
  border-radius: 7px; font-weight: 500; font-size: 12.5px; color: var(--color-ink); white-space: nowrap;
  background: var(--color-bg-raised); box-shadow: inset 0 0 0 1px var(--color-line);
  transition: background-color var(--dur-micro) var(--ease-out), color var(--dur-micro) var(--ease-out), scale var(--dur-micro) var(--ease-out);
}
.btn svg { color: var(--color-ink-2); }
.btn:active:not(:disabled) { scale: .97; }
.btn.primary { background: var(--color-light); color: var(--color-on-light); box-shadow: none; }
.btn.primary svg { color: var(--color-on-light); }
.btn.quiet, .btn.danger { background: transparent; box-shadow: none; color: var(--color-ink-2); }
.btn:disabled, .btn.quiet:disabled, .btn.danger:disabled { color: var(--color-ink-3); opacity: .55; cursor: not-allowed; }
.btn:disabled svg { color: var(--color-ink-3); }

/* ---- Changes panel ---- */
.panel {
  position: fixed; right: 12px; bottom: 12px; width: min(344px, calc(100vw - 24px)); max-height: min(560px, calc(100vh - 24px));
  display: flex; flex-direction: column; overflow: hidden; pointer-events: auto;
  background: var(--color-bg); border-radius: 14px; box-shadow: var(--shadow-float);
}
.panel.collapsed { width: min(264px, calc(100vw - 24px)); }
.panel .head { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 8px 0 12px; cursor: grab; user-select: none; }
.panel .head:active { cursor: grabbing; }
.panel .body { display: flex; flex-direction: column; min-height: 0; box-shadow: inset 0 1px 0 var(--color-line); }
.panel.collapsed .body { display: none; }
.panel .logo { display: flex; border-radius: 4.5px; box-shadow: 0 0 0 1px var(--color-line-strong); }
.panel .name { font-weight: 600; font-size: 13px; letter-spacing: -.01em; white-space: nowrap; }
.panel .count {
  min-width: 20px; height: 18px; padding: 0 6px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 500; color: var(--color-ink-2); background: var(--color-bg-raised); box-shadow: inset 0 0 0 1px var(--color-line);
}
.panel .browse { display: none; align-items: center; gap: 6px; font-size: 11.5px; color: var(--color-ink-2); }
.panel .browse::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--color-accent); }
.layer.browsing .panel .browse { display: inline-flex; }
.panel .grow { flex: 1; }
.panel .icon-btn {
  position: relative; width: 28px; height: 28px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; color: var(--color-ink-3);
  transition: background-color var(--dur-micro) var(--ease-out), color var(--dur-micro) var(--ease-out);
}
.panel .icon-btn::before { content: ""; position: absolute; inset: -2px; }
.panel .collapse svg { transition: rotate var(--dur-short) var(--ease-out); }
.panel.collapsed .collapse svg { rotate: 180deg; }

.panel .list { list-style: none; margin: 0; padding: 6px; overflow-y: auto; flex: 1; min-height: 0; overscroll-behavior: contain; }
.panel .list::-webkit-scrollbar { width: 10px; }
.panel .list::-webkit-scrollbar-thumb { background: var(--color-line-strong); border-radius: 5px; border: 3px solid var(--color-bg); }
.panel .empty { padding: 12px 10px; color: var(--color-ink-2); line-height: 1.55; text-wrap: pretty; }
.panel .empty .e-title { color: var(--color-ink); font-weight: 600; }
.panel .empty .e-hint { display: flex; align-items: center; gap: 5px; margin-top: 6px; color: var(--color-ink-3); font-size: 12px; }

.undo-strip {
  display: flex; align-items: center; gap: 8px; margin: 2px 0 4px; padding: 6px 6px 6px 10px; border-radius: 8px;
  background: var(--color-bg-raised); box-shadow: inset 0 0 0 1px var(--color-line); color: var(--color-ink-2);
}
.undo-strip span { flex: 1; }
.undo-strip .btn { height: 26px; padding: 0 10px; }

.page-head {
  display: flex; align-items: center; gap: 8px; height: 26px; padding: 0 8px; margin-top: 4px;
  font: 500 11px/1 var(--font-mono); color: var(--color-ink-3); letter-spacing: 0;
}
.page-head:first-child { margin-top: 0; }
.page-head .page-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.page-head.here .page-path { color: var(--color-ink-2); }
.page-head .page-here, .item .flag {
  flex: none; font: 500 10.5px/1 var(--font-ui); color: var(--color-ink-2); letter-spacing: 0;
  padding: 3px 6px; border-radius: 5px; background: var(--color-bg-raised); box-shadow: inset 0 0 0 1px var(--color-line);
}
.item .flag { margin-left: 4px; }
.item { display: flex; gap: 10px; align-items: flex-start; padding: 8px 6px 8px 8px; border-radius: 8px; cursor: pointer; transition: background-color var(--dur-micro) var(--ease-out); }
.item.elsewhere .detail { color: var(--color-ink-2); }
.item.missing { cursor: default; }
.item.missing .detail { color: var(--color-ink-3); }
.item .num {
  flex: none; width: 20px; height: 20px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; color: var(--color-ink-2); background: var(--color-bg-raised); box-shadow: inset 0 0 0 1px var(--color-line);
}
.item .main { flex: 1; min-width: 0; }
.item .kind { display: flex; align-items: center; gap: 5px; height: 20px; font-size: 11px; font-weight: 600; color: var(--color-ink-2); letter-spacing: .01em; }
.item .k-icon { display: flex; color: var(--color-ink-3); }
.item .k-icon svg { width: 12px; height: 12px; }
.item .k-remove .k-icon { color: var(--color-danger); }
.item .k-note .k-icon { color: var(--color-accent-text); }
.item .kind .where { margin-left: 2px; font: 500 10.5px/1 var(--font-mono); color: var(--color-ink-3); letter-spacing: 0; }
.item .detail {
  color: var(--color-ink); overflow-wrap: anywhere; line-height: 1.45;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.item .detail s { color: var(--color-ink-3); text-decoration-color: var(--color-ink-3); }
.item .detail .arrow { color: var(--color-ink-3); margin: 0 5px; }
.item .x {
  position: relative; flex: none; width: 24px; height: 24px; margin: -2px -2px 0 0; border-radius: 6px;
  display: inline-flex; align-items: center; justify-content: center; color: var(--color-ink-3); opacity: 0;
  transition: opacity var(--dur-micro) var(--ease-out), background-color var(--dur-micro) var(--ease-out), color var(--dur-micro) var(--ease-out);
}
.item .x::before { content: ""; position: absolute; inset: -4px; }
.item .x:focus-visible { opacity: 1; }

.panel .tools { display: flex; align-items: center; gap: 4px; padding: 8px 8px 0; box-shadow: inset 0 1px 0 var(--color-line); }
.panel .copy { margin: 8px 8px 0; height: 36px; font-size: 13px; font-weight: 600; gap: 8px; }
.panel .copy .copy-count {
  min-width: 20px; height: 18px; padding: 0 5px; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; background: var(--color-count-bg); color: var(--color-count-ink);
}
.panel .copy-icon { display: flex; }
.panel .copy.error, .panel .copy.error svg { color: var(--color-danger-ink); }
.panel .copy.error { background: var(--color-danger); }
.panel .copy-help { display: none; padding: 6px 12px 0; color: var(--color-danger); font-size: 12px; line-height: 1.4; }
.panel .copy-help.show { display: block; }
.panel .foot { display: flex; align-items: center; gap: 5px; padding: 8px 12px 11px; color: var(--color-ink-3); font-size: 11.5px; }

/* Hover affordances only where hover exists */
@media (hover: hover) {
  .bar button:hover { background: var(--color-bg-hover); }
  .bar button:hover svg { color: var(--color-ink); }
  .bar button.danger:hover, .bar button.danger:hover svg { color: var(--color-danger); }
  .btn:hover:not(:disabled) { background: var(--color-bg-active); }
  .btn.primary:hover:not(:disabled) { background: var(--color-light-hover); }
  .btn.primary.error:hover { background: var(--color-danger-hover); }
  .btn.quiet:hover:not(:disabled), .btn.danger:hover:not(:disabled) { background: var(--color-bg-hover); color: var(--color-ink); }
  .btn.danger:hover:not(:disabled) { color: var(--color-danger); }
  .panel .icon-btn:hover { background: var(--color-bg-hover); color: var(--color-ink); }
  .item:not(.missing):hover { background: var(--color-bg-hover); }
  .item:hover .x { opacity: 1; }
  .item .x:hover { background: var(--color-bg-active); color: var(--color-danger); }
}
@media (hover: none) { .item .x { opacity: 1; } }

.layer.browsing .hover, .layer.browsing .tag { display: none !important; }
.layer.browsing .selected { opacity: .3; }

@media (prefers-reduced-motion: reduce) {
  .bar, .note-editor, .btn, .bar button, .panel .collapse svg { transition-property: opacity, background-color, color; }
  @starting-style { .bar.show, .note-editor.show { scale: 1; } }
  .btn:active:not(:disabled), .bar button:active { scale: 1; }
}
`;
