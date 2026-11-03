// rich-animation-xi28.6rs: a host can ask when what it draws next changes.
// Each animated primitive stamps its cells with the moment, the stamp rides
// up through every container, and the host reads the soonest off the frame
// it drew (`Segment.validUntil`): frames and stepped effects at their next
// step's start, a continuous loop every frame, a transition until it is
// done, still content never.

import { createEngine } from "@promptctl/go-template-js";
import { describe, expect, it } from "vitest";
import {
  Animation,
  ColorDepth,
  ColorRgba,
  EASES,
  EFFECT_CATALOGUE,
  Effected,
  FrameSequence,
  Group,
  Panel,
  RichText,
  Segment,
  Spinner,
  Style,
  Table,
  stepSequence,
  confined,
  sampleAndHold,
  steppedInk,
  type Drawn,
  type Effect,
  type Renderable,
} from "../../src/index.js";
import { CATPPUCCIN_MOCHA } from "../../src/themes/terminalThemes.js";
import { richTextFuncs, withAnimation } from "../../src/template-bindings/index.js";
import { SPINNERS } from "../../src/core/spinnerData.js";
import { inFrame } from "./in-frame.js";

// [LAW:behavior-not-structure] What is asserted is the answer a host reads
// off a rendered frame, never which object put it there.

const OPTIONS = { maxWidth: 40, colorSystem: ColorDepth.TRUECOLOR, terminal: CATPPUCCIN_MOCHA } as const;
const frames = (holds: readonly number[]): FrameSequence => new FrameSequence(holds.map((seconds, i) => ({ text: new RichText("abcd"[i]!), seconds })));
const validUntilOf = (renderable: Renderable, options: Parameters<Renderable["render"]>[0] = OPTIONS): number => Segment.validUntil(renderable.render(options));
const lit = (child: Renderable, effect: Effect, t: number): Renderable => inFrame(new Effected(child, effect, { key: "k" }), t);
const label = new RichText(" rich-js ", { style: Style.parse("#1e1e2e on #89b4fa"), end: "", noWrap: true });
/** A loop that moves every frame: a continuous function of t, promising no validity interval. */
const drifting: Effect = () => Animation.continuous((t) => (colors) => ({ ...colors, fg: new ColorRgba(Math.floor(t * 50) % 256, 0, 0) }));

describe("what a host reads off a frame: when it next changes", () => {
  it("still content never changes: text, a panel, a table", () => {
    const table = new Table();
    table.addColumn("a");
    table.addRow("still");
    for (const still of [new RichText("still"), new Panel("still"), table]) expect(validUntilOf(still)).toBe(Number.POSITIVE_INFINITY);
  });

  it("frames change at the next frame's start, from any t, far from zero too", () => {
    const seq = frames([1, 0.5, 2.5]);
    for (const [t, next] of [[0, 1], [0.99, 1], [1, 1.5], [1.4, 1.5], [1.5, 4], [5.2, 5.5], [1e6, 1e6 + 1]] as const) {
      expect(validUntilOf(inFrame(seq, t)), `t = ${t}`).toBe(next);
    }
  });

  it("the stamp rides through every container to whoever holds the composed frame", () => {
    const inner = frames([1, 1]);
    const table = new Table();
    table.addColumn("gauge");
    table.addRow(new Panel(new Group(new RichText("effort"), inner)));
    expect(validUntilOf(inFrame(table, 0.3))).toBe(1);
    expect(validUntilOf(new Panel(new RichText("still")))).toBe(Number.POSITIVE_INFINITY);
  });

  it("a blank frame among drawn ones still turns, and so does a frame of no cells", () => {
    const blink = new FrameSequence([{ text: new RichText("x"), seconds: 1 }, { text: new RichText(""), seconds: 1 }]);
    expect(validUntilOf(inFrame(blink, 1.5))).toBe(2);
    // An empty frame draws its one piece of no width, which carries the stamp: the
    // sequence turns at 2 whatever it draws there, an early answer the contract allows.
    const nothing = new FrameSequence([{ text: new RichText(""), seconds: 1 }, { text: new RichText(""), seconds: 1 }]);
    expect(validUntilOf(inFrame(nothing, 1.5))).toBe(2);
  });

  it("a spinner's label keeps an earlier word of its own on when it changes", () => {
    const label = new RichText("soon", { end: "" }).stylize(new Style({ validity: { validFrom: 0, validUntil: 0.001 } }));
    expect(validUntilOf(inFrame(new Spinner("dots", label), 0))).toBe(0.001);
  });

  it("a spinner's frame changes at the end of its interval, scaled by its speed", () => {
    const interval = SPINNERS["dots"]!.interval / 1000;
    const spinner = new Spinner("dots", "working");
    expect(validUntilOf(inFrame(spinner, 0))).toBeCloseTo(interval, 9);
    expect(validUntilOf(inFrame(spinner, interval * 2.5))).toBeCloseTo(interval * 3, 9);
    // The answer is on the host's timeline whatever the speed: at twice the
    // speed each frame is held half the interval, and backwards is still
    // forwards in time.
    expect(validUntilOf(inFrame(new Spinner("dots", "", { speed: 2 }), 0))).toBeCloseTo(interval / 2, 9);
    expect(validUntilOf(inFrame(new Spinner("dots", "", { speed: 2 }), interval * 1.2))).toBeCloseTo(interval * 1.5, 9);
    expect(validUntilOf(inFrame(new Spinner("dots", "", { speed: -1 }), interval * 2.5))).toBeCloseTo(interval * 3, 9);
    expect(validUntilOf(inFrame(new Spinner("dots", "", { speed: 0.5 }), interval * 2.5))).toBeCloseTo(interval * 4, 9);
  });

  it("a loop changes every frame: the answer is t itself, and a catalogue loop is a loop", () => {
    for (const t of [0, 7.25, 1e6]) {
      expect(validUntilOf(lit(label, drifting, t))).toBe(t);
      expect(validUntilOf(lit(label, EFFECT_CATALOGUE.loops.pulse({ z: 0 }), t))).toBe(t);
    }
  });

  it("a stepped signal changes at its next step's start", () => {
    const signal = steppedInk([
      { color: new ColorRgba(255, 85, 85), seconds: 0.4 },
      { color: new ColorRgba(80, 250, 123), seconds: 0.6 },
    ]);
    expect(validUntilOf(lit(label, signal, 0))).toBeCloseTo(0.4, 9);
    expect(validUntilOf(lit(label, signal, 0.5))).toBe(1);
    expect(validUntilOf(lit(label, signal, 1e6 + 0.1))).toBeCloseTo(1e6 + 0.4, 6);
  });

  it("an effect that moves every frame, sampled on a step sequence, changes when the step ends", () => {
    const held = sampleAndHold(drifting, stepSequence([1]));
    expect(validUntilOf(lit(label, held, 0.25))).toBe(1);
    expect(validUntilOf(lit(label, held, 3))).toBe(4);
  });

  it("sampled on a step sequence, an effect changes at the first step start it has moved by, and never once it is done", () => {
    // Steps of 2.5 s sampled every second: the step at 2.5 shows from the step at 3.
    const signal = steppedInk([{ color: new ColorRgba(255, 85, 85), seconds: 2.5 }, { color: new ColorRgba(80, 250, 123), seconds: 2.5 }]);
    const held = sampleAndHold(signal, stepSequence([1]));
    expect(validUntilOf(lit(label, held, 0.25))).toBe(3);
    expect(validUntilOf(lit(label, held, 2.5))).toBe(3);
    expect(validUntilOf(lit(label, held, 3.5))).toBe(5);
    // A transition that is done draws one frame from then on, however often the step sequence samples it.
    const fade = EFFECT_CATALOGUE.transitions.fade({ z: 0 }, { seconds: 2, ease: EASES.linear, swing: 0 });
    expect(validUntilOf(lit(label, sampleAndHold(fade.effect, stepSequence([1])), 0.5))).toBe(1);
    expect(validUntilOf(lit(label, sampleAndHold(fade.effect, stepSequence([1])), 2.5))).toBe(Number.POSITIVE_INFINITY);
  });

  it("a catalogue loop holds every cell still at a sixteen-color depth, and says its frame never changes there", () => {
    const sixteen = { ...OPTIONS, colorSystem: ColorDepth.STANDARD };
    for (const loop of Object.values(EFFECT_CATALOGUE.loops)) {
      expect(validUntilOf(lit(label, loop({ z: 0 }), 7.25), sixteen)).toBe(Number.POSITIVE_INFINITY);
      expect(validUntilOf(lit(label, loop({ z: 0 }), 7.25))).toBe(7.25);
    }
  });

  it("the effect is made from the one measure of the frame, and both its frame and its answer are asked of what it made", () => {
    const seen: Drawn[] = [];
    const asked: string[] = [];
    const watching: Effect = (drawn) => {
      seen.push(drawn);
      return {
        at: (t) => (asked.push(`at ${t}`), (colors) => colors),
        validUntil: (t) => (asked.push(`validUntil ${t}`), t),
        validFrom: (t) => (asked.push(`validFrom ${t}`), t),
        reduced: () => (asked.push("reduced"), Animation.constant((colors: Parameters<ReturnType<ReturnType<Effect>["at"]>>[0]) => colors)),
      };
    };
    [...lit(label, watching, 1).render(OPTIONS)];
    expect(seen).toHaveLength(1);
    expect([...asked].sort()).toEqual(["at 1", "validFrom 1", "validUntil 1"]);
  });

  it("the answer is made from the frame, so a composer may answer from what the inner effect says of it", () => {
    const stillUnder = (depth: ColorDepth): Effect => (drawn) => {
      const moving = drifting(drawn);
      return {
        at: (t) => moving.at(t),
        validUntil: (t) => (drawn.depth === depth ? Number.POSITIVE_INFINITY : t),
        validFrom: (t) => moving.validFrom(t),
        reduced: () => moving.reduced(),
      };
    };
    expect(validUntilOf(lit(label, stillUnder(ColorDepth.TRUECOLOR), 3))).toBe(Number.POSITIVE_INFINITY);
    expect(validUntilOf(lit(label, stillUnder(ColorDepth.EIGHT_BIT), 3))).toBe(3);
  });

  it("a transition changes every frame until it is done, and never after", () => {
    const fade = EFFECT_CATALOGUE.transitions.fade({ z: 0 }, { seconds: 2, ease: EASES.linear, swing: 0 });
    expect(validUntilOf(lit(label, fade.effect, 0))).toBe(0);
    expect(validUntilOf(lit(label, fade.effect, 1.99))).toBe(1.99);
    expect(fade.done(1.99)).toBe(false);
    expect(validUntilOf(lit(label, fade.effect, 2))).toBe(Number.POSITIVE_INFINITY);
    expect(fade.done(2)).toBe(true);
  });

  it("confined to an owner, an effect still says when it changes", () => {
    const signal = steppedInk([{ color: new ColorRgba(255, 85, 85), seconds: 0.5 }, { color: new ColorRgba(80, 250, 123), seconds: 0.5 }]);
    expect(validUntilOf(lit(label, confined(signal, label), 0.2))).toBe(0.5);
  });

  it("an effect over frames changes at whichever comes first", () => {
    const signal = steppedInk([{ color: new ColorRgba(255, 85, 85), seconds: 0.4 }, { color: new ColorRgba(80, 250, 123), seconds: 0.4 }]);
    const chevrons = frames([1, 1, 1]);
    expect(validUntilOf(lit(chevrons, signal, 0))).toBeCloseTo(0.4, 9);
    expect(validUntilOf(lit(chevrons, sampleAndHold(drifting, stepSequence([3])), 0))).toBe(1);
  });

  it("with no color output an effect changes nothing, so the frame changes when its child does", () => {
    const none = { maxWidth: 40, colorSystem: null };
    expect(validUntilOf(lit(label, drifting, 5), none)).toBe(Number.POSITIVE_INFINITY);
    expect(validUntilOf(lit(frames([1, 1]), drifting, 0.5), none)).toBe(1);
  });

  it("writes no byte: the same frame with and without the stamp is the same bytes", () => {
    const stamped = [...inFrame(frames([1, 1]), 0).render(OPTIONS)];
    const plain = [...new RichText("a", { end: "" }).render(OPTIONS)];
    expect(stamped.map((s) => s.text).join("")).toBe(plain.map((s) => s.text).join(""));
    expect(stamped.every((s) => s.style === undefined || s.style.toString() === "none")).toBe(true);
  });

  // The epic's host: a statusline redrawn once a second today, sixty a second
  // when that lands. From the answers alone it can tell which frames it skips.
  it("a host drawing once a second can tell it is skipping frames of a quarter-second sequence, and not of a one-second one", () => {
    const quarters = frames([0.25, 0.25, 0.25, 0.25]);
    const seconds = frames([1, 1, 1]);
    for (const t of [0, 1, 2, 3]) {
      const nextDraw = t + 1;
      expect(validUntilOf(inFrame(quarters, t))).toBeLessThan(nextDraw);
      expect(validUntilOf(inFrame(seconds, t))).toBe(nextDraw);
    }
    // Sixty a second, nothing is skipped: the next change is never before the next draw.
    for (let i = 0; i < 60; i++) {
      const t = i / 60;
      expect(validUntilOf(inFrame(quarters, t))).toBeGreaterThanOrEqual(t + 1 / 60 - 1e-9);
    }
  });

  it("a template's frames say when they turn, read off what was drawn", () => {
    let frameTime = 0;
    const engine = createEngine<RichText>(
      withAnimation({ fromString: (s) => new RichText(s), isT: (v) => v instanceof RichText, toString: (rt) => rt.plain, funcs: richTextFuncs() }, () => ({ time: frameTime })),
    );
    const gauge = engine.compile(`{{ "effort " }}{{ frames 0.25 "›" 0.25 "››" 0.25 "›››" }}{{ " max" }}`);
    const still = engine.compile(`{{ "effort " }}{{ "›››" }}`);
    frameTime = 1;
    expect(validUntilOf(RichText.fromFragments(gauge({})))).toBe(1.25);
    expect(validUntilOf(RichText.fromFragments(still({})))).toBe(Number.POSITIVE_INFINITY);
  });
});
