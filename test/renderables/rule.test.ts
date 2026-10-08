import { describe, it, expect } from "vitest";
import { Rule } from "../../src/renderables/rule.js";
import { Segment } from "../../src/core/segment.js";
import { renderToString } from "../../src/core/render.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";
import { Console, type ConsoleOptions } from "../../src/core/console.js";
import { RichText } from "../../src/core/text.js";
import { Theme } from "../../src/core/style.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

/** The bytes `draw` writes through a 12-column truecolor console. */
function printed(draw: (console: Console) => void, options: ConsoleOptions): string {
  const chunks: string[] = [];
  const file = { write: (data: string) => void chunks.push(data) };
  draw(new Console({ file, width: 12, colorSystem: "truecolor", ...options }));
  return chunks.join("");
}

function collectLines(renderable: Renderable, options: RenderOptions): string[] {
  const segments = [...renderable.render(options)];
  const lines = Segment.splitLines(segments);
  return lines.map((line) => line.map((s) => s.text).join(""));
}

describe("Rule", () => {
  it("renders a line of repeated characters filling maxWidth (no title)", () => {
    const rule = new Rule();
    const lines = collectLines(rule, { maxWidth: 10 });
    expect(lines[0]).toBe("──────────");
    expect(lines[0]!.length).toBe(10);
  });

  // rich-text-b44 review: the title was cut at its `cellLength`, which counts a
  // tab as no cells.
  it("keeps a title's text past a tab", () => {
    expect(collectLines(new Rule("a\tbcd"), { maxWidth: 30 })[0]).toContain("bcd");
  });

  // Rich's bytes for the same rules at width 20.
  it("reads a newline in its title as a space, and markup that styles nothing as a gap", () => {
    expect(collectLines(new Rule("a\nb"), { maxWidth: 20 })).toEqual(["─────── a b ────────"]);
    expect(collectLines(new Rule("[b][/b]"), { maxWidth: 20 })).toEqual(["─────────  ─────────"]);
  });

  // Rich 9d8f9a3's bytes. A title wider than its room is cut with an ellipsis
  // and keeps a rule cell either side; an aligned title has no space on its
  // closed side; at a width with no room past the rule cells and gaps
  // (4 centred, 2 aligned) the rule is bare.
  it.each([
    ["center", 20, "Title", "────── Title ───────"],
    ["center", 10, "aaa bbb ccc ddd eee", "─ aaa b… ─"],
    ["center", 6, "Title", "─ T… ─"],
    ["center", 6, "a", "─ a ──"],
    ["center", 5, "Title", "─ … ─"],
    ["center", 4, "Title", "────"],
    ["center", 1, "Title", "─"],
    ["left", 20, "Title", "Title ──────────────"],
    ["left", 10, "aaa bbb ccc ddd eee", "aaa bbb… ─"],
    ["left", 3, "Title", "… ─"],
    ["left", 3, "a", "a ─"],
    ["left", 2, "Title", "──"],
    ["right", 20, "Title", "────────────── Title"],
    ["right", 10, "aaa bbb ccc ddd eee", "─ aaa bbb…"],
    ["right", 4, "Title", "─ T…"],
    ["right", 2, "Title", "──"],
  ] as const)("%s at width %i draws %j as Rich does", (align, width, title, expected) => {
    expect(collectLines(new Rule(title, { align }), { maxWidth: width })).toEqual([expected]);
  });

  // Rich 9d8f9a3's bytes, `style="none"` so the line's own style is out of it:
  // a cut title's ellipsis, and the space a split wide character leaves, carry
  // the styling of the text they replace.
  it.each([
    ["center", 10, "[bold]Hello world[/bold]", "─ \x1b[1mHello…\x1b[0m ─"],
    ["left", 10, "[bold]Hello[/bold] world", "\x1b[1mHello\x1b[0m w… ─"],
    ["left", 6, "[bold]中中中中[/bold]", "\x1b[1m中 …\x1b[0m ─"],
  ] as const)("%s at width %i cuts %j inside its styling, as Rich does", (align, width, title, expected) => {
    const bytes = renderToString(new Rule(title, { align, style: "none" }), { width, colorSystem: "truecolor" });
    expect(bytes).toBe(`${expected}\n`);
  });

  // Rich 9d8f9a3's bytes at width 12: the line is drawn in `rule.line` unless a
  // style is given, and the title is never in the line's style, only its own.
  const G = "\x1b[92m";
  const R = "\x1b[31m";
  const Z = "\x1b[0m";
  const B = `\x1b[1mB${Z} t`;
  it.each([
    ["center", undefined, "T", `${G}──── ${Z}T${G} ─────${Z}`],
    ["center", undefined, "[bold]B[/bold] t", `${G}─── ${Z}${B}${G} ────${Z}`],
    ["center", "red", "T", `${R}──── ${Z}T${R} ─────${Z}`],
    ["center", "red", "[bold]B[/bold] t", `${R}─── ${Z}${B}${R} ────${Z}`],
    ["left", undefined, "T", `T ${G}──────────${Z}`],
    ["left", undefined, "[bold]B[/bold] t", `${B} ${G}────────${Z}`],
    ["left", "red", "T", `T ${R}──────────${Z}`],
    ["left", "red", "[bold]B[/bold] t", `${B} ${R}────────${Z}`],
    ["right", undefined, "T", `${G}──────────${Z} T`],
    ["right", undefined, "[bold]B[/bold] t", `${G}────────${Z} ${B}`],
    ["right", "red", "T", `${R}──────────${Z} T`],
    ["right", "red", "[bold]B[/bold] t", `${R}────────${Z} ${B}`],
  ] as const)("%s with style %s draws %j in colour as Rich does", (align, style, title, expected) => {
    const rule = new Rule(title, style === undefined ? { align } : { align, style });
    expect(renderToString(rule, { width: 12, colorSystem: "truecolor" })).toBe(`${expected}\n`);
  });

  it("draws a bare line in rule.line, or its own style, as Rich does", () => {
    expect(renderToString(new Rule(), { width: 5, colorSystem: "truecolor" })).toBe(`${G}─────${Z}\n`);
    expect(renderToString(new Rule(undefined, { style: "red" }), { width: 5, colorSystem: "truecolor" })).toBe(`${R}─────${Z}\n`);
  });

  // Rich 9d8f9a3's bytes at width 12. A string title reads in `rule.text` only
  // where nothing highlights it, since Rich's `render_str` highlights a fresh
  // `Text` and copies only the spans; a `Text` title never reads in it.
  const I = "\x1b[3m";
  it.each([
    [true, "T", `${G}──── ${Z}T${G} ─────${Z}`],
    [false, "T", `${G}──── ${Z}${I}T${Z}${G} ─────${Z}`],
    [true, new RichText("T"), `${G}──── ${Z}T${G} ─────${Z}`],
    [false, new RichText("T"), `${G}──── ${Z}T${G} ─────${Z}`],
  ] as const)("with highlight %s draws %j in the theme's rule.text as Rich does", (highlight, title, expected) => {
    const theme = new Theme({ "rule.text": "italic" });
    expect(printed((c) => c.print(new Rule(title)), { theme, highlight })).toBe(`${expected}\n`);
  });

  // Rich resolves both names with a null default, so a theme that inherits
  // neither draws them unstyled rather than failing.
  it.each([
    ["a titled rule", (c: Console) => c.print(new Rule("T")), "──── T ─────"],
    ["a bare rule", (c: Console) => c.print(new Rule()), "────────────"],
    ["a text title over a given style", (c: Console) => c.print(new Rule(new RichText("T"), { style: "red" })), `${R}──── ${Z}T${R} ─────${Z}`],
    ["console.rule", (c: Console) => c.rule("T"), "──── T ─────"],
  ] as const)("draws %s under a theme without rule.line or rule.text as Rich does", (_name, draw, expected) => {
    expect(printed(draw, { theme: new Theme({}, { inherit: false }) })).toBe(`${expected}\n`);
  });

  it("uses custom characters", () => {
    const rule = new Rule(undefined, { characters: "*" });
    const lines = collectLines(rule, { maxWidth: 5 });
    expect(lines[0]).toBe("*****");
  });

  it("throws for characters that take no cells", () => {
    expect(() => new Rule(undefined, { characters: "" })).toThrow();
    expect(() => new Rule(undefined, { characters: "\u0301" })).toThrow();
  });

  it("repeats a glyph of several code points whole, padding the cell it cannot fill", () => {
    for (const glyph of ["❤️", "👨‍👩‍👧", "🇺🇸"]) {
      expect(collectLines(new Rule(undefined, { characters: glyph }), { maxWidth: 5 })[0]).toBe(`${glyph}${glyph} `);
    }
    expect(collectLines(new Rule(undefined, { characters: "e\u0301" }), { maxWidth: 3 })[0]).toBe("e\u0301".repeat(3));
  });

  it("throws for invalid align value", () => {
    // Spec: Invalid align values (e.g., "top") throw an error
    expect(() => new Rule(undefined, { align: "top" as any })).toThrow();
  });

  it("uses ASCII characters when asciiOnly", () => {
    const rule = new Rule();
    const lines = collectLines(rule, { maxWidth: 5, asciiOnly: true });
    expect(lines[0]).toBe("-----");
  });

  it("keeps characters that are already ASCII when asciiOnly", () => {
    const rule = new Rule(undefined, { characters: "=" });
    const lines = collectLines(rule, { maxWidth: 5, asciiOnly: true });
    expect(lines[0]).toBe("=====");
  });

  it("measurement minimum > 0", () => {
    const rule = new Rule("Title");
    const m = rule.measure({ maxWidth: 40 });
    expect(m.minimum).toBeGreaterThan(0);
  });
});
