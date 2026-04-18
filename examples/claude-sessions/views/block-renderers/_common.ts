/**
 * Shared helpers for block renderers: timestamp formatting, selection
 * border-style helpers, text truncation, emoji, markup, highlighting.
 */

import {
  RichText,
  ISO8601Highlighter,
  RegexHighlighter,
  emojiReplace,
} from "../../../../src/index.js";
import type { Renderable } from "../../../../src/index.js";
import { render as renderMarkup } from "../../../../src/core/markup.js";

// Singleton highlighters
const iso8601 = new ISO8601Highlighter();

/**
 * Render a timestamp as a highlighted RichText. Exercises ISO8601Highlighter:
 * date components, time components, and separators get distinct styles.
 */
export function styledTimestamp(iso: string): RichText {
  if (!iso) return new RichText("", { end: "" });
  const text = new RichText(iso.slice(11, 19) || iso.slice(0, 19), { end: "" });
  iso8601.highlight(text);
  return text;
}

export function truncate(text: string, maxLines: number): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join("\n") + `\n… (${lines.length - maxLines} more lines, press 'e' to expand)`;
}

export function borderFor(baseColor: string, isSelected: boolean): string {
  return isSelected ? `bold ${baseColor}` : baseColor;
}

/** Process emoji shortcodes in a string. Exercises emojiReplace + EMOJI table. */
export function emoji(text: string): string {
  return emojiReplace(text);
}

/** Build styled text via markup syntax. Exercises renderMarkup + Tag parser. */
export function markup(src: string): RichText {
  return renderMarkup(src);
}

/**
 * Highlight search query matches in a RichText via RegexHighlighter with a
 * literal (non-namespace) baseStyle. This exercises the fix where baseStyle
 * without a trailing "." is applied directly instead of being concatenated
 * with the named group.
 */
export function highlightSearch(text: RichText, query: string | undefined): void {
  if (!query || query.length === 0) return;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  class SearchHighlighter extends RegexHighlighter {
    static baseStyle = "bold on yellow";
    static highlights = [new RegExp(`(?<match>${escaped})`, "gi")];
  }
  new SearchHighlighter().highlight(text);
}

/** Wrap a renderable in Padding. Re-exported so renderers don't all import it. */
export { Padding } from "../../../../src/index.js";
export type { Renderable };
