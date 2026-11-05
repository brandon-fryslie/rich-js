import { RichText, Style, caretMark, render } from "@promptctl/rich-js";
import type { Renderable, RenderOptions, Segment } from "@promptctl/rich-js";
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
      const query = s.query;
      // The editing point is the terminal's own cursor where the painter shows
      // one, so an IME and a screen reader follow it; elsewhere it is drawn.
      // The line opens left to right, so the blank past the query is too and
      // the insertion point is its left side.
      return {
        render(options: RenderOptions): Iterable<Segment> {
          const line = new RichText("", { end: "" });
          line.append(`${sigil} `, "bold yellow on black");
          line.append(`${label}: `, "dim yellow on black");
          line.append(query, "white on black");
          if (options.caret === true) line.append(" ", Style.parse("on black").withCaret(caretMark("bar", "left")));
          else line.append("█", "bold yellow on black");
          line.append("    [⏎] search  [esc] cancel", "dim");
          return render(line, options);
        },
      };
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
