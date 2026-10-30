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
import { drawable, getStyle, isAscii, render, type Measurable, type Renderable, type RenderOptions } from "./protocol.js";

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
 * Inside it, every cell a `CellJoiner` draws is stamped with what it was
 * resolved from (`JoinedCell`), so a cell whose neighbours an effect moves is
 * resolved again from where they moved to.
 */
export const JOIN: object = Object.freeze({ name: "join" });

/**
 * [LAW:single-enforcer] What `joiner` draws at one join, every cell stamped
 * as `JOIN`'s: the one way `Strip` and `FlexStrip` draw a join.
 */
export function drawJoin<T extends StyledRenderable>(joiner: Joiner<T>, left: T | null, right: T | null, context: JoinContext): Renderable {
  const join = joiner.join(left, right, context);
  return { render: (options) => Segment.anchorLines([[...render(join, options)]], JOIN)[0]! };
}

/**
 * [LAW:single-enforcer] What `item` draws, every cell stamped as the item's,
 * so whoever holds the composed row reads which item drew a cell however the
 * row was laid out or wrapped: the one way `Strip` and `FlexStrip` draw an
 * item.
 */
export function drawItem(item: StyledRenderable): Renderable {
  return { render: (options) => Segment.anchorLines([[...render(item, options)]], item)[0]! };
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
    yield* render(drawJoin(this.joiner, null, items[0]!, { index: 0 }), row);
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      yield* render(drawItem(item), row);
      const next = i + 1 < items.length ? items[i + 1]! : null;
      yield* render(drawJoin(this.joiner, item, next, { index: i + 1 }), row);
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
    for (const segment of render(this, options)) width += segment.cellLength;
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
 * A cell of a seam, or one of the joiner's caps standing in a seam's place:
 * `{ cap: "tail" }` closes the run the seam leaves, `{ cap: "lead" }` opens the
 * run it enters, drawn as whatever caps the seam is joined with. That is how
 * a seam that parts its runs — `capsule`, `metro` — ends each in the caps
 * picked for it rather than in caps of its own.
 */
export type SeamCell = JoinCell | { readonly cap: "lead" | "tail" };

/**
 * What a joiner draws between two neighbours, in one form: `seam`, the cells
 * between them. Each is drawn with its ink held off its own ground
 * (`SEAM_MIN_DELTA_E`, `standOff`).
 */
export interface SeamForm {
  readonly seam: readonly SeamCell[];
}

/**
 * What a joiner draws at the ends of a run, in one form:
 *   • `lead` — where a run is entered from nothing: the strip's start, or a
 *     neighbour with no ground for the seam to paint. It cannot name `left`;
 *   • `tail` — where a run leaves into nothing. It cannot name `right`.
 */
export interface CapsForm {
  readonly lead: readonly JoinCell[];
  readonly tail: readonly JoinCell[];
}

/**
 * The middle of a joiner: its seam, and the `ascii` seam an ASCII-only output
 * draws instead. Picked apart from the caps, so any seam ends in any caps.
 */
export interface JoinSeam {
  readonly glyph: SeamForm;
  readonly ascii: SeamForm;
}

/** The ends of a joiner: its caps, and the `ascii` caps an ASCII-only output draws instead. */
export interface JoinCaps {
  readonly glyph: CapsForm;
  readonly ascii: CapsForm;
}

// A seam joined with its caps, every cap cell replaced by the cells it names:
// the one shape a render reads.
interface JoinShape {
  readonly seam: readonly JoinCell[];
  readonly lead: readonly JoinCell[];
  readonly tail: readonly JoinCell[];
}

type Part = keyof JoinShape;
type FormName = keyof JoinSeam;
const PARTS: readonly Part[] = ["seam", "lead", "tail"];

/**
 * The least ΔE_OK a join cell's ink must stand off its own ground by to be
 * seen. Below it the eye cannot tell the ink from the ground, so the joiner
 * lifts the ink to it (`standOff`). Twice the ~.02 threshold of a visible
 * difference, because a seam is one cell wide.
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

const ABSENT: Readonly<Record<Part, "left" | "right" | undefined>> = { seam: undefined, lead: "left", tail: "right" };
// Which argument of a joiner a part is authored in, so a refusal names it.
const AUTHORED_IN: Readonly<Record<Part, "seam" | "caps">> = { seam: "seam", lead: "caps", tail: "caps" };

function parseCell(cell: JoinCell, form: FormName, part: Part, refuse: Refuse): JoinCell {
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
}

// `raw[form][part]` as frozen cells, each checked by `parseOne`, or refused
// naming where it sits.
function parseCells<C>(raw: unknown, form: FormName, part: Part, parseOne: (cell: object, refuse: Refuse) => C): readonly C[] {
  const forms = raw as Partial<Record<FormName, Partial<Record<Part, unknown>>>> | null | undefined;
  const where = AUTHORED_IN[part];
  if (typeof forms?.[form] !== "object" || forms[form] === null) throw new Error(`${where}: has no ${form} form`);
  const cells = forms[form][part];
  if (!Array.isArray(cells)) throw new Error(`${where}: ${form} ${part} is not a list of cells`);
  return Object.freeze(
    cells.map((cell: unknown, i) => {
      const refuse: Refuse = (why) => {
        throw new Error(`${where}: ${form} ${part}[${i}] ${why}`);
      };
      return typeof cell === "object" && cell !== null ? parseOne(cell, refuse) : refuse("is not a cell");
    }),
  );
}

const asCell = (form: FormName, part: Part) => (cell: object, refuse: Refuse): JoinCell => parseCell(cell as JoinCell, form, part, refuse);

const asSeamCell = (form: FormName, part: Part) => (cell: object, refuse: Refuse): SeamCell => {
  if (!("cap" in cell)) return parseCell(cell as JoinCell, form, part, refuse);
  const { cap } = cell;
  if (Object.keys(cell).length !== 1) refuse("names a cap and draws cells of its own; a cell is one or the other");
  return cap === "lead" || cap === "tail" ? Object.freeze({ cap }) : refuse(`names a cap that is neither lead nor tail: ${JSON.stringify(cap)}`);
};

/**
 * [LAW:parse-dont-validate] The one place a seam is checked, so every rule
 * the cell model states is refused at construction and the render reads cells
 * that already hold them. A seam is often authored as data — a consumer's
 * config — so the rules the types state are checked here too, and what comes
 * back is a frozen copy the caller can no longer change.
 */
function parseSeam(raw: JoinSeam): JoinSeam {
  const parseForm = (form: FormName): SeamForm => Object.freeze({ seam: parseCells(raw, form, "seam", asSeamCell(form, "seam")) });
  return Object.freeze({ glyph: parseForm("glyph"), ascii: parseForm("ascii") });
}

/** [LAW:parse-dont-validate] `parseSeam`'s twin for the caps. */
function parseCaps(raw: JoinCaps): JoinCaps {
  const parseForm = (form: FormName): CapsForm =>
    Object.freeze({ lead: parseCells(raw, form, "lead", asCell(form, "lead")), tail: parseCells(raw, form, "tail", asCell(form, "tail")) });
  return Object.freeze({ glyph: parseForm("glyph"), ascii: parseForm("ascii") });
}

// One form of the seam joined with that form of the caps.
function joinForms(seam: SeamForm, caps: CapsForm): JoinShape {
  return { seam: seam.seam.flatMap((cell) => ("cap" in cell ? caps[cell.cap] : [cell])), lead: caps.lead, tail: caps.tail };
}

// The parts of `side`'s edge `cell` paints with: its ground (`bg`), its text (`fg`).
const partsRead = (cell: JoinCell, side: "left" | "right"): ReadonlySet<"fg" | "bg"> =>
  new Set([cell.fg, cell.bg].flatMap((color) => (color === "ground" ? [] : [...paintsIn(color)].flatMap((p) => ("edge" in p && p.edge === side ? [p.part] : [])))));

/** The parts of each neighbour's edge a join cell paints with. */
interface CellParts {
  readonly left: ReadonlySet<"fg" | "bg">;
  readonly right: ReadonlySet<"fg" | "bg">;
}

// Whether any of `cells` paints with `side`'s ground.
const readsGround = (cells: readonly JoinCell[], side: "left" | "right"): boolean =>
  cells.some((cell) =>
    [cell.fg, cell.bg].some((color) => color !== "ground" && [...paintsIn(color)].some((p) => "edge" in p && p.edge === side && p.part === "bg")),
  );

// One form of a joiner — its shape and what is read off the shape once, so a
// render does not re-derive it. Which neighbours the form needs a ground from
// belongs to the form drawn, never to the other one, and to the part drawn,
// never to the others: the seam from either neighbour, the lead from the right
// and the tail from the left, the only one each may name.
interface Form {
  readonly shape: JoinShape;
  readonly reads: { readonly seam: { readonly left: boolean; readonly right: boolean }; readonly lead: boolean; readonly tail: boolean };
  /** Each part's cells, with the parts of each neighbour's edge each paints with. */
  readonly cells: Readonly<Record<Part, readonly { readonly cell: JoinCell; readonly parts: CellParts }[]>>;
}

function formOf(shape: JoinShape): Form {
  const cells = (part: Part) => shape[part].map((cell) => ({ cell, parts: { left: partsRead(cell, "left"), right: partsRead(cell, "right") } }));
  return {
    shape,
    reads: {
      seam: { left: readsGround(shape.seam, "left"), right: readsGround(shape.seam, "right") },
      lead: readsGround(shape.lead, "right"),
      tail: readsGround(shape.tail, "left"),
    },
    cells: { seam: cells("seam"), lead: cells("lead"), tail: cells("tail") },
  };
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

// Whether ink stands off its ground, both as a depth draws them, by the floor a
// seam is seen at. A colour whose RGB is the terminal theme's own (ANSI 0–15, a
// blend reaching one) has no value here, so two of them stand apart unless they
// are one expression: the same palette slot — its `number`, never the name or
// the depth that spells it ("red", "color(1)", an EIGHT_BIT spec on 0–15 are
// one slot) — or the same blend, whose name spells each end by its slot for the
// same reason. At sixteen colours, then, the floor is a different slot. The
// terminal's default colour is nobody's to measure, and stands apart.
function standsOff(ink: ColorSpec, ground: ColorSpec): boolean {
  if (ink.isDefault || ground.isDefault) return true;
  const [a, b] = [ink.fixedValue, ground.fixedValue];
  return a !== undefined && b !== undefined
    ? Oklch.fromRgba(a).deltaE(Oklch.fromRgba(b)) >= SEAM_MIN_DELTA_E
    : ink.number !== undefined ? ink.number !== ground.number : ink.name !== ground.name;
}

// A step along a lightness ray: finer than the steps between the colours a
// truecolor writer draws, so the walk passes over none of them.
const LIFT_STEP = 0.001;

// The steps along `origin`'s lightness ray, its chroma and hue held, in the
// order the lift tries them: the smaller move first, and at an equal move the
// lighter, out to black and to white.
function* lightnessRay(origin: Oklch): Iterable<Oklch> {
  for (let k = 1; k * LIFT_STEP <= 1; k++) {
    for (const l of [origin.l + k * LIFT_STEP, origin.l - k * LIFT_STEP]) {
      if (l >= 0 && l <= 1) yield new Oklch(l, origin.c, origin.h);
    }
  }
}

/**
 * `ink`, a glyph's colour on `ground`, held at least `SEAM_MIN_DELTA_E` off it
 * as `depth` draws both (`Style.drawnColors`). Ink that already stands off is
 * returned as it is. Ink that does not becomes the drawn form of the nearest
 * step along its own OKLCH lightness ray, chroma and hue held, that stands off:
 * the smaller step, toward white or toward black. Every step is measured as the
 * depth draws it, so at 256 colours and at sixteen the candidates are the
 * entries the depth draws, and the side the ink moves to can differ between
 * depths. A floor measured on rounded colours is not monotone along a ray, so
 * the walk enumerates and never bisects. A side with no colour to measure is
 * left alone.
 *
 * [LAW:one-source-of-truth] The colour returned is the one measured — the
 * entry the depth draws, not the step that rounds to it — so a reader of the
 * cell at another depth (an export reads a recording in truecolor) sees the
 * colour that cleared the floor, never a step one unit off its ground.
 *
 * [LAW:single-enforcer] The one place a join cell's visibility is decided:
 * nothing outside the joiner predicts whether a seam will show.
 */
function standOff(ink: ColorSpec | undefined, ground: ColorSpec | undefined, depth: ColorDepth): ColorSpec | undefined {
  if (ink === undefined || ground === undefined) return ink;
  const drawn = (color: ColorSpec, at?: ColorDepth) => new Style({ color, bgcolor: ground }).drawnColors(at);
  const { color: shown, bgcolor: under } = drawn(ink, depth);
  if (standsOff(shown!, under!)) return ink;
  // The ray starts from the ink as it is laid on its ground, before a depth
  // rounds it; ink the terminal's theme draws starts from the colour the
  // default terminal theme gives it. Ink that vanishes is drawn in the same
  // kind as its ground — both fixed, or both the theme's — and every step is
  // drawn in that kind too, so it is measured as the ink was. Ink the depth
  // draws as the theme's (a slot, or a mix reaching one at truecolor) steps
  // between slots: an RGB beside a colour only the terminal knows could be
  // that very colour. Ink the depth fixes (that same mix is a cube entry at
  // 256) steps between fixed colours, for the same reason turned round.
  const laid = drawn(ink).color!;
  const kind = shown!.fixedValue === undefined ? ColorDepth.STANDARD : ColorDepth.TRUECOLOR;
  for (const step of lightnessRay(Oklch.fromRgba(laid.getTruecolor()))) {
    const candidate = drawn(ColorSpec.fromRgba(step.toRgba()).downgrade(kind), depth).color!;
    if (standsOff(candidate, under!)) return candidate;
  }
  // [LAW:no-silent-failure] Unreachable: the ray runs out to black and to
  // white, and no ground lies within the floor of both, nor is one slot both.
  throw new Error(`no colour on the lightness ray of ${ink.name} stands off ${ground.name} at depth ${ColorDepth[depth]}`);
}

/** A neighbour a join cell paints with, and its edge as the cell was resolved from it. */
export interface JoinSide {
  readonly owner: object;
  readonly edge: Style;
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

// [LAW:single-enforcer] The one resolution of a join cell's paints: at join
// time, and again whenever an effect moves the neighbours it reads
// (`JoinedCell`).
function cellStyle(cell: JoinCell, edges: Edges, options: RenderOptions): Style {
  // [LAW:dataflow-not-control-flow] "ground" is the absence of a colour on its
  // side; as the fg it is reverse video over the bg colour, so the glyph's ink
  // is the terminal's own background.
  if (cell.fg === "ground") return new Style({ color: cell.bg === "ground" ? undefined : resolvePaint(cell.bg, edges, options), reverse: true });
  const bgcolor = cell.bg === "ground" ? undefined : resolvePaint(cell.bg, edges, options);
  // [LAW:dataflow-not-control-flow] Every cell's ink is held off its ground;
  // the gap measured between them decides how far it moves, usually not at all.
  return new Style({ color: standOff(resolvePaint(cell.fg, edges, options), bgcolor, options.colorSystem ?? ColorDepth.TRUECOLOR), bgcolor });
}

/**
 * Where an effect moved one slot or both of a neighbour's edge cell to, each
 * the spec the depth writes the slot in, a palette slot as that slot:
 * `color` for its text, `bgcolor` for its ground. A slot left unset did not
 * move.
 */
export interface EdgeMove {
  readonly color?: ColorSpec;
  readonly bgcolor?: ColorSpec;
}

/**
 * A cell a `CellJoiner` drew, as what it is: one function of its two
 * neighbours' edges. It holds the cell's paints, the neighbour each side of
 * them reads, and the edges and render it was resolved from, and it is stamped
 * on the cell as the owner of its innermost anchor level.
 *
 * [LAW:one-source-of-truth] A seam's colours are its neighbours', so nothing
 * paints them but this resolution. An effect paints a strip's items and never
 * a join cell that `follows` them; once the items are painted, each such cell
 * is handed what moved at the item cells beside it and resolved again through
 * `cellStyle`, the path the join was drawn by, lift included
 * (`../renderables/effect.ts`). A seam then follows its neighbours wherever an
 * effect takes them, a mix of the two included, and an effect that paints
 * both one colour leaves the seam's ink lifted off it. A cell painted from
 * roles and the terminal's ground alone, as `plain`'s separator is, follows
 * nobody, and an effect paints it as it paints any cell.
 */
export class JoinedCell {
  /** What the cell's paints read on each side: that neighbour and its edge as the cell was resolved from it, or `null` for a side they read nothing of. */
  readonly reads: { readonly left: JoinSide | null; readonly right: JoinSide | null };
  /** Whether the cell's paints read either neighbour, so it follows them under an effect. */
  readonly follows: boolean;
  /** The cell as drawn from its edges: the one resolution, at join time and after an effect alike. */
  readonly style: Style;

  constructor(
    private readonly cell: JoinCell,
    private readonly parts: CellParts,
    private readonly neighbours: { readonly left: object | null; readonly right: object | null },
    private readonly edges: Edges,
    private readonly options: RenderOptions,
  ) {
    const read = (side: "left" | "right"): JoinSide | null => {
      if (parts[side].size === 0) return null;
      const [owner, edge] = [neighbours[side], edges[side]];
      // [LAW:no-silent-failure] Unreachable: a join draws a part only beside
      // the neighbours its cells may name: a cap naming the one it is drawn
      // without is refused when parsed (`parsePaint`).
      if (owner === null || edge === undefined) throw new Error(`a join cell paints with its ${side} neighbour's edge, and the join has no ${side} neighbour`);
      return { owner, edge };
    };
    this.reads = { left: read("left"), right: read("right") };
    this.follows = this.reads.left !== null || this.reads.right !== null;
    this.style = cellStyle(cell, edges, options);
  }

  /**
   * The cell resolved again once each side's edge has moved as `moves` says:
   * its `colors`, as `cellStyle` draws them, and `style`, the cell's own, with
   * the record of that stamped where this one was, so an effect drawn over
   * this one moves on from these edges. Resolved, lift included, at `depth`,
   * the depth the effect writes the frame at. None when nothing moved of what
   * the cell paints with: a seam of arrows in two grounds is as it was drawn
   * while an effect moves only the lettering beside it, and its lift is not
   * walked again for a frame that cannot change it.
   */
  rederived(moves: { readonly left?: EdgeMove; readonly right?: EdgeMove }, style: Style, depth: ColorDepth): { readonly colors: Style; readonly style: Style } | undefined {
    const reaches = (side: "left" | "right"): boolean =>
      (moves[side]?.color !== undefined && this.parts[side].has("fg")) || (moves[side]?.bgcolor !== undefined && this.parts[side].has("bg"));
    if (!reaches("left") && !reaches("right")) return undefined;
    const moved = (edge: Style | undefined, move: EdgeMove | undefined): Style | undefined =>
      move === undefined ? edge : new Style({ color: move.color ?? edge?.color, bgcolor: move.bgcolor ?? edge?.bgcolor });
    const edges = { left: moved(this.edges.left, moves.left), right: moved(this.edges.right, moves.right) };
    const next = new JoinedCell(this.cell, this.parts, this.neighbours, edges, { ...this.options, colorSystem: depth });
    const restamp = (level: Anchor): Anchor => ({ ...level, owner: level.owner === this ? next : level.owner, inner: level.inner && restamp(level.inner) });
    return { colors: next.style, style: style.withAnchor(style.anchor && restamp(style.anchor)) };
  }
}

/** The record a `CellJoiner` stamped on the cell `anchor` names, or none for a cell no `CellJoiner` drew. */
export function joinedCell(anchor: Anchor | undefined): JoinedCell | undefined {
  for (let level = anchor; level; level = level.inner) if (level.owner instanceof JoinedCell) return level.owner;
  return undefined;
}

const shapeGlyphs = (shape: JoinShape): string => PARTS.flatMap((part) => shape[part].flatMap(glyphsOf)).join("");

/**
 * The one joiner: what it draws is a `JoinSeam` between neighbours and a
 * `JoinCaps` at the ends of each run, picked independently, so a new joiner is
 * a pair of values, never a class.
 *
 * Which part a join draws is read off its two neighbours. A neighbour is
 * missing at the strip's ends, and counts as missing — an endpoint — when the
 * seam paints with its ground anywhere and it has none to paint. With both
 * present the join is the seam; with only the right, the lead; with only the
 * left, the tail; with neither, nothing. Every cell is drawn with its ink held
 * off its ground at `options.colorSystem` (`standOff`), measured per cell, so a
 * seam stepping in thirds shows every step however close its grounds. A cap
 * that paints with its neighbour's ground is drawn only beside a neighbour
 * with one, so caps that need grounds never stop a seam that needs none.
 *
 * An ASCII-only output draws the `ascii` form of both, whole.
 */
export class CellJoiner<T extends StyledRenderable = StyledRenderable> implements Joiner<T> {
  readonly seam: JoinSeam;
  readonly caps: JoinCaps;
  private readonly _forms: Readonly<Record<FormName, Form>>;

  constructor(seam: JoinSeam, caps: JoinCaps) {
    this.seam = parseSeam(seam);
    this.caps = parseCaps(caps);
    this._forms = { glyph: formOf(joinForms(this.seam.glyph, this.caps.glyph)), ascii: formOf(joinForms(this.seam.ascii, this.caps.ascii)) };
  }

  join(left: T | null, right: T | null, { index }: JoinContext): Renderable {
    const forms = this._forms;
    return {
      *render(options: RenderOptions): Iterable<Segment> {
        const { cells, reads } = drawable(options, forms.glyph, forms.ascii, (form) => shapeGlyphs(form.shape));
        const edges: Edges = { left: left?.edgeStyle("right", options), right: right?.edgeStyle("left", options) };
        const leftBg = paintableBg(edges.left?.bgcolor);
        const rightBg = paintableBg(edges.right?.bgcolor);
        const hasLeft = left !== null && (!reads.seam.left || leftBg !== undefined);
        const hasRight = right !== null && (!reads.seam.right || rightBg !== undefined);
        const leads = hasRight && (!reads.lead || rightBg !== undefined);
        const tails = hasLeft && (!reads.tail || leftBg !== undefined);
        const neighbours = { left, right };
        const styled = (part: Part) =>
          cells[part].map(({ cell, parts }, at) => {
            const joined = new JoinedCell(cell, parts, neighbours, edges, options);
            return new Segment(pickGlyph(cell, part, index, at), joined.style.withAnchor({ owner: joined, row: 0, col: 0, inner: undefined }));
          });
        if (!hasLeft || !hasRight) {
          if (leads || tails) yield* styled(leads ? "lead" : "tail");
          return;
        }
        yield* styled("seam");
      },
    };
  }
}

// --- The bundled seams and caps ---

const LEFT_BG: Paint = { edge: "left", part: "bg" };
const RIGHT_BG: Paint = { edge: "right", part: "bg" };
const LEFT_FG: Paint = { edge: "left", part: "fg" };
const HALF: Paint = { mix: [LEFT_BG, RIGHT_BG, 1 / 2] };

const GROUND = "ground";
const LEAD: SeamCell = { cap: "lead" };
const TAIL: SeamCell = { cap: "tail" };

const both = <F>(glyph: F, ascii: F): { readonly glyph: F; readonly ascii: F } => ({ glyph, ascii });

// A powerline glyph family: the glyph and its ASCII stand-in.
interface Family {
  readonly glyph: string;
  readonly ascii: string;
}

const POWERLINE: Family = { glyph: "\ue0b0", ascii: ">" };
const SLANT: Family = { glyph: "\ue0bc", ascii: "/" };
const BACKSLANT: Family = { glyph: "\ue0b8", ascii: "\\" };
const FLAME: Family = { glyph: "\ue0c0", ascii: "}" };
const PIXEL: Family = { glyph: "\ue0c4", ascii: "#" };
const ICE: Family = { glyph: "\ue0c8", ascii: "]" };
const BUBBLE: Family = { glyph: "\ue0b4", ascii: ")" };

// `glyph` in the left ground over the right.
const arrow = (glyph: string): SeamForm => ({ seam: [{ glyph, fg: LEFT_BG, bg: RIGHT_BG }] });
const arrowSeam = (f: Family): JoinSeam => both(arrow(f.glyph), arrow(f.ascii));

// Three arrows stepping through the two thirds between the grounds.
function prism(glyph: string): SeamForm {
  const third = (t: number): Paint => ({ mix: [LEFT_BG, RIGHT_BG, t] });
  return {
    seam: [
      { glyph, fg: LEFT_BG, bg: third(1 / 3) },
      { glyph, fg: third(1 / 3), bg: third(2 / 3) },
      { glyph, fg: third(2 / 3), bg: RIGHT_BG },
    ],
  };
}

// The runs parted: the caps close the one and open the other, `between` —
// cells on the terminal's ground — set between them.
const parted = (between: readonly JoinCell[]): SeamForm => ({ seam: [TAIL, ...between, LEAD] });

// One cell drawn over the two grounds' midpoint, so it reads as neither item's.
const midpoint = (glyph: JoinCell["glyph"], fg: Paint): SeamForm => ({ seam: [{ glyph, fg, bg: HALF }] });

// A ragged tear in the left ground over the midpoint.
const torn = (glyphs: readonly string[]): SeamForm => midpoint({ oneOf: glyphs }, LEFT_BG);

const PLAIN: SeamForm = { seam: [{ glyph: " | ", fg: { role: "strip.separator" }, bg: GROUND }] };
const SPACE: JoinCell = { glyph: " ", fg: LEFT_FG, bg: GROUND };
const rail = (glyph: string): JoinCell => ({ glyph, fg: { role: "strip.rail" }, bg: GROUND });

/**
 * The bundled seams, by name: what a joiner draws between two neighbours.
 * What each draws is `docs/strip.md`'s "Seams"; any of them ends in any of
 * `CAPS`.
 */
export const SEAMS = Object.freeze({
  powerline: parseSeam(arrowSeam(POWERLINE)),
  prism: parseSeam(both(prism(POWERLINE.glyph), prism(POWERLINE.ascii))),
  slant: parseSeam(arrowSeam(SLANT)),
  backslant: parseSeam(arrowSeam(BACKSLANT)),
  flame: parseSeam(arrowSeam(FLAME)),
  pixel: parseSeam(arrowSeam(PIXEL)),
  ice: parseSeam(arrowSeam(ICE)),
  bubble: parseSeam(arrowSeam(BUBBLE)),
  capsule: parseSeam(both(parted([SPACE]), parted([SPACE]))),
  wrapper: parseSeam(both(parted([]), parted([]))),
  metro: parseSeam(both(parted([rail("──")]), parted([rail("--")]))),
  stitch: parseSeam(both(midpoint("┊", LEFT_FG), midpoint(":", LEFT_FG))),
  torn: parseSeam(both(torn(["▚▞", "▞▚", "▘▗", "▝▖", "▖▝", "▗▘"]), torn(["/\\", "\\/"]))),
  plain: parseSeam(both(PLAIN, PLAIN)),
});

// The family's glyph reversed out of the terminal's ground at the lead — a
// notch whose ink is the terminal's background — and over that ground at the
// tail, so a run reads as one chevron. ASCII opens each run flat: an ASCII
// glyph reversed out of the terminal's ground is a block of nothing.
const flowCaps = (f: Family): JoinCaps =>
  both(
    { lead: [{ glyph: f.glyph, fg: GROUND, bg: RIGHT_BG }], tail: [{ glyph: f.glyph, fg: LEFT_BG, bg: GROUND }] },
    { lead: [], tail: [{ glyph: f.ascii, fg: LEFT_BG, bg: GROUND }] },
  );

// `open` and `close`, each in its run's ground over the terminal's.
const pill = (open: string, close: string): CapsForm => ({
  lead: [{ glyph: open, fg: RIGHT_BG, bg: GROUND }],
  tail: [{ glyph: close, fg: LEFT_BG, bg: GROUND }],
});

const FLAT: CapsForm = { lead: [], tail: [] };

/**
 * The bundled caps, by name: what a joiner draws where a run begins and ends.
 * What each draws is `docs/strip.md`'s "Caps"; any of them ends any of
 * `SEAMS`.
 */
export const CAPS = Object.freeze({
  powerline: parseCaps(flowCaps(POWERLINE)),
  slant: parseCaps(flowCaps(SLANT)),
  backslant: parseCaps(flowCaps(BACKSLANT)),
  flame: parseCaps(flowCaps(FLAME)),
  pixel: parseCaps(flowCaps(PIXEL)),
  ice: parseCaps(flowCaps(ICE)),
  bubble: parseCaps(flowCaps(BUBBLE)),
  capsule: parseCaps(both(pill("\ue0b6", "\ue0b4"), pill("(", ")"))),
  wrapper: parseCaps(both(pill("\ue0b2", "\ue0b0"), pill("<", ">"))),
  flat: parseCaps(both(FLAT, FLAT)),
});

/**
 * The bundled joiners, by name: each a seam from `SEAMS` ended in caps from
 * `CAPS`. What each draws is `docs/strip.md`'s "Built-in joiners"; a name from
 * config is read with `joinerNamed`.
 */
export const JOINERS = Object.freeze({
  powerline: new CellJoiner(SEAMS.powerline, CAPS.powerline),
  prism: new CellJoiner(SEAMS.prism, CAPS.powerline),
  slant: new CellJoiner(SEAMS.slant, CAPS.slant),
  backslant: new CellJoiner(SEAMS.backslant, CAPS.backslant),
  flame: new CellJoiner(SEAMS.flame, CAPS.flame),
  pixel: new CellJoiner(SEAMS.pixel, CAPS.pixel),
  ice: new CellJoiner(SEAMS.ice, CAPS.ice),
  bubble: new CellJoiner(SEAMS.bubble, CAPS.bubble),
  capsule: new CellJoiner(SEAMS.capsule, CAPS.capsule),
  wrapper: new CellJoiner(SEAMS.wrapper, CAPS.wrapper),
  metro: new CellJoiner(SEAMS.metro, CAPS.capsule),
  stitch: new CellJoiner(SEAMS.stitch, CAPS.flat),
  torn: new CellJoiner(SEAMS.torn, CAPS.flat),
  plain: new CellJoiner(SEAMS.plain, CAPS.flat),
});

/**
 * A joiner as config names it: one of `JOINERS`, or a seam from `SEAMS` ended
 * in caps from `CAPS`, each named apart.
 */
export type JoinerSpec = string | { readonly seam: string; readonly caps: string };

/**
 * The joiner `spec` names — a joiner read from config, parsed. Throws on a
 * name its table lacks, naming the ones there are; an own-key test, so
 * `toString` and the rest of `Object.prototype` are no one's name.
 */
export function joinerNamed(spec: JoinerSpec): CellJoiner {
  if (typeof spec === "string") return named(JOINERS, "joiner", "joiners", spec);
  if (typeof spec !== "object" || spec === null) throw new Error(`a joiner is a name or { seam, caps }, not ${JSON.stringify(spec)}`);
  return new CellJoiner(named(SEAMS, "seam", "seams", spec.seam), named(CAPS, "caps", "caps", spec.caps));
}

function named<V>(table: Readonly<Record<string, V>>, kind: string, kinds: string, name: string): V {
  if (!Object.hasOwn(table, name)) throw new Error(`no ${kind} named ${JSON.stringify(name)}; the ${kinds} are ${Object.keys(table).join(", ")}`);
  return table[name]!;
}

/**
 * A ramp of `steps` cells from the left ground to the right, each cell filled
 * with one colour: cell `i` is the colour `(i + 1/2) / steps` of the way
 * across, so no cell is either neighbour's ground. A cell is a space whose ink
 * is the terminal's ground, so its one colour is its fill, the same in ASCII.
 * Beside a neighbour with no ground there is no colour to ramp toward, so that
 * join draws the caps the ramp is ended in.
 *
 * [LAW:dataflow-not-control-flow] A ramp cell is fill alone: a space has no
 * ink, and `"ground"` as its `fg` is the absence of a colour on that side
 * (`cellStyle`). So the lift, the path every seam cell is drawn by, has no ink
 * to hold off its ground, and the ramp is the blend, monotone however close
 * its grounds or however many its steps. Two samples to a cell, ink over
 * ground, cannot be: the lift holds every cell's two the floor apart, so
 * `steps` such cells rise without turning back only between grounds `steps`
 * floors apart.
 */
export function gradientSeam(steps = 4): JoinSeam {
  // [LAW:no-silent-failure] A count that is no whole number of cells would draw
  // a lopsided ramp, or none, without a word. No cells is a ramp: the items meet.
  if (!(Number.isInteger(steps) && steps >= 0)) throw new RangeError(`gradientSeam steps must be a whole number of cells, got ${steps}`);
  const ramp: SeamForm = {
    seam: Array.from({ length: steps }, (_, i): JoinCell => ({ glyph: " ", fg: GROUND, bg: { mix: [LEFT_BG, RIGHT_BG, (i + 1 / 2) / steps] } })),
  };
  return parseSeam(both(ramp, ramp));
}
