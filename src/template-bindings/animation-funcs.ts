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
 * [LAW:single-enforcer] `drawn` is the one place the time, the timeline
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
 * template while it moves and not after — and says it only for what the
 * output depends on. A number or a colour has no cells to carry a hold, and
 * a fragment's cells lose theirs the moment it is flattened (`printf "%s"`),
 * so no function stamps cells or tells the frame itself. Each marks its
 * return with the hold its value is in (`marked`, the engine's evaluation
 * provenance), and the engine carries the mark beside the value into every
 * variable, dot and function the value passes through, reporting it where
 * the output depends on it. `emitted` is where a template's cells take a
 * hold: every fragment the template emits, stamped with the holds of the
 * marked values its action read. `decided` is the route for a hold no cell
 * can carry: a mark an `if`/`with`/`range` consumed is told to the frame
 * (`TemplateFrame.onHold`), whichever arm was taken, because the frame may
 * show cells for it later and must say when without a cell to say it on, as
 * a placed animation of no cells does (`placed`). A mark bound somewhere
 * nobody reads is reported nowhere, so a value a template computes and never
 * draws or decides on tells the frame nothing (rich-animation-27tq.0gd).
 * Early, never late: an emission may carry a hold it did not strictly need,
 * and a hold the output depends on is never dropped. [LAW:single-enforcer]
 */

import { marked, type EngineConfig, type TemplateFunc } from "@promptctl/go-template-js";
import { Animation, frameTimeOf, holdOf, shownAt, stamp } from "../core/animation.js";
import { Phase, beat, finiteTime, parseEase } from "../core/easing.js";
import type { RenderOptions } from "../core/protocol.js";
import { layerStyle, type Hold } from "../core/style.js";
import type { RichText } from "../core/text.js";
import { Timeline } from "../core/timeline.js";
import { tween } from "../core/tween.js";
import { cellSeed } from "../renderables/effect.js";
import type { EffectTarget } from "../renderables/effects.js";
import { reglyphText, type GlyphEffect } from "../renderables/glyph-effect.js";
import { GLYPH_EFFECT_CATALOGUE, type GlyphLoopName, type GlyphTransitionName } from "../renderables/glyph-effects.js";
import { FrameSequence, type Frame } from "../renderables/frames.js";
import { asColor } from "./color-funcs.js";
import { asFragment } from "./helpers.js";

/** What a registration is drawn on, beside the frame each evaluation is handed. */
export interface AnimationFuncsOptions {
  /** The timeline to draw on, read once per call; the frame's own time when omitted. */
  readonly timeline?: () => Timeline;
}

/**
 * The frame a template is evaluated for, in the fields a render's options
 * carry under the same names: `time` in seconds, `onHold`, told the hold of
 * an animated value the template decided on but drew no cell for, and the
 * reader's preferences — `reducedMotion`, and `asciiOnly`, which the glyphs
 * an effect picks for itself go through. They arrive with every frame and
 * nowhere else, so a template drawn in an `App` is drawn as the app's
 * preferences say. [LAW:one-source-of-truth]
 *
 * `time` is on the clock `AnimationFuncsOptions.timeline` maps from, and
 * `onHold` hears on that clock. A host outside rich-js hands its own clock's
 * time. Inside a rich-js frame the time is the frame's, which its host's
 * timeline has already mapped, so a template drawn there registers no
 * `timeline` and is handed `templateFrame(options)`.
 */
export interface TemplateFrame extends Pick<RenderOptions, "onHold" | "reducedMotion" | "asciiOnly"> {
  readonly time: number;
}

/** The frame a renderable is drawn in, as the frame a template it evaluates there is drawn for. */
export function templateFrame(options: RenderOptions): TemplateFrame {
  return { time: frameTimeOf(options), onHold: options.onHold, reducedMotion: options.reducedMotion, asciiOnly: options.asciiOnly };
}

/**
 * What `animationFuncs` registers: its functions, and the two engine hooks
 * their holds reach the frame through — `funcs`, which merges into the
 * engine's `funcs` (`frames`, `stepped`, `tween`, `loop` and `glyphs`);
 * `emitted`, every fragment the template emits stamped with the holds of
 * the animated values its action read; and `decided`, the holds a decision
 * read told to the frame they were drawn for, whichever arm it took. One
 * value, so the hooks travel with the functions they report for, and the
 * engine's own `EngineConfig` fields of those names, so a hook's signature
 * is written once. [LAW:types-are-the-program] [LAW:one-source-of-truth]
 */
export type AnimationFuncs = Required<Pick<EngineConfig<RichText>, "funcs" | "emitted" | "decided">>;

/**
 * The mark a function puts on its return: the hold its value is in, and the
 * frame it was drawn for, which is the one `decided` tells. Only the two
 * hooks here read one; a consumer's own marks pass through them untouched,
 * and a foreign token shaped like a `Hold` is not one.
 * [LAW:types-are-the-program]
 */
class HoldMark {
  constructor(
    readonly hold: Hold,
    readonly frame: TemplateFrame,
  ) {}
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
 * seconds, from whatever zero the host counts from — through
 * `options.timeline`, and each marking its return with the hold it is in
 * there, which the returned `emitted` and `decided` hooks carry to the
 * cells and the frame. The functions exist whatever `frame` returns, so a
 * template compiles once and is evaluated at every moment the host draws.
 * In a frame that says `reducedMotion` each draws its animation reduced
 * (`Animation.reduced`): a loop at its start, a one-shot cut from where it
 * starts to where it arrives when it starts.
 */
export function animationFuncs(frame: () => TemplateFrame, options: AnimationFuncsOptions = {}): AnimationFuncs {
  const timeline = options.timeline ?? (() => HOST_CLOCK);
  // What `animation`, on this call's timeline, shows in the frame `at`,
  // under the reader's preference, with the mark saying how long for: the
  // time is read once a call so a value and its hold are one frame's.
  const drawn = <T>(what: string, animation: Animation<T>, at: TemplateFrame): { value: T; mark: HoldMark } => {
    const t = finiteTime(what, at.time);
    const shown = shownAt(Timeline.run(timeline(), animation), t, at);
    return { value: shown.value, mark: new HoldMark(holdOf(shown, t), at) };
  };
  const startedAt = <T>(start: number, animation: Animation<T>): Animation<T> => Timeline.run(Timeline.play(start), animation);

  const framesFunc: TemplateFunc = {
    fn: ((...tail: unknown[]) => {
      const frames: Frame[] = pairs("frame", tail, asFragment).map(({ seconds, value }) => ({ seconds, text: value }));
      const { value, mark } = drawn("frames", new FrameSequence(frames), frame());
      return marked(value, mark);
    }) as TemplateFunc["fn"],
    argTypes: ["float", "liftable"],
    arity: { kind: "alternating", minimum: 2 },
    returnType: "T",
  };
  const steppedFunc: TemplateFunc = {
    fn: ((...tail: unknown[]) => {
      const steps = pairs("color", tail, (v) => asColor(v as string, "stepped"));
      const { value: step, mark } = drawn("stepped", beat(steps.map((s) => s.seconds)), frame());
      return marked(steps[step]!.value.hex, mark);
    }) as TemplateFunc["fn"],
    argTypes: ["float", "string"],
    arity: { kind: "alternating", minimum: 2 },
    returnType: "string",
  };
  const tweenFunc: TemplateFunc = {
    fn: ((seconds: number, ease: string, start: number, from: number, to: number) => {
      const { value, mark } = drawn("tween", startedAt(start, tween(from, to, { seconds, ease: parseEase(ease) })), frame());
      return marked(value, mark);
    }) as TemplateFunc["fn"],
    argTypes: ["float", "string", "float", "float", "float"],
    arity: { kind: "exact" },
    returnType: "float",
  };
  const loopFunc: TemplateFunc = {
    fn: ((seconds: number, start: number) => {
      const { value, mark } = drawn("loop", startedAt(start, Animation.continuous(Phase.loop(seconds))), frame());
      return marked(value, mark);
    }) as TemplateFunc["fn"],
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
      const at = frame();
      const reglyphed = reglyphText(fragment, make({ z: cellSeed(key, 0, 0) }), { key, asciiOnly: at.asciiOnly === true });
      const { value, mark } = drawn("glyphs", startedAt(start, reglyphed), at);
      return marked(value, mark);
    }) as TemplateFunc["fn"],
    argTypes: ["string", "float", "liftable"],
    arity: { kind: "exact" },
    returnType: "T",
  };

  // The holds among `marks` layered onto the fragment's base style, which an
  // empty text still draws as its one piece of no width: `Style.add` keeps
  // the later `lastChange` and the sooner `nextChange`, so cells that read
  // two animated values are in the intersection of their holds, as two
  // styles laid together are anywhere. On a copy, since the engine may hand
  // the one fragment a scope holds to more than one emission.
  const emitted = (fragment: RichText, marks: ReadonlySet<unknown>): RichText => {
    const result = fragment.copy();
    let style = fragment.style;
    for (const mark of marks) {
      if (mark instanceof HoldMark) style = layerStyle(style, stamp(mark.hold));
    }
    result.style = style;
    return result;
  };
  const decided = (marks: ReadonlySet<unknown>): void => {
    for (const mark of marks) {
      if (mark instanceof HoldMark) mark.frame.onHold?.(mark.hold);
    }
  };
  return { funcs: { frames: framesFunc, stepped: steppedFunc, tween: tweenFunc, loop: loopFunc, glyphs: glyphsFunc }, emitted, decided };
}
