// Short, stable element IDs ("el_12") shared by humans, the UI and AI callers.
// IDs are assigned on first reference and live for the page session.

const ids = new WeakMap<Element, string>();
const refs = new Map<string, WeakRef<Element>>();
let next = 1;

export function idOf(el: Element): string {
  let id = ids.get(el);
  if (!id) {
    id = `el_${next++}`;
    ids.set(el, id);
    refs.set(id, new WeakRef(el));
  }
  return id;
}

/** The element for an ID, or null if unknown or no longer in the document. */
export function elementOf(id: string | null | undefined): Element | null {
  if (!id) return null;
  const el = refs.get(id)?.deref();
  if (!el) {
    refs.delete(id);
    return null;
  }
  return el.isConnected ? el : null;
}
