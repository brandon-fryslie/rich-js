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
      expect(segments[0]!.text).toBe("  OK  ");
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

    it("renders brackets when focused", () => {
      const btn = new Button({ label: "Go" });
      btn.focus();
      const segments = [...btn.render({ maxWidth: 80 })];
      expect(segments).toHaveLength(1);
      expect(segments[0]!.text).toBe("[ Go ]");
    });

    it("renders spaces (no brackets) when not focused", () => {
      const btn = new Button({ label: "Go" });
      const segments = [...btn.render({ maxWidth: 80 })];
      expect(segments[0]!.text).toBe("  Go  ");
    });

    it("focus does not change width", () => {
      const btn = new Button({ label: "Go" });
      const normalSegs = [...btn.render({ maxWidth: 80 })];
      btn.focus();
      const focusedSegs = [...btn.render({ maxWidth: 80 })];
      expect(normalSegs[0]!.text.length).toBe(focusedSegs[0]!.text.length);
    });

    it("renders hover state with lighter background", () => {
      const btn = new Button({ label: "Go" });
      btn.setHovered(true);
      const segments = [...btn.render({ maxWidth: 80 })];
      const style = segments[0]!.style!;
      expect(style.bgcolor).toBeDefined();
      expect(style.bgcolor!.name).not.toBe("#4a4a4a");
    });

    it("hover uses the on-${accent} contrast colour as fg, not text-${accent}", () => {
      const btn = new Button({ label: "Go", variant: "primary" });
      btn.setHovered(true);
      const style = [...btn.render({ maxWidth: 80 })][0]!.style!;
      // on-primary is pure black or pure white (WCAG contrast).
      const fg = style.color!;
      const isBlack = fg.name === "#000000";
      const isWhite = fg.name === "#ffffff";
      expect(isBlack || isWhite).toBe(true);
    });

    it("renders active state with bold and full accent bg", () => {
      const btn = new Button({ label: "Go", variant: "primary" });
      btn.setActive(true);
      const segments = [...btn.render({ maxWidth: 80 })];
      expect(segments).toHaveLength(1);
      const style = segments[0]!.style!;
      expect(style.bold).toBe(true);
      // bg should be the full accent (same as hover), fg should be on-${accent}.
      // Both should be different — no inversion that would put fg = mostly-bg.
      expect(style.color!.name).not.toBe(style.bgcolor!.name);
    });

    it("active and hover use the same colour pair; bold differentiates them", () => {
      const hover = new Button({ label: "Go", variant: "primary" });
      hover.setHovered(true);
      const hoverStyle = [...hover.render({ maxWidth: 80 })][0]!.style!;

      const active = new Button({ label: "Go", variant: "primary" });
      active.setActive(true);
      const activeStyle = [...active.render({ maxWidth: 80 })][0]!.style!;

      expect(activeStyle.color!.name).toBe(hoverStyle.color!.name);
      expect(activeStyle.bgcolor!.name).toBe(hoverStyle.bgcolor!.name);
      expect(activeStyle.bold).toBe(true);
      expect(hoverStyle.bold).toBeFalsy();
    });

    it("active + focused shows brackets and bold", () => {
      const btn = new Button({ label: "Go" });
      btn.focus();
      btn.setActive(true);
      const segments = [...btn.render({ maxWidth: 80 })];
      expect(segments).toHaveLength(1);
      expect(segments[0]!.text).toBe("[ Go ]");
      expect(segments[0]!.style!.bold).toBe(true);
    });
  });

  describe("measure", () => {
    it("reports exact width (label + 4 for brackets and padding)", () => {
      const btn = new Button({ label: "Submit" });
      const { minimum, maximum } = btn.measure({ maxWidth: 80 });
      expect(minimum).toBe(10);
      expect(maximum).toBe(10);
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

    it("keyboard activation makes active=true observable across MobX cycles", async () => {
      // [LAW:dataflow-not-control-flow] toggling active true→false inside a
      // single @action would only ever expose the post-action state to MobX
      // autoruns. The handler exits with active=true and schedules the clear
      // on a microtask so observers see both states.
      const btn = new Button({ label: "Go" });
      btn.handleKey(enterEvent);
      expect(btn.active).toBe(true);
      await Promise.resolve(); // drain microtask queue
      expect(btn.active).toBe(false);
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
