/**
 * rich-config — browser bootstrap.
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
