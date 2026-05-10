import { describe, it, expect } from "vitest";
import {
  ColorRgba,
  ColorTable,
  ColorSpec,
  ColorDepth,
  ColorParseError,
  parseRgbHex,
  blendRgb,
  TerminalTheme,
  STANDARD_TABLE,
  EIGHT_BIT_TABLE,
  WINDOWS_TABLE,
  ANSI_COLOR_NAMES,
} from "../../src/core/color.js";
import {
  DEFAULT_TERMINAL_THEME,
  MONOKAI,
  SVG_EXPORT_THEME,
  ANSI_COLOR_NAMES,
} from "../../src/core/color.js";
import { buildPalette } from "../../src/themes/buildPalette.js";

// ---------------------------------------------------------------------------
// ColorRgba
// ---------------------------------------------------------------------------

describe("ColorRgba", () => {
  it("stores red, green, blue as readonly properties", () => {
    const t = new ColorRgba(10, 20, 30);
    expect(t.red).toBe(10);
    expect(t.green).toBe(20);
    expect(t.blue).toBe(30);
  });

  it(".hex returns zero-padded lowercase hex string", () => {
    expect(new ColorRgba(255, 0, 0).hex).toBe("#ff0000");
    expect(new ColorRgba(0, 255, 0).hex).toBe("#00ff00");
    expect(new ColorRgba(0, 0, 255).hex).toBe("#0000ff");
    expect(new ColorRgba(0, 0, 0).hex).toBe("#000000");
    expect(new ColorRgba(1, 2, 3).hex).toBe("#010203");
  });

  it(".rgb returns rgb(...) string", () => {
    expect(new ColorRgba(255, 128, 0).rgb).toBe("rgb(255,128,0)");
  });

  it(".normalized returns [r, g, b, a] tuple", () => {
    const [r, g, b, a] = new ColorRgba(255, 0, 128).normalized;
    expect(r).toBe(1);
    expect(g).toBe(0);
    expect(b).toBeCloseTo(128 / 255);
    expect(a).toBe(1);
  });

  it(".normalized of opaque black is [0,0,0,1]", () => {
    expect(new ColorRgba(0, 0, 0).normalized).toEqual([0, 0, 0, 1]);
  });

  it(".normalized of opaque white is [1,1,1,1]", () => {
    expect(new ColorRgba(255, 255, 255).normalized).toEqual([1, 1, 1, 1]);
  });

  it("alpha defaults to 1 (fully opaque)", () => {
    expect(new ColorRgba(10, 20, 30).alpha).toBe(1);
  });

  it("accepts explicit alpha in [0,1]", () => {
    expect(new ColorRgba(10, 20, 30, 0.5).alpha).toBe(0.5);
    expect(new ColorRgba(10, 20, 30, 0).alpha).toBe(0);
  });

  it(".hex emits 8-char form when alpha < 1", () => {
    expect(new ColorRgba(255, 0, 102, 0.5).hex).toBe("#ff006680");
  });

  it(".rgb emits rgba(...) when alpha < 1", () => {
    expect(new ColorRgba(255, 0, 102, 0.5).rgb).toBe("rgba(255,0,102,0.5)");
  });

  it("constructor throws on rgb out of [0,255]", () => {
    expect(() => new ColorRgba(-1, 0, 0)).toThrow(RangeError);
    expect(() => new ColorRgba(0, 256, 0)).toThrow(RangeError);
    expect(() => new ColorRgba(0, 0, NaN)).toThrow(RangeError);
  });

  it("constructor throws on alpha out of [0,1]", () => {
    expect(() => new ColorRgba(0, 0, 0, -0.1)).toThrow(RangeError);
    expect(() => new ColorRgba(0, 0, 0, 1.5)).toThrow(RangeError);
  });

  it("compositeOver of opaque is identity", () => {
    const c = new ColorRgba(100, 100, 100);
    const bg = new ColorRgba(0, 0, 0);
    expect(c.compositeOver(bg)).toBe(c);
  });

  it("compositeOver lerps per channel and produces alpha=1", () => {
    const fg = new ColorRgba(255, 0, 0, 0.5);
    const bg = new ColorRgba(0, 0, 0);
    const out = fg.compositeOver(bg);
    expect(out.red).toBe(128);
    expect(out.green).toBe(0);
    expect(out.blue).toBe(0);
    expect(out.alpha).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// ColorTable
// ---------------------------------------------------------------------------

describe("ColorTable", () => {
  const palette = new ColorTable([
    new ColorRgba(0, 0, 0),
    new ColorRgba(255, 0, 0),
    new ColorRgba(0, 255, 0),
    new ColorRgba(0, 0, 255),
  ]);

  it(".get() retrieves the triplet at a given index", () => {
    expect(palette.get(0)).toEqual(new ColorRgba(0, 0, 0));
    expect(palette.get(1)).toEqual(new ColorRgba(255, 0, 0));
  });

  it(".size returns the number of entries", () => {
    expect(palette.size).toBe(4);
  });

  it(".match() returns the index of the nearest color", () => {
    // Exact red
    expect(palette.match(new ColorRgba(255, 0, 0))).toBe(1);
    // Very close to green
    expect(palette.match(new ColorRgba(10, 240, 10))).toBe(2);
    // Very close to blue
    expect(palette.match(new ColorRgba(5, 5, 250))).toBe(3);
    // Black
    expect(palette.match(new ColorRgba(0, 0, 0))).toBe(0);
  });

  it(".match() caches results — second call returns same value", () => {
    const target = new ColorRgba(200, 10, 10);
    const first = palette.match(target);
    const second = palette.match(target);
    expect(first).toBe(second);
    expect(first).toBe(1);
  });

  it("STANDARD_TABLE has 16 entries", () => {
    expect(STANDARD_TABLE.size).toBe(16);
  });

  it("EIGHT_BIT_TABLE has 256 entries", () => {
    expect(EIGHT_BIT_TABLE.size).toBe(256);
  });

  it("WINDOWS_TABLE has 16 entries", () => {
    expect(WINDOWS_TABLE.size).toBe(16);
  });

  it("EIGHT_BIT_TABLE.get(0) returns black (0,0,0)", () => {
    expect(EIGHT_BIT_TABLE.get(0)).toEqual(new ColorRgba(0, 0, 0));
  });
});

// ---------------------------------------------------------------------------
// ColorSpec.parse()
// ---------------------------------------------------------------------------

describe("ColorSpec.parse()", () => {
  it('parses "color(100)" as EIGHT_BIT (number >= 16)', () => {
    const c = ColorSpec.parse("color(100)");
    expect(c.type).toBe(ColorDepth.EIGHT_BIT);
    expect(c.number).toBe(100);
  });

  it('parses "#ff0000" as TRUECOLOR', () => {
    const c = ColorSpec.parse("#ff0000");
    expect(c.type).toBe(ColorDepth.TRUECOLOR);
    expect(c.value).toEqual(new ColorRgba(255, 0, 0));
  });

  it("throws ColorParseError on invalid color string", () => {
    expect(() => ColorSpec.parse("not_a_color_at_all")).toThrow(ColorParseError);
  });

  it('throws ColorParseError on "color(256)" (out of range)', () => {
    expect(() => ColorSpec.parse("color(256)")).toThrow(ColorParseError);
    expect(() => ColorSpec.parse("color(256)")).toThrow(/out of range/);
  });

  it('parses "navy_blue" as extended color name with number 17', () => {
    const c = ColorSpec.parse("navy_blue");
    expect(c.number).toBe(17);
  });

  it("parse caching returns same reference (reference equality)", () => {
    const a = ColorSpec.parse("red");
    const b = ColorSpec.parse("red");
    expect(a === b).toBe(true);
  });

  it('parses "color(0)" as STANDARD', () => {
    const c = ColorSpec.parse("color(0)");
    expect(c.type).toBe(ColorDepth.STANDARD);
    expect(c.number).toBe(0);
  });

  it('parses "color(255)" as EIGHT_BIT', () => {
    const c = ColorSpec.parse("color(255)");
    expect(c.type).toBe(ColorDepth.EIGHT_BIT);
    expect(c.number).toBe(255);
  });

  it('parses "color(15)" as STANDARD (boundary)', () => {
    const c = ColorSpec.parse("color(15)");
    expect(c.type).toBe(ColorDepth.STANDARD);
    expect(c.number).toBe(15);
  });

  it('parses "color(16)" as EIGHT_BIT (boundary)', () => {
    const c = ColorSpec.parse("color(16)");
    expect(c.type).toBe(ColorDepth.EIGHT_BIT);
    expect(c.number).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// Color factory methods
// ---------------------------------------------------------------------------

describe("ColorSpec factory methods", () => {
  it("ColorSpec.default() creates a DEFAULT color", () => {
    const c = ColorSpec.default();
    expect(c.type).toBe(ColorDepth.DEFAULT);
    expect(c.name).toBe("default");
    expect(c.number).toBeUndefined();
    expect(c.value).toBeUndefined();
  });

  it("ColorSpec.fromAnsi() creates STANDARD for n < 16", () => {
    const c = ColorSpec.fromAnsi(1);
    expect(c.type).toBe(ColorDepth.STANDARD);
    expect(c.number).toBe(1);
    expect(c.name).toBe("color(1)");
  });

  it("ColorSpec.fromAnsi() creates EIGHT_BIT for n >= 16", () => {
    const c = ColorSpec.fromAnsi(100);
    expect(c.type).toBe(ColorDepth.EIGHT_BIT);
    expect(c.number).toBe(100);
  });

  it("ColorSpec.fromRgba() creates a TRUECOLOR with the given triplet", () => {
    const t = new ColorRgba(10, 20, 30);
    const c = ColorSpec.fromRgba(t);
    expect(c.type).toBe(ColorDepth.TRUECOLOR);
    expect(c.value).toBe(t);
    expect(c.name).toBe(t.hex);
  });

  it("ColorSpec.fromRgb() creates a TRUECOLOR with r, g, b values", () => {
    const c = ColorSpec.fromRgb(100, 150, 200);
    expect(c.type).toBe(ColorDepth.TRUECOLOR);
    expect(c.value).toEqual(new ColorRgba(100, 150, 200));
  });
});

// ---------------------------------------------------------------------------
// Color properties
// ---------------------------------------------------------------------------

describe("ColorSpec properties", () => {
  it(".isDefault is true only for DEFAULT type", () => {
    expect(ColorSpec.default().isDefault).toBe(true);
    expect(ColorSpec.fromAnsi(1).isDefault).toBe(false);
    expect(ColorSpec.fromRgb(0, 0, 0).isDefault).toBe(false);
  });

  it(".isSystemDefined is true for STANDARD colors", () => {
    expect(ColorSpec.fromAnsi(1).isSystemDefined).toBe(true);
  });

  it(".isSystemDefined is false for EIGHT_BIT and TRUECOLOR", () => {
    expect(ColorSpec.fromAnsi(100).isSystemDefined).toBe(false);
    expect(ColorSpec.fromRgb(0, 0, 0).isSystemDefined).toBe(false);
  });

  it(".isSystemDefined is false for DEFAULT", () => {
    expect(ColorSpec.default().isSystemDefined).toBe(false);
  });

  it(".isSystemDefined is true for WINDOWS type", () => {
    const c = new ColorSpec("color(12)", ColorDepth.WINDOWS, 12);
    expect(c.type).toBe(ColorDepth.WINDOWS);
    expect(c.isSystemDefined).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ColorSpec.getAnsiCodes()
// ---------------------------------------------------------------------------

describe("ColorSpec.getAnsiCodes()", () => {
  it("DEFAULT foreground returns ['39']", () => {
    expect(ColorSpec.default().getAnsiCodes(true)).toEqual(["39"]);
  });

  it("DEFAULT background returns ['49']", () => {
    expect(ColorSpec.default().getAnsiCodes(false)).toEqual(["49"]);
  });

  it("STANDARD red (1) foreground returns ['31']", () => {
    expect(ColorSpec.fromAnsi(1).getAnsiCodes(true)).toEqual(["31"]);
  });

  it("STANDARD red (1) background returns ['41']", () => {
    expect(ColorSpec.fromAnsi(1).getAnsiCodes(false)).toEqual(["41"]);
  });

  it("STANDARD bright color (n >= 8) foreground uses 90+ range", () => {
    // bright_red = index 9 → 90 + 9 - 8 = 91
    const c = ColorSpec.fromAnsi(9);
    expect(c.getAnsiCodes(true)).toEqual(["91"]);
  });

  it("STANDARD bright color (n >= 8) background uses 100+ range", () => {
    // bright_red = index 9 → 100 + 9 - 8 = 101
    const c = ColorSpec.fromAnsi(9);
    expect(c.getAnsiCodes(false)).toEqual(["101"]);
  });

  it("STANDARD black (0) foreground returns ['30']", () => {
    expect(ColorSpec.fromAnsi(0).getAnsiCodes(true)).toEqual(["30"]);
  });

  it("STANDARD white (7) foreground returns ['37']", () => {
    expect(ColorSpec.fromAnsi(7).getAnsiCodes(true)).toEqual(["37"]);
  });

  it("EIGHT_BIT foreground returns ['38','5','N']", () => {
    const c = ColorSpec.fromAnsi(100);
    expect(c.getAnsiCodes(true)).toEqual(["38", "5", "100"]);
  });

  it("EIGHT_BIT background returns ['48','5','N']", () => {
    const c = ColorSpec.fromAnsi(100);
    expect(c.getAnsiCodes(false)).toEqual(["48", "5", "100"]);
  });

  it("TRUECOLOR foreground returns ['38','2','R','G','B']", () => {
    const c = ColorSpec.fromRgb(10, 20, 30);
    expect(c.getAnsiCodes(true)).toEqual(["38", "2", "10", "20", "30"]);
  });

  it("TRUECOLOR background returns ['48','2','R','G','B']", () => {
    const c = ColorSpec.fromRgb(10, 20, 30);
    expect(c.getAnsiCodes(false)).toEqual(["48", "2", "10", "20", "30"]);
  });

  it("defaults to foreground when called with no argument", () => {
    expect(ColorSpec.default().getAnsiCodes()).toEqual(["39"]);
  });
});

// ---------------------------------------------------------------------------
// ColorSpec.flattenAlpha()
// ---------------------------------------------------------------------------

describe("ColorSpec.flattenAlpha()", () => {
  const black = new ColorRgba(0, 0, 0);
  const white = new ColorRgba(255, 255, 255);

  it("opaque truecolor passes through (returns same instance)", () => {
    const c = ColorSpec.fromRgb(255, 0, 0);
    expect(c.flattenAlpha(white)).toBe(c);
  });

  it("translucent truecolor flattens against bg and produces a new opaque ColorSpec", () => {
    // alpha 0x80 = 128/255 ≈ 0.502
    const c = ColorSpec.parse("#ff000080");
    const out = c.flattenAlpha(black);
    expect(out.value!.red).toBe(128);
    expect(out.value!.green).toBe(0);
    expect(out.value!.blue).toBe(0);
    expect(out.value!.alpha).toBe(1);
  });

  it("non-truecolor (palette index) has no alpha and returns self", () => {
    const c = ColorSpec.fromAnsi(1); // STANDARD red
    expect(c.flattenAlpha(black)).toBe(c);
  });

  it("DEFAULT color returns self (no alpha to flatten)", () => {
    const c = ColorSpec.default();
    expect(c.flattenAlpha(white)).toBe(c);
  });

  it("idempotent: flattening an already-opaque result is a no-op", () => {
    const c = ColorSpec.parse("#ff000080");
    const flat1 = c.flattenAlpha(black);
    const flat2 = flat1.flattenAlpha(black);
    expect(flat2).toBe(flat1);
  });
});

// ---------------------------------------------------------------------------
// ColorSpec.downgrade()
// ---------------------------------------------------------------------------

describe("ColorSpec.downgrade()", () => {
  it("DEFAULT returns self regardless of target system", () => {
    const def = ColorSpec.default();
    expect(def.downgrade(ColorDepth.STANDARD)).toBe(def);
    expect(def.downgrade(ColorDepth.EIGHT_BIT)).toBe(def);
    expect(def.downgrade(ColorDepth.TRUECOLOR)).toBe(def);
  });

  it("returns self when already at or below the target system", () => {
    const std = ColorSpec.fromAnsi(1); // STANDARD
    expect(std.downgrade(ColorDepth.STANDARD)).toBe(std);
    expect(std.downgrade(ColorDepth.EIGHT_BIT)).toBe(std);
    expect(std.downgrade(ColorDepth.TRUECOLOR)).toBe(std);
  });

  it("TRUECOLOR downgrades to EIGHT_BIT", () => {
    const c = ColorSpec.fromRgb(255, 0, 0);
    const downgraded = c.downgrade(ColorDepth.EIGHT_BIT);
    expect(downgraded.type).toBe(ColorDepth.STANDARD); // 255,0,0 matches standard red
    // At minimum it should have a number
    expect(downgraded.number).toBeDefined();
  });

  it("TRUECOLOR downgrades to STANDARD", () => {
    const c = ColorSpec.fromRgb(255, 0, 0);
    const downgraded = c.downgrade(ColorDepth.STANDARD);
    expect(downgraded.type).toBe(ColorDepth.STANDARD);
    expect(downgraded.number).toBeDefined();
  });

  it("EIGHT_BIT downgrades to STANDARD", () => {
    const c = ColorSpec.fromAnsi(196); // Bright red in 256 palette
    const downgraded = c.downgrade(ColorDepth.STANDARD);
    expect(downgraded.type).toBe(ColorDepth.STANDARD);
    expect(downgraded.number).toBeDefined();
    expect(downgraded.number!).toBeLessThan(16);
  });

  it("caches downgrade results", () => {
    const c = ColorSpec.fromRgb(100, 200, 50);
    const first = c.downgrade(ColorDepth.STANDARD);
    const second = c.downgrade(ColorDepth.STANDARD);
    expect(first).toBe(second);
  });

  it("TRUECOLOR grayscale downgrades to EIGHT_BIT mapping to grayscale ramp", () => {
    // Use a gray that doesn't exactly match any standard 16 color,
    // so the nearest palette entry falls in the grayscale ramp (232-255).
    // Grayscale ramp entries: 8, 18, 28, 38, 48, 58, 68, 78, 88, 98, 108, 118, 128, ...
    // (108, 108, 108) is closest to index 245 (grey58) = (108, 108, 108)
    const c = ColorSpec.fromRgb(108, 108, 108);
    const downgraded = c.downgrade(ColorDepth.EIGHT_BIT);
    expect(downgraded.number).toBeDefined();
    expect(downgraded.number!).toBeGreaterThanOrEqual(232);
    expect(downgraded.number!).toBeLessThanOrEqual(255);
  });

  it("WINDOWS downgrades to STANDARD returning a STANDARD-type color", () => {
    // WINDOWS (system=4) > STANDARD (system=1), so downgrade is triggered
    const c = new ColorSpec("color(12)", ColorDepth.WINDOWS, 12);
    const downgraded = c.downgrade(ColorDepth.STANDARD);
    expect(downgraded.type).toBe(ColorDepth.STANDARD);
    expect(downgraded.number).toBeDefined();
    expect(downgraded.number!).toBeGreaterThanOrEqual(0);
    expect(downgraded.number!).toBeLessThan(16);
  });
});

// ---------------------------------------------------------------------------
// ColorSpec.getTruecolor()
// ---------------------------------------------------------------------------

describe("ColorSpec.getTruecolor()", () => {
  it("TRUECOLOR returns its own triplet", () => {
    const t = new ColorRgba(10, 20, 30);
    const c = ColorSpec.fromRgba(t);
    expect(c.getTruecolor()).toBe(t);
  });

  it("EIGHT_BIT looks up in EIGHT_BIT_TABLE", () => {
    const c = ColorSpec.fromAnsi(100);
    const result = c.getTruecolor();
    expect(result).toEqual(EIGHT_BIT_TABLE.get(100));
  });

  it("STANDARD looks up in theme's ansiColors", () => {
    const c = ColorSpec.fromAnsi(1); // STANDARD red
    const result = c.getTruecolor();
    // Default theme uses STANDARD_TABLE
    expect(result).toEqual(STANDARD_TABLE.get(1));
  });

  it("STANDARD uses provided theme when given", () => {
    const c = ColorSpec.fromAnsi(1);
    const result = c.getTruecolor(MONOKAI);
    expect(result).toEqual(MONOKAI.ansiColors.get(1));
  });

  it("DEFAULT foreground uses theme foregroundColor", () => {
    const c = ColorSpec.default();
    expect(c.getTruecolor(undefined, true)).toEqual(
      DEFAULT_TERMINAL_THEME.foregroundColor,
    );
  });

  it("DEFAULT background uses theme backgroundColor", () => {
    const c = ColorSpec.default();
    expect(c.getTruecolor(undefined, false)).toEqual(
      DEFAULT_TERMINAL_THEME.backgroundColor,
    );
  });

  it("DEFAULT uses explicit theme when provided", () => {
    const c = ColorSpec.default();
    expect(c.getTruecolor(MONOKAI, true)).toEqual(MONOKAI.foregroundColor);
    expect(c.getTruecolor(MONOKAI, false)).toEqual(MONOKAI.backgroundColor);
  });
});

// ---------------------------------------------------------------------------
// parseRgbHex
// ---------------------------------------------------------------------------

describe("parseRgbHex", () => {
  it("parses six-digit hex string into ColorRgba", () => {
    const t = parseRgbHex("ff8000");
    expect(t.red).toBe(255);
    expect(t.green).toBe(128);
    expect(t.blue).toBe(0);
  });

  it("parses 000000 as black", () => {
    const t = parseRgbHex("000000");
    expect(t).toEqual(new ColorRgba(0, 0, 0));
  });

  it("parses ffffff as white", () => {
    const t = parseRgbHex("ffffff");
    expect(t).toEqual(new ColorRgba(255, 255, 255));
  });

  it('parses "ff8040" into ColorRgba(255, 128, 64)', () => {
    const t = parseRgbHex("ff8040");
    expect(t).toEqual(new ColorRgba(255, 128, 64));
  });
});

// ---------------------------------------------------------------------------
// blendRgb
// ---------------------------------------------------------------------------

describe("blendRgb", () => {
  const black = new ColorRgba(0, 0, 0);
  const white = new ColorRgba(255, 255, 255);

  it("at crossFade=0.0 returns color1", () => {
    const result = blendRgb(black, white, 0.0);
    expect(result).toEqual(black);
  });

  it("at crossFade=1.0 returns color2", () => {
    const result = blendRgb(black, white, 1.0);
    expect(result).toEqual(white);
  });

  it("at crossFade=0.5 returns midpoint", () => {
    const result = blendRgb(black, white, 0.5);
    expect(result.red).toBe(128);
    expect(result.green).toBe(128);
    expect(result.blue).toBe(128);
  });

  it("defaults to crossFade=0.5 when omitted", () => {
    const result = blendRgb(black, white);
    expect(result.red).toBe(128);
    expect(result.green).toBe(128);
    expect(result.blue).toBe(128);
  });

  it("blends non-trivial colors correctly", () => {
    const c1 = new ColorRgba(100, 0, 200);
    const c2 = new ColorRgba(200, 100, 0);
    const result = blendRgb(c1, c2, 0.5);
    expect(result.red).toBe(150);
    expect(result.green).toBe(50);
    expect(result.blue).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// TerminalTheme and pre-built themes
// ---------------------------------------------------------------------------

describe("TerminalTheme", () => {
  it("stores background, foreground, ansiColors, and palette", () => {
    const bg = new ColorRgba(0, 0, 0);
    const fg = new ColorRgba(255, 255, 255);
    const pal = new ColorTable([bg, fg]);
    const palette = buildPalette("test", true, {
      primary: new ColorRgba(0, 111, 184),
      secondary: new ColorRgba(118, 38, 113),
      accent: new ColorRgba(0, 111, 184),
      success: new ColorRgba(0, 128, 0),
      warning: new ColorRgba(128, 128, 0),
      error: new ColorRgba(128, 0, 0),
      background: bg,
      foreground: fg,
    });
    const theme = new TerminalTheme(bg, fg, pal, palette);
    expect(theme.backgroundColor).toBe(bg);
    expect(theme.foregroundColor).toBe(fg);
    expect(theme.ansiColors).toBe(pal);
    expect(theme.palette).toBe(palette);
  });
});

describe("Pre-built themes", () => {
  it("DEFAULT_TERMINAL_THEME exists with expected colors", () => {
    expect(DEFAULT_TERMINAL_THEME.backgroundColor).toEqual(
      new ColorRgba(0, 0, 0),
    );
    expect(DEFAULT_TERMINAL_THEME.foregroundColor).toEqual(
      new ColorRgba(255, 255, 255),
    );
  });

  it("MONOKAI exists and has distinct background", () => {
    expect(MONOKAI.backgroundColor).toEqual(new ColorRgba(39, 40, 34));
  });

  it("SVG_EXPORT_THEME exists", () => {
    expect(SVG_EXPORT_THEME.backgroundColor).toEqual(
      new ColorRgba(41, 41, 41),
    );
  });
});

// ---------------------------------------------------------------------------
// ANSI_COLOR_NAMES and gray/grey aliases
// ---------------------------------------------------------------------------

describe("ANSI_COLOR_NAMES", () => {
  it("contains standard color names", () => {
    expect(ANSI_COLOR_NAMES["black"]).toBe(0);
    expect(ANSI_COLOR_NAMES["red"]).toBe(1);
    expect(ANSI_COLOR_NAMES["white"]).toBe(7);
    expect(ANSI_COLOR_NAMES["bright_white"]).toBe(15);
  });

  it("grey/gray aliases map to the same index", () => {
    expect(ANSI_COLOR_NAMES["grey50"]).toBe(ANSI_COLOR_NAMES["gray50"]);
    expect(ANSI_COLOR_NAMES["grey0"]).toBe(ANSI_COLOR_NAMES["gray0"]);
    expect(ANSI_COLOR_NAMES["grey100"]).toBe(ANSI_COLOR_NAMES["gray100"]);
  });

  it("grey37 has a gray37 alias", () => {
    expect(ANSI_COLOR_NAMES["gray37"]).toBe(59);
  });
});
