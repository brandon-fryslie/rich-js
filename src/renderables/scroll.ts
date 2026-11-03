/**
 * Scroll — a slot of fixed size over content wider or taller than it, the
 * content's offset in the slot moving with time: a long line panning as a
 * marquee, a log tail scrolling, a panel sliding into its place.
 *
 * [LAW:one-type-per-behavior] A marquee, a scroll and a slide are one window,
 * `ScrollFrame`, and differ only in where it sits on what the content drew. A
 * scroll and a slide are handed their offsets as `Animation<number>`s — a
 * slide-in is a `tween` to 0 — and next change when `Animation.all` says. A
 * marquee is a step count, wrapped round the span the content and the slot
 * drew, so it learns that span only when the frame is drawn.
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
import { passAt, positiveSeconds, stepSequence } from "../core/easing.js";
import { Measurement } from "../core/measure.js";
import type { Measurable, Renderable, RenderOptions } from "../core/protocol.js";
import { render, withBoundedWidth } from "../core/protocol.js";
import { Segment } from "../core/segment.js";

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
  return Animation.map(Animation.all([col, row]), ([c, r]) => {
    const window: Window = { col: cells("col", c), row: cells("row", r), height };
    return new ScrollFrame(content, width, () => window);
  });
}

/** How a marquee crosses its slot. */
export interface MarqueeOptions {
  /** The slot's width in cells. */
  readonly width: number;
  /** The seconds the content holds at each cell before it moves one on. */
  readonly step: number;
}

/**
 * `content` crossing a slot `width` cells wide, one cell every `step`
 * seconds, right to left: it leaves on the left, then enters again from the
 * right, for ever, before 0 too. Any renderable with a natural width crosses
 * — the span is that width plus the slot's, read when the frame is drawn —
 * and the slot is as tall as the content, so every row of it crosses.
 *
 * It changes only on a step's boundary, whatever the content's width, so a
 * host sleeps between steps. Step 0 shows the content from its first column;
 * reduced, it holds there, the start in view.
 */
export function marquee(content: Renderable, options: MarqueeOptions): Animation<Renderable> {
  const { width, step } = options;
  if (!(Number.isInteger(width) && width > 0)) throw new RangeError(`marquee: width must be a positive whole number of cells, got ${width}`);
  positiveSeconds("marquee step", step);
  // [LAW:single-enforcer] Which step a time is in is `passAt`'s pass, and its two ends a one-hold
  // step sequence's, the wrap `Animation.repeat` reads its turns through.
  const holds = stepSequence([step]);
  const stepped: Animation<number> = Animation.of({
    at: (t: number) => passAt("marquee", t, step).pass,
    validUntil: (t: number) => holds.validUntil(t),
    validFrom: (t: number) => holds.validFrom(t),
    reduced: () => Animation.constant(0),
  });
  return Animation.map(stepped, (n) => new ScrollFrame(content, width, (drawn) => {
    const span = drawn.width + drawn.slot;
    return { col: ((((n + drawn.slot) % span) + span) % span) - drawn.slot, row: 0, height: drawn.rows };
  }));
}

/** Where a frame's slot sits on the content: columns left of it, rows above it, and how many rows it shows. */
interface Window {
  readonly col: number;
  readonly row: number;
  readonly height: number;
}

/** The size of what the content drew — its natural width and its rows — and the slot's width, cropped to the room it was given. */
interface Drawn {
  readonly width: number;
  readonly rows: number;
  readonly slot: number;
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

/**
 * One frame of a scroll: `width` cells of each row of `content` the window
 * shows, blank where it has none. [LAW:one-type-per-behavior] The window is
 * always a function of what the content drew: a scroll's ignores it, a
 * marquee's crosses the width it learns.
 */
class ScrollFrame implements Renderable, Measurable {
  constructor(
    readonly content: Renderable,
    readonly width: number,
    readonly window: (drawn: Drawn) => Window,
  ) {}

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    const options = withBoundedWidth(rawOptions, this);
    // The slot is cropped to the room it is given, as a `Panel` of a declared width is.
    const width = Math.min(this.width, options.maxWidth);
    const natural = naturalWidth(this.content, options);
    const drawn = [...render(this.content, { ...options, maxWidth: natural, height: undefined })];
    const lines = Segment.splitLines(drawn);
    const { col, row, height } = this.window({ width: natural, rows: lines.length, slot: width });
    const blank = Math.min(width, Math.max(0, -col));
    const start = Math.max(0, col);
    // [LAW:one-source-of-truth] What the window shows is cut from the whole content, so it may change
    // when anything in the content does — a row above the slot entering pushes every row down, and run
    // backwards, leaving it pulls them up. The cut throws away the cells that hold rode on, so it is
    // told to the frame (`RenderOptions.onValidity`).
    options.onValidity?.({ validFrom: Segment.validFrom(drawn), validUntil: Segment.validUntil(drawn) });
    for (let r = 0; r < height; r++) {
      const line = lines[row + r] ?? [];
      const shown = Segment.divide(line, [start, start + width - blank])[1] ?? [];
      yield* Segment.adjustLineLength([new Segment(" ".repeat(blank)), ...shown], width);
      yield Segment.line();
    }
  }

  measure(): { minimum: number; maximum: number } {
    return { minimum: this.width, maximum: this.width };
  }
}
