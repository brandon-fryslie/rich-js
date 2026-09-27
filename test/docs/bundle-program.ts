/**
 * Bundle a JavaScript entry into the one self-contained script
 * `runInTerminal` (docs/.vitepress/simulated-process.ts) takes: every import
 * inlined, no import or export left in the output.
 *
 * Test support for that module's two suites, the unit one here and the browser
 * one in e2e/. It goes through `vite`, the bundler this repository already
 * declares, rather than the rolldown underneath it, which nothing declares.
 */
import { build } from "vite";
import { resolve } from "node:path";

export const REPO_ROOT = resolve(import.meta.dirname, "..", "..");

/** An absolute import specifier for a file in this repository. */
export function repoPath(path: string): string {
  return resolve(REPO_ROOT, path);
}

const ENTRY = "\0bundle-program-entry";

export async function bundleProgram(entry: string): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    root: REPO_ROOT,
    // Left alone, a build rewrites `process.env` to `{}` at bundle time, and
    // the program's env reads never reach the stand-in `runInTerminal` binds.
    environments: { client: { keepProcessEnv: true } },
    plugins: [
      {
        name: "bundle-program-entry",
        resolveId: (id) => (id === ENTRY ? id : null),
        load: (id) => (id === ENTRY ? entry : null),
      },
    ],
    build: {
      write: false,
      minify: false,
      rolldownOptions: { input: ENTRY, output: { format: "es" } },
    },
  });
  if (!("output" in result)) {
    throw new Error("bundleProgram: vite returned no single build output");
  }
  const chunks = result.output.filter((file) => file.type === "chunk");
  const [chunk] = chunks;
  if (chunk === undefined || chunks.length !== 1) {
    throw new Error(`bundleProgram: expected one chunk, vite produced ${chunks.length}`);
  }
  return chunk.code;
}
