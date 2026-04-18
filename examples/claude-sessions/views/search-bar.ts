import { RichText } from "../../../src/index.js";
import type { Renderable } from "../../../src/index.js";
import type { AppState } from "../state.js";

/**
 * Renders the active search status as a single line. Always returns a
 * renderable (even an empty spacer) so the layout doesn't branch on visibility.
 */
export function buildSearchBar(state: AppState): Renderable {
  const text = new RichText("", { end: "" });
  const s = state.search;
  const scopePrefix = (mode: string): [string, string] => {
    if (mode === "typing-local" || mode === "results-local") return [" /", "local"];
    if (mode === "typing-global" || mode === "results-global") return [" S", "global"];
    return [" ", ""];
  };

  switch (s.mode) {
    case "off":
      text.append(" ");
      return text;
    case "typing-local":
    case "typing-global": {
      const [sigil, label] = scopePrefix(s.mode);
      text.append(`${sigil} `, "bold yellow on black");
      text.append(`${label}: `, "dim yellow on black");
      text.append(s.query, "white on black");
      text.append("█", "bold yellow on black");
      text.append("    [⏎] search  [esc] cancel", "dim");
      return text;
    }
    case "results-local": {
      const total = s.matches.length;
      const cur = total > 0 ? s.cursor + 1 : 0;
      text.append(" / ", "bold yellow on black");
      text.append("local: ", "dim yellow on black");
      text.append(s.query, "white on black");
      text.append(`  ${cur}/${total}`, "yellow");
      text.append("    [n] next  [N] prev  [esc] exit", "dim");
      return text;
    }
    case "results-global": {
      const total = s.globalHits.length;
      const cur = total > 0 ? s.globalCursor + 1 : 0;
      text.append(" S ", "bold yellow on black");
      text.append("global: ", "dim yellow on black");
      text.append(s.query, "white on black");
      text.append(`  ${cur}/${total}`, "yellow");
      text.append("    [⏎] open  [↑↓] move  [esc] exit", "dim");
      return text;
    }
  }
}
