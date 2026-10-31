/**
 * Effected — a renderable whose finished cells' looks — colours and text
 * attributes — pass through an effect at a moment `t`.
 *
 * An effect is, for what an element draws in a frame, an `Animation`
 * (`core/animation.ts`) of what is done to its cells: its value at `t` is a
 * function from a cell's look and where the cell is to the cell's new look
 * (`EffectFrame`), and it says when that next changes as every
 * animation does. Whatever holds for the whole frame is worked out once, in
 * the effect and its `at(t)`, and every cell of the frame is handed to the
 * function `at(t)` returns, but for those a wrapper keeps back — `confined`
 * hands over only the cells its owners drew, so an effect never counts on
 * seeing them all — and for a strip's join cells painted from the items beside
 * them, which are no one's to paint: a seam's colours are its neighbours'
 * edges, so once the effect has painted every other cell, each such cell is
 * resolved again from the cells beside it as the effect left them
 * (`JoinedCell`, `../core/strip.ts`), the way the joiner drew it. Shimmer,
 * pulse, fade, dissolve and a blinking attribute are all this one shape,
 * differing by what the function does with its inputs
 * [LAW:one-type-per-behavior]; two effects stack as layers of one effect
 * (`layered`, `./effects.ts`), each moving what the last left and recognising
 * a cell by what the element drew (`EffectCell.pair`), or by nesting one
 * wrapper in another, which measures the inner one's output instead.
 *
 * A cell's look is one value, its colours and its attributes together
 * (`CellLook`), rather than an attribute stage beside the colour one, so
 * everything that takes an `Effect` — `confined`, `onBeat`,
 * `Animation.all`, nesting over a glyph effect — takes one that moves
 * attributes with no second copy of itself. `reverse` is the one attribute
 * a look leaves out (`CellAttributes`): it decides which of a style's slots
 * a colour on screen is in, and a swap of the two is already a colour move.
 *
 * What the element draws (`Drawn`) — the cells the effect will be handed,
 * and the colours of its words — is measured here, in the render, off the
 * same reading of each segment its cells are drawn from, and handed to the
 * effect once a frame. It is what an effect keeping words legible is settled
 * against (`onColors`, `./effects.ts`), so no caller derives it a second time
 * from a render of its own.
 *
 * An `Effected` is the element under its effect over time: an
 * `Animation<Renderable>`, placed wherever a renderable goes and drawn at
 * the time of the frame it is drawn in. Its value at `t` is the element
 * through the effect at `t` (`Recolored`). [LAW:no-ambient-temporal-coupling]
 * The time is the frame's, never a clock read, so the same time always draws
 * the same bytes, at 30 frames a second or one every two seconds.
 *
 * What an effect may not do is the contract this module holds:
 *
 * - It changes how cells look, never which cells exist or who drew them. The
 *   child's text is walked by grapheme cluster, so a wide glyph is one cell
 *   to the effect and is never cut, and a run cut out of a segment keeps that
 *   segment's link and meta and carries its anchor shifted to the run's first
 *   cell (`Style.shiftedBy`), so hit testing still finds the owner.
 * - A cell whose colours come back unchanged keeps its original `ColorSpec`,
 *   one whose attributes come back as its style set them keeps them, and a
 *   segment whose every cell is unchanged is yielded with its look as
 *   it was, so the identity effect is byte-identical; what an `Effected` gains is when
 *   the frame next changes (`Style.hold`), which writes no byte.
 *   Neighbouring cells the output depth
 *   writes alike stay one segment: a segment is cut only where the written
 *   colours or the attributes change, so two colours that land on one index
 *   are one run.
 * - New colours are built with `ColorSpec.fromRgba`, never parsed from a
 *   string, so no frame adds an entry to a parse cache.
 * - With no colour output (`colorSystem: null`) no style is written at all,
 *   attributes included, so there is nothing for an effect to change, and
 *   the child's segments pass through untouched.
 *
 * Positions are the child's own: row and column count from the top-left of
 * what the child drew, so a sweep crosses the element, not the screen.
 */

import { drawnBy, shiftAnchor, type Anchor } from "../core/anchor.js";
import { Animation, frameTimeOf, holdOf, shownAt, stampFrame } from "../core/animation.js";
import type { Hold } from "../core/style.js";
import { cellLen, graphemes } from "../core/cells.js";
import { ColorDepth, ColorSpec, SURFACE_BLACK, type ColorRgba, type TerminalColors } from "../core/color.js";
import { fnv1a } from "../core/fnv1a.js";
import { Measurement } from "../core/measure.js";
import type { Measurable, Renderable, RenderOptions } from "../core/protocol.js";
import { render } from "../core/protocol.js";
import { Segment } from "../core/segment.js";
import { JOIN, joinedCell, type EdgeMove, type JoinedCell } from "../core/strip.js";
import { ATTRIBUTE_NAMES, Style, type AttributeName, type Attributes } from "../core/style.js";
import { finiteTime } from "../core/easing.js";

/**
 * A cell's foreground and background as they appear on screen — the glyph's
 * colour and the colour behind it — which are the colours an effect moves.
 * Under `reverse` they are the style's two colours swapped.
 */
export interface CellColors {
  readonly fg: ColorRgba;
  readonly bg: ColorRgba;
}

/**
 * The text attributes an effect moves: every one a style sets but
 * `reverse`, each on, off or unset as the cell's style has it. An unset
 * one lets a style laid beneath show through, as it does undrawn.
 */
export type CellAttributes = Omit<Attributes, "reverse">;

/** What an effect moves in a cell: its colours as the screen shows them, and its attributes. */
export interface CellLook extends CellColors {
  readonly attributes: CellAttributes;
}

/**
 * Where a cell is in the output of the renderable an effect wraps, its seed:
 * a number in [0, 1) that is the same for that cell on every frame, for an
 * effect that varies cell by cell (a per-cell offset in time, a sparkle) —
 * and what the element drew it in.
 */
export interface EffectCell {
  readonly row: number;
  readonly col: number;
  readonly seed: number;
  /**
   * The ink and ground the element drew the cell in: what the cell is, where
   * the `CellLook` beside it is what is there now. Under one effect they are
   * the same colours; under `layered` (`./effects.ts`) the look is what the
   * layers beneath left, so an effect recognises a cell by its pair and moves
   * its look. [LAW:one-source-of-truth] A pair's `terminal` is what tells a
   * colour the terminal resolved from one the element wrote at the same hex.
   */
  readonly pair: Pair;
  /**
   * Who drew the cell, and where it sits in their output, as
   * `Segment.anchorAt` reads it off a frame: what tells one owner's cells
   * from another's when their colours are alike (`confined`).
   */
  readonly anchor: Anchor | undefined;
}

/** Where a cell sits and who drew it: an `EffectCell` before it has a seed or colours. */
export type Placed = Pick<EffectCell, "row" | "col" | "anchor">;

/**
 * A cell as `Drawn.all` lists it: where it sits and who drew it, the
 * columns its glyph takes, its ink and ground as the screen shows them, and
 * whether a strip's joiner drew it — a seam, no item's, whose colours are its
 * neighbours' edges. Each is read off the one look and the one walk the cell
 * is later handed with, so an effect that groups cells into the runs they
 * are drawn in — `wheel`'s segments — reads what the frame hands, never a
 * second measure. [LAW:one-source-of-truth]
 */
export interface ListedCell extends Placed {
  readonly width: number;
  readonly pair: Pair;
  readonly seam: boolean;
}

/**
 * A cell's ink and ground as the screen shows them, which of the two are the
 * terminal's, and whether its style swaps them (`reverse`): what an `Effect`
 * is handed for that cell.
 */
export interface Pair extends CellColors {
  /**
   * Whether the glyph's colour and the colour behind it, as the screen shows
   * them, are the terminal's own: a slot the element's style leaves unset or
   * sets to `default`. Such a colour is resolved through the theme, so its
   * hex can equal one the element wrote; this is what tells them apart.
   */
  readonly terminal: { readonly fg: boolean; readonly bg: boolean };
  /**
   * Whether the ink is written in the style's ground slot and the ground in
   * its ink slot. Below truecolor the slot decides what a moved colour can
   * land on: a slot set to `default` draws the terminal's foreground in one
   * and its background in the other.
   */
  readonly reverse: boolean;
}

/**
 * What the element an effect wraps draws in one frame: the cells the effect
 * is handed, and the colours the element draws its words in, as the screen
 * shows them — what an effect that must keep the words legible is measured
 * against. A word cell is one whose glyph is not blank and that a strip's
 * joiner did not draw (`JOIN`): a seam's ink is the fill beside it, not words.
 */
export interface Drawn {
  /**
   * Every cell the element draws this frame, shown or not — where it sits
   * and who drew it, what it shows and how wide it is (`ListedCell`) — in
   * the order it draws them, listed before the effect is handed any. A blank
   * cell on the terminal's ground that draws no line is here: the effect is
   * handed it, and its ink, unseen, is the ink of the words beside it, so an
   * effect that turns the element's runs each at their own pace — `wheel` —
   * reads the runs off this and a styled sentence is one run across its
   * spaces. A strip's join cell painted from the items beside it is here,
   * as a `seam`, but never handed its own look, since it follows them: it is
   * handed only a neighbour's edge the frame does not show, to be painted
   * where the seam shows it. `confined` narrows it to the cells its owners
   * drew. A call, so a frame whose effect does not ask lists none.
   */
  all(): readonly ListedCell[];
  /**
   * Of `all`, every cell the element shows something in — a glyph, a ground
   * that is not the terminal's, or a line its style draws: what an effect
   * spread over the element — a transition, which has its last cell settle
   * as it ends — is spread over. A blank cell on the terminal's ground that
   * draws no line is handed but not here, since nothing in it shows.
   */
  cells(): readonly ListedCell[];
  /** Every distinct ink and ground of a word cell. */
  readonly pairs: readonly Pair[];
  /** The colours the element sets itself in its word cells, by hex: never the terminal's, whatever its hex. */
  readonly colors: ReadonlySet<string>;
  /** Of `colors`, the ones a word cell has for its ground. */
  readonly fills: ReadonlySet<string>;
  /** The depth the frame is written at: below truecolor a moved colour lands on a palette colour. */
  readonly depth: ColorDepth;
  /** The terminal the frame is drawn on. */
  readonly theme: TerminalColors;
}

/** What an effect does to the cells of one frame: each cell's look and where it is in, its look out. Return `look` to leave a cell be. */
export type EffectFrame = (look: CellLook, cell: EffectCell) => CellLook;

/**
 * For an element drawing `drawn`, the animation of what is done to its cells.
 * [LAW:types-are-the-program] Per-frame work is `at(t)`, so it runs once a
 * frame by the shape of the call, never by a cache asking whether this cell's
 * frame is the last one's.
 *
 * Its `nextChange` is when the frame next changes: a stepped effect its next
 * step's start, a transition `t` until it is done and `Infinity` after, a
 * loop that holds every cell still, at the frame's depth or with nothing in
 * it to move, `Infinity` there, and a loop that moves `t`
 * (`Animation.continuous`). [LAW:types-are-the-program] The answer is a fact
 * about the frame, so the animation is made from everything the frame is drawn
 * from; one made from `t` alone could not say that a frame is still because of
 * its depth.
 */
export type Effect = (drawn: Drawn) => Animation<EffectFrame>;

export interface EffectedOptions {
  /**
   * Names the element for its seeds, so two elements showing the same text do
   * not twinkle in lockstep. The same key gives the same seeds on every frame.
   */
  readonly key: string;
  /**
   * The terminal the frame is drawn on: the colours a cell that sets none is
   * drawn in, and the sixteen an ANSI colour names. The terminal's own palette
   * is never queried, so the caller says what it is.
   */
  readonly theme: TerminalColors;
}

/** A frame an effect drew at a moment, and the hold the effect says it is in there. */
export interface Moved {
  readonly segments: Iterable<Segment>;
  readonly hold: Hold;
}

/** What drew nothing the effect can change: held forever, as far as the effect says. */
const UNMOVED: Hold = { lastChange: Number.NEGATIVE_INFINITY, nextChange: Number.POSITIVE_INFINITY };

/**
 * An `Effected` at `t`, or an element through an effect at a time an
 * animation's `at` was handed — a lifecycle's time since it entered: `renderable`
 * with its cells' looks passed through `effect` at `t`, saying nothing of
 * when that changes, since whatever placed the animation stamps its hold.
 * [LAW:one-type-per-behavior]
 */
export class Recolored implements Renderable, Measurable {
  readonly t: number;
  readonly key: string;
  readonly theme: TerminalColors;

  constructor(
    readonly renderable: Renderable,
    readonly effect: Effect,
    options: EffectedOptions & { readonly t: number },
  ) {
    this.t = finiteTime("Effected", options.t);
    this.key = options.key;
    this.theme = options.theme;
  }

  render(options: RenderOptions): Iterable<Segment> {
    return this.moved(options).segments;
  }

  /** The frame the effect draws at `t`, and the hold it says that is in. */
  moved(options: RenderOptions): Moved {
    const segments = render(this.renderable, options);
    // With no colour output nothing the effect does is written, so the child
    // is what is shown, and it changes when the child says it does.
    if (options.colorSystem === null) return { segments, hold: UNMOVED };
    // No depth named is no downgrade, as `drawnColors` reads it.
    const depth = options.colorSystem ?? ColorDepth.TRUECOLOR;
    // [LAW:one-source-of-truth] The frame is measured before any cell is
    // handed to the effect, off the same looks its cells are drawn from, and
    // the one measure is what the effect's animation is made from.
    const looked = looks(segments, depth, this.theme);
    const walked = walk(looked);
    const animation = this.effect(measured(looked, () => walked, depth, this.theme));
    const shown = shownAt(animation, this.t, options);
    return { segments: this._recolored(walked, shown.value, depth), hold: holdOf(shown, this.t) };
  }

  private *_recolored(walked: readonly Walked[], frame: EffectFrame, depth: ColorDepth): Iterable<Segment> {
    // [LAW:one-source-of-truth] Every cell but a join cell that follows its
    // neighbours is painted first, so that cell is resolved from the cells
    // beside it as the effect left them, wherever in the frame they fall.
    const drawings = walked.map(({ look, glyphs }): Drawing | undefined => {
      if (look === undefined) return undefined;
      const joined = joinedCell(look.style.anchor);
      if (joined?.follows === true) return { joined };
      const from: CellLook = { fg: look.pair.fg, bg: look.pair.bg, attributes: look.attributes };
      return { painted: glyphs.map(({ cell }) => (cell === undefined ? from : returned(frame(from, { ...cell, seed: cellSeed(this.key, cell.row, cell.col), pair: look.pair })))) };
    });
    const beside = edgesBeside(walked, drawings);
    for (const [i, { segment, look, glyphs }] of walked.entries()) {
      const drawing = drawings[i];
      if (look === undefined || drawing === undefined) yield segment;
      else if ("joined" in drawing) yield this._rejoined(segment, look, drawing.joined, glyphs, beside, frame, depth);
      else yield* this._repainted(segment, look, glyphs, drawing.painted, depth);
    }
  }

  /** `segment`'s cells drawn in the looks the effect painted them. */
  private *_repainted(segment: Segment, look: Look, glyphs: readonly WalkedGlyph[], moved: readonly CellLook[], depth: ColorDepth): Iterable<Segment> {
    const { style: base, wire, slots, pair, attributes } = look;
    // [LAW:one-source-of-truth] A run is cells the wire writes alike: each
    // cell is drawn at the output depth first and merged on the colours that
    // writes and on its attributes, so two truecolors landing on one index
    // stay one run. A cell the effect gave its neighbour's look is drawn as
    // that neighbour was.
    const runs: { text: string; cells: number; colors: CellColors; attributes: CellAttributes; drawn: DrawnColors }[] = [];
    for (const [k, { glyph }] of glyphs.entries()) {
      const now = moved[k]!;
      // Back from the screen to the style's slots: the same swap undoes itself.
      const colors = onScreen(now, pair.reverse);
      const last = runs[runs.length - 1];
      const writes = last !== undefined && sameColors(last.colors, colors) ? last.drawn : this.respec(wire, slots, colors, depth);
      if (last !== undefined && writesAlike(last.drawn, writes) && sameAttributes(last.attributes, now.attributes)) {
        last.text += glyph;
        last.cells += cellLen(glyph);
        last.colors = colors;
      } else {
        runs.push({ text: glyph, cells: cellLen(glyph), colors, attributes: now.attributes, drawn: writes });
      }
    }
    if (runs.every((run) => writesAlike(run.drawn, wire) && sameAttributes(run.attributes, attributes))) {
      yield segment;
      return;
    }
    let offset = 0;
    for (const run of runs) {
      const placed = base.shiftedBy(offset);
      const shifted = sameAttributes(run.attributes, attributes) ? placed : placed.withAttributes(cellAttributes(run.attributes));
      const style = writesAlike(run.drawn, wire) ? shifted : shifted.add(Style.fromColor(run.drawn.color, run.drawn.bgcolor));
      yield new Segment(run.text, style);
      offset += run.cells;
    }
  }

  /**
   * A join cell's `segment` resolved again from the edges beside it, as the
   * effect left them: each neighbour's nearest cell to the join on its row,
   * its slots as the depth writes them. A side whose neighbour the effect moved
   * nothing of keeps the edge the cell was drawn from, so with neither moved
   * the cell is as it was drawn.
   */
  private _rejoined(segment: Segment, look: Look, joined: JoinedCell, glyphs: readonly WalkedGlyph[], beside: EdgesBeside, frame: EffectFrame, depth: ColorDepth): Segment {
    const cells = glyphs.flatMap(({ cell }) => (cell === undefined ? [] : [cell]));
    // A join cell that draws no cell shows nothing an effect could move.
    const [at] = cells;
    if (at === undefined) return segment;
    const { theme } = this;
    // [LAW:one-source-of-truth] A moved edge is the spec the depth writes its
    // slot in, the spec the joiner reads of an item drawn so: a palette slot
    // stays that slot, which the lift tells apart by number, never an RGB read
    // back through a palette the writer did not use. Only the terminal's own
    // colour names none, and the terminal the effect draws on says what it is.
    // Each such spec is kept, so the writer below knows it by identity: an
    // RGB a blend or another colour lands on is not the terminal's own.
    const terminals = new Set<ColorSpec>();
    const edgeOf = (spec: ColorSpec | undefined, foreground: boolean): ColorSpec | undefined => {
      if (!spec?.isDefault) return spec;
      const own = ColorSpec.fromRgba(spec.getTruecolor(theme, foreground));
      terminals.add(own);
      return own;
    };
    const moved = (from: CellColors, to: CellColors): EdgeMove | undefined => {
      const specs = movedSpecs(from, to, depth, theme);
      return specs.fg === undefined && specs.bg === undefined ? undefined : { color: edgeOf(specs.fg, true), bgcolor: edgeOf(specs.bg, false) };
    };
    // [LAW:one-source-of-truth] A neighbour the frame shows no cell of beside
    // the join (cut off by a narrower container, scrolled out of a `Viewport`,
    // covered, or an item that draws nothing) is painted by the effect where
    // the seam shows it: its edge, as the seam drew it, handed to the frame at
    // the seam's own cell. An effect over the whole element moves it as it
    // moves everything there; one confined to some owners leaves it, since no
    // owner drew the seam. Where the frame is whole and every item draws, each
    // neighbour a seam reads has a cell on its row, so only a partial frame
    // comes here [LAW:no-silent-failure].
    const unseen = (edge: Style): EdgeMove | undefined => {
      const wire = edge.drawnColors(depth);
      const slots = { fg: (wire.color ?? DEFAULT).getTruecolor(theme, true), bg: (wire.bgcolor ?? DEFAULT).getTruecolor(theme, false) };
      const terminal = { fg: wire.color?.isDefault ?? true, bg: wire.bgcolor?.isDefault ?? true };
      return moved(slots, returned(frame({ ...slots, attributes: cellAttributes(edge) }, { ...at, seed: cellSeed(this.key, at.row, at.col), pair: { ...slots, terminal, reverse: false } })));
    };
    const moveOf = (side: "left" | "right"): EdgeMove | undefined => {
      const read = joined.reads[side];
      if (read === null) return undefined;
      const cell = beside(cells, side, read.owner);
      return cell === undefined ? unseen(read.edge) : moved(cell.look.slots, onScreen(cell.moved, cell.look.pair.reverse));
    };
    const rederived = joined.rederived({ left: moveOf("left"), right: moveOf("right") }, look.style, depth);
    if (rederived === undefined) return segment;
    const { colors, style } = rederived;
    // [LAW:one-source-of-truth] Each slot is written as the depth writes what
    // it resolved to, by the writer the lift measured it with
    // (`Style.drawnColors`), so a lifted ink stands off its ground in the bytes
    // as it did when measured. A slot resolved to the colour it was before
    // keeps the spec it was written in, as a painted cell's unmoved slot does.
    // The terminal's own colours, which stand in a moved edge as the spec of
    // the RGB the effect's terminal gives them and reach a slot unchanged or
    // not at all, are written by the writer that wrote them on the item
    // beside, on that terminal, which writes its own ground below truecolor as
    // `default`.
    const was = joined.style;
    const drawn = colors.drawnColors(depth);
    const { wire, slots } = look;
    const rounded = this.respec(wire, slots, { fg: colors.color?.getTruecolor(theme, true) ?? slots.fg, bg: colors.bgcolor?.getTruecolor(theme, false) ?? slots.bg }, depth);
    const written = (now: ColorSpec | undefined, before: ColorSpec | undefined, wrote: ColorSpec | undefined, drew: ColorSpec | undefined, round: ColorSpec | undefined): ColorSpec | undefined => {
      if (sameSpec(now, before)) return wrote;
      // [LAW:no-silent-failure] Unreachable: a move only fills an edge in, so
      // a slot that resolved to a colour when drawn resolves to one after.
      if (now === undefined) throw new Error(`a seam cell resolved to ${before?.name ?? "nothing"} when drawn and to nothing after an effect moved its neighbours`);
      return terminals.has(now) ? round : drew;
    };
    const writes = {
      color: written(colors.color, was.color, wire.color, drawn.color, rounded.color),
      bgcolor: written(colors.bgcolor, was.bgcolor, wire.bgcolor, drawn.bgcolor, rounded.bgcolor),
    };
    return new Segment(segment.text, writesAlike(writes, wire) ? style : style.add(Style.fromColor(writes.color, writes.bgcolor)));
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return Measurement.get(options, this.renderable);
  }

  /**
   * The specs that draw a cell's slot colours `to` where the segment drew
   * `from` with `wire`: each moved slot in the spec `movedSpecs` writes it
   * in, the rest as `wire` wrote them.
   */
  private respec(wire: DrawnColors, from: CellColors, to: CellColors, depth: ColorDepth): DrawnColors {
    const moved = movedSpecs(from, to, depth, this.theme);
    return { color: moved.fg ?? wire.color, bgcolor: moved.bg ?? wire.bgcolor };
  }
}

/**
 * `renderable` under `effect` over time: an `Animation<Renderable>` whose
 * value at `t` is the element through the effect at `t`, placed wherever a
 * renderable goes. Its own answer to when it changes is `t`, at every time:
 * an `Effect` is made from what the element draws, so with nothing drawn
 * nothing can say more — early, never false. Placed, it says exactly: its
 * cells carry the effect's own hold at the frame's time and the output's
 * depth (`stampFrame`), under whatever the element already said, so at a
 * depth that shows no motion a loop says it never changes there and the
 * host sleeps.
 */
export class Effected implements Animation<Renderable> {
  readonly key: string;
  readonly theme: TerminalColors;

  constructor(
    readonly renderable: Renderable,
    readonly effect: Effect,
    options: EffectedOptions,
  ) {
    this.key = options.key;
    this.theme = options.theme;
  }

  /** The element through the effect at `t`, unstamped. */
  at(t: number): Recolored {
    return new Recolored(this.renderable, this.effect, { t, key: this.key, theme: this.theme });
  }

  nextChange(t: number): number {
    return t;
  }

  lastChange(t: number): number {
    return t;
  }

  /** The element under the effect with its motion taken out. */
  reduced(): Effected {
    const { effect } = this;
    return new Effected(this.renderable, (drawn) => effect(drawn).reduced(), this);
  }

  /** Drawn at the frame's time, its cells stamped with the effect's exact hold there. */
  render(options: RenderOptions): Iterable<Segment> {
    const { segments, hold } = this.at(frameTimeOf(options)).moved(options);
    return stampFrame(segments, hold);
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return Measurement.get(options, this.renderable);
  }

  /**
   * The colours the screen shows for `pair` once it is drawn moved to `to`,
   * both as the screen shows them, at `depth` on `theme`: what an effect
   * moving a pair's colours leaves its words reading in.
   * [LAW:one-source-of-truth] Read through `movedSpecs`, the one writer a
   * moved slot is written with.
   */
  static shows(pair: Pair, to: CellColors, depth: ColorDepth, theme: TerminalColors): CellColors {
    const from = onScreen(pair, pair.reverse);
    const moved = movedSpecs(from, onScreen(to, pair.reverse), depth, theme);
    return onScreen({ fg: moved.fg?.getTruecolor(theme, true) ?? from.fg, bg: moved.bg?.getTruecolor(theme, false) ?? from.bg }, pair.reverse);
  }
}

/**
 * A cell's seed: FNV-1a of the element's key and the cell's position, scaled
 * into [0, 1). [LAW:one-source-of-truth] One rule for a colour effect's seeds
 * and a glyph effect's, so one element under both twinkles from one seed.
 */
export function cellSeed(key: string, row: number, col: number): number {
  return Number.parseInt(fnv1a(`${key}:${row}:${col}`), 16) / 0x1_0000_0000;
}

const DEFAULT = ColorSpec.default();

type DrawnColors = ReturnType<Style["drawnColors"]>;

/**
 * How one segment is drawn. [LAW:single-enforcer] `drawnColors` is what the
 * wire writes at the depth — alpha flattened, downgraded — and the theme
 * resolves what it leaves to the terminal. A slot an effect leaves alone keeps
 * the written spec, so it stays what the screen showed whatever moves beside it.
 */
interface Look {
  readonly style: Style;
  /** The specs the wire writes. */
  readonly wire: DrawnColors;
  /** The style's two slots, as colours. */
  readonly slots: CellColors;
  /** The slots as the screen shows them, `reverse` applied. */
  readonly pair: Pair;
  /** The attributes an effect is handed, as the style sets them. */
  readonly attributes: CellAttributes;
  /**
   * Whether a strip's joiner drew the segment (`JOIN`): a seam, whose ink is
   * the fill beside it, not words. [LAW:single-enforcer] Decided here once,
   * for the cells listed and the words measured alike.
   */
  readonly seam: boolean;
}

/** Each of `segments` with how it is drawn at `depth` on `theme`; a control segment draws nothing. */
function looks(segments: Iterable<Segment>, depth: ColorDepth, theme: TerminalColors): Looked[] {
  return [...segments].map((segment) => {
    if (segment.isControl) return { segment, look: undefined };
    const style = segment.style ?? Style.null();
    const wire = style.drawnColors(depth);
    const slots = { fg: (wire.color ?? DEFAULT).getTruecolor(theme, true), bg: (wire.bgcolor ?? DEFAULT).getTruecolor(theme, false) };
    const reverse = style.reverse === true;
    const terminal = onScreen({ fg: wire.color?.isDefault ?? true, bg: wire.bgcolor?.isDefault ?? true }, reverse);
    return { segment, look: { style, wire, slots, pair: { ...onScreen(slots, reverse), terminal, reverse }, attributes: cellAttributes(style), seam: drawnBy(style.anchor, JOIN) } };
  });
}

/** A segment with how it is drawn, or none for a control segment, which draws nothing. */
interface Looked {
  readonly segment: Segment;
  readonly look: Look | undefined;
}

/** A glyph of a segment, placed where its cell is drawn — or none for a newline, which is no cell. */
export interface WalkedGlyph {
  readonly glyph: string;
  readonly cell: Placed | undefined;
  /** The columns the glyph takes: the one measure the walk steps by, so a listed cell's width is the walk's. [LAW:one-source-of-truth] */
  readonly width: number;
}

/** A segment with how it is drawn and each of its glyphs, placed. */
interface Walked extends Looked {
  readonly glyphs: readonly WalkedGlyph[];
}

/**
 * Each glyph of each of `segments`, where its cell sits: rows and columns
 * from the top-left of the output, a wide glyph one cell at its first
 * column, and its anchor shifted to that column as `Style.shiftedBy` shifts
 * a run's. A control segment draws nothing and has none.
 * [LAW:one-source-of-truth] The one walk: what `Drawn.cells` lists, what the
 * render hands a colour effect, and what a glyph effect (`./glyph-effect.ts`)
 * is handed are all read off it.
 */
export function walkGlyphs(segments: readonly Segment[]): (readonly WalkedGlyph[])[] {
  let row = 0;
  let col = 0;
  return segments.map((segment) => {
    if (segment.isControl) return [];
    const anchor = segment.style?.anchor;
    // Cells into the segment, as `base.shiftedBy` counts them in the render.
    let into = 0;
    return [...graphemes(segment.text)].map((glyph) => {
      const cell = glyph === "\n" ? undefined : { row, col, anchor: anchor && shiftAnchor(anchor, into) };
      const width = cellLen(glyph);
      [row, col] = glyph === "\n" ? [row + 1, 0] : [row, col + width];
      into += width;
      return { glyph, cell, width };
    });
  });
}

/**
 * Whether `text` draws ink: anything but blanks. [LAW:one-source-of-truth]
 * The one test, so the words a colour effect lights are the words a glyph
 * effect (`./glyph-effects.ts`) scrambles and its particles pass behind.
 */
export function inked(text: string): boolean {
  return text.trim() !== "";
}

/** `looked` with each segment's glyphs placed, by the one walk. */
function walk(looked: readonly Looked[]): Walked[] {
  const placed = walkGlyphs(looked.map(({ segment }) => segment));
  return looked.map((item, i) => ({ ...item, glyphs: placed[i]! }));
}

/**
 * How a segment's cells are drawn in an effect's frame: `painted`, each in the
 * look the effect left it in, or `joined`, a join cell resolved again from the
 * painted cells beside it.
 */
type Drawing = { readonly painted: readonly CellLook[] } | { readonly joined: JoinedCell };

/** A cell the effect painted: where it sits and who drew it, how its segment is drawn, and the look the effect left it in. */
interface PaintedCell {
  readonly col: number;
  readonly anchor: Anchor | undefined;
  readonly look: Look;
  readonly moved: CellLook;
}

/**
 * The cell `owner` drew nearest a join on the join's row, on `side` of the
 * join's `cells`, which are at least one — or none, for an owner that drew no
 * cell there: a strip cut short by a narrower container, or an item that
 * draws nothing.
 */
type EdgesBeside = (cells: readonly Placed[], side: "left" | "right", owner: object) => PaintedCell | undefined;

/**
 * Where to find the cells beside a join in `walked`, painted as `painted` says.
 * Read by owner, never by column alone: a `FlexStrip` can set a gap or a
 * justified fill between a seam and the items it joins.
 */
function edgesBeside(walked: readonly Walked[], drawings: readonly (Drawing | undefined)[]): EdgesBeside {
  let rows: Map<number, PaintedCell[]> | undefined;
  const index = (): Map<number, PaintedCell[]> => {
    const byRow = new Map<number, PaintedCell[]>();
    walked.forEach(({ look, glyphs }, i) => {
      const drawing = drawings[i];
      if (look === undefined || drawing === undefined || !("painted" in drawing)) return;
      const moved = drawing.painted;
      glyphs.forEach(({ cell }, k) => {
        if (cell === undefined) return;
        const row = byRow.get(cell.row) ?? [];
        row.push({ col: cell.col, anchor: cell.anchor, look, moved: moved[k]! });
        byRow.set(cell.row, row);
      });
    });
    return byRow;
  };
  return (cells, side, owner) => {
    // Cells on a row are listed left to right, as the walk places them.
    const row = (rows ??= index()).get(cells[0]!.row) ?? [];
    const first = cells[0]!.col;
    const last = cells[cells.length - 1]!.col;
    if (side === "right") return row.find((cell) => cell.col > last && drawnBy(cell.anchor, owner));
    for (let k = row.length - 1; k >= 0; k--) {
      const cell = row[k]!;
      if (cell.col < first && drawnBy(cell.anchor, owner)) return cell;
    }
    return undefined;
  };
}

/** Whether `style` draws in its ink on a blank glyph: a line under, through or over it, or a frame round it. */
function drawsLines(style: Style): boolean {
  return [style.underline, style.underline2, style.strike, style.overline, style.frame, style.encircle].some((on) => on === true);
}

/**
 * What `looked` draws: `Drawn`'s measure, taken once per frame. Its `all`
 * and `cells` are listed off `walked` the first time either is asked for,
 * since an effect on attributes alone never asks, and
 * a glyph walk is what measuring the words alone, a segment at a time, is
 * spared (`drawnOf`).
 */
function measured(looked: readonly Looked[], walked: () => readonly Walked[], depth: ColorDepth, theme: TerminalColors): Drawn {
  const ground = theme.backgroundColor.hex;
  // [LAW:one-source-of-truth] One listing, each cell with whether it shows; `all` and `cells` are read off it.
  let everything: readonly { readonly cell: ListedCell; readonly shows: boolean }[] | undefined;
  const list = (): readonly { readonly cell: ListedCell; readonly shows: boolean }[] =>
    walked().flatMap(({ look, glyphs }) => {
      if (look === undefined) return [];
      // A blank glyph shows its ground, and any line its style draws in its ink.
      const blankShows = look.pair.bg.hex !== ground || drawsLines(look.style);
      return glyphs.flatMap(({ glyph, cell, width }) => (cell === undefined ? [] : [{ cell: { ...cell, width, pair: look.pair, seam: look.seam }, shows: inked(glyph) || blankShows }]));
    });
  const listed = (): readonly { readonly cell: ListedCell; readonly shows: boolean }[] => (everything ??= list());
  let all: readonly ListedCell[] | undefined;
  let shown: readonly ListedCell[] | undefined;
  const words = looked.flatMap(({ segment, look }) => (look !== undefined && inked(segment.text) && !look.seam ? [look.pair] : []));
  const pairs = [...new Map(words.map((pair): [string, Pair] => [`${pair.fg.hex}/${pair.bg.hex}/${pair.terminal.fg}/${pair.terminal.bg}/${pair.reverse}`, pair])).values()];
  // [LAW:one-source-of-truth] A slot the terminal fills is no colour of the element's, whatever its hex.
  const own = (slot: "fg" | "bg"): string[] => pairs.flatMap((pair) => (pair.terminal[slot] ? [] : [pair[slot].hex]));
  return {
    all: () => (all ??= listed().map(({ cell }) => cell)),
    cells: () => (shown ??= listed().flatMap(({ cell, shows }) => (shows ? [cell] : []))),
    pairs,
    colors: new Set([...own("fg"), ...own("bg")]),
    fills: new Set(own("bg")),
    depth,
    theme,
  };
}

/**
 * `effect` on the cells any of `owners` drew, itself or through an owner
 * nested in its output, and every other cell left as it is: one item of a
 * strip whose items share a fill, the items of a row one other item stands
 * apart from, one widget of a screen. A strip's join cell is no item's, so it
 * is never handed; one painted from the items beside it follows them, the
 * moved ones included (`Recolored`). A cell none of them drew is never handed to the
 * effect, so confining one effect to many owners costs one call a cell, not
 * one for each owner.
 */
export function confined(effect: Effect, ...owners: readonly object[]): Effect {
  const confinedTo: ReadonlySet<object> = new Set(owners);
  // [LAW:single-enforcer] One reading of whose a cell is, for the cells listed and the cells handed alike.
  const owned = (cell: Placed): boolean => {
    for (let level = cell.anchor; level; level = level.inner) if (confinedTo.has(level.owner)) return true;
    return false;
  };
  // The frame as the effect sees it: the owners' cells alone. [LAW:one-source-of-truth] One narrowing, handed to both stages.
  const narrowed = (drawn: Drawn): Drawn => {
    let all: readonly ListedCell[] | undefined;
    let cells: readonly ListedCell[] | undefined;
    return { ...drawn, all: () => (all ??= drawn.all().filter(owned)), cells: () => (cells ??= drawn.cells().filter(owned)) };
  };
  // The owners' cells change when the effect's frame does.
  return (drawn) => Animation.map(effect(narrowed(drawn)), (frame): EffectFrame => (look, cell) => (owned(cell) ? frame(look, cell) : look));
}

/**
 * What `segments`, drawn at `depth` on `theme`, draw their words in, measured
 * as `Effected` measures its child for every frame. Measure an element's
 * output under an effect to read the contrast its words are left at.
 */
export function drawnOf(segments: Iterable<Segment>, depth: ColorDepth, theme: TerminalColors): Drawn {
  const looked = looks(segments, depth, theme);
  return measured(looked, () => walk(looked), depth, theme);
}

/**
 * A style's colour slots as the screen shows them, or the reverse: `reverse`
 * swaps glyph and ground, and swapping twice is where you started.
 */
function onScreen<T>(slots: { readonly fg: T; readonly bg: T }, reverse: boolean): { readonly fg: T; readonly bg: T } {
  return reverse ? { fg: slots.bg, bg: slots.fg } : slots;
}

/**
 * The specs a cell's slots are written in once their colours move from
 * `from`, what the written specs draw, to `to`: each laid on what is beneath
 * it — the ground on `SURFACE_BLACK`, the glyph on that ground, as the writer
 * lays any translucent colour (`Style.drawnColors`) — then matched at `depth`
 * (`ColorSpec.matchMove`). A slot the depth shows no move in has none, and
 * keeps the spec it was written in.
 */
function movedSpecs(from: CellColors, to: CellColors, depth: ColorDepth, theme: TerminalColors): { readonly fg?: ColorSpec; readonly bg?: ColorSpec } {
  // [LAW:one-source-of-truth] The writer's surface, so one translucent colour draws one way in a frame.
  const ground = to.bg.compositeOver(SURFACE_BLACK);
  const glyph = to.fg.compositeOver(ground);
  return { fg: ColorSpec.matchMove(from.fg, glyph, depth, theme, true), bg: ColorSpec.matchMove(from.bg, ground, depth, theme, false) };
}

/**
 * Whether two cells' colours are written alike. A slot with no colour is not
 * the default colour: it writes nothing, so a style a container lays beneath
 * (`Segment.applyStyle`) still shows through it, where `39`/`49` would not.
 */
function writesAlike(a: DrawnColors, b: DrawnColors): boolean {
  return slotWritesAlike(a.color, b.color, true) && slotWritesAlike(a.bgcolor, b.bgcolor, false);
}

function slotWritesAlike(a: ColorSpec | undefined, b: ColorSpec | undefined, foreground: boolean): boolean {
  return a === b || written(a, foreground) === written(b, foreground);
}

function written(spec: ColorSpec | undefined, foreground: boolean): string {
  return spec?.getAnsiCodes(foreground).join(";") ?? "";
}

/**
 * The look a frame returned, refused at once when it carries no attributes.
 * [LAW:no-silent-failure] A frame written before an effect moved attributes
 * returns `{ fg, bg }`, and the effects playground runs a visitor's frame with
 * its types stripped, not checked; unrefused, it fails as a TypeError in run
 * merging that names neither the frame nor the contract.
 */
function returned(look: CellLook): CellLook {
  if (look.attributes === undefined) {
    throw new TypeError("an effect frame returns the look it was handed with its changes, { ...look, fg, bg }: this one returned no attributes");
  }
  return look;
}

/** The attributes a look carries: `ATTRIBUTE_NAMES` but `reverse`. */
const MOVED: readonly Exclude<AttributeName, "reverse">[] = ATTRIBUTE_NAMES.filter((name): name is Exclude<AttributeName, "reverse"> => name !== "reverse");

/**
 * The attributes a look carries, read off anything that sets them — a
 * `Style`, or a look a frame returned with more on it than `CellAttributes`
 * names. [LAW:one-source-of-truth] The one place `reverse` is left out.
 */
export function cellAttributes(of: CellAttributes): CellAttributes {
  return Object.fromEntries(MOVED.map((name) => [name, of[name]])) as CellAttributes;
}

function sameAttributes(a: CellAttributes, b: CellAttributes): boolean {
  return a === b || MOVED.every((name) => a[name] === b[name]);
}

/** Whether two specs are one colour as written: the same kind, naming the same colour. */
function sameSpec(a: ColorSpec | undefined, b: ColorSpec | undefined): boolean {
  return a === b || (a !== undefined && b !== undefined && a.type === b.type && a.name === b.name);
}

function sameColors(a: CellColors, b: CellColors): boolean {
  return sameColor(a.fg, b.fg) && sameColor(a.bg, b.bg);
}

function sameColor(a: ColorRgba, b: ColorRgba): boolean {
  return a.red === b.red && a.green === b.green && a.blue === b.blue && a.alpha === b.alpha;
}
