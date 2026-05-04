import { describe, it, expect } from "vitest";
import { Button } from "../../src/widgets/button.js";
import type { InteractiveWidget, KeyEvent, WidgetMouseEvent } from "../../src/widgets/types.js";

const enterEvent: KeyEvent = { key: "enter", character: "\r", shift: false, ctrl: false, meta: false };
const spaceEvent: KeyEvent = { key: "space", character: " ", shift: false, ctrl: false, meta: false };
const escapeEvent: KeyEvent = { key: "escape", character: "\x1b", shift: false, ctrl: false, meta: false };

const mouseDown: WidgetMouseEvent = { type: "mouse_down", x: 0, y: 0, button: 0, shift: false, ctrl: false };
const mouseUp: WidgetMouseEvent = { type: "mouse_up", x: 0, y: 0, button: 0, shift: false, ctrl: false };

describe("Button", () => {
  it("constructs with defaults", () => {
    const btn = new Button({ label: "Click" });
    expect(btn.id).toBe("button-click");
    expect(btn.label).toBe("Click");
    expect(btn.variant).toBe("default");
    expect(btn.focusable).toBe(true);
    expect(btn.disabled).toBe(false);
    expect(btn.focused).toBe(false);
    expect(btn.hovered).toBe(false);
    expect(btn.active).toBe(false);
  });

  it("constructs with options", () => {
    const btn = new Button({ label: "Go", variant: "primary", id: "go-btn", disabled: true });
    expect(btn.id).toBe("go-btn");
    expect(btn.variant).toBe("primary");
    expect(btn.disabled).toBe(true);
  });

  it("implements InteractiveWidget", () => {
    const btn: InteractiveWidget = new Button({ label: "OK" });
    expect(typeof btn.handleKey).toBe("function");
    expect(typeof btn.handleMouse).toBe("function");
    expect(typeof btn.render).toBe("function");
    expect(typeof btn.measure).toBe("function");
  });

  describe("rendering", () => {
    it("renders label with surrounding spaces", () => {
      const btn = new Button({ label: "OK" });
      const segments = [...btn.render({ maxWidth: 80 })];
      expect(segments).toHaveLength(1);
      expect(segments[0]!.text).toBe(" OK ");
    });

    it("renders with style (not undefined)", () => {
      const btn = new Button({ label: "Go" });
      const segments = [...btn.render({ maxWidth: 80 })];
      expect(segments[0]!.style).toBeDefined();
    });

    it("renders dimmed when disabled", () => {
      const btn = new Button({ label: "Go", disabled: true });
      const segments = [...btn.render({ maxWidth: 80 })];
      const style = segments[0]!.style!;
      expect(style.dim).toBe(true);
    });

    it("renders with reversed colors when focused", () => {
      const btn = new Button({ label: "Go" });
      btn.focus();
      const segments = [...btn.render({ maxWidth: 80 })];
      const style = segments[0]!.style!;
      expect(style.bold).toBe(true);
      expect(style.bgcolor?.name).toBe("#ffffff");
    });

    it("renders hover state with lighter background", () => {
      const btn = new Button({ label: "Go" });
      btn.setHovered(true);
      const segments = [...btn.render({ maxWidth: 80 })];
      const style = segments[0]!.style!;
      // Hover bg should be lighter than normal bg
      expect(style.bgcolor).toBeDefined();
      expect(style.bgcolor!.name).not.toBe("#4a4a4a"); // normal bg for default
    });

    it("renders active state with reverse + underline", () => {
      const btn = new Button({ label: "Go" });
      btn.setActive(true);
      const segments = [...btn.render({ maxWidth: 80 })];
      const style = segments[0]!.style!;
      expect(style.bold).toBe(true);
      expect(style.underline).toBe(true);
      expect(style.bgcolor?.name).toBe("#ffffff"); // fg/bg swapped
    });

    it("active overrides focused", () => {
      const btn = new Button({ label: "Go" });
      btn.focus();
      btn.setActive(true);
      const segments = [...btn.render({ maxWidth: 80 })];
      const style = segments[0]!.style!;
      expect(style.underline).toBe(true); // active adds underline, focus alone doesn't
    });
  });

  describe("measure", () => {
    it("reports exact width (label + 2 spaces)", () => {
      const btn = new Button({ label: "Submit" });
      const { minimum, maximum } = btn.measure({ maxWidth: 80 });
      expect(minimum).toBe(8);
      expect(maximum).toBe(8);
    });
  });

  describe("events", () => {
    it("fires onSubmit on enter key", () => {
      const btn = new Button({ label: "Go" });
      const submits: InteractiveWidget[] = [];
      btn.onSubmit((w) => submits.push(w));
      btn.handleKey(enterEvent);
      expect(submits).toHaveLength(1);
      expect(submits[0]).toBe(btn);
    });

    it("fires onSubmit on space key", () => {
      const btn = new Button({ label: "Go" });
      const submits: InteractiveWidget[] = [];
      btn.onSubmit((w) => submits.push(w));
      btn.handleKey(spaceEvent);
      expect(submits).toHaveLength(1);
    });

    it("does not fire onSubmit on other keys", () => {
      const btn = new Button({ label: "Go" });
      const submits: InteractiveWidget[] = [];
      btn.onSubmit((w) => submits.push(w));
      btn.handleKey(escapeEvent);
      expect(submits).toHaveLength(0);
    });

    it("does not fire onSubmit when disabled (key)", () => {
      const btn = new Button({ label: "Go", disabled: true });
      const submits: InteractiveWidget[] = [];
      btn.onSubmit((w) => submits.push(w));
      btn.handleKey(enterEvent);
      expect(submits).toHaveLength(0);
    });

    it("fires onSubmit on mouse down then up", () => {
      const btn = new Button({ label: "Go" });
      const submits: InteractiveWidget[] = [];
      btn.onSubmit((w) => submits.push(w));
      btn.handleMouse(mouseDown);
      expect(submits).toHaveLength(0); // not yet
      btn.handleMouse(mouseUp);
      expect(submits).toHaveLength(1);
    });

    it("does not fire onSubmit when disabled (mouse)", () => {
      const btn = new Button({ label: "Go", disabled: true });
      const submits: InteractiveWidget[] = [];
      btn.onSubmit((w) => submits.push(w));
      btn.handleMouse(mouseDown);
      btn.handleMouse(mouseUp);
      expect(submits).toHaveLength(0);
    });
  });

  describe("state management", () => {
    it("focuses and blurs", () => {
      const btn = new Button({ label: "Go" });
      btn.focus();
      expect(btn.focused).toBe(true);
      btn.blur();
      expect(btn.focused).toBe(false);
    });

    it("toggles disabled", () => {
      const btn = new Button({ label: "Go" });
      btn.setDisabled(true);
      expect(btn.disabled).toBe(true);
      btn.setDisabled(false);
      expect(btn.disabled).toBe(false);
    });

    it("sets hovered", () => {
      const btn = new Button({ label: "Go" });
      btn.setHovered(true);
      expect(btn.hovered).toBe(true);
      btn.setHovered(false);
      expect(btn.hovered).toBe(false);
    });

    it("sets active", () => {
      const btn = new Button({ label: "Go" });
      btn.setActive(true);
      expect(btn.active).toBe(true);
      btn.setActive(false);
      expect(btn.active).toBe(false);
    });

    it("unsubscribes from onSubmit", () => {
      const btn = new Button({ label: "Go" });
      const submits: InteractiveWidget[] = [];
      const unsub = btn.onSubmit((w) => submits.push(w));
      unsub();
      btn.handleKey(enterEvent);
      expect(submits).toHaveLength(0);
    });
  });

  describe("hit-testing", () => {
    it("hit-tests against bounds", () => {
      const btn = new Button({ label: "Go" });
      expect(btn.containsPoint(0, 0)).toBe(false);
      btn.bounds = { x: 0, y: 0, width: 4, height: 1 };
      expect(btn.containsPoint(0, 0)).toBe(true);
      expect(btn.containsPoint(3, 0)).toBe(true);
      expect(btn.containsPoint(4, 0)).toBe(false);
    });
  });
});
