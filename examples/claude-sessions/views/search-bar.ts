import { Measurement, RichText, Style, caretMark, render } from "@promptctl/rich-js";
import type { Measurable, Renderable, RenderOptions, Segment } from "@promptctl/rich-js";
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
      // The cell past the query holds none of it (`Style.asTextEnd`), so it is
      // shown beside the character typed last, whatever direction ends it.
      const line = (marked: boolean): RichText => {
        const out = new RichText("", { end: "" });
        out.append(`${sigil} `, "bold yellow on black");
        out.append(`${label}: `, "dim yellow on black");
        out.append(query, "white on black");
        if (marked) out.append(" ", Style.parse("on black").asTextEnd.withCaret(caretMark("bar")));
        else out.append("█", Style.parse("bold yellow on black").asTextEnd);
        out.append("    [⏎] search  [esc] cancel", "dim");
        return out;
      };
      const marked = line(true);
      const drawn = line(false);
      const bar: Renderable & Measurable = {
        render: (options: RenderOptions): Iterable<Segment> => render(options.caret === true ? marked : drawn, options),
        measure: (options: RenderOptions) => Measurement.get(options, options.caret === true ? marked : drawn),
      };
      return bar;
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
