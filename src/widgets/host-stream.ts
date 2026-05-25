/**
 * hostStream — adapt a TerminalHost into a NodeJS.WritableStream-shaped value
 * that Console (and Live) can accept as its `file` option.
 *
 * [LAW:locality-or-seam] The Console-using demos (rich-strip, rich-markup-plugins,
 * themes-and-color-studio, rich-dash, claude-sessions, rich-explore) need their
 * Console output to go through a TerminalHost so the same demo code runs against
 * NodeTerminalHost in the terminal and BrowserTerminalHost in the browser. The
 * missing seam was a writable-shaped value that forwards to host.write(); this
 * adapter is exactly that, with no Console-class change required.
 *
 * [LAW:single-enforcer] One adapter, one direction (TerminalHost → Console sink).
 * Console writes only via `.write()` (verified across core/console.ts and
 * renderables/live.ts), so this is the entire contract the adapter must satisfy.
 * The `as unknown as NodeJS.WritableStream` cast at the return crosses a boundary
 * where the runtime contract is narrower than the structural type — Console's
 * `file:` option is typed as the full stream, but the implementation only
 * exercises `.write(string)`.
 *
 * [LAW:dataflow-not-control-flow] Demos never branch on environment. They build
 * a Console with `file: hostStream(host)`; whether `host` is a NodeTerminalHost
 * or a BrowserTerminalHost is the value that differs, not a code path.
 */

import type { TerminalHost } from "./terminal-host.js";

/**
 * Wrap a `TerminalHost` so its output can be threaded into `Console` via the
 * existing `file:` option. The returned object forwards `.write(chunk)` to
 * `host.write(chunk)` and reports as writable; all other Writable surface is
 * unused by Rich's render pipeline.
 *
 * Pair with `forceTerminal: true` on the Console — without it, Console treats
 * any non-undefined `file` option as non-TTY and disables color, which defeats
 * the point of routing through xterm.js.
 */
export function hostStream(host: TerminalHost): NodeJS.WritableStream {
  const stream = {
    writable: true,
    write(chunk: string | Uint8Array): boolean {
      host.write(chunk);
      return true;
    },
    end(): unknown {
      return stream;
    },
  };
  return stream as unknown as NodeJS.WritableStream;
}
