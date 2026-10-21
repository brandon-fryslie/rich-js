/**
 * GlyphEffected — a renderable whose finished cells' glyphs pass through a
 * glyph effect at a moment `t`: the glyph half of `Effected` (`./effect.ts`),
 * built to its contract.
 *
 * A glyph effect is the colour effect's two-stage shape with a glyph where
 * the colours were: for the cells an element draws in a frame, an
 * `Animation` (`../core/animation.ts`) of what is done to them. The first
 * stage is handed every cell once a frame (`GlyphCell`), blanks included —
 * rain and stars live there — and whether the output draws ASCII alone
 * (`DrawnGlyphs`), and works out what holds for the whole frame:
 * how many cells are typed, where a band is. The second, the function
 * `at(t)` returns, maps each cell to the text it shows. A typewriter, a
 * scramble, a wave of case changes and particles on blank cells are all this
 * one shape (`./glyph-effects.ts`) [LAW:one-type-per-behavior].
 *
 * Colour and glyph are not two kinds of animation: each is an `Animation` of
 * a per-cell map, and they differ only in what a cell is mapped to. The
 * wrappers are two because the stages are handed different facts. A colour
 * effect is settled against the depth, the terminal and the colours of the
 * words (`Drawn`), and with no colour output there is nothing for it to
 * change. A glyph effect needs none of that, and is written at every depth,
 * with no colour too. Over one element the two compose by nesting:
 * `new Effected(new GlyphEffected(child, glyphs, …), colours, …)` moves the
 * colours of the glyphs the glyph effect left, since each wrapper measures
 * what its child drew.
 *
 * A `GlyphEffected` is the element under its glyph effect over time, an
 * `Animation<Renderable>` placed as an `Effected` is, its value at `t` the
 * element through the effect at `t` (`Reglyphed`).
 * [LAW:no-ambient-temporal-coupling] The time is the frame's, never a clock
 * read, so the same time draws the same bytes at any frame rate.
 *
 * What a glyph effect may not do is the contract this module holds:
 *
 * - It changes what a cell shows, never which cells exist, where they are or
 *   who drew them. The text it returns for a cell is exactly as many cells
 *   wide (`cellLen`), carries no line break or control character, and does
 *   not join the cell beside it into one grapheme cluster, or the render
 *   throws naming the cell [LAW:single-enforcer]. So what sits beside the
 *   element never moves, and a wide glyph is changed whole — blanked as two
 *   spaces, scrambled as two one-cell glyphs — never cut.
 * - A segment whose every glyph comes back as it was is yielded as it was,
 *   so the identity effect is byte-identical. A changed segment keeps its
 *   style whole, link, meta and anchor included; no cell has moved, so the
 *   anchor's offsets are still true and hit testing still finds the owner.
 * - Placed as a `GlyphEffected`, every cell carries the hold the frame is in
 *   (`Style.nextChange`, `Style.lastChange`), under whatever the child said,
 *   as under `Effected`; drawn as a `Reglyphed`, a value, none.
 *
 * Positions are the child's own: row and column count from the top-left of
 * what the child drew.
 */

import { Animation, frameTimeOf, holdOf, shownAt, stampFrame } from "../core/animation.js";
import { cellLen, graphemes } from "../core/cells.js";
import { Measurement } from "../core/measure.js";
import type { Composite, Measurable, Renderable, RenderOptions } from "../core/protocol.js";
import { render } from "../core/protocol.js";
import { Segment } from "../core/segment.js";
import { finiteTime } from "../core/easing.js";
import { stripControlChars, type RichText } from "../core/text.js";
import { cellSeed, walkGlyphs, type Moved, type Placed } from "./effect.js";

/**
 * A cell of the element a glyph effect wraps: the glyph it shows, where it
 * sits and who drew it, its place in reading order among the cells handed
 * (`DrawnGlyphs.cells[index]` is this cell), and its seed, a number in [0, 1) that is the
 * same for that cell on every frame, as an `EffectCell`'s is.
 */
export interface GlyphCell extends Placed {
  readonly glyph: string;
  readonly index: number;
  readonly seed: number;
}

/** What a glyph effect does to the cells of one frame: a cell in, the text it shows out, as many cells wide. Return `cell.glyph` to leave it be. */
export type GlyphFrame = (cell: GlyphCell) => string;

/**
 * What the element a glyph effect wraps draws in one frame, and on what: the
 * glyph half of `Drawn`.
 */
export interface DrawnGlyphs {
  /** Every cell, in reading order; a line break is no cell. */
  readonly cells: readonly GlyphCell[];
  /**
   * Whether the output draws ASCII alone (`RenderOptions.asciiOnly`). A glyph
   * the effect chooses itself, rather than one the element drew, goes through
   * `drawable` against it, as every glyph the library chooses does.
   */
  readonly asciiOnly: boolean;
}

/**
 * For an element drawing `drawn`, the animation of what is done to its
 * glyphs. Its `nextChange` is when the frame next changes, as an `Effect`'s is.
 */
export type GlyphEffect = (drawn: DrawnGlyphs) => Animation<GlyphFrame>;

export interface GlyphEffectedOptions {
  /** Names the element for its seeds, as `EffectedOptions.key` does; under both wrappers, one key gives one seed a cell. */
  readonly key: string;
}

/**
 * A `GlyphEffected` at `t`, or an element through a glyph effect at a time an
 * animation's `at` was handed: `renderable` with its cells' glyphs passed
 * through `effect` at `t`, saying nothing of when that changes, as a
 * `Recolored` is (`./effect.ts`). [LAW:one-type-per-behavior]
 */
export class Reglyphed implements Renderable, Measurable, Composite {
  readonly t: number;
  readonly key: string;

  constructor(
    readonly renderable: Renderable,
    readonly effect: GlyphEffect,
    options: GlyphEffectedOptions & { readonly t: number },
  ) {
    this.t = finiteTime("GlyphEffected", options.t);
    this.key = options.key;
  }

  render(options: RenderOptions): Iterable<Segment> {
    return this.moved(options).segments;
  }

  /** The frame the effect draws at `t`, and the hold it says that is in. */
  moved(options: RenderOptions): Moved {
    const segments = [...render(this.renderable, options)];
    const { placed, cells } = placeGlyphs(segments, this.key);
    const animation = this.effect({ cells, asciiOnly: options.asciiOnly === true });
    const frame = shownAt(animation, this.t, options);
    const shown = showGlyphs(placed, frame.value);
    const changed = segments.map((segment, i) =>
      shown[i]!.every((text, j) => text === placed[i]![j]!.glyph) ? segment : new Segment(shown[i]!.join(""), segment.style),
    );
    return { segments: changed, hold: holdOf(frame, this.t) };
  }

  *contents(): Iterable<Renderable> {
    yield this.renderable;
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return Measurement.get(options, this.renderable);
  }
}

/**
 * `renderable` under a glyph effect over time, an `Animation<Renderable>`
 * as an `Effected` is (`./effect.ts`): its own answer is `t`, and placed,
 * its cells carry the glyph effect's exact hold at the frame's time and the
 * output's `asciiOnly`, under whatever the element already said.
 */
export class GlyphEffected implements Animation<Renderable> {
  readonly key: string;

  constructor(
    readonly renderable: Renderable,
    readonly effect: GlyphEffect,
    options: GlyphEffectedOptions,
  ) {
    this.key = options.key;
  }

  /** The element through the glyph effect at `t`, unstamped. */
  at(t: number): Reglyphed {
    return new Reglyphed(this.renderable, this.effect, { t, key: this.key });
  }

  nextChange(t: number): number {
    return t;
  }

  lastChange(t: number): number {
    return t;
  }

  /** The element under the glyph effect with its motion taken out. */
  reduced(): GlyphEffected {
    const { effect } = this;
    return new GlyphEffected(this.renderable, (drawn) => effect(drawn).reduced(), this);
  }

  /** Drawn at the frame's time, its cells stamped with the glyph effect's exact hold there. */
  render(options: RenderOptions): Iterable<Segment> {
    const { segments, hold } = this.at(frameTimeOf(options)).moved(options);
    return stampFrame(segments, hold);
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return Measurement.get(options, this.renderable);
  }

  *contents(): Iterable<Renderable> {
    yield this.renderable;
  }
}

/** A glyph of what was drawn, and its cell as an effect is handed it; a line break has none. */
type PlacedGlyph = { readonly glyph: string; readonly cell: GlyphCell | undefined };

/**
 * Each segment's glyphs, each with its cell as the effect is handed it, and
 * every cell in reading order. [LAW:one-source-of-truth] One walk, one count
 * of reading order, for a rendered frame and a text alike.
 */
function placeGlyphs(segments: readonly Segment[], key: string): { placed: PlacedGlyph[][]; cells: GlyphCell[] } {
  let index = 0;
  const placed = walkGlyphs(segments).map((glyphs) =>
    glyphs.map(({ glyph, cell }) => ({ glyph, cell: cell && { ...cell, glyph, index: index++, seed: cellSeed(key, cell.row, cell.col) } })),
  );
  return { placed, cells: placed.flatMap((glyphs) => glyphs.flatMap(({ cell }) => (cell === undefined ? [] : [cell]))) };
}

/** What `frame` shows for each placed glyph, held to the contract (`shows`, `standsApart`). */
function showGlyphs(placed: readonly (readonly PlacedGlyph[])[], frame: GlyphFrame): string[][] {
  const shown = placed.map((glyphs) => glyphs.map(({ glyph, cell }) => (cell === undefined ? glyph : shows(frame, cell))));
  standsApart(placed.flat(), shown.flat());
  return shown;
}

/**
 * `text` with its glyphs passed through `effect`, before any render: the
 * glyph half of a template fragment (`../template-bindings/animation-funcs.ts`),
 * which is spliced into a line and drawn under a theme it does not know yet,
 * so it cannot be rendered to cells first as `Reglyphed` renders its child.
 * The cells are the text's own lines, at its own columns; the contract is
 * the one `Reglyphed` is held to, through the same checks, over the text's
 * own glyphs: a neighbour spliced beside it later, a combining mark leading
 * the next fragment say, is outside what either check can see. The text keeps
 * its every style and span, each moved to where its glyphs now sit, and a
 * frame that changes nothing hands the text back as it was. What it says of
 * when it changes is the effect's, unstamped: whoever draws it at a time
 * stamps it (`textFrameAt`).
 */
export function reglyphText(text: RichText, effect: GlyphEffect, options: { readonly key: string; readonly asciiOnly: boolean }): Animation<RichText> {
  const { placed, cells } = placeGlyphs([new Segment(text.plain)], options.key);
  return Animation.map(effect({ cells, asciiOnly: options.asciiOnly }), (frame) => rewritten(text, placed[0]!, showGlyphs(placed, frame)[0]!));
}

/**
 * `text` with each of its `glyphs` written as `shown` says, every span moved
 * with the glyphs it covers. An offset inside a glyph — a span edge between
 * a letter and its mark — lands as far into the written glyph as it can.
 */
function rewritten(text: RichText, glyphs: readonly PlacedGlyph[], shown: readonly string[]): RichText {
  if (shown.every((s, i) => s === glyphs[i]!.glyph)) return text;
  // Where each glyph starts, before and after, with one more entry for the end.
  const from = [0];
  const to = [0];
  glyphs.forEach(({ glyph }, i) => {
    from.push(from[i]! + glyph.length);
    to.push(to[i]! + shown[i]!.length);
  });
  const moved = (offset: number): number => {
    let i = 0;
    while (i + 1 < from.length && from[i + 1]! <= offset) i++;
    return i === glyphs.length ? to[i]! : to[i]! + Math.min(offset - from[i]!, shown[i]!.length);
  };
  const result = text.blankCopy(shown.join(""));
  for (const span of text.spans) result.stylize(span.style, moved(span.start), moved(span.end));
  return result;
}

/** Line breaks and tabs, which `stripControlChars` leaves for a text's own lines and which no cell may hold. */
const BREAKS = /[\n\t]/;

/**
 * What `frame` shows in `cell`, held to the contract: as many cells wide as
 * the glyph, with no line break or control character. [LAW:single-enforcer]
 * The one place a glyph effect's output is checked; a breach throws, naming
 * the cell and what it was turned into.
 */
function shows(frame: GlyphFrame, cell: GlyphCell): string {
  const text = frame(cell);
  if (text === cell.glyph) return text;
  if (cellLen(text) !== cellLen(cell.glyph) || BREAKS.test(text) || stripControlChars(text) !== text) {
    throw new RangeError(
      `a glyph effect turned ${JSON.stringify(cell.glyph)} at row ${cell.row}, column ${cell.col} into ${JSON.stringify(text)}: ` +
        `it must be ${cellLen(cell.glyph)} cell(s) wide, with no line break or control character`,
    );
  }
  return text;
}

/**
 * Every text `frame` changed, in `shown`, stands apart from the texts beside
 * it on its line: joined to them, it splits into as many grapheme clusters as
 * it and they do alone, or this throws naming the cell. Each text being as
 * wide as its glyph is `shows`'s check; this is the half no one cell can
 * see — a trailing zero-width joiner that fuses with the next emoji, or a
 * leading combining mark that draws on the glyph before it, is right alone
 * and wrong beside its neighbour. Only a changed text is asked, so a child
 * that splits a cluster across its own segments is drawn as it drew it.
 */
function standsApart(placed: readonly PlacedGlyph[], shown: readonly string[]): void {
  // A line break is no cell, and nothing joins across it.
  const beside = (j: number): string => (placed[j]?.cell === undefined ? "" : shown[j]!);
  shown.forEach((text, i) => {
    const { glyph, cell } = placed[i]!;
    if (cell === undefined || text === glyph) return;
    const [before, after] = [beside(i - 1), beside(i + 1)];
    if (graphemes(before + text + after).length !== graphemes(before).length + graphemes(text).length + graphemes(after).length) {
      throw new RangeError(
        `a glyph effect turned ${JSON.stringify(glyph)} at row ${cell.row}, column ${cell.col} into ${JSON.stringify(text)}, ` +
          `which joins the cell beside it into one character`,
      );
    }
  });
}
