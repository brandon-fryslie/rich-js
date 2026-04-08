/**
 * Data-driven key → action table. To bind a new key, add a row; no edits
 * to the main loop required. Actions are a discriminated union consumed
 * by the reducer in app.ts.
 */

export type Action =
  | { type: "move"; delta: number }
  | { type: "move-first" }
  | { type: "move-last" }
  | { type: "open" }
  | { type: "up" }
  | { type: "focus-toggle" }
  | { type: "quit" }
  | { type: "none" };

const KEYMAP: Record<string, Action> = {
  "\x1b[A": { type: "move", delta: -1 },
  "\x1b[B": { type: "move", delta: 1 },
  "k": { type: "move", delta: -1 },
  "j": { type: "move", delta: 1 },
  "\x1b[5~": { type: "move", delta: -10 },
  "\x1b[6~": { type: "move", delta: 10 },
  "\x1b[C": { type: "open" },
  "\r": { type: "open" },
  "\n": { type: "open" },
  "l": { type: "open" },
  "\x1b[D": { type: "up" },
  "h": { type: "up" },
  "g": { type: "move-first" },
  "G": { type: "move-last" },
  "\t": { type: "focus-toggle" },
  "\x1b[Z": { type: "focus-toggle" }, // shift-tab
  "q": { type: "quit" },
  "\x03": { type: "quit" },
  "\x1b": { type: "quit" },
};

export function lookup(key: string): Action {
  return KEYMAP[key] ?? { type: "none" };
}
