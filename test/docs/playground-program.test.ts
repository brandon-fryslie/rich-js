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
import { PLAYGROUND_SOURCE, playgroundProgram, playgroundScript } from "../../docs/.vitepress/theme/playground-program.js";

const library = liveLibraryOnce();

/** What `source` writes, and the error it ends on. */
async function play(source: string): Promise<{ readonly output: string; readonly error: unknown }> {
  const output: string[] = [];
  const script = playgroundScript(source, (await library()).script);
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
    expect(playgroundProgram('process.stdout.write("ran");\nprocess.stdout.write(String(import.meta.url));', "")).toMatchObject({
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
