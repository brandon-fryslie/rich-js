/**
 * ProgressBar — a visual progress bar rendered with block characters.
 */

import { cellCount } from "../core/cells.js";
import { ColorDepth, ColorSpec, resolveTerminal, type TerminalTheme } from "../core/color.js";
import { Segment } from "../core/segment.js";
import type { Style } from "../core/style.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { drawable, getStyle } from "../core/protocol.js";
import { Effected, type Effect } from "./effect.js";
import { EFFECT_CURVES, onColors, shimmer } from "./effects.js";

const BAR = "━";
const ASCII_BAR = "-";
const HALF_BAR_RIGHT = "╸";
const HALF_BAR_LEFT = "╺";

/**
 * The pulse's shimmer: the signed-off ease and swing, at a period that carries
 * the light along a bar at about Rich's pace, and a band reaching half Rich's
 * `PULSE_SIZE` of 20 cells either side of its centre.
 */
const PULSE_CURVE = { ...EFFECT_CURVES.shimmer, seconds: 5 };
const PULSE_REACH = 10;

export interface ProgressBarOptions {
  total?: number;
  completed?: number;
  width?: number;
  /**
   * Rich's pulse, for work whose end is not known, drawn as it is `t` seconds
   * into whoever draws the frames' clock: the whole bar in its back style,
   * with the library's `shimmer` carrying `bar.pulse` light along it. Without
   * it, the bar shows `completed` of `total`.
   */
  pulse?: { readonly t: number };
  style?: string | Style;
  completeStyle?: string | Style;
  finishedStyle?: string | Style;
}

export class ProgressBar implements Renderable, Measurable {
  total: number;
  completed: number;
  readonly width: number | undefined;
  readonly pulse: { readonly t: number } | undefined;
  readonly style: string | Style;
  readonly completeStyle: string | Style;
  readonly finishedStyle: string | Style;

  constructor(options?: ProgressBarOptions) {
    this.total = options?.total ?? 100;
    this.completed = options?.completed ?? 0;
    this.width = options?.width;
    this.pulse = options?.pulse;
    this.style = options?.style ?? "bar.back";
    this.completeStyle = options?.completeStyle ?? "bar.complete";
    this.finishedStyle = options?.finishedStyle ?? "bar.finished";
  }

  *render(options: RenderOptions): Iterable<Segment> {
    // Never wider than offered, as Rich's `min(self.width or max_width, max_width)`.
    // [LAW:parse-dont-validate] parsed as a cell count, so a negative width draws nothing, as Python's `"━" * -2` is "".
    const width = cellCount(Math.min(this.width || options.maxWidth, options.maxWidth));
    if (this.pulse === undefined) {
      yield* this.track(options, width, this.completeHalves(width));
      return;
    }
    // [LAW:no-ambient-temporal-coupling] The moment is the caller's; the bar
    // only says what it looks like then. An empty track, lit by the shimmer.
    const track: Renderable = { render: (o) => this.track(o, width, 0) };
    const depth = options.colorSystem ?? ColorDepth.TRUECOLOR;
    // Rich's pulse resolves its colours on the terminal a depth assumes, as
    // `get_truecolor` does with no theme; so does this.
    const theme = resolveTerminal(undefined, depth);
    yield* new Effected(track, this.pulseEffect(options, width, depth, theme), { t: this.pulse.t, key: "progress-bar", theme }).render(options);
  }

  /**
   * The shimmer over this bar's back colour as `Effected` sees it drawn at
   * `depth`, toward `bar.pulse`. A bar has no words to keep legible, so its
   * back takes the whole of the light.
   */
  private pulseEffect(options: RenderOptions, width: number, depth: ColorDepth, theme: TerminalTheme): Effect {
    const ink = getStyle(options, this.style).drawnColors(depth).color ?? ColorSpec.default();
    const glow = getStyle(options, "bar.pulse").drawnColors(depth).color ?? ColorSpec.default();
    const loop = shimmer(PULSE_CURVE, width, PULSE_REACH, glow.getTruecolor(theme, true), 0);
    const lit = onColors(new Map([[ink.getTruecolor(theme, true).hex, 1]]), loop);
    // The light falls on the line, never the ground: a back colour equal to
    // the terminal's would otherwise light the cell behind it too.
    return (colors, cell, t) => ({ fg: lit(colors, cell, t).fg, bg: colors.bg });
  }

  /** Rich 9d8f9a3 `__rich_console__`: the fill is counted in half cells, and a total of zero is a bar already full. */
  private completeHalves(width: number): number {
    const completed = Math.min(this.total, Math.max(0, this.completed));
    return this.total ? Math.trunc((width * 2 * completed) / this.total) : width * 2;
  }

  /** The bar `width` cells wide with `completeHalves` half cells filled. */
  private *track(options: RenderOptions, width: number, completeHalves: number): Iterable<Segment> {
    const barCount = Math.floor(completeHalves / 2);
    const halfBarCount = completeHalves % 2;
    const isFinished = this.completed >= this.total;

    const fill = getStyle(options, isFinished ? this.finishedStyle : this.completeStyle);
    const back = getStyle(options, this.style);
    const fillStyle = fill.isNull ? undefined : fill;
    const backStyle = back.isNull ? undefined : back;
    const bar = drawable(options, BAR, ASCII_BAR);

    if (barCount) yield new Segment(bar.repeat(barCount), fillStyle);
    if (halfBarCount) yield new Segment(drawable(options, HALF_BAR_RIGHT, " "), fillStyle);

    // The back is drawn in colour alone, so an output with none leaves it blank.
    if (options.colorSystem === null) return;
    let remaining = width - barCount - halfBarCount;
    if (remaining && !halfBarCount && barCount) {
      yield new Segment(drawable(options, HALF_BAR_LEFT, " "), backStyle);
      remaining -= 1;
    }
    if (remaining) yield new Segment(bar.repeat(remaining), backStyle);
  }

  /** A width given is the bar's exact width, as Rich measures it; one left open fills what it is offered, down to 4. */
  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return this.width === undefined ? { minimum: 4, maximum: options.maxWidth } : { minimum: this.width, maximum: this.width };
  }
}
