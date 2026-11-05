/**
 * Right-to-left text in a `TextInput`, on the bytes it writes and the terminals
 * `test/core/bidi-terminal.ts` models: typed, read, pressed and moved through.
 */

import { describe, expect, it } from "vitest";
import { asCodeUnit, graphemes } from "../../src/core/cells.js";
import { ColorDepth } from "../../src/core/color.js";
import { render, type RenderOptions } from "../../src/core/protocol.js";
import { segmentsToString } from "../../src/core/render.js";
import { Segment } from "../../src/core/segment.js";
import { Style } from "../../src/core/style.js";
import type { TextOrder } from "../../src/core/text-order.js";
import { cellOf } from "../../src/widgets/hit.js";
import { TextInput } from "../../src/widgets/text-input.js";
import { WidgetKeyEvent, type WidgetMouseEvent } from "../../src/widgets/types.js";
import { implicit, none, rows } from "../core/bidi-terminal.js";

const HEBREW = "אבג";
const ARABIC = "مرحبا بالعالم";

const key = (name: string, character = ""): WidgetKeyEvent =>
  new WidgetKeyEvent({ key: name, character, shift: false, ctrl: false, meta: false }, 0);

const options = (textOrder: TextOrder): RenderOptions => ({ maxWidth: 40, textOrder });

// The row a terminal of `order` shows, read by `show`.
function shown(input: TextInput, order: TextOrder, show: (row: string) => string): string {
  const bytes = segmentsToString(render(input, options(order)), { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: false, reducedMotion: false, textOrder: order });
  return show(rows(bytes)[0]!);
}

// The text of the cell the caret is drawn on, and its column, in the frame's cells.
function caret(input: TextInput, order: TextOrder): { text: string; column: number } {
  const [row] = Segment.splitLines(render(input, options(order)));
  let column = 0;
  for (const segment of row!) {
    if (segment.style?.reverse === true) return { text: segment.text, column };
    column += segment.cellLength;
  }
  throw new Error("no caret drawn");
}

function field(value = ""): TextInput {
  const input = new TextInput({ value });
  input.cursorStyleOverride = Style.parse("bold reverse");
  input.focus(0);
  return input;
}

const press = (input: TextInput, x: number, order: TextOrder): WidgetMouseEvent => {
  const frame = Segment.splitLines(render(input, options(order)));
  return { type: "mouse_down", x, y: 0, button: 0, shift: false, ctrl: false, over: true, cell: cellOf(frame, input, x, 0), time: 0 };
};

describe("TextInput with right-to-left text", () => {
  it("reads typed Arabic in order on a terminal that reorders, and on one that does not", () => {
    const typed = field();
    for (const character of ARABIC) typed.handleKey(key(character, character));
    expect(typed.value).toBe(ARABIC);
    const reading = implicit(ARABIC).normalize("NFKC");
    expect(shown(typed, "logical", implicit).normalize("NFKC")).toContain(reading);
    expect(shown(typed, "visual", none).normalize("NFKC")).toContain(reading);
  });

  it.each(["logical", "visual"] as const)("draws the caret on the glyph at the cursor under %s", (order) => {
    const input = field(HEBREW);
    input.cursorPosition = asCodeUnit(0);
    expect(caret(input, order).text).toBe("א");
    input.cursorPosition = asCodeUnit(1);
    expect(caret(input, order).text).toBe("ב");
  });

  it("draws the caret past the end on the text's left", () => {
    const input = field(HEBREW);
    input.cursorPosition = asCodeUnit(HEBREW.length);
    const end = caret(input, "visual");
    input.cursorPosition = asCodeUnit(HEBREW.length - 1);
    expect(end.column).toBeLessThan(caret(input, "visual").column);
  });

  it("puts the cursor before the glyph a press lands on", () => {
    const input = field(HEBREW);
    input.cursorPosition = asCodeUnit(2);
    const at = caret(input, "visual").column;
    input.cursorPosition = asCodeUnit(0);
    input.handleMouse(press(input, at, "visual"));
    expect(input.cursorPosition).toBe(2);
  });

  it("moves Left across the screen, so from the start of a right-to-left line it moves on through it", () => {
    const input = field(HEBREW);
    input.cursorPosition = asCodeUnit(0);
    render(input, options("visual"));
    input.handleKey(key("left"));
    expect(input.cursorPosition).toBe(1);
    input.handleKey(key("right"));
    expect(input.cursorPosition).toBe(0);
  });

  it("moves through the text as written on a terminal nothing is known of", () => {
    const input = field(HEBREW);
    input.cursorPosition = asCodeUnit(1);
    input.handleKey(key("left"));
    expect(input.cursorPosition).toBe(0);
  });

  it("orders a wrapped row at its line's direction, not its own", () => {
    const input = new TextInput({ value: "שלום hello עולם", multiline: true });
    const drawn = Segment.splitLines(render(input, { maxWidth: 11, textOrder: "visual" })).map((row) => row.map((segment) => segment.text).join(""));
    expect(drawn.some((row) => row.includes("םלוע hello"))).toBe(true);
  });

  it("moves across a line break shown on one row as the row shows it", () => {
    const input = field("abc\nאבג");
    render(input, options("visual"));
    input.cursorPosition = asCodeUnit(4);
    input.handleKey(key("right"));
    expect(input.cursorPosition).toBe(7);
  });

  it("keeps the slot past the end beside a prepended mark", () => {
    const input = field("xyzൎ");
    render(input, options("visual"));
    input.cursorPosition = asCodeUnit(4);
    input.handleKey(key("right"));
    expect(input.cursorPosition).toBe(4);
    input.handleKey(key("left"));
    expect(input.cursorPosition).toBe(3);
  });

  it("steps a word the way the screen runs beside the caret", () => {
    const input = field("see אבג דהו now");
    render(input, options("visual"));
    input.cursorPosition = asCodeUnit(9);
    const before = caret(input, "visual").column;
    input.handleKey(new WidgetKeyEvent({ key: "left", character: "", shift: false, ctrl: true, meta: false }, 0));
    expect(caret(input, "visual").column).toBeLessThan(before);
  });

  it.each([
    ["one line wider than the field's least width", "אבגדהוזחטיכל", false],
    ["a row of a multiline field", HEBREW, true],
  ])("lands a press on %s on the glyph under it", (_name, value, multiline) => {
    const input = new TextInput({ value, multiline });
    input.cursorStyleOverride = Style.parse("bold reverse");
    input.focus(0);
    for (let at = 0; at < value.length; at++) {
      input.cursorPosition = asCodeUnit(at);
      const column = caret(input, "visual").column;
      input.cursorPosition = asCodeUnit(at === 0 ? 1 : 0);
      input.handleMouse(press(input, column, "visual"));
      expect([at, input.cursorPosition]).toEqual([at, at]);
    }
  });

  it("steps right-to-left words edge by edge, the same edges each way", () => {
    const input = field("שלום עולם");
    render(input, options("visual"));
    input.cursorPosition = asCodeUnit(9);
    const ctrlKey = (name: string): WidgetKeyEvent => new WidgetKeyEvent({ key: name, character: "", shift: false, ctrl: true, meta: false }, 0);
    const visited = (name: string): number[] => [0, 1, 2].map(() => (input.handleKey(ctrlKey(name)), input.cursorPosition));
    expect(visited("right")).toEqual([5, 4, 0]);
    expect(visited("left")).toEqual([4, 5, 9]);
  });

  it("steps left-to-right words as readline does", () => {
    const input = field("see אבג now");
    render(input, options("visual"));
    input.cursorPosition = asCodeUnit(0);
    input.handleKey(new WidgetKeyEvent({ key: "right", character: "", shift: false, ctrl: true, meta: false }, 0));
    expect(input.cursorPosition).toBe(3);
  });

  it("keeps an override in its value from reaching past the field", () => {
    const input = field("‮abc");
    for (const order of ["plain", "logical", "visual"] as const) {
      const row = shown(input, order, order === "logical" ? implicit : none);
      expect(row).not.toContain("‮");
      expect(row.trimEnd().endsWith("]")).toBe(true);
    }
  });
});


// Values whose screen order is not their text's: overrides, isolates, marks,
// combining marks, a joined sequence, numbers in right-to-left text.
const BIDI_VALUES = ["אבג", "see אבג דהו now", "abc 123 אבג", "א‮abc‬ב", "⁧אב⁩cd", "א‏b‎c", "שָׁלוֹם x", "مرحبا 12 بالعالم", "a⁦שלום⁩b", "x؜אב 3.5", "👨‍👩‍👧 אב", "a‫ב‬c"];

// Every cursor stop of `value`: each glyph boundary.
function stops(value: string): number[] {
  const at = [0];
  for (const glyph of graphemes(value)) at.push(at.at(-1)! + glyph.length);
  return at;
}

const pressOn = (frame: Segment[][], input: TextInput, x: number): WidgetMouseEvent =>
  ({ type: "mouse_down", x, y: 0, button: 0, shift: false, ctrl: false, over: true, cell: cellOf(frame, input, x, 0), time: 0 });

describe("a press reads the frame it lands on", () => {
  it.each(["plain", "visual", "words"] as const)("puts the cursor on the stop whose caret the pressed cell drew, under %s, wherever the cursor went since", (order) => {
    for (const multiline of [false, true]) {
      for (const value of BIDI_VALUES) {
        const input = new TextInput({ value, multiline });
        input.cursorStyleOverride = Style.parse("bold reverse");
        input.focus(0);
        for (const stop of stops(value)) {
          input.cursorPosition = asCodeUnit(stop);
          const frame = Segment.splitLines(render(input, options(order)));
          let column = 0;
          for (const segment of frame[0]!) {
            if (segment.style?.reverse === true) break;
            column += segment.cellLength;
          }
          input.cursorPosition = asCodeUnit(stop === 0 ? value.length : 0);
          input.handleMouse(pressOn(frame, input, column));
          expect(input.cursorPosition, `${JSON.stringify(value)}, multiline ${multiline}`).toBe(stop);
        }
      }
    }
  });

  it("maps a column under logical the same before and after the cursor moves", () => {
    for (const multiline of [false, true]) {
      for (const value of BIDI_VALUES) {
        const input = new TextInput({ value, multiline });
        input.focus(0);
        for (const stop of stops(value)) {
          input.cursorPosition = asCodeUnit(stop);
          const frame = Segment.splitLines(render(input, options("logical")));
          for (let x = 0; x < Segment.getLineLength(frame[0]!); x++) {
            input.cursorPosition = asCodeUnit(stop);
            input.handleMouse(pressOn(frame, input, x));
            const unmoved = input.cursorPosition;
            input.cursorPosition = asCodeUnit(stop === 0 ? value.length : 0);
            input.handleMouse(pressOn(frame, input, x));
            expect(input.cursorPosition, `${JSON.stringify(value)} at ${x}, multiline ${multiline}`).toBe(unmoved);
          }
        }
      }
    }
  });
});
