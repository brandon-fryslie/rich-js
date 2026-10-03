/**
 * Effected — a renderable whose finished cells' colours pass through an
 * effect at a moment `t`.
 *
 * An effect is one pure function: a cell's colours, where the cell is, and a
 * time in, the cell's new colours out. Shimmer, pulse, fade and dissolve are
 * all this one shape, differing by what the function does with its inputs
 * [LAW:one-type-per-behavior]; two effects stack by nesting one wrapper in
 * another, which is the same as calling one after the other.
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
 *   and a segment whose every cell is unchanged is yielded as it was, so the
 *   identity effect is byte-identical. Neighbouring cells given equal colours
 *   stay one segment: a segment is cut only where the colours change.
 * - New colours are built with `ColorSpec.fromRgba`, never parsed from a
 *   string, so no frame adds an entry to a parse cache.
 * - With no colour output (`colorSystem: null`) there is nothing for an
 *   effect to change, and the child's segments pass through untouched.
 *
 * Positions are the child's own: row and column count from the top-left of
 * what the child drew, so a sweep crosses the element, not the screen.
 */

import { cellLen, graphemes } from "../core/cells.js";
import { ColorSpec, type ColorRgba } from "../core/color.js";
import { fnv1a } from "../core/fnv1a.js";
import { Measurement } from "../core/measure.js";
import type { Measurable, Renderable, RenderOptions } from "../core/protocol.js";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";

/** A cell's foreground and background, as the colours an effect moves. */
export interface CellColors {
  readonly fg: ColorRgba;
  readonly bg: ColorRgba;
}

/**
 * Where a cell is in the output of the renderable an effect wraps, and its
 * seed: a number in [0, 1) that is the same for that cell on every frame, for
 * an effect that varies cell by cell (a per-cell offset in time, a sparkle).
 */
export interface EffectCell {
  readonly row: number;
  readonly col: number;
  readonly seed: number;
}

/** A cell's colours at time `t`, in seconds. Return `colors` to leave it be. */
export type Effect = (colors: CellColors, cell: EffectCell, t: number) => CellColors;

export interface EffectedOptions {
  /** The moment to draw, in seconds. */
  readonly t: number;
  /**
   * Names the element for its seeds, so two elements showing the same text do
   * not twinkle in lockstep. The same key gives the same seeds on every frame.
   */
  readonly key: string;
  /**
   * The colours a cell that sets none is drawn in. The terminal's own
   * foreground and background are never queried, so the caller says what they
   * are.
   */
  readonly defaults: CellColors;
}

export class Effected implements Renderable, Measurable {
  readonly t: number;
  readonly key: string;
  readonly defaults: CellColors;

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
    this.defaults = options.defaults;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    const segments = this.renderable.render(options);
    if (options.colorSystem === null) {
      yield* segments;
      return;
    }
    let row = 0;
    let col = 0;
    for (const segment of segments) {
      if (segment.isControl) {
        yield segment;
        continue;
      }
      const base = segment.style ?? Style.null();
      const from: CellColors = {
        fg: drawn(base.color, this.defaults.fg, true),
        bg: drawn(base.bgcolor, this.defaults.bg, false),
      };
      // Each grapheme's colours, merged into runs of equal colours as they
      // come; `undefined` is a run left as the segment drew it.
      const runs: { text: string; cells: number; colors: CellColors | undefined }[] = [];
      for (const glyph of graphemes(segment.text)) {
        let colors: CellColors | undefined;
        if (glyph === "\n") {
          row++;
          col = 0;
        } else {
          const to = this.effect(from, { row, col, seed: this.seed(row, col) }, this.t);
          colors = sameColors(to, from) ? undefined : to;
          col += cellLen(glyph);
        }
        const last = runs[runs.length - 1];
        if (last !== undefined && sameRun(last.colors, colors)) {
          last.text += glyph;
          last.cells += cellLen(glyph);
        } else {
          runs.push({ text: glyph, cells: cellLen(glyph), colors });
        }
      }
      if (runs.every((run) => run.colors === undefined)) {
        yield segment;
        continue;
      }
      let offset = 0;
      for (const run of runs) {
        const shifted = base.shiftedBy(offset);
        const style =
          run.colors === undefined
            ? shifted
            : shifted.add(
                Style.fromColor(
                  respec(base.color, from.fg, run.colors.fg),
                  respec(base.bgcolor, from.bg, run.colors.bg),
                ),
              );
        yield new Segment(run.text, style);
        offset += run.cells;
      }
    }
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return Measurement.get(options, this.renderable);
  }

  /** A cell's seed: FNV-1a of the key and the position, scaled into [0, 1). */
  private seed(row: number, col: number): number {
    return Number.parseInt(fnv1a(`${this.key}:${row}:${col}`), 16) / 0x1_0000_0000;
  }
}

/** The colour a cell's spec draws, or `fallback` when it sets none. */
function drawn(spec: ColorSpec | undefined, fallback: ColorRgba, foreground: boolean): ColorRgba {
  return spec === undefined || spec.isDefault ? fallback : spec.getTruecolor(undefined, foreground);
}

/** The spec to draw `to` with: the original one where the effect left it. */
function respec(spec: ColorSpec | undefined, from: ColorRgba, to: ColorRgba): ColorSpec | undefined {
  return sameColor(from, to) ? spec : ColorSpec.fromRgba(to);
}

function sameColor(a: ColorRgba, b: ColorRgba): boolean {
  return a.red === b.red && a.green === b.green && a.blue === b.blue && a.alpha === b.alpha;
}

function sameColors(a: CellColors, b: CellColors): boolean {
  return sameColor(a.fg, b.fg) && sameColor(a.bg, b.bg);
}

function sameRun(a: CellColors | undefined, b: CellColors | undefined): boolean {
  return a === undefined || b === undefined ? a === b : sameColors(a, b);
}
