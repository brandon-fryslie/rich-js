/**
 * node:traceback — install `Traceback` as the process-wide crash renderer.
 *
 * [LAW:locality-or-seam] `process.on` / `process.exit` live only here, on the
 * node side of the API boundary. The `Traceback` renderable itself is pure
 * rendering and stays in the browser-safe barrel; installing it as a global
 * handler is a node capability, so it is a node subpath:
 *
 *     import { installTraceback } from "@promptctl/rich-js/node/traceback";
 *     installTraceback({ showLocals: true });
 *
 * [LAW:dataflow-not-control-flow] Both crash channels run the same `report`
 * pipeline. `unhandledRejection` differs only in that its payload is
 * `unknown` rather than `Error`, so it flows through `toError` first — the
 * variability is a value crossing one boundary, not a second code path.
 */

import { inspect } from "node:util";

import { Console } from "../core/console.js";
import { Traceback } from "../renderables/traceback.js";
import type { TracebackOptions } from "../renderables/traceback.js";

/**
 * [LAW:parse-dont-validate] The checkpoint between node's untyped rejection
 * payload and `Traceback`, which renders an `Error`. The return type is the
 * proof: nothing downstream re-asks whether the reason was throwable.
 *
 * A non-`Error` rejection (`Promise.reject("nope")`) has no call site to
 * report, so the synthesized error carries an empty stack rather than the
 * frames of this function — those point into rich-js and describe nothing
 * about the fault. `inspect` renders every payload shape, including circular
 * objects, where `String(reason)` would collapse them to `[object Object]`.
 */
function toError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  const error = new Error(inspect(reason));
  error.name = "UnhandledRejection";
  error.stack = "";
  return error;
}

/**
 * Register rich tracebacks for uncaught exceptions and unhandled rejections.
 * Call once, as early as possible in an application's entry point.
 */
export function installTraceback(options?: TracebackOptions): void {
  const report = (error: Error): void => {
    // [LAW:effects-at-boundaries] Render to a string first, then perform one
    // write. `beginCapture` redirects the console's sink without setting
    // `file:`, so stderr's TTY status still drives colour depth and width —
    // a `file:` sink would report `isTTY === false` and silently strip colour.
    const out = new Console({ stderr: true });
    out.beginCapture();
    out.print(new Traceback(error, options));

    // [LAW:no-silent-failure] Exit only once the bytes have drained. When
    // stderr is a pipe (CI logs, `2>&1 | tee`), writes are asynchronous and
    // an immediate `process.exit(1)` truncates the traceback at the pipe
    // buffer — the longer the traceback, the more of it is lost, which is
    // the reverse of what a crash report should do.
    process.stderr.write(out.endCapture(), () => {
      process.exit(1);
    });
  };

  process.on("uncaughtException", report);
  process.on("unhandledRejection", (reason) => {
    report(toError(reason));
  });
}
