import { describe, it, expect } from "vitest";
import {
  ColorRgba,
  ColorTable,
  ColorSpec,
  ColorDepth,
  ColorParseError,
  parseRgbHex,
  parseRgbaHex,
  parseHexColor,
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
  ATOM_ONE_DARK,
  ATOM_ONE_LIGHT,
  CATPPUCCIN_MOCHA,
  SVG_EXPORT_THEME,
} from "../../src/themes/terminalThemes.js";
import { buildPalette } from "../../src/themes/buildPalette.js";
import { Palette } from "../../src/themes/palette.js";
import { Style } from "../../src/core/style.js";

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

  it(".match() stays correct past its memo's size cap", () => {
    const entries = [[0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255]] as const;
    const table = new ColorTable(entries.map(([r, g, b]) => new ColorRgba(r, g, b)));
    const oracle = (r: number, g: number, b: number): number => {
      const d = entries.map(([er, eg, eb]) => (er - r) ** 2 + (eg - g) ** 2 + (eb - b) ** 2);
      return d.indexOf(Math.min(...d));
    };
    // 64 × 64 × 2 = 8192 distinct keys, twice the cap, then a key from the
    // first half again, which the clear has dropped and must recompute.
    for (let r = 0; r < 256; r += 4)
      for (let g = 0; g < 256; g += 4)
        for (const b of [0, 255])
          expect(table.match(new ColorRgba(r, g, b))).toBe(oracle(r, g, b));
    expect(table.match(new ColorRgba(0, 4, 0))).toBe(oracle(0, 4, 0));
  });

  it(".matchReadable() picks the nearest entry that clears the ratio, else the most contrast", () => {
    const black = new ColorRgba(0, 0, 0);
    // Blue itself draws at 2.4:1 on black; red (5.3) and green (15.3) pass,
    // and green is nearer this sky blue than red is.
    const sky = new ColorRgba(0, 60, 255);
    expect(palette.match(sky)).toBe(3);
    expect(palette.matchReadable(sky, black, 4.5)).toBe(2);
    // An entry that already passes is its own answer.
    expect(palette.matchReadable(new ColorRgba(240, 10, 10), black, 4.5)).toBe(1);
    // Nothing reaches 21:1 on mid-grey: the most contrast wins (black, 5.3:1).
    expect(palette.matchReadable(sky, new ColorRgba(128, 128, 128), 21)).toBe(0);
    // Indices are the terminal's: a table starting at 16 answers from 16.
    const offset = new ColorTable(
      [black, new ColorRgba(255, 0, 0), new ColorRgba(0, 255, 0), new ColorRgba(0, 0, 255)],
      16,
    );
    expect(offset.matchReadable(sky, black, 4.5)).toBe(18);
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

  it.each([
    ["color(256)", "number 256"],
    ["color(1000)", "number 1000"],
    ["rgb(256,0,0)", "red 256"],
    ["rgb(0,300,0)", "green 300"],
    ["rgb(0,0,1000)", "blue 1000"],
  ])("%s is a ColorParseError naming the key and the out-of-range %s", (key, field) => {
    expect(() => ColorSpec.parse(key)).toThrow(ColorParseError);
    expect(() => ColorSpec.parse(key)).toThrow(`ColorSpec "${key}": ${field} is out of range (0-255)`);
  });

  it("parses the top of the byte range", () => {
    expect(ColorSpec.parse("rgb(255,255,255)").value).toEqual(new ColorRgba(255, 255, 255));
    expect(ColorSpec.parse("color(255)").number).toBe(255);
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

describe("ColorSpec.fixedValue", () => {
  it("is the colour every terminal draws: a truecolor value, or a 256-colour cube or grey entry", () => {
    expect(ColorSpec.parse("#123456").fixedValue?.hex).toBe("#123456");
    expect(ColorSpec.fromAnsi(23).fixedValue?.hex).toBe(EIGHT_BIT_TABLE.get(23).hex);
    expect(ColorSpec.fromAnsi(240).fixedValue?.hex).toBe(EIGHT_BIT_TABLE.get(240).hex);
  });

  it("is absent where the terminal theme decides: ANSI 0-15 and the default", () => {
    expect(ColorSpec.fromAnsi(9).fixedValue).toBeUndefined();
    expect(ColorSpec.parse("red").fixedValue).toBeUndefined();
    expect(ColorSpec.default().fixedValue).toBeUndefined();
    // The constructor admits an EIGHT_BIT spec on a theme slot.
    expect(new ColorSpec("color(1)", ColorDepth.EIGHT_BIT, 1).fixedValue).toBeUndefined();
  });
});

describe("ColorTable.matchWhere()", () => {
  it("is the nearest entry the predicate takes, by the distance match uses", () => {
    const near = new ColorRgba(200, 10, 10);
    const all = STANDARD_TABLE.matchWhere(near, () => true);
    expect(all).toBe(STANDARD_TABLE.match(near));
    const refused = STANDARD_TABLE.matchWhere(near, (_, i) => i !== all);
    expect(refused).not.toBe(all);
    expect(refused).toBeDefined();
  });

  it("asks the predicate nearest-first and stops at the first it takes", () => {
    const table = EIGHT_BIT_TABLE;
    const value = new ColorRgba(128, 128, 128);
    const asked: number[] = [];
    const nearest = table.match(value);
    const found = table.matchWhere(value, (_, i) => {
      asked.push(i);
      return i !== nearest;
    });
    expect(asked[0]).toBe(nearest);
    expect(asked).toHaveLength(2);
    expect(found).toBe(asked[1]);
  });

  it("is undefined when the predicate takes nothing", () => {
    expect(STANDARD_TABLE.matchWhere(new ColorRgba(0, 0, 0), () => false)).toBeUndefined();
  });
});

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
    // The cube's pure red, not ANSI 9: indices 0-15 are the terminal's own.
    expect([downgraded.type, downgraded.number]).toEqual([ColorDepth.EIGHT_BIT, 196]);
  });

  it("a downgrade to 256 never picks a terminal-defined index 0-15", () => {
    for (let v = 0; v < 256; v += 5) {
      const rgbs: [number, number, number][] = [[v, v, v], [v, 0, 0], [0, v, 0], [0, 0, v], [v, 255 - v, v]];
      for (const rgb of rgbs) {
        const n = ColorSpec.fromRgb(...rgb).downgrade(ColorDepth.EIGHT_BIT).number!;
        expect([rgb, n >= 16]).toEqual([rgb, true]);
      }
    }
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

  it("WINDOWS and STANDARD are the same sixteen slots: each becomes the other in the same slot", () => {
    const win = new ColorSpec("color(12)", ColorDepth.WINDOWS, 12);
    const std = ColorSpec.fromAnsi(12);
    expect([win.downgrade(ColorDepth.STANDARD).type, win.downgrade(ColorDepth.STANDARD).number]).toEqual([ColorDepth.STANDARD, 12]);
    expect([std.downgrade(ColorDepth.WINDOWS).type, std.downgrade(ColorDepth.WINDOWS).number]).toEqual([ColorDepth.WINDOWS, 12]);
  });

  it("a blend of named colours drawn at WINDOWS ramps between the console's own shades", () => {
    // Mixed from the VGA ends instead, three quarters of the way to yellow is green (slot 2).
    const blend = ColorSpec.parse("blend(black,yellow,0.75)").downgrade(ColorDepth.WINDOWS);
    expect([blend.type, blend.number]).toEqual([ColorDepth.WINDOWS, 3]);
  });

  it("with no theme named, a colour drawn at WINDOWS reads as the console's own colour", () => {
    expect(ColorSpec.parse("red").downgrade(ColorDepth.WINDOWS).getTruecolor()).toEqual(WINDOWS_TABLE.get(1));
    expect(ColorSpec.parse("#0037da").downgrade(ColorDepth.WINDOWS).getTruecolor()).toEqual(new ColorRgba(0, 55, 218));
    expect(ColorSpec.parse("red").getTruecolor()).toEqual(STANDARD_TABLE.get(1));
  });

  it("a WINDOWS colour is drawn at every richer depth as itself", () => {
    const win = new ColorSpec("color(12)", ColorDepth.WINDOWS, 12);
    expect(win.downgrade(ColorDepth.EIGHT_BIT)).toBe(win);
    expect(win.downgrade(ColorDepth.TRUECOLOR)).toBe(win);
  });

  it("TRUECOLOR downgrades to WINDOWS as the console's nearest colour, in ANSI slot order", () => {
    for (let i = 0; i < 16; i++) {
      const downgraded = ColorSpec.fromRgba(WINDOWS_TABLE.get(i)).downgrade(ColorDepth.WINDOWS);
      expect([downgraded.type, downgraded.number]).toEqual([ColorDepth.WINDOWS, i]);
    }
    // Slot n is written as SGR 30+n, so a red is written as a red.
    expect(ColorSpec.parse("#ff0000").downgrade(ColorDepth.WINDOWS).getAnsiCodes()).toEqual(["31"]);
    expect(ColorSpec.parse("#0000c0").downgrade(ColorDepth.WINDOWS).getAnsiCodes(false)).toEqual(["44"]);
  });

  it("EIGHT_BIT downgrades to WINDOWS: a cube colour is matched, an ANSI slot keeps its index", () => {
    const cube = ColorSpec.parse("color(196)").downgrade(ColorDepth.WINDOWS);
    expect(cube.type).toBe(ColorDepth.WINDOWS);
    expect(cube.number).toBe(WINDOWS_TABLE.match(EIGHT_BIT_TABLE.get(196)));
    const slot = new ColorSpec("color(3)", ColorDepth.EIGHT_BIT, 3).downgrade(ColorDepth.WINDOWS);
    expect([slot.type, slot.number]).toEqual([ColorDepth.WINDOWS, 3]);
  });
});

describe("ColorSpec.matchOn()", () => {
  const codes = (value: ColorRgba, depth: ColorDepth, foreground: boolean): string[] =>
    ColorSpec.matchOn(value, depth, CATPPUCCIN_MOCHA, foreground).getAnsiCodes(foreground);

  it("draws each of the theme's sixteen as its own slot, at sixteen colours and at 256", () => {
    for (const depth of [ColorDepth.STANDARD, ColorDepth.WINDOWS, ColorDepth.EIGHT_BIT]) {
      for (let n = 0; n < 16; n++) {
        expect(ColorSpec.matchOn(CATPPUCCIN_MOCHA.ansiColors.get(n), depth, CATPPUCCIN_MOCHA, true).number).toBe(n);
      }
    }
    // Mocha's red is a slot of its own under the theme, and some other slot under the stock sixteen.
    expect(ColorSpec.fromRgba(CATPPUCCIN_MOCHA.ansiColors.get(1)).downgrade(ColorDepth.STANDARD).number).not.toBe(1);
  });

  it("draws the theme's default colours as the default, glyph and ground each its own", () => {
    for (const depth of [ColorDepth.STANDARD, ColorDepth.EIGHT_BIT]) {
      expect(codes(CATPPUCCIN_MOCHA.foregroundColor, depth, true)).toEqual(["39"]);
      expect(codes(CATPPUCCIN_MOCHA.backgroundColor, depth, false)).toEqual(["49"]);
    }
  });

  it("reaches into the cube at 256 colours only when a cube colour is nearer", () => {
    expect(codes(new ColorRgba(255, 0, 0), ColorDepth.EIGHT_BIT, true)).toEqual(["38", "5", "196"]);
    expect(codes(new ColorRgba(255, 0, 0), ColorDepth.STANDARD, true)).toEqual(["31"]);
  });

  it("writes truecolor as the value itself, and refuses a translucent one", () => {
    const v = new ColorRgba(1, 2, 3);
    expect(ColorSpec.matchOn(v, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA, true).value).toEqual(v);
    expect(() => ColorSpec.matchOn(new ColorRgba(1, 2, 3, 0.5), ColorDepth.STANDARD, CATPPUCCIN_MOCHA, true)).toThrow(RangeError);
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

  it("a named colour draws in the bundled theme's own shade, not VGA's", () => {
    const blue = ColorSpec.parse("blue");
    expect(blue.getTruecolor(ATOM_ONE_DARK).hex).toBe("#61afef");
    expect(blue.getTruecolor(ATOM_ONE_LIGHT).hex).toBe("#0184bc");
    expect(ColorSpec.parse("bright_magenta").getTruecolor(ATOM_ONE_LIGHT).hex).toBe("#c678dd");
  });

  it("an EIGHT_BIT spec on slots 0–15 draws in the theme's table, like the STANDARD one", () => {
    const eightBitBlue = new ColorSpec("color(4)", ColorDepth.EIGHT_BIT, 4);
    expect(eightBitBlue.getTruecolor(ATOM_ONE_DARK)).toEqual(ColorSpec.parse("blue").getTruecolor(ATOM_ONE_DARK));
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

describe("ColorSpec.blend()", () => {
  const blue = ColorSpec.parse("blue");
  const red = ColorSpec.parse("red");

  it("draws as the mix of the shades a theme draws its ends in", () => {
    const mixed = ColorSpec.blend(blue, red, 0.25);
    expect(mixed.getTruecolor(ATOM_ONE_DARK)).toEqual(
      blendRgb(ATOM_ONE_DARK.ansiColors.get(4), ATOM_ONE_DARK.ansiColors.get(1), 0.25),
    );
    expect(mixed.fixedValue).toBeUndefined();
    expect(mixed.flattenAlpha(new ColorRgba(255, 255, 255))).toBe(mixed);
  });

  it("tells a terminal the mix under the standard table, at every depth", () => {
    const mixed = ColorSpec.blend(blue, red, 0.25);
    const standard = blendRgb(STANDARD_TABLE.get(4), STANDARD_TABLE.get(1), 0.25);
    expect(mixed.getAnsiCodes(false)).toEqual(["48", "2", `${standard.red}`, `${standard.green}`, `${standard.blue}`]);
    expect(mixed.downgrade(ColorDepth.EIGHT_BIT)).toEqual(ColorSpec.fromRgba(standard).downgrade(ColorDepth.EIGHT_BIT));
  });

  it("mixes two fixed colours to a fixed colour", () => {
    const mixed = ColorSpec.blend(ColorSpec.parse("#000000"), ColorSpec.parse("color(231)"), 0.5);
    expect(mixed).toEqual(ColorSpec.fromRgba(blendRgb(new ColorRgba(0, 0, 0), new ColorRgba(255, 255, 255), 0.5)));
  });

  it("refuses an end that is no one colour, and a fraction outside [0, 1]", () => {
    expect(() => ColorSpec.blend(ColorSpec.default(), red, 0.5)).toThrow(ColorParseError);
    expect(() => ColorSpec.blend(ColorSpec.parse("#ffffff80"), red, 0.5)).toThrow(/translucent/);
    expect(() => ColorSpec.blend(blue, red, 1.5)).toThrow(ColorParseError);
    expect(() => ColorSpec.blend(blue, red, NaN)).toThrow(ColorParseError);
  });

  it("is named for what it mixes, so two mixes with one standard RGB stay two colours", () => {
    const navy = ColorSpec.parse("#000080");
    expect(ColorSpec.blend(blue, red, 0.5).value).toEqual(ColorSpec.blend(navy, red, 0.5).value);
    expect(ColorSpec.blend(blue, red, 0.5).name).not.toBe(ColorSpec.blend(navy, red, 0.5).name);
  });

  it("spells each end by what it draws as, so every spelling of one mix is one name", () => {
    const name = ColorSpec.blend(blue, red, 0.5).name;
    expect(ColorSpec.blend(ColorSpec.parse("color(4)"), red, 0.5).name).toBe(name);
    expect(ColorSpec.blend(new ColorSpec("x", ColorDepth.EIGHT_BIT, 4), red, 0.5).name).toBe(name);
    expect(ColorSpec.blend(ColorSpec.parse("grey50"), red, 0.5).name).toBe(ColorSpec.blend(ColorSpec.parse("gray50"), red, 0.5).name);
  });

  it("parses back from its name, alone and in a style", () => {
    const mixed = ColorSpec.blend(ColorSpec.blend(blue, ColorSpec.parse("rgb(1,2,3)"), 0.25), red, 1e-7);
    expect(ColorSpec.parse(mixed.name).name).toBe(mixed.name);
    expect(ColorSpec.parse(mixed.name).getTruecolor(ATOM_ONE_DARK)).toEqual(mixed.getTruecolor(ATOM_ONE_DARK));
    const style = new Style({ color: "white", bgcolor: ColorSpec.blend(blue, red, 0.1875) });
    expect(Style.parse(style.toString()).equals(style)).toBe(true);
  });

  it("parses the form as written: any colour at each end, spaces allowed", () => {
    expect(ColorSpec.parse("blend(Blue, rgb(1, 2, 3), .5)").name).toBe(ColorSpec.blend(blue, ColorSpec.fromRgb(1, 2, 3), 0.5).name);
    for (const bad of ["blend(blue,red)", "blend(blue,red,0.5,0.5)", "blend(blue,red,)", "blend(blue,red,half)", "blend(nope,red,0.5)"]) {
      expect(() => ColorSpec.parse(bad), bad).toThrow(ColorParseError);
    }
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

// [LAW:single-enforcer] One hex grammar behind three entry points: each admits
// only its own lengths, and everything else is a ColorParseError naming the
// input — never a colour read from a valid prefix, never ColorRgba's RangeError.
describe("hex parsers", () => {
  it("parseRgbaHex splits the alpha byte into the 0..1 channel", () => {
    expect(parseRgbaHex("3b82f680")).toEqual(new ColorRgba(59, 130, 246, 128 / 255));
  });

  it("parseHexColor parses both literal forms and round-trips through .hex", () => {
    expect(parseHexColor("#123456").hex).toBe("#123456");
    expect(parseHexColor("#12345680").hex).toBe("#12345680");
    expect(parseHexColor("#00000000").alpha).toBe(0);
  });

  const rejected: Array<[string, (hex: string) => ColorRgba, string[]]> = [
    ["parseRgbHex", parseRgbHex, ["1g0000", "zz0000", "ff000", "ff00000", "#ff0000", "ff0000ff", ""]],
    ["parseRgbaHex", parseRgbaHex, ["ff0000zz", "ff0000", "#ff0000ff", " ff0000ff", ""]],
    ["parseHexColor", parseHexColor, ["#1g0000", "ff0000", "#ff00", "#abc", "primary", " #ff0000", "#ff0000 ", ""]],
  ];
  it.each(rejected)("%s throws ColorParseError naming each malformed input", (_, parse, inputs) => {
    for (const input of inputs) {
      expect(() => parse(input)).toThrow(ColorParseError);
      expect(() => parse(input)).toThrow(JSON.stringify(input));
    }
  });

  it("ColorSpec.parse reports a malformed #-literal as malformed hex", () => {
    expect(() => ColorSpec.parse("#1g0000")).toThrow(/Invalid hex colour "#1g0000"/);
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
    const pal = STANDARD_TABLE;
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

  it("refuses ansiColors that are not the sixteen ANSI colours", () => {
    const palette = new Palette("probe", true, new Map());
    const black = new ColorRgba(0, 0, 0);
    const theme = (table: ColorTable) => () => new TerminalTheme(black, black, table, palette);
    expect(theme(new ColorTable([black, black]))).toThrow(RangeError);
    expect(theme(EIGHT_BIT_TABLE)).toThrow(RangeError);
    expect(theme(new ColorTable(Array.from({ length: 16 }, () => black), 16))).toThrow(RangeError);
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
