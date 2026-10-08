/**
 * A visitor's TypeScript, turned into the script the playground runs and run
 * under the simulated process in Node, as the live terminal's worker runs it
 * in a browser: what it prints, and the visitor's own line in every error.
 * The browser half, a frame and a terminal included, is
 * e2e/playground-program.spec.ts.
 */
import { describe, expect, it } from "vitest";
import stripAnsi from "strip-ansi";
import { liveLibraryOnce } from "../../docs/.vitepress/example-runner.js";
import { runInTerminal, startInTerminal } from "../../docs/.vitepress/simulated-process.js";
import { EXAMPLE_TERMINAL } from "../../docs/.vitepress/example-terminal.js";
import { NO_SETUP, PLAYGROUND_SOURCE, oneFile, programFiles, type ProgramFiles } from "../../docs/.vitepress/example-card.js";
import { fileOf, playgroundProgram, playgroundScript, rewriteImportMeta, thrownAt } from "../../docs/.vitepress/theme/playground-program.js";

const library = liveLibraryOnce();

/** `source` as a docs block's one-file program. */
const one = (source: string): ProgramFiles => programFiles(oneFile(NO_SETUP, source));

/** What `source`, or a program of `files`, writes, and the error it ends on. */
async function play(source: string | ProgramFiles): Promise<{ readonly output: string; readonly error: unknown }> {
  const output: string[] = [];
  const script = playgroundScript(typeof source === "string" ? one(source) : source, (await library()).script);
  const error = await runInTerminal(script, { ...EXAMPLE_TERMINAL, write: (chunk) => output.push(String(chunk)), onInput: () => {}, exit: () => {} }).then(
    () => null,
    (thrown: unknown) => thrown,
  );
  return { output: stripAnsi(output.join("")), error };
}

/** Where an error's stack says it came from in the visitor's code. */
const lines = (error: unknown) =>
  [...((error as Error).stack ?? "").matchAll(new RegExp(`${PLAYGROUND_SOURCE.replace(".", "\\.")}:(\\d+):\\d+`, "g"))].map((m) => Number(m[1]));

describe("the playground's program", { timeout: 60_000 }, () => {
  it("imports the library by its published names, types and all, and prints on its own Console", async () => {
    const { output, error } = await play(
      [
        'import { Console, Table, type TableOptions } from "@promptctl/rich-js";',
        'import { TextInput } from "@promptctl/rich-js/widgets";',
        "const options: TableOptions = { title: 'Planets' };",
        "const table = new Table(options);",
        'table.addColumn("Name");',
        'table.addRow(typeof TextInput === "function" ? "Mercury" : "none");',
        "new Console().print(table);",
      ].join("\n"),
    );
    expect(error).toBeNull();
    expect(output).toContain("Planets");
    expect(output).toContain("Mercury");
  });

  it("may await at the top level", async () => {
    const { output } = await play('await new Promise((resolve) => setTimeout(resolve, 1));\nprocess.stdout.write("after");');
    expect(output).toBe("after");
  });

  it("runs code that exports, as Node runs an entry module that does", async () => {
    const { output, error } = await play('export const planet = "Mercury";\nexport default planet;\nprocess.stdout.write(planet);');
    expect(error).toBeNull();
    expect(output).toBe("Mercury");
  });

  it("reports a syntax error at the visitor's line, and runs nothing", async () => {
    const { output, error } = await play('process.stdout.write("ran");\nconst x: number = ;');
    expect(output).toBe("");
    expect(error).toBeInstanceOf(SyntaxError);
    expect(lines(error)).toEqual([2]);
  });

  it("gives each file an import.meta of its own, its hot context", async () => {
    const { output, error } = await play("process.stdout.write(typeof import.meta.hot?.accept);");
    expect(error).toBeNull();
    expect(output).toBe("function");
  });

  it("refuses any other read of import.meta at its line, which Node would answer and this could not", async () => {
    for (const read of ["import.meta.url", "import.meta", "import.meta?.hot"]) {
      const { output, error } = await play(`process.stdout.write("ran");\nconst x: unknown = ${read};`);
      expect(output).toBe("");
      expect((error as Error).message).toMatch(/reads only `import\.meta\.hot`/);
      expect(lines(error)).toEqual([2]);
    }
  });

  it("reports a thrown error at the line that threw", async () => {
    const { error } = await play('const a = 1;\n\nfunction fail(): never {\n  throw new Error("boom");\n}\nfail();');
    expect((error as Error).message).toBe("boom");
    // Thrown on line 4, from the call on line 6.
    expect(lines(error)).toEqual([4, 6]);
  });

  it("reports a thrown error at its line after a type-only line was stripped", async () => {
    const { error } = await play("interface Planet {\n  name: string;\n}\nconst p: Planet = null!;\np.name.length;");
    expect(error).toBeInstanceOf(TypeError);
    expect(lines(error)[0]).toBe(5);
  });

  it("refuses a module the library does not carry, at the import's line, naming what it may import", async () => {
    const { error } = await play('const a = 1;\nimport { chunk } from "lodash";\nchunk([1], 1);');
    expect((error as Error).message).toMatch(/^Cannot find module 'lodash'\. The playground can import .*@promptctl\/rich-js\/widgets/);
    expect(lines(error)).toEqual([2]);
  });
});

describe("a program of several files", { timeout: 60_000 }, () => {
  const shared: ProgramFiles = [
    { name: "main.ts", source: 'import { greet } from "./app.js";\nimport { name } from "../_shared/name.js";\nprocess.stdout.write(greet(name));' },
    { name: "app.ts", source: 'import { Console } from "@promptctl/rich-js";\nexport const greet = (who: string): string => `${typeof Console}:${who}`;' },
    { name: "../_shared/name.ts", source: 'export const name: string = "Mercury";' },
  ];

  it("imports its own files by relative name, each importing the library by its published names", async () => {
    const { output, error } = await play(shared);
    expect(error).toBeNull();
    expect(output).toBe("function:Mercury");
  });

  it("runs a file once, however many files import it, and hands an import cycle the exports set so far", async () => {
    const { output, error } = await play([
      { name: "main.ts", source: 'import { count } from "./counter.js";\nimport { again } from "./again.js";\nprocess.stdout.write(`${count()} ${again()}`);' },
      { name: "counter.ts", source: 'import "./again.js";\nlet runs = 0;\nruns += 1;\nexport const count = () => runs;' },
      { name: "again.ts", source: 'import { count } from "./counter.js";\nexport const again = () => count();' },
    ]);
    expect(error).toBeNull();
    expect(output).toBe("1 1");
  });

  it("names the file and line an error was thrown at, in the file that threw", async () => {
    const { error } = await play([
      { name: "main.ts", source: 'import { fail } from "./app.js";\n\nfail();' },
      { name: "app.ts", source: 'export function fail(): never {\n  throw new Error("boom");\n}' },
    ]);
    expect((error as Error).message).toBe("boom");
    expect(thrownAt((error as Error).stack!, ["main.ts", "app.ts"])).toEqual({ file: "app.ts", line: 2 });
  });

  it("reads a frame as Firefox and Safari write it, and not a file whose name only ends in a program file's", () => {
    expect(thrownAt("Error: boom\nfail@app.ts:2:9\n@main.ts:3:1", ["main.ts", "app.ts"])).toEqual({ file: "app.ts", line: 2 });
    expect(thrownAt("Error: boom\n    at fail (domain.ts:2:9)", ["main.ts"])).toBeNull();
  });

  it("refuses an import of a file the program does not have, naming the file that imports it and those it has", async () => {
    const { error } = await play([{ name: "main.ts", source: 'import { x } from "./missing.js";\nx();' }, { name: "app.ts", source: "export {};" }]);
    expect((error as Error).message).toBe("Cannot find module './missing.js' imported by main.ts. The program's files are main.ts, app.ts.");
  });

  it("refuses a file the eval cannot run at that file, claiming no line it does not know", () => {
    const files: ProgramFiles = [{ name: "main.ts", source: 'import "./app.js";' }, { name: "app.ts", source: "await Promise.resolve();" }];
    expect(playgroundProgram(files, "")).toMatchObject({ kind: "refused", at: { file: "app.ts", line: null } });
  });

  it("refuses a file that does not parse, at its own name and line, and runs nothing", async () => {
    const files: ProgramFiles = [
      { name: "main.ts", source: 'process.stdout.write("ran");\nimport "./app.js";' },
      { name: "app.ts", source: "const x: number = ;" },
    ];
    expect(playgroundProgram(files, "")).toMatchObject({ kind: "refused", report: expect.stringMatching(/\n {4}at app\.ts:1:\d+$/) });
    expect((await play(files)).output).toBe("");
  });

  it("refuses a top-level await outside the entry, which a required file cannot wait on", () => {
    const files: ProgramFiles = [{ name: "main.ts", source: 'import "./app.js";' }, { name: "app.ts", source: "await Promise.resolve();" }];
    expect(playgroundProgram(files, "")).toMatchObject({ kind: "refused", report: expect.stringMatching(/^SyntaxError: [^\n]*\n {4}at app\.ts$/) });
  });
});

describe("fileOf", () => {
  it("names a relative import's file from the entry's directory, its .js read as the .ts it is compiled from", () => {
    expect(fileOf("./app.js", "main.ts")).toBe("app.ts");
    expect(fileOf("../_capabilities/memory-file-system.js", "main.ts")).toBe("../_capabilities/memory-file-system.ts");
    expect(fileOf("./file-system.js", "../_capabilities/memory-file-system.ts")).toBe("../_capabilities/file-system.ts");
    expect(fileOf("../rich-strip/app.js", "../_capabilities/x.ts")).toBe("../rich-strip/app.ts");
    expect(fileOf("./views/panel.js", "main.ts")).toBe("views/panel.ts");
    expect(fileOf("../app.js", "views/panel.ts")).toBe("app.ts");
  });
});

describe("rewriteImportMeta", () => {
  // Sucrase's tokenizer is internal to it (sucrase/dist/parser); this is what pins it.
  it("rewrites import.meta, line breaks inside it kept, and not a string that spells it or a property named import", () => {
    const code = 'const s = "import.meta";\nimport.meta.hot;\nimport\n  . meta;\no.import.meta;\no?.import.meta;';
    expect(rewriteImportMeta(code)).toBe('const s = "import.meta";\n__richImportMeta.hot;\n__richImportMeta\n;\no.import.meta;\no?.import.meta;');
  });
});

describe("hot replacement", { timeout: 60_000 }, () => {
  /** A program on the live library started in a terminal, and how to replace it with `source`. */
  async function started(source: string) {
    const { script: lib } = await library();
    const output: string[] = [];
    const compiled = (code: string) => {
      const program = playgroundProgram(one(code), lib);
      if (program.kind === "refused") throw new Error(program.report);
      return program;
    };
    const { hot, returned } = startInTerminal(compiled(source).script, { ...EXAMPLE_TERMINAL, write: (chunk) => output.push(String(chunk)), onInput: () => {}, exit: () => {} });
    await returned;
    return { output, replace: (next: string) => hot.replace(compiled(next).files) };
  }

  /** A program that writes every millisecond, `TICKS` times, and then stops, so no test leaves it running. */
  const TICKS = 200;

  /** The program a version of which counts on from what the last one carried, ticking every millisecond, writing `label` and the count. */
  const counter = (label: string) =>
    [
      'const carried = (import.meta.hot?.data["n"] ?? 0) as number;',
      "let n = carried;",
      "import.meta.hot?.accept();",
      'import.meta.hot?.dispose((data) => { data["n"] = n; });',
      `const tick = setInterval(() => { n += 1; process.stdout.write(\`${label}\${n} \`); if (n === carried + ${TICKS}) clearInterval(tick); }, 1);`,
      'process.stdin.on("data", () => {});',
    ].join("\n");

  const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  it("runs a version that accepted in its place, carrying what its dispose wrote, and stops the last one's timers", async () => {
    const { output, replace } = await started(counter("a"));
    await settle(20);
    const replaced = replace(counter("b"));
    expect(replaced.kind).toBe("replaced");
    const at = output.length;
    const last = Number(output.at(-1)!.trim().slice(1));
    await settle(20);
    const after = output.slice(at).join("");
    // Only the new version writes now, counting on from where the old one stopped.
    expect(after).not.toMatch(/a\d/);
    expect(after.trim().split(" ")[0]).toBe(`b${last + 1}`);
  });

  it("declines an edit for a program that never accepted, which runs on untouched", async () => {
    const { output, replace } = await started(`let k = 0;\nconst tick = setInterval(() => { process.stdout.write("a"); if (++k === ${TICKS}) clearInterval(tick); }, 1);`);
    expect(replace(counter("b")).kind).toBe("declined");
    await settle(10);
    const at = output.length;
    await settle(10);
    expect(output.slice(at).join("")).toMatch(/^a+$/);
  });
});
