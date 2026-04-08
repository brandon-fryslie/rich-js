import { Panel, JSONRenderable } from "../../../../src/index.js";
import type { Renderable } from "../../../../src/index.js";
import type { Block } from "../../data/types.js";
import { shortTime, borderFor } from "./_common.js";
import type { RenderOpts } from "./index.js";

export function renderRaw(block: Block, opts: RenderOpts): Renderable {
  const json = JSONRenderable.fromData(block.raw, { indent: 2 });
  const title = `{ } ${block.kind}  ${shortTime(block.timestamp)}  [raw]`;
  return new Panel(json, {
    title,
    borderStyle: borderFor("white", opts.isSelected),
    padding: [0, 1],
  });
}
