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

import type { Anchor } from "./anchor.js";
import { Segment } from "./segment.js";
import { Style } from "./style.js";
import { ColorDepth, ColorSpec, SURFACE_BLACK } from "./color.js";
import { Oklch } from "./oklch.js";
import { cellLen } from "./cells.js";
import { fnv1a } from "./fnv1a.js";
import { drawable, getStyle, isAscii, type Measurable, type Renderable, type RenderOptions } from "./protocol.js";

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

/**
 * Where a join sits in its strip. `index` counts joins from the strip's start:
 * the join before item `i` is `i`, and the end after the last of `n` items is
 * `n`. It names the seam, not the line it lands on, so where a `FlexStrip`
 * wraps, the end cap and the next line's lead both carry the index of the seam
 * the wrap replaced — and every seam that survives a wrap keeps its own.
 */
export interface JoinContext {
  readonly index: number;
}

export interface Joiner<T extends StyledRenderable = StyledRenderable> {
  /**
   * `left === null` marks the start endpoint; `right === null` marks the end
   * endpoint. The joiner decides what an endpoint looks like — typically
   * fg-only with no bg so the strip blends into the terminal background.
   */
  join(left: T | null, right: T | null, context: JoinContext): Renderable;
}

/**
 * The owner every cell a strip's joiner draws is stamped with
 * (`Segment.anchorLines`), whatever the joiner: a seam is told by what drew
 * it, never by its glyph, which an ASCII joiner draws otherwise and a lead may
 * not draw at all. An effect reads it to leave a seam out of the words it
 * keeps legible (`drawnOf`, `../renderables/effect.ts`).
 *
 * Inside it, every cell a `CellJoiner` draws names whose colour each of its
 * two sides shows (`colorsOwnedBy`). One seam cell can show two neighbours —
 * a powerline arrow is inked in the fill it points out of, over the fill it
 * points into — so a cell has no single owner; each side has one.
 */
export const JOIN: object = Object.freeze({ name: "join" });

/**
 * Whose colour each side of a join cell shows on screen, its ink and its
 * ground: the neighbour whose edge a `Paint` names, or `null` for a role, a
 * mix or the terminal's ground, which are no neighbour's.
 */
class ColorOwners {
  constructor(
    readonly fg: object | null,
    readonly bg: object | null,
  ) {}
}

/**
 * Which of a cell's two colours on screen are `owner`'s: both, for a cell
 * `owner` drew, itself or through an owner nested in its output; for a cell a
 * `CellJoiner` drew, the sides shown in `owner`'s colour.
 */
export function colorsOwnedBy(anchor: Anchor | undefined, owner: object): { readonly fg: boolean; readonly bg: boolean } {
  for (let level = anchor; level; level = level.inner) {
    if (level.owner === owner) return { fg: true, bg: true };
    if (level.owner instanceof ColorOwners) return { fg: level.owner.fg === owner, bg: level.owner.bg === owner };
  }
  return { fg: false, bg: false };
}

/**
 * [LAW:single-enforcer] What `joiner` draws at one join, every cell stamped
 * as `JOIN`'s: the one way `Strip` and `FlexStrip` draw a join.
 */
export function drawJoin<T extends StyledRenderable>(joiner: Joiner<T>, left: T | null, right: T | null, context: JoinContext): Renderable {
  const join = joiner.join(left, right, context);
  return { render: (options) => Segment.anchorLines([[...join.render(options)]], JOIN)[0]! };
}

/**
 * [LAW:single-enforcer] What `item` draws, every cell stamped as the item's,
 * so whoever holds the composed row reads which item drew a cell however the
 * row was laid out or wrapped: the one way `Strip` and `FlexStrip` draw an
 * item.
 */
export function drawItem(item: StyledRenderable): Renderable {
  return { render: (options) => Segment.anchorLines([[...item.render(options)]], item)[0]! };
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
    yield* drawJoin(this.joiner, null, items[0]!, { index: 0 }).render(row);
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      yield* drawItem(item).render(row);
      const next = i + 1 < items.length ? items[i + 1]! : null;
      yield* drawJoin(this.joiner, item, next, { index: i + 1 }).render(row);
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
 * measure a join by rendering it. Which member stands is hashed from the
 * join's part, its `index` and the cell's place in it, so it holds still from
 * frame to frame while the items before it do, and differs from seam to seam
 * even between the same two colours.
 */
export interface JoinCell {
  readonly glyph: string | { readonly oneOf: readonly string[] };
  readonly fg: CellColor;
  readonly bg: CellColor;
}

/**
 * The cells a joiner draws at each kind of join:
 *   • `seam` — between two neighbours;
 *   • `divider` — in the seam's place where every seam cell's ink is drawn
 *     indistinct from its own ground (see `SEAM_MIN_DELTA_E`), so the seam
 *     would vanish;
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
 * The least ΔE_OK a seam cell's ink must differ from its own ground by for the
 * seam to be seen. Below it the eye cannot tell the ink from the ground,
 * so the joiner draws the divider instead. Twice the ~.02 threshold of a visible difference, because a seam is
 * one cell wide.
 */
export const SEAM_MIN_DELTA_E = 0.04;

function* paintsIn(paint: Paint): Iterable<Paint> {
  yield paint;
  if ("mix" in paint) {
    yield* paintsIn(paint.mix[0]);
    yield* paintsIn(paint.mix[1]);
  }
}

const glyphsOf = (cell: JoinCell): readonly string[] => (typeof cell.glyph === "string" ? [cell.glyph] : cell.glyph.oneOf);
// An integer hash, so every engine picks the same member, scaled from its high
// bits — FNV-1a's low bits barely mix — so the pick is in range by
// construction. The part is in the key so a wrap's tail and lead, which share
// an index, are picked independently.
const pickGlyph = (cell: JoinCell, part: Part, index: number, at: number): string => {
  const glyphs = glyphsOf(cell);
  return glyphs[Math.floor((parseInt(fnv1a(`${part}:${index}:${at}`), 16) / 2 ** 32) * glyphs.length)]!;
};
const cellWidth = (cell: JoinCell): number => cellLen(glyphsOf(cell)[0] ?? "");
const partWidth = (cells: readonly JoinCell[]): number => cells.reduce((width, cell) => width + cellWidth(cell), 0);

type Refuse = (why: string) => never;

// `raw` as a `Paint`, or refused. `absent` is the neighbour this part may not
// name, because the part is also drawn where that neighbour does not exist.
function parsePaint(raw: unknown, absent: "left" | "right" | undefined, refuse: Refuse): Paint {
  if (raw === "ground") return refuse("mixes ground, whose colour is unknown");
  const p = (typeof raw === "object" && raw !== null ? raw : {}) as { edge?: unknown; part?: unknown; role?: unknown; mix?: unknown };
  if ((p.edge === "left" || p.edge === "right") && (p.part === "bg" || p.part === "fg")) {
    if (p.edge === absent) refuse(`names the ${absent} neighbour, which this part is drawn without`);
    return Object.freeze({ edge: p.edge, part: p.part });
  }
  if (typeof p.role === "string") return Object.freeze({ role: p.role });
  if (Array.isArray(p.mix) && p.mix.length === 3) {
    const [from, to, t] = p.mix as unknown[];
    if (typeof t !== "number" || !(t >= 0 && t <= 1)) refuse(`mixes at ${String(t)}, outside 0..1`);
    return Object.freeze({ mix: Object.freeze([parsePaint(from, absent, refuse), parsePaint(to, absent, refuse), t as number] as const) });
  }
  return refuse(`has a colour that is not a Paint: ${JSON.stringify(raw)}`);
}

const parseColor = (raw: CellColor, absent: "left" | "right" | undefined, refuse: Refuse): CellColor =>
  raw === "ground" ? raw : parsePaint(raw, absent, refuse);

const ABSENT: Readonly<Record<Part, "left" | "right" | undefined>> = { seam: undefined, divider: undefined, lead: "left", tail: "right" };

function parseList(raw: unknown, where: string): readonly JoinCell[] {
  if (!Array.isArray(raw)) throw new Error(`CellJoiner: ${where} is not a list of cells`);
  return raw.map((cell: unknown, i) => {
    if (typeof cell !== "object" || cell === null) throw new Error(`CellJoiner: ${where}[${i}] is not a cell`);
    return cell as JoinCell;
  });
}

/**
 * [LAW:parse-dont-validate] The one place a shape is checked, so every rule
 * the cell model states is refused at construction and the render reads a
 * shape that already holds them. A shape is often authored as data — a
 * consumer's config — so the rules the types state are checked here too, and
 * what comes back is a frozen copy the caller can no longer change.
 */
function parseShape(raw: JoinShape, form: "glyph" | "ascii"): JoinShape {
  const parseCells = (part: Part): readonly JoinCell[] =>
    Object.freeze(
      parseList(raw[part], `${form} ${part}`).map((cell, i): JoinCell => {
        const refuse: Refuse = (why) => {
          throw new Error(`CellJoiner: ${form} ${part}[${i}] ${why}`);
        };
        const glyph: unknown = cell.glyph;
        const oneOf: unknown = typeof glyph === "object" && glyph !== null ? (glyph as { oneOf?: unknown }).oneOf : undefined;
        if (typeof glyph !== "string" && !(Array.isArray(oneOf) && oneOf.every((g) => typeof g === "string"))) {
          refuse(`has a glyph that is neither a string nor a oneOf of strings: ${JSON.stringify(glyph)}`);
        }
        if (cell.fg === "ground" && cell.bg === "ground") refuse("has ground on both sides");
        const glyphs = glyphsOf(cell);
        if (glyphs.length === 0) refuse("has an empty oneOf");
        if (glyphs.some((glyph) => cellLen(glyph) !== cellWidth(cell))) refuse("has oneOf members of different widths");
        if (form === "ascii" && !glyphs.every(isAscii)) refuse("is not ASCII");
        return Object.freeze({
          glyph: typeof cell.glyph === "string" ? cell.glyph : Object.freeze({ oneOf: Object.freeze([...glyphs]) }),
          fg: parseColor(cell.fg, ABSENT[part], refuse),
          bg: parseColor(cell.bg, ABSENT[part], refuse),
        });
      }),
    );
  const seam = parseCells("seam");
  // A divider authored as the seam itself stays the seam, so a render can see
  // it has no choice to make.
  const divider = raw.divider === raw.seam ? seam : parseCells("divider");
  if (partWidth(divider) !== partWidth(seam)) throw new Error(`CellJoiner: ${form} divider is not the width of the seam`);
  return Object.freeze({ seam, divider, lead: parseCells("lead"), tail: parseCells("tail") });
}

// Whether any cell of `shape` paints with `side`'s ground.
const readsGround = (shape: JoinShape, side: "left" | "right"): boolean =>
  PARTS.flatMap((part) => shape[part]).some((cell) =>
    [cell.fg, cell.bg].some((color) => color !== "ground" && [...paintsIn(color)].some((p) => "edge" in p && p.edge === side && p.part === "bg")),
  );

// One form of a joiner — its shape and what is read off the shape once, so a
// render does not re-derive it. Which neighbours the form needs a ground from
// belongs to the form drawn, never to the other one.
interface Form {
  readonly shape: JoinShape;
  readonly reads: { readonly left: boolean; readonly right: boolean };
}

function formOf(shape: JoinShape): Form {
  return { shape, reads: { left: readsGround(shape, "left"), right: readsGround(shape, "right") } };
}

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

// A cell whose ink the eye cannot tell from its ground, read off the style it
// is drawn in. What is measured is what is drawn — `Style.drawnColors`, the
// colours the writer encodes: the ink flattened onto the cell's own ground and
// the ground onto the terminal's black, both downgraded to the depth the
// render encodes at, so two colours that depth rounds to one entry are the one
// entry they render as. A colour whose RGB is the terminal theme's own (ANSI
// 0–15, a blend reaching one) has no value here, so two of them are the same
// only when they are one expression: the same palette slot — its `number`,
// never the name or the depth that spells it ("red", "color(1)", an EIGHT_BIT
// spec on 0–15 are one slot) — or the same blend, whose name spells each end
// by its slot for the same reason. A cell on the terminal's ground, or in
// reverse video over it, has a colour nobody knows on one side, and is seen.
function vanishes(style: Style, colorSystem: ColorDepth | null | undefined): boolean {
  if (style.reverse) return false;
  const { color, bgcolor } = style.drawnColors(colorSystem ?? ColorDepth.TRUECOLOR);
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
 * shape paints with its ground anywhere and it has none to paint. With both present the
 * join is the seam, or the divider where every seam cell's ink is drawn
 * indistinct from its ground at `options.colorSystem`; with only the right, the lead; with only
 * the left, the tail; with neither, nothing.
 *
 * `ascii` is the shape an ASCII-only output draws instead, whole.
 */
export class CellJoiner<T extends StyledRenderable = StyledRenderable> implements Joiner<T> {
  readonly shape: JoinShape;
  readonly ascii: JoinShape;
  private readonly _forms: { readonly glyph: Form; readonly ascii: Form };

  constructor(shape: JoinShape, ascii: JoinShape) {
    this.shape = parseShape(shape, "glyph");
    this.ascii = parseShape(ascii, "ascii");
    this._forms = { glyph: formOf(this.shape), ascii: formOf(this.ascii) };
  }

  join(left: T | null, right: T | null, { index }: JoinContext): Renderable {
    const forms = this._forms;
    return {
      *render(options: RenderOptions): Iterable<Segment> {
        const { shape: drawn, reads } = drawable(options, forms.glyph, forms.ascii, (form) => shapeGlyphs(form.shape));
        const edges: Edges = { left: left?.edgeStyle("right", options), right: right?.edgeStyle("left", options) };
        const leftBg = paintableBg(edges.left?.bgcolor);
        const rightBg = paintableBg(edges.right?.bgcolor);
        const hasLeft = left !== null && (!reads.left || leftBg !== undefined);
        const hasRight = right !== null && (!reads.right || rightBg !== undefined);
        const neighbours = { left, right };
        // On screen a cell's ink is its `fg` paint and its ground its `bg`,
        // reverse video or not (`cellStyle`).
        const ownerOf = (color: CellColor): object | null => (color !== "ground" && "edge" in color ? neighbours[color.edge] : null);
        const styled = (part: Part) =>
          drawn[part].map((cell, at) => {
            const owners = new ColorOwners(ownerOf(cell.fg), ownerOf(cell.bg));
            return new Segment(pickGlyph(cell, part, index, at), cellStyle(cell, edges, options).withAnchor({ owner: owners, row: 0, col: 0, inner: undefined }));
          });
        if (!hasLeft || !hasRight) {
          if (hasLeft || hasRight) yield* styled(hasRight ? "lead" : "tail");
          return;
        }
        // A seam is lost only when every cell of it is: one cell rounded into
        // its ground at a shallow depth still leaves the others to show the
        // step, and measuring per cell, not across the two grounds, divides a
        // seam stepping in thirds where each third would not be seen.
        const seam = styled("seam");
        const lost = drawn.divider !== drawn.seam && seam.every((segment) => segment.style !== undefined && vanishes(segment.style, options.colorSystem));
        yield* lost ? styled("divider") : seam;
      },
    };
  }
}

// --- The bundled joiners ---

const LEFT_BG: Paint = { edge: "left", part: "bg" };
const RIGHT_BG: Paint = { edge: "right", part: "bg" };
const LEFT_FG: Paint = { edge: "left", part: "fg" };
const HALF: Paint = { mix: [LEFT_BG, RIGHT_BG, 1 / 2] };

const GROUND = "ground";

// A one-cell edge in the powerline family: `glyph` in the left ground over the
// right; divided by `thin` in the left item's text; led by the same glyph with
// the left ground replaced by the terminal's — in reverse video, a notch whose
// ink is the terminal's background — and tailed by it over the terminal's.
function edge(glyph: string, thin: string): JoinShape {
  return {
    seam: [{ glyph, fg: LEFT_BG, bg: RIGHT_BG }],
    divider: [{ glyph: thin, fg: LEFT_FG, bg: LEFT_BG }],
    lead: [{ glyph, fg: GROUND, bg: RIGHT_BG }],
    tail: [{ glyph, fg: LEFT_BG, bg: GROUND }],
  };
}

// Three powerline arrows stepping through the two thirds between the grounds.
function prism(glyph: string, thin: string): JoinShape {
  const third = (t: number): Paint => ({ mix: [LEFT_BG, RIGHT_BG, t] });
  const pad: JoinCell = { glyph: " ", fg: LEFT_FG, bg: LEFT_BG };
  return {
    ...edge(glyph, thin),
    seam: [
      { glyph, fg: LEFT_BG, bg: third(1 / 3) },
      { glyph, fg: third(1 / 3), bg: third(2 / 3) },
      { glyph, fg: third(2 / 3), bg: RIGHT_BG },
    ],
    divider: [pad, { glyph: thin, fg: LEFT_FG, bg: LEFT_BG }, pad],
  };
}

// A powerline-family joiner: `shape` over `glyph`, its ASCII form the same
// shape over `ascii`, beginning each run flat — an ASCII arrow reversed out of
// the terminal's ground is a block of nothing.
const arrows = (shape: (glyph: string, thin: string) => JoinShape, glyph: string, thin: string, ascii: string, asciiThin: string): CellJoiner =>
  new CellJoiner(shape(glyph, thin), { ...shape(ascii, asciiThin), lead: [] });

// Each run closed by `close` and opened by `open`, both in its ground over the
// terminal's, with `between` — cells on the terminal's ground — between runs.
function pill(open: string, close: string, between: readonly JoinCell[]): JoinShape {
  const seam: JoinCell[] = [{ glyph: close, fg: LEFT_BG, bg: GROUND }, ...between, { glyph: open, fg: RIGHT_BG, bg: GROUND }];
  return { seam, divider: seam, lead: [{ glyph: open, fg: RIGHT_BG, bg: GROUND }], tail: [{ glyph: close, fg: LEFT_BG, bg: GROUND }] };
}

const capsule = (open: string, close: string): JoinShape => pill(open, close, [{ glyph: " ", fg: LEFT_FG, bg: GROUND }]);
const metro = (open: string, close: string, rail: string): JoinShape => pill(open, close, [{ glyph: rail, fg: { role: "strip.rail" }, bg: GROUND }]);

// One cell drawn over the two grounds' midpoint, so it reads as neither item's;
// nothing at the ends, where there is no second ground to meet.
function midpoint(glyph: JoinCell["glyph"], fg: Paint): JoinShape {
  const seam: JoinCell[] = [{ glyph, fg, bg: HALF }];
  return { seam, divider: seam, lead: [], tail: [] };
}

// A ragged tear in the left ground over the midpoint; where that ink would
// vanish into the midpoint — grounds a few steps apart, or one ground — the
// same tear in the left item's text.
function torn(glyphs: readonly string[]): JoinShape {
  return { ...midpoint({ oneOf: glyphs }, LEFT_BG), divider: [{ glyph: { oneOf: glyphs }, fg: LEFT_FG, bg: HALF }] };
}

const PLAIN_SEAM: readonly JoinCell[] = [{ glyph: " | ", fg: { role: "strip.separator" }, bg: GROUND }];
const PLAIN: JoinShape = { seam: PLAIN_SEAM, divider: PLAIN_SEAM, lead: [], tail: [] };

/**
 * The bundled joiners, by name. What each draws is `docs/strip.md`'s
 * "Built-in joiners"; a name from config is read with `joinerNamed`.
 */
export const JOINERS = Object.freeze({
  powerline: arrows(edge, "\ue0b0", "\ue0b1", ">", ">"),
  prism: arrows(prism, "\ue0b0", "\ue0b1", ">", ">"),
  slant: arrows(edge, "\ue0bc", "\ue0bd", "/", "/"),
  backslant: arrows(edge, "\ue0b8", "\ue0b9", "\\", "\\"),
  flame: arrows(edge, "\ue0c0", "\ue0c1", "}", "}"),
  pixel: arrows(edge, "\ue0c4", "\ue0b1", "#", ">"),
  ice: arrows(edge, "\ue0c8", "\ue0b1", "]", ">"),
  bubble: arrows(edge, "\ue0b4", "\ue0b5", ")", ")"),
  capsule: new CellJoiner(capsule("\ue0b6", "\ue0b4"), capsule("(", ")")),
  wrapper: new CellJoiner(pill("\ue0b2", "\ue0b0", []), pill("<", ">", [])),
  metro: new CellJoiner(metro("\ue0b6", "\ue0b4", "\u2500\u2500"), metro("(", ")", "--")),
  stitch: new CellJoiner(midpoint("\u250a", LEFT_FG), midpoint(":", LEFT_FG)),
  torn: new CellJoiner(torn(["\u259a\u259e", "\u259e\u259a", "\u2598\u2597", "\u259d\u2596", "\u2596\u259d", "\u2597\u2598"]), torn(["/\\", "\\/"])),
  plain: new CellJoiner(PLAIN, PLAIN),
});

type JoinerName = keyof typeof JOINERS;

/**
 * The bundled joiner `name` names — a name read from config, parsed. Throws on
 * any other string, naming the ones there are; an own-key test, so `toString`
 * and the rest of `Object.prototype` are not joiners.
 */
export function joinerNamed(name: string): CellJoiner {
  if (!isJoinerName(name)) throw new Error(`no joiner named ${JSON.stringify(name)}; the joiners are ${Object.keys(JOINERS).join(", ")}`);
  return JOINERS[name];
}

const isJoinerName = (name: string): name is JoinerName => Object.hasOwn(JOINERS, name);

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
