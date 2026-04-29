import { describe, it, expect } from "vitest";
import { renderToString } from "../../src/core/render.js";
import { ColorSystem } from "../../src/core/color.js";
import { RichText } from "../../src/core/text.js";
import { Style } from "../../src/core/style.js";
import { Strip, StripCell, PowerlineJoiner } from "../../src/core/strip.js";
import { Panel } from "../../src/renderables/panel.js";

// [LAW:behavior-not-structure] Tests assert observable bytes — ANSI codes,
// terminator newlines, color stripping — not internal walk shape.

describe("renderToString", () => {
  it("emits ANSI-encoded text for a styled RichText (standard color)", () => {
    const text = new RichText("hi", { style: Style.parse("red"), end: "" });
    const out = renderToString(text, { colorSystem: ColorSystem.STANDARD });
    expect(out).toContain("hi");
    expect(out).toMatch(/\x1b\[[0-9;]*31[0-9;]*m/); // SGR 31 = red
    expect(out).toMatch(/\x1b\[0m/); // reset
    expect(out.endsWith("\n")).toBe(true);
  });

  it("strips all color codes when colorSystem = null", () => {
    const text = new RichText("hi", { style: Style.parse("bold red on blue"), end: "" });
    const out = renderToString(text, { colorSystem: null });
    expect(out).toBe("hi\n");
  });

  it("strips all color codes when noColor = true", () => {
    const text = new RichText("hi", { style: Style.parse("bold red"), end: "" });
    const out = renderToString(text, { noColor: true });
    expect(out).toBe("hi\n");
  });

  it("does not append a newline when endWithNewline = false", () => {
    const text = new RichText("hi", { end: "" });
    const out = renderToString(text, { endWithNewline: false, colorSystem: null });
    expect(out).toBe("hi");
  });

  it("does not double a trailing newline that the renderable already produced", () => {
    const text = new RichText("hi"); // default end = "\n"
    const out = renderToString(text, { colorSystem: null });
    expect(out).toBe("hi\n");
  });

  it("is referentially transparent — same args produce byte-identical output", () => {
    const text = new RichText("alpha", { style: Style.parse("bold red on blue") });
    const a = renderToString(text);
    const b = renderToString(text);
    expect(a).toBe(b);
  });

  it("renders a Strip with PowerlineJoiner end-to-end as ANSI", () => {
    const strip = new Strip(
      [
        new StripCell(" main ", Style.parse("white on blue")),
        new StripCell(" foo ", Style.parse("white on cyan")),
      ],
      new PowerlineJoiner({ glyph: ">" }),
    );
    const out = renderToString(strip, { colorSystem: ColorSystem.TRUECOLOR });
    expect(out).toContain(" main ");
    expect(out).toContain(" foo ");
    expect(out).toContain(">");
    // Reset code present.
    expect(out).toMatch(/\x1b\[0m/);
  });

  it("respects the explicit width for wider renderables (Panel)", () => {
    const panel = new Panel(new RichText("body", { end: "" }));
    const narrow = renderToString(panel, { width: 20, colorSystem: null });
    const wide = renderToString(panel, { width: 60, colorSystem: null });
    const narrowWidth = narrow.split("\n")[0]!.length;
    const wideWidth = wide.split("\n")[0]!.length;
    expect(narrowWidth).toBe(20);
    expect(wideWidth).toBe(60);
  });

  it("defaults to truecolor when colorSystem is omitted", () => {
    const text = new RichText("x", { style: Style.parse("#ff0066"), end: "" });
    const out = renderToString(text);
    // Truecolor uses 38;2;r;g;b SGR.
    expect(out).toMatch(/\x1b\[38;2;255;0;102m/);
  });
});
