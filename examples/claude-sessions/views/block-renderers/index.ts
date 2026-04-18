/**
 * Dispatch table: BlockKind → renderer function. Adding a new BlockKind
 * means adding a renderer file and one row here. No edits to viewer.ts.
 */

import type { Block } from "../../data/types.js";
import type { Renderable } from "../../../../src/index.js";
import { renderHuman } from "./human.js";
import { renderAssistant } from "./assistant.js";
import { renderToolCall } from "./tool-call.js";
import { renderSubagent } from "./subagent.js";
import { renderSystem } from "./system-event.js";
import { renderError } from "./error.js";
import { renderRaw } from "./raw.js";

export interface RenderOpts {
  readonly isSelected: boolean;
  readonly isExpanded: boolean;
  readonly viewMode: "pretty" | "raw";
  readonly searchQuery?: string;
}

export function renderBlock(block: Block, opts: RenderOpts): Renderable {
  if (opts.viewMode === "raw") return renderRaw(block, opts);
  switch (block.kind) {
    case "human": return renderHuman(block, opts);
    case "assistant": return renderAssistant(block, opts);
    case "tool-call": return renderToolCall(block, opts);
    case "subagent": return renderSubagent(block, opts);
    case "system": return renderSystem(block, opts);
    case "error": return renderError(block, opts);
  }
}
