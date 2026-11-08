/**
 * The kitty keyboard protocol: its key form parsed into the names legacy keys
 * go by, and an app that asks for it pushing it only where the terminal
 * answers, and popping it on every hand-back.
 */

import { describe, expect, it } from "vitest";
import { App } from "../../src/host/app.js";
import { InputParser, keyName } from "../../src/host/input.js";
import { RichText } from "../../src/core/text.js";
import { fakeClock } from "../core/fake-clock.js";
import { scriptedHost } from "./scripted-host.js";

const DA1_REPLY = "\x1b[?62;22c";
const QUERY = "\x1b[?u";
const PUSH = "\x1b[>5u";
const POP = "\x1b[<u";

function keysOf(bytes: string): string[] {
  const heard: string[] = [];
  const parser = new InputParser({ key: (press) => heard.push(keyName(press)), mouse: () => {}, reply: (reply) => heard.push(`reply:${reply.body}`), paste: () => {}, focus: () => {} }, "whole-keys");
  parser.feed(bytes);
  return heard;
}

describe("the kitty protocol's keys", () => {
  it.each([
    ["\x1b[27u", "escape"],
    ["\x1b[97;5u", "ctrl+a"],
    ["\x1b[97;6u", "ctrl+shift+a"],
    ["\x1b[120;3u", "meta+x"],
    ["\x1b[13;2u", "shift+enter"],
    ["\x1b[105;5u", "ctrl+i"],
    ["\x1b[9u", "tab"],
    ["\x1b[127;5u", "ctrl+backspace"],
    ["\x1b[32;5u", "ctrl+space"],
    // Caps Lock (64) and Num Lock (128) held change no name.
    ["\x1b[97;69u", "ctrl+a"],
    ["\x1b[97:65;5u", "ctrl+a"],
    // Alt+Shift+G as legacy names it (`ESC G`).
    ["\x1b[103;4u", "meta+G"],
    // Keypad keys, sent in the Private Use Area, as what they type.
    ["\x1b[57400u", "1"],
    ["\x1b[57414u", "enter"],
    ["\x1b[57413;5u", "ctrl++"],
    ["\x1b[57417u", "left"],
    ["\x1b[57421;5u", "ctrl+pageup"],
    // Shift+1 as the terminal reports its shifted key (flag 4).
    ["\x1b[49:33;4u", "meta+!"],
    ["\x1b[49:33;2u", "!"],
    // A case change that is no single glyph keeps the glyph.
    ["\x1b[223;4u", "meta+ß"],
    // A shortcut on a Cyrillic layout, by its base-layout key (flag 4); typed text as typed.
    ["\x1b[1089::99;5u", "ctrl+c"],
    ["\x1b[1089::99;3u", "meta+c"],
    ["\x1b[1089::99;4u", "meta+C"],
    ["\x1b[1089::99u", "с"],
    ["\x1b[1089:1057:99;2u", "С"],
  ])("reads %j as %s", (bytes, name) => {
    expect(keysOf(bytes)).toEqual([name]);
  });

  it("reads F1–F4 with a modifier, as xterm sends them too", () => {
    expect(keysOf("\x1b[1;2P\x1b[1;5Q\x1b[13;3~\x1b[1;6S")).toEqual(["shift+f1", "ctrl+f2", "meta+f3", "ctrl+shift+f4"]);
  });

  it("reads nothing from a key no program can name: other Private Use keys, no code, a Super chord", () => {
    expect(keysOf("\x1b[57376u\x1b[0u\x1b[u\x1b[99;9u")).toEqual([]);
  });

  it("does not read a cursor position report as F3", () => {
    expect(keysOf("\x1b[12;40R")).toEqual([]);
  });

  it("still reads the terminal's answer to the query as a reply", () => {
    expect(keysOf("\x1b[?1u")).toEqual(["reply:?1u"]);
  });

  it("reads legacy keys as before", () => {
    expect(keysOf("a\x1b[A\x01\x1bx")).toEqual(["a", "up", "ctrl+a", "meta+x"]);
  });
});

const asked = () => new Promise((resolve) => setTimeout(resolve));

function started(keyboard?: "kitty" | "legacy") {
  const host = scriptedHost();
  const clock = fakeClock();
  const app = new App({ host, surface: "inline", clock, view: () => new RichText("x"), ...(keyboard === undefined ? {} : { keyboard }) });
  const done = app.run();
  return { host, app, clock, done };
}

describe("an app that asks for the kitty keyboard", () => {
  it("asks, and pushes it when the terminal answers, then pops it on stop", async () => {
    const { host, app, done } = started("kitty");
    await asked();
    expect(host.output()).toContain(`${QUERY}\x1b[c`);
    host.type(`\x1b[?0u${DA1_REPLY}`);
    await asked();
    expect(host.output()).toContain(PUSH);
    app.stop();
    await done;
    expect(host.output().indexOf(POP)).toBeGreaterThan(host.output().indexOf(PUSH));
  });

  it("pushes nothing when the app stops between the answer and acting on it", async () => {
    const { host, done } = started("kitty");
    await asked();
    host.type(`\x1b[?0u${DA1_REPLY}\x03`);
    await done;
    await asked();
    expect(host.output()).not.toContain(PUSH);
  });

  it("stays on legacy keys where the terminal answers DA1 alone", async () => {
    const { host, app, done } = started("kitty");
    await asked();
    host.type(DA1_REPLY);
    await asked();
    app.stop();
    await done;
    expect(host.output()).not.toContain(PUSH);
    expect(host.output()).not.toContain(POP);
  });

  it("stays on legacy keys where the terminal answers nothing", async () => {
    const { host, app, clock, done } = started("kitty");
    await asked();
    clock.advance(1);
    await asked();
    app.stop();
    await done;
    expect(host.output()).not.toContain(PUSH);
  });

  it("pops on suspend, and asks again on resume", async () => {
    const { host, app, done } = started("kitty");
    await asked();
    host.type(`\x1b[?0u${DA1_REPLY}`);
    await asked();
    const suspended = app.suspend();
    expect(host.output().split(POP)).toHaveLength(2);
    const before = host.output().length;
    host.resume();
    await suspended;
    await asked();
    expect(host.output().slice(before)).toContain(QUERY);
    app.stop();
    await done;
  });

  it("fails the run when writing the push throws", async () => {
    const { host, done } = started("kitty");
    const error = new Error("write failed");
    const write = host.write.bind(host);
    host.write = (data) => {
      if (data === PUSH) throw error;
      write(data);
    };
    await asked();
    host.type(`\x1b[?0u${DA1_REPLY}`);
    await expect(done).rejects.toBe(error);
  });

  it("asks nothing unless the program asks for it", async () => {
    const { host, app, done } = started();
    await asked();
    app.stop();
    await done;
    expect(host.output()).not.toContain(QUERY);
  });
});
