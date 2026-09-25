// Page understanding for AI callers: find_elements and get_page_outline.
import { isVisible, sectionOf, snippet, stableSelector, textOf } from "./describe";
import { idOf } from "./registry";

export interface FoundElement {
  elementId: string;
  tag: string;
  role: string;
  text: string;
  selector: string;
  section: string;
}

const OUTLINE_SELECTOR = [
  "h1", "h2", "h3", "h4", "h5", "h6", "[role=heading]",
  "button", "[role=button]", "a[href]", "input:not([type=hidden])", "textarea", "select",
  "p", "li", "blockquote", "img[alt]:not([alt=''])", "label", "figcaption", "th", "td", "summary",
].join(",");

function roleOf(el: Element): string {
  const role = el.getAttribute("role");
  if (role) return role;
  const tag = el.localName;
  if (/^h[1-6]$/.test(tag)) return `heading${tag[1]}`;
  if (tag === "a") return "link";
  if (tag === "img") return "image";
  if (tag === "p") return "paragraph";
  if (tag === "li") return "listitem";
  if (tag === "input" || tag === "textarea" || tag === "select") return "field";
  return tag;
}

const isOurs = (el: Element) => el.localName === "agent-markup-root";

function info(el: Element, withSelector: boolean): FoundElement {
  return {
    elementId: idOf(el),
    tag: el.localName,
    role: roleOf(el),
    text: snippet(el, 80),
    selector: withSelector ? stableSelector(el) : "",
    section: sectionOf(el),
  };
}

export function outline(limit: number, includeSelectors: boolean): FoundElement[] {
  const out: FoundElement[] = [];
  const seen = new Set<Element>();
  for (const el of Array.from(document.body.querySelectorAll(OUTLINE_SELECTOR))) {
    if (out.length >= limit) break;
    if (isOurs(el) || !isVisible(el)) continue;
    // Skip paragraphs/list items nested in something already listed (e.g. a <p> inside a button).
    if (el.parentElement?.closest("button,a[href],[role=button],li,p") && seen.has(el.parentElement.closest("button,a[href],[role=button],li,p")!)) continue;
    const text = snippet(el, 80);
    if (!text && !/^(input|textarea|select|img)$/.test(el.localName)) continue;
    seen.add(el);
    const item = info(el, includeSelectors);
    if (!includeSelectors) delete (item as Partial<FoundElement>).selector;
    out.push(item);
  }
  return out;
}

const STOPWORDS = new Set("the a an this that of to in on for with and or my our your its it element please".split(" "));
const ROLE_WORDS: Record<string, string[]> = {
  button: ["button", "[role=button]", "input[type=submit]", "input[type=button]"],
  cta: ["button", "a[href]", "[role=button]"],
  link: ["a[href]"],
  headline: ["h1", "h2"],
  heading: ["h1", "h2", "h3", "h4", "h5", "h6", "[role=heading]"],
  title: ["h1", "h2", "h3"],
  subheading: ["h2", "h3", "h4"],
  subtitle: ["h2", "h3", "p"],
  paragraph: ["p"],
  text: ["p", "span", "li"],
  image: ["img", "svg", "picture"],
  logo: ["img", "svg", "a[href]"],
  input: ["input", "textarea", "select"],
  field: ["input", "textarea", "select"],
  nav: ["nav"],
  navigation: ["nav"],
  menu: ["nav", "[role=menu]", "ul"],
  footer: ["footer"],
  header: ["header"],
  list: ["ul", "ol"],
  item: ["li"],
  card: ["article", "li", "div"],
  section: ["section"],
};

const labelOf = (el: Element) =>
  [textOf(el), el.getAttribute("aria-label"), el.getAttribute("alt"), el.getAttribute("title"), el.getAttribute("placeholder"), (el as HTMLInputElement).value]
    .filter((v) => typeof v === "string" && v)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ");

/** Smallest visible elements whose text contains `needle`. */
function byText(needle: string): Element[] {
  const n = needle.toLowerCase().replace(/\s+/g, " ").trim();
  const hits = Array.from(document.body.querySelectorAll("*")).filter(
    (el) => !isOurs(el) && !/^(script|style|noscript|template|svg|path)$/.test(el.localName) && labelOf(el).includes(n) && isVisible(el),
  );
  // Keep the innermost matches: drop any hit that contains another hit.
  return hits.filter((el) => !hits.some((o) => o !== el && el.contains(o)));
}

function byQuery(query: string): Element[] {
  const tokens = query.toLowerCase().replace(/["'“”‘’.,!?]/g, " ").split(/\s+/).filter((t) => t && !STOPWORDS.has(t));
  const roleSelectors = tokens.flatMap((t) => ROLE_WORDS[t] ?? []);
  const words = tokens.filter((t) => !ROLE_WORDS[t]);
  const phrase = words.join(" ");
  const candidates = new Set<Element>(document.body.querySelectorAll(OUTLINE_SELECTOR));
  if (roleSelectors.length) for (const el of Array.from(document.body.querySelectorAll(roleSelectors.join(",")))) candidates.add(el);
  if (phrase) for (const el of byText(phrase)) candidates.add(el);

  const scored: { el: Element; score: number }[] = [];
  for (const el of candidates) {
    if (isOurs(el) || !isVisible(el)) continue;
    const label = labelOf(el);
    let score = 0;
    if (words.length) {
      const matched = words.filter((w) => label.includes(w)).length;
      if (!matched) continue;
      score += matched / words.length;
      if (phrase && label.includes(phrase)) score += 1;
      if (label.length < phrase.length * 3) score += 0.3; // tight match, not a big container
    }
    if (roleSelectors.length) {
      if (roleSelectors.some((s) => el.matches(s))) score += words.length ? 0.6 : 1;
      else if (!words.length) continue;
    }
    if (el.localName === "h1") score += 0.1;
    scored.push({ el, score });
  }
  scored.sort((a, b) => b.score - a.score);
  // Drop containers whose better-scoring descendant is already listed.
  const out: Element[] = [];
  for (const { el } of scored) if (!out.some((o) => o.contains(el) || el.contains(o))) out.push(el);
  return out;
}

export function find(params: { query?: string; text?: string; selector?: string; limit?: number }): FoundElement[] {
  const limit = params.limit ?? 10;
  let els: Element[];
  if (params.selector) {
    els = Array.from(document.querySelectorAll(params.selector)).filter((el) => !isOurs(el));
    if (params.text) {
      const n = params.text.toLowerCase();
      els = els.filter((el) => labelOf(el).includes(n));
    }
  } else if (params.text) {
    els = byText(params.text);
  } else if (params.query) {
    els = byQuery(params.query);
  } else {
    throw new Error("Provide query, text or selector");
  }
  return els.slice(0, limit).map((el) => info(el, true));
}
