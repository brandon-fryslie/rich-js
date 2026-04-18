import { Panel, RichText } from "../../../../src/index.js";
import type { Renderable } from "../../../../src/index.js";
import type { HumanBlock } from "../../data/types.js";
import { styledTimestamp, borderFor, truncate, emoji, highlightSearch } from "./_common.js";
import type { RenderOpts } from "./index.js";

const PREVIEW_LINES = 12;

export function renderHuman(block: HumanBlock, opts: RenderOpts): Renderable {
  const text = opts.isExpanded ? block.text : truncate(block.text, PREVIEW_LINES);
  const body = new RichText(text, { end: "" });
  if (block.isMeta) body.stylize("dim italic");
  highlightSearch(body, opts.searchQuery);
  const kind = block.isMeta ? emoji(":gear: meta") : emoji(":person: user");
  const title = new RichText(`${kind}  `, { end: "" });
  title.append(styledTimestamp(block.timestamp));
  return new Panel(body, {
    title,
    borderStyle: borderFor("cyan", opts.isSelected),
    padding: [0, 1],
  });
}
