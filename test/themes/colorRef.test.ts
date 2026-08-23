import { describe, it, expect } from "vitest";
import {
  resolveColorRef,
  parseHexColor,
  ColorRefError,
} from "../../src/themes/colorRef.js";
import { GRUVBOX } from "../../src/themes/terminalThemes.js";

// [LAW:behavior-not-structure] The contract under test is "a color reference
// becomes a color, or it fails loudly" — not how the dispatch between the hex
// arm and the palette arm is implemented.

const palette = GRUVBOX.palette;

describe("resolveColorRef", () => {
  it("resolves a palette variable name to that variable's color", () => {
    const primary = palette.get("primary")!;
    expect(resolveColorRef(palette, "primary")).toEqual(primary);
  });

  it("resolves hyphenated names, which no generated function could ever spell", () => {
    // The reason a single reference-taking function replaced a family of
    // per-variable functions: ~90% of a themed palette's variables are not
    // legal template identifiers, so a name family can never cover the domain.
    const hyphenated = [...palette.vars.keys()].filter((n) => n.includes("-"));
    expect(hyphenated.length).toBeGreaterThan(0);
    for (const name of hyphenated) {
      expect(resolveColorRef(palette, name)).toEqual(palette.get(name));
    }
  });

  it("passes a hex literal through, in both opaque and alpha forms", () => {
    expect(resolveColorRef(palette, "#af00ff").hex).toBe("#af00ff");
    expect(resolveColorRef(palette, "#af00ff80").hex).toBe("#af00ff80");
  });

  it("is idempotent: resolving its own output returns the same color", () => {
    // This is the property that lets callers apply it unconditionally to any
    // author-written color string without asking "name or literal?" first.
    // [LAW:dataflow-not-control-flow]
    for (const name of ["primary", "surface", "error"]) {
      const once = resolveColorRef(palette, name);
      expect(resolveColorRef(palette, once.hex)).toEqual(once);
    }
  });

  it("tolerates surrounding whitespace on both arms", () => {
    expect(resolveColorRef(palette, "  primary  ")).toEqual(palette.get("primary"));
    expect(resolveColorRef(palette, "  #af00ff  ").hex).toBe("#af00ff");
  });

  it("throws on an unknown name, naming the palette", () => {
    expect(() => resolveColorRef(palette, "nosuchvar")).toThrow(ColorRefError);
    expect(() => resolveColorRef(palette, "nosuchvar")).toThrow(/gruvbox/i);
  });

  it("suggests near misses so a mistyped qualifier is one edit from correct", () => {
    // "primary-mutd" shares the "primary" part with several real names.
    let message = "";
    try {
      resolveColorRef(palette, "primary-mutd");
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("did you mean");
    expect(message).toContain("primary");
  });

  it("reports malformed hex as malformed hex, not as an unknown name", () => {
    // A `#`-leading string is committed to the hex arm. Reporting "no such
    // palette variable '#12345'" would send the author looking in the wrong
    // place entirely. [LAW:no-silent-failure]
    expect(() => resolveColorRef(palette, "#12345")).toThrow(/#RRGGBB/);
    expect(() => resolveColorRef(palette, "#nothex")).toThrow(/#RRGGBB/);
  });

  it("never answers with a substituted default", () => {
    // The failure mode this rules out: an unknown name silently becoming
    // black or transparent, so a broken config merely renders wrong.
    expect(() => resolveColorRef(palette, "")).toThrow(ColorRefError);
  });
});

describe("parseHexColor", () => {
  it("parses the two literal forms and round-trips through .hex", () => {
    expect(parseHexColor("#123456").hex).toBe("#123456");
    expect(parseHexColor("#12345680").hex).toBe("#12345680");
  });

  it("splits the alpha byte into the 0..1 channel", () => {
    expect(parseHexColor("#000000ff").alpha).toBe(1);
    expect(parseHexColor("#00000000").alpha).toBe(0);
  });

  it("rejects every non-literal shape, including palette names", () => {
    for (const bad of ["primary", "red", "af00ff", "#abc", "#gggggg", ""]) {
      expect(() => parseHexColor(bad)).toThrow(ColorRefError);
    }
  });
});
