import { describe, expect, test } from "vitest";
import { resolveOutputTarget } from "../../src/core/color.js";
import { detectTextOrder, type TextOrder } from "../../src/core/text-order.js";

const VTE = { TERM: "xterm-256color", VTE_VERSION: "7600" };
const WT = { TERM: "xterm-256color", WT_SESSION: "abc" };

describe("detectTextOrder", () => {
  const cases: readonly (readonly [string, Record<string, string>, boolean, TextOrder])[] = [
    ["a pipe", VTE, false, "plain"],
    ["nothing known", {}, true, "plain"],
    ["an unknown terminal", { TERM: "xterm-256color" }, true, "plain"],
    ["VTE", VTE, true, "logical"],
    ["Windows Terminal under WSL", WT, true, "visual"],
    ["a native Windows Terminal console", { WT_SESSION: "abc" }, true, "visual"],
    ["Alacritty", { TERM: "alacritty" }, true, "visual"],
    ["foot", { TERM: "foot-extra" }, true, "visual"],
    ["Ghostty", { TERM: "xterm-ghostty" }, true, "visual"],
    ["xterm.js, stated by its env", { TERM: "xterm-256color", TERM_PROGRAM: "xterm.js" }, true, "plain"],
    ["iTerm2, unmeasured", { TERM: "xterm-256color", TERM_PROGRAM: "iTerm.app" }, true, "plain"],
    ["kitty", { TERM: "xterm-kitty" }, true, "words"],
    ["kitty in tmux", { TERM: "xterm-kitty", TMUX: "/tmp/tmux" }, true, "plain"],
    ["kitty from iTerm2", { TERM: "xterm-kitty", TERM_PROGRAM: "iTerm.app", KITTY_WINDOW_ID: "1" }, true, "words"],
    ["WezTerm with kitty's TERM", { TERM: "xterm-kitty", TERM_PROGRAM: "WezTerm" }, true, "plain"],
    // An environment is inherited: each of these has a parent's variable in it.
    ["VS Code from Windows Terminal", { ...WT, TERM_PROGRAM: "vscode" }, true, "plain"],
    ["VS Code from GNOME Terminal", { ...VTE, TERM_PROGRAM: "vscode" }, true, "plain"],
    ["JetBrains from GNOME Terminal", { ...VTE, TERMINAL_EMULATOR: "JetBrains-JediTerm" }, true, "plain"],
    ["Konsole from GNOME Terminal", { ...VTE, KONSOLE_VERSION: "240800" }, true, "plain"],
    ["kitty from GNOME Terminal", { ...VTE, TERM: "xterm-kitty" }, true, "words"],
    ["Alacritty from GNOME Terminal", { ...VTE, TERM: "alacritty" }, true, "visual"],
    ["tmux in Windows Terminal", { ...WT, TMUX: "/tmp/tmux" }, true, "plain"],
    ["screen in Alacritty", { TERM: "screen", STY: "1" }, true, "plain"],
    ["zellij in Alacritty", { TERM: "alacritty", ZELLIJ: "0" }, true, "plain"],
    ["a dumb pty under Emacs in Windows Terminal", { TERM: "dumb", WT_SESSION: "abc" }, true, "plain"],
    ["a dumb pty from Ghostty", { TERM: "dumb", TERM_PROGRAM: "ghostty" }, true, "plain"],
    ["vterm in Windows Terminal", { ...WT, INSIDE_EMACS: "vterm" }, true, "plain"],
    ["Neovim's terminal in GNOME Terminal", { ...VTE, NVIM: "/run/nvim.sock" }, true, "plain"],
    ["Vim's terminal in GNOME Terminal", { ...VTE, VIM_TERMINAL: "901" }, true, "plain"],
    ["Alacritty on a pipe", { TERM: "alacritty" }, false, "plain"],
  ];
  test.each(cases)("%s", (_name, env, isTTY, order) => {
    expect(detectTextOrder(env, isTTY)).toBe(order);
  });
});

describe("resolveOutputTarget", () => {
  test("a color spec says nothing about order", () => {
    for (const spec of ["auto", "truecolor", null] as const) {
      expect(resolveOutputTarget(spec, { env: VTE, isTTY: true }).textOrder).toBe("logical");
      expect(resolveOutputTarget(spec, { env: VTE, isTTY: false }).textOrder).toBe("plain");
    }
  });

  test("an order the program states wins", () => {
    expect(resolveOutputTarget("auto", { env: {}, isTTY: false, textOrder: "visual" }).textOrder).toBe("visual");
  });
});
