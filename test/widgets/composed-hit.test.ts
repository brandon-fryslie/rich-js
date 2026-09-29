import { describe, it, expect } from "vitest";
import { Segment } from "../../src/core/segment.js";
import { Layout } from "../../src/renderables/layout.js";
import { Panel } from "../../src/renderables/panel.js";
import { Button } from "../../src/widgets/button.js";
import { Slider } from "../../src/widgets/slider.js";
import { TextInput } from "../../src/widgets/text-input.js";
import { DefaultFocusManager } from "../../src/widgets/focus-manager.js";
import { EventRouter } from "../../src/widgets/event-router.js";
import { NodeTerminalHost } from "../../src/node/terminal-host.js";
import type { RenderOptions } from "../../src/core/protocol.js";
import type { InteractiveWidget, WidgetMouseEvent } from "../../src/widgets/types.js";

// [LAW:behavior-not-structure] The contract of rich-runtime-fna.2, end to end:
// a widget nested in containers that know nothing about widgets is found by
// the router at the cell the user sees it in, and handed the event in its own
// coordinates. Nothing here tells the router, the Panel or the Layout where
// the widget went — the only geometry is the frame.

const OPTIONS: RenderOptions = { maxWidth: 40, height: { rows: 5, exact: true } };

/** The widget in a Panel in the right pane of a Layout row split. */
function composed(widget: InteractiveWidget): Layout {
  const layout = new Layout();
  layout.splitRow(new Layout("left pane"), new Layout(new Panel(widget)));
  return layout;
}

/** A router reading the frame `root` paints now, as a screen would supply it. */
function routerOver(root: Layout): EventRouter {
  const frame = (): Segment[][] => Segment.splitLines(root.render(OPTIONS));
  return new EventRouter({
    screen: { focusManager: new DefaultFocusManager(), get frame() { return frame(); } },
    host: new NodeTerminalHost({ stdout: { write: () => true, on: () => {}, off: () => {} } }),
  });
}

/** Where `text` first appears on screen, read off the painted characters. */
function find(root: Layout, text: string): { x: number; y: number } {
  const rows = Segment.splitLines(root.render(OPTIONS))
    .map((line) => line.map((s) => s.text).join(""));
  const y = rows.findIndex((row) => row.includes(text));
  expect(y, `"${text}" is on screen`).toBeGreaterThanOrEqual(0);
  return { x: rows[y]!.indexOf(text), y };
}

// SGR mouse reports are 1-based.
const press = (x: number, y: number): string => `\x1b[<0;${x + 1};${y + 1}M`;
const drag = (x: number, y: number): string => `\x1b[<32;${x + 1};${y + 1}M`;
const release = (x: number, y: number): string => `\x1b[<0;${x + 1};${y + 1}m`;

class ProbeButton extends Button {
  readonly events: WidgetMouseEvent[] = [];
  override handleMouse(event: WidgetMouseEvent): void {
    this.events.push(event);
    super.handleMouse(event);
  }
}

describe("a widget composed inside a Panel inside a Layout split", () => {
  it("receives a click at its true screen position, in its own coordinates", () => {
    const button = new ProbeButton({ label: "Go" });
    const root = composed(button);
    const router = routerOver(root);
    const submits: InteractiveWidget[] = [];
    button.onSubmit((w) => submits.push(w));

    const go = find(root, "Go");
    // The pane and the panel border put the button well away from the origin.
    expect(go.x).toBeGreaterThan(20);
    expect(go.y).toBeGreaterThan(0);

    router.feed(press(go.x, go.y));
    router.feed(release(go.x + 1, go.y));
    // "  Go  ": the label starts at the button's column 2, on its row 0.
    expect(button.events.map(({ type, x, y }) => ({ type, x, y }))).toEqual([
      { type: "mouse_down", x: 2, y: 0 },
      { type: "mouse_up", x: 3, y: 0 },
    ]);
    expect(submits).toEqual([button]);
  });

  it("a click on the pane beside it reaches no widget", () => {
    const button = new ProbeButton({ label: "Go" });
    const root = composed(button);
    routerOver(root).feed(press(find(root, "left pane").x, find(root, "left pane").y));
    expect(button.events).toEqual([]);
  });

  it("a click past the end of a short row of a multiline input reaches it", () => {
    const input = new TextInput({ value: "long line\nab", multiline: true });
    const root = composed(input);
    const ab = find(root, "ab");
    routerOver(root).feed(press(ab.x + 5, ab.y));
    expect(input.cursorPosition).toBe(input.value.length);
  });

  it("a drag started on a Slider and released past its edge clamps", () => {
    const slider = new Slider({ value: 0, min: 0, max: 100, width: 10 });
    const root = composed(slider);
    const router = routerOver(root);

    const start = find(root, "●");
    router.feed(press(start.x, start.y));
    router.feed(drag(start.x + 15, start.y + 1));
    router.feed(release(start.x + 15, start.y + 1));
    expect(slider.value).toBe(100);

    const end = find(root, "●");
    expect(end.x).toBe(start.x + 9);
    router.feed(press(end.x, end.y));
    router.feed(release(end.x - 15, end.y));
    expect(slider.value).toBe(0);
  });
});
