import { Panel, RichText, Traceback } from "../../../../src/index.js";
import type { Renderable } from "../../../../src/index.js";
import type { ErrorBlock } from "../../data/types.js";
import { styledTimestamp, borderFor, emoji } from "./_common.js";
import type { RenderOpts } from "./index.js";

export function renderError(block: ErrorBlock, opts: RenderOpts): Renderable {
  // If the error text looks like it contains a stack trace, render it via
  // Traceback so we exercise that renderable and get styled output.
  let body: Renderable;
  if (block.text.includes("\n    at ")) {
    const err = new Error(block.text.split("\n")[0]);
    err.stack = block.text;
    body = new Traceback(err);
  } else {
    const text = new RichText(block.text, { end: "" });
    text.stylize("red");
    body = text;
  }
  const title = new RichText(`${emoji(":cross_mark:")} ${block.errorType}  `, { end: "" });
  title.append(styledTimestamp(block.timestamp));
  return new Panel(body, {
    title,
    borderStyle: borderFor("red", opts.isSelected),
    padding: [0, 1],
  });
}
