/**
 * hostEnvironment — a `TerminalHost` as the `ConsoleEnvironment` a `Console`
 * consults, so a console writing through a host asks that host every question
 * it has about its destination.
 *
 * [LAW:one-source-of-truth] A console asks its destination four things: where
 * bytes go, is it a terminal, how big is it, and — through the environment —
 * what colours it draws. A bare sink answers only the first, and the other
 * three fall to the ambient `process`: some other stream's answer in node,
 * none in a browser, where a console on xterm.js saw an unnamed TTY and drew
 * 16 colours. Handing the console the whole environment keeps all four
 * answers the host's.
 *
 * The host's size is `size()`, so the environment handed on carries no
 * `COLUMNS` or `LINES`: a console reads those ahead of the stream, and an
 * exported `COLUMNS` in the shell that launched a node host would pin the
 * console's width while the terminal it draws on is resized. The stream's
 * `columns` and `rows` are getters, so a console that was not given a fixed
 * size follows the host through resizes.
 */

import type { ConsoleEnvironment, ConsoleStream } from "../core/console.js";
import type { TerminalHost } from "./terminal-host.js";

// [LAW:types-are-the-program] A host always has a stream, so the return type
// says so rather than inheriting `ConsoleEnvironment`'s optional ones. It is
// one terminal, so stdout and stderr are the same stream — which is where a
// program's two streams land when both are attached to a terminal.
export function hostEnvironment(
  host: TerminalHost,
): ConsoleEnvironment & { readonly stdout: ConsoleStream; readonly stderr: ConsoleStream } {
  const { COLUMNS: _columns, LINES: _lines, ...env } = host.env;
  const stream: ConsoleStream = {
    write(chunk: string | Uint8Array): void {
      host.write(chunk);
    },
    get isTTY(): boolean {
      return host.isTTY;
    },
    get columns(): number {
      return host.size().cols;
    },
    get rows(): number {
      return host.size().rows;
    },
  };
  return { env, stdout: stream, stderr: stream };
}
