import { describe, it, expect } from "vitest";
import { TextInput } from "../../src/widgets/text-input.js";
import type { InteractiveWidget, KeyEvent, WidgetMouseEvent } from "../../src/widgets/types.js";

const makeKey = (key: string, character = ""): KeyEvent => ({
  key,
  character,
  shift: false,
  ctrl: false,
  meta: false,
});

const ctrl = (key: string): KeyEvent => ({
  key,
  character: "",
  shift: false,
  ctrl: true,
  meta: false,
});

const alt = (key: string): KeyEvent => ({
  key,
  character: "",
  shift: false,
  ctrl: false,
  meta: true,
});

const upEvent = makeKey("up");
const downEvent = makeKey("down");

const printable = (ch: string): KeyEvent => ({
  key: ch,
  character: ch,
  shift: false,
  ctrl: false,
  meta: false,
});

const enterEvent = makeKey("enter", "\r");
const escapeEvent = makeKey("escape", "\x1b");
const backspaceEvent = makeKey("backspace", "\x08");
const deleteEvent = makeKey("delete");
const leftEvent = makeKey("left");
const rightEvent = makeKey("right");
const homeEvent = makeKey("home");
const endEvent = makeKey("end");

const mouseDownAt = (x: number): WidgetMouseEvent => ({
  type: "mouse_down",
  x,
  y: 0,
  button: 0,
  shift: false,
  ctrl: false,
});

const RENDER = { maxWidth: 80 };

const renderText = (input: TextInput): string =>
  [...input.render(RENDER)].map((s) => s.text).join("");

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
      t.cursorPosition = 1;
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
      t.handleKey({ key: "a", character: "a", shift: false, ctrl: true, meta: false });
      expect(t.value).toBe("");
    });
  });

  describe("deletion", () => {
    it("backspace removes the char before cursor and decrements", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = 2;
      t.handleKey(backspaceEvent);
      expect(t.value).toBe("ac");
      expect(t.cursorPosition).toBe(1);
    });

    it("backspace at position 0 is a no-op", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = 0;
      const changes: InteractiveWidget[] = [];
      t.onChange((w) => changes.push(w));
      t.handleKey(backspaceEvent);
      expect(t.value).toBe("abc");
      expect(t.cursorPosition).toBe(0);
      expect(changes).toHaveLength(0);
    });

    it("delete removes the char after cursor without moving it", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = 1;
      t.handleKey(deleteEvent);
      expect(t.value).toBe("ac");
      expect(t.cursorPosition).toBe(1);
    });

    it("delete at end is a no-op", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = 3;
      t.handleKey(deleteEvent);
      expect(t.value).toBe("abc");
    });
  });

  describe("cursor movement", () => {
    it("left moves cursor back, clamped at 0", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = 2;
      t.handleKey(leftEvent);
      expect(t.cursorPosition).toBe(1);
      t.handleKey(leftEvent);
      t.handleKey(leftEvent);
      expect(t.cursorPosition).toBe(0);
    });

    it("right moves cursor forward, clamped at value.length", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = 1;
      t.handleKey(rightEvent);
      expect(t.cursorPosition).toBe(2);
      t.handleKey(rightEvent);
      t.handleKey(rightEvent);
      expect(t.cursorPosition).toBe(3);
    });

    it("home jumps cursor to 0", () => {
      const t = new TextInput({ value: "hello" });
      t.handleKey(homeEvent);
      expect(t.cursorPosition).toBe(0);
    });

    it("end jumps cursor to value.length", () => {
      const t = new TextInput({ value: "hello" });
      t.cursorPosition = 0;
      t.handleKey(endEvent);
      expect(t.cursorPosition).toBe(5);
    });
  });

  describe("click-to-position", () => {
    it("mouse_down sets cursor based on x relative to bounds.x and the leading bracket", () => {
      const t = new TextInput({ value: "abcdef" });
      t.bounds = { x: 5, y: 0, width: 10, height: 1 };
      // Click at screen-x = 8 → relX = 8 - 5 - 1 = 2
      t.handleMouse(mouseDownAt(8));
      expect(t.cursorPosition).toBe(2);
    });

    it("clamps to value.length when click is past the end", () => {
      const t = new TextInput({ value: "abc" });
      t.bounds = { x: 0, y: 0, width: 10, height: 1 };
      t.handleMouse(mouseDownAt(50));
      expect(t.cursorPosition).toBe(3);
    });

    it("clamps to 0 when click is before the content", () => {
      const t = new TextInput({ value: "abc" });
      t.bounds = { x: 5, y: 0, width: 10, height: 1 };
      t.handleMouse(mouseDownAt(0));
      expect(t.cursorPosition).toBe(0);
    });

    it("ignores mouse_down when bounds is unset", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = 1;
      t.handleMouse(mouseDownAt(2));
      expect(t.cursorPosition).toBe(1);
    });
  });

  describe("submit", () => {
    it("fires onSubmit on enter", () => {
      const t = new TextInput({ value: "hi" });
      const submits: InteractiveWidget[] = [];
      t.onSubmit((w) => submits.push(w));
      t.handleKey(enterEvent);
      expect(submits).toHaveLength(1);
    });

    it("does not fire onSubmit on other named keys", () => {
      const t = new TextInput({ value: "hi" });
      const submits: InteractiveWidget[] = [];
      t.onSubmit((w) => submits.push(w));
      t.handleKey(escapeEvent);
      t.handleKey(leftEvent);
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
      t.cursorPosition = 2;
      t.handleKey(backspaceEvent);
      expect(t.value).toBe("ab");
    });

    it("blocks submit", () => {
      const t = new TextInput({ disabled: true });
      const submits: InteractiveWidget[] = [];
      t.onSubmit((w) => submits.push(w));
      t.handleKey(enterEvent);
      expect(submits).toHaveLength(0);
    });

    it("blocks click-to-position", () => {
      const t = new TextInput({ value: "abcdef", disabled: true });
      t.bounds = { x: 0, y: 0, width: 10, height: 1 };
      t.handleMouse(mouseDownAt(3));
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

    it("shows placeholder when focused and value is empty", () => {
      const t = new TextInput({ placeholder: "enter name" });
      t.focus();
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
      t.focus();
      const text = renderText(t);
      expect(text).not.toContain("enter name");
      expect(text).toContain("x");
    });

    it("renders one cursor cell when focused", () => {
      const t = new TextInput({ value: "ab" });
      t.focus();
      const segments = [...t.render(RENDER)];
      // cursor segment uses bgcolor=primary palette colour
      const cursorSeg = segments.find(
        (s) => s.style?.bgcolor !== undefined && s.style?.bgcolor.name !== "#333333",
      );
      expect(cursorSeg).toBeDefined();
      expect(cursorSeg!.text.length).toBe(1);
    });

    it("renders dimmed when disabled", () => {
      const t = new TextInput({ value: "ab", disabled: true });
      const segments = [...t.render(RENDER)];
      expect(segments.every((s) => s.style?.dim === true)).toBe(true);
    });

    it("emits the same total width focused vs unfocused", () => {
      const t = new TextInput({ value: "abc" });
      const before = renderText(t).length;
      t.focus();
      const after = renderText(t).length;
      expect(before).toBe(after);
    });

    it("focused empty placeholder still produces a fixed width", () => {
      const t = new TextInput({ placeholder: "name" });
      const unfocused = renderText(t).length;
      t.focus();
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

    it("maximum tracks max(value.length, placeholder.length) + 2 with floor at minimum", () => {
      const empty = new TextInput();
      expect(empty.measure(RENDER).maximum).toBe(10);

      const longer = new TextInput({ value: "abcdefghijklmnop" });
      expect(longer.measure(RENDER).maximum).toBe(18);

      const placeholderOnly = new TextInput({ placeholder: "abcdefghijklmnop" });
      expect(placeholderOnly.measure(RENDER).maximum).toBe(18);
    });
  });

  // ─── Readline / multiline behaviors ────────────────────────────────────

  describe("readline motion (Ctrl-modified)", () => {
    it("Ctrl+A moves cursor to line start", () => {
      const t = new TextInput({ value: "hello" });
      t.cursorPosition = 3;
      t.handleKey(ctrl("a"));
      expect(t.cursorPosition).toBe(0);
    });

    it("Ctrl+E moves cursor to line end", () => {
      const t = new TextInput({ value: "hello" });
      t.cursorPosition = 1;
      t.handleKey(ctrl("e"));
      expect(t.cursorPosition).toBe(5);
    });

    it("Ctrl+B / Ctrl+F are aliases for left / right", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = 1;
      t.handleKey(ctrl("b"));
      expect(t.cursorPosition).toBe(0);
      t.handleKey(ctrl("f"));
      t.handleKey(ctrl("f"));
      expect(t.cursorPosition).toBe(2);
    });

    it("Ctrl+H is a synonym for backspace", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = 3;
      t.handleKey(ctrl("h"));
      expect(t.value).toBe("ab");
      expect(t.cursorPosition).toBe(2);
    });

    it("Ctrl+D forward-deletes (synonym for Delete)", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = 1;
      t.handleKey(ctrl("d"));
      expect(t.value).toBe("ac");
      expect(t.cursorPosition).toBe(1);
    });

    it("Ctrl+W kills the previous whitespace-bounded word", () => {
      const t = new TextInput({ value: "foo bar baz" });
      t.cursorPosition = 11;
      t.handleKey(ctrl("w"));
      expect(t.value).toBe("foo bar ");
      expect(t.cursorPosition).toBe(8);
    });

    it("Ctrl+W with trailing whitespace skips it first", () => {
      const t = new TextInput({ value: "foo bar  " });
      t.cursorPosition = 9;
      t.handleKey(ctrl("w"));
      expect(t.value).toBe("foo ");
      expect(t.cursorPosition).toBe(4);
    });

    it("Ctrl+U kills back to line start", () => {
      const t = new TextInput({ value: "hello" });
      t.cursorPosition = 3;
      t.handleKey(ctrl("u"));
      expect(t.value).toBe("lo");
      expect(t.cursorPosition).toBe(0);
    });

    it("Ctrl+K kills to line end", () => {
      const t = new TextInput({ value: "hello" });
      t.cursorPosition = 2;
      t.handleKey(ctrl("k"));
      expect(t.value).toBe("he");
      expect(t.cursorPosition).toBe(2);
    });

    it("Ctrl+Y yanks the most recent kill", () => {
      const t = new TextInput({ value: "hello" });
      t.cursorPosition = 5;
      t.handleKey(ctrl("u"));           // kill "hello"; value="", cursor=0
      t.handleKey(ctrl("y"));           // paste "hello" at cursor 0
      expect(t.value).toBe("hello");
      expect(t.cursorPosition).toBe(5);
    });

    it("Ctrl+T transposes mid-string (swap + advance)", () => {
      const t = new TextInput({ value: "abcd" });
      t.cursorPosition = 2;             // between 'b' and 'c'
      t.handleKey(ctrl("t"));
      expect(t.value).toBe("acbd");
      expect(t.cursorPosition).toBe(3);
    });

    it("Ctrl+T at end-of-string swaps the trailing two without advancing", () => {
      const t = new TextInput({ value: "abcd" });
      t.cursorPosition = 4;
      t.handleKey(ctrl("t"));
      expect(t.value).toBe("abdc");
      expect(t.cursorPosition).toBe(4);
    });

    it("Ctrl+Left / Ctrl+Right do word motion", () => {
      const t = new TextInput({ value: "foo bar baz" });
      t.cursorPosition = 11;
      t.handleKey({ key: "left", character: "", shift: false, ctrl: true, meta: false });
      expect(t.cursorPosition).toBe(8);
      t.handleKey({ key: "left", character: "", shift: false, ctrl: true, meta: false });
      expect(t.cursorPosition).toBe(4);
      t.handleKey({ key: "right", character: "", shift: false, ctrl: true, meta: false });
      expect(t.cursorPosition).toBe(7);  // end of "bar"
    });

    it("Ctrl+Home / Ctrl+End jump to document bounds", () => {
      const t = new TextInput({ value: "line1\nline2\nline3", multiline: true });
      t.cursorPosition = 8;
      t.handleKey({ key: "home", character: "", shift: false, ctrl: true, meta: false });
      expect(t.cursorPosition).toBe(0);
      t.handleKey({ key: "end", character: "", shift: false, ctrl: true, meta: false });
      expect(t.cursorPosition).toBe(17);
    });
  });

  describe("alt-modified motion / editing", () => {
    it("Alt+B / Alt+F do word motion", () => {
      const t = new TextInput({ value: "foo bar baz" });
      t.cursorPosition = 11;
      t.handleKey(alt("b"));
      expect(t.cursorPosition).toBe(8);
      t.handleKey(alt("f"));
      expect(t.cursorPosition).toBe(11);
    });

    it("Alt+D deletes the next word forward", () => {
      const t = new TextInput({ value: "foo bar baz" });
      t.cursorPosition = 0;
      t.handleKey(alt("d"));
      expect(t.value).toBe(" bar baz");
      expect(t.cursorPosition).toBe(0);
    });

    it("Alt+Backspace kills the previous word", () => {
      const t = new TextInput({ value: "foo bar baz" });
      t.cursorPosition = 11;
      t.handleKey({ key: "backspace", character: "", shift: false, ctrl: false, meta: true });
      expect(t.value).toBe("foo bar ");
    });
  });

  describe("multiline mode", () => {
    it("Enter inserts a newline rather than submitting", () => {
      const t = new TextInput({ value: "ab", multiline: true });
      t.cursorPosition = 1;
      const submits: InteractiveWidget[] = [];
      t.onSubmit((w) => submits.push(w));
      t.handleKey(enterEvent);
      expect(t.value).toBe("a\nb");
      expect(t.cursorPosition).toBe(2);
      expect(submits).toHaveLength(0);
    });

    it("Ctrl+Enter still submits in multiline mode", () => {
      const t = new TextInput({ value: "hi", multiline: true });
      const submits: InteractiveWidget[] = [];
      t.onSubmit((w) => submits.push(w));
      t.handleKey({ key: "enter", character: "\r", shift: false, ctrl: true, meta: false });
      expect(submits).toHaveLength(1);
      expect(t.value).toBe("hi");
    });

    it("Up arrow moves to the same column on the previous line", () => {
      const t = new TextInput({ value: "abcdef\nxyz", multiline: true });
      t.cursorPosition = 9;             // between 'y' and 'z' on line 2 (col 2)
      t.handleKey(upEvent);
      expect(t.cursorPosition).toBe(2); // col 2 on line 1
    });

    it("Down arrow preserves the preferred column across short lines", () => {
      const t = new TextInput({ value: "abcdef\nxy\nuvwxyz", multiline: true });
      t.cursorPosition = 5;             // col 5 on line 1
      t.handleKey(downEvent);
      expect(t.cursorPosition).toBe(9); // line 2 only has 2 chars; clamp to its end
      t.handleKey(downEvent);
      expect(t.cursorPosition).toBe(15); // line 3 col 5 ('z' position) — preferred col restored
    });

    it("Up at first line is a no-op", () => {
      const t = new TextInput({ value: "abc\ndef", multiline: true });
      t.cursorPosition = 2;
      t.handleKey(upEvent);
      expect(t.cursorPosition).toBe(2);
    });

    it("Down at last line is a no-op", () => {
      const t = new TextInput({ value: "abc\ndef", multiline: true });
      t.cursorPosition = 6;
      t.handleKey(downEvent);
      expect(t.cursorPosition).toBe(6);
    });

    it("Home jumps to the start of the current logical line, not the value", () => {
      const t = new TextInput({ value: "abc\ndef\nghi", multiline: true });
      t.cursorPosition = 6;             // 'f' on line 2
      t.handleKey(homeEvent);
      expect(t.cursorPosition).toBe(4); // start of line 2
    });

    it("End jumps to the end of the current logical line, not the value", () => {
      const t = new TextInput({ value: "abc\ndef\nghi", multiline: true });
      t.cursorPosition = 5;             // 'e' on line 2
      t.handleKey(endEvent);
      expect(t.cursorPosition).toBe(7); // end of line 2
    });

    it("Ctrl+K at the end of a non-last line joins the next line", () => {
      const t = new TextInput({ value: "abc\ndef", multiline: true });
      t.cursorPosition = 3;             // end of line 1
      t.handleKey(ctrl("k"));
      expect(t.value).toBe("abcdef");
      expect(t.cursorPosition).toBe(3);
    });

    it("multiline=false preserves the legacy Enter=submit behavior", () => {
      const t = new TextInput({ value: "hi" });
      const submits: InteractiveWidget[] = [];
      t.onSubmit((w) => submits.push(w));
      t.handleKey(enterEvent);
      expect(submits).toHaveLength(1);
      expect(t.value).toBe("hi");
    });
  });

  describe("hit-testing", () => {
    it("hit-tests against bounds", () => {
      const t = new TextInput();
      expect(t.containsPoint(0, 0)).toBe(false);
      t.bounds = { x: 0, y: 0, width: 10, height: 1 };
      expect(t.containsPoint(0, 0)).toBe(true);
      expect(t.containsPoint(9, 0)).toBe(true);
      expect(t.containsPoint(10, 0)).toBe(false);
    });
  });
});
