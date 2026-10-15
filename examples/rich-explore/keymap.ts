/**
 * Data-driven key → action table, keyed by `keyName`. To bind a new key, add
 * a row; no edits to the main loop required. Actions are a discriminated
 * union consumed by the reducer in app.ts. Ctrl+C is the app's own quit key
 * and never reaches the table.
 */

import { keyName, type KeyPress } from "@promptctl/rich-js/host";

export type Action =
  | { type: "move"; delta: number }
  | { type: "move-first" }
  | { type: "move-last" }
  | { type: "open" }
  | { type: "up" }
  | { type: "focus-toggle" }
  | { type: "coverage" }
  | { type: "suspend" }
  | { type: "quit" }
  | { type: "none" };

const KEYMAP: Record<string, Action> = {
  "up": { type: "move", delta: -1 },
  "down": { type: "move", delta: 1 },
  "k": { type: "move", delta: -1 },
  "j": { type: "move", delta: 1 },
  "pageup": { type: "move", delta: -10 },
  "pagedown": { type: "move", delta: 10 },
  "right": { type: "open" },
  "enter": { type: "open" },
  "l": { type: "open" },
  "left": { type: "up" },
  "h": { type: "up" },
  "g": { type: "move-first" },
  "G": { type: "move-last" },
  "tab": { type: "focus-toggle" },
  "shift+tab": { type: "focus-toggle" },
  "c": { type: "coverage" },
  "ctrl+z": { type: "suspend" }, // a key in raw mode
  "q": { type: "quit" },
};

export function lookup(press: KeyPress): Action {
  return KEYMAP[keyName(press)] ?? { type: "none" };
}
