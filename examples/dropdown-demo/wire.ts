/**
 * dropdown-demo — browser bootstrap. Constructs `BrowserTerminalHost` over the
 * xterm.js Terminal provided by the page shell, runs the shared demo body
 * against it, and returns the mount handle.
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
