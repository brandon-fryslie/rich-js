/**
 * Requests a program sends the terminal itself — title, clipboard, pointer shape, notification
 * — on their exact bytes, outside and inside tmux, and never to no one.
 */

import { describe, expect, it } from "vitest";
import { Console, type AppNotifyOptions, type ConsoleOptions } from "../../src/core/console.js";
import type { Env } from "../../src/core/env.js";
import { identifyTerminal } from "../../src/core/terminal-identity.js";
import { notificationClick } from "../../src/core/terminal-requests.js";
import { declareCapabilities, type TerminalSend } from "../../src/core/terminal-capabilities.js";
import { Prompt } from "../../src/renderables/prompt.js";


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

// The console an app draws on: the one that raises a notification with a click
// report, through the same protected road `App.notify` takes.
class HeardConsole extends Console {
  notifyHeard(title: string, body: string | undefined, options: AppNotifyOptions): string {
    return this.raise(title, body, options);
  }

  withdrawHeard(id: string): void {
    this.withdraw(id);
  }
}

function heardTerminal(env: Env, options: ConsoleOptions = {}): { console: HeardConsole; written: () => string } {
  const chunks: string[] = [];
  const console = new HeardConsole({
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
  const PASSES = (kind: "tmux" | "screen") => ({ terminalFeatures: { layers: [{ kind, passthrough: "declared" }] } } as const);

  it("sends none of them under strict when nothing says tmux passes them, and says why", () => {
    const log: TerminalSend[] = [];
    const { console, written } = terminal(TMUX, { terminalFeatures: { onSend: (send) => void log.push(send) } });
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
      terminalFeatures: { capabilities: declareCapabilities([], "kitty"), layers: [{ kind: "tmux", passthrough: "declared" }], onSend: (send) => void log.push(send) },
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

describe("Console.notify urgency", () => {
  it("writes kitty's u= on the title's chunk, graded 0 low, 1 normal, 2 critical", () => {
    const { console, written } = terminal(KITTY, GUESS);
    console.notify("Build failed", "3 tests", { urgency: "critical" });
    expect(written()).toMatch(/^\x1b\]99;i=\w+:u=2:d=0;Build failed\x1b\\/);
  });

  it("leaves the urgency out where none is asked, so kitty keeps its default", () => {
    const { console, written } = terminal(KITTY, GUESS);
    console.notify("Done");
    expect(written()).not.toContain(":u=");
  });

  it("is not written where it has no meaning, the notification as it would have been", () => {
    const { console, written } = terminal(FOOT, GUESS);
    console.notify("Done", undefined, { urgency: "critical" });
    expect(written()).toBe(`${ESC}]777;notify;Done;${ST}`);
  });
});

describe("Console.requestAttention", () => {
  it("asks iTerm2 to bounce or to fire its fireworks, and to cancel a bounce", () => {
    const { console, written } = terminal(ITERM, GUESS);
    console.requestAttention("bounce");
    console.requestAttention("fireworks");
    console.requestAttention("cancel");
    expect(written()).toBe(`${ESC}]1337;RequestAttention=yes${ST}${ESC}]1337;RequestAttention=fireworks${ST}${ESC}]1337;RequestAttention=no${ST}`);
  });

  it("is refused under strict on the environment's word alone, and says why", () => {
    const sends: TerminalSend[] = [];
    const { console, written } = terminal(ITERM, { terminalFeatures: { onSend: (send) => void sends.push(send) } });
    console.requestAttention("bounce");
    expect(written()).toBe("");
    expect(sends.at(-1)?.feature).toBe("attention");
  });

  it("is not sent to a terminal that does not read it", () => {
    const { console, written } = terminal(KITTY, GUESS);
    console.requestAttention("bounce");
    expect(written()).toBe("");
  });
});

describe("Console.mark", () => {
  it("writes OSC 133's zones, the exit a command finished with included", () => {
    const { console, written } = terminal(ITERM, GUESS);
    console.mark("prompt");
    console.mark("input");
    console.mark("output");
    console.mark({ done: 2 });
    expect(written()).toBe(`${ESC}]133;A${ST}${ESC}]133;B${ST}${ESC}]133;C${ST}${ESC}]133;D;2${ST}`);
  });

  it("writes the bare D that aborts a command, which carries no exit", () => {
    const { console, written } = terminal(ITERM, GUESS);
    console.mark("abort");
    expect(written()).toBe(`${ESC}]133;D${ST}`);
  });

  it("refuses an exit a shell cannot report, so no digits a terminal would misread are written", () => {
    const { console, written } = terminal(ITERM, GUESS);
    for (const done of [-1, 1.5, 256, Number.NaN]) {
      expect(() => console.mark({ done })).toThrow(TypeError);
    }
    expect(written()).toBe("");
    console.mark({ done: 255 });
    expect(written()).toBe(`${ESC}]133;D;255${ST}`);
  });

  it("writes nothing into a capture, as every request", () => {
    const { console, written } = terminal(ITERM, GUESS);
    console.beginCapture();
    console.mark("prompt");
    expect(console.endCapture()).toBe("");
    expect(written()).toBe("");
  });
});

describe("buttons and click reports, which only an app asks for", () => {
  it("writes a report request on the first chunk, then each button as a chunk of its own, after the body", () => {
    const { console, written } = heardTerminal(KITTY, GUESS);
    const id = console.notifyHeard("Build", "3 failed", { buttons: ["Open log", "Dismiss"], reportClicks: true });
    // kitty's `a` is a list whose default is `focus`: naming `report` alone drops focus-on-click, so both are named.
    expect(written()).toBe(
      `${ESC}]99;i=${id}:a=focus,report:d=0;Build${ST}${ESC}]99;i=${id}:p=body:d=0;3 failed${ST}${ESC}]99;i=${id}:p=buttons;Open log Dismiss${ST}`,
    );
  });

  it("returns the id it wrote, so a click names the notification it came from", () => {
    const { console, written } = heardTerminal(KITTY, GUESS);
    const id = console.notifyHeard("Done", undefined, { reportClicks: true });
    expect(written()).toBe(`${ESC}]99;i=${id}:a=focus,report;Done${ST}`);
  });

  it("drops a U+2028 from a label, so a label cannot split into two buttons", () => {
    const { console, written } = heardTerminal(KITTY, GUESS);
    console.notifyHeard("Done", undefined, { buttons: ["a b", "c"] });
    expect(written()).toContain("p=buttons;ab c\x1b\\");
  });

  it("asks for no report where none is asked, and writes no button chunk without buttons", () => {
    const { console, written } = terminal(KITTY, GUESS);
    console.notify("Done", "ok");
    expect(written()).not.toContain("a=report");
    expect(written()).not.toContain("p=buttons");
  });

  it("writes no button or report where the terminal has no such thing", () => {
    const { console, written } = heardTerminal(FOOT, GUESS);
    console.notifyHeard("Done", "ok", { buttons: ["x"], reportClicks: true });
    expect(written()).toBe(`${ESC}]777;notify;Done;ok${ST}`);
  });
});

describe("Console.notify's options are checked where they are given", () => {
  // A TypeScript caller cannot pass these; a JavaScript one can, and the error belongs to the call, not to whichever terminal reads it.
  it("refuses an urgency kitty does not know on every terminal, rather than writing u=undefined", () => {
    const { console, written } = terminal(FOOT, GUESS);
    expect(() => console.notify("Done", undefined, { urgency: "high" as never })).toThrow(TypeError);
    expect(written()).toBe("");
  });

  it("refuses a button with no label, so kitty never shows an empty button", () => {
    const { console, written } = heardTerminal(KITTY, GUESS);
    expect(() => console.notifyHeard("Done", undefined, { buttons: ["Yes", ""] })).toThrow(TypeError);
    expect(written()).toBe("");
  });

  it("refuses a label that is only line separators, which stripping would leave empty", () => {
    const { console } = heardTerminal(KITTY, GUESS);
    expect(() => console.notifyHeard("Done", undefined, { buttons: [" "] })).toThrow(TypeError);
  });

  it("names the field that is not text, since a JavaScript caller can pass a number for it", () => {
    const { console } = terminal(KITTY, GUESS);
    expect(() => console.notify(1 as never)).toThrow("a notification's title must be text, not number");
    expect(() => heardTerminal(KITTY, GUESS).console.notifyHeard("Done", undefined, { buttons: ["Yes", 2 as never] })).toThrow("button 2 must be text, not number");
  });

  it("refuses a click report or buttons on a console, which no app hears: App.notify asks for them", () => {
    const { console, written } = terminal(KITTY, GUESS);
    expect(() => console.notify("Done", undefined, { reportClicks: true } as never)).toThrow("App.notify");
    expect(() => console.notify("Done", undefined, { buttons: ["Yes"] } as never)).toThrow("App.notify");
    expect(written()).toBe("");
  });

  it("refuses a report flag that is not true or false, rather than dropping it without a sound", () => {
    const { console } = heardTerminal(KITTY, GUESS);
    expect(() => console.notifyHeard("Done", undefined, { reportClicks: "yes" as never })).toThrow("reportClicks must be true or false, not string");
  });

  it("withdraws a notification by its id, so a click on it is no longer reported", () => {
    const { console, written } = heardTerminal(KITTY, GUESS);
    const id = console.notifyHeard("Done", undefined, { reportClicks: true });
    console.withdrawHeard(id);
    expect(written().endsWith(`${ESC}]99;i=${id}:p=close;${ST}`)).toBe(true);
  });
});

describe("notificationClick", () => {
  it("reads a click on the notification as its id with no button", () => {
    expect(notificationClick("99;i=abc123;")).toEqual({ id: "abc123", button: undefined });
  });

  it("reads a click on a button as the button's 1-based number", () => {
    expect(notificationClick("99;i=abc123;2")).toEqual({ id: "abc123", button: 2 });
  });

  it("reads any other OSC as no click, OSC 11's color report and a malformed 99 included", () => {
    expect(notificationClick("11;rgb:1e1e/1e1e/1e1e")).toBeUndefined();
    expect(notificationClick("99;i=abc;x")).toBeUndefined();
    expect(notificationClick("99;abc;")).toBeUndefined();
  });
});

describe("Console.requestAttention focus", () => {
  it("writes StealFocus, which takes no argument", () => {
    const { console, written } = terminal(ITERM, GUESS);
    console.requestAttention("focus");
    expect(written()).toBe(`${ESC}]1337;StealFocus${ST}`);
  });
});

describe("Console.requestAttention's argument", () => {
  it("refuses an attention request it does not know, rather than writing RequestAttention=undefined", () => {
    const { console, written } = terminal(ITERM, GUESS);
    expect(() => console.requestAttention("bounce-once" as never)).toThrow(TypeError);
    expect(written()).toBe("");
  });
});

describe("Console's print zones", () => {
  it("writes no zone around a print, since a print is output and not a command a shell ran", () => {
    const { console, written } = terminal(ITERM, GUESS);
    console.print("hi");
    console.print("there");
    expect(written()).toBe("hi\nthere\n");
  });

  it("zones nothing into a pipe, and logs nothing for it", () => {
    const sends: TerminalSend[] = [];
    const { console, written } = terminal(ITERM, { forceTerminal: false, terminalFeatures: { policy: "bestGuess", onSend: (send) => void sends.push(send) } });
    console.print("hi");
    expect(written()).toBe("hi\n");
    expect(sends).toEqual([]);
  });

  it("zones nothing into a capture", () => {
    const { console, written } = terminal(ITERM, GUESS);
    console.beginCapture();
    console.print("hi");
    expect(console.endCapture()).toBe("hi\n");
    expect(written()).toBe("");
  });
});

describe("Prompt's zones", () => {
  it("makes each attempt a command: a refused one is aborted, and the accepted one opens and closes its own", async () => {
    const { console, written } = terminal(ITERM, GUESS);
    const answers = ["nope", "yes"];
    const value = await Prompt.ask("Proceed?", async () => {
      // What the input sees: this attempt's input zone is the last one opened.
      expect(written().match(/\x1b\]133;[^\x1b]*\x1b\\/g)?.at(-1)).toBe(`${ESC}]133;B${ST}`);
      return answers.shift()!;
    }, { console, choices: ["yes", "no"] });
    expect(value).toBe("yes");
    expect(written().match(/\x1b\]133;[^\x1b]*\x1b\\/g)).toEqual([
      `${ESC}]133;A${ST}`,
      `${ESC}]133;B${ST}`,
      `${ESC}]133;D${ST}`,
      `${ESC}]133;A${ST}`,
      `${ESC}]133;B${ST}`,
      `${ESC}]133;C${ST}`,
      `${ESC}]133;D;0${ST}`,
    ]);
  });

  it("draws the prompt its input writes inside the input zone, so the command stays open until the answer", async () => {
    const { console, written } = terminal(ITERM, GUESS);
    const value = await Prompt.ask("Proceed?", async (prompt, console) => {
      console.print(prompt, { end: "", softWrap: true });
      return "yes";
    }, { console });
    expect(value).toBe("yes");
    // The prompt sits between B and the output zone, which opens once the answer is accepted and closes at once.
    expect(written()).toBe(`${ESC}]133;A${ST}${ESC}]133;B${ST}Proceed?: ${ESC}]133;C${ST}${ESC}]133;D;0${ST}`);
  });

  it("ends the command it opened when no answer comes, so the text after it is not its input", async () => {
    const { console, written } = terminal(ITERM, GUESS);
    await expect(Prompt.ask("Proceed?", async () => {
      throw new Error("closed");
    }, { console })).rejects.toThrow("closed");
    expect(written()).toBe(`${ESC}]133;A${ST}${ESC}]133;B${ST}${ESC}]133;D${ST}`);
    console.print("after");
    expect(written()).toBe(`${ESC}]133;A${ST}${ESC}]133;B${ST}${ESC}]133;D${ST}after\n`);
  });

  it("does not report a valid answer as an abort when the mark that closes it fails", async () => {
    const chunks: string[] = [];
    const { console } = terminal(ITERM, { ...GUESS, file: { write: (chunk: string) => {
      if (chunk.includes(`${ESC}]133;C`)) throw new Error("broken pipe");
      chunks.push(chunk);
    } } });
    await expect(Prompt.ask("Proceed?", async () => "yes", { console })).rejects.toThrow("broken pipe");
    expect(chunks.join("")).not.toContain(`${ESC}]133;D${ST}`);
  });

  it("ends its command when its input zone cannot open, so the command it began is not left open", async () => {
    const chunks: string[] = [];
    const { console } = terminal(ITERM, { ...GUESS, file: { write: (chunk: string) => {
      if (chunk.includes(`${ESC}]133;B`)) throw new Error("broken pipe");
      chunks.push(chunk);
    } } });
    await expect(Prompt.ask("Proceed?", async () => "yes", { console })).rejects.toThrow("broken pipe");
    console.print("after");
    expect(chunks.join("")).toBe(`${ESC}]133;A${ST}${ESC}]133;D${ST}after\n`);
  });
});
