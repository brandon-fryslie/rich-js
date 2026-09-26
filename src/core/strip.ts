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
import { ColorDepth, ColorSpec, blendRgb } from "./color.js";
import { Oklch } from "./oklch.js";
import type { Renderable, RenderOptions } from "./protocol.js";

// --- StyledRenderable ---

/**
 * Items in a `Strip` expose their per-edge style so joiners can paint the
 * transition glyph at each boundary.
 *
 * `edgeStyle("left", options)` reports the style of the item's leftmost cell
 * column; `edgeStyle("right", options)` reports the rightmost. Joiners read
 * only these — the item's interior may carry any per-column variation without
 * breaking the join.
 *
 * The edge is asked in a render, with that render's options, because a style
 * name only becomes a colour against the render's theme. A joiner therefore
 * reads edges inside the `render` of what it returns, never in `join`.
 */
export interface StyledRenderable extends Renderable {
  edgeStyle(side: "left" | "right", options: RenderOptions): Style;
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

    // [LAW:one-source-of-truth] `Strip`'s sibling `FlexStrip` ends every line
    // it emits, including the last, and the other block-level renderables
    // (`Panel`/`Rule`/`Table` structurally, `RichText` via `end`) do too — so
    // `Group` can emit children back to back with nothing in between
    // (docs/group.md). A `Strip` that left its last line open broke only
    // under composition: printed alone, Console's own "close whatever the
    // renderable left open" step (console.ts) papered over it, and a `Group`
    // of a Strip and a RichText ran the RichText onto the Strip's line
    // instead of below it. (Not every renderable follows this — a `Spinner`
    // or `ProgressBar` is a line *fragment*, not a block; see
    // rich-flexstrip-5kf.4cq for the open question of formalizing that split.)
    yield Segment.line();
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

/** A renderable whose segments are computed from the options it is rendered with. */
function deferred(emit: (options: RenderOptions) => Iterable<Segment>): Renderable {
  return { render: emit };
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

/**
 * The least ΔE_OK two neighbouring backgrounds must differ by for the powerline
 * arrow between them to be seen. Below it the arrow is drawn in a colour the
 * eye cannot tell from its own background, so the joiner draws the divider
 * instead. Twice the ~.02 threshold of a visible difference, because a seam is
 * one cell wide.
 */
export const SEAM_MIN_DELTA_E = 0.04;

// An arrow the eye cannot tell from the ground it is drawn on. What is
// measured is what is drawn — `Style.drawnColors`, the colours the writer
// encodes: the arrow's colour flattened onto its ground and the ground onto
// the terminal's black, both downgraded to the depth the render encodes at,
// so two grounds 256 colours round to one cube entry are the one entry they
// render as. A colour whose RGB is the terminal theme's own (ANSI 0–15) has no
// value here, so two of them are the same only when they are the same palette
// slot — its `number`, never the name or the depth that spells it ("red",
// "color(1)", an EIGHT_BIT spec on 0–15 are one slot).
function vanishes(arrow: Style, colorSystem: ColorDepth | null | undefined): boolean {
  // No colour emitted draws nothing to tell apart; measure what was handed.
  const { color, bgcolor } = arrow.drawnColors(colorSystem ?? ColorDepth.TRUECOLOR);
  if (color === undefined || bgcolor === undefined) return false;
  const av = color.fixedValue;
  const bv = bgcolor.fixedValue;
  return av !== undefined && bv !== undefined
    ? Oklch.fromRgba(av).deltaE(Oklch.fromRgba(bv)) < SEAM_MIN_DELTA_E
    : color.number === bgcolor.number;
}

// [LAW:types-are-the-program] The arrow, its divider and the two caps are one
// vocabulary: a caller who replaces the arrow (say with ASCII ">") must also say
// what divides and what caps, or the default powerline glyphs would render as
// tofu beside it. So they are given together or not at all — the default set is
// the unset case. A cap shape (rounded, slanted, flat) is therefore a value of
// this record, never a joiner of its own.
export interface PowerlineJoinerOptions {
  /** Glyph for every join between two coloured items. */
  glyph: string;
  /**
   * Glyph drawn between neighbours whose backgrounds the eye cannot tell apart,
   * in the left item's text colour — the arrow itself would vanish into the
   * shared background.
   */
  divider: string;
  /**
   * Glyph for every join a coloured item is entered from nothing — the strip's
   * start, or a colourless left neighbour — painted in the right item's
   * background. `""` begins a coloured run flat.
   */
  lead: string;
  /**
   * Glyph for every join a coloured item leaves into nothing — the strip's end,
   * or a colourless right neighbour — painted in the left item's background.
   * `""` ends a coloured run flat.
   */
  tail: string;
}

/**
 * The powerline set: U+E0B0 (right-arrow) divided by U+E0B1 (thin right-arrow),
 * led by U+E0B2 (left-arrow) and tailed by the arrow itself — so a strip's two
 * ends are one shape.
 */
export const POWERLINE_JOINER_GLYPHS: Readonly<PowerlineJoinerOptions> = Object.freeze({
  glyph: "\ue0b0",
  divider: "\ue0b1",
  lead: "\ue0b2",
  tail: "\ue0b0",
});

export class PowerlineJoiner<T extends StyledRenderable = StyledRenderable> implements Joiner<T> {
  private readonly _glyph: string;
  private readonly _divider: string;
  private readonly _lead: string;
  private readonly _tail: string;

  constructor(options: PowerlineJoinerOptions = POWERLINE_JOINER_GLYPHS) {
    this._glyph = options.glyph;
    this._divider = options.divider;
    this._lead = options.lead;
    this._tail = options.tail;
  }

  join(left: T | null, right: T | null): Renderable {
    // [LAW:dataflow-not-control-flow] One table for all three positions (start
    // cap, mid-join, end cap), read off which side has a colour to paint. The
    // endpoints are not control-flow special cases; they are the DATA cases
    // where a neighbour (hence its bg) is absent:
    //   • both bgs — the arrow in the LEFT bg (the colour bleeding rightward)
    //     over the RIGHT bg.
    //   • left bg only — the end cap, OR a coloured item before a colourless
    //     one — the tail bleeds the left colour out over the terminal
    //     background (fg = left bg, no bg).
    //   • right bg only — the start cap, OR a colourless item before a coloured
    //     one — the lead: the right colour reaching back over the terminal
    //     background (fg = right bg, no bg).
    //   • neither — nothing to paint, so the join yields nothing.
    // Equal REAL bgs still emit: a same-bg seam between two distinct items is a
    // structural boundary, never suppressed. The arrow would be drawn in its own
    // background colour there and vanish, so the seam is the DIVIDER instead, in
    // the left item's text colour — the vim-airline convention for neighbours
    // that share a background. "Equal" is perceptual (SEAM_MIN_DELTA_E) and
    // measured on the colours the terminal draws at `options.colorSystem`: an
    // arrow a hair off its background is as invisible as one exactly on it,
    // and two backgrounds 256 colours round to one entry are one background.
    // Background colour is paint, not structure; its ABSENCE (nothing to paint)
    // is the only thing that elides the separator, and that is paint logic.
    // "Absent" = no bg OR the terminal default (transparent) — paintableBg folds
    // both to undefined so an explicit `… on default` cannot smuggle a separator.
    const glyph = this._glyph;
    const divider = this._divider;
    const lead = this._lead;
    const tail = this._tail;
    return deferred(function* (options) {
      const leftEdge = left?.edgeStyle("right", options);
      const leftBg = paintableBg(leftEdge?.bgcolor);
      const rightBg = paintableBg(right?.edgeStyle("left", options).bgcolor);
      // A cap or arrow is its cell continuing: that cell's ground as the writer
      // draws it, so a translucent ground is not composited a second time over
      // whatever it enters.
      const drawn = (bg: ColorSpec) => new Style({ bgcolor: bg }).drawnColors().bgcolor;
      if (leftBg === undefined) {
        if (rightBg !== undefined) yield new Segment(lead, new Style({ color: drawn(rightBg) }));
        return;
      }
      if (rightBg === undefined) {
        yield new Segment(tail, new Style({ color: drawn(leftBg) }));
        return;
      }
      const arrow = new Style({ color: drawn(leftBg), bgcolor: rightBg });
      // The divider is the left item's text on the left item's own ground,
      // so it reads exactly as well as that item's text does, at any depth.
      yield vanishes(arrow, options.colorSystem)
        ? new Segment(divider, new Style({ color: leftEdge?.color, bgcolor: leftBg }))
        : new Segment(glyph, arrow);
    });
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
      yield new Segment(this._left, bgAsFg(right!.edgeStyle("left", options)));
      return;
    }
    if (right === null) {
      yield new Segment(this._right, bgAsFg(left.edgeStyle("right", options)));
      return;
    }
    // Middle: close the left capsule, separator (unstyled), open the right.
    yield new Segment(this._right, bgAsFg(left.edgeStyle("right", options)));
    if (this._separator.length > 0) yield new Segment(this._separator);
    yield new Segment(this._left, bgAsFg(right.edgeStyle("left", options)));
  }

  join(left: T | null, right: T | null): Renderable {
    return deferred((options) => this._emit(left, right, options));
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
    const steps = this._steps;
    return deferred(function* (options) {
      const lbg = left.edgeStyle("right", options).bgcolor;
      const rbg = right.edgeStyle("left", options).bgcolor;
      if (!lbg || !rbg) return;
      const lTrip = lbg.getTruecolor();
      const rTrip = rbg.getTruecolor();
      const samples = 2 * steps;
      // Midpoint sampling across `2 * steps` half-cell positions: sample j has
      // t = (j + 0.5) / samples. Cell i takes samples 2i (left half) and 2i+1
      // (right half). No sample ever equals either anchor.
      for (let i = 0; i < steps; i++) {
        const tLeft = (2 * i + 0.5) / samples;
        const tRight = (2 * i + 1.5) / samples;
        const fg = ColorSpec.fromRgba(blendRgb(lTrip, rTrip, tLeft));
        const bg = ColorSpec.fromRgba(blendRgb(lTrip, rTrip, tRight));
        yield new Segment(HALF_BLOCK, new Style({ color: fg, bgcolor: bg }));
      }
    });
  }
}
