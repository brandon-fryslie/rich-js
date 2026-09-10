/**
 * ProgressBar — a visual progress bar rendered with block characters.
 */

import { Segment } from "../core/segment.js";
import { Style, NULL_STYLE } from "../core/style.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { getStyle } from "../core/protocol.js";

const FULL_BLOCK = "━";
const EMPTY_BLOCK = "━";

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

  get percentComplete(): number {
    if (this.total <= 0) return 0;
    return Math.min(1, Math.max(0, this.completed / this.total));
  }

  *render(options: RenderOptions): Iterable<Segment> {
    const barWidth = this.width ?? Math.min(40, options.maxWidth);
    const percent = this.percentComplete;
    const isFinished = percent >= 1;
    const filledWidth = Math.round(barWidth * percent);
    const emptyWidth = barWidth - filledWidth;

    const fill = getStyle(options, isFinished ? this.finishedStyle : this.completeStyle);
    const back = getStyle(options, this.style);
    const fillStyle = fill.isNull ? undefined : fill;
    const bgStyle = back.isNull ? undefined : back;

    if (filledWidth > 0) {
      yield new Segment(FULL_BLOCK.repeat(filledWidth), fillStyle);
    }
    if (emptyWidth > 0) {
      yield new Segment(EMPTY_BLOCK.repeat(emptyWidth), bgStyle);
    }
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    const w = this.width ?? 40;
    return { minimum: 4, maximum: w };
  }
}
