// rich-animation-27tq.vmc: an effect's validity interval is known only from what it drew,
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
  stepSequence,
  type Effect,
  type GlyphEffect,
  type Renderable,
  type RenderOptions,
  type Behavior,
} from "../../src/index.js";
import { measure, render } from "../../src/core/protocol.js";
import { drawView } from "../../src/core/view.js";
import type { ValidityInterval } from "../../src/core/style.js";
import { CATPPUCCIN_MOCHA } from "../../src/themes/terminalThemes.js";
import { inFrame } from "./in-frame.js";

const OPTIONS = { maxWidth: 40, colorSystem: ColorDepth.TRUECOLOR, terminal: CATPPUCCIN_MOCHA } as const;
const NEVER = Number.POSITIVE_INFINITY;
const EVER = Number.NEGATIVE_INFINITY;

const label = new RichText(" rich-js ", { style: Style.parse("#1e1e2e on #89b4fa"), end: "", noWrap: true });
/** Reads every frame, promising no validity interval. */
const drifting: Effect = () => Animation.continuous((t) => (look) => ({ ...look, fg: new ColorRgba(Math.floor(t * 50) % 256, 0, 0) }));
/** Reads every frame where the element sets a color of its own, and holds where it sets none. */
const onItsColors: Effect = (drawn) => (drawn.colors.size === 0 ? Animation.constant((look) => look) : drifting(drawn));
/** Steps once a second. */
const stepping: Effect = () => Animation.sampleAndHold(Animation.continuous(() => (look) => look), stepSequence([1]));

const color = (key = "k"): Effected => new Effected(label, drifting, { key });
const glyph = (key = "k"): GlyphEffected => new GlyphEffected(label, GLYPH_EFFECT_CATALOGUE.loops.wave({ z: 0 }) as GlyphEffect, { key });

/** Each combinator, over a part, with the moments around 1 it changes of its own accord, on the frame's clock: the last, and the next. */
const combinators = (part: () => Behavior<Renderable>): readonly [string, Animation<Renderable>, number, number][] => [
  ["Timeline.run", Timeline.run(Timeline.play(0), part()), EVER, NEVER],
  ["Timeline.run at another rate", Timeline.run(Timeline.play(0, 2), part()), EVER, NEVER],
  ["Animation.map", Animation.map(part(), (value) => new Panel(value)), EVER, NEVER],
  ["Animation.all", Animation.map(Animation.all([part(), part()]), (values) => new Group(...values)), EVER, NEVER],
  ["Timeline.stagger", Animation.map(Timeline.stagger([part(), part()], 0.25), (values) => new Group(...values)), EVER, NEVER],
  ["Animation.sampleAndHold", Animation.sampleAndHold(part(), stepSequence([1])), EVER, NEVER],
  ["Animation.sequence, the first part", Animation.sequence<Renderable>(part(), 5, Animation.constant(label)), EVER, 5],
  ["Animation.sequence, the second part", Animation.sequence<Renderable>(Animation.constant(label), 0.5, part()), 0.5, NEVER],
  ["Animation.repeat", Animation.repeat(4, () => part()), 0, 4],
];

const validUntilOf = (renderable: Renderable, t: number, options: RenderOptions = OPTIONS): number => Segment.validUntil(render(inFrame(renderable, t), options));
const validFromOf = (renderable: Renderable, t: number, options: RenderOptions = OPTIONS): number => Segment.validFrom(render(inFrame(renderable, t), options));

describe("an effect held still at the output lets the host sleep, wherever it is placed", () => {
  const reduced = { ...OPTIONS, reducedMotion: true };
  const colorless = { ...OPTIONS, colorSystem: null };

  it("the ticket's case: under reduced motion in a timeline, it never changes", () => {
    expect(validUntilOf(Timeline.run(Timeline.play(0), color()), 1, reduced)).toBe(NEVER);
  });

  for (const [name, placed, last, next] of combinators(() => color())) {
    it(`a color effect in ${name}, reduced`, () => expect(validUntilOf(placed, 1, reduced)).toBe(next));
    it(`a color effect in ${name}, with no color`, () => expect(validUntilOf(placed, 1, colorless)).toBe(next));
    it(`a color effect in ${name}, with no color, run backwards`, () => expect(validFromOf(placed, 1, colorless)).toBe(last));
  }

  for (const [name, placed, , next] of combinators(() => glyph())) {
    it(`a glyph effect in ${name}, reduced`, () => expect(validUntilOf(placed, 1, reduced)).toBe(next));
  }

  it("a repeat whose turn builds its effect each time it is asked, reduced and with no color", () => {
    const placed = Animation.repeat(4, () => color());
    expect(validUntilOf(placed, 1, reduced)).toBe(4);
    expect(validUntilOf(placed, 1, colorless)).toBe(4);
  });

  it("a whole frame on a timeline says so to the host", () => {
    const view = Timeline.run(Timeline.play(0), color());
    const { validUntil } = drawView(view, { now: 1, timeline: Timeline.play(0), epoch: 0 }, {}, reduced, (drawn, options) => [[...render(drawn, options)]]);
    expect(validUntil).toBe(NEVER);
  });

  it("at no column it holds for good, moving or not, on its own and in a combinator", () => {
    const told: ValidityInterval[] = [];
    for (const placed of [color(), Timeline.run(Timeline.play(0), color()), new Panel(color())]) {
      for (const options of [OPTIONS, reduced, colorless]) [...render(inFrame(placed, 1), { ...options, maxWidth: 0, onValidity: (validity) => told.push(validity) })];
    }
    expect(told.map((validity) => validity.validUntil).filter((next) => next !== NEVER)).toEqual([]);
    expect(told.length).toBeGreaterThanOrEqual(6);
  });
});

describe("an effect over an element that draws no cell", () => {
  const empty: Renderable = { render: () => [] };
  const told = (placed: Renderable): number[] => {
    const holds: ValidityInterval[] = [];
    [...render(inFrame(placed, 1), { ...OPTIONS, onValidity: (validity) => holds.push(validity) })];
    return holds.map((validity) => validity.validUntil);
  };

  it("holds for good, moving or not", () => {
    expect(told(new Effected(empty, drifting, { key: "k" }))).toEqual([NEVER]);
    expect(told(new GlyphEffected(empty, GLYPH_EFFECT_CATALOGUE.loops.wave({ z: 0 }) as GlyphEffect, { key: "k" }))).toEqual([NEVER]);
  });

  it("wakes when the element says it will have cells", () => {
    const entering = Animation.sequence<Renderable>(Animation.constant(empty), 5, Animation.constant(label));
    expect(Math.min(...told(new Effected(entering, drifting, { key: "k" })))).toBe(5);
  });
});

describe("a moving effect still moves under a combinator", () => {
  for (const [name, placed] of combinators(() => color()).filter(([name]) => name !== "Animation.sampleAndHold")) {
    it(`in ${name}, it answers the frame's time`, () => expect(validUntilOf(placed, 1.25)).toBe(1.25));
  }

  it("on a step sequence, it holds to the step's end", () => {
    expect(validUntilOf(Animation.sampleAndHold(color(), stepSequence([1])), 1.25)).toBe(2);
  });

  it("a glyph effect with no color is written all the same", () => {
    expect(validUntilOf(Timeline.run(Timeline.play(0), glyph()), 1.25, { ...OPTIONS, colorSystem: null })).toBeLessThan(NEVER);
  });

  it("the drawing that reported is the one the frame shows, at the width a container narrowed it to", () => {
    const wide = { ...OPTIONS, maxWidth: 30 };
    const coloredWhenNarrow: Renderable = {
      render: (options) => [new Segment("words", options.maxWidth < 28 ? Style.parse("#1e1e2e on #89b4fa") : undefined)],
    };
    const panelled = Animation.map(new Effected(coloredWhenNarrow, onItsColors, { key: "k" }), (value) => new Panel(value));
    expect(validUntilOf(panelled, 1.25, wide)).toBe(1.25);
    expect(validUntilOf(new Effected(coloredWhenNarrow, onItsColors, { key: "k" }), 1.25, wide)).toBe(NEVER);
  });

  it("a moving element and a still one at one moment answer the moving one's time", () => {
    const moving = new Effected(label, onItsColors, { key: "a" });
    const still = new Effected(new RichText("plain", { end: "" }), onItsColors, { key: "b" });
    const both = Animation.map(Animation.all([still, moving]), (values) => new Group(...values));
    expect(validUntilOf(both, 1.25)).toBe(1.25);
  });

  it("a part drawn inside a placement in the value still reports to the animation it is a part of", () => {
    const moving = new Effected(label, onItsColors, { key: "a" });
    const still = new Effected(new RichText("plain", { end: "" }), onItsColors, { key: "b" });
    const nested = Animation.map(Animation.all([still, moving]), ([a, b]) => new Group(a, Animation.constant(b)));
    expect(validUntilOf(nested, 1.25)).toBe(1.25);
  });

  it("a part a container hides its drawing of stays early, whatever a sibling under another key told", () => {
    const hiding = (child: Renderable): Renderable => ({ render: (options) => render(child, { maxWidth: options.maxWidth, colorSystem: options.colorSystem ?? null }) });
    const moving = new Effected(label, drifting, { key: "a" });
    const still = new Effected(new RichText("plain", { end: "" }), onItsColors, { key: "b" });
    const hidden = Animation.map(Animation.all([still, moving]), ([a, b]) => new Group(a, hiding(b)));
    expect(validUntilOf(hidden, 1.25)).toBe(1.25);
  });

  it("a lone part a container hides its drawing of stays early", () => {
    const hiding = (child: Renderable): Renderable => ({ render: (options) => render(child, { maxWidth: options.maxWidth, colorSystem: options.colorSystem ?? null }) });
    const hidden = Animation.map(new Effected(label, drifting, { key: "a" }), (b) => hiding(b));
    expect(validUntilOf(hidden, 1.25)).toBe(1.25);
  });

  it("an effect never drawn answers the time it is asked at", () => {
    expect(color().validUntil(3)).toBe(3);
    expect(color().validFrom(3)).toBe(3);
  });
});

describe("the validity interval comes back on the host's clock", () => {
  const holdAt = (animation: Renderable, t: number): ValidityInterval => {
    const segments = [...render(inFrame(animation, t), OPTIONS)];
    return { validFrom: Segment.validFrom(segments), validUntil: Segment.validUntil(segments) };
  };
  const stepped = (): Effected => new Effected(label, stepping, { key: "k" });

  it("a stepped effect at twice speed changes at half the time, both ends of the validity interval", () => {
    const { validFrom, validUntil } = holdAt(Timeline.run(Timeline.play(0, 2), stepped()), 0.6);
    expect(validFrom).toBeCloseTo(0.5, 9);
    expect(validUntil).toBeCloseTo(1, 9);
  });

  it("run backwards, it next changes where the step began", () => {
    const { validFrom, validUntil } = holdAt(Timeline.run(Timeline.play(0, -1), stepped()), 0.25);
    expect(validFrom).toBeCloseTo(0, 9);
    expect(validUntil).toBeCloseTo(1, 9);
  });

  it("in a sequence's second part, the step is carried past the switch", () => {
    expect(holdAt(Animation.sequence<Renderable>(Animation.constant(label), 5, stepped()), 5.25).validUntil).toBe(6);
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

  it("a measurement draws nothing for the validity interval, and tells only what a layout can change on", () => {
    const { child, drawn } = counting();
    const measurable = { ...child, measure: () => ({ minimum: 5, maximum: 5 }) };
    const told: ValidityInterval[] = [];
    measure(Timeline.run(Timeline.play(0), new Effected(measurable, EFFECT_CATALOGUE.loops.pulse({ z: 0 }), { key: "k" })), inFramed(OPTIONS, told));
    expect(drawn()).toBe(0);
    expect(told.map((validity) => validity.validUntil)).toEqual([NEVER]);
  });

  it("a measurement that renders to learn its shape reports no drawing", () => {
    const told: string[] = [];
    const probing = {
      render: () => [],
      measure: (options: RenderOptions) => {
        [...render(color("probed"), options)];
        return { minimum: 1, maximum: 1 };
      },
    };
    measure(probing, { ...inFramed(OPTIONS, []), onReads: (_, key) => told.push(key) });
    expect(told).toEqual([]);
  });

  it("a combinator's own switch still reaches a measurement", () => {
    const told: ValidityInterval[] = [];
    measure(Animation.sequence<Renderable>(new Effected(label, drifting, { key: "k" }), 5, Animation.constant(label)), inFramed(OPTIONS, told));
    expect(told.map((validity) => validity.validUntil)).toEqual([5]);
  });
});

function inFramed(options: RenderOptions, told: ValidityInterval[]): RenderOptions {
  return { ...options, frame: { time: 1, host: {} }, onValidity: (validity) => told.push(validity) };
}
