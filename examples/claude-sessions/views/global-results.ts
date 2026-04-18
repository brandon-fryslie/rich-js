/**
 * Global search results pane. Replaces the viewer when search.mode is
 * "results-global". Renders hits as a scrollable list with selection
 * highlight, scroll-to-cursor, and a summary header.
 */

import { Panel, Segment, RichText } from "../../../src/index.js";
import type { Renderable, RenderOptions } from "../../../src/index.js";
import type { AppState } from "../state.js";
import type { GlobalHit } from "../data/global-search.js";
import { Window } from "../../shared/window.js";
import { highlightSearch } from "./block-renderers/_common.js";

function buildHitLine(hit: GlobalHit, isSelected: boolean, width: number, query: string): RichText {
  const header = new RichText("", { end: "" });
  const prefix = isSelected ? "▶ " : "  ";
  header.append(prefix, isSelected ? "bold yellow" : "dim");
  const loc = `${hit.projectDisplayName} · ${hit.sessionLabel}:${hit.lineNumber}`;
  header.append(loc, isSelected ? "bold cyan" : "cyan");
  header.append("\n    ", "dim");
  const maxSnip = Math.max(20, width - 8);
  const snip = hit.snippet.length > maxSnip
    ? hit.snippet.slice(0, maxSnip) + "…"
    : hit.snippet;
  // Build snippet as its own RichText so we can highlight the search match
  const snippetText = new RichText(snip, { end: "" });
  if (!isSelected) snippetText.stylize("dim");
  highlightSearch(snippetText, query);
  header.append(snippetText);
  return header;
}

class GlobalHitListRenderable implements Renderable {
  constructor(
    private readonly state: AppState,
    private readonly maxLines: number,
  ) {}

  *render(options: RenderOptions): Iterable<Segment> {
    const hits = this.state.search.globalHits;
    if (hits.length === 0) {
      const empty = new RichText(`No results for "${this.state.search.query}"`, { end: "" });
      empty.stylize("dim italic");
      yield* empty.render(options);
      for (let i = 1; i < this.maxLines; i++) yield Segment.line();
      return;
    }

    // Pre-render each hit, track line ranges
    const hitRanges: Array<{ start: number; end: number }> = [];
    const allLines: Segment[][] = [];
    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i]!;
      const isSelected = i === this.state.search.globalCursor;
      const line = buildHitLine(hit, isSelected, options.maxWidth, this.state.search.query);
      const segs = [...line.render(options)];
      const lines = Segment.splitLines(segs);
      const start = allLines.length;
      for (const l of lines) allLines.push(l);
      allLines.push([]); // blank separator
      hitRanges.push({ start, end: allLines.length - 1 });
    }

    // Scroll to keep selected hit in view
    const sel = hitRanges[this.state.search.globalCursor];
    let offset = 0;
    if (sel) {
      const hitHeight = sel.end - sel.start;
      const desired = sel.start - Math.floor((this.maxLines - hitHeight) / 2);
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

export function buildGlobalResults(
  state: AppState,
  innerHeight: number,
  focused: boolean,
): Renderable {
  const list = new GlobalHitListRenderable(state, innerHeight);
  const hits = state.search.globalHits;
  const total = hits.length;
  const cursor = total > 0 ? state.search.globalCursor + 1 : 0;
  const focusPrefix = focused ? "▸ " : "";
  const title = `${focusPrefix}Global Results: "${state.search.query}"  ${cursor}/${total}`;
  return new Panel(new Window(list, innerHeight, 0), {
    title,
    borderStyle: focused ? "bold yellow" : "dim yellow",
    padding: [0, 1],
  });
}
