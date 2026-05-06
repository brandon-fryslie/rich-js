import { describe, it, expect } from "vitest";
import { Checkbox } from "../../src/widgets/checkbox.js";
import type { InteractiveWidget, KeyEvent, WidgetMouseEvent } from "../../src/widgets/types.js";

const enterEvent: KeyEvent = { key: "enter", character: "\r", shift: false, ctrl: false, meta: false };
const spaceEvent: KeyEvent = { key: "space", character: " ", shift: false, ctrl: false, meta: false };
const escapeEvent: KeyEvent = { key: "escape", character: "\x1b", shift: false, ctrl: false, meta: false };

const mouseDown: WidgetMouseEvent = { type: "mouse_down", x: 0, y: 0, button: 0, shift: false, ctrl: false };
const mouseUp: WidgetMouseEvent = { type: "mouse_up", x: 0, y: 0, button: 0, shift: false, ctrl: false };

describe("Checkbox", () => {
  it("constructs with defaults", () => {
    const cb = new Checkbox({ label: "Agree" });
    expect(cb.id).toBe("checkbox-agree");
    expect(cb.label).toBe("Agree");
    expect(cb.checked).toBe(false);
    expect(cb.focusable).toBe(true);
    expect(cb.disabled).toBe(false);
    expect(cb.focused).toBe(false);
    expect(cb.hovered).toBe(false);
  });

  it("constructs with options", () => {
    const cb = new Checkbox({ label: "Subscribe", checked: true, id: "sub", disabled: true });
    expect(cb.id).toBe("sub");
    expect(cb.label).toBe("Subscribe");
    expect(cb.checked).toBe(true);
    expect(cb.disabled).toBe(true);
  });

  it("derives id from multi-word label", () => {
    const cb = new Checkbox({ label: "Remember Me" });
    expect(cb.id).toBe("checkbox-remember-me");
  });

  it("implements InteractiveWidget", () => {
    const cb: InteractiveWidget = new Checkbox({ label: "OK" });
    expect(typeof cb.handleKey).toBe("function");
    expect(typeof cb.handleMouse).toBe("function");
    expect(typeof cb.render).toBe("function");
    expect(typeof cb.measure).toBe("function");
  });

  describe("rendering", () => {
    it("renders unchecked indicator with label", () => {
      const cb = new Checkbox({ label: "Go" });
      const segments = [...cb.render({ maxWidth: 80 })];
      expect(segments).toHaveLength(1);
      expect(segments[0]!.text).toBe("[ ] Go");
    });

    it("renders checked indicator with label", () => {
      const cb = new Checkbox({ label: "Go", checked: true });
      const segments = [...cb.render({ maxWidth: 80 })];
      expect(segments).toHaveLength(1);
      expect(segments[0]!.text).toBe("[✓] Go");
    });

    it("renders ASCII fallback when asciiOnly", () => {
      const cb = new Checkbox({ label: "Go", checked: true });
      const segments = [...cb.render({ maxWidth: 80, asciiOnly: true })];
      expect(segments[0]!.text).toBe("[x] Go");
    });

    it("renders unchecked the same in ASCII and Unicode modes", () => {
      const cb = new Checkbox({ label: "Go" });
      const unicode = [...cb.render({ maxWidth: 80 })];
      const ascii = [...cb.render({ maxWidth: 80, asciiOnly: true })];
      expect(unicode[0]!.text).toBe(ascii[0]!.text);
    });

    it("renders with style (not undefined)", () => {
      const cb = new Checkbox({ label: "Go" });
      const segments = [...cb.render({ maxWidth: 80 })];
      expect(segments[0]!.style).toBeDefined();
    });

    it("renders dimmed when disabled", () => {
      const cb = new Checkbox({ label: "Go", disabled: true });
      const segments = [...cb.render({ maxWidth: 80 })];
      expect(segments[0]!.style!.dim).toBe(true);
    });

    it("renders with underline when focused", () => {
      const cb = new Checkbox({ label: "Go" });
      cb.focus();
      const segments = [...cb.render({ maxWidth: 80 })];
      expect(segments[0]!.style!.underline).toBe(true);
    });

    it("renders without underline when not focused", () => {
      const cb = new Checkbox({ label: "Go" });
      const segments = [...cb.render({ maxWidth: 80 })];
      expect(segments[0]!.style!.underline).toBeFalsy();
    });

    it("focus does not change width", () => {
      const cb = new Checkbox({ label: "Go" });
      const normalSegs = [...cb.render({ maxWidth: 80 })];
      cb.focus();
      const focusedSegs = [...cb.render({ maxWidth: 80 })];
      expect(normalSegs[0]!.text.length).toBe(focusedSegs[0]!.text.length);
    });

    it("toggle does not change width", () => {
      const cb = new Checkbox({ label: "Go" });
      const uncheckedSegs = [...cb.render({ maxWidth: 80 })];
      cb.handleKey(spaceEvent);
      const checkedSegs = [...cb.render({ maxWidth: 80 })];
      expect(uncheckedSegs[0]!.text.length).toBe(checkedSegs[0]!.text.length);
    });

    it("checked uses primary palette colour, unchecked uses foreground", () => {
      const checked = new Checkbox({ label: "Go", checked: true });
      const unchecked = new Checkbox({ label: "Go" });
      const checkedFg = [...checked.render({ maxWidth: 80 })][0]!.style!.color;
      const uncheckedFg = [...unchecked.render({ maxWidth: 80 })][0]!.style!.color;
      expect(checkedFg).toBeDefined();
      expect(uncheckedFg).toBeDefined();
      expect(checkedFg!.name).not.toBe(uncheckedFg!.name);
    });
  });

  describe("measure", () => {
    it("reports label.length + 4", () => {
      const cb = new Checkbox({ label: "Subscribe" });
      const { minimum, maximum } = cb.measure({ maxWidth: 80 });
      expect(minimum).toBe(13);
      expect(maximum).toBe(13);
    });

    it("measure is independent of checked/focused state", () => {
      const cb = new Checkbox({ label: "Go" });
      const before = cb.measure({ maxWidth: 80 });
      cb.handleKey(spaceEvent);
      cb.focus();
      const after = cb.measure({ maxWidth: 80 });
      expect(before).toEqual(after);
    });
  });

  describe("events", () => {
    it("toggles checked on space key", () => {
      const cb = new Checkbox({ label: "Go" });
      cb.handleKey(spaceEvent);
      expect(cb.checked).toBe(true);
      cb.handleKey(spaceEvent);
      expect(cb.checked).toBe(false);
    });

    it("fires onChange when toggled by space", () => {
      const cb = new Checkbox({ label: "Go" });
      const changes: InteractiveWidget[] = [];
      cb.onChange((w) => changes.push(w));
      cb.handleKey(spaceEvent);
      expect(changes).toHaveLength(1);
      expect(changes[0]).toBe(cb);
    });

    it("fires onSubmit on enter without toggling", () => {
      const cb = new Checkbox({ label: "Go" });
      const submits: InteractiveWidget[] = [];
      cb.onSubmit((w) => submits.push(w));
      cb.handleKey(enterEvent);
      expect(submits).toHaveLength(1);
      expect(cb.checked).toBe(false);
    });

    it("does not toggle or fire on other keys", () => {
      const cb = new Checkbox({ label: "Go" });
      const changes: InteractiveWidget[] = [];
      const submits: InteractiveWidget[] = [];
      cb.onChange((w) => changes.push(w));
      cb.onSubmit((w) => submits.push(w));
      cb.handleKey(escapeEvent);
      expect(changes).toHaveLength(0);
      expect(submits).toHaveLength(0);
      expect(cb.checked).toBe(false);
    });

    it("does not toggle when disabled (key)", () => {
      const cb = new Checkbox({ label: "Go", disabled: true });
      const changes: InteractiveWidget[] = [];
      cb.onChange((w) => changes.push(w));
      cb.handleKey(spaceEvent);
      expect(cb.checked).toBe(false);
      expect(changes).toHaveLength(0);
    });

    it("does not submit when disabled (key)", () => {
      const cb = new Checkbox({ label: "Go", disabled: true });
      const submits: InteractiveWidget[] = [];
      cb.onSubmit((w) => submits.push(w));
      cb.handleKey(enterEvent);
      expect(submits).toHaveLength(0);
    });

    it("toggles checked on mouse_up and fires onChange", () => {
      const cb = new Checkbox({ label: "Go" });
      const changes: InteractiveWidget[] = [];
      cb.onChange((w) => changes.push(w));
      cb.handleMouse(mouseUp);
      expect(cb.checked).toBe(true);
      expect(changes).toHaveLength(1);
    });

    it("does not toggle on mouse_down alone", () => {
      const cb = new Checkbox({ label: "Go" });
      const changes: InteractiveWidget[] = [];
      cb.onChange((w) => changes.push(w));
      cb.handleMouse(mouseDown);
      expect(cb.checked).toBe(false);
      expect(changes).toHaveLength(0);
    });

    it("does not toggle when disabled (mouse)", () => {
      const cb = new Checkbox({ label: "Go", disabled: true });
      const changes: InteractiveWidget[] = [];
      cb.onChange((w) => changes.push(w));
      cb.handleMouse(mouseUp);
      expect(cb.checked).toBe(false);
      expect(changes).toHaveLength(0);
    });
  });

  describe("state management", () => {
    it("focuses and blurs", () => {
      const cb = new Checkbox({ label: "Go" });
      cb.focus();
      expect(cb.focused).toBe(true);
      cb.blur();
      expect(cb.focused).toBe(false);
    });

    it("toggles disabled", () => {
      const cb = new Checkbox({ label: "Go" });
      cb.setDisabled(true);
      expect(cb.disabled).toBe(true);
      cb.setDisabled(false);
      expect(cb.disabled).toBe(false);
    });

    it("sets hovered", () => {
      const cb = new Checkbox({ label: "Go" });
      cb.setHovered(true);
      expect(cb.hovered).toBe(true);
      cb.setHovered(false);
      expect(cb.hovered).toBe(false);
    });

    it("unsubscribes from onChange", () => {
      const cb = new Checkbox({ label: "Go" });
      const changes: InteractiveWidget[] = [];
      const unsub = cb.onChange((w) => changes.push(w));
      unsub();
      cb.handleKey(spaceEvent);
      expect(changes).toHaveLength(0);
    });

    it("unsubscribes from onSubmit", () => {
      const cb = new Checkbox({ label: "Go" });
      const submits: InteractiveWidget[] = [];
      const unsub = cb.onSubmit((w) => submits.push(w));
      unsub();
      cb.handleKey(enterEvent);
      expect(submits).toHaveLength(0);
    });
  });

  describe("hit-testing", () => {
    it("hit-tests against bounds", () => {
      const cb = new Checkbox({ label: "Go" });
      expect(cb.containsPoint(0, 0)).toBe(false);
      cb.bounds = { x: 0, y: 0, width: 6, height: 1 };
      expect(cb.containsPoint(0, 0)).toBe(true);
      expect(cb.containsPoint(5, 0)).toBe(true);
      expect(cb.containsPoint(6, 0)).toBe(false);
    });
  });
});
