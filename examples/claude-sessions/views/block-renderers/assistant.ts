import { Panel, Markdown, RichText, Padding } from "../../../../src/index.js";
import type { Renderable } from "../../../../src/index.js";
import type { AssistantBlock } from "../../data/types.js";
import { styledTimestamp, borderFor, truncate, emoji, highlightSearch } from "./_common.js";
import type { RenderOpts } from "./index.js";

const PREVIEW_LINES = 25;

export function renderAssistant(block: AssistantBlock, opts: RenderOpts): Renderable {
  const text = opts.isExpanded ? block.text : truncate(block.text, PREVIEW_LINES);
  // Try Markdown rendering — assistant text is often markdown
  let body: Renderable;
  try {
    body = new Markdown(text);
  } catch {
    const rt = new RichText(text, { end: "" });
    highlightSearch(rt, opts.searchQuery);
    body = rt;
  }
  // Wrap in standalone Padding to exercise the Padding renderable
  body = new Padding(body, [1, 0]);

  const tokenCounts = `${block.inputTokens}↑ ${block.outputTokens}↓`;
  const title = new RichText(`${emoji(":sparkles:")} ${block.model}  `, { end: "" });
  title.append(styledTimestamp(block.timestamp));
  title.append(`  ·  ${tokenCounts}`);
  return new Panel(body, {
    title,
    borderStyle: borderFor("blue", opts.isSelected),
    padding: [0, 1],
  });
}
