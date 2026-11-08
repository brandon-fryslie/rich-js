/**
 * Contract of a notification's click, which kitty reports back to the program
 * that asked for it: an app hears it as a click, never as a key.
 *
 * [LAW:behavior-not-structure] Driven through an `App` on a scripted host: what
 * is asserted is which handler hears each reply the terminal sends.
 */

import { describe, expect, it } from "vitest";

import { App } from "../../src/host/app.js";
import { RichText } from "../../src/core/text.js";
import { declareCapabilities } from "../../src/core/terminal-capabilities.js";
import { fakeClock } from "../core/fake-clock.js";
import { scriptedHost } from "./scripted-host.js";

const ESC = "\x1b";
const ST = `${ESC}\\`;

describe("a notification's click", () => {
  it("reaches onNotificationClick as its id and button, and reaches no key handler", async () => {
    const host = scriptedHost({ cols: 20, rows: 4 });
    const app = new App({ host, surface: "alternate", clock: fakeClock(0), view: new RichText("hi") });
    const clicks: unknown[] = [];
    const keys: unknown[] = [];
    app.onNotificationClick((click) => void clicks.push(click));
    app.onKey((press) => void keys.push(press));
    const done = app.run();
    host.type(`${ESC}]99;i=abc;2${ST}`);
    host.type(`${ESC}]99;i=abc;${ST}`);
    app.stop();
    await done;
    expect(clicks).toEqual([
      { id: "abc", button: 2 },
      { id: "abc", button: undefined },
    ]);
    expect(keys).toEqual([]);
  });

  it("is not heard once its handler has unsubscribed", async () => {
    const host = scriptedHost({ cols: 20, rows: 4 });
    const app = new App({ host, surface: "alternate", clock: fakeClock(0), view: new RichText("hi") });
    const clicks: unknown[] = [];
    const unsubscribe = app.onNotificationClick((click) => void clicks.push(click));
    const done = app.run();
    unsubscribe();
    host.type(`${ESC}]99;i=abc;1${ST}`);
    app.stop();
    await done;
    expect(clicks).toEqual([]);
  });

  it("is not heard while the app is suspended and has handed the terminal back", async () => {
    const host = scriptedHost({ cols: 20, rows: 4 });
    const app = new App({ host, surface: "alternate", clock: fakeClock(0), view: new RichText("hi") });
    const clicks: unknown[] = [];
    const keys: unknown[] = [];
    app.onNotificationClick((click) => void clicks.push(click));
    app.onKey((press) => void keys.push(press));
    const done = app.run();
    const suspended = app.suspend();
    host.type(`${ESC}]99;i=abc;1${ST}`);
    host.type("x");
    host.resume();
    await suspended;
    app.stop();
    await done;
    expect(clicks).toEqual([]);
    expect(keys).toEqual([]);
  });

  it("raises a notification with a click report, and hears the click on it", async () => {
    const host = scriptedHost({ cols: 20, rows: 4 });
    const app = new App({ host, surface: "alternate", clock: fakeClock(0), view: new RichText("hi"), terminalFeatures: { capabilities: declareCapabilities([], "kitty") } });
    const clicks: unknown[] = [];
    app.onNotificationClick((click) => void clicks.push(click));
    const done = app.run();
    const id = app.notify("Done", undefined, { reportClicks: true });
    host.type(`${ESC}]99;i=${id};1${ST}`);
    app.stop();
    await done;
    expect(host.output()).toContain(`${ESC}]99;i=${id}:a=focus,report;Done${ST}`);
    expect(clicks).toEqual([{ id, button: 1 }]);
  });

  it("raises a notification only while it runs", () => {
    const host = scriptedHost({ cols: 20, rows: 4 });
    const app = new App({ host, surface: "alternate", clock: fakeClock(0), view: new RichText("hi") });
    expect(() => app.notify("Done")).toThrow("App.notify");
  });

  it("withdraws the notifications it asked to hear when it stops, so no click is typed at the shell", async () => {
    const host = scriptedHost({ cols: 20, rows: 4 });
    const app = new App({ host, surface: "alternate", clock: fakeClock(0), view: new RichText("hi"), terminalFeatures: { capabilities: declareCapabilities([], "kitty") } });
    const done = app.run();
    const id = app.notify("Done", undefined, { reportClicks: true });
    app.stop();
    await done;
    expect(host.output()).toContain(`${ESC}]99;i=${id}:p=close;${ST}`);
  });

  it("withdraws them when it suspends, as the terminal goes back to the shell", async () => {
    const host = scriptedHost({ cols: 20, rows: 4 });
    const app = new App({ host, surface: "alternate", clock: fakeClock(0), view: new RichText("hi"), terminalFeatures: { capabilities: declareCapabilities([], "kitty") } });
    const done = app.run();
    const id = app.notify("Done", undefined, { reportClicks: true });
    const suspended = app.suspend();
    expect(host.output()).toContain(`${ESC}]99;i=${id}:p=close;${ST}`);
    host.resume();
    await suspended;
    app.stop();
    await done;
  });
});
