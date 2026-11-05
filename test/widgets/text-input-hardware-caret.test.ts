/**
 * Contract of the terminal's own cursor on a focused `TextInput`: where an app
 * paints, the field marks its caret cell (`Style.caret`) instead of drawing
 * one, and the painter shows the terminal's cursor on that cell in the field's
 * shape (DECSCUSR) after each frame, hides it while it paints, and gives the
 * terminal its default shape back when it hands the terminal back.
 *
 * [LAW:behavior-not-structure] Driven through a `WidgetApp` on a scripted
 * host: what is asserted is the bytes the terminal receives and the frame on
 * screen.
 */

import { describe, it, expect } from "vitest";

import { WidgetApp } from "../../src/widgets/widget-app.js";
import { TextInput, type TextInputOptions } from "../../src/widgets/text-input.js";
import { Group } from "../../src/renderables/group.js";
import { Style } from "../../src/core/style.js";
import type { Surface } from "../../src/core/paint.js";
import { scriptedHost, type ScriptedHost } from "../host/scripted-host.js";
import { fakeClock } from "../core/fake-clock.js";

const SHOW = "\x1b[?25h";
const HIDE = "\x1b[?25l";
const CARET = new Style({ reverse: true });

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

interface Started {
  readonly app: WidgetApp;
  readonly host: ScriptedHost;
  readonly input: TextInput;
  readonly done: Promise<unknown>;
}

function start(
  input: Partial<TextInputOptions> = {},
  app: { surface?: Surface; reducedMotion?: boolean; focused?: boolean } = {},
): Started {
  const { surface = "alternate", reducedMotion = false, focused = true } = app;
  const host = scriptedHost({ cols: 20, rows: 2 });
  const field = new TextInput({ value: "hello", cursorStyle: CARET, ...input });
  if (focused) field.focus(0);
  const widgets = new WidgetApp({ host, surface, clock: fakeClock(0), reducedMotion, view: () => field });
  const done = widgets.run();
  return { app: widgets, host, input: field, done };
}

describe("TextInput on the terminal's own cursor", () => {
  it("shows the cursor as a blinking bar on the cell after the text, and draws no caret of its own", () => {
    const { app, host } = start();
    // "[hello" is six cells, so the cell after the text is column 6 of the
    // first row; the cursor rests on the frame's second row and goes up one.
    expect(host.output().endsWith(`\x1b[1A\r\x1b[6C\x1b[5 q${SHOW}\x1b[?2026l`)).toBe(true);
    expect(app.frame.flat().some((s) => s.style?.reverse === true)).toBe(false);
    app.stop();
  });

  it.each([
    ["block", 1],
    ["underline", 3],
    ["bar", 5],
  ] as const)("writes the %s shape's DECSCUSR, and its steady twin under reduced motion", (caretShape, code) => {
    const moving = start({ caretShape });
    expect(moving.host.output()).toContain(`\x1b[${code} q${SHOW}`);
    moving.app.stop();
    const still = start({ caretShape }, { reducedMotion: true });
    expect(still.host.output()).toContain(`\x1b[${code + 1} q${SHOW}`);
    still.app.stop();
  });

  it("stands on the first cell of a wide glyph's successor, counting the glyphs before it in cells", () => {
    const { app, host } = start({ value: "日本" });
    // "[" and two two-cell glyphs.
    expect(host.output()).toContain(`\r\x1b[5C\x1b[5 q${SHOW}`);
    app.stop();
  });

  it("follows the cursor as it moves", async () => {
    const { app, host } = start();
    host.type("\x1b[D");
    await tick();
    expect(host.output().endsWith(`\r\x1b[5C${SHOW}\x1b[?2026l`)).toBe(true);
    app.stop();
  });

  it("is hidden while a frame paints, and stays hidden once no field is focused", async () => {
    const host = scriptedHost({ cols: 20, rows: 3 });
    const field = new TextInput({ value: "a" });
    const other = new TextInput({ value: "b", disabled: true });
    field.focus(0);
    const app = new WidgetApp({ host, surface: "alternate", clock: fakeClock(0), view: () => new Group(field, other) });
    void app.run();
    const before = host.output().length;
    field.blur(0);
    app.refresh();
    await tick();
    const repaint = host.output().slice(before);
    expect(repaint.startsWith(`\x1b[?2026h${HIDE}`)).toBe(true);
    expect(repaint).not.toContain(SHOW);
    app.stop();
  });

  it("never draws a blink the terminal does not need: an idle field paints nothing more", () => {
    const clock = fakeClock(0);
    const host = scriptedHost({ cols: 20, rows: 2 });
    const field = new TextInput({ value: "hello" });
    field.focus(0);
    const app = new WidgetApp({ host, surface: "alternate", clock, view: () => field });
    void app.run();
    const painted = host.output();
    clock.advance(3);
    expect(host.output()).toBe(painted);
    app.stop();
  });

  it("goes home from the caret's row on an inline surface, and back to the frame's last row on hand-back", async () => {
    const { app, host, done } = start({ multiline: true, value: "ab\ncd", minRows: 2 }, { surface: "inline" });
    // A multiline field starts with the cursor at its start: the first row,
    // one up from the frame's last.
    const first = host.output();
    expect(first).toContain(`\x1b[1A\r\x1b[5 q${SHOW}`);
    host.type("x");
    await tick();
    const second = host.output().slice(first.length);
    // Already on the first row: no move up before the frame.
    expect(second.startsWith(`\x1b[?2026h${HIDE}\r\x1b[2K`)).toBe(true);
    app.stop();
    await done;
    const handBack = host.output().slice(first.length + second.length);
    expect(handBack).toContain(`\x1b[0m\x1b[1B\x1b[0 q${SHOW}\n`);
  });
});
