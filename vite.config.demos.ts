/**
 * Browser bundle pipeline for demos (ticket rich-demo-site-pek.3).
 *
 * [LAW:single-enforcer] One pipeline produces every demo bundle that the docs
 * site consumes. There is no second build path: a demo is bundleable iff it
 * has a `wire.ts` exporting `mount(terminal): HarnessHandle` (the shape
 * established in rich-demo-site-pek.2's harness).
 *
 * [LAW:dataflow-not-control-flow] The set of demos is data, not code — the
 * config enumerates `examples/<name>/wire.ts` at build time. Adding a demo
 * is "create the directory and the wire.ts"; no list to edit here.
 *
 * [LAW:one-source-of-truth] The HTML shell + mount glue live as templates in
 * `examples/_browser-shell/`; per-demo staged copies under `.vite-demos/` are
 * derived. Edit the template, every demo gets the change.
 */

import { defineConfig } from "vite";
import {
  readdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesDir = resolve(__dirname, "examples");
const compiledExamplesDir = resolve(__dirname, "dist-demo", "examples");
const stagingDir = resolve(__dirname, ".vite-demos");
const shellDir = resolve(examplesDir, "_browser-shell");

// ---- Demo discovery --------------------------------------------------------
//
// A demo is *any* directory under examples/ that has a wire.ts (the
// authoring source) AND a compiled wire.js under dist-demo/ (the bundler
// input). Vite bundles the already-tsc-compiled JS so the decorator-using
// modules (mobx accessors in src/widgets/) don't need a second TS toolchain
// inside the bundler — tsc is the single TypeScript compiler in this repo.
// [LAW:single-enforcer]
function discoverDemos(): readonly string[] {
  return readdirSync(examplesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .filter((name) => existsSync(resolve(examplesDir, name, "wire.ts")))
    .filter((name) =>
      existsSync(resolve(compiledExamplesDir, name, "wire.js")),
    )
    .sort();
}

// ---- Staging ---------------------------------------------------------------
//
// For each demo, materialise `.vite-demos/<name>/{index.html,mount.ts}` from
// the templates with `__DEMO_NAME__` / `__DEMO_WIRE__` substituted. The HTML
// references `./mount.ts` (a Vite-handled TS entry); the mount imports the
// demo's wire by absolute path so Vite resolves it without alias gymnastics.
function stageDemos(demos: readonly string[]): void {
  rmSync(stagingDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });

  const htmlTmpl = readFileSync(resolve(shellDir, "index.html.tmpl"), "utf-8");
  const mountTmpl = readFileSync(resolve(shellDir, "mount.ts.tmpl"), "utf-8");

  for (const name of demos) {
    const dir = resolve(stagingDir, name);
    mkdirSync(dir, { recursive: true });
    // Absolute, forward-slashed path to the tsc-compiled wire — Vite/Rollup
    // expects POSIX-style module specifiers even on Windows.
    const wirePath = resolve(compiledExamplesDir, name, "wire.js").replace(
      /\\/g,
      "/",
    );
    writeFileSync(
      resolve(dir, "index.html"),
      htmlTmpl.replaceAll("__DEMO_NAME__", name),
    );
    writeFileSync(
      resolve(dir, "mount.ts"),
      mountTmpl.replaceAll("__DEMO_WIRE__", wirePath),
    );
  }
}

const demos = discoverDemos();
stageDemos(demos);

// Build one HTML input per demo. Vite's multi-page-app mode handles the rest.
const input: Record<string, string> = {};
for (const name of demos) {
  input[name] = resolve(stagingDir, name, "index.html");
}

// Boundary stubs for node-only modules the library happens to import at
// module top level. Today this is just `fs` (used by Console.saveText /
// Console.saveHtml — Node-only operations). [LAW:locality-or-seam] These
// aliases mark the seam where a structural fix should land: the fs-using
// methods should be extracted out of the Console class so the type itself
// forbids them in environments without a filesystem.
// Two node-only modules are reachable from `src/index.ts` via the renderables
// barrel: `fs` (Console.saveText/saveHtml) and `node:readline` (the prompt
// renderable). Both stub to the same module — calling either at runtime in a
// browser bundle throws a clear error.
const nodeStub = resolve(shellDir, "node-stub.js");
const browserStubs = {
  fs: nodeStub,
  "node:fs": nodeStub,
  readline: nodeStub,
  "node:readline": nodeStub,
};

export default defineConfig({
  root: stagingDir,
  base: "./",
  resolve: {
    alias: browserStubs,
  },
  build: {
    outDir: resolve(__dirname, "dist-demos"),
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: { input },
  },
  // xterm.js is loaded via CDN in the HTML shell, so the bundles don't need
  // it bundled. The global `Terminal` on `window` is the wire's input.
  // [LAW:locality-or-seam] The xterm.js dependency is anchored at exactly
  // one boundary (the HTML) so swapping xterm.js versions or replacing it
  // is a single-file change.
});
