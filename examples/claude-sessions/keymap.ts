/**
 * Data-driven key → action tables, keyed by `keyName`: one for browsing, one
 * for typing a search query, which reads every key as text but the lifecycle
 * ones. Ctrl+C is the app's own quit key and never reaches either.
 */

import { keyName, type KeyPress } from "@promptctl/rich-js/host";

export type Action =
  | { type: "move"; delta: number }
  | { type: "first" }
  | { type: "last" }
  | { type: "open" }              // sidebar: descend; viewer: drill into subagent
  | { type: "back" }              // sidebar: ascend
  | { type: "toggle-sidebar" }
  | { type: "toggle-focus" }
  | { type: "toggle-view-mode" }
  | { type: "toggle-expand" }
  | { type: "toggle-hidden" }
  | { type: "jump-parent" }
  | { type: "pop-session" }
  | { type: "search-enter" }       // local, /
  | { type: "global-search-enter" }// global, S
  | { type: "search-next" }
  | { type: "search-prev" }
  | { type: "search-exit" }
  | { type: "search-key"; press: KeyPress } // typing a query
  | { type: "suspend" }
  | { type: "quit" }
  | { type: "none" };

// Ctrl+Z is a key in raw mode, and acts in every mode.
const LIFECYCLE: Record<string, Action> = {
  "ctrl+z": { type: "suspend" },
};

const KEYMAP: Record<string, Action> = {
  // Movement
  "up": { type: "move", delta: -1 },
  "down": { type: "move", delta: 1 },
  "k": { type: "move", delta: -1 },
  "j": { type: "move", delta: 1 },
  "pageup": { type: "move", delta: -10 },
  "pagedown": { type: "move", delta: 10 },
  "g": { type: "first" },
  "G": { type: "last" },

  // Context-polymorphic open/back
  "right": { type: "open" },
  "enter": { type: "open" },
  "l": { type: "open" },
  "left": { type: "back" },

  // Layout
  "\\": { type: "toggle-sidebar" },
  "tab": { type: "toggle-focus" },
  "shift+tab": { type: "toggle-focus" },

  // Viewer commands
  "v": { type: "toggle-view-mode" },
  "e": { type: "toggle-expand" },
  "H": { type: "toggle-hidden" },
  "p": { type: "jump-parent" },
  "u": { type: "pop-session" },

  // Search
  "/": { type: "search-enter" },
  "S": { type: "global-search-enter" },
  "n": { type: "search-next" },
  "N": { type: "search-prev" },
  "escape": { type: "search-exit" },

  "q": { type: "quit" },
  ...LIFECYCLE,
};

export function lookup(press: KeyPress): Action {
  return KEYMAP[keyName(press)] ?? { type: "none" };
}

export function lookupTyping(press: KeyPress): Action {
  return LIFECYCLE[keyName(press)] ?? { type: "search-key", press };
}
