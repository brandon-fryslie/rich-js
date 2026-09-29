/**
 * TerminalHost — the capability seam between the interactive runtime and its
 * I/O environment.
 *
 * [LAW:locality-or-seam] The missing seam *was* the missing type. Before this
 * type existed, Screen and EventRouter reached for ambient `process.stdin`/
 * `process.stdout`, which crystallised them to node. With a `TerminalHost`
 * value flowing across one boundary, the same runtime code runs against any
 * implementation — node's TTY (`NodeTerminalHost`, on the `node/terminal-host`
 * subpath) or a browser xterm.js terminal (`BrowserTerminalHost`, below).
 *
 * [LAW:dataflow-not-control-flow] The runtime never branches on "am I in
 * node or browser." The host is the value that differs; the code path is
 * the same. Variability lives in which host is constructed at the program
 * entry, not in any `if` inside the runtime.
 *
 * [LAW:one-way-deps] The interface and the browser host live here, on the
 * `host` subpath; the node host lives in `src/node/terminal-host.ts`, behind
 * its own subpath, because it reads `process.stdin` / `process.stdout`. The
 * dependency runs one way — the node adapter imports this seam; nothing here
 * imports the adapter — so importing a browser-facing entry point cannot
 * reach the ambient `process` global by any path, rather than merely not
 * reaching it in practice. `test/seam/browser-safe.test.ts` is what holds
 * that direction; who reads the host at all is `HOST_ACCESS` in
 * `test/seam/ambient-process.ts`, and neither list is repeated here.
 *
 * [LAW:decomposition] This seam is not part of the interactive layer, which is
 * why it is not in it. It sits below `src/widgets/` and imports nothing from
 * it, so a program that wants to write bytes through a host — every non-
 * interactive consumer — reaches one without loading the widget set or its
 * `mobx` dependency.
 *
 * [boundaries: capabilities over context] A `TerminalHost` grants exactly
 * the I/O capabilities the runtime needs: write bytes, read input, query
 * size, observe resize, switch raw mode, read the terminal's environment,
 * hear the program end, hand the terminal back for a while, lifecycle. It is
 * not an omniscient handle to "the process."
 */

import type { Unsubscribe } from "../core/subscription.js";

// [LAW:types-are-the-program] `TerminalSize` is a *snapshot* — a value
// captured at a point in time, never mutated after construction. The
// `readonly` fields make that constraint a compile-time fact: every
// subscriber that receives one is statically forbidden from mutating
// shared state out from under later subscribers in the same fan-out.
// Hosts are free to allocate one snapshot per event and reuse the
// reference across subscribers without aliasing hazard.
export interface TerminalSize {
  readonly cols: number;
  readonly rows: number;
}

export type DataHandler = (chunk: Uint8Array | string) => void;
export type ResizeHandler = (size: TerminalSize) => void;
export type ExitHandler = () => void;

export interface TerminalHost {
  /**
   * Write raw bytes (or UTF-8 text) to the terminal as a program's output
   * reaches it: no escape interpretation, no framing, and a terminal on a
   * tty receives each newline as carriage return + newline, the tty's own
   * output translation, which node's raw mode leaves on. A host with no tty
   * in front of its terminal does that translation itself.
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
   * Whether the host is connected to a real interactive terminal — input and
   * output both: what an interactive program checks before it starts.
   */
  readonly isTTY: boolean;

  /**
   * Whether the bytes `write` sends land on a terminal, whatever the input
   * is. Colour detection asks this: a program with piped stdin and a terminal
   * stdout still draws on a terminal, and `isTTY` would call it plain.
   */
  readonly writesToTerminal: boolean;

  /**
   * The environment a program running on this terminal sees — `TERM`,
   * `COLORTERM`, `NO_COLOR` and the rest. Colour detection reads it: what a
   * terminal can draw is a fact about the host, so it travels with the host
   * rather than being read off whatever `process` the renderer happens to
   * share a runtime with, which in a browser is none.
   */
  readonly env: NodeJS.ProcessEnv;

  /**
   * Run `handler` once, when the program ends by any path this host can
   * observe, so whoever changed the terminal can hand it back. The program
   * still ends as it would have without the handler: a signal still
   * terminates and a crash is still reported.
   */
  onExit(handler: ExitHandler): Unsubscribe;

  /**
   * Hand the terminal to whatever launched the program, and resolve once it
   * hands it back. Raw mode delivers Ctrl+Z as a key rather than a signal, so
   * suspending is something a program asks for, and it restores the terminal
   * before asking.
   */
  suspend(): Promise<void>;

  /**
   * Begin the host's lifecycle. Implementations attach whatever resources
   * they own — or no-op when there is nothing to attach. Idempotent. See
   * the concrete host's own JSDoc for what its `start()` actually does:
   * `NodeTerminalHost` and `BrowserTerminalHost` both no-op because their
   * underlying transports (process streams; a caller-managed xterm.js
   * Terminal) are already live by the time the host is constructed.
   */
  start(): void;

  /**
   * Stop the host's lifecycle. Pairs with `start`. Idempotent. After
   * `stop()`, the host releases its own subscriptions to the underlying
   * transport and clears its handler sets; the transport itself is not
   * torn down (that is the caller's concern — process streams persist;
   * an xterm.js Terminal is disposed by the caller). Re-subscribing via
   * `onData` / `onResize` after `stop()` re-engages the host.
   */
  stop(): void;
}

// ---------------------------------------------------------------------------
// BrowserTerminalHost
// ---------------------------------------------------------------------------

/**
 * Subset of xterm.js's `Terminal` surface the browser host depends on.
 *
 * [LAW:locality-or-seam] Declaring the dependency by *shape* — rather than
 * importing xterm.js's types — keeps this package free of an xterm.js
 * dev-dep at the type level, lets the browser-bundle pipeline (downstream
 * ticket) pin whichever xterm.js version it wants, and lets unit tests
 * pass a hand-built fake: ask for exactly the capabilities the host uses,
 * no more.
 */
export interface XtermDisposable {
  dispose(): void;
}

export interface XtermResizeEvent {
  cols: number;
  rows: number;
}

export interface XtermTerminal {
  readonly cols: number;
  readonly rows: number;
  write(data: Uint8Array | string): void;
  onData(handler: (data: string) => void): XtermDisposable;
  onResize(handler: (size: XtermResizeEvent) => void): XtermDisposable;
}

export interface BrowserTerminalHostOptions {
  /**
   * The xterm.js `Terminal` instance to wrap. The caller is responsible
   * for its DOM lifecycle (`terminal.open(element)`, `terminal.dispose()`)
   * — the host only owns its own subscriber lifecycle, exactly mirroring
   * `NodeTerminalHost`'s relationship to `process.stdin`/`process.stdout`.
   */
  terminal: XtermTerminal;
}

const XTERM_ENV: NodeJS.ProcessEnv = Object.freeze({
  TERM: "xterm-256color",
  COLORTERM: "truecolor",
});

export class BrowserTerminalHost implements TerminalHost {
  private readonly terminal: XtermTerminal;
  private readonly dataHandlers = new Set<DataHandler>();
  private readonly resizeHandlers = new Set<ResizeHandler>();
  private dataSubscription: XtermDisposable | undefined;
  private resizeSubscription: XtermDisposable | undefined;

  constructor(options: BrowserTerminalHostOptions) {
    this.terminal = options.terminal;
  }

  // [LAW:dataflow-not-control-flow] xterm.js is always an interactive
  // terminal — there is no "non-TTY" code path in the browser. The
  // runtime never branches on the value; this is the only sensible
  // constant for this host.
  get isTTY(): boolean {
    return true;
  }

  get writesToTerminal(): boolean {
    return true;
  }

  // What xterm.js is, stated the way a terminal states it: it identifies as
  // `xterm-256color` and draws 24-bit SGR. With no env at all, detection saw
  // an unnamed TTY and drew every colour at 16-colour depth.
  get env(): NodeJS.ProcessEnv {
    return XTERM_ENV;
  }

  // [LAW:single-enforcer] xterm.js is a terminal with no tty in front of
  // it, so this host is where the tty's newline translation happens. Left to
  // the terminal, a bare newline moves down without returning, and every row
  // a Console writes starts where the last one ended — every demo drew as a
  // staircase. Here and not in each page's xterm options, so every writer
  // through this host gets it.
  write(data: Uint8Array | string): void {
    this.terminal.write(returnBeforeNewline(data));
  }

  size(): TerminalSize {
    return { cols: this.terminal.cols, rows: this.terminal.rows };
  }

  // [LAW:dataflow-not-control-flow] xterm.js delivers keystrokes raw
  // unconditionally — there is no cooked mode to toggle. The no-op
  // matches the TerminalHost contract's documented "silently no-op when
  // the transport has no cooked mode," so callers stay uniform across
  // hosts. (Mirror: NodeTerminalHost on a non-TTY stream takes the same
  // no-op path via the optional-chain in `applyRawMode`.)
  setRawMode(_raw: boolean): void {}

  // The page owns the terminal's life: a program here ends when the page
  // does, and nothing is left to restore.
  onExit(_handler: ExitHandler): Unsubscribe {
    return () => {};
  }

  // Nothing launched the program that could take the terminal back, so the
  // hand-back is immediate.
  suspend(): Promise<void> {
    return Promise.resolve();
  }

  // [LAW:single-enforcer] One underlying `terminal.onData` subscription
  // fans out to every host-level handler — the same lazy-attach,
  // last-unsubscribe-detaches shape as NodeTerminalHost.onData. The
  // runtime never sees the underlying subscription; it sees a single
  // uniform `(handler) => Unsubscribe` API across hosts.
  onData(handler: DataHandler): Unsubscribe {
    this.dataHandlers.add(handler);
    if (!this.dataSubscription) {
      this.dataSubscription = this.terminal.onData((chunk: string) => {
        for (const h of this.dataHandlers) h(chunk);
      });
    }
    return () => {
      this.dataHandlers.delete(handler);
      if (this.dataHandlers.size === 0 && this.dataSubscription) {
        this.dataSubscription.dispose();
        this.dataSubscription = undefined;
      }
    };
  }

  onResize(handler: ResizeHandler): Unsubscribe {
    this.resizeHandlers.add(handler);
    if (!this.resizeSubscription) {
      this.resizeSubscription = this.terminal.onResize((size: XtermResizeEvent) => {
        const snapshot: TerminalSize = { cols: size.cols, rows: size.rows };
        for (const h of this.resizeHandlers) h(snapshot);
      });
    }
    return () => {
      this.resizeHandlers.delete(handler);
      if (this.resizeHandlers.size === 0 && this.resizeSubscription) {
        this.resizeSubscription.dispose();
        this.resizeSubscription = undefined;
      }
    };
  }

  start(): void {
    // [LAW:one-source-of-truth] The host does NOT own the terminal's DOM
    // lifecycle (`terminal.open` / `terminal.dispose`). That is the
    // caller's responsibility, exactly as NodeTerminalHost does not own
    // `process.stdin`/`process.stdout`. start() is here so the runtime
    // can call it uniformly across hosts; for this host there is
    // nothing to do at this seam.
  }

  stop(): void {
    // [LAW:one-source-of-truth] Symmetric teardown mirroring
    // NodeTerminalHost.stop: drop every host-level subscriber and
    // dispose the underlying terminal subscriptions. The terminal
    // itself stays alive — re-subscribing via onData/onResize after
    // stop() works, since the lazy-attach path re-creates the
    // subscription on next subscribe. Calling stop() repeatedly is
    // safe — the subscription guards make later calls no-ops.
    if (this.dataSubscription) {
      this.dataSubscription.dispose();
      this.dataSubscription = undefined;
    }
    if (this.resizeSubscription) {
      this.resizeSubscription.dispose();
      this.resizeSubscription = undefined;
    }
    this.dataHandlers.clear();
    this.resizeHandlers.clear();
  }
}

/**
 * `data` with a carriage return before every newline — the tty's ONLCR. A
 * newline byte never occurs inside a multi-byte UTF-8 character, so the bytes
 * are translated as bytes. A newline already preceded by a carriage return
 * gains a second one, which returns to a column the cursor is already in, as
 * the kernel's translation does.
 */
function returnBeforeNewline(data: Uint8Array | string): Uint8Array | string {
  if (typeof data === "string") return data.replaceAll("\n", "\r\n");
  let newlines = 0;
  for (let i = 0; i < data.length; i++) newlines += Number(data[i] === 0x0a);
  if (newlines === 0) return data;
  const out = new Uint8Array(data.length + newlines);
  let at = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === 0x0a) out[at++] = 0x0d;
    out[at++] = data[i]!;
  }
  return out;
}
