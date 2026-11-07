import { describe, expect, it } from "vitest";
import { ALL_UNDERLINES } from "../../src/core/color.js";
import { Animation } from "../../src/core/animation.js";
import { ColorDepth } from "../../src/core/color.js";
import { EASES, WrapMode } from "../../src/core/easing.js";
import { Measurement } from "../../src/core/measure.js";
import { render, type Measurable, type Renderable, type RenderOptions } from "../../src/core/protocol.js";
import { segmentsToString } from "../../src/core/render.js";
import { Segment } from "../../src/core/segment.js";
import { RichText } from "../../src/core/text.js";
import { Timeline } from "../../src/core/timeline.js";
import { tween } from "../../src/core/tween.js";
import { drawView, hostView } from "../../src/core/view.js";
import { Constrain } from "../../src/renderables/constrain.js";
import { drawnAt, inFrame } from "./in-frame.js";
import { Group } from "../../src/renderables/group.js";
import { Rule } from "../../src/renderables/rule.js";
import { marquee, scroll } from "../../src/renderables/scroll.js";

const OPTIONS: RenderOptions = { maxWidth: 40, colorSystem: ColorDepth.TRUECOLOR };

const draw = (renderable: Renderable, options: RenderOptions = OPTIONS): Segment[] => [...render(renderable, options)];
const bytes = (segments: Segment[]): string => segmentsToString(segments, { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true, underlines: ALL_UNDERLINES, isTerminal: false, reducedMotion: false, textOrder: "plain" });
const rows = (segments: Segment[]): string[] => Segment.splitLines(segments).map((line) => line.map((s) => s.text).join(""));
const at = (col: number, row = 0, content: Renderable = LINE, size = { width: 6, height: 1 }): string[] =>
  rows(draw(scroll(content, { ...size, col: Animation.constant(col), row: Animation.constant(row) }).at(0)));

const LINE = new RichText("abcdefghij", { style: "bold cyan" });
const LOG = new Group(...["one", "two", "three", "four"].map((s) => new RichText(s)));

/** `rate` samples a second from `from` to `to`. */
const sampled = (rate: number, from: number, to: number): number[] => Array.from({ length: Math.floor((to - from) * rate) + 1 }, (_, i) => from + i / rate);

describe("scroll", () => {
  it("shows the content's cells from its offset, blank where the content has none, on either axis", () => {
    expect(at(0)).toEqual(["abcdef"]);
    expect(at(3)).toEqual(["defghi"]);
    expect(at(-2)).toEqual(["  abcd"]);
    expect(at(8)).toEqual(["ij    "]);
    expect(at(-6)).toEqual(["      "]);
    expect(at(10)).toEqual(["      "]);
    const tall = { width: 5, height: 2 };
    expect(at(0, 1, LOG, tall)).toEqual(["two  ", "three"]);
    expect(at(0, 3, LOG, tall)).toEqual(["four ", "     "]);
    expect(at(0, -1, LOG, tall)).toEqual(["     ", "one  "]);
    expect(at(1, 2, LOG, tall)).toEqual(["hree ", "our  "]);
  });

  it("rounds an offset to the nearest cell", () => {
    expect(at(2.4)).toEqual(at(2));
    expect(at(2.6)).toEqual(at(3));
  });

  it("measures as its slot, and draws exactly its slot, whatever the content", () => {
    for (const content of [LINE, LOG, new RichText("x"), new RichText("")]) {
      const frame = scroll(content, { width: 7, height: 3, col: Animation.continuous((t) => t * 5 - 9) });
      for (const t of [0, 1, 2, 3, 4]) {
        expect(Measurement.get(OPTIONS, frame.at(t))).toEqual(new Measurement(7, 7));
        const drawn = Segment.splitLines(draw(frame.at(t)));
        expect(drawn.map((line) => Segment.getLineLength(line))).toEqual([7, 7, 7]);
      }
    }
  });

  it("draws its content at the content's own width, and wraps it only when the content is constrained", () => {
    const long = new RichText("a line much wider than the forty cells the console offers here");
    expect(at(50, 0, long, { width: 13, height: 1 })).toEqual([long.plain.slice(50, 63).padEnd(13)]);
    expect(at(0, 1, new Constrain(new RichText("wrap me to ten cells"), 10), { width: 10, height: 1 })).toEqual(["ten cells "]);
  });

  it("blanks a wide glyph its edge falls in, never halving it", () => {
    const wide = new RichText("漢字漢字漢字");
    for (const col of [-1, 0, 1, 2, 3]) {
      const [row] = at(col, 0, wide, { width: 5, height: 1 });
      expect(Segment.getLineLength([new Segment(row!)])).toBe(5);
    }
    expect(at(1, 0, wide, { width: 5, height: 1 })).toEqual([" 字漢"]);
    expect(at(0, 0, wide, { width: 5, height: 1 })).toEqual(["漢字 "]);
  });

  it("keeps each cell's anchor naming its column in the content, so a moving window is hit-tested to its owner", () => {
    const owner = {};
    const anchored: Renderable & Measurable = {
      render: () => Segment.anchorLines([[new Segment("abcdefghij")]], owner).flatMap((line) => [...line, Segment.line()]),
      measure: () => ({ minimum: 10, maximum: 10 }),
    };
    for (const col of [-3, 0, 4]) {
      const lines = Segment.splitLines(draw(scroll(anchored, { width: 6, height: 1, col: Animation.constant(col) }).at(0)));
      for (let x = 0; x < 6; x++) {
        const anchor = Segment.anchorAt(lines, x, 0);
        const inContent = x + col >= 0 && x + col < 10;
        expect(anchor && { owner: anchor.owner, col: anchor.col }).toEqual(inContent ? { owner, col: x + col } : undefined);
      }
    }
  });

  it("draws the same bytes for the same moment at one sample a second and sixty, a million seconds in", () => {
    const marquee = (content: Renderable) =>
      scroll(content, { width: 6, height: 1, col: Animation.continuous((t) => WrapMode.loop(4)(t) * 16 - 6) });
    const slow = new Map(sampled(1, 1e6, 1e6 + 8).map((t) => [t, bytes(draw(marquee(LINE).at(t)))]));
    const fast = marquee(LINE);
    let checked = 0;
    for (const t of sampled(60, 1e6, 1e6 + 8)) {
      if (!slow.has(t)) continue;
      expect(bytes(draw(fast.at(t)))).toBe(slow.get(t));
      checked++;
    }
    expect(checked).toBe(9);
  });

  it("changes every frame while its offset moves, and never once a slide-in has arrived", () => {
    const marquee = scroll(LINE, { width: 6, height: 1, col: Animation.continuous((t) => WrapMode.loop(4)(t) * 16 - 6) });
    for (const t of [0, 1.5, 1e6]) expect(marquee.validUntil(t)).toBe(t);
    const slide = scroll(LINE, { width: 6, height: 1, col: tween(-6, 0, { seconds: 2, ease: EASES["ease-out"] }) });
    expect(slide.validUntil(1)).toBe(1);
    expect(slide.validUntil(2)).toBe(Number.POSITIVE_INFINITY);
    expect(rows(draw(slide.at(0)))).toEqual(["      "]);
    expect(rows(draw(slide.at(2)))).toEqual(["abcdef"]);
  });

  it("is cropped to a room narrower than its slot, never spilling past it", () => {
    const frame = scroll(LINE, { width: 10, height: 2 }).at(0);
    expect(Measurement.get({ ...OPTIONS, maxWidth: 4 }, frame)).toEqual(new Measurement(4, 4));
    expect(rows(draw(frame, { ...OPTIONS, maxWidth: 4 }))).toEqual(["abcd", "    "]);
  });

  it("refuses content with no natural width by name, and draws it once constrained to one", () => {
    const rule = new Rule();
    expect(() => draw(scroll(rule, { width: 6, height: 1 }).at(0))).toThrow(/no natural width.*Constrain/);
    expect(at(0, 0, new Constrain(rule, 8))).toEqual([rule.characters.repeat(6)]);
  });

  it("refuses an offset that is not a finite number of cells, and blanks one any distance outside", () => {
    for (const bad of [Number.NaN, Number.NEGATIVE_INFINITY]) {
      expect(() => scroll(LINE, { width: 6, height: 1, col: Animation.constant(bad) }).at(0)).toThrow(/col must be a finite/);
      expect(() => scroll(LINE, { width: 6, height: 1, row: Animation.constant(bad) }).at(0)).toThrow(/row must be a finite/);
    }
    expect(at(-1e12)).toEqual(["      "]);
    expect(at(1e12)).toEqual(["      "]);
  });

  it("keeps a frame's word on when it changes when the frame has no cells at the window's left edge or before it", () => {
    const nothing: Renderable & Measurable = { render: () => [], measure: () => ({ minimum: 0, maximum: 0 }) };
    const entering = inFrame(Animation.of({ at: () => nothing, validUntil: () => 5, validFrom: () => Number.NEGATIVE_INFINITY, reduced: () => Animation.constant<Renderable>(nothing) }), 0);
    const content = new Group(entering, new RichText("hello"), new RichText("world"), entering);
    expect(drawnAt(content, 0, OPTIONS).validUntil).toBe(5);
    for (const [col, row] of [[0, 0], [3, 0], [9, 0], [0, 2], [0, 3], [-9, 9]] as const) {
      const frame = scroll(content, { width: 3, height: 1, col: Animation.constant(col), row: Animation.constant(row) }).at(0);
      expect(drawnAt(frame, 0, OPTIONS).validUntil).toBe(5);
    }
    expect(drawnAt(scroll(entering, { width: 6, height: 1 }).at(0), 0, OPTIONS).validUntil).toBe(5);
  });

  it("writes nothing of the content left of its window, a combining mark included", () => {
    const marked = new RichText("aébcdef");
    expect(at(3, 0, marked, { width: 3, height: 1 })).toEqual(["cde"]);
  });

  it("refuses a slot that is not a positive whole number of cells", () => {
    for (const size of [{ width: 0, height: 1 }, { width: 3, height: 1.5 }, { width: Number.NaN, height: 1 }]) {
      expect(() => scroll(LINE, size)).toThrow(RangeError);
    }
  });

  it("drawn in a frame, every cell carries when it next changes, and a frame of no cells still does", () => {
    const marquee = scroll(LINE, { width: 6, height: 2, col: Animation.continuous((t) => t) });
    const cells = draw(inFrame(marquee, 3)).filter((s) => !s.isControl && s.text !== "\n");
    expect(cells.length).toBeGreaterThan(1);
    for (const segment of cells) expect(segment.style?.validity.validUntil).toBe(3);
    const empty = Animation.map(Animation.continuous((t) => t), (): Renderable => ({ render: () => [] }));
    expect(drawnAt(empty, 2, OPTIONS).validUntil).toBe(2);
  });

  describe("placed in a function view, on a nested timeline", () => {
    const host = Timeline.play(0);
    const drawn = (timeline: Timeline, animation: Animation<Renderable>, t: number) =>
      drawView(hostView(() => new Group(Timeline.run(timeline, animation))), { now: t, epoch: 0, timeline: host }, {}, OPTIONS, (r, options) => Segment.splitLines(draw(r, options)));
    const slide = scroll(LINE, { width: 6, height: 1, col: tween(-6, 0, { seconds: 2, ease: EASES.linear }) });

    it("at twice the speed, a slide-in says it moves until the host moment it arrives, and never after", () => {
      const fast = Timeline.play(0, 2);
      for (const t of [0, 0.5, 0.99]) expect(drawn(fast, slide, t).validUntil).toBe(t);
      expect(drawn(fast, slide, 1).validUntil).toBe(Number.POSITIVE_INFINITY);
    });

    it("paused mid-slide, says it never changes, so the host does not wake for it", () => {
      const paused = Timeline.pause(Timeline.play(0), 1);
      for (const t of [1, 5]) expect(drawn(paused, slide, t).validUntil).toBe(Number.POSITIVE_INFINITY);
    });
  });
});

describe("marquee", () => {
  const WORD = new RichText("abcd");
  const shown = (content: Renderable, t: number, width = 6): string[] => rows(draw(marquee(content, { width, step: 0.5 }).at(t)));

  it("moves one cell a step, leaves on the left, and enters again from the right, before 0 too", () => {
    expect(shown(WORD, 0)).toEqual(["abcd  "]);
    expect(shown(WORD, 0.5)).toEqual(["bcd   "]);
    expect(shown(WORD, 1.9)).toEqual(["d     "]);
    // A span of 4 + 6 = 10 steps: gone at step 4, entering at the right edge at step 5.
    expect(shown(WORD, 2)).toEqual(["      "]);
    expect(shown(WORD, 2.5)).toEqual(["     a"]);
    expect(shown(WORD, 5)).toEqual(["abcd  "]);
    expect(shown(WORD, -0.5)).toEqual([" abcd "]);
  });

  it("changes only on a step's boundary, at the start and a million seconds in", () => {
    const moving = marquee(WORD, { width: 6, step: 0.5 });
    expect(moving.validUntil(0.1)).toBe(0.5);
    expect(moving.validFrom(0.1)).toBe(0);
    expect(moving.validUntil(1_000_000.2)).toBeCloseTo(1_000_000.5, 6);
  });

  it("reduced, holds the content's start in view", () => {
    const still = marquee(WORD, { width: 6, step: 0.5 }).reduced();
    expect(rows(draw(still.at(3.7)))).toEqual(["abcd  "]);
    expect(still.validUntil(3.7)).toBe(Number.POSITIVE_INFINITY);
  });

  it("crosses content wider than its slot, and keeps every row of multi-row content", () => {
    expect(shown(LINE, 1)).toEqual(["cdefgh"]);
    expect(shown(LOG, 0.5, 4)).toEqual(["ne  ", "wo  ", "hree", "our "]);
  });

  it("cropped to a narrower room, crosses the slot it draws, entering at its right edge", () => {
    const cropped = (t: number) => rows(draw(marquee(WORD, { width: 6, step: 0.5 }).at(t), { ...OPTIONS, maxWidth: 3 }));
    // A span of 4 + 3 = 7 steps: gone at step 4, entering at the cropped edge at step 5.
    expect(cropped(1.5)).toEqual(["d  "]);
    expect(cropped(2)).toEqual(["   "]);
    expect(cropped(2.5)).toEqual(["  a"]);
    expect(cropped(3.5)).toEqual(["abc"]);
  });

  it("draws the same bytes for the same moment at one sample a second and sixty", () => {
    const moving = marquee(LINE, { width: 6, step: 0.25 });
    const once = sampled(1, 0, 10).map((t) => bytes(draw(moving.at(t))));
    const often = sampled(60, 0, 10).filter((_, i) => i % 60 === 0).map((t) => bytes(draw(moving.at(t))));
    expect(often).toEqual(once);
  });

  it("refuses a slot that is not a positive whole number of cells, and a step that is not a positive time", () => {
    expect(() => marquee(WORD, { width: 0, step: 1 })).toThrow(RangeError);
    expect(() => marquee(WORD, { width: 4, step: 0 })).toThrow(RangeError);
  });
});
