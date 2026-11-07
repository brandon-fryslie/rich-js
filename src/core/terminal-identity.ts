/**
 * Which terminal draws the cells, and what sits between it and the program:
 * the one reading of the environment every terminal-specific choice derives
 * from — the text order, the notification protocol, the wrapping a multiplexer
 * needs. `color.ts` reads `TERM` for a different question, how many colors, and
 * partly from suffixes (`-256color`) that name no terminal.
 *
 * An environment is inherited: `code .` from Windows Terminal carries
 * `WT_SESSION` into VS Code's xterm.js terminal, and Alacritty clears nothing
 * from GNOME Terminal. `TERM` is the one variable every terminal writes for its
 * own child, so it is read first, and a variable a parent could have left counts
 * only beside the `TERM` its own terminal sets. A terminal naming itself off
 * this list is `other`.
 */

import type { Env } from "./env.js";
import { pattern, type Pattern } from "./pattern.js";

/** A terminal some choice in the library turns on; every other one is `other`. */
export type TerminalName = "kitty" | "ghostty" | "foot" | "alacritty" | "iterm2" | "wezterm" | "vte" | "windows-terminal" | "other";

/**
 * What sits between the program and the terminal, rewriting what it writes:
 * a multiplexer, or an editor's embedded terminal.
 */
export type Intermediary = "tmux" | "screen" | "zellij" | "editor";

export interface TerminalIdentity {
  readonly terminal: TerminalName;
  readonly intermediary: Intermediary | undefined;
  /** The variable that named `terminal`, as `NAME=value`: what a choice made on it gives as its reason. */
  readonly namedBy: string | undefined;
}

const TERM_NAMES: readonly (readonly [Pattern, TerminalName])[] = [
  [pattern(/^alacritty/), "alacritty"],
  [pattern(/^foot/), "foot"],
  [pattern(/^xterm-ghostty/), "ghostty"],
];

// tmux and screen set the TERM their panes see (tmux 3.2+ its TERM_PROGRAM too),
// so their variable counts only beside it: a terminal started inside one
// inherits the variable and sets its own TERM.
const MULTIPLEXER_TERM = pattern(/^(screen|tmux)/);

function intermediaryOf(env: Env): Intermediary | undefined {
  const own = (env["TERM"] ?? "").match(MULTIPLEXER_TERM) !== null;
  if (env["TMUX"] && (own || env["TERM_PROGRAM"] === "tmux")) return "tmux";
  if (env["STY"] && own) return "screen";
  if (env["ZELLIJ"]) return "zellij";
  if (env["INSIDE_EMACS"] || env["NVIM"] || env["VIM_TERMINAL"]) return "editor";
  return undefined;
}

// The TERM_PROGRAM a terminal writes for its own child, beside the TERM it sets.
// A Map, so an inherited key (`constructor`) names nothing.
const TERM_PROGRAMS: ReadonlyMap<string, TerminalName> = new Map([["iTerm.app", "iterm2"], ["WezTerm", "wezterm"]]);

type Named = readonly [TerminalName, string | undefined];

function terminalOf(env: Env, intermediary: Intermediary | undefined): Named {
  const term = env["TERM"] ?? "";
  for (const [name, terminal] of TERM_NAMES) if (term.match(name) !== null) return [terminal, `TERM=${term}`];
  // kitty sets no TERM_PROGRAM. A terminal that borrows kitty's TERM (WezTerm
  // can) names itself, and so does one started from kitty, whose KITTY_WINDOW_ID
  // it inherits, so that variable proves nothing.
  if (term === "xterm-kitty" && !env["TERM_PROGRAM"]) return ["kitty", `TERM=${term}`];
  const program = env["TERM_PROGRAM"];
  const programmed = program === undefined ? undefined : TERM_PROGRAMS.get(program);
  if (programmed !== undefined) return [programmed, `TERM_PROGRAM=${program}`];
  // iTerm2 sets LC_TERMINAL for its child, and ssh forwards LC_* where tmux's
  // TERM_PROGRAM and a remote shell's lose it. It counts beside iTerm2's own
  // TERM, or behind a multiplexer, whose pane has a TERM of its own: a
  // terminal started from iTerm2 inherits the variable and sets another TERM,
  // or iTerm2's TERM and a TERM_PROGRAM of its own (VS Code's `vscode`).
  const lc = env["LC_TERMINAL"];
  const ownProgram = program !== undefined && program !== "tmux";
  if (lc === "iTerm2" && !ownProgram && (term === "xterm-256color" || intermediary === "tmux" || intermediary === "screen")) return ["iterm2", `LC_TERMINAL=${lc}`];
  if (program || env["TERMINAL_EMULATOR"] || env["KONSOLE_VERSION"]) return ["other", undefined];
  if (env["VTE_VERSION"] && term === "xterm-256color") return ["vte", `VTE_VERSION=${env["VTE_VERSION"]}`];
  // Windows Terminal (microsoft/terminal#538): a console there has no `TERM`, WSL has this one.
  if (env["WT_SESSION"] && (env["TERM"] === undefined || term === "xterm-256color")) return ["windows-terminal", "WT_SESSION"];
  return ["other", undefined];
}

/** The terminal and intermediary `env` gives evidence for. */
export function identifyTerminal(env: Env): TerminalIdentity {
  const intermediary = intermediaryOf(env);
  const [terminal, namedBy] = terminalOf(env, intermediary);
  return { terminal, intermediary, namedBy };
}
