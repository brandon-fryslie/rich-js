import { describe, it, expect } from "vitest";
import {
  Style,
  StyleStack,
  Theme,
  StyleSyntaxError,
  NULL_STYLE,
  DEFAULT_STYLES,
} from "../../src/core/style.js";
import { ColorSpec, ColorDepth } from "../../src/core/color.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts (parse semantics, merge rules, render output), not implementation details (caches, internal fields)

// --- Style construction ---

describe("Style construction", () => {
  it("constructs a null style with no options", () => {
    const s = new Style();
    expect(s.color).toBeUndefined();
    expect(s.bgcolor).toBeUndefined();
    expect(s.bold).toBeUndefined();
    expect(s.dim).toBeUndefined();
    expect(s.italic).toBeUndefined();
    expect(s.underline).toBeUndefined();
    expect(s.link).toBeUndefined();
    expect(s.meta).toBeUndefined();
  });

  it("constructs with a color string", () => {
    const s = new Style({ color: "red" });
    expect(s.color).toBeDefined();
    expect(s.color!.name).toBe("red");
  });

  it("constructs with a ColorSpec instance", () => {
    const c = ColorSpec.parse("blue");
    const s = new Style({ color: c });
    expect(s.color).toBe(c);
  });

  it("constructs with a bgcolor string", () => {
    const s = new Style({ bgcolor: "green" });
    expect(s.bgcolor).toBeDefined();
    expect(s.bgcolor!.name).toBe("green");
  });

  it("constructs with attributes", () => {
    const s = new Style({ bold: true, italic: true, underline: false });
    expect(s.bold).toBe(true);
    expect(s.italic).toBe(true);
    expect(s.underline).toBe(false);
    expect(s.dim).toBeUndefined();
  });

  it("constructs with a link", () => {
    const s = new Style({ link: "https://example.com" });
    expect(s.link).toBe("https://example.com");
  });

  it("constructs with meta", () => {
    const s = new Style({ meta: { key: "value" } });
    expect(s.meta).toEqual({ key: "value" });
  });
});

// --- isNull ---

describe("isNull", () => {
  it("returns true for a default-constructed style", () => {
    expect(new Style().isNull).toBe(true);
  });

  it("returns true for Style.null()", () => {
    expect(Style.null().isNull).toBe(true);
  });

  it("returns false when color is set", () => {
    expect(new Style({ color: "red" }).isNull).toBe(false);
  });

  it("returns false when bgcolor is set", () => {
    expect(new Style({ bgcolor: "blue" }).isNull).toBe(false);
  });

  it("returns false when an attribute is set to true", () => {
    expect(new Style({ bold: true }).isNull).toBe(false);
  });

  it("returns false when an attribute is set to false", () => {
    expect(new Style({ bold: false }).isNull).toBe(false);
  });

  it("returns false when link is set", () => {
    expect(new Style({ link: "https://example.com" }).isNull).toBe(false);
  });

  it("returns false when meta is set", () => {
    expect(new Style({ meta: { key: 1 } }).isNull).toBe(false);
  });
});

// --- Style.parse ---

describe("Style.parse", () => {
  it('parses "none" as a null style', () => {
    const s = Style.parse("none");
    expect(s.isNull).toBe(true);
  });

  it('parses "" as a null style', () => {
    const s = Style.parse("");
    expect(s.isNull).toBe(true);
  });

  it('parses a single color name like "red"', () => {
    const s = Style.parse("red");
    expect(s.color).toBeDefined();
    expect(s.color!.name).toBe("red");
    expect(s.bgcolor).toBeUndefined();
    expect(s.bold).toBeUndefined();
  });

  it('parses "red on blue" with foreground and background', () => {
    const s = Style.parse("red on blue");
    expect(s.color!.name).toBe("red");
    expect(s.bgcolor!.name).toBe("blue");
  });

  it('parses "bold" as a single attribute', () => {
    const s = Style.parse("bold");
    expect(s.bold).toBe(true);
  });

  it('parses "not bold" as a negated attribute', () => {
    const s = Style.parse("not bold");
    expect(s.bold).toBe(false);
  });

  it('parses a complex definition "bold italic red on blue"', () => {
    const s = Style.parse("bold italic red on blue");
    expect(s.bold).toBe(true);
    expect(s.italic).toBe(true);
    expect(s.color!.name).toBe("red");
    expect(s.bgcolor!.name).toBe("blue");
  });

  it('parses "bold link https://example.com"', () => {
    const s = Style.parse("bold link https://example.com");
    expect(s.bold).toBe(true);
    expect(s.link).toBe("https://example.com");
  });

  it('parses hex colors "#ff0000 on #00ff00"', () => {
    const s = Style.parse("#ff0000 on #00ff00");
    expect(s.color).toBeDefined();
    expect(s.bgcolor).toBeDefined();
  });

  describe("short aliases", () => {
    it('parses "b" as bold', () => {
      expect(Style.parse("b").bold).toBe(true);
    });

    it('parses "i" as italic', () => {
      expect(Style.parse("i").italic).toBe(true);
    });

    it('parses "u" as underline', () => {
      expect(Style.parse("u").underline).toBe(true);
    });

    it('parses "s" as strike', () => {
      expect(Style.parse("s").strike).toBe(true);
    });

    it('parses "d" as dim', () => {
      expect(Style.parse("d").dim).toBe(true);
    });

    it('parses "r" as reverse', () => {
      expect(Style.parse("r").reverse).toBe(true);
    });

    it('parses "o" as overline', () => {
      expect(Style.parse("o").overline).toBe(true);
    });

    it('parses "uu" as underline2', () => {
      expect(Style.parse("uu").underline2).toBe(true);
    });
  });

  it('parses "not b" using short alias for negation', () => {
    expect(Style.parse("not b").bold).toBe(false);
  });

  it("parses multiple attributes together", () => {
    const s = Style.parse("bold italic underline strike");
    expect(s.bold).toBe(true);
    expect(s.italic).toBe(true);
    expect(s.underline).toBe(true);
    expect(s.strike).toBe(true);
  });

  it("normalizes extra whitespace", () => {
    const s = Style.parse("  bold   red   on   blue  ");
    expect(s.bold).toBe(true);
    expect(s.color!.name).toBe("red");
    expect(s.bgcolor!.name).toBe("blue");
  });

  it('parses "color(N)" syntax for color by number', () => {
    const s = Style.parse("color(5)");
    expect(s.color).toBeDefined();
  });

  it('parses "rgb(r,g,b)" syntax for decimal RGB', () => {
    const s = Style.parse("rgb(255,0,0)");
    expect(s.color).toBeDefined();
  });

  it('parses "default on default" as terminal defaults', () => {
    const s = Style.parse("default on default");
    expect(s.color).toBeDefined();
    expect(s.color!.isDefault).toBe(true);
    expect(s.bgcolor).toBeDefined();
    expect(s.bgcolor!.isDefault).toBe(true);
  });
});

// --- Parse errors ---

describe("Style.parse errors", () => {
  it('throws on "not foobar" (invalid attribute)', () => {
    expect(() => Style.parse("not foobar")).toThrow(StyleSyntaxError);
  });

  it('throws on "on" alone (missing background color)', () => {
    expect(() => Style.parse("on")).toThrow(StyleSyntaxError);
  });

  it("throws on an invalid color string", () => {
    expect(() => Style.parse("not_a_color")).toThrow(StyleSyntaxError);
  });

  it('throws on "not" at end of string', () => {
    expect(() => Style.parse("not")).toThrow(StyleSyntaxError);
  });
});

// --- toString ---

describe("Style.toString", () => {
  it('returns "none" for a null style', () => {
    expect(new Style().toString()).toBe("none");
  });

  it("round-trips a single color through parse", () => {
    const s = Style.parse("red");
    const reparsed = Style.parse(s.toString());
    expect(reparsed.color!.name).toBe("red");
  });

  it("round-trips bold attribute through parse", () => {
    const s = Style.parse("bold");
    expect(Style.parse(s.toString()).bold).toBe(true);
  });

  it("round-trips a complex style through parse", () => {
    const s = Style.parse("bold italic red on blue");
    const reparsed = Style.parse(s.toString());
    expect(reparsed.bold).toBe(true);
    expect(reparsed.italic).toBe(true);
    expect(reparsed.color!.name).toBe("red");
    expect(reparsed.bgcolor!.name).toBe("blue");
  });

  it("round-trips negated attributes through parse", () => {
    const s = Style.parse("not bold not italic");
    const reparsed = Style.parse(s.toString());
    expect(reparsed.bold).toBe(false);
    expect(reparsed.italic).toBe(false);
  });

  it("round-trips a link through parse", () => {
    const s = Style.parse("bold link https://example.com");
    const str = s.toString();
    expect(str).toContain("link https://example.com");
    expect(str).toContain("bold");
  });
});

// --- .add ---

describe("Style.add", () => {
  it("returns self when other is null style", () => {
    const s = new Style({ bold: true });
    const result = s.add(NULL_STYLE);
    expect(result).toBe(s);
  });

  it("returns self when other is undefined", () => {
    const s = new Style({ bold: true });
    const result = s.add(undefined);
    expect(result).toBe(s);
  });

  it("returns other when self is null style", () => {
    const other = new Style({ color: "red" });
    const result = NULL_STYLE.add(other);
    expect(result).toBe(other);
  });

  it("other wins on conflicting attributes", () => {
    const base = new Style({ bold: true, italic: true });
    const override = new Style({ bold: false });
    const result = base.add(override);
    expect(result.bold).toBe(false);
    expect(result.italic).toBe(true);
  });

  it("other wins on conflicting colors", () => {
    const base = new Style({ color: "red" });
    const override = new Style({ color: "blue" });
    const result = base.add(override);
    expect(result.color!.name).toBe("blue");
  });

  it("preserves self attributes when other does not set them", () => {
    const base = new Style({ bold: true, color: "red" });
    const overlay = new Style({ italic: true });
    const result = base.add(overlay);
    expect(result.bold).toBe(true);
    expect(result.italic).toBe(true);
    expect(result.color!.name).toBe("red");
  });

  it("merges meta dictionaries", () => {
    const base = new Style({ meta: { a: 1 } });
    const overlay = new Style({ meta: { b: 2 } });
    const result = base.add(overlay);
    expect(result.meta).toEqual({ a: 1, b: 2 });
  });

  it("other meta wins on conflicting keys", () => {
    const base = new Style({ meta: { key: "old" } });
    const overlay = new Style({ meta: { key: "new" } });
    const result = base.add(overlay);
    expect(result.meta).toEqual({ key: "new" });
  });

  it("preserves link from other when set", () => {
    const base = new Style({ link: "https://a.com" });
    const overlay = new Style({ link: "https://b.com" });
    const result = base.add(overlay);
    expect(result.link).toBe("https://b.com");
  });

  it("preserves self's color when other has no color", () => {
    const base = new Style({ color: "red" });
    const overlay = new Style({ bold: true });
    const result = base.add(overlay);
    expect(result.color!.name).toBe("red");
  });
});

// --- Style.combine and Style.chain ---

describe("Style.combine", () => {
  it("returns null style for empty array", () => {
    expect(Style.combine([]).isNull).toBe(true);
  });

  it("combines multiple styles in order", () => {
    const result = Style.combine([
      new Style({ bold: true }),
      new Style({ color: "red" }),
      new Style({ italic: true }),
    ]);
    expect(result.bold).toBe(true);
    expect(result.color!.name).toBe("red");
    expect(result.italic).toBe(true);
  });

  it("later styles override earlier ones", () => {
    const result = Style.combine([
      new Style({ color: "red" }),
      new Style({ color: "blue" }),
    ]);
    expect(result.color!.name).toBe("blue");
  });

  it("skips undefined entries", () => {
    const result = Style.combine([
      undefined,
      new Style({ bold: true }),
      undefined,
    ]);
    expect(result.bold).toBe(true);
  });
});

describe("Style.chain", () => {
  it("chains styles same as combine", () => {
    const a = new Style({ bold: true });
    const b = new Style({ color: "red" });
    const combined = Style.combine([a, b]);
    const chained = Style.chain(a, b);
    expect(combined.equals(chained)).toBe(true);
  });
});

// --- .equals ---

describe("Style.equals", () => {
  it("same style is equal to itself", () => {
    const s = new Style({ bold: true, color: "red" });
    expect(s.equals(s)).toBe(true);
  });

  it("two styles with identical options are equal", () => {
    const a = new Style({ bold: true, color: "red" });
    const b = new Style({ bold: true, color: "red" });
    expect(a.equals(b)).toBe(true);
  });

  it("null styles are equal", () => {
    expect(new Style().equals(new Style())).toBe(true);
  });

  it("different attributes are not equal", () => {
    const a = new Style({ bold: true });
    const b = new Style({ italic: true });
    expect(a.equals(b)).toBe(false);
  });

  it("different colors are not equal", () => {
    const a = new Style({ color: "red" });
    const b = new Style({ color: "blue" });
    expect(a.equals(b)).toBe(false);
  });

  it("different links are not equal", () => {
    const a = new Style({ link: "https://a.com" });
    const b = new Style({ link: "https://b.com" });
    expect(a.equals(b)).toBe(false);
  });

  it("null vs non-null are not equal", () => {
    expect(new Style().equals(new Style({ bold: true }))).toBe(false);
  });
});

// --- .render ---

describe("Style.render", () => {
  it("returns empty string for empty text", () => {
    const s = new Style({ bold: true });
    expect(s.render("")).toBe("");
  });

  it("null style returns plain text unchanged", () => {
    expect(NULL_STYLE.render("hello")).toBe("hello");
  });

  it("bold text contains ANSI escape sequence", () => {
    const s = new Style({ bold: true });
    const result = s.render("hello");
    expect(result).toContain("\x1b[");
    expect(result).toContain("m");
    expect(result).toContain("hello");
    expect(result).toContain("\x1b[0m");
  });

  it("renders with SGR code 1 for bold", () => {
    const s = new Style({ bold: true });
    const result = s.render("test");
    expect(result).toContain("\x1b[1m");
  });

  it("renders with SGR code 3 for italic", () => {
    const s = new Style({ italic: true });
    const result = s.render("test");
    expect(result).toContain("\x1b[3m");
  });

  it("renders with multiple SGR codes for combined attributes", () => {
    const s = new Style({ bold: true, italic: true });
    const result = s.render("test");
    // Should contain both codes separated by ;
    expect(result).toMatch(/\x1b\[\d+(;\d+)*m/);
    expect(result).toContain("test");
  });

  it("includes color escape codes", () => {
    const s = new Style({ color: "red" });
    const result = s.render("test");
    expect(result).toContain("\x1b[");
    expect(result).toContain("test");
    expect(result).toContain("\x1b[0m");
  });

  it("includes OSC 8 for links", () => {
    const s = new Style({ link: "https://example.com" });
    const result = s.render("click");
    expect(result).toContain("\x1b]8;");
    expect(result).toContain("https://example.com");
    expect(result).toContain("\x1b\\");
    expect(result).toContain("click");
  });

  it("renders negated attribute (bold false) with the off SGR code", () => {
    const s = new Style({ bold: false });
    const result = s.render("test");
    expect(result).toContain("\x1b[22m");
  });
});

// --- Property accessors ---

describe("transparentBackground", () => {
  it("returns true when no background is set", () => {
    expect(new Style().transparentBackground).toBe(true);
  });

  it("returns true when bgcolor is the default color", () => {
    const s = new Style({ bgcolor: ColorSpec.default() });
    expect(s.transparentBackground).toBe(true);
  });

  it("returns false when bgcolor is a named color", () => {
    const s = new Style({ bgcolor: "red" });
    expect(s.transparentBackground).toBe(false);
  });
});

describe("backgroundStyle", () => {
  it("returns a style with only the background color", () => {
    const s = new Style({ bold: true, color: "red", bgcolor: "blue" });
    const bg = s.backgroundStyle;
    expect(bg.bgcolor!.name).toBe("blue");
    expect(bg.color).toBeUndefined();
    expect(bg.bold).toBeUndefined();
  });

  it("returns null-ish style when no background set", () => {
    const s = new Style({ bold: true });
    const bg = s.backgroundStyle;
    expect(bg.bgcolor).toBeUndefined();
    expect(bg.bold).toBeUndefined();
  });
});

describe("withoutColor", () => {
  it("removes color and bgcolor but keeps attributes", () => {
    const s = new Style({
      color: "red",
      bgcolor: "blue",
      bold: true,
      italic: true,
    });
    const noColor = s.withoutColor;
    expect(noColor.color).toBeUndefined();
    expect(noColor.bgcolor).toBeUndefined();
    expect(noColor.bold).toBe(true);
    expect(noColor.italic).toBe(true);
  });

  it("preserves link and meta", () => {
    const s = new Style({
      color: "red",
      link: "https://example.com",
      meta: { key: 1 },
    });
    const noColor = s.withoutColor;
    expect(noColor.link).toBe("https://example.com");
    expect(noColor.meta).toEqual({ key: 1 });
  });
});

describe("clearMetaAndLinks", () => {
  it("removes link and meta but keeps colors and attributes", () => {
    const s = new Style({
      color: "red",
      bgcolor: "blue",
      bold: true,
      link: "https://example.com",
      meta: { key: 1 },
    });
    const cleared = s.clearMetaAndLinks();
    expect(cleared.color!.name).toBe("red");
    expect(cleared.bgcolor!.name).toBe("blue");
    expect(cleared.bold).toBe(true);
    expect(cleared.link).toBeUndefined();
    expect(cleared.meta).toBeUndefined();
  });
});

// --- getHtmlStyle ---

describe("getHtmlStyle", () => {
  it("returns empty string for null style", () => {
    expect(new Style().getHtmlStyle()).toBe("");
  });

  it("bold produces font-weight: bold", () => {
    const s = new Style({ bold: true });
    expect(s.getHtmlStyle()).toContain("font-weight: bold");
  });

  it("italic produces font-style: italic", () => {
    const s = new Style({ italic: true });
    expect(s.getHtmlStyle()).toContain("font-style: italic");
  });

  it("underline produces text-decoration containing underline", () => {
    const s = new Style({ underline: true });
    expect(s.getHtmlStyle()).toContain("text-decoration");
    expect(s.getHtmlStyle()).toContain("underline");
  });

  it("strike produces text-decoration containing line-through", () => {
    const s = new Style({ strike: true });
    expect(s.getHtmlStyle()).toContain("line-through");
  });

  it("overline produces text-decoration containing overline", () => {
    const s = new Style({ overline: true });
    expect(s.getHtmlStyle()).toContain("overline");
  });

  it("dim produces opacity: 0.5", () => {
    const s = new Style({ dim: true });
    expect(s.getHtmlStyle()).toContain("opacity: 0.5");
  });

  it("color produces a CSS color with hex value", () => {
    const s = new Style({ color: "red" });
    const html = s.getHtmlStyle();
    expect(html).toMatch(/color:\s*#[0-9a-f]{6}/);
  });

  it("bgcolor produces a CSS background-color with hex value", () => {
    const s = new Style({ bgcolor: "blue" });
    const html = s.getHtmlStyle();
    expect(html).toMatch(/background-color:\s*#[0-9a-f]{6}/);
  });

  it("combines multiple underline decorations", () => {
    const s = new Style({ underline: true, strike: true, overline: true });
    const html = s.getHtmlStyle();
    expect(html).toContain("underline");
    expect(html).toContain("line-through");
    expect(html).toContain("overline");
  });
});

// --- Static factory methods ---

describe("Style.null", () => {
  it("returns the shared null style", () => {
    const n = Style.null();
    expect(n.isNull).toBe(true);
    expect(n).toBe(NULL_STYLE);
  });
});

describe("Style.fromColor", () => {
  it("creates a style with just a foreground color", () => {
    const c = ColorSpec.parse("red");
    const s = Style.fromColor(c);
    expect(s.color!.name).toBe("red");
    expect(s.bgcolor).toBeUndefined();
  });

  it("creates a style with foreground and background colors", () => {
    const fg = ColorSpec.parse("red");
    const bg = ColorSpec.parse("blue");
    const s = Style.fromColor(fg, bg);
    expect(s.color!.name).toBe("red");
    expect(s.bgcolor!.name).toBe("blue");
  });

  it("creates a null-ish style when no colors given", () => {
    const s = Style.fromColor();
    expect(s.color).toBeUndefined();
    expect(s.bgcolor).toBeUndefined();
  });
});

describe("Style.fromMeta", () => {
  it("creates a style with only meta", () => {
    const s = Style.fromMeta({ handler: "click" });
    expect(s.meta).toEqual({ handler: "click" });
    expect(s.isNull).toBe(false);
    expect(s.bold).toBeUndefined();
    expect(s.color).toBeUndefined();
  });
});

describe("Style.pickFirst", () => {
  it("returns the first defined style", () => {
    const s = new Style({ bold: true });
    expect(Style.pickFirst(undefined, s)).toBe(s);
  });

  it("returns the very first if all are defined", () => {
    const a = new Style({ bold: true });
    const b = new Style({ italic: true });
    expect(Style.pickFirst(a, b)).toBe(a);
  });

  it("throws if all arguments are undefined", () => {
    expect(() => Style.pickFirst(undefined, undefined)).toThrow(
      "All arguments are undefined",
    );
  });
});

// --- StyleStack ---

describe("StyleStack", () => {
  it("starts with the base style as current", () => {
    const base = new Style({ bold: true });
    const stack = new StyleStack(base);
    expect(stack.current.bold).toBe(true);
  });

  it("defaults to null style when no base given", () => {
    const stack = new StyleStack();
    expect(stack.current.isNull).toBe(true);
  });

  it("push merges the new style onto current", () => {
    const stack = new StyleStack(new Style({ bold: true }));
    stack.push(new Style({ italic: true }));
    expect(stack.current.bold).toBe(true);
    expect(stack.current.italic).toBe(true);
  });

  it("pop restores the previous style", () => {
    const stack = new StyleStack(new Style({ bold: true }));
    stack.push(new Style({ italic: true }));
    expect(stack.current.italic).toBe(true);
    stack.pop();
    expect(stack.current.italic).toBeUndefined();
    expect(stack.current.bold).toBe(true);
  });

  it("pop reverts to the previous combined state", () => {
    const stack = new StyleStack();
    stack.push(new Style({ bold: true }));
    stack.pop();
    expect(stack.current.isNull).toBe(true);
  });

  it("supports multiple push/pop cycles", () => {
    const stack = new StyleStack();
    stack.push(new Style({ bold: true }));
    stack.push(new Style({ italic: true }));
    stack.push(new Style({ color: "red" }));
    expect(stack.current.bold).toBe(true);
    expect(stack.current.italic).toBe(true);
    expect(stack.current.color!.name).toBe("red");
    stack.pop();
    expect(stack.current.color).toBeUndefined();
    stack.pop();
    expect(stack.current.italic).toBeUndefined();
    stack.pop();
    expect(stack.current.isNull).toBe(true);
  });
});

// --- Theme ---

describe("Theme", () => {
  it("constructs with defaults inherited", () => {
    const theme = new Theme();
    expect(theme.has("bold")).toBe(true);
    expect(theme.has("italic")).toBe(true);
  });

  it("looks up a default style", () => {
    const theme = new Theme();
    const bold = theme.get("bold");
    expect(bold).toBeDefined();
    expect(bold!.bold).toBe(true);
  });

  it("accepts custom style definitions", () => {
    const theme = new Theme({ "custom.style": "bold red" });
    const s = theme.get("custom.style");
    expect(s).toBeDefined();
    expect(s!.bold).toBe(true);
    expect(s!.color!.name).toBe("red");
  });

  it("custom definitions override defaults", () => {
    const theme = new Theme({ bold: "italic" });
    const s = theme.get("bold");
    expect(s!.italic).toBe(true);
    expect(s!.bold).toBeUndefined();
  });

  it("does not inherit defaults when inherit is false", () => {
    const theme = new Theme({ "my.style": "bold" }, { inherit: false });
    expect(theme.has("bold")).toBe(false);
    expect(theme.has("my.style")).toBe(true);
  });

  it("throws on invalid style name with uppercase", () => {
    expect(() => new Theme({ InvalidName: "bold" })).toThrow(
      "Invalid style name",
    );
  });

  it("throws on invalid style name starting with digit", () => {
    expect(() => new Theme({ "1invalid": "bold" })).toThrow(
      "Invalid style name",
    );
  });

  it("throws on invalid style name with special characters", () => {
    expect(() => new Theme({ "foo bar": "bold" })).toThrow(
      "Invalid style name",
    );
  });

  it("allows names with dots, dashes, and underscores", () => {
    const theme = new Theme({
      "my.style": "bold",
      "my-style": "italic",
      my_style: "underline",
    });
    expect(theme.has("my.style")).toBe(true);
    expect(theme.has("my-style")).toBe(true);
    expect(theme.has("my_style")).toBe(true);
  });

  it("returns undefined for unknown style names", () => {
    const theme = new Theme();
    expect(theme.get("nonexistent.style")).toBeUndefined();
  });
});

// --- DEFAULT_STYLES ---

describe("DEFAULT_STYLES", () => {
  it("contains 'none' key", () => {
    expect(DEFAULT_STYLES["none"]).toBeDefined();
    expect(DEFAULT_STYLES["none"]!.isNull).toBe(true);
  });

  it("contains 'bold' key", () => {
    expect(DEFAULT_STYLES["bold"]).toBeDefined();
    expect(DEFAULT_STYLES["bold"]!.bold).toBe(true);
  });

  it("contains 'reset' key", () => {
    expect(DEFAULT_STYLES["reset"]).toBeDefined();
  });

  it("contains table styles", () => {
    expect(DEFAULT_STYLES["table.header"]).toBeDefined();
    expect(DEFAULT_STYLES["table.footer"]).toBeDefined();
    expect(DEFAULT_STYLES["table.cell"]).toBeDefined();
  });

  it("contains repr styles", () => {
    expect(DEFAULT_STYLES["repr.str"]).toBeDefined();
    expect(DEFAULT_STYLES["repr.number"]).toBeDefined();
    expect(DEFAULT_STYLES["repr.bool"]).toBeDefined();
  });

  it("contains log styles", () => {
    expect(DEFAULT_STYLES["log.time"]).toBeDefined();
    expect(DEFAULT_STYLES["log.message"]).toBeDefined();
  });

  it("contains progress styles", () => {
    expect(DEFAULT_STYLES["progress.description"]).toBeDefined();
    expect(DEFAULT_STYLES["progress.percentage"]).toBeDefined();
  });

  it("contains markdown styles", () => {
    expect(DEFAULT_STYLES["markdown.h1"]).toBeDefined();
    expect(DEFAULT_STYLES["markdown.code"]).toBeDefined();
  });

  it("contains json styles", () => {
    expect(DEFAULT_STYLES["json.key"]).toBeDefined();
    expect(DEFAULT_STYLES["json.str"]).toBeDefined();
  });

  it("contains all base attribute styles", () => {
    const attrNames = [
      "bold",
      "dim",
      "italic",
      "underline",
      "blink",
      "blink2",
      "reverse",
      "conceal",
      "strike",
      "underline2",
      "frame",
      "encircle",
      "overline",
    ];
    for (const name of attrNames) {
      expect(DEFAULT_STYLES[name]).toBeDefined();
    }
  });
});

// --- Style.normalize ---

// --- Additional coverage ---

describe("Style.parse caching", () => {
  it("returns the same cached instance for identical definitions", () => {
    const a = Style.parse("red");
    const b = Style.parse("red");
    expect(a).toBe(b);
  });

  it('parse("none") returns NULL_STYLE by identity', () => {
    expect(Style.parse("none")).toBe(NULL_STYLE);
  });
});

describe("Style.parse errors (additional)", () => {
  it('throws StyleSyntaxError on "on not_a_color"', () => {
    expect(() => Style.parse("on not_a_color")).toThrow(StyleSyntaxError);
  });
});

describe("Style.toString (additional)", () => {
  it('bgcolor-only style produces "on blue"', () => {
    const s = new Style({ bgcolor: "blue" });
    expect(s.toString()).toBe("on blue");
  });

  it('color + bgcolor produces "red on blue"', () => {
    const s = new Style({ color: "red", bgcolor: "blue" });
    const str = s.toString();
    expect(str).toContain("red");
    expect(str).toContain("on blue");
  });

  it('attributes produce canonical form like "bold italic"', () => {
    const s = new Style({ bold: true, italic: true });
    const str = s.toString();
    expect(str).toContain("bold");
    expect(str).toContain("italic");
  });
});

describe("Style.add (additional)", () => {
  it("preserves self's link when other has no link", () => {
    const base = new Style({ link: "http://x.com" });
    const overlay = new Style({ bold: true });
    const result = base.add(overlay);
    expect(result.link).toBe("http://x.com");
    expect(result.bold).toBe(true);
  });
});

describe("Style.equals (additional)", () => {
  it("ignores meta when comparing equality", () => {
    const a = new Style({ bold: true, color: "red", meta: { a: 1 } });
    const b = new Style({ bold: true, color: "red", meta: { b: 2 } });
    expect(a.equals(b)).toBe(true);
  });
});

describe("DEFAULT_STYLES (additional)", () => {
  it('"reset" has all attributes false and color = default', () => {
    const reset = DEFAULT_STYLES["reset"]!;
    expect(reset.bold).toBe(false);
    expect(reset.dim).toBe(false);
    expect(reset.italic).toBe(false);
    expect(reset.underline).toBe(false);
    expect(reset.blink).toBe(false);
    expect(reset.blink2).toBe(false);
    expect(reset.reverse).toBe(false);
    expect(reset.conceal).toBe(false);
    expect(reset.strike).toBe(false);
    expect(reset.underline2).toBe(false);
    expect(reset.frame).toBe(false);
    expect(reset.encircle).toBe(false);
    expect(reset.overline).toBe(false);
    expect(reset.color).toBeDefined();
    expect(reset.color!.isDefault).toBe(true);
  });

  it('"table.header" has bold = true', () => {
    expect(DEFAULT_STYLES["table.header"]!.bold).toBe(true);
  });

  it('"table.cell" is null style', () => {
    expect(DEFAULT_STYLES["table.cell"]!.isNull).toBe(true);
  });
});

describe("Style.render with colorSystem", () => {
  it("renders with ANSI codes when colorSystem is STANDARD", () => {
    const s = Style.parse("red");
    const result = s.render("x", ColorDepth.STANDARD);
    expect(result).toContain("\x1b[");
    expect(result).toContain("m");
    expect(result).toContain("x");
  });
});

describe("Style.normalize", () => {
  it("trims leading and trailing whitespace", () => {
    expect(Style.normalize("  bold  ")).toBe("bold");
  });

  it("collapses internal whitespace", () => {
    expect(Style.normalize("bold   italic")).toBe("bold italic");
  });
});
