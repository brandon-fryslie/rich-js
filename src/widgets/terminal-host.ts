/**
 * TerminalHost — the capability seam between the interactive runtime and its
 * I/O environment.
 *
 * [LAW:locality-or-seam] The missing seam *was* the missing type. Before this
 * type existed, Screen and EventRouter reached for ambient `process.stdin`/
 * `process.stdout`, which crystallised them to node. With a `TerminalHost`
 * value flowing across one boundary, the same runtime code runs against any
 * implementation — node's TTY (`NodeTerminalHost`, this file) or a browser
 * xterm.js terminal (a downstream ticket's adapter).
 *
 * [LAW:dataflow-not-control-flow] The runtime never branches on "am I in
 * node or browser." The host is the value that differs; the code path is
 * the same. Variability lives in which host is constructed at the program
 * entry, not in any `if` inside the runtime.
 *
 * [LAW:no-shared-mutable-globals] This file is the *single owner* of node
 * TTY access in the codebase. Every other module receives a `TerminalHost`
 * from outside. If you find yourself reaching for `process.stdin`,
 * `process.stdout`, or `setRawMode` anywhere else in the runtime or in a
 * demo, fix the call site to take a `TerminalHost` parameter instead —
 * the seam is already here; use it.
 *
 * [boundaries: capabilities over context] A `TerminalHost` grants exactly
 * the I/O capabilities the runtime needs: write bytes, read input, query
 * size, observe resize, switch raw mode, lifecycle. It is not an
 * omniscient handle to "the process."
 */

import type { Unsubscribe } from "./types.js";

export interface TerminalSize {
  cols: number;
  rows: number;
}

export type DataHandler = (chunk: Uint8Array | string) => void;
export type ResizeHandler = (size: TerminalSize) => void;

export interface TerminalHost {
  /**
   * Write raw bytes (or UTF-8 text) to the terminal. The byte sequence is
   * written verbatim; no escape interpretation, no framing.
   */
  write(data: Uint8Array | string): void;

  /**
   * Subscribe to input data. The host emits whatever its underlying
   * transport produces (Buffer on node, string on browser xterm.js); the
   * runtime's parser accepts either.
   */
  onData(handler: DataHandler): Unsubscribe;

  /**
   * Subscribe to terminal resize events. The handler fires with the new
   * size after a resize is observed.
   */
  onResize(handler: ResizeHandler): Unsubscribe;

  /** Current terminal size in cells. Always returns a valid size. */
  size(): TerminalSize;

  /**
   * Enable or disable raw mode on the input side. Implementations whose
   * transport has no "cooked" mode (xterm.js, non-TTY pipes) silently
   * no-op so callers don't need to branch on capability.
   */
  setRawMode(raw: boolean): void;

  /**
   * Whether the host is connected to a real interactive terminal. Drives
   * default option values (e.g. `manageCursor`, `manageRawMode`) in the
   * runtime; non-TTY hosts default those features off.
   */
  readonly isTTY: boolean;

  /**
   * Begin the host's lifecycle. For node this is a no-op (process streams
   * are always available); for browser xterm.js this attaches to the DOM.
   * Idempotent.
   */
  start(): void;

  /**
   * Stop the host's lifecycle. Pairs with `start`. Idempotent. After
   * `stop()`, any future writes still go to the underlying transport but
   * subscribers will not be notified of further data (the host removes
   * its underlying listeners).
   */
  stop(): void;
}

// ---------------------------------------------------------------------------
// NodeTerminalHost
// ---------------------------------------------------------------------------

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
}

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

export class NodeTerminalHost implements TerminalHost {
  private readonly stdin: NodeReadable;
  private readonly stdout: NodeWritable;
  private readonly dataHandlers = new Set<DataHandler>();
  private readonly resizeHandlers = new Set<ResizeHandler>();
  private dataListener: ((chunk: Buffer | string) => void) | undefined;
  private resizeListener: (() => void) | undefined;
  private rawModeRequested = false;

  constructor(options: NodeTerminalHostOptions = {}) {
    // [LAW:no-shared-mutable-globals] The ONLY place in the codebase that
    // reaches for `process.stdin`/`process.stdout` directly. All other
    // callers receive a `TerminalHost` and stay environment-agnostic.
    this.stdin = options.stdin ?? (process.stdin as unknown as NodeReadable);
    this.stdout = options.stdout ?? (process.stdout as unknown as NodeWritable);
  }

  get isTTY(): boolean {
    return !!this.stdin.isTTY && !!this.stdout.isTTY;
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

  start(): void {
    // No-op on node: stdin/stdout are always available. Lifecycle exists
    // so the browser host (downstream ticket) can attach to the DOM here
    // without the runtime branching on "do I need to start?"
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
