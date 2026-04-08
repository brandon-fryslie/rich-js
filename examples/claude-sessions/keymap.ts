/**
 * Data-driven key → action table. Search-typing mode bypasses this lookup
 * and consumes raw characters directly in the app loop.
 */

export type Action =
  | { type: "move"; delta: number }
  | { type: "first" }
  | { type: "last" }
  | { type: "open" }     // sidebar: descend; viewer: no-op
  | { type: "back" }     // sidebar: ascend
  | { type: "toggle-sidebar" }
  | { type: "toggle-focus" }
  | { type: "toggle-view-mode" }
  | { type: "toggle-expand" }
  | { type: "jump-parent" }
  | { type: "jump-related" }
  | { type: "search-enter" }
  | { type: "search-next" }
  | { type: "search-prev" }
  | { type: "search-exit" }
  | { type: "quit" }
  | { type: "none" };

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

  // Sidebar navigation
  "\x1b[C": { type: "open" },
  "\r": { type: "open" },
  "\n": { type: "open" },
  "l": { type: "open" },
  "\x1b[D": { type: "back" },
  "h": { type: "back" },

  // Layout
  "\\": { type: "toggle-sidebar" },
  "b": { type: "toggle-sidebar" },
  "\t": { type: "toggle-focus" },
  "\x1b[Z": { type: "toggle-focus" }, // shift-tab

  // Viewer commands
  "v": { type: "toggle-view-mode" },
  "e": { type: "toggle-expand" },
  "p": { type: "jump-parent" },
  "r": { type: "jump-related" },

  // Search
  "/": { type: "search-enter" },
  "n": { type: "search-next" },
  "N": { type: "search-prev" },
  "\x1b": { type: "search-exit" }, // esc — also doubles as quit if no search

  // Quit
  "q": { type: "quit" },
  "\x03": { type: "quit" },
};

export function lookup(key: string): Action {
  return KEYMAP[key] ?? { type: "none" };
}
