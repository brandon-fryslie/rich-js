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

import { cellLen, graphemes } from "./cells.js";
import type { TerminalTheme } from "./color.js";
import type { Segment } from "./segment.js";
import {
  escapeAttribute,
  escapeText,
  exportCanvas,
  exportLines,
  type ExportLook,
  type ExportRun,
} from "./export-lines.js";

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

/** Text of printable ASCII only: one cell a character, nothing to box. */
const ONE_CELL = /^[\x20-\x7e]*$/;

/**
 * A box exactly `cells` of the monospace font wide (`ch` is one of its cells)
 * for glyphs the browser would otherwise draw at a fallback font's width,
 * which for a CJK character is rarely two cells: left to it, everything after
 * them on the row shifts off its column. The box carries no paint, so the
 * run's background runs through it at the run's own height; an atomic inline
 * takes no decoration from its ancestors, so it inherits its parent's lines.
 */
const cellBox = (cells: number): readonly string[] =>
  ["display:inline-block", `width:${cells}ch`, "text-align:center", "text-decoration:inherit"];

/**
 * `text` with each stretch of graphemes wider than one cell in one box as wide
 * as their cells together, and `draw` applied to every stretch of escaped text
 * inside and between the boxes. A stretch, not a glyph apiece, because a
 * browser's find-in-page does not match across two boxes. Graphemes, not code
 * points, because `cellLen` measures a joined emoji as one glyph; a zero-width
 * one joins the stretch before it, so it can still combine.
 */
function onGrid(text: string, draw: (escaped: string) => string): string {
  if (ONE_CELL.test(text)) return draw(escapeText(text));
  const pieces: string[] = [];
  let stretch = "";
  let wideCells = 0;
  const flush = () => {
    if (stretch !== "") pieces.push(wideCells === 0 ? draw(escapeText(stretch)) : span(cellBox(wideCells), draw(escapeText(stretch))));
    stretch = "";
    wideCells = 0;
  };
  for (const segment of graphemes(text)) {
    const cells = cellLen(segment);
    const wide = cells === 0 ? wideCells > 0 : cells > 1;
    if (wide !== (wideCells > 0)) flush();
    stretch += segment;
    if (wide) wideCells += cells;
  }
  flush();
  return pieces.join("");
}

/**
 * One run as markup.
 *
 * An element has one `text-decoration-style`, so a double underline sharing a
 * span with a strike would double the strike too. It gets an outer span of its
 * own instead. That span carries the paint, because a descendant's background
 * may be painted over an ancestor's underline, and the blink, so the underline
 * blinks with the glyph. A wide glyph's box sits between the two: it inherits
 * the double underline, and the inner span inside it draws the other lines.
 */
function runHtml({ text, look }: ExportRun): string {
  const drawn = look.underline === "double"
    ? span(
      [...paintCss(look), "text-decoration-line:underline", "text-decoration-style:double", ...BLINK[look.blink]],
      onGrid(text, (glyph) => span([`color:${look.foreground.hex}`, ...glyphCss(look)], glyph)),
    )
    : span([...paintCss(look), ...glyphCss(look)], onGrid(text, (glyph) => glyph));
  return look.href === null
    ? drawn
    : `<a href="${escapeAttribute(look.href)}" style="${ANCHOR_CSS}">${drawn}</a>`;
}

/**
 * The CSS a page includes once, wherever fragments appear: what an inline
 * style cannot say. A fragment that blinks draws steadily without it.
 *
 * The keyframes exist only for a reader who has not asked for reduced motion,
 * so for one who has, the inline `animation` names nothing and the glyph holds
 * still. One rule, so no second rule's order or survival in a host's CSS
 * pipeline can bring the blink back.
 */
export const HTML_FRAGMENT_CSS =
  `@media (prefers-reduced-motion:no-preference){@keyframes ${BLINK_KEYFRAMES}{50%{color:transparent}}}`;

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
 * own code font; unset, the rows are the browser's default monospace at a
 * fixed line height, as a terminal's rows are. A host's value wants one too: at
 * `normal`, a row holding a glyph from a taller fallback font grows and shifts
 * every row below it. It must be a whole shorthand, a size and a family at
 * least: any other value is invalid when computed, and the rows then inherit
 * the host's font.
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
    "font:var(--rich-fragment-font,medium/1.2 monospace)",
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
