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

const QUIT = /[\x03\x04]/;
const NAMED: Record<string, string> = { "\t": "\\t", "\r": "\\r", "\n": "\\n", "\x1b": "\\e" };

/**
 * One chunk as printable text: every C0 control, DEL and C1 control escaped —
 * by name where it has one, as `\xNN` otherwise — and everything else as is,
 * so a quote or a backslash shows as the one byte it is.
 */
export function describeChunk(chunk: string): string {
  return chunk.replace(
    /[\x00-\x1f\x7f-\x9f]/g,
    (c) => NAMED[c] ?? `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`,
  );
}

/** Run the inspector on `host` until Ctrl-D or Ctrl-C, then hand the terminal back. */
export function inspectKeys(host: TerminalHost): Promise<void> {
  const decoder = new TextDecoder();
  const { cols, rows } = host.size();
  host.setRawMode(true);
  host.write("\x1b[2J\x1b[H");
  host.write(`\x1b[1mterminal-host\x1b[0m · ${cols}x${rows}\n`);
  host.write("Press any key to see what it sends. Ctrl-D or Ctrl-C quits.\n\n");

  return new Promise((resolve) => {
    const printKey = (chunk: string): void => {
      if (chunk) host.write(`key  \x1b[36m${describeChunk(chunk)}\x1b[0m\n`);
    };
    const onData: DataHandler = (data) => {
      const chunk = typeof data === "string" ? data : decoder.decode(data, { stream: true });
      // A paste or a fast typist can put the quit key inside a larger read.
      const quit = chunk.search(QUIT);
      if (quit < 0) return printKey(chunk);
      printKey(chunk.slice(0, quit));
      stopData();
      stopResize();
      stopExit();
      host.setRawMode(false);
      resolve();
    };
    const onResize: ResizeHandler = (size) => {
      host.write(`size \x1b[33m${size.cols}x${size.rows}\x1b[0m\n`);
    };
    const stopData = host.onData(onData);
    const stopResize = host.onResize(onResize);
    // Ended any other way, the program still hands back cooked mode.
    const stopExit = host.onExit(() => host.setRawMode(false));
  });
}
