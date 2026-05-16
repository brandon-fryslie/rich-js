import { describe, it, expect } from "vitest";
import { Slider } from "../../src/widgets/slider.js";
import { KeyEvent } from "../../src/widgets/types.js";
import type { InteractiveWidget, WidgetMouseEvent } from "../../src/widgets/types.js";

// Factory — KeyEvent carries a mutable `stopped` flag; fresh per call.
const makeKey = (key: string): KeyEvent => new KeyEvent({
  key,
  character: "",
  shift: false,
  ctrl: false,
  meta: false,
});

const leftEvent = () => makeKey("left");
const rightEvent = () => makeKey("right");
const homeEvent = () => makeKey("home");
const endEvent = () => makeKey("end");
const upEvent = () => makeKey("up");

const mouseAt = (
  type: "mouse_down" | "mouse_up" | "mouse_move",
  x: number,
  y = 0,
): WidgetMouseEvent => ({
  type,
  x,
  y,
  button: 0,
  shift: false,
  ctrl: false,
});

const RENDER = { maxWidth: 80 };
const renderText = (s: Slider): string =>
  [...s.render(RENDER)].map((seg) => seg.text).join("");

describe("Slider", () => {
  it("constructs with defaults", () => {
    const s = new Slider();
    expect(s.value).toBe(0);
    expect(s.min).toBe(0);
    expect(s.max).toBe(100);
    expect(s.step).toBe(1);
    expect(s.width).toBe(20);
    expect(s.focusable).toBe(true);
    expect(s.disabled).toBe(false);
  });

  it("constructs with options", () => {
    const s = new Slider({ value: 50, min: 0, max: 200, step: 5, width: 30, id: "vol", disabled: true });
    expect(s.value).toBe(50);
    expect(s.max).toBe(200);
    expect(s.step).toBe(5);
    expect(s.width).toBe(30);
    expect(s.id).toBe("vol");
    expect(s.disabled).toBe(true);
  });

  it("rejects non-positive or non-integer width at construction", () => {
    // Width drives `trackChar.repeat(width)` and `width - 1` as a divisor.
    // Anything but a positive integer corrupts both; guard at the trust
    // boundary so every downstream call can assume validity.
    expect(() => new Slider({ width: 0 })).toThrow(RangeError);
    expect(() => new Slider({ width: -1 })).toThrow(RangeError);
    expect(() => new Slider({ width: 1.5 })).toThrow(RangeError);
    expect(() => new Slider({ width: Number.NaN })).toThrow(RangeError);
  });

  it("snaps initial value to step", () => {
    const s = new Slider({ value: 7, min: 0, max: 100, step: 5 });
    expect(s.value).toBe(5);
  });

  it("clamps initial value to range", () => {
    const aboveMax = new Slider({ value: 999, min: 0, max: 100 });
    expect(aboveMax.value).toBe(100);
    const belowMin = new Slider({ value: -50, min: 0, max: 100 });
    expect(belowMin.value).toBe(0);
  });

  it("implements InteractiveWidget", () => {
    const s: InteractiveWidget = new Slider();
    expect(typeof s.handleKey).toBe("function");
    expect(typeof s.handleMouse).toBe("function");
    expect(typeof s.render).toBe("function");
    expect(typeof s.measure).toBe("function");
  });

  describe("keyboard adjustment", () => {
    it("right increments by step", () => {
      const s = new Slider({ value: 10, step: 5 });
      s.handleKey(rightEvent());
      expect(s.value).toBe(15);
    });

    it("left decrements by step", () => {
      const s = new Slider({ value: 10, step: 5 });
      s.handleKey(leftEvent());
      expect(s.value).toBe(5);
    });

    it("right clamps at max", () => {
      const s = new Slider({ value: 99, max: 100, step: 5 });
      s.handleKey(rightEvent());
      expect(s.value).toBe(100);
    });

    it("left clamps at min", () => {
      const s = new Slider({ value: 1, min: 0, step: 5 });
      s.handleKey(leftEvent());
      expect(s.value).toBe(0);
    });

    it("home jumps to min", () => {
      const s = new Slider({ value: 50, min: 10 });
      s.handleKey(homeEvent());
      expect(s.value).toBe(10);
    });

    it("end jumps to max", () => {
      const s = new Slider({ value: 50, max: 80 });
      s.handleKey(endEvent());
      expect(s.value).toBe(80);
    });

    it("ignores unrelated keys", () => {
      const s = new Slider({ value: 10 });
      s.handleKey(upEvent());
      expect(s.value).toBe(10);
    });

    it("emits onChange after each adjustment", () => {
      const s = new Slider({ value: 10 });
      const changes: InteractiveWidget[] = [];
      s.onChange((w) => changes.push(w));
      s.handleKey(rightEvent());
      s.handleKey(rightEvent());
      expect(changes).toHaveLength(2);
    });

    it("does not emit onChange when value did not change (clamped no-op)", () => {
      const s = new Slider({ value: 100, max: 100 });
      const changes: InteractiveWidget[] = [];
      s.onChange((w) => changes.push(w));
      s.handleKey(rightEvent());
      expect(changes).toHaveLength(0);
    });
  });

  describe("snap-to-step", () => {
    it("snaps to nearest step boundary on adjustment", () => {
      const s = new Slider({ value: 0, step: 5, max: 100 });
      s.handleKey(rightEvent());
      expect(s.value).toBe(5);
      s.handleKey(rightEvent());
      expect(s.value).toBe(10);
    });
  });

  describe("mouse adjustment", () => {
    it("mouse_down jumps value to fractional position", () => {
      const s = new Slider({ value: 0, min: 0, max: 100, step: 1, width: 11 });
      s.bounds = { x: 0, y: 0, width: 11, height: 1 };
      // x = 5 → fraction = 5/10 = 0.5 → value = 50
      s.handleMouse(mouseAt("mouse_down", 5));
      expect(s.value).toBe(50);
    });

    it("clamps mouse position to track bounds", () => {
      const s = new Slider({ value: 0, min: 0, max: 100, width: 11 });
      s.bounds = { x: 0, y: 0, width: 11, height: 1 };
      s.handleMouse(mouseAt("mouse_down", 50));
      expect(s.value).toBe(100);
    });

    it("mouse_move updates value while dragging", () => {
      const s = new Slider({ value: 0, min: 0, max: 100, width: 11 });
      s.bounds = { x: 0, y: 0, width: 11, height: 1 };
      s.handleMouse(mouseAt("mouse_down", 0));
      s.handleMouse(mouseAt("mouse_move", 5));
      expect(s.value).toBe(50);
    });

    it("mouse_move without prior mouse_down does not change value", () => {
      const s = new Slider({ value: 30, min: 0, max: 100, width: 11 });
      s.bounds = { x: 0, y: 0, width: 11, height: 1 };
      s.handleMouse(mouseAt("mouse_move", 5));
      expect(s.value).toBe(30);
    });

    it("mouse_up after drag fires onSubmit", () => {
      const s = new Slider({ value: 0, min: 0, max: 100, width: 11 });
      s.bounds = { x: 0, y: 0, width: 11, height: 1 };
      const submits: InteractiveWidget[] = [];
      s.onSubmit((w) => submits.push(w));
      s.handleMouse(mouseAt("mouse_down", 0));
      s.handleMouse(mouseAt("mouse_up", 10));
      expect(submits).toHaveLength(1);
      expect(s.value).toBe(100);
    });

    it("mouse_up without preceding mouse_down does NOT fire onSubmit", () => {
      const s = new Slider({ value: 0, width: 11 });
      s.bounds = { x: 0, y: 0, width: 11, height: 1 };
      const submits: InteractiveWidget[] = [];
      s.onSubmit((w) => submits.push(w));
      s.handleMouse(mouseAt("mouse_up", 5));
      expect(submits).toHaveLength(0);
    });
  });

  describe("disabled gating", () => {
    it("blocks keyboard adjustment", () => {
      const s = new Slider({ value: 10, disabled: true });
      s.handleKey(rightEvent());
      expect(s.value).toBe(10);
    });

    it("blocks mouse_down", () => {
      const s = new Slider({ value: 10, width: 11, disabled: true });
      s.bounds = { x: 0, y: 0, width: 11, height: 1 };
      s.handleMouse(mouseAt("mouse_down", 10));
      expect(s.value).toBe(10);
    });
  });

  describe("rendering", () => {
    it("emits exactly `width` cells of track + marker", () => {
      const s = new Slider({ value: 50, width: 11 });
      const text = renderText(s);
      expect(text.length).toBe(11);
    });

    it("contains exactly one marker character", () => {
      const s = new Slider({ value: 50, width: 11 });
      const text = renderText(s);
      const markers = (text.match(/●/g) || []).length;
      expect(markers).toBe(1);
    });

    it("places marker at left when value=min", () => {
      const s = new Slider({ value: 0, min: 0, max: 100, width: 11 });
      const text = renderText(s);
      expect(text[0]).toBe("●");
    });

    it("places marker at right when value=max", () => {
      const s = new Slider({ value: 100, min: 0, max: 100, width: 11 });
      const text = renderText(s);
      expect(text[text.length - 1]).toBe("●");
    });

    it("ASCII fallback uses '-' track and '*' marker", () => {
      const s = new Slider({ value: 50, width: 11 });
      const text = [...s.render({ ...RENDER, asciiOnly: true })].map((seg) => seg.text).join("");
      expect(text).toContain("*");
      expect(text).toContain("-");
      expect(text).not.toContain("●");
      expect(text).not.toContain("─");
    });

    it("renders dimmed when disabled", () => {
      const s = new Slider({ value: 50, disabled: true });
      const segs = [...s.render(RENDER)];
      expect(segs.every((seg) => seg.style?.dim === true)).toBe(true);
    });

    it("focused adds underline to all segments", () => {
      const s = new Slider({ value: 50 });
      s.focus();
      const segs = [...s.render(RENDER)];
      expect(segs.every((seg) => seg.style?.underline === true)).toBe(true);
    });

    it("width never changes with value", () => {
      const s = new Slider({ value: 0, width: 11 });
      const at0 = renderText(s).length;
      s.handleKey(endEvent());
      const atMax = renderText(s).length;
      expect(at0).toBe(atMax);
      expect(at0).toBe(11);
    });
  });

  describe("measure", () => {
    it("reports the configured width", () => {
      const s = new Slider({ width: 30 });
      const { minimum, maximum } = s.measure(RENDER);
      expect(minimum).toBe(30);
      expect(maximum).toBe(30);
    });
  });

  describe("hit-testing", () => {
    it("hit-tests against bounds", () => {
      const s = new Slider({ width: 10 });
      expect(s.containsPoint(0, 0)).toBe(false);
      s.bounds = { x: 0, y: 0, width: 10, height: 1 };
      expect(s.containsPoint(0, 0)).toBe(true);
      expect(s.containsPoint(9, 0)).toBe(true);
      expect(s.containsPoint(10, 0)).toBe(false);
    });
  });
});
