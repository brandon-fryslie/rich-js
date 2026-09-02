/**
 * node:traceback — install `Traceback` as the process-wide crash renderer.
 *
 * [LAW:locality-or-seam] `process.on` / `process.exit` live only here, on the
 * node side of the API boundary. The `Traceback` renderable itself is pure
 * rendering and stays in the browser-safe barrel; installing it as a global
 * handler is a node capability, so it is a node subpath:
 *
 *     import { installTraceback } from "@promptctl/rich-js/node/traceback";
 *     installTraceback({ suppress: ["node_modules"] });
 *
 * [LAW:dataflow-not-control-flow] Both crash channels register the same
 * `report` function, unadapted. Neither payload is trusted to be an `Error`:
 * `@types/node` annotates `uncaughtException` with `Error`, but `throw "boom"`
 * delivers the raw string, so the annotation is a claim about the common case
 * rather than a guarantee. `report` takes `unknown` and both channels are
 * literally one code path.
 */

import { inspect } from "node:util";

import { Console } from "../core/console.js";
import { Traceback } from "../renderables/traceback.js";
import type { TracebackOptions } from "../renderables/traceback.js";

/**
 * [LAW:parse-dont-validate] The checkpoint between a crash payload, which node
 * allows to be any value at all, and `Traceback`, which renders an `Error`.
 * The return type is the proof: nothing downstream re-asks whether the payload
 * was throwable, and no raw value can reach the renderable to have `.name` and
 * `.message` read off it as `undefined`.
 *
 * A non-`Error` payload has no call site to report, so the synthesized error
 * carries an empty stack rather than the frames of this function — those point
 * into rich-js and describe nothing about the fault. `inspect` renders every
 * payload shape, including circular objects, where `String(reason)` would
 * collapse them to `[object Object]`.
 */
function toError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  const error = new Error(inspect(reason));
  error.name = "NonError";
  error.stack = "";
  return error;
}

/**
 * The handler currently registered, or a no-op standing in for "none yet".
 *
 * [LAW:no-shared-mutable-globals] The process listener registry is a shared
 * global, so the handler installed into it gets a single owner here rather
 * than a caller appending to it once per call. Holding the reference is what
 * lets `installTraceback` replace rather than accumulate.
 *
 * [LAW:types-are-the-program] A no-op rather than `null`: `process.off` on an
 * unregistered listener does nothing, so the first call needs no null check
 * and no "have we installed yet" branch. There is no absent case to handle.
 */
let installed: (reason: unknown) => void = () => {};

/**
 * Register rich tracebacks for uncaught exceptions and unhandled rejections.
 *
 * Calling this more than once replaces the previous handler — the last call
 * wins, options included — so a process always has exactly one rich crash
 * renderer no matter how many entry points reach for it.
 */
export function installTraceback(options?: TracebackOptions): void {
  const report = (reason: unknown): void => {
    // [LAW:effects-at-boundaries] Render to a string first, then perform one
    // write. `beginCapture` redirects the console's sink without setting
    // `file:`, so stderr's TTY status still drives colour depth and width —
    // a `file:` sink would report `isTTY === false` and silently strip colour.
    const out = new Console({ stderr: true });
    out.beginCapture();
    out.print(new Traceback(toError(reason), options));

    // [LAW:no-silent-failure] Exit only once the bytes have drained. When
    // stderr is a pipe (CI logs, `2>&1 | tee`), writes are asynchronous and
    // an immediate `process.exit(1)` truncates the traceback at the pipe
    // buffer — the longer the traceback, the more of it is lost, which is
    // the reverse of what a crash report should do.
    process.stderr.write(out.endCapture(), () => {
      process.exit(1);
    });
  };

  process.off("uncaughtException", installed);
  process.off("unhandledRejection", installed);

  process.on("uncaughtException", report);
  process.on("unhandledRejection", report);
  installed = report;
}
