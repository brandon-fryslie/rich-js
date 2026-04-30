import { describe, it, expect } from "vitest";
import { ColorTriplet } from "../../src/core/color.js";
import { Palette } from "../../src/themes/palette.js";
import { PaletteResolver } from "../../src/themes/paletteResolver.js";
import {
  darken,
  alphaBlend,
  contrastFor,
} from "../../src/themes/colorMath.js";

const primary = new ColorTriplet(133, 165, 152); // gruvbox primary-ish
const accent = new ColorTriplet(254, 128, 25);
const primaryBg = new ColorTriplet(40, 40, 40); // hyphenated var name
const darkBg = new ColorTriplet(20, 20, 20);
const lightBg = new ColorTriplet(240, 240, 240);

const palette = new Palette(
  "test",
  true,
  new Map([
    ["primary", primary],
    ["accent", accent],
    ["primary-background", primaryBg],
  ]),
);

const resolver = new PaletteResolver(palette);

const eqTriplet = (a: ColorTriplet | null, b: ColorTriplet) => {
  expect(a).not.toBeNull();
  expect(a!.red).toBe(b.red);
  expect(a!.green).toBe(b.green);
  expect(a!.blue).toBe(b.blue);
};

describe("PaletteResolver — bare names", () => {
  it("resolves a bare var to its triplet", () => {
    eqTriplet(resolver.resolve("primary"), primary);
    eqTriplet(resolver.resolve("accent"), accent);
  });

  it("resolves names that themselves contain hyphens", () => {
    eqTriplet(resolver.resolve("primary-background"), primaryBg);
  });

  it("returns null for missing var", () => {
    expect(resolver.resolve("nonexistent")).toBeNull();
  });

  it("is case-sensitive", () => {
    expect(resolver.resolve("Primary")).toBeNull();
  });

  it("ignores leading/trailing whitespace", () => {
    eqTriplet(resolver.resolve("  primary  "), primary);
  });
});

describe("PaletteResolver — modifiers", () => {
  it("darken-N applies N levels of darkening to the base", () => {
    eqTriplet(resolver.resolve("primary-darken-3"), darken(primary, 3));
  });

  it("lighten-N applies N levels of lightening to the base", () => {
    eqTriplet(resolver.resolve("primary-lighten-2"), darken(primary, -2));
  });

  it("modifier applies to hyphenated var names (right-anchored parse)", () => {
    eqTriplet(
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
    expect(Math.abs(got!.green - primary.green)).toBeLessThanOrEqual(1);
    expect(Math.abs(got!.blue - primary.blue)).toBeLessThanOrEqual(1);
  });
});

describe("PaletteResolver — alpha", () => {
  it("composites the resolved color over `against`", () => {
    eqTriplet(
      resolver.resolve("primary 50%", { against: darkBg }),
      alphaBlend(primary, darkBg, 0.5),
    );
  });

  it("alpha 0% returns the background", () => {
    eqTriplet(
      resolver.resolve("primary 0%", { against: darkBg }),
      alphaBlend(primary, darkBg, 0),
    );
  });

  it("alpha 100% is effectively the foreground", () => {
    eqTriplet(
      resolver.resolve("primary 100%", { against: darkBg }),
      alphaBlend(primary, darkBg, 1),
    );
  });

  it("returns null when alpha is specified but no `against` is given", () => {
    expect(resolver.resolve("primary 50%")).toBeNull();
  });

  it("accepts decimal percentages", () => {
    eqTriplet(
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
  it("`auto` against a dark bg returns white", () => {
    eqTriplet(resolver.resolve("auto", { against: darkBg }), contrastFor(darkBg));
    expect(resolver.resolve("auto", { against: darkBg })!.red).toBe(255);
  });

  it("`auto` against a light bg returns black", () => {
    eqTriplet(
      resolver.resolve("auto", { against: lightBg }),
      contrastFor(lightBg),
    );
    expect(resolver.resolve("auto", { against: lightBg })!.red).toBe(0);
  });

  it("`auto NN%` blends the contrast color over the bg", () => {
    eqTriplet(
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
    eqTriplet(
      resolver.resolve("primary-darken-3 50%", { against: darkBg }),
      alphaBlend(darken(primary, 3), darkBg, 0.5),
    );
  });

  it("alpha 100% with modifier is the modifier result composited at full opacity", () => {
    eqTriplet(
      resolver.resolve("primary-lighten-2 100%", { against: darkBg }),
      alphaBlend(darken(primary, -2), darkBg, 1),
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
