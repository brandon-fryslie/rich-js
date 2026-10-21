import { describe, it, expect } from "vitest";
import { autorun } from "mobx";
import { TextInput, charGreedyWrap, type WrapStrategy, type WrapRow } from "../../src/widgets/text-input.js";
import { asCodePoint, asCellCol, cellLen } from "../../src/core/cells.js";
import { KeyEvent } from "../../src/widgets/types.js";
import type { InteractiveWidget, WidgetMouseEvent } from "../../src/widgets/types.js";
import { Segment } from "../../src/core/segment.js";
import { Style } from "../../src/core/style.js";
import { render, type Renderable, type RenderOptions } from "../../src/core/protocol.js";
import { Panel } from "../../src/renderables/panel.js";
import { cellOf, scrollTargetAt } from "../../src/widgets/hit.js";
import { Padding } from "../../src/renderables/padding.js";
import { ASCII } from "../../src/core/box.js";
import { ColorSpec } from "../../src/core/color.js";
import { DEFAULT_TERMINAL_THEME } from "../../src/themes/terminalThemes.js";
import { expectLinearTime } from "../suite/linear-time.js";

// What every widget draws a disabled cell in.
const MUTED = ColorSpec.fromRgba(DEFAULT_TERMINAL_THEME.palette.get("foreground-muted")!);

// Factories — KeyEvent carries a mutable `stopped` flag; fresh per call.
const makeKey = (key: string, character = ""): KeyEvent => new KeyEvent({
  key,
  character,
  shift: false,
  ctrl: false,
  meta: false,
}, 0);

const ctrl = (key: string): KeyEvent => new KeyEvent({
  key,
  character: "",
  shift: false,
  ctrl: true,
  meta: false,
}, 0);

const alt = (key: string): KeyEvent => new KeyEvent({
  key,
  character: "",
  shift: false,
  ctrl: false,
  meta: true,
}, 0);

// [LAW:behavior-not-structure] The wrap/cursor-motion suites below are white-box
// regression pins for a specific boundary bug, not contract tests: they read
// the rows `TextInput["_rows"]` lays out at the width last drawn to construct
// an exact row layout and assert which row the cursor resolved to. Bracket
// access is the one sanctioned mechanism for such a reach in this repo — it
// keeps every deliberate reach greppable and refuses to spread, where widening
// `TextInput`'s public surface (and exporting the internal `VisualRow`) would
// have shipped permanent API to satisfy a disposable test. Contract-level
// assertions in this file go through `render()`, `value`, and `cursorPosition`.

const rowsOf = (t: TextInput) => t["_rows"](t["_drawn"].get());
// The row the cursor is on: the last that starts at or before it.
const cursorRowOf = (t: TextInput): number => {
  const rows = rowsOf(t);
  let row = rows.length - 1;
  while (row > 0 && rows[row]!.valueStart > t.cursorPosition) row--;
  return row;
};

const upEvent = () => makeKey("up");
const downEvent = () => makeKey("down");

const printable = (ch: string): KeyEvent => new KeyEvent({
  key: ch,
  character: ch,
  shift: false,
  ctrl: false,
  meta: false,
}, 0);

const enterEvent = () => makeKey("enter", "\r");
const escapeEvent = () => makeKey("escape", "\x1b");
const backspaceEvent = () => makeKey("backspace", "\x08");
const deleteEvent = () => makeKey("delete");
const leftEvent = () => makeKey("left");
const rightEvent = () => makeKey("right");
const homeEvent = () => makeKey("home");
const endEvent = () => makeKey("end");

const RENDER = { maxWidth: 80 };

// A press on the cell at column `x` of row `y` of `frame`, as the router
// delivers it to `t`: with what `t` stamped on that cell.
const pressIn = (frame: readonly (readonly Segment[])[], t: TextInput, x: number, y = 0): WidgetMouseEvent => ({
  type: "mouse_down",
  x,
  y,
  button: 0,
  shift: false,
  ctrl: false,
  over: true,
  cell: cellOf(frame, t, x, y),
  time: 0,
});

// A press on the frame `t` draws now.
const pressOn = (t: TextInput, x: number, y = 0, options: RenderOptions = RENDER): WidgetMouseEvent =>
  pressIn(Segment.splitLines(render(t, options)), t, x, y);

// The rows the input draws, one per line.
const rowsText = (input: TextInput, options: RenderOptions): string =>
  Segment.splitLines(input.render(options))
    .map((row) => row.map((s) => s.text).join(""))
    .join("\n");
const renderText = (input: TextInput): string => rowsText(input, RENDER);

describe("TextInput", () => {
  it("constructs with defaults", () => {
    const t = new TextInput();
    expect(t.value).toBe("");
    expect(t.placeholder).toBe("");
    expect(t.cursorPosition).toBe(0);
    expect(t.focusable).toBe(true);
    expect(t.disabled).toBe(false);
    expect(typeof t.id).toBe("string");
    expect(t.id.length).toBeGreaterThan(0);
  });

  it("constructs with options", () => {
    const t = new TextInput({ value: "hello", placeholder: "name", id: "n", disabled: true });
    expect(t.value).toBe("hello");
    expect(t.placeholder).toBe("name");
    expect(t.cursorPosition).toBe(5);
    expect(t.id).toBe("n");
    expect(t.disabled).toBe(true);
  });

  it("multiline mode initializes cursor at start so pre-loaded content shows from the top", () => {
    // Regression: a multiline TextInput pre-loaded with long content used
    // to open with cursor at value.length, which scrolled the viewport to
    // the bottom on first render. Convention for textareas is cursor at 0.
    const t = new TextInput({
      value: "0\n1\n2\n3\n4\n5\n6\n7\n8\n9",
      multiline: true,
      maxRows: 3,
    });
    expect(t.cursorPosition).toBe(0);
    const text = rowsText(t, { maxWidth: 20 });
    expect(text).toContain("0");
    expect(text).toContain("1");
    expect(text).toContain("2");
    expect(text).not.toContain("9");
  });

  it("implements InteractiveWidget", () => {
    const t: InteractiveWidget = new TextInput();
    expect(typeof t.handleKey).toBe("function");
    expect(typeof t.handleMouse).toBe("function");
    expect(typeof t.render).toBe("function");
    expect(typeof t.measure).toBe("function");
  });

  describe("insertion", () => {
    it("inserts a printable character at the cursor and advances", () => {
      const t = new TextInput();
      t.handleKey(printable("h"));
      expect(t.value).toBe("h");
      expect(t.cursorPosition).toBe(1);
    });

    it("inserts in the middle of existing text", () => {
      const t = new TextInput({ value: "ac" });
      t.cursorPosition = asCodePoint(1);
      t.handleKey(printable("b"));
      expect(t.value).toBe("abc");
      expect(t.cursorPosition).toBe(2);
    });

    it("emits onChange on insertion", () => {
      const t = new TextInput();
      const changes: InteractiveWidget[] = [];
      t.onChange((w) => changes.push(w));
      t.handleKey(printable("x"));
      expect(changes).toHaveLength(1);
    });

    it("respects maxLength", () => {
      const t = new TextInput({ value: "ab", maxLength: 2 });
      t.handleKey(printable("c"));
      expect(t.value).toBe("ab");
    });

    it("ignores ctrl-modified keys", () => {
      const t = new TextInput();
      t.handleKey(new KeyEvent({ key: "a", character: "a", shift: false, ctrl: true, meta: false }, 0));
      expect(t.value).toBe("");
    });
  });

  describe("deletion", () => {
    it("backspace removes the char before cursor and decrements", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = asCodePoint(2);
      t.handleKey(backspaceEvent());
      expect(t.value).toBe("ac");
      expect(t.cursorPosition).toBe(1);
    });

    it("backspace at position 0 is a no-op", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = asCodePoint(0);
      const changes: InteractiveWidget[] = [];
      t.onChange((w) => changes.push(w));
      t.handleKey(backspaceEvent());
      expect(t.value).toBe("abc");
      expect(t.cursorPosition).toBe(0);
      expect(changes).toHaveLength(0);
    });

    it("delete removes the char after cursor without moving it", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = asCodePoint(1);
      t.handleKey(deleteEvent());
      expect(t.value).toBe("ac");
      expect(t.cursorPosition).toBe(1);
    });

    it("delete at end is a no-op", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = asCodePoint(3);
      t.handleKey(deleteEvent());
      expect(t.value).toBe("abc");
    });
  });

  describe("cursor movement", () => {
    it("left moves cursor back, clamped at 0", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = asCodePoint(2);
      t.handleKey(leftEvent());
      expect(t.cursorPosition).toBe(1);
      t.handleKey(leftEvent());
      t.handleKey(leftEvent());
      expect(t.cursorPosition).toBe(0);
    });

    it("right moves cursor forward, clamped at value.length", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = asCodePoint(1);
      t.handleKey(rightEvent());
      expect(t.cursorPosition).toBe(2);
      t.handleKey(rightEvent());
      t.handleKey(rightEvent());
      expect(t.cursorPosition).toBe(3);
    });

    it("home jumps cursor to 0", () => {
      const t = new TextInput({ value: "hello" });
      t.handleKey(homeEvent());
      expect(t.cursorPosition).toBe(0);
    });

    it("end jumps cursor to value.length", () => {
      const t = new TextInput({ value: "hello" });
      t.cursorPosition = asCodePoint(0);
      t.handleKey(endEvent());
      expect(t.cursorPosition).toBe(5);
    });
  });

  describe("click-to-position", () => {
    it("lands on the window of the frame clicked, whatever the cursor did since", () => {
      const t = new TextInput({ value: "abcdefghijklmnopqrstuvwxyz" });
      t.focus(0);
      // The cursor at the end scrolls the window to the value's tail.
      const frame = Segment.splitLines(render(t, { maxWidth: 10 }));
      const shownFirst = frame[0]!.map((s) => s.text).join("")[1]!;
      // Home moves the window back before the next frame is drawn.
      t.handleKey(homeEvent());
      t.handleMouse(pressIn(frame, t, 1));
      expect(t.value[t.cursorPosition]).toBe(shownFirst);
    });

    it("mouse_down sets cursor based on x past the leading bracket", () => {
      const t = new TextInput({ value: "abcdef" });
      // Column 3 of the input is the third value cell: relX = 3 - 1 = 2
      t.handleMouse(pressOn(t, 3));
      expect(t.cursorPosition).toBe(2);
    });

    it("clamps to value.length when click is past the end", () => {
      const t = new TextInput({ value: "abc" });
      // The closing bracket of "[abc     ]".
      t.handleMouse(pressOn(t, 9));
      expect(t.cursorPosition).toBe(3);
    });

    it("clamps to 0 when click is before the content", () => {
      const t = new TextInput({ value: "abc" });
      t.handleMouse(pressOn(t, 0));
      expect(t.cursorPosition).toBe(0);
    });

  });

  describe("submit", () => {
    it("fires onSubmit on enter", () => {
      const t = new TextInput({ value: "hi" });
      const submits: InteractiveWidget[] = [];
      t.onSubmit((w) => submits.push(w));
      t.handleKey(enterEvent());
      expect(submits).toHaveLength(1);
    });

    it("does not fire onSubmit on other named keys", () => {
      const t = new TextInput({ value: "hi" });
      const submits: InteractiveWidget[] = [];
      t.onSubmit((w) => submits.push(w));
      t.handleKey(escapeEvent());
      t.handleKey(leftEvent());
      expect(submits).toHaveLength(0);
    });
  });

  describe("disabled gating", () => {
    it("blocks insertion", () => {
      const t = new TextInput({ disabled: true });
      t.handleKey(printable("a"));
      expect(t.value).toBe("");
    });

    it("blocks deletion", () => {
      const t = new TextInput({ value: "ab", disabled: true });
      t.cursorPosition = asCodePoint(2);
      t.handleKey(backspaceEvent());
      expect(t.value).toBe("ab");
    });

    it("blocks submit", () => {
      const t = new TextInput({ disabled: true });
      const submits: InteractiveWidget[] = [];
      t.onSubmit((w) => submits.push(w));
      t.handleKey(enterEvent());
      expect(submits).toHaveLength(0);
    });

    it("blocks click-to-position", () => {
      const t = new TextInput({ value: "abcdef", disabled: true });
      t.handleMouse(pressOn(t, 3));
      expect(t.cursorPosition).toBe(6);
    });
  });

  describe("rendering", () => {
    it("renders [content] with brackets", () => {
      const t = new TextInput({ value: "ab" });
      const text = renderText(t);
      expect(text.startsWith("[")).toBe(true);
      expect(text.endsWith("]")).toBe(true);
    });

    it("pads content to MIN_CONTENT_WIDTH (8) when value is short", () => {
      const t = new TextInput();
      const text = renderText(t);
      expect(text).toBe("[        ]");
    });

    it("includes the value text", () => {
      const t = new TextInput({ value: "hi" });
      const text = renderText(t);
      expect(text).toContain("hi");
    });

    it("password mode masks characters with •", () => {
      const t = new TextInput({ value: "secret", password: true });
      const text = renderText(t);
      expect(text).toContain("••••••");
      expect(text).not.toContain("secret");
    });

    it("password mode masks every line of a multi-line value", () => {
      const t = new TextInput({ value: "abc\nde", password: true, multiline: true });
      expect(renderText(t).split("\n").map((r) => r.trimEnd())).toEqual(["•••", "••"]);
    });

    it("password mode wraps by its masks, one per glyph however many code units the glyph takes", () => {
      const options = { maxWidth: 4 };
      const t = new TextInput({ value: "😀".repeat(6), password: true, multiline: true, wrap: charGreedyWrap });
      t.cursorPosition = asCodePoint(t.value.length);
      expect(rowsText(t, options).split("\n").map((r) => r.trimEnd())).toEqual(["••••", "↳ ••"]);
      t.handleKey(upEvent());
      expect(t.cursorPosition).toBe("😀".length * 2);
    });

    it("password mode measures a mask per glyph, whatever the glyph's cells", () => {
      const masked = new TextInput({ value: "あ".repeat(30), password: true });
      expect(masked.measure(RENDER)).toEqual(new TextInput({ value: "a".repeat(30) }).measure(RENDER));
    });

    it("shows placeholder when focused and value is empty", () => {
      const t = new TextInput({ placeholder: "enter name" });
      t.focus(0);
      const text = renderText(t);
      expect(text).toContain("enter name");
    });

    it("does not show placeholder when not focused", () => {
      const t = new TextInput({ placeholder: "enter name" });
      const text = renderText(t);
      expect(text).not.toContain("enter name");
    });

    it("does not show placeholder when value is non-empty", () => {
      const t = new TextInput({ value: "x", placeholder: "enter name" });
      t.focus(0);
      const text = renderText(t);
      expect(text).not.toContain("enter name");
      expect(text).toContain("x");
    });

    it("renders one cursor cell when focused", () => {
      const t = new TextInput({ value: "ab" });
      t.focus(0);
      const segments = Segment.splitLines(t.render(RENDER))[0]!;
      // cursor segment uses bgcolor=primary palette colour
      const cursorSeg = segments.find(
        (s) => s.style?.bgcolor !== undefined && s.style?.bgcolor.name !== "#333333",
      );
      expect(cursorSeg).toBeDefined();
      expect(cursorSeg!.text.length).toBe(1);
    });

    it("renders in the palette's muted foreground when disabled", () => {
      const t = new TextInput({ value: "ab", disabled: true });
      const segments = Segment.splitLines(t.render(RENDER))[0]!;
      expect(segments.map((s) => s.style?.color)).toEqual(segments.map(() => MUTED));
    });

    it("pads a short multiline row in the caller's contentStyle", () => {
      const contentStyle = new Style({ bgcolor: "blue" });
      const t = new TextInput({ value: "ab\nlonger line", multiline: true, contentStyle });
      const firstRow = Segment.splitLines(t.render(RENDER))[0]!.filter((s) => s.cellLength > 0);
      expect(firstRow.map((s) => s.style?.bgcolor)).toEqual(firstRow.map(() => contentStyle.bgcolor));
    });

    it("emits the same total width focused vs unfocused", () => {
      const t = new TextInput({ value: "abc" });
      const before = renderText(t).length;
      t.focus(0);
      const after = renderText(t).length;
      expect(before).toBe(after);
    });

    it("focused empty placeholder still produces a fixed width", () => {
      const t = new TextInput({ placeholder: "name" });
      const unfocused = renderText(t).length;
      t.focus(0);
      const focused = renderText(t).length;
      expect(unfocused).toBe(focused);
    });
  });

  describe("measure", () => {
    it("reports a minimum of 10", () => {
      const t = new TextInput();
      const { minimum } = t.measure(RENDER);
      expect(minimum).toBe(10);
    });

    it("reports a maximum at the floor for an input that draws narrower", () => {
      expect(new TextInput().measure(RENDER).maximum).toBe(10);
      expect(new TextInput({ value: "ab\ncd", multiline: true }).measure(RENDER).maximum).toBe(10);
    });

    // Each focused, with the cursor at the end of its widest line: the widest
    // the input draws.
    it.each([
      ["a value", { value: "abcdefghijklmnop" }],
      ["a placeholder over an empty value", { placeholder: "abcdefghijklmnop" }],
      ["glyphs of zero cells", { value: "a" + "\u200b".repeat(20) + "b" }],
      ["wide glyphs", { value: "あ".repeat(20) }],
      ["a password of wide glyphs, masked a cell each", { value: "あ".repeat(20), password: true }],
      ["multi-line", { value: "ab\nx\nabcdefghijklmnop", multiline: true }],
      ["multi-line glyphs of zero cells", { value: "ab\na" + "\u200b".repeat(20) + "b", multiline: true }],
      ["multi-line wide glyphs", { value: "あ\n" + "あ".repeat(20), multiline: true }],
      ["a multi-line password of wide glyphs, masked a cell each", { value: "あ\n" + "あ".repeat(20), password: true, multiline: true }],
    ])("reports as its maximum the width it draws, nothing cut at that width: %s", (_, options) => {
      const t = new TextInput(options);
      t.focused = true;
      t.cursorPosition = asCodePoint(t.value.length);
      const unbounded = rowsText(t, { maxWidth: 200 });
      const { maximum } = t.measure(RENDER);
      expect(Math.max(...unbounded.split("\n").map(cellLen))).toBe(maximum);
      expect(rowsText(t, { maxWidth: maximum })).toBe(unbounded);
    });

    const CURSOR = new Style({ reverse: true });
    const cursorText = (t: TextInput, options: RenderOptions): string[] =>
      [...t.render(options)].filter((s) => s.style?.reverse).map((s) => s.text);

    it("leaves a scroll arrow its cell past the cursor's at the end of the widest line", () => {
      const t = new TextInput({ value: "b\nabcdefghijklmnop", multiline: true, maxRows: 1, cursorStyle: CURSOR });
      t.focused = true;
      t.cursorPosition = asCodePoint(t.value.length);
      const { maximum } = t.measure(RENDER);
      expect(rowsText(t, { maxWidth: maximum })).toBe("abcdefghijklmnop ▲");
      expect(cursorText(t, { maxWidth: maximum })).toEqual([" "]);
    });

    // The field is 20 cells wide at a width of 22.
    it.each([
      ["at the end of narrow glyphs", "a".repeat(30) + "XYZ", 33, `[${"a".repeat(16)}XYZ ]`, " "],
      ["at the end of wide glyphs", "あ".repeat(20), 20, `[${"あ".repeat(9)}  ]`, " "],
      ["where the viewport's start would cut a wide glyph", "a" + "あ".repeat(20), 21, `[${"あ".repeat(9)}  ]`, " "],
      ["on a wide glyph at the field's last cells", "a".repeat(30) + "あb", 30, `[${"a".repeat(18)}あ]`, "あ"],
    ])("keeps the cursor's glyph in view in a value wider than the field: %s", (_, value, at, row, cursor) => {
      const t = new TextInput({ value, cursorStyle: CURSOR });
      t.focused = true;
      t.cursorPosition = asCodePoint(at);
      expect(rowsText(t, { maxWidth: 22 })).toBe(row);
      expect(cursorText(t, { maxWidth: 22 })).toEqual([cursor]);
      // Unfocused, it draws the same cells, so focus never shifts the text.
      t.focused = false;
      expect(rowsText(t, { maxWidth: 22 })).toBe(row);
    });
  });

  // ─── Readline / multiline behaviors ────────────────────────────────────

  describe("readline motion (Ctrl-modified)", () => {
    it("Ctrl+A moves cursor to line start", () => {
      const t = new TextInput({ value: "hello" });
      t.cursorPosition = asCodePoint(3);
      t.handleKey(ctrl("a"));
      expect(t.cursorPosition).toBe(0);
    });

    it("Ctrl+E moves cursor to line end", () => {
      const t = new TextInput({ value: "hello" });
      t.cursorPosition = asCodePoint(1);
      t.handleKey(ctrl("e"));
      expect(t.cursorPosition).toBe(5);
    });

    it("Ctrl+B / Ctrl+F are aliases for left / right", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = asCodePoint(1);
      t.handleKey(ctrl("b"));
      expect(t.cursorPosition).toBe(0);
      t.handleKey(ctrl("f"));
      t.handleKey(ctrl("f"));
      expect(t.cursorPosition).toBe(2);
    });

    it("Ctrl+H is a synonym for backspace", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = asCodePoint(3);
      t.handleKey(ctrl("h"));
      expect(t.value).toBe("ab");
      expect(t.cursorPosition).toBe(2);
    });

    it("Ctrl+D forward-deletes (synonym for Delete)", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = asCodePoint(1);
      t.handleKey(ctrl("d"));
      expect(t.value).toBe("ac");
      expect(t.cursorPosition).toBe(1);
    });

    it("Ctrl+W kills the previous whitespace-bounded word", () => {
      const t = new TextInput({ value: "foo bar baz" });
      t.cursorPosition = asCodePoint(11);
      t.handleKey(ctrl("w"));
      expect(t.value).toBe("foo bar ");
      expect(t.cursorPosition).toBe(8);
    });

    it("Ctrl+W with trailing whitespace skips it first", () => {
      const t = new TextInput({ value: "foo bar  " });
      t.cursorPosition = asCodePoint(9);
      t.handleKey(ctrl("w"));
      expect(t.value).toBe("foo ");
      expect(t.cursorPosition).toBe(4);
    });

    it("Ctrl+U kills back to line start", () => {
      const t = new TextInput({ value: "hello" });
      t.cursorPosition = asCodePoint(3);
      t.handleKey(ctrl("u"));
      expect(t.value).toBe("lo");
      expect(t.cursorPosition).toBe(0);
    });

    it("Ctrl+K kills to line end", () => {
      const t = new TextInput({ value: "hello" });
      t.cursorPosition = asCodePoint(2);
      t.handleKey(ctrl("k"));
      expect(t.value).toBe("he");
      expect(t.cursorPosition).toBe(2);
    });

    it("Ctrl+Y yanks the most recent kill", () => {
      const t = new TextInput({ value: "hello" });
      t.cursorPosition = asCodePoint(5);
      t.handleKey(ctrl("u"));           // kill "hello"; value="", cursor=0
      t.handleKey(ctrl("y"));           // paste "hello" at cursor 0
      expect(t.value).toBe("hello");
      expect(t.cursorPosition).toBe(5);
    });

    it("Ctrl+T transposes mid-string (swap + advance)", () => {
      const t = new TextInput({ value: "abcd" });
      t.cursorPosition = asCodePoint(2);             // between 'b' and 'c'
      t.handleKey(ctrl("t"));
      expect(t.value).toBe("acbd");
      expect(t.cursorPosition).toBe(3);
    });

    it("Ctrl+T at end-of-string swaps the trailing two without advancing", () => {
      const t = new TextInput({ value: "abcd" });
      t.cursorPosition = asCodePoint(4);
      t.handleKey(ctrl("t"));
      expect(t.value).toBe("abdc");
      expect(t.cursorPosition).toBe(4);
    });

    it("Ctrl+Left / Ctrl+Right do word motion", () => {
      const t = new TextInput({ value: "foo bar baz" });
      t.cursorPosition = asCodePoint(11);
      t.handleKey(new KeyEvent({ key: "left", character: "", shift: false, ctrl: true, meta: false }, 0));
      expect(t.cursorPosition).toBe(8);
      t.handleKey(new KeyEvent({ key: "left", character: "", shift: false, ctrl: true, meta: false }, 0));
      expect(t.cursorPosition).toBe(4);
      t.handleKey(new KeyEvent({ key: "right", character: "", shift: false, ctrl: true, meta: false }, 0));
      expect(t.cursorPosition).toBe(7);  // end of "bar"
    });

    it("Ctrl+Home / Ctrl+End jump to document bounds", () => {
      const t = new TextInput({ value: "line1\nline2\nline3", multiline: true });
      t.cursorPosition = asCodePoint(8);
      t.handleKey(new KeyEvent({ key: "home", character: "", shift: false, ctrl: true, meta: false }, 0));
      expect(t.cursorPosition).toBe(0);
      t.handleKey(new KeyEvent({ key: "end", character: "", shift: false, ctrl: true, meta: false }, 0));
      expect(t.cursorPosition).toBe(17);
    });
  });

  describe("alt-modified motion / editing", () => {
    it("Alt+B / Alt+F do word motion", () => {
      const t = new TextInput({ value: "foo bar baz" });
      t.cursorPosition = asCodePoint(11);
      t.handleKey(alt("b"));
      expect(t.cursorPosition).toBe(8);
      t.handleKey(alt("f"));
      expect(t.cursorPosition).toBe(11);
    });

    it("Alt+D deletes the next word forward", () => {
      const t = new TextInput({ value: "foo bar baz" });
      t.cursorPosition = asCodePoint(0);
      t.handleKey(alt("d"));
      expect(t.value).toBe(" bar baz");
      expect(t.cursorPosition).toBe(0);
    });

    it("Alt+Backspace kills the previous word", () => {
      const t = new TextInput({ value: "foo bar baz" });
      t.cursorPosition = asCodePoint(11);
      t.handleKey(new KeyEvent({ key: "backspace", character: "", shift: false, ctrl: false, meta: true }, 0));
      expect(t.value).toBe("foo bar ");
    });
  });

  describe("multiline mode", () => {
    it("Enter inserts a newline rather than submitting", () => {
      const t = new TextInput({ value: "ab", multiline: true });
      t.cursorPosition = asCodePoint(1);
      const submits: InteractiveWidget[] = [];
      t.onSubmit((w) => submits.push(w));
      t.handleKey(enterEvent());
      expect(t.value).toBe("a\nb");
      expect(t.cursorPosition).toBe(2);
      expect(submits).toHaveLength(0);
    });

    it("Ctrl+Enter still submits in multiline mode", () => {
      const t = new TextInput({ value: "hi", multiline: true });
      const submits: InteractiveWidget[] = [];
      t.onSubmit((w) => submits.push(w));
      t.handleKey(new KeyEvent({ key: "enter", character: "\r", shift: false, ctrl: true, meta: false }, 0));
      expect(submits).toHaveLength(1);
      expect(t.value).toBe("hi");
    });

    it("Up arrow moves to the same column on the previous line", () => {
      const t = new TextInput({ value: "abcdef\nxyz", multiline: true });
      t.cursorPosition = asCodePoint(9);             // between 'y' and 'z' on line 2 (col 2)
      t.handleKey(upEvent());
      expect(t.cursorPosition).toBe(2); // col 2 on line 1
    });

    it("Down arrow preserves the preferred column across short lines", () => {
      const t = new TextInput({ value: "abcdef\nxy\nuvwxyz", multiline: true });
      t.cursorPosition = asCodePoint(5);             // col 5 on line 1
      t.handleKey(downEvent());
      expect(t.cursorPosition).toBe(9); // line 2 only has 2 chars; clamp to its end
      t.handleKey(downEvent());
      expect(t.cursorPosition).toBe(15); // line 3 col 5 ('z' position) — preferred col restored
    });

    it("Up at first line is a no-op", () => {
      const t = new TextInput({ value: "abc\ndef", multiline: true });
      t.cursorPosition = asCodePoint(2);
      t.handleKey(upEvent());
      expect(t.cursorPosition).toBe(2);
    });

    it("Down at last line is a no-op", () => {
      const t = new TextInput({ value: "abc\ndef", multiline: true });
      t.cursorPosition = asCodePoint(6);
      t.handleKey(downEvent());
      expect(t.cursorPosition).toBe(6);
    });

    it("Home jumps to the start of the current logical line, not the value", () => {
      const t = new TextInput({ value: "abc\ndef\nghi", multiline: true });
      t.cursorPosition = asCodePoint(6);             // 'f' on line 2
      t.handleKey(homeEvent());
      expect(t.cursorPosition).toBe(4); // start of line 2
    });

    it("End jumps to the end of the current logical line, not the value", () => {
      const t = new TextInput({ value: "abc\ndef\nghi", multiline: true });
      t.cursorPosition = asCodePoint(5);             // 'e' on line 2
      t.handleKey(endEvent());
      expect(t.cursorPosition).toBe(7); // end of line 2
    });

    it("Ctrl+K at the end of a non-last line joins the next line", () => {
      const t = new TextInput({ value: "abc\ndef", multiline: true });
      t.cursorPosition = asCodePoint(3);             // end of line 1
      t.handleKey(ctrl("k"));
      expect(t.value).toBe("abcdef");
      expect(t.cursorPosition).toBe(3);
    });

    it("multiline=false preserves the legacy Enter=submit behavior", () => {
      const t = new TextInput({ value: "hi" });
      const submits: InteractiveWidget[] = [];
      t.onSubmit((w) => submits.push(w));
      t.handleKey(enterEvent());
      expect(submits).toHaveLength(1);
      expect(t.value).toBe("hi");
    });
  });

  describe("multiline rendering + soft wrap", () => {
    const RENDER_NARROW = { maxWidth: 10 };

    it("emits one visual row per logical line when no wrap strategy is set", () => {
      const t = new TextInput({ value: "a\nb\nc", multiline: true });
      const text = rowsText(t, RENDER_NARROW);
      // Three lines joined by \n; no continuation marker.
      expect(text.split("\n").map((r) => r.trimEnd())).toEqual(["a", "b", "c"]);
    });

    it("renders the continuation marker for soft-wrapped rows", () => {
      const t = new TextInput({
        value: "abcdefghijklmno",       // 15 chars
        multiline: true,
        wrap: charGreedyWrap,
      });
      // firstWidth = 10, continuationWidth = 10 - cellLen("↳ ") = 8
      // → row 0: "abcdefghij" (10), row 1: continuation "klmno" (5)
      const text = rowsText(t, RENDER_NARROW);
      expect(text).toContain("abcdefghij");
      expect(text).toContain("↳ ");
      expect(text).toContain("klmno");
    });

    it("Up arrow moves by visual row when wrap is active (post-render)", () => {
      const t = new TextInput({
        value: "abcdefghijklmno",       // wraps to 2 visual rows at width 10
        multiline: true,
        wrap: charGreedyWrap,
      });
      // Render first so visual rows get cached.
      [...t.render(RENDER_NARROW)];
      t.cursorPosition = asCodePoint(13);            // on visual row 1 (continuation), col 3
      t.handleKey(new KeyEvent({ key: "up", character: "", shift: false, ctrl: false, meta: false }, 0));
      // Visual row 0 at col 3 → cursorPosition = 3
      expect(t.cursorPosition).toBe(3);
    });

    it("Down arrow moves by visual row across a soft-wrap boundary", () => {
      const t = new TextInput({
        value: "abcdefghijklmno",
        multiline: true,
        wrap: charGreedyWrap,
      });
      [...t.render(RENDER_NARROW)];
      t.cursorPosition = asCodePoint(4);             // visual row 0, col 4
      t.handleKey(new KeyEvent({ key: "down", character: "", shift: false, ctrl: false, meta: false }, 0));
      // Visual row 1 starts at value-offset 10; col 4 → 14
      expect(t.cursorPosition).toBe(14);
    });

    it("custom wrap strategy is invoked and its rows drive motion", () => {
      let called = 0;
      const strategy: WrapStrategy = (line, { firstWidth, continuationWidth }) => {
        called++;
        // Break at every 4 chars regardless of width.
        const rows: WrapRow[] = [];
        let p = 0;
        while (p < line.length) {
          const take = Math.min(4, line.length - p);
          rows.push({ start: asCodePoint(p), end: asCodePoint(p + take) });
          p += take;
        }
        // Reference unused params so the type isn't dropped.
        void firstWidth; void continuationWidth;
        return rows;
      };
      const t = new TextInput({ value: "abcdefgh", multiline: true, wrap: strategy });
      [...t.render({ maxWidth: 80 })];
      expect(called).toBeGreaterThan(0);
      t.cursorPosition = asCodePoint(0);
      t.handleKey(new KeyEvent({ key: "down", character: "", shift: false, ctrl: false, meta: false }, 0));
      // Visual row 1 starts at offset 4 (per the custom strategy)
      expect(t.cursorPosition).toBe(4);
    });

    it("maxRows scrolls the cursor row into view", () => {
      const t = new TextInput({
        value: "a\nb\nc\nd\ne",            // 5 logical lines
        multiline: true,
        maxRows: 2,
      });
      t.cursorPosition = asCodePoint(8);                 // on line 5 ("e")
      const text = rowsText(t, { maxWidth: 20 });
      // Should show only lines 4 and 5 ("d" and "e") since maxRows=2 and
      // cursor is on the last line.
      expect(text).toContain("d");
      expect(text).toContain("e");
      expect(text).not.toContain("a");
      expect(text).not.toContain("b");
    });

    it("maxRows: cursor moves within viewport without scrolling once scrolled past top", () => {
      // Regression: previously the viewport was a pure function of cursor
      // position (`scrollStart = cursorRow - maxRows + 1`), which pinned the
      // cursor to the bottom row of the viewport whenever `cursorRow >= maxRows`.
      // Every Up/Down from there scrolled the viewport in lockstep with the
      // cursor, and the cursor could never appear anywhere except at the
      // viewport's bottom edge. Post-fix: the viewport is persistent state;
      // it scrolls only when the cursor would actually leave it.
      const value = "0\n1\n2\n3\n4\n5\n6\n7\n8\n9";  // 10 visual rows
      const t = new TextInput({ value, multiline: true, maxRows: 3 });

      // Park cursor at last row, render once → viewport scrolls to show 7,8,9.
      t.cursorPosition = asCodePoint(value.length);
      let text = rowsText(t, { maxWidth: 20 });
      expect(text).toContain("7");
      expect(text).toContain("8");
      expect(text).toContain("9");
      expect(text).not.toContain("6");

      // Up once: cursor moves from row 9 to row 8 — still inside viewport
      // (rows 7..9). Viewport must NOT scroll.
      t.handleKey(upEvent());
      text = rowsText(t, { maxWidth: 20 });
      expect(text).toContain("7");
      expect(text).toContain("8");
      expect(text).toContain("9");
      expect(text).not.toContain("6");

      // Up again: cursor at row 7, still inside viewport. No scroll.
      t.handleKey(upEvent());
      text = rowsText(t, { maxWidth: 20 });
      expect(text).toContain("7");
      expect(text).toContain("9");
      expect(text).not.toContain("6");

      // Up once more: cursor at row 6, now ABOVE viewport → scroll up by one.
      t.handleKey(upEvent());
      text = rowsText(t, { maxWidth: 20 });
      expect(text).toContain("6");
      expect(text).toContain("7");
      expect(text).toContain("8");
      expect(text).not.toContain("9");
      expect(text).not.toContain("5");
    });

    it("maxRows: viewport persists when value shrinks; clamps to valid range", () => {
      // Park cursor and scroll deep, then delete a chunk so the new total
      // is smaller than the saved scrollStart. The render must clamp so
      // the viewport stays within bounds rather than reading past the end.
      const t = new TextInput({
        value: "0\n1\n2\n3\n4\n5\n6\n7\n8\n9",
        multiline: true,
        maxRows: 3,
      });
      t.cursorPosition = asCodePoint(t.value.length);
      [...t.render({ maxWidth: 20 })];  // viewport scrolls to rows 7..9
      // Delete back to a 4-row value.
      t.value = "0\n1\n2\n3";
      t.cursorPosition = asCodePoint(t.value.length);
      const text = rowsText(t, { maxWidth: 20 });
      // Total rows = 4, maxRows = 3, cursor at row 3 → viewport should show
      // rows 1..3 (clamped from the stale deeper value). Must not error and
      // must contain the cursor row.
      expect(text).toContain("3");
      expect(text).toContain("1");
      expect(text).toContain("2");
    });

    it("scroll arrows: at top of scrollable content shows ▼ only (no ▲)", () => {
      const t = new TextInput({
        value: "0\n1\n2\n3\n4\n5\n6\n7\n8\n9",
        multiline: true,
        maxRows: 3,
      });
      const text = rowsText(t, { maxWidth: 20 });
      expect(text).not.toContain("▲");
      expect(text).toContain("▼");
    });

    it("an unfocused blank field still draws its minRows, with cells a click can land on", () => {
      for (const value of ["", "\n\n"]) {
        const t = new TextInput({ value, multiline: true, minRows: 5 });
        const rows = rowsText(t, { maxWidth: 10 }).split("\n");
        expect(rows).toHaveLength(5);
        expect(rows.every((row) => row.length === 10)).toBe(true);
      }
    });

    it("maxRows is a ceiling: a value with fewer rows draws only its own", () => {
      const t = new TextInput({ value: "a", multiline: true, maxRows: 5 });
      expect(rowsText(t, { maxWidth: 10 }).split("\n")).toHaveLength(1);
    });

    it("an arrow sits in the last cell of the width offered, however wide a line is", () => {
      const t = new TextInput({ value: "0123456789abcdef\n1\n2\n3", multiline: true, maxRows: 2 });
      t.focus(0);
      const rows = rowsText(t, { maxWidth: 10 }).split("\n");
      expect(rows.map((row) => cellLen(row))).toEqual([10, 10]);
      expect(rows[1]!.endsWith("▼")).toBe(true);
    });

    it("the wheel scrolls a multi-line field, a click lands on the row it shows, and typing scrolls back to the caret", () => {
      const t = new TextInput({ value: "0\n1\n2\n3\n4\n5\n6\n7\n8\n9", multiline: true, maxRows: 3, scrollIndicator: "none" });
      t.focus(0);
      const frame = (): Segment[][] => Segment.splitLines(t.render({ maxWidth: 20 }));
      const shown = (): string[] => frame().map((row) => row.map((s) => s.text).join("").trimEnd());
      expect(shown()).toEqual(["0", "1", "2"]);
      // The wheel over the field finds its scroll, as it finds any viewport's.
      const scroll = scrollTargetAt(frame(), 0, 0, 1)!;
      expect(scroll).toBeDefined();
      scroll.scrollBy(5);
      expect(shown()).toEqual(["5", "6", "7"]);
      // A click on the second row it shows lands on line 6.
      t.handleMouse(pressIn(frame(), t, 0, 1));
      expect(t.cursorPosition).toBe(t.value.indexOf("6"));
      expect(shown()).toEqual(["5", "6", "7"]);
      // Scrolled away from the caret, a key typed on its row brings it back.
      scroll.scrollBy(-5);
      expect(shown()).toEqual(["0", "1", "2"]);
      t.handleKey(printable("x"));
      expect(shown()).toEqual(["4", "5", "x6"]);
    });

    it("scroll arrows: at bottom of scrollable content shows ▲ only (no ▼)", () => {
      const t = new TextInput({
        value: "0\n1\n2\n3\n4\n5\n6\n7\n8\n9",
        multiline: true,
        maxRows: 3,
      });
      t.cursorPosition = asCodePoint(t.value.length);
      const text = rowsText(t, { maxWidth: 20 });
      expect(text).toContain("▲");
      expect(text).not.toContain("▼");
    });

    it("scroll arrows: mid-scroll shows both ▲ and ▼", () => {
      const t = new TextInput({
        value: "0\n1\n2\n3\n4\n5\n6\n7\n8\n9",
        multiline: true,
        maxRows: 3,
      });
      // Scroll to bottom, then move cursor up by one so we're mid-buffer
      // with content both above and below the viewport.
      t.cursorPosition = asCodePoint(t.value.length);
      [...t.render({ maxWidth: 20 })];      // scrollStart = 7
      t.handleKey(upEvent());                  // cursor row 8 → still in viewport
      t.handleKey(upEvent());                  // cursor row 7 → still in viewport
      t.handleKey(upEvent());                  // cursor row 6 → scrolls to 6
      const text = rowsText(t, { maxWidth: 20 });
      expect(text).toContain("▲");
      expect(text).toContain("▼");
    });

    it("scroll arrows: hidden entirely when content fits within maxRows", () => {
      const t = new TextInput({ value: "0\n1\n2", multiline: true, maxRows: 5 });
      const text = rowsText(t, { maxWidth: 20 });
      expect(text).not.toContain("▲");
      expect(text).not.toContain("▼");
    });

    it("scroll arrows: hidden when maxRows is unset", () => {
      const t = new TextInput({ value: "0\n1\n2\n3\n4", multiline: true });
      const text = rowsText(t, { maxWidth: 20 });
      expect(text).not.toContain("▲");
      expect(text).not.toContain("▼");
    });

    // The indicator of the frame `t` draws at `options`, read off that frame.
    const indicatorOf = (t: TextInput, options: RenderOptions): string | undefined =>
      t.scrollIndicatorText(Segment.splitLines(t.render(options)));

    it("scrollIndicator='indices': counts the rows of the frame it labels, inside a Panel at any depth", () => {
      // "abcdef", "↳ ghij", "k" at the 6 cells a 10-cell panel leaves; at 20, two rows.
      const t = new TextInput({ value: "abcdefghij\nk", multiline: true, wrap: charGreedyWrap, maxRows: 1, scrollIndicator: "indices" });
      t.cursorPosition = asCodePoint(t.value.length);
      const bottom = (width: number, content: Renderable): string => {
        const panel = new Panel(content, { box: ASCII, bottomRightAccessory: (body) => t.scrollIndicatorText(body) });
        const lines = Segment.splitLines(panel.render({ maxWidth: width }))
          .map((row) => row.map((s) => s.text).join(""));
        return lines[lines.length - 1]!;
      };
      // Its first frame, before anything is kept from one, and a frame whose
      // width changed, each count their own rows.
      expect(bottom(10, t)).toContain("[3/3]");
      expect(bottom(24, t)).toContain("[2/2]");
      expect(bottom(10, new Padding(t, [0, 0]))).toContain("[3/3]");
    });

    it("scrollIndicator='indices': suppresses arrows, exposes [X/Y] text", () => {
      const t = new TextInput({
        value: "0\n1\n2\n3\n4\n5\n6\n7\n8\n9",
        multiline: true,
        maxRows: 3,
        scrollIndicator: "indices",
      });
      const text = rowsText(t, { maxWidth: 20 });
      expect(text).not.toContain("▲");
      expect(text).not.toContain("▼");
      // Cursor defaults to 0 in multiline → row 1 of 10.
      expect(indicatorOf(t, { maxWidth: 20 })).toBe("[1/10]");
      // Move cursor to end → row 10 of 10.
      t.cursorPosition = asCodePoint(t.value.length);
      expect(indicatorOf(t, { maxWidth: 20 })).toBe("[10/10]");
    });

    it("scrollIndicator='indices': returns undefined when nothing to scroll", () => {
      const t = new TextInput({
        value: "0\n1\n2",
        multiline: true,
        maxRows: 5,
        scrollIndicator: "indices",
      });
      expect(indicatorOf(t, { maxWidth: 20 })).toBeUndefined();
    });

    it("scrollIndicator='none': no arrows, no text", () => {
      const t = new TextInput({
        value: "0\n1\n2\n3\n4\n5\n6\n7\n8\n9",
        multiline: true,
        maxRows: 3,
        scrollIndicator: "none",
      });
      const text = rowsText(t, { maxWidth: 20 });
      expect(text).not.toContain("▲");
      expect(text).not.toContain("▼");
      expect(indicatorOf(t, { maxWidth: 20 })).toBeUndefined();
    });

    it("scrollIndicatorText is undefined in default 'arrows' mode", () => {
      const t = new TextInput({
        value: "0\n1\n2\n3\n4\n5\n6\n7\n8\n9",
        multiline: true,
        maxRows: 3,
      });
      // Defaults to arrows; the indices text is only published in 'indices' mode.
      expect(indicatorOf(t, { maxWidth: 20 })).toBeUndefined();
    });

    it("scroll arrows: full wrap budget — no column reserved when nothing to scroll", () => {
      // Regression: a previous design reserved one column for indicators
      // whenever `maxRows` was set, shrinking wrap budget even when no
      // scrolling was possible. Verify the wrap budget is now the full
      // maxWidth: a 20-char line at maxWidth=20 fits in one visual row.
      const t = new TextInput({
        value: "x".repeat(20),
        multiline: true,
        wrap: charGreedyWrap,
        maxRows: 5,
      });
      [...t.render({ maxWidth: 20 })];
      expect(rowsOf(t).length).toBe(1);
    });


    it("minRows pads short content with empty rows", () => {
      const t = new TextInput({ value: "x", multiline: true, minRows: 3 });
      const segs = [...t.render({ maxWidth: 20 })];
      // Count the trailing "\n" separators — should be at least minRows-1.
      const nlCount = segs.filter((s) => s.text === "\n").length;
      expect(nlCount).toBeGreaterThanOrEqual(2);
    });

    it("Up at first visual row (wrap active) is a no-op", () => {
      const t = new TextInput({
        value: "abcdefghijklmno",
        multiline: true,
        wrap: charGreedyWrap,
      });
      [...t.render(RENDER_NARROW)];
      t.cursorPosition = asCodePoint(3);
      t.handleKey(new KeyEvent({ key: "up", character: "", shift: false, ctrl: false, meta: false }, 0));
      expect(t.cursorPosition).toBe(3);
    });

    it("Down at last visual row (wrap active) is a no-op", () => {
      const t = new TextInput({
        value: "abcdefghijklmno",
        multiline: true,
        wrap: charGreedyWrap,
      });
      [...t.render(RENDER_NARROW)];
      t.cursorPosition = asCodePoint(13);
      t.handleKey(new KeyEvent({ key: "down", character: "", shift: false, ctrl: false, meta: false }, 0));
      expect(t.cursorPosition).toBe(13);
    });

    // Regression suite for the wrap-boundary trap. The trap shape: a visual
    // row of length L is followed by a continuation row of the same logical
    // line. Cursor on the continuation at any col > L. Up targets the
    // shorter row; pre-fix, the clamp landed cursor at `target.valueStart
    // + L`, which equaled the continuation's `valueStart` — `_cursorVisualRow`
    // then resolved that boundary to the *later* row, leaving the cursor
    // visibly stuck and the position frozen for subsequent Ups.
    //
    // Reproduces deterministically with a strategy that emits a single-char
    // head followed by long continuations. Default `charGreedyWrap` doesn't
    // expose the trap because every continuation row has the same length —
    // the trap manifests when target length < cursor col, which charGreedyWrap
    // alone can't produce. `templateAtomWrap` in the demo does produce it
    // (leading whitespace becomes a 2-char head row).
    const tinyHeadWrap: WrapStrategy = (line, { continuationWidth }) => {
      if (line.length <= 1) return [{ start: asCodePoint(0), end: asCodePoint(line.length) }];
      const out: WrapRow[] = [{ start: asCodePoint(0), end: asCodePoint(1) }];
      let p = 1;
      while (p < line.length) {
        const take = Math.min(continuationWidth, line.length - p);
        out.push({ start: asCodePoint(p), end: asCodePoint(p + take) });
        p += take;
      }
      return out;
    };

    it("Up onto a short head row lands strictly inside it, not at the boundary", () => {
      const t = new TextInput({
        value: "abcdefghijklmno",  // single logical line; wraps to head "a" + continuations
        multiline: true,
        wrap: tinyHeadWrap,
      });
      [...t.render({ maxWidth: 20 })];
      const rows = rowsOf(t);
      // Expected shape: row 0 "a" (vs=0, len=1, cont=false),
      //                 row 1 long continuation (vs=1, ...).
      expect(rows[0]!.content).toBe("a");
      expect(rows[1]!.isContinuation).toBe(true);
      expect(rows.length).toBeGreaterThanOrEqual(2);

      // Park cursor on the continuation row at col 5 (well past head.length=1).
      t.cursorPosition = asCodePoint(rows[1]!.valueStart + 5);
      expect(cursorRowOf(t)).toBe(1);

      t.handleKey(new KeyEvent({ key: "up", character: "", shift: false, ctrl: false, meta: false }, 0));

      // Pre-fix: cursorPosition would be `rows[0].valueStart + 1 = 1`, which
      // equals `rows[1].valueStart` — the boundary — and `_cursorVisualRow`
      // would still report row 1. Post-fix: clamp to `length - 1 = 0`,
      // cursor lands at `rows[0].valueStart = 0`, unambiguously row 0.
      expect(t.cursorPosition).toBe(0);
      expect(cursorRowOf(t)).toBe(0);
    });

    it("repeated Up across the trap row makes progress every press (no stuck position)", () => {
      const t = new TextInput({
        value: "x\nabcdefghijklmno",  // line 0 "x" (one row), line 1 wraps via tinyHeadWrap
        multiline: true,
        wrap: tinyHeadWrap,
      });
      [...t.render({ maxWidth: 20 })];
      const rows = rowsOf(t);
      // rows: [row 0 "x"], [row 1 "a" head of line 1], [row 2 long cont], ...
      // Park cursor on row 2 (continuation) at col 5.
      t.cursorPosition = asCodePoint(rows[2]!.valueStart + 5);

      const positions: number[] = [t.cursorPosition];
      for (let i = 0; i < 3; i++) {
        t.handleKey(new KeyEvent({ key: "up", character: "", shift: false, ctrl: false, meta: false }, 0));
        positions.push(t.cursorPosition);
      }
      // Three Ups from row 2: row 2 → row 1 → row 0 → (stuck at top, no further movement).
      // Crucially, the second-to-last Up must NOT leave cursor at the same
      // position as a prior one (boundary stuck-state).
      expect(positions[0]).not.toBe(positions[1]);
      expect(positions[1]).not.toBe(positions[2]);
    });

    it("Down onto a short head row also avoids the boundary trap", () => {
      const t = new TextInput({
        value: "AAAAAAAAAAAAAAAAAAA\nabcdefghij",  // line 0 long enough to give a col=5+ start
        multiline: true,
        wrap: tinyHeadWrap,
      });
      [...t.render({ maxWidth: 20 })];
      const rows = rowsOf(t);
      // From a row above the tinyHeadWrap line, Down at col 5 should land
      // unambiguously inside the head row (length 1), which means cursor
      // must clamp to col 0, not col 1 (the boundary).
      // First find the head row of line 1.
      const head = rows.findIndex((r) => r.content === "a" && !r.isContinuation);
      expect(head).toBeGreaterThan(0);

      // Park cursor on the row right above `head` at col 5.
      t.cursorPosition = asCodePoint(rows[head - 1]!.valueStart + 5);
      t.handleKey(new KeyEvent({ key: "down", character: "", shift: false, ctrl: false, meta: false }, 0));

      // Cursor should be on row `head` (valueStart), NOT at row `head+1`'s boundary.
      expect(t.cursorPosition).toBe(rows[head]!.valueStart);
      expect(cursorRowOf(t)).toBe(head);
    });

    it("preferred column survives motion through a short wrap row", () => {
      const t = new TextInput({
        // 3 logical lines: long / short / long. Wrap will further split lines.
        value: "abcdefghij\nxy\nuvwxyz",
        multiline: true,
        wrap: charGreedyWrap,
      });
      [...t.render(RENDER_NARROW)];
      t.cursorPosition = asCodePoint(6);                 // col 6 on visual row 0 of line 1
      t.handleKey(new KeyEvent({ key: "down", character: "", shift: false, ctrl: false, meta: false }, 0));
      // Visual row 1 = "xy" (start=11, length 2) → clamped to col 2 → pos 13
      expect(t.cursorPosition).toBe(13);
      t.handleKey(new KeyEvent({ key: "down", character: "", shift: false, ctrl: false, meta: false }, 0));
      // Visual row 2 = "uvwxyz" (start=14, length 6) → preferred col 6 → pos 20
      expect(t.cursorPosition).toBe(20);
    });
  });

  describe("charGreedyWrap", () => {
    // The stretch of the line each row draws.
    const wrapped = (line: string, firstWidth: number, continuationWidth: number): string[] =>
      charGreedyWrap(line, { firstWidth: asCellCol(firstWidth), continuationWidth: asCellCol(continuationWidth) })
        .map((row) => line.slice(row.start, row.end));

    it("returns one row for an empty line", () => {
      expect(wrapped("", 10, 8)).toEqual([""]);
    });

    it("splits at firstWidth then at continuationWidth", () => {
      expect(wrapped("0123456789abcdefghij", 10, 5)).toEqual(["0123456789", "abcde", "fghij"]);
    });

    it("returns a single row when line fits in firstWidth", () => {
      expect(wrapped("short", 10, 8)).toEqual(["short"]);
    });

    // Wide-char (CJK) tests — each CJK character is 1 code unit but 2 cells.
    it("does not overflow budget for wide chars (CJK)", () => {
      // "AAあ" = 3 code units, 4 cells.  Budget of 3 cells → "AA" (2 cells) fits,
      // "あ" (2 cells) does not; it must go to the next row.
      expect(wrapped("AAあ", 3, 3)).toEqual(["AA", "あ"]);
    });

    it("places a leading wide char on its own row when budget is 2 cells", () => {
      // "あAA" — wide char first.  Budget 2 → "あ" fits (2 cells), then "AA".
      expect(wrapped("あAA", 2, 2)).toEqual(["あ", "AA"]);
    });

    it("force-takes a wide char when budget is 1 cell (no infinite loop)", () => {
      // Degenerate: budget too narrow for the wide char.  Force-take to avoid
      // an infinite loop.
      expect(wrapped("あ", 1, 1)).toEqual(["あ"]);
    });
  });

  describe("a glyph of several code points is one cursor step", () => {
    const CURSOR = new Style({ reverse: true });
    // The text of the cell drawn in the cursor style, on every row.
    const cursorCells = (t: TextInput, options: RenderOptions = RENDER): string[] =>
      [...t.render(options)].filter((s) => s.style?.reverse).map((s) => s.text);

    for (const multiline of [false, true]) {
      describe(multiline ? "multi-line" : "single-line", () => {
        it("Right steps over a whole glyph, and Home, Right, Right lands before the next", () => {
          const t = new TextInput({ multiline, cursorStyle: CURSOR });
          t.focus(0);
          // One key per code point, as the router sends them.
          for (const ch of "a👍🏽b") t.handleKey(printable(ch));
          expect(t.value).toBe("a👍🏽b");
          t.handleKey(homeEvent());
          t.handleKey(rightEvent());
          t.handleKey(rightEvent());
          expect(t.value.slice(t.cursorPosition)).toBe("b");
          expect(cursorCells(t)).toEqual(["b"]);
        });

        it("draws the cursor on a whole glyph, and inserts after it", () => {
          const t = new TextInput({ value: "👍🏽x", multiline, cursorStyle: CURSOR });
          t.focus(0);
          t.handleKey(homeEvent());
          expect(cursorCells(t)).toEqual(["👍🏽"]);
          t.handleKey(rightEvent());
          expect(cursorCells(t)).toEqual(["x"]);
          t.handleKey(printable("y"));
          expect(t.value).toBe("👍🏽yx");
        });

        it("Backspace and Delete take the whole glyph", () => {
          for (const glyph of ["👍🏽", "❤️", "👨‍👩‍👧", "🇺🇸", "e\u0301"]) {
            const t = new TextInput({ value: `a${glyph}b`, multiline });
            t.cursorPosition = asCodePoint(1 + glyph.length);
            t.handleKey(backspaceEvent());
            expect(t.value).toBe("ab");
            t.value = `a${glyph}b`;
            t.cursorPosition = asCodePoint(1);
            t.handleKey(deleteEvent());
            expect(t.value).toBe("ab");
          }
        });

        it("Left steps back over a whole glyph", () => {
          const t = new TextInput({ value: "a👨‍👩‍👧", multiline });
          t.cursorPosition = asCodePoint(t.value.length);
          t.handleKey(leftEvent());
          expect(t.cursorPosition).toBe(1);
        });
      });
    }

    it("a cursor set from outside comes to rest on a glyph boundary inside the value", () => {
      const t = new TextInput({ value: "hello" });
      t.value = "";
      expect(t.cursorPosition).toBe(0);
      t.handleKey(leftEvent());
      t.handleKey(backspaceEvent());
      expect(t.cursorPosition).toBe(0);
      t.value = "a👍🏽";
      t.cursorPosition = asCodePoint(3);
      expect(t.cursorPosition).toBe(5);
      t.cursorPosition = asCodePoint(99);
      expect(t.cursorPosition).toBe(5);
    });

    it("typing a base before a modifier leaves the cursor after the glyph they form", () => {
      const t = new TextInput({ value: "🏽" });
      t.handleKey(homeEvent());
      t.handleKey(printable("a"));
      expect(t.cursorPosition).toBe(t.value.length);
      t.handleKey(backspaceEvent());
      expect(t.value).toBe("");
    });

    it("a key that joins the glyph before the cursor leaves the cursor just after it", () => {
      const t = new TextInput({ value: "👍x" });
      t.cursorPosition = asCodePoint(2);
      t.handleKey(printable("🏽"));
      expect(t.value).toBe("👍🏽x");
      expect(t.value.slice(t.cursorPosition)).toBe("x");
    });

    it("holds line breaks as \\n, so End stays on its line", () => {
      const t = new TextInput({ value: "a\r\nb\rc", multiline: true });
      expect(t.value).toBe("a\nb\nc");
      t.handleKey(endEvent());
      expect(t.cursorPosition).toBe(1);
      t.value = "x\r\ny";
      expect(t.value).toBe("x\ny");
    });

    it("maxLength cuts between glyphs, never inside one", () => {
      const t = new TextInput({ value: "abcd", maxLength: 5 });
      t.handleKey(printable("😀"));
      expect(t.value).toBe("abcd");
      t.value = "abc";
      t.cursorPosition = asCodePoint(3);
      t.handleKey(printable("😀"));
      expect(t.value).toBe("abc😀");
    });

    it("a password mask is one cell per glyph, and a click lands between glyphs", () => {
      const t = new TextInput({ value: "a👍🏽b", password: true, cursorStyle: CURSOR });
      t.focus(0);
      const drawn = [...t.render(RENDER)].map((seg) => seg.text).join("");
      expect([...drawn].filter((c) => c === "•")).toHaveLength(3);
      t.handleMouse(pressOn(t, 3));
      expect(t.value.slice(t.cursorPosition)).toBe("b");
      t.handleKey(backspaceEvent());
      expect(t.value).toBe("ab");
    });

    it("Ctrl+T on a single glyph changes nothing and emits nothing", () => {
      const t = new TextInput({ value: "👍🏽" });
      const changes: unknown[] = [];
      t.onChange((w) => changes.push(w));
      t.transposeChars();
      expect(t.value).toBe("👍🏽");
      expect(changes).toEqual([]);
    });

    it("a glyph too long for maxLength is refused without a change event", () => {
      const t = new TextInput({ value: "abcd", maxLength: 5 });
      const changes: unknown[] = [];
      t.onChange((w) => changes.push(w));
      t.handleKey(printable("😀"));
      expect(changes).toEqual([]);
    });

    it("refuses C1 controls, which a terminal reads as escape sequences", () => {
      const t = new TextInput({ value: "" });
      t.handleKey(printable("\u009b"));
      expect(t.value).toBe("");
    });

    it("an observer of value and cursorPosition never sees the cursor past the value", () => {
      const t = new TextInput({ value: "hello" });
      const seen: number[] = [];
      const stop = autorun(() => { seen.push(t.cursorPosition - t.value.length); });
      t.value = "";
      stop();
      expect(seen.every((over) => over <= 0)).toBe(true);
    });

    it("transposes whole glyphs", () => {
      const t = new TextInput({ value: "a👍🏽" });
      t.cursorPosition = asCodePoint(t.value.length);
      t.transposeChars();
      expect(t.value).toBe("👍🏽a");
    });
  });

  describe("a glyph of zero cells", () => {
    const CURSOR = new Style({ reverse: true });

    it("has a column of its own, so every cursor stop moves the cursor", () => {
      for (const glyph of ["\u200b", "\u2028", "\u2029", "\t", "\n"]) {
        const t = new TextInput({ value: `a${glyph}b`, cursorStyle: CURSOR });
        t.focus(0);
        t.cursorPosition = asCodePoint(0);
        const columns: number[] = [];
        for (let stop = 0; stop <= 3; stop++) {
          const segments = [...t.render(RENDER)];
          const at = segments.findIndex((seg) => seg.style?.reverse);
          expect(cellLen(segments[at]!.text)).toBe(1);
          const column = cellLen(segments.slice(0, at).map((seg) => seg.text).join(""));
          columns.push(column);
          // A click on the cell the cursor is drawn in puts it back there.
          const before = t.cursorPosition;
          t.handleMouse(pressOn(t, column));
          expect(t.cursorPosition).toBe(before);
          t.handleKey(rightEvent());
        }
        expect(columns).toEqual([1, 2, 3, 4]);
      }
    });

    it("is drawn as ◌, or ? where only ASCII is drawable", () => {
      const t = new TextInput({ value: "a\u200bb" });
      expect(renderText(t)).toContain("a◌b");
      expect(rowsText(t, { ...RENDER, asciiOnly: true })).toContain("a?b");
    });

    // Where the cursor is drawn: the row it is on, and the cells before it there.
    const cursorCell = (t: TextInput, options: RenderOptions): { row: number; column: number } => {
      const rows = Segment.splitLines(t.render(options));
      const row = rows.findIndex((r) => r.some((seg) => seg.style?.reverse));
      const at = rows[row]!.findIndex((seg) => seg.style?.reverse);
      expect(cellLen(rows[row]![at]!.text)).toBe(1);
      return { row, column: cellLen(rows[row]!.slice(0, at).map((seg) => seg.text).join("")) };
    };

    it("has a column of its own in a multi-line value, wrapped or not", () => {
      for (const wrap of [undefined, charGreedyWrap]) {
        for (const glyph of ["​", " ", " ", "\t"]) {
          const t = new TextInput({ value: `a${glyph}b`, multiline: true, wrap, cursorStyle: CURSOR });
          t.focus(0);
          expect(renderText(t).trimEnd()).toBe("a◌b");
          const columns: number[] = [];
          for (let stop = 0; stop <= 3; stop++) {
            const { row, column } = cursorCell(t, RENDER);
            expect(row).toBe(0);
            columns.push(column);
            const before = t.cursorPosition;
            t.handleMouse(pressOn(t, column, row));
            expect(t.cursorPosition).toBe(before);
            t.handleKey(rightEvent());
          }
          expect(columns).toEqual([0, 1, 2, 3]);
        }
      }
    });

    it("is a cell the wrap budget counts, so it wraps instead of overflowing its row", () => {
      const options = { maxWidth: 4 };
      const t = new TextInput({ value: "abcd​e", multiline: true, wrap: charGreedyWrap, cursorStyle: CURSOR });
      t.focus(0);
      expect(rowsText(t, options).split("\n").map((r) => r.trimEnd())).toEqual(["abcd", "↳ ◌e"]);
      const stops: { row: number; column: number }[] = [];
      for (let stop = 0; stop <= 6; stop++) {
        stops.push(cursorCell(t, options));
        t.handleKey(rightEvent());
      }
      expect(stops).toEqual([
        { row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 }, { row: 0, column: 3 },
        { row: 1, column: 2 }, { row: 1, column: 3 }, { row: 1, column: 4 },
      ]);
    });

    it("is measured as the one cell it is drawn as", () => {
      for (const multiline of [false, true]) {
        const thirty = new TextInput({ value: "a".repeat(30), multiline }).measure(RENDER);
        expect(new TextInput({ value: "​".repeat(30), multiline }).measure(RENDER)).toEqual(thirty);
      }
    });

    it("wraps a long line in time linear in its length", () => {
      expectLinearTime((n) => {
        const t = new TextInput({ value: "ab😀​".repeat(n), multiline: true, wrap: charGreedyWrap });
        rowsText(t, RENDER);
      }, 4000);
    });

    it("is drawn as ↵ when it breaks a line, or ~ where only ASCII is drawable", () => {
      const t = new TextInput({ value: "a\nb" });
      expect(renderText(t)).toContain("a↵b");
      expect(rowsText(t, { ...RENDER, asciiOnly: true })).toContain("a~b");
    });
  });

  describe("wide-char rendering and navigation", () => {
    const RENDER = { maxWidth: 20 };

    it("wraps CJK content at cell boundaries (not code-unit boundaries)", () => {
      // "AAAA日日" = 6 code units, 8 cells.  Width 6 → "AAAA日" = 6 cells fits;
      // "日" = 2 cells goes to continuation row.
      const t = new TextInput({
        value: "AAAA日日",
        multiline: true,
        wrap: charGreedyWrap,
      });
      const segs = [...t.render({ maxWidth: 6 })];
      const text = segs.map((s) => s.text).join("");
      expect(text).toContain("AAAA日");
      expect(text).toContain("日");
    });

    it("_cursorVisualCol returns cell column, not code-unit offset, for wide chars", () => {
      // "日A\nB": 日=cu0 (2cells), A=cu1 (1cell), \n=cu2, B=cu3 (1cell)
      // row 0 = "日A" (valueStart=0), row 1 = "B" (valueStart=3)
      // cursor at cu1 (after 日) → cell col = cellLen("日A".slice(0,1)) = 2
      // move down: row 1 "B" has 1 cell → clamp(2,1)=1 → cu offset 1 in "B"
      // cursorPosition = valueStart(3) + 1 = 4
      const t = new TextInput({
        value: "日A\nB",
        multiline: true,
        wrap: charGreedyWrap,
      });
      [...t.render(RENDER)];
      t.cursorPosition = asCodePoint(1); // after 日
      t.moveLineDown();
      expect(t.cursorPosition).toBe(4);
    });

    it("vertical navigation with wide chars preserves preferred cell column", () => {
      // Three lines: "日日" (4 cells) / "A" (1 cell) / "日日" (4 cells)
      // Start cursor after first 日 (cell col 2), move down to "A" (1 cell → clamp),
      // then down again to "日日" — should restore to cell col 2.
      const t = new TextInput({
        value: "日日\nA\n日日",
        multiline: true,
      });
      [...t.render(RENDER)];
      t.cursorPosition = asCodePoint(1); // after first 日, cell col 2
      t.moveLineDown();                  // → "A" row, clamped to end (cu 1 from "A" start)
      // "日日\n" = 3 code units; "A" is at cu 3; clamp cell 2→1→cu1 → cursorPosition 4
      expect(t.cursorPosition).toBe(4);
      t.moveLineDown();                  // → "日日" row, preferred col 2 → first 日 end
      // "A\n" = 2 code units from start of "A" row; "日日" starts at cu 5
      // preferred col = 2; cellColToCodeUnitOffset("日日", 2) = 1 (after first 日)
      expect(t.cursorPosition).toBe(6);
    });
  });

});

describe("a word motion takes time linear in the word it crosses", () => {
  // Stepping a cluster at a time, each step segmenting the value again, a motion across one long word was quadratic.
  const across = (motion: (t: TextInput) => void, from: "start" | "end") => (n: number) => {
    const t = new TextInput({ value: "a".repeat(n) });
    t.cursorPosition = asCodePoint(from === "start" ? 0 : n);
    motion(t);
  };

  it.each([
    ["moveWordLeft", (t: TextInput) => t.moveWordLeft(), "end"],
    ["moveWordRight", (t: TextInput) => t.moveWordRight(), "start"],
    ["deleteWordBack", (t: TextInput) => t.deleteWordBack(), "end"],
    ["deleteWordForward", (t: TextInput) => t.deleteWordForward(), "start"],
  ] as const)("%s", (_, motion, from) => {
    expectLinearTime(across(motion, from), 4000);
  });
});
