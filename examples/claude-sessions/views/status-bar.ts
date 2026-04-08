import { RichText } from "../../../src/index.js";
import type { Renderable } from "../../../src/index.js";
import type { AppState } from "../state.js";

interface Hint {
  readonly key: string;
  readonly label: string;
}

const SIDEBAR_HINTS: ReadonlyArray<Hint> = [
  { key: "↑↓/jk", label: "move" },
  { key: "→/⏎", label: "open" },
  { key: "←/h", label: "back" },
  { key: "tab", label: "focus" },
  { key: "\\", label: "hide" },
  { key: "q", label: "quit" },
];

const VIEWER_HINTS: ReadonlyArray<Hint> = [
  { key: "↑↓/jk", label: "block" },
  { key: "g/G", label: "top/bot" },
  { key: "PgU/D", label: "page" },
  { key: "v", label: "raw" },
  { key: "e", label: "expand" },
  { key: "p", label: "parent" },
  { key: "/", label: "find" },
  { key: "n/N", label: "next/prev" },
  { key: "tab", label: "focus" },
  { key: "\\", label: "side" },
  { key: "q", label: "quit" },
];

export function buildStatusBar(state: AppState): Renderable {
  const text = new RichText("", { end: "" });
  const hints = state.focus === "sidebar" ? SIDEBAR_HINTS : VIEWER_HINTS;
  text.append(" ", "on blue");
  hints.forEach((hint, i) => {
    if (i > 0) text.append("  ", "on blue");
    text.append(hint.key, "bold white on blue");
    text.append(" ", "on blue");
    text.append(hint.label, "white on blue");
  });
  text.append(" ", "on blue");
  return text;
}
