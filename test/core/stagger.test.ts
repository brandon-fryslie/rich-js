import { describe, expect, it } from "vitest";
import {
  Animation,
  ColorDepth,
  DEFAULT_TERMINAL_THEME,
  EASES,
  Group,
  Layout,
  RichText,
  Segment,
  Table,
  Timeline,
  Tree,
  beat,
  dissolveOut,
  fadeIn,
  frameAt,
  lifecycle,
  throughColors,
  onBeat,
  render,
  segmentsToString,
  type Lifecycle,
  type Renderable,
  type RenderOptions,
} from "../../src/index.js";
import { nextDown } from "./next-down.js";

// [LAW:behavior-not-structure] What is asserted is what a host sees of a
// stagger: each child's value at its own offset, and the group's word on when
// it changes, on the stagger's clock — failing on an early answer as well as
// a late one.

const OPTIONS: RenderOptions = { maxWidth: 40, colorSystem: ColorDepth.TRUECOLOR, height: { rows: 6, exact: false } };
const theme = DEFAULT_TERMINAL_THEME;
const draw = (renderable: Renderable): Segment[] => [...render(renderable, OPTIONS)];
const bytes = (renderable: Renderable): string => segmentsToString(draw(renderable), { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true });

/** `rate` samples a second from `from` to `to`. */
const sampled = (rate: number, from: number, to: number): number[] => Array.from({ length: Math.floor((to - from) * rate) + 1 }, (_, i) => from + i / rate);

/**
 * Row `i` entering at 0 on its own clock through a fade-in over `seconds`, stepped on `steps` when given.
 * Used here only as an animation that moves and then holds: a host that will tell rows to leave staggers them by `entered` instead.
 */
const row = (i: number, seconds: number, steps?: number): Lifecycle => {
  const fade = fadeIn({ seconds, ease: EASES.linear, swing: 1 }, i);
  const enter = steps === undefined ? fade : onBeat(fade, beat([steps]));
  return lifecycle(new RichText(`row ${i} arrived`, { style: "bold cyan" }), { enter: throughColors(enter, theme), exit: throughColors(dissolveOut({ seconds, ease: EASES.linear, swing: 1 }, i), theme), key: `row-${i}` }, 0);
};
const rows = (seconds: number, steps?: number): Lifecycle[] => [0, 1, 2].map((i) => row(i, seconds, steps));

describe("Timeline.stagger", () => {
  it("draws each child at the time since its own turn, the same bytes at one sample a second and sixty", () => {
    const children = rows(1);
    const staggered = Timeline.stagger(children, 0.5);
    const slow = new Map(sampled(1, 0, 3).map((t) => [t, staggered.at(t).map(bytes)]));
    // A fresh stagger for the fast host, as two hosts would hold.
    const fast = Timeline.stagger(rows(1), 0.5);
    for (const t of sampled(60, 0, 3)) {
      const drawn = fast.at(t).map(bytes);
      children.forEach((child, i) => expect(drawn[i]).toBe(bytes(child.at(t - i * 0.5))));
      if (slow.has(t)) expect(drawn).toEqual(slow.get(t));
    }
  });

  it("a child before its turn is asked for its own time before 0: a lifecycle draws nothing, a loop is shifted in phase", () => {
    const staggered = Timeline.stagger(rows(1), 0.5);
    expect(staggered.at(0.2).slice(1).map(bytes)).toEqual(["", ""]);
    const signal = Animation.map(beat([1, 1]), (i) => ["on", "off"][i]!);
    const pulse = Timeline.stagger([signal, signal, signal], 0.5);
    for (const t of [0, 0.25, 0.75, 1.6, 1e6, 1e6 + 0.7]) expect(pulse.at(t)).toEqual([0, 1, 2].map((i) => signal.at(t - i * 0.5)));
  });

  it("changes when the soonest child does, carried from that child's clock: a beat-stepped arrival wakes on its own beats", () => {
    const delay = 0.6;
    const children = rows(1, 0.25);
    const staggered = Timeline.stagger(children, delay);
    // At 0.8, row 0 turns at 1 and row 2 enters at 1.2, but row 1, 0.2 into its arrival, turns its first beat at 0.25 on its clock.
    const next = staggered.nextChange(0.8);
    expect(next).toBeCloseTo(0.85, 12);
    // Exact to the float: the frame before it is still row 1's frame of the last beat.
    const before = (x: number) => bytes(staggered.at(x)[1]!);
    expect(before(next)).not.toBe(before(0.8));
    expect(before(nextDown(next))).toBe(before(0.8));
  });

  it("holds still between one child arriving and the next entering, and never changes once every child has arrived", () => {
    const staggered = Timeline.stagger(rows(0.4), 1);
    expect(staggered.nextChange(0.2)).toBe(0.2);
    expect(staggered.nextChange(0.6)).toBe(1);
    // Row 0 finished arriving at 0.4, and nothing has moved since.
    expect(staggered.lastChange(0.6)).toBe(0.4);
    expect(staggered.nextChange(2.5)).toBe(Number.POSITIVE_INFINITY);
  });

  it("run backwards, turns exactly where the latest child became what it shows", () => {
    const signal = Animation.map(beat([1, 1]), (i) => ["on", "off"][i]!);
    // Host h asks the stagger for 3 - h: at host 1.4 the children are at 1.6, 1.1 and 0.6, and child 1 drops back under 1 first.
    const backwards = Timeline.run(Timeline.seek(Timeline.play(0, -1), 0, 3), Timeline.stagger([signal, signal, signal], 0.5));
    const next = backwards.nextChange(1.4);
    expect(next).toBeCloseTo(1.5, 12);
    expect(backwards.at(next)).not.toEqual(backwards.at(1.4));
    expect(backwards.at(nextDown(next))).toEqual(backwards.at(1.4));
  });

  it("a negative delay starts the last child at 0 and the first last", () => {
    const children = rows(1);
    const staggered = Timeline.stagger(children, -0.5);
    for (const t of sampled(60, 0, 3)) {
      const drawn = staggered.at(t).map(bytes);
      children.forEach((child, i) => expect(drawn[i]).toBe(bytes(child.at(t - (2 - i) * 0.5))));
    }
    expect(staggered.at(0).slice(0, 2).map(bytes)).toEqual(["", ""]);
  });

  it("refuses a delay that is not a finite number of seconds, by its name; an empty stagger never changes", () => {
    // 1e308 is finite, but two of it is not: the last child's origin is refused by the delay's name too.
    for (const delay of [Number.NaN, Number.POSITIVE_INFINITY, 1e308]) expect(() => Timeline.stagger(rows(1), delay)).toThrow(/Timeline\.stagger delay/);
    const none = Timeline.stagger<string>([], 0.5);
    expect([none.at(3), none.nextChange(3), none.lastChange(3)]).toEqual([[], Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]);
  });
});

describe("a stagger over any container, by composition", () => {
  const CONTAINERS: Record<string, (frames: readonly Renderable[]) => Renderable> = {
    Group: (frames) => new Group(...frames),
    "Table rows": (frames) => {
      const table = new Table();
      table.addColumn("step");
      for (const frame of frames) table.addRow(frame);
      return table;
    },
    "Tree children": (frames) => {
      const tree = new Tree("build");
      for (const frame of frames) tree.add(frame);
      return tree;
    },
    "Layout panes": (frames) => {
      const layout = new Layout();
      layout.splitColumn(...frames.map((frame) => new Layout(frame, { size: 1 })));
      return layout;
    },
  };

  for (const [name, laidOut] of Object.entries(CONTAINERS)) {
    it(`${name}: the drawn frame says when it changes as the stagger does, the same bytes at one sample a second and sixty`, () => {
      const shown = (steps?: number) => Animation.map(Timeline.stagger(rows(1, steps), 0.6), laidOut);
      for (const steps of [undefined, 0.25]) {
        const slow = new Map(sampled(1, 0, 3).map((t) => [t, bytes(frameAt(shown(steps), t))]));
        const fast = shown(steps);
        for (const t of sampled(60, 0, 3)) {
          const frame = frameAt(fast, t);
          expect(Segment.nextChange(draw(frame))).toBe(fast.nextChange(t));
          if (slow.has(t)) expect(bytes(frame)).toBe(slow.get(t));
        }
      }
    });
  }
});
