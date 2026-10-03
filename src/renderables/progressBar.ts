/**
 * ProgressBar — a visual progress bar rendered with block characters.
 */

import { cellCount } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import { Style, NULL_STYLE } from "../core/style.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { drawable, getStyle } from "../core/protocol.js";

const BAR = "━";
const ASCII_BAR = "-";
const HALF_BAR_RIGHT = "╸";
const HALF_BAR_LEFT = "╺";

export interface ProgressBarOptions {
  total?: number;
  completed?: number;
  width?: number;
  pulse?: boolean;
  style?: string | Style;
  completeStyle?: string | Style;
  finishedStyle?: string | Style;
}

export class ProgressBar implements Renderable, Measurable {
  total: number;
  completed: number;
  readonly width: number | undefined;
  readonly pulse: boolean;
  readonly style: string | Style;
  readonly completeStyle: string | Style;
  readonly finishedStyle: string | Style;

  constructor(options?: ProgressBarOptions) {
    this.total = options?.total ?? 100;
    this.completed = options?.completed ?? 0;
    this.width = options?.width;
    this.pulse = options?.pulse ?? false;
    this.style = options?.style ?? NULL_STYLE;
    this.completeStyle = options?.completeStyle ?? "bar.complete";
    this.finishedStyle = options?.finishedStyle ?? "bar.finished";
  }

  *render(options: RenderOptions): Iterable<Segment> {
    // Never wider than offered, as Rich's `min(self.width or max_width, max_width)`.
    // [LAW:parse-dont-validate] parsed as a cell count, so a negative width draws nothing, as Python's `"━" * -2` is "".
    const width = cellCount(Math.min(this.width || options.maxWidth, options.maxWidth));
    // Rich 9d8f9a3 `__rich_console__`: the fill is counted in half cells, and
    // a total of zero is a bar already full.
    const completed = Math.min(this.total, Math.max(0, this.completed));
    const completeHalves = this.total ? Math.trunc((width * 2 * completed) / this.total) : width * 2;
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
