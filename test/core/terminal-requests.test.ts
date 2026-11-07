/**
 * Requests a program sends the terminal itself — title, clipboard, pointer shape, notification
 * — on their exact bytes, outside and inside tmux, and never to no one.
 */

import { describe, expect, it } from "vitest";
import { Console } from "../../src/core/console.js";
import type { Env } from "../../src/core/env.js";
import { identifyTerminal } from "../../src/core/terminal-identity.js";
import { declareCapabilities, type TerminalSend } from "../../src/core/terminal-capabilities.js";

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
// What acts on the environment's word that the terminal is kitty or foot.
const GUESS = { terminalFeatures: { policy: "bestGuess" } } as const;

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
    const { console, written } = terminal(FOOT, GUESS);
    console.notify("a;b", "c;d");
    expect(written()).toBe(`${ESC}]777;notify;a,b;c;d${ST}`);
  });

  it("writes OSC 9 for kitty on the environment's word alone, under strict", () => {
    const { console, written } = terminal(KITTY);
    console.notify("Done");
    expect(written()).toBe(`${ESC}]9;Done${ST}`);
  });

  it("writes kitty's OSC 99, title then body under one id", () => {
    const { console, written } = terminal(KITTY, GUESS);
    console.notify("Done", "ok");
    const [first, second] = written().split(`${ESC}]99;`).slice(1);
    const id = /^i=(\w+):d=0;Done/.exec(first!)?.[1];
    expect(id).toBeDefined();
    expect(second).toBe(`i=${id}:p=body;ok${ST}`);
  });

  it("keeps the terminal it inferred when the program declares only an encoding", () => {
    const { console, written } = terminal(KITTY, { terminalFeatures: { policy: "bestGuess", capabilities: declareCapabilities(["OSC 9;4"]) } });
    console.notify("A");
    expect(written()).toContain(`${ESC}]99;`);
  });

  it("gives each kitty notification its own id, so a second does not replace the first", () => {
    const { console, written } = terminal(KITTY, GUESS);
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

  it("keeps a bare number off the shape of a ConEmu sub-command", () => {
    const { console, written } = terminal(ITERM);
    console.notify("4");
    expect(written()).toBe(`${ESC}]9; 4${ST}`);
  });

  it("sends a terminal's own notification through no editor or zellij, which cannot pass it", () => {
    for (const env of [{ TERM: "xterm-kitty", NVIM: "x" }, { TERM: "xterm-kitty", ZELLIJ: "0" }]) {
      const { console, written } = terminal(env, GUESS);
      console.notify("n");
      expect(written()).toBe(`${ESC}]9;n${ST}`);
    }
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
  // A program stating that tmux's `allow-passthrough` is on.
  const PASSES = (kind: "tmux" | "screen") => ({ terminalFeatures: { layers: [{ kind, evidence: "declared", passthrough: "declared" }] } } as const);

  it("sends none of them under strict when nothing says tmux passes them, and says why", () => {
    const log: TerminalSend[] = [];
    const { console, written } = terminal(TMUX, { terminalFeatures: { onSend: (send) => log.push(send) } });
    console.copyToClipboard("x");
    console.setPointerShape("text");
    console.notify("n");
    expect(written()).toBe("");
    expect(log.map((send) => send.reason)).toEqual([
      "fallback: OSC 52: tmux passthrough is unknown",
      "fallback: OSC 22: tmux passthrough is unknown",
      "fallback: OSC 99 ignored where unsupported; whether other reads it is unknown, strict; OSC 777 ignored where unsupported; whether other reads it is unknown, strict; OSC 9: tmux passthrough is unknown",
    ]);
  });

  it("writes kitty's own notification through a tmux the program says passes it, and logs the route", () => {
    const log: TerminalSend[] = [];
    const { console, written } = terminal(TMUX, {
      terminalFeatures: { capabilities: declareCapabilities([], "kitty"), layers: [{ kind: "tmux", evidence: "declared", passthrough: "declared" }], onSend: (send) => log.push(send) },
    });
    console.notify("n");
    expect(written()).toMatch(new RegExp(`^${ESC}Ptmux;${ESC}${ESC}\\]99;i=\\w+;n${ESC}${ESC}\\\\${ESC}\\\\$`));
    expect(log[0]?.reason).toBe("OSC 99 through tmux passthrough: declared by the program is declared, strict");
  });

  it("wraps the clipboard and a notification in tmux's passthrough, every ESC inside doubled", () => {
    const { console, written } = terminal(TMUX, PASSES("tmux"));
    console.copyToClipboard("x");
    console.notify("n");
    const wrap = (sequence: string): string => `${ESC}Ptmux;${sequence.replaceAll(ESC, ESC + ESC)}${ST}`;
    expect(written()).toBe(wrap(`${ESC}]52;c;eA==${ST}`) + wrap(`${ESC}]9;n${ST}`));
  });

  it("wraps the pointer's shape in tmux's passthrough, which does not know OSC 22", () => {
    const { console, written } = terminal(TMUX, PASSES("tmux"));
    console.setPointerShape("pointer");
    expect(written()).toBe(`${ESC}Ptmux;${ESC}${ESC}]22;pointer${ESC}${ESC}\\${ST}`);
  });

  it("sends OSC 9 behind tmux whatever TERM tmux was told to set, under either policy: that TERM names no terminal past it", () => {
    const env = { TERM: "xterm-ghostty", TERM_PROGRAM: "tmux", TMUX: "x" };
    expect(identifyTerminal(env)).toMatchObject({ terminal: "other", intermediary: "tmux", namedBy: undefined });
    for (const policy of ["strict", "bestGuess"] as const) {
      const { console, written } = terminal(env, { terminalFeatures: { ...PASSES("tmux").terminalFeatures, policy } });
      console.notify("n");
      expect(written()).toBe(`${ESC}Ptmux;${ESC}${ESC}]9;n${ESC}${ESC}\\${ST}`);
    }
  });

  it("takes a terminal started inside tmux for that terminal, not for tmux", () => {
    expect(identifyTerminal({ TERM: "xterm-kitty", TMUX: "x" })).toMatchObject({ terminal: "kitty", intermediary: undefined });
  });

  it("sends nothing through screen that screen would cut", () => {
    const { console, written } = terminal({ TERM: "screen", STY: "1.pts-0.host" }, PASSES("screen"));
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
    const { console, written } = terminal({ TERM: "screen", STY: "1.pts-0.host" }, PASSES("screen"));
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
    [{ TERM: "xterm-kitty", TERM_PROGRAM: "WezTerm" }, "wezterm", undefined],
    [{ TERM: "xterm-256color", TERM_PROGRAM: "iTerm.app" }, "iterm2", undefined],
    [{ TERM: "xterm-256color", LC_TERMINAL: "iTerm2" }, "iterm2", undefined],
    [{ TERM: "tmux-256color", TERM_PROGRAM: "tmux", TMUX: "x", LC_TERMINAL: "iTerm2" }, "iterm2", "tmux"],
    // kitty started from an iTerm2 shell inherits LC_TERMINAL and sets its own TERM.
    [{ TERM: "xterm-kitty", LC_TERMINAL: "iTerm2" }, "kitty", undefined],
    [{ TERM: "alacritty", LC_TERMINAL: "iTerm2" }, "alacritty", undefined],
    [{ TERM: "xterm-ghostty", TERM_PROGRAM: "ghostty" }, "ghostty", undefined],
    [{ TERM: "foot-extra" }, "foot", undefined],
    [{ TERM: "xterm-256color", VTE_VERSION: "7600" }, "vte", undefined],
    [{ WT_SESSION: "x" }, "windows-terminal", undefined],
    [{ TERM: "screen-256color", TMUX: "x" }, "other", "tmux"],
    [{ TERM: "screen.xterm-256color", STY: "x" }, "other", "screen"],
    [{ TERM: "xterm-kitty", NVIM: "x" }, "kitty", "editor"],
    [{ TERM: "xterm-256color", TERM_PROGRAM: "tmux", TMUX: "x" }, "other", "tmux"],
  ] as const)("%j is %s behind %s", (env, terminal, intermediary) => {
    expect(identifyTerminal(env)).toMatchObject({ terminal, intermediary });
  });
});

describe("a pointer shape", () => {
  // BEL ends OSC 22 in xterm's parser, and what follows is a clipboard write.
  const planted = "text\x07\x1b]52;c;AAA\x07" as "text";

  it.each([
    ["attended", true],
    ["unattended", false],
  ])("is refused on an %s console before anything is written", (_, forceTerminal) => {
    const { console, written } = terminal(KITTY, { forceTerminal });
    expect(() => console.setPointerShape(planted)).toThrow(TypeError);
    expect(written()).toBe("");
  });

  it("names a value that is not a string by its type", () => {
    const { console } = terminal(KITTY);
    expect(() => console.setPointerShape(1n as never)).toThrow(/^a bigint is not a pointer shape/);
  });
});
