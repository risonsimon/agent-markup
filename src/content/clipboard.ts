import { shadow } from "./ui/root";

/** Copies text, falling back to execCommand when the async Clipboard API is unavailable (no focus/gesture). */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Fall through.
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
  const container = shadow() ?? document.body;
  container.appendChild(ta);
  const active = document.activeElement as HTMLElement | null;
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  active?.focus?.({ preventScroll: true });
  if (!ok) throw new Error("Clipboard is not available on this page");
}
