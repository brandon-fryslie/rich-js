/**
 * The worker a live terminal runs one program in: it is that program's
 * process. Its first message is the program and its terminal; every later one
 * is a key typed at the terminal, or a mark it answers at once. Removing the
 * sandboxed frame that made the worker is how the page stops the program.
 * sandbox.ts owns why a worker, and why in a frame.
 *
 * It reaches the page as text (`LIVE_RUNTIME_MODULE` in example-runner.ts): one
 * classic script whose only statement is a call of `serve`, so nothing here may
 * use `import.meta`. Importing this module does nothing, as package.json's
 * `"sideEffects": false` promises; a bundle of a bare import of it is empty.
 */
import { runInTerminal } from "../simulated-process.js";
import type { FromWorker, ToWorker } from "./sandbox.js";

/**
 * The worker's global scope, as far as this file uses it. Declared here rather
 * than through the WebWorker lib, which cannot share a program with the DOM lib
 * the rest of the theme is checked under.
 */
interface WorkerScope extends Timers {
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
  addEventListener(type: "unhandledrejection", listener: (event: PromiseRejectionEvent) => void): void;
  addEventListener(type: "error", listener: (event: ErrorEvent) => void): void;
  postMessage(message: FromWorker): void;
  close(): void;
}

/** The timer functions a program reads off the worker's global scope. */
interface Timers {
  setTimeout(handler: (...args: unknown[]) => void, ms?: number, ...args: unknown[]): number;
  setInterval(handler: (...args: unknown[]) => void, ms?: number, ...args: unknown[]): number;
  clearTimeout(id: number | undefined): void;
  clearInterval(id: number | undefined): void;
}

/**
 * `scope`'s timers, replaced by ones that count which are still set, so the
 * worker can say whether a program whose body has returned runs on. Returns
 * the originals, which the worker's own timers use and do not count.
 */
function countTimers(scope: Timers): { readonly original: Timers; readonly set: () => boolean } {
  const original: Timers = {
    setTimeout: scope.setTimeout.bind(scope),
    setInterval: scope.setInterval.bind(scope),
    clearTimeout: scope.clearTimeout.bind(scope),
    clearInterval: scope.clearInterval.bind(scope),
  };
  const live = new Set<number>();
  scope.setTimeout = (handler, ms, ...args) => {
    const id = original.setTimeout(
      (...passed: unknown[]) => {
        live.delete(id);
        handler(...passed);
      },
      ms,
      ...args,
    );
    live.add(id);
    return id;
  };
  scope.setInterval = (handler, ms, ...args) => {
    const id = original.setInterval(handler, ms, ...args);
    live.add(id);
    return id;
  };
  // A browser keeps one pool of ids for both, and clears either through either.
  scope.clearTimeout = scope.clearInterval = (id) => {
    if (id !== undefined) live.delete(id);
    original.clearTimeout(id);
  };
  return { original, set: () => live.size > 0 };
}

/**
 * How a thrown value reads on the terminal, as Node reports an uncaught one:
 * an error's stack, which names the line of each frame it was thrown through,
 * led by its name and message; anything else as a string. Some engines' stacks
 * carry no such lead, and get one.
 */
function describe(error: unknown): string {
  if (!(error instanceof Error) || error.stack === undefined) return String(error);
  const lead = String(error);
  return error.stack.startsWith(lead) ? error.stack : `${lead}\n${error.stack}`;
}

/** Make this worker the process of the program its first message carries. */
export function serve(): void {
  const scope = globalThis as unknown as WorkerScope;
  const post = (message: FromWorker): void => scope.postMessage(message);
  const timers = countTimers(scope);

  // [LAW:single-enforcer] Every way a program can fail ends here: its body
  // rejecting, an error thrown from a task of its own (a key handler, a timer),
  // and a rejection nothing handles. Each is reported from inside the worker,
  // where the error itself is still at hand; the page would see only its message.
  const crash = (error: unknown): void => post({ kind: "crashed", report: `Uncaught ${describe(error)}` });

  scope.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
    crash(event.reason);
  });

  scope.addEventListener("error", (event) => {
    event.preventDefault();
    crash(event.error);
  });

  // Keys typed before the program subscribed to its stdin have nowhere to go,
  // as on a terminal whose program is not reading yet.
  let deliver: (chunk: string | Uint8Array) => void = () => {};

  scope.onmessage = ({ data }) => {
    switch (data.kind) {
      case "input":
        return deliver(data.chunk);
      case "mark":
        return post({ kind: "mark" });
      case "run":
        return void runInTerminal(data.script, {
          ...data.terminal,
          write: (chunk) => post({ kind: "output", chunk }),
          onInput: (to) => {
            deliver = to;
            post({ kind: "listening" });
          },
          exit: (code) => {
            post({ kind: "exit", code });
            scope.close();
          },
        }).then(
          // A timer fires only once every queued job has run, so by then the
          // program has written all it drew in response to its body.
          () => void timers.original.setTimeout(() => post({ kind: "settled", runsOn: timers.set() }), 0),
          crash,
        );
    }
  };
}
