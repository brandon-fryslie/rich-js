/**
 * export-lines — recorded segments resolved against a `TerminalTheme` into the
 * lines every exporter draws.
 *
 * The HTML and SVG exporters are two encodings of one picture, and this module
 * is the picture. What a styled cell *looks like* — which colour its glyph is,
 * whether its background is painted, which decorations it carries, where it
 * links — is decided here, once, and an exporter decides only how to write
 * that down. Before it existed the decision was made twice, by
 * `Style.getHtmlStyle` and by `Console`'s private CSS converter, and the two
 * had already disagreed: one honoured `underline2`, the other dropped it.
 *
 * [LAW:types-are-the-program] `ExportLook` has no `reverse`, `dim`, `conceal`
 * or default colour, because all four are consumed by `resolveLook` and turned
 * into plain RGB. An exporter holding a look cannot forget to swap a reversed
 * run or to fade a dim one: there is nothing left in its hands to forget. That
 * is the whole reason the representation is resolved rather than a `Style`
 * handed through.
 *
 * Runs rather than a cell grid. A grid gives a wide character a phantom
 * continuation cell every consumer must know to skip, and gives an HTML
 * exporter — which lays text out by flowing it — nothing it needs. A run's
 * column and cell width are `cellLen` of the text before it and of its own
 * text; they are not stored, so they cannot disagree with the text
 * [LAW:one-source-of-truth]. The SVG exporter, the one consumer that positions
 * anything, derives them.
 *
 * Browser-safe by construction: this imports `color`, `style`, `segment` and
 * nothing that touches the host, so `Console` can reach it from the main
 * barrel and the fs half of exporting stays in `src/node/save.ts`.
 */

import { blendRgb, ColorSpec, type ColorRgba, type TerminalTheme } from "./color.js";
import { NULL_STYLE, type Style } from "./style.js";
import type { Segment } from "./segment.js";

declare const _href: unique symbol;

/**
 * A link target that is safe to write into a published document.
 *
 * [LAW:parse-dont-validate] Only `parseHref` produces one, so an exporter that
 * writes an `href` attribute from an `Href` cannot have skipped the check.
 */
export type Href = string & { readonly [_href]: true };

/**
 * Where a run's background comes from. `"canvas"` is the theme background
 * showing through — nothing painted — and is distinct from a painted colour
 * that happens to equal it, because `on default` and `on #000000` are
 * different requests even over a black theme.
 */
export type Background = ColorRgba | "canvas";

/** Everything an exporter needs to draw one run, and nothing left to resolve. */
export interface ExportLook {
  readonly foreground: ColorRgba;
  readonly background: Background;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: "none" | "single" | "double";
  readonly strike: boolean;
  readonly overline: boolean;
  readonly blink: "none" | "slow" | "fast";
  readonly outline: "none" | "frame" | "encircle";
  readonly href: Href | null;
}

export interface ExportRun {
  readonly text: string;
  readonly look: ExportLook;
}

/** One terminal row, left to right. An empty array is a blank row. */
export type ExportLine = readonly ExportRun[];

/**
 * The URL schemes an export will link.
 *
 * A terminal hands an OSC 8 target to the user's opener; an exported page hands
 * it to whoever loads the page, and exports are made to be published. A
 * `javascript:` target that was inert in a terminal is script in a README. The
 * list is an allowance, not a denylist, so a scheme nobody considered is
 * refused rather than trusted.
 */
const LINKABLE_SCHEMES: ReadonlySet<string> = new Set(["http:", "https:", "mailto:", "ftp:", "file:"]);

/**
 * `Style.link` as a link an export may write, or `null` when it may not.
 *
 * A refused link loses only its target: the run keeps its text and every other
 * attribute, so nothing the terminal showed disappears from the export. The
 * canonical `URL.href` is what comes back, since the parse is what vouches for
 * it.
 */
export function parseHref(link: string): Href | null {
  if (!URL.canParse(link)) return null;
  const url = new URL(link);
  return LINKABLE_SCHEMES.has(url.protocol) ? (url.href as Href) : null;
}

/**
 * How far a dim glyph moves toward its background — Rich's own factor, so an
 * export of the same program matches the library this ports.
 */
const DIM_FADE = 0.4;

const DEFAULT_COLOR = ColorSpec.default();

/**
 * A `Style` as it appears on screen under `theme`.
 *
 * The order is the terminal's: colours resolve through the theme and lose
 * their alpha — paper over the canvas, ink over the paper, as `toSgrCodes`
 * flattens them — `reverse` swaps them, `dim` fades the glyph toward whatever
 * background it ended up on, and `conceal` finally paints the glyph in that
 * background. Every step after flattening works on opaque colour, so no
 * exporter ever draws a translucent one. Text under `conceal` is still
 * present, and still selectable, in both formats.
 *
 * The one difference from `toSgrCodes` is the substrate: a terminal cannot
 * know what lies under its cells and assumes black, while an export draws its
 * own canvas and flattens over that.
 *
 * `theme` omitted is `ColorSpec.getTruecolor`'s own fallback — black canvas,
 * white ink, the standard ANSI table. Choosing it there rather than naming a
 * preset here is what keeps `core/` from a third upward edge into `themes/`.
 */
export function resolveLook(style: Style, theme?: TerminalTheme): ExportLook {
  const inkSpec = style.color ?? DEFAULT_COLOR;
  const paperSpec = style.bgcolor ?? DEFAULT_COLOR;
  const canvas = DEFAULT_COLOR.getTruecolor(theme, false);
  // [LAW:single-enforcer] `flattenAlpha` is the one place alpha is composited.
  const paper = paperSpec.flattenAlpha(canvas).getTruecolor(theme, false);
  const ink = inkSpec.flattenAlpha(paper).getTruecolor(theme, true);

  // A reversed run always paints: its background is the ink, which is never
  // the canvas, even when the ink is the theme's default foreground.
  const glyph = style.reverse ? paper : ink;
  const ground = style.reverse ? ink : paper;
  const background: Background = style.reverse || !paperSpec.isDefault ? ground : "canvas";

  const faded = style.dim ? blendRgb(glyph, ground, DIM_FADE) : glyph;

  return {
    foreground: style.conceal ? ground : faded,
    background,
    bold: style.bold === true,
    italic: style.italic === true,
    underline: style.underline2 ? "double" : style.underline ? "single" : "none",
    strike: style.strike === true,
    overline: style.overline === true,
    blink: style.blink2 ? "fast" : style.blink ? "slow" : "none",
    outline: style.encircle ? "encircle" : style.frame ? "frame" : "none",
    href: style.link === undefined ? null : parseHref(style.link),
  };
}

/**
 * Recorded segments as terminal rows under `theme`.
 *
 * `"\n"` ends a row, so output that ends with a newline — every `print` does —
 * has no empty row after it, and `"a\n\nb"` keeps its blank row. Callers pass
 * the recording buffer, which already holds no control segments.
 */
export function exportLines(segments: Iterable<Segment>, theme?: TerminalTheme): ExportLine[] {
  const rows: ExportRun[][] = [[]];
  for (const segment of segments) {
    const look = resolveLook(segment.style ?? NULL_STYLE, theme);
    segment.text.split("\n").forEach((piece, index) => {
      if (index > 0) rows.push([]);
      if (piece.length > 0) rows[rows.length - 1]!.push({ text: piece, look });
    });
  }
  return rows[rows.length - 1]!.length === 0 ? rows.slice(0, -1) : rows;
}
