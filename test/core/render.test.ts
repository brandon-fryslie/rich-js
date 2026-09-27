import { describe, it, expect } from "vitest";
import { renderToString, segmentsToString, segmentToString } from "../../src/core/render.js";
import { ColorDepth } from "../../src/core/color.js";
import { RichText } from "../../src/core/text.js";
import { Style } from "../../src/core/style.js";
import { Segment } from "../../src/core/segment.js";
import { Strip, PowerlineJoiner, PlainJoiner } from "../../src/core/strip.js";
import { Panel } from "../../src/renderables/panel.js";
import { renderMarkup } from "../../src/core/markup.js";
import { osc8Sequences } from "../../src/core/osc8.js";

// Every OSC 8 open in `out` as `{ params, uri }` (a close has an empty uri).
function osc8Opens(out: string): { params: string; uri: string }[] {
  return osc8Sequences(out)
    .filter((s) => s.uri !== "")
    .map(({ params, uri }) => ({ params, uri }));
}

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

  it("emits exactly the bytes the renderable produces — nothing added, nothing stripped", () => {
    // [LAW:one-source-of-truth] renderToString does not add or strip newlines;
    // the renderable's segment stream — `end` included, "\n" by default
    // (rich-text-5ai) — is the only source of truth.
    const text = new RichText("hi");
    const fromSegments = segmentsToString([...text.render({ maxWidth: 80 })], { colorSystem: null, hyperlinks: true });
    expect(renderToString(text, { colorSystem: null })).toBe(fromSegments);
    expect(fromSegments).toBe("hi\n");
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
        new RichText(" main ", { style: "white on blue", end: "" }),
        new RichText(" foo ", { style: "white on cyan", end: "" }),
      ],
      new PowerlineJoiner({ glyph: ">", divider: "|", lead: "<", tail: ">" }),
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

  it("coalesces three adjacent same-style segments into one SGR open/close pair", () => {
    const segs = [
      new Segment(" a ", STYLE),
      new Segment(" b ", STYLE),
      new Segment(" c ", STYLE),
    ];
    const out = segmentsToString(segs, { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true });
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
    const out = segmentsToString(segs, { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true });
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
    const out = segmentsToString(segs, { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true });
    // One SGR wrap (same non-link style), two OSC 8 pairs (different links).
    expect(countSgrOpens(out)).toBe(1);
    expect(countSgrResets(out)).toBe(1);
    expect(osc8Opens(out)).toHaveLength(2);
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
    const out = segmentsToString(segs, { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true });
    expect(countSgrOpens(out)).toBe(1);
    expect(osc8Opens(out)).toHaveLength(1);
  });

  it("emits no SGR wraps when colorSystem is null even for adjacent styled segments", () => {
    const segs = [
      new Segment("hi ", STYLE),
      new Segment("there", STYLE),
    ];
    expect(segmentsToString(segs, { colorSystem: null, hyperlinks: true })).toBe("hi there");
  });

  it("keeps OSC 8 hyperlinks when colorSystem is null — colour depth governs SGR only", () => {
    const linked = new Style({ link: "https://example.com", color: "red" });
    const segs = [new Segment("click me", linked)];
    const out = segmentsToString(segs, { colorSystem: null, hyperlinks: true });
    expect(countSgrOpens(out)).toBe(0);
    expect(osc8Opens(out)).toHaveLength(1);
    expect(out).toBe(segmentsToString(segs, { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true }).replace(/\x1b\[[0-9;]*m/g, ""));
  });

  it("strips OSC 8 hyperlinks when hyperlinks is false, at any colour depth", () => {
    const linked = new Style({ link: "https://example.com", color: "red" });
    const segs = [new Segment("click me", linked)];
    expect(segmentsToString(segs, { colorSystem: null, hyperlinks: false })).toBe("click me");
    expect(osc8Opens(segmentsToString(segs, { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: false }))).toHaveLength(0);
  });

  it("renderToString keeps links under colorSystem null and noColor", () => {
    const linked = new Style({ link: "https://example.com" });
    const text = new RichText("go", { style: linked, end: "" });
    expect(osc8Opens(renderToString(text, { colorSystem: null }))).toHaveLength(1);
    expect(osc8Opens(renderToString(text, { noColor: true }))).toHaveLength(1);
    expect(osc8Opens(renderToString(text, { colorSystem: null, hyperlinks: false }))).toHaveLength(0);
  });

  it("agrees with segmentToString for a single segment (single-enforcer)", () => {
    const seg = new Segment("hi", STYLE);
    expect(segmentToString(seg, { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true })).toBe(
      segmentsToString([seg], { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true }),
    );
  });

  it("renders a 3-cell same-style Strip with an empty joiner as one SGR open/close pair", () => {
    // PlainJoiner with separator="" emits an empty-text segment between cells
    // (filtered by the coalescer) and EMPTY at endpoints. With same-style
    // cells the three text pieces become one SGR run on the wire.
    const strip = new Strip(
      [
        new RichText(" a ", { style: STYLE, end: "" }),
        new RichText(" b ", { style: STYLE, end: "" }),
        new RichText(" c ", { style: STYLE, end: "" }),
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
    // is 1. A future regression that goes back to per-segment encoding would
    // push this back to 3.
    const segs = [
      new Segment(" a ", STYLE),
      new Segment(" b ", STYLE),
      new Segment(" c ", STYLE),
    ];
    const out = segmentsToString(segs, { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true });
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
    const outA = segmentsToString([new Segment("x", a)], { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true });
    const outB = segmentsToString([new Segment("x", b)], { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true });
    expect(outA).toBe(outB);
  });

  // [LAW:behavior-not-structure] The hover contract: a terminal treats cells
  // as one hyperlink when they share the URI AND the id. A link whose text
  // changes style mid-span cannot share one OSC 8 pair (the pair nests inside
  // an SGR run), so every pair it becomes must carry the same id — or the
  // span highlights in pieces.
  it("gives every OSC 8 pair of one link the same id when its text spans two SGR runs", () => {
    const url = "https://split.example";
    const segs = [
      new Segment("▸", new Style({ bold: true, link: url })),
      new Segment(" open", new Style({ link: url })),
    ];
    const out = segmentsToString(segs, { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true });
    const open = { params: "id=3051f306", uri: url };
    expect(osc8Opens(out)).toEqual([open, open]);
  });

  it("gives non-adjacent spans with the same URL the same id — one URL is one link", () => {
    const url = "https://same.example";
    const out = segmentsToString([
      new Segment("✕", new Style({ link: url })),
      new Segment(" between ", Style.parse("red")),
      new Segment("▾ menu", new Style({ bold: true, link: url })),
    ], { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true });
    const opens = osc8Opens(out);
    expect(opens).toHaveLength(2);
    expect(opens[1]).toEqual(opens[0]);
  });
});

// =========================================================
// OSC 8 wrap is escape-safe (end-to-end trust-boundary contract)
// =========================================================

// [LAW:behavior-not-structure] Pin the observable invariant at the byte
// level: hostile URL bytes routed through the markup parser cannot break
// out of the OSC 8 wrap. The renderer trusts that link sanitization
// happened at the RichText boundary upstream; this test holds that contract.

describe("OSC 8 wrap is escape-safe", () => {
  it("cannot be terminated early by a hostile URL routed through the markup parser", () => {
    const t = renderMarkup("[link=https://evil.example/\x1b\\BAD]click[/link]");
    const out = segmentsToString(
      [...t.render({ maxWidth: 80 })], { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true });
    const [open] = osc8Opens(out);
    expect(open).toBeDefined();
    // The URL slot must contain zero OSC terminators — otherwise an attacker
    // could close the OSC 8 early and inject arbitrary terminal control bytes.
    expect(open!.uri).not.toContain("\x1b");
    expect(open!.uri).not.toContain("\x07");
    expect(open!.uri).not.toContain("\x9c");
    // And the "BAD" suffix from the dirty URL is now part of the (sanitized)
    // URL, not arbitrary terminal-control text following an escaped OSC.
    expect(open!.uri).toBe("https://evil.example/\\BAD");
  });

  it("sanitizes wire bytes even when a dirty Style bypasses RichText entirely (segmentsToString)", () => {
    // [LAW:single-enforcer] Wire-byte boundary check: even a Style constructed
    // directly via `new Style({ link })` and handed straight to a Segment —
    // never touching RichText, markup, or any input-sanitizing layer — must
    // not produce bytes that can escape the OSC 8 wrap. This covers
    // Console.print({ style }), Segment.applyStyle callers, and any future
    // renderable that builds Segments without going through RichText.
    const dirty = "https://evil.example/\x1b\\BAD";
    const dirtyStyle = new Style({ link: dirty });
    expect(dirtyStyle.link).toBe(dirty); // Style stays faithful (precondition)
    const out = segmentsToString(
      [new Segment("click", dirtyStyle)], { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true });
    const [open] = osc8Opens(out);
    expect(open).toBeDefined();
    expect(open!.uri).toBe("https://evil.example/\\BAD");
  });
});
