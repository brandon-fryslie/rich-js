import { readFileSync } from "node:fs";
import xtermHeadless from "@xterm/headless";
import { describe, expect, test } from "vitest";
import { shaped } from "../../src/core/bidi.js";
import { MIRRORS } from "../../src/core/bidi-data.js";
import { cellLen, graphemes } from "../../src/core/cells.js";
import { JSONRenderable } from "../../src/core/json.js";
import { Pretty } from "../../src/core/pretty.js";
import { MarkupRegistry, renderMarkup } from "../../src/core/markup.js";
import { Console } from "../../src/core/console.js";
import { renderToString, segmentToString, segmentsToString } from "../../src/core/render.js";
import { ColorDepth, resolveOutputTarget } from "../../src/core/color.js";
import { Segment } from "../../src/core/segment.js";
import { SEPARATOR_STYLES, Strip } from "../../src/core/strip.js";
import { Style } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import type { TextOrder } from "../../src/core/text-order.js";
import { Markdown } from "../../src/renderables/markdown.js";
import { Panel } from "../../src/renderables/panel.js";
import { Rule } from "../../src/renderables/rule.js";
import { Syntax } from "../../src/renderables/syntax.js";
import { Table } from "../../src/renderables/table.js";
import { Tree } from "../../src/renderables/tree.js";
import { Columns } from "../../src/renderables/columns.js";
import { FlexStrip } from "../../src/renderables/flexStrip.js";
import { Button } from "../../src/widgets/button.js";
import { balancedControls, implicit, implicitVte, kitty, none, rows } from "./bidi-terminal.js";

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
    ["an assembly of strings", () => RichText.assemble([`${RLO}abc`, ` ${after}`])],
    ["an assembly of styled strings", () => RichText.assemble([[`${RLO}abc`, "red"], [` ${after}`, "blue"]])],
    ["a paragraph separator, a line ending like any other", () => new RichText(`${RLO}abc\u2029`).append(new RichText(` ${after}`))],
    ["a string between Texts", () => new RichText("x").append(new RichText("y")).append(`${RLO}abc`).append(new RichText(` ${after}`))],
    ["tokens", () => new RichText("").appendTokens([[`${RLO}abc`, "red"], [` ${after}`]])],
    ["a Markdown span", () => new Markdown(`**${RLO}abc** ${after}`)],
    ["Markdown inline code", () => new Markdown(`see \`${RLO}abc\` ${after}`)],
    ["a symbol in Pretty", () => new Pretty([Symbol(`${RLO}abc`), after])],
    ["a function's name in Pretty", () => new Pretty([Object.defineProperty(() => 0, "name", { value: `${RLO}abc` }), after])],
    ["a thrown message in Pretty", () => new Pretty([{ get a(): number { throw new Error(`${RLO}abc`); } }, after])],
  ];

  for (const order of ["plain", "logical", "visual", "words"] as const) {
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
    for (const textOrder of ["plain", "logical", "visual", "words"] as const) {
      const destination = { ...resolveOutputTarget(null, { isTTY: false }), textOrder };
      expect(segmentsToString([new Segment(`${RLO}abc`)], destination)).toBe("abc");
      expect(segmentToString(new Segment(`${RLO}abc`), destination)).toBe("abc");
    }
  });

  test("a row cut by a crop still closes", () => {
    const segments = [...new RichText(`${RLO}abcdefgh`, { end: "" }).render({ maxWidth: 40, textOrder: "logical" })];
    const cropped = Segment.adjustLineLength(segments, 4);
    const destination = { ...resolveOutputTarget(null, { isTTY: false }), textOrder: "logical" as const };
    const row = segmentsToString([...cropped, new Segment("after")], destination);
    expect(balancedControls(row)).toBe(true);
    expect(implicit(row).endsWith("after")).toBe(true);
  });

  test("a row reopens no more than the algorithm reads", () => {
    const deep = `${RLO.repeat(1000)}${"abcd ".repeat(20)}`;
    const [, second] = rows(plainBytes(new RichText(deep, { end: "" }), "logical", 10));
    expect(second!.match(new RegExp(RLO, "g"))).toHaveLength(125);
  });

  test("a closer that matches nothing is dropped behind any depth of embeddings", () => {
    const hostile = `${RLO.repeat(50)}abc\u2069`;
    expect(balancedControls(plainBytes(new RichText(hostile, { end: "" }), "logical"))).toBe(true);
  });

  test("inline code deletes what a code block deletes", () => {
    expect(plainBytes(new Markdown(`see \`${RLO}abc\``), "logical")).not.toContain(RLO);
  });

  test("a line too long to spread into a call still resolves", () => {
    const line = `a\u2067b\u2069${"c".repeat(200_000)}`;
    for (const order of ["logical", "visual"] as const) {
      expect(plainBytes(new RichText(line, { end: "", noWrap: true, overflow: "ignore" }), order, 80)).toContain("ccc");
    }
  });

  test("content cannot end the isolate around it", () => {
    const bytes = plainBytes(new RichText("\u2069\u202cשלום", { end: "" }), "logical");
    expect(balancedControls(bytes)).toBe(true);
  });

  test("a control after a wrap's whitespace does not make the row overfull", () => {
    const rle = "\u202b";
    const pdf = "\u202c";
    const hebrew = "\u05d0\u05d1\u05d2\u05d3";
    for (const textOrder of ["plain", "logical", "visual", "words"] as const) {
      const bytes = plainBytes(new RichText(`${rle}${hebrew} ${pdf}\u05d4\u05d5\u05d6\u05d7`, { end: "", overflow: "ellipsis" }), textOrder, 4);
      expect(bytes).not.toContain("\u2026");
    }
    const centred = rows(plainBytes(new RichText(`${rle}\u05d0\u05d1 \u05d2\u05d3 ${pdf}`, { end: "", justify: "center" }), "logical", 7))[0]!;
    expect(/^ */.exec(none(centred))![0].length).toBe(1);
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

describe("reading on kitty, which reverses right-to-left words and not lines", () => {
  const onKitty = (renderable: Parameters<typeof renderToString>[0], width = 40): string[] => rows(plainBytes(renderable, "words", width)).map(kitty);
  const visually = (renderable: Parameters<typeof renderToString>[0], width = 40): string[] => rows(plainBytes(renderable, "visual", width));

  test.each([
    ["an Arabic sentence", ARABIC],
    ["a Hebrew sentence", HEBREW],
    ["brackets in a right-to-left word", "(שלום) [עולם]"],
    ["a Latin word in a right-to-left line", `${HEBREW} abc ${HEBREW}`],
    ["a right-to-left word in a left-to-right line", `abc ${HEBREW} def`],
  ])("shows %s as visual order shows it", (_name, line) => {
    expect(onKitty(new RichText(line, { end: "" })).map(read)).toEqual(visually(new RichText(line, { end: "" })).map(read));
  });

  test("writes each word's letters in the order kitty turns back", () => {
    const [row] = rows(plainBytes(new RichText(HEBREW, { end: "" }), "words"));
    expect(row).toBe("עולם שלום");
  });

  test("shows a wrapped table of right-to-left cells as visual order does", () => {
    const table = new Table({ showHeader: false });
    table.addRow(HEBREW, ARABIC);
    expect(onKitty(table).map(read)).toEqual(visually(table).map(read));
  });

  test("writes styled text with nothing to turn back as it writes it in plain order", () => {
    const styled = (textOrder: TextOrder): string => renderToString(renderMarkup("[bold red]hello world[/]"), { width: 40, textOrder });
    expect(styled("words")).toBe(styled("plain"));
  });

  test("turns back each face of a word apart, as kitty shapes each face alone", () => {
    const [row] = rows(renderToString(renderMarkup("[bold]של[/]ום עולם"), { width: 40, textOrder: "words", colorSystem: "none" }));
    expect(row!.trimEnd()).toBe("עולם וםשל");
  });

  test("ends a run at a box-drawing cell, where kitty ends one", () => {
    const line = new RichText(HEBREW.replace(" ", "─"), { end: "" });
    expect(onKitty(line)).toEqual(visually(line));
  });

  test("keeps each segment's edges, so a joiner at one is judged as in every order", () => {
    const style = Style.parse("bold");
    const bytes = (textOrder: TextOrder): string =>
      segmentsToString([new Segment("\u{1f468}‍", style), new Segment("\u{1f469}", style)], { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: false, isTerminal: false, reducedMotion: false, textOrder });
    expect(bytes("words")).toBe(bytes("plain"));
  });

  // Shaped forms show as written under any shaper, and stay shaped in an export.
  test("sends kitty the joined forms a row is laid out in", () => {
    expect(plainBytes(new RichText(ARABIC, { end: "" }), "words")).toMatch(/[ﭐ-﷿ﹰ-﻿]/);
  });

  test("keeps a style on the cell it was laid out in, which kitty does not move", () => {
    const bytes = renderToString(renderMarkup("[red]א[/]ב"), { width: 10, textOrder: "words", colorSystem: "ansi" });
    expect(bytes).toMatch(/^א\x1b\[31mב/);
  });

  test("ends a run at an emoji, which kitty draws from its own font", () => {
    expect(plainBytes(new RichText("אב😀גד", { end: "" }), "words")).toBe("גד😀אב");
  });

  test("leaves a cell no row ordered as it was given, for kitty to reverse as it does", () => {
    expect(segmentsToString([new Segment(HEBREW)], { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: false, isTerminal: false, reducedMotion: false, textOrder: "words" })).toBe(HEBREW);
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

  test("a span edge inside a cluster leaves it whole, so a mark stays on its letter", () => {
    const text = new RichText("\u05d0\u05b0\u05d1", { end: "" }).stylize("bold", 1, 2);
    const shown = [...text.render({ maxWidth: 40, textOrder: "visual" })].map((segment) => segment.text).join("");
    expect(shown).toBe("\u05d1\u05d0\u05b0");
  });

  test("a wrapped right-to-left row starts at its edge, and pads to the width", () => {
    const sentence = "\u05d0\u05d1\u05d2 \u05d3\u05d4\u05d5 \u05d6";
    const shown = rows(plainBytes(new RichText(sentence, { end: "" }), "visual", 5));
    expect(shown[0]!.startsWith(" ")).toBe(false);
    expect(implicit(rows(plainBytes(new RichText(sentence, { end: "" }), "logical", 5))[0]!).startsWith(" ")).toBe(false);
    const padded = rows(plainBytes(new RichText(sentence, { end: "", justify: "left" }), "visual", 5));
    expect(cellLen(padded[0]!)).toBe(5);
  });

  test("the last row keeps the spaces the author wrote", () => {
    expect(plainBytes(new RichText("\u05d0\u05d1 ", { end: "" }), "visual")).toBe(" \u05d1\u05d0");
  });

  test("a Text's edge is a cell it draws, never a control", () => {
    const options = (textOrder: TextOrder) => ({ maxWidth: 40, textOrder });
    for (const order of ["plain", "logical", "visual", "words"] as const) {
      const held = new RichText("\u2067\u05d0\u05d1\u2069").stylize("on red", 1, 3);
      expect(held.edgeStyle("left", options(order)).bgcolor?.name).toBe("red");
      expect(held.edgeStyle("right", options(order)).bgcolor?.name).toBe("red");
    }
  });

  test("a Text's edges are the cells it draws at them", () => {
    const options = (textOrder: TextOrder) => ({ maxWidth: 40, textOrder });
    const rtl = new RichText("\u05d0\u05d1", { end: "" }).stylize("on red", 0, 1);
    expect(rtl.edgeStyle("right", options("visual")).bgcolor?.name).toBe("red");
    expect(rtl.edgeStyle("left", options("visual")).bgcolor).toBeUndefined();
    expect(rtl.edgeStyle("left", options("plain")).bgcolor?.name).toBe("red");
    // The left edge of a right-to-left row holding a Latin word is neither end of the text.
    const mixed = new RichText("\u05d0\u05d1 abc", { end: "" }).stylize("on red", 3, 4);
    expect(mixed.edgeStyle("left", options("logical")).bgcolor?.name).toBe("red");
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
      (["plain", "logical", "visual", "words"] as const).map((order) => cellLen(rows(plainBytes(new RichText(text, { end: "" }), order, 60)).join("")));
    for (const text of [ARABIC, HEBREW, "لا إله إلا الله", "مَرْحَبًا", "سلام 👨\u200d👩\u200d👧 عليكم"]) {
      expect(new Set(widths(text)).size).toBe(1);
    }
  });
});

describe("a paragraph starts at its own edge", () => {
  const SENTENCE = "مرحبا بالعالم هذا نص";
  const laidOut = ["logical", "visual", "words"] as const;
  const shownBy = { logical: implicit, visual: none, words: kitty } as const;
  const shown = (renderable: Parameters<typeof renderToString>[0], order: (typeof laidOut)[number], width: number): string[] =>
    rows(plainBytes(renderable, order, width)).map(shownBy[order]);
  /** Where a drawn row's padding stands: the side its text is not on. */
  const padded = (row: string): "left" | "right" | "none" =>
    row.startsWith(" ") ? "left" : row.endsWith(" ") ? "right" : "none";

  test.each(laidOut)("a wrapped right-to-left paragraph is ragged on its left, under %s", (order) => {
    const lines = shown(new RichText(SENTENCE, { end: "", justify: "default" }), order, 12);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(cellLen(line)).toBe(12);
      expect(padded(line)).not.toBe("right");
    }
  });

  test("the ticket's console prints every row against the right edge", () => {
    const recording = new Console({ width: 12, textOrder: "visual", record: true, colorSystem: null, file: { write: () => true } });
    recording.print(new RichText(SENTENCE));
    for (const line of recording.exportText().split("\n").filter((row) => row !== "")) {
      expect(cellLen(line)).toBe(12);
      expect(line.endsWith(" ")).toBe(false);
    }
  });

  test.each(laidOut)("an explicit left or right still means that edge, under %s", (order) => {
    expect(padded(shown(new RichText(HEBREW, { end: "", justify: "left" }), order, 20)[0]!)).toBe("right");
    expect(padded(shown(new RichText(HEBREW, { end: "", justify: "right" }), order, 20)[0]!)).toBe("left");
    expect(padded(shown(new RichText("abc", { end: "", justify: "right" }), order, 20)[0]!)).toBe("left");
  });

  test.each(laidOut)("start is the left edge of a left-to-right paragraph and the right of a stated rtl one, under %s", (order) => {
    expect(padded(shown(new RichText("abc", { end: "", justify: "start" }), order, 20)[0]!)).toBe("right");
    expect(padded(shown(new RichText("abc", { end: "", justify: "start", direction: "rtl" }), order, 20)[0]!)).toBe("left");
    // At the default edge, a left-to-right line is still left at its natural width.
    expect(shown(new RichText("abc", { end: "", justify: "default" }), order, 20)[0]).toBe("abc");
  });

  test("each line of a text takes its own paragraph's edge", () => {
    const lines = shown(new RichText(`abc\n${HEBREW}`, { end: "", justify: "default" }), "visual", 20);
    expect(lines[0]).toBe("abc");
    expect(padded(lines[1]!)).toBe("left");
  });

  test.each(laidOut)("a Table cell of right-to-left text is placed at the cell's right, a Latin one at its left, under %s", (order) => {
    const table = new Table({ showHeader: false, box: undefined, showEdge: false, padding: 0 });
    table.addColumn("", { width: 12 });
    table.addRow(HEBREW);
    table.addRow("abc");
    const [hebrew, latin] = shown(table, order, 40).filter((row) => row.trim() !== "");
    expect(padded(hebrew!)).toBe("left");
    expect(padded(latin!)).toBe("right");
  });

  test("a Markdown paragraph in Arabic stands at the right edge", () => {
    const [row] = shown(new Markdown(ARABIC), "visual", 30).filter((line) => line.trim() !== "");
    expect(padded(row!)).toBe("left");
  });

  test("plain writes logical order, whose start is the line's first character: today's bytes", () => {
    const table = new Table({ showHeader: false, box: undefined, showEdge: false, padding: 0 });
    table.addColumn("", { width: 12 });
    table.addRow(HEBREW);
    expect(plainBytes(table, "plain").split("\n")[0]).toBe(`${HEBREW}   `);
  });

  // Absent, justify places nothing, so what sets a line down at its natural
  // width keeps it there whatever the script and the order.
  test.each(laidOut)("unjustified, a right-to-left line keeps its natural width, under %s", (order) => {
    expect(plainBytes(new RichText(HEBREW, { end: "" }), order, 30)).toBe(plainBytes(new RichText(HEBREW, { end: "" }), order, cellLen(HEBREW)));
  });

  test("a Strip item in Hebrew takes its own cells, not the row", () => {
    const strip = new Strip([new RichText("שלום"), new RichText("x")], SEPARATOR_STYLES.powerline);
    expect(cellLen(rows(plainBytes(strip, "visual", 20))[0]!.trimEnd())).toBe(cellLen(rows(plainBytes(strip, "plain", 20))[0]!.trimEnd()));
  });

  test("a soft-wrapped print of Hebrew is not padded", () => {
    const recording = new Console({ width: 20, textOrder: "visual", record: true, colorSystem: null, file: { write: () => true } });
    recording.print(new RichText("שלום"), { softWrap: true });
    expect(recording.exportText()).toBe("םולש\n");
  });

  test("a Hebrew comment in Syntax is its own cells, not set against the block's right edge", () => {
    const [, comment] = rows(plainBytes(new Syntax("def f():\n    # שלום\n    return 1", "python"), "visual", 30));
    expect(comment).toBe("םולש #    ");
  });

  const printed = (renderable: Parameters<Console["print"]>[0], width: number): string[] => {
    const recording = new Console({ width, textOrder: "visual", record: true, colorSystem: null, file: { write: () => true } });
    recording.print(renderable);
    return recording.exportText().split("\n").filter((row) => row !== "");
  };

  test("print sets its own text at the paragraph's edge, and hands a container no justify", () => {
    expect(printed(new FlexStrip([new RichText("שלום"), new RichText("abc"), new RichText("עולם")]), 30).map(cellLen)).toEqual([4, 3, 4]);
    const tree = new Tree("root");
    tree.add("שלום");
    expect(printed(tree, 30)[1]).toBe("└── םולש");
  });

  test.each(laidOut)("the last row of a full right-to-left paragraph starts at its right, under %s", (order) => {
    const lines = shown(new RichText(SENTENCE, { end: "", justify: "full" }), order, 12);
    expect(padded(lines.at(-1)!)).toBe("left");
  });

  test("unjustified, a stated right-to-left line is its isolate and nothing more", () => {
    expect(plainBytes(new RichText("abc", { end: "", direction: "rtl" }), "logical", 20)).toBe("⁧abc⁩");
  });

  test("a leading RLM decides the edge under visual, as it decides the order", () => {
    const [row] = rows(plainBytes(new RichText("\u200Fhello", { end: "", justify: "start" }), "visual", 20));
    expect(padded(row!)).toBe("left");
  });
});

describe("shaping, against an implementation of its own", () => {
  const golden = readFileSync(new URL("./arabic-shaping.golden.txt", import.meta.url), "utf-8").trimEnd().split("\n");
  const decoded = (hex: string): string => String.fromCodePoint(...hex.split(" ").map((code) => parseInt(code, 16)));

  test.each(golden)("%s", (row) => {
    const [source, forms] = row.split(";") as [string, string];
    expect(shaped(graphemes(decoded(source))).join("")).toBe(decoded(forms));
  });

  test("a ZWJ joins across it: the letter before takes its connecting form", () => {
    expect(shaped(["\u0647\u200d", " "])).toEqual(["\ufeeb", " "]);
    expect(shaped(["\u0627\u200d", "\u0628"])).toEqual(["\ufe8d", "\ufe90"]);
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
  const destination = { ...resolveOutputTarget(null, { isTTY: false }), textOrder: "logical" as const };
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

describe("values with no text of their own", () => {
  test("a class whose name is no string still prints", () => {
    class Named {
      static name = 7;
    }
    expect(plainBytes(new Pretty(Named), "plain")).toContain("[Function: 7]");
  });

  test("JSON with no form of a value draws a blank line", () => {
    expect(plainBytes(JSONRenderable.fromData(undefined), "plain")).toBe("\n");
    expect(plainBytes(JSONRenderable.fromData(() => 1), "plain")).toBe("\n");
  });
});

describe("views of data and code", () => {
  const key = `${RLO}name`;

  test("printJson's bytes stay JSON, in every order, and show the control", () => {
    for (const textOrder of ["plain", "logical", "visual", "words"] as const) {
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
