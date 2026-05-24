import { describe, it, expect } from "vitest";
import { renderToString, segmentsToString, segmentToString } from "../../src/core/render.js";
import { ColorDepth } from "../../src/core/color.js";
import { RichText } from "../../src/core/text.js";
import { Style } from "../../src/core/style.js";
import { Segment } from "../../src/core/segment.js";
import { Strip, StripCell, PowerlineJoiner, PlainJoiner } from "../../src/core/strip.js";
import { Panel } from "../../src/renderables/panel.js";

// [LAW:behavior-not-structure] Tests assert observable bytes — ANSI codes,
// terminator newlines, color stripping — not internal walk shape.

describe("renderToString", () => {
  it("emits ANSI-encoded text for a styled RichText (standard color)", () => {
    const text = new RichText("hi", { style: Style.parse("red"), end: "" });
    const out = renderToString(text, { colorSystem: ColorDepth.STANDARD });
    expect(out).toContain("hi");
    expect(out).toMatch(/\x1b\[[0-9;]*31[0-9;]*m/); // SGR 31 = red
    expect(out).toMatch(/\x1b\[0m/); // reset
    expect(out.endsWith("\n")).toBe(false);
  });

  it("strips all color codes when colorSystem = null", () => {
    const text = new RichText("hi", { style: Style.parse("bold red on blue"), end: "" });
    const out = renderToString(text, { colorSystem: null });
    expect(out).toBe("hi");
  });

  it("strips all color codes when noColor = true", () => {
    const text = new RichText("hi", { style: Style.parse("bold red"), end: "" });
    const out = renderToString(text, { noColor: true });
    expect(out).toBe("hi");
  });

  it("emits exactly the bytes the renderable produces — no implicit trailing newline", () => {
    // [LAW:one-source-of-truth] renderToString does not add or strip newlines;
    // the renderable's segment stream is the only source of truth.
    expect(renderToString(new RichText("hi"), { colorSystem: null })).toBe("hi");
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
    const out = renderToString(strip, { colorSystem: ColorDepth.TRUECOLOR });
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

// [LAW:behavior-not-structure] The tree-coalescer's contract is byte-level:
// adjacent same-style cells share one SGR open/close pair, OSC 8 link pairs
// sit inside that pair, and the count of SGR transitions equals the number of
// distinct adjacent-style runs — not the segment count.
describe("segmentsToString coalescing", () => {
  const STYLE = Style.parse("white on red");

  function countSgrOpens(out: string): number {
    return [...out.matchAll(/\x1b\[(?!0m)[0-9;]+m/g)].length;
  }
  function countSgrResets(out: string): number {
    return [...out.matchAll(/\x1b\[0m/g)].length;
  }
  function countOsc8Opens(out: string): number {
    return [...out.matchAll(/\x1b\]8;[^\\]*\x1b\\/g)].length / 2;
  }

  it("coalesces three adjacent same-style segments into one SGR open/close pair", () => {
    const segs = [
      new Segment(" a ", STYLE),
      new Segment(" b ", STYLE),
      new Segment(" c ", STYLE),
    ];
    const out = segmentsToString(segs, ColorDepth.TRUECOLOR);
    expect(countSgrOpens(out)).toBe(1);
    expect(countSgrResets(out)).toBe(1);
    // Run contents land between the open and the reset, in source order.
    expect(out).toMatch(/\x1b\[[0-9;]+m a  b  c \x1b\[0m/);
  });

  it("emits one SGR transition between two distinct-style runs (not four)", () => {
    const RED = Style.parse("white on red");
    const BLUE = Style.parse("white on blue");
    const segs = [
      new Segment(" a ", RED),
      new Segment(" b ", RED),
      new Segment(" c ", BLUE),
      new Segment(" d ", BLUE),
    ];
    const out = segmentsToString(segs, ColorDepth.TRUECOLOR);
    expect(countSgrOpens(out)).toBe(2);
    expect(countSgrResets(out)).toBe(2);
  });

  it("nests OSC 8 link pairs inside the shared SGR wrap when adjacent same-style cells link to different URLs", () => {
    const linkA = new Style({ color: STYLE.color, bgcolor: STYLE.bgcolor, link: "https://a.example" });
    const linkB = new Style({ color: STYLE.color, bgcolor: STYLE.bgcolor, link: "https://b.example" });
    const segs = [
      new Segment(" a ", linkA),
      new Segment(" b ", linkB),
    ];
    const out = segmentsToString(segs, ColorDepth.TRUECOLOR);
    // One SGR wrap (same non-link style), two OSC 8 pairs (different links).
    expect(countSgrOpens(out)).toBe(1);
    expect(countSgrResets(out)).toBe(1);
    expect(countOsc8Opens(out)).toBe(2);
    // OSC 8 open appears AFTER the SGR open; OSC 8 close BEFORE the SGR reset.
    const sgrOpen = out.indexOf("\x1b[");
    const sgrReset = out.lastIndexOf("\x1b[0m");
    const firstOsc8 = out.indexOf("\x1b]8;");
    const lastOsc8 = out.lastIndexOf("\x1b]8;");
    expect(firstOsc8).toBeGreaterThan(sgrOpen);
    expect(lastOsc8).toBeLessThan(sgrReset);
  });

  it("emits one shared OSC 8 pair when adjacent same-style cells link to the same URL", () => {
    const linked = new Style({ color: STYLE.color, bgcolor: STYLE.bgcolor, link: "https://same.example" });
    const segs = [
      new Segment(" a ", linked),
      new Segment(" b ", linked),
    ];
    const out = segmentsToString(segs, ColorDepth.TRUECOLOR);
    expect(countSgrOpens(out)).toBe(1);
    expect(countOsc8Opens(out)).toBe(1);
  });

  it("emits no SGR wraps when colorSystem is null even for adjacent styled segments", () => {
    const segs = [
      new Segment("hi ", STYLE),
      new Segment("there", STYLE),
    ];
    expect(segmentsToString(segs, null)).toBe("hi there");
  });

  it("strips OSC 8 hyperlinks too when colorSystem is null (not just SGR)", () => {
    const linked = new Style({ link: "https://example.com" });
    const segs = [new Segment("click me", linked)];
    expect(segmentsToString(segs, null)).toBe("click me");
  });

  it("agrees with segmentToString for a single segment (single-enforcer)", () => {
    const seg = new Segment("hi", STYLE);
    expect(segmentToString(seg, ColorDepth.TRUECOLOR)).toBe(
      segmentsToString([seg], ColorDepth.TRUECOLOR),
    );
  });

  it("renders a 3-cell same-style Strip with an empty joiner as one SGR open/close pair", () => {
    // PlainJoiner with separator="" emits an empty-text segment between cells
    // (filtered by the coalescer) and EMPTY at endpoints. With same-style
    // cells the three text pieces become one SGR run on the wire.
    const strip = new Strip(
      [
        new StripCell(" a ", STYLE),
        new StripCell(" b ", STYLE),
        new StripCell(" c ", STYLE),
      ],
      new PlainJoiner({ separator: "" }),
    );
    const out = renderToString(strip, { colorSystem: ColorDepth.TRUECOLOR });
    expect(countSgrOpens(out)).toBe(1);
    expect(countSgrResets(out)).toBe(1);
    expect(out).toMatch(/\x1b\[[0-9;]+m a  b  c \x1b\[0m/);
  });

  it("avoids the legacy N-pairs-per-cell layout (regression bar)", () => {
    // Pre-coalescer behavior: 3 cells → 3 SGR open/close pairs. The new floor
    // is 1. A future regression that goes back to per-segment Style.render
    // would push this back to 3.
    const segs = [
      new Segment(" a ", STYLE),
      new Segment(" b ", STYLE),
      new Segment(" c ", STYLE),
    ];
    const out = segmentsToString(segs, ColorDepth.TRUECOLOR);
    expect(countSgrOpens(out)).toBeLessThan(3);
  });

  // [LAW:types-are-the-program] segmentsToString must be a pure function of
  // (segments, colorSystem). Two pipeline runs over independently-constructed
  // Style instances for the same link URL must emit byte-identical OSC 8 —
  // no global-counter dependence on construction order.
  it("emits byte-identical OSC 8 for independently-constructed link Styles with the same URL", () => {
    new Style({ link: "https://noise.example/a" });
    const a = new Style({
      color: STYLE.color,
      bgcolor: STYLE.bgcolor,
      link: "https://target.example",
    });
    new Style({ link: "https://noise.example/b" });
    const b = new Style({
      color: STYLE.color,
      bgcolor: STYLE.bgcolor,
      link: "https://target.example",
    });
    const outA = segmentsToString([new Segment("x", a)], ColorDepth.TRUECOLOR);
    const outB = segmentsToString([new Segment("x", b)], ColorDepth.TRUECOLOR);
    expect(outA).toBe(outB);
  });

  it("emits OSC 8 with empty params (no id= annotation) in the coalesced pipeline", () => {
    const linked = new Style({ link: "https://example.com" });
    const out = segmentsToString(
      [new Segment("click", linked)],
      ColorDepth.TRUECOLOR,
    );
    expect(out).toContain("\x1b]8;;https://example.com\x1b\\");
    expect(out).not.toMatch(/\x1b\]8;id=/);
  });
});
