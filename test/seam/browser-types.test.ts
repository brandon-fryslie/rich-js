/*
 * The published declarations, read by a TypeScript project that has no Node.
 *
 * `browser-safe.test.ts` next door walks the runtime graph and skips erased
 * edges, because a browser cannot trip over a type at runtime. A browser's
 * *compiler* can. Public signatures once named `NodeJS.ProcessEnv`, the
 * emitted `.d.ts` carried it verbatim, and a project with no `@types/node` and
 * `skipLibCheck` off — the ordinary browser project, say one driving this
 * library through xterm.js — failed on our types with `Cannot find namespace
 * 'NodeJS'`. Nothing here could see that, because every compiler this
 * repository runs has Node's types loaded. Recorded on ticket rich-types-42o.
 *
 * [LAW:verifiable-goals] The claim is about what a consumer's compiler reads,
 * so the test makes that: the real `tsconfig.json` emits declarations into a
 * package laid out in a temp `node_modules`, beside every dependency and peer
 * the manifest names, and a consumer that imports each browser-facing entry by
 * its published specifier type-checks against it with `types: []`, a DOM lib
 * and `skipLibCheck: false`. The next `NodeJS.` or `Buffer` in a public
 * signature fails here, naming the `.d.ts` and the line.
 *
 * [LAW:behavior-not-structure] The second test is the guard on the guard: the
 * same consumer, importing every entry and then naming `NodeJS`, must fail. A consumer that picked up
 * Node's types from anywhere — a dependency's `/// <reference types="node" />`,
 * a relaxed `types` — would pass the first test for the very reason it should
 * not.
 *
 * WHAT THIS CANNOT SEE. It checks the declarations `tsc` emits from this
 * checkout, which are those `npm run build` ships, against the dependency
 * versions this checkout resolved. A consumer resolving a newer peer whose own
 * types need Node would fail where this passes.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { REPO_ROOT, PACKAGE_MANIFEST, ENTRY_BY_SPECIFIER, isBehindNodeAirlock } from "../../scripts/repo-facts.js";

const PACKAGE_NAME = PACKAGE_MANIFEST.name ?? missing("package.json has no `name` to install the package under");
const TSC = path.join(REPO_ROOT, "node_modules", "typescript", "bin", "tsc");
const TIMEOUT_MS = 120_000;

/** Every published specifier a consumer may import without opting into Node. */
const BROWSER_SPECIFIERS = [...ENTRY_BY_SPECIFIER]
  .filter(([, source]) => !isBehindNodeAirlock(source))
  .map(([specifier]) => specifier);

/** What a browser project's compiler is told: no Node, and check every `.d.ts`. */
const CONSUMER_TSCONFIG = {
  compilerOptions: {
    target: "ES2022",
    module: "ESNext",
    moduleResolution: "bundler",
    lib: ["ES2022", "DOM"],
    types: [],
    strict: true,
    skipLibCheck: false,
    // An import that resolves nowhere is an error, not a silently unchecked entry.
    noUncheckedSideEffectImports: true,
    noEmit: true,
  },
  files: ["consumer.ts"],
};

function missing(message: string): never {
  throw new Error(message);
}

/** Run tsc, returning its exit status and everything it printed. */
function tsc(cwd: string, ...args: string[]): { status: number | null; output: string } {
  const run = spawnSync(process.execPath, [TSC, ...args], { cwd, encoding: "utf8" });
  if (run.error !== undefined) throw run.error;
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

let consumer = "";

/** Every browser-facing entry, imported the way a consumer imports it. */
const IMPORT_EVERY_ENTRY = BROWSER_SPECIFIERS.map((specifier) => `import "${specifier}";\n`).join("");

/** Type-check `source` as the consumer's only file. */
function checkConsumer(source: string): { status: number | null; output: string } {
  writeFileSync(path.join(consumer, "consumer.ts"), source);
  return tsc(consumer, "-p", ".");
}

beforeAll(() => {
  consumer = mkdtempSync(path.join(tmpdir(), "browser-types-"));
  const modules = path.join(consumer, "node_modules");
  const pkg = path.join(modules, ...PACKAGE_NAME.split("/"));
  mkdirSync(pkg, { recursive: true });
  copyFileSync(path.join(REPO_ROOT, "package.json"), path.join(pkg, "package.json"));

  const emit = tsc(REPO_ROOT, "-p", "tsconfig.json", "--emitDeclarationOnly", "--outDir", path.join(pkg, "dist"));
  if (emit.status !== 0) throw new Error(`declaration emit failed\n${emit.output}`);

  // What a consumer who installed every peer has beside the package.
  const installed = Object.keys({ ...PACKAGE_MANIFEST.dependencies, ...PACKAGE_MANIFEST.peerDependencies });
  for (const name of installed) {
    const link = path.join(modules, ...name.split("/"));
    mkdirSync(path.dirname(link), { recursive: true });
    symlinkSync(path.join(REPO_ROOT, "node_modules", name), link, "dir");
  }
  writeFileSync(path.join(consumer, "tsconfig.json"), JSON.stringify(CONSUMER_TSCONFIG));
}, TIMEOUT_MS);

afterAll(() => {
  if (consumer !== "") rmSync(consumer, { recursive: true, force: true });
});

describe("the published declarations in a project with no Node types", () => {
  it("cover every entry outside the node airlock", () => {
    expect(BROWSER_SPECIFIERS).toContain(PACKAGE_NAME);
    expect(BROWSER_SPECIFIERS.length).toBeGreaterThan(1);
    expect(BROWSER_SPECIFIERS.length).toBeLessThan(ENTRY_BY_SPECIFIER.size);
  });

  it(
    "type-check for every browser-facing entry",
    () => {
      expect(checkConsumer(IMPORT_EVERY_ENTRY)).toEqual({ status: 0, output: "" });
    },
    TIMEOUT_MS,
  );

  it(
    "fail on a signature that names Node",
    () => {
      const { status, output } = checkConsumer(`${IMPORT_EVERY_ENTRY}export type Probe = NodeJS.ProcessEnv;\n`);
      expect(status).not.toBe(0);
      expect(output).toContain("Cannot find namespace 'NodeJS'");
    },
    TIMEOUT_MS,
  );
});
