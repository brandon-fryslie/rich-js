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
import { ColorDepth, ColorSpec, SURFACE_BLACK } from "./color.js";
import { Oklch } from "./oklch.js";
import { cellLen } from "./cells.js";
import { drawable, getStyle, type Measurable, type Renderable, type RenderOptions } from "./protocol.js";

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

export class Strip<T extends StyledRenderable = StyledRenderable> implements Renderable, Measurable {
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
    //
    // The row sits its items side by side, so none is handed a justify: a
    // `left` fills the canvas, and the first item would pad over the rest of
    // the row. Where the row sits in the width is its container's to say.
    const row: RenderOptions = { ...options, justify: undefined };
    yield* this.joiner.join(null, items[0]!).render(row);
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      yield* item.render(row);
      const next = i + 1 < items.length ? items[i + 1]! : null;
      yield* this.joiner.join(item, next).render(row);
    }

    // [LAW:one-source-of-truth] `Strip`'s sibling `FlexStrip` ends every line
    // it emits, including the last, and the other block-level renderables
    // (`Panel`/`Rule`/`Table` structurally, `RichText` via `end`) do too — so
    // `Group` can emit children back to back with nothing in between
    // (docs/group.md). A `Strip` that left its last line open broke only
    // under composition: printed alone, Console's own "close whatever the
    // renderable left open" step (console.ts) papered over it, and a `Group`
    // of a Strip and a RichText ran the RichText onto the Strip's line
    // instead of below it. `LINE_ENDS` in test/seam/line-ends.ts is the list
    // of which renderables end their own line and which are fragments.
    yield Segment.line();
  }

  /**
   * [LAW:one-source-of-truth] The width of the one row it draws, and that is
   * both bounds: the row never wraps and no item is offered less than the whole
   * width, so there is no narrower strip to report as a minimum. Read off the
   * drawing rather than summed from the items' measurements, which describe
   * how an item could be drawn, not how the walk draws it.
   */
  measure(options: RenderOptions): { minimum: number; maximum: number } {
    let width = 0;
    for (const segment of this.render(options)) width += segment.cellLength;
    return { minimum: width, maximum: width };
  }
}

// --- CellJoiner ---

/**
 * A colour a joiner's cell is drawn in. Each variant names where the colour
 * comes from when the join is drawn:
 *   • an `edge` — a neighbour's ground (`bg`) or text (`fg`) at the column
 *     facing the join, read through `StyledRenderable.edgeStyle`;
 *   • a `role` — a style name, resolved against the render's theme, whose
 *     foreground colour is the colour;
 *   • a `mix` — two colours blended at `t` (0 is the first, 1 the second).
 */
export type Paint =
  | { readonly edge: "left" | "right"; readonly part: "bg" | "fg" }
  | { readonly role: string }
  | { readonly mix: readonly [Paint, Paint, number] };

/**
 * A `Paint`, or `"ground"`: the terminal's own background, whose colour nobody
 * knows. That is why it is never mixed (`Paint` excludes it), and why a cell
 * may put it on one side only. As a cell's `fg` it is drawn in reverse video —
 * the glyph's ink shows the terminal's background through a cell filled with
 * the `bg` colour — so an inverted shape is the same glyph, never a glyph of
 * its own.
 */
export type CellColor = Paint | "ground";

/**
 * One styled run of a join. A `oneOf` glyph is a set any member of which may
 * stand in the cell; every member has the same width, because consumers
 * measure a join by rendering it.
 */
export interface JoinCell {
  readonly glyph: string | { readonly oneOf: readonly string[] };
  readonly fg: CellColor;
  readonly bg: CellColor;
}

/**
 * The cells a joiner draws at each kind of join:
 *   • `seam` — between two neighbours;
 *   • `divider` — in the seam's place where the two grounds are drawn as one
 *     colour (see `SEAM_MIN_DELTA_E`), so the seam would vanish into them;
 *     the same width as `seam`;
 *   • `lead` — where a run is entered from nothing: the strip's start, or a
 *     neighbour with no ground for the seam to paint. It cannot name `left`;
 *   • `tail` — where a run leaves into nothing. It cannot name `right`.
 */
export interface JoinShape {
  readonly seam: readonly JoinCell[];
  readonly divider: readonly JoinCell[];
  readonly lead: readonly JoinCell[];
  readonly tail: readonly JoinCell[];
}

type Part = keyof JoinShape;
const PARTS: readonly Part[] = ["seam", "divider", "lead", "tail"];

/**
 * The least ΔE_OK two neighbouring backgrounds must differ by for a seam drawn
 * between them to be seen. Below it the seam is drawn in a colour the eye
 * cannot tell from its own background, so the joiner draws the divider
 * instead. Twice the ~.02 threshold of a visible difference, because a seam is
 * one cell wide.
 */
export const SEAM_MIN_DELTA_E = 0.04;

const ASCII_TEXT = /^[\x00-\x7F]*$/;

function* paintsIn(color: CellColor): Iterable<Paint | "ground"> {
  yield color;
  if (typeof color === "object" && "mix" in color) {
    yield* paintsIn(color.mix[0]);
    yield* paintsIn(color.mix[1]);
  }
}

const glyphsOf = (cell: JoinCell): readonly string[] => (typeof cell.glyph === "string" ? [cell.glyph] : cell.glyph.oneOf);
const cellWidth = (cell: JoinCell): number => cellLen(glyphsOf(cell)[0] ?? "");
const partWidth = (cells: readonly JoinCell[]): number => cells.reduce((width, cell) => width + cellWidth(cell), 0);

/**
 * [LAW:parse-dont-validate] The one place a shape is checked, so every rule
 * the cell model states is refused at construction and the render reads a
 * shape that already holds them. A shape is often authored as data — a
 * consumer's config — so the rules the types state are checked here too.
 */
function checkShape(shape: JoinShape, form: "glyph" | "ascii"): JoinShape {
  const refuse = (where: string, why: string): never => {
    throw new Error(`CellJoiner: ${form} ${where} ${why}`);
  };
  for (const part of PARTS) {
    shape[part].forEach((cell, i) => {
      const where = `${part}[${i}]`;
      if (cell.fg === "ground" && cell.bg === "ground") refuse(where, "has ground on both sides");
      for (const side of [cell.fg, cell.bg]) {
        if (typeof side === "object" && "mix" in side) {
          for (const inner of paintsIn(side)) if (inner === "ground") refuse(where, "mixes ground, whose colour is unknown");
        }
        for (const paint of paintsIn(side)) {
          if (typeof paint !== "object" || !("edge" in paint)) continue;
          if (part === "lead" && paint.edge === "left") refuse(where, "names the left neighbour, which a lead never has");
          if (part === "tail" && paint.edge === "right") refuse(where, "names the right neighbour, which a tail never has");
        }
      }
      const glyphs = glyphsOf(cell);
      if (glyphs.length === 0) refuse(where, "has an empty oneOf");
      if (glyphs.some((glyph) => cellLen(glyph) !== cellWidth(cell))) refuse(where, "has oneOf members of different widths");
      if (form === "ascii" && !glyphs.every((glyph) => ASCII_TEXT.test(glyph))) refuse(where, "is not ASCII");
    });
  }
  if (partWidth(shape.divider) !== partWidth(shape.seam)) refuse("divider", "is not the width of the seam");
  return shape;
}

// Whether any cell of `cells` paints with `side`'s ground.
const readsGround = (cells: readonly JoinCell[], side: "left" | "right"): boolean =>
  cells.some((cell) =>
    [cell.fg, cell.bg].some((color) => [...paintsIn(color)].some((p) => typeof p === "object" && "edge" in p && p.edge === side && p.part === "bg")),
  );

// A bg with a real colour to paint. `undefined` (no bg) and the terminal
// DEFAULT colour (transparent — identical to the terminal background) are the
// two representations of "nothing to paint", so an explicit `… on default`
// cannot smuggle a seam.
function paintableBg(bg: ColorSpec | undefined): ColorSpec | undefined {
  return bg !== undefined && !bg.isDefault ? bg : undefined;
}

// A neighbour's ground as the writer draws it (`Style.drawnColors`, onto the
// terminal's black), so a translucent ground is not composited a second time
// over whatever a join cell enters.
function drawnGround(bg: ColorSpec): ColorSpec {
  return bg.flattenAlpha(SURFACE_BLACK);
}

// A seam the eye cannot tell from the ground it is drawn on. What is measured
// is what is drawn — `Style.drawnColors`, the colours the writer encodes: the
// left ground flattened onto the right and the right onto the terminal's
// black, both downgraded to the depth the render encodes at, so two grounds
// 256 colours round to one cube entry are the one entry they render as. A
// colour whose RGB is the terminal theme's own (ANSI 0–15, a blend reaching
// one) has no value here, so two of them are the same only when they are one
// expression: the same palette slot — its `number`, never the name or the
// depth that spells it ("red", "color(1)", an EIGHT_BIT spec on 0–15 are one
// slot) — or the same blend, whose name spells each end by its slot for the
// same reason.
function vanishes(leftBg: ColorSpec, rightBg: ColorSpec, colorSystem: ColorDepth | null | undefined): boolean {
  const { color, bgcolor } = new Style({ color: drawnGround(leftBg), bgcolor: rightBg }).drawnColors(colorSystem ?? ColorDepth.TRUECOLOR);
  if (color === undefined || bgcolor === undefined) return false;
  const av = color.fixedValue;
  const bv = bgcolor.fixedValue;
  return av !== undefined && bv !== undefined
    ? Oklch.fromRgba(av).deltaE(Oklch.fromRgba(bv)) < SEAM_MIN_DELTA_E
    : color.number !== undefined ? color.number === bgcolor.number : color.name === bgcolor.name;
}

interface Edges {
  readonly left: Style | undefined;
  readonly right: Style | undefined;
}

function resolvePaint(paint: Paint, edges: Edges, options: RenderOptions): ColorSpec | undefined {
  if ("edge" in paint) {
    const edge = edges[paint.edge];
    if (paint.part === "fg") return edge?.color;
    const bg = paintableBg(edge?.bgcolor);
    return bg && drawnGround(bg);
  }
  if ("role" in paint) return getStyle(options, paint.role).color;
  const [from, to, t] = paint.mix;
  const a = resolvePaint(from, edges, options);
  const b = resolvePaint(to, edges, options);
  // A mix with no colour at one end has nothing to blend toward.
  return a && b && ColorSpec.blend(a, b, t);
}

function cellStyle(cell: JoinCell, edges: Edges, options: RenderOptions): Style {
  // [LAW:dataflow-not-control-flow] "ground" is the absence of a colour on its
  // side; as the fg it is reverse video over the bg colour, so the glyph's ink
  // is the terminal's own background.
  if (cell.fg === "ground") return new Style({ color: cell.bg === "ground" ? undefined : resolvePaint(cell.bg, edges, options), reverse: true });
  const color = resolvePaint(cell.fg, edges, options);
  return new Style({ color, bgcolor: cell.bg === "ground" ? undefined : resolvePaint(cell.bg, edges, options) });
}

const shapeGlyphs = (shape: JoinShape): string => PARTS.flatMap((part) => shape[part].flatMap(glyphsOf)).join("");

/**
 * The one joiner: what it draws at each join is the `JoinShape` it is given,
 * so a new joiner is a value, never a class.
 *
 * Which part a join draws is read off its two neighbours. A neighbour is
 * missing at the strip's ends, and counts as missing — an endpoint — when the
 * seam paints with its ground and it has none to paint. With both present the
 * join is the seam, or the divider where the two grounds are drawn as one
 * colour at `options.colorSystem`; with only the right, the lead; with only
 * the left, the tail; with neither, nothing.
 *
 * `ascii` is the shape an ASCII-only output draws instead, whole.
 */
export class CellJoiner<T extends StyledRenderable = StyledRenderable> implements Joiner<T> {
  readonly shape: JoinShape;
  readonly ascii: JoinShape;
  private readonly _seamReads: { readonly left: boolean; readonly right: boolean };

  constructor(shape: JoinShape, ascii: JoinShape) {
    this.shape = checkShape(shape, "glyph");
    this.ascii = checkShape(ascii, "ascii");
    this._seamReads = { left: readsGround(shape.seam, "left"), right: readsGround(shape.seam, "right") };
  }

  join(left: T | null, right: T | null): Renderable {
    const { shape, ascii, _seamReads: reads } = this;
    return {
      *render(options: RenderOptions): Iterable<Segment> {
        const drawn = drawable(options, shape, ascii, shapeGlyphs);
        const edges: Edges = { left: left?.edgeStyle("right", options), right: right?.edgeStyle("left", options) };
        const leftBg = paintableBg(edges.left?.bgcolor);
        const rightBg = paintableBg(edges.right?.bgcolor);
        const hasLeft = left !== null && (!reads.left || leftBg !== undefined);
        const hasRight = right !== null && (!reads.right || rightBg !== undefined);
        const cells =
          hasLeft && hasRight
            ? leftBg && rightBg && vanishes(leftBg, rightBg, options.colorSystem) ? drawn.divider : drawn.seam
            : hasRight ? drawn.lead
            : hasLeft ? drawn.tail
            : [];
        // A oneOf draws its first member until a join knows its seam index
        // (rich-joiners-9ntp.bex).
        for (const cell of cells) yield new Segment(glyphsOf(cell)[0]!, cellStyle(cell, edges, options));
      },
    };
  }
}

// --- The four joiners as shapes ---

const LEFT_BG: Paint = { edge: "left", part: "bg" };
const RIGHT_BG: Paint = { edge: "right", part: "bg" };
const LEFT_FG: Paint = { edge: "left", part: "fg" };

const GROUND = "ground";

/**
 * The powerline joiner: U+E0B0 (right-arrow) in the left ground over the
 * right, divided by U+E0B1 (thin right-arrow) in the left item's text. The
 * lead is the arrow with the left ground replaced by the terminal's — drawn
 * in reverse video it leaves a notch whose base is the cell's left edge, the
 * terminal's own background showing through, so it matches under a
 * translucent terminal too. The tail is the arrow over the terminal's ground.
 * ASCII draws `>` everywhere and begins each run flat.
 */
export const POWERLINE_JOINER = new CellJoiner(
  {
    seam: [{ glyph: "", fg: LEFT_BG, bg: RIGHT_BG }],
    divider: [{ glyph: "", fg: LEFT_FG, bg: LEFT_BG }],
    lead: [{ glyph: "", fg: GROUND, bg: RIGHT_BG }],
    tail: [{ glyph: "", fg: LEFT_BG, bg: GROUND }],
  },
  {
    seam: [{ glyph: ">", fg: LEFT_BG, bg: RIGHT_BG }],
    divider: [{ glyph: ">", fg: LEFT_FG, bg: LEFT_BG }],
    lead: [],
    tail: [{ glyph: ">", fg: LEFT_BG, bg: GROUND }],
  },
);

function capsule(open: string, close: string): JoinShape {
  const seam: JoinCell[] = [
    { glyph: close, fg: LEFT_BG, bg: GROUND },
    { glyph: " ", fg: LEFT_FG, bg: GROUND },
    { glyph: open, fg: RIGHT_BG, bg: GROUND },
  ];
  return { seam, divider: seam, lead: [{ glyph: open, fg: RIGHT_BG, bg: GROUND }], tail: [{ glyph: close, fg: LEFT_BG, bg: GROUND }] };
}

/**
 * Rounded pills: each run opened by U+E0B6 and closed by U+E0B4, both in its
 * ground over the terminal's, a space between pills. ASCII draws `(` and `)`.
 */
export const CAPSULE_JOINER = new CellJoiner(capsule("", ""), capsule("(", ")"));

const PLAIN_SEAM: readonly JoinCell[] = [{ glyph: " | ", fg: { role: "strip.separator" }, bg: GROUND }];
const PLAIN: JoinShape = { seam: PLAIN_SEAM, divider: PLAIN_SEAM, lead: [], tail: [] };

/**
 * ` | ` between every pair of items, in the theme's `strip.separator` colour;
 * nothing at the ends. Its seam names no neighbour, so it joins items with no
 * ground too.
 */
export const PLAIN_JOINER = new CellJoiner(PLAIN, PLAIN);

function gradient(steps: number, glyph: string): JoinShape {
  // Midpoint sampling across `2 * steps` half-cell positions: cell i takes
  // samples 2i (its ink, the left half) and 2i+1 (its ground, the right half),
  // so no sample equals either neighbour's ground.
  const samples = 2 * steps;
  const seam = Array.from({ length: steps }, (_, i): JoinCell => ({
    glyph,
    fg: { mix: [LEFT_BG, RIGHT_BG, (2 * i + 0.5) / samples] },
    bg: { mix: [LEFT_BG, RIGHT_BG, (2 * i + 1.5) / samples] },
  }));
  return { seam, divider: seam, lead: [], tail: [] };
}

/**
 * A ramp of `steps` cells from the left ground to the right. Each cell is the
 * half block U+258C, ink on its left half and ground on its right, so it
 * carries two samples; ASCII draws a space, keeping the grounds alone. Nothing
 * at the ends, or beside a neighbour with no ground — there is no colour to
 * ramp toward.
 */
export function gradientJoiner(steps = 4): CellJoiner {
  return new CellJoiner(gradient(steps, "▌"), gradient(steps, " "));
}
