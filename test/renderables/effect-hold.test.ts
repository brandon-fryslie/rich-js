// rich-animation-27tq.vmc: an effect's hold is known only from what it drew,
// so the frame's one drawing tells it, and the combinators that remapped the
// time carry it back. An effect held still at the output lets the host sleep
// wherever it is placed.

import { describe, expect, it } from "vitest";
import {
  Animation,
  ColorDepth,
  ColorRgba,
  EFFECT_CATALOGUE,
  Effected,
  GLYPH_EFFECT_CATALOGUE,
  GlyphEffected,
  Group,
  Panel,
  RichText,
  Segment,
  Style,
  Timeline,
  beat,
  type Effect,
  type GlyphEffect,
  type Renderable,
  type RenderOptions,
  type Timed,
} from "../../src/index.js";
import { measure, render } from "../../src/core/protocol.js";
import { drawView } from "../../src/core/view.js";
import type { Hold } from "../../src/core/style.js";
import { CATPPUCCIN_MOCHA } from "../../src/themes/terminalThemes.js";
import { inFrame } from "./in-frame.js";

const OPTIONS = { maxWidth: 40, colorSystem: ColorDepth.TRUECOLOR, terminal: CATPPUCCIN_MOCHA } as const;
const NEVER = Number.POSITIVE_INFINITY;
const EVER = Number.NEGATIVE_INFINITY;

const label = new RichText(" rich-js ", { style: Style.parse("#1e1e2e on #89b4fa"), end: "", noWrap: true });
/** Moves every frame, promising no hold. */
const drifting: Effect = () => Animation.continuous((t) => (look) => ({ ...look, fg: new ColorRgba(Math.floor(t * 50) % 256, 0, 0) }));
/** Moves every frame where the element sets a colour of its own, and holds where it sets none. */
const onItsColours: Effect = (drawn) => (drawn.colors.size === 0 ? Animation.constant((look) => look) : drifting(drawn));
/** Steps once a second. */
const stepping: Effect = () => Animation.onBeat(Animation.continuous(() => (look) => look), beat([1]));

const colour = (key = "k"): Effected => new Effected(label, drifting, { key });
const glyph = (key = "k"): GlyphEffected => new GlyphEffected(label, GLYPH_EFFECT_CATALOGUE.loops.wave({ z: 0 }) as GlyphEffect, { key });

/** Each combinator, over a part, with the moments around 1 it changes of its own accord, on the frame's clock: the last, and the next. */
const combinators = (part: () => Timed<Renderable>): readonly [string, Animation<Renderable>, number, number][] => [
  ["Timeline.run", Timeline.run(Timeline.play(0), part()), EVER, NEVER],
  ["Timeline.run at another rate", Timeline.run(Timeline.play(0, 2), part()), EVER, NEVER],
  ["Animation.map", Animation.map(part(), (value) => new Panel(value)), EVER, NEVER],
  ["Animation.all", Animation.map(Animation.all([part(), part()]), (values) => new Group(...values)), EVER, NEVER],
  ["Timeline.stagger", Animation.map(Timeline.stagger([part(), part()], 0.25), (values) => new Group(...values)), EVER, NEVER],
  ["Animation.onBeat", Animation.onBeat(part(), beat([1])), EVER, NEVER],
  ["Animation.sequence, the first part", Animation.sequence<Renderable>(part(), 5, Animation.constant(label)), EVER, 5],
  ["Animation.sequence, the second part", Animation.sequence<Renderable>(Animation.constant(label), 0.5, part()), 0.5, NEVER],
  ["Animation.repeat", Animation.repeat(4, () => part()), 0, 4],
];

const nextChangeOf = (renderable: Renderable, t: number, options: RenderOptions = OPTIONS): number => Segment.nextChange(render(inFrame(renderable, t), options));
const lastChangeOf = (renderable: Renderable, t: number, options: RenderOptions = OPTIONS): number => Segment.lastChange(render(inFrame(renderable, t), options));

describe("an effect held still at the output lets the host sleep, wherever it is placed", () => {
  const reduced = { ...OPTIONS, reducedMotion: true };
  const colourless = { ...OPTIONS, colorSystem: null };

  it("the ticket's case: under reduced motion in a timeline, it never changes", () => {
    expect(nextChangeOf(Timeline.run(Timeline.play(0), colour()), 1, reduced)).toBe(NEVER);
  });

  for (const [name, placed, last, next] of combinators(() => colour())) {
    it(`a colour effect in ${name}, reduced`, () => expect(nextChangeOf(placed, 1, reduced)).toBe(next));
    it(`a colour effect in ${name}, with no colour`, () => expect(nextChangeOf(placed, 1, colourless)).toBe(next));
    it(`a colour effect in ${name}, with no colour, run backwards`, () => expect(lastChangeOf(placed, 1, colourless)).toBe(last));
  }

  for (const [name, placed, , next] of combinators(() => glyph())) {
    it(`a glyph effect in ${name}, reduced`, () => expect(nextChangeOf(placed, 1, reduced)).toBe(next));
  }

  it("a repeat whose turn builds its effect each time it is asked, reduced and with no colour", () => {
    const placed = Animation.repeat(4, () => colour());
    expect(nextChangeOf(placed, 1, reduced)).toBe(4);
    expect(nextChangeOf(placed, 1, colourless)).toBe(4);
  });

  it("a whole frame on a timeline says so to the host", () => {
    const view = Timeline.run(Timeline.play(0), colour());
    const { nextChange } = drawView(view, { now: 1, timeline: Timeline.play(0), epoch: 0 }, {}, reduced, (drawn, options) => [[...render(drawn, options)]]);
    expect(nextChange).toBe(NEVER);
  });

  it("placed on its own at no column, what the drawing says reaches the frame", () => {
    const told: Hold[] = [];
    for (const options of [reduced, colourless]) [...render(inFrame(colour(), 1), { ...options, maxWidth: 0, onHold: (hold) => told.push(hold) })];
    expect(told.map((hold) => hold.nextChange)).toEqual([NEVER, NEVER]);
  });
});

describe("a moving effect still moves under a combinator", () => {
  for (const [name, placed] of combinators(() => colour()).filter(([name]) => name !== "Animation.onBeat")) {
    it(`in ${name}, it answers the frame's time`, () => expect(nextChangeOf(placed, 1.25)).toBe(1.25));
  }

  it("on a beat, it holds to the beat's end", () => {
    expect(nextChangeOf(Animation.onBeat(colour(), beat([1])), 1.25)).toBe(2);
  });

  it("a glyph effect with no colour is written all the same", () => {
    expect(nextChangeOf(Timeline.run(Timeline.play(0), glyph()), 1.25, { ...OPTIONS, colorSystem: null })).toBeLessThan(NEVER);
  });

  it("the drawing that reported is the one the frame shows, at the width a container narrowed it to", () => {
    const wide = { ...OPTIONS, maxWidth: 30 };
    const colouredWhenNarrow: Renderable = {
      render: (options) => [new Segment("words", options.maxWidth < 28 ? Style.parse("#1e1e2e on #89b4fa") : undefined)],
    };
    const panelled = Animation.map(new Effected(colouredWhenNarrow, onItsColours, { key: "k" }), (value) => new Panel(value));
    expect(nextChangeOf(panelled, 1.25, wide)).toBe(1.25);
    expect(nextChangeOf(new Effected(colouredWhenNarrow, onItsColours, { key: "k" }), 1.25, wide)).toBe(NEVER);
  });

  it("a moving element and a still one at one moment answer the moving one's time", () => {
    const moving = new Effected(label, onItsColours, { key: "a" });
    const still = new Effected(new RichText("plain", { end: "" }), onItsColours, { key: "b" });
    const both = Animation.map(Animation.all([still, moving]), (values) => new Group(...values));
    expect(nextChangeOf(both, 1.25)).toBe(1.25);
  });

  it("a part drawn inside a placement in the value still reports to the animation it is a part of", () => {
    const moving = new Effected(label, onItsColours, { key: "a" });
    const still = new Effected(new RichText("plain", { end: "" }), onItsColours, { key: "b" });
    const nested = Animation.map(Animation.all([still, moving]), ([a, b]) => new Group(a, Animation.constant(b)));
    expect(nextChangeOf(nested, 1.25)).toBe(1.25);
  });

  it("a part a container hides its drawing of stays early, whatever a sibling told", () => {
    const hiding = (child: Renderable): Renderable => ({ render: (options) => render(child, { maxWidth: options.maxWidth, colorSystem: options.colorSystem ?? null }) });
    const moving = new Effected(label, drifting, { key: "a" });
    const still = new Effected(new RichText("plain", { end: "" }), onItsColours, { key: "b" });
    const hidden = Animation.map(Animation.all([still, moving]), ([a, b]) => new Group(a, hiding(b)));
    expect(nextChangeOf(hidden, 1.25)).toBe(1.25);
  });

  it("an effect never drawn answers the time it is asked at", () => {
    expect(colour().nextChange(3)).toBe(3);
    expect(colour().lastChange(3)).toBe(3);
  });
});

describe("the hold comes back on the host's clock", () => {
  const holdAt = (animation: Renderable, t: number): Hold => {
    const segments = [...render(inFrame(animation, t), OPTIONS)];
    return { lastChange: Segment.lastChange(segments), nextChange: Segment.nextChange(segments) };
  };
  const stepped = (): Effected => new Effected(label, stepping, { key: "k" });

  it("a stepped effect at twice speed changes at half the time, both ends of the hold", () => {
    const { lastChange, nextChange } = holdAt(Timeline.run(Timeline.play(0, 2), stepped()), 0.6);
    expect(lastChange).toBeCloseTo(0.5, 9);
    expect(nextChange).toBeCloseTo(1, 9);
  });

  it("run backwards, it next changes where the step began", () => {
    const { lastChange, nextChange } = holdAt(Timeline.run(Timeline.play(0, -1), stepped()), 0.25);
    expect(lastChange).toBeCloseTo(0, 9);
    expect(nextChange).toBeCloseTo(1, 9);
  });

  it("in a sequence's second part, the step is carried past the switch", () => {
    expect(holdAt(Animation.sequence<Renderable>(Animation.constant(label), 5, stepped()), 5.25).nextChange).toBe(6);
  });
});

describe("one frame, one drawing", () => {
  const counting = (): { child: Renderable; drawn: () => number } => {
    let draws = 0;
    return {
      child: {
        render: () => {
          draws += 1;
          return [new Segment("words")];
        },
      },
      drawn: () => draws,
    };
  };

  it("an effect under a combinator draws its child once", () => {
    const { child, drawn } = counting();
    [...render(inFrame(Timeline.run(Timeline.play(0), new Effected(child, drifting, { key: "k" })), 1), OPTIONS)];
    expect(drawn()).toBe(1);
  });

  it("nesting does not multiply the drawing", () => {
    const { child, drawn } = counting();
    const inner = Timeline.run(Timeline.play(0), new Effected(child, drifting, { key: "a" }));
    [...render(inFrame(Timeline.run(Timeline.play(0), new Effected(inner, drifting, { key: "b" })), 1), OPTIONS)];
    expect(drawn()).toBe(1);
  });

  it("a measurement draws nothing for the hold, and tells only what a layout can change on", () => {
    const { child, drawn } = counting();
    const measurable = { ...child, measure: () => ({ minimum: 5, maximum: 5 }) };
    const told: Hold[] = [];
    measure(Timeline.run(Timeline.play(0), new Effected(measurable, EFFECT_CATALOGUE.loops.pulse({ z: 0 }), { key: "k" })), inFramed(OPTIONS, told));
    expect(drawn()).toBe(0);
    expect(told.map((hold) => hold.nextChange)).toEqual([NEVER]);
  });

  it("a combinator's own switch still reaches a measurement", () => {
    const told: Hold[] = [];
    measure(Animation.sequence<Renderable>(new Effected(label, drifting, { key: "k" }), 5, Animation.constant(label)), inFramed(OPTIONS, told));
    expect(told.map((hold) => hold.nextChange)).toEqual([5]);
  });
});

function inFramed(options: RenderOptions, told: Hold[]): RenderOptions {
  return { ...options, frame: { time: 1, host: {} }, onHold: (hold) => told.push(hold) };
}
