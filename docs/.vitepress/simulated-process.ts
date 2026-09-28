/**
 * A terminal we supply, standing in for Node's `process`, so an example's own
 * `new Console()` — written the way a reader will copy it, with no
 * `environment:` or `file:` — writes to that terminal at its size and colour
 * depth.
 *
 * It needs no library change. `Console` given no environment reads the bare
 * name `process` (`ambientEnvironment` in src/core/console.ts) and takes its
 * size, TTY and colour depth from that, so whatever `process` resolves to
 * where the library's code runs is the host it talks to.
 *
 * [LAW:no-shared-mutable-globals] That resolution is made lexical, never
 * global. `runInTerminal` evaluates the program as the body of a function whose
 * one parameter is named `process`, so every free `process` in the program —
 * the library bundled into it included — binds to the stand-in, while
 * `globalThis.process` is never read, written or replaced. Swapping the global
 * for the length of a run was the alternative, and it loses three ways: a
 * `Progress` example keeps running on timers after the swap is undone, two live
 * examples on one page would each overwrite the other's terminal, and in the
 * Node build the replaced object would be the build's own `process`.
 *
 * The cost of that choice is the program's shape: it has to be one
 * self-contained script with every import bundled in, and with every
 * `process` left as the free name it was written as. A bundler that
 * substitutes `process.env` at build time (vite does unless told
 * `keepProcessEnv`) cuts those reads off from the stand-in. A program that
 * still carries an `import` or `export` declaration is refused with a
 * SyntaxError, which is the loud failure it should be. Top-level `await` is
 * allowed; the body is an async function's.
 *
 * The stand-in is also enough of Node's `process` for a program that reads
 * keys: `stdin` emits what is typed at the terminal as `data`, which is all
 * `NodeTerminalHost` asks of it, so a widget example written against a real
 * TTY runs unchanged in a live terminal on a page.
 */

import type { ConsoleEnvironment, ConsoleStream } from "../../src/index.js";

/**
 * The terminal a program runs in: its size, whether it is a TTY, the
 * environment its programs see, where its bytes go, what is typed at it, and
 * what happens when its program exits.
 *
 * [LAW:types-are-the-program] Every field is required and nothing here has a
 * default. The docs examples, the playground and the landing hero each size
 * their terminal differently, and a default would be a fourth terminal nobody
 * chose. The same holds for input and exit: a build-time run and a live one
 * answer them differently, and each says how.
 */
export interface SimulatedTerminal extends ConsoleStream {
  readonly columns: number;
  readonly rows: number;
  readonly isTTY: boolean;
  /** The whole environment. Nothing from the host's own passes through. */
  readonly env: Readonly<Record<string, string>>;
  /**
   * Called once per run with the function that delivers typed input to the
   * program. A terminal nobody types at never calls it.
   */
  onInput(deliver: (chunk: string | Uint8Array) => void): void;
  /** The program called `process.exit(code)`. What that ends is the terminal's to decide. */
  exit(code: number): void;
}

// The async-function constructor has no global name; it is reached through an
// async function's prototype.
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  parameter: string,
  body: string,
) => (process: SimulatedProcess) => Promise<void>;

type Listener = (...args: never[]) => void;

/**
 * The part of a Node stream's event interface a terminal program uses:
 * `on` and `off`, returning the stream. An event the terminal never raises
 * (`resize` on a fixed-size terminal, `end` on one that never closes) can be
 * subscribed to, and never fires.
 */
class Events {
  private readonly listeners = new Map<string, Set<Listener>>();

  on(event: string, listener: Listener): this {
    this.listeners.set(event, (this.listeners.get(event) ?? new Set()).add(listener));
    return this;
  }

  off(event: string, listener: Listener): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) (listener as (...a: unknown[]) => void)(...args);
  }
}

/** The terminal's output side, as a program's `process.stdout`. */
class Output extends Events implements ConsoleStream {
  readonly columns: number;
  readonly rows: number;
  readonly isTTY: boolean;

  constructor(private readonly terminal: SimulatedTerminal) {
    super();
    this.columns = terminal.columns;
    this.rows = terminal.rows;
    this.isTTY = terminal.isTTY;
  }

  write(chunk: string | Uint8Array): boolean {
    this.terminal.write(chunk);
    return true;
  }
}

/**
 * The terminal's input side, as a program's `process.stdin`. Raw mode, pause
 * and resume answer and change nothing: the terminal delivers every key as it
 * is typed, which is what raw mode asks for.
 */
class Input extends Events {
  constructor(readonly isTTY: boolean) {
    super();
  }

  setRawMode(_raw: boolean): this {
    return this;
  }

  resume(): this {
    return this;
  }

  pause(): this {
    return this;
  }
}

/**
 * What the program sees as `process`: the terminal on both standard streams —
 * a real terminal shows stderr where it shows stdout — its keyboard on stdin,
 * a copy of its environment, and `exit`.
 */
export interface SimulatedProcess extends ConsoleEnvironment {
  readonly env: Record<string, string>;
  readonly stdin: Input;
  readonly stdout: Output;
  readonly stderr: Output;
  exit(code?: number): void;
}

/**
 * Run a bundled program with `process` bound to a stand-in for `terminal`.
 * Settles when the program's body does. Every failure rejects, one that stops
 * the program compiling included.
 */
export async function runInTerminal(program: string, terminal: SimulatedTerminal): Promise<void> {
  // "use strict" because the program was written as a module, and a sloppy body
  // would turn an assignment to an undeclared name into a global — a leak.
  const body = new AsyncFunction("process", `"use strict";\n${program}`);
  const output = new Output(terminal);
  const stdin = new Input(terminal.isTTY);
  terminal.onInput((chunk) => stdin.emit("data", chunk));
  await body({
    // [LAW:one-source-of-truth] The env is copied per run: a program that sets
    // `process.env.X` changes its own run and not the terminal it was handed.
    env: { ...terminal.env },
    stdin,
    stdout: output,
    stderr: output,
    exit: (code = 0) => terminal.exit(code),
  });
}
