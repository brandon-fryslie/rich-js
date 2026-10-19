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
 * [LAW:no-ambient-temporal-coupling] `t` is a constructor argument, never a
 * clock read, so the same `t` draws the same bytes at any frame rate.
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
 * - Drawn as a `GlyphEffected`, every cell carries when the frame next changes (`Style.nextChange`),
 *   under whatever the child said, as under `Effected`; drawn as a `Reglyphed`, inside an animation's `at`, none.
 *
 * Positions are the child's own: row and column count from the top-left of
 * what the child drew.
 */

import type { Animation } from "../core/animation.js";
import { cellLen, graphemes } from "../core/cells.js";
import { Measurement } from "../core/measure.js";
import type { Composite, Measurable, Renderable, RenderOptions } from "../core/protocol.js";
import { render } from "../core/protocol.js";
import { Segment } from "../core/segment.js";
import { stampFrame } from "./frames.js";
import { stripControlChars } from "../core/text.js";
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
  /** The moment to draw, in seconds. */
  readonly t: number;
  /** Names the element for its seeds, as `EffectedOptions.key` does; under both wrappers, one key gives one seed a cell. */
  readonly key: string;
}

/**
 * `renderable` with its cells' glyphs passed through `effect` at `t`, saying
 * nothing of when that changes: the frame an animation's `at` hands over, as
 * a `Recolored` is (`./effect.ts`). [LAW:one-type-per-behavior] Drawn at a
 * draw site's `t` instead, it is a `GlyphEffected`.
 */
export class Reglyphed implements Renderable, Measurable, Composite {
  readonly t: number;
  readonly key: string;

  constructor(
    readonly renderable: Renderable,
    readonly effect: GlyphEffect,
    options: GlyphEffectedOptions,
  ) {
    if (!Number.isFinite(options.t)) {
      throw new RangeError(`GlyphEffected needs a finite t, got ${options.t}`);
    }
    this.t = options.t;
    this.key = options.key;
  }

  render(options: RenderOptions): Iterable<Segment> {
    return this.moved(options).segments;
  }

  /** The frame the effect draws at `t`, and when it says that next changes. */
  protected moved(options: RenderOptions): Moved {
    const segments = [...render(this.renderable, options)];
    let index = 0;
    // Each segment's glyphs, each with its cell as the effect is handed it: one walk, one count of reading order.
    const placed = walkGlyphs(segments).map((glyphs) =>
      glyphs.map(({ glyph, cell }) => ({ glyph, cell: cell && { ...cell, glyph, index: index++, seed: cellSeed(this.key, cell.row, cell.col) } })),
    );
    const cells = placed.flatMap((glyphs) => glyphs.flatMap(({ cell }) => (cell === undefined ? [] : [cell])));
    const animation = this.effect({ cells, asciiOnly: options.asciiOnly === true });
    const frame = animation.at(this.t);
    const shown = placed.map((glyphs) => glyphs.map(({ glyph, cell }) => (cell === undefined ? glyph : shows(frame, cell))));
    standsApart(placed.flat(), shown.flat());
    const changed = segments.map((segment, i) =>
      shown[i]!.every((text, j) => text === placed[i]![j]!.glyph) ? segment : new Segment(shown[i]!.join(""), segment.style),
    );
    return { segments: changed, nextChange: animation.nextChange(this.t) };
  }

  *contents(): Iterable<Renderable> {
    yield this.renderable;
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return Measurement.get(options, this.renderable);
  }
}

/**
 * A `Reglyphed` drawn at the draw site's `t`, its cells saying when the glyph
 * effect's frame next changes there (`stampFrame`), under whatever the child
 * already said, as an `Effected`'s do.
 */
export class GlyphEffected extends Reglyphed {
  override render(options: RenderOptions): Iterable<Segment> {
    const { segments, nextChange } = this.moved(options);
    return stampFrame(segments, nextChange);
  }
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
function standsApart(placed: readonly { readonly glyph: string; readonly cell: GlyphCell | undefined }[], shown: readonly string[]): void {
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
