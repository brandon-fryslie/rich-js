import type { Renderable } from "../../../src/index.js";
import type { AppState } from "../state.js";
import { markup } from "./block-renderers/_common.js";

interface Hint {
  readonly key: string;
  readonly label: string;
}

const SIDEBAR_HINTS: ReadonlyArray<Hint> = [
  { key: "↑↓/jk", label: "move" },
  { key: "→/⏎", label: "open" },
  { key: "←", label: "back" },
  { key: "tab", label: "focus" },
  { key: "\\", label: "hide" },
  { key: "S", label: "search all" },
  { key: "q", label: "quit" },
];

const VIEWER_HINTS: ReadonlyArray<Hint> = [
  { key: "↑↓/jk", label: "block" },
  { key: "g/G", label: "top/bot" },
  { key: "⏎", label: "drill" },
  { key: "u", label: "back" },
  { key: "v", label: "raw" },
  { key: "e", label: "expand" },
  { key: "H", label: "hidden" },
  { key: "p", label: "parent" },
  { key: "/", label: "find" },
  { key: "S", label: "find all" },
  { key: "n/N", label: "next/prev" },
  { key: "tab", label: "focus" },
  { key: "q", label: "quit" },
];

const GLOBAL_RESULTS_HINTS: ReadonlyArray<Hint> = [
  { key: "↑↓/jk", label: "hit" },
  { key: "⏎", label: "open" },
  { key: "esc", label: "exit" },
  { key: "q", label: "quit" },
];

/** Build the status bar via renderMarkup — exercises the markup parser. */
export function buildStatusBar(state: AppState): Renderable {
  let hints: ReadonlyArray<Hint>;
  if (state.search.mode === "results-global") {
    hints = GLOBAL_RESULTS_HINTS;
  } else if (state.focus === "sidebar") {
    hints = SIDEBAR_HINTS;
  } else {
    hints = VIEWER_HINTS;
  }
  // Build the entire bar as a single markup string
  const parts = hints.map((h) =>
    `[bold white on blue]${h.key}[/bold white on blue] [white on blue]${h.label}[/white on blue]`,
  );
  const src = `[on blue] ${parts.join("  ")} [/on blue]`;
  return markup(src);
}
