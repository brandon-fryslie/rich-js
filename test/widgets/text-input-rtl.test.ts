/**
 * Right-to-left text in a `TextInput`, on the bytes it writes and the terminals
 * `test/core/bidi-terminal.ts` models: typed, read, pressed and moved through.
 */

import { describe, expect, it } from "vitest";
import { asCodePoint, asCodeUnit, cellLen, graphemes } from "../../src/core/cells.js";
import { ColorDepth } from "../../src/core/color.js";
import { render, type RenderOptions } from "../../src/core/protocol.js";
import { segmentsToString } from "../../src/core/render.js";
import { Segment } from "../../src/core/segment.js";
import { Style } from "../../src/core/style.js";
import type { TextOrder } from "../../src/core/text-order.js";
import { shownWritten } from "../../src/core/seal.js";
import { cellOf } from "../../src/widgets/hit.js";
import { TextInput } from "../../src/widgets/text-input.js";
import { Panel } from "../../src/renderables/panel.js";
import { Columns } from "../../src/renderables/columns.js";
import { RichText } from "../../src/core/text.js";
import { DefaultFocusManager } from "../../src/widgets/focus-manager.js";
import { EventRouter } from "../../src/widgets/event-router.js";
import { parserFor } from "./feed.js";
import { WidgetKeyEvent, type WidgetMouseEvent } from "../../src/widgets/types.js";
import { implicit, none, rows } from "../core/bidi-terminal.js";
import { lineLevels, paragraph, visualOrder } from "../../src/core/bidi.js";


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
    // Shown "abc⏎" then the end beside ג, then "גבא": from א, the rightmost
    // cell, Left walks the run to the end.
    const input = field("abc\nאבג");
    render(input, options("visual"));
    input.cursorPosition = asCodeUnit(4);
    for (const to of [5, 6, 7]) {
      input.handleKey(key("left"));
      expect(input.cursorPosition).toBe(to);
    }
    input.handleKey(key("left"));
    expect(input.cursorPosition).toBe(3);
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
  it("lands a press past a wrapped right-to-left row's cells on the stop shown beside it, under logical as under visual", () => {
    const landed = (order: TextOrder): number => {
      const input = new TextInput({ value: "אבגדהו", multiline: true, wrap: () => [{ start: asCodePoint(0), end: asCodePoint(3) }, { start: asCodePoint(3), end: asCodePoint(6) }] });
      input.focus(0);
      input.cursorPosition = asCodeUnit(6);
      const frame = Segment.splitLines(render(input, { maxWidth: 8, textOrder: order }));
      input.handleMouse(pressOn(frame, input, 7));
      return input.cursorPosition;
    };
    expect(landed("logical")).toBe(landed("visual"));
  });

  it.each(["plain", "logical", "visual", "words"] as const)("puts the cursor on the stop whose caret the pressed cell drew, under %s, wherever the cursor went since", (order) => {
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

// Where the caret is drawn in `frame`: its row and column, or nothing.
function caretIn(frame: readonly Segment[][]): { x: number; y: number } | undefined {
  for (const [y, row] of frame.entries()) {
    let x = 0;
    for (const segment of row) {
      if (segment.style?.reverse === true) return { x, y };
      x += segment.cellLength;
    }
  }
  return undefined;
}

// A mark the value holds alone, after a control or a line break, and a Prepend
// it holds alone, before one, beside right-to-left text.
const LONE_MARKS = ["א​ﾞב", "א\nﾞב", "ﾞאב", "אב​́ג", "אൎ​ב", "אבൎ", "אൎ\nב"];

// The screen column a terminal that runs UAX #9 on `row` (`implicit`) shows
// the cluster starting at code unit `unit` in: each cluster takes its cells
// where the first of its units is shown.
function screenColumn(row: string, unit: number): number {
  const clusterOf: number[] = [];
  const clusters = graphemes(row);
  clusters.forEach((cluster, index) => clusterOf.push(...new Array<number>(cluster.length).fill(index)));
  const { level, levels } = paragraph(row, 0);
  const counted = new Set<number>();
  let column = 0;
  for (const shown of visualOrder(lineLevels(row, levels, level))) {
    const cluster = clusterOf[shown]!;
    if (counted.has(cluster)) continue;
    counted.add(cluster);
    if (cluster === clusterOf[unit]) return column;
    column += cellLen(clusters[cluster]!);
  }
  throw new Error(`unit ${unit} is not on the row`);
}

// The column a terminal reports for a pointer at screen column `x` of row `y`.
// One that orders what it is written (`logical`) orders the whole line and
// reports the column of what it was written there — the BiDi recommendation's
// "the reported column is the model's column", VTE's `vis2log` — so this models
// that terminal; every other order reports the screen's own column.
function reported(frame: readonly (readonly Segment[])[], order: TextOrder, x: number, y: number): number {
  if (order !== "logical") return x;
  const pieces: Segment[] = [];
  const starts: number[] = [];
  let col = 0;
  for (const segment of frame[y]!) {
    if (segment.isControl) continue;
    for (const glyph of graphemes(segment.text)) {
      pieces.push(new Segment(glyph, segment.style));
      starts.push(col);
      col += pieces.at(-1)!.cellLength;
    }
  }
  const columns = shownWritten(pieces).flatMap((index) => Array.from({ length: pieces[index]!.cellLength }, (_, cell) => starts[index]! + cell));
  return columns[x] ?? x;
}

// A terminal showing `input`, alone or in a container, through one app router:
// `paint` draws a frame once, as its rows and the bytes written for them, and
// `press` is a left press and release where the user points at screen column
// `x` of row `y` of the last frame painted, reported as the terminal reports it.
function screenOf(input: TextInput, order: TextOrder) {
  let frame: Segment[][] = [];
  const focusManager = new DefaultFocusManager({ mounted: () => [input], onScreen: () => [input], frameTime: () => 0 });
  const routes = new EventRouter({
    source: { focusManager, get frame() { return frame; }, frameNow: () => ({ time: 0, host: {} }), refresh: () => {} },
    focusOnClick: false,
  });
  const router = parserFor(routes);
  // A key goes to the widget the manager holds focus on, as in an app.
  if (input.focused) focusManager.focus(input);
  return {
    paint(drawn: RenderOptions, view: TextInput | Panel | Columns = input): { frame: Segment[][]; bytes: string } {
      const segments = [...render(view, drawn)];
      frame = Segment.splitLines(segments);
      // As an app does once it has painted.
      routes.framePainted();
      return { frame, bytes: segmentsToString(segments, { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: false, reducedMotion: false, textOrder: order }) };
    },
    press(x: number, y: number): void {
      const at = reported(frame, order, x, y);
      router.feed(`\x1b[<0;${at + 1};${y + 1}M\x1b[<0;${at + 1};${y + 1}m`);
    },
    step(way: "left" | "right"): void {
      router.feed(way === "left" ? "\x1b[D" : "\x1b[C");
    },
  };
}

// The caret's row, and the code unit it starts at in what a terminal keeps of that row.
function caretUnit(bytes: string): { y: number; unit: number } {
  for (const [y, line] of bytes.split("\n").entries()) {
    const at = line.indexOf("\x1b[1;7m");
    if (at >= 0) return { y, unit: rows(line.slice(0, at))[0]!.length };
  }
  throw new Error("no caret drawn");
}

describe("every stop of every row is drawn, pressed and stepped from", () => {
  const values = [...BIDI_VALUES, ...LONE_MARKS, "אבגדהוזחטיכלמנסעפצקרשת abc"];
  it.each(["plain", "logical", "visual", "words"] as const)("under %s, one line scrolled and rows wrapped", (order) => {
    for (const multiline of [false, true]) {
      for (const value of values) {
        const input = new TextInput({ value, multiline });
        input.cursorStyleOverride = Style.parse("bold reverse");
        input.focus(0);
        const drawn: RenderOptions = { maxWidth: 8, textOrder: order };
        const screen = screenOf(input, order);
        for (const stop of stops(value)) {
          const what = `${JSON.stringify(value)} at ${stop}, multiline ${multiline}`;
          input.cursorPosition = asCodeUnit(stop);
          const { frame, bytes } = screen.paint(drawn);
          const at = caretIn(frame);
          expect(at, what).toBeDefined();
          // Under logical the terminal orders the row, so the caret is pressed where it shows it.
          if (order === "logical") {
            const { y, unit } = caretUnit(bytes);
            at!.x = screenColumn(rows(bytes)[y]!, unit);
          }
          input.cursorPosition = asCodeUnit(stop === 0 ? value.length : 0);
          screen.press(at!.x, at!.y);
          expect(input.cursorPosition, what).toBe(stop);
          for (const step of ["left", "right"]) {
            input.cursorPosition = asCodeUnit(stop);
            render(input, drawn);
            expect(() => input.handleKey(key(step)), `${what}, ${step}`).not.toThrow();
          }
        }
      }
    }
  });

  it("draws the caret at the end of a row the wrap dropped a space after", () => {
    const input = new TextInput({ value: "abc def", multiline: true, wrap: () => [{ start: asCodePoint(0), end: asCodePoint(3) }, { start: asCodePoint(4), end: asCodePoint(7) }] });
    input.cursorStyleOverride = Style.parse("bold reverse");
    input.focus(0);
    input.cursorPosition = asCodeUnit(3);
    const frame = Segment.splitLines(render(input, { maxWidth: 3, textOrder: "plain" }));
    expect(caretIn(frame)).toEqual({ x: 3, y: 0 });
    input.handleKey(key("right"));
    expect(input.cursorPosition).toBe(4);
  });

  it.each(["plain", "visual"] as const)("steps through every offset a wrap dropped, the caret drawn at each, under %s", (order) => {
    for (const value of ["abc   def", "אבג   דהו"]) {
      const input = new TextInput({ value, multiline: true, wrap: () => [{ start: asCodePoint(0), end: asCodePoint(3) }, { start: asCodePoint(6), end: asCodePoint(9) }] });
      input.cursorStyleOverride = Style.parse("bold reverse");
      input.focus(0);
      const drawn: RenderOptions = { maxWidth: 3, textOrder: order };
      // An offset in the gap stands on the end of the row before it.
      for (const inGap of [4, 5]) {
        input.cursorPosition = asCodeUnit(inGap);
        expect(caretIn(Segment.splitLines(render(input, drawn))), `${value} at ${inGap}`).toBeDefined();
        for (const step of ["left", "right"]) {
          input.cursorPosition = asCodeUnit(inGap);
          render(input, drawn);
          expect(() => input.handleKey(key(step)), `${value} at ${inGap}, ${step}`).not.toThrow();
        }
      }
      // A step out of the row's end lands on the next row, never inside the gap.
      const forward = order === "plain" || value.startsWith("a") ? "right" : "left";
      input.cursorPosition = asCodeUnit(2);
      const seen: number[] = [];
      for (let presses = 0; presses < 12 && input.cursorPosition !== 6; presses++) {
        render(input, drawn);
        input.handleKey(key(forward));
        seen.push(input.cursorPosition);
      }
      expect(seen, value).toEqual([3, 6]);
    }
  });

  it("puts the cursor at the end of a right-to-left line pressed past its text", () => {
    // Rows: in the blank right of the row, where the frame drew no cell for its end.
    const input = new TextInput({ value: HEBREW, multiline: true });
    input.focus(0);
    input.cursorPosition = asCodeUnit(1);
    const drawn: RenderOptions = { maxWidth: 20, textOrder: "visual" };
    const frame = Segment.splitLines(render(input, drawn));
    const x = Segment.getLineLength(frame[0]!) - 1;
    expect(x).toBeGreaterThan(cellLen(HEBREW));
    input.handleMouse({ type: "mouse_down", x, y: 0, button: 0, shift: false, ctrl: false, over: true, cell: cellOf(frame, input, x, 0), time: 0 });
    expect(input.cursorPosition).toBe(HEBREW.length);
  });

  it.each(["plain", "logical", "visual", "words"] as const)("steps onto the stop the screen shows beside the caret, under %s", (order) => {
    for (const value of [...BIDI_VALUES, ...LONE_MARKS, "אבג\nabc", "abc אבג\nדהו"]) {
      const input = new TextInput({ value, multiline: true });
      input.cursorStyleOverride = Style.parse("bold reverse");
      input.focus(0);
      const drawn: RenderOptions = { maxWidth: 8, textOrder: order };
      const screen = screenOf(input, order);
      for (const stop of stops(value)) {
        // In the frame that draws the caret at `stop`: where a terminal shows
        // it, and the glyphs drawn beside it, read by pressing them.
        input.cursorPosition = asCodeUnit(stop);
        const { frame, bytes } = screen.paint(drawn);
        const at = caretIn(frame)!;
        if (order === "logical") {
          const { y, unit } = caretUnit(bytes);
          at.x = screenColumn(rows(bytes)[y]!, unit);
        }
        const drawnTo = Math.max(...frame[at.y]!.flatMap((segment, index) =>
          segment.text.trim() !== "" || segment.style?.reverse === true ? [Segment.getLineLength(frame[at.y]!.slice(0, index + 1))] : []));
        const pressed = (screenX: number): number => {
          screen.press(screenX, at.y);
          return input.cursorPosition;
        };
        for (const [name, side] of [["left", -1], ["right", 1]] as const) {
          let beside: number | undefined;
          for (let x = at.x + side; beside === undefined && x >= 0 && x < drawnTo; x += side) {
            const there = pressed(x);
            if (there !== stop) beside = there;
          }
          if (beside === undefined) continue;
          input.cursorPosition = asCodeUnit(stop);
          render(input, drawn);
          input.handleKey(key(name));
          const stepped = input.cursorPosition;
          // A row wider than the offer draws no cell for its end, which stands,
          // with no cells, beside the character typed last, and has no padding
          // past it to press: a step reaches that line end and no press does.
          const lineEnd = stepped === value.length || value[stepped] === "\n";
          if (stepped !== beside && lineEnd && !Array.from({ length: drawnTo }, (_, x) => pressed(x)).includes(stepped)) continue;
          expect(stepped, `${JSON.stringify(value)} from ${stop}, ${name}`).toBe(beside);
        }
      }
    }
  });

  it("steps off the end of a right-to-left row a terminal shows its caret right of", () => {
    // Logical: only whitespace follows the row, so the terminal shows the caret's blank at its right.
    const input = new TextInput({ value: HEBREW, multiline: true });
    input.focus(0);
    const drawn: RenderOptions = { maxWidth: 20, textOrder: "logical" };
    input.cursorPosition = asCodeUnit(3);
    render(input, drawn);
    input.handleKey(key("left"));
    expect(input.cursorPosition).toBe(0);
    input.cursorPosition = asCodeUnit(3);
    render(input, drawn);
    input.handleKey(key("right"));
    expect(input.cursorPosition).toBe(3);
  });

  it("presses the stops of a row a scroll arrow follows where a terminal shows them", () => {
    const value = "אבג\nדהו\nזחט";
    const input = new TextInput({ value, multiline: true, maxRows: 2 });
    input.cursorStyleOverride = Style.parse("bold reverse");
    input.focus(0);
    const drawn: RenderOptions = { maxWidth: 12, textOrder: "logical" };
    const screen = screenOf(input, "logical");
    for (const stop of [4, 5, 6, 7]) {
      input.cursorPosition = asCodeUnit(stop);
      const { bytes } = screen.paint(drawn);
      const { y, unit } = caretUnit(bytes);
      expect(rows(bytes)[y]).toContain("▼");
      input.cursorPosition = asCodeUnit(0);
      screen.press(screenColumn(rows(bytes)[y]!, unit), y);
      expect(input.cursorPosition, `at ${stop}`).toBe(stop);
    }
  });

  it.each(["plain", "visual"] as const)("steps back out of a row onto the end of the row a wrap dropped a gap after, and types there, under %s", (order) => {
    for (const value of ["abc   def", "אבג   דהו"]) {
      const input = new TextInput({ value, multiline: true, wrap: () => [{ start: asCodePoint(0), end: asCodePoint(3) }, { start: asCodePoint(6), end: asCodePoint(9) }] });
      input.focus(0);
      const drawn: RenderOptions = { maxWidth: 3, textOrder: order };
      const back = order === "plain" || value.startsWith("a") ? "left" : "right";
      input.cursorPosition = asCodeUnit(6);
      render(input, drawn);
      input.handleKey(key(back));
      expect(input.cursorPosition, value).toBe(3);
      input.handleKey(key("x", "X"));
      expect(input.value, value).toBe(`${value.slice(0, 3)}X${value.slice(3)}`);
    }
  });

  it("moves Up onto the end of a row a wrap dropped a gap after, and Down back", () => {
    const input = new TextInput({ value: "abc   def", multiline: true, wrap: () => [{ start: asCodePoint(0), end: asCodePoint(3) }, { start: asCodePoint(6), end: asCodePoint(9) }] });
    input.focus(0);
    render(input, { maxWidth: 3, textOrder: "plain" });
    input.cursorPosition = asCodeUnit(9);
    input.handleKey(key("up"));
    expect(input.cursorPosition).toBe(3);
    input.handleKey(key("down"));
    expect(input.cursorPosition).toBe(9);
  });

  it("orders a right-to-left placeholder at its own direction", () => {
    const input = new TextInput({ value: "", placeholder: "חפש..." });
    input.cursorStyleOverride = Style.parse("bold reverse");
    input.focus(0);
    const [row] = Segment.splitLines(render(input, { maxWidth: 40, textOrder: "visual" }));
    expect(row!.map((segment) => segment.text).join("")).toContain("...שפח");
  });
});

describe("under logical, a press reads the column the terminal reports", () => {
  // The terminal orders the whole line it is written, a Panel's border with
  // it, and reports a press at the column of what it was written there.
  it("presses every stop of a right-to-left field inside a Panel where the terminal shows it", () => {
    const value = "אבג";
    const input = new TextInput({ value, multiline: true });
    input.cursorStyleOverride = Style.parse("bold reverse");
    const panel = new Panel(input);
    const drawn: RenderOptions = { maxWidth: 12, textOrder: "logical" };
    input.focus(0);
    // The frame on screen is the one painted with the caret at the stop; the
    // press reads that one, as an app's router does, not a frame drawn after.
    const screen = screenOf(input, "logical");
    for (const stop of stops(value)) {
      input.cursorPosition = asCodeUnit(stop);
      const { bytes } = screen.paint(drawn, panel);
      const { y, unit } = caretUnit(bytes);
      input.cursorPosition = asCodeUnit(stop === 0 ? value.length : 0);
      screen.press(screenColumn(rows(bytes)[y]!, unit), y);
      expect(input.cursorPosition, `at ${stop}`).toBe(stop);
    }
  });
});

describe("under logical, a step walks the stops the terminal shows on the whole composed line", () => {
  // The terminal orders the whole line, the neighbour's text with the field's
  // row, so a step must walk the stops where that line shows them. Every stop
  // has a cell in the frame painted with the caret at the end — each glyph its
  // own, the end the caret's blank — so that frame says where each one is
  // shown; a step from one goes to the stop shown beside it on its side.
  it.each([
    ["a right-to-left field beside right-to-left text", "אב", (input: TextInput) => new Columns([input, new RichText("שם")])],
    ["a field opening on a neutral right of a right-to-left label", "- אב", (input: TextInput) => new Columns([new RichText("שם"), input])],
    ["digits and a space right of a right-to-left label", "1 2", (input: TextInput) => new Columns([new RichText("שם"), input])],
    ["alone", "אב", (input: TextInput) => new Columns([input])],
  ])("%s", (_, value, compose) => {
    const input = new TextInput({ value, multiline: true });
    input.cursorStyleOverride = Style.parse("bold reverse");
    input.focus(0);
    const view = compose(input);
    const drawn: RenderOptions = { maxWidth: 30, textOrder: "logical" };
    const screen = screenOf(input, "logical");
    input.cursorPosition = asCodeUnit(value.length);
    const { bytes } = screen.paint(drawn, view);
    const { y, unit: end } = caretUnit(bytes);
    const row = rows(bytes)[y]!;
    // The field's glyphs, as written, are the units from where its text starts up to the caret's blank.
    const start = end - value.length;
    const columnOf = new Map(stops(value).map((stop) => [stop, screenColumn(row, stop === value.length ? end : start + stop)]));
    const leftToRight = [...columnOf].sort(([, a], [, b]) => a - b).map(([stop]) => stop);
    leftToRight.forEach((stop, index) => {
      for (const [way, beside] of [["left", leftToRight[index - 1]], ["right", leftToRight[index + 1]]] as const) {
        if (beside === undefined) continue;
        input.cursorPosition = asCodeUnit(stop);
        screen.paint(drawn, view);
        screen.step(way);
        expect(input.cursorPosition, `${way} from ${stop}`).toBe(beside);
      }
    });
  });
});

describe("the insertion point past the text, under visual order", () => {
  // The row's cells and the index of the one the caret stands on, on the
  // terminal's cursor or drawn by the field.
  function marked(input: TextInput, onTerminal: boolean): { row: Segment[]; at: number } {
    const [row] = Segment.splitLines(render(input, { ...options("visual"), caret: onTerminal }));
    const at = row!.findIndex((segment) => onTerminal ? segment.style?.caret !== undefined : segment.style?.reverse === true);
    return { row: row!, at };
  }

  describe.each([["on the terminal's cursor", true], ["drawn by the field", false]] as const)("%s", (_name, onTerminal) => {
    it("past a right-to-left run in a left-to-right line, stands beside the character typed last", () => {
      const { row, at } = marked(field("abc של"), onTerminal);
      expect(row.slice(0, at).map((segment) => segment.text).join("")).toMatch(/abc $/);
      expect(row.slice(at + 1).map((segment) => segment.text).join("")).toMatch(/^ל/);
      if (onTerminal) expect(row[at]!.style!.caret!.side).toBe("right");
    });

    it("past a left-to-right run in a right-to-left line, stands beside the character typed last", () => {
      const { row, at } = marked(field("של abc"), onTerminal);
      expect(row.slice(0, at).map((segment) => segment.text).join("")).toMatch(/c$/);
      if (onTerminal) expect(row[at]!.style!.caret!.side).toBe("left");
    });

    it("on a typed trailing space, is on a character, which keeps the level its text gives it", () => {
      const input = field("abc של ");
      input.cursorPosition = asCodeUnit(6);
      const { row, at } = marked(input, onTerminal);
      expect(row[at]!.text).toBe(" ");
      expect(row.slice(0, at).map((segment) => segment.text).join("")).toMatch(/ש$/);
    });
  });

  it("shows no blank the value does not hold while the caret is elsewhere", () => {
    const blurred = new TextInput({ value: "abc של" });
    const [row] = Segment.splitLines(render(blurred, options("visual")));
    expect(row!.map((segment) => segment.text).join("")).toMatch(/abc לש/);
  });

  it("puts a press on a right-to-left field's closing bracket beside the pointer", () => {
    const input = field("של");
    input.cursorPosition = asCodeUnit(1);
    const frame = Segment.splitLines(render(input, options("visual")));
    const x = Segment.getLineLength(frame[0]!) - 1;
    input.handleMouse({ type: "mouse_down", x, y: 0, button: 0, shift: false, ctrl: false, over: true, cell: cellOf(frame, input, x, 0), time: 0 });
    expect(input.cursorPosition).toBe(0);
  });

  // From the end of "abc של", shown "abc ␣לש" with the end beside ל: Left
  // crosses to the space, Right to ל.
  it.each([
    ["left", 3],
    ["right", 5],
  ] as const)("steps %s from the end to the same stop whether or not a frame showed the cursor there", (name, to) => {
    for (const onTerminal of [true, false]) {
      const painted = field("abc של");
      marked(painted, onTerminal);
      painted.handleKey(key(name));
      expect(painted.cursorPosition).toBe(to);

      const unpainted = field("abc של");
      unpainted.cursorPosition = asCodeUnit(4);
      marked(unpainted, onTerminal);
      unpainted.cursorPosition = asCodeUnit(6);
      unpainted.handleKey(key(name));
      expect(unpainted.cursorPosition).toBe(to);
    }
  });

  it("puts the end stop where the caret stands there, from anywhere in the text", () => {
    const input = field("abc של");
    input.cursorPosition = asCodeUnit(4);
    marked(input, true);
    // From ש, the rightmost cell, Left crosses ל to the end beside it.
    input.handleKey(key("left"));
    expect(input.cursorPosition).toBe(5);
    input.handleKey(key("left"));
    expect(input.cursorPosition).toBe(6);
  });
});
