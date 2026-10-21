/**
 * An animation is placed like any renderable and draws at the frame's time.
 *
 * The proof that the one way to write an animation needs nothing from the
 * container it sits in: `Box` below is declared here, not imported from
 * rich-js, and draws its children through their own `render`, as a
 * third-party container would. An animation and an effect placed in it are
 * drawn by an `App` on a fake clock and draw at the frame's time, wake the
 * app at the soonest change, sleep where nothing can move, hold under a
 * paused timeline and reduce under reduced motion — and the library's own
 * containers give the same frames and the same wakes, with no edit made to
 * any of them for animations.
 *
 * [LAW:behavior-not-structure] What is asserted is what the app paints and
 * when: the bytes it writes, at the clock moments it writes them.
 */

import { describe, expect, it } from "vitest";
import { App } from "../../src/host/app.js";
import { scriptedHost } from "../host/scripted-host.js";
import { fakeClock } from "../core/fake-clock.js";
import { frameRate } from "../../src/core/clock.js";
import { Animation } from "../../src/core/animation.js";
import { EASES, Phase } from "../../src/core/easing.js";
import { Timeline } from "../../src/core/timeline.js";
import { tween } from "../../src/core/tween.js";
import { render, type Renderable, type RenderOptions } from "../../src/core/protocol.js";
import { Segment } from "../../src/core/segment.js";
import { Style } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import { ColorRgba } from "../../src/core/color.js";
import { Console } from "../../src/core/console.js";
import { ColorRamp } from "../../src/themes/ramp.js";
import { CATPPUCCIN_MOCHA } from "../../src/themes/terminalThemes.js";
import { Columns } from "../../src/renderables/columns.js";
import { Effected } from "../../src/renderables/effect.js";
import { drawnAt, inFrame } from "./in-frame.js";
import { dissolveOut, fadeIn, gradient } from "../../src/renderables/effects.js";
import { Group } from "../../src/renderables/group.js";
import { Layout } from "../../src/renderables/layout.js";
import { Panel } from "../../src/renderables/panel.js";
import { Rule } from "../../src/renderables/rule.js";
import { scroll } from "../../src/renderables/scroll.js";
import { Table } from "../../src/renderables/table.js";
import { Tree } from "../../src/renderables/tree.js";
import { lifecycle, throughColors, type Lifecycle } from "../../src/renderables/lifecycle.js";
import { DEFAULT_TERMINAL_THEME } from "../../src/themes/terminalThemes.js";

/** A container written by a user: each child drawn through its own `render`, a line after each. */
class Box implements Renderable {
  readonly children: readonly Renderable[];
  constructor(...children: Renderable[]) {
    this.children = children;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    for (const child of this.children) {
      yield* child.render(options);
      yield Segment.line();
    }
  }
}

/** A container written by a user that cuts each child into its rows and frames every row, as a third-party list or border would. */
class Rows implements Renderable {
  readonly children: readonly Renderable[];
  constructor(...children: Renderable[]) {
    this.children = children;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    for (const child of this.children) {
      for (const line of Segment.splitLines(child.render(options))) {
        yield new Segment("|");
        yield* line;
        yield new Segment("|");
        yield Segment.line();
      }
    }
  }
}

const SYNC_START = "\x1b[?2026h";
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const linear = (seconds: number) => ({ seconds, ease: EASES.linear });
const curve = { seconds: 2, ease: EASES.linear, swing: 1 };

/** A count from 0 to 10 over 2 s, drawn as its value. */
const counting = (): Animation<RichText> => Animation.map(tween(0, 10, linear(2)), (v) => new RichText(`n=${v.toFixed(1)}`, { end: "" }));

/** A rule under a ramp scrolling forever: moving every frame wherever its colours can move. */
const ramped = (): Effected => {
  const hues = new ColorRamp(EASES.linear, [
    { at: 0, color: new ColorRgba(255, 120, 100) },
    { at: 0.5, color: new ColorRgba(110, 190, 255) },
    { at: 1, color: new ColorRgba(255, 120, 100) },
  ]);
  const line = "#a6e3a1";
  return new Effected(new Rule("x", { style: line }), gradient(hues.moving({ scroll: Animation.continuous(Phase.loop(4)) }), [line]), { key: "ramp", theme: CATPPUCCIN_MOCHA });
};

interface Run {
  /** The clock moment of every paint. */
  readonly paints: readonly number[];
  /** The app's frame now, as text. */
  readonly text: () => string;
  /** Timers still armed. */
  readonly timers: () => number;
  readonly app: App;
  readonly clock: ReturnType<typeof fakeClock>;
}

/** `view` run by an app on a fake clock at `perSecond`, on `env`'s terminal. */
function run(view: Renderable, options: { perSecond: number; seconds: number; env?: Record<string, string>; timeline?: Timeline; reducedMotion?: boolean }): Run {
  const clock = fakeClock();
  const paints: number[] = [];
  const base = scriptedHost({ cols: 40, rows: 10 });
  const host = {
    ...base,
    env: options.env ?? base.env,
    write(data: string | Uint8Array) {
      if (String(data).includes(SYNC_START)) paints.push(clock.now());
      base.write(data);
    },
  };
  const app = new App({ host, surface: "alternate", clock, rate: frameRate(options.perSecond), view, timeline: options.timeline, reducedMotion: options.reducedMotion });
  void app.run();
  clock.advance(options.seconds);
  const text = () => app.frame.map((line) => line.map((s) => s.text).join("")).join("\n");
  return { paints, text, timers: () => clock.timers(), app, clock };
}

const SIXTEEN = { TERM: "xterm" };
const TRUECOLOR = { TERM: "xterm-256color", COLORTERM: "truecolor" };

/** Each library container holding `child`, beside the user's `Box`. */
const CONTAINERS: readonly [string, (child: Renderable) => Renderable][] = [
  ["Box", (child) => new Box(child)],
  ["Panel", (child) => new Panel(child)],
  [
    "Table",
    (child) => {
      const table = new Table();
      table.addColumn("c");
      table.addRow(child);
      return table;
    },
  ],
  ["Columns", (child) => new Columns([child])],
  ["Layout", (child) => new Layout(child)],
  ["Group", (child) => new Group(child)],
];

describe("an animation placed in a container written by the user", () => {
  it("draws at the frame's time, wakes the app every frame while it moves, and sleeps once it arrives", () => {
    const { paints, text, timers } = run(new Box(counting()), { perSecond: 10, seconds: 3 });
    expect(text()).toContain("n=10.0");
    // Painted at the start, at the rate while the count moves, and never after it arrives at 2.
    expect(paints[0]).toBe(0);
    expect(paints.at(-1)).toBeCloseTo(2, 9);
    expect(paints.length).toBeGreaterThanOrEqual(20);
    expect(timers()).toBe(0);
  });

  it("an effect moves at every frame where its colours can, and sleeps at sixteen colours where they cannot", () => {
    const moving = run(new Box(ramped()), { perSecond: 10, seconds: 1, env: TRUECOLOR });
    expect(moving.paints.length).toBeGreaterThanOrEqual(10);
    expect(moving.timers()).toBe(1);
    const still = run(new Box(ramped()), { perSecond: 10, seconds: 1, env: SIXTEEN });
    expect(still.paints).toEqual([0]);
    expect(still.timers()).toBe(0);
  });

  it("holds under a paused timeline: one paint at the held time, nothing armed", () => {
    const { paints, text, timers } = run(new Box(counting()), { perSecond: 10, seconds: 2, timeline: Timeline.pause(Timeline.play(0), 0.5) });
    expect(paints).toEqual([0]);
    expect(text()).toContain("n=2.5");
    expect(timers()).toBe(0);
  });

  it("draws reduced under reduced motion: the count cut to where it arrives, nothing armed", () => {
    const { paints, text, timers } = run(new Box(counting(), ramped()), { perSecond: 10, seconds: 2, env: TRUECOLOR, reducedMotion: true });
    expect(paints).toEqual([0]);
    expect(text()).toContain("n=10.0");
    expect(timers()).toBe(0);
  });

  it("run backwards after it arrived, wakes the app where the count ended and draws it running back", async () => {
    const clock = fakeClock();
    const paints: number[] = [];
    const base = scriptedHost({ cols: 40, rows: 4 });
    const host = { ...base, write: (data: string | Uint8Array) => (String(data).includes(SYNC_START) && paints.push(clock.now()), base.write(data)) };
    const app = new App({ host, surface: "alternate", clock, rate: frameRate(10), view: new Box(counting()) });
    void app.run();
    clock.advance(5);
    expect(app.frame[0]!.map((s) => s.text).join("")).toContain("n=10.0");
    const arrived = paints.length;
    // At 5 s on the timeline, from clock 5, running backwards: the count ended at 2, reached at clock 8.
    app.timeline = Timeline.withRate(app.timeline, clock.now(), -1);
    await tick();
    clock.advance(3.5);
    const woken = paints.slice(arrived + 1);
    expect(woken[0]).toBeGreaterThan(8 - 1e-9);
    expect(woken[0]).toBeCloseTo(8, 9);
    expect(app.frame[0]!.map((s) => s.text).join("")).toMatch(/n=[0-9]\.[0-9]/);
    expect(app.frame[0]!.map((s) => s.text).join("")).not.toContain("n=10.0");
    app.stop();
  });

  it.each(CONTAINERS)("in a %s, paints the same moments as in the user's container, and shows the frame's value", (_, contain) => {
    const box = run(new Box(counting()), { perSecond: 10, seconds: 3 });
    const contained = run(contain(counting()), { perSecond: 10, seconds: 3 });
    expect(contained.paints).toEqual(box.paints);
    expect(contained.text()).toContain("n=10.0");
    const effected = run(contain(ramped()), { perSecond: 10, seconds: 1, env: SIXTEEN });
    expect(effected.paints).toEqual([0]);
  });
});

describe("an animation placed showing nothing", () => {
  /** A toast that enters at 1 s, fading in over 2: before 1 it shows nothing. */
  const entering = (): Lifecycle =>
    lifecycle(new RichText("toast", { end: "" }), { enter: throughColors(fadeIn(curve, 0), DEFAULT_TERMINAL_THEME), exit: throughColors(dissolveOut(curve, 0), DEFAULT_TERMINAL_THEME), key: "toast" }, 1);
  const rowsOf: readonly [string, (child: Renderable) => Renderable][] = [
    ["Rows", (child) => new Rows(new RichText("above", { end: "" }), child, new RichText("below", { end: "" }))],
    ...CONTAINERS,
    ["Tree", (child) => new Tree("root").add(child)],
  ];

  it.each(rowsOf)("in a %s, takes the rows static nothing takes until it enters, and wakes the app when it does", (_, contain) => {
    // Drawn with no height to fill, so a row the container pads to a region cannot hide a row it was handed.
    const rows = (child: Renderable): string[] => drawnAt(contain(child), 0.5, { maxWidth: 40 }).lines.map((line) => line.map((s) => s.text).join(""));
    expect(rows(entering())).toEqual(rows(new Group()));
    const placed = run(contain(entering()), { perSecond: 10, seconds: 0.5 });
    expect(placed.paints).toEqual([0]);
    placed.clock.advance(1);
    expect(placed.paints[1]).toBeCloseTo(1, 9);
    expect(placed.text()).toContain("toast");
    placed.app.stop();
  });
});

describe("what a placed animation draws inside another animation's frame", () => {
  it("draws at the frame's time, and its stamp is read on the host's clock", () => {
    // A count over 10 s, inside the second part of a sequence that switches at 2.
    const inner = Animation.map(tween(0, 10, linear(10)), (v) => new RichText(`n=${v.toFixed(1)}`, { end: "" }));
    const outer = Animation.sequence(Animation.constant<Renderable>(new RichText("first", { end: "" })), 2, Animation.constant<Renderable>(new Panel(inner)));
    const { app, paints, text } = run(new Box(outer), { perSecond: 10, seconds: 3 });
    // The frame's 3, never the part's 1.
    expect(text()).toContain("n=3.0");
    // The count moves, and says so on the host's clock: a paint every frame through the switch and on.
    expect(paints.filter((at) => at > 2).length).toBeGreaterThanOrEqual(9);
    app.stop();
  });

  it("a scroll whose content gained a row above the window at 3, run backwards past 3, wakes the host there and shifts back", () => {
    const entering = Animation.sequence(Animation.constant<Renderable>(new Group()), 3, Animation.constant<Renderable>(new RichText("new")));
    const content = new Group(entering, new RichText("a"), new RichText("b"));
    const window = scroll(content, { width: 6, height: 1, row: Animation.constant(1) });
    const clock = fakeClock();
    const paints: number[] = [];
    const base = scriptedHost({ cols: 20, rows: 3 });
    const host = { ...base, write: (data: string | Uint8Array) => (String(data).includes(SYNC_START) && paints.push(clock.now()), base.write(data)) };
    const shown = () => app.frame[0]!.map((s) => s.text).join("").trim();
    const app = new App({ host, surface: "alternate", clock, rate: frameRate(10), view: new Box(window), timeline: Timeline.seek(Timeline.play(0, -1), 0, 5) });
    void app.run();
    expect(shown()).toBe("a");
    clock.advance(3);
    // Timeline 3 is clock 2: the row left there, and the window shows the row that was second again.
    expect(paints.length).toBe(2);
    expect(paints[1]).toBeCloseTo(2, 9);
    expect(shown()).toBe("b");
    app.stop();
  });
});

describe("the type says which animations are placed", () => {
  it("refuses an animation of numbers or of a tuple where a renderable goes", () => {
    const text = counting();
    // @ts-expect-error a tween of a number is no renderable
    void (() => new Panel(tween(0, 1, linear(1))));
    // @ts-expect-error several at once is a tuple of renderables, not one
    void (() => new Panel(Animation.all([text, text])));
    expect(new Panel(text)).toBeInstanceOf(Panel);
  });

  it("an animation of numbers drawn from untyped code throws, naming what to do", () => {
    const untyped: unknown = Animation.of({ at: () => 5, nextChange: () => Number.POSITIVE_INFINITY, lastChange: () => Number.NEGATIVE_INFINITY, reduced: () => Animation.constant(5) });
    const console = new Console({ width: 20, file: { write: () => {} } });
    expect(() => console.print(untyped)).toThrow(new TypeError("an Animation is drawn only when its values are renderables; place what it maps to (Animation.map)"));
  });

  it("a printed animation draws at 0, the start of its own clock", () => {
    const lines: string[] = [];
    const console = new Console({ width: 20, file: { write: (s: string) => void lines.push(s) } });
    console.print(counting());
    expect(lines.join("")).toContain("n=0.0");
  });
});

describe("an animation drawn in a frame on an output of no colour", () => {
  const NO_COLOR: RenderOptions = { maxWidth: 40, colorSystem: null };
  const drawn = (renderable: Renderable) => [...render(renderable, NO_COLOR)];

  it("an effect whose colours cannot move says it never changes", () => {
    for (const t of [0, 3, 30]) expect(Segment.nextChange(drawn(inFrame(ramped(), t)))).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("Animation.of keeps what it is handed", () => {
  it("a class instance keeps the methods on its prototype", () => {
    class Steps {
      at(t: number): RichText {
        return new RichText(`step ${Math.floor(t)}`, { end: "" });
      }
      nextChange(t: number): number {
        return Math.floor(t) + 1;
      }
      lastChange(t: number): number {
        return Math.floor(t);
      }
      reduced(): Animation<RichText> {
        return Animation.constant(this.at(0));
      }
    }
    const steps = Animation.of(new Steps());
    const segments = [...render(steps, { maxWidth: 20, frame: { time: 2.5, host: { frameTime: 2.5 } } })];
    expect(segments.map((s) => s.text).join("")).toBe("step 2");
    expect(Segment.nextChange(segments)).toBe(3);
    expect(Segment.lastChange(segments)).toBe(2);
  });
});

describe("a cell's hold is both its ends or neither", () => {
  it("refuses a style saying only when it next changes", () => {
    // @ts-expect-error a hold with one end would claim the cell always was
    void (() => new Style({ nextChange: 3 }));
    expect(new Style({ hold: { lastChange: 1, nextChange: 3 } }).hold.lastChange).toBe(1);
  });
});
