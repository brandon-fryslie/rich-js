/**
 * Contract of an app's chrome channel and its cursor's color: what `chrome`
 * asks for reaches the terminal once, every exit path gives the terminal its
 * own back, and a tmux reattach — focus-in, or a resize — re-sends what only a
 * passthrough carried.
 *
 * [LAW:behavior-not-structure] Driven through an `App` on a scripted host:
 * what is asserted is the bytes the terminal receives.
 */

import { describe, expect, it } from "vitest";

import { App, type AppOptions } from "../../src/host/app.js";
import { InputParser, keyName } from "../../src/host/input.js";
import { ColorRgba } from "../../src/core/color.js";
import { Style } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import { declareCapabilities, type LayerDeclaration } from "../../src/core/terminal-capabilities.js";
import { WidgetApp } from "../../src/widgets/widget-app.js";
import { TextInput } from "../../src/widgets/text-input.js";
import { fakeClock } from "../core/fake-clock.js";
import { scriptedHost, type ScriptedHost } from "./scripted-host.js";

const ESC = "\x1b";
const ST = `${ESC}\\`;
const purple = new ColorRgba(128, 0, 255);
const FOCUS_IN = `${ESC}[I`;
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const count = (text: string, part: string): number => text.split(part).length - 1;

function start(layers: readonly LayerDeclaration[] = [], options: Partial<AppOptions> = {}): { app: App; host: ScriptedHost; done: Promise<void> } {
  const host = scriptedHost({ cols: 20, rows: 4 });
  const app = new App({
    host,
    surface: "alternate",
    clock: fakeClock(0),
    view: new RichText("hi"),
    terminalFeatures: { capabilities: declareCapabilities([], "iterm2"), layers },
    ...options,
  });
  return { app, host, done: app.run() };
}

describe("an app's chrome", () => {
  it("is sent once when set, and given back when the app stops", async () => {
    const { app, host, done } = start();
    app.chrome = { title: "build", tabColor: purple, badge: "prod" };
    app.refresh();
    await tick();
    const shown = host.output();
    expect(count(shown, `${ESC}]2;build${ST}`)).toBe(1);
    expect(count(shown, `${ESC}[22;0t`)).toBe(1);
    expect(count(shown, "]6;1;bg;red;brightness;128")).toBe(1);
    app.stop();
    await done;
    const after = host.output().slice(shown.length);
    expect(after).toContain(`${ESC}[23;0t`);
    expect(after).toContain(`${ESC}]6;1;bg;*;default${ST}`);
    expect(after).toContain(`${ESC}]1337;SetBadgeFormat=${ST}`);
    expect(app.chrome).toEqual({});
  });

  it("set before the run is shown when it starts, and a stopped app refuses one", async () => {
    const host = scriptedHost();
    const app = new App({ host, surface: "alternate", clock: fakeClock(0), view: new RichText("hi") });
    app.chrome = { title: "early" };
    const done = app.run();
    expect(host.output()).toContain(`${ESC}]2;early${ST}`);
    app.stop();
    await done;
    expect(() => (app.chrome = { title: "late" })).toThrow(/stopped/);
  });

  it("asks for focus reports while it holds the terminal", async () => {
    const { app, host, done } = start();
    expect(host.output()).toContain(`${ESC}[?1004h`);
    app.stop();
    await done;
    expect(host.output()).toContain(`${ESC}[?1004l`);
  });
});

describe("a tmux reattach", () => {
  const tmux: LayerDeclaration = { kind: "tmux", passthrough: "declared" };

  it("re-sends the tab color on focus-in, and pushes no second title", async () => {
    const { app, host, done } = start([tmux]);
    app.chrome = { title: "build", tabColor: purple };
    const before = host.output().length;
    host.type(FOCUS_IN);
    const resent = host.output().slice(before);
    expect(resent).toContain(`${ESC}Ptmux;${ESC}${ESC}]6;1;bg;red;brightness;128`);
    expect(resent).not.toContain("22;0t");
    expect(resent).not.toContain("]2;build");
    app.stop();
    await done;
  });

  it("re-sends it on a resize too, and a bare terminal's focus-in sends nothing", async () => {
    const wrapped = start([tmux]);
    wrapped.app.chrome = { tabColor: purple };
    const before = wrapped.host.output().length;
    wrapped.host.resize({ cols: 30, rows: 5 });
    expect(wrapped.host.output().slice(before)).toContain(`${ESC}Ptmux;`);
    wrapped.app.stop();
    await wrapped.done;

    const bare = start();
    bare.app.chrome = { tabColor: purple };
    const shown = bare.host.output().length;
    bare.host.type(FOCUS_IN);
    expect(bare.host.output().slice(shown)).toBe("");
    bare.app.stop();
    await bare.done;
  });
});

describe("focus reports", () => {
  it("reach the parser's sink as focus, never as a key, beside the keys around them", () => {
    const heard: string[] = [];
    const parser = new InputParser(
      { key: (press) => heard.push(keyName(press)), mouse: () => {}, reply: () => {}, paste: () => {}, focus: (focused) => heard.push(focused ? "focus-in" : "focus-out") },
      "whole-keys",
    );
    parser.feed(new TextEncoder().encode(`a${ESC}[I${ESC}[O${ESC}[1;2Ab`));
    expect(heard).toEqual(["a", "focus-in", "focus-out", "shift+up", "b"]);
  });
});

describe("a focused field's cursor", () => {
  it("takes the color its drawn cursor's cell would have, and the terminal's own back on hand-back", async () => {
    const host = scriptedHost({ cols: 20, rows: 4 });
    const field = new TextInput({ value: "hello" });
    const app = new WidgetApp({ host, surface: "alternate", clock: fakeClock(0), view: () => field });
    const done = app.run();
    app.focusManager.focus(field);
    await tick();
    expect(host.output()).toMatch(/\x1b\]12;#[0-9a-f]{6}\x1b\\/);
    app.stop();
    await done;
    expect(host.output()).toContain(`${ESC}]112${ST}`);
  });

  async function cursorBytes(cursorStyle: string): Promise<string> {
    const host = scriptedHost({ cols: 20, rows: 4 });
    const field = new TextInput({ value: "hello", cursorStyle: Style.parse(cursorStyle) });
    const app = new WidgetApp({ host, surface: "alternate", clock: fakeClock(0), view: () => field });
    const done = app.run();
    app.focusManager.focus(field);
    await tick();
    const shown = host.output();
    app.stop();
    await done;
    return shown;
  }

  it("takes a reversed cell's foreground, which is what that cell shows behind its glyph", async () => {
    expect(await cursorBytes("reverse #8000ff")).toContain(`${ESC}]12;#8000ff${ST}`);
  });

  it("stays the terminal's own where the drawn cell shows the terminal's own color", async () => {
    expect(await cursorBytes("bold on default")).not.toContain(`${ESC}]12;`);
  });
});
