import { describe, it, expect } from "vitest";
import { Segment } from "../../src/core/segment.js";
import type { RenderOptions, KeyEvent, WidgetMouseEvent } from "../../src/index.js";
import { WidgetBase } from "../../src/widgets/widget-base.js";
import { DefaultFocusManager } from "../../src/widgets/focus-manager.js";

class StubWidget extends WidgetBase {
  constructor(
    readonly id: string,
    readonly focusable: boolean = true,
  ) {
    super();
  }

  handleKey(_event: KeyEvent): void {}
  render(_options: RenderOptions): Iterable<Segment> {
    return [new Segment(this.id)];
  }
  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 4, maximum: 4 };
  }
}

describe("DefaultFocusManager", () => {
  it("starts with no focused widget", () => {
    const fm = new DefaultFocusManager();
    expect(fm.current).toBeNull();
    expect(fm.widgets).toHaveLength(0);
  });

  it("auto-focuses first focusable widget on register", () => {
    const fm = new DefaultFocusManager();
    const a = new StubWidget("a");
    fm.register(a);
    expect(fm.current).toBe(a);
    expect(a.focused).toBe(true);
  });

  it("does not auto-focus non-focusable widget", () => {
    const fm = new DefaultFocusManager();
    const a = new StubWidget("a", false);
    fm.register(a);
    expect(fm.current).toBeNull();
  });

  it("registers multiple widgets", () => {
    const fm = new DefaultFocusManager();
    const a = new StubWidget("a");
    const b = new StubWidget("b");
    const c = new StubWidget("c");
    fm.register(a);
    fm.register(b);
    fm.register(c);
    expect(fm.widgets).toHaveLength(3);
    expect(fm.current).toBe(a);
  });

  describe("next() / prev()", () => {
    it("cycles forward through focusable widgets", () => {
      const fm = new DefaultFocusManager();
      const a = new StubWidget("a");
      const b = new StubWidget("b");
      const c = new StubWidget("c");
      fm.register(a);
      fm.register(b);
      fm.register(c);

      expect(fm.current).toBe(a);
      fm.next();
      expect(fm.current).toBe(b);
      fm.next();
      expect(fm.current).toBe(c);
      fm.next();
      expect(fm.current).toBe(a); // wraps
    });

    it("cycles backward through focusable widgets", () => {
      const fm = new DefaultFocusManager();
      const a = new StubWidget("a");
      const b = new StubWidget("b");
      const c = new StubWidget("c");
      fm.register(a);
      fm.register(b);
      fm.register(c);

      fm.prev();
      expect(fm.current).toBe(c); // wraps to last
      fm.prev();
      expect(fm.current).toBe(b);
    });

    it("skips non-focusable widgets", () => {
      const fm = new DefaultFocusManager();
      const a = new StubWidget("a");
      const b = new StubWidget("b", false);
      const c = new StubWidget("c");
      fm.register(a);
      fm.register(b);
      fm.register(c);

      fm.next();
      expect(fm.current).toBe(c); // skipped b
      fm.next();
      expect(fm.current).toBe(a); // wraps, skipped b
    });

    it("skips disabled widgets", () => {
      const fm = new DefaultFocusManager();
      const a = new StubWidget("a");
      const b = new StubWidget("b");
      const c = new StubWidget("c");
      fm.register(a);
      fm.register(b);
      fm.register(c);

      b.setDisabled(true);
      fm.next(); // a -> skip b -> c
      expect(fm.current).toBe(c);
    });

    it("no-ops when no focusable widgets exist", () => {
      const fm = new DefaultFocusManager();
      const a = new StubWidget("a", false);
      fm.register(a);
      fm.next();
      expect(fm.current).toBeNull();
    });
  });

  describe("focus() / blur()", () => {
    it("focuses a specific widget", () => {
      const fm = new DefaultFocusManager();
      const a = new StubWidget("a");
      const b = new StubWidget("b");
      fm.register(a);
      fm.register(b);

      fm.focus(b);
      expect(fm.current).toBe(b);
      expect(a.focused).toBe(false);
      expect(b.focused).toBe(true);
    });

    it("rejects focus on unregistered widget", () => {
      const fm = new DefaultFocusManager();
      const a = new StubWidget("a");
      // a is not registered
      fm.focus(a);
      expect(fm.current).toBeNull();
    });

    it("rejects focus on non-focusable widget", () => {
      const fm = new DefaultFocusManager();
      const a = new StubWidget("a");
      const b = new StubWidget("b", false);
      fm.register(a);
      fm.register(b);

      fm.focus(b);
      expect(fm.current).toBe(a); // unchanged
    });

    it("rejects focus on disabled widget", () => {
      const fm = new DefaultFocusManager();
      const a = new StubWidget("a");
      const b = new StubWidget("b");
      fm.register(a);
      fm.register(b);

      b.setDisabled(true);
      fm.focus(b);
      expect(fm.current).toBe(a); // unchanged
    });

    it("blurs the current widget", () => {
      const fm = new DefaultFocusManager();
      const a = new StubWidget("a");
      fm.register(a);

      fm.blur();
      expect(fm.current).toBeNull();
      expect(a.focused).toBe(false);
    });
  });

  describe("unregister()", () => {
    it("removes widget from list", () => {
      const fm = new DefaultFocusManager();
      const a = new StubWidget("a");
      const b = new StubWidget("b");
      fm.register(a);
      fm.register(b);

      fm.unregister(a);
      expect(fm.widgets).toHaveLength(1);
      expect(fm.widgets[0]).toBe(b);
    });

    it("focuses next focusable widget when current is removed", () => {
      const fm = new DefaultFocusManager();
      const a = new StubWidget("a");
      const b = new StubWidget("b");
      fm.register(a);
      fm.register(b);

      expect(fm.current).toBe(a);
      fm.unregister(a);
      expect(fm.current).toBe(b);
      expect(b.focused).toBe(true);
    });

    it("sets current to null when last widget is removed", () => {
      const fm = new DefaultFocusManager();
      const a = new StubWidget("a");
      fm.register(a);

      fm.unregister(a);
      expect(fm.current).toBeNull();
    });
  });

  describe("onChange", () => {
    it("fires on focus transitions", () => {
      const fm = new DefaultFocusManager();
      const a = new StubWidget("a");
      const b = new StubWidget("b");
      const changes: (InteractiveWidget | null)[] = [];
      fm.onChange((current) => changes.push(current));

      fm.register(a);
      fm.register(b);
      fm.next();
      fm.blur();

      // register(a) → change to a, register(b) → no change (a stays), next → change to b, blur → change to null
      expect(changes).toHaveLength(3);
      expect(changes[0]).toBe(a);
      expect(changes[1]).toBe(b);
      expect(changes[2]).toBeNull();
    });

    it("unsubscribes correctly", () => {
      const fm = new DefaultFocusManager();
      const changes: (InteractiveWidget | null)[] = [];
      const unsub = fm.onChange((current) => changes.push(current));

      unsub();
      const a = new StubWidget("a");
      fm.register(a);
      expect(changes).toHaveLength(0);
    });
  });
});
