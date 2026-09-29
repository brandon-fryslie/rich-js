/**
 * dropdown-demo — browser bootstrap. Constructs `BrowserTerminalHost` over the
 * xterm.js Terminal provided by the page shell, runs the shared demo body
 * against it, and returns the mount handle. The app starts and stops the host.
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
  const demo = runDemo(host);
  return { host, stop: () => demo.stop() };
}

export default mount;
