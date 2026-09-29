/**
 * Contract of `WidgetApp` — an `App` whose widgets sit anywhere in the view's
 * renderable tree and still take focus, keys and clicks.
 *
 * [LAW:behavior-not-structure] Input goes in as the bytes a terminal sends,
 * through a scripted host; what is asserted is which widget has focus, what
 * a widget did with a click, and the frame the user sees.
 */

import { describe, it, expect } from "vitest";
import { runInAction, observable } from "mobx";

import { WidgetApp } from "../../src/widgets/widget-app.js";
import { Checkbox } from "../../src/widgets/checkbox.js";
import { Dropdown } from "../../src/widgets/dropdown.js";
import { Button } from "../../src/widgets/button.js";
import { Layout } from "../../src/renderables/layout.js";
import { Panel } from "../../src/renderables/panel.js";
import { Group } from "../../src/renderables/group.js";
import { RichText } from "../../src/core/text.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";
import type { Segment } from "../../src/core/segment.js";
import type { AppOptions } from "../../src/host/app.js";
import { scriptedHost, type ScriptedHost } from "../host/scripted-host.js";

const TAB = "\t";
const SHIFT_TAB = "\x1b[Z";
const SPACE = " ";

/** A click as an SGR-reporting terminal sends it: press, then release. */
function click(x: number, y: number): string {
  return `\x1b[<0;${x + 1};${y + 1}M\x1b[<0;${x + 1};${y + 1}m`;
}

/** The pointer moving, no button held, as an SGR-reporting terminal sends it. */
function move(x: number, y: number): string {
  return `\x1b[<35;${x + 1};${y + 1}M`;
}

/** Where `text` starts on the frame on screen, as a cell. */
function cellOf(app: WidgetApp, text: string): { x: number; y: number } {
  for (const [y, line] of app.frame.entries()) {
    const x = line.map((s) => s.text).join("").indexOf(text);
    if (x !== -1) return { x, y };
  }
  throw new Error(`"${text}" is not on the frame:\n${rows(app).join("\n")}`);
}

function rows(app: WidgetApp): string[] {
  return app.frame.map((line) => line.map((s) => s.text).join(""));
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function start(
  host: ScriptedHost,
  view: () => Renderable,
  surface: AppOptions["surface"] = "alternate",
): WidgetApp {
  const app = new WidgetApp({ host, surface, view });
  void app.run();
  return app;
}

function text(value: string): Renderable {
  return new RichText(value, { end: "" });
}

/**
 * Two columns: `left` above `under` in the left pane, `right` in the right.
 * Reading order is left, right, under; document order is left, under, right.
 */
function columns(): { view: Layout; left: Checkbox; under: Checkbox; right: Checkbox } {
  const left = new Checkbox({ label: "left", id: "left" });
  const under = new Checkbox({ label: "under", id: "under" });
  const right = new Checkbox({ label: "right", id: "right" });
  const view = new Layout();
  view.splitRow(
    new Layout(new Panel(new Group(left, text("\n\n"), under), { title: "a" })),
    new Layout(new Panel(right, { title: "b" })),
  );
  return { view, left, under, right };
}

describe("WidgetApp focus", () => {
  it("moves in document order through widgets nested in panels in a layout", async () => {
    const host = scriptedHost({ cols: 40, rows: 8 });
    const { view, left, under, right } = columns();
    const app = start(host, () => view);
    await tick();

    // The first widget in document order has focus before any key.
    expect(app.focusManager.current).toBe(left);
    expect(left.focused).toBe(true);

    host.type(TAB);
    expect(app.focusManager.current).toBe(under);
    host.type(TAB);
    expect(app.focusManager.current).toBe(right);
    host.type(TAB);
    expect(app.focusManager.current).toBe(left);
    host.type(SHIFT_TAB);
    expect(app.focusManager.current).toBe(right);
    expect(right.focused).toBe(true);
    expect(left.focused).toBe(false);
  });

  it("gives the focused widget its keys, however deep it is nested", async () => {
    const host = scriptedHost({ cols: 40, rows: 8 });
    const { view, under } = columns();
    const app = start(host, () => view);
    await tick();

    host.type(TAB);
    host.type(SPACE);

    expect(under.checked).toBe(true);
    await tick();
    expect(rows(app).join("\n")).toContain("[✓] under");
  });

  it("skips a widget the frame does not show", async () => {
    const host = scriptedHost({ cols: 20, rows: 3 });
    const shown = new Checkbox({ label: "shown", id: "shown" });
    const below = new Checkbox({ label: "below", id: "below" });
    const app = start(host, () => new Group(shown, text("\n\n\n"), below));
    await tick();

    expect(app.focusManager.widgets).toEqual([shown]);
    host.type(TAB);
    expect(app.focusManager.current).toBe(shown);
  });

  it("moves off a widget that stops being drawn, to the first that is", async () => {
    const host = scriptedHost({ cols: 20, rows: 4 });
    const a = new Checkbox({ label: "a", id: "a" });
    const b = new Checkbox({ label: "b", id: "b" });
    const showB = observable.box(true);
    const app = start(host, () => (showB.get() ? new Group(a, b) : new Group(a)));
    await tick();
    host.type(TAB);
    expect(app.focusManager.current).toBe(b);

    runInAction(() => showB.set(false));
    await tick();

    expect(app.focusManager.current).toBe(a);
    expect(b.focused).toBe(false);
    expect(a.focused).toBe(true);
  });

  it("keeps a widget focused before it is drawn once the frame shows it", async () => {
    const host = scriptedHost({ cols: 20, rows: 4 });
    const a = new Checkbox({ label: "a", id: "a" });
    const b = new Checkbox({ label: "b", id: "b" });
    const showB = observable.box(false);
    const app = start(host, () => (showB.get() ? new Group(a, b) : new Group(a)));
    await tick();

    runInAction(() => {
      showB.set(true);
      app.focusManager.focus(b);
    });
    await tick();

    expect(app.focusManager.current).toBe(b);
  });

  it("keeps focus on a widget the frame crops for the moment", async () => {
    const host = scriptedHost({ cols: 20, rows: 4 });
    const a = new Checkbox({ label: "a", id: "a" });
    const b = new Checkbox({ label: "b", id: "b" });
    const app = start(host, () => new Group(a, text("\n"), b));
    await tick();
    host.type(TAB);
    expect(app.focusManager.current).toBe(b);

    host.resize({ cols: 20, rows: 1 });
    await tick();
    expect(rows(app).join("\n")).not.toContain("b");
    expect(app.focusManager.current).toBe(b);

    host.resize({ cols: 20, rows: 4 });
    await tick();
    expect(b.focused).toBe(true);
  });

  it("moves focus off a widget no frame draws, though nothing had focus", async () => {
    const host = scriptedHost({ cols: 20, rows: 4 });
    const never = new Checkbox({ label: "never", id: "never" });
    const app = start(host, () => text("no widgets"));
    await tick();

    app.focusManager.focus(never);
    await tick();

    expect(app.focusManager.current).toBeNull();
    expect(never.focused).toBe(false);
  });

  it("tells focus listeners when the frame moves focus", async () => {
    const host = scriptedHost({ cols: 20, rows: 4 });
    const a = new Checkbox({ label: "a", id: "a" });
    const heard: (string | null)[] = [];
    const app = new WidgetApp({ host, surface: "alternate", view: () => a });
    app.focusManager.onChange((current) => heard.push(current?.id ?? null));

    void app.run();
    await tick();

    expect(heard).toEqual(["a"]);
  });
});

describe("WidgetApp pointer", () => {
  it("reaches a widget nested in a panel in a layout at its true screen position", async () => {
    const host = scriptedHost({ cols: 40, rows: 8 });
    const { view, under, right } = columns();
    const app = start(host, () => view);
    await tick();

    const at = cellOf(app, "[ ] under");
    host.type(click(at.x + 1, at.y));

    expect(under.checked).toBe(true);
    expect(right.checked).toBe(false);
  });

  it("paints an overlay below its owner's footprint, and a click on it reaches the owner", async () => {
    const host = scriptedHost({ cols: 40, rows: 10 });
    const dropdown = new Dropdown({ options: ["Red", "Green", "Blue"], selectedIndex: 0, id: "dd" });
    const below = new Button({ label: "below", id: "below" });
    const app = start(host, () => new Panel(new Group(dropdown, below)));
    await tick();

    const header = cellOf(app, "Red");
    host.type(click(header.x, header.y));
    await tick();

    expect(dropdown.expanded).toBe(true);
    // The overlay covers the button beneath the header, at the header's column.
    const green = cellOf(app, "Green");
    expect(green).toEqual({ x: header.x, y: header.y + 2 });
    expect(rows(app).join("\n")).not.toContain("below");

    host.type(click(green.x, green.y));
    await tick();

    expect(dropdown.selectedIndex).toBe(1);
    expect(dropdown.expanded).toBe(false);
    expect(rows(app).join("\n")).toContain("below");
  });

  it("reads hover off each frame, under a pointer that has not moved", async () => {
    const host = scriptedHost({ cols: 20, rows: 4 });
    const box = new Checkbox({ label: "a", id: "a" });
    const shown = observable.box(true);
    const app = start(host, () => (shown.get() ? box : text("")));
    await tick();
    const at = cellOf(app, "[ ] a");
    host.type(move(at.x, at.y));
    expect(box.hovered).toBe(true);

    runInAction(() => shown.set(false));
    await tick();
    expect(box.hovered).toBe(false);

    runInAction(() => shown.set(true));
    await tick();
    expect(box.hovered).toBe(true);
  });

  it("gives focus and clicks to a widget drawn in another widget's overlay", async () => {
    const host = scriptedHost({ cols: 20, rows: 6 });
    const ok = new Button({ label: "ok", id: "ok" });
    class WithPopup extends Checkbox {
      renderOverlay(options: RenderOptions): Iterable<Segment> {
        return ok.render(options);
      }
    }
    const owner = new WithPopup({ label: "owner", id: "owner" });
    const app = start(host, () => owner);
    await tick();
    let submitted = 0;
    ok.onSubmit(() => (submitted += 1));

    host.type(TAB);
    expect(app.focusManager.current).toBe(ok);

    const at = cellOf(app, "ok");
    host.type(click(at.x, at.y));
    expect(submitted).toBe(1);
  });

  it("hears every pointer event in terminal cells before any widget", async () => {
    const host = scriptedHost({ cols: 20, rows: 4 });
    const box = new Checkbox({ label: "a", id: "a" });
    const app = start(host, () => box);
    const heard: string[] = [];
    app.onMouse((event) => heard.push(`${event.type}@${event.x},${event.y}`));
    await tick();

    host.type(click(3, 2));

    expect(heard).toEqual(["mouse_down@3,2", "mouse_up@3,2"]);
  });
});

describe("WidgetApp lifecycle", () => {
  it("repaints when an observable the view read changes", async () => {
    const host = scriptedHost({ cols: 20, rows: 3 });
    const label = observable.box("before");
    const app = start(host, () => text(label.get()));
    await tick();
    expect(rows(app)[0]).toBe("before");

    runInAction(() => label.set("after"));
    await tick();

    expect(rows(app)[0]).toBe("after");
  });

  it("hands a key to a high handler ahead of the focused widget", async () => {
    const host = scriptedHost({ cols: 20, rows: 3 });
    const box = new Checkbox({ label: "a", id: "a" });
    const app = start(host, () => box);
    await tick();
    app.onKey((event) => {
      if (event.key === "space") event.stop();
    }, { priority: "high" });

    host.type(SPACE);

    expect(box.checked).toBe(false);
  });

  it("stops reading input when it stops, and hands the terminal back", async () => {
    const host = scriptedHost({ cols: 20, rows: 3 });
    const box = new Checkbox({ label: "a", id: "a" });
    const app = new WidgetApp({ host, surface: "alternate", view: () => box });
    const done = app.run();
    await tick();

    app.stop();
    await done;
    host.type(SPACE);

    expect(box.checked).toBe(false);
    expect(host.raw()).toBe(false);
    expect(app.phase).toBe("stopped");
  });

  it("fails run with the error a view threw, the terminal handed back first", async () => {
    const host = scriptedHost({ cols: 20, rows: 3 });
    const app = new WidgetApp({
      host,
      surface: "alternate",
      view: () => {
        throw new Error("view broke");
      },
    });

    await expect(app.run()).rejects.toThrow("view broke");
    expect(host.raw()).toBe(false);
  });

  it("still hears keys from a view that asks for a frame on every frame", async () => {
    const host = scriptedHost({ cols: 20, rows: 3 });
    // A new widget each frame: focus settles onto each one, and each move
    // asks for the next frame.
    const app = new WidgetApp({
      host,
      surface: "alternate",
      view: () => new Checkbox({ label: "a", id: "a" }),
    });
    app.onKey((event) => {
      if (event.ctrl && event.key === "c") app.stop();
    }, { priority: "high" });
    const done = app.run();
    await tick();

    host.type("\x03");

    await expect(done).resolves.toBeUndefined();
  });

  it("subscribes to no input on a host a failed first frame has stopped", async () => {
    const script = scriptedHost({ cols: 20, rows: 3 });
    const calls: string[] = [];
    const host = {
      ...script,
      onData: (handler: Parameters<typeof script.onData>[0]) => {
        calls.push("onData");
        return script.onData(handler);
      },
      stop: () => {
        calls.push("stop");
        script.stop();
      },
    };
    const app = new WidgetApp({
      host,
      surface: "alternate",
      view: () => {
        throw new Error("view broke");
      },
    });

    await expect(app.run()).rejects.toThrow("view broke");

    expect(calls.lastIndexOf("onData")).toBeLessThan(calls.lastIndexOf("stop"));
  });

  it("refuses a second run without ending the input of the first", async () => {
    const host = scriptedHost({ cols: 20, rows: 3 });
    const box = new Checkbox({ label: "a", id: "a" });
    const app = new WidgetApp({ host, surface: "alternate", view: () => box });
    void app.run();
    await tick();

    await expect(app.run()).rejects.toThrow(/runs once/);
    host.type(SPACE);

    expect(box.checked).toBe(true);
  });
});
