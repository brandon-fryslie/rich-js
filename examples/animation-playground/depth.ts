/**
 * The color depths the playground can ask its terminal for.
 *
 * THIS IS A DEMO (`examples/animation-playground/`). An `App` takes its
 * colors from its host's environment, deliberately, so a depth here is the
 * `FORCE_COLOR` / `NO_COLOR` overlay color detection reads, laid over the
 * host's own environment. Each step draws a different encoding: `38;2;`,
 * `38;5;`, the sixteen plain SGR colors, and none.
 *
 * [LAW:one-source-of-truth] `DEPTHS` is the one list. The depth a run starts
 * on is not a second answer: it is the step whose overlay detection reads as
 * the same depth as the host's environment untouched.
 */
import { detectColorSystem, type Env } from "@promptctl/rich-js";
import type { TerminalHost } from "@promptctl/rich-js/host";

export const DEPTHS = {
  truecolor: { FORCE_COLOR: "3", NO_COLOR: undefined },
  "256 colors": { FORCE_COLOR: "2", NO_COLOR: undefined },
  "16 colors": { FORCE_COLOR: "1", NO_COLOR: undefined },
  "no color": { NO_COLOR: "1" },
} as const satisfies Record<string, Env>;
export type Depth = keyof typeof DEPTHS;
const ORDER = Object.keys(DEPTHS) as Depth[];

const detected = (host: TerminalHost, env: Env) => detectColorSystem({ env, isTTY: host.writesToTerminal });

/** The depth `host`'s own environment gives, named as one of `DEPTHS`. */
export function hostDepth(host: TerminalHost): Depth {
  const own = detected(host, host.env);
  return ORDER.find((depth) => detected(host, { ...host.env, ...DEPTHS[depth] }) === own)!;
}

/** The step after `depth`, round the list. */
export const nextDepth = (depth: Depth): Depth => ORDER[(ORDER.indexOf(depth) + 1) % ORDER.length]!;

/** `host`, its environment saying `depth`: everything else is the host's own. */
export function atDepth(host: TerminalHost, depth: Depth): TerminalHost {
  const env: Env = { ...host.env, ...DEPTHS[depth] };
  return {
    env,
    get isTTY() {
      return host.isTTY;
    },
    get writesToTerminal() {
      return host.writesToTerminal;
    },
    get inputChunks() {
      return host.inputChunks;
    },
    write: (data) => host.write(data),
    onData: (handler) => host.onData(handler),
    onResize: (handler) => host.onResize(handler),
    size: () => host.size(),
    setRawMode: (raw) => host.setRawMode(raw),
    passWheel: (lines) => host.passWheel(lines),
    onExit: (handler) => host.onExit(handler),
    suspend: () => host.suspend(),
    start: () => host.start(),
    stop: () => host.stop(),
  };
}
