import { describe, it, expect } from "vitest";
import {
  ColorTriplet,
  ColorTable,
  Color,
  ColorType,
  ColorSystem,
  ColorParseError,
  parseRgbHex,
  blendRgb,
  TerminalTheme,
  STANDARD_TABLE,
  EIGHT_BIT_TABLE,
  WINDOWS_TABLE,
  DEFAULT_TERMINAL_THEME,
  MONOKAI,
  SVG_EXPORT_THEME,
  ANSI_COLOR_NAMES,
} from "../../src/core/color.js";

// ---------------------------------------------------------------------------
// ColorTriplet
// ---------------------------------------------------------------------------

describe("ColorTriplet", () => {
  it("stores red, green, blue as readonly properties", () => {
    const t = new ColorTriplet(10, 20, 30);
    expect(t.red).toBe(10);
    expect(t.green).toBe(20);
    expect(t.blue).toBe(30);
  });

  it(".hex returns zero-padded lowercase hex string", () => {
    expect(new ColorTriplet(255, 0, 0).hex).toBe("#ff0000");
    expect(new ColorTriplet(0, 255, 0).hex).toBe("#00ff00");
    expect(new ColorTriplet(0, 0, 255).hex).toBe("#0000ff");
    expect(new ColorTriplet(0, 0, 0).hex).toBe("#000000");
    expect(new ColorTriplet(1, 2, 3).hex).toBe("#010203");
  });

  it(".rgb returns rgb(...) string", () => {
    expect(new ColorTriplet(255, 128, 0).rgb).toBe("rgb(255,128,0)");
  });

  it(".normalized returns [0-1] tuple", () => {
    const [r, g, b] = new ColorTriplet(255, 0, 128).normalized;
    expect(r).toBe(1);
    expect(g).toBe(0);
    expect(b).toBeCloseTo(128 / 255);
  });

  it(".normalized of black is [0,0,0]", () => {
    expect(new ColorTriplet(0, 0, 0).normalized).toEqual([0, 0, 0]);
  });

  it(".normalized of white is [1,1,1]", () => {
    expect(new ColorTriplet(255, 255, 255).normalized).toEqual([1, 1, 1]);
  });
});

// ---------------------------------------------------------------------------
// ColorTable
// ---------------------------------------------------------------------------

describe("ColorTable", () => {
  const palette = new ColorTable([
    new ColorTriplet(0, 0, 0),
    new ColorTriplet(255, 0, 0),
    new ColorTriplet(0, 255, 0),
    new ColorTriplet(0, 0, 255),
  ]);

  it(".get() retrieves the triplet at a given index", () => {
    expect(palette.get(0)).toEqual(new ColorTriplet(0, 0, 0));
    expect(palette.get(1)).toEqual(new ColorTriplet(255, 0, 0));
  });

  it(".size returns the number of entries", () => {
    expect(palette.size).toBe(4);
  });

  it(".match() returns the index of the nearest color", () => {
    // Exact red
    expect(palette.match(new ColorTriplet(255, 0, 0))).toBe(1);
    // Very close to green
    expect(palette.match(new ColorTriplet(10, 240, 10))).toBe(2);
    // Very close to blue
    expect(palette.match(new ColorTriplet(5, 5, 250))).toBe(3);
    // Black
    expect(palette.match(new ColorTriplet(0, 0, 0))).toBe(0);
  });

  it(".match() caches results — second call returns same value", () => {
    const target = new ColorTriplet(200, 10, 10);
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
    expect(EIGHT_BIT_TABLE.get(0)).toEqual(new ColorTriplet(0, 0, 0));
  });
});

// ---------------------------------------------------------------------------
// Color.parse()
// ---------------------------------------------------------------------------

describe("Color.parse()", () => {
  it('parses "default" with no number and no triplet', () => {
    const c = Color.parse("default");
    expect(c.type).toBe(ColorType.DEFAULT);
    expect(c.isDefault).toBe(true);
    expect(c.number).toBeUndefined();
    expect(c.triplet).toBeUndefined();
  });

  it("parses empty string as default", () => {
    const c = Color.parse("");
    expect(c.type).toBe(ColorType.DEFAULT);
  });

  it('parses "red" as STANDARD color number 1', () => {
    const c = Color.parse("red");
    expect(c.type).toBe(ColorType.STANDARD);
    expect(c.number).toBe(1);
  });

  it("is case-insensitive: RED, Red, rEd all parse the same", () => {
    const c1 = Color.parse("RED");
    const c2 = Color.parse("Red");
    const c3 = Color.parse("rEd");
    // All should resolve to same cached instance via lowercase key
    expect(c1.number).toBe(1);
    expect(c2.number).toBe(1);
    expect(c3.number).toBe(1);
    expect(c1.type).toBe(ColorType.STANDARD);
  });

  it('parses "bright_red" as STANDARD color number 9', () => {
    const c = Color.parse("bright_red");
    expect(c.type).toBe(ColorType.STANDARD);
    expect(c.number).toBe(9);
  });

  it('parses "color(5)" as STANDARD (number < 16)', () => {
    const c = Color.parse("color(5)");
    expect(c.type).toBe(ColorType.STANDARD);
    expect(c.number).toBe(5);
  });

  it('parses "color(100)" as EIGHT_BIT (number >= 16)', () => {
    const c = Color.parse("color(100)");
    expect(c.type).toBe(ColorType.EIGHT_BIT);
    expect(c.number).toBe(100);
  });

  it('parses "#ff0000" as TRUECOLOR', () => {
    const c = Color.parse("#ff0000");
    expect(c.type).toBe(ColorType.TRUECOLOR);
    expect(c.triplet).toEqual(new ColorTriplet(255, 0, 0));
  });

  it('parses "#FF0000" (uppercase hex) via case normalization', () => {
    const c = Color.parse("#FF0000");
    expect(c.type).toBe(ColorType.TRUECOLOR);
    expect(c.triplet).toEqual(new ColorTriplet(255, 0, 0));
  });

  it('parses "rgb(255,0,0)" as TRUECOLOR', () => {
    const c = Color.parse("rgb(255,0,0)");
    expect(c.type).toBe(ColorType.TRUECOLOR);
    expect(c.triplet).toEqual(new ColorTriplet(255, 0, 0));
  });

  it("parses rgb with spaces: rgb( 10 , 20 , 30 )", () => {
    const c = Color.parse("rgb( 10 , 20 , 30 )");
    expect(c.type).toBe(ColorType.TRUECOLOR);
    expect(c.triplet).toEqual(new ColorTriplet(10, 20, 30));
  });

  it('"grey50" resolves to palette index 244', () => {
    const c = Color.parse("grey50");
    expect(c.number).toBe(244);
  });

  it('"gray50" alias resolves to the same index as "grey50"', () => {
    const grey = Color.parse("grey50");
    const gray = Color.parse("gray50");
    expect(grey.number).toBe(gray.number);
  });

  it("throws ColorParseError on invalid color string", () => {
    expect(() => Color.parse("not_a_color_at_all")).toThrow(ColorParseError);
  });

  it('throws ColorParseError on "color(256)" (out of range)', () => {
    expect(() => Color.parse("color(256)")).toThrow(ColorParseError);
    expect(() => Color.parse("color(256)")).toThrow(/out of range/);
  });

  it("returns cached instance for repeated parse calls", () => {
    const a = Color.parse("blue");
    const b = Color.parse("blue");
    expect(a).toBe(b);
  });

  it('parses "navy_blue" as extended color name with number 17', () => {
    const c = Color.parse("navy_blue");
    expect(c.number).toBe(17);
  });

  it("parse caching returns same reference (reference equality)", () => {
    const a = Color.parse("red");
    const b = Color.parse("red");
    expect(a === b).toBe(true);
  });

  it('parses "color(0)" as STANDARD', () => {
    const c = Color.parse("color(0)");
    expect(c.type).toBe(ColorType.STANDARD);
    expect(c.number).toBe(0);
  });

  it('parses "color(255)" as EIGHT_BIT', () => {
    const c = Color.parse("color(255)");
    expect(c.type).toBe(ColorType.EIGHT_BIT);
    expect(c.number).toBe(255);
  });

  it('parses "color(15)" as STANDARD (boundary)', () => {
    const c = Color.parse("color(15)");
    expect(c.type).toBe(ColorType.STANDARD);
    expect(c.number).toBe(15);
  });

  it('parses "color(16)" as EIGHT_BIT (boundary)', () => {
    const c = Color.parse("color(16)");
    expect(c.type).toBe(ColorType.EIGHT_BIT);
    expect(c.number).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// Color factory methods
// ---------------------------------------------------------------------------

describe("Color factory methods", () => {
  it("Color.default() creates a DEFAULT color", () => {
    const c = Color.default();
    expect(c.type).toBe(ColorType.DEFAULT);
    expect(c.name).toBe("default");
    expect(c.number).toBeUndefined();
    expect(c.triplet).toBeUndefined();
  });

  it("Color.fromAnsi() creates STANDARD for n < 16", () => {
    const c = Color.fromAnsi(1);
    expect(c.type).toBe(ColorType.STANDARD);
    expect(c.number).toBe(1);
    expect(c.name).toBe("color(1)");
  });

  it("Color.fromAnsi() creates EIGHT_BIT for n >= 16", () => {
    const c = Color.fromAnsi(100);
    expect(c.type).toBe(ColorType.EIGHT_BIT);
    expect(c.number).toBe(100);
  });

  it("Color.fromTriplet() creates a TRUECOLOR with the given triplet", () => {
    const t = new ColorTriplet(10, 20, 30);
    const c = Color.fromTriplet(t);
    expect(c.type).toBe(ColorType.TRUECOLOR);
    expect(c.triplet).toBe(t);
    expect(c.name).toBe(t.hex);
  });

  it("Color.fromRgb() creates a TRUECOLOR with r, g, b values", () => {
    const c = Color.fromRgb(100, 150, 200);
    expect(c.type).toBe(ColorType.TRUECOLOR);
    expect(c.triplet).toEqual(new ColorTriplet(100, 150, 200));
  });
});

// ---------------------------------------------------------------------------
// Color properties
// ---------------------------------------------------------------------------

describe("Color properties", () => {
  it(".system maps DEFAULT to STANDARD", () => {
    expect(Color.default().system).toBe(ColorSystem.STANDARD);
  });

  it(".system maps STANDARD to STANDARD", () => {
    expect(Color.fromAnsi(1).system).toBe(ColorSystem.STANDARD);
  });

  it(".system maps EIGHT_BIT to EIGHT_BIT", () => {
    expect(Color.fromAnsi(100).system).toBe(ColorSystem.EIGHT_BIT);
  });

  it(".system maps TRUECOLOR to TRUECOLOR", () => {
    expect(Color.fromRgb(1, 2, 3).system).toBe(ColorSystem.TRUECOLOR);
  });

  it(".isDefault is true only for DEFAULT type", () => {
    expect(Color.default().isDefault).toBe(true);
    expect(Color.fromAnsi(1).isDefault).toBe(false);
    expect(Color.fromRgb(0, 0, 0).isDefault).toBe(false);
  });

  it(".isSystemDefined is true for STANDARD colors", () => {
    expect(Color.fromAnsi(1).isSystemDefined).toBe(true);
  });

  it(".isSystemDefined is false for EIGHT_BIT and TRUECOLOR", () => {
    expect(Color.fromAnsi(100).isSystemDefined).toBe(false);
    expect(Color.fromRgb(0, 0, 0).isSystemDefined).toBe(false);
  });

  it(".isSystemDefined is false for DEFAULT", () => {
    expect(Color.default().isSystemDefined).toBe(false);
  });

  it(".system maps WINDOWS to WINDOWS", () => {
    const c = new Color("color(12)", ColorType.WINDOWS, 12);
    expect(c.system).toBe(ColorSystem.WINDOWS);
  });

  it(".isSystemDefined is true for WINDOWS type", () => {
    const c = new Color("color(12)", ColorType.WINDOWS, 12);
    expect(c.type).toBe(ColorType.WINDOWS);
    expect(c.isSystemDefined).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Color.getAnsiCodes()
// ---------------------------------------------------------------------------

describe("Color.getAnsiCodes()", () => {
  it("DEFAULT foreground returns ['39']", () => {
    expect(Color.default().getAnsiCodes(true)).toEqual(["39"]);
  });

  it("DEFAULT background returns ['49']", () => {
    expect(Color.default().getAnsiCodes(false)).toEqual(["49"]);
  });

  it("STANDARD red (1) foreground returns ['31']", () => {
    expect(Color.fromAnsi(1).getAnsiCodes(true)).toEqual(["31"]);
  });

  it("STANDARD red (1) background returns ['41']", () => {
    expect(Color.fromAnsi(1).getAnsiCodes(false)).toEqual(["41"]);
  });

  it("STANDARD bright color (n >= 8) foreground uses 90+ range", () => {
    // bright_red = index 9 → 90 + 9 - 8 = 91
    const c = Color.fromAnsi(9);
    expect(c.getAnsiCodes(true)).toEqual(["91"]);
  });

  it("STANDARD bright color (n >= 8) background uses 100+ range", () => {
    // bright_red = index 9 → 100 + 9 - 8 = 101
    const c = Color.fromAnsi(9);
    expect(c.getAnsiCodes(false)).toEqual(["101"]);
  });

  it("STANDARD black (0) foreground returns ['30']", () => {
    expect(Color.fromAnsi(0).getAnsiCodes(true)).toEqual(["30"]);
  });

  it("STANDARD white (7) foreground returns ['37']", () => {
    expect(Color.fromAnsi(7).getAnsiCodes(true)).toEqual(["37"]);
  });

  it("EIGHT_BIT foreground returns ['38','5','N']", () => {
    const c = Color.fromAnsi(100);
    expect(c.getAnsiCodes(true)).toEqual(["38", "5", "100"]);
  });

  it("EIGHT_BIT background returns ['48','5','N']", () => {
    const c = Color.fromAnsi(100);
    expect(c.getAnsiCodes(false)).toEqual(["48", "5", "100"]);
  });

  it("TRUECOLOR foreground returns ['38','2','R','G','B']", () => {
    const c = Color.fromRgb(10, 20, 30);
    expect(c.getAnsiCodes(true)).toEqual(["38", "2", "10", "20", "30"]);
  });

  it("TRUECOLOR background returns ['48','2','R','G','B']", () => {
    const c = Color.fromRgb(10, 20, 30);
    expect(c.getAnsiCodes(false)).toEqual(["48", "2", "10", "20", "30"]);
  });

  it("defaults to foreground when called with no argument", () => {
    expect(Color.default().getAnsiCodes()).toEqual(["39"]);
  });
});

// ---------------------------------------------------------------------------
// Color.downgrade()
// ---------------------------------------------------------------------------

describe("Color.downgrade()", () => {
  it("DEFAULT returns self regardless of target system", () => {
    const def = Color.default();
    expect(def.downgrade(ColorSystem.STANDARD)).toBe(def);
    expect(def.downgrade(ColorSystem.EIGHT_BIT)).toBe(def);
    expect(def.downgrade(ColorSystem.TRUECOLOR)).toBe(def);
  });

  it("returns self when already at or below the target system", () => {
    const std = Color.fromAnsi(1); // STANDARD
    expect(std.downgrade(ColorSystem.STANDARD)).toBe(std);
    expect(std.downgrade(ColorSystem.EIGHT_BIT)).toBe(std);
    expect(std.downgrade(ColorSystem.TRUECOLOR)).toBe(std);
  });

  it("TRUECOLOR downgrades to EIGHT_BIT", () => {
    const c = Color.fromRgb(255, 0, 0);
    const downgraded = c.downgrade(ColorSystem.EIGHT_BIT);
    expect(downgraded.type).toBe(ColorType.STANDARD); // 255,0,0 matches standard red
    // At minimum it should have a number
    expect(downgraded.number).toBeDefined();
  });

  it("TRUECOLOR downgrades to STANDARD", () => {
    const c = Color.fromRgb(255, 0, 0);
    const downgraded = c.downgrade(ColorSystem.STANDARD);
    expect(downgraded.type).toBe(ColorType.STANDARD);
    expect(downgraded.number).toBeDefined();
  });

  it("EIGHT_BIT downgrades to STANDARD", () => {
    const c = Color.fromAnsi(196); // Bright red in 256 palette
    const downgraded = c.downgrade(ColorSystem.STANDARD);
    expect(downgraded.type).toBe(ColorType.STANDARD);
    expect(downgraded.number).toBeDefined();
    expect(downgraded.number!).toBeLessThan(16);
  });

  it("caches downgrade results", () => {
    const c = Color.fromRgb(100, 200, 50);
    const first = c.downgrade(ColorSystem.STANDARD);
    const second = c.downgrade(ColorSystem.STANDARD);
    expect(first).toBe(second);
  });

  it("TRUECOLOR grayscale downgrades to EIGHT_BIT mapping to grayscale ramp", () => {
    // Use a gray that doesn't exactly match any standard 16 color,
    // so the nearest palette entry falls in the grayscale ramp (232-255).
    // Grayscale ramp entries: 8, 18, 28, 38, 48, 58, 68, 78, 88, 98, 108, 118, 128, ...
    // (108, 108, 108) is closest to index 245 (grey58) = (108, 108, 108)
    const c = Color.fromRgb(108, 108, 108);
    const downgraded = c.downgrade(ColorSystem.EIGHT_BIT);
    expect(downgraded.number).toBeDefined();
    expect(downgraded.number!).toBeGreaterThanOrEqual(232);
    expect(downgraded.number!).toBeLessThanOrEqual(255);
  });

  it("WINDOWS downgrades to STANDARD returning a STANDARD-type color", () => {
    // WINDOWS (system=4) > STANDARD (system=1), so downgrade is triggered
    const c = new Color("color(12)", ColorType.WINDOWS, 12);
    const downgraded = c.downgrade(ColorSystem.STANDARD);
    expect(downgraded.type).toBe(ColorType.STANDARD);
    expect(downgraded.number).toBeDefined();
    expect(downgraded.number!).toBeGreaterThanOrEqual(0);
    expect(downgraded.number!).toBeLessThan(16);
  });
});

// ---------------------------------------------------------------------------
// Color.getTruecolor()
// ---------------------------------------------------------------------------

describe("Color.getTruecolor()", () => {
  it("TRUECOLOR returns its own triplet", () => {
    const t = new ColorTriplet(10, 20, 30);
    const c = Color.fromTriplet(t);
    expect(c.getTruecolor()).toBe(t);
  });

  it("EIGHT_BIT looks up in EIGHT_BIT_TABLE", () => {
    const c = Color.fromAnsi(100);
    const result = c.getTruecolor();
    expect(result).toEqual(EIGHT_BIT_TABLE.get(100));
  });

  it("STANDARD looks up in theme's ansiColors", () => {
    const c = Color.fromAnsi(1); // STANDARD red
    const result = c.getTruecolor();
    // Default theme uses STANDARD_TABLE
    expect(result).toEqual(STANDARD_TABLE.get(1));
  });

  it("STANDARD uses provided theme when given", () => {
    const c = Color.fromAnsi(1);
    const result = c.getTruecolor(MONOKAI);
    expect(result).toEqual(MONOKAI.ansiColors.get(1));
  });

  it("DEFAULT foreground uses theme foregroundColor", () => {
    const c = Color.default();
    expect(c.getTruecolor(undefined, true)).toEqual(
      DEFAULT_TERMINAL_THEME.foregroundColor,
    );
  });

  it("DEFAULT background uses theme backgroundColor", () => {
    const c = Color.default();
    expect(c.getTruecolor(undefined, false)).toEqual(
      DEFAULT_TERMINAL_THEME.backgroundColor,
    );
  });

  it("DEFAULT uses explicit theme when provided", () => {
    const c = Color.default();
    expect(c.getTruecolor(MONOKAI, true)).toEqual(MONOKAI.foregroundColor);
    expect(c.getTruecolor(MONOKAI, false)).toEqual(MONOKAI.backgroundColor);
  });
});

// ---------------------------------------------------------------------------
// parseRgbHex
// ---------------------------------------------------------------------------

describe("parseRgbHex", () => {
  it("parses six-digit hex string into ColorTriplet", () => {
    const t = parseRgbHex("ff8000");
    expect(t.red).toBe(255);
    expect(t.green).toBe(128);
    expect(t.blue).toBe(0);
  });

  it("parses 000000 as black", () => {
    const t = parseRgbHex("000000");
    expect(t).toEqual(new ColorTriplet(0, 0, 0));
  });

  it("parses ffffff as white", () => {
    const t = parseRgbHex("ffffff");
    expect(t).toEqual(new ColorTriplet(255, 255, 255));
  });

  it('parses "ff8040" into ColorTriplet(255, 128, 64)', () => {
    const t = parseRgbHex("ff8040");
    expect(t).toEqual(new ColorTriplet(255, 128, 64));
  });
});

// ---------------------------------------------------------------------------
// blendRgb
// ---------------------------------------------------------------------------

describe("blendRgb", () => {
  const black = new ColorTriplet(0, 0, 0);
  const white = new ColorTriplet(255, 255, 255);

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
    const c1 = new ColorTriplet(100, 0, 200);
    const c2 = new ColorTriplet(200, 100, 0);
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
  it("stores background, foreground, and ansiColors", () => {
    const bg = new ColorTriplet(0, 0, 0);
    const fg = new ColorTriplet(255, 255, 255);
    const pal = new ColorTable([bg, fg]);
    const theme = new TerminalTheme(bg, fg, pal);
    expect(theme.backgroundColor).toBe(bg);
    expect(theme.foregroundColor).toBe(fg);
    expect(theme.ansiColors).toBe(pal);
  });
});

describe("Pre-built themes", () => {
  it("DEFAULT_TERMINAL_THEME exists with expected colors", () => {
    expect(DEFAULT_TERMINAL_THEME.backgroundColor).toEqual(
      new ColorTriplet(0, 0, 0),
    );
    expect(DEFAULT_TERMINAL_THEME.foregroundColor).toEqual(
      new ColorTriplet(255, 255, 255),
    );
  });

  it("MONOKAI exists and has distinct background", () => {
    expect(MONOKAI.backgroundColor).toEqual(new ColorTriplet(12, 12, 12));
  });

  it("SVG_EXPORT_THEME exists", () => {
    expect(SVG_EXPORT_THEME.backgroundColor).toEqual(
      new ColorTriplet(41, 41, 41),
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
