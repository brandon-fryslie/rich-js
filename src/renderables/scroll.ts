/**
 * Scroll — a slot of fixed size over content wider or taller than it, the
 * content's offset in the slot moving with time: a long line panning as a
 * marquee, a log tail scrolling, a panel sliding into its place.
 *
 * [LAW:one-type-per-behavior] A marquee, a scroll and a slide are one window
 * and differ only in the motion handed in: the offset along each axis is an
 * `Animation<number>`, so a marquee is a looping `Phase` scaled to the span
 * it crosses and a slide-in is a `tween` to 0, and when the window next
 * changes is `Animation.all`'s answer over the two. Nothing here knows which
 * one it is drawing.
 *
 * The slot is what the window is. It measures as its width whatever the
 * content, and draws exactly its rows of its width at every offset — cropped
 * only to a narrower room it is given — so what sits beside it never moves.
 * An offset before or past the content shows blank cells rather than stopping
 * at an edge: that is what lets a marquee enter from the right and a slide-in
 * arrive from outside the slot.
 *
 * The content is drawn at its own natural width and no height, its own
 * length, because the content wider and taller than the slot is the thing
 * being windowed. Content that should wrap to the slot instead, or that has
 * no natural width because it fills whatever it is given, is
 * `new Constrain(content, width)`, composed rather than asked for.
 *
 * [LAW:single-enforcer] A row is cut at the window's edges by
 * `Segment.divide`, the one place a line is cut at a column: a wide glyph a
 * cut falls in is blanked, never halved, and each cell's anchor still names
 * its column in the content, so hit-testing finds the owner through a moving
 * window.
 *
 * [LAW:no-ambient-temporal-coupling] Pure in `t`, nothing kept between
 * frames; `at` hands over the frame alone, and placed, the scroll stamps
 * the hold it is in at the frame's time (`placedRender`).
 */

import { Animation } from "../core/animation.js";
import { Measurement } from "../core/measure.js";
import type { Composite, Measurable, Renderable, RenderOptions } from "../core/protocol.js";
import { render, withBoundedWidth } from "../core/protocol.js";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";

/** The slot a scroll draws, and how far the content is moved in it. */
export interface ScrollOptions {
  /** The slot's width in cells. */
  readonly width: number;
  /** The slot's height in rows. */
  readonly height: number;
  /** Columns of content left of the slot's first, rounded to the nearest cell: negative moves the content right. Absent, 0. */
  readonly col?: Animation<number>;
  /** Rows of content above the slot's first, rounded to the nearest row: negative moves the content down. Absent, 0. */
  readonly row?: Animation<number>;
}

const NO_OFFSET = Animation.constant(0);

/** `content` seen through a slot of `width` by `height` cells, moved in it by `col` and `row` at each moment. */
export function scroll(content: Renderable, options: ScrollOptions): Animation<Renderable> {
  const { width, height, col = NO_OFFSET, row = NO_OFFSET } = options;
  for (const [name, n] of [["width", width], ["height", height]] as const) {
    if (!(Number.isInteger(n) && n > 0)) throw new RangeError(`scroll: ${name} must be a positive whole number of cells, got ${n}`);
  }
  return Animation.map(Animation.all([col, row]), ([c, r]) => new ScrollFrame(content, width, height, cells("col", c), cells("row", r)));
}

/** `offset` rounded to the nearest cell. [LAW:no-silent-failure] One that is not finite has no cell to move to, and says so rather than drawing a blank slot. */
function cells(name: string, offset: number): number {
  if (!Number.isFinite(offset)) throw new RangeError(`scroll: ${name} must be a finite number of cells, got ${offset}`);
  return Math.round(offset);
}

/**
 * The width `content` is drawn at: its own natural one. [LAW:no-silent-failure]
 * Content that takes whatever width it is offered — a `Rule`, a renderable
 * with no `measure` — has none, and is refused by name rather than drawn at
 * an unbounded width it cannot fill.
 */
function naturalWidth(content: Renderable, options: RenderOptions): number {
  const natural = Measurement.get({ ...options, maxWidth: Number.POSITIVE_INFINITY }, content).maximum;
  if (!Number.isFinite(natural)) {
    throw new RangeError("scroll: the content has no natural width — it fills whatever width it is given; give it one with new Constrain(content, width)");
  }
  return natural;
}

/** One frame of a scroll: `content`'s cells from column `col` and row `row`, `width` by `height` of them, blank where it has none. */
class ScrollFrame implements Renderable, Measurable, Composite {
  constructor(
    readonly content: Renderable,
    readonly width: number,
    readonly height: number,
    readonly col: number,
    readonly row: number,
  ) {}

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    const options = withBoundedWidth(rawOptions, this);
    // The slot is cropped to the room it is given, as a `Panel` of a declared width is.
    const width = Math.min(this.width, options.maxWidth);
    // At least the one column a render draws at, so content of no width still draws its word on when it changes.
    const drawn = [...render(this.content, { ...options, maxWidth: Math.max(1, naturalWidth(this.content, options)), height: undefined })];
    const lines = Segment.splitLines(drawn);
    const blank = Math.min(width, Math.max(0, -this.col));
    const start = Math.max(0, this.col);
    // [LAW:one-source-of-truth] What the window shows is cut from the whole content, so it may change
    // when anything in the content does — a row above the slot entering pushes every row down, and run
    // backwards, leaving it pulls them up. That hold rides a cell of no width on the first row, and the
    // cut throws the rest away.
    yield Segment.carrier(new Style({ hold: { lastChange: Segment.lastChange(drawn), nextChange: Segment.nextChange(drawn) } }));
    for (let r = 0; r < this.height; r++) {
      const line = lines[this.row + r] ?? [];
      const shown = Segment.divide(line, [start, start + width - blank])[1] ?? [];
      yield* Segment.adjustLineLength([new Segment(" ".repeat(blank)), ...shown], width);
      yield Segment.line();
    }
  }

  *contents(): Iterable<Renderable> {
    yield this.content;
  }

  measure(): { minimum: number; maximum: number } {
    return { minimum: this.width, maximum: this.width };
  }
}
