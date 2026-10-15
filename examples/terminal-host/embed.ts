/**
 * terminal-host in a page of your own: the same program on an xterm.js
 * terminal you have already opened. Not a tab and not run by any script —
 * this is the copy-paste for embedding; test/examples/terminal-host runs it
 * against a stand-in terminal.
 *
 *   const term = new Terminal();
 *   term.open(document.getElementById("term"));
 *   const row = () => term.element.offsetHeight / term.rows;
 *   await mountInPage(term, (lines) => scrollBy({ top: lines * row() }));
 *
 * The second argument is where a wheel turn the program moves nothing with
 * goes: here, the page scrolls by that many of the terminal's rows.
 */
import { BrowserTerminalHost, type XtermTerminal } from "@promptctl/rich-js/host";
import { inspectKeys } from "./app.js";

export async function mountInPage(terminal: XtermTerminal, passWheel: (lines: number) => void): Promise<void> {
  const host = new BrowserTerminalHost({ terminal, passWheel });
  host.start();
  try {
    await inspectKeys(host);
  } finally {
    host.stop();
  }
}
