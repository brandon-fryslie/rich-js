/**
 * Contract of the pointer's shape over a widget app (OSC 22): the hovered
 * widget names it — a hand over a control that can be used, an I-beam over a
 * field, the terminal's default anywhere else — the app writes it only when it
 * changes, and hands the terminal back with its default shape.
 *
 * [LAW:behavior-not-structure] Driven through a `WidgetApp` on a scripted
 * host: what is asserted is the bytes the terminal receives.
 */

import { describe, it, expect } from "vitest";

import { WidgetApp } from "../../src/widgets/widget-app.js";
import { Button } from "../../src/widgets/button.js";
import { TextInput } from "../../src/widgets/text-input.js";
import { Group } from "../../src/renderables/group.js";
import { scriptedHost, type ScriptedHost } from "../host/scripted-host.js";
import { fakeClock } from "../core/fake-clock.js";
import { App } from "../../src/host/app.js";
import { RichText } from "../../src/core/text.js";

// The pointer moved with no button held, at a 1-based column and row.
const moveTo = (col: number, row: number): string => `\x1b[<35;${col};${row}M`;

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** The OSC 22 shapes written to `host`, in order. */
const shapes = (host: ScriptedHost): string[] =>
  [...host.output().matchAll(/\x1b\]22;([^\x1b]*)\x1b\\/g)].map((match) => match[1]!);

function start(options: { disabled?: boolean } = {}): { app: WidgetApp; host: ScriptedHost; done: Promise<void> } {
  const host = scriptedHost({ cols: 20, rows: 4 });
  const button = new Button({ label: "Go" });
  button.setDisabled(options.disabled ?? false);
  const input = new TextInput({ value: "hello" });
  // Row 1 the button, row 2 the field, rows 3 and 4 nothing.
  const app = new WidgetApp({ host, surface: "alternate", clock: fakeClock(0), view: () => new Group(button, input) });
  return { app, host, done: app.run() };
}

describe("the pointer's shape over a widget app", () => {
  it("is a hand over a button, an I-beam over a field, and the default over nothing", async () => {
    const { app, host } = start();
    host.type(moveTo(2, 1));
    await tick();
    host.type(moveTo(3, 2));
    await tick();
    host.type(moveTo(3, 4));
    await tick();
    expect(shapes(host)).toEqual(["pointer", "text", "default"]);
    app.stop();
  });

  it("is written once for as long as it stays the same", async () => {
    const { app, host } = start();
    host.type(moveTo(2, 1));
    await tick();
    host.type(moveTo(3, 1));
    await tick();
    expect(shapes(host)).toEqual(["pointer"]);
    app.stop();
  });

  it("is the default over a control that cannot be used", async () => {
    const { app, host } = start({ disabled: true });
    host.type(moveTo(2, 1));
    await tick();
    expect(shapes(host)).toEqual([]);
    app.stop();
  });

  it("is given back as the default when the app hands the terminal back", async () => {
    const { app, host, done } = start();
    host.type(moveTo(3, 2));
    await tick();
    app.stop();
    await done;
    expect(shapes(host)).toEqual(["text", "default"]);
  });

  it("is shown again when an app resumes, after the default while it is suspended", async () => {
    const host = scriptedHost({ cols: 20, rows: 4 });
    const app = new App({ host, surface: "alternate", view: () => new RichText("canvas") });
    const done = app.run();
    app.pointerShape = "crosshair";
    const suspended = app.suspend();
    host.resume();
    await suspended;
    expect(app.pointerShape).toBe("crosshair");
    app.stop();
    await done;
    expect(shapes(host)).toEqual(["crosshair", "default", "crosshair", "default"]);
    expect(app.pointerShape).toBe("default");
  });
});
