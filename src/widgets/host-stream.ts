/**
 * hostStream — adapt a `TerminalHost` into the narrow Writable surface that
 * Console (and Live) actually exercise.
 *
 * [LAW:types-are-the-program] The returned object's type tells the truth
 * about what it implements: `.write(chunk) → boolean`, `.end() → self`, and
 * `.writable: true`. It is NOT a full `NodeJS.WritableStream`; calling
 * `.pipe()`, `.cork()`, `.on('error')`, etc. is a programming error that
 * TypeScript will reject at compile time.
 *
 * [LAW:locality-or-seam] Console + Live access their `_file` only via
 * `.write()` (verified in src/core/console.ts and src/renderables/live.ts) —
 * so this narrow surface is the entire contract they need. Console's
 * declared `file:` type is wider (`NodeJS.WritableStream`) than what its
 * implementation uses; callers cross that boundary with an explicit cast at
 * the Console construction site, where the imprecision belongs.
 *
 * [LAW:single-enforcer] One adapter, one direction (TerminalHost → Console
 * sink). The cast Console requires is callers' responsibility — making this
 * function itself honest keeps the seam diagnostic about which side is wide
 * (Console's `file:` option) vs narrow (the adapter's implementation).
 *
 * Followup `rich-demo-site-pek.3.4` will widen Console's `file:` type to
 * the narrow shape (since Console only needs `.write`), eliminating the
 * caller-side cast altogether.
 */

import type { TerminalHost } from "./terminal-host.js";

/**
 * The narrow Writable surface this adapter implements — the entire contract
 * Console + Live exercise on their `_file` sink. Returned by `hostStream`.
 */
export interface RichWritable {
  /** Mirrors `NodeJS.WritableStream.writable` — always true for this adapter. */
  readonly writable: true;
  /** Forwards the chunk to `host.write(chunk)`. Returns `true` to mirror Node's contract. */
  write(chunk: string | Uint8Array): boolean;
  /** No-op; the adapter does not buffer. Returns the same stream for chaining. */
  end(): RichWritable;
}

/**
 * Wrap a `TerminalHost` so its output can be threaded into `Console` via the
 * existing `file:` option. The returned object implements only `.write()`
 * (which forwards to `host.write()`), `.end()` (no-op), and `.writable`.
 *
 * To pass the result into Console's `file:` option (which is typed as the
 * full `NodeJS.WritableStream`), cast at the call site:
 *
 *     new Console({
 *       forceTerminal: true,
 *       file: hostStream(host) as unknown as NodeJS.WritableStream,
 *     });
 *
 * Pair with `forceTerminal: true` — without it, Console treats any non-undefined
 * `file` option as non-TTY and disables color, which defeats the point.
 */
export function hostStream(host: TerminalHost): RichWritable {
  const stream: RichWritable = {
    writable: true,
    write(chunk: string | Uint8Array): boolean {
      host.write(chunk);
      return true;
    },
    end(): RichWritable {
      return stream;
    },
  };
  return stream;
}
