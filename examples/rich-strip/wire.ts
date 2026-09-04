/**
 * rich-strip — browser bootstrap. Constructs a `BrowserTerminalHost` over an
 * already-open xterm.js Terminal and runs the shared demo body against it.
 *
 * [LAW:one-source-of-truth] The demo logic lives in app.ts. This file is the
 * browser-side mirror of index.ts; the only difference is which `TerminalHost`
 * implementation is constructed.
 */

import {
  BrowserTerminalHost,
  type TerminalHost,
  type XtermTerminal,
} from "../../src/host/terminal-host.js";
import { runDemo } from "./app.js";

export interface MountHandle {
  readonly host: TerminalHost;
  stop(): void;
}

export function mount(terminal: XtermTerminal): MountHandle {
  const host = new BrowserTerminalHost({ terminal });
  host.start();
  let demo: ReturnType<typeof runDemo>;
  try {
    demo = runDemo(host);
  } catch (err) {
    host.stop();
    throw err;
  }
  return {
    host,
    stop(): void {
      demo.stop();
      host.stop();
    },
  };
}

export default mount;
