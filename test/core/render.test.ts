import { describe, it, expect } from "vitest";
import { renderToString, segmentsToString, segmentToString } from "../../src/core/render.js";
import { ColorDepth } from "../../src/core/color.js";
import { RichText } from "../../src/core/text.js";
import { Style } from "../../src/core/style.js";
import { Segment, ControlType } from "../../src/core/segment.js";
import { Strip, PowerlineJoiner } from "../../src/core/strip.js";
import { Panel } from "../../src/renderables/panel.js";
import { renderMarkup } from "../../src/core/markup.js";
import { OSC8_CLOSE, osc8Open, osc8Sequences } from "../../src/core/osc8.js";
import { StyleSyntaxError } from "../../src/core/style.js";

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

  it("draws only ASCII when asciiOnly is set", () => {
    const panel = new Panel("boxed");
    expect(renderToString(panel, { asciiOnly: true })).toMatch(/^[\x00-\x7f]*$/);
    expect(renderToString(panel)).toMatch(/[^\x00-\x7f]/);
  });

  it("defaults to truecolor when colorSystem is omitted", () => {
    const text = new RichText("x", { style: Style.parse("#ff0066"), end: "" });
    const out = renderToString(text);
    // Truecolor uses 38;2;r;g;b SGR.
    expect(out).toMatch(/\x1b\[38;2;255;0;102m/);
  });

  it("reports each style it drops to onStyleError and still renders unstyled", () => {
    const heard: [StyleSyntaxError, string][] = [];
    const out = renderToString(new Panel(new RichText("x", { style: "bold rd" })), {
      colorSystem: null,
      onStyleError: (error, style) => void heard.push([error, style]),
    });
    expect(out).toBe(renderToString(new Panel("x"), { colorSystem: null }));
    expect(heard).toHaveLength(1);
    expect(heard[0]![0]).toBeInstanceOf(StyleSyntaxError);
    expect(heard[0]![1]).toBe("bold rd");
  });

  it("throws the dropped style's error when onStyleError rethrows", () => {
    const strict = (error: StyleSyntaxError): never => {
      throw error;
    };
    expect(() => renderToString(new RichText("x", { style: "rd" }), { onStyleError: strict })).toThrow(
      StyleSyntaxError,
    );
  });
});

// [LAW:behavior-not-structure] The encoder's contract is byte-level and is the
// reference's: Python Rich 9d8f9a3 writes every segment through its own
// `Style.render`, so each segment is its own SGR run, and a link's OSC 8 pair
// wraps that run.
describe("segmentsToString", () => {
  const STYLE = Style.parse("white on red");
  const TRUECOLOR = { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true } as const;

  it("writes each segment as its own run, even beside one with the same style", () => {
    const segs = [new Segment(" a ", STYLE), new Segment(" b ", STYLE), new Segment(" c ", STYLE)];
    expect(segmentsToString(segs, TRUECOLOR)).toBe(
      "\x1b[37;41m a \x1b[0m\x1b[37;41m b \x1b[0m\x1b[37;41m c \x1b[0m",
    );
  });

  it("wraps a linked segment's run in its OSC 8 pair", () => {
    const url = "https://a.example";
    const linked = new Style({ color: STYLE.color, bgcolor: STYLE.bgcolor, link: url });
    expect(segmentsToString([new Segment(" a ", linked)], TRUECOLOR)).toBe(
      `${osc8Open(url)}\x1b[37;41m a \x1b[0m${OSC8_CLOSE}`,
    );
  });

  it("writes nothing for an empty or control segment, and bare text for an unstyled one", () => {
    const segs = [new Segment("", STYLE), new Segment("\x07", undefined, [[ControlType.BELL]]), new Segment("plain")];
    expect(segmentsToString(segs, TRUECOLOR)).toBe("plain");
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
    expect(out).not.toMatch(/\x1b\[[0-9;]*m/);
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
  // spans several segments is several OSC 8 pairs, one per segment, so every
  // pair it becomes must carry the same id — or the span highlights in pieces.
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
