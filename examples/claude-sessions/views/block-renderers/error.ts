import { Panel, RichText } from "../../../../src/index.js";
import type { Renderable } from "../../../../src/index.js";
import type { ErrorBlock } from "../../data/types.js";
import { shortTime, borderFor } from "./_common.js";
import type { RenderOpts } from "./index.js";

export function renderError(block: ErrorBlock, opts: RenderOpts): Renderable {
  const text = new RichText(block.text, { end: "" });
  text.stylize("red");
  const title = `✗ ${block.errorType}  ${shortTime(block.timestamp)}`;
  return new Panel(text, {
    title,
    borderStyle: borderFor("red", opts.isSelected),
    padding: [0, 1],
  });
}
