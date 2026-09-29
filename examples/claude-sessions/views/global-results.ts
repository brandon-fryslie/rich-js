/**
 * Global search results pane. Replaces the viewer when search.mode is
 * "results-global". Renders hits as a scrollable list with selection
 * highlight, scroll-to-cursor, and a summary header.
 */

import { Panel, RichText } from "../../../src/index.js";
import type { Renderable, Viewport } from "../../../src/index.js";
import type { AppState } from "../state.js";
import type { GlobalHit } from "../data/global-search.js";
import { highlightSearch } from "./block-renderers/_common.js";
import { ItemsInView } from "./items-in-view.js";

function buildHitLine(hit: GlobalHit, isSelected: boolean, query: string): RichText {
  // Each line of a hit ends at the pane's edge rather than wrapping under it.
  const header = new RichText("", { end: "", noWrap: true, overflow: "ellipsis" });
  const prefix = isSelected ? "▶ " : "  ";
  header.append(prefix, isSelected ? "bold yellow" : "dim");
  const loc = `${hit.projectDisplayName} · ${hit.sessionLabel}:${hit.lineNumber}`;
  header.append(loc, isSelected ? "bold cyan" : "cyan");
  header.append("\n    ", "dim");
  // Build snippet as its own RichText so we can highlight the search match
  const snippetText = new RichText(hit.snippet, { end: "" });
  if (!isSelected) snippetText.stylize("dim");
  highlightSearch(snippetText, query);
  header.append(snippetText);
  return header;
}

function hitItems(state: AppState): Renderable[] {
  const { globalHits, globalCursor, query } = state.search;
  if (globalHits.length === 0) {
    const empty = new RichText(`No results for "${query}"`, { end: "" });
    empty.stylize("dim italic");
    return [empty];
  }
  return globalHits.map((hit, i) => buildHitLine(hit, i === globalCursor, query));
}

export function buildGlobalResults(
  state: AppState,
  viewport: Viewport,
  focused: boolean,
): Renderable {
  const hits = state.search.globalHits;
  const total = hits.length;
  const cursor = total > 0 ? state.search.globalCursor + 1 : 0;
  const focusPrefix = focused ? "▸ " : "";
  const title = `${focusPrefix}Global Results: "${state.search.query}"  ${cursor}/${total}`;
  return new Panel(new ItemsInView(viewport, hitItems(state), state.search.globalCursor), {
    title,
    borderStyle: focused ? "bold yellow" : "dim yellow",
    padding: [0, 1],
  });
}
