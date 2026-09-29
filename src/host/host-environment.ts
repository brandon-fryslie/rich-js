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
 * The stream's `columns` and `rows` are getters, so a console that was not
 * given a fixed size follows the host through resizes.
 */

import type { ConsoleEnvironment, ConsoleStream } from "../core/console.js";
import type { TerminalHost } from "./terminal-host.js";

// [LAW:types-are-the-program] A host always has a stream, so the return type
// says so rather than inheriting `ConsoleEnvironment`'s optional one.
export function hostEnvironment(
  host: TerminalHost,
): ConsoleEnvironment & { readonly stdout: ConsoleStream } {
  return {
    env: host.env,
    stdout: {
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
    },
  };
}
