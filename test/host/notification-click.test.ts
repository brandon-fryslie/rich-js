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
});
