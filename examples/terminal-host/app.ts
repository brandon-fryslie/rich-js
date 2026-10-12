/**
 * terminal-host: what a terminal sends a program, key by key.
 *
 * Every program in this library draws on a `TerminalHost`, and this one uses
 * nothing else: it writes to the host, reads its size, and prints each chunk
 * `onData` delivers as the bytes it is, so Tab arrives as `\t` and an arrow
 * key as its escape sequence. A resize prints the new size. Ctrl-D or Ctrl-C
 * ends it.
 *
 * It takes the host as a value and never builds one, so the same program runs
 * on `NodeTerminalHost` (main.ts — the card and `npm run terminal-host`) and on
 * `BrowserTerminalHost` over an xterm.js terminal in a page (embed.ts).
 */
import type { DataHandler, ResizeHandler, TerminalHost } from "@promptctl/rich-js/host";

const QUIT = new Set(["\x03", "\x04"]);

/** One chunk as printable text: control bytes escaped, everything else as is. */
export function describeChunk(chunk: string): string {
  return JSON.stringify(chunk).slice(1, -1).replace(/\\u001b/g, "\\e");
}

/** Run the inspector on `host` until Ctrl-D or Ctrl-C, then hand the terminal back. */
export function inspectKeys(host: TerminalHost): Promise<void> {
  const decoder = new TextDecoder();
  const { cols, rows } = host.size();
  host.setRawMode(true);
  host.write("\x1b[2J\x1b[H");
  host.write(`\x1b[1mterminal-host\x1b[0m · ${cols}x${rows}\r\n`);
  host.write("Press any key to see what it sends. Ctrl-D quits.\r\n\r\n");

  return new Promise((resolve) => {
    const onData: DataHandler = (data) => {
      const chunk = typeof data === "string" ? data : decoder.decode(data);
      if (QUIT.has(chunk)) {
        stopData();
        stopResize();
        host.setRawMode(false);
        resolve();
        return;
      }
      host.write(`key  \x1b[36m${describeChunk(chunk)}\x1b[0m\r\n`);
    };
    const onResize: ResizeHandler = (size) => {
      host.write(`size \x1b[33m${size.cols}x${size.rows}\x1b[0m\r\n`);
    };
    const stopData = host.onData(onData);
    const stopResize = host.onResize(onResize);
  });
}
