// Smoke test on real websites: drives Agent Markup through the command layer
// (as an AI would), checks changes show live and survive a reload, and prints
// the prompt. Screenshots land in $TMPDIR. Run: bun tests/real-sites.mjs [url...]
import { launch } from "./harness.mjs";

const urls = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["https://mailchimp.com/", "https://docs.python.org/3/tutorial/index.html", "https://tailwindcss.com/", "https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a"];

let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(`  ${cond ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
};

const harness = await launch({ headless: !process.env.HEADED });
const { context, toggle, cmd } = harness;
let page = harness.page;
const ui = () => page.locator("agent-markup-root");
for (const url of urls) {
  console.log(`\n=== ${url}`);
  try {
    // A fresh tab per site.
    const fresh = await context.newPage();
    await page.close();
    page = harness.page = fresh;
    await page.bringToFront();
    await page.goto(url, { waitUntil: "load", timeout: 45000 });
    await page.waitForTimeout(1500);
    await toggle();
    check("panel visible", await ui().locator(".panel").isVisible());
    const font = await ui().locator(".panel .name").evaluate((n) => getComputedStyle(n).fontFamily + " " + getComputedStyle(n).fontSize);
    check("panel styles isolated", /ui-sans-serif/.test(font) && font.endsWith(" 13px"), font);

    const outline = (await cmd("get_page_outline", { limit: 60 })).data;
    check("outline", outline.length > 5, `${outline.length} items, e.g. ${JSON.stringify(outline.slice(0, 3).map((o) => `${o.role}: ${o.text}`))}`);

    const heading = (await cmd("find_elements", { query: "headline" })).data[0];
    check("found headline", !!heading, heading && `${heading.tag} ${heading.selector} "${heading.text}"`);
    const edit = await cmd("edit_text", { elementId: heading.elementId, newText: "Agent Markup was here" });
    check("edit_text", edit.ok, edit.error);

    // Remove the first visible paragraph.
    const para = outline.find((o) => o.role === "paragraph" && o.text.length > 20);
    if (para) check("remove paragraph", (await cmd("remove_element", { elementId: para.elementId })).ok);

    // Move: last sibling of the first visible list with 3+ items before its first item.
    const listIndex = await page.evaluate(() =>
      [...document.querySelectorAll("ul, ol")].findIndex((l) => {
        const items = [...l.children].filter((c) => c.getBoundingClientRect().height > 0);
        return items.length >= 3 && l.getBoundingClientRect().top < innerHeight * 2;
      }),
    );
    if (listIndex >= 0) {
      const list = (await cmd("find_elements", { selector: "ul, ol", limit: 100 })).data[listIndex];
      const items = (await cmd("find_elements", { selector: `${list.selector} > *`, limit: 100 })).data;
      const first = items[0], last = items[items.length - 1];
      const mv = await cmd("move_element", { elementId: last.elementId, targetId: first.elementId, position: "before" });
      check("move_element", mv.ok, mv.error ?? `"${last.text}" before "${first.text}"`);
    }

    const cta = (await cmd("find_elements", { query: "button" })).data[0] ?? (await cmd("find_elements", { query: "link" })).data[0];
    if (cta) check("add_note", (await cmd("add_note", { elementId: cta.elementId, note: "Make this more prominent" })).ok);

    const shown = await page.evaluate((sel) => document.querySelector(sel)?.textContent?.includes("Agent Markup was here"), heading.selector);
    check("edit visible on page", shown);
    await page.mouse.move(400, 300);
    await page.screenshot({ path: `${process.env.TMPDIR || "/tmp"}/am-${new URL(url).hostname}.png` });

    const before = (await cmd("list_changes")).data;
    const prompt = (await cmd("get_prompt")).data.prompt;
    console.log("\n" + prompt.split("\n").map((l) => "    " + l).join("\n") + "\n");

    // Undo everything, redo everything.
    for (let i = 0; i < before.length; i++) await cmd("undo");
    const undone = await page.evaluate((sel) => !document.querySelector(sel)?.textContent?.includes("Agent Markup was here"), heading.selector);
    check("undo all", undone && (await cmd("list_changes")).data.length === 0);
    for (let i = 0; i < before.length; i++) await cmd("redo");
    check("redo all", (await cmd("list_changes")).data.length === before.length);

    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(2500);
    const after = (await cmd("list_changes")).data;
    check("changes restored after reload", after.length === before.length, `${after.filter((c) => c.found).length}/${after.length} found on page`);
    const reapplied = await page.evaluate(() => document.body.innerText.includes("Agent Markup was here"));
    check("edit re-applied after reload", reapplied);
    await cmd("clear_all");
    check("clear_all", (await cmd("list_changes")).data.length === 0);
  } catch (err) {
    failures++;
    console.log("  ✗ error:", err.message.split("\n")[0]);
  }
}
await context.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
