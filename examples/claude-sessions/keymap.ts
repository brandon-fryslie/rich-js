/**
 * Data-driven key → action tables: one for browsing, one for typing a search
 * query, which reads every key as text but the lifecycle ones.
 */

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
  | { type: "search-key"; key: string } // typing a query
  | { type: "suspend" }
  | { type: "quit" }
  | { type: "none" };

// Ctrl+Z and Ctrl+C are keys in raw mode, and act in every mode.
const LIFECYCLE: Record<string, Action> = {
  "\x1a": { type: "suspend" },
  "\x03": { type: "quit" },
};

const KEYMAP: Record<string, Action> = {
  // Movement
  "\x1b[A": { type: "move", delta: -1 },
  "\x1b[B": { type: "move", delta: 1 },
  "k": { type: "move", delta: -1 },
  "j": { type: "move", delta: 1 },
  "\x1b[5~": { type: "move", delta: -10 },
  "\x1b[6~": { type: "move", delta: 10 },
  "g": { type: "first" },
  "G": { type: "last" },

  // Context-polymorphic open/back
  "\x1b[C": { type: "open" },
  "\r": { type: "open" },
  "\n": { type: "open" },
  "l": { type: "open" },
  "\x1b[D": { type: "back" },

  // Layout
  "\\": { type: "toggle-sidebar" },
  "\t": { type: "toggle-focus" },
  "\x1b[Z": { type: "toggle-focus" }, // shift-tab

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
  "\x1b": { type: "search-exit" },

  "q": { type: "quit" },
  ...LIFECYCLE,
};

export function lookup(key: string): Action {
  return KEYMAP[key] ?? { type: "none" };
}

export function lookupTyping(key: string): Action {
  return LIFECYCLE[key] ?? { type: "search-key", key };
}
