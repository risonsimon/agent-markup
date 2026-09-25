// Builds the prompt the user pastes into their coding agent.
import type { Change } from "./changes";

const quote = (s: string) => `"${s.replace(/\n/g, "\\n")}"`;
const code = (s: string) => "`" + s.replace(/`/g, "'") + "`";

function elementLines(c: Change): string[] {
  return [`Element: <${c.tag}> — selector: ${code(c.selector)}`, `Section: ${c.section}`];
}

function describe(c: Change): string[] {
  switch (c.type) {
    case "edit":
      return ["EDIT TEXT", ...elementLines(c), `Old: ${quote(c.oldText)}`, `New: ${quote(c.newText)}`, `Context HTML: ${code(c.contextHtml)}`];
    case "remove":
      return ["REMOVE", ...elementLines(c), ...(c.snippet ? [`Text: ${quote(c.snippet)}`] : []), `Context HTML: ${code(c.contextHtml)}`];
    case "note":
      return ["NOTE", ...elementLines(c), ...(c.snippet ? [`Text: ${quote(c.snippet)}`] : []), `Instruction: ${quote(c.note)}`, `Context HTML: ${code(c.contextHtml)}`];
    case "move": {
      const a = c.snippet ? ` (${quote(c.snippet)})` : "";
      const b = c.targetSnippet ? ` (${quote(c.targetSnippet)})` : "";
      const from = c.fromParentSelector ?? c.parentSelector;
      const line =
        from === c.parentSelector
          ? `Move ${code(c.selector)}${a} to be ${c.position} ${code(c.targetSelector)}${b} within ${code(c.parentSelector)}.`
          : `Move ${code(c.selector)}${a} out of ${code(from)} to be ${c.position} ${code(c.targetSelector)}${b} in ${code(c.parentSelector)}.`;
      return [
        "MOVE",
        line,
        `Section: ${c.section}`,
        `Context HTML: ${code(c.contextHtml)}`,
      ];
    }
  }
}

function numbered(c: Change, n: number): string[] {
  const [title, ...rest] = describe(c);
  const prefix = `${n}. `;
  return [`${prefix}${title}`, ...rest.map((l) => " ".repeat(prefix.length) + l), ""];
}

const pageLine = (url: string, title: string) => `Page: ${url}  |  Title: ${title || "(untitled)"}`;

/** Changes are numbered in list order, which is grouped by page. */
export function buildPrompt(changes: Change[]): string {
  const viewport = `Viewport: ${window.innerWidth}x${window.innerHeight}`;
  const tip = "Tip: search the codebase for the old text or the class names above to locate each element.";
  const pages = [...new Map(changes.map((c) => [c.page.key, c.page])).values()];

  if (pages.length <= 1) {
    const page = pages[0] ?? { url: location.href, title: document.title };
    const header = [
      "I reviewed the live page and want these changes applied to the source code.",
      `${pageLine(page.url, page.title)}  |  ${viewport}`,
    ];
    if (!changes.length) return [...header, "", "(No changes yet.)"].join("\n");
    return [...header, "", ...changes.flatMap((c, i) => numbered(c, i + 1)), tip].join("\n");
  }

  const lines = [
    `I reviewed ${pages.length} pages of the live site and want these changes applied to the source code.`,
    `Site: ${location.origin}  |  ${viewport}`,
    "",
  ];
  let n = 0;
  for (const page of pages) {
    lines.push(`## ${pageLine(page.url, page.title)}`, "");
    for (const c of changes.filter((c) => c.page.key === page.key)) lines.push(...numbered(c, ++n));
  }
  return [...lines, tip].join("\n");
}
