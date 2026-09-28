/**
 * The worker a live terminal runs one program in: it is that program's
 * process. Its first message is the program and its terminal; every later one
 * is a key typed at the terminal. Terminating the worker is how the page stops
 * the program. live-terminal.ts owns why a worker.
 */
import { runInTerminal } from "../simulated-process.js";
import type { FromWorker, ToWorker } from "./live-terminal.js";

/**
 * The worker's global scope, as far as this file uses it. Declared here rather
 * than through the WebWorker lib, which cannot share a program with the DOM lib
 * the rest of the theme is checked under.
 */
interface WorkerScope {
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
  postMessage(message: FromWorker): void;
  close(): void;
}

const scope = globalThis as unknown as WorkerScope;
const post = (message: FromWorker): void => scope.postMessage(message);

/** How a thrown value reads on the terminal, as Node reports an uncaught one. */
function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

// Keys typed before the program subscribed to its stdin have nowhere to go,
// as on a terminal whose program is not reading yet.
let deliver: (chunk: string | Uint8Array) => void = () => {};

scope.onmessage = ({ data }) => {
  switch (data.kind) {
    case "input":
      return deliver(data.chunk);
    case "run":
      return void runInTerminal(data.script, {
        ...data.terminal,
        write: (chunk) => post({ kind: "output", chunk }),
        onInput: (to) => {
          deliver = to;
        },
        exit: (code) => {
          post({ kind: "exit", code });
          scope.close();
        },
      })
        .then(
          () => null,
          (error: unknown) => describe(error),
        )
        .then((error) => {
          // A timer fires only once every queued job has run, so by then the
          // program has written all it drew in response to its body.
          setTimeout(() => post({ kind: "settled", error }), 0);
        });
  }
};
