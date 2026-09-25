// Describes elements for prompts and AI callers: stable CSS selectors, section
// hints, text snippets and truncated context HTML.

const TEST_ATTRS = ["data-testid", "data-test-id", "data-test", "data-cy", "data-qa"];
const IGNORED_DATA = /^data-(v-|reactid|react|radix|headlessui|state|orientation|side|align|aria|rk|framer|sentry|gtm|ga|analytics|track|ved|hveid|view-component|turbo|n-|nimg|nextjs|styled|emotion|agent-markup)/;

/** True for IDs and classes that look generated and won't appear verbatim in source. */
function looksGenerated(token: string): boolean {
  if (token.length < 2 || token.length > 40) return true;
  if (/^(css|sc|jsx|emotion|svelte|astro|chakra|mui|Mui[A-Z]\w*-)-?[a-z0-9]{0,4}[-_]?[a-zA-Z0-9]{4,}$/.test(token) && /\d/.test(token)) return true;
  if (/^(css|sc|jsx|svelte|astro)-/.test(token)) return true;
  // CSS Modules hashes (Hero_title__a1B2c), but not BEM (hero__title).
  const tail = token.match(/_{1,2}([a-zA-Z0-9-]{5,8})$/)?.[1];
  if (tail && (/\d/.test(tail) || (/[A-Z]/.test(tail) && /[a-z]/.test(tail) && !/^[a-z]+[A-Z][a-z]+$/.test(tail)))) return true;
  if (/^:|^[0-9]|^radix-|^headlessui-|^react-aria|^ember\d|^mui-\d|^rc-\w+-\d/.test(token)) return true;
  if (/[0-9a-f]{6,}/i.test(token) && /\d/.test(token) && /[a-f]/i.test(token)) return true; // hash-like runs
  if ((token.match(/\d/g)?.length ?? 0) >= 4) return true;
  return false;
}

const UTILITY_PREFIX =
  /^-?(m|p|mx|my|mt|mb|ml|mr|ms|me|px|py|pt|pb|pl|pr|ps|pe|w|h|min-w|min-h|max-w|max-h|size|text|bg|from|via|to|flex|grid|gap|gap-x|gap-y|items|justify|content|self|place|rounded|shadow|border|ring|outline|font|leading|tracking|z|top|left|right|bottom|inset|opacity|transition|duration|ease|delay|animate|space-x|space-y|col|row|order|overflow|cursor|select|pointer-events|fill|stroke|object|aspect|basis|grow|shrink|translate|rotate|scale|skew|origin|decoration|underline|line-clamp|whitespace|break|truncate|divide|backdrop|blur|brightness|drop-shadow|columns|list|align|float|clear|isolate|mix-blend|will-change|sr|not-sr|tabular|antialiased|uppercase|lowercase|capitalize|italic|visible|invisible|static|fixed|absolute|relative|sticky|block|inline|inline-block|inline-flex|hidden|contents|table|container|prose)(-|$)/;

function isUtilityClass(c: string): boolean {
  return /[:[\]/!.]/.test(c) || UTILITY_PREFIX.test(c) || /^(sm|md|lg|xl|2xl|dark|hover|focus|group|peer)-/.test(c);
}

export function meaningfulClasses(el: Element): string[] {
  return Array.from(el.classList).filter((c) => !looksGenerated(c) && !isUtilityClass(c));
}

function stableId(el: Element): string | null {
  const id = el.id;
  return id && !looksGenerated(id) && !/\s/.test(id) ? id : null;
}

function isUnique(selector: string, el: Element, root: ParentNode = document): boolean {
  try {
    const found = root.querySelectorAll(selector);
    return found.length === 1 && found[0] === el;
  } catch {
    return false;
  }
}

const attr = (name: string, value: string) => `[${name}="${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
const tagOf = (el: Element) => CSS.escape(el.localName);

/** Selectors identifying `el` on their own (not guaranteed unique), best first. */
function ownCandidates(el: Element): string[] {
  const tag = tagOf(el);
  const out: string[] = [];
  const id = stableId(el);
  if (id) out.push(`#${CSS.escape(id)}`);
  for (const a of TEST_ATTRS) {
    const v = el.getAttribute(a);
    if (v) out.push(`${tag}${attr(a, v)}`);
  }
  for (const { name, value } of Array.from(el.attributes)) {
    if (name.startsWith("data-") && !TEST_ATTRS.includes(name) && !IGNORED_DATA.test(name) && value && value.length <= 40 && !looksGenerated(value.replace(/[\s-]/g, "")))
      out.push(`${tag}${attr(name, value)}`);
  }
  const aria = el.getAttribute("aria-label");
  if (aria && aria.length <= 60) out.push(`${tag}${attr("aria-label", aria)}`);
  for (const a of ["name", "alt", "title", "placeholder", "for"]) {
    const v = el.getAttribute(a);
    if (v && v.length <= 60) out.push(`${tag}${attr(a, v)}`);
  }
  const href = el.localName === "a" ? el.getAttribute("href") : null;
  if (href && href.length <= 80 && !href.startsWith("javascript:")) out.push(`${tag}${attr("href", href)}`);
  const classes = meaningfulClasses(el).slice(0, 3).map(CSS.escape);
  for (const c of classes) out.push(`${tag}.${c}`);
  if (classes.length > 1) out.push(`${tag}.${classes.join(".")}`);
  return out;
}

/** A short segment for `el` that distinguishes it among its siblings. */
function localSegment(el: Element): string {
  const tag = tagOf(el);
  const classes = meaningfulClasses(el).slice(0, 2).map(CSS.escape);
  const base = classes.length ? `${tag}.${classes.join(".")}` : tag;
  const parent = el.parentElement;
  if (!parent) return base;
  const same = Array.from(parent.children).filter((c) => c.localName === el.localName);
  if (same.length === 1) return base;
  if (classes.length && Array.from(parent.children).filter((c) => c.matches(base)).length === 1) return base;
  return `${base}:nth-of-type(${same.indexOf(el) + 1})`;
}

const selectorCache = new WeakMap<Element, string>();

/** The shortest reasonably stable CSS selector that uniquely matches `el`. */
export function stableSelector(el: Element, { cache = true } = {}): string {
  if (cache) {
    const hit = selectorCache.get(el);
    if (hit && isUnique(hit, el)) return hit;
  }
  const sel = computeSelector(el);
  selectorCache.set(el, sel);
  return sel;
}

function computeSelector(el: Element): string {
  if (el === document.documentElement) return "html";
  if (el === document.body) return "body";
  const own = ownCandidates(el);
  for (const c of own) if (isUnique(c, el)) return c;

  const ownShort = [...own, localSegment(el), tagOf(el)];
  if (isUnique(tagOf(el), el)) return tagOf(el);

  // Anchor on the nearest ancestor with a unique selector: "#pricing h2", "nav a[href='/docs']".
  let anchor: { el: Element; sel: string } | null = null;
  for (let a = el.parentElement, depth = 0; a && a !== document.documentElement && depth < 12; a = a.parentElement, depth++) {
    const sel = ownCandidates(a).find((c) => isUnique(c, a!)) ?? (a === document.body ? "body" : null);
    if (sel) {
      anchor = { el: a, sel };
      break;
    }
  }
  if (anchor && anchor.sel !== "body") {
    for (const c of ownShort) {
      const s = `${anchor.sel} ${c}`;
      if (isUnique(s, el)) return s;
    }
  }

  // Child path from the anchor (or html), shortened from the top where possible.
  const segments: string[] = [];
  for (let cur: Element | null = el; cur && cur !== anchor?.el && cur !== document.documentElement; cur = cur.parentElement) {
    segments.unshift(localSegment(cur));
  }
  const prefix = anchor ? `${anchor.sel} > ` : "";
  for (let i = segments.length - 1; i >= 0; i--) {
    // A purely positional tail ("li:nth-of-type(3)") is too fragile on its own.
    if (i === segments.length - 1 && segments.length > 1 && /^[a-z0-9-]+:nth-of-type/.test(segments[i])) continue;
    const tail = segments.slice(i).join(" > ");
    if (isUnique(tail, el)) return tail;
    if (anchor && isUnique(prefix + tail, el)) return prefix + tail;
  }
  return prefix + segments.join(" > ");
}

export function textOf(el: Element): string {
  const t = (el as HTMLElement).innerText ?? el.textContent ?? "";
  return t.replace(/\r/g, "").replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

const LABEL_ATTRS = ["aria-label", "alt", "title", "placeholder"];

/** One-line label for UI lists and search results: visible text, else an accessible label (own or a descendant's). */
export function snippet(el: Element, max = 60): string {
  const text = textOf(el).replace(/\s+/g, " ");
  if (text) return truncate(text, max);
  for (const a of LABEL_ATTRS) {
    const v = el.getAttribute(a);
    if (v) return truncate(v, max);
  }
  const labelled = el.querySelector("[aria-label], img[alt]:not([alt='']), [title]");
  const v = labelled && LABEL_ATTRS.map((a) => labelled.getAttribute(a)).find(Boolean);
  return v ? truncate(v, max) : "";
}

/** Truncated outerHTML without event handlers, inline styles or long attribute values. */
export function contextHtml(el: Element, max = 300): string {
  const html = el.outerHTML
    .slice(0, 4000)
    .replace(/\s+/g, " ")
    .replace(/ (on[a-z]+|style|data-onclickmeta|data-reactid|jsaction|jscontroller|jsname)="[^"]*"/gi, "")
    .replace(/="([^"]{80})[^"]+"/g, '="$1…"')
    .replace(/<!-- -->/g, "")
    .replace(/> </g, "><");
  return truncate(html, max);
}

const LANDMARK_TAGS: Record<string, string> = {
  header: "Header",
  nav: "Nav",
  footer: "Footer",
  aside: "Sidebar",
  form: "Form",
  dialog: "Dialog",
};
const LANDMARK_ROLES: Record<string, string> = {
  banner: "Header",
  navigation: "Nav",
  contentinfo: "Footer",
  complementary: "Sidebar",
  dialog: "Dialog",
  search: "Search",
  form: "Form",
  region: "Section",
};
const SECTION_HINT = /hero|pricing|feature|faq|testimonial|cta|banner|footer|header|nav|about|contact|team|blog|signup|newsletter|product|sidebar|menu|modal/i;

function humanize(s: string): string {
  const words = s.replace(/[-_]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function landmarkName(el: Element): string | null {
  const role = el.getAttribute("role");
  const tagName = LANDMARK_TAGS[el.localName] ?? (role ? LANDMARK_ROLES[role] : undefined);
  const aria = el.getAttribute("aria-label");
  const id = stableId(el);
  const hintClass = meaningfulClasses(el).find((c) => SECTION_HINT.test(c));
  if (tagName) return aria ? `${tagName} (${truncate(aria, 30)})` : tagName;
  if (el.localName === "section" || el.localName === "article") {
    if (aria) return truncate(aria, 40);
    if (id) return humanize(id);
    if (hintClass) return humanize(hintClass);
    return null;
  }
  if (id && SECTION_HINT.test(id)) return humanize(id);
  if (hintClass && el.localName === "div") return humanize(hintClass);
  return null;
}

/** Lets the session report a heading's pre-edit text, so section hints match the source. */
let originalText: (el: Element) => string | undefined = () => undefined;
export function setOriginalTextLookup(fn: (el: Element) => string | undefined) {
  originalText = fn;
}

const HEADINGS = "h1,h2,h3,h4,h5,h6,[role=heading]";

/** Nearest landmark and/or preceding heading, e.g. `Hero — "Email marketing platform…"`. */
export function sectionOf(el: Element): string {
  let landmark: { el: Element; name: string } | null = null;
  for (let a: Element | null = el.parentElement; a && a !== document.body; a = a.parentElement) {
    const name = landmarkName(a);
    if (name) {
      landmark = { el: a, name };
      break;
    }
  }
  let heading: Element | null = el.closest(HEADINGS);
  if (!heading) {
    for (const h of Array.from(document.querySelectorAll(HEADINGS))) {
      if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
        if ((h as HTMLElement).offsetParent !== null || h.getClientRects().length) heading = h;
      } else if (!h.contains(el)) break;
    }
  }
  // A heading outside the landmark (e.g. the last content heading before the footer) would mislead.
  if (heading && landmark && !landmark.el.contains(heading)) heading = null;
  const headingText = heading && heading !== el ? truncate((originalText(heading) ?? textOf(heading)).replace(/\s+/g, " "), 50) : "";
  const sameAsLandmark = !!landmark && headingText.toLowerCase() === landmark.name.toLowerCase();
  const parts = [landmark?.name, headingText && !sameAsLandmark ? `"${headingText}"` : ""].filter(Boolean);
  return parts.join(" — ") || "Page body";
}

export interface ElementInfo {
  elementId: string;
  tag: string;
  text: string;
  selector: string;
  section: string;
}

export function isVisible(el: Element): boolean {
  if (!el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0.01;
}
