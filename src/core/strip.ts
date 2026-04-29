/**
 * Strip + Joiner — edge-aware horizontal layout primitive.
 *
 * A `Strip` renders a horizontal sequence of styled items with a `Joiner`
 * deciding how each transition between adjacent items looks. The joiner is
 * a pure function of `(leftItem | null, rightItem | null) -> Renderable`,
 * so endpoint joins (the start and end of the strip) are explicit positions
 * in the protocol — the joiner names what an endpoint looks like rather than
 * the strip guessing.
 *
 * [LAW:one-source-of-truth] The render walk
 *   joiner(null, items[0]), items[0],
 *   joiner(items[0], items[1]), items[1], ...,
 *   joiner(items[N-1], null)
 * is the single authority for how strips lay out. Every joiner participates
 * in the same protocol; "look up the previous segment's bg" is no longer a
 * powerline-specific hack but the contract every joiner shares.
 */

import { Segment } from "./segment.js";
import { Style, NULL_STYLE } from "./style.js";
import { Color, blendRgb } from "./color.js";
import type { Renderable, RenderOptions } from "./protocol.js";

// --- StyledRenderable ---

/**
 * Items in a `Strip` expose a single dominant `style` so joiners can read
 * fg/bg without inspecting the rendered output.
 *
 * ## Single-style invariant (load-bearing)
 *
 * Joiners — `PowerlineJoiner`, `CapsuleJoiner`, `GradientJoiner` — paint edges
 * by reading `item.style.bgcolor` for adjacent items. If `render()` emits a
 * `Segment` whose `style.bgcolor` diverges from `this.style.bgcolor`, the
 * arrow/cap glyph between this item and its neighbour will use the *declared*
 * bg even though the item *displayed* a different bg. The result is a
 * visually wrong transition (e.g. a powerline arrow whose source colour
 * doesn't match the cell it's bleeding out of).
 *
 * **The invariant**: for every `Segment` yielded by `render()`, either
 *   - `segment.style.bgcolor === this.style.bgcolor`, or
 *   - `segment.style.bgcolor === undefined` (transparent — terminal default).
 *
 * Foreground colour and text attributes (bold, italic, underline, etc.) may
 * vary freely within a single item — only `bgcolor` is constrained, because
 * that's the only field joiners read.
 *
 * ## What breaks the invariant
 *
 * - Yielding inline `Segment`s with their own `bgcolor` set to a different
 *   value (e.g. an embedded "warning" highlight with a yellow background).
 * - Wrapping a renderable that paints its own background — `Panel`, a styled
 *   `Group`, or any `RichText` whose base style includes a bg.
 *
 * ## The safe path
 *
 * Use `StripCell(text, style)` for plain styled text — it satisfies the
 * invariant by construction. For richer items, implement this interface
 * directly and ensure your `render()` only emits Segments whose bg matches
 * `this.style.bgcolor` (or is undefined). Inline fg variation is fine; bg
 * variation is not.
 */
export interface StyledRenderable extends Renderable {
  readonly style: Style;
}

// --- StripCell ---

/**
 * Canonical safe implementation of `StyledRenderable`: a single styled run of
 * text. Satisfies the single-style invariant by construction — every emitted
 * `Segment` carries exactly the declared `style`.
 *
 * Consumers with richer needs can implement `StyledRenderable` directly and
 * pass any `T extends StyledRenderable` to `Strip`, but must uphold the
 * invariant documented on `StyledRenderable`.
 */
export class StripCell implements StyledRenderable {
  readonly text: string;
  readonly style: Style;

  constructor(text: string, style?: Style) {
    this.text = text;
    this.style = style ?? NULL_STYLE;
  }

  *render(_options: RenderOptions): Iterable<Segment> {
    yield new Segment(this.text, this.style);
  }
}

// --- Joiner ---

export interface Joiner<T extends StyledRenderable = StyledRenderable> {
  /**
   * `left === null` marks the start endpoint; `right === null` marks the end
   * endpoint. The joiner decides what an endpoint looks like — typically
   * fg-only with no bg so the strip blends into the terminal background.
   */
  join(left: T | null, right: T | null): Renderable;
}

// --- Strip ---

export class Strip<T extends StyledRenderable = StyledRenderable> implements Renderable {
  readonly items: readonly T[];
  readonly joiner: Joiner<T>;

  constructor(items: readonly T[], joiner: Joiner<T>) {
    this.items = items;
    this.joiner = joiner;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    const items = this.items;
    if (items.length === 0) return;

    // [LAW:dataflow-not-control-flow] The walk is the same shape every render:
    // start-cap, item, mid-join, item, ..., item, end-cap. Variability lives
    // in `items` and in what the joiner emits at each position — never in
    // whether a join runs.
    yield* this.joiner.join(null, items[0]!).render(options);
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      yield* item.render(options);
      const next = i + 1 < items.length ? items[i + 1]! : null;
      yield* this.joiner.join(item, next).render(options);
    }
  }
}

// --- Helpers ---

const EMPTY: Renderable = {
  *render(_options: RenderOptions): Iterable<Segment> {
    // intentionally empty
  },
};

class FixedSegment implements Renderable {
  private readonly _text: string;
  private readonly _style: Style;

  constructor(text: string, style: Style) {
    this._text = text;
    this._style = style;
  }

  *render(_options: RenderOptions): Iterable<Segment> {
    yield new Segment(this._text, this._style);
  }
}

function bgAsFg(item: StyledRenderable): Style {
  // Endpoint and powerline join glyphs paint the previous/next item's bg
  // *as* their fg. If the source item has no bgcolor, the glyph degrades to
  // the default fg — which renders as nothing visible against the terminal
  // background, the right outcome for an unstyled cell.
  return new Style({ color: item.style.bgcolor });
}

// --- PowerlineJoiner ---

export interface PowerlineJoinerOptions {
  /** Glyph used for every join (default: U+E0B0, the powerline right-arrow). */
  glyph?: string;
}

export class PowerlineJoiner<T extends StyledRenderable = StyledRenderable> implements Joiner<T> {
  private readonly _glyph: string;

  constructor(options?: PowerlineJoinerOptions) {
    this._glyph = options?.glyph ?? "\ue0b0";
  }

  join(left: T | null, right: T | null): Renderable {
    // Start cap: empty. A right-pointing arrow with no source segment to its
    // left has nothing to bleed out *from*, so the first segment just begins
    // cleanly. This matches vim-airline / tmux-powerline / claude-powerline.
    if (left === null) return EMPTY;
    if (right === null) {
      // End cap: fg = left.bg, no bg — last segment bleeds out into the
      // terminal background.
      return new FixedSegment(this._glyph, bgAsFg(left));
    }
    // Middle: fg = left.bg, bg = right.bg.
    return new FixedSegment(
      this._glyph,
      new Style({ color: left.style.bgcolor, bgcolor: right.style.bgcolor }),
    );
  }
}

// --- CapsuleJoiner ---

export interface CapsuleJoinerOptions {
  /** Left-cap glyph (default: U+E0B6, powerline rounded left). */
  left?: string;
  /** Right-cap glyph (default: U+E0B4, powerline rounded right). */
  right?: string;
  /** Separator inserted between adjacent capsules in the middle position. */
  separator?: string;
}

export class CapsuleJoiner<T extends StyledRenderable = StyledRenderable> implements Joiner<T> {
  private readonly _left: string;
  private readonly _right: string;
  private readonly _separator: string;

  constructor(options?: CapsuleJoinerOptions) {
    this._left = options?.left ?? "\ue0b6";
    this._right = options?.right ?? "\ue0b4";
    this._separator = options?.separator ?? " ";
  }

  *_emit(left: T | null, right: T | null, options: RenderOptions): Iterable<Segment> {
    if (left === null && right === null) return;
    if (left === null) {
      yield new Segment(this._left, bgAsFg(right!));
      return;
    }
    if (right === null) {
      yield new Segment(this._right, bgAsFg(left));
      return;
    }
    // Middle: close the left capsule, separator (unstyled), open the right.
    yield new Segment(this._right, bgAsFg(left));
    if (this._separator.length > 0) yield new Segment(this._separator);
    yield new Segment(this._left, bgAsFg(right));
    void options;
  }

  join(left: T | null, right: T | null): Renderable {
    const emit = this._emit.bind(this);
    return {
      *render(options: RenderOptions): Iterable<Segment> {
        yield* emit(left, right, options);
      },
    };
  }
}

// --- PlainJoiner ---

export interface PlainJoinerOptions {
  separator?: string;
  style?: Style;
}

export class PlainJoiner<T extends StyledRenderable = StyledRenderable> implements Joiner<T> {
  private readonly _separator: string;
  private readonly _style: Style;

  constructor(options?: PlainJoinerOptions) {
    this._separator = options?.separator ?? " | ";
    this._style = options?.style ?? Style.parse("dim");
  }

  join(left: T | null, right: T | null): Renderable {
    // Endpoints are empty — a fixed separator has no natural cap.
    if (left === null || right === null) return EMPTY;
    return new FixedSegment(this._separator, this._style);
  }
}

// --- GradientJoiner ---

export interface GradientJoinerOptions {
  /** Number of cells between adjacent items (default: 4). */
  steps?: number;
}

/**
 * Half-block dithering glyph: paints the cell's left half with the foreground
 * colour and the right half with the background colour. Lets each cell carry
 * two colour samples — `2 * steps` samples in `steps` cells — so the gradient
 * looks twice as smooth as one-colour-per-cell at the same width.
 */
const HALF_BLOCK = "\u258c"; // ▌

export class GradientJoiner<T extends StyledRenderable = StyledRenderable> implements Joiner<T> {
  private readonly _steps: number;

  constructor(options?: GradientJoinerOptions) {
    this._steps = options?.steps ?? 4;
  }

  join(left: T | null, right: T | null): Renderable {
    // [LAW:dataflow-not-control-flow] Endpoints have no opposite anchor to
    // interpolate toward — the data (a missing neighbor) makes the gradient
    // empty. Same for items lacking a bgcolor: nothing to blend between.
    if (left === null || right === null) return EMPTY;
    const lbg = left.style.bgcolor;
    const rbg = right.style.bgcolor;
    if (!lbg || !rbg) return EMPTY;
    const lTrip = lbg.getTruecolor();
    const rTrip = rbg.getTruecolor();
    const steps = this._steps;
    const samples = 2 * steps;
    // Midpoint sampling across `2 * steps` half-cell positions: sample j has
    // t = (j + 0.5) / samples. Cell i takes samples 2i (left half) and 2i+1
    // (right half). No sample ever equals either anchor.
    const segments: Segment[] = [];
    for (let i = 0; i < steps; i++) {
      const tLeft = (2 * i + 0.5) / samples;
      const tRight = (2 * i + 1.5) / samples;
      const fg = Color.fromTriplet(blendRgb(lTrip, rTrip, tLeft));
      const bg = Color.fromTriplet(blendRgb(lTrip, rTrip, tRight));
      segments.push(new Segment(HALF_BLOCK, new Style({ color: fg, bgcolor: bg })));
    }
    return {
      *render(_options: RenderOptions): Iterable<Segment> {
        yield* segments;
      },
    };
  }
}
