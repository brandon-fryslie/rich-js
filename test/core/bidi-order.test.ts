import { readFileSync } from "node:fs";
import xtermHeadless from "@xterm/headless";
import { describe, expect, test } from "vitest";
import { shaped } from "../../src/core/bidi.js";
import { MIRRORS } from "../../src/core/bidi-data.js";
import { cellLen, graphemes } from "../../src/core/cells.js";
import { JSONRenderable } from "../../src/core/json.js";
import { MarkupRegistry, renderMarkup } from "../../src/core/markup.js";
import { Console } from "../../src/core/console.js";
import { renderToString, segmentToString, segmentsToString } from "../../src/core/render.js";
import { resolveDestination } from "../../src/core/color.js";
import { Segment } from "../../src/core/segment.js";
import { RichText } from "../../src/core/text.js";
import type { TextOrder } from "../../src/core/text-order.js";
import { Panel } from "../../src/renderables/panel.js";
import { Rule } from "../../src/renderables/rule.js";
import { Syntax } from "../../src/renderables/syntax.js";
import { Table } from "../../src/renderables/table.js";
import { Tree } from "../../src/renderables/tree.js";
import { Columns } from "../../src/renderables/columns.js";
import { Button } from "../../src/widgets/button.js";
import { balancedControls, implicit, implicitVte, none, rows } from "./bidi-terminal.js";

const RLO = "\u202e";
const ARABIC = "مرحبا بالعالم";
const HEBREW = "שלום עולם";
const plainBytes = (renderable: Parameters<typeof renderToString>[0], textOrder: TextOrder, width = 40): string =>
  renderToString(renderable, { width, textOrder, colorSystem: "none" });

/** The reading the eye gets: presentation forms folded to the letters they show. */
const read = (row: string): string => row.normalize("NFKC");

describe("containment: an unclosed override reverses nothing after its Text", () => {
  const hostile = (): RichText => new RichText(`${RLO}abc`, { end: "" });
  const after = "after";

  /** Whether `after`, drawn behind the hostile Text on one row, still reads forwards on `show`. */
  const holds = (bytes: string, show: (row: string) => string): boolean =>
    rows(bytes).every((row) => balancedControls(row)) && rows(bytes).some((row) => show(row).includes(after));

  const shapes: readonly (readonly [string, () => Parameters<typeof renderToString>[0]])[] = [
    ["a Table row", () => {
      const table = new Table();
      table.addColumn("a");
      table.addColumn("b");
      table.addRow(hostile(), after);
      return table;
    }],
    ["a Panel title", () => new Panel(after, { title: hostile(), subtitle: after })],
    ["a Panel accessory", () => new Panel(after, { bottomRightAccessory: `${RLO}abc`, subtitle: after })],
    ["a Rule title", () => new Rule(new RichText(`${RLO}abc`).append(new RichText(` ${after}`)))],
    ["a Tree label", () => new Tree(hostile()).add(after)],
    ["a Columns item", () => new Columns([hostile(), after])],
    ["joined Texts", () => new RichText("Name: ").append(new RichText(`${RLO}abc`)).append(new RichText(` ${after}`))],
    ["an assembly", () => RichText.assemble([new RichText(`${RLO}abc`), new RichText(` ${after}`)])],
  ];

  for (const order of ["plain", "logical", "visual"] as const) {
    test.each(shapes)(`${order}: %s`, (_name, make) => {
      const bytes = plainBytes(make(), order);
      expect(holds(bytes, order === "logical" ? implicit : none)).toBe(true);
    });
  }

  test("two print arguments are two contents", () => {
    const written: string[] = [];
    const console_ = new Console({
      textOrder: "logical",
      colorSystem: null,
      environment: { env: {}, stdout: { write: (chunk: string | Uint8Array) => void written.push(String(chunk)), isTTY: false, columns: 40, rows: 10 }, stderr: { write: () => undefined, isTTY: false, columns: 40, rows: 10 } } as never,
    });
    console_.print(`${RLO}abc`, "after");
    const [row] = rows(written.join(""));
    expect(balancedControls(row!)).toBe(true);
    expect(implicit(row!)).toContain("after");
  });

  test("a raw segment is contained, in every order", () => {
    for (const textOrder of ["plain", "logical", "visual"] as const) {
      const destination = { ...resolveDestination(null, { isTTY: false }), textOrder };
      expect(segmentsToString([new Segment(`${RLO}abc`)], destination)).toBe("abc");
      expect(segmentToString(new Segment(`${RLO}abc`), destination)).toBe("abc");
    }
  });

  test("a row cut by a crop still closes", () => {
    const segments = [...new RichText(`${RLO}abcdefgh`, { end: "" }).render({ maxWidth: 40, textOrder: "logical" })];
    const cropped = Segment.adjustLineLength(segments, 4);
    const destination = { ...resolveDestination(null, { isTTY: false }), textOrder: "logical" as const };
    const row = segmentsToString([...cropped, new Segment("after")], destination);
    expect(balancedControls(row)).toBe(true);
    expect(implicit(row).endsWith("after")).toBe(true);
  });

  test("content cannot end the isolate around it", () => {
    const bytes = plainBytes(new RichText("\u2069\u202cשלום", { end: "" }), "logical");
    expect(balancedControls(bytes)).toBe(true);
  });

  test("a wrapped override opens again on the next row, and closes on each", () => {
    const bytes = plainBytes(new RichText(`${RLO}abcd efgh`, { end: "" }), "logical", 5);
    const [first, second] = rows(bytes);
    expect(balancedControls(first!)).toBe(true);
    expect(balancedControls(second!)).toBe(true);
    expect(second).toContain(RLO);
  });

  test("text content keeps no control in a file", () => {
    const written: string[] = [];
    const stream = { write: (chunk: string | Uint8Array) => void written.push(String(chunk)), isTTY: false, columns: 40, rows: 10 };
    const recording = new Console({ record: true, textOrder: "logical", colorSystem: null, environment: { env: {}, stdout: stream, stderr: stream } as never });
    recording.print(`${RLO}abc`);
    expect(recording.exportText()).toBe("abc\n");
  });
});

describe("plain is today's bytes", () => {
  test("nothing is added to right-to-left text", () => {
    expect(plainBytes(new RichText(ARABIC, { end: "" }), "plain")).toBe(ARABIC);
    expect(plainBytes(new RichText(HEBREW, { end: "" }), "plain")).toBe(HEBREW);
  });

  test("a control between spaces is no word, in wrapping or in measure", () => {
    const text = (): RichText => new RichText(`aaaaa ${RLO} bbb`, { end: "" });
    expect(plainBytes(text(), "plain", 5)).toBe(plainBytes(new RichText("aaaaa  bbb", { end: "" }), "plain", 5));
    expect(text().measure({ maxWidth: 40 })).toEqual(new RichText("aaaaa  bbb").measure({ maxWidth: 40 }));
  });

  test("an LTR line's bytes do not change with order", () => {
    const text = (): RichText => new RichText("plain (ascii), 123", { justify: "center", style: "on blue" });
    const bytes = (textOrder: TextOrder): string => renderToString(text(), { width: 30, textOrder, colorSystem: "truecolor" });
    expect(bytes("logical")).toBe(bytes("plain"));
    expect(bytes("visual")).toBe(bytes("plain"));
  });
});

describe("reading on a terminal that reorders", () => {
  test("Arabic in a Text and in a Table cell, under logical", () => {
    const bytes = plainBytes(new RichText(ARABIC, { end: "" }), "logical");
    expect(rows(bytes).map(implicit)).toEqual([[...ARABIC].reverse().join("")]);
  });

  test("two adjacent right-to-left cells stay in their columns", () => {
    const table = new Table();
    table.addColumn("a");
    table.addColumn("b");
    table.addRow("אב", "גד");
    for (const show of [implicit, implicitVte]) {
      const row = rows(plainBytes(table, "logical")).map(show).find((shown) => shown.includes("א"))!;
      expect(row.indexOf("א")).toBeLessThan(row.indexOf("ד"));
    }
  });

  test("without isolates, the cells swap: what logical is for", () => {
    const table = new Table();
    table.addColumn("a");
    table.addColumn("b");
    table.addRow("אב", "גד");
    const row = rows(plainBytes(table, "plain")).map(implicit).find((shown) => shown.includes("א"))!;
    expect(row.indexOf("א")).toBeGreaterThan(row.indexOf("ד"));
  });

  test("at column 0 VTE discards the initiator, so a sentence's full stop is where it is today", () => {
    const bytes = plainBytes(new RichText("שלום.", { end: "" }), "logical");
    expect(implicit(rows(bytes)[0]!)).toBe(".םולש");
    expect(implicitVte(rows(bytes)[0]!)).toBe("םולש.");
  });

  test("a mixed line wrapped at a neutral: a terminal cannot see the paragraph", () => {
    const line = "abc مر, عل def";
    const logical = rows(plainBytes(new RichText(line, { end: "" }), "logical", 7)).map(implicit);
    const visual = rows(plainBytes(new RichText(line, { end: "" }), "visual", 7)).map((row) => read(row));
    expect(logical[0]).not.toBe(visual[0]);
  });

  test("a mixed line wrapped before numbers: a terminal cannot see the paragraph", () => {
    const line = "abc مر 12 34 def";
    const logical = rows(plainBytes(new RichText(line, { end: "" }), "logical", 7)).map(implicit);
    const visual = rows(plainBytes(new RichText(line, { end: "" }), "visual", 7)).map((row) => read(row));
    expect(logical[1]).not.toBe(visual[1]);
  });
});

describe("reading on a terminal that does not reorder", () => {
  test("visual order is what a reordering terminal shows, and needs no controls", () => {
    const bytes = plainBytes(new RichText(ARABIC, { end: "" }), "visual");
    expect(bytes).not.toMatch(/[\u202a-\u202e\u2066-\u2069]/);
    expect(read(bytes)).toBe(read(implicit(ARABIC)));
  });

  test("Hebrew, wrapped: each row reads from its own right edge, first words first", () => {
    const shown = rows(plainBytes(new RichText("אב גד הו", { end: "" }), "visual", 5)).map(none);
    expect(shown[0]!.trimEnd()).toBe("דג בא");
    expect(shown[1]!.trimEnd()).toBe("וה");
  });

  test("truncation keeps the start of the sentence, which is its right side", () => {
    const shown = plainBytes(new RichText("אבגדהו", { end: "", overflow: "ellipsis", noWrap: true }), "visual", 4);
    expect(shown).toBe("…גבא");
  });

  test("a Table cell's right-to-left text stays inside its borders", () => {
    const table = new Table();
    table.addColumn("name");
    table.addRow(HEBREW);
    const bytes = plainBytes(table, "visual");
    expect(rows(bytes).join("\n")).toContain([...HEBREW].reverse().join(""));
  });

  test("a mixed line keeps the left-to-right word forwards", () => {
    expect(plainBytes(new RichText("אב abc גד", { end: "" }), "visual")).toBe("דג abc בא");
  });

  test("L4: brackets mirror in a right-to-left run", () => {
    expect(plainBytes(new RichText("א (ב) «ג» <ד>", { end: "" }), "visual")).toBe("<ד> «ג» (ב) א");
  });

  test("the mirror table is an involution over the engine's own Bidi_Mirrored", () => {
    const mirrors = new Map(MIRRORS);
    for (const [from, to] of MIRRORS) {
      expect(String.fromCodePoint(from)).toMatch(/\p{Bidi_Mirrored}/u);
      if (mirrors.has(to) && mirrors.get(to) !== from) {
        // Unicode's few one-way "best fit" rows are marked as such; none may cycle back to another character.
        expect(mirrors.get(mirrors.get(to)!)).toBe(to);
      }
    }
  });

  test("a line's cells do not change with order, a joiner emoji included", () => {
    const widths = (text: string): number[] =>
      (["plain", "logical", "visual"] as const).map((order) => cellLen(rows(plainBytes(new RichText(text, { end: "" }), order, 60)).join("")));
    for (const text of [ARABIC, HEBREW, "لا إله إلا الله", "مَرْحَبًا", "سلام 👨\u200d👩\u200d👧 عليكم"]) {
      expect(new Set(widths(text)).size).toBe(1);
    }
  });
});

describe("shaping, against an implementation of its own", () => {
  const golden = readFileSync(new URL("./arabic-shaping.golden.txt", import.meta.url), "utf-8").trimEnd().split("\n");
  const decoded = (hex: string): string => String.fromCodePoint(...hex.split(" ").map((code) => parseInt(code, 16)));

  test.each(golden)("%s", (row) => {
    const [source, forms] = row.split(";") as [string, string];
    expect(shaped(graphemes(decoded(source))).join("")).toBe(decoded(forms));
  });

  test("a joiner goes where forms carry it, and stays in an emoji", () => {
    expect(shaped(graphemes("ب\u200cب")).join("")).toBe("ﺏﺏ");
    const family = "👨\u200d👩\u200d👧";
    expect(shaped(graphemes(family)).join("")).toBe(family);
  });
});

describe("the grid on a real emulator", () => {
  const { Terminal } = xtermHeadless;
  const cursorAfter = (bytes: string): Promise<number> =>
    new Promise((resolve) => {
      const terminal = new Terminal({ cols: 80, rows: 5, allowProposedApi: true });
      terminal.write(bytes, () => {
        resolve(terminal.buffer.active.cursorX);
        terminal.dispose();
      });
    });

  const text = (content: string, textOrder: TextOrder): string => plainBytes(new RichText(content, { end: "" }), textOrder, 80);

  test.each([ARABIC, HEBREW, "مَرْحَبًا", "در این باغ گل", "ﺑﺎ"])("%s advances by its cells, plain and visual", async (content) => {
    for (const order of ["plain", "visual"] as const) {
      const bytes = text(content, order);
      expect(await cursorAfter(bytes)).toBe(cellLen(bytes));
    }
  });

  test("a Table row lands where it was measured, in visual", async () => {
    const table = new Table();
    table.addColumn("a");
    table.addColumn("b");
    table.addRow(ARABIC, HEBREW);
    const row = plainBytes(table, "visual", 60).split("\n").find((line) => line.includes("│") || line.includes("┃"))!;
    expect(await cursorAfter(row)).toBe(cellLen(row));
  });

  test("logical bytes advance further here, which is why xterm.js is not on the logical list", async () => {
    const bytes = text(HEBREW, "logical");
    expect(await cursorAfter(bytes)).toBeGreaterThan(cellLen(bytes));
  });
});

describe("crops and splices, below every drawing", () => {
  const destination = { ...resolveDestination(null, { isTTY: false }), textOrder: "logical" as const };
  const logicalRow = (content: string): Segment[] => [...new RichText(content, { end: "" }).render({ maxWidth: 40, textOrder: "logical" })];

  test("two cells merged side by side are two isolates", () => {
    const lines = (content: string): Segment[][] => [logicalRow(content)];
    const merged = [...Segment.mergeHorizontal([{ lines: lines("אב"), width: 2 }, { lines: lines("גד"), width: 2 }], 1)];
    const row = segmentsToString(merged, destination).split("\n")[0]!;
    expect(balancedControls(row)).toBe(true);
    expect(implicit(row).indexOf("א")).toBeLessThan(implicit(row).indexOf("ד"));
  });

  test("an overlay spliced into a row stands outside both halves", () => {
    const row = logicalRow("אבגדהו");
    const [left, right] = Segment.divide(row, [3]);
    const spliced = segmentsToString([...left!, new Segment("[menu]"), ...right!], destination);
    expect(balancedControls(spliced)).toBe(true);
    expect(implicit(spliced)).toContain("[menu]");
    expect(implicit(spliced).indexOf("[menu]")).toBeGreaterThan(0);
  });

  test("a markup handler's output is its own content", () => {
    const tags = new MarkupRegistry();
    tags.register("raw", () => new RichText(`${RLO}abc`));
    const bytes = plainBytes(renderMarkup("[raw]x[/raw] after", { registry: tags }), "logical");
    expect(balancedControls(bytes)).toBe(true);
    expect(implicit(rows(bytes)[0]!)).toContain("after");
  });

});

describe("views of data and code", () => {
  const key = `${RLO}name`;

  test("printJson's bytes stay JSON, in every order, and show the control", () => {
    for (const textOrder of ["plain", "logical", "visual"] as const) {
      const written = plainBytes(JSONRenderable.fromData({ [key]: "value" }, { indent: 0 } as never), textOrder, 200);
      expect(JSON.parse(written)).toEqual({ [key]: "value" });
      expect(written).toContain("\\u202e");
    }
  });

  test("piped Arabic JSON parses", () => {
    expect(JSON.parse(plainBytes(JSONRenderable.fromData({ a: ARABIC }), "plain", 200))).toEqual({ a: ARABIC });
  });

  test("Syntax writes no control held in code", () => {
    const bytes = plainBytes(new Syntax(`if (x${RLO}) {}`, "typescript" as never), "logical", 40);
    expect(bytes).not.toContain(RLO);
  });
});

describe("a widget's frame stays put", () => {
  test("a Button mirrors its label's run, never its brackets", () => {
    const bytes = (textOrder: TextOrder): string =>
      plainBytes(new Button({ label: "אב" }) as never, textOrder);
    expect(bytes("visual").trim()).toBe("בא");
  });
});
