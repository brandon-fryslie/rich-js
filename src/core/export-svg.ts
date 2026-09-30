/**
 * export-svg — recorded segments drawn as an SVG terminal window: rounded
 * chrome with a title and three window buttons, the rows inside it, every
 * glyph where its terminal cell was, and the text still selectable.
 *
 * An encoding of `export-lines` and nothing more, the same as `export-html`.
 * What a run looks like under a theme is decided there; this module decides
 * only where SVG puts it. It never sees a `Style`.
 *
 * The geometry is Rich's — a 20px character, a cell 0.61 of that wide, a row
 * 1.22 of it tall, the same margin and padding — so a screenshot of the same
 * program matches the library this ports. What is not Rich's is how a glyph
 * lands on its cell. The exporter has no font engine and does not know which
 * font the viewer will draw with, so no advance width can be trusted: a CJK
 * character drawn from a fallback font is rarely two cells, and every glyph
 * after it on the row drifts. So every chunk of a run is anchored at its own
 * column and stretched to its own cells with `textLength`, and alignment is
 * guaranteed by the numbers written here rather than by the font. Measured in
 * headless Chromium on `"ab漢字cd😀ef é̂x"`: Rich's `textLength` (cell width ×
 * string length) was off by up to 12px, one `<text>` a run by 3.9px, this
 * chunking by 0.
 *
 * Decorations are rectangles, not CSS `text-decoration`: SVG has no reliable
 * double underline, and one `text-decoration` property cannot hold an
 * underline and a strike with different styles.
 */

import { cellLen, graphemes } from "./cells.js";
import type { TerminalTheme } from "./color.js";
import type { Segment } from "./segment.js";
import { fnv1a } from "./fnv1a.js";
import {
  escapeAttribute,
  escapeText,
  exportCanvas,
  exportLines,
  type ExportLine,
  type ExportLook,
} from "./export-lines.js";

const CHAR_HEIGHT = 20;
const CELL_WIDTH = CHAR_HEIGHT * 0.61;
const LINE_HEIGHT = CHAR_HEIGHT * 1.22;

const MARGIN = 1;
const PADDING = { top: 40, right: 8, bottom: 8, left: 8 } as const;

/** A painted background sits 1.5px into its row and overlaps the next by a hair, so rows show no seam. */
const CELL_TOP = 1.5;
const CELL_HEIGHT = LINE_HEIGHT + 0.25;

const LINE_THICKNESS = 1.5;

const FONT_FAMILY = `"Fira Code", Menlo, Consolas, "DejaVu Sans Mono", monospace`;

const WINDOW_BUTTONS = ["#ff5f57", "#febc2e", "#28c840"] as const;

/** Coordinates to two decimals, so `3 × 12.2` is written `36.6` and not `36.599999999999994`. */
const n = (value: number): string => String(Math.round(value * 100) / 100);

/**
 * The blink keyframes every SVG defines identically, so one name serves them
 * all: two inlined in one page define the same rule twice, and neither changes
 * the other.
 */
const BLINK_KEYFRAMES = "rich-svg-blink";

/** Text anchored at `column` and stretched to exactly `cells`. */
interface Chunk {
  readonly text: string;
  readonly column: number;
  readonly cells: number;
}

/** A run with the cells it covers on its row. */
interface PlacedRun {
  readonly row: number;
  readonly column: number;
  readonly cells: number;
  readonly look: ExportLook;
  readonly chunks: readonly Chunk[];
}

/**
 * `text` cut into the pieces that are positioned one by one, starting at
 * `column`: consecutive one-cell graphemes share a chunk, since the font's
 * own advance is right for them to within what `textLength` corrects; every
 * wider grapheme is a chunk of its own, since that advance is the one that
 * drifts. A zero-cell grapheme joins the chunk before it so it can still
 * combine, and only when a run opens with one does it stand as a chunk of no
 * cells. Graphemes rather than code points, because `cellLen` measures a
 * joined emoji as one glyph.
 */
function chunk(text: string, column: number): Chunk[] {
  const pieces: { text: string; cells: number; narrow: boolean }[] = [];
  for (const grapheme of graphemes(text)) {
    const cells = cellLen(grapheme);
    const last = pieces[pieces.length - 1];
    if (last !== undefined && (cells === 0 || (cells === 1 && last.narrow))) {
      last.text += grapheme;
      last.cells += cells;
    } else {
      pieces.push({ text: grapheme, cells, narrow: cells === 1 });
    }
  }
  let at = column;
  return pieces.map(({ text, cells }) => {
    const placed = { text, column: at, cells };
    at += cells;
    return placed;
  });
}

/** Every run of every row at the column the runs before it on its row end at. */
function place(rows: readonly ExportLine[]): PlacedRun[] {
  return rows.flatMap((runs, row) => {
    let column = 0;
    return runs.map(({ text, look }) => {
      const chunks = chunk(text, column);
      const cells = chunks.reduce((sum, c) => sum + c.cells, 0);
      const placed = { row, column, cells, look, chunks };
      column += cells;
      return placed;
    });
  });
}

// [LAW:dataflow-not-control-flow] Each enum-valued field of a look is a table
// from its values to what it draws, so `Record` makes a new value a compile
// error until it has a row.
const UNDERLINE_BELOW_BASELINE: Record<ExportLook["underline"], readonly number[]> = {
  none: [],
  single: [2],
  double: [2, 5],
};

const BLINK_PERIOD: Record<ExportLook["blink"], string | null> = {
  none: null,
  slow: "1s",
  fast: "0.5s",
};

const OUTLINE_RADIUS: Record<ExportLook["outline"], number | null> = {
  none: null,
  frame: 0,
  encircle: CELL_WIDTH,
};

/** The CSS a look's class carries: what a glyph's `fill` and font say, and its blink. */
function lookCss(look: ExportLook): string {
  const period = BLINK_PERIOD[look.blink];
  return [
    `fill:${look.foreground.hex}`,
    ...(look.bold ? ["font-weight:bold"] : []),
    ...(look.italic ? ["font-style:italic"] : []),
    ...(period === null ? [] : [`animation:${BLINK_KEYFRAMES} ${period} step-end infinite`]),
  ].join(";");
}

const cellBox = (run: PlacedRun): string =>
  `x="${n(run.column * CELL_WIDTH)}" y="${n(run.row * LINE_HEIGHT + CELL_TOP)}" ` +
  `width="${n(run.cells * CELL_WIDTH)}" height="${n(CELL_HEIGHT)}"`;

/** A run's painted background; a run showing the canvas paints nothing. */
function backgroundSvg(run: PlacedRun): string[] {
  return run.look.background === "canvas"
    ? []
    : [`<rect fill="${run.look.background.hex}" ${cellBox(run)} shape-rendering="crispEdges"/>`];
}

function textSvg({ text, column, cells }: Chunk, baseline: number): string {
  // A chunk of no cells has no length to stretch to; it takes the font's.
  const length = cells === 0 ? "" : ` textLength="${n(cells * CELL_WIDTH)}" lengthAdjust="spacingAndGlyphs"`;
  return `<text x="${n(column * CELL_WIDTH)}" y="${n(baseline)}"${length} xml:space="preserve">${escapeText(text)}</text>`;
}

/**
 * One run: its glyphs, then its lines and outline over them, in a group whose
 * class carries the look — so the lines take the glyph's `fill` and blink
 * with it. The outline is a stroke, so it names its colour itself.
 */
function runSvg(run: PlacedRun, className: string): string {
  const { look } = run;
  const top = run.row * LINE_HEIGHT;
  const baseline = top + CHAR_HEIGHT;
  const x = n(run.column * CELL_WIDTH);
  const width = n(run.cells * CELL_WIDTH);
  const lineYs = [
    ...UNDERLINE_BELOW_BASELINE[look.underline].map((offset) => baseline + offset),
    ...(look.strike ? [baseline - 6] : []),
    ...(look.overline ? [top + CELL_TOP] : []),
  ];
  const radius = OUTLINE_RADIUS[look.outline];
  const drawn = [
    ...run.chunks.map((c) => textSvg(c, baseline)),
    ...lineYs.map((y) => `<rect x="${x}" y="${n(y)}" width="${width}" height="${LINE_THICKNESS}"/>`),
    ...(radius === null
      ? []
      : [`<rect ${cellBox(run)} rx="${n(radius)}" fill="none" stroke="${look.foreground.hex}" stroke-width="1"/>`]),
  ].join("");
  const group = `<g class="${className}">${drawn}</g>`;
  return look.href === null ? group : `<a href="${escapeAttribute(look.href)}">${group}</a>`;
}

export interface SvgOptions {
  readonly theme?: TerminalTheme;
  /** The window title, centred in the chrome. */
  readonly title: string;
  /** The console width in cells; a wider row widens the window rather than being clipped. */
  readonly width: number;
}

/**
 * `segments` under `theme` as a standalone SVG document.
 *
 * Every background is painted before any glyph, so no run's paint covers its
 * neighbour's text. Whitespace is emitted as real spaces under
 * `xml:space="preserve"`, never as `&#160;`, so a selection copies what the
 * terminal showed.
 */
export function encodeSvg(segments: Iterable<Segment>, { theme, title, width }: SvgOptions): string {
  const canvas = exportCanvas(theme);
  const rows = exportLines(segments, theme);
  const runs = place(rows);

  // The prefix every class name carries is a hash of the rules those classes
  // define as well as of what is drawn, since a class is page-wide once the
  // SVG is inlined: two exports that share a prefix define every rule alike, so
  // the same recording under another theme cannot restyle this one.
  const styled = runs.map((run) => ({ run, css: lookCss(run.look) }));
  const rules = [...new Set(styled.map(({ css }) => css))];
  const text = rows.map((row) => row.map((run) => run.text).join("")).join("\n");
  const id = `terminal-${fnv1a(`${title.length}:${title}${text.length}:${text}${rules.join("\n")}`)}`;
  const classOf = (css: string): string => `${id}-r${rules.indexOf(css) + 1}`;
  const drawnRuns = styled.map(({ run, css }) => runSvg(run, classOf(css)));

  const columns = runs.reduce((widest, run) => Math.max(widest, run.column + run.cells), width);
  const terminalWidth = Math.ceil(columns * CELL_WIDTH + PADDING.left + PADDING.right);
  const terminalHeight = rows.length * LINE_HEIGHT + PADDING.top + PADDING.bottom;

  const stylesheet = [
    `.${id}-matrix{font-family:${FONT_FAMILY};font-size:${CHAR_HEIGHT}px}`,
    `.${id}-title{font-size:18px;font-weight:bold;font-family:arial}`,
    ...rules.map((css) => `.${classOf(css)}{${css}}`),
    // Blink only for a reader who has not asked for reduced motion, as in HTML.
    `@media (prefers-reduced-motion:no-preference){@keyframes ${BLINK_KEYFRAMES}{50%{fill:transparent}}}`,
  ].join("\n");

  return [
    `<svg class="rich-terminal" viewBox="0 0 ${n(terminalWidth + 2 * MARGIN)} ${n(terminalHeight + 2 * MARGIN)}" xmlns="http://www.w3.org/2000/svg">`,
    `<style>\n${stylesheet}\n</style>`,
    // [LAW:one-source-of-truth] The frame is the theme's ink at Rich's 35%, not
    // Rich's fixed white: that white is invisible around a light theme's canvas.
    `<rect fill="${canvas.background.hex}" stroke="${canvas.foreground.hex}" stroke-opacity="0.35" stroke-width="1" ` +
      `x="${MARGIN}" y="${MARGIN}" width="${n(terminalWidth)}" height="${n(terminalHeight)}" rx="8"/>`,
    `<text class="${id}-title" fill="${canvas.foreground.hex}" text-anchor="middle" ` +
      `x="${n(MARGIN + terminalWidth / 2)}" y="${MARGIN + CHAR_HEIGHT + 6}">${escapeText(title)}</text>`,
    `<g transform="translate(26,22)">${WINDOW_BUTTONS.map((fill, i) => `<circle cx="${i * 22}" cy="0" r="7" fill="${fill}"/>`).join("")}</g>`,
    `<g class="${id}-matrix" transform="translate(${MARGIN + PADDING.left},${MARGIN + PADDING.top})">`,
    ...runs.flatMap(backgroundSvg),
    ...drawnRuns,
    `</g>`,
    `</svg>`,
  ].join("\n");
}
