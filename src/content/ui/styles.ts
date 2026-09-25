// One accent (signal orange) marks things on the page; the UI chrome is neutral
// graphite. Borders are alpha box-shadows, focus rings are white, motion is
// short ease-out on transform/opacity only.
export const CSS_TEXT = /* css */ `
:host { all: initial; }
* { box-sizing: border-box; }

.layer {
  --accent: #ff6a1f;
  --accent-text: #ff8a4c;
  --accent-soft: rgba(255, 106, 31, .07);
  --danger: #ff6369;

  --bg: #18181a;
  --bg-raised: #212124;
  --bg-hover: rgba(255, 255, 255, .055);
  --bg-active: rgba(255, 255, 255, .08);
  --line: rgba(255, 255, 255, .08);
  --line-strong: rgba(255, 255, 255, .13);
  --text: #ededee;
  --text-2: #b4b4b9;
  --text-3: #7c7c82;

  --shadow-float: 0 0 0 1px rgba(0,0,0,.55), 0 1px 1px rgba(0,0,0,.15), 0 4px 10px rgba(0,0,0,.2), 0 16px 36px rgba(0,0,0,.28);
  --ease-out: cubic-bezier(.23, 1, .32, 1);
  --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;

  position: fixed; inset: 0; pointer-events: none;
  font: 400 13px/1.45 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  color: var(--text); letter-spacing: -.003em;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  font-variant-numeric: tabular-nums;
}
button { font: inherit; color: inherit; background: none; border: 0; margin: 0; padding: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
button:focus-visible, textarea:focus-visible { outline: 2px solid rgba(255, 255, 255, .75); outline-offset: 1px; }
svg { display: block; flex: none; }
kbd {
  display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 4px;
  font: 500 10.5px/1 var(--mono); color: var(--text-2); background: var(--bg-raised); border-radius: 4px;
  box-shadow: inset 0 0 0 1px var(--line), inset 0 -1px 0 rgba(0,0,0,.35);
}

/* ---- Page marks ---- */
.box { position: fixed; top: 0; left: 0; display: none; pointer-events: none; }
.box.show { display: block; }
.hover { box-shadow: inset 0 0 0 1px var(--accent); background: var(--accent-soft); border-radius: 1px; }
.selected { box-shadow: 0 0 0 1.5px var(--accent); border-radius: 1px; }
.selected.editing { box-shadow: none; outline: 1.5px dashed var(--accent); outline-offset: 3px; }
.selected.editing .corner { display: none; }
.corner {
  position: absolute; width: 7px; height: 7px; background: #fff; border-radius: 1.5px;
  box-shadow: 0 0 0 1.5px var(--accent), 0 1px 2px rgba(0,0,0,.25);
}
.corner.tl { top: -4px; left: -4px; } .corner.tr { top: -4px; right: -4px; }
.corner.bl { bottom: -4px; left: -4px; } .corner.br { bottom: -4px; right: -4px; }
.dragging-src { outline: 1.5px dashed rgba(120, 120, 128, .9); outline-offset: 2px; background: rgba(120, 120, 128, .1); }
.flash { box-shadow: 0 0 0 2px var(--accent); background: rgba(255, 106, 31, .16); border-radius: 2px; }
.flash.show { animation: am-flash 1s var(--ease-out) forwards; }
@keyframes am-flash { 0%, 45% { opacity: 1; } 100% { opacity: 0; } }

/* Hover label, DevTools-style */
.tag {
  position: fixed; top: 0; left: 0; display: none; align-items: center; gap: 7px; max-width: 460px; height: 20px; padding: 0 7px;
  white-space: nowrap; overflow: hidden; font: 500 11px/1 var(--mono); letter-spacing: 0;
  background: var(--bg); color: var(--text-2); border-radius: 5px; box-shadow: var(--shadow-float);
}
.tag.show { display: flex; }
.tag .t-tag { color: var(--accent-text); font-weight: 600; }
.tag .t-sel { overflow: hidden; text-overflow: ellipsis; color: var(--text); }
.tag .t-dim { color: var(--text-3); }

/* Drop indicator with end caps */
.drop-line { position: fixed; top: 0; left: 0; display: none; background: var(--accent); border-radius: 1px; }
.drop-line.show { display: block; }
.drop-line::before, .drop-line::after {
  content: ""; position: absolute; width: 7px; height: 7px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 2px var(--accent);
}
.drop-line::before { left: -3px; top: -3px; }
.drop-line::after { right: -3px; bottom: -3px; }

/* ---- Action bar ---- */
.bar {
  position: fixed; top: 0; left: 0; display: none; pointer-events: auto; align-items: center; gap: 1px; height: 34px; padding: 3px;
  background: var(--bg); border-radius: 9px; box-shadow: var(--shadow-float); white-space: nowrap;
  transform-origin: top left;
  transition: opacity 140ms var(--ease-out), scale 140ms var(--ease-out);
}
.bar.show { display: flex; }
@starting-style { .bar.show { opacity: 0; scale: .96; } }
.bar button {
  display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 9px; border-radius: 6px;
  color: var(--text); font-weight: 500; font-size: 12.5px;
  transition: background-color 120ms ease, color 120ms ease, scale 120ms var(--ease-out);
}
.bar button svg { color: var(--text-3); transition: color 120ms ease; }
.bar button:active { scale: .97; background: var(--bg-active); }
.bar .handle { padding: 0 6px; cursor: grab; touch-action: none; }
.bar .handle:active { cursor: grabbing; }
.bar .sep { width: 1px; height: 16px; background: var(--line-strong); margin: 0 3px; }
.bar .hint { display: inline-flex; align-items: center; gap: 5px; padding: 0 8px; color: var(--text-2); font-size: 12px; }
.bar .hint .dot { width: 3px; height: 3px; border-radius: 50%; background: var(--text-3); margin: 0 4px; }

/* ---- Note pins ---- */
.pin {
  position: fixed; top: 0; left: 0; pointer-events: auto; width: 20px; height: 20px; border-radius: 10px 10px 10px 3px;
  display: flex; align-items: center; justify-content: center;
  background: var(--accent); color: #fff; font: 650 10.5px/1 ui-sans-serif, -apple-system, system-ui, sans-serif;
  box-shadow: 0 0 0 2px #fff, 0 2px 6px rgba(0,0,0,.28);
  transition: scale 150ms var(--ease-out);
}
@starting-style { .pin { scale: .5; } }
.pin:active { scale: .92; }

/* ---- Note editor ---- */
.note-editor {
  position: fixed; top: 0; left: 0; display: none; pointer-events: auto; width: 288px; padding: 10px;
  background: var(--bg); border-radius: 12px; box-shadow: var(--shadow-float);
  transform-origin: top left;
  transition: opacity 160ms var(--ease-out), scale 160ms var(--ease-out);
}
.note-editor.show { display: block; }
@starting-style { .note-editor.show { opacity: 0; scale: .97; } }
.note-editor .title { display: flex; align-items: baseline; gap: 6px; padding: 0 2px 8px; font-weight: 600; font-size: 12.5px; }
.note-editor .title span { font: 500 11px/1 var(--mono); color: var(--text-3); }
.note-editor textarea {
  display: block; width: 100%; min-height: 76px; resize: vertical; padding: 8px 10px; margin: 0;
  font: inherit; font-size: 13px; line-height: 1.5; color: var(--text);
  background: var(--bg-raised); border: 0; border-radius: 7px; outline: none; box-shadow: inset 0 0 0 1px var(--line);
  transition: box-shadow 120ms ease;
}
.note-editor textarea::placeholder { color: var(--text-3); }
.note-editor textarea:focus { box-shadow: inset 0 0 0 1px var(--line-strong), 0 0 0 3px rgba(255,255,255,.06); outline: none; }
.note-editor .row { display: flex; gap: 6px; align-items: center; margin-top: 10px; }
.note-editor .row .spacer { flex: 1; display: inline-flex; align-items: center; gap: 3px; color: var(--text-3); font-size: 11.5px; }

/* ---- Buttons ---- */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 30px; padding: 0 11px;
  border-radius: 7px; font-weight: 500; font-size: 12.5px; color: var(--text);
  background: var(--bg-raised); box-shadow: inset 0 0 0 1px var(--line);
  transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease, scale 120ms var(--ease-out);
}
.btn svg { color: var(--text-2); }
.btn:active:not(:disabled) { scale: .97; }
.btn.primary { background: #ededee; color: #18181a; box-shadow: none; }
.btn.primary svg { color: #18181a; }
.btn.quiet { background: transparent; box-shadow: none; color: var(--text-2); }
.btn.danger { background: transparent; box-shadow: none; color: var(--text-2); }
.btn.confirm { background: var(--danger); color: #fff; box-shadow: none; }
.btn:disabled, .btn.quiet:disabled, .btn.danger:disabled { color: var(--text-3); opacity: .55; cursor: default; }
.btn:disabled svg { color: var(--text-3); }

/* ---- Changes panel ---- */
.panel {
  position: fixed; right: 16px; bottom: 16px; width: 344px; max-height: min(560px, calc(100vh - 32px));
  display: flex; flex-direction: column; overflow: hidden; pointer-events: auto;
  background: var(--bg); border-radius: 14px; box-shadow: var(--shadow-float);
  transition: opacity 200ms var(--ease-out), scale 200ms var(--ease-out);
  transform-origin: bottom right;
}
@starting-style { .panel { opacity: 0; scale: .97; } }
.panel.collapsed { width: 264px; }
.panel .head { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 8px 0 12px; cursor: grab; user-select: none; }
.panel .head:active { cursor: grabbing; }
.panel .body { display: flex; flex-direction: column; min-height: 0; box-shadow: inset 0 1px 0 var(--line); }
.panel.collapsed .body { display: none; }
.panel .logo { display: flex; border-radius: 4.5px; box-shadow: 0 0 0 1px var(--line-strong); }
.panel .name { font-weight: 600; font-size: 13px; letter-spacing: -.01em; }
.panel .count {
  min-width: 20px; height: 18px; padding: 0 6px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 500; color: var(--text-2); background: var(--bg-raised); box-shadow: inset 0 0 0 1px var(--line);
}
.panel .browse { display: none; align-items: center; gap: 6px; font-size: 11.5px; color: var(--text-2); }
.panel .browse::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #3dd68c; box-shadow: 0 0 0 3px rgba(61,214,140,.18); }
.layer.browsing .panel .browse { display: inline-flex; }
.panel .grow { flex: 1; }
.panel .icon-btn {
  width: 28px; height: 28px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; color: var(--text-3);
  transition: background-color 120ms ease, color 120ms ease;
}
.panel .collapse svg { transition: rotate 200ms var(--ease-out); }
.panel.collapsed .collapse svg { rotate: 180deg; }

.panel .list { list-style: none; margin: 0; padding: 6px; overflow-y: auto; flex: 1; min-height: 0; overscroll-behavior: contain; }
.panel .list::-webkit-scrollbar { width: 10px; }
.panel .list::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 5px; border: 3px solid var(--bg); }
.panel .empty { padding: 14px 10px 12px; color: var(--text-2); line-height: 1.55; text-wrap: pretty; }
.panel .empty b { color: var(--text); font-weight: 600; }

.page-head {
  display: flex; align-items: center; gap: 8px; height: 26px; padding: 0 8px; margin-top: 4px;
  font: 500 11px/1 var(--mono); color: var(--text-3); letter-spacing: 0;
}
.page-head:first-child { margin-top: 0; }
.page-head .page-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.page-head.here .page-path { color: var(--text-2); }
.page-head .page-here {
  flex: none; font: 500 10.5px/1 ui-sans-serif, -apple-system, system-ui, sans-serif; color: var(--text-2);
  padding: 3px 6px; border-radius: 5px; background: var(--bg-raised); box-shadow: inset 0 0 0 1px var(--line);
}
.item.elsewhere .detail { color: var(--text-2); }
.item { display: flex; gap: 10px; align-items: flex-start; padding: 8px 6px 8px 8px; border-radius: 8px; cursor: pointer; transition: background-color 120ms ease; }
.item.missing { cursor: default; }
.item.missing .detail { color: var(--text-3); }
.item .num {
  flex: none; width: 20px; height: 20px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; color: var(--text-2); background: var(--bg-raised); box-shadow: inset 0 0 0 1px var(--line);
}
.item .main { flex: 1; min-width: 0; }
.item .kind { display: flex; align-items: center; gap: 5px; height: 20px; font-size: 11px; font-weight: 600; color: var(--text-2); letter-spacing: .01em; }
.item .k-icon { display: flex; color: var(--text-3); }
.item .k-icon svg { width: 12px; height: 12px; }
.item .k-remove .k-icon { color: var(--danger); }
.item .k-note .k-icon { color: var(--accent-text); }
.item .kind .where { margin-left: 2px; font: 500 10.5px/1 var(--mono); color: var(--text-3); letter-spacing: 0; }
.item .detail {
  color: var(--text); overflow-wrap: anywhere; line-height: 1.45;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.item .detail s { color: var(--text-3); text-decoration-color: rgba(255,255,255,.35); }
.item .detail .arrow { color: var(--text-3); margin: 0 5px; }
.item .x {
  flex: none; width: 24px; height: 24px; margin: -2px -2px 0 0; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center;
  color: var(--text-3); opacity: 0; transition: opacity 120ms ease, background-color 120ms ease, color 120ms ease;
}
.item .x:focus-visible { opacity: 1; }

.panel .tools { display: flex; align-items: center; gap: 4px; padding: 8px 8px 0; box-shadow: inset 0 1px 0 var(--line); }
.panel .copy { margin: 8px; height: 36px; font-size: 13px; font-weight: 600; gap: 8px; }
.panel .copy .copy-count {
  min-width: 20px; height: 18px; padding: 0 5px; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; background: rgba(0,0,0,.08); color: #3f3f45;
}
.panel .copy-icon { display: flex; }
.panel .foot { display: flex; align-items: center; gap: 5px; padding: 0 12px 11px; color: var(--text-3); font-size: 11.5px; }

/* Hover affordances only where hover exists */
@media (hover: hover) {
  .bar button:hover { background: var(--bg-hover); }
  .bar button:hover svg { color: var(--text); }
  .bar button.danger:hover, .bar button.danger:hover svg { color: var(--danger); }
  .btn:hover:not(:disabled) { background: #2a2a2e; }
  .btn.primary:hover:not(:disabled) { background: #ffffff; }
  .btn.quiet:hover:not(:disabled), .btn.danger:hover:not(:disabled) { background: var(--bg-hover); color: var(--text); }
  .btn.danger:hover:not(:disabled) { color: var(--danger); }
  .btn.confirm:hover { background: #ff7a7f; color: #fff; }
  .panel .icon-btn:hover { background: var(--bg-hover); color: var(--text); }
  .item:not(.missing):hover { background: var(--bg-hover); }
  .item:hover .x { opacity: 1; }
  .item .x:hover { background: var(--bg-active); color: var(--danger); }
  .pin:hover { scale: 1.08; }
}
@media (hover: none) { .item .x { opacity: 1; } }

.layer.browsing .hover, .layer.browsing .tag { display: none !important; }
.layer.browsing .selected { opacity: .3; }

@media (prefers-reduced-motion: reduce) {
  .bar, .note-editor, .panel, .pin, .btn, .bar button, .panel .collapse svg { transition-property: opacity, background-color, color, box-shadow; }
  @starting-style { .bar.show, .note-editor.show, .panel { scale: 1; } .pin { scale: 1; } }
  .pin:hover, .pin:active, .btn:active:not(:disabled), .bar button:active { scale: 1; }
}
`;
