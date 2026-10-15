import { Panel, Pretty, RichText } from "@promptctl/rich-js";
import type { Renderable } from "@promptctl/rich-js";
import type { Block } from "../../data/types.js";
import { styledTimestamp, borderFor } from "./_common.js";
import type { RenderOpts } from "./index.js";

export function renderRaw(block: Block, opts: RenderOpts): Renderable {
  // The records as they were read, one or several (data/types.ts, `source`).
  const pretty = new Pretty(block.source.length === 1 ? block.source[0]!.parsed : block.source.map((line) => line.parsed), {
    indent: 2,
    expandAll: true,
    maxString: 500,
  });
  const title = new RichText(`{ } ${block.kind}  `, { end: "" });
  title.append(styledTimestamp(block.timestamp));
  title.append("  [raw]");
  return new Panel(pretty, {
    title,
    borderStyle: borderFor("white", opts.isSelected),
    padding: [0, 1],
  });
}
