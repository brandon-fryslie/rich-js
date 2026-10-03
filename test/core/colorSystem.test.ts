import { describe, it, expect } from "vitest";
import {
  ColorDepth,
  ColorParseError,
  type ColorSystemName,
  resolveColorSystem,
  detectColorSystem,
  resolveDestination,
} from "../../src/core/color.js";
import type { Env } from "../../src/core/env.js";
import { renderToString } from "../../src/core/render.js";
import { RichText } from "../../src/core/text.js";
import { Console } from "../../src/core/console.js";

const EMPTY: Env = {};

describe("resolveColorSystem (string spec → ColorDepth)", () => {
  it("maps 'truecolor' → TRUECOLOR", () => {
    expect(resolveColorSystem("truecolor", { env: EMPTY, isTTY: true })).toBe(
      ColorDepth.TRUECOLOR,
    );
  });

  it("maps '256' → EIGHT_BIT", () => {
    expect(resolveColorSystem("256", { env: EMPTY, isTTY: true })).toBe(
      ColorDepth.EIGHT_BIT,
    );
  });

  it("maps 'ansi' → STANDARD", () => {
    expect(resolveColorSystem("ansi", { env: EMPTY, isTTY: true })).toBe(
      ColorDepth.STANDARD,
    );
  });

  it("maps 'none' → null", () => {
    expect(resolveColorSystem("none", { env: EMPTY, isTTY: true })).toBe(null);
  });

  it("'auto' delegates to detectColorSystem", () => {
    const env: Env = { COLORTERM: "truecolor" };
    expect(resolveColorSystem("auto", { env, isTTY: true })).toBe(
      ColorDepth.TRUECOLOR,
    );
  });

  it("explicit specs ignore env (do not auto-detect)", () => {
    const env: Env = { NO_COLOR: "1" };
    // Even with NO_COLOR set, explicit "truecolor" overrides — caller is boss.
    expect(resolveColorSystem("truecolor", { env, isTTY: true })).toBe(
      ColorDepth.TRUECOLOR,
    );
  });
});

describe("ColorSystemName (the colour-system vocabulary)", () => {
  it("types every colorSystem parameter, so a name outside it is a compile error", () => {
    // @ts-expect-error "16" is not a colour system name
    expect(() => resolveColorSystem("16")).toThrow(ColorParseError);
    // @ts-expect-error a FORCE_COLOR value is not a colour system name
    expect(() => resolveColorSystem("1")).toThrow(ColorParseError);
    // @ts-expect-error
    expect(() => resolveDestination("16")).toThrow(ColorParseError);
    // @ts-expect-error
    expect(() => renderToString(new RichText("x"), { colorSystem: "16" })).toThrow(ColorParseError);
    // @ts-expect-error
    expect(() => new Console({ colorSystem: "16" })).toThrow(ColorParseError);
  });

  it("is the set a consumer's own vocabulary can be checked against", () => {
    const names = ["auto", "truecolor", "256", "ansi", "none"] as const satisfies readonly ColorSystemName[];
    expect(names.map((name) => resolveColorSystem(name, { env: EMPTY, isTTY: true }))).toEqual([
      ColorDepth.STANDARD,
      ColorDepth.TRUECOLOR,
      ColorDepth.EIGHT_BIT,
      ColorDepth.STANDARD,
      null,
    ]);
  });
});

describe("detectColorSystem (env + TTY → ColorDepth)", () => {
  it("NO_COLOR with any non-empty value disables color", () => {
    expect(detectColorSystem({ env: { NO_COLOR: "1" }, isTTY: true })).toBe(
      null,
    );
    expect(
      detectColorSystem({
        env: { NO_COLOR: "anything", FORCE_COLOR: "3" },
        isTTY: true,
      }),
    ).toBe(null);
  });

  it("NO_COLOR='' (empty string) does NOT disable color (per no-color.org)", () => {
    expect(
      detectColorSystem({
        env: { NO_COLOR: "", COLORTERM: "truecolor" },
        isTTY: true,
      }),
    ).toBe(ColorDepth.TRUECOLOR);
  });

  it("FORCE_COLOR=3 → TRUECOLOR (overrides isTTY=false)", () => {
    expect(
      detectColorSystem({ env: { FORCE_COLOR: "3" }, isTTY: false }),
    ).toBe(ColorDepth.TRUECOLOR);
  });

  it("FORCE_COLOR=2 → EIGHT_BIT", () => {
    expect(detectColorSystem({ env: { FORCE_COLOR: "2" }, isTTY: true })).toBe(
      ColorDepth.EIGHT_BIT,
    );
  });

  it("FORCE_COLOR=1 → STANDARD", () => {
    expect(detectColorSystem({ env: { FORCE_COLOR: "1" }, isTTY: true })).toBe(
      ColorDepth.STANDARD,
    );
  });

  it("FORCE_COLOR=true → STANDARD", () => {
    expect(
      detectColorSystem({ env: { FORCE_COLOR: "true" }, isTTY: false }),
    ).toBe(ColorDepth.STANDARD);
  });

  it("FORCE_COLOR=0 → null", () => {
    expect(
      detectColorSystem({
        env: { FORCE_COLOR: "0", COLORTERM: "truecolor" },
        isTTY: true,
      }),
    ).toBe(null);
  });

  it("FORCE_COLOR=false → null", () => {
    expect(
      detectColorSystem({ env: { FORCE_COLOR: "false" }, isTTY: true }),
    ).toBe(null);
  });

  it("non-TTY without FORCE_COLOR → null", () => {
    expect(
      detectColorSystem({ env: { COLORTERM: "truecolor" }, isTTY: false }),
    ).toBe(null);
  });

  it("TERM=dumb → null", () => {
    expect(detectColorSystem({ env: { TERM: "dumb" }, isTTY: true })).toBe(
      null,
    );
  });

  it("TERM=unknown → null", () => {
    expect(detectColorSystem({ env: { TERM: "unknown" }, isTTY: true })).toBe(
      null,
    );
  });

  it("COLORTERM=truecolor → TRUECOLOR", () => {
    expect(
      detectColorSystem({ env: { COLORTERM: "truecolor" }, isTTY: true }),
    ).toBe(ColorDepth.TRUECOLOR);
  });

  it("COLORTERM=24bit → TRUECOLOR", () => {
    expect(
      detectColorSystem({ env: { COLORTERM: "24bit" }, isTTY: true }),
    ).toBe(ColorDepth.TRUECOLOR);
  });

  it("known truecolor terminal (xterm-kitty) → TRUECOLOR", () => {
    expect(
      detectColorSystem({ env: { TERM: "xterm-kitty" }, isTTY: true }),
    ).toBe(ColorDepth.TRUECOLOR);
  });

  it("TERM_PROGRAM=iTerm.app → TRUECOLOR", () => {
    expect(
      detectColorSystem({
        env: { TERM_PROGRAM: "iTerm.app", TERM: "xterm" },
        isTTY: true,
      }),
    ).toBe(ColorDepth.TRUECOLOR);
  });

  it("TERM_PROGRAM=Apple_Terminal → EIGHT_BIT", () => {
    expect(
      detectColorSystem({
        env: { TERM_PROGRAM: "Apple_Terminal", TERM: "xterm" },
        isTTY: true,
      }),
    ).toBe(ColorDepth.EIGHT_BIT);
  });

  it("TERM matches -256color → EIGHT_BIT", () => {
    expect(
      detectColorSystem({ env: { TERM: "xterm-256color" }, isTTY: true }),
    ).toBe(ColorDepth.EIGHT_BIT);
  });

  it("TERM matches generic xterm → STANDARD", () => {
    expect(detectColorSystem({ env: { TERM: "xterm" }, isTTY: true })).toBe(
      ColorDepth.STANDARD,
    );
  });

  it("unknown TERM with isTTY=true → STANDARD (safe baseline)", () => {
    expect(
      detectColorSystem({ env: { TERM: "weird-thing-9000" }, isTTY: true }),
    ).toBe(ColorDepth.STANDARD);
  });

  it("empty env, isTTY=true → STANDARD baseline", () => {
    expect(detectColorSystem({ env: EMPTY, isTTY: true })).toBe(
      ColorDepth.STANDARD,
    );
  });

  it("empty env, isTTY=false → null", () => {
    expect(detectColorSystem({ env: EMPTY, isTTY: false })).toBe(null);
  });

  it("NO_COLOR precedence: beats FORCE_COLOR", () => {
    expect(
      detectColorSystem({
        env: { NO_COLOR: "1", FORCE_COLOR: "3" },
        isTTY: true,
      }),
    ).toBe(null);
  });
});

describe("renderToString accepts ColorSystemSpec strings", () => {
  const text = new RichText("hi", { style: "red" });

  it("colorSystem: 'none' strips all color codes", () => {
    const out = renderToString(text, { colorSystem: "none", width: 10 });
    expect(out).not.toMatch(/\x1b\[/);
  });

  it("colorSystem: 'truecolor' emits 24-bit codes", () => {
    const out = renderToString(text, { colorSystem: "truecolor", width: 10 });
    expect(out).toMatch(/\x1b\[/);
  });

  it("colorSystem: 'auto' resolves via detectColorSystem", () => {
    // Auto path runs without throwing; output may or may not have codes
    // depending on env, but the function must complete.
    const out = renderToString(text, { colorSystem: "auto", width: 10 });
    expect(typeof out).toBe("string");
  });

  it("colorSystem: ColorDepth enum still works", () => {
    const out = renderToString(text, {
      colorSystem: ColorDepth.STANDARD,
      width: 10,
    });
    expect(out).toMatch(/\x1b\[/);
  });

  it("noColor: true wins over explicit truecolor spec", () => {
    const out = renderToString(text, {
      colorSystem: "truecolor",
      noColor: true,
      width: 10,
    });
    expect(out).not.toMatch(/\x1b\[/);
  });
});

describe("resolveDestination (spec → colour depth + hyperlinks)", () => {
  // [LAW:one-type-per-behavior] A hyperlink is not a colour: a colour choice
  // never removes links; only a destination that takes no escapes does.
  const TTY = { env: { TERM: "xterm-256color" }, isTTY: true };
  it.each([
    ["none", TTY, null, true],
    ["truecolor", { env: EMPTY, isTTY: false }, ColorDepth.TRUECOLOR, true],
    ["auto", TTY, ColorDepth.EIGHT_BIT, true],
    ["auto", { env: { NO_COLOR: "1", TERM: "xterm-256color" }, isTTY: true }, null, true],
    ["auto", { env: { TERM: "xterm-256color" }, isTTY: false }, null, false],
    ["auto", { env: { TERM: "dumb" }, isTTY: true }, null, false],
    ["auto", { env: { FORCE_COLOR: "1" }, isTTY: false }, ColorDepth.STANDARD, true],
    ["auto", { env: { FORCE_COLOR: "0", TERM: "xterm-256color" }, isTTY: true }, null, true],
    ["auto", { env: { FORCE_COLOR: "0", TERM: "xterm-256color" }, isTTY: false }, null, false],
  ] as const)("%s %j → %s, links %s", (spec, opts, colorSystem, hyperlinks) => {
    expect(resolveDestination(spec, opts)).toEqual({ colorSystem, hyperlinks });
  });

  it("an explicit null or enum depth keeps links", () => {
    expect(resolveDestination(null)).toEqual({ colorSystem: null, hyperlinks: true });
    expect(resolveDestination(ColorDepth.STANDARD).hyperlinks).toBe(true);
  });
});
