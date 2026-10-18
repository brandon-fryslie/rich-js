/**
 * Effected — a renderable whose finished cells' colours pass through an
 * effect at a moment `t`.
 *
 * An effect is one pure function in two stages: a time and what the element
 * draws in that frame in, a function of the frame out; and into that, a
 * cell's colours and where the cell is, the cell's new colours out. Whatever
 * holds for the whole frame is worked out in the first stage, once, and every
 * cell of the frame is handed to the second, but for those a wrapper keeps
 * back: `confined` hands over only the cells its owners drew, so a second
 * stage never counts on seeing them all. Shimmer, pulse, fade and
 * dissolve are all this one shape, differing by what the function does with
 * its inputs [LAW:one-type-per-behavior]; two effects stack by nesting one
 * wrapper in another, which is the same as calling one after the other but
 * for what the outer one measures: the inner one's output.
 *
 * What the element draws (`Drawn`) — the cells the second stage will be
 * handed, and the colours of its words — is measured here, in the render, off
 * the same reading of each segment its cells are drawn from, and handed to the
 * effect's first stage, once a frame. It is what an effect keeping words legible is
 * settled against (`onColors`, `./effects.ts`), so no caller derives it a
 * second time from a render of its own.
 *
 * [LAW:no-ambient-temporal-coupling] `t` is a constructor argument, not a
 * clock read. Whoever draws frames builds the view for each frame's `t`, so
 * the same `t` always draws the same bytes, at 30 frames a second or one
 * every two seconds.
 *
 * What an effect may not do is the contract this module holds:
 *
 * - It changes how cells look, never which cells exist or who drew them. The
 *   child's text is walked by grapheme cluster, so a wide glyph is one cell
 *   to the effect and is never cut, and a run cut out of a segment keeps that
 *   segment's link and meta and carries its anchor shifted to the run's first
 *   cell (`Style.shiftedBy`), so hit testing still finds the owner.
 * - A cell whose colours come back unchanged keeps its original `ColorSpec`,
 *   and a segment whose every cell is unchanged is yielded with its look as
 *   it was, so the identity effect is byte-identical; what it gains is when
 *   the frame next changes (`Style.nextChange`), which writes no byte.
 *   Neighbouring cells the output depth
 *   writes alike stay one segment: a segment is cut only where the written
 *   colours change, so two colours that land on one index are one run.
 * - New colours are built with `ColorSpec.fromRgba`, never parsed from a
 *   string, so no frame adds an entry to a parse cache.
 * - With no colour output (`colorSystem: null`) there is nothing for an
 *   effect to change, and the child's segments pass through untouched.
 *
 * Positions are the child's own: row and column count from the top-left of
 * what the child drew, so a sweep crosses the element, not the screen.
 */

import { drawnBy, shiftAnchor, type Anchor } from "../core/anchor.js";
import { cellLen, graphemes } from "../core/cells.js";
import { ColorDepth, ColorSpec, SURFACE_BLACK, type ColorRgba, type TerminalTheme } from "../core/color.js";
import type { Beat } from "../core/easing.js";
import { fnv1a } from "../core/fnv1a.js";
import { Measurement } from "../core/measure.js";
import type { Composite, Measurable, Renderable, RenderOptions } from "../core/protocol.js";
import { render } from "../core/protocol.js";
import { Segment } from "../core/segment.js";
import { JOIN, colorsOwnedBy } from "../core/strip.js";
import { Style } from "../core/style.js";

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
 * Where a cell is in the output of the renderable an effect wraps, its seed:
 * a number in [0, 1) that is the same for that cell on every frame, for an
 * effect that varies cell by cell (a per-cell offset in time, a sparkle) —
 * and which of its on-screen colours are the terminal's.
 */
export interface EffectCell {
  readonly row: number;
  readonly col: number;
  readonly seed: number;
  /**
   * Whether the glyph's colour and the colour behind it, as the screen shows
   * them, are the terminal's own: a slot the element's style leaves unset or
   * sets to `default`. Such a colour is resolved through the theme, so its
   * hex can equal one the element wrote; this is what tells them apart.
   */
  readonly terminal: { readonly fg: boolean; readonly bg: boolean };
  /** Whether the cell's style swaps its two slots, as `Pair.reverse` says: with `colors` and `terminal`, the cell's `Pair`. */
  readonly reverse: boolean;
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
 * A cell's ink and ground as the screen shows them, which of the two are the
 * terminal's, and whether its style swaps them (`reverse`): what an `Effect`
 * is handed for that cell.
 */
export interface Pair extends CellColors {
  readonly terminal: EffectCell["terminal"];
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
   * Every cell the element shows something in this frame — a glyph, a
   * ground that is not the terminal's, or a line its style draws — where it
   * sits and who drew it, listed before the second stage is handed any: what
   * an effect spread over the element — a transition, which has its last cell
   * settle as it ends — is spread over. A blank cell on the terminal's ground
   * that draws no line is handed but not listed, since nothing in it shows.
   * `confined` narrows it to the cells its owners drew. A call, so a frame
   * whose effect does not ask lists none.
   */
  cells(): readonly Placed[];
  /** Every distinct ink and ground of a word cell. */
  readonly pairs: readonly Pair[];
  /** The colours the element sets itself in its word cells, by hex: never the terminal's, whatever its hex. */
  readonly colors: ReadonlySet<string>;
  /** Of `colors`, the ones a word cell has for its ground. */
  readonly fills: ReadonlySet<string>;
  /** The depth the frame is written at: below truecolor a moved colour lands on a palette colour. */
  readonly depth: ColorDepth;
  /** The terminal the frame is drawn on. */
  readonly theme: TerminalTheme;
}

/**
 * The frame at time `t`, in seconds, whose element draws `drawn`: each cell's
 * colours in that frame. Return `colors` to leave a cell be.
 * [LAW:types-are-the-program] Per-frame work is the outer stage, so it runs
 * once a frame by the shape of the call, never by a cache asking whether this
 * cell's frame is the last one's.
 *
 * An effect that knows when its frame next changes says so in `nextChange`,
 * asked with the same `t` and `drawn` its first stage is: a stepped one its
 * next step's start, a transition `t` until it is done and `Infinity` after,
 * a loop that holds every cell still at the frame's depth `Infinity` there.
 * [LAW:types-are-the-program] The answer is a fact about the frame, so it is
 * asked with everything the frame is drawn from; an answer asked with `t`
 * alone could not say that a frame is still because of its depth. A plain
 * function is an effect that moves every frame, and answers `t`
 * (`nextChangeOf`): the one true answer for a frame nothing has promised to
 * hold, so a loop needs no second shape.
 */
export interface Effect {
  (t: number, drawn: Drawn): (colors: CellColors, cell: EffectCell) => CellColors;
  /** When the frame drawn at `t` of `drawn` next changes, in seconds on `t`'s timeline, never before `t`; absent, every frame. */
  readonly nextChange?: (t: number, drawn: Drawn) => number;
}

/**
 * When `effect`'s frame at `t` of `drawn` next changes: what it says, or `t`
 * for an effect that says nothing. [LAW:single-enforcer] The one reading of
 * an absent `nextChange`, so no caller holds its own default.
 */
export function nextChangeOf(effect: Effect, t: number, drawn: Drawn): number {
  return effect.nextChange?.(t, drawn) ?? t;
}

/**
 * An effect drawing as `effect` does, with `nextChange` as its answer to when
 * its frame next changes, in place of whatever `effect` answered; `effect`
 * itself is left as it was. A composer whose answer depends on the inner
 * effect's reads it with `nextChangeOf`, as `onBeat` and `confined` do.
 */
export function withNextChange(effect: Effect, nextChange: (t: number, drawn: Drawn) => number): Effect {
  return Object.assign((t: number, drawn: Drawn) => effect(t, drawn), { nextChange });
}

export interface EffectedOptions {
  /** The moment to draw, in seconds. */
  readonly t: number;
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
  readonly theme: TerminalTheme;
}

export class Effected implements Renderable, Measurable, Composite {
  readonly t: number;
  readonly key: string;
  readonly theme: TerminalTheme;

  constructor(
    readonly renderable: Renderable,
    readonly effect: Effect,
    options: EffectedOptions,
  ) {
    if (!Number.isFinite(options.t)) {
      throw new RangeError(`Effected needs a finite t, got ${options.t}`);
    }
    this.t = options.t;
    this.key = options.key;
    this.theme = options.theme;
  }

  render(options: RenderOptions): Iterable<Segment> {
    const segments = render(this.renderable, options);
    // With no colour output nothing the effect does is written, so the child
    // is what is shown, and it changes when the child says it does.
    if (options.colorSystem === null) return segments;
    return this._moved(segments, options);
  }

  *contents(): Iterable<Renderable> {
    yield this.renderable;
  }

  private *_moved(segments: Iterable<Segment>, options: RenderOptions): Iterable<Segment> {
    // No depth named is no downgrade, as `drawnColors` reads it.
    const depth = options.colorSystem ?? ColorDepth.TRUECOLOR;
    // [LAW:one-source-of-truth] The frame is measured before any cell is
    // handed to the effect, off the same looks its cells are drawn from, and
    // the one measure is what both stages and the effect's next change are
    // asked with.
    const looked = looks(segments, depth, this.theme);
    const walked = walk(looked);
    const drawn = measured(looked, () => walked, depth, this.theme);
    const frame = this.effect(this.t, drawn);
    // What the effect draws at `t` is drawn until its next change, and the
    // cells say so, under whatever the child already said (the sooner wins).
    yield* Segment.applyStyle(this._recolored(walked, frame, depth), new Style({ nextChange: nextChangeOf(this.effect, this.t, drawn) }));
  }

  private *_recolored(walked: readonly Walked[], frame: ReturnType<Effect>, depth: ColorDepth): Iterable<Segment> {
    for (const { segment, look, glyphs } of walked) {
      if (look === undefined) {
        yield segment;
        continue;
      }
      const { style: base, wire, slots, pair } = look;
      const { terminal } = pair;
      const from: CellColors = { fg: pair.fg, bg: pair.bg };
      // [LAW:one-source-of-truth] A run is cells the wire writes alike: each
      // cell is drawn at the output depth first and merged on the colours that
      // writes, so two truecolors landing on one index stay one run. A cell
      // the effect gave its neighbour's colours is drawn as that neighbour was.
      const runs: { text: string; cells: number; colors: CellColors; drawn: DrawnColors }[] = [];
      for (const { glyph, cell } of glyphs) {
        // Back from the screen to the style's slots: the same swap undoes itself.
        const colors = cell === undefined ? slots : onScreen(frame(from, { ...cell, seed: this.seed(cell.row, cell.col), terminal, reverse: pair.reverse }), pair.reverse);
        const last = runs[runs.length - 1];
        const writes = last !== undefined && sameColors(last.colors, colors) ? last.drawn : this.respec(wire, slots, colors, depth);
        if (last !== undefined && writesAlike(last.drawn, writes)) {
          last.text += glyph;
          last.cells += cellLen(glyph);
          last.colors = colors;
        } else {
          runs.push({ text: glyph, cells: cellLen(glyph), colors, drawn: writes });
        }
      }
      if (runs.every((run) => writesAlike(run.drawn, wire))) {
        yield segment;
        continue;
      }
      let offset = 0;
      for (const run of runs) {
        const shifted = base.shiftedBy(offset);
        const style = writesAlike(run.drawn, wire) ? shifted : shifted.add(Style.fromColor(run.drawn.color, run.drawn.bgcolor));
        yield new Segment(run.text, style);
        offset += run.cells;
      }
    }
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
  static shows(pair: Pair, to: CellColors, depth: ColorDepth, theme: TerminalTheme): CellColors {
    const from = onScreen(pair, pair.reverse);
    const moved = movedSpecs(from, onScreen(to, pair.reverse), depth, theme);
    return onScreen({ fg: moved.fg?.getTruecolor(theme, true) ?? from.fg, bg: moved.bg?.getTruecolor(theme, false) ?? from.bg }, pair.reverse);
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

  /** A cell's seed: FNV-1a of the key and the position, scaled into [0, 1). */
  private seed(row: number, col: number): number {
    return Number.parseInt(fnv1a(`${this.key}:${row}:${col}`), 16) / 0x1_0000_0000;
  }
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
}

/** Each of `segments` with how it is drawn at `depth` on `theme`; a control segment draws nothing. */
function looks(segments: Iterable<Segment>, depth: ColorDepth, theme: TerminalTheme): Looked[] {
  return [...segments].map((segment) => {
    if (segment.isControl) return { segment, look: undefined };
    const style = segment.style ?? Style.null();
    const wire = style.drawnColors(depth);
    const slots = { fg: (wire.color ?? DEFAULT).getTruecolor(theme, true), bg: (wire.bgcolor ?? DEFAULT).getTruecolor(theme, false) };
    const reverse = style.reverse === true;
    const terminal = onScreen({ fg: wire.color?.isDefault ?? true, bg: wire.bgcolor?.isDefault ?? true }, reverse);
    return { segment, look: { style, wire, slots, pair: { ...onScreen(slots, reverse), terminal, reverse } } };
  });
}

/** A segment with how it is drawn, or none for a control segment, which draws nothing. */
interface Looked {
  readonly segment: Segment;
  readonly look: Look | undefined;
}

/** A segment with how it is drawn and each of its glyphs, placed where a cell is drawn — never a newline, which is no cell. */
interface Walked extends Looked {
  readonly glyphs: readonly { readonly glyph: string; readonly cell: Placed | undefined }[];
}

/**
 * Each glyph of `looked`, where its cell sits: rows and columns from the
 * top-left of the output, a wide glyph one cell at its first column, and its
 * anchor shifted to that column as `Style.shiftedBy` shifts a run's.
 * [LAW:one-source-of-truth] The one walk: what `Drawn.cells` lists and what
 * the render hands the effect are read off it.
 */
function walk(looked: readonly Looked[]): Walked[] {
  let row = 0;
  let col = 0;
  return looked.map(({ segment, look }) => {
    if (look === undefined) return { segment, look, glyphs: [] };
    const anchor = look.style.anchor;
    // Cells into the segment, as `base.shiftedBy` counts them in the render.
    let into = 0;
    const glyphs = [...graphemes(segment.text)].map((glyph) => {
      const cell = glyph === "\n" ? undefined : { row, col, anchor: anchor && shiftAnchor(anchor, into) };
      [row, col] = glyph === "\n" ? [row + 1, 0] : [row, col + cellLen(glyph)];
      into += cellLen(glyph);
      return { glyph, cell };
    });
    return { segment, look, glyphs };
  });
}

/** Whether `style` draws in its ink on a blank glyph: a line under, through or over it, or a frame round it. */
function drawsLines(style: Style): boolean {
  return [style.underline, style.underline2, style.strike, style.overline, style.frame, style.encircle].some((on) => on === true);
}

/**
 * What `looked` draws: `Drawn`'s measure, taken once per frame. Its `cells`
 * are listed off `walked` the first time they are asked for, since only an
 * effect spread over the element asks, and a glyph walk is what measuring the
 * words alone, a segment at a time, is spared (`drawnOf`).
 */
function measured(looked: readonly Looked[], walked: () => readonly Walked[], depth: ColorDepth, theme: TerminalTheme): Drawn {
  const ground = theme.backgroundColor.hex;
  let listed: readonly Placed[] | undefined;
  const list = (): readonly Placed[] =>
    walked().flatMap(({ look, glyphs }) => {
      if (look === undefined) return [];
      // A blank glyph shows its ground, and any line its style draws in its ink.
      const blankShows = look.pair.bg.hex !== ground || drawsLines(look.style);
      return glyphs.flatMap(({ glyph, cell }) => (cell !== undefined && (glyph.trim() !== "" || blankShows) ? [cell] : []));
    });
  const words = looked.flatMap(({ segment, look }) => (look !== undefined && segment.text.trim() !== "" && !drawnBy(look.style.anchor, JOIN) ? [look.pair] : []));
  const pairs = [...new Map(words.map((pair): [string, Pair] => [`${pair.fg.hex}/${pair.bg.hex}/${pair.terminal.fg}/${pair.terminal.bg}/${pair.reverse}`, pair])).values()];
  // [LAW:one-source-of-truth] A slot the terminal fills is no colour of the element's, whatever its hex.
  const own = (slot: "fg" | "bg"): string[] => pairs.flatMap((pair) => (pair.terminal[slot] ? [] : [pair[slot].hex]));
  return {
    cells: () => (listed ??= list()),
    pairs,
    colors: new Set([...own("fg"), ...own("bg")]),
    fills: new Set(own("bg")),
    depth,
    theme,
  };
}

/**
 * `effect` sampled and held on `beat`: drawn at the moment the hold in
 * progress began (`Beat.start`), so within a hold every frame is the frame
 * at its start, and at each hold's start it moves on. A continuous effect
 * given a short curve becomes one that steps — a `wheel` turning a sixth of
 * a turn once a second — and at one redraw a second a hold shorter than a
 * second is skipped, as frames are. [LAW:no-ambient-temporal-coupling] The
 * held time is a function of `t`, so the same `t` draws the same bytes at
 * any rate. The frame next changes at a hold's start, and only one the
 * sampled effect has moved by: the first hold start at or after what it
 * answers for the frame held now (`Beat.end`). An effect that moves every
 * frame makes the beat's own answer, the end of this hold; one that is done
 * and says never leaves the beat saying never too, since the hold after this
 * one would draw the same frame. The answer is read off what the effect
 * says, never off a comparison of frames: an effect that steps and is back
 * on the same colour by the next hold still turns the beat there, an early
 * answer the contract allows.
 */
export function onBeat(effect: Effect, beat: Beat): Effect {
  return withNextChange(
    (t, drawn) => effect(beat.start(t), drawn),
    (t, drawn) => {
      const moved = nextChangeOf(effect, beat.start(t), drawn);
      if (moved === Number.POSITIVE_INFINITY) return moved;
      const end = beat.end(t);
      // The hold boundaries after `t` are `end`, then each hold's end in turn;
      // the frame turns at the first one the effect has moved by.
      return moved <= end ? end : beat.start(moved) === moved ? moved : beat.end(moved);
    },
  );
}

/**
 * `effect` on the colours any of `owners` drew, itself or through an owner
 * nested in its output, and every other colour left as it is: one item of a
 * strip whose items share a fill, the items of a row one other item stands
 * apart from, one widget of a screen. A seam cell shows its two neighbours
 * side by side, a powerline arrow in the fill it points out of over the fill
 * it points into, so each side moves with its own item (`colorsOwnedBy`,
 * `../core/strip.ts`). A cell none of them drew is never handed to the
 * effect, so confining one effect to many owners costs one call a cell, not
 * one for each owner.
 */
export function confined(effect: Effect, ...owners: readonly object[]): Effect {
  const confinedTo: ReadonlySet<object> = new Set(owners);
  // [LAW:single-enforcer] One reading of which slots are owned, for the cells listed and the cells handed alike.
  const ownedOf = (cell: Placed) => colorsOwnedBy(cell.anchor, confinedTo);
  const any = ({ fg, bg }: { fg: boolean; bg: boolean }): boolean => fg || bg;
  // The frame as the effect sees it: the owners' cells alone. [LAW:one-source-of-truth] One narrowing, handed to both stages.
  const owned = (drawn: Drawn): Drawn => ({ ...drawn, cells: () => drawn.cells().filter((cell) => any(ownedOf(cell))) });
  // The owners' cells change when the effect's frame does.
  return withNextChange(
    (t, drawn) => {
      const frame = effect(t, owned(drawn));
      return (colors, cell) => {
        const owns = ownedOf(cell);
        if (!any(owns)) return colors;
        const moved = frame(colors, cell);
        return { fg: owns.fg ? moved.fg : colors.fg, bg: owns.bg ? moved.bg : colors.bg };
      };
    },
    (t, drawn) => nextChangeOf(effect, t, owned(drawn)),
  );
}

/**
 * What `segments`, drawn at `depth` on `theme`, draw their words in, measured
 * as `Effected` measures its child for every frame. Measure an element's
 * output under an effect to read the contrast its words are left at.
 */
export function drawnOf(segments: Iterable<Segment>, depth: ColorDepth, theme: TerminalTheme): Drawn {
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
function movedSpecs(from: CellColors, to: CellColors, depth: ColorDepth, theme: TerminalTheme): { readonly fg?: ColorSpec; readonly bg?: ColorSpec } {
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

function sameColors(a: CellColors, b: CellColors): boolean {
  return sameColor(a.fg, b.fg) && sameColor(a.bg, b.bg);
}

function sameColor(a: ColorRgba, b: ColorRgba): boolean {
  return a.red === b.red && a.green === b.green && a.blue === b.blue && a.alpha === b.alpha;
}
