import { describe, expect, it } from "vitest";
import { Animation } from "../../src/core/animation.js";
import { ColorDepth } from "../../src/core/color.js";
import { Console } from "../../src/core/console.js";
import { EASES, beat } from "../../src/core/easing.js";
import { Measurement } from "../../src/core/measure.js";
import { render, type Renderable, type RenderOptions } from "../../src/core/protocol.js";
import { segmentsToString } from "../../src/core/render.js";
import { Segment } from "../../src/core/segment.js";
import { RichText } from "../../src/core/text.js";
import { DEFAULT_TERMINAL_THEME } from "../../src/index.js";
import { dissolveOut, fadeIn, onBeat } from "../../src/renderables/effects.js";
import { frameAt } from "../../src/renderables/frames.js";
import { Group } from "../../src/renderables/group.js";
import { Live } from "../../src/renderables/live.js";
import { lifecycle, type Lifecycle } from "../../src/renderables/lifecycle.js";
import { fakeClock } from "../core/fake-clock.js";

const theme = DEFAULT_TERMINAL_THEME;
const OPTIONS: RenderOptions = { maxWidth: 40, colorSystem: ColorDepth.TRUECOLOR };
const PLAIN: RenderOptions = { maxWidth: 40, colorSystem: null };
const curve = { seconds: 2, ease: EASES.linear, swing: 1 };

const line = new RichText("a line appended to the log", { style: "bold cyan" });
const draw = (renderable: Renderable, options: RenderOptions = OPTIONS): Segment[] => [...render(renderable, options)];
const bytes = (segments: Segment[]): string => segmentsToString(segments, { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true });
const text = (segments: Segment[]): string => segments.map((s) => s.text).join("");

/** `rate` samples a second from `from` to `to`. */
const sampled = (rate: number, from: number, to: number): number[] => Array.from({ length: Math.floor((to - from) * rate) + 1 }, (_, i) => from + i / rate);

/** A line entering at 1 through a 2 s fade-in, told to leave at 5 through a 2 s dissolve: gone at 7. */
const made = (element: Renderable = line, entered = 1): Lifecycle =>
  lifecycle(element, { enter: fadeIn(curve, 0), exit: dissolveOut(curve, 0), key: "line", theme }, entered);

describe("a lifecycle", () => {
  it("draws the same bytes for the same t at one frame a second and sixty", () => {
    const at = (t: number) => bytes(draw(made().leave(5).at(t)));
    // A fresh lifecycle for each rate, as two hosts would hold.
    const slow = new Map(sampled(1, 0, 8).map((t) => [t, at(t)]));
    const fast = made().leave(5);
    for (const t of sampled(60, 0, 8)) if (slow.has(t)) expect(bytes(draw(fast.at(t)))).toBe(slow.get(t));
  });

  it("draws nothing before it entered, moves while it arrives, is the element while it stays, moves while it leaves, then draws nothing", () => {
    const life = made().leave(5);
    const said = (t: number) => [life.lastChange(t), life.nextChange(t)];
    expect(text(draw(frameAt(life, 0.5)))).toBe("");
    expect(said(0.5)).toEqual([Number.NEGATIVE_INFINITY, 1]);
    for (const t of [1, 2, 2.9]) expect(said(t)).toEqual([t, t]);
    for (const t of [3, 4, 4.9]) {
      expect(said(t)).toEqual([3, 5]);
      expect(bytes(draw(frameAt(life, t)))).toBe(bytes(draw(line)));
      expect(Segment.nextChange(draw(frameAt(life, t)))).toBe(5);
    }
    for (const t of [5, 6, 6.9]) expect(said(t)).toEqual([t, t]);
    for (const t of [7, 100]) {
      expect(said(t)).toEqual([7, Number.POSITIVE_INFINITY]);
      expect(bytes(draw(frameAt(life, t)))).toBe("");
      expect(Measurement.get(OPTIONS, frameAt(life, t))).toEqual(new Measurement(0, 0));
    }
  });

  it("is gone from the moment it has finished leaving, and never before it was told to leave", () => {
    const staying = made();
    expect(staying.left).toBe(Number.POSITIVE_INFINITY);
    expect([0, 3, 1e6].some((t) => staying.gone(t))).toBe(false);
    expect(staying.nextChange(1e6)).toBe(Number.POSITIVE_INFINITY);
    const leaving = staying.leave(5);
    expect(leaving.gone(6.99)).toBe(false);
    expect(leaving.gone(7)).toBe(true);
    // Before it entered it draws nothing, but a timeline run backwards reaches it again: not gone.
    expect(leaving.gone(0)).toBe(false);
  });

  it("is never gone before it was told to leave, whatever its exit steps on", () => {
    const stepped = lifecycle(new RichText("x"), { enter: fadeIn(curve, 0), exit: onBeat(dissolveOut(curve, 0), beat([0.25])), key: "x", theme }, 1);
    expect([0, 5, 1e6].some((t) => stepped.gone(t))).toBe(false);
    const leaving = stepped.leave(5);
    expect(leaving.gone(leaving.lastChange(100))).toBe(true);
  });

  it("is gone, draws nothing and says so from one float on, wherever the sum of when it left and how long it takes rounds", () => {
    /** The float just under positive `x`. */
    const below = (x: number): number => {
      const view = new DataView(new ArrayBuffer(8));
      view.setFloat64(0, x);
      view.setBigUint64(0, view.getBigUint64(0) - 1n);
      return view.getFloat64(0);
    };
    const exit = { seconds: 0.7, ease: EASES.linear, swing: 1 };
    for (const left of [0.1, 0.2, 0.3, 1.1, 12345.678, 1e6 + 0.3]) {
      const life = lifecycle(line, { enter: fadeIn(curve, 0), exit: dissolveOut(exit, 0), key: "line", theme }, 0).leave(left);
      const goneAt = life.lastChange(left + 10);
      const before = below(goneAt);
      expect([life.gone(before), life.gone(goneAt)]).toEqual([false, true]);
      expect(bytes(draw(frameAt(life, goneAt)))).toBe("");
      expect(bytes(draw(frameAt(life, before)))).not.toBe("");
      expect([life.nextChange(before), life.nextChange(goneAt)]).toEqual([before, Number.POSITIVE_INFINITY]);
    }
  });

  it("told to leave while still arriving, leaves from where it is rather than shown whole first", () => {
    const early = made().leave(2);
    const arriving = made();
    // At the moment it is told, the frame is what arriving drew there: the exit has not begun to veil it.
    expect(bytes(draw(early.at(2)))).toBe(bytes(draw(arriving.at(2))));
    expect(bytes(draw(early.at(2)))).not.toBe(bytes(draw(line)));
    expect(early.gone(4)).toBe(true);
  });

  it("with no colour output, still says it moves while it leaves and that it is gone after", () => {
    const life = made().leave(5);
    expect(text(draw(frameAt(life, 4), PLAIN))).toBe(`${line.plain}\n`);
    for (const t of [5, 6, 6.9]) expect(Segment.nextChange(draw(frameAt(life, t), PLAIN))).toBe(t);
    expect(text(draw(frameAt(life, 7), PLAIN))).toBe("");
    expect(Segment.nextChange(draw(frameAt(life, 7), PLAIN))).toBe(Number.POSITIVE_INFINITY);
  });

  it("before it entered draws no byte, yet its frame says when it enters, so a function view wakes for it", () => {
    const life = made().leave(5);
    for (const options of [OPTIONS, PLAIN]) {
      const drawn = draw(new Group(frameAt(life, 0.5)), options);
      expect(bytes(drawn)).toBe("");
      expect(Segment.nextChange(drawn)).toBe(1);
    }
  });

  it("refuses a second telling to leave, and a leaving before it entered", () => {
    expect(() => made().leave(5).leave(6)).toThrow(/already told to leave at 5/);
    expect(() => made().leave(0.5)).toThrow(RangeError);
    expect(() => made().leave(Number.NaN)).toThrow(RangeError);
    expect(() => made(line, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it.each([1, 60])("in a Live at %s fps, a gone element stops being drawn and the Live waits on nothing", (perSecond) => {
    let rendered = 0;
    const counted: Renderable = { render: (options) => (rendered++, render(line, options)) };
    const lines = [made(counted, 0).leave(2), made(new RichText("stays a while"), 0).leave(3)];
    const view = Animation.map(Animation.all(lines), (frames) => new Group(...frames));
    const clock = fakeClock();
    const target = new Console({ width: 40, height: 5, colorSystem: ColorDepth.TRUECOLOR, forceTerminal: true, file: { write: () => {} } });
    const live = new Live(view, { console: target, clock, refreshPerSecond: perSecond });
    live.start();
    // The first is gone at 4; the second still leaves until 5, so the Live still draws.
    clock.advance(4);
    const whenGone = rendered;
    expect(whenGone).toBeGreaterThan(0);
    clock.advance(0.9);
    expect(rendered).toBe(whenGone);
    clock.advance(1.1);
    expect(lines.every((l) => l.gone(clock.now()))).toBe(true);
    clock.advance(10);
    expect(rendered).toBe(whenGone);
    expect(clock.timers()).toBe(0);
    live.stop();
    expect(rendered).toBe(whenGone);
  });
});
