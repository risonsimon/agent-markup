// Message contracts between the background worker, content script and any
// future client (side panel, voice client, agent bridge).

/** Run a command. Send via chrome.runtime.sendMessage (background forwards to the tab) or chrome.tabs.sendMessage. */
export const COMMAND_MESSAGE = "agent-markup:command";
/** Alias matching the original spec wording. */
export const COMMAND_MESSAGE_ALIAS = "Agent Markup:command";
/** Background -> content: flip enabled state. */
export const TOGGLE_MESSAGE = "agent-markup:toggle";
/** Background -> content: is the script already injected? */
export const PING_MESSAGE = "agent-markup:ping";
/** Content -> background: enabled state changed (for the badge). */
export const STATE_MESSAGE = "agent-markup:state";
/** Any client -> background: get tool definitions. */
export const TOOLS_MESSAGE = "agent-markup:get-tool-definitions";

export interface CommandMessage {
  type: typeof COMMAND_MESSAGE | typeof COMMAND_MESSAGE_ALIAS;
  name: string;
  params?: unknown;
  /** Only for messages sent to the background: target tab (defaults to the active tab). */
  tabId?: number;
}

export interface CommandResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export const isCommandMessage = (m: unknown): m is CommandMessage =>
  !!m && typeof m === "object" && ((m as CommandMessage).type === COMMAND_MESSAGE || (m as CommandMessage).type === COMMAND_MESSAGE_ALIAS);
