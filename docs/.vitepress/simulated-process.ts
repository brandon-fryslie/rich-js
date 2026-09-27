/**
 * A terminal we supply, standing in for Node's `process`, so an example's own
 * `new Console()` — written the way a reader will copy it, with no
 * `environment:` or `file:` — writes to that terminal at its size and colour
 * depth.
 *
 * It needs no library change. `Console` falls back to the ambient `process`
 * when it is given no environment (`ambientEnvironment` in
 * src/core/console.ts), and colour detection reads the same name
 * (`detectColorSystem` in src/core/color.ts). Both are bare references to
 * `process`, so whatever `process` resolves to where the library's code runs
 * is the host it talks to.
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
 */

import type { ConsoleEnvironment, ConsoleStream } from "../../src/index.js";

/**
 * The terminal a program runs in: its size, whether it is a TTY, the
 * environment its programs see, and where its bytes go.
 *
 * [LAW:types-are-the-program] Every field is required and nothing here has a
 * default. The docs examples, the playground and the landing hero each size
 * their terminal differently, and a default would be a fourth terminal nobody
 * chose. It is a `ConsoleStream` with every answer given, so the terminal is
 * the stand-in's `stdout` as it is, with no adapter.
 */
export interface SimulatedTerminal extends ConsoleStream {
  readonly columns: number;
  readonly rows: number;
  readonly isTTY: boolean;
  /** The whole environment. Nothing from the host's own passes through. */
  readonly env: Readonly<Record<string, string>>;
}

// The async-function constructor has no global name; it is reached through an
// async function's prototype.
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  parameter: string,
  body: string,
) => (process: SimulatedProcess) => Promise<void>;

/**
 * What the program sees as `process`: the terminal on both standard streams —
 * a real terminal shows stderr where it shows stdout — and a copy of its
 * environment.
 */
export interface SimulatedProcess extends ConsoleEnvironment {
  readonly env: Record<string, string>;
  readonly stdout: SimulatedTerminal;
  readonly stderr: SimulatedTerminal;
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
  // [LAW:one-source-of-truth] The env is copied per run: a program that sets
  // `process.env.X` changes its own run and not the terminal it was handed.
  await body({ env: { ...terminal.env }, stdout: terminal, stderr: terminal });
}
