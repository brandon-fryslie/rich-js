import { Action } from "./state.js";

/**
 * Map keystroke to action.
 *
 * [LAW:one-source-of-truth] All keybindings are defined here.
 * Adding a binding requires only adding a row; no control flow changes.
 */

export const KEYMAP: Record<string, Action> = {
  // Palette mode navigation
  "\t": { type: "cycle-palette-mode", delta: 1 },
  "\x1b[Z": { type: "cycle-palette-mode", delta: -1 }, // Shift+Tab

  // Color system navigation
  "c": { type: "cycle-color-system", delta: 1 },
  "C": { type: "cycle-color-system", delta: -1 },

  // Theme navigation
  "t": { type: "cycle-theme", delta: 1 },
  "T": { type: "cycle-theme", delta: -1 },

  // Toggles
  "\x03": { type: "toggle-compare" }, // Ctrl+C (repurposed for demo)

  // Details toggle
  "d": { type: "toggle-details" },
  "D": { type: "toggle-details" },

  // Palette selection
  "\x1b[C": { type: "move-palette-selection", delta: 1 }, // Right arrow
  "\x1b[D": { type: "move-palette-selection", delta: -1 }, // Left arrow
  "l": { type: "move-palette-selection", delta: 1 }, // vim right
  "h": { type: "move-palette-selection", delta: -1 }, // vim left

  // Input mode
  "/": { type: "start-input-mode" },

  // Quit
  "q": { type: "quit" },
  "Q": { type: "quit" },

  // No-op for unmapped keys
};

/**
 * Look up the action for a keystroke.
 * Returns { type: "none" } if not found.
 */
export function lookupKey(key: string): Action {
  return KEYMAP[key] ?? { type: "none" };
}
