/**
 * What a destination does with text direction.
 *
 * Every order above `plain` is a claim about the terminal, and a wrong claim
 * costs more than none. Visual order on a terminal that also reorders reverses
 * the text twice, and no query answers for every such terminal. An isolate on a
 * terminal whose width table predates it advances the cursor (xterm.js 6 does),
 * which moves a table's border and the rows a painter goes back over. So what
 * nothing is known about gets bare text, and `detectTextOrder` grants more only
 * on evidence.
 */

import { isDumbTerminal, type Env } from "./env.js";
import { pattern } from "./pattern.js";

/**
 * - `plain`: nothing is known of the destination, or it is not a display: a
 *   pipe, a file, an unknown terminal. Characters only, in logical order, with
 *   no explicit bidi control.
 * - `logical`: a display known to reorder and to hold the controls at zero
 *   width. Rows are sealed in isolates.
 * - `visual`: a display known not to reorder. Rows are written reordered and
 *   shaped, with no controls.
 * - `words`: a display known to reverse right-to-left text inside each run of
 *   non-space cells and nowhere else, as kitty does. Rows are laid out as under
 *   `visual`, and the wire turns back each run it will reverse (`sealed`).
 */
export type TextOrder = "plain" | "logical" | "visual" | "words";

/** Whether `order` lays a row out in the order it is shown. */
export function laidOutVisually(order: TextOrder): boolean {
  return order === "visual" || order === "words";
}

/** A row's paragraph direction: 0 left to right, 1 right to left. */
export type ParagraphLevel = 0 | 1;

/** Cells written for a terminal that reorders them: their row's direction, and what is still open where they begin. */
export interface LogicalStamp {
  readonly order: "logical";
  readonly level: ParagraphLevel;
  readonly opens: string;
}

/** Cells already in visual order, for an export not to reverse again. */
export interface VisualStamp {
  readonly order: "visual";
}

export type BidiStamp = LogicalStamp | VisualStamp;

// Terminals that paint their own cells and do not reorder, by the `TERM` each
// writes for its child. Ghostty forces the embedding level to 0
// (font/shaper/coretext.zig); Alacritty (#663) and foot (#756) run no bidi.
const VISUAL_TERM = pattern(/^(alacritty|foot|xterm-ghostty)/);

/**
 * The order `env` gives evidence for.
 *
 * An environment is inherited: `code .` from Windows Terminal carries
 * `WT_SESSION` into VS Code's xterm.js terminal, and Alacritty clears nothing
 * from GNOME Terminal. `TERM` is the one variable every terminal writes for its
 * own child, so it is read first, and a variable a parent could have left counts
 * only beside the `TERM` its own terminal sets. The rows are in the order that
 * makes that true; a terminal naming itself off this list is `plain`.
 *
 * Not listed, each for a reason: xterm.js lays a row out through the browser and
 * advances for an isolate, and VS Code is xterm.js. kitty's `force_ltr yes`
 * would want `visual`, and is a setting the environment cannot show; `words` is
 * its default. WezTerm's bidi is a setting
 * the environment cannot show. iTerm2, Konsole, Terminal.app, mintty and mlterm
 * are unmeasured. Any program may state its order.
 */
export function detectTextOrder(env: Env, isTTY: boolean): TextOrder {
  if (!isTTY || isDumbTerminal(env)) return "plain";
  if (env["TMUX"] || env["STY"] || env["ZELLIJ"] || env["INSIDE_EMACS"] || env["NVIM"] || env["VIM_TERMINAL"]) return "plain";
  if ((env["TERM"] ?? "").match(VISUAL_TERM) !== null) return "visual";
  // kitty shapes each run of equal-font cells alone, a space always ends one, and
  // HarfBuzz reverses a run whose first scripted character is right-to-left
  // (`kitty/fonts.c`, render_line and load_hb_buffer); it runs no line bidi.
  if (env["TERM"] === "xterm-kitty") return "words";
  if (env["TERM_PROGRAM"] || env["TERMINAL_EMULATOR"] || env["KONSOLE_VERSION"]) return "plain";
  // VTE reorders, and takes the controls at zero width past column 0
  // (`src/unicode-width.hh`, `Terminal::insert_char`).
  if (env["VTE_VERSION"] && env["TERM"] === "xterm-256color") return "logical";
  // Windows Terminal (microsoft/terminal#538): a console there has no `TERM`, WSL has this one.
  if (env["WT_SESSION"] && (env["TERM"] === undefined || env["TERM"] === "xterm-256color")) return "visual";
  return "plain";
}
