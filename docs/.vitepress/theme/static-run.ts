/// <reference lib="dom" />
/**
 * A program run for what it prints: every byte it writes is collected, and
 * the run is over when it ends. Nothing is shown while it runs; the caller
 * draws the bytes once it is over, as the build draws a static example's.
 *
 * It runs in a sandbox (sandbox.ts), so a program that never ends, a
 * `while (true) {}` typed half-way through an edit among them, costs the page
 * nothing: at the time limit its worker is ended, and the run says so.
 */
import { sandbox, type TerminalSpec } from "./sandbox.js";

/** How a static run ended. */
export type StaticEnd =
  /** The program's body returned and every job it queued has run. */
  | { readonly kind: "finished" }
  /** It failed; `report` is what a terminal shows for it, as Node reports an uncaught error. */
  | { readonly kind: "threw"; readonly report: string }
  | { readonly kind: "exited"; readonly code: number }
  /** It was still running at the time limit, and was ended there. */
  | { readonly kind: "timedOut"; readonly limitMs: number }
  /** It was ended by `stop`, before it ended on its own. */
  | { readonly kind: "stopped" };

/** What a static run printed, and how it ended. */
export interface StaticResult {
  readonly bytes: string;
  readonly end: StaticEnd;
}

/** A static run under way. */
export interface StaticRun {
  /** Settles once, when the run ends, however it ends. */
  readonly result: Promise<StaticResult>;
  /** End the run now, if it has not ended. */
  stop(): void;
}

export interface StaticRunOptions {
  /** The worker's script, the default export of `LIVE_RUNTIME_MODULE` (example-runner.ts). */
  readonly runtime: string;
  readonly script: string;
  readonly terminal: TerminalSpec;
  readonly limitMs: number;
}

/** Run `options.script`, its hidden frame in `parent`. */
export function runStatic(parent: HTMLElement, options: StaticRunOptions): StaticRun {
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let finish: (end: StaticEnd) => void = () => {};
  const result = new Promise<StaticResult>((resolve) => {
    // [LAW:single-enforcer] Every way a run ends comes through here, once:
    // the sandbox and the timer are ended, and a later message is no one's.
    finish = (end) => {
      finish = () => {};
      clearTimeout(limit);
      run.end();
      chunks.push(decoder.decode());
      resolve({ bytes: chunks.join(""), end });
    };
  });
  const run = sandbox(parent, options.runtime, (message) => {
    switch (message.kind) {
      case "output":
        return void chunks.push(typeof message.chunk === "string" ? message.chunk : decoder.decode(message.chunk, { stream: true }));
      case "settled":
        return finish({ kind: "finished" });
      case "crashed":
        return finish({ kind: "threw", report: message.report });
      case "exit":
        return finish({ kind: "exited", code: message.code });
      // Answers a `mark`, which a static run never sends.
      case "mark":
        return;
    }
  });
  const limit = setTimeout(() => finish({ kind: "timedOut", limitMs: options.limitMs }), options.limitMs);
  run.post({ kind: "run", script: options.script, terminal: options.terminal });
  return { result, stop: () => finish({ kind: "stopped" }) };
}
