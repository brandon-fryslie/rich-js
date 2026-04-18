import { Action } from "./state.js";

/**
 * Map keystroke to action.
 *
 * [LAW:one-source-of-truth] All keybindings are defined here.
 * Adding a binding requires only adding a row; no control flow changes.
 */

export const KEYMAP: Record<string, Action> = {
  // [LAW:one-source-of-truth] All keybindings are defined here. Add a row to add a binding.

  // Focus navigation (Tab cycles through: palette_grid → color_system → theme)
  "\t": { type: "move-focus", delta: 1 },
  "\x1b[Z": { type: "move-focus", delta: -1 }, // Shift+Tab

  // Color system navigation
  "c": { type: "cycle-color-system", delta: 1 },
  "C": { type: "cycle-color-system", delta: -1 },

  // Theme navigation
  "t": { type: "cycle-theme", delta: 1 },
  "T": { type: "cycle-theme", delta: -1 },

  // Palette mode navigation (when focus is on palette_grid)
  // Press left/right to move through the palette colors
  "\x1b[C": { type: "move-palette-selection", delta: 1 }, // Right arrow
  "\x1b[D": { type: "move-palette-selection", delta: -1 }, // Left arrow
  "l": { type: "move-palette-selection", delta: 1 }, // vim right
  "h": { type: "move-palette-selection", delta: -1 }, // vim left

  // Details toggle
  "d": { type: "toggle-details" },
  "D": { type: "toggle-details" },

  // Input mode (/ to start filtering colors)
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
