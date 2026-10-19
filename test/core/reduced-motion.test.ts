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
import { typewriter } from "../../src/renderables/glyph-effects.js";
import { Group } from "../../src/renderables/group.js";
import { lifecycle } from "../../src/renderables/lifecycle.js";
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

describe("an animation's rest", () => {
  it("a loop rests at its first value, a one-shot at its end", () => {
    expect(Animation.constant("a").rest()).toBe("a");
    expect(Animation.continuous((t) => t + 1).rest()).toBe(1);
    expect(beat([1, 2, 3]).rest()).toBe(0);
    expect(frames("a", "b").rest().plain).toBe("a");
    expect(tween(0, 10, { seconds: 1, ease: EASES.linear }).rest()).toBe(10);
    expect(Animation.sequence(Animation.continuous(() => "moving"), 2, Animation.constant("arrived")).rest()).toBe("arrived");
    expect(Animation.map(tween(0, 4, { seconds: 1, ease: EASES.linear }), (v) => v * 2).rest()).toBe(8);
    expect(Animation.onBeat(Animation.continuous((t) => t), beat([0.5])).rest()).toBe(0);
  });

  it("a timeline maps time and leaves the rest alone, playing, reversed or paused", () => {
    const moving = tween(0, 10, { seconds: 1, ease: EASES.linear });
    for (const timeline of [Timeline.play(5), Timeline.play(0, -2), Timeline.pause(Timeline.play(0), 0.5)]) {
      expect(Timeline.run(timeline, moving).rest()).toBe(10);
    }
  });

  it("a stagger rests with every child arrived", () => {
    const arriving = Array.from({ length: 4 }, (_, i) => tween(0, i + 1, { seconds: 1, ease: EASES.linear }));
    expect(Timeline.stagger(arriving, 0.5).rest()).toEqual([1, 2, 3, 4]);
  });

  it("a colour tween rests at its last stop", () => {
    const ramp = new ColorRamp(EASES.linear, [
      { at: 0, color: new ColorRgba(0, 0, 0) },
      { at: 1, color: new ColorRgba(255, 255, 255) },
    ]);
    expect(ramp.over(3).rest().hex).toBe("#ffffff");
  });

  it("a transition rests at its new state, an arrival arrived and an exit gone", () => {
    const building = new RichText("building", { end: "" });
    const done = new RichText("done", { end: "" });
    expect(crossfade(curve).effect({ from: building, to: done, theme }).rest()).toBe(done);
    // A fade-in at rest is the element as drawn; a dissolve-out at rest is the ground.
    const word = new RichText("[#ff8800 on #202020]word[/]", { end: "" });
    expect(bytes(new Effected(word, fadeIn(curve, 0).effect, { t: 0, key: "w", theme }), REDUCED)).toBe(bytes(word, FULL));
    expect(bytes(new Effected(word, dissolveOut(curve, 0).effect, { t: 0, key: "w", theme }), REDUCED)).not.toBe(bytes(word, FULL));
    // A typewriter at rest has typed everything.
    const typed = new GlyphEffected(new RichText("hello world", { end: "" }), typewriter({ seconds: 2, ease: EASES.linear }).effect, { t: 0, key: "t" });
    expect(plain(typed, REDUCED)).toBe("hello world");
    expect(plain(typed, FULL)).not.toBe("hello world");
  });

  it("an element at rest is arrived, and once told to leave, gone", () => {
    const element = new RichText("line", { end: "" });
    const life = lifecycle(element, { enter: fadeIn(curve, 0), exit: dissolveOut(curve, 0), key: "line", theme }, 0);
    expect(life.rest()).toBe(element);
    expect(plain(life.leave(5).rest())).toBe("");
  });
});

/** Every kind of motion at once, as an animation a host draws. */
function everything(): Animation<Renderable> {
  const bar = Animation.map(tween(0, 20, { seconds: 3, ease: EASES.linear }), (w) => new RichText("#".repeat(Math.round(w)), { end: "" }));
  const marquee = scroll(new RichText("a long line that scrolls past", { end: "" }), { width: 10, height: 1, col: Animation.continuous((t) => (t * 4) % 20) });
  const change = Timeline.run(Timeline.play(1), crossfade(curve).effect({ from: new RichText("old", { end: "" }), to: new RichText("new", { end: "" }), theme }));
  const life = lifecycle(new RichText("arriving", { end: "" }), { enter: fadeIn(curve, 0), exit: dissolveOut(curve, 0), key: "l", theme }, 0.5);
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
    frameAt(lifecycle(new RichText("entering", { end: "" }), { enter: fadeIn(curve, 0), exit: dissolveOut(curve, 0), key: "e", theme }, 0), t),
  );
}

describe("a host under reduced motion", () => {
  const drawnAt = (view: View, options: RenderOptions, t: number, timeline = Timeline.play(0)) =>
    drawView(hostView(view), timeline, t, options, (renderable, under) => lines(renderable, under));
  const text = (drawn: { lines: Segment[][] }): string =>
    segmentsToString(drawn.lines.flat(), { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true });

  it.each([
    ["an animation", everything()],
    ["a function of the time", builtForTheTime as View],
  ])("draws %s the same at every time, sampled once a second or sixty, and is never told to look again", (_, view) => {
    const first = text(drawnAt(view, REDUCED, 0));
    for (const t of SAMPLES) {
      const drawn = drawnAt(view, REDUCED, t);
      expect(text(drawn)).toBe(first);
      expect(drawn.nextChange).toBe(Number.POSITIVE_INFINITY);
      expect(drawn.held).toBe(true);
    }
    // The same view under full motion moves, so the sameness above is the preference's.
    expect(new Set(SAMPLES.map((t) => text(drawnAt(view, FULL, t)))).size).toBeGreaterThan(1);
    expect(drawnAt(view, FULL, 0.5).nextChange).toBe(0.5);
  });

  it("draws the rest whatever the timeline does: fast, reversed, paused or sought", () => {
    const rest = text(drawnAt(everything(), REDUCED, 0));
    for (const timeline of [Timeline.play(0, 3), Timeline.play(0, -1), Timeline.pause(Timeline.play(0), 1.2), Timeline.seek(Timeline.play(0), 0, 7)]) {
      expect(text(drawnAt(everything(), REDUCED, 4, timeline))).toBe(rest);
    }
  });

  it("a renderable drawn as it is rests every animation drawn inside it for the host's time", () => {
    const view = builtForTheTime(1.3);
    const drawn = drawnAt(view, REDUCED, 1.3);
    expect(drawn.nextChange).toBe(Number.POSITIVE_INFINITY);
    expect(text(drawn)).toBe(text(drawnAt(builtForTheTime(8.9), REDUCED, 8.9)));
  });

  it("a frame of no cells at rest says nothing, so a host holding it wakes for nothing", () => {
    const empty: Animation<Renderable> = { at: () => new Group(), nextChange: () => 3, lastChange: () => Number.NEGATIVE_INFINITY, rest: () => new Group() };
    expect(Segment.nextChange([...render(frameAt(empty, 0), REDUCED)])).toBe(Number.POSITIVE_INFINITY);
    expect(Segment.nextChange([...render(frameAt(empty, 0), FULL)])).toBe(3);
  });

  it.each([1, 60])("an App told once paints the rest once at %s fps and arms nothing, an animate()d one included", (perSecond) => {
    const clock = fakeClock();
    const asked: string[] = [];
    const looping = Animation.continuous((t) => new RichText(`t=${t}`, { end: "" }));
    const view: Animation<Renderable> = {
      at: (t) => (asked.push(`at ${t}`), looping.at(t)),
      nextChange: (t) => looping.nextChange(t),
      lastChange: (t) => looping.lastChange(t),
      rest: () => (asked.push("rest"), looping.rest()),
    };
    const target = new App({ host: scriptedHost(), surface: "alternate", clock, rate: frameRate(perSecond), view, reducedMotion: true });
    void target.run();
    target.animate();
    clock.advance(5);
    expect(asked).toEqual(["rest"]);
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

  it("a Live takes the preference from its console: a function view is still polled for its state, and shows only the rest", () => {
    const painted = liveFrames((t: number) => new Spinner("dots", "working").drawnAt(t));
    expect(painted.length).toBeGreaterThan(60);
    // Every frame but the last, which stop() ends by handing the cursor back, is one picture.
    expect(new Set(painted.slice(0, -1)).size).toBe(1);
    expect(painted.at(-1)!.startsWith(painted[0]!)).toBe(true);
  });

  it("a Live of an animation under reduced motion paints its rest and waits on nothing", () => {
    // The first frame and the one stop() draws.
    expect(liveFrames(new Spinner("dots", "working"))).toHaveLength(2);
  });
});

describe("the template animation functions under reduced motion", () => {
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
