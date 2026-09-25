// Mounts the UI when Agent Markup is enabled and keeps it in sync with the store.
import { store } from "../store";
import { cancel } from "./inlineEdit";
import { createInterceptor } from "./interceptor";
import { createOverlay } from "./overlay";
import { createPanel } from "./panel";
import { ensureRoot, mountHost, unmountHost } from "./root";

export function createUI() {
  const root = ensureRoot();
  const overlay = createOverlay();
  const panel = createPanel();
  overlay.el.append(panel.el);
  root.append(overlay.el);
  const interceptor = createInterceptor(overlay);
  void panel.loadPosition();

  let raf = 0;
  const loop = () => {
    overlay.frame();
    raf = requestAnimationFrame(loop);
  };

  function mount() {
    mountHost();
    interceptor.attach();
    panel.render(store.get());
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function unmount() {
    cancel();
    overlay.cancelDrag();
    interceptor.detach();
    cancelAnimationFrame(raf);
    unmountHost();
  }

  store.subscribe((s, prev) => {
    if (s.enabled !== prev.enabled) (s.enabled ? mount : unmount)();
    if (s.enabled) panel.render(s);
  });
}
