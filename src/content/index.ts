// Content script entry. Injected on demand by the background worker.
import { getToolDefinitions } from "../commands/definitions";
import { isCommandMessage, PING_MESSAGE, STATE_MESSAGE, TOGGLE_MESSAGE } from "../shared/messages";
import { executeCommand, onCommand } from "./commands";
import { restore } from "./session";
import { store } from "./store";
import { createUI } from "./ui";

declare global {
  interface Window {
    __agentMarkup?: { executeCommand: typeof executeCommand; getToolDefinitions: typeof getToolDefinitions; onCommand: typeof onCommand };
  }
}

if (!window.__agentMarkup) {
  window.__agentMarkup = { executeCommand, getToolDefinitions, onCommand };
  createUI();
  void restore();

  store.subscribe((s, prev) => {
    if (s.enabled !== prev.enabled) chrome.runtime.sendMessage({ type: STATE_MESSAGE, enabled: s.enabled }).catch(() => {});
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === PING_MESSAGE) {
      sendResponse({ ok: true });
      return false;
    }
    if (msg?.type === TOGGLE_MESSAGE) {
      void executeCommand("set_enabled", { enabled: !store.get().enabled }).then((r) => sendResponse({ enabled: (r.data as { enabled: boolean }).enabled }));
      return true;
    }
    if (isCommandMessage(msg)) {
      void executeCommand(msg.name, msg.params).then(sendResponse);
      return true;
    }
    return false;
  });
}
