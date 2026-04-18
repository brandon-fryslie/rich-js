/**
 * Viewer pane: renders Block[] vertically, with the selected block centered
 * in the visible window. Pre-renders each block to lines so we can compute
 * the exact line range of the selected block and scroll to it.
 */

import { Panel, Segment, RichText } from "../../../src/index.js";
import type { Renderable, RenderOptions } from "../../../src/index.js";
import type { AppState } from "../state.js";
import { renderBlock } from "./block-renderers/index.js";
import { buildGlobalResults } from "./global-results.js";

class BlockListRenderable implements Renderable {
  constructor(
    private readonly state: AppState,
    private readonly maxLines: number,
  ) {}

  *render(options: RenderOptions): Iterable<Segment> {
    if (this.state.blocks.length === 0) {
      const empty = new RichText("(no session loaded — pick one in the sidebar)", { end: "" });
      empty.stylize("dim italic");
      yield* empty.render(options);
      // Pad to maxLines
      for (let i = 1; i < this.maxLines; i++) yield Segment.line();
      return;
    }

    // Render each block, track line ranges
    const blockLineRanges: Array<{ start: number; end: number }> = [];
    const allLines: Segment[][] = [];
    for (let i = 0; i < this.state.blocks.length; i++) {
      const block = this.state.blocks[i]!;
      const searchQuery = this.state.search.mode === "results-local"
        ? this.state.search.query
        : undefined;
      const renderable = renderBlock(block, {
        isSelected: i === this.state.selectedBlockIndex,
        isExpanded: this.state.expanded.has(i),
        viewMode: this.state.viewMode,
        searchQuery,
      });
      const segs = [...renderable.render(options)];
      const lines = Segment.splitLines(segs);
      const start = allLines.length;
      for (const line of lines) allLines.push(line);
      // Add a blank line between blocks for readability
      allLines.push([]);
      blockLineRanges.push({ start, end: allLines.length - 1 });
    }

    // Compute scroll offset so the selected block is centered
    const sel = blockLineRanges[this.state.selectedBlockIndex];
    let offset = 0;
    if (sel) {
      const blockHeight = sel.end - sel.start;
      const desired = sel.start - Math.floor((this.maxLines - blockHeight) / 2);
      const maxOffset = Math.max(0, allLines.length - this.maxLines);
      offset = Math.max(0, Math.min(desired, maxOffset));
    }

    const slice = allLines.slice(offset, offset + this.maxLines);
    while (slice.length < this.maxLines) slice.push([]);

    for (const line of slice) {
      yield* line;
      yield Segment.line();
    }
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 1, maximum: Number.MAX_SAFE_INTEGER };
  }
}

export function buildViewer(state: AppState, innerHeight: number, focused: boolean): Renderable {
  // Data-driven swap: when global search results are active, the viewer
  // pane renders the hit list instead of the block list.
  if (state.search.mode === "results-global") {
    return buildGlobalResults(state, innerHeight, focused);
  }

  const list = new BlockListRenderable(state, innerHeight);
  const focusPrefix = focused ? "▸ " : "";
  const stackDepth = state.sessionStack.length;
  const depthTag = stackDepth > 0 ? ` (depth ${stackDepth})` : "";
  const sessionName = state.loadedSessionPath
    ? state.loadedSessionPath.split("/").pop() ?? "session"
    : "Viewer";
  const blockInfo = state.blocks.length > 0
    ? `  ${state.selectedBlockIndex + 1}/${state.blocks.length}`
    : "";
  const modeTag = state.viewMode === "raw" ? "  [raw]" : "";
  const hiddenTag = state.showHidden ? "  [+hidden]" : "";
  return new Panel(list, {
    title: `${focusPrefix}${sessionName}${blockInfo}${depthTag}${modeTag}${hiddenTag}`,
    borderStyle: focused ? "bold green" : "dim green",
    padding: [0, 1],
  });
}
