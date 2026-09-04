/**
 * Scratch harness wire — proves that BrowserTerminalHost satisfies the
 * TerminalHost contract end-to-end against a real xterm.js Terminal.
 *
 * [LAW:one-source-of-truth] The same `BrowserTerminalHost` class consumed
 * here is the only one in the package — there is no browser-only fork of
 * the runtime. This harness exists exclusively to give the build pipeline
 * (rich-demo-site-pek.3) and the headless-browser CI gate
 * (rich-demo-site-pek.5) a minimum-viable target before real demos are
 * bundled.
 *
 * [LAW:dataflow-not-control-flow] `mountHarness` does not branch on
 * "am I in node or browser." It takes an `XtermTerminal`-shaped value
 * from outside and runs the same code path it would in any environment.
 * The HTML shell happens to construct that value from xterm.js's CDN
 * build; a future test could pass a fake terminal and exercise the
 * exact same wire.
 */

import {
  BrowserTerminalHost,
  type BrowserTerminalHostOptions,
  type XtermTerminal,
  type XtermDisposable,
  type XtermResizeEvent,
  type TerminalHost,
  type TerminalSize,
  type DataHandler,
  type ResizeHandler,
} from "../../src/host/terminal-host.js";

export interface HarnessHandle {
  /** Underlying TerminalHost — exposes the full TerminalHost contract. */
  readonly host: TerminalHost;
  /** Detach the harness's own subscriptions; the terminal remains alive. */
  stop(): void;
}

/**
 * Mount the harness onto an already-open xterm.js Terminal.
 *
 * Behavior:
 *   - Writes a greeting that proves write() works.
 *   - Subscribes to onData and echoes printable keystrokes back, with
 *     Enter producing CRLF — proves onData fan-out + write() round-trip.
 *   - Subscribes to onResize and writes the new size — proves onResize
 *     fan-out and size() reflection.
 *   - On stop(), detaches all subscriptions cleanly.
 */
export function mountHarness(terminal: XtermTerminal): HarnessHandle {
  const options: BrowserTerminalHostOptions = { terminal };
  const host = new BrowserTerminalHost(options);
  host.start();

  // [LAW:dataflow-not-control-flow] The host has been told "this is a
  // raw input mode"; for xterm.js this is a documented no-op (the
  // transport already delivers raw), but we call it so any future host
  // that swaps in (e.g., a node-over-WebSocket adapter) gets the same
  // signal without the harness branching.
  host.setRawMode(true);

  const size: TerminalSize = host.size();
  host.write(`\x1b[2J\x1b[H`); // clear + cursor home
  host.write(`rich-js · BrowserTerminalHost harness\r\n`);
  host.write(`size: ${size.cols}x${size.rows} · isTTY=${host.isTTY}\r\n`);
  host.write(`type to echo, Enter for newline, Ctrl-D to detach\r\n\r\n> `);

  let detached = false;

  // [LAW:types-are-the-program] Hand-rolled `DataHandler` / `ResizeHandler`
  // values (instead of inline closures) make the harness an executable
  // type witness for the TerminalHost contract: the callbacks compile
  // iff their signatures match what `onData` / `onResize` expect.
  const dataHandler: DataHandler = (chunk) => {
    const data = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    for (const ch of data) {
      const code = ch.charCodeAt(0);
      if (code === 0x04) {
        // Ctrl-D — detach
        host.write(`\r\n[detached]\r\n`);
        unsubData();
        unsubResize();
        detached = true;
        return;
      }
      if (code === 0x0d) {
        // Enter
        host.write(`\r\n> `);
        continue;
      }
      if (code === 0x7f) {
        // Backspace
        host.write(`\b \b`);
        continue;
      }
      host.write(ch);
    }
  };

  const resizeHandler: ResizeHandler = (newSize) => {
    host.write(`\r\n[resize: ${newSize.cols}x${newSize.rows}]\r\n> `);
  };

  const unsubData = host.onData(dataHandler);
  const unsubResize = host.onResize(resizeHandler);

  return {
    host,
    stop(): void {
      if (detached) return;
      unsubData();
      unsubResize();
      host.stop();
    },
  };
}

// Default export so the HTML shell's dynamic import is ergonomic.
export default mountHarness;

// [LAW:behavior-not-structure] Re-export the disposable / resize-event
// types under names the harness consumer can use without reaching back
// into the seam file. These are the same types BrowserTerminalHost
// itself depends on — there is exactly one source for the contract.
export type { XtermTerminal, XtermDisposable, XtermResizeEvent };
