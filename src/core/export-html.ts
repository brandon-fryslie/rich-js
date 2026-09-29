/**
 * export-html — recorded segments drawn as HTML: a fragment that can sit in
 * a page this library does not own, and a standalone document around it.
 *
 * An encoding of `export-lines` and nothing more. What a run looks like under
 * a theme is decided there; this module decides only how CSS says it. It never
 * sees a `Style`, so it cannot disagree with the SVG exporter about what
 * `reverse` or `dim` means — the two old converters that did disagree were
 * deleted when this replaced them.
 *
 * The rows are already laid out at console width, so `pre` never re-wraps
 * them: `white-space: pre`, and a scrollbar rather than a reflow when the page
 * is narrower than the terminal was.
 */

import type { TerminalTheme } from "./color.js";
import type { Segment } from "./segment.js";
import { exportCanvas, exportLines, type ExportLook, type ExportRun } from "./export-lines.js";

const ENTITIES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

const escapeText = (text: string): string => text.replace(/[&<>]/g, (c) => ENTITIES[c]!);
const escapeAttribute = (value: string): string => value.replace(/[&"<>]/g, (c) => ENTITIES[c]!);

const BLINK_KEYFRAMES = "rich-blink";

// [LAW:dataflow-not-control-flow] Each enum-valued field of a look is a table
// from its values to the declarations it adds, so every value is spelled once
// and `Record` makes a new value a compile error until it has a row.
// A double underline adds no line to the glyph's own span; `runHtml` draws it.
const UNDERLINE_LINE: Record<ExportLook["underline"], readonly string[]> = {
  none: [],
  single: ["underline"],
  double: [],
};

const BLINK: Record<ExportLook["blink"], readonly string[]> = {
  none: [],
  slow: [`animation:${BLINK_KEYFRAMES} 1s step-end infinite`],
  fast: [`animation:${BLINK_KEYFRAMES} 0.5s step-end infinite`],
};

const FRAME = "box-shadow:inset 0 0 0 1px currentColor";

const OUTLINE: Record<ExportLook["outline"], readonly string[]> = {
  none: [],
  frame: [FRAME],
  encircle: [FRAME, "border-radius:0.5em"],
};

/**
 * The glyph colour, and the background when one is painted.
 *
 * Dim arrives already blended into `foreground`. `opacity` is never written:
 * it fades a painted background along with the glyph, which is the bug the
 * blend exists to avoid.
 */
function paintCss(look: ExportLook): string[] {
  return [
    `color:${look.foreground.hex}`,
    ...(look.background === "canvas" ? [] : [`background-color:${look.background.hex}`]),
  ];
}

/** What is drawn on the glyph: weight, slant, single-style lines, blink, outline. */
function glyphCss(look: ExportLook): string[] {
  const lines = [
    ...UNDERLINE_LINE[look.underline],
    ...(look.strike ? ["line-through"] : []),
    ...(look.overline ? ["overline"] : []),
  ];
  return [
    ...(look.bold ? ["font-weight:bold"] : []),
    ...(look.italic ? ["font-style:italic"] : []),
    ...(lines.length === 0 ? [] : [`text-decoration-line:${lines.join(" ")}`]),
    ...BLINK[look.blink],
    ...OUTLINE[look.outline],
  ];
}

// `unset` hands the anchor the run's look and drops the host's `a` rules;
// `revert` gives back the browser's link cursor and focus ring.
const ANCHOR_CSS = "all:unset;cursor:revert;outline:revert";

const span = (css: readonly string[], content: string): string =>
  `<span style="${escapeAttribute(css.join(";"))}">${content}</span>`;

/**
 * One run as markup.
 *
 * An element has one `text-decoration-style`, so a double underline sharing a
 * span with a strike would double the strike too. It gets an outer span of its
 * own instead. That span carries the paint, because a descendant's background
 * may be painted over an ancestor's underline, and the blink, so the underline
 * blinks with the glyph.
 */
function runHtml({ text, look }: ExportRun): string {
  const glyph = escapeText(text);
  const drawn = look.underline === "double"
    ? span(
      [...paintCss(look), "text-decoration-line:underline", "text-decoration-style:double", ...BLINK[look.blink]],
      span([`color:${look.foreground.hex}`, ...glyphCss(look)], glyph),
    )
    : span([...paintCss(look), ...glyphCss(look)], glyph);
  return look.href === null
    ? drawn
    : `<a href="${escapeAttribute(look.href)}" style="${ANCHOR_CSS}">${drawn}</a>`;
}

/**
 * The CSS a page includes once, wherever fragments appear: what an inline
 * style cannot say. A fragment that blinks draws steadily without it.
 *
 * A reader who asked for reduced motion gets the steady glyph too. The blink
 * is an inline `animation`, which no stylesheet rule outranks, so the media
 * query redefines the keyframes it names as empty: the animation still runs
 * and changes nothing.
 */
export const HTML_FRAGMENT_CSS =
  `@keyframes ${BLINK_KEYFRAMES}{50%{color:transparent}}` +
  `@media (prefers-reduced-motion:reduce){@keyframes ${BLINK_KEYFRAMES}{}}`;

/**
 * `segments` under `theme` as one `pre` carrying its canvas, for embedding.
 *
 * [LAW:locality-or-seam] Every rule is inline on the `pre` or below it, so the
 * fragment styles nothing outside itself; the host page keeps its own `body`,
 * `pre` and `a` rules. The seam holds the other way too: `all:initial` stops
 * the host's `pre` rules and inherited typography from reaching the rows, and
 * the two properties `all` does not cover pin the rows left to right.
 *
 * The one way in is the `--rich-fragment-font` custom property, read as the
 * `font` shorthand (`14px/1.3 "JetBrains Mono", monospace`). `all` resets no
 * custom property, so a host sets it on any ancestor to draw the rows in its
 * own code font; unset, the rows are the browser's default monospace. It must
 * be a whole shorthand, a size and a family at least: any other value is
 * invalid when computed, and the rows then inherit the host's font.
 *
 * A browser draws no line for a newline at either edge of a `pre`: the parser
 * drops the one straight after the open tag, and the one before `</pre>` ends a
 * line without starting another. So the fragment opens with a newline of its
 * own and every row ends with one, and a blank first or last row is still drawn.
 */
export function encodeHtmlFragment(segments: Iterable<Segment>, theme?: TerminalTheme): string {
  const canvas = exportCanvas(theme);
  const rows = exportLines(segments, theme).map((row) => `${row.map(runHtml).join("")}\n`);
  const css = [
    "all:initial",
    "direction:ltr",
    "unicode-bidi:isolate",
    "display:block",
    `background:${canvas.background.hex}`,
    `color:${canvas.foreground.hex}`,
    "padding:1em",
    "font:var(--rich-fragment-font,medium monospace)",
    "white-space:pre",
    "overflow-x:auto",
  ].join(";");
  return `<pre style="${css}">\n${rows.join("")}</pre>`;
}

/**
 * `segments` under `theme` as a complete HTML document.
 *
 * [LAW:one-source-of-truth] The document is the fragment in a shell, so the
 * two cannot draw different pictures. The shell paints the page around the
 * `pre` in the same canvas and includes the fragment CSS once.
 */
export function encodeHtml(segments: Iterable<Segment>, theme?: TerminalTheme): string {
  const canvas = exportCanvas(theme);
  const css = `body{background:${canvas.background.hex};color:${canvas.foreground.hex};margin:0}\n${HTML_FRAGMENT_CSS}`;
  return [
    "<!DOCTYPE html>",
    `<html><head><meta charset="utf-8"><style>\n${css}\n</style></head>`,
    `<body>${encodeHtmlFragment(segments, theme)}</body></html>`,
  ].join("\n");
}
