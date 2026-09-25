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
      return [
        "MOVE",
        `Move ${code(c.selector)}${a} to be ${c.position} ${code(c.targetSelector)}${b} within ${code(c.parentSelector)}.`,
        `Section: ${c.section}`,
        `Context HTML: ${code(c.contextHtml)}`,
      ];
    }
  }
}

export function buildPrompt(changes: Change[]): string {
  const header = [
    "I reviewed the live page and want these changes applied to the source code.",
    `Page: ${location.href}  |  Title: ${document.title || "(untitled)"}  |  Viewport: ${window.innerWidth}x${window.innerHeight}`,
  ];
  if (!changes.length) return [...header, "", "(No changes yet.)"].join("\n");
  const body = changes.flatMap((c, i) => {
    const [title, ...rest] = describe(c);
    const n = `${i + 1}. `;
    return [`${n}${title}`, ...rest.map((l) => " ".repeat(n.length) + l), ""];
  });
  return [
    ...header,
    "",
    ...body,
    "Tip: search the codebase for the old text or the class names above to locate each element.",
  ].join("\n");
}
