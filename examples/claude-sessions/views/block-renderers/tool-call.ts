import { Panel, RichText, Group, Rule, Syntax } from "../../../../src/index.js";
import type { Renderable } from "../../../../src/index.js";
import type { ToolCallBlock } from "../../data/types.js";
import { styledTimestamp, borderFor, truncate, emoji, highlightSearch } from "./_common.js";
import type { RenderOpts } from "./index.js";

const RESULT_PREVIEW_LINES = 12;
const INPUT_PREVIEW_LINES = 8;

function summarizeInput(toolName: string, input: unknown): string {
  if (input === null || input === undefined) return "";
  if (typeof input !== "object") return String(input);
  const obj = input as Record<string, unknown>;

  switch (toolName) {
    case "Bash":
      return `$ ${String(obj["command"] ?? "")}`;
    case "Read":
      return `${emoji(":book:")} ${String(obj["file_path"] ?? "")}`;
    case "Write":
      return `${emoji(":memo:")} ${String(obj["file_path"] ?? "")}`;
    case "Edit":
      return `${emoji(":memo:")} ${String(obj["file_path"] ?? "")}`;
    case "Glob":
      return `${emoji(":magnifying_glass:")} ${String(obj["pattern"] ?? "")}`;
    case "Grep":
      return `${emoji(":magnifying_glass:")} ${String(obj["pattern"] ?? "")}` +
        (obj["path"] ? `  in ${String(obj["path"])}` : "");
    case "WebFetch":
      return `${emoji(":globe:")} ${String(obj["url"] ?? "")}`;
    case "WebSearch":
      return `${emoji(":magnifying_glass:")} ${String(obj["query"] ?? "")}`;
    default:
      return JSON.stringify(input, null, 2);
  }
}

export function renderToolCall(block: ToolCallBlock, opts: RenderOpts): Renderable {
  const baseColor = block.isError ? "red" : "yellow";

  const inputSummary = summarizeInput(block.toolName, block.input);
  const inputDisplay = opts.isExpanded
    ? inputSummary
    : truncate(inputSummary, INPUT_PREVIEW_LINES);

  let inputRenderable: Renderable;
  if (block.toolName === "Bash") {
    inputRenderable = new Syntax(inputDisplay, "bash");
  } else {
    const rt = new RichText(inputDisplay, { end: "" });
    highlightSearch(rt, opts.searchQuery);
    inputRenderable = rt;
  }

  const items: Renderable[] = [inputRenderable];
  if (block.hasResult) {
    items.push(new Rule("result", { style: "dim" }));
    const resultDisplay = opts.isExpanded
      ? block.result
      : truncate(block.result, RESULT_PREVIEW_LINES);
    const resultText = new RichText(resultDisplay || "(empty)", { end: "" });
    if (block.isError) resultText.stylize("red");
    highlightSearch(resultText, opts.searchQuery);
    items.push(resultText);
  } else {
    items.push(new Rule("no result", { style: "dim red" }));
  }

  const body = new Group(...items);

  const errorTag = block.isError ? `  ${emoji(":warning:")} ERROR` : "";
  const title = new RichText(`${emoji(":gear:")} ${block.toolName}  `, { end: "" });
  title.append(styledTimestamp(block.timestamp));
  title.append(errorTag);
  return new Panel(body, {
    title,
    borderStyle: borderFor(baseColor, opts.isSelected),
    padding: [0, 1],
  });
}
