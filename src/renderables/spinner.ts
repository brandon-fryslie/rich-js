/**
 * Spinner — animated terminal spinner with optional text label.
 */

import { cellLen } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { SPINNERS, DEFAULT_SPINNER } from "../core/spinnerData.js";
import type { SpinnerData } from "../core/spinnerData.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";

export interface SpinnerOptions {
  speed?: number;
  style?: string | Style;
}

function resolveStyle(style: string | Style | undefined): Style {
  if (style === undefined) return NULL_STYLE;
  if (typeof style === "string") return Style.parse(style);
  return style;
}

export class Spinner implements Renderable, Measurable {
  readonly name: string;
  readonly text: string | undefined;
  readonly speed: number;
  readonly style: Style;
  private readonly _data: SpinnerData;
  private _frameIndex: number;
  private _lastUpdate: number;

  constructor(name?: string, text?: string, options?: SpinnerOptions) {
    const spinnerName = name ?? DEFAULT_SPINNER;
    const data = SPINNERS[spinnerName];
    if (!data) {
      throw new Error(`Unknown spinner: "${spinnerName}"`);
    }
    this.name = spinnerName;
    this.text = text;
    this.speed = options?.speed ?? 1;
    this.style = resolveStyle(options?.style);
    this._data = data;
    this._frameIndex = 0;
    this._lastUpdate = Date.now();
  }

  get frames(): readonly string[] {
    return this._data.frames;
  }

  get interval(): number {
    return this._data.interval;
  }

  /** Advance frame based on elapsed time and return current frame. */
  private _currentFrame(): string {
    const now = Date.now();
    const elapsed = now - this._lastUpdate;
    const effectiveInterval = this.interval / this.speed;
    if (elapsed >= effectiveInterval) {
      const steps = Math.floor(elapsed / effectiveInterval);
      this._frameIndex = (this._frameIndex + steps) % this._data.frames.length;
      this._lastUpdate = now;
    }
    return this._data.frames[this._frameIndex]!;
  }

  *render(_options: RenderOptions): Iterable<Segment> {
    const frame = this._currentFrame();
    const spinStyle = this.style.isNull ? undefined : this.style;
    yield new Segment(frame, spinStyle);
    if (this.text) {
      yield new Segment(` ${this.text}`);
    }
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    const frameWidth = Math.max(...this._data.frames.map((f) => cellLen(f)));
    const textWidth = this.text ? cellLen(this.text) + 1 : 0;
    const total = frameWidth + textWidth;
    return { minimum: frameWidth, maximum: total };
  }
}
