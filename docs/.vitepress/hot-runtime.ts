/**
 * Hot module replacement for a program running under the simulated process: a
 * new version of its files run in the process the old one ran in, when the
 * program accepts it (examples/_capabilities/hot-context.ts owns what a
 * program sees).
 *
 * Re-running alone is not enough, and the shape of a replacement follows from
 * what each half of it fails without: a version run beside the last one leaves
 * both drawing, so what the last version set running is cleared first; and
 * clearing it restarts the program's own state, a clock counting from frame 0,
 * so each file is handed a record that outlives its version, and its `dispose`
 * callbacks fill it. Nothing outside a program can tell what of its state
 * should carry over, which is why a program opts in: one that never accepts
 * is restarted instead, in a new process on a cleared screen.
 */
import type { HotContext } from "../../examples/_capabilities/hot-context.js";

/** The name a program's script reaches its runtime by, bound as `process` is (simulated-process.ts). */
export const HOT_BINDING = "__richHot";

/** A file of a program as it is run: its name, and its code compiled and wrapped (theme/playground-program.ts). */
export interface RunFile {
  readonly name: string;
  readonly wrapped: string;
}

/** Runs a version of a program's files in the process, its entry's top level settling the promise. */
export type RunFiles = (files: readonly RunFile[]) => Promise<unknown>;

/** What came of an edit: run in place, or declined, for the page to restart the program on it. */
export type Replacement = { readonly kind: "replaced"; readonly ran: Promise<unknown> } | { readonly kind: "declined" };

export class HotRuntime {
  private accepted = false;
  private disposers: (() => void)[] = [];
  private readonly data = new Map<string, Record<string, unknown>>();
  private runFiles: RunFiles = () => Promise.reject(new Error("a program was replaced before it started"));

  /** `clear` ends whatever a version left running: its timers, and its listeners on the process. */
  constructor(private readonly clear: () => void) {}

  /** Run the program's first version, `files`, by `runFiles`, which runs every later one too. */
  start(runFiles: RunFiles, files: readonly RunFile[]): Promise<unknown> {
    this.runFiles = runFiles;
    return runFiles(files);
  }

  /** What `file` sees as `import.meta.hot`. */
  context(file: string): HotContext {
    const data = this.data.get(file) ?? {};
    this.data.set(file, data);
    return {
      data,
      accept: () => {
        this.accepted = true;
      },
      dispose: (callback) => {
        this.disposers.push(() => callback(data));
      },
    };
  }

  /**
   * Replace the running version with `files`, if it accepted: its `dispose`
   * callbacks run, what it left running is cleared, and `files` run in its
   * place, a new version that accepts or not on its own.
   */
  replace(files: readonly RunFile[]): Replacement {
    if (!this.accepted) return { kind: "declined" };
    for (const dispose of this.disposers.splice(0)) dispose();
    this.clear();
    this.accepted = false;
    return { kind: "replaced", ran: this.runFiles(files) };
  }
}
