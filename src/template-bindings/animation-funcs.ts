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
 * `frames <seconds> <frame> <seconds> <frame> …` is a `FrameSequence`
 * (`renderables/frames.ts`) in a template: the frame in progress at the
 * moment, as a fragment at the width of the widest. Its frames arrive as
 * arguments on every evaluation, so the sequence is prepared on every one:
 * a template has nowhere to keep it, and keeping it here would be the memo
 * keyed on the arguments that `FrameSequence` is instead of. `stepped <seconds>
 * <color> <seconds> <color> …` is the colour in progress at the moment, a
 * colour value like every colour function's (`./color-funcs.ts`), so it
 * nests where a colour goes — `fg (stepped …)`, `readableOn (stepped …) $bg
 * 4.5` — and the ground it must read on is the template's to name, as it
 * is for any colour. Either argument list is one float/value cycle end to
 * end, so the engine's `alternating` gate types every slot and lifts each
 * string frame to a fragment; the pairing — a trailing hold with no frame or
 * colour — is parsed in `pairs`, once. [LAW:types-are-the-program]
 */

import type { FuncMap, TemplateFunc } from "@promptctl/go-template-js";
import { beat } from "../core/easing.js";
import type { Motion } from "../core/protocol.js";
import { shownAt } from "../core/view.js";
import { FrameSequence, textFrameAt, type Frame } from "../renderables/frames.js";
import { asColor } from "./color-funcs.js";
import { asFragment } from "./helpers.js";

/**
 * The `(seconds, value)` pairs a call spells, each value read through
 * `value`. The gate has typed every even slot as a float and every odd one
 * as `value`'s input; what it cannot see is the pairing, or that a hold is
 * a positive number of seconds: both settled here, under the engine's
 * "error calling <function>" and nothing else, since a template author
 * knows neither `FrameSequence` nor `beat`, which refuse the same hold in their
 * own names. [LAW:parse-dont-validate]
 */
function pairs<V>(what: string, tail: readonly unknown[], value: (v: unknown) => V): { seconds: number; value: V }[] {
  if (tail.length % 2 !== 0) {
    throw new RangeError(`last hold (${String(tail[tail.length - 1])} s) has no ${what} — the arguments are <seconds> <${what}> pairs`);
  }
  const paired: { seconds: number; value: V }[] = [];
  for (let i = 0; i < tail.length; i += 2) {
    const seconds = tail[i] as number;
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new RangeError(`hold ${i / 2} must be a positive number of seconds, got ${seconds}`);
    }
    paired.push({ seconds, value: value(tail[i + 1]) });
  }
  return paired;
}

/**
 * Register `frames` and `stepped`, each drawn for the moment `frameTime`
 * reports when the template is evaluated: seconds on the host's own
 * timeline, from whatever zero it counts from. The functions exist whatever
 * `frameTime` returns, so a template compiles once and is evaluated at every
 * moment the host draws. Under `motion.reducedMotion` each draws its rest —
 * the first frame, the first colour — at every moment, and a frame says it
 * never changes: a template has no render options, so the host hands the
 * reader's preference in here, beside its time.
 */
export function animationFuncs(frameTime: () => number, motion: Motion = {}): FuncMap {
  const framesFunc: TemplateFunc = {
    fn: ((...tail: unknown[]) => {
      const frames: Frame[] = pairs("frame", tail, asFragment).map(({ seconds, value }) => ({ seconds, text: value }));
      return textFrameAt(new FrameSequence(frames), frameTime(), motion);
    }) as TemplateFunc["fn"],
    argTypes: ["float", "liftable"],
    arity: { kind: "alternating", minimum: 2 },
    returnType: "T",
  };
  const steppedFunc: TemplateFunc = {
    fn: ((...tail: unknown[]) => {
      const steps = pairs("color", tail, (v) => asColor(v as string, "stepped"));
      return steps[shownAt(beat(steps.map((step) => step.seconds)), frameTime(), motion).value]!.value.hex;
    }) as TemplateFunc["fn"],
    argTypes: ["float", "string"],
    arity: { kind: "alternating", minimum: 2 },
    returnType: "string",
  };
  return { frames: framesFunc, stepped: steppedFunc };
}
