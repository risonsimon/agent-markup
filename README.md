# Agent Markup

A Chrome extension (Manifest V3) for marking up a live website: edit text, remove elements, add notes and reorder siblings right on the page. When you're done, **Copy prompt** gives you one precise prompt to paste into your coding agent (Claude Code, Cursor, etc.), which then applies the changes to your real source code.

It has no backend, no accounts and makes no AI calls. Nothing leaves your browser except what you paste.

## Install

```sh
bun install
bun run build        # outputs dist/
```

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose the `dist/` folder.
3. Optional: pin Agent Markup to the toolbar.

Use `bun run watch` to rebuild while developing. After each rebuild, click reload on the extension card.

## Use

Click the toolbar icon or press **Alt+Shift+R** to turn Agent Markup on or off for the current tab. You can change the shortcut at `chrome://extensions/shortcuts`.

While it's on:

- **Hover** to outline an element and see its tag, a short selector and its size.
- **Click** an element to select it. A small action bar appears next to it:
  - **Edit text** (or double-click the element): edit the text in place, as plain text. **Enter** saves, **Esc** cancels, **Shift+Enter** adds a new line.
  - **Remove**: hides the element on the page. It stays in the DOM, so you can restore it.
  - **Note**: attaches an instruction such as "make this bigger". A numbered pin marks the element. Save with **⌘/Ctrl+Enter**. Click the pin to edit the note.
  - **Drag handle (⠿)**: drag the element before or after one of its siblings. A line shows where it will drop. Elements can only move within their own parent.
- **Hold Alt to browse.** While you hold Alt, Agent Markup ignores clicks and hovers, so you can click links, open menus and modals, and scroll. Release Alt to go back to editing. (Chrome normally downloads a link when you Alt+click it. Agent Markup turns that into a normal click.)
- All other clicks on the page are intercepted, so selecting an element never follows a link or submits a form.
- **Esc** clears the selection.

### Changes panel

The panel sits at the bottom right. You can drag it by its header and collapse it.

- A numbered list of your changes: ~~old~~ → new for text edits, plus labelled removes, notes and moves. Click an item to scroll to its element and flash it. Click **×** to revert that change.
- **Undo** and **Redo**, also **⌘/Ctrl+Z** and **⌘/Ctrl+Shift+Z** when you're not typing in a field.
- **Clear all**. Click it twice to confirm. Clearing can be undone.
- **Copy prompt (N)** copies the prompt to your clipboard.

**Multiple pages.** Browse to other pages on the same site (hold Alt and click a link) and keep marking up. Changes from every page go into one session, grouped under a header for each page. That works for normal page loads and for client-side route changes in single-page apps. Only the current page's changes are applied live. Click a change from another page to go to that page.

The session is saved per site (origin) in `chrome.storage.local`. When you reload or come back to a page, its changes are re-applied wherever the elements can still be found. If Chrome still lets the extension access the tab after a reload or navigation, Agent Markup turns itself back on. If not, click the icon again and your saved changes come back.

### The prompt

```
I reviewed the live page and want these changes applied to the source code.
Page: https://example.com/  |  Title: Acme Mail  |  Viewport: 1280x800

1. EDIT TEXT
   Element: <a> — selector: `a[data-testid="cta-demo"]`
   Section: "Email marketing platform for startups"
   Old: "Book a demo"
   New: "Get a demo"
   Context HTML: `<a class="btn btn-primary" href="#demo" data-testid="cta-demo"><svg …>Book a demo</a>`

2. MOVE
   Move `#pricing div.plan:nth-of-type(3)` ("Scale — $199") to be after `#pricing div.plan:nth-of-type(1)` ("Starter — $9") within `#pricing`.
   Section: Pricing
   Context HTML: `<div class="plan">Scale — $199</div>`

Tip: search the codebase for the old text or the class names above to locate each element.
```

- **Selectors** are chosen to be stable and short. They prefer `id`, `data-testid` and other `data-*` attributes, `aria-label`, `href`/`alt`/`name`, and meaningful class names (BEM names are kept). Generated names are skipped: `css-1x2y3z`, `sc-abc123`, CSS Modules hashes and Tailwind utility classes. When nothing better exists, the selector falls back to a short `:nth-of-type` path.
- **Section** is the nearest landmark (header, nav, footer, aside, a named `<section>`) and/or the heading that comes before the element. Heading text is the original text, before any edit.
- **Context HTML** is the element's original `outerHTML`, trimmed to about 300 characters. Event handlers, inline styles and long attribute values are removed first.
- When changes span several pages, the prompt starts with `I reviewed N pages of the live site…` and puts each page's changes under its own `## Page: <URL>  |  Title: <title>` heading. Numbering continues across pages.
- Several edits to the same element become one entry (original → latest). Editing text back to its original removes the entry.

## Architecture (built so an AI can drive it)

```
src/
  commands/definitions.ts  tool names, descriptions, JSON Schemas, getToolDefinitions()
  commands/validate.ts     small JSON Schema validator
  shared/messages.ts       message types for chrome.runtime
  background.ts            toggle, on-demand injection, re-enable after reload, message routing
  content/
    commands.ts            CommandRegistry: executeCommand(name, params) -> { ok, data?, error? }
    session.ts             change list, undo/redo history, persistence, restore
    engine.ts              the only code that changes the page DOM (apply/unapply a change)
    store.ts               a single store (changes + history flags + UI state) that the UI subscribes to
    registry.ts            element IDs ("el_12") kept in a WeakMap
    describe.ts            selectors, section hints, snippets, context HTML
    query.ts               find_elements, get_page_outline
    prompt.ts              prompt builder
    ui/                    Shadow DOM root, overlay, action bar, panel, event interception
```

### One command layer

Everything goes through `executeCommand`: the UI, keyboard shortcuts and outside callers alike. The UI never changes the page or the change list itself. It calls the same commands a model would. (Purely visual state, like hover, open popovers and the panel's position, stays in the UI.)

| Command | Params | Result |
| --- | --- | --- |
| `select_element` | `{ elementId \| null, scrollIntoView?, flash? }` | selected element info |
| `edit_text` | `{ elementId, newText }` | `{ changed, changeId, oldText, newText }` |
| `remove_element` | `{ elementId }` | `{ changeId }` |
| `add_note` | `{ elementId, note }` (empty note deletes it) | `{ changed, changeId }` |
| `move_element` | `{ elementId, targetId, position: "before" \| "after" }` (siblings only) | `{ changed, changeId }` |
| `revert_change` | `{ changeId }` | `{ reverted }` |
| `undo` / `redo` / `clear_all` | `{}` | status |
| `list_changes` | `{}` | changes in prompt order, each with its `page` and `onThisPage` |
| `get_prompt` / `copy_prompt` | `{}` | `{ prompt, count }` |
| `find_elements` | `{ query?, text?, selector?, limit? }` | `[{ elementId, tag, role, text, selector, section }]` |
| `get_page_outline` | `{ limit?, includeSelectors? }` | headings, buttons, links, paragraphs, images with alt, fields |
| `set_enabled` | `{ enabled }` | `{ enabled }` |

- `executeCommand(name, params)` checks `params` against the command's JSON Schema. It always returns `{ ok, data?, error? }` and never throws.
- Element IDs such as `el_12` are assigned the first time an element is referenced, so a person and an AI name elements the same way. Use `find_elements({ query: "the Book a demo button" })` or `get_page_outline()` to get IDs. No screenshots needed.
- Undo and redo live in the command layer. Each mutating command records a patch (`before` → `after`) for the change it touches. The same history is used no matter who ran the command.
- `onCommand(listener)` lets you watch every command as it runs, for example to log actions or mirror them to an agent.

### Tool definitions

`getToolDefinitions()` in `src/commands/definitions.ts` has no DOM or `chrome.*` dependencies:

```ts
import { getToolDefinitions } from "./src/commands/definitions";

getToolDefinitions();          // Anthropic: [{ name, description, input_schema }]
getToolDefinitions("openai");  // OpenAI:    [{ type: "function", function: { name, description, parameters } }]
```

You can pass the array straight to a model as its `tools`. When the model calls a tool, run the call with `executeCommand(tool.name, tool.input)` and return the result to the model.

### External entry point

Any extension context (a future side panel, voice client or agent bridge) can drive the active tab:

```ts
const result = await chrome.runtime.sendMessage({
  type: "agent-markup:command",   // "Agent Markup:command" also works
  name: "find_elements",
  params: { query: "headline" },
  tabId,                          // optional; defaults to the active tab
});
// -> { ok: true, data: [{ elementId: "el_3", tag: "h1", ... }] }

const tools = await chrome.runtime.sendMessage({ type: "agent-markup:get-tool-definitions", format: "anthropic" });
```

The background worker injects the content script if it isn't already there and forwards the message. Content scripts also accept the same message directly through `chrome.tabs.sendMessage`. From the service worker's DevTools console you can call `agentMarkup.sendCommand(tabId, name, params)`.

## Permissions

`activeTab`, `scripting`, `storage`, `clipboardWrite`. There are no host permissions. The content script is injected only when you turn Agent Markup on for a tab.

## Tests

```sh
bun run test:e2e     # hostile local fixture page: UI isolation, edits, remove, notes, drag, undo/redo, Alt-browse, prompt, reload
bun run test:sites   # smoke test on real sites (Mailchimp, Python docs, Tailwind, MDN) through the command layer
```

Both use Playwright with a test build (`dist-test/`). The test build adds `<all_urls>` host access, so the scripts can inject without clicking the toolbar, and uses an open shadow root, so Playwright can reach the UI. If Chromium isn't installed yet, run `bunx playwright install chromium` first.

## Limitations

- Editing replaces the element's text with plain text. If the text is a single run next to icons (`<button><svg/>Label</button>`), only that run changes and the icons stay.
- After a reload, changes are matched to elements by selector. Pages that render very differently each load, or sites that change their markup, may leave some changes marked as not found. They still appear in the prompt.
- A session covers one site (origin). Changes on a different domain start their own session.
- Undo and redo history covers what you did since the page last loaded. After a full navigation, earlier changes stay in the list and can still be reverted with ×.
