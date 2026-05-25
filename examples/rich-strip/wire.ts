/**
 * rich-strip — browser bootstrap. Constructs a `BrowserTerminalHost` over an
 * already-open xterm.js Terminal and runs the shared demo body against it.
 *
 * [LAW:one-source-of-truth] The demo logic lives in app.ts. This file is the
 * browser-side mirror of index.ts; the only difference is which `TerminalHost`
 * implementation is constructed.
 *
 * The default export is `mount(terminal) → MountHandle` — the contract every
 * demo wire publishes, consumed by the staged mount.ts shell in
 * `.vite-demos/<demo>/mount.ts`.
 */

import {
  BrowserTerminalHost,
  type TerminalHost,
  type XtermTerminal,
} from "../../src/widgets/terminal-host.js";
import { runDemo } from "./app.js";

export interface MountHandle {
  readonly host: TerminalHost;
  stop(): void;
}

export function mount(terminal: XtermTerminal): MountHandle {
  const host = new BrowserTerminalHost({ terminal });
  host.start();
  const demo = runDemo(host);
  return {
    host,
    stop(): void {
      demo.stop();
      host.stop();
    },
  };
}

export default mount;
