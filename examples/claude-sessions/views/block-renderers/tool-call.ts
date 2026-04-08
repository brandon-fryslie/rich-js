import { Panel, RichText, Group, Rule, Syntax } from "../../../../src/index.js";
import type { Renderable } from "../../../../src/index.js";
import type { ToolCallBlock } from "../../data/types.js";
import { shortTime, borderFor, truncate } from "./_common.js";
import type { RenderOpts } from "./index.js";

const RESULT_PREVIEW_LINES = 12;
const INPUT_PREVIEW_LINES = 8;

function summarizeInput(toolName: string, input: unknown): string {
  if (input === null || input === undefined) return "";
  if (typeof input !== "object") return String(input);
  const obj = input as Record<string, unknown>;

  // Tool-specific compact summaries
  switch (toolName) {
    case "Bash":
      return `$ ${String(obj["command"] ?? "")}`;
    case "Read":
      return `📖 ${String(obj["file_path"] ?? "")}`;
    case "Write":
      return `✏️  ${String(obj["file_path"] ?? "")}`;
    case "Edit":
      return `✏️  ${String(obj["file_path"] ?? "")}`;
    case "Glob":
      return `🔍 ${String(obj["pattern"] ?? "")}`;
    case "Grep":
      return `🔍 ${String(obj["pattern"] ?? "")}` +
        (obj["path"] ? `  in ${String(obj["path"])}` : "");
    case "WebFetch":
      return `🌐 ${String(obj["url"] ?? "")}`;
    case "WebSearch":
      return `🔎 ${String(obj["query"] ?? "")}`;
    default:
      return JSON.stringify(input, null, 2);
  }
}

export function renderToolCall(block: ToolCallBlock, opts: RenderOpts): Renderable {
  const baseColor = block.isError ? "red" : "yellow";

  // Input section
  const inputSummary = summarizeInput(block.toolName, block.input);
  const inputDisplay = opts.isExpanded
    ? inputSummary
    : truncate(inputSummary, INPUT_PREVIEW_LINES);

  // Use Syntax for bash commands; otherwise plain RichText
  let inputRenderable: Renderable;
  if (block.toolName === "Bash") {
    inputRenderable = new Syntax(inputDisplay, "bash");
  } else {
    inputRenderable = new RichText(inputDisplay, { end: "" });
  }

  // Result section
  const items: Renderable[] = [inputRenderable];
  if (block.hasResult) {
    items.push(new Rule("result", { style: "dim" }));
    const resultDisplay = opts.isExpanded
      ? block.result
      : truncate(block.result, RESULT_PREVIEW_LINES);
    const resultText = new RichText(resultDisplay || "(empty)", { end: "" });
    if (block.isError) resultText.stylize("red");
    items.push(resultText);
  } else {
    items.push(new Rule("no result", { style: "dim red" }));
  }

  const body = new Group(...items);

  const errorTag = block.isError ? "  ⚠ ERROR" : "";
  const title = `⚙ ${block.toolName}  ${shortTime(block.timestamp)}${errorTag}`;
  return new Panel(body, {
    title,
    borderStyle: borderFor(baseColor, opts.isSelected),
    padding: [0, 1],
  });
}
