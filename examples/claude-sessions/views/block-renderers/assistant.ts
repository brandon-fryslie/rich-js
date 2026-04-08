import { Panel, Markdown, RichText } from "../../../../src/index.js";
import type { Renderable } from "../../../../src/index.js";
import type { AssistantBlock } from "../../data/types.js";
import { shortTime, borderFor, truncate } from "./_common.js";
import type { RenderOpts } from "./index.js";

const PREVIEW_LINES = 25;

export function renderAssistant(block: AssistantBlock, opts: RenderOpts): Renderable {
  const text = opts.isExpanded ? block.text : truncate(block.text, PREVIEW_LINES);
  // Try Markdown rendering — assistant text is often markdown
  let body: Renderable;
  try {
    body = new Markdown(text);
  } catch {
    body = new RichText(text, { end: "" });
  }
  const tokenCounts = `${block.inputTokens}↑ ${block.outputTokens}↓`;
  const title = `◆ ${block.model}  ${shortTime(block.timestamp)}  ·  ${tokenCounts}`;
  return new Panel(body, {
    title,
    borderStyle: borderFor("blue", opts.isSelected),
    padding: [0, 1],
  });
}
