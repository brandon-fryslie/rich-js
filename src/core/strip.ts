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
 *
 * [LAW:locality-or-seam] The joiner protocol asks each item only for its
 * *edge* style — the column adjacent to the joiner — not for a single
 * whole-item style. This pushes the bg-uniformity requirement out of the
 * cell type and into the narrowest place that actually needs it: the column
 * boundary. Items with uniform styling report the same style at both edges;
 * items with varying styling report the actual boundary column. There is no
 * single-style invariant on the cell type — the terminal supports per-column
 * styling, so the cell type does too.
 */

import { Segment } from "./segment.js";
import { Style } from "./style.js";
import { ColorSpec, blendRgb } from "./color.js";
import type { Renderable, RenderOptions } from "./protocol.js";

// --- StyledRenderable ---

/**
 * Items in a `Strip` expose their per-edge style so joiners can paint the
 * transition glyph at each boundary.
 *
 * `edgeStyle("left")` reports the style of the item's leftmost cell column;
 * `edgeStyle("right")` reports the rightmost. Joiners read only these — the
 * item's interior may carry any per-column variation without breaking the
 * join.
 */
export interface StyledRenderable extends Renderable {
  edgeStyle(side: "left" | "right"): Style;
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

// Endpoint and powerline join glyphs paint the adjacent item's edge bg
// *as* their fg. If the edge has no bgcolor, the glyph degrades to the
// default fg — which renders as nothing visible against the terminal
// background, the right outcome for an unstyled edge.
function bgAsFg(edge: Style): Style {
  return new Style({ color: edge.bgcolor });
}

// A bg with a real colour to paint. `undefined` (no bg) and the terminal
// DEFAULT colour (transparent — identical to the terminal background) are the
// two representations of "nothing to paint"; the powerline separator treats
// them the same, so the gate cannot be fooled by an explicit `… on default`.
function paintableBg(bg: ColorSpec | undefined): ColorSpec | undefined {
  return bg !== undefined && !bg.isDefault ? bg : undefined;
}

// --- PowerlineJoiner ---

export interface PowerlineJoinerOptions {
  /** Glyph used for every join (default: U+E0B0, the powerline right-arrow). */
  glyph?: string;
}

export class PowerlineJoiner<T extends StyledRenderable = StyledRenderable> implements Joiner<T> {
  private readonly _glyph: string;

  constructor(options?: PowerlineJoinerOptions) {
    this._glyph = options?.glyph ?? "";
  }

  join(left: T | null, right: T | null): Renderable {
    // [LAW:dataflow-not-control-flow] One expression for all three positions
    // (start cap, mid-join, end cap). The powerline separator is painted in the
    // LEFT edge's bg — the colour bleeding rightward — over the RIGHT edge's bg.
    // The endpoints are not control-flow special cases; they are the DATA cases
    // where a neighbour (hence its bg) is absent:
    //   • no left bg — the start cap, OR a left item with no background — has no
    //     colour to bleed, so there is no separator to paint: EMPTY. (This
    //     matches vim-airline / tmux-powerline: a colourless arrow is not drawn.)
    //   • no right bg — the end cap — bleeds the left colour out over the
    //     terminal background (fg = left bg, no bg).
    // Equal REAL bgs still emit: the glyph is drawn in its own background colour
    // and is invisible, but the cell is present — a same-bg seam between two
    // distinct items is a structural boundary, never suppressed. Background
    // colour is paint, not structure; its ABSENCE (nothing to paint) is the only
    // thing that elides the separator, and that is paint logic, not structure.
    // "Absent" = no bg OR the terminal default (transparent) — paintableBg folds
    // both to undefined so an explicit `… on default` cannot smuggle a separator.
    const leftBg = paintableBg(left?.edgeStyle("right").bgcolor);
    if (leftBg === undefined) return EMPTY;
    const rightBg = paintableBg(right?.edgeStyle("left").bgcolor);
    return new FixedSegment(
      this._glyph,
      new Style({ color: leftBg, bgcolor: rightBg }),
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
    this._left = options?.left ?? "";
    this._right = options?.right ?? "";
    this._separator = options?.separator ?? " ";
  }

  *_emit(left: T | null, right: T | null, options: RenderOptions): Iterable<Segment> {
    if (left === null && right === null) return;
    if (left === null) {
      yield new Segment(this._left, bgAsFg(right!.edgeStyle("left")));
      return;
    }
    if (right === null) {
      yield new Segment(this._right, bgAsFg(left.edgeStyle("right")));
      return;
    }
    // Middle: close the left capsule, separator (unstyled), open the right.
    yield new Segment(this._right, bgAsFg(left.edgeStyle("right")));
    if (this._separator.length > 0) yield new Segment(this._separator);
    yield new Segment(this._left, bgAsFg(right.edgeStyle("left")));
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
const HALF_BLOCK = "▌"; // ▌

export class GradientJoiner<T extends StyledRenderable = StyledRenderable> implements Joiner<T> {
  private readonly _steps: number;

  constructor(options?: GradientJoinerOptions) {
    this._steps = options?.steps ?? 4;
  }

  join(left: T | null, right: T | null): Renderable {
    // [LAW:dataflow-not-control-flow] Endpoints have no opposite anchor to
    // interpolate toward — the data (a missing neighbor) makes the gradient
    // empty. Same for edges lacking a bgcolor: nothing to blend between.
    if (left === null || right === null) return EMPTY;
    const lbg = left.edgeStyle("right").bgcolor;
    const rbg = right.edgeStyle("left").bgcolor;
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
      const fg = ColorSpec.fromRgba(blendRgb(lTrip, rTrip, tLeft));
      const bg = ColorSpec.fromRgba(blendRgb(lTrip, rTrip, tRight));
      segments.push(new Segment(HALF_BLOCK, new Style({ color: fg, bgcolor: bg })));
    }
    return {
      *render(_options: RenderOptions): Iterable<Segment> {
        yield* segments;
      },
    };
  }
}
