import { describe, it, expect } from "vitest";
import { Toggle } from "../../src/widgets/toggle.js";
import type { InteractiveWidget, KeyEvent, WidgetMouseEvent } from "../../src/widgets/types.js";

const enterEvent: KeyEvent = { key: "enter", character: "\r", shift: false, ctrl: false, meta: false };
const spaceEvent: KeyEvent = { key: "space", character: " ", shift: false, ctrl: false, meta: false };
const escapeEvent: KeyEvent = { key: "escape", character: "\x1b", shift: false, ctrl: false, meta: false };

const mouseDown: WidgetMouseEvent = { type: "mouse_down", x: 0, y: 0, button: 0, shift: false, ctrl: false };
const mouseUp: WidgetMouseEvent = { type: "mouse_up", x: 0, y: 0, button: 0, shift: false, ctrl: false };

describe("Toggle", () => {
  it("constructs with defaults", () => {
    const tg = new Toggle({ label: "Sound" });
    expect(tg.id).toBe("toggle-sound");
    expect(tg.label).toBe("Sound");
    expect(tg.on).toBe(false);
    expect(tg.variant).toBe("default");
    expect(tg.focusable).toBe(true);
    expect(tg.disabled).toBe(false);
    expect(tg.focused).toBe(false);
    expect(tg.hovered).toBe(false);
  });

  it("constructs with options", () => {
    const tg = new Toggle({ label: "Notifications", on: true, id: "notif", variant: "primary", disabled: true });
    expect(tg.id).toBe("notif");
    expect(tg.on).toBe(true);
    expect(tg.variant).toBe("primary");
    expect(tg.disabled).toBe(true);
  });

  it("derives id from multi-word label", () => {
    const tg = new Toggle({ label: "Dark Mode" });
    expect(tg.id).toBe("toggle-dark-mode");
  });

  it("implements InteractiveWidget", () => {
    const tg: InteractiveWidget = new Toggle({ label: "X" });
    expect(typeof tg.handleKey).toBe("function");
    expect(typeof tg.handleMouse).toBe("function");
    expect(typeof tg.render).toBe("function");
    expect(typeof tg.measure).toBe("function");
  });

  describe("rendering", () => {
    it("renders OFF indicator with label", () => {
      const tg = new Toggle({ label: "Go" });
      const segments = [...tg.render({ maxWidth: 80 })];
      expect(segments).toHaveLength(1);
      expect(segments[0]!.text).toBe("[OFF] Go");
    });

    it("renders ON indicator with label", () => {
      const tg = new Toggle({ label: "Go", on: true });
      const segments = [...tg.render({ maxWidth: 80 })];
      expect(segments).toHaveLength(1);
      expect(segments[0]!.text).toBe("[ON]  Go");
    });

    it("ON and OFF indicators have the same total width", () => {
      const off = new Toggle({ label: "Go" });
      const on = new Toggle({ label: "Go", on: true });
      const offText = [...off.render({ maxWidth: 80 })][0]!.text;
      const onText = [...on.render({ maxWidth: 80 })][0]!.text;
      expect(offText.length).toBe(onText.length);
    });

    it("renders with style (not undefined)", () => {
      const tg = new Toggle({ label: "Go" });
      const segments = [...tg.render({ maxWidth: 80 })];
      expect(segments[0]!.style).toBeDefined();
    });

    it("renders dimmed when disabled", () => {
      const tg = new Toggle({ label: "Go", disabled: true });
      const segments = [...tg.render({ maxWidth: 80 })];
      expect(segments[0]!.style!.dim).toBe(true);
    });

    it("renders with underline when focused", () => {
      const tg = new Toggle({ label: "Go" });
      tg.focus();
      const segments = [...tg.render({ maxWidth: 80 })];
      expect(segments[0]!.style!.underline).toBe(true);
    });

    it("renders without underline when not focused", () => {
      const tg = new Toggle({ label: "Go" });
      const segments = [...tg.render({ maxWidth: 80 })];
      expect(segments[0]!.style!.underline).toBeFalsy();
    });

    it("focus does not change width", () => {
      const tg = new Toggle({ label: "Go" });
      const normal = [...tg.render({ maxWidth: 80 })];
      tg.focus();
      const focused = [...tg.render({ maxWidth: 80 })];
      expect(normal[0]!.text.length).toBe(focused[0]!.text.length);
    });

    it("toggle does not change width", () => {
      const tg = new Toggle({ label: "Go" });
      const off = [...tg.render({ maxWidth: 80 })];
      tg.handleKey(spaceEvent);
      const on = [...tg.render({ maxWidth: 80 })];
      expect(off[0]!.text.length).toBe(on[0]!.text.length);
    });

    it("ON and OFF use different background colours", () => {
      const off = new Toggle({ label: "Go", variant: "primary" });
      const on = new Toggle({ label: "Go", variant: "primary", on: true });
      const offBg = [...off.render({ maxWidth: 80 })][0]!.style!.bgcolor;
      const onBg = [...on.render({ maxWidth: 80 })][0]!.style!.bgcolor;
      expect(offBg).toBeDefined();
      expect(onBg).toBeDefined();
      expect(offBg!.name).not.toBe(onBg!.name);
    });

    it("variants produce different ON background colours", () => {
      const primary = new Toggle({ label: "Go", variant: "primary", on: true });
      const success = new Toggle({ label: "Go", variant: "success", on: true });
      const danger = new Toggle({ label: "Go", variant: "danger", on: true });
      const pBg = [...primary.render({ maxWidth: 80 })][0]!.style!.bgcolor;
      const sBg = [...success.render({ maxWidth: 80 })][0]!.style!.bgcolor;
      const dBg = [...danger.render({ maxWidth: 80 })][0]!.style!.bgcolor;
      expect(pBg!.name).not.toBe(sBg!.name);
      expect(pBg!.name).not.toBe(dBg!.name);
      expect(sBg!.name).not.toBe(dBg!.name);
    });
  });

  describe("measure", () => {
    it("reports label.length + 6", () => {
      const tg = new Toggle({ label: "Sound" });
      const { minimum, maximum } = tg.measure({ maxWidth: 80 });
      expect(minimum).toBe(11);
      expect(maximum).toBe(11);
    });

    it("measure is independent of on/focused state", () => {
      const tg = new Toggle({ label: "Go" });
      const before = tg.measure({ maxWidth: 80 });
      tg.handleKey(spaceEvent);
      tg.focus();
      const after = tg.measure({ maxWidth: 80 });
      expect(before).toEqual(after);
    });
  });

  describe("events", () => {
    it("toggles on space key", () => {
      const tg = new Toggle({ label: "Go" });
      tg.handleKey(spaceEvent);
      expect(tg.on).toBe(true);
      tg.handleKey(spaceEvent);
      expect(tg.on).toBe(false);
    });

    it("fires onChange when toggled by space", () => {
      const tg = new Toggle({ label: "Go" });
      const changes: InteractiveWidget[] = [];
      tg.onChange((w) => changes.push(w));
      tg.handleKey(spaceEvent);
      expect(changes).toHaveLength(1);
      expect(changes[0]).toBe(tg);
    });

    it("fires onSubmit on enter without toggling", () => {
      const tg = new Toggle({ label: "Go" });
      const submits: InteractiveWidget[] = [];
      tg.onSubmit((w) => submits.push(w));
      tg.handleKey(enterEvent);
      expect(submits).toHaveLength(1);
      expect(tg.on).toBe(false);
    });

    it("does not toggle or fire on other keys", () => {
      const tg = new Toggle({ label: "Go" });
      const changes: InteractiveWidget[] = [];
      const submits: InteractiveWidget[] = [];
      tg.onChange((w) => changes.push(w));
      tg.onSubmit((w) => submits.push(w));
      tg.handleKey(escapeEvent);
      expect(changes).toHaveLength(0);
      expect(submits).toHaveLength(0);
      expect(tg.on).toBe(false);
    });

    it("does not toggle when disabled (key)", () => {
      const tg = new Toggle({ label: "Go", disabled: true });
      const changes: InteractiveWidget[] = [];
      tg.onChange((w) => changes.push(w));
      tg.handleKey(spaceEvent);
      expect(tg.on).toBe(false);
      expect(changes).toHaveLength(0);
    });

    it("does not submit when disabled (key)", () => {
      const tg = new Toggle({ label: "Go", disabled: true });
      const submits: InteractiveWidget[] = [];
      tg.onSubmit((w) => submits.push(w));
      tg.handleKey(enterEvent);
      expect(submits).toHaveLength(0);
    });

    it("toggles on mouse_up and fires onChange", () => {
      const tg = new Toggle({ label: "Go" });
      const changes: InteractiveWidget[] = [];
      tg.onChange((w) => changes.push(w));
      tg.handleMouse(mouseUp);
      expect(tg.on).toBe(true);
      expect(changes).toHaveLength(1);
    });

    it("does not toggle on mouse_down alone", () => {
      const tg = new Toggle({ label: "Go" });
      const changes: InteractiveWidget[] = [];
      tg.onChange((w) => changes.push(w));
      tg.handleMouse(mouseDown);
      expect(tg.on).toBe(false);
      expect(changes).toHaveLength(0);
    });

    it("does not toggle when disabled (mouse)", () => {
      const tg = new Toggle({ label: "Go", disabled: true });
      const changes: InteractiveWidget[] = [];
      tg.onChange((w) => changes.push(w));
      tg.handleMouse(mouseUp);
      expect(tg.on).toBe(false);
      expect(changes).toHaveLength(0);
    });
  });

  describe("state management", () => {
    it("focuses and blurs", () => {
      const tg = new Toggle({ label: "Go" });
      tg.focus();
      expect(tg.focused).toBe(true);
      tg.blur();
      expect(tg.focused).toBe(false);
    });

    it("toggles disabled", () => {
      const tg = new Toggle({ label: "Go" });
      tg.setDisabled(true);
      expect(tg.disabled).toBe(true);
      tg.setDisabled(false);
      expect(tg.disabled).toBe(false);
    });

    it("sets hovered", () => {
      const tg = new Toggle({ label: "Go" });
      tg.setHovered(true);
      expect(tg.hovered).toBe(true);
      tg.setHovered(false);
      expect(tg.hovered).toBe(false);
    });

    it("unsubscribes from onChange", () => {
      const tg = new Toggle({ label: "Go" });
      const changes: InteractiveWidget[] = [];
      const unsub = tg.onChange((w) => changes.push(w));
      unsub();
      tg.handleKey(spaceEvent);
      expect(changes).toHaveLength(0);
    });

    it("unsubscribes from onSubmit", () => {
      const tg = new Toggle({ label: "Go" });
      const submits: InteractiveWidget[] = [];
      const unsub = tg.onSubmit((w) => submits.push(w));
      unsub();
      tg.handleKey(enterEvent);
      expect(submits).toHaveLength(0);
    });
  });

  describe("hit-testing", () => {
    it("hit-tests against bounds", () => {
      const tg = new Toggle({ label: "Go" });
      expect(tg.containsPoint(0, 0)).toBe(false);
      tg.bounds = { x: 0, y: 0, width: 8, height: 1 };
      expect(tg.containsPoint(0, 0)).toBe(true);
      expect(tg.containsPoint(7, 0)).toBe(true);
      expect(tg.containsPoint(8, 0)).toBe(false);
    });
  });
});
