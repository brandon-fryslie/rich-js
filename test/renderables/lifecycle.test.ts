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
import { backspace, scrambleOut, typewriter } from "../../src/renderables/glyph-effects.js";
import { lifecycle, throughColors, throughGlyphs, type Lifecycle } from "../../src/renderables/lifecycle.js";
import { fakeClock } from "../core/fake-clock.js";

const theme = DEFAULT_TERMINAL_THEME;
const OPTIONS: RenderOptions = { maxWidth: 40, colorSystem: ColorDepth.TRUECOLOR };
const PLAIN: RenderOptions = { maxWidth: 40, colorSystem: null };
const curve = { seconds: 2, ease: EASES.linear, swing: 1 };

const line = new RichText("a line appended to the log", { style: "bold cyan" });
const draw = (renderable: Renderable, options: RenderOptions = OPTIONS): Segment[] => [...render(renderable, options)];
const bytes = (segments: Segment[]): string => segmentsToString(segments, { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true, reducedMotion: false });
const text = (segments: Segment[]): string => segments.map((s) => s.text).join("");

/** `rate` samples a second from `from` to `to`. */
const sampled = (rate: number, from: number, to: number): number[] => Array.from({ length: Math.floor((to - from) * rate) + 1 }, (_, i) => from + i / rate);

/** A line entering at 1 through a 2 s fade-in, told to leave at 5 through a 2 s dissolve: gone at 7. */
const made = (element: Renderable = line, entered = 1): Lifecycle =>
  lifecycle(element, { enter: throughColors(fadeIn(curve, 0), theme), exit: throughColors(dissolveOut(curve, 0), theme), key: "line" }, entered);

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
    const stepped = lifecycle(new RichText("x"), { enter: throughColors(fadeIn(curve, 0), theme), exit: throughColors(onBeat(dissolveOut(curve, 0), beat([0.25])), theme), key: "x" }, 1);
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
      const life = lifecycle(line, { enter: throughColors(fadeIn(curve, 0), theme), exit: throughColors(dissolveOut(exit, 0), theme), key: "line" }, 0).leave(left);
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

describe("a lifecycle through glyph transitions", () => {
  const timing = { seconds: 2, ease: EASES.linear };
  /** The line typed in from 1 over 2 s, told to leave at 5 and scrambled away over 2 s: gone at 7. */
  const typed = (exit = throughGlyphs(scrambleOut(timing, 0))): Lifecycle => lifecycle(line, { enter: throughGlyphs(typewriter(timing)), exit, key: "line" }, 1).leave(5);
  const shown = (life: Lifecycle, t: number, options = OPTIONS): string => text(draw(frameAt(life, t), options)).trimEnd();
  /** How many of the line's inked cells still show their own glyph. */
  const intact = (drawn: string): number => [...line.plain].filter((c, i) => c !== " " && drawn[i] === c).length;
  /** How many of the line's inked cells are drawn blank. */
  const blanked = (drawn: string): number => [...line.plain].filter((c, i) => c !== " " && (drawn[i] ?? " ") === " ").length;

  it("types itself in, stays whole, and is scrambled away until it is gone", () => {
    const life = typed();
    expect(shown(life, 1)).toBe("");
    expect(shown(life, 2)).toBe("a line append");
    for (const t of [3, 4.9, 5]) expect(bytes(draw(frameAt(life, t)))).toBe(bytes(draw(line)));
    // Leaving only ever takes the text away: its glyphs churn and then blank, never come back, all blank by the end.
    const leaving = [5.25, 5.5, 6, 6.5, 6.99].map((t) => shown(life, t));
    for (let i = 1; i < leaving.length; i++) {
      expect(intact(leaving[i]!)).toBeLessThanOrEqual(intact(leaving[i - 1]!));
      expect(blanked(leaving[i]!)).toBeGreaterThanOrEqual(blanked(leaving[i - 1]!));
    }
    expect(intact(leaving[0]!)).toBeLessThan(intact(line.plain));
    expect(intact(leaving.at(-1)!)).toBe(0);
    expect(blanked(leaving.at(-1)!)).toBe(blanked("") - 1);
    // A scramble keeps the blanks between words, so the words keep their shape while they churn.
    expect([...shown(life, 5.5)].map((c) => c === " ")).toEqual([...line.plain].map((c) => c === " "));
    expect(life.gone(6.99)).toBe(false);
    expect(life.gone(7)).toBe(true);
    expect(shown(life, 7)).toBe("");
  });

  it("can be backspaced away: erased from its last cell to its first, blank before it is gone", () => {
    const life = typed(throughGlyphs(backspace(timing)));
    expect(shown(life, 6)).toBe("a line append");
    expect(shown(life, 6.99)).toBe("a");
    expect(life.gone(7)).toBe(true);
  });

  it("says it moves every frame while it types and while it scrambles, and nothing between", () => {
    const life = typed();
    const said = (t: number) => [life.lastChange(t), life.nextChange(t)];
    for (const t of [1, 2, 2.9, 5, 6, 6.9]) expect(said(t)).toEqual([t, t]);
    expect(said(4)).toEqual([3, 5]);
    expect(said(8)).toEqual([7, Number.POSITIVE_INFINITY]);
  });

  it("types itself in with no colour output too, since a glyph is written at every depth", () => {
    const life = typed();
    expect(shown(life, 2, PLAIN)).toBe("a line append");
    expect(Segment.nextChange(draw(frameAt(life, 2), PLAIN))).toBe(2);
  });

  it("can type itself in and dissolve out: the exit's colours veil the glyphs the arrival left", () => {
    const life = typed(throughColors(dissolveOut(curve, 0), theme));
    expect(shown(life, 2)).toBe("a line append");
    // Told to leave mid-type, it goes on typing under the dissolve: the exit veils whatever the arrival draws.
    const early = lifecycle(line, { enter: throughGlyphs(typewriter(timing)), exit: throughColors(dissolveOut(curve, 0), theme), key: "line" }, 1).leave(2);
    expect(shown(early, 2.5)).toBe("a line appended to");
    expect(bytes(draw(frameAt(early, 2.5)))).not.toBe(bytes(draw(frameAt(typed(), 2.5))));
    expect(shown(life, 6)).toBe(line.plain);
    expect(bytes(draw(frameAt(life, 6)))).not.toBe(bytes(draw(line)));
    expect(life.gone(7)).toBe(true);
  });

  it("draws the same bytes for the same t at one frame a second and sixty", () => {
    const slow = new Map(sampled(1, 0, 8).map((t) => [t, bytes(draw(typed().at(t)))]));
    const fast = typed();
    for (const t of sampled(60, 0, 8)) if (slow.has(t)) expect(bytes(draw(fast.at(t)))).toBe(slow.get(t));
  });

  it("reduced, is the element whole from when it entered until it is told to leave", () => {
    const still = typed().reduced();
    expect(text(draw(still.at(0.5)))).toBe("");
    for (const t of [1, 2, 4.9]) expect(bytes(draw(still.at(t)))).toBe(bytes(draw(line)));
    expect(text(draw(still.at(5.5)))).toBe("");
  });
});
