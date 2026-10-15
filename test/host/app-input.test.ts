/**
 * Contract of `App`'s input: the host's bytes heard as keys and pointer
 * events, the quit keys heard first, and a handler that throws ending the app.
 *
 * [LAW:behavior-not-structure] What is asserted is what a program hears and
 * how `run` settles, for bytes typed at a scripted host.
 */

import { describe, it, expect } from "vitest";

import { App, type AppOptions } from "../../src/host/app.js";
import { keyName, type KeyPress, type ScreenMouseEvent } from "../../src/host/input.js";
import { RichText } from "../../src/core/text.js";
import { scriptedHost, type ScriptedHost } from "./scripted-host.js";

function started(options: Partial<AppOptions> = {}): { host: ScriptedHost; app: App; done: Promise<void>; keys: string[] } {
  const host = scriptedHost();
  const app = new App({ host, surface: "alternate", view: () => new RichText("x"), ...options });
  const keys: string[] = [];
  app.onKey((press) => keys.push(keyName(press)));
  return { host, app, done: app.run(), keys };
}

describe("App hears keys", () => {
  it("hears a key by its name", () => {
    const { host, keys } = started();
    host.type("q\x1b[A\x1b[Z\r");
    expect(keys).toEqual(["q", "up", "shift+tab", "enter"]);
  });

  it("completes a UTF-8 character split across two chunks", () => {
    const { host, app, keys } = started();
    const bytes = new TextEncoder().encode("é→");
    const presses: KeyPress[] = [];
    app.onKey((press) => presses.push(press));
    host.type(bytes.subarray(0, 1));
    host.type(bytes.subarray(1, 3));
    host.type(bytes.subarray(3));
    expect(keys).toEqual(["é", "→"]);
    expect(presses.map((p) => p.character)).toEqual(["é", "→"]);
  });

  it("hears no more once its handler unsubscribes", () => {
    const { host, app } = started();
    const heard: string[] = [];
    const unsubscribe = app.onKey((press) => heard.push(press.key));
    host.type("a");
    unsubscribe();
    host.type("b");
    expect(heard).toEqual(["a"]);
  });
});

describe("App's quit keys", () => {
  it("stops on Ctrl+C by default, and no handler hears it", async () => {
    const { host, app, done, keys } = started();
    host.type("\x03");
    await done;
    expect(app.phase).toBe("stopped");
    expect(keys).toEqual([]);
  });

  it("leaves Ctrl+C to the program when quitKeys is empty", () => {
    const { host, app, keys } = started({ quitKeys: [] });
    host.type("\x03");
    expect(app.phase).toBe("running");
    expect(keys).toEqual(["ctrl+c"]);
  });

  it("stops on the keys it is given, and not on Ctrl+C", async () => {
    const { host, app, done, keys } = started({ quitKeys: ["q", "escape"] });
    host.type("\x03");
    expect(app.phase).toBe("running");
    host.type("q");
    await done;
    expect(keys).toEqual(["ctrl+c"]);
  });

  it("hears nothing typed after the key it stopped on", async () => {
    const { host, done, keys } = started();
    host.type("a\x03b");
    await done;
    expect(keys).toEqual(["a"]);
  });
});

describe("App input handlers that throw", () => {
  it("fail the app with the error a key handler threw, terminal handed back", async () => {
    const { host, app, done } = started();
    const error = new Error("key handler");
    app.onKey(() => {
      throw error;
    });
    host.type("a");
    await expect(done).rejects.toBe(error);
    expect(host.raw()).toBe(false);
  });

  it("fail the app with the error a pointer handler threw", async () => {
    const { host, app, done } = started();
    const error = new Error("mouse handler");
    app.onMouse(() => {
      throw error;
    });
    host.type("\x1b[<0;3;2M");
    await expect(done).rejects.toBe(error);
  });
});

describe("App hears the pointer", () => {
  it("as events in terminal cells", () => {
    const { host, app } = started();
    const events: ScreenMouseEvent[] = [];
    app.onMouse((event) => events.push(event));
    host.type("\x1b[<0;3;2M\x1b[<0;3;2m\x1b[<65;1;1M");
    expect(events.map((e) => [e.type, e.x, e.y])).toEqual([
      ["mouse_down", 2, 1],
      ["mouse_up", 2, 1],
      ["scroll_down", 0, 0],
    ]);
  });
});

describe("keyName", () => {
  const press = (init: Partial<KeyPress>): KeyPress => ({ key: "", character: "", shift: false, ctrl: false, meta: false, ...init });

  it.each([
    [{ key: "q", character: "q" }, "q"],
    [{ key: "g", character: "G", shift: true }, "G"],
    [{ key: ">", character: ">" }, ">"],
    [{ key: "space", character: " " }, "space"],
    [{ key: "c", ctrl: true }, "ctrl+c"],
    [{ key: "tab", shift: true }, "shift+tab"],
    [{ key: "left", meta: true }, "meta+left"],
    [{ key: "up", ctrl: true, meta: true, shift: true }, "ctrl+meta+shift+up"],
    [{ key: "b", meta: true, shift: true }, "meta+shift+b"],
  ])("names %o %s", (init, name) => {
    expect(keyName(press(init))).toBe(name);
  });
});
