export const CSS_TEXT = /* css */ `
:host { all: initial; }
* { box-sizing: border-box; }
.layer {
  position: fixed; inset: 0; pointer-events: none;
  font: 12px/1.4 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #e7e5ee; -webkit-font-smoothing: antialiased; letter-spacing: 0;
  --accent: #8b5cf6; --accent-strong: #7c3aed; --bg: #17151c; --bg-2: #211e28; --line: #2f2b38; --muted: #9a95a8;
  --danger: #f06a6a; --ok: #4ade80;
}
button { font: inherit; color: inherit; background: none; border: 0; margin: 0; padding: 0; cursor: pointer; }
button:focus-visible, textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
svg { display: block; flex: none; }

/* Outlines */
.box { position: fixed; top: 0; left: 0; display: none; border-radius: 2px; pointer-events: none; }
.box.show { display: block; }
.hover { outline: 1.5px solid var(--accent); background: rgba(139, 92, 246, .08); }
.selected { outline: 2px solid var(--accent-strong); box-shadow: 0 0 0 4px rgba(124, 58, 237, .18); }
.selected.editing { outline-style: dashed; background: rgba(139, 92, 246, .05); }
.dragging-src { outline: 2px dashed var(--muted); background: rgba(154, 149, 168, .12); }
.flash { outline: 2px solid #facc15; background: rgba(250, 204, 21, .25); }
.flash.show { animation: am-flash .9s ease-out forwards; }
@keyframes am-flash { 0% { opacity: 1; } 60% { opacity: 1; } 100% { opacity: 0; } }

.tag {
  position: fixed; top: 0; left: 0; display: none; max-width: 420px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  background: var(--accent-strong); color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; box-shadow: 0 2px 6px rgba(0,0,0,.25);
}
.tag.show { display: block; }
.tag b { font-weight: 600; }
.tag .dim { opacity: .75; }

.drop-line { position: fixed; top: 0; left: 0; display: none; background: var(--accent); border-radius: 2px; box-shadow: 0 0 0 1px #fff, 0 0 8px rgba(139,92,246,.8); }
.drop-line.show { display: block; }

/* Action bar */
.bar {
  position: fixed; top: 0; left: 0; display: none; pointer-events: auto; align-items: center; gap: 2px;
  background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 3px;
  box-shadow: 0 6px 20px rgba(0,0,0,.35), 0 1px 2px rgba(0,0,0,.3); white-space: nowrap;
}
.bar.show { display: flex; }
.bar button { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 8px; border-radius: 5px; color: #e7e5ee; }
.bar button:hover { background: var(--bg-2); }
.bar button.danger:hover { color: var(--danger); }
.bar .handle { cursor: grab; padding: 0 5px; color: var(--muted); touch-action: none; }
.bar .handle:active { cursor: grabbing; }
.bar .sep { width: 1px; height: 16px; background: var(--line); margin: 0 2px; }
.bar .hint { padding: 0 8px; color: var(--muted); }
.bar .hint kbd { font: 10.5px ui-monospace, Menlo, monospace; padding: 1px 4px; border: 1px solid var(--line); border-radius: 3px; color: #e7e5ee; }

/* Note pins */
.pin {
  position: fixed; top: 0; left: 0; pointer-events: auto; width: 20px; height: 20px; border-radius: 10px 10px 10px 2px;
  background: #f59e0b; color: #1c1917; font-weight: 700; font-size: 11px; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 6px rgba(0,0,0,.35), 0 0 0 1.5px #fff;
}
.pin:hover { transform: scale(1.1); }

/* Note editor */
.note-editor {
  position: fixed; top: 0; left: 0; display: none; pointer-events: auto; width: 280px;
  background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 10px;
  box-shadow: 0 10px 30px rgba(0,0,0,.4);
}
.note-editor.show { display: block; }
.note-editor .title { font-weight: 600; margin-bottom: 6px; display: flex; justify-content: space-between; }
.note-editor .title span { color: var(--muted); font-weight: 400; }
.note-editor textarea {
  width: 100%; min-height: 72px; resize: vertical; background: var(--bg-2); color: #f4f3f7; border: 1px solid var(--line);
  border-radius: 6px; padding: 7px 8px; font: inherit; font-size: 12.5px; outline: none;
}
.note-editor textarea:focus { border-color: var(--accent); }
.note-editor .row { display: flex; gap: 6px; justify-content: flex-end; margin-top: 8px; align-items: center; }
.note-editor .row .spacer { flex: 1; color: var(--muted); font-size: 11px; }

.btn { height: 28px; padding: 0 10px; border-radius: 6px; background: var(--bg-2); border: 1px solid var(--line); display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.btn:hover:not(:disabled) { background: #2b2734; }
.btn:disabled { opacity: .4; cursor: default; }
.btn.primary { background: var(--accent-strong); border-color: var(--accent-strong); color: #fff; font-weight: 600; }
.btn.primary:hover:not(:disabled) { background: #6d28d9; }
.btn.danger { color: var(--danger); }
.btn.confirm { background: var(--danger); border-color: var(--danger); color: #fff; }
.btn.done { background: #16a34a; border-color: #16a34a; }

/* Changes panel */
.panel {
  position: fixed; right: 16px; bottom: 16px; width: 340px; max-height: min(560px, calc(100vh - 32px)); display: flex; flex-direction: column;
  pointer-events: auto; background: var(--bg); border: 1px solid var(--line); border-radius: 12px;
  box-shadow: 0 16px 40px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.3); overflow: hidden;
}
.panel.collapsed { width: 250px; }
.panel .head { display: flex; align-items: center; gap: 8px; padding: 9px 8px 9px 12px; cursor: grab; user-select: none; border-bottom: 1px solid var(--line); }
.panel.collapsed .head { border-bottom: 0; }
.panel .head:active { cursor: grabbing; }
.panel .logo { width: 16px; height: 16px; border-radius: 5px; background: linear-gradient(135deg, #a78bfa, #7c3aed); flex: none; }
.panel .name { font-weight: 650; font-size: 12.5px; color: #fff; }
.panel .count { background: var(--bg-2); border: 1px solid var(--line); color: var(--muted); border-radius: 9px; padding: 0 6px; font-size: 11px; }
.panel .browse { color: #facc15; font-size: 11px; display: none; }
.layer.browsing .panel .browse { display: inline; }
.panel .head .grow { flex: 1; }
.panel .icon-btn { width: 24px; height: 24px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; color: var(--muted); }
.panel .icon-btn:hover { background: var(--bg-2); color: #fff; }
.panel.collapsed .collapse svg { transform: rotate(180deg); }
.panel .body { display: flex; flex-direction: column; min-height: 0; }
.panel.collapsed .body { display: none; }
.panel .list { list-style: none; margin: 0; padding: 4px; overflow-y: auto; flex: 1; min-height: 0; }
.panel .empty { padding: 16px 14px; color: var(--muted); line-height: 1.55; }
.panel .empty b { color: #e7e5ee; font-weight: 600; }
.item { display: flex; gap: 8px; align-items: flex-start; padding: 7px 6px 7px 8px; border-radius: 7px; cursor: pointer; }
.item:hover { background: var(--bg-2); }
.item.missing { opacity: .55; cursor: default; }
.item .num { flex: none; width: 18px; height: 18px; border-radius: 9px; background: var(--bg-2); border: 1px solid var(--line); font-size: 10.5px; font-weight: 600; display: flex; align-items: center; justify-content: center; color: var(--muted); margin-top: 1px; }
.item .main { flex: 1; min-width: 0; }
.item .kind { font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.item .kind.k-edit { color: #60a5fa; } .item .kind.k-remove { color: var(--danger); } .item .kind.k-note { color: #f59e0b; } .item .kind.k-move { color: #34d399; }
.item .kind .where { color: var(--muted); font-weight: 500; letter-spacing: 0; text-transform: none; font-family: ui-monospace, Menlo, monospace; font-size: 10.5px; margin-left: 4px; }
.item .detail { color: #d6d3de; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin-top: 1px; }
.item .detail s { color: var(--muted); }
.item .detail .arrow { color: var(--muted); margin: 0 3px; }
.item .x { flex: none; width: 20px; height: 20px; border-radius: 5px; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; opacity: 0; }
.item:hover .x, .item .x:focus-visible { opacity: 1; }
.item .x:hover { background: #2f2b38; color: var(--danger); }
.panel .tools { display: flex; gap: 6px; padding: 8px; border-top: 1px solid var(--line); }
.panel .tools .grow { flex: 1; }
.panel .copy { margin: 0 8px 8px; height: 34px; font-size: 12.5px; }
.panel .foot { padding: 0 12px 9px; color: var(--muted); font-size: 11px; }
.panel kbd { font: 10.5px ui-monospace, Menlo, monospace; padding: 0 4px; border: 1px solid var(--line); border-radius: 3px; color: #d6d3de; }

.layer.browsing .hover, .layer.browsing .tag { display: none !important; }
.layer.browsing .selected { opacity: .35; }

@media (prefers-reduced-motion: reduce) { .flash.show { animation-duration: 1.2s; } .pin:hover { transform: none; } }
`;
