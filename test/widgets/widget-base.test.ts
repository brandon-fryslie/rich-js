import { describe, it, expect } from "vitest";
import { Segment } from "../../src/core/segment.js";
import { Style } from "../../src/core/style.js";
import type { RenderOptions } from "../../src/core/protocol.js";
import type {
  InteractiveWidget,
  KeyEvent,
  WidgetMouseEvent,
  WidgetFocusEvent,
} from "../../src/widgets/types.js";
import { WidgetBase } from "../../src/widgets/widget-base.js";

class StubWidget extends WidgetBase {
  readonly id = "stub";
  readonly focusable = true;

  handleKey(_event: KeyEvent): void {}

  render(_options: RenderOptions): Iterable<Segment> {
    return [new Segment("stub")];
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 4, maximum: 4 };
  }

  // Test-only public wrappers for the protected emitters.
  // emitChange/emitSubmit are part of the subclass-author contract, not the
  // public widget contract — exposing them here keeps the base API honest
  // while letting tests exercise the subscription mechanism directly.
  triggerChange(): void {
    this.emitChange();
  }

  triggerSubmit(): void {
    this.emitSubmit();
  }
}

describe("WidgetBase", () => {
  it("implements InteractiveWidget", () => {
    const widget: InteractiveWidget = new StubWidget();
    expect(widget.id).toBe("stub");
    expect(widget.focusable).toBe(true);
    expect(widget.focused).toBe(false);
    expect(widget.hovered).toBe(false);
    expect(widget.active).toBe(false);
    expect(widget.disabled).toBe(false);
    expect(widget.visible).toBe(true);
    expect(widget.bounds).toBeNull();
  });

  it("focuses and blurs", () => {
    const widget = new StubWidget();
    widget.focus();
    expect(widget.focused).toBe(true);
    widget.blur();
    expect(widget.focused).toBe(false);
  });

  it("handles focus events", () => {
    const widget = new StubWidget();
    widget.handleFocus({ type: "focus" } as WidgetFocusEvent);
    expect(widget.focused).toBe(true);
    widget.handleFocus({ type: "blur" } as WidgetFocusEvent);
    expect(widget.focused).toBe(false);
  });

  it("sets disabled state", () => {
    const widget = new StubWidget();
    widget.setDisabled(true);
    expect(widget.disabled).toBe(true);
    widget.setDisabled(false);
    expect(widget.disabled).toBe(false);
  });

  it("hit-tests against bounds", () => {
    const widget = new StubWidget();
    expect(widget.containsPoint(0, 0)).toBe(false);

    widget.bounds = { x: 5, y: 2, width: 10, height: 1 };
    expect(widget.containsPoint(5, 2)).toBe(true);
    expect(widget.containsPoint(14, 2)).toBe(true);
    expect(widget.containsPoint(15, 2)).toBe(false);
    expect(widget.containsPoint(5, 3)).toBe(false);
  });

  it("fires onChange subscriptions", () => {
    const widget = new StubWidget();
    const changes: InteractiveWidget[] = [];
    const unsub = widget.onChange((w) => changes.push(w));

    widget.triggerChange();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toBe(widget);

    unsub();
    widget.triggerChange();
    expect(changes).toHaveLength(1);
  });

  it("fires onSubmit subscriptions", () => {
    const widget = new StubWidget();
    const submits: InteractiveWidget[] = [];
    widget.onSubmit((w) => submits.push(w));

    widget.triggerSubmit();
    expect(submits).toHaveLength(1);
  });

  it("renders segments", () => {
    const widget = new StubWidget();
    const segments = [...widget.render({ maxWidth: 80 })];
    expect(segments).toHaveLength(1);
    expect(segments[0]!.text).toBe("stub");
  });

  it("measures width", () => {
    const widget = new StubWidget();
    const { minimum, maximum } = widget.measure({ maxWidth: 80 });
    expect(minimum).toBe(4);
    expect(maximum).toBe(4);
  });
});
