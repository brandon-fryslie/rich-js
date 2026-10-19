/**
 * A change from one renderable to another in the same slot — a status that
 * goes from "building" to "done", a number that becomes a different number —
 * drawn as a crossfade or a wipe instead of a cut.
 *
 * Both are one shape [LAW:one-type-per-behavior]: how far each cell is through
 * the change at `t`, from 0, the old renderable as drawn, to 1, the new one as
 * drawn. A cell under a half shows the old one and from a half the new one,
 * veiled toward the terminal's ground by how near the half it is (`veiled`,
 * `./effects.ts`), so every cell passes through the ground and none jumps from
 * one glyph to another. A crossfade has every cell at one place in the change;
 * a wipe sends a front across the element's columns with the new renderable
 * behind it.
 *
 * The change is drawn at the new renderable's size from its first frame: the
 * old one is cut or padded to the new one's rows, so what sits beside the
 * element moves once, at the cut, and never while the change runs. Once done
 * it is the new renderable itself, byte for byte, and never changes again.
 *
 * [LAW:no-ambient-temporal-coupling] Pure in `t`: nothing is kept from one
 * frame to the next, so the same `t` draws the same bytes at any frame rate.
 */

import { Animation } from "../core/animation.js";
import type { TerminalTheme } from "../core/color.js";
import { Measurement } from "../core/measure.js";
import type { Composite, Measurable, Renderable, RenderOptions } from "../core/protocol.js";
import { render } from "../core/protocol.js";
import { Segment } from "../core/segment.js";
import { Recolored } from "./effect.js";
import { requireCurve, transition, veiled, type Curve, type Transition } from "./effects.js";

/** What a change is between: the renderable drawn until now, the one drawn from now on, and the terminal whose ground the change passes through. */
export interface Between {
  readonly from: Renderable;
  readonly to: Renderable;
  readonly theme: TerminalTheme;
}

/** A change from one renderable to another: what it draws at each moment, from `t = 0` on its own clock. */
export type Change = (between: Between) => Animation<Renderable>;

/**
 * How far each cell of an element `width` columns wide is through a change at
 * `t`, in [0, 1]: 0 shows the old renderable as drawn, 1 the new one.
 */
type Progress = (t: number, width: number) => (row: number, col: number) => number;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** How much of a cell `p` of the way through a change shows: all of it at either end, none at the half, where the old gives way to the new. */
const shows = (p: number): number => Math.abs(2 * p - 1);

/** The change over `curve`, each cell as far through it as `progress` says. */
function change(curve: Curve, progress: Progress): Transition<Change> {
  requireCurve(curve);
  return transition(curve.seconds, ({ from, to, theme }) =>
    Animation.sequence(
      Animation.continuous((t) => new ChangeFrame(from, to, theme, progress, t, curve.swing)),
      curve.seconds,
      Animation.constant(to),
    ),
  );
}

/** A crossfade: the old renderable fades to the terminal's ground and the new one rises from it, every cell together, over `curve`. */
export function crossfade(curve: Curve): Transition<Change> {
  return change(curve, (t) => {
    const p = clamp01(curve.ease(clamp01(t / curve.seconds)));
    return () => p;
  });
}

/** How many columns a wipe's front is soft over at its default: each cell passes through the ground as the front crosses it. */
const WIPE_EDGE = 6;

/**
 * A wipe: a front crossing the element's columns from left to right over
 * `curve`, the new renderable behind it, the old one ahead of it, and the
 * cells within `edge` columns of it passing through the terminal's ground.
 */
export function wipe(curve: Curve, edge = WIPE_EDGE): Transition<Change> {
  if (!(Number.isFinite(edge) && edge > 0)) throw new RangeError(`wipe: edge must be a positive number of columns, got ${edge}`);
  return change(curve, (t, width) => {
    // The front starts `edge` columns before the first cell turns and ends with the last one turned.
    const front = curve.ease(clamp01(t / curve.seconds)) * (width + edge);
    return (_row, col) => clamp01((front - col) / edge);
  });
}

/** One frame of a change at `t`: `from` and `to` spliced cell by cell, each veiled by how near the half its cell is. */
class ChangeFrame implements Renderable, Measurable, Composite {
  constructor(
    readonly from: Renderable,
    readonly to: Renderable,
    readonly theme: TerminalTheme,
    readonly progress: Progress,
    readonly t: number,
    readonly swing: number,
  ) {}

  render(options: RenderOptions): Iterable<Segment> {
    // Drawn in the order `contents` names them.
    const before = Segment.splitLines(render(this.from, options));
    const drawn = [...render(this.to, options)];
    const after = Segment.splitLines(drawn);
    // [LAW:one-source-of-truth] The new renderable's rows are the shape of every frame, its last row ending as it ends.
    const lengths = after.map((line) => Segment.getLineLength(line));
    const ended = drawn.filter((segment) => !segment.isControl).at(-1)?.text.endsWith("\n") ?? false;
    const width = Math.max(0, ...lengths);
    const at = this.progress(this.t, width);
    const rows = after.flatMap((line, row) => [
      ...splice(Segment.adjustLineLength(before[row] ?? [], lengths[row]!), line, (col) => at(row, col) >= 0.5),
      ...(row < after.length - 1 || ended ? [Segment.line()] : []),
    ]);
    // The frame says nothing of when it changes: the change's own animation says it moves every frame.
    const veil = veiled(() => (cell) => shows(at(cell.row, cell.col)), this.swing);
    return render(new Recolored({ render: () => rows }, veil, { t: this.t, key: "change", theme: this.theme }), options);
  }

  *contents(): Iterable<Renderable> {
    yield this.from;
    yield this.to;
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return Measurement.get(options, this.to);
  }
}

/**
 * One row from two of the same width, each column from `after` where `isAfter`
 * says and from `before` elsewhere. Cut at every column the side changes, so
 * a wide glyph a cut falls in is blanked (`Segment.divide`), never halved.
 */
function splice(before: Segment[], after: Segment[], isAfter: (col: number) => boolean): Segment[] {
  const width = Segment.getLineLength(after);
  const cuts: number[] = [];
  for (let col = 1; col < width; col++) if (isAfter(col) !== isAfter(col - 1)) cuts.push(col);
  const from = Segment.divide(before, cuts);
  const to = Segment.divide(after, cuts);
  const starts = [0, ...cuts];
  return starts.flatMap((start, i) => (isAfter(start) ? (to[i] ?? []) : (from[i] ?? [])));
}
