import { describe, it, expect } from "vitest";
import { TextInput, charGreedyWrap, type WrapStrategy } from "../../src/widgets/text-input.js";
import { asCodeUnit } from "../../src/core/cells.js";
import { KeyEvent } from "../../src/widgets/types.js";
import type { InteractiveWidget, WidgetMouseEvent } from "../../src/widgets/types.js";

// Factories — KeyEvent carries a mutable `stopped` flag; fresh per call.
const makeKey = (key: string, character = ""): KeyEvent => new KeyEvent({
  key,
  character,
  shift: false,
  ctrl: false,
  meta: false,
});

const ctrl = (key: string): KeyEvent => new KeyEvent({
  key,
  character: "",
  shift: false,
  ctrl: true,
  meta: false,
});

const alt = (key: string): KeyEvent => new KeyEvent({
  key,
  character: "",
  shift: false,
  ctrl: false,
  meta: true,
});

const upEvent = () => makeKey("up");
const downEvent = () => makeKey("down");

const printable = (ch: string): KeyEvent => new KeyEvent({
  key: ch,
  character: ch,
  shift: false,
  ctrl: false,
  meta: false,
});

const enterEvent = () => makeKey("enter", "\r");
const escapeEvent = () => makeKey("escape", "\x1b");
const backspaceEvent = () => makeKey("backspace", "\x08");
const deleteEvent = () => makeKey("delete");
const leftEvent = () => makeKey("left");
const rightEvent = () => makeKey("right");
const homeEvent = () => makeKey("home");
const endEvent = () => makeKey("end");

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
    const text = [...t.render({ maxWidth: 20 })].map((s) => s.text).join("");
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
      t.cursorPosition = asCodeUnit(1);
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
      t.handleKey(new KeyEvent({ key: "a", character: "a", shift: false, ctrl: true, meta: false }));
      expect(t.value).toBe("");
    });
  });

  describe("deletion", () => {
    it("backspace removes the char before cursor and decrements", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = asCodeUnit(2);
      t.handleKey(backspaceEvent());
      expect(t.value).toBe("ac");
      expect(t.cursorPosition).toBe(1);
    });

    it("backspace at position 0 is a no-op", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = asCodeUnit(0);
      const changes: InteractiveWidget[] = [];
      t.onChange((w) => changes.push(w));
      t.handleKey(backspaceEvent());
      expect(t.value).toBe("abc");
      expect(t.cursorPosition).toBe(0);
      expect(changes).toHaveLength(0);
    });

    it("delete removes the char after cursor without moving it", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = asCodeUnit(1);
      t.handleKey(deleteEvent());
      expect(t.value).toBe("ac");
      expect(t.cursorPosition).toBe(1);
    });

    it("delete at end is a no-op", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = asCodeUnit(3);
      t.handleKey(deleteEvent());
      expect(t.value).toBe("abc");
    });
  });

  describe("cursor movement", () => {
    it("left moves cursor back, clamped at 0", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = asCodeUnit(2);
      t.handleKey(leftEvent());
      expect(t.cursorPosition).toBe(1);
      t.handleKey(leftEvent());
      t.handleKey(leftEvent());
      expect(t.cursorPosition).toBe(0);
    });

    it("right moves cursor forward, clamped at value.length", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = asCodeUnit(1);
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
      t.cursorPosition = asCodeUnit(0);
      t.handleKey(endEvent());
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
      t.cursorPosition = asCodeUnit(1);
      t.handleMouse(mouseDownAt(2));
      expect(t.cursorPosition).toBe(1);
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
      t.cursorPosition = asCodeUnit(2);
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
      t.cursorPosition = asCodeUnit(3);
      t.handleKey(ctrl("a"));
      expect(t.cursorPosition).toBe(0);
    });

    it("Ctrl+E moves cursor to line end", () => {
      const t = new TextInput({ value: "hello" });
      t.cursorPosition = asCodeUnit(1);
      t.handleKey(ctrl("e"));
      expect(t.cursorPosition).toBe(5);
    });

    it("Ctrl+B / Ctrl+F are aliases for left / right", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = asCodeUnit(1);
      t.handleKey(ctrl("b"));
      expect(t.cursorPosition).toBe(0);
      t.handleKey(ctrl("f"));
      t.handleKey(ctrl("f"));
      expect(t.cursorPosition).toBe(2);
    });

    it("Ctrl+H is a synonym for backspace", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = asCodeUnit(3);
      t.handleKey(ctrl("h"));
      expect(t.value).toBe("ab");
      expect(t.cursorPosition).toBe(2);
    });

    it("Ctrl+D forward-deletes (synonym for Delete)", () => {
      const t = new TextInput({ value: "abc" });
      t.cursorPosition = asCodeUnit(1);
      t.handleKey(ctrl("d"));
      expect(t.value).toBe("ac");
      expect(t.cursorPosition).toBe(1);
    });

    it("Ctrl+W kills the previous whitespace-bounded word", () => {
      const t = new TextInput({ value: "foo bar baz" });
      t.cursorPosition = asCodeUnit(11);
      t.handleKey(ctrl("w"));
      expect(t.value).toBe("foo bar ");
      expect(t.cursorPosition).toBe(8);
    });

    it("Ctrl+W with trailing whitespace skips it first", () => {
      const t = new TextInput({ value: "foo bar  " });
      t.cursorPosition = asCodeUnit(9);
      t.handleKey(ctrl("w"));
      expect(t.value).toBe("foo ");
      expect(t.cursorPosition).toBe(4);
    });

    it("Ctrl+U kills back to line start", () => {
      const t = new TextInput({ value: "hello" });
      t.cursorPosition = asCodeUnit(3);
      t.handleKey(ctrl("u"));
      expect(t.value).toBe("lo");
      expect(t.cursorPosition).toBe(0);
    });

    it("Ctrl+K kills to line end", () => {
      const t = new TextInput({ value: "hello" });
      t.cursorPosition = asCodeUnit(2);
      t.handleKey(ctrl("k"));
      expect(t.value).toBe("he");
      expect(t.cursorPosition).toBe(2);
    });

    it("Ctrl+Y yanks the most recent kill", () => {
      const t = new TextInput({ value: "hello" });
      t.cursorPosition = asCodeUnit(5);
      t.handleKey(ctrl("u"));           // kill "hello"; value="", cursor=0
      t.handleKey(ctrl("y"));           // paste "hello" at cursor 0
      expect(t.value).toBe("hello");
      expect(t.cursorPosition).toBe(5);
    });

    it("Ctrl+T transposes mid-string (swap + advance)", () => {
      const t = new TextInput({ value: "abcd" });
      t.cursorPosition = asCodeUnit(2);             // between 'b' and 'c'
      t.handleKey(ctrl("t"));
      expect(t.value).toBe("acbd");
      expect(t.cursorPosition).toBe(3);
    });

    it("Ctrl+T at end-of-string swaps the trailing two without advancing", () => {
      const t = new TextInput({ value: "abcd" });
      t.cursorPosition = asCodeUnit(4);
      t.handleKey(ctrl("t"));
      expect(t.value).toBe("abdc");
      expect(t.cursorPosition).toBe(4);
    });

    it("Ctrl+Left / Ctrl+Right do word motion", () => {
      const t = new TextInput({ value: "foo bar baz" });
      t.cursorPosition = asCodeUnit(11);
      t.handleKey(new KeyEvent({ key: "left", character: "", shift: false, ctrl: true, meta: false }));
      expect(t.cursorPosition).toBe(8);
      t.handleKey(new KeyEvent({ key: "left", character: "", shift: false, ctrl: true, meta: false }));
      expect(t.cursorPosition).toBe(4);
      t.handleKey(new KeyEvent({ key: "right", character: "", shift: false, ctrl: true, meta: false }));
      expect(t.cursorPosition).toBe(7);  // end of "bar"
    });

    it("Ctrl+Home / Ctrl+End jump to document bounds", () => {
      const t = new TextInput({ value: "line1\nline2\nline3", multiline: true });
      t.cursorPosition = asCodeUnit(8);
      t.handleKey(new KeyEvent({ key: "home", character: "", shift: false, ctrl: true, meta: false }));
      expect(t.cursorPosition).toBe(0);
      t.handleKey(new KeyEvent({ key: "end", character: "", shift: false, ctrl: true, meta: false }));
      expect(t.cursorPosition).toBe(17);
    });
  });

  describe("alt-modified motion / editing", () => {
    it("Alt+B / Alt+F do word motion", () => {
      const t = new TextInput({ value: "foo bar baz" });
      t.cursorPosition = asCodeUnit(11);
      t.handleKey(alt("b"));
      expect(t.cursorPosition).toBe(8);
      t.handleKey(alt("f"));
      expect(t.cursorPosition).toBe(11);
    });

    it("Alt+D deletes the next word forward", () => {
      const t = new TextInput({ value: "foo bar baz" });
      t.cursorPosition = asCodeUnit(0);
      t.handleKey(alt("d"));
      expect(t.value).toBe(" bar baz");
      expect(t.cursorPosition).toBe(0);
    });

    it("Alt+Backspace kills the previous word", () => {
      const t = new TextInput({ value: "foo bar baz" });
      t.cursorPosition = asCodeUnit(11);
      t.handleKey(new KeyEvent({ key: "backspace", character: "", shift: false, ctrl: false, meta: true }));
      expect(t.value).toBe("foo bar ");
    });
  });

  describe("multiline mode", () => {
    it("Enter inserts a newline rather than submitting", () => {
      const t = new TextInput({ value: "ab", multiline: true });
      t.cursorPosition = asCodeUnit(1);
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
      t.handleKey(new KeyEvent({ key: "enter", character: "\r", shift: false, ctrl: true, meta: false }));
      expect(submits).toHaveLength(1);
      expect(t.value).toBe("hi");
    });

    it("Up arrow moves to the same column on the previous line", () => {
      const t = new TextInput({ value: "abcdef\nxyz", multiline: true });
      t.cursorPosition = asCodeUnit(9);             // between 'y' and 'z' on line 2 (col 2)
      t.handleKey(upEvent());
      expect(t.cursorPosition).toBe(2); // col 2 on line 1
    });

    it("Down arrow preserves the preferred column across short lines", () => {
      const t = new TextInput({ value: "abcdef\nxy\nuvwxyz", multiline: true });
      t.cursorPosition = asCodeUnit(5);             // col 5 on line 1
      t.handleKey(downEvent());
      expect(t.cursorPosition).toBe(9); // line 2 only has 2 chars; clamp to its end
      t.handleKey(downEvent());
      expect(t.cursorPosition).toBe(15); // line 3 col 5 ('z' position) — preferred col restored
    });

    it("Up at first line is a no-op", () => {
      const t = new TextInput({ value: "abc\ndef", multiline: true });
      t.cursorPosition = asCodeUnit(2);
      t.handleKey(upEvent());
      expect(t.cursorPosition).toBe(2);
    });

    it("Down at last line is a no-op", () => {
      const t = new TextInput({ value: "abc\ndef", multiline: true });
      t.cursorPosition = asCodeUnit(6);
      t.handleKey(downEvent());
      expect(t.cursorPosition).toBe(6);
    });

    it("Home jumps to the start of the current logical line, not the value", () => {
      const t = new TextInput({ value: "abc\ndef\nghi", multiline: true });
      t.cursorPosition = asCodeUnit(6);             // 'f' on line 2
      t.handleKey(homeEvent());
      expect(t.cursorPosition).toBe(4); // start of line 2
    });

    it("End jumps to the end of the current logical line, not the value", () => {
      const t = new TextInput({ value: "abc\ndef\nghi", multiline: true });
      t.cursorPosition = asCodeUnit(5);             // 'e' on line 2
      t.handleKey(endEvent());
      expect(t.cursorPosition).toBe(7); // end of line 2
    });

    it("Ctrl+K at the end of a non-last line joins the next line", () => {
      const t = new TextInput({ value: "abc\ndef", multiline: true });
      t.cursorPosition = asCodeUnit(3);             // end of line 1
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
      const text = [...t.render(RENDER_NARROW)].map((s) => s.text).join("");
      // Three lines joined by \n; no continuation marker.
      expect(text).toBe("a\nb\nc");
    });

    it("renders the continuation marker for soft-wrapped rows", () => {
      const t = new TextInput({
        value: "abcdefghijklmno",       // 15 chars
        multiline: true,
        wrap: charGreedyWrap,
      });
      // firstWidth = 10, continuationWidth = 10 - cellLen("↳ ") = 8
      // → row 0: "abcdefghij" (10), row 1: continuation "klmno" (5)
      const text = [...t.render(RENDER_NARROW)].map((s) => s.text).join("");
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
      t.cursorPosition = asCodeUnit(13);            // on visual row 1 (continuation), col 3
      t.handleKey(new KeyEvent({ key: "up", character: "", shift: false, ctrl: false, meta: false }));
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
      t.cursorPosition = asCodeUnit(4);             // visual row 0, col 4
      t.handleKey(new KeyEvent({ key: "down", character: "", shift: false, ctrl: false, meta: false }));
      // Visual row 1 starts at value-offset 10; col 4 → 14
      expect(t.cursorPosition).toBe(14);
    });

    it("custom wrap strategy is invoked and its rows drive motion", () => {
      let called = 0;
      const strategy: WrapStrategy = (line, { firstWidth, continuationWidth }) => {
        called++;
        // Break at every 4 chars regardless of width.
        const rows: { content: string; start: ReturnType<typeof asCodeUnit> }[] = [];
        let p = 0;
        while (p < line.length) {
          const take = Math.min(4, line.length - p);
          rows.push({ content: line.slice(p, p + take), start: asCodeUnit(p) });
          p += take;
        }
        // Reference unused params so the type isn't dropped.
        void firstWidth; void continuationWidth;
        return rows;
      };
      const t = new TextInput({ value: "abcdefgh", multiline: true, wrap: strategy });
      [...t.render({ maxWidth: 80 })];
      expect(called).toBeGreaterThan(0);
      t.cursorPosition = asCodeUnit(0);
      t.handleKey(new KeyEvent({ key: "down", character: "", shift: false, ctrl: false, meta: false }));
      // Visual row 1 starts at offset 4 (per the custom strategy)
      expect(t.cursorPosition).toBe(4);
    });

    it("maxRows scrolls the cursor row into view", () => {
      const t = new TextInput({
        value: "a\nb\nc\nd\ne",            // 5 logical lines
        multiline: true,
        maxRows: 2,
      });
      t.cursorPosition = asCodeUnit(8);                 // on line 5 ("e")
      const text = [...t.render({ maxWidth: 20 })].map((s) => s.text).join("");
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
      t.cursorPosition = value.length;
      let text = [...t.render({ maxWidth: 20 })].map((s) => s.text).join("");
      expect(text).toContain("7");
      expect(text).toContain("8");
      expect(text).toContain("9");
      expect(text).not.toContain("6");

      // Up once: cursor moves from row 9 to row 8 — still inside viewport
      // (rows 7..9). Viewport must NOT scroll.
      t.handleKey(upEvent());
      text = [...t.render({ maxWidth: 20 })].map((s) => s.text).join("");
      expect(text).toContain("7");
      expect(text).toContain("8");
      expect(text).toContain("9");
      expect(text).not.toContain("6");

      // Up again: cursor at row 7, still inside viewport. No scroll.
      t.handleKey(upEvent());
      text = [...t.render({ maxWidth: 20 })].map((s) => s.text).join("");
      expect(text).toContain("7");
      expect(text).toContain("9");
      expect(text).not.toContain("6");

      // Up once more: cursor at row 6, now ABOVE viewport → scroll up by one.
      t.handleKey(upEvent());
      text = [...t.render({ maxWidth: 20 })].map((s) => s.text).join("");
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
      t.cursorPosition = t.value.length;
      [...t.render({ maxWidth: 20 })];  // viewport scrolls to rows 7..9
      // Delete back to a 4-row value.
      t.value = "0\n1\n2\n3";
      t.cursorPosition = t.value.length;
      const text = [...t.render({ maxWidth: 20 })].map((s) => s.text).join("");
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
      const text = [...t.render({ maxWidth: 20 })].map((s) => s.text).join("");
      expect(text).not.toContain("▲");
      expect(text).toContain("▼");
    });

    it("scroll arrows: at bottom of scrollable content shows ▲ only (no ▼)", () => {
      const t = new TextInput({
        value: "0\n1\n2\n3\n4\n5\n6\n7\n8\n9",
        multiline: true,
        maxRows: 3,
      });
      t.cursorPosition = t.value.length;
      const text = [...t.render({ maxWidth: 20 })].map((s) => s.text).join("");
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
      t.cursorPosition = t.value.length;
      [...t.render({ maxWidth: 20 })];      // scrollStart = 7
      t.handleKey(upEvent());                  // cursor row 8 → still in viewport
      t.handleKey(upEvent());                  // cursor row 7 → still in viewport
      t.handleKey(upEvent());                  // cursor row 6 → scrolls to 6
      const text = [...t.render({ maxWidth: 20 })].map((s) => s.text).join("");
      expect(text).toContain("▲");
      expect(text).toContain("▼");
    });

    it("scroll arrows: hidden entirely when content fits within maxRows", () => {
      const t = new TextInput({ value: "0\n1\n2", multiline: true, maxRows: 5 });
      const text = [...t.render({ maxWidth: 20 })].map((s) => s.text).join("");
      expect(text).not.toContain("▲");
      expect(text).not.toContain("▼");
    });

    it("scroll arrows: hidden when maxRows is unset", () => {
      const t = new TextInput({ value: "0\n1\n2\n3\n4", multiline: true });
      const text = [...t.render({ maxWidth: 20 })].map((s) => s.text).join("");
      expect(text).not.toContain("▲");
      expect(text).not.toContain("▼");
    });

    it("scrollIndicator='indices': suppresses arrows, exposes [X/Y] text", () => {
      const t = new TextInput({
        value: "0\n1\n2\n3\n4\n5\n6\n7\n8\n9",
        multiline: true,
        maxRows: 3,
        scrollIndicator: "indices",
      });
      // First render populates the visual-row cache that the getter reads.
      const text = [...t.render({ maxWidth: 20 })].map((s) => s.text).join("");
      expect(text).not.toContain("▲");
      expect(text).not.toContain("▼");
      // Cursor defaults to 0 in multiline → row 1 of 10.
      expect(t.scrollIndicatorText).toBe("[1/10]");
      // Move cursor to end → row 10 of 10.
      t.cursorPosition = t.value.length;
      [...t.render({ maxWidth: 20 })];
      expect(t.scrollIndicatorText).toBe("[10/10]");
    });

    it("scrollIndicator='indices': returns undefined when nothing to scroll", () => {
      const t = new TextInput({
        value: "0\n1\n2",
        multiline: true,
        maxRows: 5,
        scrollIndicator: "indices",
      });
      [...t.render({ maxWidth: 20 })];
      expect(t.scrollIndicatorText).toBeUndefined();
    });

    it("scrollIndicator='none': no arrows, no text", () => {
      const t = new TextInput({
        value: "0\n1\n2\n3\n4\n5\n6\n7\n8\n9",
        multiline: true,
        maxRows: 3,
        scrollIndicator: "none",
      });
      const text = [...t.render({ maxWidth: 20 })].map((s) => s.text).join("");
      expect(text).not.toContain("▲");
      expect(text).not.toContain("▼");
      expect(t.scrollIndicatorText).toBeUndefined();
    });

    it("scrollIndicatorText is undefined in default 'arrows' mode", () => {
      const t = new TextInput({
        value: "0\n1\n2\n3\n4\n5\n6\n7\n8\n9",
        multiline: true,
        maxRows: 3,
      });
      [...t.render({ maxWidth: 20 })];
      // Defaults to arrows; the indices text is only published in 'indices' mode.
      expect(t.scrollIndicatorText).toBeUndefined();
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
      expect(t._visualRows!.length).toBe(1);
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
      t.cursorPosition = asCodeUnit(3);
      t.handleKey(new KeyEvent({ key: "up", character: "", shift: false, ctrl: false, meta: false }));
      expect(t.cursorPosition).toBe(3);
    });

    it("Down at last visual row (wrap active) is a no-op", () => {
      const t = new TextInput({
        value: "abcdefghijklmno",
        multiline: true,
        wrap: charGreedyWrap,
      });
      [...t.render(RENDER_NARROW)];
      t.cursorPosition = asCodeUnit(13);
      t.handleKey(new KeyEvent({ key: "down", character: "", shift: false, ctrl: false, meta: false }));
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
      if (line.length === 0) return [{ content: "", start: 0 }];
      if (line.length === 1) return [{ content: line, start: 0 }];
      const out: { content: string; start: number }[] = [{ content: line[0]!, start: 0 }];
      let p = 1;
      while (p < line.length) {
        const take = Math.min(continuationWidth, line.length - p);
        out.push({ content: line.slice(p, p + take), start: p });
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
      const rows = t._visualRows!;
      // Expected shape: row 0 "a" (vs=0, len=1, cont=false),
      //                 row 1 long continuation (vs=1, ...).
      expect(rows[0]!.content).toBe("a");
      expect(rows[1]!.isContinuation).toBe(true);
      expect(rows.length).toBeGreaterThanOrEqual(2);

      // Park cursor on the continuation row at col 5 (well past head.length=1).
      t.cursorPosition = rows[1]!.valueStart + 5;
      expect(t._cursorVisualRow()).toBe(1);

      t.handleKey(new KeyEvent({ key: "up", character: "", shift: false, ctrl: false, meta: false }));

      // Pre-fix: cursorPosition would be `rows[0].valueStart + 1 = 1`, which
      // equals `rows[1].valueStart` — the boundary — and `_cursorVisualRow`
      // would still report row 1. Post-fix: clamp to `length - 1 = 0`,
      // cursor lands at `rows[0].valueStart = 0`, unambiguously row 0.
      expect(t.cursorPosition).toBe(0);
      expect(t._cursorVisualRow()).toBe(0);
    });

    it("repeated Up across the trap row makes progress every press (no stuck position)", () => {
      const t = new TextInput({
        value: "x\nabcdefghijklmno",  // line 0 "x" (one row), line 1 wraps via tinyHeadWrap
        multiline: true,
        wrap: tinyHeadWrap,
      });
      [...t.render({ maxWidth: 20 })];
      const rows = t._visualRows!;
      // rows: [row 0 "x"], [row 1 "a" head of line 1], [row 2 long cont], ...
      // Park cursor on row 2 (continuation) at col 5.
      t.cursorPosition = rows[2]!.valueStart + 5;

      const positions: number[] = [t.cursorPosition];
      for (let i = 0; i < 3; i++) {
        t.handleKey(new KeyEvent({ key: "up", character: "", shift: false, ctrl: false, meta: false }));
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
      const rows = t._visualRows!;
      // From a row above the tinyHeadWrap line, Down at col 5 should land
      // unambiguously inside the head row (length 1), which means cursor
      // must clamp to col 0, not col 1 (the boundary).
      // First find the head row of line 1.
      const head = rows.findIndex((r) => r.content === "a" && !r.isContinuation);
      expect(head).toBeGreaterThan(0);

      // Park cursor on the row right above `head` at col 5.
      t.cursorPosition = rows[head - 1]!.valueStart + 5;
      t.handleKey(new KeyEvent({ key: "down", character: "", shift: false, ctrl: false, meta: false }));

      // Cursor should be on row `head` (valueStart), NOT at row `head+1`'s boundary.
      expect(t.cursorPosition).toBe(rows[head]!.valueStart);
      expect(t._cursorVisualRow()).toBe(head);
    });

    it("preferred column survives motion through a short wrap row", () => {
      const t = new TextInput({
        // 3 logical lines: long / short / long. Wrap will further split lines.
        value: "abcdefghij\nxy\nuvwxyz",
        multiline: true,
        wrap: charGreedyWrap,
      });
      [...t.render(RENDER_NARROW)];
      t.cursorPosition = asCodeUnit(6);                 // col 6 on visual row 0 of line 1
      t.handleKey(new KeyEvent({ key: "down", character: "", shift: false, ctrl: false, meta: false }));
      // Visual row 1 = "xy" (start=11, length 2) → clamped to col 2 → pos 13
      expect(t.cursorPosition).toBe(13);
      t.handleKey(new KeyEvent({ key: "down", character: "", shift: false, ctrl: false, meta: false }));
      // Visual row 2 = "uvwxyz" (start=14, length 6) → preferred col 6 → pos 20
      expect(t.cursorPosition).toBe(20);
    });
  });

  describe("charGreedyWrap", () => {
    it("returns one row for an empty line", () => {
      const rows = charGreedyWrap("", { firstWidth: 10, continuationWidth: 8 });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.content).toBe("");
      expect(rows[0]!.start).toBe(0);
    });

    it("splits at firstWidth then at continuationWidth", () => {
      const rows = charGreedyWrap("0123456789abcdefghij", { firstWidth: 10, continuationWidth: 5 });
      expect(rows[0]!.content).toBe("0123456789");
      expect(rows[0]!.start).toBe(0);
      expect(rows[1]!.content).toBe("abcde");
      expect(rows[1]!.start).toBe(10);
      expect(rows[2]!.content).toBe("fghij");
      expect(rows[2]!.start).toBe(15);
    });

    it("returns a single row when line fits in firstWidth", () => {
      const rows = charGreedyWrap("short", { firstWidth: 10, continuationWidth: 8 });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.content).toBe("short");
    });

    // Wide-char (CJK) tests — each CJK character is 1 code unit but 2 cells.
    it("does not overflow budget for wide chars (CJK)", () => {
      // "AAあ" = 3 code units, 4 cells.  Budget of 3 cells → "AA" (2 cells) fits,
      // "あ" (2 cells) does not; it must go to the next row.
      const rows = charGreedyWrap("AAあ", { firstWidth: 3, continuationWidth: 3 });
      expect(rows).toHaveLength(2);
      expect(rows[0]!.content).toBe("AA");
      expect(rows[1]!.content).toBe("あ");
      // start values are code-unit offsets: "AA" starts at 0, "あ" starts at 2
      expect(rows[0]!.start).toBe(0);
      expect(rows[1]!.start).toBe(2);
    });

    it("places a leading wide char on its own row when budget is 2 cells", () => {
      // "あAA" — wide char first.  Budget 2 → "あ" fits (2 cells), then "AA".
      const rows = charGreedyWrap("あAA", { firstWidth: 2, continuationWidth: 2 });
      expect(rows).toHaveLength(2);
      expect(rows[0]!.content).toBe("あ");
      expect(rows[1]!.content).toBe("AA");
    });

    it("force-takes a wide char when budget is 1 cell (no infinite loop)", () => {
      // Degenerate: budget too narrow for the wide char.  Force-take to avoid
      // an infinite loop.
      const rows = charGreedyWrap("あ", { firstWidth: 1, continuationWidth: 1 });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.content).toBe("あ");
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
      t.cursorPosition = asCodeUnit(1); // after 日
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
      t.cursorPosition = asCodeUnit(1); // after first 日, cell col 2
      t.moveLineDown();                  // → "A" row, clamped to end (cu 1 from "A" start)
      // "日日\n" = 3 code units; "A" is at cu 3; clamp cell 2→1→cu1 → cursorPosition 4
      expect(t.cursorPosition).toBe(4);
      t.moveLineDown();                  // → "日日" row, preferred col 2 → first 日 end
      // "A\n" = 2 code units from start of "A" row; "日日" starts at cu 5
      // preferred col = 2; cellColToCodeUnitOffset("日日", 2) = 1 (after first 日)
      expect(t.cursorPosition).toBe(6);
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
