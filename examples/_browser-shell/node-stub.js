/**
 * Browser-side stub for the node-only modules that `src/index.ts` happens
 * to reach (via the renderables barrel):
 *
 *   - `fs`            — used by `Console.saveText` / `Console.saveHtml`.
 *   - `node:readline` — used by the `prompt` renderable.
 *
 * Neither operation makes sense in a browser bundle. The stub turns "module
 * not found" (a confusing bundle-time failure) into a clear runtime error at
 * the exact point of misuse: if a browser bundle ever calls `writeFileSync`
 * or `createInterface`, it throws.
 *
 * [LAW:locality-or-seam] The right structural fix is to lift the node-using
 * methods out of `Console` and the prompt renderable so the *type* forbids
 * them in environments without a filesystem / readline. Until that lands,
 * this stub is the boundary marker for where the fix should land.
 */

function notInBrowser(name) {
  return function () {
    throw new Error(
      `rich-js: ${name} is not available in browser bundles — ` +
        "this code path is Node-only.",
    );
  };
}

// fs surface used by Console.saveText / Console.saveHtml.
export const writeFileSync = notInBrowser("writeFileSync");
export const readFileSync = notInBrowser("readFileSync");
export const existsSync = notInBrowser("existsSync");

// readline surface used by the prompt renderable.
export const createInterface = notInBrowser("readline.createInterface");

export default {
  writeFileSync,
  readFileSync,
  existsSync,
  createInterface,
};
