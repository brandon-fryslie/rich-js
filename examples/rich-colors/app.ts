import process from "process";
import { Console } from "../../src/index.js";
import { initialState, reduce, colorToHex, type Action } from "./state.js";
import { buildShell } from "./views/shell.js";
import { lookupKey } from "./keymap.js";

/**
 * Main application entry point.
 *
 * [LAW:dataflow-not-control-flow] The same render loop executes every frame.
 * Variability lives in the state (parsing, palette generation), never in
 * whether the loop executes.
 */

export async function run(startColor?: string): Promise<void> {
  let state = initialState(startColor ?? "#2b923e");
  const consoleOut = new Console({ forceTerminal: true });

  // Terminal setup
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    throw new Error("rich-colors requires a TTY");
  }

  // Enter alt-screen, hide cursor
  process.stdout.write("\x1b[?1049h\x1b[?25l");

  // Set raw mode
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf-8");

  const render = (): void => {
    // Clear screen and move cursor home
    process.stdout.write("\x1b[2J\x1b[H");

    // Render the UI
    try {
      consoleOut.print(buildShell(state));
    } catch (err) {
      process.stdout.write(`\nRender error: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  };

  // Initial render
  render();

  // Status messages auto-clear after 2s. Hold the handle so a fresh status
  // cancels the previous timer instead of stacking new ones on every keypress.
  let statusTimeout: ReturnType<typeof setTimeout> | undefined;

  // Main event loop
  await new Promise<void>((resolve, reject) => {
    const onData = (chunk: string): void => {
      try {
        let action: Action;

        if (state.mode === "inputting") {
          // [LAW:dataflow-not-control-flow] Input handling dispatches actions that the
          // reducer uses to filter available colors and navigate. The same render loop
          // executes every frame; variability lives in the filter state, never in control.
          if (chunk === "\r" || chunk === "\n") {
            // Select the currently highlighted filtered color
            if (state.filteredColorNames.length > 0) {
              action = {
                type: "select-filtered-color",
                name: state.filteredColorNames[state.filteredColorIndex]!,
              };
            } else {
              action = { type: "none" };
            }
          } else if (chunk === "\x1b") {
            action = { type: "exit-input-mode" };
          } else if (chunk === "\x1b[A" || chunk === "\x1b[B") {
            // Up/Down arrows to navigate filtered colors
            const delta = chunk === "\x1b[A" ? -1 : 1;
            action = { type: "navigate-filtered-colors", delta };
          } else if (chunk === "\x7f" || chunk === "\b") {
            // Backspace: remove last character from filter
            action = {
              type: "set-input-filter",
              value: state.inputFilter.slice(0, -1),
            };
          } else if (chunk.charCodeAt(0) >= 0x20 && chunk.charCodeAt(0) < 0x7f) {
            // Printable character: add to filter
            action = {
              type: "set-input-filter",
              value: state.inputFilter + chunk,
            };
          } else {
            action = { type: "none" };
          }
        } else {
          // Normal browsing mode - context-aware key handling
          // [LAW:dataflow-not-control-flow] Arrow key behavior depends on state.focus
          // but the dispatch is deterministic: same focus always produces same action
          if (chunk === "\x1b[A" || chunk === "\x1b[B") {
            // Up/Down arrows - switch palette modes when in palette_grid
            const delta = chunk === "\x1b[A" ? -1 : 1;
            if (state.focus === "palette_grid") {
              action = { type: "cycle-palette-mode", delta };
            } else {
              action = { type: "none" };
            }
          } else if (chunk === "\x1b[C" || chunk === "\x1b[D") {
            // Left/Right arrows - context-dependent
            const delta = chunk === "\x1b[C" ? 1 : -1;
            if (state.focus === "palette_grid") {
              action = { type: "move-palette-selection", delta };
            } else if (state.focus === "color_system") {
              action = { type: "cycle-color-system", delta };
            } else if (state.focus === "theme") {
              action = { type: "cycle-theme", delta };
            } else {
              action = { type: "none" };
            }
          } else if (chunk === "\r" || chunk === "\n") {
            // Enter - context-dependent (show status message for now)
            if (state.focus === "palette_grid" && state.baseColor) {
              const palette = state.allPalettes[state.selectedPaletteMode];
              if (palette && palette.length > 0) {
                const color = palette[state.selectedColorIndexInPalette];
                if (color) {
                  action = {
                    type: "set-status",
                    message: `Selected: ${colorToHex(color)}`,
                  };
                } else {
                  action = { type: "none" };
                }
              } else {
                action = { type: "none" };
              }
            } else {
              action = { type: "none" };
            }
          } else {
            // Other keys - use keymap
            action = lookupKey(chunk);
          }

          if (action.type === "quit") {
            stdin.off("data", onData);
            resolve();
            return;
          }
        }

        // Reduce state
        const nextState = reduce(state, action);

        // Only re-render if state changed
        if (nextState !== state) {
          state = nextState;
          render();

          // Clear transient messages after a short time
          if (state.statusMessage) {
            if (statusTimeout) clearTimeout(statusTimeout);
            statusTimeout = setTimeout(() => {
              statusTimeout = undefined;
              state = reduce(state, { type: "clear-status" });
              render();
            }, 2000);
          }
        }
      } catch (err) {
        stdin.off("data", onData);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };

    stdin.on("data", onData);
  }).finally(() => {
    // Cleanup: restore terminal state
    try {
      process.stdout.write("\x1b[?1049l\x1b[?25h");
      stdin.setRawMode(false);
      stdin.pause();
    } catch {
      // Ignore errors during cleanup
    }
  });
}
