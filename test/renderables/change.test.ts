import { describe, expect, it } from "vitest";
import { ColorDepth } from "../../src/core/color.js";
import { DEFAULT_TERMINAL_THEME } from "../../src/index.js";
import { EASES } from "../../src/core/easing.js";
import { Measurement } from "../../src/core/measure.js";
import { render, type Renderable, type RenderOptions } from "../../src/core/protocol.js";
import { segmentsToString } from "../../src/core/render.js";
import { Segment } from "../../src/core/segment.js";
import { RichText } from "../../src/core/text.js";
import { crossfade, wipe, type Change } from "../../src/renderables/change.js";
import type { Transition } from "../../src/renderables/effects.js";
import { frameAt } from "../../src/renderables/frames.js";

const theme = DEFAULT_TERMINAL_THEME;
const OPTIONS: RenderOptions = { maxWidth: 40, colorSystem: ColorDepth.TRUECOLOR };
const curve = { seconds: 2, ease: EASES.linear, swing: 1 };

const building = new RichText("building the project", { style: "bold yellow" });
const done = new RichText("done ✓", { style: "green" });
const tall = new RichText("one\ntwo\nthree", { style: "cyan" });
const wide = new RichText("漢字漢字漢字漢字漢字", { style: "magenta" });

const draw = (renderable: Renderable, options: RenderOptions = OPTIONS): Segment[] => [...render(renderable, options)];
const bytes = (segments: Segment[]): string => segmentsToString(segments, { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true, reducedMotion: false });
const text = (segments: Segment[]): string => segments.map((s) => s.text).join("");
const rows = (segments: Segment[]): number[] => Segment.splitLines(segments).map((line) => Segment.getLineLength(line));

/** `rate` samples a second from 0 to `seconds`. */
const sampled = (rate: number, seconds: number): number[] => Array.from({ length: Math.floor(seconds * rate) + 1 }, (_, i) => i / rate);

const CHANGES: readonly [string, Transition<Change>][] = [
  ["crossfade", crossfade(curve)],
  ["wipe", wipe(curve)],
];

describe("a change from one renderable to another", () => {
  for (const [name, change] of CHANGES) {
    const between = (from: Renderable, to: Renderable) => change.effect({ from, to, theme });

    it(`${name}: draws the same bytes for the same t at one frame a second and sixty`, () => {
      const moving = between(building, done);
      const slow = new Map(sampled(1, 3).map((t) => [t, bytes(draw(frameAt(moving, t)))]));
      for (const t of sampled(60, 3)) if (slow.has(t)) expect(bytes(draw(frameAt(moving, t)))).toBe(slow.get(t));
    });

    it(`${name}: is drawn at the new renderable's shape from its first frame, whatever the old one's`, () => {
      for (const [from, to] of [
        [building, done],
        [done, building],
        [tall, done],
        [done, tall],
        [wide, done],
        [done, wide],
      ] as const) {
        const moving = between(from, to);
        const shape = rows(draw(to));
        for (const t of sampled(60, 2.5)) {
          expect(rows(draw(frameAt(moving, t)))).toEqual(shape);
          expect(Measurement.get(OPTIONS, frameAt(moving, t))).toEqual(Measurement.get(OPTIONS, to));
        }
      }
    });

    it(`${name}: changes every frame until done, then is the new renderable and never changes`, () => {
      const moving = between(building, done);
      for (const t of sampled(60, 2.5)) {
        const frame = draw(frameAt(moving, t));
        expect(change.done(t)).toBe(t >= curve.seconds);
        expect(Segment.nextChange(frame)).toBe(t < curve.seconds ? t : Number.POSITIVE_INFINITY);
        expect(moving.nextChange(t)).toBe(t < curve.seconds ? t : Number.POSITIVE_INFINITY);
        if (t >= curve.seconds) expect(bytes(frame)).toBe(bytes(draw(done)));
      }
    });

    it(`${name}: ends its last row as the new renderable does`, () => {
      const unended: Renderable = { render: () => [new Segment("abc")] };
      const moving = between(building, unended);
      for (const t of [0, 1.5, curve.seconds]) expect(text(draw(frameAt(moving, t))).endsWith("\n")).toBe(false);
    });

    it(`${name}: starts as the old renderable, in the new one's shape`, () => {
      const at0 = text(draw(between(building, done).at(0)));
      expect(at0).toBe("buildi\n");
    });

    it(`${name}: with no colour output, is spliced, and changes every frame until done`, () => {
      const plain: RenderOptions = { maxWidth: 40, colorSystem: null };
      const moving = between(building, done);
      expect(text(draw(frameAt(moving, 0), plain))).toBe("buildi\n");
      for (const t of sampled(4, 1.9)) expect(Segment.nextChange(draw(frameAt(moving, t), plain))).toBe(t);
      expect(text(draw(frameAt(moving, curve.seconds), plain))).toBe("done ✓\n");
      expect(Segment.nextChange(draw(frameAt(moving, curve.seconds), plain))).toBe(Number.POSITIVE_INFINITY);
    });
  }

  it("a crossfade turns every cell at its half, and a wipe turns the left before the right", () => {
    expect(text(draw(crossfade(curve).effect({ from: building, to: done, theme }).at(0.99), { maxWidth: 40, colorSystem: null }))).toBe("buildi\n");
    expect(text(draw(crossfade(curve).effect({ from: building, to: done, theme }).at(1), { maxWidth: 40, colorSystem: null }))).toBe("done ✓\n");
    const midway = text(draw(wipe(curve).effect({ from: new RichText("aaaaaaaaaaaaaaaaaaaa"), to: new RichText("bbbbbbbbbbbbbbbbbbbb"), theme }).at(1), { maxWidth: 40, colorSystem: null }));
    expect(midway).toMatch(/^b+a+\n$/);
  });

  it("reports the old renderable and the new one in the same order drawn as held", () => {
    const frame = crossfade(curve).effect({ from: building, to: done, theme }).at(0.5);
    const seen = (maxWidth: number): Renderable[] => {
      const present: Renderable[] = [];
      draw(frame, { ...OPTIONS, maxWidth, onPresent: (r) => present.push(r) });
      return present.filter((r) => r === building || r === done);
    };
    expect(seen(40)).toEqual([building, done]);
    expect(seen(0)).toEqual([building, done]);
  });

  it("a wipe whose front falls inside a wide glyph blanks it rather than halving it", () => {
    // Linear over 2s, 20 columns, edge 6: the front is at 13t, and a cell turns once it is 3 columns behind it,
    // so at t = 0.577 columns 0–4 have turned and the cut at column 5 falls in the glyph at columns 4–5.
    const cut = wipe(curve).effect({ from: wide, to: building, theme }).at(0.577);
    expect(text(draw(cut, { maxWidth: 40, colorSystem: null }))).toBe("build 字漢字漢字漢字\n");
  });

  it("a crossfade shorter than a second, sampled once a second, shows the old renderable and then the new", () => {
    const quick = crossfade({ seconds: 0.5, ease: EASES.linear, swing: 1 });
    const moving = quick.effect({ from: building, to: done, theme });
    expect(text(draw(frameAt(moving, 0)))).toBe("buildi\n");
    for (const t of [1, 2]) {
      expect(quick.done(t)).toBe(true);
      expect(bytes(draw(frameAt(moving, t)))).toBe(bytes(draw(done)));
      expect(moving.nextChange(t)).toBe(Number.POSITIVE_INFINITY);
    }
  });

  it("a cell passes through the terminal's ground at its half", () => {
    const moving = crossfade(curve).effect({ from: building, to: done, theme });
    const half = draw(frameAt(moving, 1)).filter((s) => s.text.trim() !== "");
    const ground = theme.backgroundColor.hex;
    for (const segment of half) expect(segment.style?.color?.getTruecolor(theme, true).hex).toBe(ground);
  });
});
