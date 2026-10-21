/**
 * Animation registrations for the rich-js template binding: what a template
 * draws for the moment it is evaluated at.
 *
 * A host that builds its cells in templates — cc-candybar's statusline, say —
 * evaluates each template once per redraw and owns the clock that says when
 * that is. So the frame is a capability the registration takes, the way
 * `richTextFuncs(drawnAt)` takes the drawn depth: `frame()` is read once per
 * call, when the template is evaluated, and nothing here reads a clock.
 * [LAW:no-ambient-temporal-coupling] A host hands in the same `t` and gets
 * the same fragment back; a host that redraws once a second or sixty times
 * a second registers the same functions.
 *
 * Every function draws its animation on a `Timeline` (`../core/timeline.ts`)
 * the host hands in as a getter beside the time — playing from host time 0
 * at rate 1, the host's own clock, when it hands none — so a daemon pauses,
 * reverses, scrubs or speeds one session's animations by changing one value
 * it holds, with nothing recompiled, as `paletteFuncs` follows a theme
 * through its getter. The timeline is a map the drawing runs through, not a
 * number the time is turned into first: a frame's stamp says when it changes
 * on the host's clock, which only `Timeline.run` can carry it back onto —
 * paused, never; backwards, at the hold it is about to drop under.
 * [LAW:single-enforcer] `drawing` is the one place the time, the timeline
 * and the reader's preference for motion are read, for every function.
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
 *
 * The rest start at a moment the template names, on the timeline's clock —
 * a field of the host's state, the moment a value changed — and each is the
 * animation `Timeline.play(start)` runs, so a start is a timeline like any
 * other and nothing here offsets a time by hand. `tween <seconds> <ease>
 * <start> <from> <to>` is a number eased from one value to another and held
 * (`core/tween.ts`), its ease spelled by name (`parseEase`); `loop <seconds>
 * <start>` is the way through a period, 0 to 1 and round again — two
 * cells started a step apart are a stagger. Each is a number, so it goes
 * wherever a number goes: a colour tween is `ramp (tween …) "linear" 0 $from
 * 1 $to` and a ramp scrolling is `ramp (loop …) …`, because `ColorRamp` is
 * the one place two colours are blended and a colour tween is a two-stop
 * ramp read over time (`ColorRamp.over`). [LAW:one-source-of-truth] A
 * second blender here would be a second answer to what lies between two
 * colours. `glyphs <name> <start> <fragment>` is the fragment through a
 * glyph effect from the catalogue (`GLYPH_EFFECT_CATALOGUE`), at its
 * defaults, before any render (`reglyphText`). Every argument list is an
 * exact arity of typed slots, so a slot of the wrong kind fails at the gate.
 *
 * Every function says when what it drew changes, so a host paints a
 * template while it moves and not after. `frames` and `glyphs` stamp the
 * fragment they draw (`textFrameAt`), covering its own glyphs. A number or a
 * colour carries no cells to stamp, so `tween`, `loop` and `stepped` tell
 * their hold to the frame instead (`TemplateFrame.onHold`), as a placed
 * animation of no cells does (`RenderOptions.onHold`). Nothing here claims
 * a moment it does not know.
 */

import type { FuncMap, TemplateFunc } from "@promptctl/go-template-js";
import { Animation, holdOf, shownAt } from "../core/animation.js";
import { Phase, beat, finiteTime, parseEase } from "../core/easing.js";
import type { RenderOptions } from "../core/protocol.js";
import type { Hold } from "../core/style.js";
import { Timeline } from "../core/timeline.js";
import { tween } from "../core/tween.js";
import { cellSeed } from "../renderables/effect.js";
import type { EffectTarget } from "../renderables/effects.js";
import { reglyphText, type GlyphEffect } from "../renderables/glyph-effect.js";
import { GLYPH_EFFECT_CATALOGUE, type GlyphLoopName, type GlyphTransitionName } from "../renderables/glyph-effects.js";
import { FrameSequence, textFrameAt, type Frame } from "../renderables/frames.js";
import { asColor } from "./color-funcs.js";
import { asFragment } from "./helpers.js";

/**
 * What a template cannot read off render options it never sees, handed in
 * beside its time: the reader's preference for motion, whether the output
 * draws ASCII alone — a glyph effect's own glyphs go through `drawable`
 * against it — and the timeline every function is drawn on.
 */
export interface AnimationFuncsOptions extends Pick<RenderOptions, "reducedMotion" | "asciiOnly"> {
  /** The timeline to draw on, read once per call; the host's own clock when omitted. */
  readonly timeline?: () => Timeline;
}

/**
 * The frame a template is evaluated for: `time`, in seconds on the host's
 * clock, and `onHold`, told when what a function drew there changes on that
 * clock — the two fields a render's options carry under those names
 * (`RenderOptions.frame`, `RenderOptions.onHold`), so a renderable evaluating
 * a template hands on the frame it is drawn in.
 */
export interface TemplateFrame {
  readonly time: number;
  readonly onHold?: (hold: Hold) => void;
}

/** The host's own clock as a timeline: host time 0 at animation time 0, at rate 1. */
const HOST_CLOCK = Timeline.play(0);

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
 * Every glyph effect in the catalogue by the name a template spells it
 * with, a transition as the effect it runs. [LAW:types-are-the-program]
 * Keyed by both name types, so a name added to the catalogue does not
 * compile until it is spelled here too.
 */
const GLYPH_EFFECTS: Readonly<Record<GlyphLoopName | GlyphTransitionName, (element: EffectTarget) => GlyphEffect>> = {
  ...GLYPH_EFFECT_CATALOGUE.loops,
  typewriter: (element) => GLYPH_EFFECT_CATALOGUE.transitions.typewriter(element).effect,
  scramble: (element) => GLYPH_EFFECT_CATALOGUE.transitions.scramble(element).effect,
  backspace: (element) => GLYPH_EFFECT_CATALOGUE.transitions.backspace(element).effect,
  scrambleOut: (element) => GLYPH_EFFECT_CATALOGUE.transitions.scrambleOut(element).effect,
};

/**
 * The gate a spelled glyph effect crosses: the name in, the effect's maker
 * out, or a refusal naming every legal one. [LAW:parse-dont-validate]
 */
function glyphEffect(name: string): (element: EffectTarget) => GlyphEffect {
  if (!Object.hasOwn(GLYPH_EFFECTS, name)) {
    throw new RangeError(`unknown glyph effect ${JSON.stringify(name)}; expected one of ${Object.keys(GLYPH_EFFECTS).map((n) => JSON.stringify(n)).join(", ")}`);
  }
  return GLYPH_EFFECTS[name as keyof typeof GLYPH_EFFECTS];
}

/**
 * Register `frames`, `stepped`, `tween`, `loop` and `glyphs`, each drawn for
 * the frame `frame` reports when the template is evaluated — its time in
 * seconds on the host's own clock, from whatever zero it counts from —
 * through `options.timeline`, and each telling that frame when what it drew
 * changes. The functions exist whatever `frame` returns, so a template
 * compiles once and is evaluated at every moment the host draws.
 * Under `options.reducedMotion` each draws its animation reduced
 * (`Animation.reduced`): a loop at its start, a one-shot cut from where it
 * starts to where it arrives when it starts.
 */
export function animationFuncs(frame: () => TemplateFrame, options: AnimationFuncsOptions = {}): FuncMap {
  const timeline = options.timeline ?? (() => HOST_CLOCK);
  // `animation` on this call's timeline, and the host time it is drawn at.
  const drawing = <T>(what: string, animation: Animation<T>): [Animation<T>, number] => [Timeline.run(timeline(), animation), finiteTime(what, frame().time)];
  // What a value animation shows now, under the reader's preference, its
  // hold told to the frame: a value has no cells to carry it.
  const now = <T>(what: string, animation: Animation<T>): T => {
    const [drawn, t] = drawing(what, animation);
    const shown = shownAt(drawn, t, options);
    frame().onHold?.(holdOf(shown, t));
    return shown.value;
  };
  const startedAt = <T>(start: number, animation: Animation<T>): Animation<T> => Timeline.run(Timeline.play(start), animation);

  const framesFunc: TemplateFunc = {
    fn: ((...tail: unknown[]) => {
      const frames: Frame[] = pairs("frame", tail, asFragment).map(({ seconds, value }) => ({ seconds, text: value }));
      return textFrameAt(...drawing("frames", new FrameSequence(frames)), options);
    }) as TemplateFunc["fn"],
    argTypes: ["float", "liftable"],
    arity: { kind: "alternating", minimum: 2 },
    returnType: "T",
  };
  const steppedFunc: TemplateFunc = {
    fn: ((...tail: unknown[]) => {
      const steps = pairs("color", tail, (v) => asColor(v as string, "stepped"));
      return steps[now("stepped", beat(steps.map((step) => step.seconds)))]!.value.hex;
    }) as TemplateFunc["fn"],
    argTypes: ["float", "string"],
    arity: { kind: "alternating", minimum: 2 },
    returnType: "string",
  };
  const tweenFunc: TemplateFunc = {
    fn: ((seconds: number, ease: string, start: number, from: number, to: number) =>
      now("tween", startedAt(start, tween(from, to, { seconds, ease: parseEase(ease) })))) as TemplateFunc["fn"],
    argTypes: ["float", "string", "float", "float", "float"],
    arity: { kind: "exact" },
    returnType: "float",
  };
  const loopFunc: TemplateFunc = {
    fn: ((seconds: number, start: number) => now("loop", startedAt(start, Animation.continuous(Phase.loop(seconds))))) as TemplateFunc["fn"],
    argTypes: ["float", "float"],
    arity: { kind: "exact" },
    returnType: "float",
  };
  const glyphsFunc: TemplateFunc = {
    fn: ((name: string, start: number, child: unknown) => {
      const make = glyphEffect(name);
      const fragment = asFragment(child);
      // One text, one seed: the element is named by what it says.
      const key = fragment.plain;
      const reglyphed = reglyphText(fragment, make({ z: cellSeed(key, 0, 0) }), { key, asciiOnly: options.asciiOnly === true });
      return textFrameAt(...drawing("glyphs", startedAt(start, reglyphed)), options);
    }) as TemplateFunc["fn"],
    argTypes: ["string", "float", "liftable"],
    arity: { kind: "exact" },
    returnType: "T",
  };
  return { frames: framesFunc, stepped: steppedFunc, tween: tweenFunc, loop: loopFunc, glyphs: glyphsFunc };
}
