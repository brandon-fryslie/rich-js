/**
 * effects-playground — what the effects-feel demo's keys change while it
 * runs, and its `--depth`, as values the page can hold and a running program
 * can be told: frames a second, the rate the demo's time moves at, the
 * magnitude, the theme and the colour depth.
 */
import { THEMES } from "../effects-feel/app.js";
import { RUN_DEFAULTS, type Depth } from "../effects-feel/vocabulary.js";

export interface Controls {
  readonly fps: number;
  readonly rate: number;
  readonly magnitude: number;
  /** A theme by its palette's name. */
  readonly theme: string;
  readonly depth: Depth;
}

/**
 * What the page tells a running program: new controls; replay the transition
 * of the scene it names from now (the demo's `f` and `d`); or restart that
 * scene's clock from 0.
 */
export type Heard =
  | { readonly kind: "controls"; readonly controls: Controls }
  | { readonly kind: "replay"; readonly scene: string }
  | { readonly kind: "restart"; readonly scene: string };

/** What the demo starts at. */
export const CONTROL_DEFAULTS: Controls = {
  fps: RUN_DEFAULTS.fps,
  rate: 1,
  magnitude: 1,
  theme: THEMES.find((t) => t.palette.dark === (RUN_DEFAULTS.ground === "dark"))!.palette.name,
  depth: RUN_DEFAULTS.depth,
};

/** Where each numeric control's slider runs. A rate of 0 holds the demo's time still. */
export const SLIDERS: { readonly [K in "fps" | "rate" | "magnitude"]: { readonly min: number; readonly max: number; readonly step: number } } = {
  fps: { min: 0.5, max: 60, step: 0.5 },
  rate: { min: 0, max: 16, step: 0.05 },
  magnitude: { min: 0, max: 100, step: 0.05 },
};
