/**
 * Contract of `TextInput`'s caret blink: on the time the frame is drawn for
 * (`RenderOptions.frame`), restarted by the last key the field heard
 * (`KeyEvent.time`), and saying when it next flips so a host paints then and
 * not between.
 *
 * [LAW:behavior-not-structure] Driven through a `WidgetApp` on a scripted
 * host and a hand-moved clock: what is asserted is the caret cell on the
 * frame on screen, how many frames were painted, and what was left waiting.
 */

import { describe, it, expect } from "vitest";

import { WidgetApp } from "../../src/widgets/widget-app.js";
import { TextInput } from "../../src/widgets/text-input.js";
import { Style } from "../../src/core/style.js";
import { Segment } from "../../src/core/segment.js";
import { render } from "../../src/core/protocol.js";
import { Timeline } from "../../src/core/timeline.js";
import { Group } from "../../src/renderables/group.js";
import { scriptedHost, type ScriptedHost } from "../host/scripted-host.js";
import { fakeClock, type FakeClock } from "../core/fake-clock.js";

const CARET = new Style({ reverse: true });

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

interface Running {
  readonly app: WidgetApp;
  readonly host: ScriptedHost;
  readonly input: TextInput;
  readonly clock: FakeClock;
  readonly paints: () => number;
  /** Whether the caret cell is drawn as the cursor on the frame on screen. */
  readonly lit: () => boolean;
}

function start(options: { reducedMotion?: boolean; focused?: boolean; view?: "function" | "renderable" } = {}): Running {
  const { reducedMotion = false, focused = true, view = "function" } = options;
  const clock = fakeClock(0);
  const host = scriptedHost({ cols: 20, rows: 2 });
  const input = new TextInput({ value: "hello", cursorStyle: CARET });
  if (focused) input.focus(0);
  const app = new WidgetApp({ host, surface: "alternate", clock, reducedMotion, view: view === "function" ? () => input : input });
  let paints = 0;
  // Every frame the app paints moves the cursor home first.
  const write = host.write.bind(host);
  host.write = (data) => {
    if (String(data).includes("\x1b[H")) paints++;
    write(data);
  };
  void app.run();
  const lit = (): boolean => app.frame.some((line) => line.some((s) => s.style?.reverse === true));
  return { app, host, input, clock, paints: () => paints, lit };
}

/** Whether the blink restarted at `typedAt` is lit at `t`: lit the first half of each second. */
const litAt = (t: number, typedAt = 0): boolean => (((t - typedAt) % 1) + 1) % 1 < 0.5;

describe("TextInput caret blink", () => {
  it.each([
    ["one tick a second", 1],
    ["sixty ticks a second", 1 / 60],
  ])("is lit then dark on a half-second beat, sampled at %s", (_, step) => {
    const { clock, lit, app } = start();
    // Half a sixtieth off the flips, so no sample sits on one at either rate.
    const offset = 1 / 120;
    clock.advance(offset);
    for (let t = offset; t < 4; t += step) {
      expect(lit(), `at ${t.toFixed(3)}s`).toBe(litAt(t));
      clock.advance(step);
    }
    app.stop();
  });

  it.each([1, 1 / 60, 1 / 7])("paints once a flip whatever the hand moving the clock steps by (%s s)", (step) => {
    const { clock, paints, app } = start();
    const first = paints();
    for (let moved = 0; moved < 3 - 1e-9; moved += step) clock.advance(step);
    // Flips at 0.5, 1, 1.5, 2, 2.5 and 3.
    expect(paints() - first).toBe(6);
    app.stop();
  });

  it("draws the same frame for the same time, at either rate", () => {
    const sampled = (step: number): string[] => {
      const { clock, app } = start();
      const frames: string[] = [];
      for (let i = 0; i < 4; i++) {
        clock.advance(step === 1 ? 1 : 0);
        for (let k = 0; step !== 1 && k < 60; k++) clock.advance(step);
        frames.push(app.frame.map((line) => line.map((s) => `${s.text}${s.style?.reverse === true ? "*" : ""}`).join("")).join("\n"));
      }
      app.stop();
      return frames;
    };
    expect(sampled(1 / 60)).toEqual(sampled(1));
  });

  it("is solid right after a key, the blink restarting from it", async () => {
    const { app, host, clock, lit } = start();
    clock.advance(0.7);
    expect(lit()).toBe(false);
    host.type("a");
    await tick();
    expect(lit()).toBe(true);
    clock.advance(0.45);
    expect(lit()).toBe(true);
    clock.advance(0.1);
    expect(lit()).toBe(false);
    clock.advance(0.5);
    expect(lit()).toBe(true);
    app.stop();
  });

  it("is not restarted, or repainted, by a key the field passes on", async () => {
    const { app, host, clock, lit, paints } = start();
    clock.advance(0.7);
    const before = paints();
    host.type("\x07"); // Ctrl+G: no binding in the field
    await tick();
    expect(lit()).toBe(false);
    expect(paints()).toBe(before);
    app.stop();
  });

  it("is solid right after a click places the cursor", async () => {
    const { app, host, clock, lit } = start();
    clock.advance(0.7);
    expect(lit()).toBe(false);
    host.type("\x1b[<0;3;1M");
    await tick();
    expect(lit()).toBe(true);
    app.stop();
  });

  it("is solid in a field the moment Tab moves focus to it", async () => {
    const clock = fakeClock(0);
    const host = scriptedHost({ cols: 20, rows: 2 });
    const first = new TextInput({ value: "a", cursorStyle: CARET });
    const second = new TextInput({ value: "b", cursorStyle: CARET });
    const app = new WidgetApp({ host, surface: "alternate", clock, view: () => new Group(first, second) });
    void app.run();
    const litIn = (row: number): boolean => app.frame[row]!.some((s) => s.style?.reverse === true);
    clock.advance(0.7);
    expect(litIn(0)).toBe(false);
    host.type("\t");
    await tick();
    expect(second.focused).toBe(true);
    expect(litIn(1)).toBe(true);
    app.stop();
  });

  it("is solid right after a key on a timeline played backwards", async () => {
    const { app, host, clock, lit } = start();
    clock.advance(0.7);
    app.timeline = Timeline.withRate(app.timeline, clock.now(), -1);
    host.type("a");
    await tick();
    clock.advance(0.2);
    expect(lit()).toBe(true);
    clock.advance(0.4);
    expect(lit()).toBe(false);
    app.stop();
  });

  it("holds still on a paused timeline, and leaves nothing waiting", async () => {
    const { app, clock, lit, paints } = start();
    clock.advance(0.6);
    expect(lit()).toBe(false);
    app.timeline = Timeline.pause(app.timeline, clock.now());
    await tick();
    const held = paints();
    expect(clock.timers()).toBe(0);
    clock.advance(3);
    expect(lit()).toBe(false);
    expect(paints()).toBe(held);
    app.stop();
  });

  it("is solid under reduced motion, and wakes nothing", () => {
    const { app, clock, lit, paints } = start({ reducedMotion: true });
    const first = paints();
    expect(clock.timers()).toBe(0);
    clock.advance(3);
    expect(lit()).toBe(true);
    expect(paints()).toBe(first);
    app.stop();
  });

  it("is not drawn, and wakes nothing, while the field is unfocused", () => {
    const { app, clock, lit } = start({ focused: false });
    expect(lit()).toBe(false);
    expect(clock.timers()).toBe(0);
    app.stop();
  });

  it("blinks on the timeline in a renderable view too, so a pause holds it", async () => {
    const { app, clock, lit } = start({ view: "renderable" });
    clock.advance(0.6);
    expect(lit()).toBe(false);
    app.timeline = Timeline.pause(app.timeline, clock.now());
    await tick();
    clock.advance(0.5);
    expect(lit()).toBe(false);
    app.stop();
  });

  // A print names no moment, so it is drawn for 0, as every placed animation is.
  it("in a frame drawn for no moment, is drawn at 0: the blink from a touch at 0, lit, flipping at the half second", () => {
    const input = new TextInput({ value: "hi", cursorStyle: CARET });
    input.focus(0);
    const segments = [...render(input, { maxWidth: 10 })];
    expect(segments.some((s) => s.style?.reverse === true)).toBe(true);
    expect(Segment.nextChange(segments)).toBe(0.5);
    expect(segments).toEqual([...render(input, { maxWidth: 10, frame: { time: 0, host: {} } })]);
  });
});
