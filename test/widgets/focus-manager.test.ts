import { describe, it, expect } from "vitest";
import { Segment } from "../../src/core/segment.js";
import type { RenderOptions } from "../../src/index.js";
import type { KeyEvent, InteractiveWidget } from "../../src/widgets/index.js";
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
  protected draw(_options: RenderOptions): Iterable<Segment> {
    return [new Segment(this.id)];
  }
  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 4, maximum: 4 };
  }
}

/** A focus manager over `shown`, standing for the widgets on the frame. */
function over(...shown: StubWidget[]): DefaultFocusManager {
  return new DefaultFocusManager(() => shown);
}

describe("DefaultFocusManager", () => {
  it("starts with no focused widget", () => {
    const fm = over();
    expect(fm.current).toBeNull();
    expect(fm.widgets).toHaveLength(0);
  });

  it("moves among the widgets on screen that can take focus, in their order", () => {
    const a = new StubWidget("a");
    const b = new StubWidget("b", false);
    const c = new StubWidget("c");
    c.setDisabled(true);
    const d = new StubWidget("d");
    expect(over(a, b, c, d).widgets).toEqual([a, d]);
  });

  describe("settle()", () => {
    it("focuses the first widget that can take focus", () => {
      const a = new StubWidget("a", false);
      const b = new StubWidget("b");
      const fm = over(a, b);
      fm.settle([a, b]);
      expect(fm.current).toBe(b);
      expect(b.focused).toBe(true);
    });

    it("keeps focus on a widget still on screen", () => {
      const a = new StubWidget("a");
      const b = new StubWidget("b");
      const fm = over(a, b);
      fm.focus(b);
      fm.settle([a, b]);
      expect(fm.current).toBe(b);
    });

    it("moves focus off a widget no longer on screen, to the first", () => {
      const a = new StubWidget("a");
      const b = new StubWidget("b");
      const shown = [a, b];
      const fm = new DefaultFocusManager(() => shown);
      fm.focus(b);
      shown.pop();
      fm.settle(shown);
      expect(fm.current).toBe(a);
      expect(b.focused).toBe(false);
    });

    it("keeps focus on a widget the view drew that the frame crops off screen", () => {
      const a = new StubWidget("a");
      const b = new StubWidget("b");
      const shown = [a, b];
      const fm = new DefaultFocusManager(() => shown);
      fm.focus(b);
      shown.pop();
      fm.settle([a, b]);
      expect(fm.current).toBe(b);
      expect(b.focused).toBe(true);
    });

    it("moves focus off a widget that was disabled", () => {
      const a = new StubWidget("a");
      const b = new StubWidget("b");
      const fm = over(a, b);
      fm.focus(b);
      b.setDisabled(true);
      fm.settle([a, b]);
      expect(fm.current).toBe(a);
    });

    it("drops focus when nothing on screen can take it", () => {
      const a = new StubWidget("a");
      const shown = [a];
      const fm = new DefaultFocusManager(() => shown);
      fm.settle(shown);
      shown.pop();
      fm.settle(shown);
      expect(fm.current).toBeNull();
      expect(a.focused).toBe(false);
    });
  });

  describe("next() / prev()", () => {
    it("cycles forward through focusable widgets", () => {
      const a = new StubWidget("a");
      const b = new StubWidget("b");
      const c = new StubWidget("c");
      const fm = over(a, b, c);

      fm.next();
      expect(fm.current).toBe(a);
      fm.next();
      expect(fm.current).toBe(b);
      fm.next();
      expect(fm.current).toBe(c);
      fm.next();
      expect(fm.current).toBe(a); // wraps
    });

    it("cycles backward through focusable widgets", () => {
      const a = new StubWidget("a");
      const b = new StubWidget("b");
      const c = new StubWidget("c");
      const fm = over(a, b, c);
      fm.settle([a, b, c]);

      fm.prev();
      expect(fm.current).toBe(c); // wraps to last
      fm.prev();
      expect(fm.current).toBe(b);
    });

    it("skips non-focusable widgets", () => {
      const a = new StubWidget("a");
      const b = new StubWidget("b", false);
      const c = new StubWidget("c");
      const fm = over(a, b, c);
      fm.settle([a, b, c]);

      fm.next();
      expect(fm.current).toBe(c); // skipped b
      fm.next();
      expect(fm.current).toBe(a); // wraps, skipped b
    });

    it("skips disabled widgets", () => {
      const a = new StubWidget("a");
      const b = new StubWidget("b");
      const c = new StubWidget("c");
      const fm = over(a, b, c);
      fm.settle([a, b, c]);

      b.setDisabled(true);
      fm.next(); // a -> skip b -> c
      expect(fm.current).toBe(c);
    });

    it("no-ops when no focusable widgets exist", () => {
      const fm = over(new StubWidget("a", false));
      fm.next();
      expect(fm.current).toBeNull();
    });
  });

  describe("focus()", () => {
    it("focuses a specific widget", () => {
      const a = new StubWidget("a");
      const b = new StubWidget("b");
      const fm = over(a, b);
      fm.settle([a, b]);

      fm.focus(b);
      expect(fm.current).toBe(b);
      expect(a.focused).toBe(false);
      expect(b.focused).toBe(true);
    });

    it("focuses a widget not yet on screen", () => {
      // An app about to show a widget focuses it first; the frame that shows
      // it keeps it (settle).
      const a = new StubWidget("a");
      const fm = over();
      fm.focus(a);
      expect(fm.current).toBe(a);
    });

    it("rejects focus on non-focusable widget", () => {
      const a = new StubWidget("a");
      const b = new StubWidget("b", false);
      const fm = over(a, b);
      fm.settle([a, b]);

      fm.focus(b);
      expect(fm.current).toBe(a); // unchanged
    });

    it("rejects focus on disabled widget", () => {
      const a = new StubWidget("a");
      const b = new StubWidget("b");
      const fm = over(a, b);
      fm.settle([a, b]);

      b.setDisabled(true);
      fm.focus(b);
      expect(fm.current).toBe(a); // unchanged
    });

    it("dispatches handleFocus exactly once per focus transition", () => {
      // [LAW:single-enforcer] WidgetBase.focus()/blur() route through
      // handleFocus; FocusManager must not call handleFocus a second time
      // or every subclass override (Dropdown.handleFocus, custom widgets
      // that track focus counts, etc.) runs twice per transition.
      class Counting extends StubWidget {
        focusCount = 0;
        blurCount = 0;
        override handleFocus(event: { type: "focus" | "blur" }): void {
          super.handleFocus(event);
          if (event.type === "focus") this.focusCount++;
          else this.blurCount++;
        }
      }
      const a = new Counting("a");
      const b = new Counting("b");
      const shown = [a, b];
      const fm = new DefaultFocusManager(() => shown);
      fm.settle([a, b]); // focuses a → a.focusCount = 1

      expect(a.focusCount).toBe(1);
      expect(a.blurCount).toBe(0);

      fm.focus(b); // a blurs once, b focuses once
      expect(a.focusCount).toBe(1);
      expect(a.blurCount).toBe(1);
      expect(b.focusCount).toBe(1);
      expect(b.blurCount).toBe(0);

      shown.length = 0;
      fm.settle([]); // nothing drawn: b blurs once
      expect(b.blurCount).toBe(1);
    });
  });

  describe("onChange", () => {
    it("fires on focus transitions", () => {
      const a = new StubWidget("a");
      const b = new StubWidget("b");
      const shown = [a, b];
      const fm = new DefaultFocusManager(() => shown);
      const changes: (InteractiveWidget | null)[] = [];
      fm.onChange((current) => changes.push(current));

      fm.settle([a, b]);
      fm.settle([a, b]);
      fm.next();
      shown.length = 0;
      fm.settle([]);

      // settle → a, settle again → no change (a stays), next → b, nothing
      // drawn → null
      expect(changes).toEqual([a, b, null]);
    });

    it("unsubscribes correctly", () => {
      const a = new StubWidget("a");
      const fm = over(a);
      const changes: (InteractiveWidget | null)[] = [];
      const unsub = fm.onChange((current) => changes.push(current));

      unsub();
      fm.settle([a]);
      expect(changes).toHaveLength(0);
    });
  });
});
