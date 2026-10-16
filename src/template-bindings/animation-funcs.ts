/**
 * Animation registrations for the rich-js template binding: what a template
 * draws for the moment it is evaluated at.
 *
 * A host that builds its cells in templates — cc-candybar's statusline, say —
 * evaluates each template once per redraw and owns the clock that says when
 * that is. So the time is a capability the registration takes, the way
 * `richTextFuncs(drawnAt)` takes the drawn depth: `frameTime()` is read once
 * per call, when the template is evaluated, and nothing here reads a clock.
 * [LAW:no-ambient-temporal-coupling] A host hands in the same `t` and gets
 * the same fragment back; a host that redraws once a second or sixty times
 * a second registers the same functions.
 *
 * `frames <seconds> <frame> <seconds> <frame> …` is `Frames`
 * (`renderables/frames.ts`) in a template: the frame in progress at the
 * moment, as a fragment at the width of the widest. The argument list is one
 * float/fragment cycle end to end, so the engine's `alternating` gate types
 * every slot and lifts each string frame to a fragment; the pairing — a
 * trailing hold with no frame — is parsed in `framePairs`, once.
 * [LAW:types-are-the-program]
 */

import type { FuncMap, TemplateFunc } from "@promptctl/go-template-js";
import { Frames, type Frame } from "../renderables/frames.js";
import { asFragment } from "./helpers.js";

/**
 * The `(seconds, frame)` pairs a `frames` call spells, as frames. The gate has
 * typed every even slot as a float and lifted every odd one; what it cannot
 * see is the pairing, settled here. [LAW:parse-dont-validate] `Frames`
 * receives frames it never re-checks, and refuses a hold that is not a
 * positive number of seconds itself.
 */
function framePairs(tail: readonly unknown[]): Frame[] {
  if (tail.length % 2 !== 0) {
    throw new RangeError(
      `frames' last hold (${String(tail[tail.length - 1])} s) has no frame — frames are <seconds> <frame> pairs`,
    );
  }
  const frames: Frame[] = [];
  for (let i = 0; i < tail.length; i += 2) {
    frames.push({ seconds: tail[i] as number, text: asFragment(tail[i + 1]) });
  }
  return frames;
}

/**
 * Register `frames`, drawn for the moment `frameTime` reports when the
 * template is evaluated: seconds on the host's own timeline, from whatever
 * zero it counts from. The function exists whatever `frameTime` returns, so
 * a template compiles once and is evaluated at every moment the host draws.
 */
export function animationFuncs(frameTime: () => number): FuncMap {
  const framesFunc: TemplateFunc = {
    fn: ((...tail: unknown[]) => new Frames(framePairs(tail), { t: frameTime() }).text()) as TemplateFunc["fn"],
    argTypes: ["float", "liftable"],
    arity: { kind: "alternating", minimum: 2 },
    returnType: "T",
  };
  return { frames: framesFunc };
}
