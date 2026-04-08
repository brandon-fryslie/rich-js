import { RichText } from "../../../src/index.js";
import type { Renderable } from "../../../src/index.js";

const HINTS: ReadonlyArray<[string, string]> = [
  ["↑↓/jk", "move"],
  ["→/enter", "open"],
  ["←/h", "up"],
  ["tab", "focus"],
  ["g/G", "top/bot"],
  ["PgUp/Dn", "page"],
  ["q/esc", "quit"],
];

export function buildStatusBar(): Renderable {
  const text = new RichText("", { end: "" });
  text.append(" ", "on blue");
  HINTS.forEach(([key, label], i) => {
    if (i > 0) text.append("  ", "on blue");
    text.append(key, "bold white on blue");
    text.append(" ", "on blue");
    text.append(label, "white on blue");
  });
  text.append(" ", "on blue");
  return text;
}
