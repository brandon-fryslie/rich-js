import { Rule, RichText } from "@promptctl/rich-js";
import type { Renderable } from "@promptctl/rich-js";
import type { RecordBlock } from "../../data/types.js";
import type { RenderOpts } from "./index.js";

/** A hidden record, out of the conversation's way: a rule naming its type. Its raw view has the rest. */
export function renderRecord(block: RecordBlock, opts: RenderOpts): Renderable {
  const style = opts.isSelected ? "bold white" : "dim white";
  return new Rule(new RichText(block.recordType, { style }), { style, characters: "┄" });
}
