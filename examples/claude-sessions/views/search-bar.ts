import { RichText } from "../../../src/index.js";
import type { Renderable } from "../../../src/index.js";
import type { AppState } from "../state.js";

/**
 * Renders the active search status as a single line. The renderer always
 * returns *something* — when search is off it returns an empty styled line —
 * so the layout never has to branch on visibility (data-driven, not control-flow).
 */
export function buildSearchBar(state: AppState): Renderable {
  const text = new RichText("", { end: "" });
  const s = state.search;
  if (s.mode === "off") {
    text.append(" ");
  } else if (s.mode === "typing") {
    text.append(" / ", "bold yellow on black");
    text.append(s.query, "white on black");
    text.append("█", "bold yellow on black");
    text.append("    [enter] search  [esc] cancel", "dim");
  } else {
    const total = s.matches.length;
    const cur = total > 0 ? s.cursor + 1 : 0;
    text.append(" / ", "bold yellow on black");
    text.append(s.query, "white on black");
    text.append(`  ${cur}/${total}`, "yellow");
    text.append("    [n] next  [N] prev  [esc] exit", "dim");
  }
  return text;
}
