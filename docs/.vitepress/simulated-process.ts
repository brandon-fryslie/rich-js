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
 * parameters are named `process` and `console`, so every free `process` and
 * `console` in the program — the library bundled into it included — binds to
 * the stand-in, while the globals are never read, written or replaced.
 * Swapping the globals for the length of a run was the alternative, and it
 * loses three ways: a `Progress` example keeps running on timers after the swap
 * is undone, two live examples on one page would each overwrite the other's
 * terminal, and in the Node build the replaced object would be the build's own
 * `process`.
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
 * TTY runs unchanged in a live terminal on a page. And it is enough for one
 * that runs an `App`, which listens on `process` for the program ending: the
 * program's own `process.exit` raises `exit` as Node's does, and no signal is
 * ever raised, because nothing outside the page can send one. `kill` sends
 * nothing — the suspend it carries goes to a job no shell controls, which
 * Node's kernel would discard too.
 */

import { formatWithOptions } from "node-inspect-extracted";
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
   * Called with the function that delivers typed input to the program, once,
   * when the program first listens on `stdin` for `data`: until then nothing
   * reads what is typed, as on a terminal whose program is not reading yet. A
   * terminal nobody types at never calls what it is handed.
   */
  onInput(deliver: (chunk: string | Uint8Array) => void): void;
  /** The program called `process.exit(code)`. What that ends is the terminal's to decide. */
  exit(code: number): void;
}

// The async-function constructor has no global name; it is reached through an
// async function's prototype.
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...parametersThenBody: string[]
) => (process: SimulatedProcess, console: ProgramConsole) => Promise<void>;

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

  prependListener(event: string, listener: Listener): this {
    this.listeners.set(event, new Set([listener, ...(this.listeners.get(event) ?? [])]));
    return this;
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  off(event: string, listener: Listener): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of [...(this.listeners.get(event) ?? [])]) (listener as (...a: unknown[]) => void)(...args);
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
  constructor(
    readonly isTTY: boolean,
    /** Called each time a listener for `data` is added. */
    private readonly listening: () => void,
  ) {
    super();
  }

  override on(event: string, listener: Listener): this {
    if (event === "data") this.listening();
    return super.on(event, listener);
  }

  override prependListener(event: string, listener: Listener): this {
    if (event === "data") this.listening();
    return super.prependListener(event, listener);
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
 * a copy of its environment, the events it ends on, and `exit`.
 */
class SimulatedProcess extends Events implements ConsoleEnvironment {
  readonly pid = 1;
  readonly stdout: Output;
  readonly stderr: Output;

  constructor(
    private readonly terminal: SimulatedTerminal,
    readonly env: Record<string, string>,
    readonly stdin: Input,
  ) {
    super();
    this.stdout = new Output(terminal);
    this.stderr = this.stdout;
  }

  exit(code = 0): void {
    this.emit("exit", code);
    this.terminal.exit(code);
  }

  kill(_pid: number, _signal: string): boolean {
    return true;
  }
}

/** The part of Node's global `console` a program writes with. */
type ProgramConsole = Readonly<Record<"log" | "info" | "debug" | "warn" | "error", (...args: unknown[]) => void>>;

/** The `FORCE_COLOR` values Node colours at; any other forces colour off. */
const FORCED_COLOUR: ReadonlySet<string> = new Set(["", "1", "true", "2", "3"]);

/**
 * What the program sees as `console`: Node's, on the stand-in's streams. Each
 * call is formatted as Node's `util.format` formats it, by Node's own code
 * (node-inspect-extracted, 19 KB gzipped — a formatter written here would be a
 * second copy of Node's, drifting from it), and written with a newline — `log`,
 * `info` and `debug` to stdout, `warn` and `error` to stderr. A method Node has
 * and this lacks is not a function here, so a call to it fails loudly rather
 * than landing somewhere unseen.
 *
 * It colours as Node's does, reading the program's env at each call: any
 * `FORCE_COLOR` decides alone ("", "1", "true", "2" and "3" colour), and
 * otherwise a TTY colours unless a non-empty `NO_COLOR` or
 * `NODE_DISABLE_COLORS`, or `TERM=dumb`, says not to. Past those Node looks
 * the terminal's `TERM` up in a table this does not carry; this takes every
 * terminal as a colour one.
 */
function programConsole(process: SimulatedProcess): ProgramConsole {
  const { env } = process;
  const colours = (stream: Output): boolean =>
    env["FORCE_COLOR"] !== undefined
      ? FORCED_COLOUR.has(env["FORCE_COLOR"])
      : stream.isTTY && !env["NO_COLOR"] && !env["NODE_DISABLE_COLORS"] && env["TERM"] !== "dumb";
  const to = (stream: Output) => (...args: unknown[]) => void stream.write(`${formatWithOptions({ colors: colours(stream) }, ...args)}\n`);
  return { log: to(process.stdout), info: to(process.stdout), debug: to(process.stdout), warn: to(process.stderr), error: to(process.stderr) };
}

/**
 * Run a bundled program with `process` bound to a stand-in for `terminal`.
 * Settles when the program's body does. Every failure rejects, one that stops
 * the program compiling included.
 */
export async function runInTerminal(program: string, terminal: SimulatedTerminal): Promise<void> {
  // "use strict" because the program was written as a module, and a sloppy body
  // would turn an assignment to an undeclared name into a global — a leak.
  // [LAW:no-shared-mutable-globals] `console` is bound as `process` is, so the
  // program's free `console` writes to its terminal and not the host's
  // devtools. The body is a block so that a program declaring its own
  // `console` — every docs example's `const console = new Console()` — shadows
  // the parameter instead of redeclaring it, which is a SyntaxError.
  const body = new AsyncFunction("process", "console", `"use strict"; {\n${program}\n}`);
  let listened = false;
  const stdin: Input = new Input(terminal.isTTY, () => {
    if (listened) return;
    listened = true;
    terminal.onInput((chunk) => stdin.emit("data", chunk));
  });
  // [LAW:one-source-of-truth] The env is copied per run: a program that sets
  // `process.env.X` changes its own run and not the terminal it was handed.
  const process = new SimulatedProcess(terminal, { ...terminal.env }, stdin);
  await body(process, programConsole(process));
}
