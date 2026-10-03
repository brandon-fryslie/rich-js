/**
 * effects-feel — the command line, parsed into the settings a run is judged
 * under. [LAW:parse-dont-validate] Every flag crosses here once and comes out
 * typed: an ease as its function, a depth as the environment that makes a
 * console draw at it. A flag this does not know, or a value out of range,
 * stops the demo with a message naming it. [LAW:no-silent-failure]
 */

import { parseArgs, type ParseArgsConfig } from "node:util";
import { EASES, parseEase, type Env } from "../../src/index.js";
import type { Curve } from "./curves.js";

type EaseName = keyof typeof EASES;

/** The colour depths a run can be judged at, by the name the flag takes. */
export const DEPTHS = ["truecolor", "256", "16", "none"] as const;
export type Depth = (typeof DEPTHS)[number];

export const GROUNDS = ["dark", "light"] as const;
export type Ground = (typeof GROUNDS)[number];

/** The effects a run shows, in the order it shows them. */
export const EFFECTS = ["shimmer", "pulse", "drift", "sparkle", "fade", "dissolve"] as const;
export type EffectName = (typeof EFFECTS)[number];

/** A curve as the flags spelled it, so the screen can say what is running. */
export interface NamedCurve extends Curve {
  readonly easeName: EaseName;
}

export interface Settings {
  readonly fps: number;
  readonly depth: Depth;
  readonly ground: Ground;
  readonly curves: Readonly<Record<EffectName, NamedCurve>>;
}

/** Each effect's defaults: the starting point for the sign-off, nothing more. */
const DEFAULTS: Record<EffectName, { seconds: number; ease: EaseName; swing: number; unit: string }> = {
  shimmer: { seconds: 2.5, ease: "sine", swing: 0.5, unit: "mix toward the highlight, 0–1" },
  pulse: { seconds: 3, ease: "sine", swing: 0.12, unit: "OKLCH lightness at the peak, 0–1" },
  drift: { seconds: 8, ease: "sine", swing: 40, unit: "degrees of hue at the peak" },
  sparkle: { seconds: 2, ease: "ease-in", swing: 0.2, unit: "OKLCH lightness at the peak, 0–1" },
  fade: { seconds: 2, ease: "ease-out", swing: 1, unit: "how hidden at the start, 0–1" },
  dissolve: { seconds: 3, ease: "linear", swing: 1, unit: "how hidden once gone, 0–1" },
};

const FPS_RANGE = [0.5, 30] as const;

/**
 * How a terminal says it draws each depth, as the environment colour
 * detection reads: `FORCE_COLOR` names a depth and beats the terminal's own
 * answer; `NO_COLOR` turns colour off and beats `FORCE_COLOR`.
 */
const DEPTH_ENV: Record<Depth, { readonly set: Env; readonly drop: readonly string[] }> = {
  truecolor: { set: { FORCE_COLOR: "truecolor" }, drop: ["NO_COLOR"] },
  "256": { set: { FORCE_COLOR: "256" }, drop: ["NO_COLOR"] },
  "16": { set: { FORCE_COLOR: "ansi" }, drop: ["NO_COLOR"] },
  none: { set: { NO_COLOR: "1" }, drop: ["FORCE_COLOR"] },
};

/** `env` as a terminal drawing at `depth` would present it. */
export function envAtDepth(env: Env, depth: Depth): Env {
  const { set, drop } = DEPTH_ENV[depth];
  return { ...Object.fromEntries(Object.entries(env).filter(([key]) => !drop.includes(key))), ...set };
}

const curveFlags = EFFECTS.flatMap((effect) => [`${effect}-${secondsWord(effect)}`, `${effect}-ease`, `${effect}-swing`]);

function secondsWord(effect: EffectName): "period" | "duration" {
  return effect === "fade" || effect === "dissolve" ? "duration" : "period";
}

export const USAGE = [
  "npm run effects-feel -- [flags]",
  "",
  `  --fps <n>`.padEnd(29) + `frames a second, ${FPS_RANGE[0]}–${FPS_RANGE[1]} (default 1)`,
  `  --depth <d>`.padEnd(29) + `${DEPTHS.join(" | ")} (default truecolor)`,
  `  --ground <g>`.padEnd(29) + `${GROUNDS.join(" | ")} (default dark)`,
  "",
  ...EFFECTS.flatMap((effect) => {
    const d = DEFAULTS[effect];
    const word = secondsWord(effect);
    return [
      `  --${effect}-${word} <s>`.padEnd(29) + `seconds (default ${d.seconds})`,
      `  --${effect}-ease <name>`.padEnd(29) + `(default ${d.ease})`,
      `  --${effect}-swing <n>`.padEnd(29) + `${d.unit} (default ${d.swing})`,
    ];
  }),
  "",
  `  eases: ${Object.keys(EASES).join(", ")}`,
  "",
  "  keys: f replays the fade-in, d replays the dissolve, q or Ctrl-C quits",
].join("\n");

/** `undefined` is `--help`; anything else is a run's settings. */
export function parseSettings(argv: readonly string[]): Settings | undefined {
  const options: NonNullable<ParseArgsConfig["options"]> = {
    help: { type: "boolean", short: "h" },
    ...Object.fromEntries(["fps", "depth", "ground", ...curveFlags].map((flag) => [flag, { type: "string" as const }])),
  };
  const { values } = parseArgs({ args: [...argv], strict: true, allowPositionals: false, options });
  if (values["help"] === true) return undefined;
  const flag = (name: string): string | undefined => {
    const value = values[name];
    return typeof value === "string" ? value : undefined;
  };

  const curves = Object.fromEntries(
    EFFECTS.map((effect) => {
      const d = DEFAULTS[effect];
      const easeName = oneOf(`--${effect}-ease`, flag(`${effect}-ease`) ?? d.ease, Object.keys(EASES) as EaseName[]);
      const curve: NamedCurve = {
        seconds: number(`--${effect}-${secondsWord(effect)}`, flag(`${effect}-${secondsWord(effect)}`), d.seconds, [0.05, 600]),
        ease: parseEase(easeName),
        easeName,
        swing: number(`--${effect}-swing`, flag(`${effect}-swing`), d.swing, effect === "drift" ? [-360, 360] : [0, 1]),
      };
      return [effect, curve];
    }),
  ) as Record<EffectName, NamedCurve>;

  return {
    fps: number("--fps", flag("fps"), 1, FPS_RANGE),
    depth: oneOf("--depth", flag("depth") ?? "truecolor", DEPTHS),
    ground: oneOf("--ground", flag("ground") ?? "dark", GROUNDS),
    curves,
  };
}

function number(name: string, raw: string | undefined, fallback: number, [lo, hi]: readonly [number, number]): number {
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(value) || value < lo || value > hi) {
    throw new RangeError(`${name} must be a number from ${lo} to ${hi}, got ${JSON.stringify(raw)}`);
  }
  return value;
}

function oneOf<T extends string>(name: string, raw: string, legal: readonly T[]): T {
  if (!(legal as readonly string[]).includes(raw)) {
    throw new RangeError(`${name} must be one of ${legal.join(", ")}, got ${JSON.stringify(raw)}`);
  }
  return raw as T;
}
