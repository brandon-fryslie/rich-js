/*
 * Nothing outside the tests imports a test module.
 *
 * [LAW:one-way-deps] `test/` depends on the code it checks, never the reverse.
 * The docs build once took the repo root, the entry-point map and the compiler
 * options from the coverage verifier, so a refactor of that verifier could
 * change how the published site's examples compile. Facts both sides need live
 * in `scripts/repo-facts.ts`; this gate keeps the edge from coming back.
 *
 * Type-only imports count: a type imported from `test/` is still the importer
 * depending on a test module's shape.
 *
 * Blind spot: only `.ts` files under `NON_TEST_REGIONS` are read. The `.mjs`
 * scripts and the config files at the repository root are not.
 */

import { describe, it, expect } from "vitest";
import ts from "typescript";
import path from "node:path";
import { REPO_ROOT, isPathInside, listTypeScriptFiles, repoRelative } from "../../scripts/repo-facts.js";
import { moduleSpecifiers, parseSourceFile } from "./graph.js";
import { classifySpecifier } from "./specifiers.js";

/** Every region of the repository that is not test code. */
const NON_TEST_REGIONS = ["src", "docs", "scripts", "examples"] as const;

/**
 * Each import in `sf` that lands under `test/`, as `file:line imports target`.
 *
 * Where a relative specifier points is a fact of its path alone, so nothing is
 * resolved: a Vite asset import (`./code-font.css`) is as readable as a module.
 */
function importsOfTest(sf: ts.SourceFile): string[] {
  const file = repoRelative(sf.fileName);
  return moduleSpecifiers(sf).flatMap(({ literal }) => {
    if (classifySpecifier(literal.text).kind !== "relative") return [];
    const target = repoRelative(path.resolve(path.dirname(sf.fileName), literal.text));
    if (!isPathInside("test", target)) return [];
    const line = sf.getLineAndCharacterOfPosition(literal.getStart(sf)).line + 1;
    return [`${file}:${line} imports ${target}`];
  });
}

const FILES = NON_TEST_REGIONS.flatMap((region) => listTypeScriptFiles(region));

describe("the non-test sweep", () => {
  it("reaches every region", () => {
    // A sweep that finds nothing passes the rule below.
    const relative = FILES.map(repoRelative);
    expect(relative).toContain("src/index.ts");
    expect(relative).toContain("docs/.vitepress/example-runner.ts");
    expect(relative).toContain("scripts/repo-facts.ts");
    expect(relative.some((f) => f.startsWith("examples/"))).toBe(true);
  });
});

describe("code outside the tests", () => {
  it("imports nothing from test/", () => {
    const violations = FILES.flatMap((file) => importsOfTest(parseSourceFile(file)));
    expect(violations, `move what these need out of test/:\n${violations.join("\n")}`).toEqual([]);
  });

  it("reports a test import, type-only included, and nothing else", () => {
    const sf = ts.createSourceFile(
      path.join(REPO_ROOT, "docs/.vitepress/fixture.ts"),
      [
        `import { REPO_ROOT } from "../../scripts/repo-facts.js";`,
        `import { collectPublicExports } from "../../test/coverage/extract.js";`,
        `import type { OriginInfo } from "../../test/coverage/extract.js";`,
        `import ts from "typescript";`,
      ].join("\n"),
      ts.ScriptTarget.ES2022,
      true,
    );
    expect(importsOfTest(sf)).toEqual([
      "docs/.vitepress/fixture.ts:2 imports test/coverage/extract.js",
      "docs/.vitepress/fixture.ts:3 imports test/coverage/extract.js",
    ]);
  });
});
