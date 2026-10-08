/**
 * effects-feel — what the effects are tried on: a powerline strip and a run
 * of text, drawn in a theme, and how a loop is settled on the colours they
 * draw. The demo's screen (app.ts) shows them, and so does each card on the
 * docs' effects playground page (examples/effects-playground/kit.ts), which
 * runs this file as one of its program's files.
 *
 * So it imports the library by its published names, as a card's file does
 * (docs/.vitepress/demo-card.ts), and nothing from node.
 */

import {
  ColorDepth,
  ColorRgba,
  ColorSpec,
  Measurement,
  PowerlineJoiner,
  RichText,
  Segment,
  Strip,
  Style,
  cellLen,
  ensureContrast,
  graphemes,
  onColors,
  shares,
  type Effect,
  type Joiner,
  type Loop,
  type Measurable,
  type Pair,
  type Renderable,
  type RenderOptions,
  type StyledRenderable,
  type TerminalTheme,
} from "@promptctl/rich-js";

const STRIP_LABELS = [
  "main", "+3 ~2", "claude.ai", "opus", "3.4k tok", "12%",
  "$0.42", "ctx 61%", "rich-js", "effects", "14:02", "ok",
];
const STRIP_KEYS = ["primary", "secondary", "accent", "success", "warning", "error"] as const;

const TEXT = "Thinking about how a band of light should cross these words at one frame a second…";

/** The status line's contrast against the ground: WCAG's AAA for body text. */
const STATUS_CONTRAST = 7;

/**
 * A thing the effects are tried on: a powerline strip, which sets its cells'
 * fill and lettering, or a run of text, which sets only its ink.
 */
export interface Subject {
  readonly name: string;
  readonly renderable: Renderable & Measurable;
  /** Where it sits in the noise, so two subjects under one effect never move in lockstep. */
  readonly z: number;
}

/**
 * A subject as a run draws it, measured once at startup and read by every
 * frame: whole, at its own width whatever the terminal's — a sweep crosses
 * the element, not the screen — and at the run's depth.
 */
export interface DrawnSubject extends Subject {
  readonly options: RenderOptions;
  /** Its width in columns. */
  readonly span: number;
  /** The colours it sets in the cells it draws text in, by hex, as the screen shows them. */
  readonly colors: ReadonlySet<string>;
  /** Every distinct ink and ground of a cell it draws text in, as the screen shows them. */
  readonly pairs: readonly Pair[];
  /** `row:col` of every cell it draws text in. */
  readonly text: ReadonlySet<string>;
}

/** A cell of finished output: where it is, its glyph, and the style it is drawn with. */
export interface Cell {
  readonly at: string;
  readonly glyph: string;
  readonly style: Style;
}

/**
 * Finished output cell by cell. [LAW:one-source-of-truth] It walks graphemes
 * by `graphemes()`, as `Effected` does, so a position here is the one an
 * effect was handed.
 */
export function cellsOf(segments: Iterable<Segment>): Cell[] {
  const cells: Cell[] = [];
  let row = 0;
  let col = 0;
  for (const segment of segments) {
    if (segment.isControl) continue;
    for (const glyph of graphemes(segment.text)) {
      if (glyph === "\n") {
        row++;
        col = 0;
        continue;
      }
      cells.push({ at: `${row}:${col}`, glyph, style: segment.style ?? Style.null() });
      col += cellLen(glyph);
    }
  }
  return cells;
}

const DEFAULT = ColorSpec.default();

/**
 * A cell's ink and ground as the wire draws them at `options`' depth, the
 * theme resolving the rest, and which of the two are the terminal's.
 */
export function shown(cell: Cell, options: RenderOptions, theme: TerminalTheme): Pair {
  const drawn = cell.style.drawnColors(options.colorSystem ?? undefined);
  return {
    fg: (drawn.color ?? DEFAULT).getTruecolor(theme, true),
    bg: (drawn.bgcolor ?? DEFAULT).getTruecolor(theme, false),
    terminal: { fg: drawn.color?.isDefault ?? true, bg: drawn.bgcolor?.isDefault ?? true },
  };
}

/**
 * The owner stamped on every cell a joiner draws between a strip's cells: a
 * colour seam, not text. A seam is told by what drew it, not by its glyph — an
 * ASCII joiner draws other glyphs, and its lead draws none, so every cell
 * after it sits a column left of where a glyph render has it.
 */
const SEAM = Object.freeze({ name: "seam" });

/** `joiner`, every seam it draws stamped as `SEAM`'s. */
function seamed<T extends StyledRenderable>(joiner: Joiner<T>): Joiner<T> {
  return {
    join(left, right) {
      const seam = joiner.join(left, right);
      return { render: (options) => Segment.anchorLines([[...seam.render(options)]], SEAM)[0]! };
    },
  };
}

/** Whether `owner` drew the cell, at any depth of its nesting. */
function drawnBy(cell: Cell, owner: object): boolean {
  for (let anchor = cell.style.anchor; anchor; anchor = anchor.inner) if (anchor.owner === owner) return true;
  return false;
}

export function drawnSubject(subject: Subject, drawnWith: RenderOptions, theme: TerminalTheme): DrawnSubject {
  const span = Measurement.get({ ...drawnWith, maxWidth: Number.MAX_SAFE_INTEGER }, subject.renderable).maximum;
  const options = { ...drawnWith, maxWidth: span };
  const lettered = cellsOf(subject.renderable.render(options)).filter((cell) => cell.glyph.trim() !== "" && !drawnBy(cell, SEAM));
  const text = new Set(lettered.map((cell) => cell.at));
  // A colour the cell leaves to the terminal is no colour of the subject's.
  const drawn = lettered.map((cell) => shown(cell, options, theme));
  const colors = new Set(drawn.flatMap(({ fg, bg, terminal }) => [...(terminal.fg ? [] : [fg.hex]), ...(terminal.bg ? [] : [bg.hex])]));
  const pairs = [...new Map(drawn.map((pair): [string, Pair] => [`${pair.fg.hex}/${pair.bg.hex}/${pair.terminal.fg}/${pair.terminal.bg}`, pair])).values()];
  return { ...subject, options, span, colors, pairs, text };
}

/** A colour of the theme's palette by its name; a name the palette lacks is a bug here. */
export function paletteRgba(theme: TerminalTheme, key: string): ColorRgba {
  const rgba = theme.palette.get(key);
  if (rgba === undefined) throw new Error(`theme ${theme.palette.name} has no palette colour ${key}`);
  return rgba;
}

/**
 * The style of the strip's `i`th cell. The second lap round the palette takes
 * each colour's muted shade, so a dozen neighbours are a dozen colours.
 */
function stripStyle(theme: TerminalTheme, i: number): Style {
  const color = (key: string): ColorSpec => ColorSpec.fromRgba(paletteRgba(theme, key));
  const key = STRIP_KEYS[i % STRIP_KEYS.length]!;
  return Math.floor(i / STRIP_KEYS.length) === 0
    ? Style.fromColor(color(`on-${key}`), color(key))
    : Style.fromColor(color("foreground"), color(`${key}-muted`));
}

/**
 * The elements the pulse is for, by the subject they are in and the labels of
 * the cells they are: the rest of the screen does not breathe.
 */
const PULSED: Readonly<Record<string, readonly string[]>> = { strip: ["ctx 61%", "ok"] };

/** A powerline strip of a dozen cells over the theme's palette. */
export function stripSubject(theme: TerminalTheme): Subject {
  const cells = STRIP_LABELS.map((label, i) => new RichText(` ${label} `, { style: stripStyle(theme, i), end: "", noWrap: true }));
  return { name: "strip", renderable: new Strip(cells, seamed(new PowerlineJoiner())), z: 0 };
}

/**
 * A status line, drawn dim as a "thinking" line is — the theme's muted ink,
 * lifted only as far as it must to read at `STATUS_CONTRAST` at `depth` —
 * which on a dark ground leaves the light room to lift it.
 */
export function textSubject(theme: TerminalTheme, depth: ColorDepth): Subject {
  const ink = ensureContrast(paletteRgba(theme, "foreground-muted"), theme.backgroundColor, STATUS_CONTRAST, depth, undefined, theme);
  const style = Style.fromColor(ColorSpec.fromRgba(ink));
  return { name: "text", renderable: new RichText(TEXT, { style, noWrap: true }), z: 11.3 };
}

/**
 * `loop` on `subject`'s own colours, each at the share of it its cells can
 * spare. Shares are settled on the colours as the run's depth draws them:
 * at 256 colours a touched colour lands on the cube, and the contrast it
 * spends is the cube colour's. Only `colors` — the subject's own, unless an
 * element of it is chosen — are touched.
 */
export function subjectUnder(subject: DrawnSubject, loop: Loop, theme: TerminalTheme, colors: ReadonlySet<string> = subject.colors): Effect {
  const depth = subject.options.colorSystem ?? ColorDepth.TRUECOLOR;
  const asDrawn = (color: ColorRgba, w: number): ColorRgba =>
    ColorSpec.fromRgba(loop.touch(color, w)).downgrade(depth).getTruecolor(theme);
  return onColors(shares(subject.pairs, colors, asDrawn), loop);
}

/** The fills of `subject`: the colours it sets that are the ground of a cell it draws text in. */
export function fills(subject: DrawnSubject): ReadonlySet<string> {
  return new Set(subject.pairs.flatMap(({ bg, terminal }) => (terminal.bg ? [] : [bg.hex])));
}

/**
 * A pulse breathing the elements chosen for `subject` (`PULSED`), each its
 * own `pulseAt(z)`, at a `z` of its own so each keeps a time of its own, on
 * the fill the screen draws them with; a subject with none chosen is left be.
 */
export function pulsedOn(subject: DrawnSubject, pulseAt: (z: number) => Loop, theme: TerminalTheme): Effect {
  const effects = (PULSED[subject.name] ?? []).map((label, n) => {
    const fill = stripStyle(theme, STRIP_LABELS.indexOf(label)).drawnColors(subject.options.colorSystem ?? undefined).bgcolor!;
    return subjectUnder(subject, pulseAt(subject.z + 3.7 * (n + 1)), theme, new Set([fill.getTruecolor(theme, false).hex]));
  });
  return (colors, cell, t) => effects.reduce((moved, effect) => effect(moved, cell, t), colors);
}
