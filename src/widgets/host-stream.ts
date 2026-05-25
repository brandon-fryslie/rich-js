/**
 * hostStream — adapt a `TerminalHost` into the narrow Writable surface that
 * Console (and Live) actually exercise.
 *
 * [LAW:types-are-the-program] The return type matches Console's `ConsoleSink`
 * exactly: `.write(chunk) → boolean`. Anything wider would lie about what
 * this adapter implements. Anything narrower would force a cast at the call
 * site. Calling `.pipe()`, `.cork()`, `.on('error')`, etc. is a programming
 * error that TypeScript will reject at compile time.
 *
 * [LAW:locality-or-seam] Console + Live access their sink only via `.write()`
 * — verified in src/core/console.ts (one `_file.write` call) and
 * src/renderables/live.ts (every `this._console.file.write(...)` site). So
 * this narrow surface is the entire contract they need.
 */

import type { ConsoleSink } from "../core/console.js";
import type { TerminalHost } from "./terminal-host.js";

/**
 * Wrap a `TerminalHost` so its output can be threaded into `Console` via the
 * existing `file:` option. The returned object implements `.write()` only —
 * exactly the surface Console + Live touch.
 *
 * Pair with `forceTerminal: true` on the Console — without it, Console treats
 * any non-undefined `file` option as non-TTY and disables color, which
 * defeats the point.
 */
export function hostStream(host: TerminalHost): ConsoleSink {
  return {
    write(chunk: string | Uint8Array): boolean {
      host.write(chunk);
      return true;
    },
  };
}
