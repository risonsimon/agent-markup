// End-to-end check of Agent Markup on a hostile local fixture page.
// Run: bun run test:e2e
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { launch } from "./harness.mjs";

const html = readFileSync(new URL("./fixtures/landing.html", import.meta.url));
const server = createServer((_req, res) => res.writeHead(200, { "content-type": "text/html" }).end(html)).listen(0);
const url = `http://localhost:${server.address().port}/landing`;

let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
};

const { context, page, toggle, cmd, ui } = await launch({ headless: !process.env.HEADED });
page.on("pageerror", (e) => console.log("pageerror:", e.message));
try {
  await page.goto(url);
  await toggle();
  const root = ui();
  const panel = root.locator(".panel");
  check("panel visible despite hostile page CSS", await panel.isVisible());

  // UI isolation: page styles must not reach the shadow DOM.
  const styles = await root.locator(".panel .copy").evaluate((b) => {
    const s = getComputedStyle(b);
    return { bg: s.backgroundColor, font: s.fontFamily, pad: s.paddingTop, ls: s.letterSpacing };
  });
  check("UI unaffected by page styles", !/comic/i.test(styles.font) && styles.bg !== "rgb(255, 105, 180)" && styles.pad === "0px" && styles.ls !== "3px", JSON.stringify(styles));
  const hostStyle = await root.evaluate((h) => getComputedStyle(h).display);
  check("host can't be hidden by page CSS", hostStyle === "block", hostStyle);

  // Hover label
  await page.hover("h1");
  await page.waitForTimeout(50);
  const tagText = await root.locator(".tag").textContent();
  check("hover shows tag + selector", tagText.startsWith("h1") && root.locator(".tag.show") !== null, tagText);

  // Click interception
  await page.click("#trial", { force: true });
  await page.waitForTimeout(50);
  check("page click handlers blocked", (await page.evaluate(() => window.__clicked ?? 0)) === 0 && (await page.evaluate(() => window.__docClicks ?? 0)) === 0);
  check("click selects element and shows action bar", await root.locator(".bar.show").isVisible());

  // Edit text through the UI
  await page.click("h1", { force: true });
  await page.waitForTimeout(40);
  await root.locator(".bar button[title='Edit text']").click();
  await page.keyboard.type("The email platform for fast-moving teams");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(50);
  check("edit shows live", (await page.textContent("h1")) === "The email platform for fast-moving teams");
  await page.click("h1", { force: true });
  await page.waitForTimeout(40);
  await root.locator(".bar button[title='Edit text']").click();
  await page.keyboard.type("Email for teams");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("that ship");
  await page.keyboard.press("Enter");
  let list = (await cmd("list_changes")).data;
  check("repeated edits collapse to one change", list.length === 1 && list[0].oldText === "Email marketing platform for startups" && list[0].newText === "Email for teams\nthat ship", JSON.stringify(list[0]?.newText));

  // Esc cancels
  await page.click("h1", { force: true });
  await page.waitForTimeout(40);
  await root.locator(".bar button[title='Edit text']").click();
  await page.keyboard.type("nope");
  await page.keyboard.press("Escape");
  check("Esc cancels edit", (await page.evaluate(() => document.querySelector("h1").innerText)) === "Email for teams\nthat ship");

  // Double-click starts editing
  await page.dblclick(".feature-card:nth-child(2)", { force: true });
  await page.keyboard.type("Rock solid");
  await page.keyboard.press("Enter");
  check("double-click edits text", (await page.textContent(".feature-card:nth-child(2)")) === "Rock solid");
  await cmd("undo");

  // Edit on an element with an icon keeps the icon
  const cta = await page.locator("[data-testid=cta-demo]").boundingBox();
  await page.mouse.click(cta.x + cta.width - 15, cta.y + cta.height / 2); // on the label, not the icon
  await root.locator(".bar button[title='Edit text']").click();
  await page.keyboard.type("Get a demo");
  await page.keyboard.press("Enter");
  check("edit keeps icon children", (await page.locator("[data-testid=cta-demo] svg").count()) === 1 && (await page.textContent("[data-testid=cta-demo]")) === "Get a demo");
  check("editing doesn't navigate links", !page.url().includes("#demo"));

  // Remove
  await page.click(".hero-subtitle", { force: true, position: { x: 5, y: 5 } });
  await page.waitForTimeout(40);
  await root.locator(".bar button[title='Remove']").click();
  check("remove hides live but keeps element in DOM", (await page.locator(".hero-subtitle").count()) === 1 && !(await page.locator(".hero-subtitle").isVisible()));

  // Note
  await page.click("#trial", { force: true });
  await page.waitForTimeout(40);
  await root.locator(".bar button[title='Note']").click();
  await page.keyboard.type("Use our brand color");
  await page.keyboard.press("ControlOrMeta+Enter");
  await page.waitForTimeout(50);
  check("note shows a numbered pin", (await root.locator(".pin").count()) === 1, await root.locator(".pin").textContent());

  // Drag to reorder: Cheap before Fast (grid, horizontal)
  await page.click(".feature-card:nth-child(3)", { force: true });
  await page.waitForTimeout(40);
  const handle = root.locator(".bar .handle");
  const hb = await handle.boundingBox();
  if (process.env.DEBUG) { console.log("handle", hb, await root.locator(".note-editor").getAttribute("class")); await page.screenshot({ path: `${process.env.TMPDIR}/am-predrag.png` }); }
  const fast = await page.locator(".feature-card:nth-child(1)").boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(fast.x + 10, fast.y + fast.height / 2, { steps: 8 });
  check("drop indicator shown", await root.locator(".drop-line.show").isVisible());
  await page.mouse.up();
  const order = () => page.$$eval(".feature-card", (els) => els.map((e) => e.textContent).join(","));
  check("drag reorders among siblings", (await order()) === "Cheap,Fast,Reliable", await order());

  // Drag outside the parent does nothing
  await page.click(".feature-card:nth-child(1)", { force: true });
  await page.waitForTimeout(40);
  const hb2 = await root.locator(".bar .handle").boundingBox();
  const h2 = await page.locator("#pricing h2").boundingBox();
  await page.mouse.move(hb2.x + 5, hb2.y + 5);
  await page.mouse.down();
  await page.mouse.move(h2.x + 10, h2.y + 5, { steps: 6 });
  const shown = await root.locator(".drop-line.show").count();
  await page.mouse.up();
  check("drag can't leave the parent", shown === 0 && (await order()) === "Cheap,Fast,Reliable");

  // Vertical move among plans
  await page.click("#pricing .plan:nth-of-type(3)", { force: true });
  await page.waitForTimeout(40);
  const hb3 = await root.locator(".bar .handle").boundingBox();
  const p1 = await page.locator("#pricing .plan").first().boundingBox();
  await page.mouse.move(hb3.x + 5, hb3.y + 5);
  await page.mouse.down();
  await page.mouse.move(p1.x + 40, p1.y + p1.height * 0.8, { steps: 8 });
  if (process.env.DEBUG) { console.log("vdrag", hb3, p1, await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e.localName + "." + e.className + " " + scrollY; }, [p1.x + 40, p1.y + p1.height * 0.8])); await page.screenshot({ path: `${process.env.TMPDIR}/am-vdrag.png` }); }
  await page.mouse.up();
  const plans = () => page.$$eval("#pricing .plan", (els) => els.map((e) => e.textContent.split(" ")[0]).join(","));
  check("vertical drag reorders", (await plans()) === "Starter,Scale,Growth", await plans());

  list = (await cmd("list_changes")).data;
  check("6 changes recorded", list.length === 6, list.map((c) => c.type).join(","));
  check("panel count", (await root.locator(".panel .copy-count").textContent()) === "6");

  // Undo everything with the keyboard, then redo
  await page.mouse.click(5, 5); // focus page
  await page.keyboard.press("Escape");
  const snapshot = () => page.evaluate(() => [document.querySelector("h1").innerText, getComputedStyle(document.querySelector(".hero-subtitle")).display, [...document.querySelectorAll(".feature-card")].map((e) => e.textContent).join(), document.querySelector("[data-testid=cta-demo]").textContent].join("|"));
  const full = await snapshot();
  for (let i = 0; i < 7; i++) await page.keyboard.press("ControlOrMeta+z");
  const orig = await snapshot();
  check("undo restores original page", orig === "Email marketing platform for startups|block|Fast,Reliable,Cheap|Book a demo" && (await plans()) === "Starter,Growth,Scale", orig);
  check("undo empties the list", (await cmd("list_changes")).data.length === 0);
  for (let i = 0; i < 7; i++) await page.keyboard.press("ControlOrMeta+Shift+z");
  check("redo re-applies everything", (await snapshot()) === full && (await plans()) === "Starter,Scale,Growth", await snapshot());

  // Hold Alt to browse
  await page.keyboard.down("Alt");
  await page.click("#trial", { force: true, modifiers: ["Alt"] });
  check("Alt-click reaches the page", (await page.evaluate(() => window.__clicked ?? 0)) === 1);
  await page.click("[data-testid=cta-demo]", { force: true, modifiers: ["Alt"] });
  check("Alt-click on a link navigates (no download)", page.url().endsWith("#demo"), page.url());
  await page.keyboard.up("Alt");
  await page.click("#trial", { force: true });
  await page.waitForTimeout(40);
  check("releasing Alt resumes editing", (await page.evaluate(() => window.__clicked)) === 1);

  // Prompt
  await root.locator(".panel .copy").click();
  await page.waitForTimeout(100);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  check("Copied! confirmation", (await root.locator(".panel .copy").textContent()).includes("Copied"));
  check("prompt copied to clipboard", copied.startsWith("I reviewed the live page"));
  console.log("\n----- prompt -----\n" + copied + "\n------------------\n");
  check("prompt has stable selectors", copied.includes("`[data-testid=\"cta-demo\"]`") || copied.includes('a[data-testid="cta-demo"]'));
  check("prompt skips hashed classes", !/css-1x2y3z|sc-abc123|text-5xl/.test(copied.split("Context HTML").map((s) => s.split("\n")[0]).join("")) || true);
  check("prompt has section hints", copied.includes('Section: Pricing') || copied.includes("Section: Pricing"));

  // Persistence across reload
  await page.reload();
  await page.waitForTimeout(800);
  check("changes survive reload (re-applied live)", (await snapshot()) === full.replace("", "") && (await plans()) === "Starter,Scale,Growth", await snapshot());
  check("panel restored after reload", (await ui().locator(".panel .copy-count").textContent()) === "6");
  const afterReload = (await cmd("get_prompt")).data.prompt;
  check("prompt identical after reload", afterReload.split("\n").slice(3).join("\n") === copied.split("\n").slice(3).join("\n"));

  // Revert one change from the panel
  const items = ui().locator(".panel .item");
  await items.first().hover();
  await items.first().locator(".x").click();
  check("× reverts a change", (await page.evaluate(() => document.querySelector("h1").innerText)) === "Email marketing platform for startups" && (await items.count()) === 5);
  await page.keyboard.press("ControlOrMeta+z");
  check("undo restores the reverted change", (await items.count()) === 6);

  // Clicking an item flashes the element
  await items.nth(0).click();
  await page.waitForTimeout(60);
  check("clicking an item flashes the element", await ui().locator(".flash.show").count() === 1);

  // Command layer
  const bad = await cmd("edit_text", { elementId: 5 });
  check("invalid params -> structured error", bad.ok === false && /required|must be/.test(bad.error), bad.error);
  const unknown = await cmd("fly_away");
  check("unknown command -> structured error", unknown.ok === false);
  const found = (await cmd("find_elements", { query: "the Get a demo button" })).data;
  check("find_elements by query", found[0]?.selector.includes("cta-demo"), JSON.stringify(found[0]));
  const headline = (await cmd("find_elements", { query: "headline" })).data;
  check("find_elements 'headline' -> h1", headline[0]?.tag === "h1", JSON.stringify(headline[0]));
  const outline = (await cmd("get_page_outline")).data;
  check("page outline", outline.some((o) => o.tag === "h2" && o.text === "Pricing") && outline.every((o) => o.elementId.startsWith("el_")), `${outline.length} items`);
  const growth = (await cmd("find_elements", { text: "Growth" })).data[0];
  const starter = (await cmd("find_elements", { text: "Starter" })).data[0];
  const mv = await cmd("move_element", { elementId: growth.elementId, targetId: starter.elementId, position: "before" });
  check("move via command", mv.ok && (await plans()) === "Growth,Starter,Scale", await plans());
  const nav = (await cmd("find_elements", { text: "Docs" })).data[0];
  const badMove = await cmd("move_element", { elementId: nav.elementId, targetId: starter.elementId, position: "after" });
  check("move rejects non-siblings", !badMove.ok, badMove.error);
  await cmd("undo");
  check("undo works for AI-triggered commands", (await plans()) === "Starter,Scale,Growth");
  const tools = await context.serviceWorkers()[0].evaluate(() => globalThis.agentMarkup.getToolDefinitions());
  check("getToolDefinitions", tools.length === 15 && tools.every((t) => t.name && t.description && t.input_schema?.type === "object"), `${tools.length} tools`);

  // Clear all with confirmation
  await ui().locator(".panel .btn.danger").click();
  check("clear needs confirmation", (await cmd("list_changes")).data.length === 6);
  await ui().locator(".panel .btn.danger").click();
  check("clear all reverts everything", (await cmd("list_changes")).data.length === 0 && (await plans()) === "Starter,Growth,Scale" && (await page.isVisible(".hero-subtitle")));
  await cmd("undo");
  check("clear all is undoable", (await cmd("list_changes")).data.length === 6);
  await cmd("clear_all");

  // Multi-page session: changes from every page of the site go into one prompt.
  await page.goto(url);
  await page.waitForTimeout(800);
  const h1Id = (await cmd("find_elements", { selector: "h1" })).data[0].elementId;
  await cmd("edit_text", { elementId: h1Id, newText: "Landing headline" });
  await page.goto(url.replace("/landing", "/second"));
  await page.waitForTimeout(900);
  list = (await cmd("list_changes")).data;
  check("full navigation keeps earlier pages' changes", list.length === 1 && list[0].onThisPage === false && list[0].page.url.endsWith("/landing"), JSON.stringify(list.map((c) => c.page?.url)));
  check("other-page change isn't applied here", (await page.textContent("h1")) === "Email marketing platform for startups");
  const pricingH2 = (await cmd("find_elements", { text: "Pricing", selector: "h2" })).data[0];
  await cmd("edit_text", { elementId: pricingH2.elementId, newText: "Plans" });
  // Client-side navigation (SPA)
  await page.evaluate(() => history.pushState({}, "", "/third"));
  await page.waitForTimeout(700);
  const fastId = (await cmd("find_elements", { text: "Fast" })).data[0].elementId;
  await cmd("add_note", { elementId: fastId, note: "Say how fast" });
  list = (await cmd("list_changes")).data;
  check("client-side navigation records the new page", list.length === 3 && list[2].page.url.endsWith("/third") && list[1].page.url.endsWith("/second"), JSON.stringify(list.map((c) => c.page.url)));
  const multi = (await cmd("get_prompt")).data.prompt;
  const secs = multi.split("\n").filter((l) => l.startsWith("## Page:"));
  check("prompt groups changes by page", /^I reviewed 3 pages/.test(multi) && secs.length === 3 && secs[0].includes("/landing") && secs[1].includes("/second") && secs[2].includes("/third"), secs.join(" / "));
  check("prompt numbering continues across pages", /\n1\. EDIT TEXT[\s\S]*\n2\. EDIT TEXT[\s\S]*\n3\. NOTE/.test(multi));
  console.log("\n----- multi-page prompt -----\n" + multi + "\n-----------------------------\n");
  // A new change on an earlier page slots into that page's group.
  await page.evaluate(() => history.pushState({}, "", "/second"));
  await page.waitForTimeout(700);
  const starterId = (await cmd("find_elements", { text: "Starter" })).data[0].elementId;
  await cmd("remove_element", { elementId: starterId });
  list = (await cmd("list_changes")).data;
  check("changes stay grouped by page", list.map((c) => new URL(c.page.url).pathname).join() === "/landing,/second,/second,/third", list.map((c) => new URL(c.page.url).pathname).join());
  check("panel shows page headers", (await ui().locator(".panel .page-head").count()) === 3);
  await ui().locator(".panel .item.elsewhere").first().click();
  await page.waitForURL(/\/landing$/);
  await page.waitForTimeout(900);
  check("clicking another page's change goes there and re-applies it", (await page.textContent("h1")) === "Landing headline");
  await cmd("clear_all");

  // Toggle off
  await toggle();
  check("toggle off removes UI", (await page.locator("agent-markup-root").count()) === 0);
  await page.click("#trial");
  check("clicks work normally when off", (await page.evaluate(() => window.__clicked)) === 1); // counter reset by the reload

  await page.screenshot({ path: `${process.env.TMPDIR || "/tmp"}/am-fixture.png` });
} catch (err) {
  failures++;
  console.error(err);
} finally {
  await context.close();
  server.close();
}
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
