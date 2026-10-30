/*
 * A join cell's ink held off its own ground: what the lift moves, and what it
 * leaves alone.
 *
 * `strip-seams.golden.json` is the bytes 0.24.1 drew for strips in which every
 * seam cell's ink already stands off its ground, under every named joiner, at
 * three depths, in both forms. The lift moves no colour that clears the floor,
 * so those bytes hold. It was written once from 0.24.1's code with
 *
 *     npx vitest run test/core/strip-lift.test.ts -u
 *
 * and a diff in it is a join that showed and was changed: regenerate it only
 * for a change that means to redraw a join that already shows.
 */
import { describe, it, expect } from "vitest";
import { JOINERS, Strip } from "../../src/core/strip.js";
import { RichText } from "../../src/core/text.js";
import { Style } from "../../src/core/style.js";
import { ColorDepth, ColorSpec } from "../../src/core/color.js";
import { Oklch } from "../../src/core/oklch.js";
import { renderToString } from "../../src/core/render.js";
import { standsOffAsDrawn } from "./stands-off.js";

const cell = (text: string, style: string): RichText => new RichText(text, { style: Style.parse(style), end: "" });

const DEPTHS = { truecolor: ColorDepth.TRUECOLOR, "256": ColorDepth.EIGHT_BIT, ansi: ColorDepth.STANDARD } as const;

// Neighbours far enough apart that every cell of every named seam — prism's
// thirds and torn's midpoint included — clears the floor at every depth.
const APART = {
  primaries: ["#ffffff on #000080", "#000000 on #ffff00", "#ffffff on #800080"],
  tailwind: ["#e0e0e0 on #1d4ed8", "#1a1a1a on #f0f0f0", "#e0e0e0 on #b91c1c"],
} as const;

describe("a join whose every cell already stands off its ground", () => {
  it("draws 0.24.1's bytes", async () => {
    const drawn: Record<string, string> = {};
    for (const [palette, styles] of Object.entries(APART)) {
      const items = styles.map((style, i) => cell(` ${i} `, style));
      for (const [name, joiner] of Object.entries(JOINERS)) {
        for (const [depth, colorSystem] of Object.entries(DEPTHS)) {
          for (const asciiOnly of [false, true]) {
            drawn[`${palette} ${name} ${depth}${asciiOnly ? " ascii" : ""}`] = renderToString(new Strip(items, joiner), { colorSystem, asciiOnly, width: 80 });
          }
        }
      }
    }
    await expect(`${JSON.stringify(drawn, null, 1)}\n`).toMatchFileSnapshot("./strip-seams.golden.json");
  });
});

describe("a join between grounds too close to tell apart", () => {
  // Each base and a ground `gap` lighter along its own lightness, which is the
  // ΔE_OK between them but for the 8-bit rounding of the colour drawn.
  const BASES = { grey: "#303030", blue: "#336699" } as const;
  const GAPS = [0, 0.01, 0.03, 0.2] as const;
  const FAR = 0.2;
  const partner = (base: string, gap: number): string => {
    const from = Oklch.fromRgba(ColorSpec.parse(base).value!);
    return new Oklch(from.l + gap, from.c, from.h).toRgba().hex;
  };
  // The cells a join draws between `left` and `right`, and of those, the ones
  // with a colour on both sides to measure: a cell on the terminal's ground, or
  // reversed out of it, has a side nobody knows.
  const seam = (name: keyof typeof JOINERS, left: string, right: string, colorSystem: ColorDepth) =>
    [...JOINERS[name].join(cell(" a ", `#e0e0e0 on ${left}`), cell(" b ", `#e0e0e0 on ${right}`), { index: 1 }).render({ maxWidth: 80, colorSystem })];
  const CASES = (Object.keys(JOINERS) as (keyof typeof JOINERS)[]).flatMap((name) =>
    Object.entries(DEPTHS).map(([depth, colorSystem]) => [name, depth, colorSystem] as const),
  );

  it.each(CASES)("%s at %s draws its seam, every cell's ink standing off its ground", (name, _, colorSystem) => {
    const failures: string[] = [];
    for (const [hue, base] of Object.entries(BASES)) {
      const far = seam(name, base, partner(base, FAR), colorSystem);
      for (const gap of GAPS) {
        const cells = seam(name, base, partner(base, gap), colorSystem);
        // The seam's own glyphs at every gap: nothing stands in for it.
        if (cells.map((s) => s.text).join("") !== far.map((s) => s.text).join("")) failures.push(`${hue} ${gap}: drew ${cells.map((s) => s.text).join("")}`);
        for (const [at, { style }] of cells.entries()) {
          const measured = style !== undefined && !style.reverse && style.color !== undefined && style.bgcolor !== undefined;
          if (measured && !standsOffAsDrawn(style, colorSystem)) failures.push(`${hue} ${gap}: cell ${at} ${style.toString()}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  // A mix of a slot and an RGB is the terminal theme's colour at truecolor but
  // a cube entry at 256, so there it is lifted among fixed colours and measured
  // by ΔE, never parted from its ground only by being a slot.
  it("lifts a mix the depth draws as a fixed colour among fixed colours", () => {
    for (const { style } of seam("prism", "blue", "#000080", ColorDepth.EIGHT_BIT).slice(1)) {
      const { color, bgcolor } = style!.drawnColors(ColorDepth.EIGHT_BIT);
      expect([color!.name, color!.fixedValue !== undefined, bgcolor!.fixedValue !== undefined]).toEqual([color!.name, true, true]);
      expect(standsOffAsDrawn(style!, ColorDepth.EIGHT_BIT)).toBe(true);
    }
  });

  // Measured through the joiner itself: powerline's arrow between two cells of
  // one ground, drawn at each depth — truecolor and 256 by the colour the
  // terminal shows, sixteen colours by its slot.
  it.each([
    ["#303030", "#262626", "#262626", 8],
    ["#336699", "#3f72a6", "#5f5faf", 8],
    ["#fafafa", "#ececec", "#eeeeee", 7],
    ["#c0392b", "#ce4737", "#d75f00", 1],
    ["#1e1e2e", "#282838", "#1c1c1c", 4],
  ] as const)("lifts %s's arrow to %s in truecolor, %s at 256 and slot %i at sixteen", (ground, truecolor, eightBit, slot) => {
    const drawn = (colorSystem: ColorDepth) => {
      const [arrow] = seam("powerline", ground, ground, colorSystem);
      return arrow!.style!.drawnColors(colorSystem).color!;
    };
    expect(drawn(ColorDepth.TRUECOLOR).fixedValue?.hex).toBe(truecolor);
    expect(drawn(ColorDepth.EIGHT_BIT).fixedValue?.hex).toBe(eightBit);
    expect(drawn(ColorDepth.STANDARD).number).toBe(slot);
  });
});
