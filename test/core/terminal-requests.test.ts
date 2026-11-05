/**
 * Requests a program sends the terminal itself — title, clipboard, pointer shape, notification
 * — on their exact bytes, outside and inside tmux, and never to no one.
 */

import { describe, expect, it } from "vitest";
import { Console } from "../../src/core/console.js";
import type { Env } from "../../src/core/env.js";
import { identifyTerminal } from "../../src/core/terminal-identity.js";

const ESC = "\x1b";
const ST = `${ESC}\\`;

function terminal(env: Env, options: ConstructorParameters<typeof Console>[0] = {}): { console: Console; written: () => string } {
  const chunks: string[] = [];
  const console = new Console({
    width: 20,
    colorSystem: null,
    forceTerminal: true,
    hyperlinks: false,
    environment: { env },
    file: { write: (chunk: string) => void chunks.push(chunk) },
    ...options,
  });
  return { console, written: () => chunks.join("") };
}

const KITTY: Env = { TERM: "xterm-kitty" };
const FOOT: Env = { TERM: "foot" };
const ITERM: Env = { TERM: "xterm-256color", TERM_PROGRAM: "iTerm.app" };

describe("Console.setWindowTitle", () => {
  it("writes OSC 2 with the title", () => {
    const { console, written } = terminal(ITERM);
    console.setWindowTitle("build — 3/4");
    expect(written()).toBe(`${ESC}]2;build — 3/4${ST}`);
  });

  it("drops a control that could end the sequence or start another", () => {
    const { console, written } = terminal(ITERM);
    console.setWindowTitle(`a${ESC}\\b\x07c\x9cd\ne\u202ef\u2028g`);
    expect(written()).toBe(`${ESC}]2;a\\bcdefg${ST}`);
  });
});

describe("Console.copyToClipboard", () => {
  it("writes OSC 52 with the text's UTF-8 bytes in base64", () => {
    const { console, written } = terminal(ITERM);
    console.copyToClipboard("héllo ✓");
    expect(written()).toBe(`${ESC}]52;c;${Buffer.from("héllo ✓", "utf8").toString("base64")}${ST}`);
  });
});

describe("Console.setPointerShape", () => {
  it("writes OSC 22 with the shape's CSS name", () => {
    const { console, written } = terminal(KITTY);
    console.setPointerShape("text");
    expect(written()).toBe(`${ESC}]22;text${ST}`);
  });
});

describe("Console.notify", () => {
  it("writes OSC 9 where nothing better is known, title and body on its one line", () => {
    const { console, written } = terminal(ITERM);
    console.notify("Done", "3 tests failed");
    expect(written()).toBe(`${ESC}]9;Done: 3 tests failed${ST}`);
  });

  it("writes OSC 777 for foot, with a ; in the title kept out of the separator", () => {
    const { console, written } = terminal(FOOT);
    console.notify("a;b", "c;d");
    expect(written()).toBe(`${ESC}]777;notify;a,b;c;d${ST}`);
  });

  it("writes kitty's OSC 99, title then body under one id", () => {
    const { console, written } = terminal(KITTY);
    console.notify("Done", "ok");
    const [first, second] = written().split(`${ESC}]99;`).slice(1);
    const id = /^i=(\w+):d=0;Done/.exec(first!)?.[1];
    expect(id).toBeDefined();
    expect(second).toBe(`i=${id}:p=body;ok${ST}`);
  });

  it("gives each kitty notification its own id, so a second does not replace the first", () => {
    const { console, written } = terminal(KITTY);
    console.notify("A");
    console.notify("B");
    const ids = [...written().matchAll(/99;i=(\w+);/g)].map((match) => match[1]);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("keeps an OSC 9 line off the shape of ConEmu's numbered sub-commands", () => {
    const { console, written } = terminal(ITERM);
    console.notify("4;2 hosts down");
    expect(written()).toBe(`${ESC}]9; 4;2 hosts down${ST}`);
  });

  it("does not take a terminal borrowing kitty's TERM for kitty", () => {
    const { console, written } = terminal({ TERM: "xterm-kitty", TERM_PROGRAM: "WezTerm" });
    console.notify("Done");
    expect(written()).toBe(`${ESC}]9;Done${ST}`);
  });
});

describe("inside tmux", () => {
  // What tmux 3.2+ gives its panes: its own TERM and TERM_PROGRAM, whatever is outside.
  const TMUX: Env = { TERM: "tmux-256color", TERM_PROGRAM: "tmux", TMUX: "/tmp/tmux-501/default,1,0" };

  it("wraps the clipboard and a notification in tmux's passthrough, every ESC inside doubled", () => {
    const { console, written } = terminal(TMUX);
    console.copyToClipboard("x");
    console.notify("n");
    const wrap = (sequence: string): string => `${ESC}Ptmux;${sequence.replaceAll(ESC, ESC + ESC)}${ST}`;
    expect(written()).toBe(wrap(`${ESC}]52;c;eA==${ST}`) + wrap(`${ESC}]9;n${ST}`));
  });

  it("wraps the pointer's shape in tmux's passthrough, which does not know OSC 22", () => {
    const { console, written } = terminal(TMUX);
    console.setPointerShape("pointer");
    expect(written()).toBe(`${ESC}Ptmux;${ESC}${ESC}]22;pointer${ESC}${ESC}\\${ST}`);
  });

  it("sends OSC 9 behind tmux whatever TERM tmux was told to set", () => {
    const { console, written } = terminal({ TERM: "xterm-ghostty", TERM_PROGRAM: "tmux", TMUX: "x" });
    console.notify("n");
    expect(written()).toBe(`${ESC}Ptmux;${ESC}${ESC}]9;n${ESC}${ESC}\\${ST}`);
  });

  it("takes a terminal started inside tmux for that terminal, not for tmux", () => {
    expect(identifyTerminal({ TERM: "xterm-kitty", TMUX: "x" })).toEqual({ terminal: "kitty", intermediary: undefined });
  });

  it("sends nothing through screen that screen would cut", () => {
    const { console, written } = terminal({ TERM: "screen", STY: "1.pts-0.host" });
    console.copyToClipboard("x".repeat(600));
    expect(written()).toBe("");
    // 300 characters, 900 bytes.
    console.notify("✓".repeat(300));
    expect(written()).toBe("");
  });

  it("leaves the title to tmux, which takes OSC 2 as the pane's", () => {
    const { console, written } = terminal(TMUX);
    console.setWindowTitle("t");
    expect(written()).toBe(`${ESC}]2;t${ST}`);
  });

  it("wraps a request inside screen in its bare passthrough", () => {
    const { console, written } = terminal({ TERM: "screen", STY: "1.pts-0.host" });
    console.copyToClipboard("x");
    expect(written()).toBe(`${ESC}P${ESC}]52;c;eA==\x07${ST}`);
  });

  it("leaves the bell to tmux, which handles it itself", () => {
    const { console, written } = terminal(TMUX);
    console.bell();
    expect(written()).toBe("\x07");
  });
});

describe("no one at a terminal", () => {
  it.each([
    ["a pipe", ITERM, { forceTerminal: false }],
    ["a dumb terminal", { TERM: "dumb" }, {}],
  ] as const)("writes nothing to %s", (_name, env, options) => {
    const { console, written } = terminal(env, options);
    console.setWindowTitle("t");
    console.copyToClipboard("x");
    console.notify("n", "b");
    expect(written()).toBe("");
  });

  it("writes nothing into a capture", () => {
    const { console, written } = terminal(ITERM);
    console.beginCapture();
    console.setWindowTitle("t");
    console.notify("n");
    expect(console.endCapture()).toBe("");
    expect(written()).toBe("");
  });
});

describe("identifyTerminal", () => {
  it.each([
    [{ TERM: "xterm-kitty" }, "kitty", undefined],
    [{ TERM: "xterm-kitty", TERM_PROGRAM: "WezTerm" }, "other", undefined],
    [{ TERM: "xterm-ghostty", TERM_PROGRAM: "ghostty" }, "ghostty", undefined],
    [{ TERM: "foot-extra" }, "foot", undefined],
    [{ TERM: "xterm-256color", VTE_VERSION: "7600" }, "vte", undefined],
    [{ WT_SESSION: "x" }, "windows-terminal", undefined],
    [{ TERM: "screen-256color", TMUX: "x" }, "other", "tmux"],
    [{ TERM: "screen.xterm-256color", STY: "x" }, "other", "screen"],
    [{ TERM: "xterm-kitty", NVIM: "x" }, "kitty", "editor"],
    [{ TERM: "xterm-256color", TERM_PROGRAM: "tmux", TMUX: "x" }, "other", "tmux"],
  ] as const)("%j is %s behind %s", (env, terminal, intermediary) => {
    expect(identifyTerminal(env)).toEqual({ terminal, intermediary });
  });
});
