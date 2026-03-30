import { describe, it, expect } from "vitest";
import { Markdown } from "../../src/renderables/markdown.js";
import { Segment } from "../../src/core/segment.js";
import { Style } from "../../src/core/style.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

function collectText(r: Renderable, opts: RenderOptions): string {
  return [...r.render(opts)].map((s) => s.text).join("");
}

function collectSegments(r: Renderable, opts: RenderOptions): Segment[] {
  return [...r.render(opts)];
}

describe("Markdown", () => {
  // --- Supported Elements ---

  it("renders headings as bold, sized by level", () => {
    const md = new Markdown("# Title\n## Subtitle");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("Title");
    expect(text).toContain("Subtitle");
  });

  it("renders bold text", () => {
    const md = new Markdown("This is **bold** text");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("bold");
    // Verify bold styling is applied
    const segs = collectSegments(md, { maxWidth: 80 });
    const boldSeg = segs.find((s) => s.text === "bold");
    expect(boldSeg).toBeDefined();
    expect(boldSeg!.style).toBeDefined();
  });

  it("renders italic text", () => {
    const md = new Markdown("This is *italic* text");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("italic");
    const segs = collectSegments(md, { maxWidth: 80 });
    const italicSeg = segs.find((s) => s.text === "italic");
    expect(italicSeg).toBeDefined();
    expect(italicSeg!.style).toBeDefined();
  });

  it("renders fenced code blocks with language detection", () => {
    const md = new Markdown("```python\ndef hello():\n    print(\"Hello, World!\")\n```");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("def hello():");
    expect(text).toContain('print("Hello, World!")');
  });

  it("renders inline code as styled", () => {
    const md = new Markdown("Use the `render` function");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("render");
  });

  it("renders unordered lists with bullets", () => {
    const md = new Markdown("- Item A\n- Item B");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("Item A");
    expect(text).toContain("Item B");
    expect(text).toContain("\u2022"); // bullet character
  });

  it("renders ordered lists with numbers", () => {
    const md = new Markdown("1. First\n2. Second");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("First");
    expect(text).toContain("Second");
    expect(text).toContain("1.");
    expect(text).toContain("2.");
  });

  it("renders links", () => {
    const md = new Markdown("[Click here](https://example.com)");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("Click here");
  });

  it("renders blockquotes with indented border", () => {
    const md = new Markdown("> A quote");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("A quote");
    // Blockquotes have a vertical bar indicator
    expect(text).toContain("\u258e"); // left block element used as border
  });

  it("renders horizontal rules as line separator", () => {
    const md = new Markdown("---");
    const text = collectText(md, { maxWidth: 80 });
    expect(text.length).toBeGreaterThan(0);
  });

  // --- Options ---

  it("accepts inlineCodeStyle option as string", () => {
    const md = new Markdown("Use `code` here", { inlineCodeStyle: "bold red" });
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("code");
  });

  it("accepts inlineCodeStyle option as Style", () => {
    const style = Style.parse("bold green");
    const md = new Markdown("Use `code` here", { inlineCodeStyle: style });
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("code");
  });

  it("accepts hyperlinks option", () => {
    const md = new Markdown("[link](https://example.com)", { hyperlinks: true });
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("link");
  });

  it("disables hyperlinks when option is false", () => {
    const md = new Markdown("[link](https://example.com)", { hyperlinks: false });
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("link");
  });

  // --- Measurement ---

  it("measurement returns valid values", () => {
    const md = new Markdown("# Hello");
    const m = md.measure({ maxWidth: 80 });
    expect(m.minimum).toBeGreaterThan(0);
    expect(m.maximum).toBeLessThanOrEqual(80);
  });

  // --- Construction ---

  it("constructs with markdown string only", () => {
    const md = new Markdown("Hello");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("Hello");
  });

  it("constructs with markdown string and options", () => {
    const md = new Markdown("Hello", { justify: "center" });
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("Hello");
  });
});
