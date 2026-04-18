import { Panel, Group, Rule, RichText } from "../../../../src/index.js";
import type { Renderable } from "../../../../src/index.js";
import type { SubagentBlock } from "../../data/types.js";
import { styledTimestamp, borderFor, truncate, emoji, highlightSearch } from "./_common.js";
import type { RenderOpts } from "./index.js";

const PREVIEW_LINES = 6;

export function renderSubagent(block: SubagentBlock, opts: RenderOpts): Renderable {
  const items: Renderable[] = [];

  if (block.description) {
    const desc = new RichText(block.description, { end: "" });
    desc.stylize("italic");
    highlightSearch(desc, opts.searchQuery);
    items.push(desc);
  }
  const promptDisplay = opts.isExpanded
    ? block.prompt
    : truncate(block.prompt, PREVIEW_LINES);
  const promptText = new RichText(promptDisplay, { end: "" });
  highlightSearch(promptText, opts.searchQuery);
  items.push(promptText);

  if (block.hasResult) {
    items.push(new Rule("result", { style: "dim magenta" }));
    const resultDisplay = opts.isExpanded
      ? block.resultText
      : truncate(block.resultText, PREVIEW_LINES);
    const resultText = new RichText(resultDisplay || "(empty)", { end: "" });
    highlightSearch(resultText, opts.searchQuery);
    items.push(resultText);
  } else {
    items.push(new Rule("no result", { style: "dim red" }));
  }

  const body = new Group(...items);
  const title = new RichText(`${emoji(":robot:")} subagent: ${block.subagentType}  `, { end: "" });
  title.append(styledTimestamp(block.timestamp));
  return new Panel(body, {
    title,
    borderStyle: borderFor("magenta", opts.isSelected),
    padding: [0, 1],
  });
}
