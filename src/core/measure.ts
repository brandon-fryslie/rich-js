/**
 * Measurement — min/max cell width calculation for renderables.
 */

import type { Measurable, RenderOptions } from "./protocol.js";

export class Measurement {
  readonly minimum: number;
  readonly maximum: number;

  constructor(minimum: number, maximum: number) {
    this.minimum = minimum;
    this.maximum = maximum;
  }

  get span(): number {
    return this.maximum - this.minimum;
  }

  normalize(): Measurement {
    const min = Math.max(0, Math.min(this.minimum, this.maximum));
    const max = Math.max(0, this.maximum);
    return new Measurement(min, max);
  }

  withMaximum(width: number): Measurement {
    return new Measurement(
      Math.min(this.minimum, width),
      Math.min(this.maximum, width),
    );
  }

  withMinimum(width: number): Measurement {
    const min = Math.max(this.minimum, width);
    const max = Math.max(this.maximum, min);
    return new Measurement(min, max);
  }

  clamp(minWidth: number, maxWidth: number): Measurement {
    return new Measurement(
      Math.min(Math.max(this.minimum, minWidth), maxWidth),
      Math.min(Math.max(this.maximum, minWidth), maxWidth),
    );
  }

  // [LAW:single-enforcer] Single entry point for measuring a Measurable
  static get(options: RenderOptions, measurable: Measurable): Measurement {
    if (options.maxWidth < 1) return new Measurement(0, 0);
    const { minimum, maximum } = measurable.measure(options);
    return new Measurement(minimum, Math.min(maximum, options.maxWidth));
  }
}

export function measureRenderables(
  options: RenderOptions,
  measurables: Measurable[],
): Measurement {
  if (measurables.length === 0) return new Measurement(0, 0);
  let minOfAll = 0;
  let maxOfAll = 0;
  for (const m of measurables) {
    const measurement = Measurement.get(options, m);
    minOfAll = Math.max(minOfAll, measurement.minimum);
    maxOfAll = Math.max(maxOfAll, measurement.maximum);
  }
  return new Measurement(minOfAll, maxOfAll);
}
