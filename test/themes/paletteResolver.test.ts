import { describe, it, expect } from "vitest";
import { ColorQuad } from "../../src/core/color.js";
import { Palette } from "../../src/themes/palette.js";
import { PaletteResolver } from "../../src/themes/paletteResolver.js";
import {
  darken,
  alphaBlend,
  contrastFor,
} from "../../src/themes/colorMath.js";

const primary = new ColorQuad(133, 165, 152, 1);
const accent = new ColorQuad(254, 128, 25, 1);
const primaryBg = new ColorQuad(40, 40, 40, 1);
const boost = new ColorQuad(255, 255, 255, 0x0a / 255);
const darkBg = new ColorQuad(20, 20, 20, 1);
const lightBg = new ColorQuad(240, 240, 240, 1);

const palette = new Palette(
  "test",
  true,
  new Map([
    ["primary", primary],
    ["accent", accent],
    ["primary-background", primaryBg],
    ["boost", boost],
  ]),
);

const resolver = new PaletteResolver(palette);

const eqQuad = (a: ColorQuad | null, b: ColorQuad) => {
  expect(a).not.toBeNull();
  expect(a!.red).toBe(b.red);
  expect(a!.green).toBe(b.green);
  expect(a!.blue).toBe(b.blue);
  expect(a!.alpha).toBeCloseTo(b.alpha);
};

describe("PaletteResolver — bare names", () => {
  it("resolves a bare var to its quad", () => {
    eqQuad(resolver.resolve("primary"), primary);
    eqQuad(resolver.resolve("accent"), accent);
  });

  it("preserves alpha for translucent vars", () => {
    eqQuad(resolver.resolve("boost"), boost);
  });

  it("resolves names that themselves contain hyphens", () => {
    eqQuad(resolver.resolve("primary-background"), primaryBg);
  });

  it("returns null for missing var", () => {
    expect(resolver.resolve("nonexistent")).toBeNull();
  });

  it("is case-sensitive", () => {
    expect(resolver.resolve("Primary")).toBeNull();
  });

  it("ignores leading/trailing whitespace", () => {
    eqQuad(resolver.resolve("  primary  "), primary);
  });
});

describe("PaletteResolver — modifiers", () => {
  it("darken-N applies N levels of darkening to the base", () => {
    eqQuad(resolver.resolve("primary-darken-3"), darken(primary, 3));
  });

  it("lighten-N applies N levels of lightening to the base", () => {
    eqQuad(resolver.resolve("primary-lighten-2"), darken(primary, -2));
  });

  it("modifier preserves alpha of translucent base", () => {
    const got = resolver.resolve("boost-darken-2");
    expect(got).not.toBeNull();
    expect(got!.alpha).toBeCloseTo(boost.alpha);
  });

  it("modifier applies to hyphenated var names (right-anchored parse)", () => {
    eqQuad(
      resolver.resolve("primary-background-darken-2"),
      darken(primaryBg, 2),
    );
  });

  it("returns null when modifier targets a missing var", () => {
    expect(resolver.resolve("ghost-darken-1")).toBeNull();
  });

  it("zero-level modifier is functionally identity (±1 RGB roundtrip)", () => {
    const got = resolver.resolve("primary-darken-0");
    expect(got).not.toBeNull();
    expect(Math.abs(got!.red - primary.red)).toBeLessThanOrEqual(1);
    expect(got!.alpha).toBe(primary.alpha);
  });
});

describe("PaletteResolver — alpha", () => {
  it("composites the resolved color over `against` (per-channel lerp)", () => {
    eqQuad(
      resolver.resolve("primary 50%", { against: darkBg }),
      alphaBlend(primary, darkBg, 0.5),
    );
  });

  it("alpha 0% returns the background", () => {
    eqQuad(
      resolver.resolve("primary 0%", { against: darkBg }),
      alphaBlend(primary, darkBg, 0),
    );
  });

  it("alpha 100% is effectively the foreground", () => {
    eqQuad(
      resolver.resolve("primary 100%", { against: darkBg }),
      alphaBlend(primary, darkBg, 1),
    );
  });

  it("returns null when alpha is specified but no `against` is given", () => {
    expect(resolver.resolve("primary 50%")).toBeNull();
  });

  it("accepts decimal percentages", () => {
    eqQuad(
      resolver.resolve("primary 33.5%", { against: darkBg }),
      alphaBlend(primary, darkBg, 0.335),
    );
  });

  it("rejects out-of-range percentages", () => {
    expect(resolver.resolve("primary 150%", { against: darkBg })).toBeNull();
    expect(resolver.resolve("primary -10%", { against: darkBg })).toBeNull();
  });
});

describe("PaletteResolver — auto-contrast", () => {
  it("`auto` against a dark bg returns white (opaque)", () => {
    const got = resolver.resolve("auto", { against: darkBg });
    eqQuad(got, contrastFor(darkBg));
    expect(got!.red).toBe(255);
    expect(got!.alpha).toBe(1);
  });

  it("`auto` against a light bg returns black (opaque)", () => {
    const got = resolver.resolve("auto", { against: lightBg });
    eqQuad(got, contrastFor(lightBg));
    expect(got!.red).toBe(0);
    expect(got!.alpha).toBe(1);
  });

  it("`auto NN%` blends the contrast color over the bg", () => {
    eqQuad(
      resolver.resolve("auto 33%", { against: darkBg }),
      alphaBlend(contrastFor(darkBg), darkBg, 0.33),
    );
  });

  it("`auto` without `against` returns null", () => {
    expect(resolver.resolve("auto")).toBeNull();
    expect(resolver.resolve("auto 50%")).toBeNull();
  });
});

describe("PaletteResolver — combined modifier + alpha", () => {
  it("applies modifier first, then composites", () => {
    eqQuad(
      resolver.resolve("primary-darken-3 50%", { against: darkBg }),
      alphaBlend(darken(primary, 3), darkBg, 0.5),
    );
  });
});

describe("PaletteResolver — invalid syntax", () => {
  it("empty string returns null", () => {
    expect(resolver.resolve("")).toBeNull();
    expect(resolver.resolve("   ")).toBeNull();
  });

  it("more than two whitespace-separated tokens returns null", () => {
    expect(resolver.resolve("primary 50% extra")).toBeNull();
  });

  it("malformed alpha returns null", () => {
    expect(resolver.resolve("primary 50", { against: darkBg })).toBeNull();
    expect(resolver.resolve("primary abc%", { against: darkBg })).toBeNull();
  });
});
