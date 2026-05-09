import { describe, it, expect } from "vitest";
import { Dropdown } from "../../src/widgets/dropdown.js";
import type { InteractiveWidget, KeyEvent, WidgetMouseEvent } from "../../src/widgets/types.js";

const makeKey = (key: string): KeyEvent => ({
  key,
  character: "",
  shift: false,
  ctrl: false,
  meta: false,
});

const enterEvent = makeKey("enter");
const spaceEvent = makeKey("space");
const escapeEvent = makeKey("escape");
const upEvent = makeKey("up");
const downEvent = makeKey("down");

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

  it("rejects empty options at construction", () => {
    // [LAW:types-are-the-program] zero options is an illegal state — no value
    // to select, navigation can produce -1. Forbid at the constructor edge.
    expect(() => new Dropdown({ options: [] })).toThrow(/at least one option/);
  });

  it("rejects out-of-range selectedIndex at construction", () => {
    expect(() => new Dropdown({ options: ["a", "b"], selectedIndex: 5 })).toThrow(/out of range/);
    expect(() => new Dropdown({ options: ["a", "b"], selectedIndex: -1 })).toThrow(/out of range/);
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
      d.handleKey(enterEvent);
      expect(d.expanded).toBe(true);
    });

    it("space expands when collapsed", () => {
      const d = new Dropdown({ options: ["a", "b"] });
      d.handleKey(spaceEvent);
      expect(d.expanded).toBe(true);
    });

    it("expanding seeds highlightedIndex from selectedIndex", () => {
      const d = new Dropdown({ options: ["a", "b", "c"], selectedIndex: 2 });
      d.handleKey(enterEvent);
      expect(d.highlightedIndex).toBe(2);
    });

    it("escape collapses without changing selection", () => {
      const d = new Dropdown({ options: ["a", "b", "c"], selectedIndex: 0 });
      d.handleKey(enterEvent);
      d.handleKey(downEvent);
      d.handleKey(escapeEvent);
      expect(d.expanded).toBe(false);
      expect(d.selectedIndex).toBe(0);
    });
  });

  describe("navigation when expanded", () => {
    it("down increments highlightedIndex (clamped)", () => {
      const d = new Dropdown({ options: ["a", "b", "c"] });
      d.handleKey(enterEvent);
      d.handleKey(downEvent);
      expect(d.highlightedIndex).toBe(1);
      d.handleKey(downEvent);
      expect(d.highlightedIndex).toBe(2);
      d.handleKey(downEvent);
      expect(d.highlightedIndex).toBe(2);
    });

    it("up decrements highlightedIndex (clamped)", () => {
      const d = new Dropdown({ options: ["a", "b", "c"], selectedIndex: 2 });
      d.handleKey(enterEvent);
      d.handleKey(upEvent);
      expect(d.highlightedIndex).toBe(1);
      d.handleKey(upEvent);
      expect(d.highlightedIndex).toBe(0);
      d.handleKey(upEvent);
      expect(d.highlightedIndex).toBe(0);
    });

    it("does not change selectedIndex while navigating", () => {
      const d = new Dropdown({ options: ["a", "b", "c"], selectedIndex: 0 });
      d.handleKey(enterEvent);
      d.handleKey(downEvent);
      d.handleKey(downEvent);
      expect(d.selectedIndex).toBe(0);
    });
  });

  describe("selection", () => {
    it("enter while expanded commits highlightedIndex to selectedIndex and collapses", () => {
      const d = new Dropdown({ options: ["a", "b", "c"], selectedIndex: 0 });
      d.handleKey(enterEvent);
      d.handleKey(downEvent);
      d.handleKey(enterEvent);
      expect(d.selectedIndex).toBe(1);
      expect(d.expanded).toBe(false);
    });

    it("enter while expanded fires onChange and onSubmit", () => {
      const d = new Dropdown({ options: ["a", "b"] });
      const changes: InteractiveWidget[] = [];
      const submits: InteractiveWidget[] = [];
      d.onChange((w) => changes.push(w));
      d.onSubmit((w) => submits.push(w));
      d.handleKey(enterEvent);
      d.handleKey(downEvent);
      d.handleKey(enterEvent);
      expect(changes).toHaveLength(1);
      expect(submits).toHaveLength(1);
    });

    it("escape does NOT fire onChange/onSubmit", () => {
      const d = new Dropdown({ options: ["a", "b"] });
      const changes: InteractiveWidget[] = [];
      const submits: InteractiveWidget[] = [];
      d.onChange((w) => changes.push(w));
      d.onSubmit((w) => submits.push(w));
      d.handleKey(enterEvent);
      d.handleKey(downEvent);
      d.handleKey(escapeEvent);
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
      d.handleKey(enterEvent); // expand
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
      d.handleKey(enterEvent);
      d.bounds = { x: 0, y: 0, width: 8, height: 4 };
      d.handleMouse(mouseUpAt(2, 0));
      expect(d.expanded).toBe(false);
      expect(d.selectedIndex).toBe(0);
    });

    it("click outside expanded bounds collapses without change", () => {
      const d = new Dropdown({ options: ["a", "b", "c"], selectedIndex: 0 });
      d.handleKey(enterEvent);
      d.bounds = { x: 0, y: 0, width: 8, height: 4 };
      d.handleMouse(mouseUpAt(50, 50));
      expect(d.expanded).toBe(false);
      expect(d.selectedIndex).toBe(0);
    });
  });

  describe("disabled gating", () => {
    it("blocks expansion via key", () => {
      const d = new Dropdown({ options: ["a"], disabled: true });
      d.handleKey(enterEvent);
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
    it("collapsed renders 1 row", () => {
      const d = new Dropdown({ options: ["a", "b"] });
      const segs = [...d.render(RENDER)];
      const text = segs.map((s) => s.text).join("");
      expect(text.includes("\n")).toBe(false);
    });

    it("expanded renders 1 + N rows", () => {
      const d = new Dropdown({ options: ["a", "b", "c"] });
      d.handleKey(enterEvent);
      const segs = [...d.render(RENDER)];
      const text = segs.map((s) => s.text).join("");
      const newlineCount = (text.match(/\n/g) || []).length;
      expect(newlineCount).toBe(3);
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

    it("highlighted row uses primary-muted bg, distinct from selected primary", () => {
      const d = new Dropdown({ options: ["a", "b", "c"], selectedIndex: 0 });
      d.handleKey(enterEvent);
      d.handleKey(downEvent); // highlighted = 1, selected = 0
      const segs = [...d.render(RENDER)];
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
      d.handleKey(enterEvent);
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
});
