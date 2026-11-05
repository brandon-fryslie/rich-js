/**
 * Bracketed paste: the app turns it on while it holds the terminal, and a
 * paste reaches a program as one event, never as the keys it holds, on split
 * and whole-keys hosts alike.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/host/app.js";
import { ESCAPE_DELAY_MS, InputParser, keyName } from "../../src/host/input.js";
import type { InputChunks } from "../../src/host/terminal-host.js";
import { RichText } from "../../src/core/text.js";
import { TextInput } from "../../src/widgets/text-input.js";
import { scriptedHost } from "./scripted-host.js";

const START = "\x1b[200~";
const END = "\x1b[201~";

function parser(chunks: InputChunks): { parser: InputParser; heard: string[] } {
  const heard: string[] = [];
  const parser = new InputParser(
    {
      key: (press) => heard.push(`key:${keyName(press)}`),
      mouse: () => heard.push("mouse"),
      reply: () => heard.push("reply"),
      paste: (text) => heard.push(`paste:${text}`),
    },
    chunks,
  );
  return { parser, heard };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("InputParser reads a bracketed paste", () => {
  it.each(["split", "whole-keys"] as const)("as one event between the keys around it, on a %s host", (chunks) => {
    const { parser: input, heard } = parser(chunks);
    input.feed(`a${START}x\r\x03\x1b[Ay${END}b`);
    expect(heard).toEqual(["key:a", "paste:x\n\x03\x1b[Ay", "key:b"]);
  });

  it("makes each pasted line break \\n, as CR LF or CR", () => {
    const { parser: input, heard } = parser("split");
    input.feed(`${START}one\r\ntwo\rthree\nfour${END}`);
    expect(heard).toEqual(["paste:one\ntwo\nthree\nfour"]);
  });

  it("holds a paste split across reads past the escape delay, on a split host", () => {
    vi.useFakeTimers();
    const { parser: input, heard } = parser("split");
    input.feed(`${START}first half `);
    vi.advanceTimersByTime(ESCAPE_DELAY_MS * 10);
    expect(heard).toEqual([]);
    input.feed(`second half${END}`);
    expect(heard).toEqual(["paste:first half second half"]);
  });

  it("joins a paste whose markers a read split, on a split host", () => {
    const { parser: input, heard } = parser("split");
    input.feed("\x1b[20");
    input.feed("0~é");
    input.feed("\x1b[2");
    input.feed("01~");
    expect(heard).toEqual(["paste:é"]);
  });

  it("reads Escape typed just ahead of a paste as Escape, and holds the paste whole", () => {
    vi.useFakeTimers();
    const { parser: input, heard } = parser("split");
    input.feed(`\x1b${START}a\r`);
    vi.advanceTimersByTime(ESCAPE_DELAY_MS * 10);
    input.feed(`b${END}`);
    expect(heard).toEqual(["key:escape", "paste:a\nb"]);
  });

  it("ends a paste open at a whole-keys chunk's end with the chunk", () => {
    const { parser: input, heard } = parser("whole-keys");
    input.feed(`${START}cut`);
    input.feed("q");
    expect(heard).toEqual(["paste:cut", "key:q"]);
  });
});

describe("App and a paste", () => {
  it("turns bracketed paste on when it takes the terminal and off when it hands it back", async () => {
    const host = scriptedHost();
    const app = new App({ host, surface: "inline", view: () => new RichText("x") });
    const done = app.run();
    expect(host.output()).toContain("\x1b[?2004h");
    expect(host.output()).not.toContain("\x1b[?2004l");
    app.stop();
    await done;
    expect(host.output().lastIndexOf("\x1b[?2004l")).toBeGreaterThan(host.output().lastIndexOf("\x1b[?2004h"));
  });

  it("turns it off when the app fails", async () => {
    const host = scriptedHost();
    const app = new App({ host, surface: "alternate", view: () => new RichText("x") });
    const done = app.run();
    app.onPaste(() => {
      throw new Error("handler");
    });
    host.type(`${START}x${END}`);
    await expect(done).rejects.toThrow("handler");
    expect(host.output()).toContain("\x1b[?2004l");
  });

  it("hears a paste as text, and a pasted quit key quits nothing", async () => {
    const host = scriptedHost();
    const app = new App({ host, surface: "alternate", view: () => new RichText("x") });
    const done = app.run();
    const pastes: string[] = [];
    const keys: string[] = [];
    app.onPaste((text) => pastes.push(text));
    app.onKey((press) => keys.push(keyName(press)));
    host.type(`${START}line\r\x03${END}`);
    expect(pastes).toEqual(["line\n\x03"]);
    expect(keys).toEqual([]);
    expect(app.phase).toBe("running");
    app.stop();
    await done;
  });
});

describe("TextInput and a paste", () => {
  it("takes a paste as lines in a multiline field", () => {
    const input = new TextInput({ multiline: true });
    input.handlePaste("one\ntwo", 0);
    expect(input.value).toBe("one\ntwo");
  });

  it("takes a paste on one line in a single-line field, submitting nothing", () => {
    const input = new TextInput();
    const submitted = vi.fn();
    input.onSubmit(submitted);
    input.handlePaste("one\ntwo", 0);
    expect(input.value).toBe("one two");
    expect(submitted).not.toHaveBeenCalled();
  });

  it("keeps no control from a paste, only what typing could put in", () => {
    const input = new TextInput({ multiline: true });
    input.handlePaste("a\x03\x1b[Ab\tc\nd", 0);
    expect(input.value).toBe("a[Abc\nd");
  });

  it("drops the final line break a copied line brings, on one line", () => {
    const input = new TextInput();
    input.handlePaste("npm test\n", 0);
    expect(input.value).toBe("npm test");
  });
});
