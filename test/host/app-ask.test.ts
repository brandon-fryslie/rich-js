/**
 * Contract of `App.ask` and `terminalColors`: the bytes asked, how each ask
 * ends, and that a reply never reaches a key handler.
 *
 * [LAW:behavior-not-structure] What is asserted is what reaches the terminal,
 * what the ask resolves with, and what a program hears, for bytes typed at a
 * scripted host on a hand-moved clock.
 */

import { afterEach, describe, it, expect, vi } from "vitest";

import { App } from "../../src/host/app.js";
import { ESCAPE_DELAY_MS, keyName } from "../../src/host/input.js";
import { terminalColors } from "../../src/host/terminal-colors.js";
import { ColorRgba } from "../../src/core/color.js";
import { RichText } from "../../src/core/text.js";
import { Segment } from "../../src/core/segment.js";
import type { Renderable } from "../../src/core/protocol.js";
import { fakeClock } from "../core/fake-clock.js";
import { scriptedHost, type ScriptedHost } from "./scripted-host.js";

const DA1_REPLY = "\x1b[?62;22c";

function started(host: ScriptedHost = scriptedHost()) {
  const clock = fakeClock();
  const app = new App({ host, surface: "inline", clock, view: () => new RichText("x") });
  const keys: string[] = [];
  app.onKey((press) => keys.push(keyName(press)));
  const done = app.run();
  return { host, app, clock, keys, done };
}

// The ask writes once the asks before it have settled: a turn of the microtask queue.
const asked = () => new Promise((resolve) => setTimeout(resolve));

describe("App.ask", () => {
  it("writes the queries, then DA1, and ends answered on DA1's reply", async () => {
    const { host, app } = started();
    const before = host.output().length;
    const ask = app.ask(["\x1b[?2026$p"]);
    await asked();
    expect(host.output().slice(before)).toBe("\x1b[?2026$p\x1b[c");
    host.type("\x1b[?2026;2$y" + DA1_REPLY);
    expect(await ask).toEqual({ ended: "answered", replies: [{ kind: "csi", body: "?2026;2$y" }] });
  });

  it("reads a query DA1 overtook as unsupported, without waiting", async () => {
    const { host, app } = started();
    const ask = app.ask(["\x1b]11;?\x1b\\"]);
    await asked();
    host.type(DA1_REPLY);
    expect(await ask).toEqual({ ended: "answered", replies: [] });
  });

  it("ends on the timeout when the terminal answers nothing", async () => {
    const { app, clock } = started();
    const ask = app.ask(["\x1b]11;?\x1b\\"], { timeout: 0.2 });
    await asked();
    clock.advance(0.2);
    expect(await ask).toEqual({ ended: "timeout", replies: [] });
  });

  it("ends left when the app stops mid-ask, its timer cleared", async () => {
    const { app, clock } = started();
    const ask = app.ask(["\x1b]11;?\x1b\\"]);
    await asked();
    app.stop();
    expect(await ask).toEqual({ ended: "left", replies: [] });
    expect(clock.timers()).toBe(0);
  });

  it("asks nothing of a host that writes to no terminal", async () => {
    const host = { ...scriptedHost(), writesToTerminal: false };
    const { app } = started(host);
    expect(await app.ask(["\x1b]11;?\x1b\\"])).toEqual({ ended: "unasked", replies: [] });
  });

  it("refuses an ask from an app that has not started", () => {
    const app = new App({ host: scriptedHost(), surface: "inline", view: () => new RichText("x") });
    expect(() => app.ask([])).toThrow(/has not started/);
  });

  it("ends left for an ask from an app that has stopped", async () => {
    const { app } = started();
    app.stop();
    expect(await app.ask(["\x1b]11;?\x1b\\"])).toEqual({ ended: "left", replies: [] });
  });

  it("runs asks one after another", async () => {
    const { host, app } = started();
    const before = host.output().length;
    const first = app.ask(["A"]);
    const second = app.ask(["B"]);
    await asked();
    expect(host.output().slice(before)).toBe("A\x1b[c");
    host.type(DA1_REPLY);
    await first;
    await asked();
    expect(host.output().slice(before)).toBe("A\x1b[cB\x1b[c");
    host.type(DA1_REPLY);
    expect((await second).ended).toBe("answered");
  });

  it("credits a timed-out ask's late replies to no later ask", async () => {
    const { host, app, clock } = started();
    const first = app.ask(["\x1b]11;?\x1b\\"], { timeout: 0.5 });
    const second = app.ask(["\x1b]10;?\x1b\\"]);
    await asked();
    clock.advance(0.5);
    expect((await first).ended).toBe("timeout");
    await asked();
    host.type("\x1b]11;rgb:0/0/0\x1b\\" + DA1_REPLY);
    host.type("\x1b]10;rgb:f/f/f\x1b\\" + DA1_REPLY);
    expect(await second).toEqual({ ended: "answered", replies: [{ kind: "osc", body: "10;rgb:f/f/f" }] });
  });

  it("still asks after an ask whose write threw", async () => {
    const host = scriptedHost();
    const { app, clock } = started(host);
    const write = host.write.bind(host);
    host.write = () => {
      throw new Error("closed");
    };
    await expect(app.ask(["A"], { timeout: 0.1 })).rejects.toThrow("closed");
    host.write = write;
    const second = app.ask(["\x1b]11;?\x1b\\"]);
    await asked();
    clock.advance(0.1);
    host.type("\x1b]11;rgb:0/0/0\x1b\\" + DA1_REPLY);
    expect(await second).toEqual({ ended: "answered", replies: [{ kind: "osc", body: "11;rgb:0/0/0" }] });
  });

  it("refuses a timeout that is not a positive, finite number of seconds", () => {
    const { app } = started();
    for (const timeout of [0, -1, Number.NaN, Infinity]) expect(() => app.ask([], { timeout })).toThrow(RangeError);
  });

  it("hears a reply split across reads, BEL-terminated, as one reply", async () => {
    const { host, app } = started();
    const ask = app.ask(["\x1b]10;?\x07"]);
    await asked();
    host.type("\x1b]10;rgb:ff");
    host.type("ff/0000/8080\x07");
    host.type(DA1_REPLY);
    expect((await ask).replies).toEqual([{ kind: "osc", body: "10;rgb:ffff/0000/8080" }]);
  });

  it("types nothing for a reply no ask is waiting for", () => {
    const { host, keys } = started();
    host.type("\x1b]11;rgb:0000/0000/0000\x1b\\q\x1b[?62;22cw\x1bP>|kitty\x1b\\");
    expect(keys).toEqual(["q", "w"]);
  });
});

// rich-control-codes-xh4n.re6: whether `ESC ]`, `ESC P` or `ESC _` opens a
// reply or is Alt on a key is decided by whether an ask is waiting for one.
describe("a reply or Alt on a split host", () => {
  afterEach(() => vi.useRealTimers());

  it("reads ESC ] with no ask in flight as Alt+], and Ctrl+C after it at once", () => {
    const { host, app, keys } = started();
    host.type("\x1b]x\x1b_y\x1bPz");
    expect(keys).toEqual(["meta+]", "x", "meta+_", "y", "meta+P", "z"]);
    host.type("\x03");
    expect(app.phase).toBe("stopped");
  });

  it("reads Alt+] at once after an ask the terminal never answered", async () => {
    const { host, app, clock, keys } = started();
    const ask = app.ask(["\x1b]11;?\x1b\\"], { timeout: 0.2 });
    await asked();
    clock.advance(0.2);
    await ask;
    host.type("\x1b]x");
    expect(keys).toEqual(["meta+]", "x"]);
  });

  it("hears a reply split across reads longer than the escape delay apart", async () => {
    const { host, app, keys } = started();
    const ask = app.ask(["\x1b]11;?\x1b\\"]);
    await asked();
    vi.useFakeTimers();
    host.type("\x1b]11;rgb:00");
    vi.advanceTimersByTime(ESCAPE_DELAY_MS * 3);
    host.type("00/0000/0000\x1b\\" + DA1_REPLY);
    expect(await ask).toEqual({ ended: "answered", replies: [{ kind: "osc", body: "11;rgb:0000/0000/0000" }] });
    expect(keys).toEqual([]);
  });

  it("hears a reply split right after its ESC", async () => {
    const { host, app, keys } = started();
    const ask = app.ask(["\x1b]11;?\x1b\\"]);
    await asked();
    host.type("\x1b");
    host.type("]11;rgb:0000/0000/0000\x1b\\" + DA1_REPLY);
    expect((await ask).replies).toEqual([{ kind: "osc", body: "11;rgb:0000/0000/0000" }]);
    expect(keys).toEqual([]);
  });

  it("reads Escape then P typed as two chunks as two keys with no ask in flight", () => {
    const { host, keys } = started();
    host.type("\x1b");
    host.type("P");
    expect(keys).toEqual(["escape", "P"]);
  });

  it("hears a held Escape when the ask it waited behind times out", async () => {
    const { host, app, clock, keys } = started();
    const ask = app.ask(["\x1b]11;?\x1b\\"], { timeout: 0.2 });
    await asked();
    vi.useFakeTimers();
    host.type("\x1b");
    vi.advanceTimersByTime(ESCAPE_DELAY_MS * 3);
    expect(keys).toEqual([]);
    clock.advance(0.2);
    expect((await ask).ended).toBe("timeout");
    expect(keys).toEqual([]);
    vi.advanceTimersByTime(ESCAPE_DELAY_MS + 1);
    expect(keys).toEqual(["escape"]);
  });

  it("reads Alt+] typed during an ask as Alt+] when the reply follows it", async () => {
    const { host, app, keys } = started();
    const ask = app.ask(["\x1b]11;?\x1b\\"]);
    await asked();
    host.type("\x1b]");
    host.type("\x1b]11;rgb:0000/0000/0000\x1b\\" + DA1_REPLY);
    expect((await ask).replies).toEqual([{ kind: "osc", body: "11;rgb:0000/0000/0000" }]);
    expect(keys).toEqual(["meta+]"]);
  });

  it("reads Alt+] then x typed during an ask as Alt+] and x when the reply follows", async () => {
    const { host, app, keys } = started();
    const ask = app.ask(["\x1b]11;?\x1b\\"]);
    await asked();
    host.type("\x1b]x");
    host.type(DA1_REPLY);
    expect((await ask).ended).toBe("answered");
    expect(keys).toEqual(["meta+]", "x"]);
  });

  it("does not stretch a stalled CSI's escape delay when an ask starts", async () => {
    const { host, app, keys } = started();
    vi.useFakeTimers();
    host.type("\x1b[");
    vi.advanceTimersByTime(ESCAPE_DELAY_MS - 10);
    const ask = app.ask(["\x1b]11;?\x1b\\"]);
    await vi.advanceTimersByTimeAsync(11);
    expect(keys).toEqual(["meta+["]);
    host.type(DA1_REPLY);
    await ask;
  });

  it("settles a stalled CSI during an ask after the escape delay", async () => {
    const { host, app, keys } = started();
    const ask = app.ask(["\x1b]11;?\x1b\\"]);
    await asked();
    vi.useFakeTimers();
    host.type("\x1b[");
    vi.advanceTimersByTime(ESCAPE_DELAY_MS + 1);
    expect(keys).toEqual(["meta+["]);
    host.type(DA1_REPLY);
    await ask;
  });

  it("gives a reply straddling the ask's timeout the whole escape delay", async () => {
    const { host, app, clock, keys } = started();
    const ask = app.ask(["\x1b]11;?\x1b\\"], { timeout: 0.2 });
    await asked();
    vi.useFakeTimers();
    host.type("\x1b]11;rgb:00");
    clock.advance(0.2);
    expect((await ask).ended).toBe("timeout");
    host.type("00/0000/0000\x1b\\");
    expect(keys).toEqual([]);
  });

  it("drops what an ask held when a suspend ends it", async () => {
    const { host, app, keys } = started();
    const ask = app.ask(["\x1b]11;?\x1b\\"]);
    await asked();
    vi.useFakeTimers();
    host.type("\x1b]1");
    vi.advanceTimersByTime(ESCAPE_DELAY_MS * 3);
    const suspended = app.suspend();
    expect((await ask).ended).toBe("left");
    vi.advanceTimersByTime(ESCAPE_DELAY_MS + 1);
    expect(keys).toEqual([]);
    host.resume();
    await suspended;
    host.type("a");
    expect(keys).toEqual(["a"]);
  });
});

describe("a reply or Alt on a whole-keys host", () => {
  it("reads ESC ] alone in a chunk as Alt+] whether or not an ask is in flight", async () => {
    const { host, app, keys } = started({ ...scriptedHost(), inputChunks: "whole-keys" });
    host.type("\x1b]x");
    const ask = app.ask(["\x1b]11;?\x1b\\"]);
    await asked();
    host.type("\x1b]x");
    host.type(DA1_REPLY);
    await ask;
    expect(keys).toEqual(["meta+]", "x", "meta+]", "x"]);
  });
});

describe("terminalColors", () => {
  it("reads the foreground and background, keeping the app's sixteen", async () => {
    const { host, app } = started();
    const colors = terminalColors(app);
    await asked();
    expect(host.output()).toContain("\x1b]10;?\x1b\\\x1b]11;?\x1b\\\x1b[c");
    host.type("\x1b]10;rgb:ffff/ffff/ffff\x1b\\\x1b]11;rgb:1e/1e/2e\x1b\\" + DA1_REPLY);
    const terminal = (await colors)!;
    expect(terminal.foregroundColor).toEqual(new ColorRgba(255, 255, 255));
    expect(terminal.backgroundColor).toEqual(new ColorRgba(0x1e, 0x1e, 0x2e));
    expect(terminal.ansiColors).toBe(app.terminal.ansiColors);
  });

  it("scales one, two and four hex digits a channel to 8 bits", async () => {
    const { host, app } = started();
    const colors = terminalColors(app);
    await asked();
    host.type("\x1b]10;rgb:f/8/0\x1b\\\x1b]11;rgb:8080/ffff/0000\x1b\\" + DA1_REPLY);
    const terminal = (await colors)!;
    expect(terminal.foregroundColor).toEqual(new ColorRgba(255, 136, 0));
    expect(terminal.backgroundColor).toEqual(new ColorRgba(128, 255, 0));
  });

  it("reads XParseColor's rgba: form, as urxvt answers with transparency", async () => {
    const { host, app } = started();
    const colors = terminalColors(app);
    await asked();
    host.type("\x1b]10;rgba:ffff/ffff/ffff/dddd\x1b\\\x1b]11;rgba:0/0/0/d\x1b\\" + DA1_REPLY);
    expect((await colors)!.backgroundColor).toEqual(new ColorRgba(0, 0, 0));
  });

  it("is undefined when the terminal answers only one", async () => {
    const { host, app } = started();
    const colors = terminalColors(app);
    await asked();
    host.type("\x1b]11;rgb:0/0/0\x1b\\" + DA1_REPLY);
    expect(await colors).toBeUndefined();
  });

  it("draws the next frame against the background it learned", async () => {
    const host = scriptedHost();
    const clock = fakeClock();
    // A renderable that draws the background its render options hand it —
    // the terminal every contrast decision in a frame reads.
    const showsGround: Renderable = {
      *render(options) {
        yield new Segment(options.terminal?.backgroundColor.hex ?? "none");
      },
    };
    const app = new App({ host, surface: "inline", clock, view: showsGround });
    void app.run();
    const colors = terminalColors(app);
    await asked();
    host.type("\x1b]10;rgb:0/0/0\x1b\\\x1b]11;rgb:f/f/f\x1b\\" + DA1_REPLY);
    app.terminal = (await colors)!;
    const before = host.output().length;
    await asked();
    expect(host.output().slice(before)).toContain("#ffffff");
  });
});
