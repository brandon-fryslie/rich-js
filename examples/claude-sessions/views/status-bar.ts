import { escapeMarkup, withCellWidth, type RichText, type Renderable, type RenderOptions, type Segment } from "../../../src/index.js";
import type { AppState } from "../state.js";
import { markup } from "./block-renderers/_common.js";

interface Hint {
  readonly key: string;
  readonly label: string;
}

// Each list leads with what a newcomer needs to get around and out, so a
// narrow bar keeps those and drops the conveniences.
const SIDEBAR_HINTS: ReadonlyArray<Hint> = [
  { key: "↑↓/jk", label: "move" },
  { key: "→/⏎", label: "open" },
  { key: "←", label: "back" },
  { key: "tab", label: "focus" },
  { key: "q", label: "quit" },
  { key: "\\", label: "hide" },
  { key: "S", label: "search all" },
  { key: "^z", label: "suspend" },
];

const VIEWER_HINTS: ReadonlyArray<Hint> = [
  { key: "↑↓/jk", label: "block" },
  { key: "⏎", label: "drill" },
  { key: "u", label: "back" },
  { key: "tab", label: "focus" },
  { key: "q", label: "quit" },
  { key: "/", label: "find" },
  { key: "n/N", label: "next/prev" },
  { key: "g/G", label: "top/bot" },
  { key: "e", label: "expand" },
  { key: "v", label: "raw" },
  { key: "H", label: "hidden" },
  { key: "p", label: "parent" },
  { key: "S", label: "find all" },
  { key: "^z", label: "suspend" },
];

const GLOBAL_RESULTS_HINTS: ReadonlyArray<Hint> = [
  { key: "↑↓/jk", label: "hit" },
  { key: "⏎", label: "open" },
  { key: "esc", label: "exit" },
  { key: "q", label: "quit" },
];

/**
 * One row of hints, as many as fit the width it is drawn at. The hints that
 * do not fit are counted at its end (`+5 more`), so a narrow terminal shows
 * that the bar is cut rather than losing hints without a trace.
 *
 * [LAW:one-source-of-truth] A bar's width is read off the bar itself, so the
 * markup is the only description of its geometry.
 * [LAW:dataflow-not-control-flow] Every width takes the same path: the
 * longest leading run of hints that fits beside the count of the rest, drawn
 * on one row that is cut with an ellipsis when not even the count fits.
 */
class StatusBar implements Renderable {
  constructor(private readonly hints: ReadonlyArray<Hint>) {}

  render(rawOptions: RenderOptions): Iterable<Segment> {
    const options = withCellWidth(rawOptions);
    const shown = Array.from({ length: this.hints.length + 1 }, (_, n) => n)
      .filter((n) => this.bar(n).cellLength <= options.maxWidth)
      .pop() ?? 0;
    const bar = this.bar(shown);
    bar.noWrap = true;
    bar.overflow = "ellipsis";
    return bar.render(options);
  }

  /** The bar showing the first `shown` hints, and the count of the rest when any are left. */
  private bar(shown: number): RichText {
    const parts = this.hints
      .slice(0, shown)
      .map(
        (h) =>
          `[bold white on blue]${escapeMarkup(h.key)}[/bold white on blue] [white on blue]${escapeMarkup(h.label)}[/white on blue]`,
      );
    const rest = this.hints.length - shown;
    const items = rest > 0 ? [...parts, `[italic white on blue]+${rest} more[/italic white on blue]`] : parts;
    return markup(`[on blue] ${items.join("  ")} [/on blue]`);
  }
}

/** The status bar for the current focus. */
export function buildStatusBar(state: AppState): Renderable {
  let hints: ReadonlyArray<Hint>;
  if (state.search.mode === "results-global") {
    hints = GLOBAL_RESULTS_HINTS;
  } else if (state.focus === "sidebar") {
    hints = SIDEBAR_HINTS;
  } else {
    hints = VIEWER_HINTS;
  }
  return new StatusBar(hints);
}
