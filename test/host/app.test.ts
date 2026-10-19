/**
 * Contract of `App` — the runtime that takes the terminal, paints a frame of
 * its view, and hands the terminal back on every path out.
 *
 * [LAW:behavior-not-structure] What is asserted is what the terminal sees —
 * the bytes written to it and whether it is in raw mode — and what `run`
 * settles with. The host is a script of the `TerminalHost` contract whose
 * resize, exit and resume the test fires by hand. The real node process —
 * signals, a crash, job control — is test/node/crash-order.test.ts.
 */

import { describe, it, expect } from "vitest";
import stripAnsi from "strip-ansi";

import { App, type AppOptions } from "../../src/host/app.js";
import { scriptedHost, type ScriptedHost } from "./scripted-host.js";
import { RichText } from "../../src/core/text.js";
import { Layout } from "../../src/renderables/layout.js";
import { Panel } from "../../src/renderables/panel.js";
import { getStyle, type Renderable, type RenderOptions } from "../../src/core/protocol.js";
import { Segment } from "../../src/core/segment.js";
import { Style, Theme } from "../../src/core/style.js";
import { NullHighlighter } from "../../src/core/highlighter.js";
import { frameRate } from "../../src/core/clock.js";
import { fakeClock, type FakeClock } from "../core/fake-clock.js";
import { Animation } from "../../src/core/animation.js";
import { EASES } from "../../src/core/easing.js";
import { Timeline } from "../../src/core/timeline.js";
import { tween } from "../../src/core/tween.js";

// Pointer reporting belongs to the alternate surface: it is switched on with
// the buffer and off before it, so no exit path leaves one without the other.
const POINTER_ON = "\x1b[?1006h\x1b[?1000h\x1b[?1003h";
const POINTER_OFF = "\x1b[?1003l\x1b[?1000l\x1b[?1006l";
const ALT_ON = "\x1b[?1049h";
const ALT_OFF = "\x1b[?1049l";
const CURSOR_OFF = "\x1b[?25l";
// Every paint is wrapped in synchronized output, so the terminal shows it whole.
const SYNC_START = "\x1b[?2026h";
const SYNC_END = "\x1b[?2026l";
const CURSOR_ON = "\x1b[?25h";
const TAKE = ALT_ON + CURSOR_OFF + POINTER_ON;
const HAND_BACK = POINTER_OFF + "\x1b[0m" + CURSOR_ON + ALT_OFF;

function text(value: string): Renderable {
  return new RichText(value, { end: "" });
}

function app(host: ScriptedHost, view: () => Renderable, surface: AppOptions["surface"] = "alternate"): App {
  return new App({ host, surface, view });
}

/** The frame's rows as the user reads them. */
function rows(target: App): string[] {
  return target.frame.map((line) => line.map((s) => s.text).join(""));
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("App on the alternate screen", () => {
  it("takes the terminal and paints the view as a region the size of the screen", () => {
    const host = scriptedHost({ cols: 12, rows: 3 });
    const target = app(host, () => text("hello"));

    void target.run();

    expect(target.phase).toBe("running");
    expect(host.started()).toBe(true);
    expect(host.raw()).toBe(true);
    expect(host.output().startsWith(TAKE)).toBe(true);
    // A region: padded to every row of the screen.
    expect(rows(target)).toEqual(["hello", "", ""]);
    expect(stripAnsi(host.output())).toContain("hello");
  });

  it("gives a Layout the whole screen", () => {
    const host = scriptedHost({ cols: 10, rows: 4 });
    const layout = new Layout();
    layout.splitColumn(new Layout(text("top"), { name: "top" }), new Layout(text("bottom"), { name: "bottom" }));
    const target = app(host, () => layout);

    void target.run();

    // Each half of the split is half the screen's rows, every one the screen's width.
    expect(rows(target)).toEqual(["top       ", "          ", "bottom    ", "          "]);
  });

  it("paints every change made before a frame into that one frame", async () => {
    let label = "a";
    let views = 0;
    const host = scriptedHost();
    const target = app(host, () => {
      views += 1;
      return text(label);
    });
    void target.run();

    label = "b";
    target.refresh();
    label = "c";
    target.refresh();
    await tick();

    expect(views).toBe(2);
    expect(rows(target)[0]).toBe("c");
  });

  it("keeps the frame on screen until the resized one replaces it", async () => {
    const host = scriptedHost({ cols: 10, rows: 2 });
    const target = app(host, () => text("x".repeat(30)));
    void target.run();
    const before = target.frame;

    host.resize({ cols: 6, rows: 3 });

    // An event arriving now lands on what the user sees.
    expect(target.frame).toBe(before);
    await tick();
    expect(target.frame).not.toBe(before);
    expect(target.frame).toHaveLength(3);
    expect(rows(target).every((row) => row.length <= 6)).toBe(true);
  });

  it("hands the terminal back when stopped, and run resolves", async () => {
    const host = scriptedHost();
    const target = app(host, () => text("hi"));
    const running = target.run();

    target.stop();

    await expect(running).resolves.toBeUndefined();
    expect(target.phase).toBe("stopped");
    expect(host.raw()).toBe(false);
    expect(host.started()).toBe(false);
    expect(host.output().endsWith(HAND_BACK)).toBe(true);
  });

  // The rest of the program's end — a crash report, then the exit — is
  // still running; code after `await run()` must not run inside it.
  it("hands the terminal back when the program ends under it, and run does not settle", async () => {
    const host = scriptedHost();
    const target = app(host, () => text("hi"));
    let settled = false;
    void target.run().then(
      () => (settled = true),
      () => (settled = true),
    );

    host.exit();
    await tick();

    expect(settled).toBe(false);
    expect(target.phase).toBe("stopped");
    expect(host.raw()).toBe(false);
    expect(host.output().endsWith(HAND_BACK)).toBe(true);
  });

  it("hands the terminal back before rejecting with the error a frame threw", async () => {
    const host = scriptedHost();
    const fault = new Error("view broke");
    let broken = false;
    const target = app(host, () => {
      if (broken) throw fault;
      return text("fine");
    });
    const running = target.run();

    broken = true;
    target.refresh();

    await expect(running).rejects.toBe(fault);
    expect(target.phase).toBe("stopped");
    expect(host.raw()).toBe(false);
    expect(host.output().endsWith(HAND_BACK)).toBe(true);
  });

  it("hands the terminal back when failed, and run rejects with the error it was given", async () => {
    const host = scriptedHost();
    const fault = new Error("a key handler broke");
    const target = app(host, () => text("hi"));
    const running = target.run();

    target.fail(fault);

    await expect(running).rejects.toBe(fault);
    expect(target.phase).toBe("stopped");
    expect(host.raw()).toBe(false);
    expect(host.started()).toBe(false);
    expect(host.output().endsWith(HAND_BACK)).toBe(true);
  });

  it("rejects when the first frame throws, with the terminal handed back", async () => {
    const host = scriptedHost();
    const fault = new Error("never drew");
    const target = app(host, () => {
      throw fault;
    });

    await expect(target.run()).rejects.toBe(fault);
    expect(host.raw()).toBe(false);
    expect(host.output()).toContain(HAND_BACK);
  });

  it("suspends by handing the terminal back first, and repaints on resume", async () => {
    const host = scriptedHost();
    const target = app(host, () => text("frame"));
    void target.run();

    const suspended = target.suspend();

    expect(target.phase).toBe("suspended");
    expect(host.suspends()).toBe(1);
    expect(host.raw()).toBe(false);
    expect(host.output().endsWith(HAND_BACK)).toBe(true);

    const handedBack = host.output().length;
    host.resume();
    await suspended;

    expect(target.phase).toBe("running");
    expect(host.raw()).toBe(true);
    const resumed = host.output().slice(handedBack);
    expect(resumed.startsWith(TAKE)).toBe(true);
    expect(stripAnsi(resumed)).toContain("frame");
  });

  it("does not repaint while suspended, nor take the terminal back once stopped", async () => {
    const host = scriptedHost();
    const target = app(host, () => text("frame"));
    const running = target.run();
    const suspended = target.suspend();
    const handedBack = host.output().length;

    target.refresh();
    await tick();
    expect(host.output().length).toBe(handedBack);

    target.stop();
    host.resume();
    await suspended;
    await running;

    expect(target.phase).toBe("stopped");
    expect(host.raw()).toBe(false);
    expect(host.output().length).toBe(handedBack);
  });

  it("runs once", async () => {
    const host = scriptedHost();
    const target = app(host, () => text("x"));
    const first = target.run();
    target.stop();
    await first;

    await expect(target.run()).rejects.toThrow(/runs once/);
  });
});

describe("App on an ASCII-only terminal", () => {
  it("paints every frame in ASCII when asciiOnly is set", () => {
    const view = (): Renderable => new Panel("boxed");
    const ascii = new App({ host: scriptedHost({ cols: 12, rows: 3 }), surface: "inline", view, asciiOnly: true });
    const glyphs = new App({ host: scriptedHost({ cols: 12, rows: 3 }), surface: "inline", view });

    void ascii.run();
    void glyphs.run();

    expect(rows(ascii).join("\n")).toMatch(/^[\x00-\x7f]*$/);
    expect(rows(glyphs).join("\n")).toMatch(/[^\x00-\x7f]/);
  });
});

describe("App drawing options", () => {
  const theme = new Theme({ "health.up": "bold green" });
  const inline = (options: Omit<AppOptions, "host" | "surface">): App =>
    new App({ host: scriptedHost({ cols: 12, rows: 3 }), surface: "inline", ...options });
  // The segment that drew "up", or a failure naming its absence: an assertion
  // on the style of a segment that is not there would pass for any style.
  const up = (target: App): Segment => {
    const found = target.frame[0]?.find((s) => s.text.includes("up"));
    if (found === undefined) throw new Error("no segment of the first row drew 'up'");
    return found;
  };

  it("reach every frame's render options as the console's", () => {
    const highlighter = new NullHighlighter();
    const onStyleError = (): void => {};
    let seen: RenderOptions | undefined;
    const view: Renderable = {
      *render(options: RenderOptions) {
        seen = options;
        yield new Segment("up");
      },
    };

    void inline({ view: () => view, asciiOnly: true, theme, onStyleError, markup: false, highlighter }).run();

    expect(seen).toMatchObject({ asciiOnly: true, theme, onStyleError, markup: false, highlighter });
  });

  it("carry nothing else to the console, so the host alone sets the frame's size", () => {
    let seen: RenderOptions | undefined;
    const view: Renderable = {
      *render(options: RenderOptions) {
        seen = options;
        yield new Segment("up");
      },
    };
    const console = { width: 3, height: 1, colorSystem: null };
    const options: AppOptions = { ...console, host: scriptedHost({ cols: 12, rows: 3 }), surface: "inline", view: () => view };

    void new App(options).run();

    expect(seen?.maxWidth).toBe(12);
    expect(seen?.colorSystem).not.toBe(null);
  });

  it("resolve a name the theme adds, which without the theme draws plain", () => {
    const health: Renderable = {
      *render(options: RenderOptions) {
        yield new Segment("up", getStyle(options, "health.up"));
      },
    };
    const view = (): Renderable => new RichText("up", { style: "health.up", end: "" });
    const named = inline({ view: () => health, theme });
    const themed = inline({ view, theme });
    const plain = inline({ view });

    void named.run();
    void themed.run();
    void plain.run();

    expect(up(named).style?.equals(Style.parse("bold green"))).toBe(true);
    expect(up(themed).style?.bold).toBe(true);
    expect(up(plain).style?.bold).toBeUndefined();
  });

  it("report a name the theme lacks to onStyleError", () => {
    const failed: string[] = [];
    const target = inline({
      view: () => new RichText("up", { style: "helth.up", end: "" }),
      theme,
      onStyleError: (_error, style) => failed.push(style),
    });

    void target.run();

    expect(failed).toContain("helth.up");
  });
});

describe("App paint listeners", () => {
  it("hear each frame once it is on screen, as the frame the app now reports", async () => {
    const host = scriptedHost({ cols: 10, rows: 2 });
    let label = "one";
    const target = app(host, () => text(label));
    const heard: string[][] = [];
    target.onPaint((frame) => {
      expect(frame).toBe(target.frame);
      heard.push(rows(target));
    });

    void target.run();
    label = "two";
    target.refresh();
    await tick();

    expect(heard).toEqual([["one", ""], ["two", ""]]);
  });

  it("fail the app when one throws, as a frame that throws does", async () => {
    const host = scriptedHost();
    const target = app(host, () => text("x"));
    target.onPaint(() => {
      throw new Error("listener broke");
    });

    await expect(target.run()).rejects.toThrow("listener broke");
    expect(host.raw()).toBe(false);
  });
});

describe("App frame clock", () => {
  /** An app on `clock` at `perSecond`, and the time of every frame its view was asked for. */
  function clocked(perSecond: number, clock: FakeClock): { target: App; times: number[] } {
    const times: number[] = [];
    const target = new App({
      host: scriptedHost(),
      surface: "alternate",
      clock,
      rate: frameRate(perSecond),
      view: (t) => {
        times.push(t);
        return text(`t=${t}`);
      },
    });
    return { target, times };
  }

  it("paints 30 frames a second at 30 fps while something animates", () => {
    const clock = fakeClock();
    const { target, times } = clocked(30, clock);
    void target.run();
    target.animate();

    clock.advance(1);

    // The first frame, then one a tick.
    expect(times).toHaveLength(1 + 30);
  });

  it("paints one frame every two seconds at 0.5 fps, each handed the time since the app was made", () => {
    const clock = fakeClock(100);
    const { target, times } = clocked(0.5, clock);
    void target.run();
    target.animate();

    clock.advance(1.9);
    expect(times).toEqual([0]);
    clock.advance(4.1);
    expect(times).toEqual([0, 2, 4, 6]);
  });

  it("goes on at a new rate from the next frame when rate is set mid-animation", () => {
    const clock = fakeClock();
    const { target, times } = clocked(1, clock);
    void target.run();
    target.animate();
    clock.advance(2);
    expect(times).toEqual([0, 1, 2]);

    target.rate = frameRate(4);

    clock.advance(1);
    expect(target.rate.perSecond).toBe(4);
    expect(times).toEqual([0, 1, 2, 2.25, 2.5, 2.75, 3]);
    expect(clock.timers()).toBe(1);
  });

  it("paints an animation's first frame without waiting out an interval", async () => {
    const clock = fakeClock();
    const { target, times } = clocked(0.5, clock);
    void target.run();
    clock.advance(1);

    target.animate();
    await tick();

    expect(times).toEqual([0, 1]);
  });

  it("paints one frame, not two, for a refresh asked for before a tick", async () => {
    const clock = fakeClock();
    const { target, times } = clocked(10, clock);
    void target.run();
    target.animate();
    await tick();

    target.refresh();
    clock.advance(0.1);
    await tick();

    // The first frame, the animation's first, then the tick that drew the refresh.
    expect(times).toHaveLength(3);
  });

  it("does not tick while nothing animates, and stops when the last animation ends", () => {
    const clock = fakeClock();
    const { target, times } = clocked(10, clock);
    void target.run();

    clock.advance(1);
    expect(times).toHaveLength(1);
    expect(clock.timers()).toBe(0);

    const first = target.animate();
    const second = target.animate();
    first();
    clock.advance(1);
    expect(times).toHaveLength(1 + 10);

    second();
    second();
    clock.advance(1);
    expect(times).toHaveLength(1 + 10);
    expect(clock.timers()).toBe(0);
  });

  it("starts ticking when it runs for an animation begun before, and leaves no timer once stopped", async () => {
    const clock = fakeClock();
    const { target, times } = clocked(10, clock);
    target.animate();
    expect(clock.timers()).toBe(0);

    const running = target.run();
    clock.advance(0.5);
    expect(times).toHaveLength(1 + 5);

    target.stop();
    await running;
    expect(clock.timers()).toBe(0);
    clock.advance(1);
    expect(times).toHaveLength(1 + 5);
  });

  it("does not tick while suspended, and ticks again on resume", async () => {
    const clock = fakeClock();
    const host = scriptedHost();
    const times: number[] = [];
    const target = new App({
      host,
      surface: "alternate",
      clock,
      rate: frameRate(10),
      view: (t) => {
        times.push(t);
        return text("x");
      },
    });
    void target.run();
    target.animate();

    const suspended = target.suspend();
    expect(clock.timers()).toBe(0);
    clock.advance(1);
    expect(times).toHaveLength(1);

    host.resume();
    await suspended;
    clock.advance(1);
    // The repaint on resume, then a tick each tenth of a second.
    expect(times).toHaveLength(2 + 10);
  });

  it("ends the app, with no timer left, when a ticked frame throws", async () => {
    const clock = fakeClock();
    let frames = 0;
    const target = new App({
      host: scriptedHost(),
      surface: "alternate",
      clock,
      rate: frameRate(10),
      view: () => {
        frames += 1;
        if (frames > 2) throw new Error("frame broke");
        return text("x");
      },
    });
    const running = target.run();
    target.animate();

    clock.advance(1);

    await expect(running).rejects.toThrow("frame broke");
    expect(frames).toBe(3);
    expect(clock.timers()).toBe(0);
  });
});

// rich-animation-42lg.04v: an app draws its view at the time its timeline
// maps the clock to, and paints when what it drew says it changes — so a
// view built on a value animation needs no `animate()` to move.
describe("App on a timeline", () => {
  /** An app on `clock` at `perSecond` drawing `animation`, and every value it was drawn with, at the time it was drawn for. */
  function playing(animation: Animation<number>, perSecond: number, clock: FakeClock, timeline?: Timeline): { target: App; drawn: { t: number; value: number }[] } {
    const drawn: { t: number; value: number }[] = [];
    const view: Animation<Renderable> = {
      at: (t) => {
        const value = animation.at(t);
        drawn.push({ t, value });
        return text(`${value}`);
      },
      nextChange: (t) => animation.nextChange(t),
      lastChange: (t) => animation.lastChange(t),
    };
    return { target: new App({ host: scriptedHost(), surface: "alternate", clock, rate: frameRate(perSecond), view, timeline }), drawn };
  }
  // 0 to 10 over a second.
  const growing = (): Animation<number> => tween(0, 10, { ease: EASES.linear, seconds: 1 });

  it.each([1, 60])("at %s fps, paints a tween at its rate while it moves and stops on arriving, with nothing animate()d", (perSecond) => {
    const clock = fakeClock();
    const { target, drawn } = playing(growing(), perSecond, clock);
    void target.run();
    clock.advance(3);
    // Every frame until the first at or past the end, which shows it arrived.
    expect(drawn.slice(0, -1).every(({ t }) => t < 1)).toBe(true);
    expect(drawn.at(-1)).toEqual({ t: expect.closeTo(1, 9), value: 10 });
    expect(drawn.length).toBeGreaterThanOrEqual(perSecond + 1);
    expect(clock.timers()).toBe(0);
    expect(rows(target)[0]).toBe("10");
  });

  it.each([1, 60])("at %s fps, wakes once for a held sequence's switch, and not at the rate", (perSecond) => {
    const clock = fakeClock();
    const { target, drawn } = playing(Animation.sequence(Animation.constant(1), 2.5, Animation.constant(2)), perSecond, clock);
    void target.run();
    clock.advance(5);
    expect(drawn).toEqual([
      { t: 0, value: 1 },
      { t: 2.5, value: 2 },
    ]);
    expect(clock.timers()).toBe(0);
  });

  it.each([1, 60])("at %s fps, paused, paints the held frame once with no timer left, and resumed, moves on to arrive", async (perSecond) => {
    const clock = fakeClock();
    const { target, drawn } = playing(growing(), perSecond, clock);
    void target.run();
    clock.advance(0.5);
    const before = drawn.length;

    target.timeline = Timeline.pause(target.timeline, clock.now());
    await tick();
    expect(drawn).toHaveLength(before + 1);
    expect(drawn.at(-1)).toEqual({ t: 0.5, value: 5 });
    expect(clock.timers()).toBe(0);
    clock.advance(5);
    expect(drawn).toHaveLength(before + 1);

    target.timeline = Timeline.resume(target.timeline, clock.now());
    await tick();
    expect(drawn.at(-1)).toEqual({ t: 0.5, value: 5 });
    clock.advance(1);
    expect(drawn.at(-1)!.value).toBe(10);
    expect(clock.timers()).toBe(0);
  });

  it("paints a seek while paused once, at the sought time", async () => {
    const clock = fakeClock();
    const { target, drawn } = playing(growing(), 60, clock, Timeline.pause(Timeline.play(0), 0));
    void target.run();
    expect(drawn).toEqual([{ t: 0, value: 0 }]);
    target.timeline = Timeline.seek(target.timeline, clock.now(), 0.25);
    await tick();
    clock.advance(2);
    expect(drawn).toEqual([
      { t: 0, value: 0 },
      { t: 0.25, value: 2.5 },
    ]);
    expect(clock.timers()).toBe(0);
  });

  it.each([1, 60])("at %s fps, paused, paints nothing for an animate() held until the timeline plays again", async (perSecond) => {
    const clock = fakeClock();
    const { target, drawn } = playing(Animation.constant(1), perSecond, clock);
    void target.run();
    target.animate();
    clock.advance(1);
    target.timeline = Timeline.pause(target.timeline, clock.now());
    await tick();
    const held = drawn.length;
    clock.advance(3);
    expect(drawn).toHaveLength(held);
    expect(clock.timers()).toBe(0);

    target.timeline = Timeline.resume(target.timeline, clock.now());
    await tick();
    clock.advance(1);
    expect(drawn.length).toBeGreaterThanOrEqual(held + perSecond);
  });

  // A renderable is never handed a time, so what its cells say is on the
  // only clock it can read, the app's — a Progress stamps its spinner there.
  it("wakes a renderable view at the clock moment its cells say, whatever the timeline does", async () => {
    const clock = fakeClock(100);
    let draws = 0;
    const stamped: Renderable = {
      render: () => {
        draws += 1;
        return [new Segment("x", new Style({ nextChange: Math.floor(clock.now()) + 1 }))];
      },
    };
    const target = new App({ host: scriptedHost(), surface: "alternate", clock, rate: frameRate(1), view: stamped, timeline: Timeline.play(0, -3) });
    void target.run();
    clock.advance(2.5);
    // Drawn at 100, then at 101 and 102, as its cells said.
    expect(draws).toBe(3);
    target.timeline = Timeline.pause(target.timeline, clock.now());
    await tick();
    clock.advance(2);
    // The frame the pause paints, then 103 and 104: pausing holds nothing off the timeline.
    expect(draws).toBe(6);
  });

  // An animation's frame whose cells move — an effect over a tween that has
  // arrived — cannot say since when, so backwards it is painted at the rate,
  // not frozen until the tween's end comes round.
  it.each([1, 60])("at %s fps, run backwards, paints an animation's frame at its rate while its cells move", (perSecond) => {
    const clock = fakeClock();
    const times: number[] = [];
    const settled: Animation<Renderable> = {
      at: (t) => {
        times.push(t);
        return { render: () => [new Segment("x", new Style({ nextChange: t }))] };
      },
      nextChange: () => Number.POSITIVE_INFINITY,
      lastChange: () => 2,
    };
    const timeline = Timeline.seek(Timeline.play(0, -1), 0, 10);
    const target = new App({ host: scriptedHost(), surface: "alternate", clock, rate: frameRate(perSecond), view: settled, timeline });
    void target.run();
    clock.advance(1);
    expect(times).toHaveLength(1 + perSecond);
    expect(times.at(-1)).toBeCloseTo(9, 9);
  });

  it("run backwards, paints a tween back to where it began and stops there", () => {
    const clock = fakeClock();
    const { target, drawn } = playing(growing(), 10, clock, Timeline.seek(Timeline.play(0, -1), 0, 1));
    void target.run();
    clock.advance(3);
    expect(drawn[0]).toEqual({ t: 1, value: 10 });
    expect(drawn.at(-1)!.value).toBe(0);
    expect(drawn.slice(0, -1).every(({ t }) => t > 0)).toBe(true);
    expect(clock.timers()).toBe(0);
  });
});

describe("App inline", () => {
  it("keeps the frame's own height under the terminal as a ceiling", () => {
    const host = scriptedHost({ cols: 10, rows: 5 });
    const target = app(host, () => text("one\ntwo"), "inline");

    void target.run();

    expect(rows(target)).toEqual(["one", "two"]);
    expect(host.output()).not.toContain(ALT_ON);
    // The terminal reports a pointer by its screen row, and an inline frame
    // does not know which row it starts on.
    expect(host.output()).not.toContain(POINTER_ON);
  });

  it("hands the terminal back with style reset before the cursor is shown, on the line under the frame", async () => {
    const host = scriptedHost({ cols: 10, rows: 5 });
    const target = app(host, () => text("one\ntwo"), "inline");
    const running = target.run();

    target.stop();

    await expect(running).resolves.toBeUndefined();
    expect(host.output().endsWith("\x1b[0m" + CURSOR_ON + "\n")).toBe(true);
  });

  it("crops a frame taller than the terminal to the terminal", () => {
    const host = scriptedHost({ cols: 10, rows: 2 });
    const target = app(host, () => text("a\nb\nc\nd"), "inline");

    void target.run();

    expect(rows(target)).toEqual(["a", "b"]);
  });

  it("paints over its own last frame, blanking the rows a shorter one leaves", async () => {
    const host = scriptedHost({ cols: 10, rows: 10 });
    let body = "a\nb\nc";
    const target = app(host, () => text(body), "inline");
    void target.run();
    const first = host.output().length;

    body = "z";
    target.refresh();
    await tick();

    const second = host.output().slice(first);
    // Back to the first frame's top row, then three rows, each from its
    // first cell: the new one and two blanked.
    const home = SYNC_START + "\x1b[2A";
    expect(second.startsWith(home)).toBe(true);
    expect(second.slice(home.length).split("\n").map(stripAnsi)).toEqual(["\rz", "\r", "\r"]);
  });

  it("after blanking, starts the next frame and the program's next line from its own height", async () => {
    const host = scriptedHost({ cols: 10, rows: 10 });
    let body = "a\nb\nc";
    const target = app(host, () => text(body), "inline");
    const running = target.run();

    body = "y\nz";
    target.refresh();
    await tick();
    const second = host.output().length;
    body = "x";
    target.refresh();
    await tick();
    const third = host.output().slice(second);
    target.stop();
    await running;
    const last = host.output().slice(second + third.length);

    // One row up from the second frame's last row to its first, not two.
    expect(third.startsWith(SYNC_START + "\x1b[1A\r")).toBe(true);
    // The row it blanked is left behind, and the program's line follows the
    // frame's one row.
    expect(third.endsWith("\x1b[1A" + SYNC_END)).toBe(true);
    expect(last.endsWith(CURSOR_ON + "\n")).toBe(true);
  });

  it("leaves the frame on the terminal with the cursor below it", async () => {
    const host = scriptedHost({ cols: 10, rows: 10 });
    const target = app(host, () => text("a\nb"), "inline");
    const running = target.run();

    target.stop();
    await running;

    expect(host.output().endsWith(CURSOR_ON + "\n")).toBe(true);
    expect(host.output()).not.toContain(ALT_OFF);
  });
});

describe("App and the wheel", () => {
  const UP = "\x1b[<64;3;2M";
  const DOWN = "\x1b[<65;3;2M";

  it("with nothing reading the wheel, passes every turn outward", () => {
    const host = scriptedHost();
    void app(host, () => text("still")).run();
    host.type(DOWN + UP + DOWN);
    expect(host.passed()).toEqual([1, -1, 1]);
  });

  it("passes a turn outward only when no wheel handler moved anything with it", () => {
    const host = scriptedHost();
    const target = app(host, () => text("still"));
    void target.run();
    const heard: unknown[] = [];
    target.onWheel((wheel) => (heard.push(wheel), wheel.lines > 0));
    host.type(DOWN + UP);
    expect(heard).toEqual([
      { x: 2, y: 1, lines: 1 },
      { x: 2, y: 1, lines: -1 },
    ]);
    expect(host.passed()).toEqual([-1]);
  });

  it("passes nothing outward for a click or the sideways wheel", () => {
    const host = scriptedHost();
    void app(host, () => text("still")).run();
    host.type("\x1b[<0;3;2M\x1b[<0;3;2m\x1b[<66;3;2M");
    expect(host.passed()).toEqual([]);
  });

  it("does not tell onMouse about the vertical wheel, which is onWheel's", () => {
    const host = scriptedHost();
    const target = app(host, () => text("still"));
    void target.run();
    const heard: string[] = [];
    target.onMouse((event) => heard.push(event.type));
    host.type(DOWN + "\x1b[<66;3;2M");
    expect(heard).toEqual(["scroll_left"]);
  });

  it("while suspended, offers no handler a turn and passes none outward", async () => {
    const host = scriptedHost();
    const target = app(host, () => text("still"));
    void target.run();
    const heard: unknown[] = [];
    target.onWheel((wheel) => (heard.push(wheel), true));
    const suspended = target.suspend();
    host.type(DOWN);
    host.resume();
    await suspended;
    expect(heard).toEqual([]);
    expect(host.passed()).toEqual([]);
  });

  it("fails with the error a wheel handler throws", async () => {
    const host = scriptedHost();
    const target = new App({ host, surface: "alternate", view: () => text("still") });
    const run = target.run();
    target.onWheel(() => {
      throw new Error("wheel");
    });
    host.type(DOWN);
    await expect(run).rejects.toThrow("wheel");
    expect(host.passed()).toEqual([]);
  });
});
