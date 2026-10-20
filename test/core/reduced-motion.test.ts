import { describe, expect, it } from "vitest";
import { Animation } from "../../src/core/animation.js";
import { ColorDepth, ColorRgba } from "../../src/core/color.js";
import { Console } from "../../src/core/console.js";
import { EASES, beat } from "../../src/core/easing.js";
import { render, type Renderable, type RenderOptions } from "../../src/core/protocol.js";
import { segmentsToString } from "../../src/core/render.js";
import { Segment } from "../../src/core/segment.js";
import { RichText } from "../../src/core/text.js";
import { Timeline } from "../../src/core/timeline.js";
import { tween } from "../../src/core/tween.js";
import { drawView, hostView, type View } from "../../src/core/view.js";
import { App } from "../../src/host/app.js";
import { frameRate } from "../../src/core/clock.js";
import { DEFAULT_TERMINAL_THEME } from "../../src/index.js";
import { crossfade } from "../../src/renderables/change.js";
import { Effected } from "../../src/renderables/effect.js";
import { dissolveOut, fadeIn, onColors, pulse } from "../../src/renderables/effects.js";
import { Frames, FrameSequence, frameAt } from "../../src/renderables/frames.js";
import { GlyphEffected } from "../../src/renderables/glyph-effect.js";
import { caseWave, particles, typewriter } from "../../src/renderables/glyph-effects.js";
import { Group } from "../../src/renderables/group.js";
import { lifecycle, throughColors } from "../../src/renderables/lifecycle.js";
import { Live } from "../../src/renderables/live.js";
import { scroll } from "../../src/renderables/scroll.js";
import { Spinner } from "../../src/renderables/spinner.js";
import { ColorRamp } from "../../src/themes/ramp.js";
import { animationFuncs, richTextFuncs } from "../../src/template-bindings/index.js";
import { createEngine } from "@promptctl/go-template-js";
import { renderToString } from "../../src/core/render.js";
import { fakeClock } from "./fake-clock.js";
import { scriptedHost } from "../host/scripted-host.js";

// [LAW:behavior-not-structure] What is asserted is what a reader sees and
// what a host does: the bytes drawn, and whether it is told to look again.

const theme = DEFAULT_TERMINAL_THEME;
const curve = { seconds: 2, ease: EASES.linear, swing: 1 };
const FULL: RenderOptions = { maxWidth: 40, colorSystem: ColorDepth.TRUECOLOR };
const REDUCED: RenderOptions = { ...FULL, reducedMotion: true };
const bytes = (renderable: Renderable, options: RenderOptions): string =>
  segmentsToString([...render(renderable, options)], { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true });
const plain = (renderable: Renderable, options: RenderOptions = FULL): string => [...render(renderable, options)].map((s) => s.text).join("");
const lines = (renderable: Renderable, options: RenderOptions): Segment[][] => Segment.splitLines([...render(renderable, options)]);

/** Host times sampled once a second and sixty times a second over ten seconds, and one far out. */
const SAMPLES = [...Array.from({ length: 11 }, (_, i) => i), ...Array.from({ length: 601 }, (_, i) => i / 60), 1e6];

const frames = (...shown: string[]): FrameSequence => new FrameSequence(shown.map((text) => ({ text: new RichText(text), seconds: 0.25 })));

/** `animation` reduced, sampled: its one value, the same at every time, and that it never says it changes. */
function still<T>(animation: Animation<T>): T {
  const reduced = animation.reduced();
  const value = reduced.at(0);
  for (const t of SAMPLES) {
    expect(reduced.at(t)).toEqual(value);
    expect(reduced.nextChange(t)).toBe(Number.POSITIVE_INFINITY);
  }
  return value;
}

describe("an animation reduced", () => {
  it("a loop holds its first value, a one-shot its end", () => {
    expect(still(Animation.constant("a"))).toBe("a");
    expect(still(Animation.continuous((t) => t + 1))).toBe(1);
    expect(still(beat([1, 2, 3]))).toBe(0);
    expect(still(frames("a", "b")).plain).toBe("a");
    expect(still(tween(0, 10, { seconds: 1, ease: EASES.linear }))).toBe(10);
    expect(still(Animation.map(tween(0, 4, { seconds: 1, ease: EASES.linear }), (v) => v * 2))).toBe(8);
    expect(still(Animation.onBeat(Animation.continuous((t) => t), beat([0.5])))).toBe(0);
  });

  it("a sequence keeps each part on time, and wakes only at the switch", () => {
    const reduced = Animation.sequence(Animation.continuous((t) => `loading ${t}`), 2, Animation.constant("results")).reduced();
    expect([0, 1, 1.99, 2, 9].map((t) => reduced.at(t))).toEqual(["loading 0", "loading 0", "loading 0", "results", "results"]);
    expect([0, 1, 2, 9].map((t) => reduced.nextChange(t))).toEqual([2, 2, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]);
  });

  it("a one-shot cuts from its start to its end the moment it starts, and back again run backwards", () => {
    const reduced = tween(0, 10, { seconds: 1, ease: EASES.linear }).reduced();
    expect([-1, -0.01, 0, 0.5, 9].map((t) => reduced.at(t))).toEqual([0, 0, 10, 10, 10]);
    expect([-1, 0, 9].map((t) => reduced.nextChange(t))).toEqual([0, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]);
  });

  it("a timeline maps time and the motion stays gone, playing, reversed or paused", () => {
    const moving = tween(0, 10, { seconds: 1, ease: EASES.linear });
    for (const timeline of [Timeline.play(5), Timeline.play(0, -2), Timeline.pause(Timeline.play(0), 0.5)]) {
      const reduced = Timeline.run(timeline, moving).reduced();
      for (const host of SAMPLES) expect(reduced.at(host)).toBe(Timeline.at(timeline, host) < 0 ? 0 : 10);
    }
  });

  it("a stagger has every child arrived", () => {
    const arriving = Array.from({ length: 4 }, (_, i) => tween(0, i + 1, { seconds: 1, ease: EASES.linear }));
    expect(still(Timeline.stagger(arriving, 0.5))).toEqual([1, 2, 3, 4]);
  });

  it("a colour tween is its last stop", () => {
    const ramp = new ColorRamp(EASES.linear, [
      { at: 0, color: new ColorRgba(0, 0, 0) },
      { at: 1, color: new ColorRgba(255, 255, 255) },
    ]);
    expect(still(ramp.over(3)).hex).toBe("#ffffff");
  });

  it("a transition is its new state, an arrival arrived and an exit gone", () => {
    const building = new RichText("building", { end: "" });
    const done = new RichText("done", { end: "" });
    expect(still(crossfade(curve).effect({ from: building, to: done, theme }))).toBe(done);
    // A fade-in reduced is the element as drawn; a dissolve-out reduced is the ground.
    const word = new RichText("[#ff8800 on #202020]word[/]", { end: "" });
    expect(bytes(new Effected(word, fadeIn(curve, 0).effect, { t: 0, key: "w", theme }), REDUCED)).toBe(bytes(word, FULL));
    expect(bytes(new Effected(word, dissolveOut(curve, 0).effect, { t: 0, key: "w", theme }), REDUCED)).not.toBe(bytes(word, FULL));
    // A typewriter reduced has typed everything.
    const typed = new GlyphEffected(new RichText("hello world", { end: "" }), typewriter({ seconds: 2, ease: EASES.linear }).effect, { t: 0, key: "t" });
    expect(plain(typed, REDUCED)).toBe("hello world");
    expect(plain(typed, FULL)).not.toBe("hello world");
  });

  it("a glyph loop draws the text as written", () => {
    const text = new RichText("hello world", { end: "" });
    for (const effect of [caseWave({ step: 0.1, width: 3 }, 7), particles({ glyphs: "*", ascii: "*", density: 1, step: 0.2, drift: 1, life: Number.POSITIVE_INFINITY }, 3)]) {
      expect(plain(new GlyphEffected(text, effect, { t: 0.7, key: "g" }), REDUCED)).toBe("hello world");
    }
  });

  it("an element is there from when it entered until it is told to leave, with no arrival or exit, and wakes only for those", () => {
    const element = new RichText("line", { end: "" });
    const options = { enter: throughColors(fadeIn(curve, 0), theme), exit: throughColors(dissolveOut(curve, 0), theme), key: "line" };
    expect(still(lifecycle(element, options, -1))).toBe(element);
    const life = lifecycle(element, options, 2).leave(5);
    const reduced = life.reduced();
    expect([1, 2, 3, 4.99, 5, 9].map((t) => plain(reduced.at(t)))).toEqual(["", "line", "line", "line", "", ""]);
    // Gone once the exit would have ended, which a host is woken for, so it can drop the element then.
    expect([1, 2, 3].map((t) => reduced.nextChange(t))).toEqual([2, 5, 5]);
    const goneAt = reduced.nextChange(5);
    expect([life.gone(goneAt - 0.01), life.gone(goneAt)]).toEqual([false, true]);
    expect([goneAt, 9].map((t) => reduced.nextChange(t))).toEqual([Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]);
    expect(reduced.at(3)).toBe(element);
  });
});

/** Every kind of motion at once, as an animation a host draws. */
function everything(): Animation<Renderable> {
  const bar = Animation.map(tween(0, 20, { seconds: 3, ease: EASES.linear }), (w) => new RichText("#".repeat(Math.round(w)), { end: "" }));
  const marquee = scroll(new RichText("a long line that scrolls past", { end: "" }), { width: 10, height: 1, col: Animation.continuous((t) => (t * 4) % 20) });
  const change = Timeline.run(Timeline.play(0), crossfade(curve).effect({ from: new RichText("old", { end: "" }), to: new RichText("new", { end: "" }), theme }));
  const life = lifecycle(new RichText("arriving", { end: "" }), { enter: throughColors(fadeIn(curve, 0), theme), exit: throughColors(dissolveOut(curve, 0), theme), key: "l" }, 0);
  const cascade = Animation.map(Timeline.stagger([frames("1", "2"), frames("3", "4"), frames("5", "6")], 0.1), (shown) => new Group(...shown));
  return Animation.map(Animation.all([bar, marquee, change, life, cascade]), (parts) => new Group(...parts));
}

/** Every renderable built for the host's time, as a function view draws them. */
function builtForTheTime(t: number): Renderable {
  const glow = new ColorRgba(255, 255, 255);
  return new Group(
    new Effected(new RichText("[#5080ff]pulsing[/]", { end: "" }), onColors(pulse({ seconds: 2, ease: EASES.sine, swing: 1 }, glow, 0)), { t, key: "p", theme }),
    new GlyphEffected(new RichText("typing out", { end: "" }), typewriter({ seconds: 2, ease: EASES.linear }).effect, { t, key: "g" }),
    new Frames(frames("◐", "◓", "◑", "◒"), { t }),
    new Spinner("dots", "working").drawnAt(t),
    frameAt(lifecycle(new RichText("entering", { end: "" }), { enter: throughColors(fadeIn(curve, 0), theme), exit: throughColors(dissolveOut(curve, 0), theme), key: "e" }, 0), t),
  );
}

describe("a host under reduced motion", () => {
  const drawnAt = (view: View, options: RenderOptions, t: number, timeline = Timeline.play(0)) =>
    drawView(hostView(view), timeline, t, options, (renderable, under) => lines(renderable, under));
  const text = (drawn: { lines: Segment[][] }): string =>
    segmentsToString(drawn.lines.flat(), { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true });

  // An animation says itself every moment it changes, so reduced it is held; a
  // function computes from the time what no animation says, so it is not.
  it.each([
    ["an animation", everything(), true],
    ["a function of the time", builtForTheTime as View, false],
  ])("draws %s the same at every time, sampled once a second or sixty, and is never told to look again", (_, view, held) => {
    const first = text(drawnAt(view, REDUCED, 0));
    for (const t of SAMPLES) {
      const drawn = drawnAt(view, REDUCED, t);
      expect(text(drawn)).toBe(first);
      expect(drawn.nextChange).toBe(Number.POSITIVE_INFINITY);
      expect(drawn.held).toBe(held);
    }
    // The same view under full motion moves, so the sameness above is the preference's.
    expect(new Set(SAMPLES.map((t) => text(drawnAt(view, FULL, t)))).size).toBeGreaterThan(1);
    expect(drawnAt(view, FULL, 0.5).nextChange).toBe(0.5);
  });

  it("draws the reduced view at the time the timeline maps to, fast, reversed, paused or sought, and is never told to look again", () => {
    for (const timeline of [Timeline.play(0, 3), Timeline.play(0, -1), Timeline.pause(Timeline.play(0), 1.2), Timeline.seek(Timeline.play(0), 0, 7)]) {
      const drawn = drawnAt(everything(), REDUCED, 4, timeline);
      expect(text(drawn)).toBe(text(drawnAt(everything(), REDUCED, Timeline.at(timeline, 4))));
      expect(drawn.nextChange).toBe(Number.POSITIVE_INFINITY);
    }
  });

  it("a view reduced still shows and drops content on time, and wakes for exactly that", () => {
    const life = lifecycle(new RichText("toast", { end: "" }), { enter: throughColors(fadeIn(curve, 0), theme), exit: throughColors(dissolveOut(curve, 0), theme), key: "toast" }, 2).leave(5);
    expect([1, 3, 6].map((t) => text(drawnAt(life, REDUCED, t)).trim())).toEqual(["", "toast", ""]);
    expect([1, 3, 8].map((t) => drawnAt(life, REDUCED, t).nextChange)).toEqual([2, 5, Number.POSITIVE_INFINITY]);
  });

  it("a function view is asked at the time, so what it computes from it stays on time", () => {
    const elapsed = (t: number): Renderable => new RichText(`elapsed ${Math.floor(t)}s`, { end: "" });
    expect(text(drawnAt(elapsed, REDUCED, 3.5))).toBe("elapsed 3s");
  });

  it("a text frame the program splices itself is its own sample, and tells the host when it really changes", () => {
    // Not the host's time itself, which a host reads as moving every moment.
    const spliced = (t: number): Renderable => frameAt(frames("a", "b"), t);
    expect(drawnAt(spliced, REDUCED, 5).nextChange).toBe(5.25);
  });

  it("a renderable drawn as it is reduces every animation drawn inside it for the host's time", () => {
    const view = builtForTheTime(1.3);
    const drawn = drawnAt(view, REDUCED, 1.3);
    expect(drawn.nextChange).toBe(Number.POSITIVE_INFINITY);
    expect(text(drawn)).toBe(text(drawnAt(builtForTheTime(8.9), REDUCED, 8.9)));
  });

  it("a frame of no cells reduced says nothing, so a host holding it wakes for nothing", () => {
    const empty: Animation<Renderable> = { at: () => new Group(), nextChange: () => 3, lastChange: () => Number.NEGATIVE_INFINITY, reduced: () => Animation.constant<Renderable>(new Group()) };
    expect(Segment.nextChange([...render(frameAt(empty, 0), REDUCED)])).toBe(Number.POSITIVE_INFINITY);
    expect(Segment.nextChange([...render(frameAt(empty, 0), FULL)])).toBe(3);
  });

  it.each([1, 60])("an App told once paints an animation view reduced once at %s fps and arms nothing, an animate()d one included", (perSecond) => {
    const clock = fakeClock();
    const asked: string[] = [];
    const looping = Animation.continuous((t) => new RichText(`t=${t}`, { end: "" }));
    const view: Animation<Renderable> = {
      at: (t) => (asked.push(`at ${t}`), looping.at(t)),
      nextChange: (t) => looping.nextChange(t),
      lastChange: (t) => looping.lastChange(t),
      reduced: () => (asked.push("reduced"), looping.reduced()),
    };
    const target = new App({ host: scriptedHost(), surface: "alternate", clock, rate: frameRate(perSecond), view, reducedMotion: true });
    void target.run();
    target.animate();
    clock.advance(5);
    expect(asked).toEqual(["reduced"]);
    expect(clock.timers()).toBe(0);
    expect(target.frame.map((line) => line.map((s) => s.text).join(""))[0]).toBe("t=0");
  });

  /** A Live of `view` on a reduced-motion console at sixty frames a second, run for six seconds, and every frame it painted. */
  function liveFrames(view: View): string[] {
    const clock = fakeClock();
    const out: string[] = [];
    const console = new Console({ width: 20, height: 5, colorSystem: null, forceTerminal: true, file: { write: (s: string) => void out.push(s) }, reducedMotion: true });
    const display = new Live(view, { console, clock, refreshPerSecond: 60 });
    display.start();
    clock.advance(6);
    display.stop();
    return out.join("").split("\x1b[?2026h").slice(1);
  }

  it("a Live takes the preference from its console: a function view is still polled for its state, and shows only the reduced frame", () => {
    const painted = liveFrames((t: number) => new Spinner("dots", "working").drawnAt(t));
    expect(painted.length).toBeGreaterThan(60);
    // Every frame but the last, which stop() ends by handing the cursor back, is one picture.
    expect(new Set(painted.slice(0, -1)).size).toBe(1);
    expect(painted.at(-1)!.startsWith(painted[0]!)).toBe(true);
  });

  it("a Live of an animation under reduced motion paints it reduced and waits on nothing", () => {
    // The first frame and the one stop() draws.
    expect(liveFrames(new Spinner("dots", "working"))).toHaveLength(2);
  });
});

describe("a one-shot render under reduced motion", () => {
  it("draws a spinner's first frame at every moment", () => {
    const at = (t: number, reducedMotion: boolean): string => renderToString(new Spinner("dots", "working").drawnAt(t), { width: 20, reducedMotion });
    expect(new Set(SAMPLES.map((t) => at(t, true))).size).toBe(1);
    expect(new Set(SAMPLES.map((t) => at(t, false))).size).toBeGreaterThan(1);
  });
});

describe("the template animation functions under reduced motion", () => {
  it("refuse a time that is not finite, as they do with motion", () => {
    const funcs = animationFuncs(() => Number.NaN, { reducedMotion: true });
    const engine = createEngine<RichText>({ fromString: (s) => new RichText(s), toString: (rt) => rt.plain, funcs: { ...richTextFuncs(), ...funcs } });
    expect(() => engine.compile(`{{ frames 0.25 "a" 0.25 "b" }}`)({})).toThrow(/frames needs a finite t, got NaN/);
    expect(() => engine.compile(`{{ stepped 0.5 "#ff0000" 0.5 "#00ff00" }}`)({})).toThrow(/stepped needs a finite t, got NaN/);
  });

  it("draw the first frame and the first colour at every moment", () => {
    let frameTime = 0;
    const compiled = (reducedMotion: boolean) =>
      createEngine<RichText>({
        fromString: (s) => new RichText(s),
        toString: (rt) => rt.plain,
        funcs: { ...richTextFuncs(), ...animationFuncs(() => frameTime, { reducedMotion }) },
      }).compile(`{{ frames 0.25 "a" 0.25 "b" }}{{ fg (stepped 0.5 "#ff0000" 0.5 "#00ff00") "x" }}`);
    const [reduced, full] = [compiled(true), compiled(false)];
    const evaluate = (reducedMotion: boolean): string =>
      renderToString(RichText.fromFragments((reducedMotion ? reduced : full)({})), { width: 10, colorSystem: "truecolor" });
    const seen = new Set<string>();
    const moving = new Set<string>();
    for (const t of SAMPLES) {
      frameTime = t;
      seen.add(evaluate(true));
      moving.add(evaluate(false));
    }
    expect([...seen]).toHaveLength(1);
    expect(moving.size).toBeGreaterThan(1);
  });
});
