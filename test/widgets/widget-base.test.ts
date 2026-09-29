import { describe, it, expect } from "vitest";
import { Segment } from "../../src/core/segment.js";
import type { RenderOptions } from "../../src/core/protocol.js";
import type {
  InteractiveWidget,
  KeyEvent,
  WidgetFocusEvent,
} from "../../src/widgets/types.js";
import { WidgetBase } from "../../src/widgets/widget-base.js";

class StubWidget extends WidgetBase {
  readonly id = "stub";
  readonly focusable = true;

  handleKey(_event: KeyEvent): void {}

  protected draw(_options: RenderOptions): Iterable<Segment> {
    return [new Segment("st"), new Segment("ub\nnext")];
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 4, maximum: 4 };
  }

  triggerChange(): void { this.emitChange(); }
  triggerSubmit(): void { this.emitSubmit(); }
}

// Draws exactly `text`.
class TextWidget extends StubWidget {
  constructor(private readonly text: string) {
    super();
  }
  protected override draw(_options: RenderOptions): Iterable<Segment> {
    return [new Segment(this.text)];
  }
}

const rows = (widget: WidgetBase): string[] =>
  Segment.splitLines(widget.render({ maxWidth: 80 })).map((line) => line.map((s) => s.text).join(""));

describe("WidgetBase", () => {
  it("implements InteractiveWidget", () => {
    const widget: InteractiveWidget = new StubWidget();
    expect(widget.id).toBe("stub");
    expect(widget.focusable).toBe(true);
    expect(widget.focused).toBe(false);
    expect(widget.hovered).toBe(false);
    expect(widget.active).toBe(false);
    expect(widget.disabled).toBe(false);
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

  it("stamps every cell it draws with its own row and column", () => {
    const widget = new StubWidget();
    const lines = Segment.splitLines(widget.render({ maxWidth: 80 }));
    expect(lines.map((line) => line.map((s) => s.text))).toEqual([["st", "ub"], ["next"]]);
    expect(Segment.anchorAt(lines, 3, 0)).toMatchObject({ owner: widget, row: 0, col: 3 });
    expect(Segment.anchorAt(lines, 2, 1)).toMatchObject({ owner: widget, row: 1, col: 2 });
  });

  it("keeps a blank last row", () => {
    expect(rows(new TextWidget("a\n\n"))).toEqual(["a", " "]);
    expect(rows(new TextWidget("\n"))).toEqual([""]);
  });

  it("owns its whole rectangle: a short row is padded to the widest", () => {
    const widget = new TextWidget("long\nab");
    const lines = Segment.splitLines(widget.render({ maxWidth: 80 }));
    expect(rows(widget)).toEqual(["long", "ab  "]);
    expect(Segment.anchorAt(lines, 3, 1)).toMatchObject({ owner: widget, row: 1, col: 3 });
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

  it("reports itself to onDraw before the widgets nested in its output", () => {
    // Document order — the order focus moves in — is the order these calls arrive.
    const inner = new TextWidget("in");
    const outer = new (class extends StubWidget {
      protected override draw(options: RenderOptions): Iterable<Segment> {
        return inner.render(options);
      }
    })();
    const heard: object[] = [];
    [...outer.render({ maxWidth: 80, onDraw: (owner) => heard.push(owner) })];
    expect(heard).toEqual([outer, inner]);
  });

  it("measures width", () => {
    const widget = new StubWidget();
    const { minimum, maximum } = widget.measure({ maxWidth: 80 });
    expect(minimum).toBe(4);
    expect(maximum).toBe(4);
  });
});
