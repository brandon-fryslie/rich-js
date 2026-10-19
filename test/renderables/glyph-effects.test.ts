import { describe, expect, it } from "vitest";
import type { Animation } from "../../src/core/animation.js";
import { cellLen } from "../../src/core/cells.js";
import { EASES } from "../../src/core/easing.js";
import type { Renderable } from "../../src/core/protocol.js";
import { Segment } from "../../src/core/segment.js";
import { GlyphEffected, type GlyphEffect, type GlyphFrame } from "../../src/renderables/glyph-effect.js";
import { GLYPH_DEFAULTS, GLYPH_EFFECT_CATALOGUE, caseWave, particles, scramble, typewriter } from "../../src/renderables/glyph-effects.js";

/** A renderable yielding `lines` as fixed segments. */
function lines(...rows: string[]): Renderable {
  return { *render() { yield* rows.flatMap((row, i) => (i === 0 ? [new Segment(row)] : [new Segment("\n"), new Segment(row)])); } };
}

const words = lines("hello, wide 漢字 world");
const field = lines(" ".repeat(24), "     a few words        ", " ".repeat(24), " ".repeat(24));

/** What `effect` draws over `child` at `t`, with no colour, the frame's next change, and the animation it drew it from. */
function draw(effect: GlyphEffect, child: Renderable, t: number): { text: string; next: number; animation: Animation<GlyphFrame> } {
  let animation: Animation<GlyphFrame> | undefined;
  const watched: GlyphEffect = (cells) => (animation = effect(cells));
  const segments = [...new GlyphEffected(child, watched, { t, key: "k" }).render({ maxWidth: 80, colorSystem: null })];
  return { text: segments.map((s) => s.text).join(""), next: Segment.nextChange(segments), animation: animation! };
}

/** `count` times `rate` a second apart from 0. */
function sampled(rate: number, seconds: number): number[] {
  return Array.from({ length: Math.floor(seconds * rate) + 1 }, (_, i) => i / rate);
}

const z = 0.3;
const ALL: readonly [string, GlyphEffect, Renderable][] = [
  ...Object.entries(GLYPH_EFFECT_CATALOGUE.loops).map(([name, make]): [string, GlyphEffect, Renderable] => [name, make({ z }), name === "wave" ? words : field]),
  ...Object.entries(GLYPH_EFFECT_CATALOGUE.transitions).map(([name, make]): [string, GlyphEffect, Renderable] => [name, make({ z }).effect, words]),
];

describe("the glyph effect catalogue — at one frame a second and sixty", () => {
  for (const [name, effect, child] of ALL) {
    it(`${name}: draws the same bytes for the same t at either rate`, () => {
      const slow = new Map(sampled(1, 4).map((t) => [t, draw(effect, child, t).text]));
      for (const t of sampled(60, 4)) if (slow.has(t)) expect(draw(effect, child, t).text).toBe(slow.get(t));
    });

    it(`${name}: never changes before the time the last frame said, and says when it began`, () => {
      const times = sampled(60, 4);
      for (let i = 1; i < times.length; i++) {
        const [before, after] = [draw(effect, child, times[i - 1]!), draw(effect, child, times[i]!)];
        if (before.text === after.text) continue;
        expect(before.next).toBeLessThanOrEqual(times[i]!);
        expect(after.animation.lastChange(times[i]!)).toBeGreaterThan(times[i - 1]!);
      }
    });

    it(`${name}: keeps every line's width, and draws a million seconds in`, () => {
      const at = (t: number) => draw(effect, child, t).text.split("\n").map(cellLen);
      expect(at(1.5)).toEqual(at(0));
      expect(at(1e6)).toEqual(at(0));
    });
  }
});

describe("typewriter", () => {
  const typing = typewriter({ seconds: 2, ease: EASES.linear });

  it("starts blank, types in reading order, and is whole and done at its seconds", () => {
    const text = lines("abcd");
    expect(draw(typing.effect, text, 0).text).toBe("    ");
    expect(draw(typing.effect, text, 1).text).toBe("ab  ");
    expect(draw(typing.effect, text, 2).text).toBe("abcd");
    expect(typing.done(1.99)).toBe(false);
    expect(typing.done(2)).toBe(true);
  });

  it("moves every frame until done, then never", () => {
    expect(draw(typing.effect, words, 1).next).toBe(1);
    expect(draw(typing.effect, words, 2).next).toBe(Number.POSITIVE_INFINITY);
  });

  it("blanks a wide glyph as two spaces", () => {
    expect(draw(typing.effect, lines("漢"), 0).text).toBe("  ");
  });

  it("types the text and not the margins round it, so its seconds go on the words", () => {
    expect(draw(typing.effect, lines(`hello${" ".repeat(35)}`), 1).text.trimEnd()).toBe("he");
    expect(draw(typing.effect, lines("  ab  ", "  cd  "), 1).text).toBe("  ab  \n      ");
    expect(draw(typing.effect, lines("a b"), 2 / 3).text).toBe("a  ");
  });
});

describe("scramble", () => {
  const scrambling = scramble({ seconds: 2, ease: EASES.linear }, z);

  it("churns every glyph but blanks, then resolves to the words at its seconds", () => {
    const shown = (t: number) => draw(scrambling.effect, words, t).text;
    // Blanks stay put, so every word keeps its place and its width while it churns.
    expect(shown(0).split(" ").map(cellLen)).toEqual(shown(2).split(" ").map(cellLen));
    expect(shown(0)).not.toBe(shown(2));
    expect(shown(2)).toBe("hello, wide 漢字 world");
    expect(shown(0.5)).not.toBe(shown(0.6));
  });

  it("resolves the text and not the margins round it", () => {
    const shown = draw(scrambling.effect, lines(`ab${" ".repeat(38)}`), 1).text;
    expect(shown.startsWith("a")).toBe(true);
    expect(shown.slice(1, 2)).not.toBe("b");
    expect(shown.slice(2)).toBe(" ".repeat(38));
  });

  it("needs a finite z", () => {
    expect(() => scramble({ seconds: 2, ease: EASES.linear }, Number.NaN)).toThrow(/scramble z must be a finite place in the noise/);
  });
});

describe("caseWave", () => {
  const wave = caseWave({ step: 0.1, width: 2 }, z);
  /** The columns `text` shows in capitals. */
  const caps = (text: string): number[] => [...text].flatMap((ch, col) => (ch !== ch.toLowerCase() ? [col] : []));

  it("swaps case inside a band crossing left to right a column a step, and comes round again", () => {
    const text = lines("abcdef");
    // A pass is the six columns and the band's two. Mid-step samples: 0.3 itself is a float short of three steps of 0.1.
    const pass = Array.from({ length: 8 }, (_, k) => caps(draw(wave, text, (k + 0.5) * 0.1).text));
    const band = (lead: number): number[] => [lead - 2, lead - 1].filter((col) => col >= 0 && col < 6);
    const lead = Array.from({ length: 8 }, (_, l) => l).find((l) => pass.every((cols, k) => cols.join() === band((l + k) % 8).join()));
    expect(lead).toBeDefined();
    expect(draw(wave, text, 0.35 + 0.8).text).toBe(draw(wave, text, 0.35).text);
    expect(draw(wave, text, 0.35).next).toBeCloseTo(0.4, 12);
  });

  it("starts each element at its own place in the pass, by z", () => {
    const text = lines("abcdefghijklmnop");
    const passes = [0.1, 0.9].map((place) => Array.from({ length: 18 }, (_, k) => draw(caseWave({ step: 0.1, width: 2 }, place), text, (k + 0.5) * 0.1).text));
    expect(passes[0]).not.toEqual(passes[1]);
  });

  it("leaves a glyph whose swapped case is another width", () => {
    expect(draw(wave, lines("ß"), 0.1).text).toBe("ß");
  });

  it("needs a positive whole width", () => {
    expect(() => caseWave({ step: 0.1, width: 0 }, z)).toThrow(RangeError);
    expect(() => caseWave({ step: 0.1, width: 1.5 }, z)).toThrow(RangeError);
    expect(() => caseWave({ step: 0.1, width: 2 }, Number.NaN)).toThrow(/caseWave z/);
  });
});

describe("particles", () => {
  const rain = particles(GLYPH_DEFAULTS.rain, z);
  const stars = particles(GLYPH_DEFAULTS.stars, z);
  const rows = (text: string) => text.split("\n");

  it("draws only on blank cells, never over a glyph", () => {
    for (const effect of [rain, stars]) {
      for (const t of [0, 1, 7.3]) expect(rows(draw(effect, field, t).text)[1]!.replace(/[^a-z,]/g, "")).toBe("afewwords");
    }
  });

  it("rain falls a row a step", () => {
    const empty = lines(...Array.from({ length: 6 }, () => " ".repeat(40)));
    const { step } = GLYPH_DEFAULTS.rain;
    const [now, then] = [rows(draw(rain, empty, 10.5 * step).text), rows(draw(rain, empty, 11.5 * step).text)];
    for (let row = 0; row < 5; row++) expect(then[row + 1]).toBe(now[row]);
    expect(now.join("")).toMatch(/[│╎]/);
  });

  it("stars hold through a life and are drawn afresh after it", () => {
    const empty = lines(...Array.from({ length: 6 }, () => " ".repeat(40)));
    const { step, life } = GLYPH_DEFAULTS.stars;
    expect(draw(stars, empty, 0.5 * step).text).toBe(draw(stars, empty, (life - 0.5) * step).text);
    expect(draw(stars, empty, 0.5 * step).text).not.toBe(draw(stars, empty, (life + 0.5) * step).text);
  });

  it("draws its ASCII set on an output that draws ASCII alone", () => {
    const sky = lines(" ".repeat(40), " ".repeat(40));
    const dense = particles({ ...GLYPH_DEFAULTS.rain, density: 1 }, z);
    const drawnOn = (asciiOnly: boolean) => [...new GlyphEffected(sky, dense, { t: 0, key: "k" }).render({ maxWidth: 80, asciiOnly })].map((s) => s.text).join("");
    expect(drawnOn(true)).toMatch(/^[|:\n]+$/);
    expect(drawnOn(false)).toMatch(/^[│╎\n]+$/);
  });

  it("refuses glyphs that are not one cell, and a density outside [0, 1]", () => {
    expect(() => particles({ ...GLYPH_DEFAULTS.rain, glyphs: "漢" }, z)).toThrow(RangeError);
    expect(() => particles({ ...GLYPH_DEFAULTS.rain, glyphs: "" }, z)).toThrow(RangeError);
    expect(() => particles({ ...GLYPH_DEFAULTS.rain, ascii: "·" }, z)).toThrow(RangeError);
    expect(() => particles({ ...GLYPH_DEFAULTS.rain, density: 2 }, z)).toThrow(RangeError);
  });

  it("falls a whole number of rows a step, and sits at a finite place in the noise", () => {
    expect(() => particles({ ...GLYPH_DEFAULTS.rain, drift: 0.5 }, z)).toThrow(/drift must be a whole number of rows, got 0.5/);
    expect(() => particles(GLYPH_DEFAULTS.rain, Number.NaN)).toThrow(/particles z/);
  });

  it("falls on every blank a scramble keeps, a wide one a particle and a space", () => {
    const blanks = lines("\u00a0".repeat(20), "\u3000".repeat(10));
    const dense = particles({ ...GLYPH_DEFAULTS.rain, density: 1 }, z);
    const [narrow, wide] = rows(draw(dense, blanks, 0).text);
    expect(narrow).toMatch(/^[│╎]{20}$/);
    expect(wide).toMatch(/^([│╎] ){10}$/);
  });

  it("leaves a zero-width glyph that trims away, a byte-order mark, as it is", () => {
    const dense = particles({ ...GLYPH_DEFAULTS.rain, density: 1 }, z);
    expect(draw(dense, lines("a﻿  b"), 0).text).toMatch(/^a﻿[│╎]{2}b$/);
  });
});
