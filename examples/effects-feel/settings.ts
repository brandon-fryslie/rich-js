/**
 * effects-feel — the command line, parsed into the settings a run is judged
 * under. [LAW:parse-dont-validate] Every flag crosses here once and comes out
 * typed: an ease as its function, a depth as the environment that makes a
 * console draw at it. A flag this does not know, or a value out of range,
 * stops the demo with a message naming it. [LAW:no-silent-failure]
 */

import { parseArgs, type ParseArgsConfig } from "node:util";
import { EASES, parseEase } from "../../src/index.js";
import type { Curve } from "./curves.js";
import { DEPTHS, EFFECTS, EFFECT_DEFAULTS, type Depth, type EffectName } from "./vocabulary.js";

export const GROUNDS = ["dark", "light"] as const;
export type Ground = (typeof GROUNDS)[number];

/** The effects a run shows, in the order it shows them. */

/** A curve as the flags spelled it, so the screen can say what is running. */
export interface NamedCurve extends Curve {
  readonly easeName: string;
}

export interface Settings {
  readonly fps: number;
  readonly depth: Depth;
  readonly ground: Ground;
  readonly curves: Readonly<Record<EffectName, NamedCurve>>;
}

const FPS_RANGE = [0.5, 30] as const;

const curveFlags = EFFECTS.flatMap((effect) => [`${effect}-${secondsWord(effect)}`, `${effect}-ease`, `${effect}-swing`]);

function secondsWord(effect: EffectName): "period" | "duration" {
  return effect === "fade" || effect === "dissolve" ? "duration" : "period";
}

export const USAGE = [
  "npm run effects-feel -- [flags]",
  "",
  `  --fps <n>`.padEnd(29) + `frames a second, ${FPS_RANGE[0]}–${FPS_RANGE[1]} (default 30; Claude Code draws at 1)`,
  `  --depth <d>`.padEnd(29) + `${DEPTHS.join(" | ")} (default truecolor)`,
  `  --ground <g>`.padEnd(29) + `${GROUNDS.join(" | ")} (default dark)`,
  "",
  ...EFFECTS.flatMap((effect) => {
    const d = EFFECT_DEFAULTS[effect];
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
  "  keys: f replays the fade-in, d replays the dissolve, n/p the next/previous theme,",
  "        < and > step the frame rate, - and + halve and double the rate,",
  "        [ and ] take a quarter off and add a quarter to the magnitude, every loop's swing, q or Ctrl-C quits",
  "  a frame is the unit of change: every frame moves every loop the same amount, whatever the",
  "  frame rate, and the rate scales that amount; the demo starts over after one cycle of frames",
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
      const d = EFFECT_DEFAULTS[effect];
      const easeName = flag(`${effect}-ease`) ?? d.ease;
      const curve: NamedCurve = {
        seconds: number(`--${effect}-${secondsWord(effect)}`, flag(`${effect}-${secondsWord(effect)}`), d.seconds, [0.05, 3600]),
        ease: named(`--${effect}-ease`, parseEase, easeName),
        easeName,
        swing: number(`--${effect}-swing`, flag(`${effect}-swing`), d.swing, [0, 1]),
      };
      return [effect, curve];
    }),
  ) as Record<EffectName, NamedCurve>;

  return {
    fps: number("--fps", flag("fps"), 30, FPS_RANGE),
    depth: oneOf("--depth", flag("depth") ?? "truecolor", DEPTHS),
    ground: oneOf("--ground", flag("ground") ?? "dark", GROUNDS),
    curves,
  };
}

/** A decimal as a person types one: `2`, `-90`, `0.5`, `.5`. */
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function number(name: string, raw: string | undefined, fallback: number, [lo, hi]: readonly [number, number]): number {
  // `Number` alone reads "" and " " as 0, and 0 is in range for every swing.
  const value = raw === undefined ? fallback : DECIMAL.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isFinite(value) || value < lo || value > hi) {
    throw new RangeError(`${name} must be a number from ${lo} to ${hi}, got ${JSON.stringify(raw)}`);
  }
  return value;
}

/** `parse` on a flag's value, its refusal prefixed with the flag's name. */
function named<T>(name: string, parse: (raw: string) => T, raw: string): T {
  try {
    return parse(raw);
  } catch (error) {
    throw new RangeError(`${name}: ${String(error)}`, { cause: error });
  }
}

function oneOf<T extends string>(name: string, raw: string, legal: readonly T[]): T {
  if (!(legal as readonly string[]).includes(raw)) {
    throw new RangeError(`${name} must be one of ${legal.join(", ")}, got ${JSON.stringify(raw)}`);
  }
  return raw as T;
}
