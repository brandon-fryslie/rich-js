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
import { JOINERS } from "../../src/core/strip.js";
import { Strip } from "../../src/core/strip.js";
import { RichText } from "../../src/core/text.js";
import { Style } from "../../src/core/style.js";
import { ColorDepth } from "../../src/core/color.js";
import { renderToString } from "../../src/core/render.js";

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
