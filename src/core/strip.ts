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
 * Items in a Strip expose a single dominant `style` so joiners can read its
 * fg/bg without inspecting the rendered output. Multi-style content nests
 * inside a styled wrapper; the joiner reads only the wrapper's style.
 */
export interface StyledRenderable extends Renderable {
  readonly style: Style;
}

// --- StripCell ---

/**
 * Minimal `StyledRenderable` for the common case: a single styled run of
 * text. Consumers with richer needs can implement `StyledRenderable`
 * directly and pass any `T extends StyledRenderable` to `Strip`.
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
  /**
   * Glyph painted at every gradient cell (default: " "). The interpolated
   * colour fills the cell *background*; the glyph rides on top with the
   * given foreground style. Pass a partial block (e.g. U+258E) and a
   * non-default `style` to overlay a texture on the gradient.
   */
  glyph?: string;
  /** Foreground style for `glyph`. Bg is overwritten with the gradient colour. */
  style?: Style;
}

export class GradientJoiner<T extends StyledRenderable = StyledRenderable> implements Joiner<T> {
  private readonly _steps: number;
  private readonly _glyph: string;
  private readonly _fgStyle: Style;

  constructor(options?: GradientJoinerOptions) {
    this._steps = options?.steps ?? 4;
    this._glyph = options?.glyph ?? " ";
    this._fgStyle = options?.style ?? NULL_STYLE;
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
    const glyph = this._glyph;
    const fgStyle = this._fgStyle;
    // Midpoint sampling: t = (i + 0.5) / steps so no cell equals an anchor.
    const segments: Segment[] = [];
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      const c = Color.fromTriplet(blendRgb(lTrip, rTrip, t));
      segments.push(new Segment(glyph, fgStyle.add(new Style({ bgcolor: c }))));
    }
    return {
      *render(_options: RenderOptions): Iterable<Segment> {
        yield* segments;
      },
    };
  }
}
