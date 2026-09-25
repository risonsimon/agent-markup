// Shared Playwright harness: launches Chromium with the dist-test extension and
// exposes helpers to toggle Agent Markup and run commands through the
// background worker (the same path a future side panel or agent would use).
import { chromium } from "playwright";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";

const ext = resolve("dist-test");
const cached = join(homedir(), "Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");

export async function launch({ headless = true } = {}) {
  const context = await chromium.launchPersistentContext(mkdtempSync(join(process.env.TMPDIR || tmpdir(), "am-")), {
    headless,
    executablePath: process.env.CHROME_PATH || (existsSync(cached) ? cached : undefined),
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const page = context.pages()[0] ?? (await context.newPage());
  const tabId = async () => sw.evaluate(async () => (await chrome.tabs.query({ active: true }))[0].id);
  const h = {
    context,
    page,
    sw,
    async toggle() {
      const id = await tabId();
      await sw.evaluate((id) => globalThis.agentMarkup.toggle(id), id);
      await h.page.waitForTimeout(150);
    },
    async cmd(name, params = {}) {
      const id = await tabId();
      return sw.evaluate(({ id, name, params }) => globalThis.agentMarkup.sendCommand(id, name, params), { id, name, params });
    },
    ui: () => h.page.locator("agent-markup-root"),
  };
  return h;
}
