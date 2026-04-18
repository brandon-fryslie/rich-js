import { Panel, Pretty, RichText } from "../../../../src/index.js";
import type { Renderable } from "../../../../src/index.js";
import type { Block } from "../../data/types.js";
import { styledTimestamp, borderFor } from "./_common.js";
import type { RenderOpts } from "./index.js";

export function renderRaw(block: Block, opts: RenderOpts): Renderable {
  const pretty = new Pretty(block.raw, {
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
