/**
 * Viewport — a fixed number of rows onto a taller renderable, scrolled by an
 * offset that cannot leave the content.
 *
 * Its rows, under the `Height` contract in `../core/protocol.ts`: the region's
 * when it is given one; otherwise its own configured rows, or the content's
 * full length when it has none, capped by any ceiling. It renders its content
 * with no height, because the content's natural length is the scroll extent,
 * and pads or crops what comes back to its rows — its rows are its own height,
 * not a region someone else will shape.
 *
 * Its width is the width it is given, in both directions: each row is cropped
 * or padded to it, so content that ignores its width cannot spill past the
 * viewport's edge and the scrollbar, drawn in a gutter at that edge, lines up
 * down every row. [LAW:dataflow-not-control-flow] A viewport with no scrollbar
 * has a gutter zero cells wide, and every row takes the same path either way.
 *
 * [LAW:no-ambient-temporal-coupling] Neither half of what an offset is clamped
 * against exists before a render: the rows come from the budget the render is
 * handed, and the content's length from rendering it at the width it is handed.
 * So `scrollTo`, `scrollBy` and `ensureVisible` do not move anything when they
 * are called. Each queues a move, and the next render that draws the content
 * resolves the queue in call order, clamping after every move, against the
 * rows and length that render found. Calling an operation before the first render, or three of them
 * between two renders, is the same code path as calling one.
 *
 * A render changes nothing (`State`, `../core/state.ts`), so the render draws
 * the offset it resolved without keeping it, and hands the keeping to its pass
 * (`afterPass`): once the frame has been drawn whole, the offset, the rows and
 * length it was clamped against, and the followed range become the viewport's,
 * and the moves it resolved leave the queue. A measurement, which draws
 * nothing anyone sees, keeps nothing.
 *
 * Every cell of its rows, gutter included, is stamped as its own
 * (`Segment.anchorLines`), around whatever anchors its content drew. So the
 * composed frame names the viewport under any of its cells however deep it is
 * nested, and a cell of a widget inside it names both: that is how the wheel
 * finds the viewport to scroll. `canScrollBy` is how it passes over one that
 * cannot move that way, to the viewport around it.
 */

import { Segment } from "../core/segment.js";
import { Measurement } from "../core/measure.js";
import { cellCount, cellLen } from "../core/cells.js";
import { NULL_STYLE } from "../core/style.js";
import type { Style } from "../core/style.js";
import {
  drawable,
  drawsNothing,
  fitHeight,
  getStyle,
  regionRows,
  withBoundedWidth,
  withCellWidth,
} from "../core/protocol.js";
import type {
  Height,
  Measurable,
  Renderable,
  RenderOptions,
  Scrollable,
} from "../core/protocol.js";
import { afterPass, render } from "../core/protocol.js";
import { ListState, State } from "../core/state.js";

/** What a render found: the rows it shows, and the lines of content behind them. */
interface Extent {
  readonly rows: number;
  readonly lines: number;
}

/** One requested change of offset, resolved against the extent the next render finds. */
type Move = (offset: number, extent: Extent) => number;

/** Lines `start` up to but not including `end` of the content. */
interface Range {
  readonly start: number;
  readonly end: number;
}

/** The range a frame last followed (`showing`), and the rows the frame that last drew it showed. */
interface Followed extends Range {
  readonly rows: number;
}

/** What the viewport keeps from one frame to the next. */
interface Scroll {
  /** The first content line the last frame showed. */
  readonly offset: number;
  /** The rows and length the last frame found; the next move is clamped against them. */
  readonly extent: Extent;
  readonly followed: Followed;
}

/** A scroll with the moves queued against it: what a frame resolves. */
interface Asked {
  readonly scroll: Scroll;
  readonly moves: readonly Move[];
}

/**
 * Content a viewport shows by the line: laid out at a width, it says how many
 * lines it is and draws only the ones asked for. What a view too long to draw
 * whole every frame — a textarea's rows — is shown as (`showingLines`).
 */
export interface Lines extends Measurable {
  layout(options: RenderOptions): LaidLines;
}

/** Content laid out at one width: its length, and its lines `start` up to but not including `end`. */
export interface LaidLines {
  readonly length: number;
  lines(start: number, end: number): Segment[][];
}

/** `content` drawn whole at the width `options` offers, as lines a viewport slices. */
function drawnWhole(content: Renderable): (options: RenderOptions) => LaidLines {
  return (options) => {
    const all = Segment.splitLines(render(content, options));
    return { length: all.length, lines: (start, end) => all.slice(start, end) };
  };
}

/** How one part of a scrollbar draws each row it covers. */
export interface ScrollbarPart {
  readonly glyph: string;
  /** A style, or a theme name resolved when the viewport renders. */
  readonly style: string | Style;
}

/**
 * The look of a scrollbar: the thumb, over the rows of the track that stand for
 * the lines in view, and the track, over the rest. Its gutter is as wide as the
 * wider of the two glyphs.
 */
export interface Scrollbar {
  readonly thumb: ScrollbarPart;
  readonly track: ScrollbarPart;
}

/** A heavy line for the thumb on a light line for the track. */
export const SCROLLBAR: Scrollbar = {
  thumb: { glyph: "┃", style: "scrollbar.thumb" },
  track: { glyph: "│", style: "scrollbar.track" },
};

/** The absence of a scrollbar, as a gutter zero cells wide. */
const NO_SCROLLBAR: Scrollbar = {
  thumb: { glyph: "", style: NULL_STYLE },
  track: { glyph: "", style: NULL_STYLE },
};

export interface ViewportOptions {
  /**
   * The rows shown when the viewport is given no region. Absent, it shows the
   * content's full length. A ceiling caps either.
   */
  rows?: number;
  /** A scrollbar down the right edge. Absent, the content has the full width. */
  scrollbar?: Scrollbar;
}

export class Viewport implements Renderable, Measurable, Scrollable {
  readonly rows: number | undefined;
  readonly scrollbar: Scrollbar;
  private readonly _scroll = new State<Scroll>({
    offset: 0,
    // Nothing rendered, nothing shown: no move can take until the first render.
    extent: { rows: 0, lines: 0 },
    // No range followed yet: NaN equals nothing, so the first range followed moves.
    followed: { start: NaN, end: NaN, rows: NaN },
  });
  private readonly _moves = new ListState<Move>();

  /**
   * @param content What the viewport shows when it is drawn itself. A view
   * rebuilt every frame shows new content through one kept viewport with
   * `showing` instead.
   */
  constructor(
    readonly content: Renderable,
    options: ViewportOptions = {},
  ) {
    this.rows = options.rows;
    this.scrollbar = options.scrollbar ?? NO_SCROLLBAR;
  }

  /**
   * The first content line the last frame showed. A move requested since is
   * not reflected until the next frame resolves it.
   */
  get offset(): number {
    return this._scroll.get().offset;
  }

  /** Scroll so `line` is the first line shown. */
  scrollTo(line: number): void {
    this._moves.push(() => line);
  }

  /** Scroll by `lines`: down when positive, up when negative. */
  scrollBy(lines: number): void {
    this._moves.push((offset) => offset + lines);
  }

  /**
   * Whether `scrollBy(lines)` would move the viewport from where the moves
   * queued so far leave it, against the rows and length the last frame
   * found.
   */
  canScrollBy(lines: number): boolean {
    const { scroll, moves } = this.asked();
    const offset = resolve(scroll.offset, moves, scroll.extent);
    return clampOffset(offset + lines, scroll.extent) !== offset;
  }

  /**
   * Scroll the least distance that shows lines `start` up to but not
   * including `end` — lines of the content as it renders at the viewport's
   * width, so an item that wraps spans more than one. A range already in view does not move; one taller than
   * the viewport shows its first line at the top.
   */
  ensureVisible(start: number, end: number): void {
    this._moves.push(bringIntoView({ start, end }));
  }

  /**
   * `content` shown through this viewport from its scroll position: how a view
   * rebuilt every frame keeps one `Viewport`, and its scroll, under content it
   * builds anew. What it draws is anchored to this viewport, so the wheel finds
   * it.
   *
   * `follow` is the lines of `content` to keep in view — a selection's — and
   * is brought into view with `ensureVisible` when it differs from the range
   * the last frame followed: when the selection moves, not on every frame,
   * which would undo on its very render each scroll the mouse wheel queues. A
   * followed range the last frame showed whole stays shown when the row count
   * changes: the same lines can fall off the bottom of a viewport that got
   * shorter. One the wheel had scrolled away from stays away. Absent, the
   * range last followed stands.
   *
   * [LAW:effects-at-boundaries] What a frame drawing it resolves becomes the
   * viewport's once that frame has been drawn whole, so it may be built and
   * drawn inside a render — `ListView` draws its items to learn their lines
   * and shows them this way.
   */
  showing(content: Renderable, follow?: Range): Renderable & Measurable {
    return {
      render: (options) => this.draw(content, drawnWhole(content), follow, options),
      measure: (options) => this.measureOf(content, options),
    };
  }

  /**
   * `content` shown through this viewport as `showing` shows a renderable,
   * drawing only the lines the frame shows: a frame costs the rows in view,
   * not the content's whole length.
   */
  showingLines(content: Lines, follow?: Range): Renderable & Measurable {
    return {
      render: (options) => this.draw(content, (o) => content.layout(o), follow, options),
      measure: (options) => this.measureOf(content, options),
    };
  }

  /**
   * The width its content renders at, out of `width`: what the scrollbar's
   * gutter leaves. Lines handed to `ensureVisible` are lines at this width.
   */
  contentWidth(width: number): number {
    return cellCount(width - this.gutter);
  }

  /** The cells the scrollbar's gutter takes beside the content. */
  get gutter(): number {
    return gutterWidth(this.scrollbar);
  }

  render(options: RenderOptions): Iterable<Segment> {
    return this.draw(this.content, drawnWhole(this.content), undefined, options);
  }

  /** The scroll, and the moves queued against it, as they stand. */
  private asked(): Asked {
    return { scroll: this._scroll.get(), moves: this._moves.get() };
  }

  /**
   * The offset `settled` resolves, with the scroll it leaves kept once the frame
   * is drawn and the `resolved` moves gone from the queue.
   * [LAW:effects-at-boundaries] Kept once the frame is drawn, never while it is.
   * The resolved moves leave by identity, not by count: another frame drawing
   * this viewport in the same pass may already have taken them, and a move
   * queued since stays.
   */
  private keep(settled: { scroll: Scroll; offset: number }, resolved: readonly Move[]): number {
    // Taken now: the queue is appended to in place, so `resolved` grows with it.
    const taken = new Set(resolved);
    afterPass(() => {
      this._scroll.set(settled.scroll);
      this._moves.set(this._moves.get().filter((move) => !taken.has(move)));
    });
    return settled.offset;
  }

  /** `content`, laid out by `layout`, drawn from the scroll and the moves queued against it, with `follow` followed. */
  private *draw(content: Renderable | Measurable, layout: (options: RenderOptions) => LaidLines, follow: Range | undefined, rawOptions: RenderOptions): Iterable<Segment> {
    const { height, ...options } = withBoundedWidth(rawOptions, { measure: (o) => this.measureOf(content, o) });
    const gutter = this.gutter;
    const contentWidth = this.contentWidth(options.maxWidth);
    const lines = layout({ ...options, maxWidth: contentWidth });
    const asked = this.asked();
    const { scroll, moves } = follow === undefined ? asked : following(asked, follow);
    // [LAW:no-ambient-temporal-coupling] Content handed no column is held, not
    // drawn, so this render learns its budget but not the content's length. It
    // keeps nothing: the offset, the followed range and the queued moves wait
    // for a frame that draws, and this one draws the scrollbar against the
    // length the last one found.
    const held = drawsNothing({ maxWidth: contentWidth });
    const length = held ? scroll.extent.lines : lines.length;
    const extent: Extent = { rows: viewRows(height, this.rows, length), lines: length };
    const offset = held ? clampOffset(scroll.offset, extent) : this.keep(settle(scroll, moves, extent), asked.moves);

    const shown = fitHeight(lines.lines(offset, offset + extent.rows), { rows: extent.rows, exact: true });
    // The thumb is drawn from the offset this render resolved, not from the
    // offset the last frame kept.
    const thumb = thumbRows(extent, offset);
    // The content's cells and the gutter's drawn cells sum to the offer: a
    // gutter wider than the whole offer is drawn cropped to it.
    const drawn = Math.min(gutter, options.maxWidth);
    // The style reaches the padding too, so a glyph narrower than the gutter
    // still fills its cell with its part's background.
    const cell = ({ glyph, style }: ScrollbarPart): Segment[] => {
      const resolved = getStyle(options, style);
      return Segment.adjustLineLength([new Segment(glyph, resolved)], drawn, resolved);
    };
    // The gutter keeps the chosen scrollbar's width, so an ASCII stand-in
    // padded into it leaves the content where `contentWidth` said it would be.
    const bar = drawable(options, this.scrollbar, asciiScrollbar(this.scrollbar), scrollbarGlyphs);
    const thumbCell = cell(bar.thumb);
    const trackCell = cell(bar.track);
    const rows = shown.map((line, row) => [
      ...Segment.adjustLineLength(line, contentWidth),
      ...(row >= thumb.start && row < thumb.end ? thumbCell : trackCell),
    ]);
    for (const line of Segment.anchorLines(rows, this)) {
      yield* line;
      yield Segment.line();
    }
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return this.measureOf(this.content, options);
  }

  private measureOf(content: Renderable | Measurable, rawOptions: RenderOptions): { minimum: number; maximum: number } {
    // Its width is its content's and its gutter's. `withCellWidth` and not
    // `withBoundedWidth`: the bounded parse asks this very method for the
    // natural width.
    const options = withCellWidth(rawOptions);
    const gutter = this.gutter;
    const inner = { ...options, maxWidth: this.contentWidth(options.maxWidth) };
    const measured = Measurement.get(inner, content);
    return new Measurement(measured.minimum + gutter, measured.maximum + gutter).withMaximum(options.maxWidth);
  }
}

/** The move that scrolls the least distance showing `range`. */
const bringIntoView =
  ({ start, end }: Range): Move =>
  (offset, { rows }) =>
    Math.min(start, Math.max(offset, end - rows));

/**
 * `asked` with `range` followed: one that differs from the range last followed
 * becomes the followed range, and a move brings it into view.
 */
function following(asked: Asked, range: Range): Asked {
  const { followed } = asked.scroll;
  if (range.start === followed.start && range.end === followed.end) return asked;
  return {
    scroll: { ...asked.scroll, followed: { start: range.start, end: range.end, rows: NaN } },
    moves: [...asked.moves, bringIntoView(range)],
  };
}

/**
 * Where a frame that drew the content against `extent` leaves the scroll: a
 * followed range that was in view is kept in view if the rows changed, and the
 * moves resolve into the offset.
 */
function settle(scroll: Scroll, moves: readonly Move[], extent: Extent): { scroll: Scroll; offset: number } {
  const { followed, offset } = scroll;
  const wasShown = followed.start >= offset && followed.end <= offset + scroll.extent.rows;
  const keepShown = !Number.isNaN(followed.rows) && followed.rows !== extent.rows && wasShown ? [bringIntoView(followed)] : [];
  const settled = resolve(offset, [...moves, ...keepShown], extent);
  const rows = Number.isNaN(followed.start) ? followed.rows : extent.rows;
  return { scroll: { offset: settled, extent, followed: { ...followed, rows } }, offset: settled };
}

/**
 * [LAW:one-source-of-truth] Where `moves` leave `offset` against `extent`: what
 * a frame keeps, and what `canScrollBy` asks from.
 * [LAW:dataflow-not-control-flow] The offset is re-clamped with or without
 * queued moves: content that shrank since the last frame pulls it back.
 */
function resolve(offset: number, moves: readonly Move[], extent: Extent): number {
  return moves.reduce((at, move) => clampOffset(move(at, extent), extent), clampOffset(offset, extent));
}

/**
 * One viewport per thing a pane shows, named by a key. The same viewport comes
 * back while the key holds, so its scroll position does too; a new key gets a
 * fresh one, so a new subject opens at its top rather than wherever the last
 * one was left. A frame is rebuilt on every key press and a scroll position is
 * a viewport's, so this is what outlives the frame for a pane whose subject
 * changes under it.
 */
export class ViewportPerKey {
  private held: { key: string; viewport: Viewport };

  constructor(private readonly options: ViewportOptions = {}) {
    this.held = { key: "", viewport: this.fresh() };
  }

  /** The viewport for `key`: the held one while the key holds, a fresh one otherwise. */
  of(key: string): Viewport {
    if (key !== this.held.key) this.held = { key, viewport: this.fresh() };
    return this.held.viewport;
  }

  private fresh(): Viewport {
    // Empty: a view shows the content it builds through it with `showing`.
    return new Viewport(EMPTY, this.options);
  }
}

/** Content a viewport never draws, for one that shows content only through `showing`. */
export const EMPTY: Renderable = { *render(): Iterable<Segment> {} };

const scrollbarGlyphs = ({ thumb, track }: Scrollbar): string => thumb.glyph + track.glyph;

/** `scrollbar` in its own styles, drawn in ASCII. */
function asciiScrollbar({ thumb, track }: Scrollbar): Scrollbar {
  return { thumb: { ...thumb, glyph: "#" }, track: { ...track, glyph: "|" } };
}

/** The cells a scrollbar's gutter takes from the content: its wider glyph. */
function gutterWidth({ thumb, track }: Scrollbar): number {
  return Math.max(cellLen(thumb.glyph), cellLen(track.glyph));
}

/**
 * The rows of the track the thumb covers, from `start` up to but not including
 * `end`: its length is the share of the content in view, and its position the
 * share of the scroll travelled. Content that fits fills the track.
 *
 * An end of the track means an end of the content. Rounded alone, the position
 * reached the bottom while lines were still hidden below — at 10 rows of 20
 * lines, offset 9 rounds onto the last position. So an offset short of an end
 * is held one row off it, wherever the track has a row between its ends.
 */
function thumbRows({ rows, lines }: Extent, offset: number): { start: number; end: number } {
  const size = Math.min(rows, Math.max(1, Math.round((rows * rows) / Math.max(lines, rows, 1))));
  const travel = rows - size;
  const last = Math.max(1, lines - rows);
  const proportional = Math.round((offset * travel) / last);
  const start = Math.max(Math.min(proportional, travel - Math.min(last - offset, 1)), Math.min(offset, 1, travel));
  return { start, end: start + size };
}

/** The rows a viewport shows, from its budget, its own configured rows, and its content's length. */
function viewRows(height: Height | undefined, rows: number | undefined, lines: number): number {
  return regionRows(height) ?? cellCount(Math.min(rows ?? lines, height?.rows ?? Infinity));
}

/** An offset held to the lines that exist: never above the first, never past the last full view. */
function clampOffset(offset: number, { rows, lines }: Extent): number {
  return cellCount(Math.min(offset, lines - rows));
}
