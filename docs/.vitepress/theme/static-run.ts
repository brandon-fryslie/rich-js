/// <reference lib="dom" />
/**
 * A program run for what it prints: every byte it writes is collected, and
 * the run is over when it ends. Nothing is shown while it runs; the caller
 * draws the bytes once it is over, as the build draws a static example's.
 *
 * It runs in a sandbox (sandbox.ts), so a program that never ends, a
 * `while (true) {}` typed half-way through an edit among them, costs the page
 * nothing: at the time limit its worker is ended, and the run says so. What it
 * prints is bounded the same way, because the caller draws it on the page's
 * thread: past the output limit the worker is ended too.
 *
 * A program that does what only a terminal shows, reading what is typed at it,
 * redrawing what it drew, or running on with a timer set once its body has
 * returned, is ended as soon as it does, and the run says which: nothing it
 * prints from then on is a drawing of what it does.
 */
import { redraws } from "../example-fragments.js";
import { sandbox, type TerminalSpec } from "./sandbox.js";

/** Longer than any control sequence a program redraws with, so one split across two writes is still seen whole. */
const SEQUENCE_CHARS = 32;

/** How a static run ended. */
export type StaticEnd =
  /** The program's body returned and every job it queued has run. */
  | { readonly kind: "finished" }
  /** It failed; `report` is what a terminal shows for it, as Node reports an uncaught error. */
  | { readonly kind: "threw"; readonly report: string }
  | { readonly kind: "exited"; readonly code: number }
  /** It was still running at the time limit, and was ended there. */
  | { readonly kind: "timedOut"; readonly limitMs: number }
  /** It printed more than the output limit, and was ended there. */
  | { readonly kind: "overflowed"; readonly limitChars: number }
  /** It began reading what is typed at its terminal, which nobody types at here, and was ended there. */
  | { readonly kind: "listening" }
  /** It redrew what it drew (`redraws`), which a drawing of its bytes cannot show, and was ended there. */
  | { readonly kind: "redrew" }
  /** Its body returned with a timer still set, so it runs on past what it printed, and was ended there. */
  | { readonly kind: "ranOn" }
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
  /** How many characters it may print. */
  readonly limitChars: number;
}

/** Run `options.script`, its hidden frame in `parent`. */
export function runStatic(parent: HTMLElement, options: StaticRunOptions): StaticRun {
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let printed = 0;
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
      case "output": {
        const chunk = typeof message.chunk === "string" ? message.chunk : decoder.decode(message.chunk, { stream: true });
        // The end of the chunk before it too, for a sequence written in two writes.
        const seen = `${chunks.at(-1)?.slice(-SEQUENCE_CHARS) ?? ""}${chunk}`;
        chunks.push(chunk);
        printed += chunk.length;
        if (redraws(seen)) return finish({ kind: "redrew" });
        return printed > options.limitChars ? finish({ kind: "overflowed", limitChars: options.limitChars }) : undefined;
      }
      case "listening":
        return finish({ kind: "listening" });
      case "settled":
        return finish(message.runsOn ? { kind: "ranOn" } : { kind: "finished" });
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
