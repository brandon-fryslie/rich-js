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
import { runInTerminal } from "../../docs/.vitepress/simulated-process.js";
import { EXAMPLE_TERMINAL } from "../../docs/.vitepress/example-terminal.js";
import { NO_SETUP, PLAYGROUND_SOURCE, oneFile, programFiles, type ProgramFiles } from "../../docs/.vitepress/example-card.js";
import { fileOf, playgroundProgram, playgroundScript, thrownAt } from "../../docs/.vitepress/theme/playground-program.js";

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

  it("refuses import.meta, which Sucrase passes and only a module may say, and runs nothing", async () => {
    expect(playgroundProgram(one('process.stdout.write("ran");\nprocess.stdout.write(String(import.meta.url));'), "")).toMatchObject({
      kind: "refused",
      report: expect.stringMatching(/^SyntaxError: .*import\.meta/),
    });
    const { output, error } = await play('process.stdout.write("ran");\nprocess.stdout.write(String(import.meta.url));');
    expect(output).toBe("");
    expect(error).toBeInstanceOf(SyntaxError);
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
