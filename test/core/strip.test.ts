import { describe, it, expect } from "vitest";
import {
  Strip,
  CellJoiner,
  JOINERS,
  joinerNamed,
  SEAM_MIN_DELTA_E,
  gradientSeam,
  SEAMS,
  CAPS,
  colorsOwnedBy,
  type JoinCell,
  type JoinSeam,
  type JoinCaps,
  type SeamForm,
  type CapsForm,
  type JoinerSpec,
} from "../../src/core/strip.js";
import { arrows } from "./arrows.js";
import { Style, Theme } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import { Segment } from "../../src/core/segment.js";
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
    const strip = new Strip([], JOINERS.powerline);
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
    const strip = new Strip([], JOINERS.powerline);
    expect([...strip.render(OPTIONS)]).toEqual([]);
  });
});

describe("whose each colour of a strip is", () => {
  /** Each cell's ink and ground, as `ink/ground` by the owning item's name, or `-` for a colour no item's. */
  const owners = (strip: Strip): string[] => {
    const frame = [render(strip)];
    const width = frame[0]!.reduce((cells, segment) => cells + segment.cellLength, 0);
    return Array.from({ length: width }, (_, x) => {
      const anchor = Segment.anchorAt(frame, x, 0);
      const of = (side: "fg" | "bg"): string => (colorsOwnedBy(anchor, new Set([RED]))[side] ? "red" : colorsOwnedBy(anchor, new Set([BLUE]))[side] ? "blue" : "-");
      return `${of("fg")}/${of("bg")}`;
    });
  };
  const of = (owner: string, cells: number): string[] => Array.from({ length: cells }, () => owner);

  it("is the item that drew it, and a seam's arrow is inked by the item it points out of over the item it points into", () => {
    // lead in reverse video over red, " red ", the arrow, " blue ", tail
    expect(owners(new Strip([RED, BLUE], JOINERS.powerline))).toEqual(["-/red", ...of("red/red", 5), "red/blue", ...of("blue/blue", 6), "blue/-"]);
  });

  it("leaves the terminal's ground no item's", () => {
    // lead, " red ", close, a blank in red's ink, open, " blue ", close
    expect(owners(new Strip([RED, BLUE], JOINERS.capsule))).toEqual(["red/-", ...of("red/red", 5), ...of("red/-", 2), "blue/-", ...of("blue/blue", 6), "blue/-"]);
  });

  it("leaves a colour mixed from the two grounds no item's", () => {
    expect(owners(new Strip([RED, BLUE], JOINERS.prism))).toEqual(["-/red", ...of("red/red", 5), "red/-", "-/-", "-/blue", ...of("blue/blue", 6), "blue/-"]);
  });

  it("is one of a set of owners wherever it is any one of theirs, and none of the empty set's", () => {
    const frame = [render(new Strip([RED, BLUE], JOINERS.powerline))];
    const cells = Array.from({ length: frame[0]!.reduce((n, segment) => n + segment.cellLength, 0) }, (_, x) => Segment.anchorAt(frame, x, 0));
    const owned = (owners: ReadonlySet<object>) => cells.map((anchor) => colorsOwnedBy(anchor, owners));
    const red = owned(new Set([RED]));
    const blue = owned(new Set([BLUE]));
    expect(owned(new Set([RED, BLUE]))).toEqual(red.map((r, x) => ({ fg: r.fg || blue[x]!.fg, bg: r.bg || blue[x]!.bg })));
    expect(owned(new Set()).some((side) => side.fg || side.bg)).toBe(false);
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
    const segs = render(new Strip([RED_A, RED_B, BLUE_C], JOINERS.powerline));
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

describe("JOINERS.capsule", () => {
  const ASCII: RenderOptions = { ...OPTIONS, asciiOnly: true };

  it("opens a run with its open cap and closes it with its close cap, each in the run's ground", () => {
    const segs = render(new Strip([RED], JOINERS.capsule), ASCII);
    expect(segs.map((s) => s.text)).toEqual(["(", " red ", ")"]);
    for (const cap of [segs[0]!, segs[2]!]) {
      expect(cap.style?.color?.name).toBe("red");
      expect(cap.style?.bgcolor).toBeUndefined();
    }
  });

  it("closes the left pill, spaces, and opens the right one between items", () => {
    const segs = render(new Strip([RED, BLUE], JOINERS.capsule), ASCII);
    expect(segs.map((s) => s.text)).toEqual(["(", " red ", ")", " ", "(", " blue ", ")"]);
    expect(segs[2]!.style?.color?.name).toBe("red");
    expect(segs[4]!.style?.color?.name).toBe("blue");
  });

  it("draws the rounded glyphs where the output is not ASCII-only", () => {
    expect(render(new Strip([RED], JOINERS.capsule)).map((s) => s.text)).toEqual(["\ue0b6", " red ", "\ue0b4"]);
  });
});

describe("JOINERS.plain", () => {
  it("emits empty caps and a separator between items", () => {
    expect(render(new Strip([RED, BLUE], JOINERS.plain)).map((s) => s.text)).toEqual([" red ", " | ", " blue "]);
  });

  it("emits no separator for a single item", () => {
    expect(render(new Strip([RED], JOINERS.plain)).map((s) => s.text)).toEqual([" red "]);
  });

  it("joins items with no ground, since its seam paints with neither neighbour's", () => {
    const segs = render(new Strip([cell("docs", "cyan"), cell("guide", "cyan")], JOINERS.plain));
    expect(segs.map((s) => s.text)).toEqual(["docs", " | ", "guide"]);
  });

  it("draws the separator in the theme's strip.separator colour", () => {
    const themed: RenderOptions = { ...OPTIONS, theme: new Theme({ "strip.separator": "magenta" }) };
    expect(render(new Strip([RED, BLUE], JOINERS.plain), themed)[1]!.style?.color?.name).toBe("magenta");
    expect(render(new Strip([RED, BLUE], JOINERS.plain))[1]!.style?.color?.name).toBe("bright_black");
  });
});

describe("gradientSeam", () => {
  const ramp = (steps?: number) => new CellJoiner(gradientSeam(steps), CAPS.flat);
  const FF0000 = cell(" a ", "on #ff0000");
  const BLUE00FF = cell(" b ", "on #0000ff");

  it("emits half-block cells carrying two colour samples each", () => {
    const strip = new Strip([FF0000, BLUE00FF], ramp(3));
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
    const strip = new Strip([FF0000], ramp(4));
    expect(render(strip).map((s) => s.text)).toEqual([" a "]);
  });

  it("renders empty when an item lacks an edge bgcolor", () => {
    const noBg = cell(" x ", "white");
    const strip = new Strip([FF0000, noBg], ramp(2));
    expect(render(strip).map((s) => s.text)).toEqual([" a ", " x "]);
  });

  it("ramps between the shades a theme draws its named neighbours in, in export", () => {
    const strip = new Strip([cell(" a ", "white on blue"), cell(" b ", "white on red")], ramp(2));
    const [row] = exportLines(render(strip), ATOM_ONE_DARK);
    const grounds = row!.map((run) => run.look.background as ColorRgba);
    const blue = ATOM_ONE_DARK.ansiColors.get(4);
    const red = ATOM_ONE_DARK.ansiColors.get(1);
    expect([grounds[0]!.hex, grounds.at(-1)!.hex]).toEqual(["#61afef", "#e06c75"]);
    const samples = row!.slice(1, -1).flatMap((run) => [run.look.foreground, run.look.background as ColorRgba]);
    expect(samples.map((c) => c.hex)).toEqual([1, 3, 5, 7].map((k) => blendRgb(blue, red, k / 8).hex));
  });

  it("draws nothing beside a default ground, which is no colour to ramp from", () => {
    const strip = new Strip([cell(" a ", "white on default"), cell(" b ", "white on red")], ramp(1));
    expect(render(strip).map((s) => s.text)).toEqual([" a ", " b "]);
  });

  it("ramps between translucent grounds as their cells draw them", () => {
    const strip = new Strip([cell(" a ", "white on #ffffff80"), cell(" b ", "white on #ff0000")], ramp(1));
    const [, join] = render(strip);
    const drawn = join!.style!.drawnColors();
    const seen = new ColorRgba(255, 255, 255, 128 / 255).compositeOver(new ColorRgba(0, 0, 0));
    expect([drawn.color!.value!.hex, drawn.bgcolor!.value!.hex]).toEqual(
      [0.25, 0.75].map((t) => blendRgb(seen, new ColorRgba(255, 0, 0), t).hex),
    );
  });

  it("defaults to steps=4", () => {
    const strip = new Strip([FF0000, BLUE00FF], ramp());
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
    ["JOINERS.powerline", JOINERS.powerline],
    ["JOINERS.capsule", JOINERS.capsule],
    ["JOINERS.plain", JOINERS.plain],
    ["gradientSeam(3)", new CellJoiner(gradientSeam(3), CAPS.flat)],
  ])("measures at the width it draws, not the width offered, with a %s", (_name, joiner) => {
    const strip = new Strip([RED, BLUE, GREEN], joiner);
    const { maximum } = Measurement.get(UNBOUNDED, strip);
    expect(maximum).toBe(drawnWidth(strip, UNBOUNDED));
    expect(maximum).toBeLessThan(40);
  });

  it("measures the joins it draws at the options it is measured with", () => {
    // An ASCII-only output draws the powerline set flat at the start, so the
    // lead cell is gone from the measurement too.
    const strip = new Strip([RED, BLUE], JOINERS.powerline);
    const ascii: RenderOptions = { ...UNBOUNDED, asciiOnly: true };
    expect(Measurement.get(ascii, strip).maximum).toBe(drawnWidth(strip, ascii));
    expect(Measurement.get(ascii, strip).maximum).toBe(Measurement.get(UNBOUNDED, strip).maximum - 1);
  });

  it("measures one width as both bounds, since its row never narrows", () => {
    const strip = new Strip([cell("one two", "on red"), cell("three", "on blue")], JOINERS.plain);
    expect(Measurement.get(UNBOUNDED, strip)).toEqual(new Measurement(7 + 3 + 5, 7 + 3 + 5));
  });

  it("keeps every item when a Table squeezes the column it sits in", () => {
    const strip = new Strip(
      [new RichText(" alpha beta ", { style: "on red", end: "", noWrap: true }),
        new RichText(" gamma delta ", { style: "on blue", end: "", noWrap: true })],
      JOINERS.powerline,
    );
    const table = new Table({ showHeader: false }).addRow(strip, "a long neighbour that would gladly take every column it is offered");
    expect(renderToString(table, { colorSystem: null, width: 50 })).toContain(" gamma delta ");
  });

  it("measures an empty strip as no cells, as it draws none", () => {
    expect(Measurement.get(UNBOUNDED, new Strip([], JOINERS.powerline))).toEqual(new Measurement(0, 0));
  });
});

describe("CellJoiner", () => {
  const LEFT_BG = { edge: "left", part: "bg" } as const;
  const RIGHT_BG = { edge: "right", part: "bg" } as const;
  const arrow: JoinCell = { glyph: ">", fg: LEFT_BG, bg: RIGHT_BG };
  const seamForm = (form: Partial<SeamForm> = {}): SeamForm => ({ seam: [arrow], divider: [arrow], ...form });
  const capsForm = (form: Partial<CapsForm> = {}): CapsForm => ({ lead: [], tail: [], ...form });
  // Every part named in the glyph form; the ascii form plain arrows, flat.
  const joiner = ({ lead = [], tail = [], ...seam }: Partial<SeamForm & CapsForm>) =>
    new CellJoiner({ glyph: seamForm(seam), ascii: seamForm() }, { glyph: capsForm({ lead, tail }), ascii: capsForm() });

  it("draws ground as the fg in reverse video: SGR 7, the fg the cell's bg colour, no bg", () => {
    const lead = render(new Strip([RED], JOINERS.powerline))[0]!;
    expect(lead.style?.reverse).toBe(true);
    expect(lead.style?.color?.name).toBe("red");
    expect(lead.style?.bgcolor).toBeUndefined();
    expect(renderToString(new Strip([RED], JOINERS.powerline), { colorSystem: ColorDepth.STANDARD, width: 80 })).toMatch(/^\x1b\[7;31m\ue0b0/);
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
    const j = joiner({ seam, divider: seam });
    seam.push(arrow);
    expect(render(new Strip([RED, BLUE], j)).map((s) => s.text)).toEqual([" red ", ">", " blue "]);
    expect(Object.isFrozen(JOINERS.powerline.seam.glyph.seam[0])).toBe(true);
    expect(Object.isFrozen(SEAMS.prism.glyph.seam[0])).toBe(true);
    expect(Object.isFrozen(CAPS.bubble.glyph.lead[0])).toBe(true);
  });

  it("reads which neighbours need a ground off the form it draws", () => {
    // The glyph seam names no neighbour; the ascii seam needs both grounds, so
    // in ASCII a groundless neighbour is an endpoint.
    const plain: JoinCell = { glyph: "│", fg: { role: "strip.separator" }, bg: "ground" };
    const j = new CellJoiner(
      { glyph: seamForm({ seam: [plain], divider: [plain] }), ascii: seamForm() },
      { glyph: capsForm(), ascii: capsForm({ lead: [{ glyph: "<", fg: RIGHT_BG, bg: "ground" }] }) },
    );
    const text = render(new Strip([cell("a", ""), cell("b", "on blue")], j), { ...OPTIONS, asciiOnly: true }).map((s) => s.text).join("");
    expect(text).toBe("a<b");
  });

  it("refuses a shape that is not cells, naming the part", () => {
    expect(() => new CellJoiner({ glyph: seamForm(), ascii: seamForm() }, { glyph: { tail: [] }, ascii: capsForm() } as unknown as JoinCaps)).toThrow(/glyph lead is not a list of cells/);
    expect(() => joiner({ seam: [{ ...arrow, glyph: 5 as unknown as string }] })).toThrow(/seam\[0\] has a glyph that is neither/);
    expect(() => joiner({ seam: [{ ...arrow, glyph: { oneOf: "ab" as unknown as string[] } }] })).toThrow(/seam\[0\] has a glyph that is neither/);
  });

  it("treats a neighbour as missing when any part needs its ground, not only the seam", () => {
    // The seam names no neighbour; the lead paints the right ground. A
    // groundless right item gets no lead, so no colourless reversed block.
    const bar: JoinCell = { glyph: "│", fg: { role: "strip.separator" }, bg: "ground" };
    const j = joiner({ seam: [bar], divider: [bar], lead: [{ glyph: "\ue0b0", fg: "ground", bg: RIGHT_BG }] });
    expect(render(new Strip([cell("a", "")], j)).map((s) => s.text)).toEqual(["a"]);
  });

  it("refuses an ascii form that is not ASCII", () => {
    expect(() => new CellJoiner({ glyph: seamForm(), ascii: seamForm({ seam: [{ ...arrow, glyph: "\ue0b0" }], divider: [{ ...arrow, glyph: "\ue0b0" }] }) }, CAPS.flat)).toThrow(
      /ascii seam\[0\] is not ASCII/,
    );
  });
});

describe("oneOf picks per seam", () => {
  const CHOICES = ["a", "b", "c", "d"];
  const pick: JoinCell = { glyph: { oneOf: CHOICES }, fg: { role: "strip.separator" }, bg: "ground" };
  const picks: SeamForm = { seam: [pick], divider: [pick] };
  const varied = new CellJoiner({ glyph: picks, ascii: picks }, CAPS.flat);
  // Every item the same colour, so nothing but the seam's index can tell two seams apart.
  const items = Array.from({ length: 16 }, () => cell("-", "white on red"));
  const seams = (options: RenderOptions = OPTIONS) => render(new Strip(items, varied), options).filter((s) => s.text !== "-").map((s) => s.text);

  it("varies the glyph from seam to seam between the same two colours", () => {
    const drawn = seams();
    expect(drawn).toHaveLength(15);
    expect(drawn.every((g) => CHOICES.includes(g))).toBe(true);
    expect(new Set(drawn).size).toBeGreaterThan(1);
  });

  it("picks a wrap's tail and lead independently though they share an index", () => {
    const none: SeamForm = { seam: [], divider: [] };
    const ends: CapsForm = { lead: [pick], tail: [pick] };
    const caps = new CellJoiner({ glyph: none, ascii: none }, { glyph: ends, ascii: ends });
    const differ = Array.from({ length: 16 }, (_, index) => {
      const lead = [...caps.join(null, items[0]!, { index }).render(OPTIONS)][0]!.text;
      const tail = [...caps.join(items[0]!, null, { index }).render(OPTIONS)][0]!.text;
      return lead !== tail;
    });
    expect(differ.some(Boolean)).toBe(true);
  });
});

describe("JOINERS, the bundled definitions", () => {
  const NAMES = ["powerline", "prism", "slant", "backslant", "flame", "pixel", "ice", "bubble", "capsule", "wrapper", "metro", "stitch", "torn", "plain"];
  const ASCII: RenderOptions = { ...OPTIONS, asciiOnly: true };
  const joinText = (segs: Segment[], items: readonly RichText[]): string[] => {
    const itemTexts = new Set(items.map((i) => i.plain));
    return segs.filter((s) => !itemTexts.has(s.text)).map((s) => s.text);
  };

  it("names every definition the ticket ships, and is frozen", () => {
    expect(Object.keys(JOINERS).sort()).toEqual([...NAMES].sort());
    expect(Object.isFrozen(JOINERS)).toBe(true);
  });

  it.each(NAMES)("%s draws every seam at one width, in either form", (name) => {
    const joiner = joinerNamed(name);
    const items = [RED, BLUE, GREEN, RED, BLUE, GREEN, RED];
    for (const options of [OPTIONS, ASCII]) {
      const widths = Array.from({ length: items.length - 1 }, (_, i) =>
        [...joiner.join(items[i]!, items[i + 1]!, { index: i + 1 }).render(options)].reduce((w, s) => w + s.cellLength, 0),
      );
      expect(new Set(widths).size).toBe(1);
      expect(widths[0]).toBeGreaterThan(0);
    }
    const ascii = render(new Strip(items, joiner), ASCII).map((s) => s.text).join("");
    expect(ascii).toMatch(/^[\x20-\x7e]*$/);
  });

  it.each(["powerline", "slant", "backslant", "flame", "pixel", "ice", "bubble"])("%s leads with its seam glyph reversed out of the terminal's ground", (name) => {
    const { seam, caps } = joinerNamed(name);
    expect(caps.glyph.lead).toEqual([{ glyph: (seam.glyph.seam[0] as JoinCell).glyph, fg: "ground", bg: { edge: "right", part: "bg" } }]);
    const [leadSeg] = render(new Strip([RED], joinerNamed(name)));
    expect(leadSeg!.style?.reverse).toBe(true);
    expect(leadSeg!.style?.color?.name).toBe("red");
  });

  it("prism steps through the grounds' thirds in three arrows", () => {
    const segs = joinText(render(new Strip([RED, BLUE], JOINERS.prism)), [RED, BLUE]);
    expect(segs.slice(1, 4)).toEqual(["\ue0b0", "\ue0b0", "\ue0b0"]);
    const seam = render(new Strip([RED, BLUE], JOINERS.prism)).slice(2, 5);
    expect(seam[0]!.style?.bgcolor).toEqual(seam[1]!.style?.color);
    expect(seam[1]!.style?.bgcolor).toEqual(seam[2]!.style?.color);
    expect(seam[2]!.style?.bgcolor?.name).toBe("blue");
  });

  it("wrapper and metro close and open each run over the terminal's ground", () => {
    expect(joinText(render(new Strip([RED, BLUE], JOINERS.wrapper)), [RED, BLUE])).toEqual(["\ue0b2", "\ue0b0", "\ue0b2", "\ue0b0"]);
    const metro = render(new Strip([RED, BLUE], JOINERS.metro));
    expect(joinText(metro, [RED, BLUE])).toEqual(["\ue0b6", "\ue0b4", "──", "\ue0b6", "\ue0b4"]);
    expect(metro.every((s) => s.text === " red " || s.text === " blue " || s.style?.bgcolor === undefined)).toBe(true);
  });

  it("metro's rail is the theme's strip.rail", () => {
    const theme = new Theme({ "strip.rail": "magenta" });
    const rail = render(new Strip([RED, BLUE], JOINERS.metro), { ...OPTIONS, theme }).find((s) => s.text === "──");
    expect(rail!.style?.color?.name).toBe("magenta");
  });

  it("stitch and torn sit on the grounds' midpoint and draw nothing at the ends", () => {
    for (const joiner of [JOINERS.stitch, JOINERS.torn]) {
      const segs = render(new Strip([RED, BLUE], joiner));
      expect(segs).toHaveLength(3);
      const mid = ColorSpec.blend(ColorSpec.parse("red"), ColorSpec.parse("blue"), 0.5);
      expect(segs[1]!.style?.bgcolor).toEqual(mid);
    }
  });

  it("joinerNamed reads a name from config, and refuses one the table lacks", () => {
    expect(joinerNamed("prism")).toBe(JOINERS.prism);
    for (const name of ["constructor", "toString", "__proto__", "Powerline"]) expect(() => joinerNamed(name)).toThrow(/no joiner named .*the joiners are powerline, prism/);
  });

  // #3a3f58 and #4a5070 are ΔE_OK ~.066 apart: a one-cell arrow between them
  // shows, but each of prism's arrows steps a third of that, and would not.
  const NEAR_A = cell(" a ", "white on #3a3f58");
  const NEAR_B = cell(" b ", "white on #4a5070");

  it("prism divides where its third-steps would vanish though a one-cell arrow would not", () => {
    const powerline = joinText(render(new Strip([NEAR_A, NEAR_B], JOINERS.powerline)), [NEAR_A, NEAR_B]);
    expect(powerline[1]).toBe("\ue0b0");
    const prism = joinText(render(new Strip([NEAR_A, NEAR_B], JOINERS.prism)), [NEAR_A, NEAR_B]);
    expect(prism.slice(1, 4)).toEqual([" ", "\ue0b1", " "]);
  });

  it("torn draws its divider, the tear in the left item's text, where its ink would vanish into the midpoint", () => {
    const tear = render(new Strip([NEAR_A, NEAR_A], JOINERS.torn))[1]!;
    expect(tear.style?.color?.name).toBe("white");
    expect(["\u259a\u259e", "\u259e\u259a", "\u2598\u2597", "\u259d\u2596", "\u2596\u259d", "\u2597\u2598"]).toContain(tear.text);
    expect(render(new Strip([NEAR_A, cell(" c ", "white on #a78bfa")], JOINERS.torn))[1]!.style?.color?.name).not.toBe("white");
  });

  it("prism and torn divide between two grounds of one palette slot", () => {
    const red = cell(" r ", "white on red");
    expect(joinText(render(new Strip([red, RED], JOINERS.prism)), [red, RED]).slice(1, 4)).toEqual([" ", "\ue0b1", " "]);
    expect(render(new Strip([red, RED], JOINERS.torn))[1]!.style?.color?.name).toBe("white");
  });

  it("prism keeps its arrows at sixteen colours, where one third rounds into an end but the others show", () => {
    const seam = joinText(render(new Strip([RED, BLUE], JOINERS.prism), { ...OPTIONS, colorSystem: ColorDepth.STANDARD }), [RED, BLUE]);
    expect(seam.slice(1, 4)).toEqual(["\ue0b0", "\ue0b0", "\ue0b0"]);
  });

  it("measures translucent ink composited over its own cell's ground, as drawn", () => {
    const ink: SeamForm = { seam: [{ glyph: "x", fg: { edge: "left", part: "fg" }, bg: { edge: "right", part: "bg" } }], divider: [{ glyph: "|", fg: { edge: "left", part: "fg" }, bg: { edge: "right", part: "bg" } }] };
    const j = new CellJoiner({ glyph: ink, ascii: ink }, CAPS.flat);
    const faint = cell(" a ", "#ffffff04 on #3a3f58");
    const solid = cell(" a ", "#ffffff on #3a3f58");
    const b = cell(" b ", "white on #3a3f58");
    expect(joinText(render(new Strip([faint, b], j)), [faint, b])).toEqual(["|"]);
    expect(joinText(render(new Strip([solid, b], j)), [solid, b])).toEqual(["x"]);
  });

  it("torn picks its quadrant pair per seam", () => {
    const items = Array.from({ length: 12 }, (_, i) => (i % 2 ? RED : BLUE));
    const tears = render(new Strip(items, JOINERS.torn)).filter((s) => s.text !== " red " && s.text !== " blue ").map((s) => s.text);
    expect(tears).toHaveLength(11);
    expect(new Set(tears).size).toBeGreaterThan(1);
  });
});

describe("a seam ends in any caps", () => {
  const ASCII: RenderOptions = { ...OPTIONS, asciiOnly: true };
  const LEFT_BG = { edge: "left", part: "bg" } as const;
  const cellsWidth = (cells: readonly JoinCell[]): number => cells.reduce((w, c) => w + cellLen(typeof c.glyph === "string" ? c.glyph : c.glyph.oneOf[0]!), 0);
  const drawnWidth = (joiner: CellJoiner, left: RichText | null, right: RichText | null, index: number, options: RenderOptions): number =>
    [...joiner.join(left, right, { index }).render(options)].reduce((w, s) => w + s.cellLength, 0);
  const PAIRS = (Object.keys(SEAMS) as (keyof typeof SEAMS)[]).flatMap((seam) => (Object.keys(CAPS) as (keyof typeof CAPS)[]).map((caps) => [seam, caps] as const));

  it.each(PAIRS)("%s ended in %s draws every seam at one width and its caps at the ends, in either form", (seam, caps) => {
    const joiner = joinerNamed({ seam, caps });
    const items = [RED, BLUE, GREEN, RED, BLUE];
    for (const [options, form] of [[OPTIONS, "glyph"], [ASCII, "ascii"]] as const) {
      const seams = items.slice(1).map((right, i) => drawnWidth(joiner, items[i]!, right, i + 1, options));
      // One width, which may be none: `wrapper` is the caps touching, and
      // `flat` caps are no cells, so the runs meet edge to edge.
      expect(new Set(seams).size).toBe(1);
      expect(drawnWidth(joiner, null, RED, 0, options)).toBe(cellsWidth(CAPS[caps][form].lead));
      expect(drawnWidth(joiner, BLUE, null, items.length, options)).toBe(cellsWidth(CAPS[caps][form].tail));
    }
    expect(render(new Strip(items, joiner), ASCII).map((s) => s.text).join("")).toMatch(/^[\x20-\x7e]*$/);
  });

  it("prism ended in bubble caps opens and closes in the bubble, stepping through the thirds between", () => {
    const segs = render(new Strip([RED, BLUE], joinerNamed({ seam: "prism", caps: "bubble" })));
    expect(segs.map((s) => s.text)).toEqual(["\ue0b4", " red ", "\ue0b0", "\ue0b0", "\ue0b0", " blue ", "\ue0b4"]);
    expect(segs[0]!.style?.reverse).toBe(true);
    expect(segs[0]!.style?.color?.name).toBe("red");
    expect(segs.at(-1)!.style?.color?.name).toBe("blue");
    expect(segs.at(-1)!.style?.bgcolor).toBeUndefined();
  });

  it("a seam that parts its runs ends each in the caps it is joined with", () => {
    const segs = render(new Strip([RED, BLUE], new CellJoiner(SEAMS.capsule, CAPS.powerline)));
    expect(segs.map((s) => s.text)).toEqual(["\ue0b0", " red ", "\ue0b0", " ", "\ue0b0", " blue ", "\ue0b0"]);
    const [tail, , lead] = segs.slice(2, 5);
    expect(tail!.style?.color?.name).toBe("red");
    expect(tail!.style?.bgcolor).toBeUndefined();
    expect(lead!.style?.reverse).toBe(true);
    expect(lead!.style?.color?.name).toBe("blue");
  });

  it("ends a gradient ramp in the caps it is given", () => {
    const segs = render(new Strip([cell(" a ", "on #ff0000"), cell(" b ", "on #0000ff")], new CellJoiner(gradientSeam(2), CAPS.capsule)));
    expect(segs.map((s) => s.text)).toEqual(["\ue0b6", " a ", "▌", "▌", " b ", "\ue0b4"]);
  });

  it("holds a divider to the width of its seam under every caps, when the seam is parsed", () => {
    const bar: JoinCell = { glyph: "|", fg: { role: "strip.separator" }, bg: "ground" };
    const seamOf = (seam: SeamForm): JoinSeam => ({ glyph: seam, ascii: seam });
    // As wide as the seam under one-cell tail caps, and no wider under any other.
    const widerUnderFlat = seamOf({ seam: [{ cap: "tail" }], divider: [bar] });
    expect(() => new CellJoiner(widerUnderFlat, CAPS.capsule)).toThrow(/^seam: glyph divider is not the width of the seam under every caps$/);
    const sameUnderAll = seamOf({ seam: [{ cap: "tail" }, { ...bar, glyph: " " }], divider: [{ cap: "tail" }, bar] });
    for (const caps of Object.values(CAPS)) expect(() => new CellJoiner(sameUnderAll, caps)).not.toThrow();
  });

  it("refuses a cap that is neither the lead nor the tail, or that draws cells of its own", () => {
    const seam = { seam: [{ cap: "middle" }], divider: [] } as unknown as SeamForm;
    expect(() => new CellJoiner({ glyph: seam, ascii: seam }, CAPS.flat)).toThrow(/^seam: glyph seam\[0\] names a cap that is neither lead nor tail: "middle"$/);
    const tagged = { seam: [{ cap: "lead", glyph: ">", fg: LEFT_BG, bg: "ground" }], divider: [] } as unknown as SeamForm;
    expect(() => new CellJoiner({ glyph: tagged, ascii: tagged }, CAPS.flat)).toThrow(/^seam: glyph seam\[0\] names a cap and draws cells of its own/);
  });

  it("refuses a seam or caps missing a form, naming which", () => {
    expect(() => new CellJoiner({ glyph: SEAMS.plain.glyph } as unknown as JoinSeam, CAPS.flat)).toThrow(/^seam: has no ascii form$/);
    expect(() => new CellJoiner(SEAMS.plain, { ascii: CAPS.flat.ascii } as unknown as JoinCaps)).toThrow(/^caps: has no glyph form$/);
  });

  it("draws a seam that needs no ground between items without one, whatever caps end it", () => {
    const docs = cell("docs", "#38bdf8");
    const guide = cell("guide", "#38bdf8");
    const x = cell("x", "on red");
    const text = (joiner: CellJoiner) => render(new Strip([docs, guide, x], joiner)).map((s) => s.text).join("");
    for (const caps of Object.keys(CAPS)) expect(text(joinerNamed({ seam: "plain", caps }))).toContain("docs | guide | x");
  });

  it("joinerNamed reads a seam and caps named apart, and refuses a name either table lacks", () => {
    const mixed = render(new Strip([RED, BLUE], joinerNamed({ seam: "torn", caps: "capsule" })));
    expect(mixed[0]!.text).toBe("\ue0b6");
    expect(() => joinerNamed({ seam: "prism", caps: "prism" })).toThrow(/no caps named "prism"; the caps are powerline, .*, flat/);
    expect(() => joinerNamed({ seam: "toString", caps: "flat" })).toThrow(/no seam named "toString"; the seams are powerline, prism/);
    expect(() => joinerNamed(null as unknown as JoinerSpec)).toThrow(/^a joiner is a name or \{ seam, caps \}, not null$/);
  });

  it("freezes the tables", () => {
    expect(Object.isFrozen(SEAMS)).toBe(true);
    expect(Object.isFrozen(CAPS)).toBe(true);
  });
});
