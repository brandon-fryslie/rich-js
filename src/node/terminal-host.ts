/**
 * node:terminal-host — the `TerminalHost` implementation backed by node's
 * process streams.
 *
 * [LAW:locality-or-seam] The `TerminalHost` interface is the seam and lives
 * in `host/terminal-host.ts`, importable anywhere. *This* file is one
 * value satisfying that interface, and it reads `process.stdin` /
 * `process.stdout`, so it is a node subpath:
 *
 *     import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";
 *     const screen = new Screen(new NodeTerminalHost());
 *
 * The ambient `process` global is not an import, so it slips past the
 * module-graph reasoning that keeps the main barrel browser-safe: reading
 * `process.stdin` inside a constructor throws in a browser only when someone
 * constructs it. Moving the class here makes the boundary structural — a
 * browser bundle that never reaches for this subpath cannot reach the global
 * either.
 *
 * [LAW:no-shared-mutable-globals] Which files may read the host, and what
 * each takes off it, is `HOST_ACCESS` in `test/seam/ambient-process.ts` —
 * this file's entry carries its `why`, and a test fails when anything joins
 * the list. Deliberately not restated here: the sole-ownership sentence that
 * used to stand in this spot is what that list replaced.
 *
 * So if you find yourself reaching for `process.stdin`, `process.stdout`, or
 * `setRawMode` in the runtime or in a demo, take a `TerminalHost` parameter
 * instead. The seam is already here.
 */

import type {
  DataHandler,
  ExitHandler,
  ResizeHandler,
  TerminalHost,
  TerminalSize,
} from "../host/terminal-host.js";
import type { Unsubscribe } from "../core/subscription.js";

/**
 * Subset of NodeJS stream API the node host actually depends on. Tests
 * construct a host over PassThrough / Writable mocks; production wires it
 * to `process.stdin` / `process.stdout`.
 */
interface NodeReadable {
  on(event: "data", listener: (chunk: Buffer | string) => void): unknown;
  off(event: "data", listener: (chunk: Buffer | string) => void): unknown;
  setRawMode?(raw: boolean): unknown;
  resume?(): unknown;
  pause?(): unknown;
  readonly isTTY?: boolean;
}

interface NodeWritable {
  write(chunk: string | Uint8Array): unknown;
  on(event: "resize", listener: () => void): unknown;
  off(event: "resize", listener: () => void): unknown;
  readonly columns?: number;
  readonly rows?: number;
  readonly isTTY?: boolean;
}

/**
 * Subset of node's `process` the host hears the program end through and
 * suspends it with. Tests pass an `EventEmitter` that records `kill`, because
 * the real one would stop the test runner.
 */
interface NodeProcess {
  readonly pid: number;
  on(event: string, listener: () => void): unknown;
  off(event: string, listener: () => void): unknown;
  once(event: string, listener: () => void): unknown;
  listenerCount(event: string): number;
  kill(pid: number, signal: NodeJS.Signals): unknown;
}

/**
 * The events a program ends on without anyone having signalled it. `exit`
 * is every orderly end, `process.exit` included. `uncaughtExceptionMonitor`
 * is a crash, and node emits it ahead of every `uncaughtException` listener
 * and ahead of its own report — so a terminal handed back here is handed back
 * before any crash report prints, `installTraceback`'s included, whatever
 * order the listeners were added in.
 */
const ENDINGS = ["exit", "uncaughtExceptionMonitor"] as const;

/** The signals that end a program from outside while it holds the terminal. */
const TERMINATIONS = ["SIGINT", "SIGTERM", "SIGHUP"] as const satisfies readonly NodeJS.Signals[];

export interface NodeTerminalHostOptions {
  /**
   * Input stream. Defaults to `process.stdin` so production code does not
   * have to construct one explicitly. Tests pass a `PassThrough`.
   */
  stdin?: NodeReadable;
  /**
   * Output stream. Defaults to `process.stdout` for the same reason.
   * Tests pass a `Writable` mock.
   */
  stdout?: NodeWritable;
  /**
   * The environment colour detection reads. Defaults to `process.env`; tests
   * pass a fixed map so what the host reports does not depend on the shell
   * that ran them.
   */
  env?: NodeJS.ProcessEnv;
  /**
   * What the host hears the program end through and suspends it with.
   * Defaults to `process`; tests pass an emitter that records `kill`.
   */
  process?: NodeProcess;
}

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

export class NodeTerminalHost implements TerminalHost {
  private readonly stdin: NodeReadable;
  private readonly stdout: NodeWritable;
  private readonly process: NodeProcess;
  readonly env: NodeJS.ProcessEnv;
  private readonly dataHandlers = new Set<DataHandler>();
  private readonly resizeHandlers = new Set<ResizeHandler>();
  private dataListener: ((chunk: Buffer | string) => void) | undefined;
  private resizeListener: (() => void) | undefined;
  private rawModeRequested = false;

  constructor(options: NodeTerminalHostOptions = {}) {
    this.stdin = options.stdin ?? (process.stdin as unknown as NodeReadable);
    this.stdout = options.stdout ?? (process.stdout as unknown as NodeWritable);
    this.env = options.env ?? process.env;
    this.process = options.process ?? process;
  }

  get isTTY(): boolean {
    return !!this.stdin.isTTY && this.writesToTerminal;
  }

  get writesToTerminal(): boolean {
    return !!this.stdout.isTTY;
  }

  write(data: Uint8Array | string): void {
    this.stdout.write(data);
  }

  size(): TerminalSize {
    return {
      cols: this.stdout.columns ?? DEFAULT_COLS,
      rows: this.stdout.rows ?? DEFAULT_ROWS,
    };
  }

  setRawMode(raw: boolean): void {
    this.rawModeRequested = raw;
    this.applyRawMode(raw);
  }

  // [LAW:single-enforcer] One site decides what to do when toggling raw
  // mode on the underlying transport fails. Both `setRawMode` (call from
  // outside) and `stop` (cleanup) go through this helper so neither
  // caller has to branch on capability or exception-handling.
  //
  // [LAW:dataflow-not-control-flow] Two shapes of "the transport can't do
  // this" are absorbed identically: the optional chain handles "method
  // missing" (non-TTY streams, PassThrough in tests); the try/catch
  // handles "method exists but threw" (node's `setRawMode` throws on
  // closed or non-TTY streams). Callers see neither shape — they always
  // call `setRawMode(bool)`, and the host decides what's possible.
  //
  // The catch is silent because the only call sites are lifecycle
  // transitions: if the stream is already gone, there is nothing
  // semantically meaningful for the host to do, and surfacing the
  // exception would only make teardown brittle without giving the caller
  // a recovery path. The demos this replaces did `try { ... } catch {}`
  // at every call site for exactly this reason — absorbing it once here
  // means the pattern stops spreading.
  private applyRawMode(raw: boolean): void {
    try {
      this.stdin.setRawMode?.(raw);
    } catch {
      // Underlying stream couldn't honor the request (closed, no longer
      // a TTY, etc.). Lifecycle continues.
    }
  }

  onData(handler: DataHandler): Unsubscribe {
    this.dataHandlers.add(handler);
    // [LAW:single-enforcer] One underlying `data` listener fans out to all
    // subscribers — keeps stdin's flowing/paused state derivable from
    // "any subscribers?" instead of from per-call ref-counts scattered
    // through the runtime.
    if (!this.dataListener) {
      this.dataListener = (chunk: Buffer | string) => {
        for (const h of this.dataHandlers) h(chunk);
      };
      this.stdin.on("data", this.dataListener);
      this.stdin.resume?.();
    }
    return () => {
      this.dataHandlers.delete(handler);
      if (this.dataHandlers.size === 0 && this.dataListener) {
        this.stdin.off("data", this.dataListener);
        this.dataListener = undefined;
        // Returning stdin to paused state mirrors the symmetric "no
        // subscribers → no flow" invariant. Without this, removing the
        // last subscriber leaves stdin in flowing mode and the process
        // hangs forever waiting for an event nobody is listening for.
        this.stdin.pause?.();
      }
    };
  }

  onResize(handler: ResizeHandler): Unsubscribe {
    this.resizeHandlers.add(handler);
    if (!this.resizeListener) {
      this.resizeListener = () => {
        const size = this.size();
        for (const h of this.resizeHandlers) h(size);
      };
      this.stdout.on("resize", this.resizeListener);
    }
    return () => {
      this.resizeHandlers.delete(handler);
      if (this.resizeHandlers.size === 0 && this.resizeListener) {
        this.stdout.off("resize", this.resizeListener);
        this.resizeListener = undefined;
      }
    };
  }

  onExit(handler: ExitHandler): Unsubscribe {
    const proc = this.process;
    // [LAW:single-enforcer] Every path detaches every listener before the
    // handler runs, which is what makes it run once: the second event of a
    // crash — the monitor, then `exit` — finds nothing left to call.
    const end = (): void => {
      detach();
      handler();
    };
    // A signal a program listens for no longer terminates it, so the
    // listener owes the signal its outcome. Raised again once ours is gone,
    // it terminates — unless the program listens for it too, in which case
    // it was never going to, and that listener has already heard it.
    const terminations = TERMINATIONS.map((signal) => {
      const listener = (): void => {
        end();
        if (proc.listenerCount(signal) === 0) proc.kill(proc.pid, signal);
      };
      return { signal, listener };
    });
    const detach = (): void => {
      for (const event of ENDINGS) proc.off(event, end);
      for (const { signal, listener } of terminations) proc.off(signal, listener);
    };
    for (const event of ENDINGS) proc.on(event, end);
    for (const { signal, listener } of terminations) proc.on(signal, listener);
    return detach;
  }

  // The shell's own job control: stopped by the signal Ctrl+Z would have
  // sent outside raw mode, continued by `fg`.
  suspend(): Promise<void> {
    const proc = this.process;
    return new Promise((resolve) => {
      // A signal listener does not keep node's loop alive, so a program
      // waiting on nothing else would exit on `fg` rather than resume. The
      // timer is the program still being there to continue.
      const alive = setInterval(() => {}, 2 ** 30);
      proc.once("SIGCONT", () => {
        clearInterval(alive);
        resolve();
      });
      proc.kill(proc.pid, "SIGTSTP");
    });
  }

  start(): void {
    // No-op on node: stdin/stdout are always available. Lifecycle exists
    // so `BrowserTerminalHost` can attach to the DOM here without the
    // runtime branching on "do I need to start?"
  }

  stop(): void {
    // [LAW:one-source-of-truth] Symmetric teardown: drop every subscriber
    // and detach the underlying stream listeners. After stop(), the host
    // is in the same shape a freshly-constructed one would be in. Calling
    // stop() repeatedly is safe — the dataListener/resizeListener guards
    // make later calls no-ops.
    if (this.dataListener) {
      this.stdin.off("data", this.dataListener);
      this.dataListener = undefined;
      this.stdin.pause?.();
    }
    if (this.resizeListener) {
      this.stdout.off("resize", this.resizeListener);
      this.resizeListener = undefined;
    }
    this.dataHandlers.clear();
    this.resizeHandlers.clear();
    if (this.rawModeRequested) {
      this.applyRawMode(false);
      this.rawModeRequested = false;
    }
  }
}
