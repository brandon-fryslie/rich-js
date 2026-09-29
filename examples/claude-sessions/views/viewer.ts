/**
 * Viewer pane: renders Block[] vertically, scrolled to keep the selected
 * block in view.
 */

import { Panel, RichText } from "../../../src/index.js";
import type { Renderable } from "../../../src/index.js";
import type { AppState } from "../state.js";
import type { SessionsView } from "./shell.js";
import { renderBlock } from "./block-renderers/index.js";
import { buildGlobalResults } from "./global-results.js";
import { ItemsInView } from "./items-in-view.js";

function blockItems(state: AppState): Renderable[] {
  if (state.blocks.length === 0) {
    const empty = new RichText("(no session loaded — pick one in the sidebar)", { end: "" });
    empty.stylize("dim italic");
    return [empty];
  }
  const searchQuery = state.search.mode === "results-local" ? state.search.query : undefined;
  return state.blocks.map((block, i) =>
    renderBlock(block, {
      isSelected: i === state.selectedBlockIndex,
      isExpanded: state.expanded.has(i),
      viewMode: state.viewMode,
      searchQuery,
    }),
  );
}

export function buildViewer(state: AppState, view: SessionsView, focused: boolean): Renderable {
  // Data-driven swap: when global search results are active, the viewer
  // pane renders the hit list instead of the block list.
  if (state.search.mode === "results-global") {
    return buildGlobalResults(state, view.results.of(state.search.query), focused);
  }

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
  return new Panel(new ItemsInView(view.viewer.of(state.loadedSessionPath ?? ""), blockItems(state), state.selectedBlockIndex), {
    title: `${focusPrefix}${sessionName}${blockInfo}${depthTag}${modeTag}${hiddenTag}`,
    borderStyle: focused ? "bold green" : "dim green",
    padding: [0, 1],
  });
}
