/**
 * themes-and-color-studio — browser bootstrap.
 *
 * No recording / no HTML export — those are node-only operations. The
 * section tour itself is identical in both environments.
 */

import {
  BrowserTerminalHost,
  type TerminalHost,
  type XtermTerminal,
} from "../../src/host/terminal-host.js";
import { runDemo } from "./app.js";

/**
 * The xterm a printed reference is read in: `write` takes a callback that runs
 * once everything written before it is in the buffer, and `scrollToTop` puts
 * the viewport back on the first row of scrollback.
 */
export interface ReadingTerminal extends XtermTerminal {
  write(data: Uint8Array | string, callback?: () => void): void;
  scrollToTop(): void;
}

export interface MountHandle {
  readonly host: TerminalHost;
  stop(): void;
}

export function mount(terminal: ReadingTerminal): MountHandle {
  const host = new BrowserTerminalHost({ terminal });
  host.start();
  let demo: ReturnType<typeof runDemo>;
  try {
    demo = runDemo(host);
  } catch (err) {
    host.stop();
    throw err;
  }
  // The tour is printed all at once, many screens of it, and a terminal's
  // viewport follows the last row written; a reader starts at the first.
  // [LAW:no-ambient-temporal-coupling] xterm parses writes in order, so this
  // callback runs once every row the demo printed is in the buffer — the
  // ordering is xterm's, not a timer's.
  terminal.write("", () => terminal.scrollToTop());
  return {
    host,
    stop(): void {
      demo.stop();
      host.stop();
    },
  };
}

export default mount;
