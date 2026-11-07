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

import { isAttended, type Env } from "./env.js";
import { identifyTerminal, type TerminalName } from "./terminal-identity.js";

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

// What each terminal does with direction. Ghostty forces the embedding level to
// 0 (font/shaper/coretext.zig); Alacritty (#663) and foot (#756) run no bidi.
// kitty shapes each run of equal-font cells alone, a space always ends one, and
// HarfBuzz reverses a run whose first scripted character is right-to-left
// (`kitty/fonts.c`, render_line and load_hb_buffer); it runs no line bidi. VTE
// reorders, and takes the controls at zero width past column 0
// (`src/unicode-width.hh`, `Terminal::insert_char`). Windows Terminal does
// not reorder (microsoft/terminal#538).
const ORDER_OF: Readonly<Record<TerminalName, TextOrder>> = {
  alacritty: "visual",
  foot: "visual",
  ghostty: "visual",
  "windows-terminal": "visual",
  kitty: "words",
  // Each for its reason under `detectTextOrder`: iTerm2 reorders through isolates, WezTerm's bidi is a setting.
  iterm2: "plain",
  wezterm: "plain",
  vte: "logical",
  other: "plain",
};

/**
 * The order `env` gives evidence for: the identified terminal's
 * (`identifyTerminal`), and `plain` behind anything that sits between.
 *
 * Not listed, each for a reason: xterm.js lays a row out through the browser and
 * advances for an isolate, and VS Code is xterm.js. kitty's `force_ltr yes`
 * would want `visual`, and is a setting the environment cannot show; `words` is
 * its default. WezTerm's bidi is a setting the environment cannot show. iTerm2
 * 3.7.7, at its default settings, reorders the whole line through its isolates,
 * so they contain nothing. Terminal.app 2.15's isolates contain at zero width, but
 * it advances a cell for each RLE, RLO and PDF (LRE and LRO unmeasured), and
 * under `logical` those reach it from content and from the closers `sealed`
 * writes; whether it reorders at all is unmeasured. Konsole, mintty and mlterm
 * are unmeasured. Any program may state its order.
 */
export function detectTextOrder(env: Env, isTTY: boolean): TextOrder {
  const { terminal, intermediary } = identifyTerminal(env);
  return textOrderOf({ terminal, between: intermediary !== undefined, attended: isAttended(isTTY, env) });
}

/** The order `terminal` takes for whoever is `attended` at it: `plain` when anything sits `between`. */
export function textOrderOf({ terminal, between, attended }: { terminal: TerminalName; between: boolean; attended: boolean }): TextOrder {
  return attended && !between ? ORDER_OF[terminal] : "plain";
}
