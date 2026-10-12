/**
 * terminal-host in a page of your own: the same program on an xterm.js
 * terminal you have already opened. Not a tab and not run by any script —
 * this is the copy-paste for embedding; test/examples/terminal-host runs it
 * against a stand-in terminal.
 *
 *   const term = new Terminal();
 *   term.open(document.getElementById("term"));
 *   await mountInPage(term);
 */
import { BrowserTerminalHost, type XtermTerminal } from "@promptctl/rich-js/host";
import { inspectKeys } from "./app.js";

export async function mountInPage(terminal: XtermTerminal): Promise<void> {
  const host = new BrowserTerminalHost({ terminal });
  host.start();
  await inspectKeys(host);
  host.stop();
}
