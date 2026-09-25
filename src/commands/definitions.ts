// Tool definitions for every Agent Markup command. This module has no DOM or
// chrome.* dependencies, so a side panel, background worker or model bridge can
// import it and hand the array straight to an LLM as its tool list.

export type JSONSchema = {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  enum?: unknown[];
  items?: JSONSchema;
  additionalProperties?: boolean;
  minLength?: number;
  minimum?: number;
  maximum?: number;
};

export interface CommandDefinition {
  name: CommandName;
  description: string;
  parameters: JSONSchema;
}

const elementId: JSONSchema = {
  type: "string",
  description: 'Element ID such as "el_12", as returned by find_elements, get_page_outline or list_changes.',
  minLength: 1,
};

const noParams: JSONSchema = { type: "object", properties: {}, additionalProperties: false };

export const COMMAND_DEFINITIONS = [
  {
    name: "select_element",
    description:
      "Select an element on the page (shows its outline and action bar). Pass elementId null to clear the selection. Optionally scroll it into view and flash it.",
    parameters: {
      type: "object",
      properties: {
        elementId: { ...elementId, type: ["string", "null"] },
        scrollIntoView: { type: "boolean", description: "Scroll the element into view. Default false." },
        flash: { type: "boolean", description: "Briefly flash a highlight over the element. Default false." },
      },
      required: ["elementId"],
      additionalProperties: false,
    },
  },
  {
    name: "edit_text",
    description:
      "Replace the visible text of an element (plain text; use \\n for line breaks). Shown live on the page. Repeated edits to the same element collapse into one change (original -> latest).",
    parameters: {
      type: "object",
      properties: { elementId, newText: { type: "string", description: "The new plain text." } },
      required: ["elementId", "newText"],
      additionalProperties: false,
    },
  },
  {
    name: "remove_element",
    description: "Hide an element on the live page and record that it should be removed from the source. Restorable via undo or revert_change.",
    parameters: { type: "object", properties: { elementId }, required: ["elementId"], additionalProperties: false },
  },
  {
    name: "add_note",
    description:
      'Attach a free-text instruction to an element, e.g. "make this bigger" or "use our brand color". One note per element; calling again replaces it. An empty note deletes it.',
    parameters: {
      type: "object",
      properties: { elementId, note: { type: "string", description: "The instruction for the coding agent." } },
      required: ["elementId", "note"],
      additionalProperties: false,
    },
  },
  {
    name: "move_element",
    description:
      "Reorder an element relative to one of its siblings (same parent only). Shown live on the page.",
    parameters: {
      type: "object",
      properties: {
        elementId,
        targetId: { ...elementId, description: "A sibling of elementId (same parent element)." },
        position: { type: "string", enum: ["before", "after"], description: "Place elementId before or after targetId." },
      },
      required: ["elementId", "targetId", "position"],
      additionalProperties: false,
    },
  },
  {
    name: "revert_change",
    description: "Revert one change from the change list (undoable).",
    parameters: {
      type: "object",
      properties: { changeId: { type: "string", description: 'Change ID such as "ch_3", from list_changes.', minLength: 1 } },
      required: ["changeId"],
      additionalProperties: false,
    },
  },
  { name: "undo", description: "Undo the last change operation.", parameters: noParams },
  { name: "redo", description: "Redo the last undone change operation.", parameters: noParams },
  { name: "clear_all", description: "Revert every change on this page (undoable).", parameters: noParams },
  { name: "list_changes", description: "Return the current list of changes, in prompt order.", parameters: noParams },
  { name: "get_prompt", description: "Return the prompt text describing all changes, for a coding agent.", parameters: noParams },
  { name: "copy_prompt", description: "Copy the prompt text to the clipboard. Returns the copied text.", parameters: noParams },
  {
    name: "find_elements",
    description:
      'Find elements on the page. Use query for natural descriptions like "the headline" or "Book a demo button", text for a visible-text substring, or selector for a CSS selector. Returns elementIds usable with the other commands.',
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural description; matched against text, labels and element roles." },
        text: { type: "string", description: "Case-insensitive substring of the element's visible text." },
        selector: { type: "string", description: "CSS selector." },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "Maximum results. Default 10." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_page_outline",
    description:
      "Return a compact outline of meaningful visible elements (headings, buttons, links, paragraphs, images with alt, form fields) with elementIds, so the page can be understood without screenshots.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 1000, description: "Maximum items. Default 200." },
        includeSelectors: { type: "boolean", description: "Include a stable CSS selector per item. Default false." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "set_enabled",
    description: "Turn Agent Markup's editing UI on or off for this tab. Applied changes stay on the page either way.",
    parameters: {
      type: "object",
      properties: { enabled: { type: "boolean" } },
      required: ["enabled"],
      additionalProperties: false,
    },
  },
] as const satisfies readonly { name: string; description: string; parameters: JSONSchema }[];

export type CommandName = (typeof COMMAND_DEFINITIONS)[number]["name"];

export type AnthropicTool = { name: string; description: string; input_schema: JSONSchema };
export type OpenAITool = { type: "function"; function: { name: string; description: string; parameters: JSONSchema } };

/**
 * All commands as LLM tool definitions.
 * - "anthropic" (default): `{ name, description, input_schema }` for the Messages API `tools` param.
 * - "openai": `{ type: "function", function: { name, description, parameters } }`.
 */
export function getToolDefinitions(format?: "anthropic"): AnthropicTool[];
export function getToolDefinitions(format: "openai"): OpenAITool[];
export function getToolDefinitions(format: "anthropic" | "openai" = "anthropic"): AnthropicTool[] | OpenAITool[] {
  const defs = COMMAND_DEFINITIONS.map((d) => ({ name: d.name, description: d.description, parameters: d.parameters as JSONSchema }));
  if (format === "openai") return defs.map((d) => ({ type: "function" as const, function: d }));
  return defs.map(({ name, description, parameters }) => ({ name, description, input_schema: parameters }));
}

export function getDefinition(name: string): CommandDefinition | undefined {
  return (COMMAND_DEFINITIONS as readonly CommandDefinition[]).find((d) => d.name === name);
}
