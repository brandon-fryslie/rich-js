import process from "process";
import { Console } from "../../src/index.js";
import { initialState, reduce, type Action } from "./state.js";
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
    const termHeight = process.stdout.rows ?? 24;

    // Clear screen and move cursor home
    process.stdout.write("\x1b[2J\x1b[H");

    // Render the UI
    try {
      consoleOut.print(buildShell(state, termHeight));
    } catch (err) {
      process.stdout.write(`\nRender error: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  };

  // Initial render
  render();

  // Main event loop
  await new Promise<void>((resolve, reject) => {
    const onData = (chunk: string): void => {
      try {
        let action: Action;

        if (state.mode === "inputting") {
          // Handle raw input for color entry
          if (chunk === "\r" || chunk === "\n") {
            action = { type: "submit-input" };
          } else if (chunk === "\x1b") {
            action = { type: "exit-input-mode" };
          } else if (chunk === "\x7f" || chunk === "\b") {
            // Backspace
            action = {
              type: "set-input",
              value: state.inputColor.slice(0, -1),
            };
          } else if (chunk.charCodeAt(0) >= 0x20 && chunk.charCodeAt(0) < 0x7f) {
            // Printable character
            action = {
              type: "set-input",
              value: state.inputColor + chunk,
            };
          } else {
            action = { type: "none" };
          }
        } else {
          // Normal browsing mode - use keymap
          action = lookupKey(chunk);

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
          if (state.statusMessage && !("timeout" in state)) {
            setTimeout(() => {
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
