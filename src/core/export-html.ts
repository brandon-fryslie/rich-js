/**
 * export-html — recorded segments drawn as a standalone HTML document.
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
const UNDERLINE: Record<ExportLook["underline"], { readonly line: readonly string[]; readonly style: readonly string[] }> = {
  none: { line: [], style: [] },
  single: { line: ["underline"], style: [] },
  double: { line: ["underline"], style: ["text-decoration-style:double"] },
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
 * One look as inline CSS.
 *
 * Dim arrives already blended into `foreground`. `opacity` is never written:
 * it fades a painted background along with the glyph, which is the bug the
 * blend exists to avoid.
 */
function lookCss(look: ExportLook): string {
  const lines = [
    ...UNDERLINE[look.underline].line,
    ...(look.strike ? ["line-through"] : []),
    ...(look.overline ? ["overline"] : []),
  ];
  return [
    `color:${look.foreground.hex}`,
    ...(look.background === "canvas" ? [] : [`background-color:${look.background.hex}`]),
    ...(look.bold ? ["font-weight:bold"] : []),
    ...(look.italic ? ["font-style:italic"] : []),
    ...(lines.length === 0 ? [] : [`text-decoration-line:${lines.join(" ")}`]),
    ...UNDERLINE[look.underline].style,
    ...BLINK[look.blink],
    ...OUTLINE[look.outline],
  ].join(";");
}

function runHtml({ text, look }: ExportRun): string {
  const span = `<span style="${escapeAttribute(lookCss(look))}">${escapeText(text)}</span>`;
  return look.href === null ? span : `<a href="${escapeAttribute(look.href)}">${span}</a>`;
}

/**
 * `segments` under `theme` as a complete HTML document.
 *
 * The newline written straight after `<pre>` is the one an HTML parser drops,
 * so a recording that opens with a blank row keeps it.
 */
export function encodeHtml(segments: Iterable<Segment>, theme?: TerminalTheme): string {
  const canvas = exportCanvas(theme);
  const rows = exportLines(segments, theme).map((row) => row.map(runHtml).join(""));
  const css = [
    `body{background:${canvas.background.hex};color:${canvas.foreground.hex};padding:1em}`,
    "pre{margin:0;font-family:monospace;white-space:pre;overflow-x:auto}",
    "a{color:inherit;text-decoration:inherit}",
    `@keyframes ${BLINK_KEYFRAMES}{50%{color:transparent}}`,
  ].join("\n");
  return [
    "<!DOCTYPE html>",
    `<html><head><meta charset="utf-8"><style>\n${css}\n</style></head>`,
    `<body><pre>\n${rows.join("\n")}</pre></body></html>`,
  ].join("\n");
}
