import { describe, it, expect } from "vitest";
import {
  Strip,
  CellJoiner,
  POWERLINE_JOINER,
  SEAM_MIN_DELTA_E,
  CAPSULE_JOINER,
  PLAIN_JOINER,
  gradientJoiner,
  type JoinCell,
  type JoinShape,
} from "../../src/core/strip.js";
import { arrows } from "./arrows.js";
import { Style, Theme } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import type { Segment } from "../../src/core/segment.js";
import type { RenderOptions } from "../../src/core/protocol.js";
import { ColorDepth, ColorRgba, ColorSpec, blendRgb } from "../../src/core/color.js";
import { exportLines } from "../../src/core/export-lines.js";
import { ATOM_ONE_DARK } from "../../src/themes/terminalThemes.js";
import { Oklch } from "../../src/core/oklch.js";
import { renderToString } from "../../src/core/render.js";
import { Measurement } from "../../src/core/measure.js";
import { cellLen } from "../../src/core/cells.js";
import { Table } from "../../src/renderables/table.js";

// [LAW:behavior-not-structure] Tests assert what consumers observe — segment
// text, fg/bg pairs, ordering — not the internal walk.

const OPTIONS: RenderOptions = { maxWidth: 80 };

// Strip now ends its own last line (rich-flexstrip-5kf), matching FlexStrip
// and every other composable renderable. That terminator is pinned by its
// own tests below; stripping it here keeps the joiner/color assertions in
// the rest of this file about what they were always about.
function render(strip: Strip, options: RenderOptions = OPTIONS): Segment[] {
  const segs = [...strip.render(options)];
  const last = segs.at(-1);
  if (last && last.text === "\n" && !last.style && !last.control) segs.pop();
  return segs;
}

function cell(text: string, style: string | Style): RichText {
  return new RichText(text, { style, end: "" });
}

const RED = cell(" red ", "white on red");
const BLUE = cell(" blue ", "white on blue");
const GREEN = cell(" green ", "white on green");

describe("Strip render walk", () => {
  it("emits nothing for an empty strip", () => {
    const strip = new Strip([], POWERLINE_JOINER);
    expect(render(strip)).toEqual([]);
  });

  it("emits start-cap, item, end-cap for one item", () => {
    const strip = new Strip([RED], arrows());
    const segs = render(strip);
    expect(segs.map((s) => s.text)).toEqual(["<", " red ", ">"]);
  });

  it("emits start-cap, item, mid-join, item, end-cap for two items", () => {
    const strip = new Strip([RED, BLUE], arrows());
    const segs = render(strip);
    expect(segs.map((s) => s.text)).toEqual(["<", " red ", ">", " blue ", ">"]);
  });

  it("scales linearly: 2N+1 segments for N items", () => {
    const strip = new Strip(
      [RED, BLUE, GREEN],
      arrows(),
    );
    const segs = render(strip);
    expect(segs).toHaveLength(7);
    expect(segs.map((s) => s.text)).toEqual([
      "<", " red ", ">", " blue ", ">", " green ", ">",
    ]);
  });

  // rich-flexstrip-5kf: Strip ends its own last line, matching FlexStrip and
  // every other composable renderable (docs/group.md), so a `Group` of a
  // Strip followed by another renderable puts that renderable on its own
  // line instead of running it onto the Strip's.
  it("ends its own render with a plain line terminator", () => {
    const strip = new Strip([RED, BLUE], arrows());
    const segs = [...strip.render(OPTIONS)];
    const last = segs.at(-1)!;
    expect(last.text).toBe("\n");
    expect(last.style).toBeUndefined();
    expect(last.control).toBeUndefined();
  });

  it("emits no terminator for an empty strip", () => {
    const strip = new Strip([], POWERLINE_JOINER);
    expect([...strip.render(OPTIONS)]).toEqual([]);
  });
});

describe("powerline color inheritance", () => {
  it("start cap is the lead, fg = first item's left-edge bg, no bg", () => {
    const strip = new Strip([RED, BLUE], arrows());
    const start = render(strip)[0]!;
    expect(start.text).toBe("<");
    expect(start.style?.color?.name).toBe(RED.edgeStyle("left", OPTIONS).bgcolor?.name);
    expect(start.style?.bgcolor).toBeUndefined();
  });

  it("end cap is the tail, its own glyph, fg = last item's right-edge bg, no bg", () => {
    const strip = new Strip([RED, BLUE], arrows({ lead: "(", tail: ")" }));
    const segs = render(strip);
    expect(segs.map((s) => s.text)).toEqual(["(", " red ", ">", " blue ", ")"]);
    expect(segs[4]!.style?.color?.name).toBe(BLUE.edgeStyle("right", OPTIONS).bgcolor?.name);
    expect(segs[4]!.style?.bgcolor).toBeUndefined();
  });

  it("empty caps begin and end the strip flat — no segment at either end", () => {
    const strip = new Strip([RED], arrows({ lead: "", tail: "" }));
    expect(render(strip).map((s) => s.text)).toEqual([" red "]);
  });

  it("an empty lead begins the strip flat", () => {
    const strip = new Strip([RED], arrows({ lead: "" }));
    expect(renderToString(strip, { colorSystem: null, width: 80 })).toBe(" red >\n");
  });

  it("end cap fg = last item's right-edge bg, no bg", () => {
    const strip = new Strip([RED, BLUE], arrows());
    const segs = render(strip);
    const end = segs[segs.length - 1]!;
    expect(end.style?.color?.name).toBe(BLUE.edgeStyle("right", OPTIONS).bgcolor?.name);
    expect(end.style?.bgcolor).toBeUndefined();
  });

  it("middle join fg = left.right-edge.bg, bg = right.left-edge.bg", () => {
    const strip = new Strip([RED, BLUE], arrows());
    const segs = render(strip);
    const mid = segs[2]!;
    expect(mid.style?.color?.name).toBe(RED.edgeStyle("right", OPTIONS).bgcolor?.name);
    expect(mid.style?.bgcolor?.name).toBe(BLUE.edgeStyle("left", OPTIONS).bgcolor?.name);
  });
});

// [LAW:dataflow-not-control-flow] The powerline seam is a
// pure function of the input edge colours. Background colour is paint, never
// structure: when the two edge bgs MATCH the chevron is still emitted, just
// painted in its own bg (invisible) — a same-bg boundary between two distinct
// items survives as a real structural seam, equal bg does not coalesce them.
// The one thing that elides the separator is the ABSENCE of a left colour to
// paint (no bg, or the terminal default) — that is paint logic (nothing to
// paint), not bg deciding structure. See the no-bg suite further below.
describe("powerline same-bg structural join", () => {
  const RED_A = cell(" a ", "white on red");
  const RED_B = cell(" b ", "white on red");
  const BLUE_C = cell(" c ", "white on blue");

  it("emits the mid-join chevron structurally even when both neighbors share a bg", () => {
    const strip = new Strip([RED_A, RED_B], arrows());
    expect(render(strip).map((s) => s.text)).toEqual(["<", " a ", "|", " b ", ">"]);
  });

  it("draws the equal-bg mid-join as the divider in the left item's text colour", () => {
    const strip = new Strip([RED_A, RED_B], arrows());
    const mid = render(strip)[2]!;
    expect(mid.text).toBe("|");
    expect(mid.style?.color?.name).toBe("white");
    expect(mid.style?.bgcolor?.name).toBe("red");
  });

  it("treats backgrounds the eye cannot tell apart as equal; a visible difference keeps the arrow", () => {
    const joined = (a: string, b: string) =>
      render(
        new Strip(
          [cell(" a ", `white on ${a}`), cell(" b ", `white on ${b}`)],
          arrows(),
        ),
      )[2]!;
    expect(joined("#402020", "#412121").text).toBe("|");
    const far = joined("#402020", "#204040");
    expect(far.text).toBe(">");
    expect(far.style?.color?.value?.hex).toBe("#402020");
  });

  it("knows one palette slot by any of its spellings, and two slots apart", () => {
    const mid = (a: string, b: string) =>
      render(
        new Strip(
          [cell(" a ", `white on ${a}`), cell(" b ", `white on ${b}`)],
          arrows(),
        ),
      )[2]!.text;
    expect(mid("red", "color(1)")).toBe("|");
    expect(mid("red", "green")).toBe(">");
    expect(mid("color(1)", "color(9)")).toBe(">");
    // An EIGHT_BIT spec on 0–15 is the same theme slot.
    const slot = new Style({ color: "white", bgcolor: new ColorSpec("color(1)", ColorDepth.EIGHT_BIT, 1) });
    expect(
      render(new Strip([cell(" a ", slot), cell(" b ", "white on red")], arrows()))[2]!.text,
    ).toBe("|");
  });

  it("tells two theme-drawn mixes apart by what they mix, however their ends are spelled", () => {
    const blend = (to: string, from = "blue") => ColorSpec.blend(ColorSpec.parse(from), ColorSpec.parse(to), 0.5);
    const mid = (a: ColorSpec, b: ColorSpec) =>
      render(
        new Strip(
          [cell(" a ", new Style({ color: "white", bgcolor: a })), cell(" b ", new Style({ color: "white", bgcolor: b }))],
          arrows(),
        ),
      )[2]!.text;
    expect(mid(blend("red"), blend("red"))).toBe("|");
    expect(mid(blend("red"), blend("red", "color(4)"))).toBe("|");
    expect(mid(blend("red"), blend("green"))).toBe(">");
  });

  // Two grounds apart in truecolor that a lower depth draws as one colour: the
  // arrow would be drawn in the very colour it sits on, so the seam is the
  // divider at that depth and the arrow above it.
  it.each([
    ["256 colours", ColorDepth.EIGHT_BIT, "#107030", "#003070"],
    ["ansi", ColorDepth.STANDARD, "#f06050", "#e02040"],
  ] as const)("measures the seam on the colours drawn at %s", (_, depth, a, b) => {
    const [ca, cb] = [a, b].map((c) => ColorSpec.parse(c)) as [ColorSpec, ColorSpec];
    expect(Oklch.fromRgba(ca.value!).deltaE(Oklch.fromRgba(cb.value!))).toBeGreaterThanOrEqual(SEAM_MIN_DELTA_E);
    expect(ca.downgrade(depth).number).toBe(cb.downgrade(depth).number);
    const strip = new Strip(
      [cell(" a ", `white on ${a}`), cell(" b ", `white on ${b}`)],
      arrows(),
    );
    const mid = (colorSystem: ColorDepth) => render(strip, { maxWidth: 80, colorSystem })[2]!.text;
    expect([mid(ColorDepth.TRUECOLOR), mid(depth)]).toEqual([">", "|"]);
    // renderToString hands its own depth to the renderables it encodes.
    const text = renderToString(strip, { colorSystem: depth, width: 80 }).replace(/\x1b\[[0-9;]*m/g, "");
    expect(text).toContain(" a | b ");
  });

  it("measures a translucent background as the colour it is drawn in", () => {
    const mid = (a: string, b: string) =>
      render(
        new Strip(
          [cell(" a ", `white on ${a}`), cell(" b ", `white on ${b}`)],
          arrows(),
        ),
      )[2]!;
    expect(mid("#FFFFFF0A", "#FFFFFF60").text).toBe(">");
    expect(mid("#FFFFFF60", "#FFFFFF61").text).toBe("|");
    // The arrow continues its cell: drawn in the left ground as the writer
    // draws it, opaque, never composited again over the ground it enters.
    const arrow = mid("#FFFFFF60", "#FFFFFF0A");
    expect(arrow.style?.color?.value?.hex).toBe(
      new Style({ bgcolor: "#FFFFFF60" }).drawnColors().bgcolor?.value?.hex,
    );
    expect(arrow.style?.color?.value?.alpha).toBe(1);
  });

  it("draws the divider on the left item's own ground, so it reads as that item's text", () => {
    // Two grounds the eye cannot tell apart, but not one colour.
    const mid = render(
      new Strip(
        [cell(" a ", "white on #402020"), cell(" b ", "white on #412121")],
        arrows(),
      ),
    )[2]!;
    expect(mid.text).toBe("|");
    expect(mid.style?.bgcolor?.value?.hex).toBe("#402020");
  });

  it("draws the powerline arrow, its divider, and its lead as the arrow in reverse video", () => {
    const segs = render(new Strip([RED_A, RED_B, BLUE_C], POWERLINE_JOINER));
    // The literals, so a changed shape cannot pass by comparing it to itself.
    expect(segs.map((s) => s.text).filter((_, i) => i % 2 === 0)).toEqual(["\ue0b0", "\ue0b1", "\ue0b0", "\ue0b0"]);
    expect(segs[0]!.style?.color?.name).toBe(RED_A.edgeStyle("left", OPTIONS).bgcolor?.name);
    expect(segs[0]!.style?.reverse).toBe(true);
    expect(segs[0]!.style?.bgcolor).toBeUndefined();
  });

  it("still emits a visible arrow when neighbor bgs differ", () => {
    const strip = new Strip([RED, BLUE], arrows());
    const mid = render(strip)[2]!;
    expect(mid.text).toBe(">");
    expect(mid.style?.color?.name).toBe(RED.edgeStyle("right", OPTIONS).bgcolor?.name);
    expect(mid.style?.bgcolor?.name).toBe(BLUE.edgeStyle("left", OPTIONS).bgcolor?.name);
  });
});

// A join is painted in whichever neighbour has a bg: the arrow in the LEFT bg
// (the colour bleeding right), the lead in the RIGHT bg when only it has one —
// the same data rule that makes the start cap the lead (left === null ⇒ no left
// bg). With neither there is nothing to paint, so nothing is emitted. This is
// paint logic, not bg deciding structure: two items with REAL equal bgs still
// emit (see above).
describe("powerline no-bg edges paint nothing", () => {
  const FG_A = cell("a", "red"); // fg only — no bgcolor
  const FG_B = cell("b", "blue"); // fg only — no bgcolor

  it("emits no separator anywhere when items are fg-only (no bg to bleed)", () => {
    const strip = new Strip([FG_A, FG_B], arrows());
    // start, mid and end each have no bg on either side, so all paint nothing
    // — no glyph appears.
    expect(render(strip).map((s) => s.text)).toEqual(["a", "b"]);
  });

  it("a left item WITH a bg still bleeds into a right item without one", () => {
    const strip = new Strip([RED, FG_B], arrows());
    const mid = render(strip)[2]!;
    expect(mid.text).toBe(">");
    expect(mid.style?.color?.name).toBe(RED.edgeStyle("right", OPTIONS).bgcolor?.name);
    expect(mid.style?.bgcolor).toBeUndefined();
  });

  it("a left item WITH a bg is tailed into a right item without one", () => {
    const strip = new Strip([RED, FG_B], arrows({ lead: "(", tail: ")" }));
    expect(render(strip).map((s) => s.text)).toEqual(["(", " red ", ")", "b"]);
  });

  it("a right item WITH a bg is led in from a left item without one", () => {
    const strip = new Strip([FG_A, RED], arrows());
    const segs = render(strip);
    expect(segs.map((s) => s.text)).toEqual(["a", "<", " red ", ">"]);
    expect(segs[1]!.style?.color?.name).toBe(RED.edgeStyle("left", OPTIONS).bgcolor?.name);
    expect(segs[1]!.style?.bgcolor).toBeUndefined();
  });

  it("an explicit terminal-default bg counts as no bg (transparent — nothing to paint)", () => {
    // `… on default` is a real ColorSpec (not undefined) but renders as the
    // terminal background. It must behave like a fg-only edge: no separator.
    const DEF_A = cell("a", "red on default");
    const DEF_B = cell("b", "blue on default");
    const strip = new Strip([DEF_A, DEF_B], arrows());
    expect(render(strip).map((s) => s.text)).toEqual(["a", "b"]);
  });
});

describe("CAPSULE_JOINER", () => {
  const ASCII: RenderOptions = { ...OPTIONS, asciiOnly: true };

  it("opens a run with its open cap and closes it with its close cap, each in the run's ground", () => {
    const segs = render(new Strip([RED], CAPSULE_JOINER), ASCII);
    expect(segs.map((s) => s.text)).toEqual(["(", " red ", ")"]);
    for (const cap of [segs[0]!, segs[2]!]) {
      expect(cap.style?.color?.name).toBe("red");
      expect(cap.style?.bgcolor).toBeUndefined();
    }
  });

  it("closes the left pill, spaces, and opens the right one between items", () => {
    const segs = render(new Strip([RED, BLUE], CAPSULE_JOINER), ASCII);
    expect(segs.map((s) => s.text)).toEqual(["(", " red ", ")", " ", "(", " blue ", ")"]);
    expect(segs[2]!.style?.color?.name).toBe("red");
    expect(segs[4]!.style?.color?.name).toBe("blue");
  });

  it("draws the rounded glyphs where the output is not ASCII-only", () => {
    expect(render(new Strip([RED], CAPSULE_JOINER)).map((s) => s.text)).toEqual(["\ue0b6", " red ", "\ue0b4"]);
  });
});

describe("PLAIN_JOINER", () => {
  it("emits empty caps and a separator between items", () => {
    expect(render(new Strip([RED, BLUE], PLAIN_JOINER)).map((s) => s.text)).toEqual([" red ", " | ", " blue "]);
  });

  it("emits no separator for a single item", () => {
    expect(render(new Strip([RED], PLAIN_JOINER)).map((s) => s.text)).toEqual([" red "]);
  });

  it("joins items with no ground, since its seam paints with neither neighbour's", () => {
    const segs = render(new Strip([cell("docs", "cyan"), cell("guide", "cyan")], PLAIN_JOINER));
    expect(segs.map((s) => s.text)).toEqual(["docs", " | ", "guide"]);
  });

  it("draws the separator in the theme's strip.separator colour", () => {
    const themed: RenderOptions = { ...OPTIONS, theme: new Theme({ "strip.separator": "magenta" }) };
    expect(render(new Strip([RED, BLUE], PLAIN_JOINER), themed)[1]!.style?.color?.name).toBe("magenta");
    expect(render(new Strip([RED, BLUE], PLAIN_JOINER))[1]!.style?.color?.name).toBe("bright_black");
  });
});

describe("gradientJoiner", () => {
  const FF0000 = cell(" a ", "on #ff0000");
  const BLUE00FF = cell(" b ", "on #0000ff");

  it("emits half-block cells carrying two colour samples each", () => {
    const strip = new Strip([FF0000, BLUE00FF], gradientJoiner(3));
    const segs = render(strip);
    expect(segs.map((s) => s.text)).toEqual([" a ", "▌", "▌", "▌", " b "]);
    const grad = segs.slice(1, 4);
    for (const s of grad) {
      expect(s.style!.color).toBeDefined();
      expect(s.style!.bgcolor).toBeDefined();
    }
    const samples = grad.flatMap((s) => [
      s.style!.color!.getTruecolor(),
      s.style!.bgcolor!.getTruecolor(),
    ]);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.red).toBeLessThan(samples[i - 1]!.red);
      expect(samples[i]!.blue).toBeGreaterThan(samples[i - 1]!.blue);
    }
    expect(samples[0]!.red).toBeLessThan(255);
    expect(samples[samples.length - 1]!.blue).toBeLessThan(255);
  });

  it("renders empty at endpoints", () => {
    const strip = new Strip([FF0000], gradientJoiner(4));
    expect(render(strip).map((s) => s.text)).toEqual([" a "]);
  });

  it("renders empty when an item lacks an edge bgcolor", () => {
    const noBg = cell(" x ", "white");
    const strip = new Strip([FF0000, noBg], gradientJoiner(2));
    expect(render(strip).map((s) => s.text)).toEqual([" a ", " x "]);
  });

  it("ramps between the shades a theme draws its named neighbours in, in export", () => {
    const strip = new Strip([cell(" a ", "white on blue"), cell(" b ", "white on red")], gradientJoiner(2));
    const [row] = exportLines(render(strip), ATOM_ONE_DARK);
    const grounds = row!.map((run) => run.look.background as ColorRgba);
    const blue = ATOM_ONE_DARK.ansiColors.get(4);
    const red = ATOM_ONE_DARK.ansiColors.get(1);
    expect([grounds[0]!.hex, grounds.at(-1)!.hex]).toEqual(["#61afef", "#e06c75"]);
    const samples = row!.slice(1, -1).flatMap((run) => [run.look.foreground, run.look.background as ColorRgba]);
    expect(samples.map((c) => c.hex)).toEqual([1, 3, 5, 7].map((k) => blendRgb(blue, red, k / 8).hex));
  });

  it("draws nothing beside a default ground, which is no colour to ramp from", () => {
    const strip = new Strip([cell(" a ", "white on default"), cell(" b ", "white on red")], gradientJoiner(1));
    expect(render(strip).map((s) => s.text)).toEqual([" a ", " b "]);
  });

  it("ramps between translucent grounds as their cells draw them", () => {
    const strip = new Strip([cell(" a ", "white on #ffffff80"), cell(" b ", "white on #ff0000")], gradientJoiner(1));
    const [, join] = render(strip);
    const drawn = join!.style!.drawnColors();
    const seen = new ColorRgba(255, 255, 255, 128 / 255).compositeOver(new ColorRgba(0, 0, 0));
    expect([drawn.color!.value!.hex, drawn.bgcolor!.value!.hex]).toEqual(
      [0.25, 0.75].map((t) => blendRgb(seen, new ColorRgba(255, 0, 0), t).hex),
    );
  });

  it("defaults to steps=4", () => {
    const strip = new Strip([FF0000, BLUE00FF], gradientJoiner());
    const segs = render(strip);
    expect(segs.map((s) => s.text)).toEqual([" a ", "▌", "▌", "▌", "▌", " b "]);
  });
});

// [LAW:locality-or-seam] The bg constraint that the joiner needs lives at the
// edge of the item, not as a uniform-bg constraint on the interior. These
// tests pin that contract: a RichText with varying-bg spans reports its
// edge styles accurately, and joiners paint transitions using those edges.
describe("edge-aware joiner protocol with varying interior styling", () => {
  it("RichText.edgeStyle returns base style for unspanned text", () => {
    const r = cell("hello", "white on red");
    expect(r.edgeStyle("left", OPTIONS).bgcolor?.name).toBe("red");
    expect(r.edgeStyle("right", OPTIONS).bgcolor?.name).toBe("red");
  });

  it("RichText.edgeStyle reports span-overridden bg at the matching edge", () => {
    const r = new RichText("hello", { style: "white on red", end: "" });
    // Spans override bg on the right edge.
    r.stylize("on green", 4, 5);
    expect(r.edgeStyle("left", OPTIONS).bgcolor?.name).toBe("red");
    expect(r.edgeStyle("right", OPTIONS).bgcolor?.name).toBe("green");
  });

  it("RichText.edgeStyle leaves out a span that ends one column short of the edge", () => {
    // A span's end is exclusive: [0, 1) covers column 0 alone, so the right
    // edge — column 1 — is the base style. An inclusive end would paint the
    // joiner in a colour that is not on the boundary column.
    const r = new RichText("ab", { style: "white on red", end: "" });
    r.stylize("on green", 0, 1);
    expect(r.edgeStyle("left", OPTIONS).bgcolor?.name).toBe("green");
    expect(r.edgeStyle("right", OPTIONS).bgcolor?.name).toBe("red");
  });

  it("a joiner paints the transition using the actual edge bgs", () => {
    const left = new RichText("ab", { style: "white on red", end: "" });
    left.stylize("on yellow", 1, 2); // right edge becomes yellow
    const right = new RichText("cd", { style: "white on blue", end: "" });
    right.stylize("on green", 0, 1); // left edge is green
    const strip = new Strip([left, right], arrows());
    const segs = render(strip);
    const mid = segs.find((s) => s.text === ">")!;
    expect(mid.style?.color?.name).toBe("yellow");
    expect(mid.style?.bgcolor?.name).toBe("green");
  });

  it("empty RichText falls back to base style at both edges", () => {
    const r = cell("", "white on red");
    expect(r.edgeStyle("left", OPTIONS).bgcolor?.name).toBe("red");
    expect(r.edgeStyle("right", OPTIONS).bgcolor?.name).toBe("red");
  });
});

// A cell's style may be a theme name, which is a colour only against the theme
// of the render drawing it. That is why a joiner reads edges from inside the
// renderable it returns rather than in `join` — these pin the deferral, which
// a joiner reading edges eagerly would pass every test above.
describe("edge styles resolved against the render's theme", () => {
  const THEMED: RenderOptions = {
    maxWidth: 80,
    theme: new Theme({ "strip.lead": "white on red", "strip.tail": "white on blue" }),
  };

  it("RichText.edgeStyle resolves a theme name through the render's theme", () => {
    const r = cell("hello", "strip.lead");
    expect(r.edgeStyle("left", THEMED).bgcolor?.name).toBe("red");
    expect(r.edgeStyle("right", THEMED).bgcolor?.name).toBe("red");
  });

  it("resolves a span's theme name at the edge the span covers", () => {
    const r = cell("ab", "strip.lead");
    r.stylize("strip.tail", 1, 2);
    expect(r.edgeStyle("left", THEMED).bgcolor?.name).toBe("red");
    expect(r.edgeStyle("right", THEMED).bgcolor?.name).toBe("blue");
  });

  it("a joiner paints the transition in the theme's colours", () => {
    const strip = new Strip(
      [cell(" lead ", "strip.lead"), cell(" tail ", "strip.tail")],
      arrows(),
    );
    const mid = render(strip, THEMED).find((s) => s.text === ">")!;
    expect(mid.style?.color?.name).toBe("red");
    expect(mid.style?.bgcolor?.name).toBe("blue");
  });
});

describe("Strip measure", () => {
  const UNBOUNDED: RenderOptions = { maxWidth: Number.MAX_SAFE_INTEGER };
  const drawnWidth = (strip: Strip, options: RenderOptions): number =>
    cellLen(render(strip, options).map((s) => s.text).join(""));

  it.each([
    ["POWERLINE_JOINER", POWERLINE_JOINER],
    ["CAPSULE_JOINER", CAPSULE_JOINER],
    ["PLAIN_JOINER", PLAIN_JOINER],
    ["gradientJoiner(3)", gradientJoiner(3)],
  ])("measures at the width it draws, not the width offered, with a %s", (_name, joiner) => {
    const strip = new Strip([RED, BLUE, GREEN], joiner);
    const { maximum } = Measurement.get(UNBOUNDED, strip);
    expect(maximum).toBe(drawnWidth(strip, UNBOUNDED));
    expect(maximum).toBeLessThan(40);
  });

  it("measures the joins it draws at the options it is measured with", () => {
    // An ASCII-only output draws the powerline set flat at the start, so the
    // lead cell is gone from the measurement too.
    const strip = new Strip([RED, BLUE], POWERLINE_JOINER);
    const ascii: RenderOptions = { ...UNBOUNDED, asciiOnly: true };
    expect(Measurement.get(ascii, strip).maximum).toBe(drawnWidth(strip, ascii));
    expect(Measurement.get(ascii, strip).maximum).toBe(Measurement.get(UNBOUNDED, strip).maximum - 1);
  });

  it("measures one width as both bounds, since its row never narrows", () => {
    const strip = new Strip([cell("one two", "on red"), cell("three", "on blue")], PLAIN_JOINER);
    expect(Measurement.get(UNBOUNDED, strip)).toEqual(new Measurement(7 + 3 + 5, 7 + 3 + 5));
  });

  it("keeps every item when a Table squeezes the column it sits in", () => {
    const strip = new Strip(
      [new RichText(" alpha beta ", { style: "on red", end: "", noWrap: true }),
        new RichText(" gamma delta ", { style: "on blue", end: "", noWrap: true })],
      POWERLINE_JOINER,
    );
    const table = new Table({ showHeader: false }).addRow(strip, "a long neighbour that would gladly take every column it is offered");
    expect(renderToString(table, { colorSystem: null, width: 50 })).toContain(" gamma delta ");
  });

  it("measures an empty strip as no cells, as it draws none", () => {
    expect(Measurement.get(UNBOUNDED, new Strip([], POWERLINE_JOINER))).toEqual(new Measurement(0, 0));
  });
});

describe("CellJoiner", () => {
  const LEFT_BG = { edge: "left", part: "bg" } as const;
  const RIGHT_BG = { edge: "right", part: "bg" } as const;
  const arrow: JoinCell = { glyph: ">", fg: LEFT_BG, bg: RIGHT_BG };
  const shape = (parts: Partial<JoinShape>): JoinShape => ({ seam: [arrow], divider: [arrow], lead: [], tail: [], ...parts });
  const joiner = (parts: Partial<JoinShape>) => new CellJoiner(shape(parts), shape({}));

  it("draws ground as the fg in reverse video: SGR 7, the fg the cell's bg colour, no bg", () => {
    const lead = render(new Strip([RED], POWERLINE_JOINER))[0]!;
    expect(lead.style?.reverse).toBe(true);
    expect(lead.style?.color?.name).toBe("red");
    expect(lead.style?.bgcolor).toBeUndefined();
    expect(renderToString(new Strip([RED], POWERLINE_JOINER), { colorSystem: ColorDepth.STANDARD, width: 80 })).toMatch(/^\x1b\[7;31m\ue0b0/);
  });

  it("refuses a lead that names the left neighbour", () => {
    expect(() => joiner({ lead: [{ glyph: ">", fg: LEFT_BG, bg: "ground" }] })).toThrow(/glyph lead\[0\] names the left neighbour, which this part is drawn without/);
  });

  it("refuses a tail that names the right neighbour, inside a mix too", () => {
    const fg = { mix: [LEFT_BG, RIGHT_BG, 0.5] } as const;
    expect(() => joiner({ tail: [{ glyph: ">", fg, bg: "ground" }] })).toThrow(/glyph tail\[0\] names the right neighbour/);
  });

  it("refuses ground inside a mix, whose colour nobody knows", () => {
    // A shape authored as data reaches the joiner without the type's say.
    const fg = { mix: [LEFT_BG, "ground", 0.5] } as unknown as JoinCell["fg"];
    expect(() => joiner({ seam: [{ glyph: ">", fg, bg: RIGHT_BG }] })).toThrow(/seam\[0\] mixes ground/);
  });

  it("refuses a cell with ground on both sides", () => {
    expect(() => joiner({ seam: [{ glyph: ">", fg: "ground", bg: "ground" }] })).toThrow(/seam\[0\] has ground on both sides/);
  });

  it("refuses oneOf members of different widths", () => {
    expect(() => joiner({ seam: [{ glyph: { oneOf: [">", ">>"] }, fg: LEFT_BG, bg: RIGHT_BG }] })).toThrow(/different widths/);
  });

  it("refuses a divider of a different width than the seam", () => {
    expect(() => joiner({ divider: [arrow, arrow] })).toThrow(/divider is not the width of the seam/);
  });

  it("refuses a colour that is no Paint, and a mix outside 0..1", () => {
    const bad = (fg: unknown) => () => joiner({ seam: [{ glyph: ">", fg: fg as JoinCell["fg"], bg: RIGHT_BG }] });
    expect(bad({})).toThrow(/seam\[0\] has a colour that is not a Paint/);
    expect(bad({ edge: "left", part: "ink" })).toThrow(/not a Paint/);
    expect(bad({ mix: [LEFT_BG, RIGHT_BG, 1.5] })).toThrow(/mixes at 1.5, outside 0..1/);
    expect(bad({ mix: [LEFT_BG, RIGHT_BG, Number.NaN] })).toThrow(/outside 0..1/);
  });

  it("keeps a frozen copy, so the caller's shape cannot change it afterwards", () => {
    const seam: JoinCell[] = [arrow];
    const j = new CellJoiner(shape({ seam, divider: seam }), shape({}));
    seam.push(arrow);
    expect(render(new Strip([RED, BLUE], j)).map((s) => s.text)).toEqual([" red ", ">", " blue "]);
    expect(Object.isFrozen(POWERLINE_JOINER.shape.seam[0])).toBe(true);
  });

  it("reads which neighbours need a ground off the form it draws", () => {
    // The glyph seam names no neighbour; the ascii seam needs both grounds, so
    // in ASCII a groundless neighbour is an endpoint.
    const plain: JoinCell = { glyph: "│", fg: { role: "strip.separator" }, bg: "ground" };
    const glyph: JoinShape = { seam: [plain], divider: [plain], lead: [], tail: [] };
    const ascii: JoinShape = { seam: [arrow], divider: [arrow], lead: [{ glyph: "<", fg: RIGHT_BG, bg: "ground" }], tail: [] };
    const j = new CellJoiner(glyph, ascii);
    const text = render(new Strip([cell("a", ""), cell("b", "on blue")], j), { ...OPTIONS, asciiOnly: true }).map((s) => s.text).join("");
    expect(text).toBe("a<b");
  });

  it("refuses a shape that is not cells, naming the part", () => {
    expect(() => new CellJoiner({ seam: [arrow], divider: [arrow], tail: [] } as unknown as JoinShape, shape({}))).toThrow(/glyph lead is not a list of cells/);
    expect(() => joiner({ seam: [{ ...arrow, glyph: 5 as unknown as string }] })).toThrow(/seam\[0\] has a glyph that is neither/);
    expect(() => joiner({ seam: [{ ...arrow, glyph: { oneOf: "ab" as unknown as string[] } }] })).toThrow(/seam\[0\] has a glyph that is neither/);
  });

  it("treats a neighbour as missing when any part needs its ground, not only the seam", () => {
    // The seam names no neighbour; the lead paints the right ground. A
    // groundless right item gets no lead, so no colourless reversed block.
    const bar: JoinCell = { glyph: "│", fg: { role: "strip.separator" }, bg: "ground" };
    const j = new CellJoiner({ seam: [bar], divider: [bar], lead: [{ glyph: "\ue0b0", fg: "ground", bg: RIGHT_BG }], tail: [] }, shape({}));
    expect(render(new Strip([cell("a", "")], j)).map((s) => s.text)).toEqual(["a"]);
  });

  it("refuses an ascii form that is not ASCII", () => {
    expect(() => new CellJoiner(shape({}), shape({ seam: [{ ...arrow, glyph: "\ue0b0" }], divider: [{ ...arrow, glyph: "\ue0b0" }] }))).toThrow(
      /ascii seam\[0\] is not ASCII/,
    );
  });
});
