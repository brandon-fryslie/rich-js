/*
 * The test suite resolves each published name to the `src/` file it
 * publishes, in both of the places it resolves one: the type-check of `test/`
 * (`tsconfig.test.json`'s `paths`) and vitest (`resolve.alias` in
 * vitest.config.ts).
 *
 * [LAW:one-source-of-truth] `PUBLISHED_PATHS`, the walk of
 * `package.json#exports`, is the map. vitest derives its aliases from it; the
 * tsconfig cannot derive anything, so its list is a copy and this test is what
 * keeps the copy true, an entry added or retargeted in `package.json` included.
 */

import { describe, expect, it } from "vitest";
import ts from "typescript";
import path from "node:path";
import { PUBLISHED_PATHS, REPO_ROOT } from "../../scripts/repo-facts.js";

describe("published names in the test suite", () => {
  it("tsconfig.test.json maps every published name, and nothing else, to the src/ file it publishes", () => {
    const file = path.join(REPO_ROOT, "tsconfig.test.json");
    const read = ts.readConfigFile(file, ts.sys.readFile);
    if (read.error) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, "\n"));
    const paths = (read.config as { compilerOptions: { paths: Record<string, string[]> } }).compilerOptions.paths;
    const resolved = Object.fromEntries(Object.entries(paths).map(([name, targets]) => [name, targets.map((target) => path.join(REPO_ROOT, target))]));
    expect(resolved).toEqual(PUBLISHED_PATHS);
  });

  it("vitest imports a published name as the src/ module itself", async () => {
    const [published, source] = await Promise.all([import("@promptctl/rich-js"), import("../../src/index.js")]);
    expect(published.Console).toBe(source.Console);
  });
});
