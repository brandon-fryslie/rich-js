import { describe, it, expect } from "vitest";
import { Rule } from "../../src/renderables/rule.js";
import { Segment } from "../../src/core/segment.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

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
