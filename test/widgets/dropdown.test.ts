import { describe, it, expect } from "vitest";
import { Dropdown } from "../../src/widgets/dropdown.js";
import { KeyEvent } from "../../src/widgets/types.js";
import type { InteractiveWidget, WidgetMouseEvent } from "../../src/widgets/types.js";
import type { Segment } from "../../src/core/segment.js";

// Factories — KeyEvent carries a mutable `stopped` flag; fresh per call.
const makeKey = (key: string): KeyEvent => new KeyEvent({
  key,
  character: "",
  shift: false,
  ctrl: false,
  meta: false,
});

const enterEvent = () => makeKey("enter");
const spaceEvent = () => makeKey("space");
const escapeEvent = () => makeKey("escape");
const upEvent = () => makeKey("up");
const downEvent = () => makeKey("down");
const backspaceEvent = () => makeKey("backspace");
const tabEvent = () => makeKey("tab");
const shiftTabEvent = () => new KeyEvent({
  key: "tab",
  character: "",
  shift: true,
  ctrl: false,
  meta: false,
});

const charKey = (ch: string): KeyEvent => new KeyEvent({
  key: ch,
  character: ch,
  shift: false,
  ctrl: false,
  meta: false,
});

const mouseUpAt = (x: number, y: number): WidgetMouseEvent => ({
  type: "mouse_up",
  x,
  y,
  button: 0,
  shift: false,
  ctrl: false,
});

const RENDER = { maxWidth: 80 };

describe("Dropdown", () => {
  it("constructs with defaults", () => {
    const d = new Dropdown({ options: ["a", "b", "c"] });
    expect(d.options).toEqual(["a", "b", "c"]);
    expect(d.selectedIndex).toBe(0);
    expect(d.highlightedIndex).toBe(0);
    expect(d.expanded).toBe(false);
    expect(d.focusable).toBe(true);
    expect(d.disabled).toBe(false);
  });

  it("constructs with options", () => {
    const d = new Dropdown({ options: ["a", "b", "c"], selectedIndex: 2, id: "x", disabled: true });
    expect(d.selectedIndex).toBe(2);
    expect(d.highlightedIndex).toBe(2);
    expect(d.id).toBe("x");
    expect(d.disabled).toBe(true);
  });

  it("clamps an out-of-range selectedIndex to the valid range", () => {
    // Without the clamp, an out-of-range selectedIndex left
    // `options[selectedIndex]` as undefined → empty header and a
    // highlightedIndex that pointed past filteredOptions, so the first
    // Enter commit was a silent no-op. Clamp at the trust boundary so the
    // rest of the widget can assume validity.
    const high = new Dropdown({ options: ["a", "b", "c"], selectedIndex: 99 });
    expect(high.selectedIndex).toBe(2);
    expect(high.highlightedIndex).toBe(2);

    const low = new Dropdown({ options: ["a", "b", "c"], selectedIndex: -5 });
    expect(low.selectedIndex).toBe(0);
    expect(low.highlightedIndex).toBe(0);
  });

  it("accepts empty options without throwing", () => {
    // Empty options is a legitimate state (e.g. options populated async).
    // Construction shouldn't throw — render falls back to an empty label
    // and commit becomes a no-op until options are populated.
    const d = new Dropdown({ options: [] });
    expect(d.options).toEqual([]);
    expect(d.selectedIndex).toBe(0);
  });

  it("implements InteractiveWidget", () => {
    const d: InteractiveWidget = new Dropdown({ options: ["a"] });
    expect(typeof d.handleKey).toBe("function");
    expect(typeof d.handleMouse).toBe("function");
    expect(typeof d.render).toBe("function");
    expect(typeof d.measure).toBe("function");
  });

  describe("expansion via keyboard", () => {
    it("enter expands when collapsed", () => {
      const d = new Dropdown({ options: ["a", "b"] });
      d.handleKey(enterEvent());
      expect(d.expanded).toBe(true);
    });

    it("space expands when collapsed", () => {
      const d = new Dropdown({ options: ["a", "b"] });
      d.handleKey(spaceEvent());
      expect(d.expanded).toBe(true);
    });

    it("expanding seeds highlightedIndex from selectedIndex", () => {
      const d = new Dropdown({ options: ["a", "b", "c"], selectedIndex: 2 });
      d.handleKey(enterEvent());
      expect(d.highlightedIndex).toBe(2);
    });

    it("tab while expanded stops the event so the chain suppresses focus traversal", () => {
      const d = new Dropdown({ options: ["a", "b"] });
      d.handleKey(enterEvent()); // expand
      const ev = tabEvent();
      d.handleKey(ev);
      expect(ev.stopped).toBe(true);
      expect(d.expanded).toBe(false);
      expect(d.filter).toBe("");
    });

    it("tab when collapsed does not stop the event so the chain handles focus traversal", () => {
      const d = new Dropdown({ options: ["a", "b"] });
      const ev = tabEvent();
      d.handleKey(ev);
      expect(ev.stopped).toBe(false);
    });

    it("shift+tab while expanded also cancels (direction-agnostic)", () => {
      const d = new Dropdown({ options: ["a", "b"] });
      d.handleKey(enterEvent());
      const ev = shiftTabEvent();
      d.handleKey(ev);
      expect(ev.stopped).toBe(true);
      expect(d.expanded).toBe(false);
    });

    it("tab-to-cancel does not commit selection (no change/submit emitted)", () => {
      const d = new Dropdown({ options: ["a", "b", "c"], selectedIndex: 0 });
      const changes: InteractiveWidget[] = [];
      const submits: InteractiveWidget[] = [];
      d.onChange((w) => changes.push(w));
      d.onSubmit((w) => submits.push(w));
      d.handleKey(enterEvent());
      d.handleKey(downEvent()); // highlighted = 1, but selected still 0
      d.handleKey(tabEvent());
      expect(d.selectedIndex).toBe(0);
      expect(changes).toHaveLength(0);
      expect(submits).toHaveLength(0);
    });

    it("escape collapses without changing selection", () => {
      const d = new Dropdown({ options: ["a", "b", "c"], selectedIndex: 0 });
      d.handleKey(enterEvent());
      d.handleKey(downEvent());
      d.handleKey(escapeEvent());
      expect(d.expanded).toBe(false);
      expect(d.selectedIndex).toBe(0);
    });
  });

  describe("navigation when expanded", () => {
    it("down increments highlightedIndex (clamped)", () => {
      const d = new Dropdown({ options: ["a", "b", "c"] });
      d.handleKey(enterEvent());
      d.handleKey(downEvent());
      expect(d.highlightedIndex).toBe(1);
      d.handleKey(downEvent());
      expect(d.highlightedIndex).toBe(2);
      d.handleKey(downEvent());
      expect(d.highlightedIndex).toBe(2);
    });

    it("up decrements highlightedIndex (clamped)", () => {
      const d = new Dropdown({ options: ["a", "b", "c"], selectedIndex: 2 });
      d.handleKey(enterEvent());
      d.handleKey(upEvent());
      expect(d.highlightedIndex).toBe(1);
      d.handleKey(upEvent());
      expect(d.highlightedIndex).toBe(0);
      d.handleKey(upEvent());
      expect(d.highlightedIndex).toBe(0);
    });

    it("does not change selectedIndex while navigating", () => {
      const d = new Dropdown({ options: ["a", "b", "c"], selectedIndex: 0 });
      d.handleKey(enterEvent());
      d.handleKey(downEvent());
      d.handleKey(downEvent());
      expect(d.selectedIndex).toBe(0);
    });
  });

  describe("selection", () => {
    it("enter while expanded commits highlightedIndex to selectedIndex and collapses", () => {
      const d = new Dropdown({ options: ["a", "b", "c"], selectedIndex: 0 });
      d.handleKey(enterEvent());
      d.handleKey(downEvent());
      d.handleKey(enterEvent());
      expect(d.selectedIndex).toBe(1);
      expect(d.expanded).toBe(false);
    });

    it("enter while expanded fires onChange and onSubmit", () => {
      const d = new Dropdown({ options: ["a", "b"] });
      const changes: InteractiveWidget[] = [];
      const submits: InteractiveWidget[] = [];
      d.onChange((w) => changes.push(w));
      d.onSubmit((w) => submits.push(w));
      d.handleKey(enterEvent());
      d.handleKey(downEvent());
      d.handleKey(enterEvent());
      expect(changes).toHaveLength(1);
      expect(submits).toHaveLength(1);
    });

    it("escape does NOT fire onChange/onSubmit", () => {
      const d = new Dropdown({ options: ["a", "b"] });
      const changes: InteractiveWidget[] = [];
      const submits: InteractiveWidget[] = [];
      d.onChange((w) => changes.push(w));
      d.onSubmit((w) => submits.push(w));
      d.handleKey(enterEvent());
      d.handleKey(downEvent());
      d.handleKey(escapeEvent());
      expect(changes).toHaveLength(0);
      expect(submits).toHaveLength(0);
    });
  });

  describe("mouse", () => {
    it("click inside collapsed bounds expands", () => {
      const d = new Dropdown({ options: ["a", "b", "c"] });
      d.bounds = { x: 0, y: 0, width: 8, height: 1 };
      d.handleMouse(mouseUpAt(2, 0));
      expect(d.expanded).toBe(true);
    });

    it("click on an option row commits selection and collapses", () => {
      const d = new Dropdown({ options: ["a", "b", "c"], selectedIndex: 0 });
      d.handleKey(enterEvent()); // expand
      // bounds with header row 0 at y=0, options at y=1..3
      d.bounds = { x: 0, y: 0, width: 8, height: 4 };
      const changes: InteractiveWidget[] = [];
      d.onChange((w) => changes.push(w));
      // click option index 1 (y=2)
      d.handleMouse(mouseUpAt(2, 2));
      expect(d.selectedIndex).toBe(1);
      expect(d.expanded).toBe(false);
      expect(changes).toHaveLength(1);
    });

    it("click on the header row while expanded collapses without change", () => {
      const d = new Dropdown({ options: ["a", "b", "c"], selectedIndex: 0 });
      d.handleKey(enterEvent());
      d.bounds = { x: 0, y: 0, width: 8, height: 4 };
      d.handleMouse(mouseUpAt(2, 0));
      expect(d.expanded).toBe(false);
      expect(d.selectedIndex).toBe(0);
    });

    it("click outside expanded bounds collapses without change", () => {
      const d = new Dropdown({ options: ["a", "b", "c"], selectedIndex: 0 });
      d.handleKey(enterEvent());
      d.bounds = { x: 0, y: 0, width: 8, height: 4 };
      d.handleMouse(mouseUpAt(50, 50));
      expect(d.expanded).toBe(false);
      expect(d.selectedIndex).toBe(0);
    });
  });

  describe("disabled gating", () => {
    it("blocks expansion via key", () => {
      const d = new Dropdown({ options: ["a"], disabled: true });
      d.handleKey(enterEvent());
      expect(d.expanded).toBe(false);
    });

    it("blocks expansion via click", () => {
      const d = new Dropdown({ options: ["a"], disabled: true });
      d.bounds = { x: 0, y: 0, width: 8, height: 1 };
      d.handleMouse(mouseUpAt(2, 0));
      expect(d.expanded).toBe(false);
    });
  });

  describe("rendering", () => {
    it("render() always emits a single row regardless of expanded", () => {
      const d = new Dropdown({ options: ["a", "b", "c"] });
      const collapsedText = [...d.render(RENDER)].map((s) => s.text).join("");
      expect(collapsedText.includes("\n")).toBe(false);

      d.handleKey(enterEvent());
      const expandedText = [...d.render(RENDER)].map((s) => s.text).join("");
      expect(expandedText.includes("\n")).toBe(false);
      // Inline footprint is invariant under expansion.
      expect(expandedText).toBe(collapsedText);
    });

    it("renderOverlay returns null when collapsed", () => {
      const d = new Dropdown({ options: ["a", "b"] });
      expect(d.renderOverlay(RENDER)).toBeNull();
    });

    it("collapsed shows the selected label and arrow", () => {
      const d = new Dropdown({ options: ["alpha", "beta"], selectedIndex: 1 });
      const segs = [...d.render(RENDER)];
      const text = segs.map((s) => s.text).join("");
      expect(text).toContain("beta");
      expect(text).toContain("▾");
    });

    it("ASCII fallback uses 'v' for the arrow", () => {
      const d = new Dropdown({ options: ["alpha"] });
      const segs = [...d.render({ ...RENDER, asciiOnly: true })];
      const text = segs.map((s) => s.text).join("");
      expect(text).toContain("v");
      expect(text).not.toContain("▾");
    });

    it("overlay highlighted row uses primary-muted bg, distinct from selected primary", () => {
      const d = new Dropdown({ options: ["a", "b", "c"], selectedIndex: 0 });
      d.handleKey(enterEvent());
      d.handleKey(downEvent()); // highlighted = 1, selected = 0
      const overlay = d.renderOverlay(RENDER);
      expect(overlay).not.toBeNull();
      const segs = [...(overlay as Iterable<Segment>)];
      const bgColors = segs.map((s) => s.style?.bgcolor?.name).filter(Boolean);
      const distinct = new Set(bgColors);
      expect(distinct.size).toBeGreaterThan(1);
    });

    it("renders dimmed when disabled (collapsed)", () => {
      const d = new Dropdown({ options: ["a"], disabled: true });
      const segs = [...d.render(RENDER)];
      expect(segs.every((s) => s.style?.dim === true)).toBe(true);
    });

    it("focused adds underline to header row", () => {
      const d = new Dropdown({ options: ["a"] });
      d.focus();
      const segs = [...d.render(RENDER)];
      expect(segs.some((s) => s.style?.underline === true)).toBe(true);
    });

    it("programmatic blur() collapses the overlay and clears the filter", () => {
      // [LAW:single-enforcer] focus()/blur() route through handleFocus on
      // WidgetBase, so the subclass override sees the transition. Without
      // dispatch, blur() would only flip `focused` and leave the overlay
      // open — visible state surviving a blur is a real-world bug.
      const d = new Dropdown({ options: ["alpha", "beta", "gamma"] });
      d.focus();
      d.handleKey(new KeyEvent({ key: "a", character: "a", shift: false, ctrl: false, meta: false }));
      expect(d.expanded).toBe(true);
      expect(d.filter).toBe("a");

      d.blur();
      expect(d.focused).toBe(false);
      expect(d.expanded).toBe(false);
      expect(d.filter).toBe("");
    });
  });

  describe("measure", () => {
    it("reports max label length + 4", () => {
      const d = new Dropdown({ options: ["short", "much-longer", "mid"] });
      const { minimum, maximum } = d.measure(RENDER);
      expect(minimum).toBe(15); // 11 + 4
      expect(maximum).toBe(15);
    });

    it("collapsed and expanded share the same width", () => {
      const d = new Dropdown({ options: ["alpha", "beta"] });
      const beforeWidth = d.measure(RENDER).minimum;
      d.handleKey(enterEvent());
      const afterWidth = d.measure(RENDER).minimum;
      expect(beforeWidth).toBe(afterWidth);
    });
  });

  describe("hit-testing", () => {
    it("hit-tests against bounds", () => {
      const d = new Dropdown({ options: ["a"] });
      expect(d.containsPoint(0, 0)).toBe(false);
      d.bounds = { x: 0, y: 0, width: 5, height: 1 };
      expect(d.containsPoint(0, 0)).toBe(true);
      expect(d.containsPoint(4, 0)).toBe(true);
      expect(d.containsPoint(5, 0)).toBe(false);
    });
  });

  describe("filtering", () => {
    const opts = ["alpha", "beta", "gamma", "Alphabet"];

    const headerText = (d: Dropdown): string =>
      [...d.render(RENDER)].map((s) => s.text).join("");

    it("filteredOptions: empty filter returns all, with canonical idx", () => {
      const d = new Dropdown({ options: opts });
      expect(d.filteredOptions.map((e) => e.idx)).toEqual([0, 1, 2, 3]);
    });

    it("filteredOptions: case-insensitive substring match preserves canonical idx", () => {
      const d = new Dropdown({ options: opts });
      d.filter = "alph";
      expect(d.filteredOptions.map((e) => e.label)).toEqual(["alpha", "Alphabet"]);
      expect(d.filteredOptions.map((e) => e.idx)).toEqual([0, 3]);
    });

    it("typing a printable char while collapsed auto-expands and seeds filter", () => {
      const d = new Dropdown({ options: opts });
      d.handleKey(charKey("g"));
      expect(d.expanded).toBe(true);
      expect(d.filter).toBe("g");
      expect(d.highlightedIndex).toBe(0);
    });

    it("typing while expanded appends to filter and resets highlightedIndex to 0", () => {
      const d = new Dropdown({ options: opts });
      d.handleKey(enterEvent());
      d.handleKey(downEvent()); // highlightedIndex = 1
      d.handleKey(charKey("a"));
      expect(d.filter).toBe("a");
      expect(d.highlightedIndex).toBe(0);
    });

    it("backspace removes one char; on empty filter is a no-op", () => {
      const d = new Dropdown({ options: opts });
      d.handleKey(charKey("g"));
      d.handleKey(charKey("a"));
      expect(d.filter).toBe("ga");
      d.handleKey(backspaceEvent());
      expect(d.filter).toBe("g");
      d.handleKey(backspaceEvent());
      expect(d.filter).toBe("");
      d.handleKey(backspaceEvent());
      expect(d.filter).toBe("");
      expect(d.expanded).toBe(true); // backspace does not collapse
    });

    it("escape clears filter and collapses in one step", () => {
      const d = new Dropdown({ options: opts });
      d.handleKey(charKey("a"));
      d.handleKey(charKey("l"));
      expect(d.filter).toBe("al");
      d.handleKey(escapeEvent());
      expect(d.expanded).toBe(false);
      expect(d.filter).toBe("");
    });

    it("enter commits filteredOptions[highlightedIndex] to canonical selectedIndex and clears filter", () => {
      const d = new Dropdown({ options: opts, selectedIndex: 0 });
      // Filter "lph" matches alpha (canonical 0) and Alphabet (canonical 3) only.
      for (const ch of "lph") d.handleKey(charKey(ch));
      d.handleKey(downEvent()); // highlightedIndex = 1 → "Alphabet" (canonical idx 3)
      d.handleKey(enterEvent());
      expect(d.selectedIndex).toBe(3);
      expect(d.filter).toBe("");
      expect(d.expanded).toBe(false);
    });

    it("commit clears filter (next open shows all options again)", () => {
      const d = new Dropdown({ options: opts });
      d.handleKey(charKey("a"));
      d.handleKey(enterEvent());
      d.handleKey(enterEvent()); // re-open
      expect(d.filter).toBe("");
      expect(d.filteredOptions).toHaveLength(4);
    });

    it("canonical selectedIndex is preserved when filter excludes it", () => {
      const d = new Dropdown({ options: opts, selectedIndex: 1 }); // "beta"
      d.handleKey(charKey("g")); // filter excludes "beta"
      expect(d.selectedIndex).toBe(1); // unchanged
      d.handleKey(escapeEvent()); // cancel without commit
      expect(d.selectedIndex).toBe(1); // still unchanged
      // And the header shows "beta" again now that filter is clear.
      expect(headerText(d)).toContain("beta");
    });

    it("zero matches: enter is a no-op", () => {
      const d = new Dropdown({ options: opts, selectedIndex: 0 });
      const submits: InteractiveWidget[] = [];
      d.onSubmit((w) => submits.push(w));
      d.handleKey(charKey("z"));
      d.handleKey(enterEvent());
      expect(submits).toHaveLength(0);
      expect(d.selectedIndex).toBe(0);
      expect(d.expanded).toBe(true); // still open
      expect(d.filter).toBe("z"); // filter unchanged
    });

    it("header shows query (not selected label) while filtering", () => {
      const d = new Dropdown({ options: opts, selectedIndex: 0 });
      d.handleKey(charKey("b"));
      const text = headerText(d);
      expect(text).toContain("b");
      expect(text).not.toContain("alpha");
    });

    it("width invariant: header width unchanged across filter mutations", () => {
      const d = new Dropdown({ options: opts });
      const baseWidth = headerText(d).length;
      d.handleKey(charKey("a"));
      expect(headerText(d).length).toBe(baseWidth);
      // Long filter (longer than maxLabelLen) is right-clipped, width still invariant.
      for (const ch of "supercalifragilistic") d.handleKey(charKey(ch));
      expect(headerText(d).length).toBe(baseWidth);
    });

    it("measure() is invariant under filter", () => {
      const d = new Dropdown({ options: opts });
      const before = d.measure(RENDER);
      d.handleKey(charKey("z")); // zero matches
      expect(d.measure(RENDER)).toEqual(before);
    });

    it("mouse click on filtered row commits the canonical idx", () => {
      const d = new Dropdown({ options: opts, selectedIndex: 0 });
      // Filter "lph" → filteredOptions = [alpha(0), Alphabet(3)]
      for (const ch of "lph") d.handleKey(charKey(ch));
      d.bounds = { x: 0, y: 0, width: 12, height: 3 };
      d.handleMouse(mouseUpAt(2, 2)); // row index 1 → "Alphabet" (canonical idx 3)
      expect(d.selectedIndex).toBe(3);
      expect(d.filter).toBe("");
      expect(d.expanded).toBe(false);
    });

    it("mouse click on header clears filter and collapses without selection change", () => {
      const d = new Dropdown({ options: opts, selectedIndex: 0 });
      d.handleKey(charKey("g"));
      d.bounds = { x: 0, y: 0, width: 12, height: 2 };
      d.handleMouse(mouseUpAt(2, 0));
      expect(d.expanded).toBe(false);
      expect(d.filter).toBe("");
      expect(d.selectedIndex).toBe(0);
    });

    it("highlightedIndex stays in range as filter narrows", () => {
      const d = new Dropdown({ options: opts });
      d.handleKey(enterEvent());
      d.handleKey(downEvent());
      d.handleKey(downEvent()); // highlightedIndex = 2
      d.handleKey(charKey("a")); // filter resets it to 0
      expect(d.highlightedIndex).toBe(0);
      // Down clamps to filteredOptions.length - 1.
      const fLen = d.filteredOptions.length;
      for (let i = 0; i < fLen + 5; i++) d.handleKey(downEvent());
      expect(d.highlightedIndex).toBe(fLen - 1);
    });
  });
});
