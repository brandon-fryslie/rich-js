/**
 * effects-feel — the names the demo speaks: its effects and each one's
 * starting constants, and the colour depths it can be judged at. Pure data and
 * functions of it, with nothing from node, so the browser playground and the
 * command line read the one table.
 */

import { ColorDepth, EASES, EFFECT_CURVES, type Ease, type Env } from "../../src/index.js";
import type { EaseName } from "../../src/core/easing.js";

export const EFFECTS = ["shimmer", "pulse", "sparkle", "wheel", "fade", "dissolve"] as const satisfies readonly (keyof typeof EFFECT_CURVES)[];
export type EffectName = (typeof EFFECTS)[number];

/** What each effect's swing measures, for the flags' help. */
const SWING_UNITS: Record<EffectName, string> = {
  shimmer: "mix toward the light at the brightest glint, 0–1",
  pulse: "mix toward the light at the top of a beat on a chosen element, 0–1",
  sparkle: "mix toward the firefly's colour at its brightest flash, 0–1",
  wheel: "how far the segments stray from one another, 0–1 (1 is half a turn apart)",
  fade: "how hidden at the start, 0–1",
  dissolve: "how hidden once gone, 0–1",
};

/** The name `EASES` gives `ease`, so a flag can spell the library's default. */
function easeName(ease: Ease): EaseName {
  const name = (Object.keys(EASES) as EaseName[]).find((n) => EASES[n] === ease);
  if (name === undefined) throw new Error("a default curve's ease is not one EASES names");
  return name;
}

/** Each effect's defaults, as the flags spell them: the library's signed-off curves (`EFFECT_CURVES`). */
export const EFFECT_DEFAULTS: Record<EffectName, { seconds: number; ease: EaseName; swing: number; unit: string }> = Object.fromEntries(
  EFFECTS.map((effect) => {
    const { seconds, ease, swing } = EFFECT_CURVES[effect];
    return [effect, { seconds, ease: easeName(ease), swing, unit: SWING_UNITS[effect] }];
  }),
) as Record<EffectName, { seconds: number; ease: EaseName; swing: number; unit: string }>;

export const GROUNDS = ["dark", "light"] as const;
export type Ground = (typeof GROUNDS)[number];

/**
 * How much of a loop's designed time one frame moves it at rate ×1. A frame
 * is the unit of change: every frame moves every loop by this, whatever the
 * frame rate, which only sets how often a frame comes. The curves are tuned
 * so that one designed second steps a colour by at most the one-frame-a-
 * second bar, and a frame that steps the whole bar reads as a step; a
 * quarter of it reads as motion. The demo's rate keys scale it (app.ts).
 */
export const STEP = 0.25;

/** What a run is drawn at when nothing says otherwise. */
export const RUN_DEFAULTS: { readonly fps: number; readonly depth: Depth; readonly ground: Ground } = { fps: 30, depth: "truecolor", ground: "dark" };

/** The colour depths a run can be judged at, by the name the flag takes. */
export const DEPTHS = ["truecolor", "256", "16", "none"] as const;
export type Depth = (typeof DEPTHS)[number];

/**
 * How a terminal says it draws each depth, as the environment colour
 * detection reads: `FORCE_COLOR` names a depth in the chalk convention —
 * `1`, `2`, `3`; the names a `colorSystem` option takes are not read here —
 * and beats the terminal's own answer; `NO_COLOR` turns colour off and beats
 * `FORCE_COLOR`. `draws` is the depth that environment resolves to, so the
 * run can check it was given what it asked for. [LAW:one-source-of-truth]
 */
export const DEPTH_ENV: Record<Depth, { readonly set: Env; readonly drop: readonly string[]; readonly draws: ColorDepth | null }> = {
  truecolor: { set: { FORCE_COLOR: "3" }, drop: ["NO_COLOR"], draws: ColorDepth.TRUECOLOR },
  "256": { set: { FORCE_COLOR: "2" }, drop: ["NO_COLOR"], draws: ColorDepth.EIGHT_BIT },
  "16": { set: { FORCE_COLOR: "1" }, drop: ["NO_COLOR"], draws: ColorDepth.STANDARD },
  none: { set: { NO_COLOR: "1" }, drop: ["FORCE_COLOR"], draws: null },
};

/** `env` as a terminal drawing at `depth` would present it. */
export function envAtDepth(env: Env, depth: Depth): Env {
  const { set, drop } = DEPTH_ENV[depth];
  return { ...Object.fromEntries(Object.entries(env).filter(([key]) => !drop.includes(key))), ...set };
}

/** The colour depth a console on `envAtDepth(env, depth)` draws at. */
export function depthDrawn(depth: Depth): ColorDepth | null {
  return DEPTH_ENV[depth].draws;
}
